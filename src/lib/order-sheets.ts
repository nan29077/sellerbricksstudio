import type { FulfillmentMode, PaymentMethod } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { orderNo, calcSellerCommission, formatKRW } from "./utils";
import { getPolicy, pct } from "./policy";
import { getPaymentAdapter, paymentBlockedReason } from "./adapters/payment";
import { audit } from "./audit";
import { parseOptions, PUBLIC_BRAND_SHOP } from "./brands";
import { checkLowStock, createPurchaseOrdersInTx, notifyNewPurchaseOrders, reserveOrderStockInTx, StockError } from "./purchase-orders";
import { failPendingOrder } from "./order-actions";
import { notifyFacility } from "./facility-owner";
import { isLivePlatform, livePlatformLabel } from "./live-platforms";

// ---------------------------------------------------------------------------
// 셀러 주문서 (2026-11-14~)
//  구매자는 스토리지마켓에서 사지 않는다. 셀러가 외부 라이브 플랫폼(셀러브릭스 · 그립 · 클릭메이트 …)에서 판 주문을
//  주문서로 작성하고, 상품 공급가(+ 스토리지마켓 출고 배송비)를 결제하면 발주가 나간다.
//   - 브랜드 직배송(위탁배송) 상품 → 브랜드 발주서 (브랜드가 받는 분에게 바로 출고)
//   - 스토리지마켓 창고 재고(창고 상품 · 브랜드 입고 상품) → 창고 운영자가 출고 (입고 상품은 정산용 발주서)
//  주문 · 발주 · 배송 · 취소 · 정산 처리는 기존 주문 흐름을 그대로 쓴다. (주문서마다 내부 묶음 LiveSession 을 하나 만든다)
//  한 주문서에 브랜드 직배송과 창고 출고가 섞이면, 보내는 곳별로 주문을 나눠 만든다.
// ---------------------------------------------------------------------------

export type CatalogItem = {
  code: string;                 // B-<브랜드상품id> | S-<창고상품id>
  kind: "BRAND" | "STOCK";      // 브랜드 직배송 | 스토리지마켓 창고 재고
  name: string; brandName: string | null; facilityName: string | null; facilityId: string | null;
  unitCost: number;             // 셀러가 내는 개당 공급가
  stock: number;
  options: { name: string; values: string[] }[];
  shipper: string;              // 화면 표시용 (브랜드 직배송 · 스토리지마켓 ○○ 출고)
  imageUrl: string | null;
  consumerPrice: number | null;
  shippingNote: string;
};

const brandWhere = (sellerId: string): Prisma.BrandProductWhereInput => ({
  isActive: true, shop: { ...PUBLIC_BRAND_SHOP, partners: { none: { userId: sellerId, status: "BLOCKED" } } },
});

/** 셀러가 주문서에 담을 수 있는 상품: 고른(판매 목록에 담은) 브랜드 직배송 상품 + 스토리지마켓 창고 재고 */
export async function sheetCatalog(sellerId: string): Promise<CatalogItem[]> {
  const [brandRows, stockRows] = await Promise.all([
    prisma.sellerBrandProduct.findMany({
      where: { sellerId, isActive: true, brandProduct: { ...brandWhere(sellerId), allowDropship: true } },
      orderBy: { createdAt: "desc" },
      include: { brandProduct: { include: { shop: { select: { name: true } } } } },
    }),
    prisma.facilityProduct.findMany({
      where: {
        isSellable: true, facility: { status: "APPROVED" },
        // 창고가 직배송 방식으로 가져온 브랜드 상품은 브랜드 직배송으로 고르면 되므로 뺀다
        OR: [{ brandProductId: null }, { fulfillment: "WAREHOUSE", brandProduct: brandWhere(sellerId) }],
      },
      orderBy: [{ facilityId: "asc" }, { createdAt: "desc" }],
      include: {
        product: { select: { name: true, thumbnailUrl: true } }, facility: { select: { id: true, name: true } },
        brandProduct: { select: { options: true, shop: { select: { name: true } } } },
      },
    }),
  ]);
  const brand: CatalogItem[] = brandRows.map(({ brandProduct: bp }) => ({
    code: `B-${bp.id}`, kind: "BRAND", name: bp.name, brandName: bp.shop.name, facilityName: null, facilityId: null,
    unitCost: bp.supplyPrice, stock: bp.stock, options: parseOptions(bp.options), shipper: `위탁배송 · 브랜드 배송 (${bp.shop.name})`,
    imageUrl: bp.imageUrl || null, consumerPrice: bp.consumerPrice || null,
    shippingNote: `발주 후 ${bp.leadDays}일 안에 브랜드가 받는 분에게 바로 보냅니다. 택배비는 공급가에 포함됩니다.`,
  }));
  const stock: CatalogItem[] = stockRows.map((fp) => ({
    code: `S-${fp.id}`, kind: "STOCK", name: fp.product.name, brandName: fp.brandProduct?.shop.name ?? null,
    facilityName: fp.facility.name, facilityId: fp.facility.id,
    unitCost: stockUnitCost(fp), stock: fp.stock, options: parseOptions(fp.brandProduct?.options),
    shipper: `스토리지마켓 출고 (${fp.facility.name})`, imageUrl: fp.product.thumbnailUrl, consumerPrice: fp.consumerPrice || null,
    shippingNote: "스토리지마켓 창고에서 보냅니다. 주문서마다 출고 배송비가 붙습니다.",
  }));
  return [...brand, ...stock];
}

/** 창고 재고 상품의 셀러 공급가: 정한 공급가가 있으면 그 값, 없으면 판매가 − 셀러 수수료 */
function stockUnitCost(fp: { supplyPrice: number | null; salePrice: number; commissionType: "PERCENT" | "FIXED"; commissionValue: number }) {
  if (fp.supplyPrice != null) return fp.supplyPrice;
  return Math.max(0, fp.salePrice - calcSellerCommission(fp.salePrice, fp.commissionType, fp.commissionValue));
}

// ---------------------------------------------------------------------------
// 입력 검사
// ---------------------------------------------------------------------------
export type SheetLineInput = { code: string; optionLabel?: string | null; quantity: number };
export type SheetInput = {
  platform: string; platformEtc?: string | null; externalOrderNo?: string | null;
  recipient: string; phone: string; address: string; memo?: string | null;
  lines: SheetLineInput[];
  ref?: string; // 화면 · 엑셀에서 붙인 이름 (예: "3행") — 결과에 그대로 돌려준다
};

const PHONE = /^[+\d ()-]{8,30}$/;

/** 옵션 라벨 정리: "색상:블랙 / 사이즈:S" 형식으로 맞추고 상품 옵션과 맞는지 확인 */
export function normalizeOption(groups: { name: string; values: string[] }[], label: string | null | undefined): { ok: true; label: string | null } | { ok: false; error: string } {
  if (!groups.length) return { ok: true, label: null };
  const raw = (label ?? "").trim();
  if (!raw) return { ok: false, error: `옵션을 입력하세요 (${groups.map((g) => `${g.name}: ${g.values.join("/")}`).join(", ")})` };
  // "블랙 / S" 처럼 값만 적어도 순서대로 맞춰 준다
  const parts = raw.split(/\s*[/,]\s*/).filter(Boolean);
  const chosen: string[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const part = parts.find((p) => p.includes(":") ? p.split(":")[0].trim() === g.name : false)?.split(":")[1]?.trim() ?? (parts[i]?.includes(":") ? undefined : parts[i]?.trim());
    if (!part || !g.values.includes(part)) return { ok: false, error: `옵션 '${g.name}'을(를) ${g.values.join("/")} 중에서 고르세요` };
    chosen.push(`${g.name}:${part}`);
  }
  return { ok: true, label: chosen.join(" / ") };
}

export type SheetCheck = { ok: true } | { ok: false; error: string };

export function checkSheet(sheet: SheetInput, catalog: Map<string, CatalogItem>): SheetCheck {
  if (!isLivePlatform(sheet.platform)) return { ok: false, error: "판매한 플랫폼을 선택하세요." };
  if (sheet.platform === "ETC" && !(sheet.platformEtc ?? "").trim()) return { ok: false, error: "기타 플랫폼 이름을 입력하세요." };
  if ((sheet.recipient ?? "").trim().length < 2) return { ok: false, error: "받는 분 이름을 입력하세요." };
  if (!PHONE.test((sheet.phone ?? "").trim()) || sheet.phone.replace(/\D/g, "").length < 8) return { ok: false, error: "받는 분 연락처를 확인하세요." };
  if ((sheet.address ?? "").trim().length < 5) return { ok: false, error: "배송지 주소를 입력하세요." };
  if (!sheet.lines?.length) return { ok: false, error: "상품을 1개 이상 담으세요." };
  if (sheet.lines.length > 50) return { ok: false, error: "주문서 한 장에는 상품을 50줄까지 담을 수 있습니다." };
  for (const l of sheet.lines) {
    const item = catalog.get(l.code);
    if (!item) return { ok: false, error: `주문서에 담을 수 없는 상품입니다 (${l.code}). 판매 목록에 담았는지, 판매 중인지 확인하세요.` };
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 9999) return { ok: false, error: `${item.name}: 수량을 확인하세요.` };
    const opt = normalizeOption(item.options, l.optionLabel);
    if (!opt.ok) return { ok: false, error: `${item.name}: ${opt.error}` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 주문서 제출 → 보내는 곳별 주문 생성 → 재고 확보 → 셀러 결제 → 발주
// ---------------------------------------------------------------------------
export type SheetResult = { ref?: string; ok: boolean; error?: string; orders?: { id: string; orderNo: string; total: number; shipper: string }[] };

class OrderNoClash extends Error {}

export async function submitSheets(seller: { id: string }, sheets: SheetInput[], method: PaymentMethod = "CARD"): Promise<SheetResult[]> {
  const blocked = paymentBlockedReason();
  if (blocked) return sheets.map((s) => ({ ref: s.ref, ok: false, error: blocked }));
  const catalogList = await sheetCatalog(seller.id);
  const catalog = new Map(catalogList.map((c) => [c.code, c]));
  const policy = await getPolicy();
  const results: SheetResult[] = [];
  for (const sheet of sheets) {
    const check = checkSheet(sheet, catalog);
    if (!check.ok) { results.push({ ref: sheet.ref, ok: false, error: check.error }); continue; }
    try {
      results.push({ ref: sheet.ref, ok: true, orders: await submitOne(seller.id, sheet, catalog, policy, method) });
    } catch (e) {
      results.push({ ref: sheet.ref, ok: false, error: e instanceof Error ? e.message : "주문서를 처리하지 못했습니다." });
    }
  }
  return results;
}

async function submitOne(sellerId: string, sheet: SheetInput, catalog: Map<string, CatalogItem>, policy: Awaited<ReturnType<typeof getPolicy>>, method: PaymentMethod) {
  // 보내는 곳별로 묶는다: 브랜드 직배송(브랜드가 여럿이어도 한 주문 — 발주서는 브랜드별로 나뉜다) / 창고별 출고
  const groups = new Map<string, { facilityId: string | null; lines: { item: CatalogItem; quantity: number; optionLabel: string | null }[] }>();
  for (const l of sheet.lines) {
    const item = catalog.get(l.code)!;
    const key = item.kind === "BRAND" ? "BRAND" : `F:${item.facilityId}`;
    const g = groups.get(key) ?? { facilityId: item.kind === "BRAND" ? null : item.facilityId, lines: [] };
    const opt = normalizeOption(item.options, l.optionLabel);
    g.lines.push({ item, quantity: l.quantity, optionLabel: opt.ok ? opt.label : null });
    groups.set(key, g);
  }
  const platformTitle = livePlatformLabel(sheet.platform, sheet.platformEtc);
  const done: { id: string; orderNo: string; total: number; shipper: string }[] = [];
  for (const g of Array.from(groups.values())) {
    done.push(await createGroupOrder(sellerId, sheet, g, platformTitle, policy, method));
  }
  return done;
}

async function createGroupOrder(
  sellerId: string, sheet: SheetInput,
  g: { facilityId: string | null; lines: { item: CatalogItem; quantity: number; optionLabel: string | null }[] },
  platformTitle: string, policy: Awaited<ReturnType<typeof getPolicy>>, method: PaymentMethod,
) {
  // 창고 재고 상품은 정산 기준(셀러 공급가 · 브랜드 공급가)을 지금 값으로 다시 읽어 스냅샷으로 남긴다
  const fpIds = g.lines.filter((l) => l.item.kind === "STOCK").map((l) => l.item.code.slice(2));
  const bpIds = g.lines.filter((l) => l.item.kind === "BRAND").map((l) => l.item.code.slice(2));
  const [fps, bps] = await Promise.all([
    fpIds.length ? prisma.facilityProduct.findMany({ where: { id: { in: fpIds } }, include: { brandProduct: { select: { id: true, supplyPrice: true } } } }) : Promise.resolve([]),
    bpIds.length ? prisma.brandProduct.findMany({ where: { id: { in: bpIds } }, select: { id: true, supplyPrice: true } }) : Promise.resolve([]),
  ]);
  const fpMap = new Map(fps.map((f) => [f.id, f]));
  const bpMap = new Map(bps.map((b) => [b.id, b]));

  const lines = g.lines.map((l, i) => {
    const unit = l.item.unitCost;
    const lineTotal = unit * l.quantity;
    if (l.item.kind === "BRAND") {
      const bp = bpMap.get(l.item.code.slice(2));
      if (!bp) throw new StockError(`${l.item.name}: 판매가 중지된 상품입니다.`);
      return {
        no: i + 1, l, lineTotal, unit,
        lsp: { brandProductId: bp.id, fulfillment: "DROPSHIP" as FulfillmentMode, supplyPriceSnapshot: bp.supplyPrice, facilityProductId: null as string | null },
        split: { platformFee: 0, brandAmount: lineTotal, facilityAmount: 0, sellerAmount: 0 }, // 브랜드 수수료는 브랜드 정산에서 뺀다
      };
    }
    const fp = fpMap.get(l.item.code.slice(2));
    if (!fp) throw new StockError(`${l.item.name}: 판매가 중지된 상품입니다.`);
    const brand = fp.brandProduct ? fp.brandProduct.supplyPrice * l.quantity : 0;
    const platformFee = pct(Math.max(0, lineTotal - brand), policy.salesFeeRate);
    return {
      no: i + 1, l, lineTotal, unit,
      lsp: { brandProductId: fp.brandProduct?.id ?? null, fulfillment: fp.brandProduct ? ("WAREHOUSE" as FulfillmentMode) : null, supplyPriceSnapshot: fp.brandProduct?.supplyPrice ?? null, facilityProductId: fp.id },
      split: { platformFee, brandAmount: brand, facilityAmount: Math.max(0, lineTotal - brand - platformFee), sellerAmount: 0 },
    };
  });
  const subtotal = lines.reduce((s, x) => s + x.lineTotal, 0);
  const shippingFee = g.facilityId ? Math.max(0, policy.sheetShippingFee) : 0;
  const total = subtotal + shippingFee;
  const shipper = g.facilityId ? (g.lines[0].item.facilityName ?? "스토리지마켓") : "위탁배송 (브랜드 배송)";

  // 1) 주문 생성 + 재고 확보 (브랜드 실재고 · 창고 재고) — 모자라면 전체 롤백
  const reserve = () => prisma.$transaction(async (tx) => {
    const session = await tx.liveSession.create({
      data: {
        slug: `sheet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, sellerId, facilityId: g.facilityId,
        title: `${platformTitle} 주문서${sheet.externalOrderNo ? ` · ${sheet.externalOrderNo}` : ""}`.slice(0, 120),
        status: "ENDED", endedAt: new Date(), isOrderSheet: true,
        products: {
          create: lines.map((x) => ({
            displayNumber: x.no, sortOrder: x.no, nameSnapshot: x.l.item.name, priceSnapshot: x.unit, stockSnapshot: 0,
            imageSnapshot: x.l.item.imageUrl, source: "CATALOG", isActive: false,
            brandProductId: x.lsp.brandProductId, fulfillment: x.lsp.fulfillment, supplyPriceSnapshot: x.lsp.supplyPriceSnapshot,
            facilityProductId: x.lsp.facilityProductId,
          })),
        },
      },
      include: { products: { select: { id: true, displayNumber: true } } },
    });
    const lspOf = new Map(session.products.map((p) => [p.displayNumber, p.id]));
    let order;
    try {
      order = await tx.order.create({
        data: {
          orderNo: orderNo(), liveSessionId: session.id, sellerId, facilityId: g.facilityId,
          source: "SHEET", platform: sheet.platform, externalOrderNo: sheet.externalOrderNo?.trim().slice(0, 60) || null,
          sheetMemo: sheet.memo?.trim().slice(0, 300) || null,
          buyerName: sheet.recipient.trim().slice(0, 40), buyerPhone: sheet.phone.trim().slice(0, 30), buyerAddress: sheet.address.trim().slice(0, 300),
          status: "PAYMENT_PENDING", totalAmount: total, shippingFee, privacyAgreedAt: new Date(),
          items: {
            create: lines.map((x) => ({
              liveSessionProductId: lspOf.get(x.no)!, displayNumber: x.no, productName: x.l.item.name, unitPrice: x.unit, quantity: x.l.quantity,
              optionLabel: x.l.optionLabel, lineTotal: x.lineTotal, discountAmount: 0, ...x.split,
            })),
          },
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && String(e.meta?.target ?? "").includes("orderNo")) throw new OrderNoClash();
      throw e;
    }
    const touched = await reserveOrderStockInTx(tx, order.id);
    return { order, touched };
  }, { timeout: 20000 });
  let pending: Awaited<ReturnType<typeof reserve>> | null = null;
  for (let attempt = 0; attempt < 3 && !pending; attempt++) {
    try { pending = await reserve(); } catch (e) { if (!(e instanceof OrderNoClash) || attempt === 2) throw e; }
  }
  if (!pending) throw new Error("주문번호 생성이 겹쳤습니다. 다시 시도해 주세요.");
  const order = pending.order;

  // 2) 셀러 결제 (트랜잭션 밖)
  const adapter = getPaymentAdapter();
  const payment = await prisma.payment.create({ data: { orderId: order.id, provider: adapter.provider, method, status: "IN_PROGRESS", amount: total } });
  let pgTransactionId: string | undefined;
  try {
    const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { email: true, profile: { select: { name: true, phone: true } } } });
    const created = await adapter.createPayment({ orderId: order.id, amount: total, method, orderName: `${platformTitle} 주문서 ${order.orderNo}`, buyerName: seller?.profile?.name ?? seller?.email ?? "셀러", buyerPhone: seller?.profile?.phone ?? "" });
    pgTransactionId = created.pgTransactionId;
    await prisma.payment.update({ where: { id: payment.id }, data: { pgTransactionId } });
    await prisma.paymentEvent.create({ data: { paymentId: payment.id, type: "CREATED", payload: JSON.stringify(created) } });
    if (!created.success || !pgTransactionId) throw new Error(created.failReason ?? "결제를 시작하지 못했습니다.");
    const confirmed = await adapter.confirmPayment(pgTransactionId, total);
    if (!confirmed.success) throw new Error(confirmed.failReason ?? "결제에 실패했습니다.");
    await prisma.paymentEvent.create({ data: { paymentId: payment.id, type: "CONFIRMED", payload: JSON.stringify(confirmed) } });
    // 3) 결제 확정 + 브랜드 발주서
    const pos = await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "PAID", approvedAt: confirmed.approvedAt ?? new Date() } });
      await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });
      return createPurchaseOrdersInTx(tx, order.id);
    }, { timeout: 20000 });
    await notifyNewPurchaseOrders(pos);
    await checkLowStock(pending.touched);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "결제에 실패했습니다.";
    if (pgTransactionId) {
      const paid = await prisma.paymentEvent.findFirst({ where: { paymentId: payment.id, type: "CONFIRMED" }, select: { id: true } });
      if (paid) await adapter.cancelPayment(pgTransactionId, `주문서 처리 실패: ${reason}`).catch(() => null);
    }
    await failPendingOrder(order.id, payment.id, reason);
    throw new Error(reason.startsWith("결제") ? reason : `결제에 실패했습니다. ${reason}`);
  }
  await audit({ actorId: sellerId, action: "ORDER_SHEET_SUBMIT", entity: "Order", entityId: order.id, meta: { total, platform: sheet.platform, externalOrderNo: sheet.externalOrderNo ?? null } });
  if (g.facilityId) {
    await notifyFacility(g.facilityId, {
      type: "ORDER", email: true, partnerEmail: true,
      title: `출고할 새 주문서 · ${order.orderNo}`,
      body: `${platformTitle} · ${lines.map((x) => `${x.l.item.name} ×${x.l.quantity}`).join(", ").slice(0, 120)} · ${formatKRW(total)}`,
      link: "/facility/orders?status=todo",
    });
  }
  return { id: order.id, orderNo: order.orderNo, total, shipper };
}
