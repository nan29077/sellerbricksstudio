// 기존 회원 프로필 이미지 소급 배정 (one-time)
// 실행: npx tsx prisma/backfill-profile-image.ts
// - profileImageIndex 가 null 인 유저에게 1~20 랜덤 값을 배정합니다.
// - 이미 값이 있는 유저는 건너뜁니다.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { profileImageIndex: null },
    select: { id: true, email: true },
  });

  if (users.length === 0) {
    console.log("소급 배정 대상 없음 (모든 유저에 profileImageIndex 존재).");
    return;
  }

  let count = 0;
  for (const u of users) {
    const idx = Math.floor(Math.random() * 20) + 1;
    await prisma.user.update({ where: { id: u.id }, data: { profileImageIndex: idx } });
    count++;
    console.log(`  ${u.email} -> ${idx}`);
  }
  console.log(`소급 배정 완료: ${count}명`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
