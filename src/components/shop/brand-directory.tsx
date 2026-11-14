import Link from "next/link";
import { ClipboardList, Gift, PackagePlus, Search, ShoppingBag, Sparkles, Store } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { BRAND_CATEGORIES, PUBLIC_BRAND_SHOP, canSeeSupplyPrice } from "@/lib/brands";
import { categoryFilterValues } from "@/lib/categories";
import { BRAND_ARTWORK } from "@/lib/shop-artwork";
import { reportDbError } from "@/lib/db-error";
import { pageOf, sp, withParams, type SP } from "@/lib/list";
import { cn, formatKRW } from "@/lib/utils";
import { defaultProfileImage } from "@/lib/profile";
import { Input, Select } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cardActionClassName, cardLinkClassName } from "@/components/ui/card";
import { Pagination } from "@/components/list/pagination";
import { ShopImage } from "@/components/shop/shop-image";
import { BrandCatalogProductCard } from "@/components/shop/brand-catalog-product-card";
import { DataNotice } from "@/components/dashboard/kit";


const SORTS = [
  { value: "", label: "신규 입점순" },
  { value: "products", label: "상품 많은 순" },
  { value: "name", label: "이름순" },
] as const;

// 브랜드샵 목록 — 메인(/brands)과 각 대시보드(셀러 · 창고 운영 · 브랜드)의 '브랜드샵 둘러보기'가 같은 내용을 보여 준다 (2026-11-14)
export async function BrandDirectory({ searchParams, base = "/brands", dashboard = false }: { searchParams: SP; base?: string; dashboard?: boolean }) {
  const q = sp(searchParams, "q")?.slice(0, 100) ?? "";
  const category = BRAND_CATEGORIES.find((value) => value === sp(searchParams, "category"));
  const sort = SORTS.find((s) => s.value === sp(searchParams, "sort"))?.value ?? "";
  const sampleOnly = sp(searchParams, "sample") === "1";
  const { page, size, skip, take } = pageOf(searchParams, 12);
  const match = q ? { contains: q, mode: "insensitive" as const } : undefined;
  const cats = category ? { in: categoryFilterValues(category) } : undefined;
  const visibleShop = PUBLIC_BRAND_SHOP;
  const where: Prisma.BrandShopWhereInput = {
    ...visibleShop,
    AND: [
      ...(cats ? [{ OR: [{ categories: { has: category } }, { products: { some: { isActive: true, category: cats } } }] }] : []),
      ...(match ? [{ OR: [{ name: match }, { tagline: match }, { products: { some: { isActive: true, name: match, ...(cats && { category: cats }) } } }] }] : []),
      ...(sampleOnly ? [{ products: { some: { isActive: true, sampleStock: { gt: 0 } } } }] : []),
    ],
  };
  const orderBy: Prisma.BrandShopOrderByWithRelationInput = sort === "products" ? { products: { _count: "desc" } } : sort === "name" ? { name: "asc" } : { createdAt: "desc" };
  const filtered = !!(q || category || sampleOnly || page > 1);
  const link = (patch: Record<string, string | null>) => withParams(base, searchParams, { page: null, ...patch });

  const user = await getSessionUser().catch(() => null);
  // 공급가는 거래 파트너(셀러·창고)·최고관리자에게만 보여 준다
  const showSupply = canSeeSupplyPrice(user?.role);
  let data;
  try {
    const activeProduct: Prisma.BrandProductWhereInput = { isActive: true, shop: visibleShop };
    const [shops, total, shopCount, productCount, sampleCount, fresh] = await Promise.all([
      prisma.brandShop.findMany({
        where, skip, take, orderBy,
        select: { id: true, name: true, tagline: true, logoUrl: true, bannerUrl: true, categories: true, createdAt: true,
          _count: { select: { products: { where: { isActive: true } } } } },
      }),
      prisma.brandShop.count({ where }),
      prisma.brandShop.count({ where: visibleShop }),
      prisma.brandProduct.count({ where: activeProduct }),
      prisma.brandProduct.count({ where: { ...activeProduct, sampleStock: { gt: 0 } } }),
      filtered ? Promise.resolve([]) : prisma.brandProduct.findMany({
        where: activeProduct, orderBy: { createdAt: "desc" }, take: 8,
        select: { id: true, name: true, category: true, imageUrl: true, supplyPrice: true, consumerPrice: true, sampleStock: true, samplePrice: true, shop: { select: { id: true, name: true } } },
      }),
    ]);
    const ids = shops.map((s) => s.id);
    const [samples, minPrices] = ids.length ? await Promise.all([
      prisma.brandProduct.groupBy({ by: ["shopId"], where: { shopId: { in: ids }, isActive: true, sampleStock: { gt: 0 } }, _count: true }),
      prisma.brandProduct.groupBy({ by: ["shopId"], where: { shopId: { in: ids }, isActive: true }, _min: { supplyPrice: true } }),
    ]) : [[], []];
    data = {
      shops: shops.map((s) => ({ ...s, samples: samples.find((x) => x.shopId === s.id)?._count ?? 0, minPrice: showSupply ? minPrices.find((x) => x.shopId === s.id)?._min.supplyPrice ?? null : null })),
      total, shopCount, productCount, sampleCount, fresh: fresh.map((p) => ({ ...p, supplyPrice: showSupply ? p.supplyPrice : null })),
    };
  } catch (e) {
    const issue = reportDbError("brands", e);
    return <div className={cn("space-y-6", !dashboard && "px-4 py-7 sm:px-6")}><h1 className="text-3xl font-black text-navy">브랜드샵</h1><DataNotice issue={issue} /></div>;
  }

  const buyer = user?.role === "SELLER" || user?.role === "SUPER_ADMIN"; // 셀러 · 스토리지마켓 본사(창고 상품)
  const myProducts = user?.role === "SELLER" ? "/seller/brand-products" : "/facility/brand-products";

  return (
    <div className={cn("space-y-6", !dashboard && "px-4 py-7 sm:px-6")}>
      <section className="relative isolate overflow-hidden rounded-[26px] bg-navy p-6 text-white sm:p-8">
        <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/25 blur-3xl" />
        <ShoppingBag className="mb-3 h-7 w-7 text-brand-300" />
        <h1 className="text-3xl font-black">브랜드샵</h1>
        <p className="mt-2 max-w-xl break-keep text-sm leading-6 text-slate-200">방송에 어울리는 상품을 찾아 판매 상품으로 고르고, 샘플을 신청해 보세요. 예약할 때 담으면 시연품이 공간으로 미리 오고, 판매분은 주문서로 내면 브랜드가 바로 보냅니다.</p>
        <dl className="mt-5 grid max-w-md grid-cols-3 gap-2 text-center">
          {[{ k: "입점 브랜드", v: data.shopCount }, { k: "판매 상품", v: data.productCount }, { k: "샘플 가능", v: data.sampleCount }].map((x) => (
            <div key={x.k} className="rounded-2xl bg-white/[0.08] px-2 py-2.5"><dt className="text-[11px] text-white/60">{x.k}</dt><dd className="text-xl font-extrabold">{x.v.toLocaleString("ko-KR")}</dd></div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
          {buyer && <Link href={myProducts} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-500 px-4 text-navy hover:bg-brand-400"><PackagePlus className="h-4 w-4" />내 브랜드 판매 상품</Link>}
          {buyer && <Link href={base === "/brands" ? "/brand-requests" : base.replace(/\/brands$/, "/brand-requests")} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 hover:bg-white/20"><ClipboardList className="h-4 w-4" />샘플 신청 내역</Link>}
          {user?.role === "BRAND_ADMIN" && <Link href="/brand/dashboard" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-500 px-4 text-navy hover:bg-brand-400"><Store className="h-4 w-4" />내 브랜드샵 관리</Link>}
          {!user && <Link href="/signup/brand" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 hover:bg-white/20"><Store className="h-4 w-4" />브랜드사 입점 신청</Link>}
        </div>
      </section>

      <form action={base} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_9rem_9rem_auto]">
        <Input name="q" aria-label="브랜드샵 검색" defaultValue={q} maxLength={100} placeholder="브랜드명 · 상품명 검색" className="col-span-2 sm:col-span-1" />
        <Select name="category" aria-label="카테고리" defaultValue={category ?? ""}>
          <option value="">전체 카테고리</option>
          {BRAND_CATEGORIES.map((name) => <option key={name}>{name}</option>)}
        </Select>
        <Select name="sort" aria-label="정렬" defaultValue={sort}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
        {sampleOnly && <input type="hidden" name="sample" value="1" />}
        <Button type="submit"><Search className="h-4 w-4" /> 검색</Button>
      </form>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Link href={link({ sample: sampleOnly ? null : "1" })} className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold", sampleOnly ? "border-navy bg-navy text-white" : "border-brand-300 bg-brand-50 text-navy")}>
          <Gift className="h-3.5 w-3.5" />샘플 가능
        </Link>
        <Link href={link({ category: null })} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold", !category ? "border-navy bg-navy text-white" : "bg-white text-slate-600")}>전체</Link>
        {BRAND_CATEGORIES.map((c) => (
          <Link key={c} href={link({ category: c })} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold", category === c ? "border-navy bg-navy text-white" : "bg-white text-slate-600 hover:border-brand-300")}>{c}</Link>
        ))}
      </div>

      {data.fresh.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-lg font-black text-navy"><Sparkles className="h-5 w-5 text-brand-600" />새로 들어온 상품</h2>
          <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 py-1">
            {data.fresh.map((p) => (
              <li key={p.id} className="w-40 shrink-0 snap-start sm:w-44"><BrandCatalogProductCard product={p} base={base} /></li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-end justify-between">
        <h2 className="text-lg font-black text-navy">{category ? `${category} 브랜드` : "전체 브랜드"}</h2>
        <span className="text-xs text-slate-500">{data.total.toLocaleString("ko-KR")}곳</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.shops.map((shop) => (
          <Link key={shop.id} href={`${base}/${shop.id}${category ? `?category=${encodeURIComponent(category)}` : ""}`}
            aria-label={`${shop.name} 브랜드샵 보기`} className={cardLinkClassName}>
            <div className="relative">
              <ShopImage src={shop.bannerUrl} fallback={BRAND_ARTWORK[0].url} className="aspect-[16/9] w-full object-cover" />
              <ShopImage src={shop.logoUrl} fallback={defaultProfileImage(`brand:${shop.id}`)} className="absolute -bottom-6 left-4 h-12 w-12 rounded-xl border-2 border-white bg-white object-cover shadow-sm" />
              {Date.now() - shop.createdAt.getTime() < 14 * 86400000 && <span className="absolute right-3 top-3 rounded-md bg-brand-200 px-2 py-0.5 text-[11px] font-bold text-navy">신규</span>}
            </div>
            <div className="flex flex-1 flex-col p-4 pt-8">
              <h3 className="break-words text-lg font-black tracking-tight text-navy">{shop.name}</h3>
              {shop.tagline && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{shop.tagline}</p>}
              {shop.categories.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{shop.categories.slice(0, 5).map((c) => <span key={c} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{c}</span>)}</div>}
              <div className="mt-auto pt-3">
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <span>상품 {shop._count.products.toLocaleString("ko-KR")}개</span>
                  {shop.minPrice !== null && <span>공급가 {formatKRW(shop.minPrice)}~</span>}
                  {shop.samples > 0 && <span className="font-bold text-brand-800">샘플 가능 {shop.samples}개</span>}
                </div>
                <span className={cardActionClassName}>브랜드샵 보기</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {data.shops.length === 0 && (
        <div className="rounded-2xl border bg-white p-6 text-center text-sm text-slate-600">
          조건에 맞는 공개 브랜드샵이 없습니다. {filtered && <Link href={base} className="font-bold text-brand-800 underline">필터 초기화</Link>}
        </div>
      )}
      <Pagination base={base} params={searchParams} page={page} size={size} total={data.total} />
      {user?.role !== "BRAND_ADMIN" && <Link href="/signup/brand" className={buttonVariants({ variant: "secondary", className: "rounded-xl" })}>브랜드사 입점 신청</Link>}
    </div>
  );
}
