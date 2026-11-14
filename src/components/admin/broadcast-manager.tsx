"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { appConfirm } from "@/components/ui/app-dialog";
import { api } from "@/lib/client-api";
import { LIVE_PLATFORMS, LIVE_PLATFORM_GROUPS, livePlatformLabel } from "@/lib/live-platforms";
import { ExternalLink, Eye, EyeOff, Pencil, Plus, Radio, RefreshCw, Save, Trash2, X } from "lucide-react";

export type BroadcastRow = {
  id: string; source: string; externalId: string | null; title: string; sellerName: string; platform: string; url: string;
  embedUrl: string | null; thumbnailUrl: string | null; status: string; startsAt: string | null; endsAt: string | null;
  isVisible: boolean; sortOrder: number; lastSyncedAt: string | null; onAir: boolean;
};
export type SellerbricksInfo = { webhookPath: string; secretSet: boolean; feedSet: boolean; staleMinutes: number; lastReceivedAt: string | null; feed: { at: string; ok: boolean; message: string } | null };

const STATUS_LABEL: Record<string, string> = { SCHEDULED: "예정", LIVE: "방송 중", ENDED: "종료" };
const toLocal = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(iso)) : "");
const isYoutube = (url: string) => /(^|\.)youtube\.com|youtu\.be/.test((() => { try { return new URL(url).hostname; } catch { return ""; } })());

type Form = { title: string; sellerName: string; platform: string; url: string; embedUrl: string; thumbnailUrl: string; status: string; startsAt: string; endsAt: string; isVisible: boolean; sortOrder: string };
const EMPTY: Form = { title: "", sellerName: "", platform: "YOUTUBE", url: "", embedUrl: "", thumbnailUrl: "", status: "LIVE", startsAt: "", endsAt: "", isVisible: true, sortOrder: "0" };

export function BroadcastManager({ initial, sellerbricks }: { initial: BroadcastRow[]; sellerbricks: SellerbricksInfo }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null); // "new" | id
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [feedInfo, setFeedInfo] = useState(sellerbricks.feed);

  const reload = async () => {
    const d = await api<{ rows: BroadcastRow[]; feed: SellerbricksInfo["feed"] }>("/api/admin/broadcasts");
    setRows(d.rows); setFeedInfo(d.feed); router.refresh();
  };
  const run = async (fn: () => Promise<unknown>, okText: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); await reload(); setMsg({ ok: true, text: okText }); return true; }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "처리하지 못했습니다." }); return false; }
    finally { setBusy(false); }
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const openNew = () => { setEditing("new"); setForm(EMPTY); setMsg(null); };
  const openEdit = (r: BroadcastRow) => {
    setEditing(r.id); setMsg(null);
    setForm({ title: r.title, sellerName: r.sellerName, platform: r.platform, url: r.url, embedUrl: r.embedUrl ?? "", thumbnailUrl: r.thumbnailUrl ?? "", status: r.status, startsAt: toLocal(r.startsAt), endsAt: toLocal(r.endsAt), isVisible: r.isVisible, sortOrder: String(r.sortOrder) });
  };
  const save = async () => {
    const body = { ...form, embedUrl: form.embedUrl || null, thumbnailUrl: form.thumbnailUrl || null, startsAt: fromLocal(form.startsAt), endsAt: fromLocal(form.endsAt), sortOrder: Number(form.sortOrder) || 0 };
    const done = await run(() => (editing === "new" ? api("/api/admin/broadcasts", "POST", body) : api("/api/admin/broadcasts", "PATCH", { id: editing, ...body })), editing === "new" ? "방송을 등록했습니다." : "방송을 저장했습니다.");
    if (done) setEditing(null);
  };
  const patch = (id: string, data: Record<string, unknown>, text: string) => run(() => api("/api/admin/broadcasts", "PATCH", { id, ...data }), text);
  const remove = async (r: BroadcastRow) => {
    if (!(await appConfirm(`'${r.title}' 방송을 지울까요?`, { confirmLabel: "삭제", danger: true }))) return;
    await run(() => api(`/api/admin/broadcasts?id=${encodeURIComponent(r.id)}`, "DELETE"), "방송을 지웠습니다.");
  };
  const sync = () => run(() => api("/api/admin/broadcasts", "POST", { action: "sync-sellerbricks" }), "셀러브릭스 방송을 동기화했습니다.");

  const onAir = rows.filter((r) => r.onAir);
  const manual = rows.filter((r) => r.source !== "SELLERBRICKS");
  const sb = rows.filter((r) => r.source === "SELLERBRICKS");

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        메인 &lsquo;라이브 커머스&rsquo; 플레이어의 <b>온에어</b>에 보일 방송입니다. 스토리지마켓은 직접 송출하지 않고, 외부 방송을 연결해 보여 줍니다.
        유튜브 주소는 메인에서 바로 재생되고, 그 밖의 플랫폼은 &lsquo;○○에서 보기&rsquo; 버튼으로 새 창에서 열립니다. 셀러브릭스 방송은 플레이어 주소를 받으면 메인에서 바로 재생됩니다.
      </p>
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm">
        <Radio className="h-4 w-4 text-red-500" />지금 메인에 보이는 방송 <b className="text-navy">{onAir.length}건</b>
        {onAir.slice(0, 3).map((r) => <Badge key={r.id} tone="red">{r.title}</Badge>)}
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-700"}>{msg.text}</p>}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">직접 입력한 방송 ({manual.length})</CardTitle>
          <Button size="sm" onClick={openNew} disabled={busy}><Plus className="h-4 w-4" />방송 링크 추가</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {editing && (
            <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
              <p className="font-bold text-navy">{editing === "new" ? "새 방송 링크" : "방송 링크 수정"}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Label className="block sm:col-span-2">방송 제목<Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="예) 겨울 니트 특가 라이브" maxLength={120} /></Label>
                <Label className="block">셀러 · 진행자 이름 (선택)<Input value={form.sellerName} onChange={(e) => set("sellerName", e.target.value)} maxLength={60} /></Label>
                <Label className="block">방송 플랫폼
                  <Select value={form.platform} onChange={(e) => set("platform", e.target.value)}>
                    {LIVE_PLATFORM_GROUPS.map((g) => <optgroup key={g} label={g}>{LIVE_PLATFORMS.filter((p) => p.group === g).map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}</optgroup>)}
                  </Select>
                </Label>
                <Label className="block sm:col-span-2">시청 주소 (방송 링크)<Input value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://www.youtube.com/live/… · https://grip.show/…" inputMode="url" />
                  {form.url && <span className="mt-1 block text-[11px] text-slate-500">{isYoutube(form.url) ? "유튜브 주소 — 메인에서 바로 재생됩니다." : "메인에서 '플랫폼에서 보기' 버튼으로 새 창에서 열립니다."}</span>}
                </Label>
                <Label className="block sm:col-span-2">썸네일 이미지 주소 (선택)<Input value={form.thumbnailUrl} onChange={(e) => set("thumbnailUrl", e.target.value)} placeholder="https://… 또는 /images/…" /></Label>
                <Label className="block">상태
                  <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                    <option value="LIVE">방송 중 (바로 메인에 보임)</option>
                    <option value="SCHEDULED">예정 (시작 시각에 자동으로 보임)</option>
                    <option value="ENDED">종료 (메인에서 내림)</option>
                  </Select>
                </Label>
                <Label className="block">메인 표시 순서 (작을수록 앞)<Input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} min={-999} max={999} /></Label>
                <Label className="block">시작 시각 {form.status === "SCHEDULED" ? "(필수)" : "(선택)"}<Input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Label>
                <Label className="block">종료 시각 (선택 · 지나면 자동으로 내림)<Input type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></Label>
                <details className="sm:col-span-2 text-sm">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-500">고급: 끼워 넣기(iframe) 주소</summary>
                  <Input className="mt-2" value={form.embedUrl} onChange={(e) => set("embedUrl", e.target.value)} placeholder="허용된 호스트의 https 플레이어 주소만" />
                  <p className="mt-1 text-[11px] text-slate-500">유튜브는 필요 없습니다. 셀러브릭스 · 운영자가 허용한 호스트(BROADCAST_EMBED_HOSTS)만 받습니다.</p>
                </details>
                <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.isVisible} onChange={(e) => set("isVisible", e.target.checked)} />메인에 보이기</label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={save} disabled={busy}><Save className="h-4 w-4" />{busy ? "저장 중…" : "저장"}</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={busy}><X className="h-4 w-4" />취소</Button>
              </div>
            </div>
          )}
          {manual.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">직접 입력한 방송이 없습니다. &lsquo;방송 링크 추가&rsquo;로 외부 방송 주소를 넣어 보세요.</p> : (
            <ul className="space-y-2">{manual.map((r) => <Row key={r.id} r={r} busy={busy} onEdit={() => openEdit(r)} onPatch={patch} onRemove={() => remove(r)} />)}</ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">셀러브릭스 연동 방송 ({sb.length})</CardTitle>
          {sellerbricks.feedSet && <Button size="sm" variant="outline" onClick={sync} disabled={busy}><RefreshCw className="h-4 w-4" />지금 동기화</Button>}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
            <p>웹훅 받는 주소: <code className="break-all font-semibold text-navy">{sellerbricks.webhookPath}</code></p>
            <p>서명 키(SELLERBRICKS_WEBHOOK_SECRET): <b className={sellerbricks.secretSet ? "text-emerald-700" : "text-amber-700"}>{sellerbricks.secretSet ? "설정됨" : "미설정 (배포 환경에서는 웹훅 거절)"}</b></p>
            <p>피드(SELLERBRICKS_LIVE_FEED_URL): <b className={sellerbricks.feedSet ? "text-emerald-700" : "text-slate-500"}>{sellerbricks.feedSet ? "설정됨 · 1분마다 읽음" : "미설정 (웹훅만 사용)"}</b></p>
            <p>마지막 수신: <b className="text-navy">{sellerbricks.lastReceivedAt ? when(sellerbricks.lastReceivedAt) : "아직 없음"}</b>{feedInfo && <> · 피드 {feedInfo.ok ? "정상" : "오류"} ({feedInfo.message})</>}</p>
            <p className="sm:col-span-2">셀러브릭스에서 {sellerbricks.staleMinutes}분 동안 소식이 없는 방송은 종료로 보고 메인에서 내립니다. 셀러브릭스 방송은 내용이 연동으로 바뀌므로 여기서는 메인 노출 · 순서만 정합니다.</p>
          </div>
          {sb.length === 0 ? <p className="py-4 text-center text-slate-500">아직 셀러브릭스에서 받은 방송이 없습니다.</p> : (
            <ul className="space-y-2">{sb.map((r) => <Row key={r.id} r={r} busy={busy} onPatch={patch} />)}</ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ r, busy, onEdit, onPatch, onRemove }: { r: BroadcastRow; busy: boolean; onEdit?: () => void; onPatch: (id: string, d: Record<string, unknown>, t: string) => void; onRemove?: () => void }) {
  const tone = r.onAir ? "red" : r.status === "SCHEDULED" ? "blue" : "gray";
  return (
    <li className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5">
          <Badge tone={tone}>{r.onAir ? "메인 노출 중" : STATUS_LABEL[r.status] ?? r.status}</Badge>
          {!r.isVisible && <Badge tone="gray">숨김</Badge>}
          <span className="truncate font-bold text-navy">{r.title}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {r.source === "SELLERBRICKS" ? "셀러브릭스" : livePlatformLabel(r.platform)}{r.sellerName ? ` · ${r.sellerName}` : ""}
          {r.startsAt ? ` · 시작 ${when(r.startsAt)}` : ""}{r.endsAt ? ` · 종료 ${when(r.endsAt)}` : ""}
          {r.lastSyncedAt ? ` · 수신 ${when(r.lastSyncedAt)}` : ""}
        </p>
        <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-brand-800 underline"><ExternalLink className="h-3 w-3 shrink-0" /><span className="truncate">{r.url}</span></a>
      </div>
      <div className="flex shrink-0 flex-wrap gap-1">
        {r.source !== "SELLERBRICKS" && r.status !== "LIVE" && <Button size="sm" variant="outline" disabled={busy} onClick={() => onPatch(r.id, { status: "LIVE" }, "방송 중으로 바꿨습니다.")}><Radio className="h-3.5 w-3.5" />방송 중</Button>}
        {r.source !== "SELLERBRICKS" && r.status !== "ENDED" && <Button size="sm" variant="outline" disabled={busy} onClick={() => onPatch(r.id, { status: "ENDED" }, "종료했습니다.")}>종료</Button>}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onPatch(r.id, { isVisible: !r.isVisible }, r.isVisible ? "메인에서 숨겼습니다." : "메인에 다시 보입니다.")} aria-label={r.isVisible ? "메인에서 숨김" : "메인에 보이기"}>{r.isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
        {onEdit && <Button size="sm" variant="ghost" disabled={busy} onClick={onEdit} aria-label="수정"><Pencil className="h-4 w-4" /></Button>}
        {onRemove && <Button size="sm" variant="ghost" disabled={busy} onClick={onRemove} className="text-red-600" aria-label="삭제"><Trash2 className="h-4 w-4" /></Button>}
      </div>
    </li>
  );
}
