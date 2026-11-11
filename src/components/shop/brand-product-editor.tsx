"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUrlInput } from "@/components/ui/image-url-input";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { BRAND_CATEGORIES } from "@/lib/brands";
import { normalizeCategory, subCategoriesOf } from "@/lib/categories";
import { submitBrandCommand } from "./brand-command";

type ProductFields = {
  id: string; revision: string; name: string; category: string; description: string; imageUrl: string;
  supplyPrice: number; stock: number; samplePrice: number | null; sampleStock: number; isActive: boolean;
  subCategory: string; sku: string; consumerPrice: number; images: string[]; options: string;
  allowDropship: boolean; allowWarehouse: boolean; shippingFee: number; leadDays: number; sampleLimitPerBuyer: number;
  minSalePrice?: number | null;
};

export function BrandProductEditor({ shopId, product }: { shopId: string; product?: ProductFields }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error: boolean }>();
  const [category, setCategory] = useState<string>(normalizeCategory(product?.category) ?? BRAND_CATEGORIES[0]);
  const subs = subCategoriesOf(category);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const { samplePrice, supplyPrice, stock, sampleStock, isActive, consumerPrice, shippingFee, leadDays, sampleLimitPerBuyer,
      allowDropship, allowWarehouse, images, minSalePrice, ...fields } = Object.fromEntries(new FormData(form));
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
        allowDropship: allowDropship === "on", allowWarehouse: allowWarehouse === "on",
        images: String(images ?? "").split(/\s*\n\s*/).map((v) => v.trim()).filter(Boolean),
      });
      if (!product) form.reset();
      setStatus({ text: product ? "상품을 저장했습니다." : "상품을 등록했습니다.", error: false });
      router.refresh();
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "상품을 저장하지 못했습니다.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="block">상품명<Input name="name" required minLength={2} maxLength={100} defaultValue={product?.name} /></Label>
        <Label className="block">상품 코드(SKU)<Input name="sku" maxLength={60} defaultValue={product?.sku} /></Label>
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
        <Label className="block">공급 단가 (원)<Input type="number" name="supplyPrice" required min={0} max={100_000_000} defaultValue={product?.supplyPrice} /></Label>
        <Label className="block">권장 소비자가 (원)<Input type="number" name="consumerPrice" min={0} max={100_000_000} defaultValue={product?.consumerPrice || ""} /></Label>
        <Label className="block">최저 판매가 (원, 선택)<Input type="number" name="minSalePrice" min={0} max={100_000_000} defaultValue={product?.minSalePrice ?? ""} placeholder="비우면 공급가" /></Label>
        <Label className="block">공급 가능 재고<Input type="number" name="stock" required min={0} max={1_000_000} defaultValue={product?.stock ?? 0} /></Label>
        <Label className="block">발주 후 출고 소요일<Input type="number" name="leadDays" min={0} max={60} defaultValue={product?.leadDays ?? 2} /></Label>
        <Label className="block sm:col-span-2">옵션 <span className="font-normal text-slate-500">(예: 색상:블랙,화이트|사이즈:S,M,L — 최대 3종류)</span>
          <Input name="options" maxLength={500} defaultValue={product?.options} placeholder="색상:블랙,화이트|사이즈:S,M,L" />
        </Label>
      </div>
      <fieldset className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-bold text-navy">판매 방식</legend>
        <Label className="flex items-center gap-2"><input type="checkbox" name="allowDropship" defaultChecked={product?.allowDropship ?? true} />브랜드 직배송 허용 (판매 시 발주서 → 브랜드가 구매자에게 발송)</Label>
        <Label className="flex items-center gap-2"><input type="checkbox" name="allowWarehouse" defaultChecked={product?.allowWarehouse ?? true} />창고 입고(위탁) 허용 (창고에 미리 입고 → 창고가 출고)</Label>
        <Label className="block">직배송 배송비 안내 (원)<Input type="number" name="shippingFee" min={0} max={1_000_000} defaultValue={product?.shippingFee ?? 0} /></Label>
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
      <Label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} />샵에 상품 공개</Label>
      {status && <p role={status.error ? "alert" : "status"} className={status.error ? "text-sm text-red-700" : "text-sm text-emerald-700"}>{status.text}</p>}
      <Button disabled={busy}>{busy ? "저장 중…" : product ? "상품 저장" : "상품 등록"}</Button>
    </form>
  );
}
