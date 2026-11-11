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
  const catalog = await prisma.facilityProduct.findMany({
    where: { facilityId: session.facilityId, isSellable: true },
    include: { product: true }, orderBy: { createdAt: "asc" },
  });
  // 셀러가 브랜드샵에서 가져온 직배송 상품 (방송에 바로 올릴 수 있음)
  const brandListings = await prisma.sellerBrandProduct.findMany({
    where: { sellerId: session.sellerId, isActive: true, brandProduct: { isActive: true, allowDropship: true, shop: { status: "APPROVED" } } },
    include: { brandProduct: { select: { id: true, name: true, supplyPrice: true, stock: true, imageUrl: true, category: true, shop: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  }).catch(() => []);
  return {
    session,
    catalog: catalog.map((c) => ({ id: c.id, name: c.product.name, salePrice: c.salePrice, stock: c.stock, category: c.product.category, thumbnailUrl: c.product.thumbnailUrl, brand: !!c.brandProductId })),
    brandCatalog: brandListings.map((l) => ({ id: l.id, brandProductId: l.brandProduct.id, name: l.brandProduct.name, salePrice: l.salePrice, supplyPrice: l.brandProduct.supplyPrice, stock: l.brandProduct.stock, thumbnailUrl: l.brandProduct.imageUrl || null, shopName: l.brandProduct.shop.name })),
    items: session.products.map((p) => ({ id: p.id, displayNumber: p.displayNumber, nameSnapshot: p.nameSnapshot, priceSnapshot: p.priceSnapshot, stockSnapshot: p.stockSnapshot, imageSnapshot: p.imageSnapshot, source: p.source, sortOrder: p.sortOrder, fulfillment: p.fulfillment, brandProductId: p.brandProductId, facilityProductId: p.facilityProductId })),
  };
}
