// 회원 탈퇴
//  - 진행 중인 거래(배송 전 · 배송 중 주문, 지급 전 정산, 앞으로의 예약, 처리 중 발주)가 있으면 탈퇴를 막고 이유를 알려 준다.
//  - 탈퇴하면 로그인 정보와 개인정보(이메일 · 이름 · 연락처 · 사진 · 계좌 · SNS)를 지우고 계정을 닫는다.
//    주문 · 정산 · 세금 관련 기록은 법정 보관 기간 동안 남는다(계정과 연결만 남고 개인정보는 없음).
//  - 같은 이메일로 다시 가입할 수 있다.
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "./prisma";

export async function withdrawBlockers(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return ["계정을 찾을 수 없습니다."];
  if (user.role === "SUPER_ADMIN") return ["최고관리자 계정은 탈퇴할 수 없습니다. 다른 최고관리자에게 계정 정지를 요청해 주세요."];
  const now = new Date();
  const out: string[] = [];
  const [openOrders, unpaid, bookings, live, facilities, shop] = await Promise.all([
    prisma.order.count({ where: { OR: [{ sellerId: userId }, { facility: { ownerId: userId } }], status: { in: ["PAYMENT_PENDING", "PAID", "PREPARING", "SHIPPED"] } } }),
    prisma.settlement.count({ where: { OR: [{ sellerId: userId }, { facility: { ownerId: userId } }], status: { not: "PAID" } } }),
    prisma.booking.count({ where: { OR: [{ sellerId: userId }, { facility: { ownerId: userId } }], status: { in: ["PENDING", "APPROVED"] }, endAt: { gt: now } } }),
    prisma.liveSession.count({ where: { sellerId: userId, status: "LIVE" } }),
    prisma.facility.count({ where: { ownerId: userId, status: "APPROVED" } }),
    prisma.brandShop.findUnique({ where: { ownerId: userId }, select: { id: true } }),
  ]);
  if (openOrders) out.push(`배송이 끝나지 않은 주문 ${openOrders}건이 있습니다.`);
  if (unpaid) out.push(`지급이 끝나지 않은 정산 ${unpaid}건이 있습니다.`);
  if (bookings) out.push(`대기 중이거나 승인된 예약 ${bookings}건이 있습니다. 먼저 취소해 주세요.`);
  if (live) out.push("진행 중인 라이브 방송이 있습니다.");
  if (facilities) out.push(`운영 중인 창고(스튜디오) ${facilities}곳이 있습니다. 고객지원으로 운영 종료를 먼저 요청해 주세요.`);
  if (shop) {
    const [pos, bs] = await Promise.all([
      prisma.purchaseOrder.count({ where: { brandShopId: shop.id, status: { in: ["NEW", "CONFIRMED", "SHIPPED"] } } }),
      prisma.brandSettlement.count({ where: { brandShopId: shop.id, status: { not: "PAID" } } }),
    ]);
    out.push("브랜드샵 대표 계정입니다. 브랜드샵 운영 종료는 고객지원으로 요청해 주세요.");
    if (pos) out.push(`처리 중인 발주 ${pos}건이 있습니다.`);
    if (bs) out.push(`지급이 끝나지 않은 브랜드 정산 ${bs}건이 있습니다.`);
  }
  return out;
}

export async function withdrawAccount(userId: string) {
  const blank = await bcrypt.hash(randomBytes(24).toString("hex"), 10);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `withdrawn-${userId}@deleted.invalid`, passwordHash: blank, isActive: false, withdrawnAt: now,
        sessionVersion: { increment: 1 }, adminMemo: null, profileImageIndex: null,
      },
    });
    await tx.profile.updateMany({
      where: { userId },
      data: { name: "탈퇴한 회원", phone: null, avatarUrl: null, bankName: null, bankAccount: null, accountHolder: null },
    });
    await tx.$executeRaw`UPDATE "Profile" SET "snsLinks" = NULL, "notifyPrefs" = NULL WHERE "userId" = ${userId}`;
    await tx.authToken.deleteMany({ where: { userId } });
    await tx.brandMember.deleteMany({ where: { userId } });
    await tx.facilityFavorite.deleteMany({ where: { userId } });
    await tx.brandProductFavorite.deleteMany({ where: { userId } });
    await tx.userNotification.deleteMany({ where: { userId } });
    // 셀러가 모은 알림톡 구독자(다른 사람의 연락처)는 더 이상 쓸 곳이 없으므로 지운다.
    await tx.kakaoSubscriber.deleteMany({ where: { channel: { sellerId: userId } } });
  });
}
