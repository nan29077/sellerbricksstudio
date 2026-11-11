"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { BRAND_ARTWORK } from "@/lib/shop-artwork";
import { ShopArtworkPicker } from "./shop-artwork-picker";
import { submitBrandCommand } from "./brand-command";
import { CategoryPicker } from "@/components/category-picker";
import { ImageUrlInput } from "@/components/ui/image-url-input";

type ShopFields = {
  id: string; name: string; tagline: string; description: string; logoUrl: string;
  bannerUrl: string; backgroundUrl: string; paymentInstructions: string;
  categories: string[]; businessNumber: string; ceoName: string; csPhone: string; returnAddress: string;
  bankName: string; bankAccount: string; accountHolder: string;
  requireSellerApproval?: boolean; lowStockThreshold?: number;
};

export function BrandShopEditor({ shop, name, isOwner = true }: { shop?: ShopFields; name: string; isOwner?: boolean }) {
  const router = useRouter();
  const [banner, setBanner] = useState(shop?.bannerUrl || BRAND_ARTWORK[0].url);
  const [background, setBackground] = useState(shop?.backgroundUrl || BRAND_ARTWORK[4].url);
  const [categories, setCategories] = useState<string[]>(shop?.categories ?? []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const { requireSellerApproval, lowStockThreshold, currentPassword, ...fields } = Object.fromEntries(new FormData(form));
    setBusy(true);
    setMessage("");
    try {
      await submitBrandCommand({
        ...fields, action: "shop", shopId: shop?.id, bannerUrl: banner, backgroundUrl: background, categories,
        ...(currentPassword ? { currentPassword } : {}),
        ...(isOwner && shop ? { requireSellerApproval: requireSellerApproval === "on", lowStockThreshold: Number(lowStockThreshold || 0) } : {}),
      });
      const pw = form.elements.namedItem("currentPassword") as HTMLInputElement | null;
      if (pw) pw.value = "";
      setError(false);
      setMessage(shop ? "샵 정보를 저장했습니다." : "샵을 만들었습니다. 공개하려면 최고관리자의 승인이 필요합니다.");
      router.refresh();
    } catch (error) {
      setError(true);
      setMessage(error instanceof Error ? error.message : "샵 정보를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-extrabold text-navy">{shop ? "샵 정보와 디자인" : "브랜드샵 만들기"}</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Label className="block">샵 이름<Input name="name" defaultValue={shop?.name ?? name} required minLength={2} maxLength={60} /></Label>
        <Label className="block">한 줄 소개<Input name="tagline" defaultValue={shop?.tagline} maxLength={100} /></Label>
        <Label className="block">샵 소개<Textarea name="description" defaultValue={shop?.description} maxLength={1500} rows={3} /></Label>
        <Label className="block">로고 이미지<ImageUrlInput name="logoUrl" defaultValue={shop?.logoUrl} folder="shop" /></Label>
      </div>
      <ShopArtworkPicker label="샵 배너 이미지" presets={BRAND_ARTWORK} value={banner} onChange={setBanner} />
      <ShopArtworkPicker label="PC 여백 이미지" presets={BRAND_ARTWORK} value={background} onChange={setBackground} />
      <div>
        <Label>취급 카테고리</Label>
        <p className="mb-2 text-xs text-slate-600">브랜드샵 목록의 카테고리 검색에 사용됩니다.</p>
        <CategoryPicker value={categories} onChange={setCategories} />
      </div>
      <fieldset className="grid gap-4 rounded-xl border p-4 lg:grid-cols-2">
        <legend className="px-1 text-sm font-bold text-navy">사업자 · 정산 정보</legend>
        <Label className="block">사업자등록번호<Input name="businessNumber" defaultValue={shop?.businessNumber} maxLength={20} placeholder="000-00-00000" disabled={!isOwner} /></Label>
        <Label className="block">대표자명<Input name="ceoName" defaultValue={shop?.ceoName} maxLength={40} /></Label>
        <Label className="block">고객센터 · 담당 연락처<Input name="csPhone" defaultValue={shop?.csPhone} maxLength={30} /></Label>
        <Label className="block">반품 · 교환 주소<Input name="returnAddress" defaultValue={shop?.returnAddress} maxLength={300} /></Label>
        <Label className="block">정산 은행<Input name="bankName" defaultValue={shop?.bankName} maxLength={30} disabled={!isOwner} /></Label>
        <Label className="block">계좌번호<Input name="bankAccount" defaultValue={shop?.bankAccount} maxLength={40} inputMode="numeric" disabled={!isOwner} /></Label>
        <Label className="block">예금주<Input name="accountHolder" defaultValue={shop?.accountHolder} maxLength={40} disabled={!isOwner} /></Label>
        {isOwner && shop?.bankAccount && (
          <Label className="block">현재 비밀번호 <span className="font-normal text-slate-500">(정산 계좌·사업자번호를 바꿀 때만)</span>
            <Input name="currentPassword" type="password" autoComplete="current-password" maxLength={100} />
          </Label>
        )}
        {!isOwner && <p className="text-xs text-amber-700 lg:col-span-2">정산 계좌와 사업자 정보는 대표 계정만 바꿀 수 있습니다.</p>}
        <p className="text-xs text-slate-600 lg:col-span-2">판매·유료 샘플 대금은 플랫폼이 받아 정산 주기에 맞춰 이 계좌로 지급합니다. 수수료는 최고관리자가 정합니다.</p>
      </fieldset>
      {shop && isOwner && (
        <fieldset className="grid gap-4 rounded-xl border p-4 lg:grid-cols-2">
          <legend className="px-1 text-sm font-bold text-navy">판매처 · 재고 운영</legend>
          <Label className="flex items-start gap-2 lg:col-span-2"><input type="checkbox" name="requireSellerApproval" defaultChecked={shop.requireSellerApproval} className="mt-0.5 h-5 w-5" />
            <span>승인한 판매처만 상품을 가져갈 수 있게 하기<span className="block text-xs font-normal text-slate-500">켜면 셀러·창고(스튜디오)가 판매처 신청을 하고, 판매처 현황에서 승인해야 판매 목록에 담을 수 있습니다. 샘플 신청은 그대로 받을 수 있습니다.</span></span>
          </Label>
          <Label className="block">재고 부족 알림 기준 (개)<Input type="number" name="lowStockThreshold" min={0} max={100000} defaultValue={shop.lowStockThreshold ?? 10} /></Label>
        </fieldset>
      )}
      <div>
        <Label htmlFor="sample-payment">주문자 안내 메모 (선택)</Label>
        <Textarea id="sample-payment" name="paymentInstructions" defaultValue={shop?.paymentInstructions}
          placeholder="샘플 배송 일정, 교환·반품 안내 등" maxLength={600} rows={3} />
        <p className="mt-1 text-xs text-slate-600">샘플 신청자에게 표시됩니다. 결제는 스토리지마켓에서 처리되므로 계좌번호는 적지 않아도 됩니다.</p>
      </div>
      {message && <p role={error ? "alert" : "status"} className={error ? "text-sm text-red-700" : "text-sm text-emerald-700"}>{message}</p>}
      <Button disabled={busy}>{busy ? "저장 중…" : shop ? "샵 정보 저장" : "브랜드샵 만들기"}</Button>
    </form>
  );
}
