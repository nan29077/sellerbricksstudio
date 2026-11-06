// 기존 예약 이용료(totalPrice) 소급 계산 (one-time)
// 실행: npx tsx prisma/backfill-booking-price.ts
// - totalPrice 가 0 인 예약에 "창고(스튜디오) 시간당 요금 × 이용 시간"을 채웁니다.
// - 이미 승인·완료된 예약의 시각(approvedAt/completedAt)이 비어 있으면 updatedAt 으로 채웁니다.
// - 플랫폼 기본 수수료율(10%)이 없으면 만듭니다.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.booking.findMany({
    where: { totalPrice: 0 },
    select: { id: true, startAt: true, endAt: true, status: true, updatedAt: true, approvedAt: true, completedAt: true, facility: { select: { basePrice: true } } },
  });
  let n = 0;
  for (const b of rows) {
    const hours = Math.max(0, (b.endAt.getTime() - b.startAt.getTime()) / 3600000);
    await prisma.booking.update({
      where: { id: b.id },
      data: {
        totalPrice: Math.round(b.facility.basePrice * hours),
        ...(b.status === "APPROVED" || b.status === "COMPLETED" ? { approvedAt: b.approvedAt ?? b.updatedAt } : {}),
        ...(b.status === "COMPLETED" ? { completedAt: b.completedAt ?? b.updatedAt } : {}),
      },
    });
    n++;
  }
  if (!(await prisma.commissionRule.findFirst({ where: { scope: "PLATFORM" } }))) {
    await prisma.commissionRule.create({ data: { scope: "PLATFORM", commissionType: "PERCENT", commissionValue: 10 } });
  }
  console.log(`예약 ${n}건의 이용료를 채웠습니다.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
