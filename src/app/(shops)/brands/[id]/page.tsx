import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, ClipboardList, Headset, House, LayoutTemplate, LogIn, Package, ShoppingBag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { BRAND_BUYER_ROLES, BRAND_CATEGORIES, brandArtworkFor } from "@/lib/brands";
import { BRAND_ARTWORK } from "@/lib/shop-artwork";
import { formatKRW } from "@/lib/utils";
import { pageOf, sp, type SP } from "@/lib/list";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Pagination } from "@/components/list/pagination";
import { BrandOrderButton } from "@/components/shop/brand-order-button";
import { ShopImage } from "@/components/shop/shop-image";
import { ShopShell } from "@/components/shop/shop-shell";

export const dynamic = "force-dynamic";

export default async function BrandStorefront({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const [shop, user] = await Promise.all([
    prisma.brandShop.findUnique({
      where: { id: params.id },
      select: {
        id: true, ownerId: true, owner: { select: { isActive: true, role: true } }, status: true,
        name: true, tagline: true, description: true, logoUrl: true, bannerUrl: true, backgroundUrl: true,
        paymentInstructions: true,
      },
    }),
    getSessionUser(),
  ]);
  if (!shop) notFound();
  const published = shop.status === "APPROVED" && shop.owner.isActive && shop.owner.role === "BRAND_ADMIN";
  if (!published && user?.id !== shop.ownerId && user?.role !== "SUPER_ADMIN") notFound();

  const buyer = !!user && BRAND_BUYER_ROLES.includes(user.role)
    && (user.role !== "FACILITY_ADMIN" || !(await getSettings()).facilityDisabled);
  const category = BRAND_CATEGORIES.find((value) => value === sp(searchParams, "category"));
  const { page, size, skip, take } = pageOf(searchParams, 12);
  const where = { shopId: shop.id, isActive: true, ...(category && { category }) };
  const [products, total] = await Promise.all([
    prisma.brandProduct.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    prisma.brandProduct.count({ where }),
  ]);
  const path = `/brands/${shop.id}`;
  const login = `/login?callbackUrl=${encodeURIComponent(path)}`;
  const management = user?.role === "SUPER_ADMIN" ? `/admin/brands/${shop.id}` : user?.id === shop.ownerId ? "/brand/dashboard" : null;
  const links = [
    { href: "#shop-home", label: "샵 홈", icon: House },
    { href: "#shop-products", label: "상품", icon: Boxes },
    ...(buyer ? [{ href: "/brand-requests", label: "내 신청", icon: ClipboardList }] : []),
    ...(management ? [{ href: management, label: "샵 관리", icon: LayoutTemplate }] : []),
    ...(!user ? [{ href: login, label: "로그인", icon: LogIn }] : []),
    { href: "/brands", label: "브랜드샵", icon: ShoppingBag },
    { href: "/support", label: "문의", icon: Headset },
  ];

  return (
    <ShopShell background={shop.backgroundUrl} fallback={BRAND_ARTWORK[4].url} links={links}>
      <header id="shop-home" className="flex min-h-16 items-center justify-between gap-4 border-b bg-white px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <ShopImage src={shop.logoUrl} fallback="/images/brand/mark-original-on-light.png" className="h-9 w-9 shrink-0 rounded-full border bg-white object-cover" />
          <span className="truncate text-sm font-black text-navy">{shop.name}</span>
        </div>
        <Link href="/brands" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-slate-600 hover:text-navy"><ArrowLeft className="h-4 w-4" /> 브랜드 목록</Link>
      </header>
      <main className="px-3 py-4 sm:px-6 sm:py-6">
        <div className="relative aspect-[16/8] overflow-hidden rounded-[26px] bg-navy sm:aspect-[16/7]">
          <ShopImage src={shop.bannerUrl} fallback={BRAND_ARTWORK[0].url} eager className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/45 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center px-5 pb-5 text-white sm:px-9">
            <p className="mb-2 text-xs font-bold text-brand-200">셀러브릭스 브랜드샵</p>
            <h1 className="line-clamp-2 break-words text-2xl font-black sm:text-4xl">{shop.name}</h1>
            {shop.tagline && <p className="mt-2 line-clamp-2 max-w-sm text-sm">{shop.tagline}</p>}
          </div>
        </div>
        <section className="relative mx-3 -mt-7 rounded-[24px] border border-white bg-white p-4 shadow-[0_10px_30px_#1A1A2E15] sm:mx-6 sm:-mt-10 sm:p-6">
          <div className="flex items-center gap-3">
            <ShopImage src={shop.logoUrl} fallback="/images/brand/mark-original-on-light.png" className="h-14 w-14 rounded-full border bg-white object-cover" />
            <div><h2 className="font-black text-navy">{shop.name}</h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-600">{published ? "셀러브릭스 파트너 브랜드" : "비공개 미리보기"}</p></div>
          </div>
          {shop.description && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{shop.description}</p>}
          {!user && <Link href={login} className={`${buttonVariants({ size: "sm" })} mt-4`}>로그인하고 신청하기</Link>}
          {user && !buyer && published && <p className="mt-3 text-xs text-slate-600">공급 신청과 샘플 주문은 셀러와 창고(스튜디오) 관리자 계정으로 이용할 수 있습니다.</p>}
        </section>

        <section id="shop-products" className="mt-7 scroll-mt-4 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-black text-navy">브랜드 상품</h2>
            <form action={path} className="flex items-center gap-2">
              <Select name="category" aria-label="상품 카테고리" defaultValue={category ?? ""} className="w-auto">
                <option value="">전체 카테고리</option>
                {BRAND_CATEGORIES.map((name) => <option key={name}>{name}</option>)}
              </Select>
              <Button size="sm" variant="outline">조회</Button>
            </form>
          </div>
          {products.length === 0 && <p className="rounded-2xl border bg-white p-6 text-sm text-slate-600">공개된 상품이 없습니다.</p>}
          <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2">
            {products.map((product) => <article key={product.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white">
              <div className="relative">
                <ShopImage src={product.imageUrl} fallback={brandArtworkFor(product.category)} className="aspect-[4/3] w-full object-cover" />
                <span className="absolute bottom-2 left-2 rounded-full bg-white px-2 py-1 text-[11px] font-bold">{product.category}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
                <h3 className="break-words font-extrabold text-navy">{product.name}</h3>
                {product.description && <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600">{product.description}</p>}
                <p className="mt-auto text-sm font-black">공급 {formatKRW(product.supplyPrice)}<span className="ml-1 text-xs font-medium text-slate-600">· {product.stock}개</span></p>
                {product.samplePrice !== null && <p className="text-xs font-semibold text-slate-600"><Package className="mr-1 inline h-3.5 w-3.5" />샘플 {product.samplePrice === 0 ? "무료" : formatKRW(product.samplePrice)} · {product.sampleStock}개</p>}
                {buyer && published && <div className="mt-1 flex flex-wrap gap-1.5">
                  <BrandOrderButton productId={product.id} name={product.name} kind="SUPPLY" unitPrice={product.supplyPrice} stock={product.stock} />
                  {product.samplePrice !== null && (product.samplePrice === 0 || shop.paymentInstructions) &&
                    <BrandOrderButton productId={product.id} name={product.name} kind="SAMPLE" unitPrice={product.samplePrice} stock={product.sampleStock} />}
                </div>}
              </div>
            </article>)}
          </div>
          <Pagination base={path} params={searchParams} page={page} size={size} total={total} />
        </section>
      </main>
    </ShopShell>
  );
}
