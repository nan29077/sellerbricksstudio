import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { BRAND_BUYER_ROLES } from "@/lib/brands";
import { ROLE_HOME } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { sp, type SP } from "@/lib/list";
import { MessageCenter } from "@/components/brand/message-thread";

export const dynamic = "force-dynamic";

// 셀러 · 창고(스튜디오): 브랜드 문의함
export default async function PartnerBrandMessages({ searchParams }: { searchParams: SP }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/brand-messages");
  if (!BRAND_BUYER_ROLES.includes(user.role)) redirect(ROLE_HOME[user.role]);
  const shopId = sp(searchParams, "shop");
  const startShop = shopId ? await prisma.brandShop.findFirst({ where: { id: shopId, status: "APPROVED" }, select: { id: true, name: true } }) : null;
  return (
    <div className="space-y-5 px-4 py-7 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-black text-navy">브랜드 문의</h1>
        <Link href="/brands" className="text-sm font-bold text-brand-800 hover:underline">브랜드샵 둘러보기</Link>
      </div>
      <MessageCenter side="PARTNER" scope={{ partnerId: user.id }} base="/brand-messages" selected={sp(searchParams, "t")} startShop={startShop} me={user.id} />
    </div>
  );
}
