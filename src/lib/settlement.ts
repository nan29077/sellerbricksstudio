import { prisma } from "@/lib/prisma";
import { calcSellerCommission } from "@/lib/utils";

// 주문 기반 정산 요약 계산 (셀러 수익 = 셀러 수수료 합, 시설 정산 = 매출 - 셀러수익)
export async function computeSettlement(where: { sellerId?: string; facilityId?: string; facilityIds?: string[] }) {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] },
      ...(where.sellerId && { sellerId: where.sellerId }),
      ...(where.facilityId && { facilityId: where.facilityId }),
      ...(where.facilityIds && { facilityId: { in: where.facilityIds } }),
    },
    include: { items: { include: { liveSessionProduct: { include: { facilityProduct: true } } } } },
  });

  let gross = 0, sellerProfit = 0;
  for (const o of orders) {
    for (const it of o.items) {
      gross += it.lineTotal;
      const fp = it.liveSessionProduct.facilityProduct;
      if (fp) sellerProfit += calcSellerCommission(it.unitPrice, fp.commissionType, fp.commissionValue) * it.quantity;
    }
  }
  return { orderCount: orders.length, gross, sellerProfit, facilityAmount: gross - sellerProfit };
}
