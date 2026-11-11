"use client";
import { appAlert, appConfirm } from "@/components/ui/app-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareReply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { api } from "@/lib/client-api";

const TEMPLATES = [
  "소중한 리뷰 감사합니다! 다음 방송도 최고의 환경으로 준비하겠습니다.",
  "이용해 주셔서 감사합니다. 말씀해 주신 부분은 바로 개선하겠습니다.",
];

export function ReviewReply({ id, initial }: { id: string; initial: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(!initial ? false : false);
  const [text, setText] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  async function save(v: string) {
    setBusy(true);
    try { await api(`/api/reviews/${id}`, "PATCH", { reply: v }); setOpen(false); router.refresh(); }
    catch (e) { void appAlert((e as Error).message); } finally { setBusy(false); }
  }
  if (!open) return (
    <Button size="sm" variant={initial ? "ghost" : "outline"} onClick={() => setOpen(true)}><MessageSquareReply className="h-4 w-4" />{initial ? "답글 수정" : "답글 달기"}</Button>
  );
  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap gap-1">{TEMPLATES.map((t) => <button key={t} type="button" onClick={() => setText(t)} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-slate-600 hover:border-brand-300">{t.slice(0, 18)}…</button>)}</div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} placeholder="셀러에게 보여지는 공개 답글입니다." />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !text.trim()} onClick={() => save(text)}>{busy ? "저장중..." : "답글 저장"}</Button>
        {initial && <Button size="sm" variant="ghost" className="text-red-600" disabled={busy} onClick={async () => (await appConfirm("답글을 삭제할까요?")) && save("")}>답글 삭제</Button>}
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>취소</Button>
      </div>
    </div>
  );
}
