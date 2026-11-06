import { prisma } from "./prisma";

// 중간관리자 수수료 = 담당 창고(스튜디오)의 이용 완료 예약 이용료 × 정률(%)  또는  완료 1건당 정액
export function calcManagerCommission(rule: { commissionType: string; commissionValue: number } | null | undefined, revenue: number, count: number) {
  if (!rule) return 0;
  return rule.commissionType === "PERCENT" ? Math.round((revenue * rule.commissionValue) / 100) : Math.round(rule.commissionValue * count);
}

export async function managerRevenue(facilityIds: string[], range?: { gte?: Date; lt?: Date }) {
  if (facilityIds.length === 0) return { revenue: 0, count: 0 };
  const a = await prisma.booking.aggregate({
    where: { facilityId: { in: facilityIds }, status: "COMPLETED", ...(range && { startAt: range }) },
    _sum: { totalPrice: true }, _count: true,
  });
  return { revenue: a._sum.totalPrice ?? 0, count: a._count };
}
