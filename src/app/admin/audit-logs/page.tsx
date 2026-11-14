import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { FilterBar } from "@/components/list/filter-bar";
import { Pagination } from "@/components/list/pagination";
import { CsvButton } from "@/components/list/csv-button";
import { ROLE_LABELS } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";
import { dateRange, pageOf, sp, type SP } from "@/lib/list";
import { ScrollText } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/admin/audit-logs";
const ENTITY: Record<string, string> = {
  Booking: "예약", Facility: "공간", User: "회원", FacilityReview: "리뷰", FacilitySettlement: "정산", MarketingApplication: "마케팅",
  ManagerCommissionRule: "매니저 수수료", CommissionRule: "수수료", Order: "주문", LiveSession: "라이브", Payment: "결제",
};
function tone(action: string): "red" | "green" | "yellow" | "blue" | "gray" {
  if (/DELETE|REJECT|CANCEL|DEACTIVATE|SUSPEND|HIDE/.test(action)) return "red";
  if (/APPROVE|ACTIVATE|PAID|COMPLETE|CREATE/.test(action)) return "green";
  if (/SET|UPDATE|MEMO|CHANGE/.test(action)) return "yellow";
  return "blue";
}

export default async function AdminAuditLogs({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const entity = sp(searchParams, "entity");
  const q = sp(searchParams, "q");
  const { page, size, skip, take } = pageOf(searchParams, 40);
  const where: Prisma.AuditLogWhereInput = {
    ...(entity && { entity }), ...(dateRange(searchParams) && { createdAt: dateRange(searchParams) }),
    ...(q && { OR: [{ action: { contains: q, mode: "insensitive" } }, { entityId: { contains: q } }, { actor: { email: { contains: q, mode: "insensitive" } } }] }),
  };
  const [rows, total, entities] = await Promise.all([
    prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { actor: { select: { email: true, role: true, profile: { select: { name: true } } } } } }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["entity"], _count: true, orderBy: { _count: { entity: "desc" } } }),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader title="감사 로그" description="누가 언제 무엇을 변경했는지 기록합니다. 분쟁·보안 점검 시 근거로 사용하세요." />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <FilterBar className="flex-1" fields={[
          { type: "search", key: "q", placeholder: "행위(예: BOOKING_APPROVED) · 대상 ID · 이메일" },
          { type: "select", key: "entity", label: "대상", options: entities.map((e) => ({ value: e.entity, label: `${ENTITY[e.entity] ?? e.entity} (${e._count})` })) },
          { type: "date", key: "from", label: "시작" }, { type: "date", key: "to", label: "끝" },
        ]} />
        <CsvButton label="CSV" filename="감사로그" headers={["일시", "행위자", "역할", "행위", "대상", "대상ID", "상세"]}
          rows={rows.map((l) => [formatDateTime(l.createdAt), l.actor?.email ?? "system", l.actor ? ROLE_LABELS[l.actor.role] : "", l.action, ENTITY[l.entity] ?? l.entity, l.entityId, l.meta])} />
      </div>
      {rows.length === 0 ? <EmptyState icon={<ScrollText className="h-10 w-10" />} title="기록이 없습니다" /> : (
        <Card>
          <CardContent className="divide-y divide-[#F0ECE6] p-0">
            {rows.map((l) => (
              <details key={l.id} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm">
                  <span className="w-36 shrink-0 text-xs text-slate-500">{formatDateTime(l.createdAt)}</span>
                  <Badge tone={tone(l.action)}>{l.action}</Badge>
                  <span className="text-xs text-slate-500">{ENTITY[l.entity] ?? l.entity}</span>
                  <span className="ml-auto truncate text-xs text-navy">{l.actor ? `${l.actor.profile?.name ?? l.actor.email} (${ROLE_LABELS[l.actor.role]})` : "시스템"}</span>
                </summary>
                <div className="mt-2 rounded-lg bg-muted/50 p-3 font-mono text-[11px] text-slate-600">
                  <p>대상 ID: {l.entityId ?? "-"}</p>
                  {l.meta && <pre className="mt-1 whitespace-pre-wrap break-all">{(() => { try { return JSON.stringify(JSON.parse(l.meta), null, 2); } catch { return l.meta; } })()}</pre>}
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      )}
      <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
    </div>
  );
}
