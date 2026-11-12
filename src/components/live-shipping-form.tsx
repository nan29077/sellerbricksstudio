"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatKRW } from "@/lib/utils";
import { Truck } from "lucide-react";

type Mode = "FREE" | "PAID" | "CONDITIONAL";

// 셀러가 방송마다 배송비를 정한다: 무료(상품가 포함) · 유료 · 조건부 무료
export function LiveShippingForm({ sessionId, shippingFee, freeShippingOver, disabled }: { sessionId: string; shippingFee: number; freeShippingOver: number | null; disabled?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(shippingFee <= 0 ? "FREE" : freeShippingOver ? "CONDITIONAL" : "PAID");
  const [fee, setFee] = useState(String(shippingFee > 0 ? shippingFee : 3000));
  const [over, setOver] = useState(String(freeShippingOver ?? 50000));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const num = (v: string) => Number(v.replace(/[^\d]/g, "") || 0);

  async function save() {
    setBusy(true); setMsg("");
    const body = mode === "FREE" ? { shippingFee: 0, freeShippingOver: null } : { shippingFee: num(fee), freeShippingOver: mode === "CONDITIONAL" ? num(over) : null };
    const res = await fetch(`/api/live-sessions/${sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    setMsg(json.ok ? "저장했습니다. 다음 주문부터 적용됩니다." : json.error ?? "저장하지 못했습니다.");
    if (json.ok) router.refresh();
  }

  const options: [Mode, string, string][] = [
    ["FREE", "무료배송", "배송비를 상품가에 포함"],
    ["PAID", "유료배송", "주문마다 배송비 청구"],
    ["CONDITIONAL", "조건부 무료", "일정 금액 이상 무료"],
  ];
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-3 gap-2">
        {options.map(([v, label, desc]) => (
          <button key={v} type="button" disabled={disabled} onClick={() => setMode(v)}
            className={`rounded-xl border-2 p-2 text-left ${mode === v ? "border-brand-500 bg-brand-50" : "border-border"}`}>
            <span className="block font-bold text-navy">{label}</span><span className="block text-[11px] text-slate-500">{desc}</span>
          </button>
        ))}
      </div>
      {mode !== "FREE" && (
        <div className="grid grid-cols-2 gap-2">
          <div><Label htmlFor="ship-fee">배송비(원)</Label><Input id="ship-fee" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} disabled={disabled} /></div>
          {mode === "CONDITIONAL" && <div><Label htmlFor="ship-over">무료 기준 금액(원)</Label><Input id="ship-over" inputMode="numeric" value={over} onChange={(e) => setOver(e.target.value)} disabled={disabled} /></div>}
        </div>
      )}
      <p className="flex items-center gap-1 text-xs text-slate-500"><Truck className="h-3.5 w-3.5" />
        {mode === "FREE" ? "구매자에게 무료배송으로 표시됩니다." : mode === "PAID" ? `주문마다 ${formatKRW(num(fee))}이 추가됩니다.` : `${formatKRW(num(over))} 미만 주문에 ${formatKRW(num(fee))}이 추가됩니다.`}
        {" "}받은 배송비는 택배를 보내는 쪽 정산에 포함됩니다. (창고(스튜디오)가 출고하면 창고, 브랜드 직배송 · 내 공간 방송은 셀러)
      </p>
      <Button size="sm" onClick={save} disabled={busy || disabled}>{busy ? "저장 중..." : "배송비 저장"}</Button>
      {msg && <p className="text-xs text-slate-600">{msg}</p>}
    </div>
  );
}
