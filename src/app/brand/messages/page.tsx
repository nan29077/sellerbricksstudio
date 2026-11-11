import { requireRole } from "@/lib/auth";
import { brandContext } from "@/lib/brand-access";
import { reportDbError } from "@/lib/db-error";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { DataNotice, Empty } from "@/components/dashboard/kit";
import { MessageCenter } from "@/components/brand/message-thread";
import { MessageComposer } from "@/components/brand/message-composer";
import type { SP } from "@/lib/list";
import { sp } from "@/lib/list";
import { MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

// 브랜드: 판매처(셀러 · 창고) 문의함
export default async function BrandMessagesPage({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["BRAND_ADMIN"]);
  if (user.id === "demo-brand") return <p>문의함을 보려면 데이터베이스 연결이 필요합니다.</p>;
  try {
    const ctx = await brandContext(user);
    if (!ctx) return <Empty icon={MessageSquare} text="브랜드샵을 만들면 판매처 문의를 받을 수 있습니다." action={{ href: "/brand/shop", label: "브랜드샵 만들기" }} />;
    const to = sp(searchParams, "to");
    const partner = to ? await prisma.user.findFirst({ where: { id: to, role: { in: ["SELLER", "FACILITY_ADMIN"] } }, select: { id: true, email: true, profile: { select: { name: true, companyName: true } } } }) : null;
    const existing = partner ? await prisma.brandThread.findUnique({ where: { shopId_partnerId: { shopId: ctx.shop.id, partnerId: partner.id } }, select: { id: true } }) : null;
    return (
      <div className="space-y-5">
        <PageHeader title="판매처 문의함" description="셀러 · 창고(스튜디오)와 샘플, 입고, 방송 일정을 1:1로 주고받습니다." />
        {partner && !existing && (
          <div className="rounded-2xl border bg-white">
            <p className="border-b px-4 py-3 text-sm font-bold text-navy">새 메시지 · {partner.profile?.companyName || partner.profile?.name || partner.email.split("@")[0]}</p>
            <MessageComposer partnerId={partner.id} />
          </div>
        )}
        <MessageCenter side="BRAND" scope={{ shopId: ctx.shop.id }} base="/brand/messages" selected={sp(searchParams, "t") ?? existing?.id} me={user.id} />
      </div>
    );
  } catch (e) {
    return <DataNotice issue={reportDbError("brand-messages", e)} />;
  }
}
