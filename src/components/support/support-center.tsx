"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { SupportCategory } from "@prisma/client";
import { ArrowRight, Bot, CheckCircle2, ImagePlus, Inbox, Loader2, MessageSquareText, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { SUPPORT_CATEGORIES, SUPPORT_STATUS, isSupportCategory, supportInquirySchema, type SupportStatus } from "@/lib/support";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// 문의하기 팝업 (2026-11-14) — 어느 화면에서든 '문의하기'를 누르면 이 창이 뜬다
//  탭: 챗봇 상담 · 1:1 문의 · 내 문의(회원). 챗봇에서 해결되지 않으면 대화 기록과 함께 1:1 문의로 넘긴다.
//  1:1 문의는 최고관리자 '고객 문의 관리'로 들어가고, 답변은 앱 알림(비회원은 이메일)으로 온다.
//  다른 곳에서 열기: openSupport({ tab: "inquiry", category, subject })
// ---------------------------------------------------------------------------

type Tab = "chat" | "inquiry" | "mine";
type OpenDetail = { tab?: Tab; category?: SupportCategory; subject?: string };
const EVENT = "sm:support";
export function openSupport(detail: OpenDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenDetail>(EVENT, { detail }));
}

/** 문의하기 버튼 — 자바스크립트가 없으면 고객센터 페이지로 간다 */
export function SupportButton({ className, children, tab = "chat", category, subject, ariaLabel }: { className?: string; children: React.ReactNode; tab?: Tab; category?: SupportCategory; subject?: string; ariaLabel?: string }) {
  return (
    <a href="/support" aria-label={ariaLabel} title={ariaLabel} className={className} aria-haspopup="dialog"
      onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); openSupport({ tab, category, subject }); }}>
      {children}
    </a>
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

export function SupportCenter({ member }: { member: Member }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [prefill, setPrefill] = useState<{ category?: SupportCategory; subject?: string; transcript?: string; source?: "POPUP" | "CHATBOT" }>({});
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<OpenDetail>).detail ?? {};
      setTab(d.tab ?? "chat");
      setPrefill({ category: d.category, subject: d.subject, source: "POPUP" });
      setOpen(true);
    };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => closeBtn.current?.focus(), 0);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);
  useEffect(() => { setOpen(false); }, [pathname]);

  const handoff = useCallback((h: { category: SupportCategory; subject: string }, transcript: string) => {
    setPrefill({ category: h.category, subject: h.subject, transcript, source: "CHATBOT" });
    setTab("inquiry");
  }, []);

  if (!open) return null;
  const tabs: { id: Tab; label: string; icon: typeof Bot }[] = [
    { id: "chat", label: "챗봇 상담", icon: Bot },
    { id: "inquiry", label: "1:1 문의", icon: MessageSquareText },
    ...(member ? [{ id: "mine" as Tab, label: "내 문의", icon: Inbox }] : []),
  ];
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="support-center-title" onClick={(e) => e.stopPropagation()}
        className="flex h-[min(92svh,760px)] w-full flex-col overflow-hidden rounded-t-[26px] bg-[#F8F9FA] shadow-2xl sm:max-w-[460px] sm:rounded-[26px]">
        <div className="bg-navy px-5 pb-3 pt-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold tracking-[0.16em] text-brand-300">STORAGE MARKET SUPPORT</p>
              <h2 id="support-center-title" className="mt-0.5 text-lg font-black">무엇을 도와드릴까요?</h2>
            </div>
            <button ref={closeBtn} type="button" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="문의하기 닫기"><X className="h-5 w-5" /></button>
          </div>
          <div role="tablist" aria-label="문의 방법" className="mt-3 grid gap-1 rounded-xl bg-white/[0.08] p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={cn("flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition", tab === id ? "bg-brand-300 text-navy" : "text-white/80 hover:bg-white/10")}>
                <Icon aria-hidden="true" className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          {tab === "chat" && <ChatPanel member={member} onHandoff={handoff} />}
          {tab === "inquiry" && <InquiryPanel member={member} prefill={prefill} pagePath={pathname} onMine={() => setTab("mine")} />}
          {tab === "mine" && member && <MinePanel />}
        </div>
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
// 1:1 문의
// ---------------------------------------------------------------------------
function InquiryPanel({ member, prefill, pagePath, onMine }: { member: Member; prefill: { category?: SupportCategory; subject?: string; transcript?: string; source?: "POPUP" | "CHATBOT" }; pagePath: string; onMine: () => void }) {
  const requestId = useRef<string>();
  const [category, setCategory] = useState<SupportCategory | "">(prefill.category && prefill.category !== "OTHER" ? prefill.category : prefill.category ?? "");
  const [subject, setSubject] = useState(prefill.subject ?? "");
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");
  const [refs, setRefs] = useState<{ value: string; label: string }[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [guest, setGuest] = useState({ name: "", email: "", phone: "", agree: false });
  const [withTranscript, setWithTranscript] = useState(!!prefill.transcript);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ id: string; guestToken?: string } | null>(null);

  useEffect(() => {
    if (!member) return;
    fetch("/api/support/context").then((r) => r.json()).then((j) => setRefs(j.data?.refs ?? [])).catch(() => undefined);
  }, [member]);

  async function upload(file: File) {
    if (files.length >= 5) return setError("첨부 이미지는 5장까지 올릴 수 있습니다.");
    setUploading(true); setError("");
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("folder", "misc");
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.error ?? "이미지를 올리지 못했습니다.");
      setFiles((f) => [...f, j.data.url]);
    } catch (e) { setError(e instanceof Error ? e.message : "이미지를 올리지 못했습니다."); }
    finally { setUploading(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    const id = requestId.current ?? crypto.randomUUID();
    const payload = {
      id, category, subject, message, reference: reference || undefined, attachments: files,
      source: prefill.source === "CHATBOT" && withTranscript ? "CHATBOT" : "POPUP",
      chatTranscript: withTranscript ? prefill.transcript : undefined, pagePath,
      ...(member ? {} : { guestName: guest.name, guestEmail: guest.email, guestPhone: guest.phone || undefined, agreePrivacy: guest.agree }),
    };
    const check = supportInquirySchema.safeParse(payload);
    if (!check.success) return setError(check.error.issues[0].message);
    if (!member && (!guest.name.trim() || !guest.email.trim())) return setError("이름과 답변 받을 이메일을 입력해 주세요.");
    if (!member && !guest.agree) return setError("개인정보 수집 · 이용에 동의해 주세요.");
    requestId.current = id;
    setBusy(true);
    try {
      const res = await fetch("/api/support/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(check.data) });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.error ?? "접수에 실패했습니다.");
      setDone(j.data);
      try { sessionStorage.removeItem(STORE); } catch { /* 무시 */ }
    } catch (e2) { setError(e2 instanceof Error ? e2.message : "접수에 실패했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  if (done) {
    const href = done.guestToken ? `/support/guest/${done.guestToken}` : `/support/${done.id}`;
    return (
      <div className="h-full overflow-y-auto p-5">
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <CheckCircle2 className="h-8 w-8 text-emerald-700" />
          <p className="mt-2 text-lg font-extrabold text-navy">문의가 접수되었어요</p>
          <p className="mt-1 break-all text-xs text-slate-600">접수번호 {done.id}</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{done.guestToken ? "답변이 등록되면 입력하신 이메일로 알려 드려요. 아래 링크를 저장해 두면 답변 확인과 추가 문의를 할 수 있어요." : "답변이 등록되면 앱 알림으로 알려 드려요. 평일 기준 24시간 안에 답변드리는 것을 목표로 해요."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={href} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-navy px-4 text-sm font-bold text-white">접수 내역 보기<ArrowRight className="h-4 w-4" /></Link>
            {member && <button type="button" onClick={onMine} className="min-h-11 rounded-xl border px-4 text-sm font-bold text-navy">내 문의 목록</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="h-full overflow-y-auto p-4">
      <fieldset disabled={busy} className="space-y-3">
        {prefill.transcript && (
          <label className="flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-xs text-navy">
            <input type="checkbox" checked={withTranscript} onChange={(e) => setWithTranscript(e.target.checked)} className="mt-0.5" />
            <span><b>챗봇 대화 기록 함께 보내기</b><br />운영팀이 앞의 대화를 보고 바로 이어서 답해요.</span>
          </label>
        )}
        <div>
          <Label htmlFor="sc-category">문의 유형</Label>
          <Select id="sc-category" value={category} onChange={(e) => setCategory(isSupportCategory(e.target.value) ? e.target.value : "")} required>
            <option value="">유형을 선택해 주세요</option>
            {Object.entries(SUPPORT_CATEGORIES).map(([v, item]) => <option key={v} value={v}>{item.label}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="sc-subject">제목</Label>
          <Input id="sc-subject" value={subject} onChange={(e) => setSubject(e.target.value)} minLength={4} maxLength={100} placeholder="어떤 도움이 필요한지 한 줄로" required />
        </div>
        <div>
          <Label htmlFor="sc-ref">관련 예약 · 주문서 번호 <span className="text-xs font-normal text-slate-500">(선택)</span></Label>
          {refs.length > 0 ? (
            <Select id="sc-ref" value={reference} onChange={(e) => setReference(e.target.value)}>
              <option value="">선택 안 함</option>
              {refs.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          ) : <Input id="sc-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} placeholder="예약번호나 주문서 번호" />}
        </div>
        <div>
          <Label htmlFor="sc-message">문의 내용</Label>
          <Textarea id="sc-message" value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-28" minLength={10} maxLength={3000} required
            placeholder={category ? SUPPORT_CATEGORIES[category].hint : "상황을 구체적으로 적어 주세요"} />
          <p className="mt-1 flex justify-between text-[11px] text-slate-500"><span>비밀번호 · 카드번호는 적지 마세요.</span><span className="tabular-nums">{message.length.toLocaleString()} / 3,000</span></p>
        </div>
        {member ? (
          <div>
            <p className="text-sm font-medium text-navy">이미지 첨부 <span className="text-xs font-normal text-slate-500">(선택 · 5장까지)</span></p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {files.map((f) => (
                <span key={f} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f} alt="첨부 이미지" className="h-16 w-16 rounded-xl border object-cover" />
                  <button type="button" onClick={() => setFiles((x) => x.filter((y) => y !== f))} className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-navy text-white" aria-label="첨부 지우기"><X className="h-3.5 w-3.5" /></button>
                </span>
              ))}
              {files.length < 5 && (
                <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-brand-400">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
                </label>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold text-navy">비회원 문의 — 답변은 이메일로 보내 드려요 · <Link href="/login?callbackUrl=%2Fsupport" className="underline">로그인하고 문의</Link></p>
            <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
              <Input aria-label="이름" placeholder="이름" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} maxLength={40} />
              <Input aria-label="연락처 (선택)" placeholder="연락처 (선택)" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} maxLength={30} inputMode="tel" />
            </div>
            <Input aria-label="답변 받을 이메일" type="email" placeholder="답변 받을 이메일" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} maxLength={120} />
            <label className="flex items-start gap-2 text-[11px] leading-5 text-slate-600">
              <input type="checkbox" checked={guest.agree} onChange={(e) => setGuest({ ...guest, agree: e.target.checked })} className="mt-0.5" />
              <span>문의 답변을 위해 이름 · 이메일 · 연락처를 수집하고 답변 후 1년 보관하는 데 동의합니다. (<Link href="/privacy" className="underline">개인정보처리방침</Link>)</span>
            </label>
          </div>
        )}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <Button className="w-full gap-2 rounded-xl"><Send className="h-4 w-4" />{busy ? "접수 중…" : "문의 접수하기"}</Button>
        <p className="text-center text-[11px] text-slate-500">평일 10:00~18:00 순서대로 답변드려요 · <Link href="/support" className="underline">고객센터 전체 보기</Link></p>
      </fieldset>
    </form>
  );
}

// ---------------------------------------------------------------------------
// 내 문의 (회원)
// ---------------------------------------------------------------------------
function MinePanel() {
  const [rows, setRows] = useState<{ id: string; subject: string; category: string; status: SupportStatus; updatedAt: string; messages: number }[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/support/inquiries").then((r) => r.json()).then((j) => (j.ok ? setRows(j.data) : setError(j.error ?? "불러오지 못했습니다."))).catch(() => setError("불러오지 못했습니다."));
  }, []);
  if (error) return <p className="p-5 text-sm text-red-700">{error}</p>;
  if (!rows) return <p className="flex items-center gap-2 p-5 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />불러오는 중…</p>;
  if (!rows.length) return <p className="p-6 text-center text-sm text-slate-500">아직 남긴 문의가 없어요.</p>;
  return (
    <ul className="h-full space-y-2 overflow-y-auto p-4">
      {rows.map((r) => {
        const st = SUPPORT_STATUS[r.status];
        return (
          <li key={r.id}>
            <Link href={`/support/${r.id}`} className="block rounded-2xl border border-[#E8E5DD] bg-white p-3.5 hover:border-brand-300">
              <p className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                <span className={cn("rounded-full px-2 py-0.5", st.tone === "green" ? "bg-emerald-50 text-emerald-700" : st.tone === "yellow" ? "bg-amber-50 text-amber-800" : st.tone === "blue" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600")}>{st.label}</span>
                {r.category}
              </p>
              <p className="mt-1 truncate font-bold text-navy">{r.subject}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{new Date(r.updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" })}{r.messages ? ` · 대화 ${r.messages}개` : ""}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
