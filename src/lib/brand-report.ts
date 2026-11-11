import { prisma } from "./prisma";

// 브랜드 매출 리포트 집계 (공급가 기준, 취소·반품 제외)
export async function brandReport(shopId: string, from: Date, to: Date) {
  const pos = await prisma.purchaseOrder.findMany({
    where: { brandShopId: shopId, createdAt: { gte: from, lt: to }, status: { notIn: ["CANCELLED", "RETURNED"] } },
    select: {
      createdAt: true, fulfillment: true, supplyAmount: true, saleAmount: true, sellerId: true, facilityId: true,
      seller: { select: { email: true, profile: { select: { name: true, companyName: true } } } }, facility: { select: { name: true } },
      items: { select: { brandProductId: true, productName: true, quantity: true, supplyPrice: true, salePrice: true } },
    },
  });
  const byProduct = new Map<string, { name: string; qty: number; supply: number; sale: number; orders: number }>();
  const byPartner = new Map<string, { name: string; kind: string; supply: number; orders: number }>();
  const byMonth = new Map<string, { supply: number; orders: number }>();
  for (const po of pos) {
    const month = new Date(po.createdAt.getTime() + 9 * 3600000).toISOString().slice(0, 7);
    const m = byMonth.get(month) ?? { supply: 0, orders: 0 }; m.supply += po.supplyAmount; m.orders += 1; byMonth.set(month, m);
    const sellerName = po.seller.profile?.companyName || po.seller.profile?.name || po.seller.email.split("@")[0];
    const key = po.fulfillment === "WAREHOUSE" ? `f:${po.facilityId}` : `s:${po.sellerId}`;
    const p = byPartner.get(key) ?? { name: po.fulfillment === "WAREHOUSE" ? (po.facility?.name ?? "셀러 공간") : sellerName, kind: po.fulfillment === "WAREHOUSE" ? "창고 위탁" : "직배송", supply: 0, orders: 0 };
    p.supply += po.supplyAmount; p.orders += 1; byPartner.set(key, p);
    for (const it of po.items) {
      const x = byProduct.get(it.brandProductId) ?? { name: it.productName, qty: 0, supply: 0, sale: 0, orders: 0 };
      x.qty += it.quantity; x.supply += it.supplyPrice * it.quantity; x.sale += it.salePrice * it.quantity; x.orders += 1;
      byProduct.set(it.brandProductId, x);
    }
  }
  // 샘플 → 판매 전환: 기간 내 샘플을 받은 판매처 중 같은 기간에 발주가 생긴 곳
  const samples = await prisma.brandRequest.findMany({
    where: { kind: "SAMPLE", product: { shopId }, status: { in: ["SHIPPED", "COMPLETED"] }, createdAt: { gte: from, lt: to } },
    select: { buyerId: true },
  });
  const sampleBuyers = new Set(samples.map((s) => s.buyerId));
  const sellingPartners = new Set(pos.map((p) => p.sellerId));
  const facilityOwners = await prisma.facility.findMany({ where: { id: { in: Array.from(new Set(pos.map((p) => p.facilityId).filter((v): v is string => !!v))) } }, select: { ownerId: true } });
  facilityOwners.forEach((f) => sellingPartners.add(f.ownerId));
  const converted = Array.from(sampleBuyers).filter((id) => sellingPartners.has(id)).length;
  return {
    totals: { orders: pos.length, supply: pos.reduce((s, p) => s + p.supplyAmount, 0), sale: pos.reduce((s, p) => s + p.saleAmount, 0) },
    products: Array.from(byProduct.values()).sort((a, b) => b.supply - a.supply),
    partners: Array.from(byPartner.values()).sort((a, b) => b.supply - a.supply),
    months: Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })),
    samples: { partners: sampleBuyers.size, converted },
  };
}
