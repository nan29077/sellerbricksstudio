import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { BRAND_BUYER_ROLES, brandProductHref } from "@/lib/brands";
import { ROLE_HOME } from "@/lib/rbac";
import { formatKRW } from "@/lib/utils";
import { BrandFavoriteButton } from "@/components/shop/brand-favorite-button";
import { Heart } from "lucide-react";

export const dynamic = "force-dynamic";

// 찜한 브랜드 상품: 상품을 눌러 샘플 신청 · 판매 상품 가져오기를 진행한다.
export default async function BrandFavorites() {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/brand-favorites");
  if (!BRAND_BUYER_ROLES.includes(user.role)) redirect(ROLE_HOME[user.role]);
  const rows = user.id.startsWith("demo-") ? [] : await prisma.brandProductFavorite.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "desc" },
    include: { brandProduct: { select: { id: true, name: true, imageUrl: true, supplyPrice: true, consumerPrice: true, samplePrice: true, stock: true, isActive: true, shop: { select: { id: true, name: true, status: true } } } } },
  });
  const imported = new Set(rows.length ? (user.role === "SELLER"
    ? await prisma.sellerBrandProduct.findMany({ where: { sellerId: user.id, brandProductId: { in: rows.map((r) => r.brandProductId) } }, select: { brandProductId: true } })
    : await prisma.facilityProduct.findMany({ where: { facility: { ownerId: user.id }, brandProductId: { in: rows.map((r) => r.brandProductId) } }, select: { brandProductId: true } })
  ).map((x) => x.brandProductId).filter(Boolean) as string[] : []);
  return (
    <div className="space-y-5 px-4 py-7 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-black text-navy"><Heart className="h-6 w-6 text-red-500" />찜한 브랜드 상품</h1>
        <Link href="/brands" className="text-sm font-bold text-brand-800 hover:underline">브랜드샵 둘러보기</Link>
      </div>
      <p className="text-sm text-slate-600">상품을 눌러 샘플을 신청하거나 판매 상품으로 가져오세요. 샘플 구매는 판매와 별개로 진행됩니다.</p>
      {rows.length === 0 ? (
        <p className="rounded-2xl border bg-white px-4 py-10 text-center text-sm text-slate-600">아직 찜한 상품이 없습니다. 브랜드샵에서 마음에 드는 상품의 &lsquo;찜하기&rsquo;를 눌러 보세요.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rows.map(({ brandProduct: p }) => {
            const available = p.isActive && p.shop.status === "APPROVED";
            return (
              <article key={p.id} className="overflow-hidden rounded-2xl border bg-white">
                <Link href={brandProductHref(p.shop.id, p.id)} className="block bg-[#F4F0E9]">
                  {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="aspect-square w-full object-cover" /> : <div className="aspect-square w-full" />}
                </Link>
                <div className="space-y-1 p-3">
                  <p className="text-[11px] text-slate-500">{p.shop.name}</p>
                  <Link href={brandProductHref(p.shop.id, p.id)} className="line-clamp-2 text-sm font-bold text-navy hover:underline">{p.name}</Link>
                  <p className="text-xs font-semibold">공급 {formatKRW(p.supplyPrice)}{p.consumerPrice > 0 && <span className="text-slate-500"> · 권장 {formatKRW(p.consumerPrice)}</span>}</p>
                  <p className="text-[11px] text-slate-600">샘플 {p.samplePrice === null ? "미제공" : p.samplePrice === 0 ? "무료" : formatKRW(p.samplePrice)} · 재고 {p.stock}개</p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <BrandFavoriteButton productId={p.id} initial />
                    {imported.has(p.id) && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">판매 목록에 있음</span>}
                    {!available && <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">판매 중지</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
