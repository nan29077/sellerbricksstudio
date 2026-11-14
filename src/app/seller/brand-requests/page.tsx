import { requireRole } from "@/lib/auth";
import { BuyerBrandRequests } from "@/components/shop/buyer-brand-pages";
import type { SP } from "@/lib/list";

export const dynamic = "force-dynamic";
export const metadata = { title: "샘플 · 시연품 신청 내역 | 스토리지마켓" };

export default async function Page({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SELLER"]);
  return <BuyerBrandRequests user={user} searchParams={searchParams} />;
}
