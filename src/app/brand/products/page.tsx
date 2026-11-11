import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { brandShopWhere } from "@/lib/brand-access";
import { prisma } from "@/lib/prisma";
import { reportDbError } from "@/lib/db-error";
import type { SP } from "@/lib/list";
import { BrandProductsPanel } from "@/components/shop/brand-workspace";
import { DataNotice, Empty } from "@/components/dashboard/kit";
import { PackagePlus } from "lucide-react";

export const dynamic = "force-dynamic";

// 브랜드 계정: 상품 · 재고 · 샘플 조건 관리 (샵 정보와 분리)
export default async function BrandProductsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["BRAND_ADMIN"]);
  if (user.id === "demo-brand") return <p className="rounded-2xl border bg-white p-5 text-sm text-slate-700">데모 계정에서 상품을 저장하려면 데이터베이스 연결이 필요합니다.</p>;
  let shop;
  try {
    shop = await prisma.brandShop.findFirst({ where: brandShopWhere(user.id) });
  } catch (e) {
    return <DataNotice issue={reportDbError("brand-products", e)} />;
  }
  if (!shop) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold text-navy">상품 · 재고 관리</h1>
        <Empty icon={PackagePlus} text="상품을 등록하려면 먼저 브랜드샵을 만들어 주세요." action={{ href: "/brand/shop", label: "브랜드샵 만들기" }} />
        <p className="text-center text-xs text-slate-500"><Link href="/brands" className="underline">다른 브랜드샵 둘러보기</Link></p>
      </div>
    );
  }
  return <BrandProductsPanel shop={shop} params={searchParams} />;
}
