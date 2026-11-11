"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 판매처 승인 · 차단 · 해제 버튼 (브랜드 판매처 관리)
export function PartnerActions({ userId, status, name }: { userId: string; status: "PENDING" | "APPROVED" | "BLOCKED" | "NONE"; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmBlock, setConfirmBlock] = useState(false);

  async function act(next: "APPROVED" | "BLOCKED" | "REMOVE") {
    setBusy(true); setError("");
    const json = await fetch("/api/brand-partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, status: next }) })
      .then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false); setConfirmBlock(false);
    if (!json.ok) { setError(json.error ?? "처리하지 못했습니다."); return; }
    router.refresh();
  }

  const btn = "inline-flex h-9 items-center rounded-lg px-3 text-xs font-bold disabled:opacity-60";
  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5">
      {status !== "APPROVED" && status !== "BLOCKED" && <button type="button" disabled={busy} onClick={() => act("APPROVED")} className={`${btn} bg-navy text-white`} aria-label={`${name} 판매처 승인`}>승인</button>}
      {status === "BLOCKED" && <button type="button" disabled={busy} onClick={() => act("REMOVE")} className={`${btn} border border-slate-300 bg-white text-navy`} aria-label={`${name} 차단 해제`}>차단 해제</button>}
      {status !== "BLOCKED" && !confirmBlock && <button type="button" disabled={busy} onClick={() => setConfirmBlock(true)} className={`${btn} border border-rose-200 bg-rose-50 text-rose-700`} aria-label={`${name} 거래 차단`}>차단</button>}
      {confirmBlock && (
        <span className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-800">
          판매 중인 상품이 모두 내려갑니다.
          <button type="button" disabled={busy} onClick={() => act("BLOCKED")} className={`${btn} h-8 bg-rose-600 text-white`}>차단하기</button>
          <button type="button" onClick={() => setConfirmBlock(false)} className={`${btn} h-8 bg-white text-navy`}>취소</button>
        </span>
      )}
      {error && <span role="alert" className="basis-full text-right text-xs text-red-600">{error}</span>}
    </span>
  );
}
