import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PUBLIC_BRAND_SHOP } from "@/lib/brands";
import { reportDbError } from "@/lib/db-error";
import { addDays, kstParts, kstStartOfDay } from "@/lib/kst";

const SHELF_SIZE = 6;
const productSelect = {
  id: true, name: true, category: true, imageUrl: true, supplyPrice: true,
  stock: true, samplePrice: true, sampleStock: true, leadDays: true,
  shop: { select: { id: true, name: true } },
} satisfies Prisma.BrandProductSelect;

export type HomeBrandProduct = Prisma.BrandProductGetPayload<{ select: typeof productSelect }>;
export type HomeBrandProducts = {
  weekly: HomeBrandProduct[];
  popular: HomeBrandProduct[];
  recommended: HomeBrandProduct[];
  latest: HomeBrandProduct[];
  samples: HomeBrandProduct[];
};

const visibleProduct = { isActive: true, shop: PUBLIC_BRAND_SHOP } satisfies Prisma.BrandProductWhereInput;
const availableProduct = { ...visibleProduct, stock: { gt: 0 } } satisfies Prisma.BrandProductWhereInput;
const sampleAvailable = { sampleStock: { gt: 0 }, samplePrice: { not: null } } satisfies Prisma.BrandProductWhereInput;
const newestFirst: Prisma.BrandProductOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "asc" }];

async function rankedProductIds(from: Date, through: Date, take: number, inStock = false) {
  const ranked = await prisma.purchaseOrderItem.groupBy({
    by: ["brandProductId"],
    where: {
      brandProduct: inStock ? availableProduct : visibleProduct,
      orderItem: { cancelledAt: null },
      purchaseOrder: {
        status: { notIn: ["CANCELLED", "RETURNED"] },
        order: {
          status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] },
          payment: { status: "PAID", approvedAt: { gte: from, lte: through } },
        },
      },
    },
    _sum: { quantity: true },
    orderBy: [{ _sum: { quantity: "desc" } }, { brandProductId: "asc" }],
    take,
  });
  return ranked.map((row) => row.brandProductId);
}

function completeShelf(first: HomeBrandProduct[], candidates: HomeBrandProduct[]) {
  const seenProducts = new Set(first.map((product) => product.id));
  const seenShops = new Set(first.map((product) => product.shop.id));
  const shelf = [...first];
  const sameShop: HomeBrandProduct[] = [];
  for (const product of candidates) {
    if (shelf.length >= SHELF_SIZE) break;
    if (seenProducts.has(product.id)) continue;
    seenProducts.add(product.id);
    if (seenShops.has(product.shop.id)) {
      sameShop.push(product);
    } else {
      seenShops.add(product.shop.id);
      shelf.push(product);
    }
  }
  return [...shelf, ...sameShop.slice(0, SHELF_SIZE - shelf.length)];
}

export async function getHomeBrandProducts(now = new Date()): Promise<HomeBrandProducts | null> {
  const monday = addDays(kstStartOfDay(now), -((kstParts(now).weekday + 6) % 7));
  try {
    const [weeklyIds, popularIds, latest, latestInStock, recommendedSamples, quickDispatch, samples] = await Promise.all([
      rankedProductIds(monday, now, 3, true),
      rankedProductIds(addDays(now, -30), now, SHELF_SIZE),
      prisma.brandProduct.findMany({ where: visibleProduct, select: productSelect, orderBy: newestFirst, take: SHELF_SIZE }),
      prisma.brandProduct.findMany({ where: availableProduct, select: productSelect, orderBy: newestFirst, take: SHELF_SIZE * 3 }),
      prisma.brandProduct.findMany({ where: { ...availableProduct, ...sampleAvailable }, select: productSelect, orderBy: [{ leadDays: "asc" }, ...newestFirst], take: SHELF_SIZE * 3 }),
      prisma.brandProduct.findMany({ where: availableProduct, select: productSelect, orderBy: [{ leadDays: "asc" }, ...newestFirst], take: SHELF_SIZE * 3 }),
      prisma.brandProduct.findMany({ where: { ...visibleProduct, ...sampleAvailable }, select: productSelect, orderBy: [{ samplePrice: "asc" }, ...newestFirst], take: SHELF_SIZE }),
    ]);
    const rankedIds = [...new Set([...weeklyIds, ...popularIds])];
    const rankedProducts = rankedIds.length ? await prisma.brandProduct.findMany({
      where: { ...visibleProduct, id: { in: rankedIds } }, select: productSelect,
    }) : [];
    const byId = new Map(rankedProducts.map((product) => [product.id, product]));
    const inRankOrder = (ids: string[]) => ids.flatMap((id) => byId.get(id) ?? []);

    return {
      weekly: completeShelf(inRankOrder(weeklyIds).filter((product) => product.stock > 0), latestInStock),
      popular: inRankOrder(popularIds),
      recommended: completeShelf([], [...recommendedSamples, ...quickDispatch]),
      latest,
      samples,
    };
  } catch (error) {
    reportDbError("home-brand-products", error);
    return null;
  }
}
