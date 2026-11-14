import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { BRAND_BUYER_ROLES } from "@/lib/brands";

// POST /api/brand-favorites { productId } — 셀러 · 창고(스튜디오) 관리자가 브랜드 상품을 찜/해제 → { favorited }
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!BRAND_BUYER_ROLES.includes(user.role)) return fail("셀러 계정이 필요합니다.", 403);
    if (user.id.startsWith("demo-")) return fail("데모 계정은 찜할 수 없습니다. 회원가입 후 이용해 주세요.");
    const { productId } = await req.json().catch(() => ({}));
    if (typeof productId !== "string" || !productId || productId.length > 64) return fail("상품을 선택하세요.");
    const exists = await prisma.brandProductFavorite.findUnique({ where: { userId_brandProductId: { userId: user.id, brandProductId: productId } } });
    if (exists) {
      await prisma.brandProductFavorite.delete({ where: { id: exists.id } });
      return ok({ favorited: false });
    }
    const p = await prisma.brandProduct.findFirst({ where: { id: productId, isActive: true, shop: { status: "APPROVED" } }, select: { id: true } });
    if (!p) return fail("찜할 수 있는 상품을 찾지 못했습니다.", 404);
    await prisma.brandProductFavorite.create({ data: { userId: user.id, brandProductId: productId } });
    return ok({ favorited: true });
  } catch (e) { return handleError(e); }
}
