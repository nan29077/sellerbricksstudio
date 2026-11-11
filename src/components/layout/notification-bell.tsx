"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Noti = { id: string; type: string; title: string; body: string | null; link: string | null; isRead: boolean; createdAt: string };

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

export function NotificationBell({ dark = false }: { dark?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Noti[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) { setItems(j.data.items); setUnread(j.data.unread); }
    } catch { /* 네트워크 오류 무시 */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  async function patch(body: object) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    load();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        className={cn("relative rounded-lg p-2", dark ? "text-white/70 hover:bg-white/10" : "text-slate-600 hover:bg-muted")}
        aria-label={`알림 ${unread}건`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className={cn("absolute z-[70] mt-2 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[#E9E5DC] bg-white shadow-2xl", dark ? "left-0" : "right-0")}>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-extrabold text-navy">알림 {unread > 0 && <span className="text-red-500">{unread}</span>}</p>
            <div className="flex gap-1">
              <button onClick={() => patch({ all: true })} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-muted"><CheckCheck className="h-3.5 w-3.5" />모두 읽음</button>
              <button onClick={async () => { await fetch("/api/notifications", { method: "DELETE" }); load(); }} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-muted"><Trash2 className="h-3.5 w-3.5" />읽은 알림 정리</button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? <p className="py-10 text-center text-sm text-slate-400">새 알림이 없습니다.</p> : items.map((n) => (
              <button
                key={n.id}
                onClick={() => { if (!n.isRead) patch({ id: n.id }); if (n.link) { setOpen(false); router.push(n.link); } }}
                className={cn("block w-full border-b border-[#F2EEE7] px-4 py-3 text-left hover:bg-brand-50/50", !n.isRead && "bg-brand-50/40")}
              >
                <div className="flex items-start gap-2">
                  {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">{ago(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
