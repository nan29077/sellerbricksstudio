"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { CLAIM_LABEL, CLAIM_REASONS, CLAIM_STATUS_LABEL, type ClaimType } from "@/lib/order-claims";

type Claim = { id: string; type: ClaimType; status: keyof typeof CLAIM_STATUS_LABEL; reason: string; detail: string | null; answer: string | null; createdAt: string };

// 주문 화면의 '취소 · 반품 · 교환 요청' — 비회원 구매자가 주문할 때 쓴 연락처로 확인 후 요청한다.
export function OrderClaimBox({ orderId, claims, types, blockedReason }: { orderId: string; claims: Claim[]; types: ClaimType[]; blockedReason: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ClaimType>(types[0] ?? "CANCEL");
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(method: "POST" | "DELETE", body: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/orders/${orderId}/claims`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, ...body }) });
    const json = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    if (!json.ok) { setMsg({ ok: false, text: json.error ?? "처리하지 못했습니다." }); return false; }
    setMsg({ ok: true, text: method === "POST" ? "요청을 접수했습니다. 판매자가 확인 후 알림톡으로 알려 드려요." : "요청을 거뒀습니다." });
    setOpen(false); setReason(""); setDetail("");
    router.refresh();
    return true;
  }

  const pending = claims.find((c) => c.status === "REQUESTED");
  return (
    <div className="space-y-3">
      {claims.map((c) => {
        const st = CLAIM_STATUS_LABEL[c.status];
        return (
          <div key={c.id} className="rounded-xl border border-border bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-navy">{CLAIM_LABEL[c.type]} 요청</span>
              <Badge tone={st.tone}>{st.label}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-600">{c.reason}{c.detail ? ` · ${c.detail}` : ""} · {formatDateTime(c.createdAt)}</p>
            {c.answer && <p className="mt-2 rounded-lg bg-white p-2 text-xs text-slate-700"><b className="text-navy">판매자 답변</b> {c.answer}</p>}
          </div>
        );
      })}

      {(open || pending) && (
        <div>
          <Label htmlFor="claim-phone">주문할 때 입력한 연락처</Label>
          <Input id="claim-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      )}

      {pending && (
        <Button variant="outline" className="w-full" disabled={busy || phone.replace(/\D/g, "").length < 8} onClick={() => send("DELETE", { claimId: pending.id })}>
          {busy ? "처리 중..." : "요청 거두기"}
        </Button>
      )}

      {!pending && types.length > 0 && (open ? (
        <div className="space-y-3">
          {types.length > 1 && (
            <div className="grid grid-cols-2 gap-2">
              {types.map((t) => (
                <button key={t} type="button" onClick={() => { setType(t); setReason(""); }}
                  className={`min-h-[44px] rounded-xl border-2 text-sm font-semibold ${type === t ? "border-brand-500 bg-brand-50 text-navy" : "border-border text-slate-600"}`}>
                  {CLAIM_LABEL[t]}
                </button>
              ))}
            </div>
          )}
          <div>
            <Label htmlFor="claim-reason">{CLAIM_LABEL[type]} 사유</Label>
            <Select id="claim-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">사유를 선택하세요</option>
              {CLAIM_REASONS[type].map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="claim-detail">자세한 내용 {reason === "기타" ? "(필수)" : "(선택)"}</Label>
            <Textarea id="claim-detail" rows={3} maxLength={500} value={detail} onChange={(e) => setDetail(e.target.value)}
              placeholder={type === "EXCHANGE" ? "바꾸고 싶은 사이즈 · 색상을 적어 주세요" : "판매자에게 전할 내용을 적어 주세요"} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={busy}>닫기</Button>
            <Button className="flex-1" disabled={busy || !reason || phone.replace(/\D/g, "").length < 8}
              onClick={() => send("POST", { type, reason, detail })}>{busy ? "보내는 중..." : `${CLAIM_LABEL[type]} 요청`}</Button>
          </div>
          <p className="text-[11px] text-slate-500">요청은 판매자에게 바로 전달됩니다. 단순 변심 반품 · 교환은 왕복 배송비가 들 수 있어요.</p>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
          {types.includes("CANCEL") ? "주문 취소 요청" : "반품 · 교환 요청"}
        </Button>
      ))}

      {!pending && types.length === 0 && blockedReason && claims.length === 0 && <p className="text-xs text-slate-500">{blockedReason}</p>}
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
