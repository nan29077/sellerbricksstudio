"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { supportReplySchema } from "@/lib/support";

export function SupportReplyForm({ id }: { id: string }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || sent) return;
    setError("");
    const result = supportReplySchema.safeParse({ reply });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      await api(`/api/admin/support/${id}`, "PATCH", result.data);
      setSent(true);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "답변 등록에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 border-t pt-4">
      <Label htmlFor={`reply-${id}`}>운영팀 답변</Label>
      <Textarea id={`reply-${id}`} value={reply} onChange={(event) => setReply(event.target.value)} minLength={10} maxLength={3000} required disabled={busy || sent} placeholder="확인 결과와 다음 단계를 안내해 주세요." />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-slate-600">등록한 답변은 문의 작성자에게 공개되며 앱 알림이 전송됩니다.</p>
        <Button disabled={busy || sent}><Send className="h-4 w-4" />{sent ? "등록 완료" : busy ? "등록 중…" : "답변 등록"}</Button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </form>
  );
}
