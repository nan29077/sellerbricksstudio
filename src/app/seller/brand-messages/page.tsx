import { requireRole } from "@/lib/auth";
import { BuyerBrandMessages } from "@/components/shop/buyer-brand-pages";
import type { SP } from "@/lib/list";

export const dynamic = "force-dynamic";
export const metadata = { title: "브랜드 문의 | 스토리지마켓" };

export default async function Page({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SELLER"]);
  return <BuyerBrandMessages user={user} searchParams={searchParams} />;
}
