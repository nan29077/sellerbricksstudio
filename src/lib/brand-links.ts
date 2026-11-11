import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { optionSnapshotOf } from "./brands";

type Db = Prisma.TransactionClient | typeof prisma;

// 창고(스튜디오) 상품이 브랜드에서 가져온 상품이면, 방송 상품에 남길 브랜드 정보(공급가 · 배송방식 · 옵션)를 돌려준다.
export async function brandSnapshotForFacilityProduct(db: Db, facilityProductId: string) {
  const fp = await db.facilityProduct.findUnique({
    where: { id: facilityProductId },
    select: { brandProductId: true, fulfillment: true, brandProduct: { select: { supplyPrice: true, options: true } } },
  });
  if (!fp?.brandProductId || !fp.brandProduct) return {};
  return {
    brandProductId: fp.brandProductId,
    fulfillment: fp.fulfillment ?? "DROPSHIP",
    supplyPriceSnapshot: fp.brandProduct.supplyPrice,
    optionSnapshot: optionSnapshotOf(fp.brandProduct.options),
  } as const;
}
