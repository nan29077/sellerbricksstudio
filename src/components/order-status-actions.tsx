"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ORDER_NEXT_STATUS } from "@/lib/status";

const ACTIONS: Record<string, { label: string; variant?: "outline"; ask?: string; confirm?: string }> = {
  PREPARING: { label: "준비 시작", confirm: "상품 준비를 시작할까요?" },
  SHIPPED: { label: "발송", confirm: "발송 처리할까요? 구매자에게 배송중으로 표시됩니다." },
  DELIVERED: { label: "배송 완료", confirm: "배송 완료로 처리할까요?" },
  CANCELLED: { label: "취소", variant: "outline", ask: "취소 사유를 입력하세요. 결제가 취소되고 재고가 복구됩니다." },
  REFUNDED: { label: "환불", variant: "outline", ask: "환불 사유를 입력하세요. 결제 금액 전체가 환불됩니다." },
};

// 주문 목록의 상태 처리 버튼. 현재 상태에서 가능한 다음 단계만 보여준다.
export function OrderStatusActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const next = ORDER_NEXT_STATUS[status] ?? [];
  if (next.length === 0) return <span className="text-xs text-muted-foreground">-</span>;

  async function run(to: string) {
    const a = ACTIONS[to];
    let reason: string | undefined;
    if (a.ask) {
      const v = window.prompt(a.ask);
      if (v === null) return;
      if (!v.trim()) { alert("사유를 입력해야 처리할 수 있습니다."); return; }
      reason = v;
    } else if (a.confirm && !window.confirm(a.confirm)) return;

    setBusy(to);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { alert(json.error ?? "처리에 실패했습니다."); return; }
      router.refresh();
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-1.5">
      {next.map((to) => (
        <Button
          key={to} size="sm" variant={ACTIONS[to]?.variant} disabled={busy !== null}
          className="h-8 px-2.5 text-xs" onClick={() => run(to)}
        >
          {busy === to ? "처리중..." : ACTIONS[to]?.label ?? to}
        </Button>
      ))}
    </div>
  );
}
