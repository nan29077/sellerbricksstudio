"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportCategory } from "@prisma/client";
import { Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { appConfirm } from "@/components/ui/app-dialog";
import { SUPPORT_PRIORITY, SUPPORT_STATUS, type SupportStatus } from "@/lib/support";

type Template = { id: string; title: string; body: string; category: SupportCategory | null };

// 최고관리자 문의 처리 칸: 답변(템플릿) · 상태 · 우선순위 · 담당자 · 내부 메모
export function SupportAdminPanel({ id, status, priority, assigneeId, adminMemo, category, admins, templates, guest }: {
  id: string; status: SupportStatus; priority: string; assigneeId: string | null; adminMemo: string; category: SupportCategory;
  admins: { id: string; name: string }[]; templates: Template[]; guest: boolean;
}) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [after, setAfter] = useState<"ANSWERED" | "CLOSED" | "IN_PROGRESS">("ANSWERED");
  const [memo, setMemo] = useState(adminMemo);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplTitle, setTplTitle] = useState("");
  const list = [...templates].sort((a, b) => Number(b.category === category) - Number(a.category === category));

  const run = async (body: Record<string, unknown>, text: string) => {
    setBusy(true); setMsg(null);
    try { await api(`/api/admin/support/${id}`, "PATCH", body); setMsg({ ok: true, text }); router.refresh(); return true; }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "처리하지 못했습니다." }); return false; }
    finally { setBusy(false); }
  };
  const send = async () => {
    if (reply.trim().length < 2) return setMsg({ ok: false, text: "답변을 입력해 주세요." });
    if (await run({ reply, status: after }, guest ? "답변을 등록하고 이메일로 보냈습니다." : "답변을 등록하고 고객에게 알렸습니다.")) setReply("");
  };
  const saveTemplate = async () => {
    if (!tplTitle.trim() || reply.trim().length < 2) return setMsg({ ok: false, text: "템플릿 이름과 답변 내용을 입력하세요." });
    setBusy(true);
    try { await api("/api/admin/support/templates", "POST", { title: tplTitle, body: reply, category }); setTplTitle(""); setTplOpen(false); setMsg({ ok: true, text: "템플릿으로 저장했습니다." }); router.refresh(); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "저장하지 못했습니다." }); }
    finally { setBusy(false); }
  };
  const removeTemplate = async (t: Template) => {
    if (!(await appConfirm(`'${t.title}' 템플릿을 지울까요?`, { confirmLabel: "삭제", danger: true }))) return;
    try { await api(`/api/admin/support/templates?id=${t.id}`, "DELETE"); router.refresh(); } catch { /* 무시 */ }
  };

  return (
    <div className="mt-4 grid gap-4 border-t pt-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={`reply-${id}`} className="mb-0">운영팀 답변 {guest && <span className="text-xs font-normal text-slate-500">· 비회원은 이메일로 보내요</span>}</Label>
          {list.length > 0 && (
            <Select aria-label="답변 템플릿" className="h-9 w-auto max-w-[14rem] text-xs" value="" onChange={(e) => { const t = list.find((x) => x.id === e.target.value); if (t) setReply((r) => (r ? `${r}\n\n${t.body}` : t.body)); }}>
              <option value="">템플릿 넣기</option>
              {list.map((t) => <option key={t.id} value={t.id}>{t.category === category ? "★ " : ""}{t.title}</option>)}
            </Select>
          )}
        </div>
        <Textarea id={`reply-${id}`} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={3000} className="min-h-28" placeholder="고객에게 보낼 답변을 적어 주세요" />
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="답변 후 상태" value={after} onChange={(e) => setAfter(e.target.value as typeof after)} className="h-10 w-auto text-sm">
            <option value="ANSWERED">답변 후 '답변 완료'</option>
            <option value="IN_PROGRESS">답변 후 '처리 중' 유지</option>
            <option value="CLOSED">답변 후 '종료'</option>
          </Select>
          <Button size="sm" onClick={send} disabled={busy}><Send className="h-4 w-4" />{busy ? "처리 중…" : "답변 보내기"}</Button>
          <button type="button" className="text-xs font-semibold text-slate-600 underline" onClick={() => setTplOpen((v) => !v)}>템플릿으로 저장</button>
          <span className="text-[11px] tabular-nums text-slate-500">{reply.length.toLocaleString()} / 3,000</span>
        </div>
        {tplOpen && (
          <div className="flex flex-wrap gap-2 rounded-xl bg-slate-50 p-2">
            <Input value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} maxLength={60} placeholder="템플릿 이름 (예: 예약 취소 안내)" className="h-9 flex-1 text-sm" />
            <Button size="sm" variant="outline" onClick={saveTemplate} disabled={busy}><Save className="h-4 w-4" />저장</Button>
          </div>
        )}
        {templates.length > 0 && tplOpen && (
          <ul className="flex flex-wrap gap-1.5 text-[11px]">
            {templates.map((t) => <li key={t.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">{t.title}<button type="button" onClick={() => removeTemplate(t)} aria-label={`${t.title} 템플릿 삭제`}><Trash2 className="h-3 w-3 text-red-600" /></button></li>)}
          </ul>
        )}
        {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-700"}>{msg.text}</p>}
      </div>
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <Label className="block">상태
          <Select value={status} disabled={busy} onChange={(e) => run({ status: e.target.value }, "상태를 바꿨습니다.")} className="h-10 text-sm">
            {Object.entries(SUPPORT_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </Select>
        </Label>
        <Label className="block">우선순위
          <Select value={priority} disabled={busy} onChange={(e) => run({ priority: e.target.value }, "우선순위를 바꿨습니다.")} className="h-10 text-sm">
            {Object.entries(SUPPORT_PRIORITY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Label>
        <Label className="block">담당자
          <Select value={assigneeId ?? ""} disabled={busy} onChange={(e) => run({ assigneeId: e.target.value || null }, e.target.value ? "담당자를 지정했습니다." : "담당자를 해제했습니다.")} className="h-10 text-sm">
            <option value="">담당자 없음</option>
            {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Label>
        <Label className="block">내부 메모 <span className="text-xs font-normal text-slate-500">(고객에게 안 보여요)</span>
          <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={3000} className="min-h-20 text-sm" />
        </Label>
        <Button size="sm" variant="outline" disabled={busy || memo === adminMemo} onClick={() => run({ adminMemo: memo }, "메모를 저장했습니다.")}><Save className="h-4 w-4" />메모 저장</Button>
      </div>
    </div>
  );
}
