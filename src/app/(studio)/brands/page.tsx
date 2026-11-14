import { BrandDirectory } from "@/components/shop/brand-directory";
import type { SP } from "@/lib/list";

export const dynamic = "force-dynamic";

export default function BrandsPage({ searchParams }: { searchParams: SP }) {
  return <BrandDirectory searchParams={searchParams} base="/brands" />;
}
