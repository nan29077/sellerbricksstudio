import { FacilityProductsManager } from "@/components/facility/facility-products-manager";
import type { SP } from "@/lib/list";

export const dynamic = "force-dynamic";

export default function FacilityProducts({ searchParams }: { searchParams: SP }) {
  return <FacilityProductsManager searchParams={searchParams} />;
}
