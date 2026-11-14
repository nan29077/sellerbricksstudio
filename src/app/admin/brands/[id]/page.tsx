import { notFound } from "next/navigation";
import { BrandWorkspace } from "@/components/shop/brand-workspace";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SP } from "@/lib/list";
import { BrandVideoManager } from "@/components/brand/brand-video-manager";

export default async function AdminBrand({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  await requireRole(["SUPER_ADMIN"]);
  const shop = await prisma.brandShop.findUnique({
    where: { id: params.id },
  });
  if (!shop) notFound();
  return (
    <div className="space-y-6">
      <BrandWorkspace shop={shop} name={shop.name} params={searchParams} admin />
      <BrandVideoManager shopId={shop.id} shopName={shop.name} />
    </div>
  );
}
