"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { BRAND_CATEGORIES } from "@/lib/brands";
import { submitBrandCommand } from "./brand-command";

type ProductFields = {
  id: string; revision: string; name: string; category: string; description: string; imageUrl: string;
  supplyPrice: number; stock: number; samplePrice: number | null; sampleStock: number; isActive: boolean;
};

export function BrandProductEditor({ shopId, product }: { shopId: string; product?: ProductFields }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error: boolean }>();

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const { samplePrice, supplyPrice, stock, sampleStock, isActive, ...fields } = Object.fromEntries(new FormData(form));
    setBusy(true);
    setStatus(undefined);
    try {
      await submitBrandCommand({
        ...fields, action: "product", shopId, productId: product?.id, revision: product?.revision,
        supplyPrice: Number(supplyPrice), stock: Number(stock), sampleStock: Number(sampleStock),
        samplePrice: samplePrice === "" ? null : Number(samplePrice), isActive: isActive === "on",
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
        <Label className="block">카테고리
          <Select name="category" defaultValue={product?.category}>
            {BRAND_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </Select>
        </Label>
        <Label className="block">공급 단가 (원)<Input type="number" name="supplyPrice" required min={0} max={100_000_000} defaultValue={product?.supplyPrice} /></Label>
        <Label className="block">공급 가능 재고<Input type="number" name="stock" required min={0} max={1_000_000} defaultValue={product?.stock ?? 0} /></Label>
        <Label className="block">샘플 단가 (원)<Input type="number" name="samplePrice" min={0} max={100_000_000} defaultValue={product?.samplePrice ?? ""} placeholder="미제공은 비워두고, 무료는 0" /></Label>
        <Label className="block">샘플 재고<Input type="number" name="sampleStock" required min={0} max={1_000_000} defaultValue={product?.sampleStock ?? 0} /></Label>
        <Label className="block sm:col-span-2">상품 이미지 주소<Input name="imageUrl" defaultValue={product?.imageUrl} placeholder="https://…" maxLength={500} /></Label>
        <Label className="block sm:col-span-2">상품 설명<Textarea name="description" rows={3} maxLength={2000} defaultValue={product?.description} /></Label>
      </div>
      <Label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true} />샵에 상품 공개</Label>
      {status && <p role={status.error ? "alert" : "status"} className={status.error ? "text-sm text-red-700" : "text-sm text-emerald-700"}>{status.text}</p>}
      <Button disabled={busy}>{busy ? "저장 중…" : product ? "상품 저장" : "상품 등록"}</Button>
    </form>
  );
}
