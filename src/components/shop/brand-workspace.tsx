import Link from "next/link";
import type { BrandShop } from "@prisma/client";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Pagination } from "@/components/list/pagination";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { BRAND_CATEGORIES, BRAND_SHOP_STATUS } from "@/lib/brands";
import { pageOf, sp, type SP } from "@/lib/list";
import { prisma } from "@/lib/prisma";
import { formatKRW } from "@/lib/utils";
import { BrandShopEditor } from "./brand-shop-editor";
import { BrandModeration } from "./brand-moderation";
import { BrandProductEditor } from "./brand-product-editor";

export async function BrandWorkspace({ shop, name, params, admin = false }: {
  shop: BrandShop | null; name: string; params: SP; admin?: boolean;
}) {
  const base = admin && shop ? `/admin/brands/${shop.id}` : "/brand/dashboard";
  const q = sp(params, "q")?.slice(0, 100) ?? "";
  const category = BRAND_CATEGORIES.find((value) => value === sp(params, "category"));
  const { page, size, skip, take } = pageOf(params);
  const where = {
    shopId: shop?.id, ...(q && { name: { contains: q, mode: "insensitive" as const } }), ...(category && { category }),
  };
  const [products, total] = shop ? await Promise.all([
    prisma.brandProduct.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.brandProduct.count({ where }),
  ]) : [[], 0];

  return (
    <div className="space-y-5">
      <PageHeader title={admin ? shop?.name ?? "브랜드샵 관리" : "내 브랜드샵"}
        description="샵 디자인, 판매 상품, 공급 재고와 샘플 주문을 관리합니다."
        action={shop ? <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline" })} href={admin ? `/admin/brands/${shop.id}/requests` : "/brand/requests"}>신청 관리</Link>
          <Link className={buttonVariants({ variant: "outline" })} href={`/brands/${shop.id}`}>샵 보기</Link>
        </div> : undefined} />
      {shop && <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <Badge tone={shop.status === "APPROVED" ? "green" : "yellow"}>{BRAND_SHOP_STATUS[shop.status]}</Badge>
        {shop.moderationNote || (shop.status === "PENDING" ? "최고관리자 승인 후 브랜드샵 목록에 표시됩니다." : "")}
      </div>}
      {admin && shop && <BrandModeration id={shop.id} status={shop.status} note={shop.moderationNote} />}
      <BrandShopEditor shop={shop ? {
        id: shop.id, name: shop.name, tagline: shop.tagline, description: shop.description, logoUrl: shop.logoUrl,
        bannerUrl: shop.bannerUrl, backgroundUrl: shop.backgroundUrl, paymentInstructions: shop.paymentInstructions,
      } : undefined} name={name} />
      {shop && <section id="products" className="scroll-mt-24 space-y-3">
        <div><h2 className="text-xl font-black text-navy">상품 및 재고</h2>
          <p className="text-sm text-slate-600">공급용과 샘플용 재고를 각각 입력할 수 있습니다.</p></div>
        <details className="rounded-2xl border bg-white" open={!total && !q && !category}>
          <summary className="cursor-pointer px-4 py-3 font-bold text-navy">새 상품 등록</summary>
          <BrandProductEditor shopId={shop.id} />
        </details>
        <form action={`${base}#products`} className="flex flex-wrap items-center gap-2">
          <Input name="q" aria-label="상품명" defaultValue={q} placeholder="상품명 검색" maxLength={100} className="max-w-sm" />
          <Select name="category" aria-label="카테고리" defaultValue={category ?? ""} className="w-auto">
            <option value="">전체 카테고리</option>
            {BRAND_CATEGORIES.map((value) => <option key={value}>{value}</option>)}
          </Select>
          <Button variant="outline">검색</Button>
        </form>
        {!products.length && <p className="px-1 py-2 text-sm text-slate-600">조건에 맞는 상품이 없습니다.</p>}
        {products.map((product) => (
          <details className="rounded-2xl border bg-white" key={product.id}>
            <summary className="cursor-pointer px-4 py-3">
              <span className="font-bold text-navy">{product.name}</span>
              <span className="ml-2 text-xs text-slate-600">{product.category} · {formatKRW(product.supplyPrice)} · 공급 {product.stock}개 · 샘플 {product.sampleStock}개 · {product.isActive ? "공개" : "숨김"}</span>
            </summary>
            <BrandProductEditor key={product.updatedAt.toISOString()} shopId={shop.id} product={{
              id: product.id, revision: product.updatedAt.toISOString(), name: product.name, category: product.category,
              description: product.description, imageUrl: product.imageUrl, supplyPrice: product.supplyPrice,
              stock: product.stock, samplePrice: product.samplePrice, sampleStock: product.sampleStock, isActive: product.isActive,
            }} />
          </details>
        ))}
        <Pagination base={base} params={params} page={page} size={size} total={total} />
      </section>}
    </div>
  );
}
