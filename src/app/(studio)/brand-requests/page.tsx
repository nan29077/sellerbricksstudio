import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { BRAND_BUYER_ROLES } from "@/lib/brands";
import { ROLE_HOME } from "@/lib/rbac";
import { buyerHome } from "@/components/shop/buyer-brand-pages";
import type { SP } from "@/lib/list";

export const dynamic = "force-dynamic";

// 예전 주소 — 2026-11-14부터 각 대시보드 안(셀러 /seller/brand-requests · 최고관리자 /facility/brand-requests)에서 연다
export default async function LegacyBrandRequests({ searchParams }: { searchParams: SP }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/brand-requests");
  if (!BRAND_BUYER_ROLES.includes(user.role)) redirect(ROLE_HOME[user.role]);
  const qs = new URLSearchParams(Object.entries(searchParams).flatMap(([k, v]) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => [k, x] as [string, string]))).toString();
  redirect(`${buyerHome(user.role)}/brand-requests${qs ? `?${qs}` : ""}`);
}
