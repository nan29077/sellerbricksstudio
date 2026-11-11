import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { optionSnapshotOf } from "./brands";

type Db = Prisma.TransactionClient | typeof prisma;

// 창고(스튜디오) 상품을 방송에 올릴 때 남길 스냅샷.
//  - 창고(스튜디오): 셀러 공급가 · 셀러 수수료 (판매 후 바뀌어도 이 방송의 정산은 그대로)
//  - 브랜드에서 가져온 상품이면 브랜드 정보(공급가 · 배송방식 · 옵션)
export async function brandSnapshotForFacilityProduct(db: Db, facilityProductId: string) {
  const fp = await db.facilityProduct.findUnique({
    where: { id: facilityProductId },
    select: {
      supplyPrice: true, commissionType: true, commissionValue: true,
      brandProductId: true, fulfillment: true, brandProduct: { select: { supplyPrice: true, options: true } },
    },
  });
  if (!fp) return {};
  const facility = { facilitySupplySnapshot: fp.supplyPrice, commissionTypeSnapshot: fp.commissionType, commissionValueSnapshot: fp.commissionValue };
  if (!fp.brandProductId || !fp.brandProduct) return facility;
  return {
    ...facility,
    brandProductId: fp.brandProductId,
    fulfillment: fp.fulfillment ?? "DROPSHIP",
    supplyPriceSnapshot: fp.brandProduct.supplyPrice,
    optionSnapshot: optionSnapshotOf(fp.brandProduct.options),
  } as const;
}

// 방송 상품의 판매가 하한과 재고 상한 (셀러가 가격·재고를 바꿀 때 검사)
//  - 브랜드 상품: 공급가 · 브랜드 최저 판매가 아래로 못 판다. 직배송은 브랜드 재고, 위탁은 창고 재고까지
//  - 창고(스튜디오) 상품 · 공급가 방식: 셀러 공급가 아래로 못 판다. 재고는 창고 재고까지
//  - 창고(스튜디오) 상품 · 수수료 방식: 가격은 창고(스튜디오)가 정한 값 (셀러는 바꿀 수 없음)
export async function liveProductLimits(db: Db, lspId: string) {
  const lsp = await db.liveSessionProduct.findUnique({
    where: { id: lspId },
    select: {
      source: true, priceSnapshot: true, supplyPriceSnapshot: true, facilitySupplySnapshot: true, fulfillment: true,
      brandProduct: { select: { minSalePrice: true, stock: true } },
      facilityProduct: { select: { stock: true, salePrice: true, supplyPrice: true, brandProduct: { select: { minSalePrice: true, stock: true } } } },
    },
  });
  if (!lsp) return null;
  if (lsp.source === "AD_HOC") return { floor: 0, maxStock: null as number | null, sellerPriceLocked: false };
  const bp = lsp.brandProduct ?? lsp.facilityProduct?.brandProduct ?? null;
  const brandFloor = Math.max(lsp.supplyPriceSnapshot ?? 0, bp?.minSalePrice ?? 0);
  const fp = lsp.facilityProduct;
  if (!fp) return { floor: brandFloor, maxStock: bp?.stock ?? null, sellerPriceLocked: false };
  const supply = lsp.facilitySupplySnapshot ?? null;
  const maxStock = lsp.fulfillment === "DROPSHIP" && bp ? Math.min(fp.stock, bp.stock) : fp.stock;
  return { floor: Math.max(brandFloor, supply ?? 0), maxStock, sellerPriceLocked: supply == null };
}
