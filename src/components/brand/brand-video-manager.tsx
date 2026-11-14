"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, PlayCircle, Plus, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appConfirm } from "@/components/ui/app-dialog";
import { videoSourceOf, VIDEO_KIND_LABEL } from "@/lib/home-video-source";
import { cn } from "@/lib/utils";

type Row = { id: string; title: string; caption: string; url: string; thumbnailUrl: string | null; duration: string; isVisible: boolean; sortOrder: number; kind: string | null };
const EMPTY = { title: "", caption: "", url: "", thumbnailUrl: "", duration: "" };

// 브랜드 계정 '샵 꾸미기' — 내 브랜드샵 화면 왼쪽 플레이어에 띄울 라이브 커머스 영상 링크 (2026-11-14)
export function BrandVideoManager({ shopId, shopName }: { shopId?: string; shopName: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const q = shopId ? `?shopId=${encodeURIComponent(shopId)}` : "";

  const load = useCallback(async () => {
    const r = await fetch(`/api/brand/videos${q}`).then((x) => x.json()).catch(() => ({ ok: false }));
    setRows(r.ok ? r.data : []);
  }, [q]);
  useEffect(() => { void load(); }, [load]);

  async function call(method: string, body?: unknown, query = "") {
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/brand/videos${query}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((x) => x.json()).catch(() => ({ ok: false, error: "저장하지 못했습니다." }));
    setBusy(false);
    if (!r.ok) { setMsg({ tone: "err", text: r.error ?? "저장하지 못했습니다." }); return false; }
    await load(); return true;
  }

  const kind = form.url ? videoSourceOf(form.url) : null;
  const sorted = rows ?? [];

  return (
    <section aria-labelledby="brand-videos-heading" className="rounded-[24px] border border-[#E9E5DC] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold tracking-[0.18em] text-brand-700">LIVE COMMERCE</p>
          <h2 id="brand-videos-heading" className="mt-0.5 flex items-center gap-2 text-lg font-extrabold text-navy"><Video className="h-5 w-5 text-brand-600" aria-hidden />브랜드샵 라이브 커머스 영상</h2>
          <p className="mt-1 max-w-2xl break-keep text-sm leading-6 text-slate-500">{shopName || "내"} 브랜드샵 화면의 PC 왼쪽 플레이어에 나오는 영상이에요. 지난 라이브 커머스 다시보기 · 숏폼 · 브랜드 홍보 영상 링크를 넣으세요. 넣은 영상이 없으면 스토리지마켓 메인 영상이 나옵니다.</p>
        </div>
        {shopId && <a href={`/brands/${shopId}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-bold text-navy hover:bg-slate-50"><PlayCircle className="h-4 w-4" aria-hidden />내 샵에서 보기</a>}
      </div>

      <form className="mt-4 grid gap-2 rounded-2xl bg-[#F9F7F2] p-3 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault();
        const min = sorted.length ? Math.min(...sorted.map((r) => r.sortOrder)) : 0;
        if (await call("POST", { ...form, ...(shopId && { shopId }), sortOrder: min - 1 })) { setForm(EMPTY); setMsg({ tone: "ok", text: "영상을 넣었어요. 목록 맨 앞에 보입니다." }); }
      }}>
        <label className="sm:col-span-2 text-xs font-bold text-slate-600">영상 주소 *
          <Input required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://youtu.be/… · https://vimeo.com/… · mp4 주소 · 라이브 커머스 다시보기 주소" className="mt-1" />
          {form.url && <span className={cn("mt-1 block text-[11px] font-semibold", kind ? (kind.kind === "link" ? "text-amber-700" : "text-emerald-700") : "text-red-600")}>{kind ? VIDEO_KIND_LABEL[kind.kind] : "http(s)로 시작하는 영상 주소를 넣어 주세요."}</span>}
        </label>
        <label className="text-xs font-bold text-slate-600">제목 *<Input required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 가을 신상 라이브 다시보기" className="mt-1" /></label>
        <label className="text-xs font-bold text-slate-600">작은 설명<Input maxLength={60} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} placeholder="예: 그립 라이브 · 11/10" className="mt-1" /></label>
        <label className="text-xs font-bold text-slate-600">썸네일 주소 (선택)<Input value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} placeholder="유튜브는 자동" className="mt-1" /></label>
        <label className="text-xs font-bold text-slate-600">길이 (선택)<Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="12:05" className="mt-1" /></label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy || !kind}><Plus className="mr-1 h-4 w-4" aria-hidden />영상 넣기</Button>
          {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={cn("text-xs font-semibold", msg.tone === "err" ? "text-red-700" : "text-emerald-700")}>{msg.text}</p>}
        </div>
      </form>

      {rows === null ? <p className="mt-4 text-sm text-slate-500">불러오는 중…</p> : sorted.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">아직 넣은 영상이 없어요. 위에서 첫 영상을 넣어 보세요.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100">
          {sorted.map((r, i) => (
            <li key={r.id} className={cn("flex flex-wrap items-center gap-3 p-3", !r.isVisible && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-navy">{r.title} {!r.isVisible && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">숨김</span>}</p>
                <p className="truncate text-[11px] text-slate-500">{r.caption && `${r.caption} · `}{r.kind ? VIDEO_KIND_LABEL[r.kind as keyof typeof VIDEO_KIND_LABEL]?.split(" — ")[0] : "주소 확인 필요"} · <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">{r.url}</a></p>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="ghost" disabled={busy || i === 0} aria-label="앞으로" onClick={() => { const prev = sorted[i - 1]; void call("PATCH", { id: r.id, sortOrder: prev.sortOrder - 1 }); }}><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy || i === sorted.length - 1} aria-label="뒤로" onClick={() => { const next = sorted[i + 1]; void call("PATCH", { id: r.id, sortOrder: next.sortOrder + 1 }); }}><ArrowDown className="h-4 w-4" /></Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} aria-label={r.isVisible ? "숨기기" : "보이기"} onClick={() => void call("PATCH", { id: r.id, isVisible: !r.isVisible })}>{r.isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} aria-label="삭제" onClick={async () => { if (await appConfirm("이 영상을 지울까요?", { confirmLabel: "지우기", danger: true })) void call("DELETE", undefined, `?id=${encodeURIComponent(r.id)}`); }}><Trash2 className="h-4 w-4 text-red-600" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
