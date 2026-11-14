"use client";
import { useState } from "react";
import { ShopImage } from "@/components/shop/shop-image";
import { cn } from "@/lib/utils";

// 상품 상세 사진 — 큰 사진 + 아래 작은 사진을 눌러 바꿔 보기 (2026-11-14)
export function ProductGallery({ images, fallback, alt }: { images: string[]; fallback: string; alt: string }) {
  const list = images.length ? images : [fallback];
  const [index, setIndex] = useState(0);
  const current = list[Math.min(index, list.length - 1)];
  return (
    <div className="space-y-2">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-100 bg-[#F4F0E9]">
        <ShopImage key={current} src={current} fallback={fallback} alt={alt} eager className="h-full w-full object-contain" />
        {list.length > 1 && <span className="absolute bottom-2 right-2 rounded-full bg-navy/75 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">{index + 1} / {list.length}</span>}
      </div>
      {list.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {list.map((src, i) => (
            <button key={src} type="button" onClick={() => setIndex(i)} aria-label={`${i + 1}번째 사진 보기`} aria-pressed={i === index}
              className={cn("h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-[#F4F0E9] transition sm:h-16 sm:w-16", i === index ? "border-navy" : "border-transparent opacity-70 hover:opacity-100")}>
              <ShopImage src={src} fallback={fallback} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
