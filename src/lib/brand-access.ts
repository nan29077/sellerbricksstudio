import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { SessionUser } from "./auth";

// ---------------------------------------------------------------------------
// 브랜드 계정 접근: 대표 계정(ownerId) 또는 대표가 만든 팀원 계정(BrandMember)이 같은 브랜드샵을 관리한다.
//  - 정산 계좌·사업자 정보 변경과 팀원 관리는 대표만 할 수 있다.
// ---------------------------------------------------------------------------
export function brandShopWhere(userId: string): Prisma.BrandShopWhereInput {
  return { OR: [{ ownerId: userId }, { members: { some: { userId } } }] };
}

export async function brandShopIdFor(userId: string): Promise<string | null> {
  const shop = await prisma.brandShop.findFirst({ where: brandShopWhere(userId), select: { id: true } });
  return shop?.id ?? null;
}

export async function brandContext(user: Pick<SessionUser, "id" | "role">) {
  if (user.role !== "BRAND_ADMIN") return null;
  const shop = await prisma.brandShop.findFirst({ where: brandShopWhere(user.id) });
  if (!shop) return null;
  return { shop, isOwner: shop.ownerId === user.id };
}

/** 브랜드 알림 받을 사람: 대표 + 팀원 */
export async function brandRecipients(shopId: string): Promise<string[]> {
  const shop = await prisma.brandShop.findUnique({
    where: { id: shopId },
    select: { ownerId: true, members: { select: { userId: true, user: { select: { isActive: true } } } } },
  });
  if (!shop) return [];
  return [shop.ownerId, ...shop.members.filter((m) => m.user.isActive).map((m) => m.userId)];
}

/** 판매처(셀러·창고 관리자)가 이 브랜드 상품을 가져가거나 팔 수 있는지 */
export async function partnerAccess(shopId: string, userId: string, requireApproval: boolean) {
  const row = await prisma.brandPartner.findUnique({ where: { shopId_userId: { shopId, userId } }, select: { status: true } });
  if (row?.status === "BLOCKED") return { ok: false as const, status: "BLOCKED" as const, message: "이 브랜드와의 거래가 중지된 계정입니다. 브랜드에 문의해 주세요." };
  if (requireApproval && row?.status !== "APPROVED") {
    return { ok: false as const, status: (row?.status ?? "NONE") as "PENDING" | "NONE", message: row ? "브랜드가 판매처 신청을 검토하고 있습니다. 승인 후 가져올 수 있습니다." : "이 브랜드는 승인된 판매처만 상품을 가져갈 수 있습니다. 먼저 판매처 신청을 해 주세요." };
  }
  return { ok: true as const, status: (row?.status ?? "NONE") as string };
}
