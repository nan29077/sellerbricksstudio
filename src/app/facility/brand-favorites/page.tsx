import { requireRole } from "@/lib/auth";
import { BuyerBrandFavorites } from "@/components/shop/buyer-brand-pages";
import type { SP } from "@/lib/list";

export const dynamic = "force-dynamic";
export const metadata = { title: "찜한 브랜드 상품 | 스토리지마켓" };

export default async function Page({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SUPER_ADMIN"]);
  return <BuyerBrandFavorites user={user} />;
}
