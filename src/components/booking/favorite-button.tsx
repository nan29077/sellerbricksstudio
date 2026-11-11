"use client";
import { appAlert } from "@/components/ui/app-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export function FavoriteButton({ facilityId, initial, className, withLabel = false }: { facilityId: string; initial: boolean; className?: string; withLabel?: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const r = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facilityId }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.status === 401) { router.push("/login"); return; }
    if (!j.ok) { void appAlert(j.error ?? "처리에 실패했습니다."); return; }
    setOn(j.data.favorited);
    router.refresh();
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} aria-label={on ? "찜 해제" : "찜하기"}
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition", on ? "border-red-200 bg-red-50 text-red-600" : "border-border bg-white text-slate-600 hover:border-red-200", className)}>
      <Heart className={cn("h-4 w-4", on && "fill-red-500 text-red-500")} />{withLabel && (on ? "찜함" : "찜하기")}
    </button>
  );
}
