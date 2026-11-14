import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { OrderSheetForm } from "@/components/order-sheet-form";
import { sheetCatalog } from "@/lib/order-sheets";
import { getPolicy } from "@/lib/policy";

export const dynamic = "force-dynamic";

// 셀러 주문서 작성: 외부 라이브 플랫폼에서 판 주문을 적고, 공급가를 결제하면 브랜드 · 스토리지마켓 창고로 발주된다.
export default async function NewOrderSheet() {
  const user = await requireRole(["SELLER"]);
  const [catalog, profile, policy] = await Promise.all([
    sheetCatalog(user.id).catch(() => []),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { livePlatforms: true, livePlatformEtc: true } }).catch(() => null),
    getPolicy(),
  ]);
  return (
    <div className="space-y-4 pb-24 md:pb-0">
      <PageHeader title="주문서 작성" description="라이브 플랫폼에서 판매한 주문을 적어 주세요. 상품 공급가(스토리지마켓 출고분은 배송비 포함)를 결제하면 브랜드와 스토리지마켓 창고로 바로 발주됩니다." />
      <OrderSheetForm catalog={catalog} platforms={profile?.livePlatforms ?? []} platformEtc={profile?.livePlatformEtc ?? ""} shippingFee={policy.sheetShippingFee} />
    </div>
  );
}
