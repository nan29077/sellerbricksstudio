import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getSessionWithCatalog } from "@/lib/live-data";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { LiveProductManager } from "@/components/live-product-manager";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ProductsPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await getSessionWithCatalog(params.id);
  if (!data) notFound();
  if (data.session.sellerId !== user.id && user.role !== "SUPER_ADMIN" && data.session.facility.ownerId !== user.id) redirect("/seller/live-sessions");

  return (
    <div>
      <PageHeader title="판매 상품 선택" description={data.session.title}
        action={<Link href={`/seller/live-sessions/${params.id}`}><Button variant="outline">세션으로</Button></Link>} />
      <LiveProductManager sessionId={params.id} initial={data.items} catalog={data.catalog} />
    </div>
  );
}
