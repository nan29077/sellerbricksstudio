import { prisma } from "@/lib/prisma";

export async function getSessionWithCatalog(sessionId: string) {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      facility: true,
      products: { where: { isActive: true }, orderBy: { displayNumber: "asc" } },
      streamChannels: true,
    },
  });
  if (!session) return null;
  // 창고(스튜디오) 방송: 그 창고의 판매 상품 / 셀러 공간 방송: 셀러가 브랜드샵에서 가져온 직배송 상품
  const ownSpace = !session.facilityId;
  const catalog = session.facilityId ? await prisma.facilityProduct.findMany({
    where: { facilityId: session.facilityId, isSellable: true },
    include: { product: true }, orderBy: { createdAt: "asc" },
  }) : [];
  const brandListings = !ownSpace ? [] : await prisma.sellerBrandProduct.findMany({
    where: { sellerId: session.sellerId, isActive: true, brandProduct: { isActive: true, allowDropship: true, shop: { status: "APPROVED" } } },
    include: { brandProduct: { select: { id: true, name: true, supplyPrice: true, stock: true, imageUrl: true, category: true, shop: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  }).catch(() => []);
  return {
    session, ownSpace,
    catalog: catalog.map((c) => ({ id: c.id, name: c.product.name, salePrice: c.salePrice, stock: c.stock, category: c.product.category, thumbnailUrl: c.product.thumbnailUrl, brand: !!c.brandProductId })),
    brandCatalog: brandListings.map((l) => ({ id: l.id, brandProductId: l.brandProduct.id, name: l.brandProduct.name, salePrice: l.salePrice, supplyPrice: l.brandProduct.supplyPrice, stock: l.brandProduct.stock, thumbnailUrl: l.brandProduct.imageUrl || null, shopName: l.brandProduct.shop.name })),
    items: session.products.map((p) => ({ id: p.id, displayNumber: p.displayNumber, nameSnapshot: p.nameSnapshot, priceSnapshot: p.priceSnapshot, stockSnapshot: p.stockSnapshot, imageSnapshot: p.imageSnapshot, source: p.source, sortOrder: p.sortOrder, fulfillment: p.fulfillment, brandProductId: p.brandProductId, facilityProductId: p.facilityProductId })),
  };
}
