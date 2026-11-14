"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { appConfirm } from "@/components/ui/app-dialog";
import { api } from "@/lib/client-api";
import { HOME_VIDEO_CATEGORIES, VIDEO_KIND_LABEL, videoSourceOf, type HomeVideoCategory } from "@/lib/home-video-source";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Pencil, Plus, Save, Trash2, X } from "lucide-react";

export type HomeVideoRow = {
  id: string; category: string; title: string; caption: string; url: string; thumbnailUrl: string | null; duration: string;
  isVisible: boolean; sortOrder: number; startsAt: string | null; endsAt: string | null; shown: boolean;
};

const toLocal = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(iso)) : "");

type Form = { category: HomeVideoCategory; title: string; caption: string; url: string; thumbnailUrl: string; duration: string; isVisible: boolean; sortOrder: string; startsAt: string; endsAt: string };
const empty = (category: HomeVideoCategory): Form => ({ category, title: "", caption: "", url: "", thumbnailUrl: "", duration: "", isVisible: true, sortOrder: "0", startsAt: "", endsAt: "" });
const CATS = Object.keys(HOME_VIDEO_CATEGORIES) as HomeVideoCategory[];

export function HomeVideoManager({ initial }: { initial: HomeVideoRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null); // "new" | id
  const [form, setForm] = useState<Form>(empty("LIVE_COMMERCE"));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = async () => { setRows(await api<HomeVideoRow[]>("/api/admin/home-videos")); router.refresh(); };
  const run = async (fn: () => Promise<unknown>, okText: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); await reload(); setMsg({ ok: true, text: okText }); return true; }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "처리하지 못했습니다." }); return false; }
    finally { setBusy(false); }
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const openNew = (category: HomeVideoCategory) => { setEditing("new"); setForm(empty(category)); setMsg(null); };
  const openEdit = (r: HomeVideoRow) => {
    setEditing(r.id); setMsg(null);
    setForm({ category: r.category as HomeVideoCategory, title: r.title, caption: r.caption, url: r.url, thumbnailUrl: r.thumbnailUrl ?? "", duration: r.duration, isVisible: r.isVisible, sortOrder: String(r.sortOrder), startsAt: toLocal(r.startsAt), endsAt: toLocal(r.endsAt) });
  };
  const save = async () => {
    const body = { ...form, thumbnailUrl: form.thumbnailUrl || null, sortOrder: Number(form.sortOrder) || 0, startsAt: fromLocal(form.startsAt), endsAt: fromLocal(form.endsAt) };
    const done = await run(() => (editing === "new" ? api("/api/admin/home-videos", "POST", body) : api("/api/admin/home-videos", "PATCH", { id: editing, ...body })), editing === "new" ? "영상을 넣었습니다." : "영상을 저장했습니다.");
    if (done) setEditing(null);
  };
  const patch = (id: string, data: Record<string, unknown>, text: string) => run(() => api("/api/admin/home-videos", "PATCH", { id, ...data }), text);
  const remove = async (r: HomeVideoRow) => {
    if (!(await appConfirm(`'${r.title}' 영상을 지울까요?`, { confirmLabel: "삭제", danger: true }))) return;
    await run(() => api(`/api/admin/home-videos?id=${encodeURIComponent(r.id)}`, "DELETE"), "영상을 지웠습니다.");
  };
  // 순서 바꾸기: 위아래 영상과 순서 값을 맞바꾼다 (값이 같으면 위치대로 다시 매긴다)
  const move = async (list: HomeVideoRow[], i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= list.length) return;
    const order = list.map((r, k) => ({ id: r.id, sortOrder: k * 10 }));
    [order[i].sortOrder, order[j].sortOrder] = [order[j].sortOrder, order[i].sortOrder];
    await run(async () => { for (const o of order) if (list.find((r) => r.id === o.id)?.sortOrder !== o.sortOrder) await api("/api/admin/home-videos", "PATCH", o); }, "순서를 바꿨습니다.");
  };
  const kind = videoSourceOf(form.url)?.kind;

  const editor = (
    <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
      <p className="font-bold text-navy">{editing === "new" ? "새 영상" : "영상 수정"}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Label className="block sm:col-span-2">작은 글씨 (셀러 · 브랜드 · 행사명, 선택)<Input value={form.caption} onChange={(e) => set("caption", e.target.value)} maxLength={60} placeholder="예) 뷰티 스튜디오 · 온유 브랜드" /></Label>
        <Label className="block sm:col-span-2">영상 제목<Input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder="예) 겨울 니트 특가 라이브 다시보기" /></Label>
        <Label className="block sm:col-span-2">영상 링크<Input value={form.url} onChange={(e) => set("url", e.target.value)} inputMode="url" placeholder="https://youtu.be/… · https://youtube.com/shorts/… · https://vimeo.com/… · https://…/video.mp4" />
          {form.url && <span className={`mt-1 block text-[11px] ${kind ? (kind === "link" ? "text-amber-700" : "text-emerald-700") : "text-red-600"}`}>{kind ? VIDEO_KIND_LABEL[kind] : "영상 주소 형식이 아닙니다."}</span>}
        </Label>
        <Label className="block sm:col-span-2">썸네일 이미지 주소 (선택 · 유튜브는 자동)<Input value={form.thumbnailUrl} onChange={(e) => set("thumbnailUrl", e.target.value)} placeholder="https://… 또는 /images/…" /></Label>
        <Label className="block">영상 길이 (선택)<Input value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="0:30" maxLength={10} /></Label>
        <Label className="block">순서 (작을수록 앞)<Input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} min={-999} max={999} /></Label>
        <Label className="block">노출 시작 (선택)<Input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Label>
        <Label className="block">노출 종료 (선택)<Input type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></Label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.isVisible} onChange={(e) => set("isVisible", e.target.checked)} />메인에 보이기</label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={busy}><Save className="h-4 w-4" />{busy ? "저장 중…" : "저장"}</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={busy}><X className="h-4 w-4" />취소</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        메인 &lsquo;라이브 커머스&rsquo; 플레이어에 들어갈 영상입니다. 지난 라이브 커머스 · 숏폼 · 홍보 · 캠페인 · 행사 영상 링크를 넣으면 메인에서 좌우로 넘기며 볼 수 있습니다.
        유튜브(일반 · 쇼츠) · 비메오 · mp4 같은 영상 파일은 메인에서 바로 재생되고, 인스타그램 · 틱톡 등 끼워 넣을 수 없는 주소는 &lsquo;원본에서 보기&rsquo;로 열립니다.
      </p>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-700"}>{msg.text}</p>}
      {CATS.map((cat) => {
        const list = rows; // 탭이 하나라 모든 영상을 이 목록에 보여 준다
        const showing = list.filter((r) => r.shown).length;
        return (
          <Card key={cat}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">{HOME_VIDEO_CATEGORIES[cat].label} 영상 ({showing}/{list.length})</CardTitle>
                <p className="text-xs text-slate-500">메인에 보이는 영상 {showing}개 · 화살표로 순서를 바꿔요</p>
              </div>
              <Button size="sm" onClick={() => openNew(cat)} disabled={busy}><Plus className="h-4 w-4" />영상 넣기</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {editing && editor}
              {list.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">아직 넣은 영상이 없습니다. 영상이 없으면 메인에는 샘플 영상이 보입니다.</p> : (
                <ul className="space-y-2">
                  {list.map((r, i) => (
                    <li key={r.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={r.shown ? "green" : "gray"}>{r.shown ? "메인 노출" : !r.isVisible ? "숨김" : "노출 기간 아님"}</Badge>
                          <span className="truncate font-bold text-navy">{r.title}</span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {[r.caption, r.duration, VIDEO_KIND_LABEL[videoSourceOf(r.url)?.kind ?? "link"].split(" — ")[0], r.startsAt && `시작 ${when(r.startsAt)}`, r.endsAt && `종료 ${when(r.endsAt)}`].filter(Boolean).join(" · ")}
                        </p>
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs font-semibold text-brand-800 underline"><ExternalLink className="h-3 w-3 shrink-0" /><span className="truncate">{r.url}</span></a>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <Button size="sm" variant="ghost" disabled={busy || i === 0} onClick={() => move(list, i, -1)} aria-label="앞으로"><ArrowUp className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" disabled={busy || i === list.length - 1} onClick={() => move(list, i, 1)} aria-label="뒤로"><ArrowDown className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => patch(r.id, { isVisible: !r.isVisible }, r.isVisible ? "메인에서 숨겼습니다." : "메인에 다시 보입니다.")} aria-label={r.isVisible ? "숨기기" : "보이기"}>{r.isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => openEdit(r)} aria-label="수정"><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(r)} className="text-red-600" aria-label="삭제"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
