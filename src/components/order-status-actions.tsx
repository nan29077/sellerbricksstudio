"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ORDER_NEXT_STATUS } from "@/lib/status";
import { formatKRW } from "@/lib/utils";

const ACTIONS: Record<string, { label: string; variant?: "outline"; ask?: string; confirm?: string }> = {
  PREPARING: { label: "준비 시작", confirm: "상품 준비를 시작할까요?" },
  SHIPPED: { label: "발송", confirm: "발송 처리할까요? 구매자에게 배송중으로 표시됩니다." },
  DELIVERED: { label: "배송 완료", confirm: "배송 완료로 처리할까요?" },
  CANCELLED: { label: "전체 취소", variant: "outline", ask: "결제가 취소되고 재고가 복구됩니다." },
  REFUNDED: { label: "전체 환불", variant: "outline", ask: "남은 결제 금액 전체가 환불됩니다." },
};

export type OrderLine = { id: string; productName: string; optionLabel?: string | null; quantity: number; lineTotal: number; cancelledAt?: string | Date | null; poId?: string | null };
export type CancelRequest = { poId: string; poNo: string; brand: string; reason: string };

// 주문 목록의 상태 처리 버튼. 현재 상태에서 가능한 다음 단계 + 부분 취소(상품 줄 · 발주서 단위)
export function OrderStatusActions({ orderId, status, items = [], cancelRequests = [], refundedAmount = 0 }: {
  orderId: string; status: string; items?: OrderLine[]; cancelRequests?: CancelRequest[]; refundedAmount?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | { to: string } | { partial: true; poId?: string }>(null);
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState("");
  const next = ORDER_NEXT_STATUS[status] ?? [];
  const open = items.filter((i) => !i.cancelledAt);
  const canPartial = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"].includes(status) && open.length > 1;
  if (next.length === 0 && !canPartial) return <span className="text-xs text-muted-foreground">{refundedAmount > 0 ? `환불 ${formatKRW(refundedAmount)}` : "-"}</span>;

  // 같은 발주서(브랜드)에 묶인 줄은 함께 선택된다
  const togglePick = (id: string) => {
    const po = items.find((i) => i.id === id)?.poId;
    const group = po ? open.filter((i) => i.poId === po).map((i) => i.id) : [id];
    setPicked((cur) => cur.includes(id) ? cur.filter((x) => !group.includes(x)) : Array.from(new Set([...cur, ...group])));
  };

  async function send(body: Record<string, unknown>, key: string) {
    setBusy(key); setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setError(json.error ?? "처리에 실패했습니다."); return false; }
      setDialog(null); setReason(""); setPicked([]);
      router.refresh();
      return true;
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const current = dialog && "to" in dialog ? ACTIONS[dialog.to] : null;
  const partial = dialog && "partial" in dialog;
  const pickedAmount = open.filter((i) => picked.includes(i.id)).reduce((s, i) => s + i.lineTotal, 0);
  const preShip = status === "PAID" || status === "PREPARING";

  return (
    <div className="flex flex-col items-start gap-1.5">
      {cancelRequests.map((c) => (
        <button key={c.poId} type="button" onClick={() => { setDialog({ partial: true, poId: c.poId }); setPicked(open.filter((i) => i.poId === c.poId).map((i) => i.id)); setReason(`브랜드 출고 불가: ${c.reason}`); }}
          className="rounded-lg bg-red-50 px-2 py-1 text-left text-[11px] font-semibold text-red-700 hover:bg-red-100">
          {c.brand} 출고 불가 · {c.reason} → 부분 취소하기
        </button>
      ))}
      <div className="flex flex-wrap gap-1.5">
        {next.map((to) => (
          <Button key={to} size="sm" variant={ACTIONS[to]?.variant} disabled={busy !== null} className="h-9 px-3 text-xs" onClick={() => { setDialog({ to }); setError(""); }}>
            {busy === to ? "처리중..." : ACTIONS[to]?.label ?? to}
          </Button>
        ))}
        {canPartial && <Button size="sm" variant="outline" disabled={busy !== null} className="h-9 px-3 text-xs" onClick={() => { setDialog({ partial: true }); setError(""); }}>부분 {preShip ? "취소" : "환불"}</Button>}
      </div>
      {refundedAmount > 0 && <span className="text-[11px] text-slate-500">부분 환불 {formatKRW(refundedAmount)}</span>}

      <Dialog open={!!current} onClose={() => setDialog(null)} title={current ? `${current.label}` : ""}
        footer={<>
          <Button variant="outline" onClick={() => setDialog(null)}>닫기</Button>
          <Button disabled={busy !== null || (!!current?.ask && !reason.trim())} onClick={() => dialog && "to" in dialog && send({ status: dialog.to, reason: current?.ask ? reason : undefined }, dialog.to)}>
            {busy ? "처리 중…" : "확인"}
          </Button>
        </>}>
        <p className="text-sm text-slate-700">{current?.ask ?? current?.confirm}</p>
        {current?.ask && <label className="mt-3 block text-sm font-semibold text-navy" htmlFor={`reason-${orderId}`}>사유 (필수)</label>}
        {current?.ask && <textarea id={`reason-${orderId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} className="mt-1 w-full rounded-lg border border-border p-2 text-sm" />}
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </Dialog>

      <Dialog open={!!partial} onClose={() => setDialog(null)} title={`부분 ${preShip ? "취소" : "환불"}`}
        footer={<>
          <Button variant="outline" onClick={() => setDialog(null)}>닫기</Button>
          <Button disabled={busy !== null || !picked.length || !reason.trim()} onClick={() => send({ action: "cancel-items", itemIds: picked, reason }, "partial")}>
            {busy ? "처리 중…" : `${formatKRW(pickedAmount)} ${preShip ? "취소" : "환불"}`}
          </Button>
        </>}>
        <p className="text-sm text-slate-600">{preShip ? "고른 상품만 결제 취소하고 재고를 되돌립니다." : "고른 상품만 환불합니다. (반품 상품은 브랜드·창고가 수령 확인)"} 같은 브랜드 발주서에 묶인 상품은 함께 처리됩니다.</p>
        <ul className="mt-3 divide-y rounded-xl border">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <input type="checkbox" className="h-5 w-5" disabled={!!i.cancelledAt} checked={!i.cancelledAt && picked.includes(i.id)} onChange={() => togglePick(i.id)} aria-label={`${i.productName} 선택`} />
              <span className={`min-w-0 flex-1 truncate ${i.cancelledAt ? "text-slate-400 line-through" : "text-navy"}`}>{i.productName}{i.optionLabel ? ` (${i.optionLabel})` : ""} × {i.quantity}{i.poId ? <span className="ml-1 text-[11px] text-slate-500">브랜드</span> : null}</span>
              <span className="shrink-0 font-semibold">{formatKRW(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <label className="mt-3 block text-sm font-semibold text-navy" htmlFor={`preason-${orderId}`}>사유 (필수)</label>
        <textarea id={`preason-${orderId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} className="mt-1 w-full rounded-lg border border-border p-2 text-sm" />
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </Dialog>
    </div>
  );
}
