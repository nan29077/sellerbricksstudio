"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportCategory } from "@prisma/client";
import { ArrowRight, CheckCircle2, ChevronDown, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { SUPPORT_CATEGORIES, isSupportCategory, linkAllowed, supportFaq, supportInquirySchema } from "@/lib/support";

export function SupportFaq({ role }: { role?: string | null }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const term = query.trim().toLowerCase();
  const results = supportFaq.filter((item) =>
    (!category || item.category === category) &&
    [item.question, item.answer, SUPPORT_CATEGORIES[item.category].label].join(" ").toLowerCase().includes(term),
  );

  return (
    <section id="faq" className="scroll-mt-20 rounded-[24px] border bg-white p-4 sm:p-6">
      <h2 className="text-xl font-extrabold text-navy">자주 묻는 질문</h2>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
          <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" aria-label="자주 묻는 질문 검색" placeholder="질문 검색" />
        </div>
        <Select aria-label="질문 유형" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">전체 유형</option>
          {Object.entries(SUPPORT_CATEGORIES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </Select>
      </div>
      <div className="mt-4 divide-y divide-slate-100">
        {results.map((item) => (
          <details key={item.question} className="group py-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 py-2 text-sm font-bold text-navy marker:hidden">
              <span>{item.question}</span><ChevronDown className="h-4 w-4 shrink-0 text-brand-700 group-open:rotate-180" />
            </summary>
            <p className="text-sm leading-6 text-slate-600">{item.answer}</p>
            {linkAllowed(item.href, role) && <Link href={item.href} className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-brand-700 hover:text-navy">{item.link}<ArrowRight className="h-4 w-4" /></Link>}
          </details>
        ))}
        {!results.length && <p role="status" className="py-4 text-sm text-slate-600">검색 결과가 없습니다. 다른 검색어를 입력하거나 1:1 문의를 남겨 주세요.</p>}
      </div>
    </section>
  );
}

export function SupportInquiryForm() {
  const router = useRouter();
  const requestId = useRef<string>();
  const submitting = useRef(false);
  const [category, setCategory] = useState<SupportCategory | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receivedId, setReceivedId] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    const fields = new FormData(event.currentTarget);
    const id = requestId.current ?? crypto.randomUUID();
    const input = supportInquirySchema.safeParse({ id, category, subject: fields.get("subject"), message, reference: fields.get("reference") });
    if (!input.success) {
      setError(input.error.issues[0].message);
      return;
    }
    requestId.current = id;
    submitting.current = true;
    setBusy(true);
    try {
      const result = await api<{ id: string }>("/api/support/inquiries", "POST", input.data);
      setReceivedId(result.id);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "접수에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (receivedId) {
    return (
      <div role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <CheckCircle2 className="h-7 w-7 text-emerald-700" />
        <p className="mt-2 font-extrabold text-navy">문의가 접수되었습니다.</p>
        <p className="mt-1 break-all text-xs text-slate-600">접수번호 {receivedId}</p>
        <p className="mt-2 text-sm text-slate-700">운영팀이 답변하면 앱 알림으로 알려드려요.</p>
        <Link href={`/support/${receivedId}`} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-emerald-800">접수 내역 보기<ArrowRight className="h-4 w-4" /></Link>
        <button type="button" className="ml-4 text-sm font-bold text-slate-700 underline underline-offset-4" onClick={() => {
          requestId.current = undefined;
          setCategory("");
          setMessage("");
          setReceivedId("");
        }}>새 문의 작성</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5">
      <fieldset disabled={busy} className="space-y-4">
        <div>
          <Label htmlFor="support-category">문의 유형</Label>
          <Select id="support-category" value={category} onChange={(event) => {
            const value = event.target.value;
            setCategory(isSupportCategory(value) ? value : "");
          }} required>
            <option value="">유형을 선택해 주세요</option>
            {Object.entries(SUPPORT_CATEGORIES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="support-subject">제목</Label>
          <Input id="support-subject" name="subject" placeholder="어떤 도움이 필요한지 한 줄로 알려주세요" minLength={4} maxLength={100} required />
        </div>
        <div>
          <Label htmlFor="support-reference">주문·예약번호 <span className="text-xs font-normal text-slate-500">(선택)</span></Label>
          <Input id="support-reference" name="reference" placeholder="관련 번호가 있으면 적어주세요" maxLength={100} />
        </div>
        <div>
          <Label htmlFor="support-message">문의 내용</Label>
          <Textarea id="support-message" value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-32" aria-describedby="support-message-hint" placeholder={category ? SUPPORT_CATEGORIES[category].hint : "문의 내용을 구체적으로 적어주세요"} minLength={10} maxLength={3000} required />
          <div className="mt-1 flex justify-between gap-3 text-xs leading-5 text-slate-600">
            <span id="support-message-hint">비밀번호와 카드번호는 입력하지 마세요.</span>
            <span className="shrink-0 tabular-nums">{message.length.toLocaleString()} / 3,000</span>
          </div>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <Button className="w-full gap-2 rounded-xl bg-navy text-white hover:bg-navy-700"><Send className="h-4 w-4" />{busy ? "접수 중…" : "문의 접수하기"}</Button>
      </fieldset>
    </form>
  );
}
