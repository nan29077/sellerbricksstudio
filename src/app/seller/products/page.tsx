import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { FilterBar } from "@/components/list/filter-bar";
import { Pagination } from "@/components/list/pagination";
import { Kpi } from "@/components/list/charts";
import { EmptyState } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { ProductMarket, type MarketItem } from "@/components/booking/product-market";
import { pageOf, sp, type SP } from "@/lib/list";
import { CalendarPlus, Package, Warehouse, Percent, Boxes } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/seller/products";

// 셀러: 창고(스튜디오)들이 등록한 판매 상품을 둘러보고, 고른 상품으로 바로 그 창고를 예약
export default async function SellerProducts({ searchParams }: { searchParams: SP }) {
  await requireRole(["SELLER"]);
  const q = sp(searchParams, "q");
  const category = sp(searchParams, "category");
  const region = sp(searchParams, "region");
  const type = sp(searchParams, "type");
  const sort = sp(searchParams, "sort") ?? "popular";
  const stockOnly = sp(searchParams, "stock") === "1";
  const { page, size, skip, take } = pageOf(searchParams, 24);

  const where: Prisma.FacilityProductWhereInput = {
    isSellable: true,
    facility: { status: "APPROVED", ...(region && { region }), ...(type && { type: type as any }) },
    ...(stockOnly && { stock: { gt: 0 } }),
    ...(category && { product: { category } }),
    ...(q && { OR: [
      { product: { name: { contains: q, mode: "insensitive" } } },
      { product: { description: { contains: q, mode: "insensitive" } } },
      { facility: { name: { contains: q, mode: "insensitive" } } },
    ] }),
  };
  const orderBy: Prisma.FacilityProductOrderByWithRelationInput[] =
    sort === "commission" ? [{ commissionValue: "desc" }] :
    sort === "price_asc" ? [{ salePrice: "asc" }] :
    sort === "price_desc" ? [{ salePrice: "desc" }] :
    sort === "stock" ? [{ stock: "desc" }] :
    sort === "new" ? [{ createdAt: "desc" }] :
    [{ bookingProducts: { _count: "desc" } }, { createdAt: "desc" }];

  const [rows, total, cats, regions, facilityCount, avgComm] = await Promise.all([
    prisma.facilityProduct.findMany({
      where, orderBy, skip, take,
      include: {
        product: { select: { name: true, category: true, description: true, thumbnailUrl: true, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } } } },
        facility: { select: { id: true, name: true, type: true, region: true, rating: true, autoApprove: true } },
        _count: { select: { bookingProducts: true } },
      },
    }).catch(() => []),
    prisma.facilityProduct.count({ where }).catch(() => 0),
    prisma.product.findMany({ where: { facilityProducts: { some: { isSellable: true, facility: { status: "APPROVED" } } } }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }).catch(() => []),
    prisma.facility.findMany({ where: { status: "APPROVED" }, distinct: ["region"], select: { region: true }, orderBy: { region: "asc" } }).catch(() => []),
    prisma.facility.count({ where: { status: "APPROVED", products: { some: { isSellable: true } } } }).catch(() => 0),
    prisma.facilityProduct.aggregate({ where: { isSellable: true, commissionType: "PERCENT", facility: { status: "APPROVED" } }, _avg: { commissionValue: true } }).catch(() => ({ _avg: { commissionValue: null } })),
  ]);

  const items: MarketItem[] = rows.map((r) => ({
    id: r.id, name: r.product.name, category: r.product.category, description: r.product.description,
    image: r.product.thumbnailUrl ?? r.product.images[0]?.url ?? null,
    salePrice: r.salePrice, consumerPrice: r.consumerPrice, stock: r.stock, shippingInfo: r.shippingInfo,
    commissionType: r.commissionType, commissionValue: r.commissionValue, bookedCount: r._count.bookingProducts, supplyPrice: r.supplyPrice,
    facility: { id: r.facility.id, name: r.facility.name, type: r.facility.type, region: r.facility.region, rating: r.facility.rating, autoApprove: r.facility.autoApprove },
  }));

  return (
    <div className="space-y-5 pb-36 md:pb-24">
      <PageHeader
        title="판매 상품 둘러보기"
        description="창고(스튜디오)가 등록한 상품을 보고 방송할 상품을 담으세요. 담은 상품의 창고(스튜디오)로 바로 예약할 수 있고, 이용료는 무료입니다."
        action={<Link href="/seller/bookings/new"><Button variant="outline"><CalendarPlus className="h-4 w-4" />장소부터 예약</Button></Link>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="판매 가능 상품" value={`${total.toLocaleString()}개`} sub={q || category || region || type ? "검색 조건 기준" : "전체"} icon={Package} tone="brand" />
        <Kpi label="상품 보유 창고(스튜디오)" value={`${facilityCount}곳`} icon={Warehouse} tone="blue" />
        <Kpi label="평균 셀러 수수료" value={avgComm._avg.commissionValue ? `${avgComm._avg.commissionValue.toFixed(1)}%` : "-"} sub="정률 상품 기준" icon={Percent} tone="purple" />
        <Kpi label="이용료" value="무료" sub="창고·스튜디오 예약" icon={Boxes} tone="green" />
      </div>

      <FilterBar fields={[
        { type: "search", key: "q", placeholder: "상품명 · 설명 · 창고(스튜디오)명" },
        { type: "select", key: "category", label: "카테고리", options: cats.map((c) => ({ value: c.category, label: c.category })) },
        { type: "select", key: "region", label: "지역", options: regions.map((r) => ({ value: r.region, label: r.region })) },
        { type: "select", key: "type", label: "유형", options: [{ value: "STUDIO", label: "스튜디오" }, { value: "WAREHOUSE", label: "창고" }] },
        { type: "select", key: "sort", label: "정렬", options: [
          { value: "popular", label: "많이 예약된 순" }, { value: "commission", label: "수수료 높은 순" }, { value: "new", label: "최신 등록 순" },
          { value: "price_asc", label: "가격 낮은 순" }, { value: "price_desc", label: "가격 높은 순" }, { value: "stock", label: "재고 많은 순" },
        ] },
        { type: "select", key: "stock", label: "재고", options: [{ value: "1", label: "재고 있는 상품만" }] },
      ]} />

      {items.length === 0 ? (
        <EmptyState icon={<Package className="h-10 w-10" />} title={q || category || region || type ? "조건에 맞는 상품이 없습니다" : "아직 등록된 판매 상품이 없습니다"}
          description="창고(스튜디오)가 상품을 등록하면 이곳에 표시됩니다. 상품 없이도 장소를 예약할 수 있어요."
          action={<Link href="/seller/bookings/new"><Button>장소 예약하기</Button></Link>} />
      ) : (
        <>
          <ProductMarket items={items} />
          <Pagination base={BASE} params={searchParams} page={page} size={size} total={total} />
        </>
      )}
    </div>
  );
}
