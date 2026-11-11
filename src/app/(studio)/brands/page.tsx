import Link from "next/link";
import { ArrowUpRight, Search, ShoppingBag } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BRAND_CATEGORIES } from "@/lib/brands";
import { BRAND_ARTWORK } from "@/lib/shop-artwork";
import { pageOf, sp, type SP } from "@/lib/list";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/list/pagination";
import { ShopImage } from "@/components/shop/shop-image";

export const dynamic = "force-dynamic";

export default async function BrandDirectory({ searchParams }: { searchParams: SP }) {
  const q = sp(searchParams, "q")?.slice(0, 100) ?? "";
  const category = BRAND_CATEGORIES.find((value) => value === sp(searchParams, "category"));
  const { page, size, skip, take } = pageOf(searchParams, 12);
  const match = q ? { contains: q, mode: "insensitive" as const } : undefined;
  const where: Prisma.BrandShopWhereInput = {
    status: "APPROVED", owner: { isActive: true, role: "BRAND_ADMIN" },
    ...(category && { products: { some: { isActive: true, category } } }),
    ...(match && { OR: [{ name: match }, { products: { some: { isActive: true, name: match, ...(category && { category }) } } }] }),
  };
  const result = await Promise.all([
    prisma.brandShop.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      select: { id: true, name: true, tagline: true, bannerUrl: true, _count: { select: { products: { where: { isActive: true } } } } },
    }),
    prisma.brandShop.count({ where }),
  ]).catch((error: unknown) => {
    console.error("Failed to load brand shops", error);
    return null;
  });
  const [shops, total] = result ?? [[], 0];
  return (
    <div className="space-y-6 px-4 py-7 sm:px-6">
      <div className="rounded-[26px] bg-navy p-6 text-white sm:p-8">
        <ShoppingBag className="mb-3 h-7 w-7 text-brand-300" />
        <h1 className="text-3xl font-black">브랜드샵</h1>
        <p className="mt-2 text-sm text-slate-200">라이브와 판매에 어울리는 상품을 찾고, 브랜드사에 공급이나 샘플을 신청하세요.</p>
      </div>
      <form action="/brands" className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_10rem_auto]">
        <Input name="q" aria-label="브랜드샵 검색" defaultValue={q} maxLength={100} placeholder="브랜드명 또는 상품명" className="col-span-2 sm:col-span-1" />
        <Select name="category" aria-label="카테고리" defaultValue={category ?? ""}>
          <option value="">전체 카테고리</option>
          {BRAND_CATEGORIES.map((name) => <option key={name}>{name}</option>)}
        </Select>
        <Button type="submit"><Search className="h-4 w-4" /> 검색</Button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2">
        {shops.map((shop) => <Link key={shop.id} href={`/brands/${shop.id}${category ? `?category=${encodeURIComponent(category)}` : ""}`}
          className="group overflow-hidden rounded-2xl border bg-white shadow-sm hover:border-brand-300">
          <ShopImage src={shop.bannerUrl} fallback={BRAND_ARTWORK[0].url} className="aspect-[16/9] w-full object-cover" />
          <div className="p-4">
            <div className="flex items-start justify-between gap-2"><h2 className="text-lg font-black text-navy">{shop.name}</h2><ArrowUpRight className="h-4 w-4 shrink-0 text-brand-700" /></div>
            {shop.tagline && <p className="mt-1 text-sm text-slate-600">{shop.tagline}</p>}
            <p className="mt-2 text-xs text-slate-500">상품 {shop._count.products.toLocaleString("ko-KR")}개</p>
          </div>
        </Link>)}
      </div>
      {shops.length === 0 && <p className="rounded-2xl border bg-white p-6 text-sm text-slate-600">
        {result ? "조건에 맞는 공개 브랜드샵이 없습니다." : "지금은 브랜드샵 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."}
      </p>}
      <Pagination base="/brands" params={searchParams} page={page} size={size} total={total} />
      <Link href="/signup/brand" className="inline-flex min-h-11 items-center text-sm font-bold text-brand-800 hover:underline">브랜드사 입점 신청 <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
    </div>
  );
}
