import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { ownedFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Table, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { LIVE_STATUS } from "@/lib/status";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function FacilityLiveSessions() {
  const user = await requireRole(["FACILITY_ADMIN"]);
  if (!(await getSettings()).liveEnabled) redirect("/facility/dashboard");
  const ids = await ownedFacilityIds(user.id);
  const sessions = await prisma.liveSession.findMany({ where: { facilityId: { in: ids } }, orderBy: { createdAt: "desc" }, include: { seller: { include: { profile: true } }, _count: { select: { products: true } } } });
  return (
    <div>
      <PageHeader title="라이브 세션" description="내 시설에서 진행되는 방송입니다. 방송 중 상품 추가가 가능합니다." />
      {sessions.length === 0 ? <EmptyState title="라이브 세션이 없습니다" /> : (
        <Table headers={["제목", "셀러", "상태", "상품수", ""]}>
          {sessions.map((s) => { const st = LIVE_STATUS[s.status]; return (
            <tr key={s.id}><Td className="font-medium max-w-[180px] truncate">{s.title}</Td><Td>{s.seller.profile?.name}</Td><Td><Badge tone={st.tone}>{st.label}</Badge></Td><Td>{s._count.products}</Td>
              <Td><Link href={`/seller/live-sessions/${s.id}/numbering`}><Button size="sm" variant="outline">상품 추가/번호</Button></Link></Td></tr>
          ); })}
        </Table>
      )}
    </div>
  );
}
