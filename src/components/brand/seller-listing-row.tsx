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
    <div className="flex flex-wrap items-center gap-2">
      <Input type="number" min={supplyPrice} value={price} readOnly={fixed} title={fixed ? "브랜드가 판매가를 고정한 상품입니다" : undefined} onChange={(e) => setPrice(e.target.value)} className="h-9 w-28" aria-label="판매가" />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />판매</label>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => call({ action: "seller-update", listingId: id, salePrice: Number(price), isActive: active })}>저장</Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={async () => { if ((await appConfirm("내 판매 상품에서 뺄까요? 이미 방송에 올린 상품은 그대로 판매됩니다."))) call({ action: "seller-remove", listingId: id }); }}>빼기</Button>
      {err && <p role="alert" className="basis-full text-xs text-red-700">{err}</p>}
    </div>
  );
}
