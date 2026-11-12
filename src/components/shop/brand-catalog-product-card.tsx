import Link from "next/link";
import { ShopImage } from "@/components/shop/shop-image";
import { cardActionClassName, cardLinkClassName } from "@/components/ui/card";
import { brandArtworkFor, brandProductHref } from "@/lib/brands";
import { generatedBrandProductArtwork } from "@/lib/brand-product-artwork";
import { formatKRW } from "@/lib/utils";

type CatalogProduct = {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  shop: { id: string; name: string };
  supplyPrice: number | null;
  consumerPrice?: number;
  stock?: number;
  samplePrice: number | null;
  sampleStock: number;
};

export function BrandCatalogProductCard({ product, rank }: { product: CatalogProduct; rank?: number }) {
  const artwork = generatedBrandProductArtwork(product.shop.name, product);
  const sample = product.samplePrice !== null && product.sampleStock > 0
    ? (product.samplePrice === 0 ? "무료 샘플" : "유료 샘플") : null;
  const soldOut = product.stock !== undefined && product.stock <= 0;

  return (
    <Link href={brandProductHref(product.shop.id, product.id)} aria-label={`${product.name} 상품 보기`} className={cardLinkClassName}>
      <div className="relative aspect-square overflow-hidden bg-[#F4F0E9]">
        <ShopImage src={product.imageUrl} fallback={artwork?.cover ?? brandArtworkFor(product.category)} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
        {rank !== undefined && <span aria-label={`판매량 ${rank}위`} className="absolute left-2 top-2 grid h-7 min-w-7 place-items-center rounded-lg bg-navy px-1.5 text-xs font-black tabular-nums text-white">{rank}</span>}
      </div>
      <div className="flex flex-1 flex-col px-3 pb-3 pt-3.5 sm:px-4">
        <p className="truncate text-xs font-medium text-slate-600">{product.shop.name}</p>
        <h3 className="mb-2 mt-1 line-clamp-2 min-h-10 break-words text-sm font-extrabold leading-5 tracking-tight text-navy sm:text-base">{product.name}</h3>
        <div className="mt-auto space-y-2 border-t border-slate-100 pt-2.5">
          {product.supplyPrice !== null ? (
            <p className="text-sm font-extrabold text-navy"><span className="mr-1 text-xs font-medium text-slate-600">공급가</span>{formatKRW(product.supplyPrice)}</p>
          ) : (
            <p className="break-keep text-xs font-medium text-slate-600">로그인 후 공급가 공개</p>
          )}
          {!!product.consumerPrice && product.consumerPrice > 0 && <p className="text-xs text-slate-600">소비자가 {formatKRW(product.consumerPrice)}</p>}
          {(sample || soldOut) && (
            <div className="flex flex-wrap gap-1">
              {sample && <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-800">{sample}</span>}
              {soldOut && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">품절</span>}
            </div>
          )}
        </div>
        <span className={`${cardActionClassName} mt-3`}>상품 보기</span>
      </div>
    </Link>
  );
}
