import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Kpi } from "@/components/list/charts";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { ResourceForm, DeleteButton, PatchButton, type Field } from "@/components/resource-form";
import { PLATFORMS, PLATFORM_OPTIONS, POST_STATUS, APPLICATION_STATUS, APPLICATION_TYPES } from "@/lib/marketing-labels";
import { formatDate, formatDateTime, formatKRW } from "@/lib/utils";
import { addMonths, kstStartOfMonth, parseMonth, toKstInput } from "@/lib/kst";
import { sp, type SP } from "@/lib/list";
import { Users, CalendarClock, Send, Megaphone, ExternalLink, Share2 } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/seller/marketing";
const API = "/api/seller/marketing";

const accountFields: Field[] = [
  { name: "platform", label: "플랫폼", type: "select", options: PLATFORM_OPTIONS, half: true },
  { name: "handle", label: "계정명 / 채널명", required: true, half: true, placeholder: "@my_live" },
  { name: "url", label: "채널 링크", type: "url", placeholder: "https://" },
  { name: "followers", label: "팔로워 · 구독자 수", type: "number", min: 0, help: "주기적으로 갱신하면 마케팅 분석에서 추이를 볼 수 있어요." },
];
const postFields: Field[] = [
  { name: "platform", label: "플랫폼", type: "select", options: PLATFORM_OPTIONS, half: true },
  { name: "scheduledAt", label: "게시 일시", type: "datetime", required: true, half: true },
  { name: "title", label: "콘텐츠 제목", required: true, placeholder: "예: 금요일 라이브 예고 숏폼" },
  { name: "memo", label: "기획 메모", type: "textarea" },
  { name: "status", label: "상태", type: "select", options: Object.entries(POST_STATUS).map(([value, v]) => ({ value, label: v.label })), half: true },
  { name: "url", label: "게시물 링크", type: "url", half: true },
  { name: "views", label: "조회수", type: "number", half: true, min: 0 },
  { name: "likes", label: "좋아요", type: "number", half: true, min: 0 },
  { name: "comments", label: "댓글", type: "number", half: true, min: 0 },
  { name: "clicks", label: "링크 클릭", type: "number", half: true, min: 0 },
];
const applicationFields: Field[] = [
  { name: "type", label: "지원 유형", type: "select", options: Object.entries(APPLICATION_TYPES).map(([value, label]) => ({ value, label })), half: true },
  { name: "budget", label: "희망 예산(원)", type: "number", half: true, min: 0 },
  { name: "title", label: "제목", required: true, placeholder: "예: 12월 겨울 신상 라이브 홍보" },
  { name: "content", label: "신청 내용", type: "textarea", required: true, placeholder: "판매 상품, 방송 일정, 원하는 지원 내용을 적어주세요. (10자 이상)" },
  { name: "desiredAt", label: "희망 진행일", type: "date", half: true },
];

export default async function SellerSnsMarketing({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SELLER"]);
  const month = parseMonth(sp(searchParams, "month"));
  const thisMonth = kstStartOfMonth(new Date());

  const [accounts, posts, upcoming, postedThisMonth, apps] = await Promise.all([
    prisma.snsAccount.findMany({ where: { sellerId: user.id }, orderBy: { followers: "desc" } }),
    prisma.snsPost.findMany({ where: { sellerId: user.id, scheduledAt: { gte: month, lt: addMonths(month, 1) } }, orderBy: { scheduledAt: "asc" } }),
    prisma.snsPost.findMany({ where: { sellerId: user.id, status: "PLANNED", scheduledAt: { gte: new Date(Date.now() - 86400000) } }, orderBy: { scheduledAt: "asc" }, take: 8 }),
    prisma.snsPost.count({ where: { sellerId: user.id, status: "POSTED", scheduledAt: { gte: thisMonth, lt: addMonths(thisMonth, 1) } } }),
    prisma.marketingApplication.findMany({ where: { sellerId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const totalFollowers = accounts.reduce((s, a) => s + a.followers, 0);
  const openApps = apps.filter((a) => ["PENDING", "IN_REVIEW", "APPROVED"].includes(a.status)).length;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="SNS 마케팅" description="채널 현황, 콘텐츠 게시 일정, 스토리지마켓 마케팅 지원 신청을 한 곳에서 관리합니다." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="총 팔로워" value={totalFollowers.toLocaleString()} sub={`${accounts.length}개 채널`} icon={Users} tone="brand" />
        <Kpi label="이번 달 게시" value={`${postedThisMonth}건`} icon={Send} tone="green" />
        <Kpi label="게시 예정" value={`${upcoming.length}건`} sub={upcoming[0] ? `다음: ${formatDateTime(upcoming[0].scheduledAt)}` : undefined} icon={CalendarClock} tone="blue" />
        <Kpi label="진행 중 지원 신청" value={`${openApps}건`} icon={Megaphone} tone="purple" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><Share2 className="h-4 w-4 text-brand-500" />내 SNS 채널</CardTitle>
          <ResourceForm url={`${API}/sns-accounts`} fields={accountFields} title="채널 등록" triggerSize="sm" />
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">운영 중인 SNS 채널을 등록하면 팔로워 합계와 채널별 비중을 볼 수 있어요.</p> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {accounts.map((a) => (
                <div key={a.id} className={`rounded-2xl border p-4 ${PLATFORMS[a.platform]?.color ?? ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold">{PLATFORMS[a.platform]?.label ?? a.platform}</p>
                      <p className="truncate text-base font-extrabold text-navy">{a.handle}</p>
                    </div>
                    <div className="flex shrink-0">
                      <ResourceForm url={`${API}/sns-accounts`} id={a.id} fields={accountFields} title="채널 수정" iconOnly triggerVariant="ghost" initial={a} />
                      <DeleteButton url={`${API}/sns-accounts/${a.id}`} />
                    </div>
                  </div>
                  <p className="mt-2 text-2xl font-extrabold text-navy">{a.followers.toLocaleString()}<span className="ml-1 text-xs font-medium text-slate-500">팔로워 · {totalFollowers ? Math.round((a.followers / totalFollowers) * 100) : 0}%</span></p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>갱신 {formatDate(a.updatedAt)}</span>
                    {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-navy hover:underline">채널 열기<ExternalLink className="h-3 w-3" /></a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-navy">콘텐츠 캘린더</h2>
            <ResourceForm url={`${API}/sns-posts`} fields={postFields} title="콘텐츠 일정 추가" triggerSize="sm" initial={{ scheduledAt: toKstInput(new Date(Date.now() + 86400000)).slice(0, 11) + "19:00" }} />
          </div>
          <MonthCalendar month={month} base={BASE} params={searchParams}
            events={posts.map((p) => ({ id: p.id, start: p.scheduledAt, end: p.scheduledAt, label: `[${PLATFORMS[p.platform]?.label ?? p.platform}] ${p.title}`, tone: p.status === "POSTED" ? "green" : p.status === "CANCELLED" ? "gray" : "blue" }))} />
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">다가오는 게시 일정</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">예정된 콘텐츠가 없습니다.</p> : upcoming.map((p) => (
              <div key={p.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2"><Badge tone="blue">{PLATFORMS[p.platform]?.label}</Badge><span className="text-[11px] text-muted-foreground">{formatDateTime(p.scheduledAt)}</span></div>
                <p className="mt-1 text-sm font-semibold text-navy">{p.title}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <PatchButton url={`${API}/sns-posts/${p.id}`} body={{ status: "POSTED" }} variant="success" className="h-8 px-2.5 text-xs">게시 완료</PatchButton>
                  <ResourceForm url={`${API}/sns-posts`} id={p.id} fields={postFields} title="콘텐츠 수정" iconOnly triggerVariant="ghost" initial={{ ...p, scheduledAt: toKstInput(p.scheduledAt) }} />
                  <DeleteButton url={`${API}/sns-posts/${p.id}`} />
                </div>
              </div>
            ))}
            {posts.filter((p) => p.status === "POSTED").length > 0 && (
              <div className="border-t pt-3">
                <p className="mb-2 text-xs font-bold text-slate-500">이 달 게시 완료 · 성과 입력</p>
                {posts.filter((p) => p.status === "POSTED").slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 py-1 text-xs">
                    <span className="truncate">{p.title}</span>
                    <span className="flex shrink-0 items-center gap-1 text-slate-500">👁 {(p.views ?? 0).toLocaleString()} ♥ {(p.likes ?? 0).toLocaleString()}
                      <ResourceForm url={`${API}/sns-posts`} id={p.id} fields={postFields} title="성과 입력" iconOnly triggerVariant="ghost" initial={{ ...p, scheduledAt: toKstInput(p.scheduledAt) }} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4 text-brand-500" />마케팅 지원 신청</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">스토리지마켓 운영팀이 SNS 광고 · 콘텐츠 제작 · 인플루언서 연결을 지원합니다.</p>
          </div>
          <ResourceForm url={`${API}/applications`} fields={applicationFields} title="지원 신청" triggerSize="sm" successMessage="신청이 접수되었습니다. 검토 결과는 알림으로 알려드려요." />
        </CardHeader>
        <CardContent>
          {apps.length === 0 ? <EmptyState className="py-10" title="신청 내역이 없습니다" description="라이브 홍보가 필요하면 지원을 신청해 보세요." /> : (
            <div className="space-y-2">
              {apps.map((a) => {
                const st = APPLICATION_STATUS[a.status] ?? { label: a.status, tone: "gray" as const };
                return (
                  <div key={a.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <Badge tone="gray">{APPLICATION_TYPES[a.type] ?? a.type}</Badge>
                      <span className="text-sm font-bold text-navy">{a.title}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(a.createdAt)}{a.budget ? ` · 예산 ${formatKRW(a.budget)}` : ""}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-slate-600">{a.content}</p>
                    {a.adminNote && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800"><b>운영팀 답변</b> · {a.adminNote}</p>}
                    {a.status === "PENDING" && (
                      <div className="mt-2 flex gap-1">
                        <ResourceForm url={`${API}/applications`} id={a.id} fields={applicationFields} title="신청 수정" iconOnly triggerVariant="ghost" initial={{ ...a, desiredAt: toKstInput(a.desiredAt, true) }} />
                        <DeleteButton url={`${API}/applications/${a.id}`} confirmText="신청을 철회할까요?" label="철회" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
