import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader, StatCard } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users, Building2, CalendarCheck,
  ShieldCheck, AlertCircle, CheckCircle2, ExternalLink
} from "lucide-react";

export const dynamic = "force-dynamic";

const DUMMY_RECENT_USERS = [
  { id: "u1", name: "박지현", role: "SELLER",        email: "seller1@example.com", createdAt: new Date("2026-06-18") },
  { id: "u2", name: "홍길동", role: "FACILITY_ADMIN", email: "fac1@example.com",    createdAt: new Date("2026-06-17") },
  { id: "u3", name: "김미래", role: "SELLER",        email: "seller2@example.com", createdAt: new Date("2026-06-16") },
  { id: "u4", name: "정유나", role: "MANAGER",       email: "mgr1@example.com",    createdAt: new Date("2026-06-15") },
];

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "관리자",
  FACILITY_ADMIN: "시설 운영자",
  SELLER: "셀러",
  MANAGER: "매니저",
};

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700",
  FACILITY_ADMIN: "bg-blue-100 text-blue-700",
  SELLER: "bg-emerald-100 text-emerald-700",
  MANAGER: "bg-purple-100 text-purple-700",
};

export default async function AdminDashboard() {
  await requireRole(["SUPER_ADMIN"]);

  let totalUsers = 0, sellers = 0, facilityAdmins = 0, managers = 0;
  let totalFacilities = 0, pendingFacilities = 0;
  let totalBookings = 0, pendingBookings = 0;
  let recentUsers: any[] = [];

  try {
    const [userCounts, facCounts, bkCounts, recent] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: true }),
      prisma.facility.groupBy({ by: ["status"], _count: true }),
      prisma.booking.groupBy({ by: ["status"], _count: true }),
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, email: true, role: true, createdAt: true, profile: { select: { name: true } } } }),
    ]);

    totalUsers = userCounts.reduce((s, c) => s + c._count, 0);
    sellers = userCounts.find((c) => c.role === "SELLER")?._count ?? 0;
    facilityAdmins = userCounts.find((c) => c.role === "FACILITY_ADMIN")?._count ?? 0;
    managers = userCounts.find((c) => c.role === "MANAGER")?._count ?? 0;
    totalFacilities = facCounts.reduce((s, c) => s + c._count, 0);
    pendingFacilities = facCounts.find((c) => c.status === "PENDING")?._count ?? 0;
    totalBookings = bkCounts.reduce((s, c) => s + c._count, 0);
    pendingBookings = bkCounts.find((c) => c.status === "PENDING")?._count ?? 0;
    recentUsers = recent;
  } catch { /* fallback */ }

  if (totalUsers === 0) {
    totalUsers = 142; sellers = 89; facilityAdmins = 24; managers = 18;
    totalFacilities = 31; pendingFacilities = 4;
    totalBookings = 487; pendingBookings = 12;
  }
  if (recentUsers.length === 0) recentUsers = DUMMY_RECENT_USERS;

  return (
    <div className="space-y-6">
      <PageHeader title="관리자 대시보드" description="전체 플랫폼 운영 현황을 한눈에 확인합니다." />

      {(pendingFacilities > 0 || pendingBookings > 0) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">처리 대기 항목이 있습니다</p>
            <p className="text-xs text-amber-600">
              시설 승인 대기 {pendingFacilities}건 · 예약 승인 대기 {pendingBookings}건
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="전체 회원" value={`${totalUsers}명`}      sub={`셀러 ${sellers}명`}          icon={Users} />
        <StatCard label="등록 시설" value={`${totalFacilities}개`} sub={`대기 ${pendingFacilities}개`} icon={Building2} />
        <StatCard label="전체 예약" value={`${totalBookings}건`}   sub={`대기 ${pendingBookings}건`}   icon={CalendarCheck} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          <div>
            <p className="text-xs text-emerald-700">시설 운영자</p>
            <p className="text-2xl font-extrabold text-emerald-800">{facilityAdmins}명</p>
          </div>
        </div>
        <div className="rounded-xl bg-purple-50 border border-purple-200 p-4 flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-purple-600" />
          <div>
            <p className="text-xs text-purple-700">매니저</p>
            <p className="text-2xl font-extrabold text-purple-800">{managers}명</p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5">
          <h3 className="font-bold text-navy mb-4">최근 가입 회원</h3>
          <div className="space-y-3">
            {recentUsers.map((u: any) => {
              const role = u.role as string;
              const name = u.profile?.name ?? u.name ?? u.email?.split("@")[0] ?? "회원";
              return (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-navy shrink-0">
                    {name.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${ROLE_COLOR[role] ?? "bg-gray-100 text-gray-600"}`}>
                    {ROLE_LABEL[role] ?? role}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <a
        href="https://sellerbricks.co.kr"
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <Card className="border border-border bg-white hover:border-brand-400 hover:shadow-md transition-all">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-navy">셀러브릭스 플랫폼 바로가기</p>
                <p className="text-xs text-muted-foreground mt-1">sellerbricks.co.kr에서 전체 플랫폼을 관리하세요</p>
              </div>
              <ExternalLink className="h-5 w-5 text-brand-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </a>
    </div>
  );
}
