"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

// 고객 추가 문의 (회원: 본인 문의 / 비회원: 확인 링크 token)
export function SupportFollowUp({ id, token, closed }: { id: string; token?: string; closed?: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/support/inquiries/${id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, token }) });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.error ?? "보내지 못했습니다.");
      setBody(""); setMsg({ ok: true, text: "추가 문의를 보냈어요. 운영팀이 이어서 답변해 드려요." });
      router.refresh();
    } catch (e2) { setMsg({ ok: false, text: e2 instanceof Error ? e2.message : "보내지 못했습니다." }); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={send} className="space-y-2">
      <label htmlFor="support-follow" className="text-sm font-bold text-navy">{closed ? "다시 문의하기" : "추가로 묻기"}</label>
      <Textarea id="support-follow" value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} className="min-h-24" placeholder="더 궁금한 점이나 추가 정보를 적어 주세요" />
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-700"}>{msg.text}</p>}
      <Button disabled={busy || body.trim().length < 2} className="gap-2"><Send className="h-4 w-4" />{busy ? "보내는 중…" : "보내기"}</Button>
    </form>
  );
}
