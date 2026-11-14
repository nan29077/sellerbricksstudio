import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { brandShopIdFor } from "@/lib/brand-access";

export const dynamic = "force-dynamic";

// 브랜드 계정: 내 브랜드샵을 셀러가 보는 화면 그대로 열어 본다 (왼쪽 플레이어에 내가 넣은 라이브 커머스 영상)
export default async function BrandPreview() {
  const user = await requireRole(["BRAND_ADMIN"]);
  const id = await brandShopIdFor(user.id);
  redirect(id ? `/brands/${id}` : "/brand/shop");
}
