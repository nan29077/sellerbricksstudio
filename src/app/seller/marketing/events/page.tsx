import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Kpi } from "@/components/list/charts";
import { StatusTabs } from "@/components/list/status-tabs";
import { ResourceForm, DeleteButton, PatchButton, type Field } from "@/components/resource-form";
import { discountLabel, periodStatus } from "@/lib/marketing-labels";
import { formatDate, formatKRW } from "@/lib/utils";
import { toKstInput } from "@/lib/kst";
import { sp, type SP } from "@/lib/list";
import { Megaphone, PlayCircle, Target, TrendingUp, Copy } from "lucide-react";

export const dynamic = "force-dynamic";
const API = "/api/seller/marketing/promotions";

const fields: Field[] = [
  { name: "title", label: "이벤트명", required: true, placeholder: "예: 블랙프라이데이 라이브 특가" },
  { name: "description", label: "내용", type: "textarea", placeholder: "혜택, 대상 상품, 참여 방법" },
  { name: "channel", label: "진행 채널", placeholder: "유튜브 라이브, 인스타그램 등", half: true },
  { name: "discountType", label: "혜택 방식", type: "select", options: [{ value: "PERCENT", label: "정률 할인(%)" }, { value: "FIXED", label: "정액 할인(원)" }], half: true },
  { name: "discountValue", label: "할인 값", type: "number", min: 0, half: true },
  { name: "targetAmount", label: "목표 매출(원)", type: "number", min: 0, half: true },
  { name: "startAt", label: "시작", type: "datetime", required: true, half: true },
  { name: "endAt", label: "종료", type: "datetime", required: true, half: true },
  { name: "resultAmount", label: "실제 매출(원)", type: "number", min: 0, half: true, help: "종료 후 입력하면 달성률이 계산됩니다." },
  { name: "isPublished", label: "공개 (끄면 임시저장)", type: "checkbox" },
];

export default async function SellerEvents({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SELLER"]);
  const filter = sp(searchParams, "status");
  const all = await prisma.sellerPromotion.findMany({ where: { sellerId: user.id }, orderBy: { startAt: "desc" } });
  const withSt = all.map((p) => ({ ...p, st: p.isPublished ? periodStatus(p.startAt, p.endAt) : { key: "DRAFT" as const, label: "임시저장", tone: "gray" as const } }));
  const rows = filter ? withSt.filter((p) => p.st.key === filter) : withSt;
  const count = (k: string) => withSt.filter((p) => p.st.key === k).length;
  const ended = withSt.filter((p) => p.st.key === "ENDED" && p.targetAmount && p.resultAmount !== null);
  const avgRate = ended.length ? Math.round(ended.reduce((s, p) => s + (p.resultAmount! / p.targetAmount!) * 100, 0) / ended.length) : null;
  const totalResult = withSt.reduce((s, p) => s + (p.resultAmount ?? 0), 0);
  const now = new Date();
  const defaultStart = toKstInput(now).slice(0, 11) + "20:00";
  const defaultEnd = toKstInput(new Date(now.getTime() + 7 * 86400000)).slice(0, 11) + "23:59";

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="이벤트 · 프로모션" description="라이브 특가, 기획전 일정과 목표 대비 성과를 관리합니다."
        action={<ResourceForm url={API} fields={fields} title="이벤트 만들기" initial={{ startAt: defaultStart, endAt: defaultEnd, isPublished: true, discountType: "PERCENT" }} />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="진행 중" value={`${count("ACTIVE")}건`} icon={PlayCircle} tone="green" />
        <Kpi label="예정" value={`${count("UPCOMING")}건`} icon={Megaphone} tone="blue" />
        <Kpi label="평균 목표 달성률" value={avgRate === null ? "-" : `${avgRate}%`} sub={`종료 ${ended.length}건 기준`} icon={Target} tone="brand" />
        <Kpi label="이벤트 누적 매출" value={formatKRW(totalResult)} icon={TrendingUp} tone="navy" />
      </div>

      <StatusTabs base="/seller/marketing/events" params={searchParams} tabs={[
        { value: "", label: "전체", count: withSt.length }, { value: "ACTIVE", label: "진행중", count: count("ACTIVE") },
        { value: "UPCOMING", label: "예정", count: count("UPCOMING") }, { value: "ENDED", label: "종료", count: count("ENDED") },
        { value: "DRAFT", label: "임시저장", count: count("DRAFT") },
      ]} />

      {rows.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-10 w-10" />} title="이벤트가 없습니다" description="라이브 방송과 함께 진행할 특가·기획전을 등록해 보세요." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((p) => {
            const rate = p.targetAmount && p.resultAmount !== null ? Math.round((p.resultAmount / p.targetAmount) * 100) : null;
            const total = p.endAt.getTime() - p.startAt.getTime();
            const elapsed = Math.min(100, Math.max(0, ((now.getTime() - p.startAt.getTime()) / total) * 100));
            return (
              <Card key={p.id}>
                <CardContent className="space-y-3 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><Badge tone={p.st.tone}>{p.st.label}</Badge>{p.channel && <Badge tone="gray">{p.channel}</Badge>}<Badge tone="red">{discountLabel(p.discountType, p.discountValue)} 할인</Badge></div>
                      <p className="mt-1.5 truncate text-base font-extrabold text-navy">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(p.startAt)} ~ {formatDate(p.endAt)}</p>
                    </div>
                    <div className="flex shrink-0">
                      <ResourceForm url={API} id={p.id} fields={fields} title="이벤트 수정" iconOnly triggerVariant="ghost" initial={{ ...p, startAt: toKstInput(p.startAt), endAt: toKstInput(p.endAt), targetAmount: p.targetAmount ?? "", resultAmount: p.resultAmount ?? "" }} />
                      <ResourceForm url={API} fields={fields} title="복제해서 새로 만들기" iconOnly triggerVariant="ghost" initial={{ ...p, title: `${p.title} (복사)`, startAt: defaultStart, endAt: defaultEnd, resultAmount: "", targetAmount: p.targetAmount ?? "" }} />
                      <DeleteButton url={`${API}/${p.id}`} />
                    </div>
                  </div>
                  {p.description && <p className="line-clamp-3 whitespace-pre-line text-sm text-slate-600">{p.description}</p>}
                  {p.st.key === "ACTIVE" && (
                    <div><div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>기간 경과</span><span>{Math.round(elapsed)}%</span></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${elapsed}%` }} /></div></div>
                  )}
                  {p.targetAmount ? (
                    <div className="rounded-xl bg-muted/50 p-3 text-xs">
                      <div className="flex justify-between"><span>목표 {formatKRW(p.targetAmount)}</span><span className="font-bold text-navy">{p.resultAmount !== null ? `실적 ${formatKRW(p.resultAmount)}` : "실적 미입력"}</span></div>
                      {rate !== null && <div className="mt-1.5 h-2 rounded-full bg-white"><div className={`h-full rounded-full ${rate >= 100 ? "bg-emerald-500" : "bg-brand-500"}`} style={{ width: `${Math.min(100, rate)}%` }} /></div>}
                      {rate !== null && <p className="mt-1 text-right font-bold text-navy">달성률 {rate}%</p>}
                    </div>
                  ) : null}
                  {!p.isPublished && <PatchButton url={`${API}/${p.id}`} body={{ isPublished: true }} variant="outline"><Copy className="h-3.5 w-3.5" />공개로 전환</PatchButton>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
