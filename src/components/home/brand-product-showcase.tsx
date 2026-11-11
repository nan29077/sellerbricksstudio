"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Flame, Gift, PackagePlus, ShoppingBag, Sparkles, Star } from "lucide-react";
import { ShopImage } from "@/components/shop/shop-image";
import { brandArtworkFor, brandProductHref } from "@/lib/brands";
import { generatedBrandProductArtwork } from "@/lib/brand-product-artwork";
import type { HomeBrandProduct, HomeBrandProducts } from "@/lib/home-brand-products";
import { cn, formatKRW } from "@/lib/utils";

const filters = [
  { key: "weekly", label: "이번 주 추천", icon: Sparkles, description: "이번 주에 많이 판매된 상품과 최근 등록된 재고 상품을 골랐어요." },
  { key: "popular", label: "인기순", icon: Flame, description: "최근 30일 동안 결제된 판매 수량이 많은 순으로 보여드려요." },
  { key: "recommended", label: "추천순", icon: Star, description: "샘플을 신청할 수 있거나 출고가 빠른 재고 상품을 모았어요." },
  { key: "latest", label: "신상품", icon: PackagePlus, description: "브랜드가 최근에 등록한 상품이에요." },
  { key: "samples", label: "샘플 가능", icon: Gift, description: "신청 가능한 샘플을 무료부터 가격이 낮은 순으로 모았어요." },
] as const;

const emptyMessages: Record<keyof HomeBrandProducts, string> = {
  weekly: "이번 주에 추천할 재고 상품이 아직 없어요.",
  popular: "최근 30일 동안 집계된 브랜드 상품 판매가 아직 없어요.",
  recommended: "추천할 재고 상품이 아직 없어요.",
  latest: "공개된 브랜드 상품이 아직 없어요.",
  samples: "지금 신청할 수 있는 샘플이 없어요.",
};

function ProductCard({ product, rank }: { product: HomeBrandProduct; rank?: number }) {
  const artwork = generatedBrandProductArtwork(product.shop.name, product);
  const sample = product.samplePrice !== null && product.sampleStock > 0
    ? (product.samplePrice === 0 ? "무료 샘플" : "유료 샘플") : null;

  return (
    <Link href={brandProductHref(product.shop.id, product.id)}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#EAE3D7] bg-white transition hover:border-brand-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
      <div className="relative aspect-square overflow-hidden bg-[#F4F0E9]">
        <ShopImage src={product.imageUrl} fallback={artwork?.cover ?? brandArtworkFor(product.category)} className="h-full w-full object-cover transition duration-300 group-hover:scale-105 motion-reduce:transition-none" />
        {rank !== undefined && <span aria-label={`판매량 ${rank}위`} className="absolute left-2 top-2 grid h-7 min-w-7 place-items-center rounded-lg bg-navy px-1.5 text-xs font-black tabular-nums text-white">{rank}</span>}
        {sample && <span className="absolute bottom-2 left-2 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-navy shadow-sm">{sample}</span>}
      </div>
      <div className="flex flex-1 flex-col p-2.5 sm:p-3.5">
        <p className="truncate text-[11px] font-semibold text-slate-600">{product.shop.name}</p>
        <h3 className="mb-2 mt-1 line-clamp-2 min-h-10 break-words text-sm font-extrabold leading-5 text-navy">{product.name}</h3>
        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-1 gap-y-1 border-t border-[#F1EBE0] pt-2">
          <p className="text-sm font-black text-navy"><span className="mr-1 text-[11px] font-medium text-slate-600">공급가</span>{formatKRW(product.supplyPrice)}</p>
          {product.stock <= 0 ? <span className="text-[11px] font-semibold text-slate-600">품절</span> : <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 self-center text-brand-800" />}
        </div>
      </div>
    </Link>
  );
}

export function BrandProductShowcase({ data }: { data: HomeBrandProducts | null }) {
  const [filter, setFilter] = useState<keyof HomeBrandProducts>(data?.weekly.length || !data?.latest.length ? "weekly" : "latest");
  const current = filters.find(({ key }) => key === filter) ?? filters[0];
  const products = data?.[filter] ?? [];

  return (
    <section id="brand-products" aria-labelledby="brand-products-heading" className="scroll-mt-20 px-3 pt-7 sm:px-6 sm:pt-9">
      <div className="rounded-[24px] border border-[#EAE3D7] bg-[#FFFBF3] p-3.5 sm:rounded-[28px] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-200 text-navy"><ShoppingBag aria-hidden="true" className="h-5 w-5" /></span>
            <h2 id="brand-products-heading" className="text-xl font-black tracking-tight text-navy sm:text-[1.65rem]">브랜드 상품 둘러보기</h2>
          </div>
          <Link href="/brands" className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-brand-800 hover:text-navy sm:text-sm">브랜드샵 전체 보기<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>

        {data ? (
          <>
            <div role="group" aria-label="브랜드 상품 보기 방식" className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 py-1 sm:gap-2">
              {filters.map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" aria-pressed={key === filter} aria-controls="home-brand-product-results" onClick={() => setFilter(key)}
                  className={cn("inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 sm:px-3.5", key === filter ? "border-navy bg-navy text-white" : "border-[#EAE3D7] bg-white text-navy hover:border-brand-400")}>
                  <Icon aria-hidden="true" className={cn("h-3.5 w-3.5", key === filter ? "text-brand-300" : "text-brand-800")} />{label}
                </button>
              ))}
            </div>
            <div id="home-brand-product-results">
              <p role="status" className="mb-3 mt-2 text-xs leading-5 text-slate-600">{products.length ? current.description : emptyMessages[filter]}</p>
              {products.length > 0 && (
                <ul aria-label={current.label} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                  {products.map((product, index) => <li key={product.id} className="min-w-0"><ProductCard product={product} rank={filter === "popular" ? index + 1 : undefined} /></li>)}
                </ul>
              )}
            </div>
          </>
        ) : (
          <p className="mt-3 rounded-xl border border-[#EAE3D7] bg-white p-3 text-sm text-slate-600">브랜드 상품을 불러오지 못했습니다. 브랜드샵에서 다시 확인해 주세요.</p>
        )}
      </div>
    </section>
  );
}
