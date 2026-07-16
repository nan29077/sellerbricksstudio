"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Megaphone, Bell, Save, X } from "lucide-react";

/* ── 타입 ── */
interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
}
interface Notice {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
}

const STORAGE_KEY_BANNERS = "sb_site_banners";
const STORAGE_KEY_NOTICES = "sb_site_notices";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function usePersist<T>(key: string, init: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(key) : null;
      return saved ? JSON.parse(saved) : init;
    } catch {
      return init;
    }
  });
  const set = (v: T) => {
    setVal(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  };
  return [val, set];
}

/* ─────────────────────────────── BANNERS ─────────────────────────────── */
function BannerSection() {
  const [banners, setBanners] = usePersist<Banner[]>(STORAGE_KEY_BANNERS, []);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState({ title: "", imageUrl: "", linkUrl: "", active: true });

  const openNew = () => {
    setEditing({ id: "", title: "", imageUrl: "", linkUrl: "", active: true });
    setForm({ title: "", imageUrl: "", linkUrl: "", active: true });
  };
  const openEdit = (b: Banner) => {
    setEditing(b);
    setForm({ title: b.title, imageUrl: b.imageUrl, linkUrl: b.linkUrl, active: b.active });
  };
  const save = () => {
    if (!form.title) return;
    if (editing!.id) {
      setBanners(banners.map((b) => b.id === editing!.id ? { ...b, ...form } : b));
    } else {
      setBanners([...banners, { id: uid(), ...form }]);
    }
    setEditing(null);
  };
  const remove = (id: string) => setBanners(banners.filter((b) => b.id !== id));
  const toggle = (id: string) =>
    setBanners(banners.map((b) => b.id === id ? { ...b, active: !b.active } : b));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-brand-600" />
          <h2 className="text-lg font-bold text-navy">배너 관리</h2>
          <Badge tone="brand">{banners.length}개</Badge>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1">
          <Plus className="h-4 w-4" />배너 추가
        </Button>
      </div>

      {editing !== null && (
        <Card className="mb-5 border-brand-200">
          <CardContent className="pt-5 pb-5 space-y-3">
            <p className="font-semibold text-navy">{editing.id ? "배너 수정" : "새 배너 추가"}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">배너 제목</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="배너 제목" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">이미지 URL</label>
                <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">링크 URL</label>
                <Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="rounded"
                  />
                  활성화
                </label>
              </div>
            </div>
            {form.imageUrl && (
              <div className="rounded-lg overflow-hidden border border-border max-w-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imageUrl} alt="미리보기" className="w-full h-32 object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={save} className="gap-1"><Save className="h-4 w-4" />저장</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)} className="gap-1"><X className="h-4 w-4" />취소</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {banners.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">등록된 배너가 없습니다. 배너를 추가해 주세요.</p>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <Card key={b.id} className={b.active ? "" : "opacity-60"}>
              <CardContent className="py-3 flex items-center gap-4">
                {b.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.imageUrl} alt={b.title} className="h-14 w-24 object-cover rounded-lg border border-border shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />
                ) : (
                  <div className="h-14 w-24 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground shrink-0">이미지 없음</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-navy truncate">{b.title}</p>
                  {b.linkUrl && <p className="text-xs text-muted-foreground truncate">{b.linkUrl}</p>}
                  <Badge tone={b.active ? "green" : "gray"} className="mt-1">{b.active ? "활성" : "비활성"}</Badge>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => toggle(b.id)}>
                    {b.active ? "비활성화" : "활성화"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(b.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────────── NOTICES ─────────────────────────────── */
function NoticeSection() {
  const [notices, setNotices] = usePersist<Notice[]>(STORAGE_KEY_NOTICES, []);
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
  const save = () => {
    if (!form.title) return;
    if (editing!.id) {
      setNotices(notices.map((n) => n.id === editing!.id ? { ...n, ...form } : n));
    } else {
      setNotices([{ id: uid(), ...form, createdAt: new Date().toLocaleDateString("ko-KR") }, ...notices]);
    }
    setEditing(null);
  };
  const remove = (id: string) => setNotices(notices.filter((n) => n.id !== id));
  const togglePin = (id: string) =>
    setNotices(notices.map((n) => n.id === id ? { ...n, pinned: !n.pinned } : n));

  const sorted = [...notices].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <section className="mt-10">
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

/* ─────────────────────────────── PAGE ─────────────────────────────── */
export default function SiteManagementPage() {
  return (
    <div className="space-y-2">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-navy">사이트 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">배너와 공지사항을 관리합니다. 변경 사항은 자동 저장됩니다.</p>
      </div>
      <BannerSection />
      <NoticeSection />
    </div>
  );
}
