import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { managerFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Kpi } from "@/components/list/charts";
import { CsvButton } from "@/components/list/csv-button";
import { formatDate, formatKRW } from "@/lib/utils";
import { addDays, addMonths, kstStartOfMonth } from "@/lib/kst";
import { growth } from "@/lib/list";
import { Building2, Star, AlertTriangle, Wallet, ExternalLink } from "lucide-react";
import { facilityTypeLabel, facilityTypeTone, FACILITY_OPERATION_LABEL } from "@/lib/status";

export const dynamic = "force-dynamic";
const STATUS: Record<string, { label: string; tone: "yellow" | "green" | "red" }> = {
  PENDING: { label: "비공개(준비 중)", tone: "yellow" }, APPROVED: { label: "공개", tone: "green" }, SUSPENDED: { label: "운영 정지", tone: "red" },
};

export default async function ManagerFacilities() {
  const user = await requireRole(["MANAGER"]);
  const ids = await managerFacilityIds(user.id);
  if (ids.length === 0) return (
    <div><PageHeader title="담당 창고(스튜디오)" /><EmptyState icon={<Building2 className="h-10 w-10" />} title="배정된 창고(스튜디오)가 없습니다" description="최고관리자가 담당 창고(스튜디오)를 배정하면 여기에 표시됩니다." /></div>
  );
  const m = kstStartOfMonth(new Date()), pm = addMonths(m, -1);
  const [facilities, thisM, lastM, pending, recentLast] = await Promise.all([
    prisma.facility.findMany({ where: { id: { in: ids } }, include: { _count: { select: { bookings: true, reviews: true, slots: true } } } }),
    // 창고 이용료는 없다 — 실적은 창고 방송 주문(판매액) 기준
    prisma.order.groupBy({ by: ["facilityId"], where: { facilityId: { in: ids }, status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] }, createdAt: { gte: m, lt: addMonths(m, 1) } }, _sum: { totalAmount: true }, _count: true }),
    prisma.order.groupBy({ by: ["facilityId"], where: { facilityId: { in: ids }, status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] }, createdAt: { gte: pm, lt: m } }, _sum: { totalAmount: true } }),
    prisma.booking.groupBy({ by: ["facilityId"], where: { facilityId: { in: ids }, status: "PENDING" }, _count: true }),
    prisma.booking.groupBy({ by: ["facilityId"], where: { facilityId: { in: ids } }, _max: { createdAt: true } }),
  ]);
  const t = new Map(thisM.map((x) => [x.facilityId ?? "", x])), l = new Map(lastM.map((x) => [x.facilityId ?? "", x._sum.totalAmount ?? 0]));
  const p = new Map(pending.map((x) => [x.facilityId, x._count])), last = new Map(recentLast.map((x) => [x.facilityId, x._max.createdAt]));
  const staleCut = addDays(new Date(), -30);
  const rows = facilities.map((f) => {
    const rev = t.get(f.id)?._sum.totalAmount ?? 0;
    const issues = [
      f.status !== "APPROVED" && STATUS[f.status].label,
      f.operationType === "PARTNER" && !f.bankAccount && "제휴 지급 계좌 미등록", !f.cancelPolicy && "취소 규정 없음", f._count.slots === 0 && "운영 시간대 미설정",
      (!last.get(f.id) || last.get(f.id)! < staleCut) && "30일간 신규 예약 없음", (p.get(f.id) ?? 0) > 0 && `승인 대기 ${p.get(f.id)}건`,
    ].filter(Boolean) as string[];
    return { f, rev, cnt: t.get(f.id)?._count ?? 0, delta: growth(rev, l.get(f.id) ?? 0), issues };
  }).sort((a, b) => b.rev - a.rev);
  const totalRev = rows.reduce((s, r) => s + r.rev, 0);
  const totalLast = Array.from(l.values()).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="담당 창고(스튜디오)" description="운영을 맡은 창고(스튜디오)의 상태와 이번 달 판매 실적, 챙겨야 할 점입니다. 예약 승인 · 일정 · 상품 · 출고는 창고 운영 콘솔에서 합니다."
        action={<Link href="/facility/dashboard" className="inline-flex h-10 items-center rounded-lg bg-navy px-4 text-sm font-semibold text-white">창고 운영 콘솔</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="담당" value={`${rows.length}곳`} sub={`운영중 ${rows.filter((r) => r.f.status === "APPROVED").length}곳`} icon={Building2} tone="navy" />
        <Kpi label="이번 달 판매액" value={formatKRW(totalRev)} delta={growth(totalRev, totalLast)} sub="지난달 대비" icon={Wallet} tone="green" />
        <Kpi label="평균 평점" value={`★ ${(rows.reduce((s, r) => s + r.f.rating, 0) / rows.length).toFixed(1)}`} icon={Star} tone="brand" />
        <Kpi label="관리 필요" value={`${rows.filter((r) => r.issues.length).length}곳`} icon={AlertTriangle} tone="red" />
      </div>
      <div className="flex justify-end">
        <CsvButton label="CSV" filename="담당창고" headers={["이름", "상태", "운영 형태", "지역", "제휴 담당자", "연락처", "평점", "이번달 주문", "이번달 판매액", "점검사항"]}
          rows={rows.map((r) => [r.f.name, STATUS[r.f.status].label, FACILITY_OPERATION_LABEL[r.f.operationType], r.f.region, r.f.partnerContactName ?? "", r.f.partnerContactPhone ?? r.f.contactPhone ?? "", r.f.rating, r.cnt, r.rev, r.issues.join(" / ")])} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map(({ f, rev, cnt, delta, issues }) => (
          <Card key={f.id}>
            <CardContent className="space-y-2 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS[f.status].tone}>{STATUS[f.status].label}</Badge>
                <Badge tone={facilityTypeTone(f.type)}>{facilityTypeLabel(f.type)}</Badge>
                <span className="ml-auto text-[11px] text-muted-foreground">등록 {formatDate(f.createdAt)}</span>
              </div>
              <Link href={`/facilities/${f.id}`} target="_blank" className="flex items-center gap-1 text-base font-bold text-navy hover:underline">{f.name}<ExternalLink className="h-3.5 w-3.5 text-slate-400" /></Link>
              <p className="text-xs text-slate-500">{f.region} · {FACILITY_OPERATION_LABEL[f.operationType]}{f.operationType === "PARTNER" ? ` · ${f.partnerName ?? "제휴 업체"} 담당 ${f.partnerContactName ?? "-"}${f.partnerContactPhone ? ` (${f.partnerContactPhone})` : ""}` : ""}</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[["평점", `★${f.rating.toFixed(1)}`], ["대기 예약", `${p.get(f.id) ?? 0}건`], ["이번 달 주문", `${cnt}건`], ["판매액", formatKRW(rev)]].map(([a, b]) => (
                  <div key={a} className="rounded-lg bg-muted/50 p-2"><p className="text-[11px] text-slate-500">{a}</p><p className="truncate text-xs font-bold text-navy">{b}</p></div>
                ))}
              </div>
              {delta !== null && <p className={`text-xs font-semibold ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>지난달 대비 {delta >= 0 ? "+" : ""}{delta}%</p>}
              {issues.length > 0 && <div className="flex flex-wrap gap-1">{issues.map((i) => <span key={i} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{i}</span>)}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
