"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUrlInput } from "@/components/ui/image-url-input";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { BRAND_CATEGORIES } from "@/lib/brands";
import { normalizeCategory, subCategoriesOf } from "@/lib/categories";
import { submitBrandCommand } from "./brand-command";
import { parseOptions } from "@/lib/brands";
import { optionCombos, priceBreakdown, checkPricing, readVariants, PRICE_RULES, TAX_TYPES, type OptionVariant } from "@/lib/brand-pricing";
import { cn, formatKRW } from "@/lib/utils";

type ProductFields = {
  id: string; revision: string; name: string; category: string; description: string; imageUrl: string;
  supplyPrice: number; stock: number; samplePrice: number | null; sampleStock: number; isActive: boolean;
  subCategory: string; sku: string; consumerPrice: number; images: string[]; options: string;
  allowDropship: boolean; allowWarehouse: boolean; shippingFee: number; leadDays: number; sampleLimitPerBuyer: number;
  minSalePrice?: number | null;
  minOrderQty?: number; volume?: string; expiryInfo?: string; ingredients?: string; certification?: string;
  salePrice?: number; priceRule?: string; optionVariants?: unknown; taxType?: string; origin?: string; manufacturer?: string;
  returnShippingFee?: number; exchangeShippingFee?: number;
};

// 상품 정보 고시 항목을 기본으로 펼쳐 보여 줄 카테고리
const NOTICE_CATEGORIES = ["코스메틱", "식품", "건강식품", "농수산물", "유아동"];

const num = (v: string) => (v === "" ? 0 : Math.max(0, Math.round(Number(v) || 0)));

// 브랜드 상품 등록 · 수정 (2026-11-14 셀러브릭스 방식 고도화)
//  ① 기본 정보 ② 가격(공급가 · 판매가 · 정가 · 최저 판매가 · 판매가 정책, 실시간 마진 계산) ③ 옵션 조합별 추가금 · 품절
//  ④ 재고 · 배송 · 교환/반품 ⑤ 샘플 ⑥ 이미지 · 설명 ⑦ 상품 정보 고시
export function BrandProductEditor({ shopId, product, feeRate = 5 }: { shopId: string; product?: ProductFields; feeRate?: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error: boolean }>();
  const [category, setCategory] = useState<string>(normalizeCategory(product?.category) ?? BRAND_CATEGORIES[0]);
  const subs = subCategoriesOf(category);
  // 가격 · 옵션은 입력하는 대로 계산해 보여 준다
  const [price, setPrice] = useState({
    supply: String(product?.supplyPrice ?? ""), sale: product?.salePrice ? String(product.salePrice) : "",
    list: product?.consumerPrice ? String(product.consumerPrice) : "", min: product?.minSalePrice != null ? String(product.minSalePrice) : "",
  });
  const [rule, setRule] = useState<string>(product?.priceRule === "FIXED" ? "FIXED" : "FLEX");
  const [optionText, setOptionText] = useState(product?.options ?? "");
  const groups = parseOptions(optionText);
  const combos = optionCombos(groups);
  const [variants, setVariants] = useState<Record<string, OptionVariant>>(() => Object.fromEntries(readVariants(product?.optionVariants).map((v) => [v.key, v])));
  const b = priceBreakdown({ supplyPrice: num(price.supply), salePrice: num(price.sale), consumerPrice: num(price.list), minSalePrice: price.min === "" ? null : num(price.min) }, feeRate);
  const priceIssue = price.supply === "" ? null : checkPricing({ supplyPrice: num(price.supply), salePrice: num(price.sale), consumerPrice: num(price.list), minSalePrice: price.min === "" ? null : num(price.min), priceRule: rule });
  const setVariant = (key: string, patch: Partial<OptionVariant>) => setVariants((cur) => ({ ...cur, [key]: { ...(cur[key] ?? { key, extra: 0, saleExtra: 0, soldOut: false }), ...patch } }));

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const { samplePrice, supplyPrice, stock, sampleStock, isActive, consumerPrice, shippingFee, leadDays, sampleLimitPerBuyer,
      shipMode, images, minSalePrice, minOrderQty, salePrice, returnShippingFee, exchangeShippingFee, ...fields } = Object.fromEntries(new FormData(form));
    if (priceIssue) { setStatus({ text: priceIssue, error: true }); return; }
    if (shipMode !== "DROPSHIP" && shipMode !== "WAREHOUSE" && shipMode !== "BOTH") {
      setStatus({ text: "배송 방식을 선택하세요. (위탁배송 · 스토리지마켓 입고 · 둘 다)", error: true });
      return;
    }
    setBusy(true);
    setStatus(undefined);
    try {
      await submitBrandCommand({
        ...fields, action: "product", shopId, productId: product?.id, revision: product?.revision, category,
        supplyPrice: Number(supplyPrice), stock: Number(stock), sampleStock: Number(sampleStock),
        samplePrice: samplePrice === "" ? null : Number(samplePrice), isActive: isActive === "on",
        consumerPrice: Number(consumerPrice || 0), shippingFee: Number(shippingFee || 0), leadDays: Number(leadDays || 0),
        sampleLimitPerBuyer: Number(sampleLimitPerBuyer || 0),
        minSalePrice: minSalePrice === "" || minSalePrice == null ? null : Number(minSalePrice),
        minOrderQty: Math.max(1, Number(minOrderQty || 1)),
        allowDropship: shipMode !== "WAREHOUSE", allowWarehouse: shipMode !== "DROPSHIP",
        images: String(images ?? "").split(/\s*\n\s*/).map((v) => v.trim()).filter(Boolean),
        salePrice: Number(salePrice || 0), priceRule: rule, options: optionText,
        optionVariants: combos.flatMap((key) => { const v = variants[key]; return v && (v.extra || v.saleExtra || v.soldOut) ? [{ key, extra: v.extra, saleExtra: v.saleExtra, soldOut: v.soldOut }] : []; }),
        returnShippingFee: Number(returnShippingFee || 0), exchangeShippingFee: Number(exchangeShippingFee || 0),
      });
      if (!product) { form.reset(); setPrice({ supply: "", sale: "", list: "", min: "" }); setOptionText(""); setVariants({}); setRule("FLEX"); }
      setStatus({ text: product ? "상품을 저장했습니다." : "상품을 등록했습니다.", error: false });
      router.refresh();
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "상품을 저장하지 못했습니다.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="min-w-0 space-y-4 p-4 sm:p-5">
      <Section n={1} title="기본 정보">
        <Label className="block sm:col-span-2">상품명<Input name="name" required minLength={2} maxLength={100} defaultValue={product?.name} placeholder="예: 하루 비타민 앰플 50ml" /></Label>
        <Label className="block">카테고리
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {BRAND_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Label>
        <Label className="block">세부 카테고리
          <Select name="subCategory" defaultValue={product?.subCategory ?? ""} key={category}>
            <option value="">선택 안 함</option>
            {subs.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Label>
        <Label className="block">상품 코드(SKU)<Input name="sku" maxLength={60} defaultValue={product?.sku} placeholder="브랜드 관리 코드" /></Label>
        <Label className="block">과세 구분
          <Select name="taxType" defaultValue={product?.taxType === "TAX_FREE" ? "TAX_FREE" : "TAXABLE"}>
            {Object.entries(TAX_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Label>
        <Label className="block">제조사 · 수입사<Input name="manufacturer" maxLength={60} defaultValue={product?.manufacturer ?? ""} /></Label>
        <Label className="block">원산지<Input name="origin" maxLength={60} defaultValue={product?.origin ?? ""} placeholder="예: 대한민국" /></Label>
      </Section>

      <Section n={2} title="가격" hint="공급가는 셀러가 브랜드에 내는 금액(택배비 포함), 판매가는 셀러가 라이브에서 파는 가격이에요.">
        <Label className="block">공급가 (원) *<Input type="number" name="supplyPrice" required min={0} max={100_000_000} value={price.supply} onChange={(e) => setPrice({ ...price, supply: e.target.value })} /></Label>
        <Label className="block">판매가 (원)<Input type="number" name="salePrice" min={0} max={100_000_000} value={price.sale} onChange={(e) => setPrice({ ...price, sale: e.target.value })} placeholder="셀러 권장 판매가" /></Label>
        <Label className="block">정가 · 권장 소비자가 (원)<Input type="number" name="consumerPrice" min={0} max={100_000_000} value={price.list} onChange={(e) => setPrice({ ...price, list: e.target.value })} placeholder="할인 전 가격" /></Label>
        <Label className="block">최저 판매가 (원)<Input type="number" name="minSalePrice" min={0} max={100_000_000} value={price.min} onChange={(e) => setPrice({ ...price, min: e.target.value })} placeholder="비우면 공급가" /></Label>
        <div className="sm:col-span-2" role="radiogroup" aria-label="판매가 정책">
          <p className="mb-1.5 text-sm font-semibold text-navy">판매가 정책</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.entries(PRICE_RULES) as [string, string][]).map(([v, label]) => (
              <label key={v} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm", rule === v ? "border-brand-500 bg-brand-50" : "border-border")}>
                <input type="radio" name="priceRuleUi" value={v} checked={rule === v} onChange={() => setRule(v)} className="mt-1" />
                <span><span className="block font-bold text-navy">{v === "FLEX" ? "자율 판매가" : "판매가 고정"}</span><span className="block text-xs text-slate-500">{label}{v === "FIXED" ? " — 바꾸면 기존 판매 목록도 같은 가격으로 맞춰져요." : " — 처음 가져갈 때는 판매가가 기본값이에요."}</span></span>
              </label>
            ))}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 rounded-xl bg-navy p-3 text-white sm:col-span-2 sm:grid-cols-4" aria-live="polite">
          <div><dt className="text-[11px] text-white/60">할인율 (정가 대비)</dt><dd className="text-lg font-black">{b.discountRate ? `${b.discountRate}%` : "—"}</dd></div>
          <div><dt className="text-[11px] text-white/60">셀러 마진 (1개)</dt><dd className="text-lg font-black text-brand-300">{b.sale ? formatKRW(b.sellerMargin) : "—"}<span className="ml-1 text-xs font-semibold text-white/60">{b.sale ? `${b.sellerMarginRate}%` : ""}</span></dd></div>
          <div><dt className="text-[11px] text-white/60">공급률 (판매가 대비)</dt><dd className="text-lg font-black">{b.sale ? `${b.supplyRate}%` : "—"}</dd></div>
          <div><dt className="text-[11px] text-white/60">브랜드 정산 예상 (수수료 {feeRate}%)</dt><dd className="text-lg font-black">{b.supply ? formatKRW(b.brandNet) : "—"}</dd></div>
        </dl>
        {priceIssue && <p role="alert" className="text-sm font-semibold text-red-700 sm:col-span-2">{priceIssue}</p>}
      </Section>

      <Section n={3} title="옵션" hint="옵션 조합마다 추가 공급가 · 추가 판매가를 붙이거나 품절로 둘 수 있어요. 주문서 결제는 공급가 + 추가 공급가로 계산됩니다.">
        <Label className="block min-w-0 break-keep sm:col-span-2">옵션 <span className="font-normal text-slate-500">(예: 색상:블랙,화이트|사이즈:S,M,L — 최대 3종류)</span>
          <Input name="options" maxLength={500} value={optionText} onChange={(e) => setOptionText(e.target.value)} placeholder="색상:블랙,화이트|사이즈:S,M,L" />
        </Label>
        {groups.length > 0 && (
          <div className="min-w-0 sm:col-span-2">
            <p className="mb-1.5 flex flex-wrap gap-1.5 text-xs">{groups.map((g) => <span key={g.name} className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{g.name} · {g.values.length}개</span>)}<span className="text-slate-500">조합 {combos.length}개{combos.length >= 100 ? " (최대 100개까지)" : ""}</span></p>
            <div className="max-h-80 overflow-auto rounded-xl border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-[11px] text-slate-500"><tr><th className="px-3 py-2">조합</th><th className="px-2 py-2">추가 공급가</th><th className="px-2 py-2">추가 판매가</th><th className="px-2 py-2">결제 공급가</th><th className="px-2 py-2 text-center">품절</th></tr></thead>
                <tbody className="divide-y">
                  {combos.map((key) => {
                    const v = variants[key] ?? { key, extra: 0, saleExtra: 0, soldOut: false };
                    return (
                      <tr key={key} className={v.soldOut ? "bg-slate-50 text-slate-400" : ""}>
                        <td className="px-3 py-1.5 font-semibold">{key}</td>
                        <td className="px-2 py-1.5"><Input type="number" aria-label={`${key} 추가 공급가`} value={v.extra || ""} placeholder="0" onChange={(e) => setVariant(key, { extra: Math.round(Number(e.target.value) || 0) })} className="h-9 w-28" /></td>
                        <td className="px-2 py-1.5"><Input type="number" aria-label={`${key} 추가 판매가`} value={v.saleExtra || ""} placeholder="0" onChange={(e) => setVariant(key, { saleExtra: Math.round(Number(e.target.value) || 0) })} className="h-9 w-28" /></td>
                        <td className="px-2 py-1.5 text-xs font-bold text-navy">{price.supply === "" ? "—" : formatKRW(num(price.supply) + v.extra)}</td>
                        <td className="px-2 py-1.5 text-center"><input type="checkbox" aria-label={`${key} 품절`} checked={v.soldOut} onChange={(e) => setVariant(key, { soldOut: e.target.checked })} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section n={4} title="재고 · 출고">
        <Label className="block">공급 가능 재고<Input type="number" name="stock" required min={0} max={1_000_000} defaultValue={product?.stock ?? 0} /></Label>
        <Label className="block">발주 후 출고 소요일<Input type="number" name="leadDays" min={0} max={60} defaultValue={product?.leadDays ?? 2} /></Label>
        <Label className="block">반품 배송비 (편도, 원)<Input type="number" name="returnShippingFee" min={0} max={1_000_000} defaultValue={product?.returnShippingFee ?? 0} /></Label>
        <Label className="block">교환 배송비 (왕복, 원)<Input type="number" name="exchangeShippingFee" min={0} max={1_000_000} defaultValue={product?.exchangeShippingFee ?? 0} /></Label>
      </Section>
      <fieldset className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-bold text-navy">배송 방식 (필수)</legend>
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3" role="radiogroup" aria-label="배송 방식">
          {([
            ["DROPSHIP", "위탁배송 (브랜드 배송)", "셀러 주문서가 발주서로 들어오면 브랜드가 받는 분에게 바로 보냅니다."],
            ["WAREHOUSE", "스토리지마켓 입고 (스토리지마켓 배송)", "스토리지마켓 창고에 미리 입고하고, 주문이 들어오면 스토리지마켓이 보냅니다."],
            ["BOTH", "둘 다", "셀러가 위탁배송으로 팔 수 있고, 스토리지마켓 입고도 받습니다."],
          ] as const).map(([v, label, desc]) => (
            <label key={v} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="radio" name="shipMode" value={v} required className="mt-1"
                defaultChecked={product ? (v === "BOTH" ? product.allowDropship && product.allowWarehouse : v === "DROPSHIP" ? product.allowDropship && !product.allowWarehouse : !product.allowDropship && product.allowWarehouse) : false} />
              <span><span className="block font-bold text-navy">{label}</span><span className="block text-xs text-slate-500">{desc}</span></span>
            </label>
          ))}
        </div>
        <Label className="block">스토리지마켓 입고 최소 수량 (MOQ)<Input type="number" name="minOrderQty" min={1} max={10000} defaultValue={product?.minOrderQty ?? 1} /></Label>
        <Label className="block">위탁배송 배송비 안내 (원) — 참고용, 택배비는 공급가에 포함해 주세요<Input type="number" name="shippingFee" min={0} max={1_000_000} defaultValue={product?.shippingFee ?? 0} /></Label>
      </fieldset>
      <fieldset className="grid gap-3 rounded-xl border p-3 sm:grid-cols-3">
        <legend className="px-1 text-sm font-bold text-navy">샘플</legend>
        <Label className="block">샘플 단가 (원)<Input type="number" name="samplePrice" min={0} max={100_000_000} defaultValue={product?.samplePrice ?? ""} placeholder="미제공은 비우고, 무료는 0" /></Label>
        <Label className="block">샘플 재고<Input type="number" name="sampleStock" required min={0} max={1_000_000} defaultValue={product?.sampleStock ?? 0} /></Label>
        <Label className="block">계정당 신청 한도 (0 = 무제한)<Input type="number" name="sampleLimitPerBuyer" min={0} max={100} defaultValue={product?.sampleLimitPerBuyer ?? 1} /></Label>
        <p className="text-xs text-slate-600 sm:col-span-3">유료 샘플은 스토리지마켓에서 결제되고, 반려·취소하면 자동 환불됩니다. 샘플 매출은 브랜드 정산에 포함됩니다.</p>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="block sm:col-span-2">대표 이미지<ImageUrlInput name="imageUrl" defaultValue={product?.imageUrl} folder="product" /></Label>
        <Label className="block sm:col-span-2">추가 이미지 주소 (한 줄에 하나, 최대 8개)<Textarea name="images" rows={2} defaultValue={product?.images.join("\n")} placeholder="https://…" /></Label>
        <Label className="block sm:col-span-2">상품 설명<Textarea name="description" rows={3} maxLength={2000} defaultValue={product?.description} /></Label>
      </div>
      <details className="rounded-xl border p-3" open={NOTICE_CATEGORIES.includes(category) || !!(product?.volume || product?.expiryInfo || product?.ingredients || product?.certification)}>
        <summary className="cursor-pointer text-sm font-bold text-navy">상품 정보 고시 <span className="font-normal text-slate-500">(화장품·식품은 입력 권장)</span></summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Label className="block">용량·중량<Input name="volume" maxLength={60} defaultValue={product?.volume ?? ""} placeholder="예: 50ml / 500g" /></Label>
          <Label className="block">유통기한·사용기한<Input name="expiryInfo" maxLength={60} defaultValue={product?.expiryInfo ?? ""} placeholder="예: 제조일로부터 24개월" /></Label>
          <Label className="block sm:col-span-2">전성분·원재료명<Textarea name="ingredients" rows={2} maxLength={3000} defaultValue={product?.ingredients ?? ""} /></Label>
          <Label className="block sm:col-span-2">인증·신고 사항<Input name="certification" maxLength={200} defaultValue={product?.certification ?? ""} placeholder="예: 기능성화장품 심사, KC 인증번호" /></Label>
        </div>
      </details>
      <Label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} />샵에 상품 공개</Label>
      {status && <p role={status.error ? "alert" : "status"} className={status.error ? "text-sm text-red-700" : "text-sm text-emerald-700"}>{status.text}</p>}
      <Button disabled={busy}>{busy ? "저장 중…" : product ? "상품 저장" : "상품 등록"}</Button>
    </form>
  );
}

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid min-w-0 gap-3 rounded-xl border p-3 sm:grid-cols-2 sm:p-4">
      <legend className="flex items-center gap-2 px-1 text-sm font-bold text-navy"><span className="grid h-5 w-5 place-items-center rounded-full bg-navy text-[11px] text-white">{n}</span>{title}</legend>
      {hint && <p className="-mt-1 text-xs leading-5 text-slate-500 sm:col-span-2">{hint}</p>}
      {children}
    </fieldset>
  );
}
