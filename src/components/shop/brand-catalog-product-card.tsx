import { PriceLine, ProductCard } from "@/components/shop/product-card";
import { brandArtworkFor, brandProductHref } from "@/lib/brands";
import { generatedBrandProductArtwork } from "@/lib/brand-product-artwork";
import { formatKRW } from "@/lib/utils";

type CatalogProduct = {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  shop: { id: string; name: string; logoUrl?: string | null };
  supplyPrice: number | null;
  consumerPrice?: number;
  stock?: number;
  samplePrice: number | null;
  sampleStock: number;
};

// 메인 · 브랜드 목록의 상품 카드 — 공통 상품 카드(ProductCard) 모양을 쓴다 (2026-11-14)
export function BrandCatalogProductCard({ product, rank, base = "/brands" }: { product: CatalogProduct; rank?: number; base?: string }) {
  const artwork = generatedBrandProductArtwork(product.shop.name, product);
  const sample = product.samplePrice !== null && product.sampleStock > 0;
  const soldOut = product.stock !== undefined && product.stock <= 0;
  return (
    <ProductCard as="div" className="h-full" href={brandProductHref(product.shop.id, product.id, base)}
      image={product.imageUrl} fallback={artwork?.cover ?? brandArtworkFor(product.category)} title={product.name}
      brand={{ name: product.shop.name }} cover={soldOut ? "품절" : undefined}
      corner={rank !== undefined ? <span aria-label={`판매량 ${rank}위`} className="grid h-7 min-w-7 place-items-center rounded-lg bg-navy px-1.5 text-xs font-black tabular-nums text-white">{rank}</span> : undefined}
      price={product.supplyPrice !== null
        ? <PriceLine label="공급" value={formatKRW(product.supplyPrice)} note={product.consumerPrice ? `소비자가 ${formatKRW(product.consumerPrice)}` : undefined} />
        : <p className="text-xs font-semibold text-slate-500">로그인 후 공급가 공개</p>}
      chips={[sample && { label: product.samplePrice === 0 ? "무료 샘플" : "유료 샘플", tone: "brand" }]}
      detailLabel="상품 보기" />
  );
}
