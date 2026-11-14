import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Kpi } from "@/components/list/charts";
import { ManagerCommissionEditor } from "@/components/manager-commission-editor";
import { FacilityAssign } from "@/components/admin/facility-assign";
import { RegisterManagerButton } from "../users/RegisterManagerModal";
import { calcManagerCommission, managerFeeRows } from "@/lib/manager-commission";
import { formatDateTime, formatKRW } from "@/lib/utils";
import { addMonths, kstStartOfMonth } from "@/lib/kst";
import { Users, Building2, DollarSign, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminManagers() {
  await requireRole(["SUPER_ADMIN"]);
  const mStart = kstStartOfMonth(new Date());
  const [managers, facilities, links] = await Promise.all([
    prisma.user.findMany({
      where: { role: "MANAGER" }, orderBy: { createdAt: "asc" },
      include: { profile: true, managerCommission: true, managedFacilities: { include: { facility: { select: { id: true, name: true, status: true } } } } },
    }),
    prisma.facility.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, region: true } }),
    prisma.managerFacility.findMany({ include: { manager: { select: { profile: { select: { name: true } }, email: true } } } }),
  ]);
  const allFacIds = Array.from(new Set(managers.flatMap((m) => m.managedFacilities.map((x) => x.facilityId))));
  const [monthAgg, totalAgg, fees] = await Promise.all([
    prisma.booking.groupBy({ by: ["facilityId"], where: { facilityId: { in: allFacIds }, status: "COMPLETED", startAt: { gte: mStart, lt: addMonths(mStart, 1) } }, _sum: { totalPrice: true }, _count: true }),
    prisma.booking.groupBy({ by: ["facilityId"], where: { facilityId: { in: allFacIds }, status: "COMPLETED" }, _sum: { totalPrice: true }, _count: true }),
    managerFeeRows(allFacIds), // 배송 완료 주문의 플랫폼 판매 수수료 (정률 수수료 기준)
  ]);
  const mEnd = addMonths(mStart, 1);
  const sumFor = (ids: string[], agg: typeof monthAgg, monthOnly: boolean) => ({
    n: agg.filter((a) => ids.includes(a.facilityId)).reduce((s, a) => s + a._count, 0),
    rev: fees.filter((f) => ids.includes(f.facilityId) && (!monthOnly || (f.at >= mStart && f.at < mEnd))).reduce((s, f) => s + f.fee, 0),
  });

  const rows = managers.map((m) => {
    const ids = m.managedFacilities.map((x) => x.facilityId);
    const mo = sumFor(ids, monthAgg, true), tot = sumFor(ids, totalAgg, false);
    const rule = m.managerCommission[0] ?? null;
    return { m, rule, ids, mo, tot, monthCommission: calcManagerCommission(rule, mo.rev, mo.n), totalCommission: calcManagerCommission(rule, tot.rev, tot.n) };
  });
  const takenBy = new Map<string, string>();
  for (const l of links) takenBy.set(l.facilityId, [takenBy.get(l.facilityId), l.manager.profile?.name ?? l.manager.email].filter(Boolean).join(", "));
  const unassigned = facilities.filter((f) => !takenBy.has(f.id)).length;

  return (
    <div className="space-y-5">
      <PageHeader title="창고 운영 매니저" description="본사 직원 계정을 만들고 담당 창고(스튜디오)를 지정합니다. 매니저는 담당 창고만 운영(예약 승인 · 일정 · 상품 · 출고 · 문의)할 수 있습니다. 수수료(판매 수수료의 % 또는 이용 완료 건당 정액)도 설정할 수 있습니다." action={<RegisterManagerButton />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="창고 운영 매니저" value={`${managers.length}명`} sub={`활성 ${managers.filter((m) => m.isActive).length}명`} icon={Users} tone="navy" />
        <Kpi label="배정된 창고(스튜디오)" value={`${allFacIds.length}곳`} sub={`미배정 ${unassigned}곳`} icon={Building2} tone="brand" />
        <Kpi label="이번 달 수수료 합계" value={formatKRW(rows.reduce((s, r) => s + r.monthCommission, 0))} icon={DollarSign} tone="green" />
        <Kpi label="누적 수수료 합계" value={formatKRW(rows.reduce((s, r) => s + r.totalCommission, 0))} icon={TrendingUp} tone="blue" />
      </div>
      <p className="rounded-xl border border-[#E9E5DC] bg-white px-4 py-3 text-xs text-slate-600">수수료 계산: <b>정률</b> = 담당 창고(스튜디오) 방송의 배송 완료 주문에서 플랫폼이 받은 판매 수수료 × % (창고 이용료는 무료), <b>정액</b> = 이용 완료 1건당 금액</p>
      {rows.length === 0 ? <EmptyState icon={<Users className="h-10 w-10" />} title="창고 운영 매니저가 없습니다" description="오른쪽 위 버튼으로 매니저 계정을 만들 수 있습니다. 매니저가 없어도 최고관리자가 모든 창고를 운영합니다." /> : (
        <div className="space-y-3">
          {rows.map(({ m, rule, ids, mo, tot, monthCommission, totalCommission }) => (
            <Card key={m.id}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-bold text-navy">{m.profile?.name ?? m.email}</p>
                      <Badge tone="blue">{rule ? (rule.commissionType === "PERCENT" ? `${rule.commissionValue}%` : `${formatKRW(rule.commissionValue)}/건`) : "수수료 미설정"}</Badge>
                      {!m.isActive && <Badge tone="gray">정지</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{m.email}{m.profile?.phone ? ` · ${m.profile.phone}` : ""} · 최근 로그인 {m.lastLoginAt ? formatDateTime(m.lastLoginAt) : "없음"}</p>
                    <div className="flex flex-wrap gap-1">
                      {m.managedFacilities.length === 0 ? <span className="text-xs text-amber-600">배정된 창고(스튜디오)가 없습니다</span> : m.managedFacilities.map((x) => (
                        <span key={x.facilityId} className="rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700">{x.facility.name}{x.facility.status !== "APPROVED" && " (비운영)"}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[["이번 달", `완료 ${mo.n}건 · 판매 수수료 ${formatKRW(mo.rev)}`], ["이번 달 수수료", formatKRW(monthCommission)], ["누적", `완료 ${tot.n}건 · 판매 수수료 ${formatKRW(tot.rev)}`], ["누적 수수료", formatKRW(totalCommission)]].map(([l, v]) => (
                        <div key={l} className="rounded-lg bg-muted/40 p-2 text-center"><p className="text-[11px] text-muted-foreground">{l}</p><p className="text-xs font-bold text-navy">{v}</p></div>
                      ))}
                    </div>
                  </div>
                  <div className="w-full shrink-0 space-y-2 lg:w-72">
                    <p className="text-xs font-semibold text-muted-foreground">수수료 규칙</p>
                    <ManagerCommissionEditor managerId={m.id} type={rule?.commissionType ?? "PERCENT"} value={rule?.commissionValue ?? 0} />
                    <FacilityAssign managerId={m.id} managerName={m.profile?.name ?? m.email} assigned={ids}
                      all={facilities.map((f) => ({ ...f, taken: ids.includes(f.id) ? null : takenBy.get(f.id) ?? null }))} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
