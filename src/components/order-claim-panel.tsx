"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { CLAIM_LABEL, CLAIM_STATUS_LABEL, type ClaimType } from "@/lib/order-claims";
import { MessageSquareWarning } from "lucide-react";

type Claim = { id: string; type: ClaimType; status: keyof typeof CLAIM_STATUS_LABEL; reason: string; detail: string | null; answer: string | null; createdAt: string | Date };

// 주문 카드 안의 '구매자 요청' — 셀러 · 창고(스튜디오) · 최고관리자가 답변한다.
// 취소 · 환불 자체는 아래 주문 처리 버튼(취소 · 부분 취소 · 환불)으로 먼저 한 뒤 '처리 완료'를 누른다.
export function OrderClaimPanel({ claims }: { claims: Claim[] }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!claims.length) return null;
  const open = claims.find((c) => c.status === "REQUESTED");
  const last = open ?? claims[0];
  const st = CLAIM_STATUS_LABEL[last.status];

  async function reply(status: "RESOLVED" | "REJECTED") {
    if (!open) return;
    setBusy(true); setMsg("");
    const res = await fetch(`/api/order-claims/${open.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, answer }) });
    const json = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    if (!json.ok) { setMsg(json.error ?? "처리하지 못했습니다."); return; }
    setAnswer("");
    router.refresh();
  }

  return (
    <div className={`mt-3 rounded-xl border p-3 text-xs ${open ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-bold text-navy"><MessageSquareWarning className="h-4 w-4 text-amber-600" />구매자 {CLAIM_LABEL[last.type]} 요청</span>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <p className="mt-1 text-slate-700">{last.reason}{last.detail ? ` · ${last.detail}` : ""}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{formatDateTime(last.createdAt)}</p>
      {last.answer && <p className="mt-1.5 text-slate-600"><b>답변</b> {last.answer}</p>}
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-amber-800">{open.type === "CANCEL" ? "취소할 수 있으면 아래 '주문 취소'로 먼저 처리한 뒤 '처리 완료'를 눌러 주세요." : "상품을 회수 · 확인한 뒤 아래 '환불' 또는 부분 환불로 처리하고 '처리 완료'를 눌러 주세요. 교환은 재발송 후 처리 완료를 누릅니다."}</p>
          <Textarea aria-label="구매자에게 보낼 답변" rows={2} maxLength={500} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="구매자에게 보낼 답변 (처리 불가일 때 필수)" className="bg-white text-sm" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" disabled={busy || !answer.trim()} onClick={() => reply("REJECTED")}>처리 불가</Button>
            <Button size="sm" className="flex-1" disabled={busy} onClick={() => reply("RESOLVED")}>{busy ? "처리 중..." : "처리 완료"}</Button>
          </div>
          {msg && <p role="status" className="text-red-600">{msg}</p>}
        </div>
      )}
    </div>
  );
}
