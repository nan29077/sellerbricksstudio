import { FacilityProductsManager } from "@/components/facility/facility-products-manager";
import type { SP } from "@/lib/list";

export default function AdminFacilityProducts({ searchParams }: { searchParams: SP }) {
  return <FacilityProductsManager searchParams={searchParams} admin />;
}
