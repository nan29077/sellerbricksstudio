"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { appAlert } from "@/components/ui/app-dialog";
import { cn } from "@/lib/utils";

// 브랜드 상품 찜 (셀러 · 스토리지마켓 관리자)
export function BrandFavoriteButton({ productId, initial, className }: { productId: string; initial: boolean; className?: string }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const r = await fetch("/api/brand-favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.status === 401) { router.push("/login"); return; }
    if (!j.ok) { void appAlert(j.error ?? "처리에 실패했습니다."); return; }
    setOn(j.data.favorited);
    router.refresh();
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} aria-label={on ? "찜 해제" : "찜하기"}
      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition", on ? "border-red-200 bg-red-50 text-red-600" : "border-border bg-white text-slate-600 hover:border-red-200", className)}>
      <Heart className={cn("h-3.5 w-3.5", on && "fill-red-500 text-red-500")} />{on ? "찜함" : "찜하기"}
    </button>
  );
}
