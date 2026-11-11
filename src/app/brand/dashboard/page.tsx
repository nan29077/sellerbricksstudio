import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BrandWorkspace } from "@/components/shop/brand-workspace";
import type { SP } from "@/lib/list";

export default async function BrandDashboard({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["BRAND_ADMIN"]);
  if (user.id === "demo-brand") {
    return <p className="rounded-2xl border bg-white p-5 text-sm text-slate-700">데모 계정에서 샵을 만들고 저장하려면 데이터베이스 연결이 필요합니다.</p>;
  }
  const [shop, profile] = await Promise.all([
    prisma.brandShop.findUnique({ where: { ownerId: user.id } }),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { companyName: true } }),
  ]);
  return <BrandWorkspace shop={shop} name={profile?.companyName || user.name || ""} params={searchParams} />;
}
