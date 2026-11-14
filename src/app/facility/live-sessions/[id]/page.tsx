import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canOperateFacility } from "@/lib/facility-owner";
import { getSessionWithCatalog } from "@/lib/live-data";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { LiveProductManager } from "@/components/live-product-manager";

export const dynamic = "force-dynamic";

// 창고 운영자(최고관리자 · 담당 매니저): 창고 방송의 판매 상품 · 상품번호 관리. 임시 상품은 창고(스튜디오)만 추가할 수 있다.
export default async function FacilityLiveProducts({ params }: { params: { id: string } }) {
  const user = await requireRole(["SUPER_ADMIN", "MANAGER"]);
  const data = await getSessionWithCatalog(params.id);
  if (!data) notFound();
  if (!(await canOperateFacility(user, data.session.facilityId))) redirect("/facility/live-sessions");
  const closed = data.session.status === "ENDED" || data.session.status === "CANCELLED";

  return (
    <div>
      <PageHeader title="방송 상품 관리" description={`${data.session.title} · 창고 상품 추가, 상품번호 변경, 임시 상품 추가를 할 수 있습니다.${closed ? " (종료된 방송은 상품을 추가할 수 없습니다)" : ""}`}
        action={<Link href="/facility/live-sessions" className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-semibold">목록으로</Link>} />
      <LiveProductManager sessionId={params.id} initial={data.items} catalog={data.catalog} brandCatalog={data.brandCatalog} canAdHoc={!closed} />
    </div>
  );
}
