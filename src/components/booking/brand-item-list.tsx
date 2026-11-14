"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";

// 예약에 담은 브랜드 상품(방송 시연품) 준비 현황 — 공간 운영자는 '도착 확인'을 누른다
export type BrandItemView = {
  id: string; name: string; brandName: string; quantity: number; optionLabel: string | null;
  state: "WAITING" | "REQUESTED" | "PREPARING" | "SHIPPING" | "ARRIVED" | "UNAVAILABLE"; stateLabel: string;
  due: string | null; carrier: string | null; trackingNumber: string | null; reason: string | null;
};
const TONE: Record<BrandItemView["state"], string> = {
  WAITING: "border-slate-200 bg-white text-slate-600", REQUESTED: "border-amber-200 bg-amber-50 text-amber-800", PREPARING: "border-blue-200 bg-blue-50 text-blue-700",
  SHIPPING: "border-violet-200 bg-violet-50 text-violet-700", ARRIVED: "border-emerald-200 bg-emerald-50 text-emerald-700", UNAVAILABLE: "border-red-200 bg-red-50 text-red-700",
};

export function BrandItemList({ items, canConfirm }: { items: BrandItemView[]; canConfirm: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  if (!items.length) return null;
  const arrived = items.filter((i) => i.state === "ARRIVED").length;
  async function confirm(id: string) {
    setBusy(id); setErr("");
    try { await api(`/api/booking-brand-items/${id}`, "PATCH", { action: "arrived" }); router.refresh(); }
    catch (e) { setErr(e instanceof Error ? e.message : "처리하지 못했습니다."); }
    finally { setBusy(null); }
  }
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-2.5">
      <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-bold text-navy"><Truck className="h-3.5 w-3.5 text-brand-600" />방송 브랜드 상품(시연품) {items.length}종 · 도착 {arrived}/{items.length}</p>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold", TONE[i.state])}>{i.stateLabel}</span>
            <span className="min-w-0 font-semibold text-navy">{i.name}{i.optionLabel ? ` · ${i.optionLabel.split(":").pop()}` : ""} ×{i.quantity}</span>
            <span className="text-slate-500">{i.brandName}{i.due && i.state !== "ARRIVED" && i.state !== "UNAVAILABLE" ? ` · ${i.due}까지 도착` : ""}{i.trackingNumber ? ` · ${i.carrier ?? ""} ${i.trackingNumber}` : ""}{i.reason ? ` · ${i.reason}` : ""}</span>
            {canConfirm && (i.state === "PREPARING" || i.state === "SHIPPING") && (
              <Button size="sm" variant="outline" className="ml-auto h-8" disabled={busy === i.id} onClick={() => confirm(i.id)}><PackageCheck className="h-3.5 w-3.5" />{busy === i.id ? "확인 중…" : "도착 확인"}</Button>
            )}
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="mt-1 text-xs font-semibold text-red-600">{err}</p>}
    </div>
  );
}
