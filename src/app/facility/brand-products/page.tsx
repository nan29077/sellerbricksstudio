import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { facilityScope } from "@/lib/facility-owner";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { BrandOrderButton } from "@/components/shop/brand-order-button";
import { FULFILLMENT_LABEL } from "@/lib/brands";
import { formatKRW } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FacilityBrandProducts() {
  const user = await requireRole(["SUPER_ADMIN", "MANAGER"]);
  if (user.role !== "SUPER_ADMIN") redirect("/facility/products"); // 브랜드 거래(가져오기 · 입고 요청)는 최고관리자가 한다
  const [rows, profile] = await Promise.all([
    prisma.facilityProduct.findMany({
      where: { facility: facilityScope(user), brandProductId: { not: null } }, orderBy: { createdAt: "desc" },
      include: {
        facility: { select: { name: true, address: true, contactPhone: true } }, product: { select: { name: true } },
        brandProduct: { select: { id: true, name: true, supplyPrice: true, stock: true, isActive: true, allowWarehouse: true, minOrderQty: true, shop: { select: { id: true, name: true, status: true } } } },
      },
    }),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { name: true, phone: true } }),
  ]);
  const openRequests = rows.length ? await prisma.brandRequest.groupBy({
    by: ["facilityProductId"], where: { kind: "SUPPLY", facilityProductId: { in: rows.map((r) => r.id) }, status: { in: ["PENDING", "APPROVED", "SHIPPED"] } },
    _sum: { quantity: true },
  }) : [];
  const pending = new Map(openRequests.map((r) => [r.facilityProductId, r._sum.quantity ?? 0]));
  const sold = rows.length ? await prisma.purchaseOrderItem.groupBy({
    by: ["brandProductId"], where: { purchaseOrder: { facilityId: { in: Array.from(new Set(rows.map((r) => r.facilityId))) }, status: { notIn: ["CANCELLED", "RETURNED"] } } }, _sum: { quantity: true },
  }) : [];
  const soldMap = new Map(sold.map((s) => [s.brandProductId, s._sum.quantity ?? 0]));

  return (
    <div className="space-y-5">
      <PageHeader title="브랜드 판매 상품 · 입고" description="브랜드샵에서 가져온 상품입니다. 직배송은 바로 판매되고, 창고 입고 상품은 브랜드에 입고를 요청해 받은 뒤 '입고 확인'하면 판매 재고가 늘어납니다."
        action={<div className="flex gap-2"><Link href="/brands" className={buttonVariants({ variant: "outline" })}>브랜드샵 둘러보기</Link><Link href="/brand-requests?kind=SUPPLY" className={buttonVariants({ variant: "outline" })}>입고 요청 내역</Link></div>} />
      {rows.length === 0 ? <EmptyState title="가져온 브랜드 상품이 없습니다" description="브랜드샵에서 '판매 상품으로 가져오기'를 누르고 배송 방식을 고르세요." /> : (
        <div className="space-y-3">
          {rows.map((fp) => {
            const bp = fp.brandProduct!;
            const warehouse = fp.fulfillment === "WAREHOUSE";
            return (
              <article key={fp.id} className="flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-500"><Link href={`/brands/${bp.shop.id}`} className="underline">{bp.shop.name}</Link> · {fp.facility.name}</p>
                  <p className="font-black text-navy">{fp.product.name} <Badge tone={warehouse ? "gray" : "blue"}>{FULFILLMENT_LABEL[fp.fulfillment ?? "DROPSHIP"]}</Badge> {!fp.isSellable && <Badge tone="yellow">판매 대기</Badge>}</p>
                  <p className="text-xs text-slate-600">판매가 {formatKRW(fp.salePrice)} · 공급가 {formatKRW(bp.supplyPrice)} · {warehouse ? `창고 재고 ${fp.stock.toLocaleString()}개` : `판매 한도 ${fp.stock.toLocaleString()}개 (브랜드 재고 ${bp.stock.toLocaleString()}개)`} · 누적 판매 {(soldMap.get(bp.id) ?? 0).toLocaleString()}개</p>
                  {warehouse && (pending.get(fp.id) ?? 0) > 0 && <p className="text-xs font-semibold text-brand-800">입고 진행 중 {pending.get(fp.id)!.toLocaleString()}개</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/facility/products" className={buttonVariants({ variant: "outline", size: "sm" })}>가격 · 수수료 수정</Link>
                  {warehouse && bp.isActive && bp.allowWarehouse && bp.shop.status === "APPROVED" && (
                    <BrandOrderButton productId={bp.id} name={bp.name} kind="SUPPLY" unitPrice={bp.supplyPrice} stock={bp.stock} minQuantity={bp.minOrderQty} facilityProductId={fp.id}
                      defaults={{ recipient: fp.facility.name, phone: fp.facility.contactPhone ?? profile?.phone ?? "", address: fp.facility.address }} />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
