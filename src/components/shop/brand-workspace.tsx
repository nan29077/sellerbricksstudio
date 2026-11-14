import { BulkProductUpload } from "@/components/brand/bulk-product-upload";
import Link from "next/link";
import type { BrandShop, Prisma } from "@prisma/client";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Pagination } from "@/components/list/pagination";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { BRAND_CATEGORIES, BRAND_SHOP_STATUS, brandArtworkFor, brandProductHref } from "@/lib/brands";
import { priceBreakdown } from "@/lib/brand-pricing";
import { generatedBrandProductArtwork } from "@/lib/brand-product-artwork";
import { ShopImage } from "@/components/shop/shop-image";
import { PriceLine, ProductCard, ProductChip, ProductGrid, ViewToggle, viewOf } from "@/components/shop/product-card";
import { categoryFilterValues } from "@/lib/categories";
import { brandFeeRateOf, getPolicy } from "@/lib/policy";
import { pageOf, sp, withParams, type SP } from "@/lib/list";
import { prisma } from "@/lib/prisma";
import { cn, formatKRW } from "@/lib/utils";
import { BrandShopEditor } from "./brand-shop-editor";
import { BrandModeration } from "./brand-moderation";
import { BrandProductEditor } from "./brand-product-editor";

/**
 * 브랜드샵 관리 화면은 두 영역으로 나뉜다.
 *  - BrandShopPanel     : 샵 디자인 · 소개 · 사업자/정산 정보 (+ 최고관리자 승인)
 *  - BrandProductsPanel : 상품 · 재고 · 샘플 조건
 * 브랜드 계정은 /brand/shop, /brand/products 에서 각각, 최고관리자는 /admin/brands/[id] 에서 함께 본다.
 */

export const LOW_STOCK = 10;

/** 샵 정보 완성도 — 공개 샵 신뢰도와 정산에 필요한 항목 */
export function shopChecklist(shop: Pick<BrandShop, "logoUrl" | "tagline" | "description" | "categories" | "csPhone" | "returnAddress" | "businessNumber" | "bankAccount">) {
  return [
    { key: "logo", label: "로고 이미지", done: !!shop.logoUrl },
    { key: "tagline", label: "한 줄 소개", done: !!shop.tagline },
    { key: "description", label: "샵 소개", done: shop.description.length >= 20 },
    { key: "categories", label: "취급 카테고리", done: shop.categories.length > 0 },
    { key: "cs", label: "고객센터 연락처", done: !!shop.csPhone },
    { key: "return", label: "반품 · 교환 주소", done: !!shop.returnAddress },
    { key: "biz", label: "사업자등록번호", done: !!shop.businessNumber },
    { key: "bank", label: "정산 계좌", done: !!shop.bankAccount },
  ];
}

function StatusLine({ shop }: { shop: BrandShop }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
      <Badge tone={shop.status === "APPROVED" ? "green" : "yellow"}>{BRAND_SHOP_STATUS[shop.status]}</Badge>
      {shop.moderationNote || (shop.status === "PENDING" ? "최고관리자 승인 후 브랜드샵 목록에 표시됩니다." : shop.status === "SUSPENDED" ? "공개가 중지되었습니다. 고객센터로 문의해 주세요." : "")}
    </div>
  );
}

export async function BrandShopPanel({ shop, name, admin = false, header = true, isOwner = true }: { shop: BrandShop | null; name: string; admin?: boolean; header?: boolean; isOwner?: boolean }) {
  const policy = admin && shop ? await getPolicy() : null;
  const checklist = shop ? shopChecklist(shop) : [];
  const done = checklist.filter((c) => c.done).length;
  return (
    <div className="space-y-5">
      {header && (
        <PageHeader title={admin ? shop?.name ?? "브랜드샵 관리" : shop ? "내 브랜드샵" : "브랜드샵 만들기"}
          description="샵 디자인, 소개, 사업자 · 정산 정보를 관리합니다. 상품은 '상품 · 재고 관리'에서 따로 관리합니다."
          action={shop ? <div className="flex flex-wrap gap-2">
            {!admin && <Link className={buttonVariants({ variant: "outline" })} href="/brand/products">상품 · 재고 관리</Link>}
            <a className={buttonVariants({ variant: "outline" })} href={`/brands/${shop.id}`} target="_blank" rel="noopener noreferrer">샵 바로가기 (새 창)</a>
          </div> : undefined} />
      )}
      {shop && <StatusLine shop={shop} />}
      {admin && shop && policy && <BrandModeration id={shop.id} status={shop.status} note={shop.moderationNote} feeRate={shop.feeRate} defaultFeeRate={policy.brandFeeRate} />}
      {shop && done < checklist.length && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-extrabold text-navy">샵 정보 완성도 {Math.round((done / checklist.length) * 100)}%</p>
            <span className="text-xs text-slate-600">{done}/{checklist.length}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(done / checklist.length) * 100}%` }} /></div>
          <p className="mt-2 text-xs text-slate-600">채우지 않은 항목: {checklist.filter((c) => !c.done).map((c) => c.label).join(" · ")}</p>
        </div>
      )}
      <BrandShopEditor shop={shop ? {
        id: shop.id, name: shop.name, tagline: shop.tagline, description: shop.description, logoUrl: shop.logoUrl,
        bannerUrl: shop.bannerUrl, backgroundUrl: shop.backgroundUrl, paymentInstructions: shop.paymentInstructions,
        categories: shop.categories, businessNumber: shop.businessNumber, ceoName: shop.ceoName, csPhone: shop.csPhone,
        returnAddress: shop.returnAddress, bankName: shop.bankName, bankAccount: shop.bankAccount, accountHolder: shop.accountHolder,
        requireSellerApproval: shop.requireSellerApproval, lowStockThreshold: shop.lowStockThreshold,
      } : undefined} name={name} isOwner={admin || isOwner} />
    </div>
  );
}

const FILTERS = [
  { value: "", label: "전체" },
  { value: "active", label: "공개" },
  { value: "hidden", label: "숨김" },
  { value: "low", label: `재고 ${LOW_STOCK}개 이하` },
  { value: "soldout", label: "품절" },
  { value: "sample", label: "샘플 가능" },
] as const;

const SORTS = [
  { value: "", label: "최근 등록순" },
  { value: "updated", label: "최근 수정순" },
  { value: "stock", label: "재고 적은 순" },
  { value: "price", label: "공급가 낮은 순" },
  { value: "name", label: "이름순" },
] as const;

export async function BrandProductsPanel({ shop, params, admin = false, header = true }: { shop: BrandShop; params: SP; admin?: boolean; header?: boolean }) {
  const base = admin ? `/admin/brands/${shop.id}` : "/brand/products";
  const q = sp(params, "q")?.slice(0, 100) ?? "";
  const category = BRAND_CATEGORIES.find((value) => value === sp(params, "category"));
  const filter = FILTERS.find((f) => f.value === sp(params, "filter"))?.value ?? "";
  const sort = SORTS.find((s) => s.value === sp(params, "sort"))?.value ?? "";
  const openNew = sp(params, "new") === "1";
  const view = viewOf(params);
  const openId = sp(params, "open");
  const { page, size, skip, take } = pageOf(params);
  const feeRate = brandFeeRateOf(await getPolicy(), shop.feeRate);

  const filterWhere: Record<string, Prisma.BrandProductWhereInput> = {
    "": {}, active: { isActive: true }, hidden: { isActive: false },
    low: { stock: { gt: 0, lte: LOW_STOCK } }, soldout: { stock: 0 }, sample: { isActive: true, sampleStock: { gt: 0 } },
  };
  const where: Prisma.BrandProductWhereInput = {
    shopId: shop.id, ...filterWhere[filter],
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] }),
    ...(category && { category: { in: categoryFilterValues(category) } }),
  };
  const orderBy: Prisma.BrandProductOrderByWithRelationInput =
    sort === "updated" ? { updatedAt: "desc" } : sort === "stock" ? { stock: "asc" } : sort === "price" ? { supplyPrice: "asc" } : sort === "name" ? { name: "asc" } : { createdAt: "desc" };

  const [products, total, counts, channelCounts] = await Promise.all([
    prisma.brandProduct.findMany({ where, orderBy, skip, take }),
    prisma.brandProduct.count({ where }),
    Promise.all([
      prisma.brandProduct.count({ where: { shopId: shop.id } }),
      prisma.brandProduct.count({ where: { shopId: shop.id, isActive: true } }),
      prisma.brandProduct.count({ where: { shopId: shop.id, isActive: false } }),
      prisma.brandProduct.count({ where: { shopId: shop.id, stock: { gt: 0, lte: LOW_STOCK } } }),
      prisma.brandProduct.count({ where: { shopId: shop.id, stock: 0 } }),
      prisma.brandProduct.count({ where: { shopId: shop.id, isActive: true, sampleStock: { gt: 0 } } }),
    ]),
    prisma.brandProduct.findMany({
      where: { shopId: shop.id }, select: { id: true, _count: { select: { sellerListings: true, facilityProducts: true } } },
    }),
  ]);
  const countOf: Record<string, number> = { "": counts[0], active: counts[1], hidden: counts[2], low: counts[3], soldout: counts[4], sample: counts[5] };
  const channels = new Map(channelCounts.map((c) => [c.id, c._count.sellerListings + c._count.facilityProducts]));
  const link = (patch: Record<string, string | null>) => withParams(base, params, { page: null, ...patch });

  return (
    <section id="products" className="scroll-mt-24 space-y-4">
      {header ? (
        <PageHeader title={admin ? "상품 · 재고" : "상품 · 재고 관리"}
          description="공급가 · 권장 소비자가 · 옵션 · 배송 방식(위탁배송 · 스토리지마켓 입고) · 샘플 조건을 상품마다 정합니다."
          action={!admin ? <div className="flex flex-wrap gap-2">
            <Link className={buttonVariants({ variant: "outline" })} href="/brand/shop">샵 꾸미기 · 정보</Link>
            <a className={buttonVariants({ variant: "outline" })} href={`/brands/${shop.id}`} target="_blank" rel="noopener noreferrer">샵 바로가기 (새 창)</a>
          </div> : undefined} />
      ) : (
        <div><h2 className="text-xl font-black text-navy">상품 및 재고</h2>
          <p className="text-sm text-slate-600">공급가 · 권장 소비자가 · 옵션 · 배송 방식(위탁배송 · 스토리지마켓 입고) · 샘플 조건을 상품마다 정합니다.</p></div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {FILTERS.map((f) => (
          <Link key={f.value} href={link({ filter: f.value || null })} aria-current={filter === f.value ? "page" : undefined}
            className={cn("rounded-2xl border px-3 py-2.5 transition hover:border-brand-300",
              filter === f.value ? "border-navy bg-navy text-white" : "bg-white text-navy",
              f.value === "soldout" && countOf[f.value] > 0 && filter !== f.value && "border-rose-200 bg-rose-50",
              f.value === "low" && countOf[f.value] > 0 && filter !== f.value && "border-amber-200 bg-amber-50")}>
            <span className={cn("block text-[11px] font-semibold", filter === f.value ? "text-white/70" : "text-slate-500")}>{f.label}</span>
            <span className="block text-lg font-extrabold">{countOf[f.value].toLocaleString("ko-KR")}</span>
          </Link>
        ))}
      </div>

      <details className="rounded-2xl border bg-white" open={openNew || (!counts[0] && !q && !category)}>
        <summary className="cursor-pointer px-4 py-3 font-bold text-navy">＋ 새 상품 등록</summary>
        <BrandProductEditor shopId={shop.id} feeRate={feeRate} />
      </details>
      {!admin && (
        <details className="rounded-2xl border bg-white">
          <summary className="cursor-pointer px-4 py-3 font-bold text-navy">엑셀(CSV)로 여러 상품 한 번에 등록</summary>
          <div className="border-t"><BulkProductUpload shopId={shop.id} /></div>
        </details>
      )}

      <form action={`${base}#products`} className="flex flex-wrap items-center gap-2">
        {filter && <input type="hidden" name="filter" value={filter} />}
        <Input name="q" aria-label="상품명 또는 SKU" defaultValue={q} placeholder="상품명 · SKU 검색" maxLength={100} className="max-w-xs" />
        <Select name="category" aria-label="카테고리" defaultValue={category ?? ""} className="w-auto">
          <option value="">전체 카테고리</option>
          {BRAND_CATEGORIES.map((value) => <option key={value}>{value}</option>)}
        </Select>
        <Select name="sort" aria-label="정렬" defaultValue={sort} className="w-auto">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
        {view === "list" && <input type="hidden" name="view" value="list" />}
        <Button variant="outline">검색</Button>
        <span className="ml-auto flex items-center gap-2"><span className="text-xs font-bold text-slate-500">{total.toLocaleString("ko-KR")}개</span><ViewToggle base={base} params={params} view={view} /></span>
      </form>

      {!products.length && <p className="rounded-2xl border bg-white px-4 py-6 text-center text-sm text-slate-600">조건에 맞는 상품이 없습니다.</p>}
      {view === "grid" ? (
        <ProductGrid view="grid">
          {products.map((product) => {
            const ch = channels.get(product.id) ?? 0;
            const pb = priceBreakdown(product);
            const artwork = generatedBrandProductArtwork(shop.name, product);
            return (
              <ProductCard key={product.id} href={brandProductHref(shop.id, product.id)} dim={!product.isActive}
                image={product.imageUrl} fallback={artwork?.cover ?? brandArtworkFor(product.category)} title={product.name}
                subtitle={<>{product.category}{product.sku ? ` · ${product.sku}` : ""}</>}
                status={!product.isActive ? { label: "숨김", tone: "gray" } : { label: "판매 중", tone: "green" }}
                cover={product.stock === 0 ? "품절" : undefined}
                price={<PriceLine label="공급" value={formatKRW(product.supplyPrice)} note={pb.sale > 0 ? `판매가 ${formatKRW(pb.sale)}` : product.consumerPrice > 0 ? `소비자가 ${formatKRW(product.consumerPrice)}` : undefined} />}
                chips={[product.stock > 0 && product.stock <= LOW_STOCK && { label: "재고 적음", tone: "amber" }, product.sampleStock > 0 && product.isActive && { label: product.samplePrice ? "유료 샘플" : "무료 샘플", tone: "brand" }, ch > 0 && { label: `판매처 ${ch}곳`, tone: "violet" }]}
                meta={<>재고 {product.stock.toLocaleString("ko-KR")}개 · {[product.allowDropship && "위탁배송", product.allowWarehouse && "창고 입고"].filter(Boolean).join("/") || "배송 방식 없음"}</>}
                actions={<Link href={`${withParams(base, params, { view: "list", open: product.id })}#p-${product.id}`} className={buttonVariants({ size: "sm", className: "h-9 w-full rounded-xl text-xs" })}>수정 · 재고</Link>} />
            );
          })}
        </ProductGrid>
      ) : (
      <div className="space-y-2">
        {products.map((product) => {
          const ch = channels.get(product.id) ?? 0;
          const stockTone = product.stock === 0 ? "text-rose-600" : product.stock <= LOW_STOCK ? "text-amber-600" : "text-slate-600";
          return (
            <details id={`p-${product.id}`} className="group scroll-mt-24 rounded-2xl border bg-white shadow-[0_1px_2px_#1A1A2E0D]" key={product.id} open={openId === product.id}>
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 sm:px-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <ShopImage src={product.imageUrl} fallback={generatedBrandProductArtwork(shop.name, product)?.cover ?? brandArtworkFor(product.category)} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-slate-100 bg-[#F4F0E9] object-cover sm:h-16 sm:w-16" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-bold text-navy">{product.name}</span>
                    {!product.isActive && <ProductChip chip={{ label: "숨김", tone: "gray" }} />}
                    {product.stock === 0 && <ProductChip chip={{ label: "품절", tone: "red" }} />}
                    {product.sampleStock > 0 && product.isActive && <ProductChip chip={{ label: product.samplePrice ? "유료 샘플" : "무료 샘플", tone: "brand" }} />}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {product.category}{product.subCategory ? ` › ${product.subCategory}` : ""}{product.sku ? ` · ${product.sku}` : ""}
                    {" · "}{[product.allowDropship && "위탁배송", product.allowWarehouse && "스토리지마켓 입고"].filter(Boolean).join("/") || "배송 방식 없음"}
                  </span>
                </span>
                <span className="hidden shrink-0 text-right text-xs sm:block">
                  <span className="block font-extrabold text-navy">{formatKRW(product.supplyPrice)}</span>
                  {product.consumerPrice > 0 && <span className="block text-slate-400">소비자가 {formatKRW(product.consumerPrice)}</span>}
                </span>
                <span className="w-20 shrink-0 text-right text-xs">
                  <span className={cn("block font-bold", stockTone)}>재고 {product.stock.toLocaleString("ko-KR")}</span>
                  <span className="block text-slate-400">판매처 {ch}곳</span>
                </span>
              </summary>
              <div className="border-t">
                <BrandProductEditor key={product.updatedAt.toISOString()} shopId={shop.id} product={{
                  id: product.id, revision: product.updatedAt.toISOString(), name: product.name, category: product.category,
                  description: product.description, imageUrl: product.imageUrl, supplyPrice: product.supplyPrice,
                  stock: product.stock, samplePrice: product.samplePrice, sampleStock: product.sampleStock, isActive: product.isActive,
                  subCategory: product.subCategory, sku: product.sku, consumerPrice: product.consumerPrice, images: product.images, options: product.options,
                  allowDropship: product.allowDropship, allowWarehouse: product.allowWarehouse, shippingFee: product.shippingFee,
                  leadDays: product.leadDays, sampleLimitPerBuyer: product.sampleLimitPerBuyer, minSalePrice: product.minSalePrice,
                  minOrderQty: product.minOrderQty, volume: product.volume, expiryInfo: product.expiryInfo, ingredients: product.ingredients, certification: product.certification,
                  salePrice: product.salePrice, priceRule: product.priceRule, optionVariants: product.optionVariants, taxType: product.taxType, origin: product.origin,
                  manufacturer: product.manufacturer, returnShippingFee: product.returnShippingFee, exchangeShippingFee: product.exchangeShippingFee,
                }} feeRate={feeRate} />
              </div>
            </details>
          );
        })}
      </div>
      )}
      <Pagination base={base} params={params} page={page} size={size} total={total} />
    </section>
  );
}

/** 최고관리자용: 샵 정보와 상품을 한 화면에서 */
export async function BrandWorkspace({ shop, name, params, admin = false }: {
  shop: BrandShop | null; name: string; params: SP; admin?: boolean;
}) {
  return (
    <div className="space-y-8">
      <BrandShopPanel shop={shop} name={name} admin={admin} />
      {shop && <BrandProductsPanel shop={shop} params={params} admin={admin} header={false} />}
      {admin && shop && <Link href={`/admin/brands/${shop.id}/requests`} className={buttonVariants({ variant: "outline" })}>이 브랜드의 샘플 · 입고 신청 보기</Link>}
    </div>
  );
}
