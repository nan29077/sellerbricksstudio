"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 승인제 브랜드에 판매처 신청
export function PartnerApply({ shopId, status }: { shopId: string; status: "NONE" | "PENDING" }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (status === "PENDING") return <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">판매처 신청을 보냈습니다. 브랜드가 승인하면 상품을 판매 목록에 담을 수 있습니다.</p>;
  async function apply() {
    setBusy(true); setMsg(null);
    const json = await fetch("/api/brand-imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "apply", shopId, note }) })
      .then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (!json.ok) { setMsg({ ok: false, text: json.error ?? "신청하지 못했습니다." }); return; }
    setMsg({ ok: true, text: "판매처 신청을 보냈습니다." });
    router.refresh();
  }
  return (
    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/60 p-3 text-sm">
      <p className="font-bold text-navy">이 브랜드는 승인한 판매처만 상품을 가져갈 수 있습니다.</p>
      {!open ? <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex h-10 items-center rounded-lg bg-navy px-4 text-sm font-bold text-white">판매처 신청하기</button> : (
        <div className="mt-2 space-y-2">
          <label className="block text-xs font-semibold text-slate-700" htmlFor="partner-note">브랜드에 전할 말 (선택 · 채널, 주력 카테고리, 월 방송 횟수 등)</label>
          <textarea id="partner-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} className="w-full rounded-lg border border-border p-2 text-sm" />
          <button type="button" disabled={busy} onClick={apply} className="inline-flex h-10 items-center rounded-lg bg-navy px-4 text-sm font-bold text-white disabled:opacity-60">{busy ? "보내는 중…" : "신청 보내기"}</button>
        </div>
      )}
      {msg && <p role="status" className={`mt-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
