"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { BRAND_ARTWORK } from "@/lib/shop-artwork";
import { ShopArtworkPicker } from "./shop-artwork-picker";
import { submitBrandCommand } from "./brand-command";

type ShopFields = {
  id: string; name: string; tagline: string; description: string; logoUrl: string;
  bannerUrl: string; backgroundUrl: string; paymentInstructions: string;
};

export function BrandShopEditor({ shop, name }: { shop?: ShopFields; name: string }) {
  const router = useRouter();
  const [banner, setBanner] = useState(shop?.bannerUrl || BRAND_ARTWORK[0].url);
  const [background, setBackground] = useState(shop?.backgroundUrl || BRAND_ARTWORK[4].url);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setMessage("");
    try {
      await submitBrandCommand({ ...fields, action: "shop", shopId: shop?.id, bannerUrl: banner, backgroundUrl: background });
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
        <Label className="block">로고 이미지 주소<Input name="logoUrl" defaultValue={shop?.logoUrl} placeholder="https://…" maxLength={500} /></Label>
      </div>
      <ShopArtworkPicker label="샵 배너 이미지" presets={BRAND_ARTWORK} value={banner} onChange={setBanner} />
      <ShopArtworkPicker label="PC 여백 이미지" presets={BRAND_ARTWORK} value={background} onChange={setBackground} />
      <div>
        <Label htmlFor="sample-payment">유료 샘플 입금 안내</Label>
        <Textarea id="sample-payment" name="paymentInstructions" defaultValue={shop?.paymentInstructions}
          placeholder="은행, 계좌번호, 예금주, 배송 안내를 입력하세요." maxLength={600} rows={3} />
        <p className="mt-1 text-xs text-slate-600">유료 샘플 주문자에게만 표시됩니다. 입력한 뒤 유료 샘플 주문을 받을 수 있습니다.</p>
      </div>
      {message && <p role={error ? "alert" : "status"} className={error ? "text-sm text-red-700" : "text-sm text-emerald-700"}>{message}</p>}
      <Button disabled={busy}>{busy ? "저장 중…" : shop ? "샵 정보 저장" : "브랜드샵 만들기"}</Button>
    </form>
  );
}
