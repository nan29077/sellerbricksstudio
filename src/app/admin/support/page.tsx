import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SUPPORT_CATEGORIES, SUPPORT_PRIORITY, SUPPORT_SLA_HOURS, SUPPORT_SOURCE, SUPPORT_STATUS, effectiveStatus, hasUnreadForAdmin, isSupportCategory, isSupportPriority, supportThread,
} from "@/lib/support";
import { formatDateTime } from "@/lib/utils";
import { pageOf, sp, type SP } from "@/lib/list";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Pagination } from "@/components/list/pagination";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { SupportThread } from "@/components/support/support-thread";
import { SupportAdminPanel } from "@/components/support/support-admin-panel";
import { SupportLive, SupportReadMarker } from "@/components/support/support-live";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// 최고관리자 고객 문의 관리 (2026-11-14 고도화)
//  상태(새 문의 · 처리 중 · 답변 완료 · 종료) · 우선순위 · 담당자 · 내부 메모 · 답변 템플릿 · 대화(추가 문의) · 챗봇 대화 기록 · 비회원 문의 · CSV
const TABS = [
  { key: "", label: "전체" }, { key: "OPEN", label: "새 문의" }, { key: "IN_PROGRESS", label: "처리 중" },
  { key: "ANSWERED", label: "답변 완료" }, { key: "CLOSED", label: "종료" }, { key: "overdue", label: `답변 지연(${SUPPORT_SLA_HOURS}시간+)` }, { key: "mine", label: "내 담당" }, { key: "rated", label: "만족도 평가" },
] as const;

export default async function AdminSupportPage({ searchParams }: { searchParams: SP }) {
  const admin = await requireRole(["SUPER_ADMIN"]);
  const account = await prisma.user.findFirst({ where: { id: admin.id, role: "SUPER_ADMIN", isActive: true }, select: { id: true } }).catch(() => null);
  if (!account) return <PageHeader title="고객 문의 관리" description="문의 내역을 보려면 DB에 연결된 최고관리자 계정으로 로그인해 주세요." />;

  const tab = sp(searchParams, "status") ?? "";
  const query = sp(searchParams, "q")?.slice(0, 100) ?? "";
  const category = sp(searchParams, "category");
  const priority = sp(searchParams, "priority");
  const member = sp(searchParams, "member");
  const { page, size } = pageOf(searchParams, 15);
  const slaCut = new Date(Date.now() - SUPPORT_SLA_HOURS * 3600000);
  const open = { OR: [{ status: "OPEN", answeredAt: null }, { status: "IN_PROGRESS" }] } satisfies Prisma.SupportInquiryWhereInput;
  const statusWhere: Prisma.SupportInquiryWhereInput =
    tab === "OPEN" ? { status: "OPEN", OR: [{ answeredAt: null }, { lastUserReplyAt: { not: null } }] }
      : tab === "ANSWERED" ? { OR: [{ status: "ANSWERED" }, { status: "OPEN", answeredAt: { not: null }, lastUserReplyAt: null }] }
      : tab === "IN_PROGRESS" || tab === "CLOSED" ? { status: tab }
      : tab === "overdue" ? { ...open, answeredAt: null, createdAt: { lt: slaCut } }
      : tab === "mine" ? { assigneeId: admin.id, NOT: { status: "CLOSED" } }
      : tab === "rated" ? { rating: { not: null } }
      : {};
  const where: Prisma.SupportInquiryWhereInput = {
    AND: [
      statusWhere,
      isSupportCategory(category) ? { category } : {},
      isSupportPriority(priority) ? { priority } : {},
      member === "guest" ? { userId: null } : member === "member" ? { userId: { not: null } } : {},
      query ? {
        OR: [
          { id: { contains: query, mode: "insensitive" } }, { subject: { contains: query, mode: "insensitive" } }, { reference: { contains: query, mode: "insensitive" } },
          { message: { contains: query, mode: "insensitive" } }, { guestEmail: { contains: query, mode: "insensitive" } }, { guestName: { contains: query, mode: "insensitive" } },
          { user: { email: { contains: query, mode: "insensitive" } } }, { user: { profile: { name: { contains: query, mode: "insensitive" } } } },
        ],
      } : {},
    ],
  };

  const data = await (async () => {
    try {
      const [total, counts, overdue, admins, templates, answeredRows, ratingAgg] = await Promise.all([
        prisma.supportInquiry.count({ where }),
        prisma.supportInquiry.groupBy({ by: ["status"], _count: { id: true } }),
        prisma.supportInquiry.count({ where: { ...open, answeredAt: null, createdAt: { lt: slaCut } } }),
        prisma.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true, email: true, profile: { select: { name: true } } } }),
        prisma.supportTemplate.findMany({ orderBy: { title: "asc" }, take: 100 }),
        prisma.supportInquiry.findMany({ where: { answeredAt: { not: null }, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } }, select: { createdAt: true, answeredAt: true }, take: 1000 }),
        prisma.supportInquiry.aggregate({ where: { rating: { not: null }, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } }, _avg: { rating: true }, _count: { rating: true } }),
      ]);
      const current = Math.min(page, Math.max(1, Math.ceil(total / size)));
      const items = await prisma.supportInquiry.findMany({
        where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: size, skip: (current - 1) * size,
        include: { user: { select: { email: true, role: true, profile: { select: { name: true, phone: true } } } }, messages: { orderBy: { createdAt: "asc" } } },
      });
      const avg = answeredRows.length ? answeredRows.reduce((s, r) => s + (r.answeredAt!.getTime() - r.createdAt.getTime()), 0) / answeredRows.length / 3600000 : null;
      return { total, current, items, counts: Object.fromEntries(counts.map((c) => [c.status, c._count.id])), overdue, admins, templates, avg, rating: ratingAgg._avg.rating, ratingCount: ratingAgg._count.rating };
    } catch { return null; }
  })();

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: tab, q: query, category: category ?? "", priority: priority ?? "", member: member ?? "", ...patch })) if (v) p.set(k, v);
    return `/admin/support${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader title="고객 문의 관리" description="문의하기 팝업의 1:1 상담 · 챗봇 · 고객센터로 들어온 문의를 채팅처럼 이어서 처리합니다. 새 메시지는 빨간 점으로 보이고 화면은 20초마다 자동으로 새로 고쳐져요."
        action={<a href="/api/admin/support/export" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border bg-white px-3 text-sm font-bold text-navy hover:bg-brand-50"><Download className="h-4 w-4" />CSV</a>} />
      {data ? (
        <>
          <SupportLive />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="새 문의" value={data.counts.OPEN ?? 0} href={qs({ status: "OPEN", page: "" })} tone="amber" />
            <Kpi label="처리 중" value={data.counts.IN_PROGRESS ?? 0} href={qs({ status: "IN_PROGRESS" })} tone="blue" />
            <Kpi label={`답변 지연 (${SUPPORT_SLA_HOURS}시간+)`} value={data.overdue} href={qs({ status: "overdue" })} tone="red" />
            <Kpi label="평균 첫 답변 (30일)" value={data.avg == null ? "-" : `${data.avg.toFixed(1)}시간`} tone="green" />
            <Kpi label="상담 만족도 (30일)" value={data.rating == null ? "-" : `★ ${data.rating.toFixed(1)} · ${data.ratingCount}건`} href={qs({ status: "rated" })} tone="amber" />
          </div>
          <nav aria-label="문의 상태" className="-mx-1 flex gap-1 overflow-x-auto px-1">
            {TABS.map((t) => (
              <Link key={t.key} href={qs({ status: t.key })} aria-current={tab === t.key ? "page" : undefined}
                className={cn("inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 text-xs font-bold", tab === t.key ? "border-navy bg-navy text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300")}>{t.label}</Link>
            ))}
          </nav>
          <form action="/admin/support" className="grid grid-cols-2 gap-2 rounded-2xl border bg-white p-4 lg:grid-cols-[1fr_9rem_8rem_8rem_auto]">
            <input type="hidden" name="status" value={tab} />
            <Input className="col-span-2 lg:col-span-1" type="search" name="q" aria-label="문의 검색" defaultValue={query} maxLength={100} placeholder="제목 · 내용 · 접수번호 · 예약/주문번호 · 작성자 · 이메일" />
            <Select name="category" aria-label="문의 유형" defaultValue={isSupportCategory(category) ? category : ""}>
              <option value="">전체 유형</option>
              {Object.entries(SUPPORT_CATEGORIES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
            </Select>
            <Select name="priority" aria-label="우선순위" defaultValue={isSupportPriority(priority) ? priority : ""}>
              <option value="">전체 우선순위</option>
              {Object.entries(SUPPORT_PRIORITY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Select name="member" aria-label="회원 구분" defaultValue={member ?? ""}>
              <option value="">회원 · 비회원</option><option value="member">회원</option><option value="guest">비회원</option>
            </Select>
            <Button className="col-span-2 lg:col-span-1"><Search className="h-4 w-4" />검색</Button>
          </form>
          {data.items.map((item) => {
            const st = effectiveStatus(item);
            const late = !item.answeredAt && st !== "CLOSED" && item.createdAt < slaCut;
            const who = item.user ? `${item.user.profile?.name ?? item.user.email}` : `${item.guestName ?? "비회원"} (비회원)`;
            const unread = st !== "CLOSED" && hasUnreadForAdmin(item);
            return (
              <details key={item.id} open={data.items.length === 1 || undefined} className={cn("group rounded-2xl border bg-white p-4 sm:p-5", late && "border-red-200")}>
                <summary className="cursor-pointer list-none rounded-lg text-sm text-navy marker:hidden">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <SupportReadMarker id={item.id} unread={unread} />
                    {unread && <span className="h-2.5 w-2.5 rounded-full bg-rose-500" title="새 메시지"><span className="sr-only">새 메시지</span></span>}
                    <StatusChip status={st} />
                    {item.priority !== "NORMAL" && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", item.priority === "URGENT" ? "bg-red-600 text-white" : item.priority === "HIGH" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600")}>{SUPPORT_PRIORITY[item.priority as keyof typeof SUPPORT_PRIORITY] ?? item.priority}</span>}
                    {late && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">답변 지연</span>}
                    {item.lastUserReplyAt && st === "OPEN" && item.answeredAt && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">추가 문의</span>}
                    {item.rating && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-800">만족도 ★{item.rating}</span>}
                    {item.source !== "PAGE" && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">{SUPPORT_SOURCE[item.source as keyof typeof SUPPORT_SOURCE] ?? item.source}</span>}
                    <span className="ml-1 font-extrabold">{item.subject}</span>
                  </span>
                  <span className="mt-1.5 block break-words text-xs text-slate-600">
                    {SUPPORT_CATEGORIES[item.category].label} · {who} · {formatDateTime(item.createdAt)}
                    {item.assigneeId && ` · 담당 ${data.admins.find((a) => a.id === item.assigneeId)?.profile?.name ?? "관리자"}`}
                    {item.messages.length > 0 && ` · 대화 ${item.messages.length}`}
                  </span>
                </summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="min-w-0 space-y-3">
                    <SupportThread items={supportThread(item)} viewer="ADMIN" />
                    {item.chatTranscript && (
                      <details className="rounded-xl bg-violet-50/60 p-3 text-xs">
                        <summary className="cursor-pointer font-bold text-violet-800">챗봇 대화 기록 보기</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words font-sans leading-6 text-slate-700">{item.chatTranscript}</pre>
                      </details>
                    )}
                  </div>
                  <div className="space-y-3">
                    <dl className="space-y-1 break-all rounded-xl bg-[#F7F7F4] p-3 text-xs text-slate-600">
                      <div><dt className="mr-2 inline font-bold">접수번호</dt><dd className="inline">{item.id}</dd></div>
                      <div><dt className="mr-2 inline font-bold">이메일</dt><dd className="inline">{item.user?.email ?? item.guestEmail}</dd></div>
                      {(item.user?.profile?.phone || item.guestPhone) && <div><dt className="mr-2 inline font-bold">연락처</dt><dd className="inline">{item.user?.profile?.phone ?? item.guestPhone}</dd></div>}
                      <div><dt className="mr-2 inline font-bold">회원</dt><dd className="inline">{item.user ? item.user.role : "비회원 (이메일로 답변)"}</dd></div>
                      {item.reference && <div><dt className="mr-2 inline font-bold">관련 번호</dt><dd className="inline">{item.reference}</dd></div>}
                      {item.pagePath && <div><dt className="mr-2 inline font-bold">문의한 화면</dt><dd className="inline">{item.pagePath}</dd></div>}
                      {item.answeredAt && <div><dt className="mr-2 inline font-bold">첫 답변</dt><dd className="inline">{formatDateTime(item.answeredAt)}</dd></div>}
                    </dl>
                  </div>
                </div>
                <SupportAdminPanel
                  id={item.id} status={st} priority={item.priority} assigneeId={item.assigneeId} adminMemo={item.adminMemo ?? ""} category={item.category}
                  admins={data.admins.map((a) => ({ id: a.id, name: a.profile?.name ?? a.email }))}
                  templates={data.templates.map((t) => ({ id: t.id, title: t.title, body: t.body, category: t.category }))}
                  guest={!item.user}
                />
              </details>
            );
          })}
          {!data.items.length && <p className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-slate-600">조건에 맞는 문의가 없습니다.</p>}
          <Pagination base="/admin/support" params={searchParams} page={data.current} size={size} total={data.total} />
        </>
      ) : (
        <p role="status" className="rounded-xl border bg-white p-5 text-sm text-slate-600">문의 내역을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>
      )}
    </div>
  );
}

function Kpi({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone: "amber" | "blue" | "red" | "green" }) {
  const cls = { amber: "hover:bg-amber-50", blue: "hover:bg-blue-50", red: "hover:bg-red-50", green: "" }[tone];
  const body = <><span className="block text-xs font-bold text-slate-600">{label}</span><strong className="mt-1 block text-2xl text-navy">{typeof value === "number" ? value.toLocaleString() : value}</strong></>;
  return href ? <Link href={href} className={cn("rounded-2xl border bg-white p-4", cls)}>{body}</Link> : <div className="rounded-2xl border bg-white p-4">{body}</div>;
}

function StatusChip({ status }: { status: keyof typeof SUPPORT_STATUS }) {
  const s = SUPPORT_STATUS[status];
  const cls = s.tone === "yellow" ? "bg-amber-100 text-amber-900" : s.tone === "blue" ? "bg-blue-100 text-blue-800" : s.tone === "green" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600";
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", cls)}>{s.label}</span>;
}
