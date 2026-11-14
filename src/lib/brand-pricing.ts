// 브랜드 상품 가격 · 옵션 조합 (2026-11-14, 셀러브릭스 방식)
//  브랜드가 상품을 등록할 때 공급가(셀러가 브랜드에 내는 값)와 판매가(셀러가 라이브에서 파는 값)를 함께 정한다.
//   정가(권장 소비자가) ≥ 판매가 ≥ 최저 판매가 ≥ 공급가
//   priceRule FLEX  — 셀러가 최저 판매가 이상에서 판매가를 정한다 (기본값은 브랜드 판매가)
//   priceRule FIXED — 판매가 고정. 셀러 판매가 = 브랜드 판매가
//  옵션 조합별로 추가 공급가 · 추가 판매가 · 품절을 둘 수 있다. 주문서 결제는 공급가 + 추가 공급가.
// (브라우저 · 서버 공용 — DB를 쓰지 않는다)

export type OptionGroupLike = { name: string; values: string[] };
export type OptionVariant = { key: string; extra: number; saleExtra: number; soldOut: boolean };
export const PRICE_RULES = { FLEX: "셀러가 최저 판매가 이상에서 정함", FIXED: "판매가 고정 (모든 셀러 같은 가격)" } as const;
export type PriceRule = keyof typeof PRICE_RULES;
export const TAX_TYPES = { TAXABLE: "과세", TAX_FREE: "면세" } as const;
export const MAX_VARIANTS = 100;

/** 옵션 조합 목록: [["블랙","S"], ...] → "블랙 / S" */
export function optionCombos(groups: OptionGroupLike[]): string[] {
  if (!groups.length) return [];
  let out: string[][] = [[]];
  for (const g of groups) out = out.flatMap((prefix) => g.values.map((v) => [...prefix, v]));
  return out.slice(0, MAX_VARIANTS).map((c) => c.join(" / "));
}

/** 주문서 · 예약의 정규 옵션 표기("색상:블랙 / 사이즈:S")를 조합 키("블랙 / S")로 */
export function variantKeyOf(label: string | null | undefined): string {
  return (label ?? "").split(/\s*\/\s*/).map((p) => (p.includes(":") ? p.split(":").slice(1).join(":") : p).trim()).filter(Boolean).join(" / ");
}

/** 저장된 JSON을 안전하게 읽는다 (옵션에서 사라진 조합은 버린다) */
export function readVariants(raw: unknown, groups?: OptionGroupLike[]): OptionVariant[] {
  const combos = groups ? new Set(optionCombos(groups)) : null;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((v) => {
    if (!v || typeof v !== "object") return [];
    const o = v as Record<string, unknown>;
    const key = typeof o.key === "string" ? o.key.trim() : typeof o.label === "string" ? o.label.trim() : "";
    if (!key || (combos && !combos.has(key))) return [];
    const extra = Math.round(Number(o.extra) || 0), saleExtra = Math.round(Number(o.saleExtra) || 0);
    const soldOut = o.soldOut === true;
    if (!extra && !saleExtra && !soldOut) return [];
    return [{ key, extra, saleExtra, soldOut }];
  }).slice(0, MAX_VARIANTS);
}

export function variantOf(variants: OptionVariant[], label: string | null | undefined) {
  const key = variantKeyOf(label);
  return key ? variants.find((v) => v.key === key) ?? null : null;
}

/** 가격 계산 (등록 화면 미리보기 · 상품 화면 표시) */
export function priceBreakdown(p: { supplyPrice: number; salePrice?: number | null; consumerPrice?: number | null; minSalePrice?: number | null }, feeRate = 0) {
  const supply = Math.max(0, p.supplyPrice || 0);
  const sale = p.salePrice && p.salePrice > 0 ? p.salePrice : 0;
  const list = p.consumerPrice && p.consumerPrice > 0 ? p.consumerPrice : 0;
  const margin = sale ? sale - supply : 0;
  const fee = Math.round((supply * feeRate) / 100);
  return {
    supply, sale, list,
    discountRate: list && sale && sale < list ? Math.round(((list - sale) / list) * 100) : 0,
    sellerMargin: margin,
    sellerMarginRate: sale ? Math.round((margin / sale) * 1000) / 10 : 0,
    supplyRate: sale ? Math.round((supply / sale) * 1000) / 10 : 0,
    platformFee: fee,
    brandNet: supply - fee,
    floor: Math.max(supply, p.minSalePrice ?? 0),
  };
}

/** 등록 · 수정 값 검사 — 문제가 있으면 안내 문구 */
export function checkPricing(d: { supplyPrice: number; salePrice: number; consumerPrice: number; minSalePrice?: number | null; priceRule: string }): string | null {
  if (d.salePrice > 0 && d.salePrice < d.supplyPrice) return "판매가는 공급가보다 낮을 수 없습니다.";
  if (d.minSalePrice != null && d.minSalePrice < d.supplyPrice) return "최저 판매가는 공급가보다 낮을 수 없습니다.";
  if (d.salePrice > 0 && d.minSalePrice != null && d.salePrice < d.minSalePrice) return "판매가는 최저 판매가보다 낮을 수 없습니다.";
  if (d.consumerPrice > 0 && d.salePrice > d.consumerPrice) return "판매가는 정가(권장 소비자가)보다 높을 수 없습니다.";
  if (d.priceRule === "FIXED" && !(d.salePrice > 0)) return "판매가 고정으로 하려면 판매가를 입력하세요.";
  return null;
}

/** 셀러가 고를 수 있는 판매가인지 */
export function checkSellerPrice(p: { supplyPrice: number; salePrice: number; minSalePrice?: number | null; priceRule: string }, sellerPrice: number): string | null {
  if (p.priceRule === "FIXED" && p.salePrice > 0 && sellerPrice !== p.salePrice) return `이 상품은 판매가가 ${p.salePrice.toLocaleString()}원으로 고정되어 있습니다.`;
  const floor = Math.max(p.supplyPrice, p.minSalePrice ?? 0);
  if (sellerPrice < floor) return `판매가는 ${floor.toLocaleString()}원 이상이어야 합니다.`;
  return null;
}

/** 셀러가 처음 가져올 때의 판매가 */
export function defaultSellerPrice(p: { supplyPrice: number; salePrice: number; consumerPrice: number; minSalePrice?: number | null }) {
  const floor = Math.max(p.supplyPrice, p.minSalePrice ?? 0);
  return Math.max(floor, p.salePrice || p.consumerPrice || floor);
}
