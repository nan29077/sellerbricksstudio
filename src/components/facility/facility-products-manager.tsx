import { PriceLine, ProductCard, ProductGrid, ProductToolbar, ViewToggle, viewOf } from "@/components/shop/product-card";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { operableFacilityIds } from "@/lib/facility-owner";
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
  { name: "supplyPrice", label: "셀러 공급가(원)", type: "number", min: 0, half: true, help: "판매되면 공간이 받는 금액입니다. 셀러는 판매가 − 판매 수수료 − 공급가를 받고, 공급가 이상으로 판매가를 바꿀 수 있습니다. 비우면 아래 셀러 수수료 방식으로 계산합니다." },
  { name: "stock", label: "재고", type: "number", min: 0, half: true, required: true },
  { name: "shippingInfo", label: "배송 정보", half: true, placeholder: "3,000원 (5만원 이상 무료)" },
  { name: "commissionType", label: "셀러 수수료 방식", type: "select", options: [{ value: "PERCENT", label: "정률 (%)" }, { value: "FIXED", label: "정액 (원)" }], half: true },
  { name: "commissionValue", label: "셀러 수수료 값", type: "number", min: 0, half: true },
  { name: "thumbnailUrl", label: "대표 이미지 URL", type: "url" },
  { name: "description", label: "상품 설명", type: "textarea", help: "셀러가 상품을 고를 때 보는 설명입니다. 특징·구성·방송 포인트를 적어주세요." },
];

export async function FacilityProductsManager({ searchParams, admin = false }: { searchParams: SP; admin?: boolean }) {
  const user = await requireRole(admin ? ["SUPER_ADMIN"] : ["SUPER_ADMIN", "MANAGER"]);
  const q = sp(searchParams, "q");
  const view = viewOf(searchParams);
  const state = sp(searchParams, "state");
  const fid = sp(searchParams, "facility");
  const adminFacility = admin && fid ? await prisma.facility.findUnique({ where: { id: fid }, select: { id: true, name: true } }) : null;
  if (admin && !adminFacility) notFound();
  const facIds = adminFacility ? [adminFacility.id] : await operableFacilityIds(user);
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
      include: { product: { include: { images: { select: { url: true }, take: 1, orderBy: { sortOrder: "asc" } } } }, brandProduct: { select: { imageUrl: true } }, facility: { select: { name: true } }, _count: { select: { bookingProducts: true, liveSessionProducts: true } } },
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
        ...(facilities.length > 1 ? [{ type: "select" as const, key: "facility", label: "공간", options: facilities.map((f) => ({ value: f.id, label: f.name })) }] : []),
      ]} />

      {facilities.length === 0 ? (
        <EmptyState icon={<Package className="h-10 w-10" />} title="먼저 공간을 등록하세요" action={<Link href="/facility/register"><Button>공간 등록</Button></Link>} />
      ) : products.length === 0 ? (
        <EmptyState icon={<Package className="h-10 w-10" />} title={q || state ? "조건에 맞는 상품이 없습니다" : "등록된 상품이 없습니다"}
          description="상품을 등록하면 셀러가 상품을 보고 바로 예약할 수 있습니다."
          action={<Link href={newProductHref}><Button>첫 상품 등록</Button></Link>} />
      ) : (
        <>
        <ProductToolbar count={products.length} toggle={<ViewToggle base={admin ? "/admin/facility-products" : "/facility/products"} params={searchParams} view={view} />} />
        <ProductGrid view={view}>
          {products.map((fp) => {
            const unit = sellerUnitProfit(fp);
            const r = req.get(fp.id);
            const short = !!r && r.qty > fp.stock;
            return (
              <ProductCard key={fp.id} view={view} dim={!fp.isSellable} hideDetail
                image={fp.product.thumbnailUrl ?? fp.product.images[0]?.url ?? fp.brandProduct?.imageUrl} fallback="/images/placeholder/product.svg" title={fp.product.name}
                brand={facilities.length > 1 ? { name: fp.facility.name } : undefined}
                status={fp.isSellable ? { label: "판매 중", tone: "green" } : { label: "판매 중단", tone: "gray" }}
                cover={fp.stock <= 0 ? "품절" : undefined}
                subtitle={<>{fp.product.category}{fp.product.sku && ` · ${fp.product.sku}`}</>}
                price={<PriceLine label="판매가" value={formatKRW(fp.salePrice)}
                  note={<span className="text-purple-700">{fp.supplyPrice != null ? `공급 ${formatKRW(fp.supplyPrice)} · 셀러 마진 ${formatKRW(unit)}` : `셀러 수익 ${formatKRW(unit)}${fp.commissionType === "PERCENT" ? ` (${fp.commissionValue}%)` : ""}`}</span>} />}
                chips={[fp.stock > 0 && fp.stock <= 10 && { label: "재고 적음", tone: "amber" }, r && { label: `예약 ${r.n}건 · ${r.qty.toLocaleString()}개${short ? " · 부족" : ""}`, tone: short ? "red" : "green" }]}
                meta={<>재고 {fp.stock.toLocaleString()}개 · 누적 예약 {fp._count.bookingProducts}회 · 라이브 {fp._count.liveSessionProducts}회</>}
                actions={<div className="flex gap-1.5 [&>button]:h-9 [&>button]:flex-1 [&>button]:px-1 [&>button]:text-xs">
                  <ResourceForm url="/api/facility-products" id={fp.id} fields={EDIT_FIELDS} title="상품 수정" triggerLabel="수정" triggerSize="sm" triggerVariant="outline"
                    initial={{
                      name: fp.product.name, category: fp.product.category, sku: fp.product.sku ?? "", salePrice: fp.salePrice, consumerPrice: fp.consumerPrice, supplyPrice: fp.supplyPrice ?? "",
                      stock: fp.stock, shippingInfo: fp.shippingInfo ?? "", commissionType: fp.commissionType, commissionValue: fp.commissionValue,
                      thumbnailUrl: fp.product.thumbnailUrl ?? "", description: fp.product.description ?? "",
                    }} />
                  <ActionButton url={`/api/facility-products/${fp.id}`} method="PATCH" body={{ isSellable: !fp.isSellable }} size="sm" variant="outline">
                    {fp.isSellable ? "판매 중단" : "판매 재개"}
                  </ActionButton>
                </div>} />
            );
          })}
        </ProductGrid>
        </>
      )}
    </div>
  );
}
