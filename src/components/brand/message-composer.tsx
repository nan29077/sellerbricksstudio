"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function MessageComposer({ threadId, shopId, partnerId }: { threadId?: string; shopId?: string; partnerId?: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true); setError("");
    const json = await fetch("/api/brand-messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, threadId, shopId, partnerId }) })
      .then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (!json.ok) { setError(json.error ?? "보내지 못했습니다."); return; }
    setBody("");
    if (!threadId && json.data?.threadId) router.push(`?t=${json.data.threadId}`);
    router.refresh();
  }
  return (
    <form onSubmit={send} className="border-t p-3">
      <label htmlFor="msg-body" className="sr-only">메시지</label>
      <textarea id="msg-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={2} placeholder="메시지를 입력하세요"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }}
        className="w-full resize-none rounded-xl border border-border p-2.5 text-sm" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{error ? <span role="alert" className="text-red-600">{error}</span> : "Ctrl+Enter 로 보내기"}</span>
        <Button size="sm" disabled={busy || !body.trim()}>{busy ? "보내는 중…" : "보내기"}</Button>
      </div>
    </form>
  );
}
