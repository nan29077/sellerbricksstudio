import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getSessionWithCatalog } from "@/lib/live-data";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { LiveProductManager } from "@/components/live-product-manager";

export const dynamic = "force-dynamic";

export default async function NumberingPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await getSessionWithCatalog(params.id);
  if (!data) notFound();
  if (data.session.sellerId !== user.id && user.role !== "SUPER_ADMIN" && data.session.facility.ownerId !== user.id) redirect("/seller/live-sessions");

  return (
    <div>
      <PageHeader title="상품번호 관리" description={`${data.session.title} · 번호를 탭하면 즉시 수정됩니다 (실시간 반영)`} />
      <LiveProductManager sessionId={params.id} initial={data.items} catalog={data.catalog} />
    </div>
  );
}
