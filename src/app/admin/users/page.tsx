import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Kpi } from "@/components/list/charts";
import { FilterBar } from "@/components/list/filter-bar";
import { StatusTabs } from "@/components/list/status-tabs";
import { Pagination } from "@/components/list/pagination";
import { CsvButton } from "@/components/list/csv-button";
import { ResourceForm, PatchButton, type Field } from "@/components/resource-form";
import { livePlatformLabel } from "@/lib/live-platforms";
import { ROLE_LABELS } from "@/lib/rbac";
import { formatDate, formatDateTime } from "@/lib/utils";
import { addDays } from "@/lib/kst";
import { dateRange, pageOf, sp, type SP } from "@/lib/list";
import { RegisterManagerButton } from "./RegisterManagerModal";
import { Users, UserPlus, UserX, Activity } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/admin/users";
const ROLE_TONE: Record<string, "navy" | "default" | "green" | "blue" | "gray" | "purple"> = { SUPER_ADMIN: "navy", SELLER: "default", FACILITY_ADMIN: "green", BRAND_ADMIN: "purple", MANAGER: "blue", BUYER: "gray" };

const editFields: Field[] = [
  { name: "name", label: "이름", required: true, half: true },
  { name: "phone", label: "연락처", half: true },
  { name: "companyName", label: "회사명", half: true },
  { name: "role", label: "역할", type: "select", half: true, options: (["SELLER", "BRAND_ADMIN", "MANAGER"] as const).map((value) => ({ value, label: ROLE_LABELS[value] })), help: "역할 변경은 다음 로그인부터 적용됩니다." },
  { name: "adminMemo", label: "관리자 메모 (회원 비공개)", type: "textarea" },
];

export default async function AdminUsers({ searchParams }: { searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const role = sp(searchParams, "role");
  const status = sp(searchParams, "status");
  const q = sp(searchParams, "q");
  const sort = sp(searchParams, "sort");
  const { page, size, skip, take } = pageOf(searchParams, 25);
  const where: Prisma.UserWhereInput = {
    role: role ? (role as any) : { not: "BUYER" },
    ...(status === "active" && { isActive: true }), ...(status === "inactive" && { isActive: false }),
    ...(status === "dormant" && { OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: addDays(new Date(), -90) } }] }),
    ...(dateRange(searchParams) && { createdAt: dateRange(searchParams) }),
    ...(q && { OR: [
      { email: { contains: q, mode: "insensitive" } }, { profile: { name: { contains: q, mode: "insensitive" } } },
      { profile: { phone: { contains: q } } }, { profile: { companyName: { contains: q, mode: "insensitive" } } },
    ] }),
  };
  const [rows, total, byRole, inactive, newThisWeek, activeRecent] = await Promise.all([
    prisma.user.findMany({
      where, skip, take, orderBy: sort === "login" ? { lastLoginAt: { sort: "desc", nulls: "last" } } : { createdAt: "desc" },
      include: { profile: true, _count: { select: { bookings: true, ownedFacilities: true, managedFacilities: true, orders: true } } },
    }),
    prisma.user.count({ where }),
    prisma.user.groupBy({ by: ["role"], where: { role: { not: "BUYER" } }, _count: true }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.user.count({ where: { createdAt: { gte: addDays(new Date(), -7) } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: addDays(new Date(), -30) } } }),
  ]);
  const rc = Object.fromEntries(byRole.map((r) => [r.role, r._count]));
  const all = byRole.reduce((s, r) => s + r._count, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="회원 관리" description="회원 검색, 역할 변경, 계정 정지, 관리자 메모를 관리합니다." action={<RegisterManagerButton />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="전체 회원" value={`${all}명`} sub={`셀러 ${rc.SELLER ?? 0} · 브랜드사 ${rc.BRAND_ADMIN ?? 0} · 매니저 ${rc.MANAGER ?? 0}`} icon={Users} tone="navy" />
        <Kpi label="최근 7일 가입" value={`${newThisWeek}명`} icon={UserPlus} tone="green" />
        <Kpi label="30일 내 로그인" value={`${activeRecent}명`} sub={all ? `활성률 ${Math.round((activeRecent / all) * 100)}%` : undefined} icon={Activity} tone="blue" />
        <Kpi label="정지 계정" value={`${inactive}명`} icon={UserX} tone="red" />
      </div>

      <StatusTabs base={BASE} params={searchParams} paramKey="role" tabs={[
        { value: "", label: "전체", count: all },
        ...(["SELLER", "BRAND_ADMIN", "MANAGER", "SUPER_ADMIN", ...(rc.FACILITY_ADMIN ? ["FACILITY_ADMIN" as const] : [])] as const).map((r) => ({ value: r, label: ROLE_LABELS[r], count: rc[r] ?? 0 })),
      ]} />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <FilterBar className="flex-1" fields={[
          { type: "search", key: "q", placeholder: "이름 · 이메일 · 연락처 · 회사명" },
          { type: "select", key: "status", label: "상태", options: [{ value: "active", label: "활성" }, { value: "inactive", label: "정지" }, { value: "dormant", label: "90일 미접속" }] },
          { type: "select", key: "sort", label: "정렬", options: [{ value: "login", label: "최근 로그인 순" }] },
          { type: "date", key: "from", label: "가입일 시작" }, { type: "date", key: "to", label: "가입일 끝" },
        ]} />
        <CsvButton label="CSV" filename="회원목록" headers={["이름", "이메일", "역할", "연락처", "회사", "상태", "가입일", "마지막 로그인", "예약수"]}
          rows={rows.map((u) => [u.profile?.name, u.email, ROLE_LABELS[u.role], u.profile?.phone, u.profile?.companyName, u.isActive ? "활성" : "정지", formatDate(u.createdAt), u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "", u._count.bookings])} />
      </div>

      {rows.length === 0 ? <EmptyState icon={<Users className="h-10 w-10" />} title="조건에 맞는 회원이 없습니다" /> : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm rtable">
              <thead><tr className="border-b border-[#EEEAE2] bg-[#F9F7F2] text-left text-xs font-bold text-slate-500">
                {["회원", "역할", "활동", "가입 · 최근 로그인", "상태", "관리"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-[#F0ECE6] align-top last:border-0 hover:bg-brand-50/40">
                    <td data-label="회원" className="px-4 py-3">
                      <p className="font-semibold text-navy">{u.profile?.name ?? "-"}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                      {(u.profile?.phone || u.profile?.companyName) && <p className="text-[11px] text-slate-400">{[u.profile?.companyName, u.profile?.phone].filter(Boolean).join(" · ")}</p>}
                      {u.role === "SELLER" && (u.profile?.livePlatforms?.length ?? 0) > 0 && <p className="mt-0.5 max-w-xs text-[11px] text-brand-800">플랫폼: {u.profile!.livePlatforms.map((c) => livePlatformLabel(c, u.profile!.livePlatformEtc)).join(", ")}</p>}
                      {u.adminMemo && <p className="mt-1 max-w-xs truncate rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800" title={u.adminMemo}>📝 {u.adminMemo}</p>}
                    </td>
                    <td data-label="역할" className="px-4 py-3"><Badge tone={ROLE_TONE[u.role] ?? "gray"}>{ROLE_LABELS[u.role]}</Badge></td>
                    <td data-label="활동" className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                      {u.role === "SELLER" && `예약 ${u._count.bookings}건 · 주문서 ${u._count.orders}건`}
                      {u.role === "FACILITY_ADMIN" && `공간 ${u._count.ownedFacilities}곳`}
                      {u.role === "MANAGER" && `담당 ${u._count.managedFacilities}곳`}
                    </td>
                    <td data-label="가입 · 최근 로그인" className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatDate(u.createdAt)}<br /><span className="text-slate-400">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "로그인 기록 없음"}</span></td>
                    <td data-label="상태" className="px-4 py-3"><Badge tone={u.isActive ? "green" : "gray"}>{u.isActive ? "활성" : "정지"}</Badge></td>
                    <td data-label="관리" className="whitespace-nowrap px-4 py-3">
                      {u.role === "SUPER_ADMIN" ? <span className="text-xs text-muted-foreground">-</span> : (
                        <div className="flex gap-1">
                          <ResourceForm url="/api/admin/users" id={u.id} fields={editFields} title="회원 정보 수정" iconOnly triggerVariant="ghost"
                            initial={{ name: u.profile?.name ?? "", phone: u.profile?.phone ?? "", companyName: u.profile?.companyName ?? "", role: u.role, adminMemo: u.adminMemo ?? "" }} />
                          <PatchButton url={`/api/admin/users/${u.id}`} body={{ isActive: !u.isActive }} variant={u.isActive ? "outline" : "default"} className="h-8 px-2.5 text-xs"
                            confirmText={u.isActive ? `${u.email} 계정을 정지할까요? 로그인과 이용이 즉시 막힙니다.` : `${u.email} 계정을 다시 활성화할까요?`}>{u.isActive ? "정지" : "활성화"}</PatchButton>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
    </div>
  );
}
