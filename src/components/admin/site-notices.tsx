"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Bell, Save, X } from "lucide-react";

/* ── 타입 ── */
interface Notice {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
}

const STORAGE_KEY_NOTICES = "sb_site_notices"; // 예전 브라우저 저장 공지 (처음 열 때 서버로 옮김)

/* ─────────────────────────────── NOTICES ─────────────────────────────── */
/** 공지는 서버(DB)에 저장한다. 예전에 이 브라우저에만 저장된 공지가 있으면 처음 한 번 서버로 옮긴다. */
type ServerNotice = { id: string; title: string; body: string; pinned: boolean; createdAt: string };
function useServerNotices(): [Notice[], { create: (n: Omit<Notice, "id" | "createdAt">) => Promise<void>; update: (id: string, n: Partial<Notice>) => Promise<void>; remove: (id: string) => Promise<void> }, string] {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState("");
  const toView = (n: ServerNotice): Notice => ({ id: n.id, title: n.title, content: n.body, pinned: n.pinned, createdAt: new Date(n.createdAt).toLocaleDateString("ko-KR") });
  const call = async (method: string, body?: unknown, query = "") => {
    const json = await fetch(`/api/admin/notices${query}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined })
      .then((r) => r.json()).catch(() => ({ ok: false, error: "서버에 연결하지 못했습니다." }));
    if (!json.ok) throw new Error(json.error ?? "처리하지 못했습니다.");
    return json.data;
  };
  const reload = async () => {
    try { setNotices(((await call("GET")) as ServerNotice[]).map(toView)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "공지를 불러오지 못했습니다."); }
  };
  useEffect(() => {
    (async () => {
      try {
        const rows = (await call("GET")) as ServerNotice[];
        const legacy = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY_NOTICES) ?? "[]") as Notice[]; } catch { return []; } })();
        if (legacy.length && rows.length === 0) {
          await call("POST", { import: legacy.filter((n) => n.title).map((n) => ({ title: n.title.slice(0, 120), body: (n.content ?? "").slice(0, 5000), pinned: !!n.pinned })) });
          try { localStorage.removeItem(STORAGE_KEY_NOTICES); } catch { /* 저장소 사용 불가 */ }
          await reload();
          return;
        }
        if (legacy.length) { try { localStorage.removeItem(STORAGE_KEY_NOTICES); } catch { /* 저장소 사용 불가 */ } }
        setNotices(rows.map(toView));
      } catch (e) { setError(e instanceof Error ? e.message : "공지를 불러오지 못했습니다."); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const wrap = (fn: () => Promise<unknown>) => async () => {
    try { await fn(); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "처리하지 못했습니다."); }
  };
  return [notices, {
    create: (n) => wrap(() => call("POST", { title: n.title, body: n.content, pinned: n.pinned }))(),
    update: (id, n) => wrap(() => call("PATCH", { id, ...(n.title !== undefined && { title: n.title }), ...(n.content !== undefined && { body: n.content }), ...(n.pinned !== undefined && { pinned: n.pinned }) }))(),
    remove: (id) => wrap(() => call("DELETE", undefined, `?id=${encodeURIComponent(id)}`))(),
  }, error];
}

export function SiteNoticeManager() {
  const [notices, api, loadError] = useServerNotices();
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState({ title: "", content: "", pinned: false });

  const openNew = () => {
    setEditing({ id: "", title: "", content: "", pinned: false, createdAt: "" });
    setForm({ title: "", content: "", pinned: false });
  };
  const openEdit = (n: Notice) => {
    setEditing(n);
    setForm({ title: n.title, content: n.content, pinned: n.pinned });
  };
  const save = async () => {
    if (!form.title) return;
    if (editing!.id) await api.update(editing!.id, form);
    else await api.create(form);
    setEditing(null);
  };
  const remove = (id: string) => { void api.remove(id); };
  const togglePin = (id: string) => {
    const target = notices.find((n) => n.id === id);
    if (target) void api.update(id, { pinned: !target.pinned });
  };

  const sorted = [...notices].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-brand-600" />
          <h2 className="text-lg font-bold text-navy">공지사항 관리</h2>
          <Badge tone="brand">{notices.length}개</Badge>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1">
          <Plus className="h-4 w-4" />공지 추가
        </Button>
      </div>
      {loadError && <p role="alert" className="mb-3 text-sm text-red-700">{loadError}</p>}
      <p className="mb-3 text-xs text-slate-500">공지는 서버에 저장되며 사이트 하단의 <a href="/notices" target="_blank" className="underline">공지사항</a> 페이지에 공개됩니다.</p>

      {editing !== null && (
        <Card className="mb-5 border-brand-200">
          <CardContent className="pt-5 pb-5 space-y-3">
            <p className="font-semibold text-navy">{editing.id ? "공지 수정" : "새 공지 추가"}</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">제목</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="공지사항 제목" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">내용</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="공지 내용을 입력하세요..."
                rows={4}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="rounded" />
              상단 고정
            </label>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} className="gap-1"><Save className="h-4 w-4" />저장</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)} className="gap-1"><X className="h-4 w-4" />취소</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">등록된 공지사항이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((n) => (
            <Card key={n.id} className={n.pinned ? "border-amber-300 bg-amber-50/40" : ""}>
              <CardContent className="py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {n.pinned && <Badge tone="yellow">고정</Badge>}
                    <p className="font-bold text-navy truncate">{n.title}</p>
                  </div>
                  {n.content && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.content}</p>}
                  <p className="text-[11px] text-muted-foreground/60 mt-1">{n.createdAt}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => togglePin(n.id)} className="text-amber-600 hover:text-amber-700 text-xs px-2">
                    {n.pinned ? "고정 해제" : "고정"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(n)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(n.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

