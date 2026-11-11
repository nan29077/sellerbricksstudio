import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { ownedFacilityIds } from "@/lib/rbac";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { ActionButton } from "@/components/action-button";
import { ResourceForm, type Field } from "@/components/resource-form";
import { FilterBar } from "@/components/list/filter-bar";
import { Kpi } from "@/components/list/charts";
import { formatKRW, sellerUnitProfit } from "@/lib/utils";
import { sp, type SP } from "@/lib/list";
import { PRODUCT_CATEGORIES } from "@/lib/product-categories";
import { Package, Plus, CalendarCheck, AlertTriangle, Radio, ScanLine } from "lucide-react";

const EDIT_FIELDS: Field[] = [
  { name: "name", label: "상품명", required: true },
  { name: "category", label: "카테고리", type: "select", options: PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c })), half: true },
  { name: "sku", label: "SKU", half: true },
  { name: "salePrice", label: "판매가(원)", type: "number", min: 0, half: true, required: true },
  { name: "consumerPrice", label: "소비자가(원)", type: "number", min: 0, half: true },
  { name: "supplyPrice", label: "셀러 공급가(원)", type: "number", min: 0, half: true, help: "판매되면 창고(스튜디오)가 받는 금액입니다. 셀러는 판매가 − 판매 수수료 − 공급가를 받고, 공급가 이상으로 판매가를 바꿀 수 있습니다. 비우면 아래 셀러 수수료 방식으로 계산합니다." },
  { name: "stock", label: "재고", type: "number", min: 0, half: true, required: true },
  { name: "shippingInfo", label: "배송 정보", half: true, placeholder: "3,000원 (5만원 이상 무료)" },
  { name: "commissionType", label: "셀러 수수료 방식", type: "select", options: [{ value: "PERCENT", label: "정률 (%)" }, { value: "FIXED", label: "정액 (원)" }], half: true },
  { name: "commissionValue", label: "셀러 수수료 값", type: "number", min: 0, half: true },
  { name: "thumbnailUrl", label: "대표 이미지 URL", type: "url" },
  { name: "description", label: "상품 설명", type: "textarea", help: "셀러가 상품을 고를 때 보는 설명입니다. 특징·구성·방송 포인트를 적어주세요." },
];

export async function FacilityProductsManager({ searchParams, admin = false }: { searchParams: SP; admin?: boolean }) {
  const user = await requireRole(admin ? ["SUPER_ADMIN"] : ["FACILITY_ADMIN"]);
  const q = sp(searchParams, "q");
  const state = sp(searchParams, "state");
  const fid = sp(searchParams, "facility");
  const adminFacility = admin && fid ? await prisma.facility.findUnique({ where: { id: fid }, select: { id: true, name: true } }) : null;
  if (admin && !adminFacility) notFound();
  const facIds = adminFacility ? [adminFacility.id] : await ownedFacilityIds(user.id);
  const newProductHref = adminFacility ? `/admin/facilities/${adminFacility.id}/products/new` : "/facility/products/new";

  const where: Prisma.FacilityProductWhereInput = {
    facilityId: fid && facIds.includes(fid) ? fid : { in: facIds },
    ...(state === "on" && { isSellable: true }),
    ...(state === "off" && { isSellable: false }),
    ...(state === "low" && { isSellable: true, stock: { lte: 10 } }),
    ...(q && { OR: [{ product: { name: { contains: q, mode: "insensitive" } } }, { product: { sku: { contains: q, mode: "insensitive" } } }] }),
  };
  const now = new Date();
  const [facilities, products, upcomingReq] = await Promise.all([
    prisma.facility.findMany({ where: { id: { in: facIds } }, select: { id: true, name: true } }),
    prisma.facilityProduct.findMany({
      where, orderBy: [{ isSellable: "desc" }, { createdAt: "desc" }],
      include: { product: true, facility: { select: { name: true } }, _count: { select: { bookingProducts: true, liveSessionProducts: true } } },
    }),
    // 다가오는 예약(대기·승인)에서 요청된 상품별 수량
    prisma.bookingProduct.groupBy({
      by: ["facilityProductId"],
      where: { facilityProduct: { facilityId: { in: facIds } }, status: { not: "UNAVAILABLE" }, booking: { status: { in: ["PENDING", "APPROVED"] }, endAt: { gt: now } } },
      _sum: { quantity: true }, _count: true,
    }).catch(() => []),
  ]);
  const req = new Map(upcomingReq.map((r) => [r.facilityProductId, { qty: r._sum.quantity ?? 0, n: r._count }]));
  const onSale = products.filter((p) => p.isSellable).length;
  const shortage = products.filter((p) => p.isSellable && (req.get(p.id)?.qty ?? 0) > p.stock).length;
  const lowStock = products.filter((p) => p.isSellable && p.stock <= 10).length;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader
        title={adminFacility ? `${adminFacility.name} 상품 관리` : "상품 관리"}
        description="등록한 상품은 셀러의 '판매 상품 둘러보기'와 예약 화면에 노출됩니다. 셀러가 상품을 골라 예약하면 판매 예정 수량을 미리 확인할 수 있어요."
        action={<div className="flex gap-2">
          {!admin && <Link href="/facility/products/scan"><Button variant="outline"><ScanLine className="h-4 w-4" />바코드 등록</Button></Link>}
          <Link href={newProductHref}><Button><Plus className="h-4 w-4" />상품 등록</Button></Link>
        </div>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="판매 중 상품" value={`${onSale}개`} sub={`전체 ${products.length}개`} icon={Package} tone="brand" />
        <Kpi label="다가오는 예약 요청" value={`${upcomingReq.reduce((a, r) => a + r._count, 0)}건`} sub={`${upcomingReq.reduce((a, r) => a + (r._sum.quantity ?? 0), 0).toLocaleString()}개 판매 예정`} icon={CalendarCheck} tone="blue" />
        <Kpi label="재고 부족 예상" value={`${shortage}개`} sub="요청 수량 > 재고" icon={AlertTriangle} tone={shortage ? "red" : "green"} />
        <Kpi label="재고 10개 이하" value={`${lowStock}개`} icon={Radio} tone="navy" />
      </div>

      <FilterBar fields={[
        { type: "search", key: "q", placeholder: "상품명 · SKU" },
        { type: "select", key: "state", label: "상태", options: [{ value: "on", label: "판매중" }, { value: "off", label: "판매 중단" }, { value: "low", label: "재고 10개 이하" }] },
        ...(facilities.length > 1 ? [{ type: "select" as const, key: "facility", label: "창고(스튜디오)", options: facilities.map((f) => ({ value: f.id, label: f.name })) }] : []),
      ]} />

      {facilities.length === 0 ? (
        <EmptyState icon={<Package className="h-10 w-10" />} title="먼저 창고(스튜디오)를 등록하세요" action={<Link href="/facility/register"><Button>창고(스튜디오) 등록</Button></Link>} />
      ) : products.length === 0 ? (
        <EmptyState icon={<Package className="h-10 w-10" />} title={q || state ? "조건에 맞는 상품이 없습니다" : "등록된 상품이 없습니다"}
          description="상품을 등록하면 셀러가 상품을 보고 바로 예약할 수 있습니다."
          action={<Link href={newProductHref}><Button>첫 상품 등록</Button></Link>} />
      ) : (
        <div className="space-y-3">
          {products.map((fp) => {
            const unit = sellerUnitProfit(fp);
            const r = req.get(fp.id);
            const short = !!r && r.qty > fp.stock;
            return (
              <Card key={fp.id} className={fp.isSellable ? "" : "opacity-70"}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
                  <div className="flex min-w-0 flex-1 gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {fp.product.thumbnailUrl ? <img src={fp.product.thumbnailUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl bg-muted object-cover" />
                      : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-muted"><Package className="h-7 w-7 text-slate-300" /></div>}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone={fp.isSellable ? "green" : "gray"}>{fp.isSellable ? "판매중" : "중단"}</Badge>
                        <span className="text-xs text-muted-foreground">{fp.product.category}{fp.product.sku && ` · ${fp.product.sku}`}</span>
                        {facilities.length > 1 && <span className="text-xs text-slate-500">· {fp.facility.name}</span>}
                      </div>
                      <p className="truncate font-bold text-navy">{fp.product.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>판매가 <b className="text-navy">{formatKRW(fp.salePrice)}</b></span>
                        <span className={fp.stock <= 10 ? "font-semibold text-amber-700" : ""}>재고 {fp.stock.toLocaleString()}개</span>
                        {fp.supplyPrice != null
                          ? <span>공급가 <b className="text-navy">{formatKRW(fp.supplyPrice)}</b> · 셀러 마진 {formatKRW(unit)}/개 <span className="text-[11px]">(판매 수수료 차감 전)</span></span>
                          : <span>셀러 수익 {formatKRW(unit)}/개{fp.commissionType === "PERCENT" && ` (${fp.commissionValue}%)`}</span>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">누적 예약 {fp._count.bookingProducts}회</span>
                        <span className="rounded-full bg-purple-50 px-2 py-0.5 font-semibold text-purple-700">라이브 판매 {fp._count.liveSessionProducts}회</span>
                        {r && <span className={`rounded-full px-2 py-0.5 font-semibold ${short ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>다가오는 예약 {r.n}건 · {r.qty.toLocaleString()}개 예정{short && " · 재고 부족"}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 sm:flex-col">
                    <ResourceForm url="/api/facility-products" id={fp.id} fields={EDIT_FIELDS} title="상품 수정" triggerLabel="수정" triggerSize="sm" triggerVariant="outline"
                      initial={{
                        name: fp.product.name, category: fp.product.category, sku: fp.product.sku ?? "", salePrice: fp.salePrice, consumerPrice: fp.consumerPrice, supplyPrice: fp.supplyPrice ?? "",
                        stock: fp.stock, shippingInfo: fp.shippingInfo ?? "", commissionType: fp.commissionType, commissionValue: fp.commissionValue,
                        thumbnailUrl: fp.product.thumbnailUrl ?? "", description: fp.product.description ?? "",
                      }} />
                    <ActionButton url={`/api/facility-products/${fp.id}`} method="PATCH" body={{ isSellable: !fp.isSellable }} size="sm" variant="outline">
                      {fp.isSellable ? "판매 중단" : "판매 재개"}
                    </ActionButton>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
