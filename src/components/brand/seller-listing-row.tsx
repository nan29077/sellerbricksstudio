"use client";
import { appConfirm } from "@/components/ui/app-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SellerListingRow({ id, salePrice, isActive, supplyPrice, fixed = false }: { id: string; salePrice: number; isActive: boolean; supplyPrice: number; fixed?: boolean }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(salePrice));
  const [active, setActive] = useState(isActive);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function call(body: Record<string, unknown>) {
    setBusy(true); setErr("");
    const res = await fetch("/api/brand-imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    if (!json.ok) { setErr(json.error ?? "저장하지 못했습니다."); return; }
    router.refresh();
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Input type="number" min={supplyPrice} value={price} readOnly={fixed} title={fixed ? "브랜드가 판매가를 고정한 상품입니다" : undefined} onChange={(e) => setPrice(e.target.value)} className="h-9 w-full pr-7 text-right text-sm font-bold" aria-label="판매가" />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">원</span>
        </div>
        <label className="flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-navy" />판매</label>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" variant="outline" className="h-9" disabled={busy} onClick={() => call({ action: "seller-update", listingId: id, salePrice: Number(price), isActive: active })}>저장</Button>
        <Button size="sm" variant="ghost" className="h-9 text-slate-500" disabled={busy} onClick={async () => { if ((await appConfirm("내 판매 상품에서 뺄까요? 이미 방송에 올린 상품은 그대로 판매됩니다."))) call({ action: "seller-remove", listingId: id }); }}>빼기</Button>
      </div>
      {err && <p role="alert" className="text-xs text-red-700">{err}</p>}
    </div>
  );
}
