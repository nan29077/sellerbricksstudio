"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FULFILLMENT_DESC, FULFILLMENT_LABEL } from "@/lib/brands";
import { formatKRW } from "@/lib/utils";

type Mode = "DROPSHIP" | "WAREHOUSE";

export function BrandImportButton({ product, target, facilities = [] }: {
  product: { id: string; name: string; supplyPrice: number; consumerPrice: number; stock: number; allowDropship: boolean; allowWarehouse: boolean };
  target: "SELLER" | "FACILITY";
  facilities?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const modes: Mode[] = target === "SELLER" ? (product.allowDropship ? ["DROPSHIP"] : []) : [
    ...(product.allowDropship ? (["DROPSHIP"] as Mode[]) : []), ...(product.allowWarehouse ? (["WAREHOUSE"] as Mode[]) : []),
  ];
  const suggested = product.consumerPrice > product.supplyPrice ? product.consumerPrice : Math.round((product.supplyPrice * 1.3) / 100) * 100;
  const [mode, setMode] = useState<Mode>(modes[0] ?? "DROPSHIP");
  const [salePrice, setSalePrice] = useState(String(suggested));
  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? "");
  const [commissionType, setCommissionType] = useState("PERCENT");
  const [commissionValue, setCommissionValue] = useState("10");
  const [stock, setStock] = useState("");
  const [sellerSupply, setSellerSupply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ kind: string; needsStock?: boolean } | null>(null);

  if (!modes.length) return null;
  if (target === "FACILITY" && !facilities.length) {
    return <Link href="/facility/register" className="text-xs font-semibold text-brand-800 underline">창고(스튜디오) 등록 후 가져오기</Link>;
  }
  const price = Number(salePrice) || 0;
  const margin = price - product.supplyPrice;
  const supplyToSeller = sellerSupply.trim() ? Number(sellerSupply) || 0 : null;
  const supplyError = supplyToSeller != null && (supplyToSeller < product.supplyPrice || supplyToSeller > price);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/brand-imports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import", brandProductId: product.id, target, fulfillment: mode, salePrice: price,
          ...(target === "FACILITY" && {
            facilityId, commissionType, commissionValue: Number(commissionValue) || 0, sellerSupplyPrice: supplyToSeller,
            ...(mode === "DROPSHIP" && stock !== "" && { stock: Number(stock) }),
          }),
        }),
      });
      const json = await res.json().catch(() => ({ ok: false }));
      if (!json.ok) throw new Error(json.error ?? "가져오지 못했습니다.");
      setDone(json.data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "가져오지 못했습니다.");
    } finally { setBusy(false); }
  }

  return (
    <>
      <Button type="button" size="sm" variant="default" onClick={() => { setDone(null); setError(""); dialog.current?.showModal(); }}>
        <PackagePlus className="h-4 w-4" />판매 상품으로 가져오기
      </Button>
      <dialog ref={dialog} aria-label={`${product.name} 가져오기`}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[480px] overflow-auto rounded-3xl bg-white p-5 text-navy shadow-2xl backdrop:bg-navy/55 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 className="text-xl font-black">판매 상품으로 가져오기</h2><p className="mt-1 text-sm text-slate-600">{product.name}</p></div>
          <Button type="button" variant="ghost" size="icon" aria-label="닫기" onClick={() => dialog.current?.close()} disabled={busy}><X className="h-5 w-5" /></Button>
        </div>
        {done ? (
          <div className="space-y-3 text-sm">
            <p className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-800">
              {done.kind === "SELLER" ? "내 브랜드 판매 상품에 담았습니다. 외부 라이브 플랫폼에서 팔고 '주문서 작성'에 이 상품을 담으면, 공급가를 결제하는 즉시 발주서가 브랜드로 전달되고 브랜드가 받는 분에게 바로 배송합니다."
                : done.needsStock ? "창고 입고 방식으로 등록했습니다. 브랜드사에 입고를 요청하고, 입고 확인 후 판매가 시작됩니다."
                : "창고(스튜디오) 판매 상품으로 등록했습니다. 셀러가 예약할 때 이 상품을 고를 수 있습니다."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={done.kind === "SELLER" ? "/seller/brand-products" : "/facility/brand-products"} className="font-bold text-brand-800 underline">
                {done.kind === "SELLER" ? "내 브랜드 판매 상품 보기" : done.needsStock ? "입고 요청하러 가기" : "브랜드 판매 상품 보기"}
              </Link>
            </div>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={submit}>
            {target === "FACILITY" && facilities.length > 1 && (
              <Label className="block">등록할 창고(스튜디오)
                <Select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                  {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
              </Label>
            )}
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">배송 방식</legend>
              {modes.map((m) => (
                <label key={m} className={`flex cursor-pointer gap-2 rounded-xl border p-3 text-sm ${mode === m ? "border-brand-500 bg-brand-50" : ""}`}>
                  <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} className="mt-1" />
                  <span><b>{FULFILLMENT_LABEL[m]}</b><br /><span className="text-xs text-slate-600">{FULFILLMENT_DESC[m]}</span></span>
                </label>
              ))}
            </fieldset>
            <Label className="block">판매가 (원)
              <Input type="number" min={product.supplyPrice} max={100_000_000} required value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            </Label>
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              공급가 {formatKRW(product.supplyPrice)} · 판매 1개당 차액 <b className={margin < 0 ? "text-red-600" : "text-navy"}>{formatKRW(margin)}</b>
              <br />{target === "SELLER" ? "판매가는 셀러가 외부 플랫폼에서 받는 참고 가격입니다. 주문서를 낼 때는 공급가(+스토리지마켓 출고 시 배송비)만 결제합니다." : "주문서 결제는 플랫폼이 받고, 플랫폼 수수료를 뺀 뒤 브랜드에 정산합니다."}
              <br />샘플 구매는 상품 카드의 &lsquo;샘플 신청&rsquo;에서 따로 진행합니다. (판매 상품 가져오기와 별개)
            </p>
            {target === "FACILITY" && (
              <div className="space-y-1 rounded-xl border border-brand-200 bg-brand-50/60 p-3">
                <Label className="block">셀러 공급가 (원) — 셀러에게 보여 줄 공급가
                  <Input type="number" min={product.supplyPrice} max={price || undefined} value={sellerSupply} onChange={(e) => setSellerSupply(e.target.value)} placeholder={`${product.supplyPrice.toLocaleString()} ~ ${price.toLocaleString()}`} />
                </Label>
                <p className="text-[11px] text-slate-600">
                  {supplyToSeller != null
                    ? <>판매 1개당 · 브랜드 {formatKRW(product.supplyPrice)} · 창고(스튜디오) {formatKRW(Math.max(0, supplyToSeller - product.supplyPrice))} · 셀러 {formatKRW(Math.max(0, price - supplyToSeller))} (판매 수수료 차감 전)</>
                    : "비워 두면 아래 셀러 수수료 방식으로 정산합니다."}
                </p>
                {supplyError && <p className="text-[11px] font-semibold text-red-600">셀러 공급가는 브랜드 공급가 이상, 판매가 이하로 정하세요.</p>}
              </div>
            )}
            {target === "FACILITY" && (
              <div className="grid grid-cols-2 gap-2">
                <Label className={`block ${supplyToSeller != null ? "opacity-50" : ""}`}>셀러 수수료 방식
                  <Select value={commissionType} onChange={(e) => setCommissionType(e.target.value)}>
                    <option value="PERCENT">판매가의 %</option><option value="FIXED">1개당 금액</option>
                  </Select>
                </Label>
                <Label className="block">셀러 수수료{commissionType === "PERCENT" ? " (%)" : " (원)"}
                  <Input type="number" min={0} step="any" value={commissionValue} onChange={(e) => setCommissionValue(e.target.value)} />
                </Label>
                {mode === "DROPSHIP" && (
                  <Label className="col-span-2 block">판매 한도 수량 (비우면 브랜드 재고 {product.stock.toLocaleString()}개)
                    <Input type="number" min={0} max={product.stock} value={stock} onChange={(e) => setStock(e.target.value)} />
                  </Label>
                )}
              </div>
            )}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <Button className="w-full" disabled={busy || margin < 0 || supplyError}>{busy ? "등록 중…" : "가져오기"}</Button>
          </form>
        )}
      </dialog>
    </>
  );
}
