import type { FulfillmentMode, OrderStatus, Prisma, PurchaseOrderStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { notify } from "./notify";
import { makePoNo } from "./brands";
import { brandRecipients } from "./brand-access";
import { pct } from "./policy";
import { refreshOrderStatusInTx } from "./order-fulfillment";
import { notifyFacility } from "./facility-owner";

type Tx = Prisma.TransactionClient;

export class StockError extends Error {}

// ---------------------------------------------------------------------------
// 주문에 들어 있는 브랜드 상품 줄 (직배송 / 창고 입고)
// ---------------------------------------------------------------------------
async function brandLinesOf(tx: Tx, orderId: string, itemIds?: string[]) {
  const items = await tx.orderItem.findMany({
    where: { orderId, ...(itemIds && { id: { in: itemIds } }) },
    include: {
      liveSessionProduct: {
        select: {
          id: true, liveSessionId: true, brandProductId: true, fulfillment: true, supplyPriceSnapshot: true,
          facilityProduct: { select: { id: true, brandProductId: true, fulfillment: true } },
        },
      },
    },
  });
  return items.map((it) => {
    const lsp = it.liveSessionProduct;
    const brandProductId = lsp.brandProductId ?? lsp.facilityProduct?.brandProductId ?? null;
    const fulfillment: FulfillmentMode = lsp.fulfillment ?? lsp.facilityProduct?.fulfillment ?? "DROPSHIP";
    return { item: it, lsp, brandProductId, fulfillment, facilityProductId: lsp.facilityProduct?.id ?? null };
  });
}

// 직배송 상품의 브랜드 재고가 바뀌면, 진행 중인 방송에 보이는 재고도 실제 재고를 넘지 않게 맞춘다.
// (여러 셀러·창고가 같은 상품을 팔아도 화면 재고와 실제 재고가 어긋나지 않게)
export async function capDropshipLiveStockInTx(tx: Tx, brandProductId: string, stock: number) {
  const rows = await tx.liveSessionProduct.findMany({
    where: { brandProductId, fulfillment: "DROPSHIP", isActive: true, stockSnapshot: { gt: stock }, liveSession: { status: { in: ["DRAFT", "READY", "LIVE"] } } },
    select: { id: true, liveSessionId: true },
  });
  if (!rows.length) return;
  await tx.liveSessionProduct.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { stockSnapshot: Math.max(0, stock) } });
  await tx.liveSession.updateMany({ where: { id: { in: Array.from(new Set(rows.map((r) => r.liveSessionId))) } }, data: { numberVersion: { increment: 1 } } });
}

// ---------------------------------------------------------------------------
// 결제 전 재고 확보 (주문 트랜잭션 안에서 호출)
//  - 직배송: 브랜드 실재고를 조건부로 차감. 모자라면 주문 전체를 막는다.
//  - 창고 입고(위탁): 창고 재고를 조건부로 차감. 모자라면 주문 전체를 막는다.
//  - 브랜드샵이 공개 중지됐거나, 브랜드가 상품을 숨기거나 직배송을 끈 상품은 팔 수 없다.
// ---------------------------------------------------------------------------
export async function reserveOrderStockInTx(tx: Tx, orderId: string) {
  const all = await brandLinesOf(tx, orderId);
  // 공간이 직접 등록한 상품: 창고 실재고를 조건부로 차감 (여러 방송에 같은 재고가 올라가도 초과 판매되지 않게)
  for (const l of all.filter((x) => !x.brandProductId && x.facilityProductId)) {
    const dec = await tx.facilityProduct.updateMany({ where: { id: l.facilityProductId!, stock: { gte: l.item.quantity } }, data: { stock: { decrement: l.item.quantity } } });
    if (dec.count !== 1) throw new StockError(`${l.item.productName}: 창고 재고가 부족합니다. 수량을 줄여 다시 주문해 주세요.`);
  }
  const lines = all.filter((l) => l.brandProductId);
  if (!lines.length) return [] as string[];
  const products = await tx.brandProduct.findMany({
    where: { id: { in: Array.from(new Set(lines.map((l) => l.brandProductId!))) } },
    select: { id: true, name: true, isActive: true, allowDropship: true, shop: { select: { status: true, owner: { select: { isActive: true } } } } },
  });
  const map = new Map(products.map((p) => [p.id, p]));
  const touched: string[] = [];
  for (const l of lines) {
    const p = map.get(l.brandProductId!);
    if (!p || p.shop.status !== "APPROVED" || !p.shop.owner.isActive) throw new StockError(`${l.item.productName}: 지금은 판매가 중지된 브랜드 상품입니다.`);
    if (l.fulfillment === "DROPSHIP") {
      if (!p.isActive || !p.allowDropship) throw new StockError(`${l.item.productName}: 브랜드가 판매를 중단한 상품입니다.`);
      const dec = await tx.brandProduct.updateMany({ where: { id: p.id, stock: { gte: l.item.quantity } }, data: { stock: { decrement: l.item.quantity } } });
      if (dec.count !== 1) throw new StockError(`${l.item.productName}: 브랜드 재고가 부족합니다. 수량을 줄여 다시 주문해 주세요.`);
      touched.push(p.id);
    } else if (l.facilityProductId) {
      const dec = await tx.facilityProduct.updateMany({ where: { id: l.facilityProductId, stock: { gte: l.item.quantity } }, data: { stock: { decrement: l.item.quantity } } });
      if (dec.count !== 1) throw new StockError(`${l.item.productName}: 창고 재고가 부족합니다. 수량을 줄여 다시 주문해 주세요.`);
    }
  }
  for (const id of Array.from(new Set(touched))) {
    const row = await tx.brandProduct.findUnique({ where: { id }, select: { stock: true } });
    if (row) await capDropshipLiveStockInTx(tx, id, row.stock);
  }
  return Array.from(new Set(touched));
}

// 결제 실패·발주 전 취소: 확보했던 재고(방송 재고 + 브랜드·창고 재고)를 되돌린다.
export async function releaseOrderStockInTx(tx: Tx, orderId: string, opts: { liveStock: boolean; itemIds?: string[] }) {
  const lines = await brandLinesOf(tx, orderId, opts.itemIds);
  const sessions = new Set<string>();
  for (const l of lines) {
    if (opts.liveStock) {
      await tx.liveSessionProduct.update({ where: { id: l.lsp.id }, data: { stockSnapshot: { increment: l.item.quantity } } });
      sessions.add(l.lsp.liveSessionId);
    }
    if (!l.brandProductId) {
      if (l.facilityProductId) await tx.facilityProduct.update({ where: { id: l.facilityProductId }, data: { stock: { increment: l.item.quantity } } });
      continue;
    }
    if (l.fulfillment === "DROPSHIP") await tx.brandProduct.update({ where: { id: l.brandProductId }, data: { stock: { increment: l.item.quantity } } });
    else if (l.facilityProductId) await tx.facilityProduct.update({ where: { id: l.facilityProductId }, data: { stock: { increment: l.item.quantity } } });
  }
  if (sessions.size) await tx.liveSession.updateMany({ where: { id: { in: Array.from(sessions) } }, data: { numberVersion: { increment: 1 } } });
}

// ---------------------------------------------------------------------------
// 결제 완료 주문 → 브랜드 발주서 자동 생성 (결제 확정 트랜잭션 안에서 호출, 재고는 reserveOrderStockInTx 에서 이미 확보)
//  - 브랜드 × 배송방식 별로 발주서 1장. 같은 주문으로 두 번 불려도 중복 생성되지 않는다.
// ---------------------------------------------------------------------------
export async function createPurchaseOrdersInTx(tx: Tx, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { facility: { select: { name: true, address: true, contactPhone: true } } },
  });
  if (!order) return [];
  const lines = (await brandLinesOf(tx, orderId)).filter((l) => l.brandProductId && !l.item.cancelledAt);
  if (!lines.length) return [];

  const products = await tx.brandProduct.findMany({
    where: { id: { in: Array.from(new Set(lines.map((l) => l.brandProductId!))) } },
    select: { id: true, shopId: true, supplyPrice: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const groups = new Map<string, { shopId: string; fulfillment: FulfillmentMode; lines: typeof lines }>();
  for (const line of lines) {
    const product = productMap.get(line.brandProductId!);
    if (!product) continue;
    const key = `${product.shopId}:${line.fulfillment}`;
    const group = groups.get(key) ?? { shopId: product.shopId, fulfillment: line.fulfillment, lines: [] };
    group.lines.push(line);
    groups.set(key, group);
  }

  const created: { id: string; poNo: string; shopId: string; fulfillment: FulfillmentMode; count: number }[] = [];
  for (const group of Array.from(groups.values())) {
    const exists = await tx.purchaseOrder.findUnique({
      where: { orderId_brandShopId_fulfillment: { orderId: order.id, brandShopId: group.shopId, fulfillment: group.fulfillment } },
      select: { id: true },
    });
    if (exists) continue;
    const dropship = group.fulfillment === "DROPSHIP";
    const items = group.lines.map((l) => ({
      brandProductId: l.brandProductId!, orderItemId: l.item.id, productName: l.item.productName, optionLabel: l.item.optionLabel,
      quantity: l.item.quantity, salePrice: l.item.unitPrice, supplyPrice: l.lsp.supplyPriceSnapshot ?? productMap.get(l.brandProductId!)!.supplyPrice,
    }));
    let po = null;
    for (let attempt = 0; attempt < 3 && !po; attempt++) {
      try {
        po = await tx.purchaseOrder.create({
          data: {
            poNo: makePoNo(), brandShopId: group.shopId, orderId: order.id, facilityId: order.facilityId, sellerId: order.sellerId,
            fulfillment: group.fulfillment, status: dropship ? "NEW" : "CONFIRMED", confirmedAt: dropship ? null : new Date(),
            // 창고 위탁분은 창고 재고에서 나가므로 받는 곳은 공간, 직배송은 구매자
            recipient: dropship || !order.facility ? order.buyerName : order.facility.name,
            phone: dropship || !order.facility ? order.buyerPhone : order.facility.contactPhone ?? "",
            address: dropship || !order.facility ? order.buyerAddress ?? "" : order.facility.address,
            saleAmount: items.reduce((s, i) => s + i.salePrice * i.quantity, 0),
            supplyAmount: items.reduce((s, i) => s + i.supplyPrice * i.quantity, 0),
            items: { create: items },
          },
          select: { id: true, poNo: true },
        });
      } catch (e: any) { if (e?.code !== "P2002" || String(e?.meta?.target ?? "").includes("orderId")) throw e; }
    }
    if (po) created.push({ ...po, shopId: group.shopId, fulfillment: group.fulfillment, count: items.length });
  }
  return created;
}

export async function notifyNewPurchaseOrders(created: Awaited<ReturnType<typeof createPurchaseOrdersInTx>>) {
  for (const po of created) {
    await notify({
      userId: await brandRecipients(po.shopId), type: "SYSTEM",
      title: po.fulfillment === "DROPSHIP" ? "새 발주서가 도착했습니다 (직배송)" : "창고 판매 발주서가 생성되었습니다",
      body: `${po.poNo} · 상품 ${po.count}종${po.fulfillment === "DROPSHIP" ? " · 구매자에게 발송해 주세요" : " · 창고에서 출고합니다"}`,
      link: `/brand/orders?po=${po.id}`,
    });
  }
}

// 브랜드 재고가 기준 이하로 떨어지면 브랜드에 한 번 알린다. (재입고되어 기준을 넘으면 다시 알릴 수 있게 상품 저장 시 초기화)
export async function checkLowStock(productIds: string[]) {
  if (!productIds.length) return;
  try {
    const rows = await prisma.brandProduct.findMany({
      where: { id: { in: productIds }, lowStockNotifiedAt: null },
      select: { id: true, name: true, stock: true, shopId: true, shop: { select: { lowStockThreshold: true } } },
    });
    for (const p of rows) {
      if (p.stock > p.shop.lowStockThreshold) continue;
      const claimed = await prisma.brandProduct.updateMany({ where: { id: p.id, lowStockNotifiedAt: null }, data: { lowStockNotifiedAt: new Date() } });
      if (!claimed.count) continue;
      await notify({
        userId: await brandRecipients(p.shopId), type: "SYSTEM",
        title: p.stock <= 0 ? `품절: ${p.name}` : `재고 부족: ${p.name} (${p.stock}개 남음)`,
        body: p.stock <= 0 ? "직배송 판매가 멈췄습니다. 재고를 채우면 판매처에서 다시 팔 수 있습니다." : `재고가 알림 기준(${p.shop.lowStockThreshold}개) 이하입니다.`,
        link: `/brand/products?stock=low`,
      });
    }
  } catch { /* 알림 실패는 주문을 막지 않는다 */ }
}

// 출고 전 취소: 공간이 직접 등록한 상품(발주서 없음)의 창고 재고를 되돌린다.
// (브랜드 상품은 발주 취소 때 restorePoStockInTx 가 되돌린다)
export async function restoreOwnFacilityStockInTx(tx: Tx, orderId: string, itemIds: string[]) {
  if (!itemIds.length) return;
  const lines = await brandLinesOf(tx, orderId, itemIds);
  for (const l of lines) {
    if (l.brandProductId || !l.facilityProductId) continue;
    await tx.facilityProduct.update({ where: { id: l.facilityProductId }, data: { stock: { increment: l.item.quantity } } });
  }
}

// 재고 되돌리기 (발주 취소)
export async function restorePoStockInTx(tx: Tx, poId: string) {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: poId },
    include: { items: { include: { orderItem: { select: { liveSessionProduct: { select: { facilityProductId: true } } } } } } },
  });
  if (!po) return;
  for (const item of po.items) {
    if (po.fulfillment === "DROPSHIP") {
      await tx.brandProduct.update({ where: { id: item.brandProductId }, data: { stock: { increment: item.quantity } } });
    } else {
      const fpId = item.orderItem.liveSessionProduct.facilityProductId;
      if (fpId) await tx.facilityProduct.update({ where: { id: fpId }, data: { stock: { increment: item.quantity } } });
    }
  }
}

// 이미 브랜드 정산에 들어간 발주가 취소·반품되면 다음 정산에서 자동 차감할 조정 항목을 만든다.
async function settledPoAdjustmentInTx(tx: Tx, po: { id: string; brandShopId: string; brandSettlementId: string | null; supplyAmount: number; poNo: string }, to: PurchaseOrderStatus) {
  if (!po.brandSettlementId) return false;
  const exists = await tx.brandSettlementAdjustment.findFirst({ where: { purchaseOrderId: po.id }, select: { id: true } });
  if (exists) return false;
  const st = await tx.brandSettlement.findUnique({ where: { id: po.brandSettlementId }, select: { feeRate: true } });
  const net = po.supplyAmount - pct(po.supplyAmount, st?.feeRate ?? 0);
  await tx.brandSettlementAdjustment.create({
    data: { brandShopId: po.brandShopId, purchaseOrderId: po.id, amount: -net, reason: `${po.poNo} ${to === "RETURNED" ? "반품·환불" : "취소"} (정산 후)` },
  });
  return true;
}

export type PoChange = { shopId: string; poNo: string; id: string; to: PurchaseOrderStatus; orderId: string; sellerId: string; facilityId: string | null };

// 발주서를 취소·반품 상태로 바꾼다. 출고 전 취소면 브랜드·창고 재고를 되돌린다.
export async function closePurchaseOrderInTx(tx: Tx, poId: string, to: "CANCELLED" | "RETURNED", reason: string): Promise<PoChange | null> {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: poId },
    select: { id: true, poNo: true, status: true, brandShopId: true, brandSettlementId: true, supplyAmount: true, orderId: true, sellerId: true, facilityId: true },
  });
  if (!po || po.status === "CANCELLED" || po.status === "RETURNED") return null;
  if (to === "CANCELLED") await restorePoStockInTx(tx, po.id);
  const adjusted = await settledPoAdjustmentInTx(tx, po, to);
  await tx.purchaseOrder.update({
    where: { id: po.id },
    data: { status: to, cancelledAt: new Date(), cancelReason: `${reason}${adjusted ? " · 정산 후 취소 — 다음 정산에서 자동 차감" : ""}`.slice(0, 300) },
  });
  return { shopId: po.brandShopId, poNo: po.poNo, id: po.id, to, orderId: po.orderId, sellerId: po.sellerId, facilityId: po.facilityId };
}

// ---------------------------------------------------------------------------
// 주문 상태가 바뀌면 발주서도 맞춘다 (주문 트랜잭션 안에서 호출)
// ---------------------------------------------------------------------------
export async function syncPurchaseOrdersWithOrder(tx: Tx, orderId: string, status: OrderStatus, reason?: string) {
  const pos = await tx.purchaseOrder.findMany({ where: { orderId }, select: { id: true, status: true, fulfillment: true } });
  const now = new Date();
  const changed: PoChange[] = [];
  for (const po of pos) {
    if (status === "CANCELLED" || status === "REFUNDED") {
      const to = po.status === "NEW" || po.status === "CONFIRMED" ? "CANCELLED" : po.status === "SHIPPED" || po.status === "DELIVERED" ? "RETURNED" : null;
      if (!to) continue;
      const c = await closePurchaseOrderInTx(tx, po.id, to, reason ?? "주문 취소·환불");
      if (c) changed.push(c);
      continue;
    }
    let to: PurchaseOrderStatus | null = null;
    if (status === "SHIPPED") {
      if (po.fulfillment === "WAREHOUSE" && (po.status === "NEW" || po.status === "CONFIRMED")) to = "SHIPPED";
    } else if (status === "DELIVERED") {
      // 창고 위탁 발주만 주문을 따라간다. 브랜드 직배송 발주는 브랜드가 직접 배송 완료 처리한다.
      if (po.fulfillment === "WAREHOUSE" && (po.status === "SHIPPED" || po.status === "CONFIRMED" || po.status === "NEW")) to = "DELIVERED";
    }
    if (!to) continue;
    const row = await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: to, ...(to === "SHIPPED" && { shippedAt: now }), ...(to === "DELIVERED" && { deliveredAt: now }) },
      select: { id: true, poNo: true, brandShopId: true, orderId: true, sellerId: true, facilityId: true },
    });
    changed.push({ shopId: row.brandShopId, poNo: row.poNo, id: row.id, to, orderId: row.orderId, sellerId: row.sellerId, facilityId: row.facilityId });
  }
  return changed;
}

export async function notifyPurchaseOrderChanges(changed: PoChange[]) {
  for (const c of changed) {
    if (c.to !== "CANCELLED" && c.to !== "RETURNED") continue;
    await notify({
      userId: await brandRecipients(c.shopId), type: "SYSTEM",
      title: c.to === "CANCELLED" ? "발주가 취소되었습니다" : "발주 상품이 반품·환불되었습니다",
      body: c.to === "RETURNED" ? `${c.poNo} · 반품 상품을 받으면 '반품 수령 확인'을 눌러 주세요` : c.poNo,
      link: `/brand/orders?po=${c.id}`,
    });
  }
}

// 발주서 상태 알림을 셀러 · 창고 운영자(최고관리자 · 담당 매니저)에게 각자 자기 화면 링크로 보낸다.
export async function notifyPoPartners(po: { sellerId: string; facilityId: string | null }, params: { title: string; body?: string }) {
  await notify({ userId: po.sellerId, type: "SYSTEM", ...params, link: "/seller/orders" });
  if (po.facilityId) await notifyFacility(po.facilityId, { type: "SYSTEM", ...params, link: "/facility/orders", exclude: [po.sellerId] });
}

// ---------------------------------------------------------------------------
// 브랜드가 직배송 발주를 출고·배송완료 처리하면 주문 전체 상태를 다시 맞춘다.
// (공간 직접 출고분이 섞여 있으면 그쪽도 출고·배송 완료되어야 주문 상태가 바뀐다)
// ---------------------------------------------------------------------------
export async function syncOrderFromPurchaseOrders(tx: Tx, orderId: string) {
  return refreshOrderStatusInTx(tx, orderId);
}

// 정산 금액 미리 계산용 (대시보드)
export async function brandSalesSummary(shopId: string) {
  const [open, delivered, settled] = await Promise.all([
    prisma.purchaseOrder.aggregate({ where: { brandShopId: shopId, status: { in: ["NEW", "CONFIRMED", "SHIPPED"] } }, _sum: { supplyAmount: true }, _count: true }),
    prisma.purchaseOrder.aggregate({ where: { brandShopId: shopId, status: "DELIVERED", brandSettlementId: null }, _sum: { supplyAmount: true }, _count: true }),
    prisma.brandSettlement.aggregate({ where: { brandShopId: shopId, status: "PAID" }, _sum: { payoutAmount: true } }),
  ]);
  return {
    openCount: open._count, openAmount: open._sum.supplyAmount ?? 0,
    unsettledCount: delivered._count, unsettledAmount: delivered._sum.supplyAmount ?? 0,
    paidOut: settled._sum.payoutAmount ?? 0,
  };
}
