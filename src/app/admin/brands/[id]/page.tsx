import { notFound } from "next/navigation";
import { BrandWorkspace } from "@/components/shop/brand-workspace";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SP } from "@/lib/list";

export default async function AdminBrand({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const shop = await prisma.brandShop.findUnique({
    where: { id: params.id },
  });
  if (!shop) notFound();
  return <BrandWorkspace shop={shop} name={shop.name} params={searchParams} admin />;
}
