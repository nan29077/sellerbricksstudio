import Link from "next/link";
import { ArrowUpRight, ClipboardList, Gift, PackagePlus, Search, ShoppingBag, Sparkles, Store } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { BRAND_CATEGORIES, PUBLIC_BRAND_SHOP, brandArtworkFor } from "@/lib/brands";
import { categoryFilterValues } from "@/lib/categories";
import { BRAND_ARTWORK } from "@/lib/shop-artwork";
import { reportDbError } from "@/lib/db-error";
import { pageOf, sp, withParams, type SP } from "@/lib/list";
import { cn, formatKRW } from "@/lib/utils";
import { defaultProfileImage } from "@/lib/profile";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/list/pagination";
import { ShopImage } from "@/components/shop/shop-image";
import { DataNotice } from "@/components/dashboard/kit";

export const dynamic = "force-dynamic";

const SORTS = [
  { value: "", label: "신규 입점순" },
  { value: "products", label: "상품 많은 순" },
  { value: "name", label: "이름순" },
] as const;

export default async function BrandDirectory({ searchParams }: { searchParams: SP }) {
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
  const link = (patch: Record<string, string | null>) => withParams("/brands", searchParams, { page: null, ...patch });

  const user = await getSessionUser().catch(() => null);
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
      shops: shops.map((s) => ({ ...s, samples: samples.find((x) => x.shopId === s.id)?._count ?? 0, minPrice: minPrices.find((x) => x.shopId === s.id)?._min.supplyPrice ?? null })),
      total, shopCount, productCount, sampleCount, fresh,
    };
  } catch (e) {
    const issue = reportDbError("brands", e);
    return <div className="space-y-6 px-4 py-7 sm:px-6"><h1 className="text-3xl font-black text-navy">브랜드샵</h1><DataNotice issue={issue} /></div>;
  }

  const buyer = user?.role === "SELLER" || user?.role === "FACILITY_ADMIN";
  const myProducts = user?.role === "SELLER" ? "/seller/brand-products" : "/facility/brand-products";

  return (
    <div className="space-y-6 px-4 py-7 sm:px-6">
      <section className="relative isolate overflow-hidden rounded-[26px] bg-navy p-6 text-white sm:p-8">
        <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/25 blur-3xl" />
        <ShoppingBag className="mb-3 h-7 w-7 text-brand-300" />
        <h1 className="text-3xl font-black">브랜드샵</h1>
        <p className="mt-2 max-w-xl break-keep text-sm leading-6 text-slate-200">라이브와 판매에 어울리는 상품을 찾고, 브랜드사에 샘플을 신청하거나 판매 상품으로 가져오세요. 판매되면 발주서가 브랜드사로 자동 전달됩니다.</p>
        <dl className="mt-5 grid max-w-md grid-cols-3 gap-2 text-center">
          {[{ k: "입점 브랜드", v: data.shopCount }, { k: "판매 상품", v: data.productCount }, { k: "샘플 가능", v: data.sampleCount }].map((x) => (
            <div key={x.k} className="rounded-2xl bg-white/[0.08] px-2 py-2.5"><dt className="text-[11px] text-white/60">{x.k}</dt><dd className="text-xl font-extrabold">{x.v.toLocaleString("ko-KR")}</dd></div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
          {buyer && <Link href={myProducts} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-500 px-4 text-navy hover:bg-brand-400"><PackagePlus className="h-4 w-4" />내 브랜드 판매 상품</Link>}
          {buyer && <Link href="/brand-requests" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 hover:bg-white/20"><ClipboardList className="h-4 w-4" />샘플 신청 내역</Link>}
          {user?.role === "BRAND_ADMIN" && <Link href="/brand/dashboard" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-500 px-4 text-navy hover:bg-brand-400"><Store className="h-4 w-4" />내 브랜드샵 관리</Link>}
          {!user && <Link href="/signup/brand" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 hover:bg-white/20"><Store className="h-4 w-4" />브랜드사 입점 신청</Link>}
        </div>
      </section>

      <form action="/brands" className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_9rem_9rem_auto]">
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

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
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
          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {data.fresh.map((p) => (
              <Link key={p.id} href={`/brands/${p.shop.id}#shop-products`} className="w-40 shrink-0 snap-start overflow-hidden rounded-2xl border bg-white shadow-sm hover:border-brand-300">
                <ShopImage src={p.imageUrl} fallback={brandArtworkFor(p.category)} className="aspect-square w-full object-cover" />
                <div className="p-2.5">
                  <p className="truncate text-[11px] text-slate-500">{p.shop.name}</p>
                  <p className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-5 text-navy">{p.name}</p>
                  <p className="mt-1 text-sm font-extrabold text-brand-700">공급가 {formatKRW(p.supplyPrice)}</p>
                  {p.consumerPrice > 0 && <p className="text-[11px] text-slate-400">소비자가 {formatKRW(p.consumerPrice)}</p>}
                  {p.sampleStock > 0 && <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">{p.samplePrice ? "유료 샘플" : "무료 샘플"}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-end justify-between">
        <h2 className="text-lg font-black text-navy">{category ? `${category} 브랜드` : "전체 브랜드"}</h2>
        <span className="text-xs text-slate-500">{data.total.toLocaleString("ko-KR")}곳</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.shops.map((shop) => (
          <Link key={shop.id} href={`/brands/${shop.id}${category ? `?category=${encodeURIComponent(category)}` : ""}`}
            className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
            <div className="relative">
              <ShopImage src={shop.bannerUrl} fallback={BRAND_ARTWORK[0].url} className="aspect-[16/9] w-full object-cover" />
                <ShopImage src={shop.logoUrl} fallback={defaultProfileImage(`brand:${shop.id}`)} className="absolute -bottom-6 left-4 h-12 w-12 rounded-full border-2 border-white bg-white object-cover shadow" />
              {Date.now() - shop.createdAt.getTime() < 14 * 86400000 && <span className="absolute right-3 top-3 rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-extrabold text-navy">NEW</span>}
            </div>
            <div className="p-4 pt-8">
              <div className="flex items-start justify-between gap-2"><h3 className="text-lg font-black text-navy">{shop.name}</h3><ArrowUpRight className="h-4 w-4 shrink-0 text-brand-700" /></div>
              {shop.tagline && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{shop.tagline}</p>}
              {shop.categories.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{shop.categories.slice(0, 5).map((c) => <span key={c} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-navy">{c}</span>)}</div>}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>상품 {shop._count.products.toLocaleString("ko-KR")}개</span>
                {shop.minPrice !== null && <span>공급가 {formatKRW(shop.minPrice)}~</span>}
                {shop.samples > 0 && <span className="font-bold text-blue-700">샘플 가능 {shop.samples}개</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {data.shops.length === 0 && (
        <div className="rounded-2xl border bg-white p-6 text-center text-sm text-slate-600">
          조건에 맞는 공개 브랜드샵이 없습니다. {filtered && <Link href="/brands" className="font-bold text-brand-800 underline">필터 초기화</Link>}
        </div>
      )}
      <Pagination base="/brands" params={searchParams} page={page} size={size} total={data.total} />
      {user?.role !== "BRAND_ADMIN" && <Link href="/signup/brand" className="inline-flex min-h-11 items-center text-sm font-bold text-brand-800 hover:underline">브랜드사 입점 신청 <ArrowUpRight className="ml-1 h-4 w-4" /></Link>}
    </div>
  );
}
