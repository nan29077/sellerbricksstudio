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
  return {
    session,
    catalog: catalog.map((c) => ({ id: c.id, name: c.product.name, salePrice: c.salePrice, stock: c.stock, category: c.product.category, thumbnailUrl: c.product.thumbnailUrl })),
    items: session.products.map((p) => ({ id: p.id, displayNumber: p.displayNumber, nameSnapshot: p.nameSnapshot, priceSnapshot: p.priceSnapshot, stockSnapshot: p.stockSnapshot, imageSnapshot: p.imageSnapshot, source: p.source, sortOrder: p.sortOrder })),
  };
}
