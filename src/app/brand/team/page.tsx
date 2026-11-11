import { requireRole } from "@/lib/auth";
import { brandContext } from "@/lib/brand-access";
import { prisma } from "@/lib/prisma";
import { reportDbError } from "@/lib/db-error";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { DataNotice, Empty, Panel } from "@/components/dashboard/kit";
import { TeamAddForm, TeamRemoveButton } from "@/components/brand/team-controls";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

// 브랜드 팀원 관리 (대표 계정만)
export default async function BrandTeamPage() {
  const user = await requireRole(["BRAND_ADMIN"]);
  if (user.id === "demo-brand") return <p>팀원 관리는 데이터베이스 연결이 필요합니다.</p>;
  try {
    const ctx = await brandContext(user);
    if (!ctx) return <Empty icon={Users} text="브랜드샵을 만들면 팀원을 추가할 수 있습니다." action={{ href: "/brand/shop", label: "브랜드샵 만들기" }} />;
    const members = await prisma.brandMember.findMany({
      where: { shopId: ctx.shop.id }, orderBy: { createdAt: "asc" },
      select: { userId: true, createdAt: true, user: { select: { email: true, lastLoginAt: true, profile: { select: { name: true } } } } },
    });
    return (
      <div className="space-y-5">
        <PageHeader title="팀원 관리" description="상품 · 발주 · 샘플 담당 직원에게 각자 계정을 만들어 주세요. 비밀번호를 함께 쓰지 않아도 됩니다. 팀원은 정산 계좌와 팀원 관리를 할 수 없습니다." />
        {!ctx.isOwner ? <p className="rounded-2xl border bg-white p-5 text-sm text-slate-700">팀원 관리는 브랜드 대표 계정만 할 수 있습니다.</p> : <>
          <Panel eyebrow="ADD" title="팀원 추가"><TeamAddForm /></Panel>
          <Panel eyebrow="MEMBERS" title={`팀원 ${members.length}명`}>
            {!members.length ? <Empty text="아직 팀원이 없습니다" /> : (
              <ul className="divide-y divide-[#F0ECE6]">
                {members.map((m) => (
                  <li key={m.userId} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-navy">{m.user.profile?.name ?? m.user.email}</span>
                      <span className="block truncate text-xs text-slate-500">{m.user.email} · 추가 {formatDate(m.createdAt)}{m.user.lastLoginAt ? ` · 최근 로그인 ${formatDate(m.user.lastLoginAt)}` : " · 로그인 기록 없음"}</span></span>
                    <TeamRemoveButton userId={m.userId} name={m.user.profile?.name ?? m.user.email} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>}
      </div>
    );
  } catch (e) {
    return <DataNotice issue={reportDbError("brand-team", e)} />;
  }
}
