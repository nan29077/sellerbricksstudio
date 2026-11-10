// 이용료 무료 전환 + 예약 고도화 데이터 정리 (one-time)
// 실행: npx tsx prisma/backfill-free-booking.ts
// - 모든 창고(스튜디오)의 시간당 요금(basePrice)과 예약 이용료(totalPrice)를 0으로 만듭니다.
// - 예약번호(code)가 없는 기존 예약에 예약번호를 붙입니다.
// - 기존 예약의 "판매 예정 상품" 문자열은 그대로 두고, 새 예약부터 상품이 구조화되어 저장됩니다.

import { PrismaClient } from "@prisma/client";
import { bookingCode } from "../src/lib/booking-engine";
import { dateKey } from "../src/lib/kst";

const prisma = new PrismaClient();

async function main() {
  const f = await prisma.facility.updateMany({ where: { basePrice: { not: 0 } }, data: { basePrice: 0 } });
  const b = await prisma.booking.updateMany({ where: { totalPrice: { not: 0 } }, data: { totalPrice: 0 } });
  const rows = await prisma.booking.findMany({ where: { code: null }, select: { id: true, startAt: true } });
  let n = 0;
  for (const r of rows) {
    for (let i = 0; i < 5; i++) {
      try { await prisma.booking.update({ where: { id: r.id }, data: { code: bookingCode(dateKey(r.startAt).replace(/-/g, "")) } }); n++; break; }
      catch (e: any) { if (e?.code !== "P2002") throw e; }
    }
  }
  console.log(`창고(스튜디오) 요금 0원 처리 ${f.count}곳 · 예약 이용료 0원 처리 ${b.count}건 · 예약번호 부여 ${n}건`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
