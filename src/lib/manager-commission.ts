import { prisma } from "./prisma";
import { getPolicy } from "./policy";
import { SETTLEMENT_ORDER_INCLUDE, splitOrder } from "./settlement";

// 중간관리자(영업) 수수료
//  - 정률(%): 담당 창고(스튜디오) 방송의 배송 완료 주문에서 플랫폼이 받은 판매 수수료 × %
//    (창고 이용료는 무료라 이용료 기준으로는 항상 0원이 된다. 플랫폼 수입의 일부를 나누는 방식이라 플랫폼 수입을 넘지 않는다)
//  - 정액(원): 담당 창고(스튜디오)의 이용 완료 예약 1건당
export function calcManagerCommission(rule: { commissionType: string; commissionValue: number } | null | undefined, platformFee: number, count: number) {
  if (!rule) return 0;
  return rule.commissionType === "PERCENT" ? Math.round((platformFee * rule.commissionValue) / 100) : Math.round(rule.commissionValue * count);
}

export const MANAGER_COMMISSION_BASE = "담당 창고(스튜디오) 방송의 배송 완료 주문에서 발생한 플랫폼 판매 수수료";

/** 담당 창고(스튜디오) 방송의 배송 완료 주문에서 플랫폼이 받은 판매 수수료 (주문별). 취소된 상품 줄은 뺀다 */
export async function managerFeeRows(facilityIds: string[], since?: Date) {
  if (facilityIds.length === 0) return [] as { facilityId: string; at: Date; fee: number }[];
  const [policy, orders] = await Promise.all([
    getPolicy(),
    prisma.order.findMany({
      where: { facilityId: { in: facilityIds }, status: "DELIVERED", ...(since && { OR: [{ deliveredAt: { gte: since } }, { deliveredAt: null, createdAt: { gte: since } }] }) },
      include: SETTLEMENT_ORDER_INCLUDE,
    }),
  ]);
  // 주문할 때 저장한 수수료를 쓰고, 저장 전 예전 주문은 지금 기준으로 계산한다 (정산서와 같은 계산)
  return orders.map((o) => ({ facilityId: o.facilityId!, at: o.deliveredAt ?? o.createdAt, fee: splitOrder(o, policy).platformFee }));
}
