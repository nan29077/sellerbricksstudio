import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { BRAND_BUYER_ROLES } from "@/lib/brands";
import { getSettings } from "@/lib/settings";
import { ROLE_HOME } from "@/lib/rbac";
import type { SP } from "@/lib/list";
import { BrandRequestList } from "@/components/shop/brand-request-list";

export default async function BuyerBrandRequests({ searchParams }: { searchParams: SP }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/brand-requests");
  if (!BRAND_BUYER_ROLES.includes(user.role)) redirect(ROLE_HOME[user.role]);
  if (user.role === "FACILITY_ADMIN" && (await getSettings()).facilityDisabled) redirect("/");
  return (
    <div className="space-y-5 px-4 py-7 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-black text-navy">내 브랜드 신청</h1>
        <Link href="/brands" className="text-sm font-bold text-brand-800 hover:underline">브랜드샵 둘러보기</Link>
      </div>
      <BrandRequestList base="/brand-requests" scope={{ buyerId: user.id }} manager={false} params={searchParams} />
    </div>
  );
}
