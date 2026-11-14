"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { SupportCategory } from "@prisma/client";
import { ArrowLeft, ArrowRight, Bot, CheckCircle2, Clock3, Headset, ImagePlus, Loader2, MessageSquareText, Plus, Send, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SUPPORT_CATEGORIES, SUPPORT_HOURS, SUPPORT_STATUS, isSupportCategory, supportInquirySchema, type SupportStatus } from "@/lib/support";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// 문의하기 팝업 (2026-11-14) — 어느 화면에서든 '문의하기'를 누르면 이 창이 뜬다
//  탭: 챗봇 상담 · 1:1 상담(채팅형). 챗봇에서 해결되지 않으면 대화 기록과 함께 1:1 상담으로 넘긴다.
//  1:1 상담은 메신저처럼 말풍선으로 주고받는다 — 운영팀 답변은 자동으로 새로 고쳐지고, 안 읽은 답변은
//  문의하기 버튼에 빨간 숫자로 보인다. 비회원은 이 기기에 상담을 저장해 두고 이어서 대화한다(답변 메일도 발송).
//  최고관리자 '고객 문의 관리'와 연결된다. 다른 곳에서 열기: openSupport({ tab: "inquiry", category, subject })
// ---------------------------------------------------------------------------

type Tab = "chat" | "inquiry" | "mine";
type Anchor = { right: number; bottom: number };
// menu: 떠 있는 문의하기 버튼 → 위에 작은 선택 창(챗봇 상담 · 1:1 채팅 상담). 다른 버튼은 바로 상담 창(panel)을 연다
type OpenDetail = { tab?: Tab; category?: SupportCategory; subject?: string; menu?: boolean; anchor?: Anchor };
type View = "closed" | "menu" | "panel";
const EVENT = "sm:support";
const CLOSE_EVENT = "sm:support-close";
const VIEW_EVENT = "sm:support-view";
const UNREAD_EVENT = "sm:support-unread";
const GUEST_STORE = "sm.support.guest";
export function openSupport(detail: OpenDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenDetail>(EVENT, { detail }));
}

export function closeSupport() {
  window.dispatchEvent(new Event(CLOSE_EVENT));
}

// 문의하기 창이 열려 있는지 — 떠 있는 버튼(X 로 바뀜) · 미니 플레이어(숨김)가 쓴다
let viewNow: View = "closed";
function setView(v: View) {
  viewNow = v;
  window.dispatchEvent(new CustomEvent<View>(VIEW_EVENT, { detail: v }));
}
export function useSupportView() {
  const [v, setV] = useState<View>("closed");
  useEffect(() => {
    setV(viewNow);
    const on = (e: Event) => setV((e as CustomEvent<View>).detail ?? "closed");
    window.addEventListener(VIEW_EVENT, on);
    return () => window.removeEventListener(VIEW_EVENT, on);
  }, []);
  return v;
}

// 안 읽은 상담 답변 수 — 문의하기 팝업(레이아웃에 항상 있음)이 확인해서 알려 준다
let unreadNow = 0;
function setUnread(n: number) {
  unreadNow = n;
  window.dispatchEvent(new CustomEvent<number>(UNREAD_EVENT, { detail: n }));
}
function useUnread() {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(unreadNow);
    const on = (e: Event) => setN((e as CustomEvent<number>).detail ?? 0);
    window.addEventListener(UNREAD_EVENT, on);
    return () => window.removeEventListener(UNREAD_EVENT, on);
  }, []);
  return n;
}

type GuestThread = { id: string; token: string };
function guestThreads(): GuestThread[] {
  try { const v = JSON.parse(localStorage.getItem(GUEST_STORE) ?? "[]"); return Array.isArray(v) ? v.filter((x) => x?.id && x?.token).slice(0, 20) : []; } catch { return []; }
}
function saveGuestThread(t: GuestThread) {
  try { localStorage.setItem(GUEST_STORE, JSON.stringify([t, ...guestThreads().filter((x) => x.id !== t.id)].slice(0, 20))); } catch { /* 저장소 사용 불가 */ }
}

/** 문의하기 버튼 — 누르면 페이지 이동 없이 문의하기 팝업이 뜬다.
 *  launcher(떠 있는 문의하기 버튼): 버튼 위에 '챗봇 상담 · 1:1 채팅 상담' 선택 창, 열려 있으면 X 로 바뀌어 닫는다.
 *  showUnread면 안 읽은 답변 수를 붙인다 */
export function SupportButton({ className, children, tab = "chat", category, subject, ariaLabel, showUnread = false, launcher = false }: { className?: string; children: React.ReactNode; tab?: Tab; category?: SupportCategory; subject?: string; ariaLabel?: string; showUnread?: boolean; launcher?: boolean }) {
  const unread = useUnread();
  const view = useSupportView();
  const opened = launcher && view !== "closed";
  const badge = showUnread && unread > 0 && !opened;
  return (
    <button type="button" aria-label={opened ? "문의하기 닫기" : ariaLabel ? `${ariaLabel}${badge ? ` (새 답변 ${unread}개)` : ""}` : undefined} title={ariaLabel}
      className={cn(className, badge && !/\b(fixed|absolute|sticky)\b/.test(className ?? "") && "relative")} aria-haspopup="dialog" aria-expanded={launcher ? opened : undefined}
      onClick={(e) => {
        if (opened) return closeSupport();
        if (!launcher) return openSupport({ tab: badge ? "inquiry" : tab, category, subject });
        const r = e.currentTarget.getBoundingClientRect();
        openSupport({ menu: true, anchor: { right: Math.max(8, window.innerWidth - r.right), bottom: Math.max(8, window.innerHeight - r.top + 10) } });
      }}>
      {opened ? <X aria-hidden="true" className="h-5 w-5" /> : children}
      {badge && <span aria-hidden="true" className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>}
    </button>
  );
}

type Member = { name: string | null; email: string } | null;
type BotLink = { label: string; href: string };
type Msg = { id: string; from: "bot" | "me"; text: string; links?: BotLink[]; chips?: string[]; handoff?: { category: SupportCategory; subject: string } };
const STORE = "sm.support.chat";
const WELCOME: Msg = {
  id: "welcome", from: "bot", text: "안녕하세요, 스토리지마켓 상담 챗봇이에요. 무엇을 도와드릴까요? 아래에서 고르거나 질문을 입력해 주세요.",
  chips: ["공간 예약 방법", "시연품은 어떻게 준비돼요?", "주문서 쓰는 법", "정산은 언제?", "내 예약 확인", "상담원 연결"],
};
type Prefill = { category?: SupportCategory; subject?: string; transcript?: string; source?: "POPUP" | "CHATBOT"; at?: number };

export function SupportCenter({ member }: { member: Member }) {
  const pathname = usePathname();
  const [view, setViewState] = useState<View>("closed");
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [prefill, setPrefill] = useState<Prefill>({});
  const unread = useUnread();
  const closeBtn = useRef<HTMLButtonElement>(null);
  const open = view !== "closed";
  const show = useCallback((v: View) => { setViewState(v); setView(v); }, []);

  // 안 읽은 답변 확인 (1분마다 · 화면을 보고 있을 때만)
  const refreshUnread = useCallback(async () => {
    try {
      if (member) {
        const j = await fetch("/api/support/unread", { cache: "no-store" }).then((r) => r.json());
        setUnread(j.data?.count ?? 0);
      } else {
        const tokens = guestThreads().map((t) => t.token);
        if (!tokens.length) return setUnread(0);
        const j = await fetch("/api/support/unread", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tokens }) }).then((r) => r.json());
        setUnread(j.data?.count ?? 0);
      }
    } catch { /* 다음에 다시 */ }
  }, [member]);
  useEffect(() => {
    void refreshUnread();
    const t = setInterval(() => { if (document.visibilityState === "visible") void refreshUnread(); }, 60_000);
    return () => clearInterval(t);
  }, [refreshUnread]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<OpenDetail>).detail ?? {};
      if (d.menu) { setAnchor(d.anchor ?? null); show("menu"); return; }
      setTab(d.tab === "mine" ? "inquiry" : d.tab ?? "chat");
      setPrefill(d.category || d.subject ? { category: d.category, subject: d.subject, source: "POPUP", at: Date.now() } : {});
      show("panel");
    };
    const onClose = () => show("closed");
    window.addEventListener(EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    return () => { window.removeEventListener(EVENT, onOpen); window.removeEventListener(CLOSE_EVENT, onClose); };
  }, [show]);
  useEffect(() => {
    if (!open) { void refreshUnread(); return; }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && show("closed");
    window.addEventListener("keydown", onKey);
    setTimeout(() => closeBtn.current?.focus({ preventScroll: true }), 0);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, refreshUnread, show]);
  useEffect(() => { show("closed"); }, [pathname, show]);

  const handoff = useCallback((h: { category: SupportCategory; subject: string }, transcript: string) => {
    setPrefill({ category: h.category, subject: h.subject, transcript, source: "CHATBOT", at: Date.now() });
    setTab("inquiry");
  }, []);
  const choose = (t: Tab) => { setTab(t); setPrefill({}); show("panel"); };

  if (!open) return null;

  // ── 선택 창: 떠 있는 문의하기 버튼 바로 위 ─────────────────────────────
  if (view === "menu") {
    const pos = anchor ? { right: anchor.right, bottom: anchor.bottom } : { right: 16, bottom: 140 };
    return (
      <>
        <div className="fixed inset-0 z-[70]" onClick={() => show("closed")} aria-hidden="true" />
        <div role="dialog" aria-modal="false" aria-labelledby="support-menu-title" style={pos}
          className="fixed z-[71] w-[min(17.5rem,calc(100vw-2rem))] origin-bottom-right animate-[support-pop_160ms_ease-out] rounded-[22px] border border-slate-100 bg-white p-2 text-navy shadow-[0_18px_44px_#1A1A2E2e] motion-reduce:animate-none">
          <div className="flex items-center justify-between py-1 pl-3 pr-0.5">
            <h2 id="support-menu-title" className="text-[15px] font-black">문의하기</h2>
            <button ref={closeBtn} type="button" onClick={() => show("closed")} aria-label="문의하기 닫기" className="grid h-10 w-10 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-navy"><X className="h-5 w-5" /></button>
          </div>
          {([
            { id: "chat" as const, title: "챗봇 상담", desc: "자주 묻는 질문 · 바로 답변", icon: Bot, tone: "bg-brand-50 text-brand-700" },
            { id: "inquiry" as const, title: "1:1 채팅 상담", desc: "운영팀과 대화하기", icon: MessageSquareText, tone: "bg-sky-50 text-sky-700", badge: unread },
          ]).map(({ id, title, desc, icon: Icon, tone, badge }) => (
            <button key={id} type="button" onClick={() => choose(id)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-slate-50 active:bg-slate-100">
              <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", tone)}><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-extrabold">{title}{!!badge && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white">{badge > 9 ? "9+" : badge}<span className="sr-only">개 새 답변</span></span>}</span>
                <span className="block text-xs text-slate-500">{desc}</span>
              </span>
            </button>
          ))}
          <p className="mx-3 mt-1 flex items-center gap-1.5 border-t border-slate-100 pb-1.5 pt-2.5 text-[11px] font-semibold text-slate-500"><Clock3 className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />{SUPPORT_HOURS} · 챗봇은 24시간</p>
        </div>
      </>
    );
  }

  // ── 상담 창: 화면 위에 떠 있는 카드 (모바일은 하단 메뉴바 위까지, PC는 오른쪽 아래) ─────
  const isChat = tab === "chat";
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="support-center-title"
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] top-[calc(env(safe-area-inset-top)+4.25rem)] z-[71] mx-auto flex max-w-[460px] animate-[support-pop_180ms_ease-out] flex-col overflow-hidden rounded-[22px] border border-slate-200/70 bg-[#F8F9FA] shadow-[0_22px_60px_#1A1A2E40] motion-reduce:animate-none lg:inset-x-auto lg:bottom-6 lg:right-6 lg:top-auto lg:h-[min(680px,calc(100vh-3rem))] lg:w-[410px]">
      <div className="flex items-center gap-1 bg-navy py-2.5 pl-2 pr-1.5 text-white">
        <button type="button" onClick={() => show("menu")} aria-label="상담 방법 다시 고르기" className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></button>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10 text-brand-300">{isChat ? <Bot className="h-[18px] w-[18px]" aria-hidden="true" /> : <MessageSquareText className="h-[18px] w-[18px]" aria-hidden="true" />}</span>
        <h2 id="support-center-title" className="ml-1.5 min-w-0 flex-1 truncate text-base font-black">{isChat ? "챗봇 상담" : "1:1 채팅 상담"}</h2>
        <button type="button" onClick={() => setTab(isChat ? "inquiry" : "chat")} className="relative mr-0.5 inline-flex h-8 shrink-0 items-center rounded-full bg-white/10 px-3 text-[11px] font-bold text-white/90 hover:bg-white/20">
          {isChat ? "1:1 상담" : "챗봇"}
          {isChat && unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-navy" aria-label={`새 답변 ${unread}개`} />}
        </button>
        <button ref={closeBtn} type="button" onClick={() => show("closed")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-white/10" aria-label="문의하기 닫기"><X className="h-5 w-5" /></button>
      </div>
      <p className="flex items-center gap-1.5 border-b border-sky-100 bg-sky-50 px-4 py-1.5 text-[11px] font-semibold text-sky-800"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />운영팀 {SUPPORT_HOURS}{isChat ? " · 챗봇은 24시간 답변" : " · 답변이 오면 알려 드려요"}</p>
      <div className="min-h-0 flex-1">
        {isChat && <ChatPanel member={member} onHandoff={handoff} />}
        {tab === "inquiry" && <TalkPanel key={prefill.at ?? 0} member={member} prefill={prefill} pagePath={pathname} onRead={refreshUnread} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 챗봇
// ---------------------------------------------------------------------------
function ChatPanel({ member, onHandoff }: { member: Member; onHandoff: (h: { category: SupportCategory; subject: string }, transcript: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try { const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null"); if (Array.isArray(saved) && saved.length) return saved; } catch { /* 저장소 사용 불가 */ }
    return [WELCOME];
  });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-40))); } catch { /* 저장소 사용 불가 */ } end.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  const transcript = () => msgs.filter((m) => m.id !== "welcome").map((m) => `${m.from === "me" ? "고객" : "챗봇"}: ${m.text}`).join("\n").slice(-8000);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    if (/^상담원\s*연결$/.test(question)) { onHandoff({ category: "OTHER", subject: "상담원 문의" }, transcript()); return; }
    setText("");
    const mine: Msg = { id: `m${Date.now()}`, from: "me", text: question };
    setMsgs((m) => [...m, mine]);
    setBusy(true);
    try {
      const res = await fetch("/api/support/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: question }) });
      const j = await res.json().catch(() => ({}));
      const d = j.data ?? {};
      setMsgs((m) => [...m, j.ok
        ? { id: `b${Date.now()}`, from: "bot", text: d.text, links: d.links, chips: d.chips, handoff: d.handoff ?? (d.confident === false ? { category: "OTHER", subject: question.slice(0, 60) } : undefined) }
        : { id: `b${Date.now()}`, from: "bot", text: j.error ?? "지금은 답변하지 못했어요. 잠시 후 다시 시도하거나 1:1 문의를 남겨 주세요.", handoff: { category: "OTHER", subject: question.slice(0, 60) } }]);
    } catch {
      setMsgs((m) => [...m, { id: `b${Date.now()}`, from: "bot", text: "연결이 불안정해요. 잠시 후 다시 시도해 주세요." }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[88%] space-y-2", m.from === "me" ? "items-end" : "")}>
              {m.from === "bot" && <p className="flex items-center gap-1 text-[11px] font-bold text-slate-500"><Bot className="h-3.5 w-3.5 text-brand-600" />상담 챗봇</p>}
              <p className={cn("whitespace-pre-line break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6", m.from === "me" ? "rounded-br-md bg-navy text-white" : "rounded-bl-md border border-[#E8E5DD] bg-white text-navy")}>{m.text}</p>
              {!!m.links?.length && (
                <div className="flex flex-wrap gap-1.5">
                  {m.links.map((l) => <Link key={l.href + l.label} href={l.href} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-brand-300 bg-brand-50 px-3 text-xs font-bold text-brand-800 hover:bg-brand-100">{l.label}<ArrowRight className="h-3.5 w-3.5" /></Link>)}
                </div>
              )}
              {m.handoff && (
                <button type="button" onClick={() => onHandoff(m.handoff!, transcript())} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-navy px-3 text-xs font-bold text-white hover:bg-navy-700">
                  <MessageSquareText className="h-3.5 w-3.5 text-brand-300" />운영팀에 1:1 문의 남기기
                </button>
              )}
              {!!m.chips?.length && m === msgs[msgs.length - 1] && (
                <div className="flex flex-wrap gap-1.5">
                  {m.chips.map((c) => <button key={c} type="button" onClick={() => ask(c)} className="min-h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-navy hover:border-brand-300 hover:bg-brand-50">{c}</button>)}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />답변을 찾는 중…</p>}
        <div ref={end} />
      </div>
      <form className="flex items-end gap-2 border-t border-[#E8E5DD] bg-white p-3" onSubmit={(e) => { e.preventDefault(); void ask(text); }}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={500} aria-label="챗봇에게 질문"
          placeholder={member ? "예) 내 예약 확인 · 시연품 도착 언제?" : "궁금한 점을 입력하세요"} className="max-h-28 min-h-11 flex-1 resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(text); } }} />
        <Button type="submit" disabled={busy || !text.trim()} className="h-11 w-11 shrink-0 p-0" aria-label="질문 보내기"><Send className="h-4 w-4" /></Button>
      </form>
      <div className="flex justify-between bg-white px-4 pb-3 text-[11px] text-slate-500">
        <span>챗봇 답변은 안내용이에요. 정확한 처리는 1:1 문의로 남겨 주세요.</span>
        <button type="button" className="font-semibold underline" onClick={() => { setMsgs([WELCOME]); try { sessionStorage.removeItem(STORE); } catch { /* 무시 */ } }}>대화 지우기</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1:1 상담 (채팅형) — 상담 목록 · 새 상담 · 대화
// ---------------------------------------------------------------------------
type ThreadRow = { id: string; subject: string; status: SupportStatus; updatedAt: string; unread: boolean; last?: string; lastFrom?: string; token?: string };
type Bubble = { id: string; author: "USER" | "ADMIN"; body: string; attachments: string[]; at: string; pending?: boolean };
type ThreadData = { id: string; subject: string; category: string; status: SupportStatus; createdAt: string; rating: number | null; closed: boolean; items: Bubble[] };

const timeOf = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const toneOf = (s: SupportStatus) => SUPPORT_STATUS[s].tone === "green" ? "bg-emerald-50 text-emerald-700" : SUPPORT_STATUS[s].tone === "yellow" ? "bg-amber-50 text-amber-800" : SUPPORT_STATUS[s].tone === "blue" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600";

function TalkPanel({ member, prefill, pagePath, onRead }: { member: Member; prefill: Prefill; pagePath: string; onRead: () => void }) {
  const [view, setView] = useState<"list" | "new" | { id: string; token?: string }>(prefill.transcript || prefill.category || prefill.subject ? "new" : "list");
  const [rows, setRows] = useState<ThreadRow[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      if (member) {
        const j = await fetch("/api/support/inquiries", { cache: "no-store" }).then((r) => r.json());
        if (!j.ok) throw new Error(j.error);
        setRows(j.data);
      } else {
        const tokens = guestThreads().map((t) => t.token);
        if (!tokens.length) return setRows([]);
        const j = await fetch("/api/support/unread", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tokens }) }).then((r) => r.json());
        setRows((j.data?.threads ?? []).map((t: ThreadRow & { status: string }) => ({ ...t, status: (t.status in SUPPORT_STATUS ? t.status : "OPEN") as SupportStatus })));
      }
    } catch { setError("상담 목록을 불러오지 못했어요."); setRows([]); }
  }, [member]);
  useEffect(() => { if (view === "list") void load(); }, [view, load]);
  useEffect(() => { if (view === "list" && rows && rows.length === 0 && !error) setView("new"); }, [view, rows, error]);

  if (view === "new") return <NewTalk member={member} prefill={prefill} pagePath={pagePath} onBack={rows?.length ? () => setView("list") : undefined}
    onCreated={(id, token) => { if (token) saveGuestThread({ id, token }); setView({ id, token }); }} />;
  if (typeof view === "object") return <TalkThread id={view.id} token={view.token} member={member} onBack={() => { setView("list"); onRead(); }} onRead={onRead} />;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[#E8E5DD] bg-white px-4 py-3">
        <div>
          <p className="text-sm font-extrabold text-navy">내 상담</p>
          <p className="text-[11px] text-slate-500">운영팀 {SUPPORT_HOURS} · 답변은 이 창과 {member ? "앱 알림" : "이메일"}으로 알려 드려요</p>
        </div>
        <Button size="sm" onClick={() => setView("new")} className="gap-1 rounded-full"><Plus className="h-4 w-4" />새 상담</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {error && <p role="alert" className="mb-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {!rows ? <p className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />불러오는 중…</p> : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const token = member ? undefined : guestThreads().find((t) => t.id === r.id)?.token;
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => setView({ id: r.id, token })} className="flex w-full items-start gap-3 rounded-2xl border border-[#E8E5DD] bg-white p-3 text-left hover:border-brand-300">
                    <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy text-brand-300">
                      <Headset className="h-5 w-5" />
                      {r.unread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-white"><span className="sr-only">새 답변</span></span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", toneOf(r.status))}>{SUPPORT_STATUS[r.status].label}</span>
                        <span className="truncate text-sm font-bold text-navy">{r.subject}</span>
                      </span>
                      {r.last && <span className={cn("mt-0.5 block truncate text-xs", r.unread ? "font-bold text-navy" : "text-slate-500")}>{r.lastFrom === "ADMIN" ? "운영팀: " : ""}{r.last}</span>}
                      <span className="mt-0.5 block text-[11px] text-slate-400">{timeOf(r.updatedAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function useImageUpload(enabled: boolean, onError: (m: string) => void) {
  const [files, setFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  async function upload(file: File) {
    if (!enabled) return;
    if (files.length >= 5) return onError("이미지는 5장까지 보낼 수 있어요.");
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("folder", "misc");
      const j = await fetch("/api/uploads", { method: "POST", body: fd }).then((r) => r.json()).catch(() => ({}));
      if (!j.ok) throw new Error(j.error ?? "이미지를 올리지 못했어요.");
      setFiles((f) => [...f, j.data.url]);
    } catch (e) { onError(e instanceof Error ? e.message : "이미지를 올리지 못했어요."); }
    finally { setUploading(false); }
  }
  return { files, setFiles, uploading, upload };
}

function Composer({ value, onChange, onSend, busy, placeholder, attach, disabled }: {
  value: string; onChange: (v: string) => void; onSend: () => void; busy: boolean; placeholder: string; disabled?: boolean;
  attach?: ReturnType<typeof useImageUpload> | null;
}) {
  return (
    <div className="border-t border-[#E8E5DD] bg-white p-3">
      {!!attach?.files.length && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attach.files.map((f) => (
            <span key={f} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f} alt="보낼 이미지" className="h-14 w-14 rounded-xl border object-cover" />
              <button type="button" onClick={() => attach.setFiles((x) => x.filter((y) => y !== f))} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-navy text-white" aria-label="이미지 빼기"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); onSend(); }}>
        {attach && (
          <label className={cn("grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border text-slate-500 hover:border-brand-300", (disabled || attach.uploading) && "pointer-events-none opacity-50")} title="이미지 보내기">
            {attach.uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span className="sr-only">이미지 보내기</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={disabled || attach.uploading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void attach.upload(f); }} />
          </label>
        )}
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={1} maxLength={3000} aria-label="메시지" disabled={disabled}
          placeholder={placeholder} className="max-h-32 min-h-11 flex-1 resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSend(); } }} />
        <Button type="submit" disabled={busy || disabled || (!value.trim() && !attach?.files.length)} className="h-11 w-11 shrink-0 p-0" aria-label="보내기">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
      </form>
      <p className="mt-1.5 text-[10.5px] text-slate-400">Enter 보내기 · Shift+Enter 줄바꿈 · 비밀번호 · 카드번호는 보내지 마세요</p>
    </div>
  );
}

function AgentBubble({ children, time }: { children: React.ReactNode; time?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-brand-300"><Headset className="h-4 w-4" /></span>
      <div className="max-w-[85%]">
        <p className="mb-0.5 text-[11px] font-bold text-slate-500">스토리지마켓 운영팀{time ? <span className="ml-1 font-normal text-slate-400">{time}</span> : null}</p>
        <div className="rounded-2xl rounded-tl-md border border-[#E8E5DD] bg-white px-3.5 py-2.5 text-sm leading-6 text-navy">{children}</div>
      </div>
    </div>
  );
}

function NewTalk({ member, prefill, pagePath, onBack, onCreated }: { member: Member; prefill: Prefill; pagePath: string; onBack?: () => void; onCreated: (id: string, token?: string) => void }) {
  const requestId = useRef<string>();
  const [category, setCategory] = useState<SupportCategory | "">(prefill.category ?? "");
  const [text, setText] = useState(prefill.subject && prefill.source === "POPUP" ? `${prefill.subject}\n` : "");
  const [reference, setReference] = useState("");
  const [refs, setRefs] = useState<{ value: string; label: string }[]>([]);
  const [guest, setGuest] = useState({ name: "", email: "", phone: "", agree: false });
  const [withTranscript, setWithTranscript] = useState(!!prefill.transcript);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attach = useImageUpload(!!member, setError);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!member) return;
    fetch("/api/support/context").then((r) => r.json()).then((j) => setRefs(j.data?.refs ?? [])).catch(() => undefined);
  }, [member]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [category]);

  async function send() {
    if (busy) return;
    setError("");
    const body = text.trim();
    if (!category) return setError("먼저 어떤 내용인지 골라 주세요.");
    if (body.length < 10) return setError("운영팀이 바로 도울 수 있게 조금만 더 자세히 적어 주세요. (10자 이상)");
    if (!member && (!guest.name.trim() || !guest.email.trim())) return setError("이름과 답변 받을 이메일을 입력해 주세요.");
    if (!member && !guest.agree) return setError("개인정보 수집 · 이용에 동의해 주세요.");
    const firstLine = body.split("\n")[0].trim();
    const subject = (firstLine.length >= 4 ? firstLine : `${SUPPORT_CATEGORIES[category].label} 문의 · ${firstLine}`).slice(0, 60);
    const id = requestId.current ?? crypto.randomUUID();
    const payload = {
      id, category, subject: subject.length >= 4 ? subject : `${SUPPORT_CATEGORIES[category].label} 문의`, message: body, reference: reference || undefined, attachments: attach.files,
      source: prefill.source === "CHATBOT" && withTranscript ? "CHATBOT" : "POPUP",
      chatTranscript: withTranscript ? prefill.transcript : undefined, pagePath,
      ...(member ? {} : { guestName: guest.name, guestEmail: guest.email, guestPhone: guest.phone || undefined, agreePrivacy: guest.agree }),
    };
    const check = supportInquirySchema.safeParse(payload);
    if (!check.success) return setError(check.error.issues[0].message);
    requestId.current = id;
    setBusy(true);
    try {
      const j = await fetch("/api/support/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(check.data) }).then((r) => r.json()).catch(() => ({}));
      if (!j.ok) throw new Error(j.error ?? "보내지 못했어요. 다시 시도해 주세요.");
      try { if (withTranscript) sessionStorage.removeItem(STORE); } catch { /* 무시 */ }
      onCreated(j.data.id, j.data.guestToken);
    } catch (e) { setError(e instanceof Error ? e.message : "보내지 못했어요. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[#E8E5DD] bg-white px-3 py-2.5">
        {onBack && <button type="button" onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100" aria-label="상담 목록"><ArrowLeft className="h-5 w-5" /></button>}
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-navy">새 상담</p>
          <p className="text-[11px] text-slate-500">운영팀 {SUPPORT_HOURS} · 보통 몇 시간 안에 답해요</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
        <AgentBubble>안녕하세요{member?.name ? `, ${member.name}님` : ""}! 스토리지마켓 운영팀이에요. 어떤 내용인지 골라 주시면 담당자가 바로 확인할게요.</AgentBubble>
        <div className="flex flex-wrap gap-1.5 pl-10">
          {Object.entries(SUPPORT_CATEGORIES).map(([v, item]) => (
            <button key={v} type="button" onClick={() => setCategory(isSupportCategory(v) ? v : "")} aria-pressed={category === v}
              className={cn("min-h-9 rounded-full border px-3 text-xs font-semibold", category === v ? "border-navy bg-navy text-white" : "border-slate-200 bg-white text-navy hover:border-brand-300")}>{item.label}</button>
          ))}
        </div>
        {category && <AgentBubble>{SUPPORT_CATEGORIES[category].hint} 아래 입력창에 편하게 적어 보내 주세요.</AgentBubble>}
        {category && member && refs.length > 0 && (
          <div className="pl-10">
            <Select aria-label="관련 예약 · 주문서" value={reference} onChange={(e) => setReference(e.target.value)} className="h-10 text-xs">
              <option value="">관련 예약 · 주문서 (선택)</option>
              {refs.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </div>
        )}
        {prefill.transcript && (
          <label className="ml-10 flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-xs text-navy">
            <input type="checkbox" checked={withTranscript} onChange={(e) => setWithTranscript(e.target.checked)} className="mt-0.5" />
            <span><b>챗봇 대화 기록 함께 보내기</b> — 운영팀이 앞의 대화를 보고 바로 이어서 답해요.</span>
          </label>
        )}
        {category && !member && (
          <div className="ml-10 space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold text-navy">답변 받을 곳 · <Link href="/login?callbackUrl=%2Fsupport" className="underline">로그인하고 상담</Link></p>
            <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
              <Input aria-label="이름" placeholder="이름" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} maxLength={40} />
              <Input aria-label="연락처 (선택)" placeholder="연락처 (선택)" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} maxLength={30} inputMode="tel" />
            </div>
            <Input aria-label="답변 받을 이메일" type="email" placeholder="답변 받을 이메일" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} maxLength={120} />
            <label className="flex items-start gap-2 text-[11px] leading-5 text-slate-600">
              <input type="checkbox" checked={guest.agree} onChange={(e) => setGuest({ ...guest, agree: e.target.checked })} className="mt-0.5" />
              <span>상담 답변을 위해 이름 · 이메일 · 연락처를 수집하고 답변 후 1년 보관하는 데 동의합니다. (<Link href="/privacy" className="underline">개인정보처리방침</Link>) 이 기기에 상담이 저장되어 이어서 대화할 수 있어요.</span>
            </label>
          </div>
        )}
        {error && <p role="alert" className="ml-10 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div ref={end} />
      </div>
      <Composer value={text} onChange={setText} onSend={send} busy={busy} disabled={!category} attach={member ? attach : null}
        placeholder={category ? "무엇을 도와드릴까요? 상황을 자세히 적어 주세요" : "먼저 위에서 내용을 골라 주세요"} />
    </div>
  );
}

function TalkThread({ id, token, member, onBack, onRead }: { id: string; token?: string; member: Member; onBack: () => void; onRead: () => void }) {
  const [data, setData] = useState<ThreadData | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Bubble[]>([]);
  const [rated, setRated] = useState(0);
  const attach = useImageUpload(!!member, setError);
  const end = useRef<HTMLDivElement>(null);
  const count = useRef(0);
  const q = token ? `?token=${encodeURIComponent(token)}` : "";

  const load = useCallback(async () => {
    try {
      const j = await fetch(`/api/support/inquiries/${id}${q}`, { cache: "no-store" }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error ?? "상담을 불러오지 못했어요.");
      setData(j.data);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "상담을 불러오지 못했어요."); }
  }, [id, q]);
  // 운영팀 답변을 기다리는 동안 자동으로 새로 고친다 (6초마다, 화면을 보고 있을 때만)
  useEffect(() => {
    void load().then(onRead);
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 6000);
    return () => clearInterval(t);
  }, [load, onRead]);
  useEffect(() => {
    const n = (data?.items.length ?? 0) + pending.length;
    if (n !== count.current) { count.current = n; end.current?.scrollIntoView({ block: "end" }); }
  }, [data, pending]);

  async function send() {
    const body = text.trim() || (attach.files.length ? "(이미지)" : "");
    if (!body || busy) return;
    setBusy(true); setError("");
    const temp: Bubble = { id: `p${Date.now()}`, author: "USER", body, attachments: attach.files, at: new Date().toISOString(), pending: true };
    setPending((p) => [...p, temp]);
    setText("");
    try {
      const j = await fetch(`/api/support/inquiries/${id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, attachments: attach.files, token }) }).then((r) => r.json()).catch(() => ({}));
      if (!j.ok) throw new Error(j.error ?? "보내지 못했어요.");
      attach.setFiles([]);
      await load();
      setPending((p) => p.filter((x) => x.id !== temp.id));
    } catch (e) {
      setPending((p) => p.filter((x) => x.id !== temp.id));
      setText(body === "(이미지)" ? "" : body);
      setError(e instanceof Error ? e.message : "보내지 못했어요.");
    } finally { setBusy(false); }
  }

  async function patch(action: "close" | "rate", rating?: number) {
    const j = await fetch(`/api/support/inquiries/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, rating, token }) }).then((r) => r.json()).catch(() => ({}));
    if (!j.ok) { setError(j.error ?? "처리하지 못했어요."); return; }
    if (rating) setRated(rating);
    await load();
  }

  if (!data) return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-slate-500">
      {error ? <><p role="alert" className="text-red-700">{error}</p><Button variant="outline" onClick={onBack}>상담 목록</Button></> : <><Loader2 className="h-5 w-5 animate-spin" />불러오는 중…</>}
    </div>
  );
  const items = [...data.items, ...pending];
  const lastAdmin = [...data.items].reverse().find((m) => m.author === "ADMIN");
  const waiting = !data.closed && data.items[data.items.length - 1]?.author === "USER";
  const showRating = !data.rating && !rated && (data.status === "ANSWERED" || data.closed) && !!lastAdmin;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[#E8E5DD] bg-white px-3 py-2.5">
        <button type="button" onClick={onBack} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-slate-100" aria-label="상담 목록"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-navy">{data.subject}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className={cn("rounded-full px-1.5 py-0.5 font-bold", toneOf(data.status))}>{SUPPORT_STATUS[data.status].label}</span>{data.category}</p>
        </div>
        {data.status === "ANSWERED" && <button type="button" onClick={() => patch("close")} className="shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold text-navy hover:bg-slate-50">해결됐어요</button>}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4" aria-live="polite">
        <p className="text-center text-[11px] text-slate-400">{timeOf(data.createdAt)} 상담 시작</p>
        {items.map((m) => m.author === "ADMIN" ? (
          <AgentBubble key={m.id} time={timeOf(m.at)}>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            {!!m.attachments.length && <Attachments list={m.attachments} />}
          </AgentBubble>
        ) : (
          <div key={m.id} className="flex flex-col items-end">
            <div className={cn("max-w-[85%] rounded-2xl rounded-br-md bg-navy px-3.5 py-2.5 text-sm leading-6 text-white", m.pending && "opacity-60")}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              {!!m.attachments.length && <Attachments list={m.attachments} />}
            </div>
            <p className="mt-0.5 text-[10.5px] text-slate-400">{m.pending ? "보내는 중…" : timeOf(m.at)}</p>
          </div>
        ))}
        {waiting && (
          <AgentBubble>
            <span className="flex items-center gap-2 text-slate-600"><span className="flex gap-0.5"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" /></span>담당자가 확인하고 있어요. 답변이 오면 {member ? "앱 알림" : "이메일"}으로도 알려 드려요.</span>
          </AgentBubble>
        )}
        {showRating && (
          <div className="mx-auto max-w-[320px] rounded-2xl border border-brand-200 bg-brand-50 p-3 text-center">
            <p className="text-xs font-bold text-navy">상담이 도움이 됐나요?</p>
            <div className="mt-1.5 flex justify-center gap-1" role="radiogroup" aria-label="상담 만족도">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={false} aria-label={`${n}점`} onClick={() => patch("rate", n)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white">
                  <Star className="h-6 w-6 text-brand-500" />
                </button>
              ))}
            </div>
          </div>
        )}
        {(data.rating || rated) ? <p className="flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />만족도 {data.rating ?? rated}점 — 의견 고마워요!</p> : null}
        {data.closed && <p className="text-center text-[11px] text-slate-500">상담이 종료되었어요. 메시지를 보내면 다시 이어서 상담할 수 있어요.</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div ref={end} />
      </div>
      <Composer value={text} onChange={setText} onSend={send} busy={busy} attach={member ? attach : null}
        placeholder={data.closed ? "다시 상담하려면 메시지를 보내세요" : "메시지를 입력하세요"} />
    </div>
  );
}

function Attachments({ list }: { list: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {list.map((a) => (
        <a key={a} href={a} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a} alt="첨부 이미지" className="h-20 w-20 rounded-xl border object-cover" />
        </a>
      ))}
    </div>
  );
}

/** 비회원 확인 링크 화면: 이 기기에 상담을 저장하고, 문의하기 창(채팅)에서 이어서 볼 수 있게 한다 */
export function GuestThreadRemember({ id, token }: { id: string; token: string }) {
  useEffect(() => { saveGuestThread({ id, token }); }, [id, token]);
  return (
    <button type="button" onClick={() => openSupport({ tab: "inquiry" })} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-navy px-4 text-xs font-bold text-white hover:bg-navy-700">
      <MessageSquareText className="h-4 w-4 text-brand-300" />채팅으로 이어서 상담하기
    </button>
  );
}
