import { requireRole } from "@/lib/auth";
import { brandShopWhere } from "@/lib/brand-access";
import { prisma } from "@/lib/prisma";
import { reportDbError } from "@/lib/db-error";
import { BrandShopPanel } from "@/components/shop/brand-workspace";
import { DataNotice } from "@/components/dashboard/kit";
import { BrandVideoManager } from "@/components/brand/brand-video-manager";

export const dynamic = "force-dynamic";

// 브랜드 계정: 샵 꾸미기 · 소개 · 사업자/정산 정보
export default async function BrandShopPage() {
  const user = await requireRole(["BRAND_ADMIN"]);
  if (user.id === "demo-brand") return <p className="rounded-2xl border bg-white p-5 text-sm text-slate-700">데모 계정에서 샵을 만들고 저장하려면 데이터베이스 연결이 필요합니다.</p>;
  try {
    const [shop, profile] = await Promise.all([
      prisma.brandShop.findFirst({ where: brandShopWhere(user.id) }),
      prisma.profile.findUnique({ where: { userId: user.id }, select: { companyName: true } }),
    ]);
    return (
      <div className="space-y-6">
        <BrandShopPanel shop={shop} name={profile?.companyName || user.name || ""} isOwner={!shop || shop.ownerId === user.id} />
        {shop && <BrandVideoManager shopId={shop.id} shopName={shop.name} />}
      </div>
    );
  } catch (e) {
    return <DataNotice issue={reportDbError("brand-shop", e)} />;
  }
}
