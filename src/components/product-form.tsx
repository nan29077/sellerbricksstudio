"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { formatKRW, sellerUnitProfit } from "@/lib/utils";
import { PRODUCT_CATEGORIES } from "@/lib/product-categories";

// 창고(스튜디오) 상품 등록 — 등록한 상품은 셀러의 '판매 상품 둘러보기'와 예약 화면에 노출된다.
export function ProductForm({ facilities, returnHref = "/facility/products" }: { facilities: { id: string; name: string }[]; returnHref?: string }) {
  const router = useRouter();
  const [f, setF] = useState({
    facilityId: facilities[0]?.id ?? "", name: "", sku: "", category: "식품", description: "",
    thumbnailUrl: "", salePrice: "", consumerPrice: "", supplyPrice: "", stock: "", shippingInfo: "",
    commissionType: "PERCENT", commissionValue: "10",
  });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const [again, setAgain] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const num = (v: string) => Number(v.replace(/[^\d.]/g, "") || 0);

  const sale = num(f.salePrice), consumer = num(f.consumerPrice);
  const supply = f.supplyPrice.trim() ? num(f.supplyPrice) : null;
  const preview = sale ? sellerUnitProfit({ salePrice: sale, supplyPrice: supply, commissionType: f.commissionType, commissionValue: num(f.commissionValue) }) : 0;
  const off = consumer > sale && sale > 0 ? Math.round((1 - sale / consumer) * 100) : 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (f.commissionType === "PERCENT" && num(f.commissionValue) > 100) return setError("정률 수수료는 100%를 넘을 수 없습니다.");
    if (supply == null && f.commissionType === "FIXED" && num(f.commissionValue) > sale) return setError("정액 수수료가 판매가보다 큽니다.");
    if (supply != null && supply > sale) return setError("셀러 공급가는 판매가보다 클 수 없습니다.");
    setLoading(true);
    const res = await fetch("/api/facility-products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, salePrice: sale, consumerPrice: consumer || sale, supplyPrice: supply, stock: num(f.stock), commissionValue: num(f.commissionValue), isSellable: true }),
    });
    const json = await res.json(); setLoading(false);
    if (!json.ok) { setError(json.error ?? "등록 실패"); return; }
    if (again) {
      setF({ ...f, name: "", sku: "", description: "", thumbnailUrl: "", salePrice: "", consumerPrice: "", supplyPrice: "", stock: "" });
      setError(""); router.refresh(); return;
    }
    router.push(returnHref); router.refresh();
  }

  return (
    <div className="grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card><CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-4">
          {facilities.length > 1 && <div><Label>창고(스튜디오)</Label><Select aria-label="창고(스튜디오)" value={f.facilityId} onChange={set("facilityId")}>{facilities.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>}
          <div><Label>상품명</Label><Input aria-label="상품명" value={f.name} onChange={set("name")} maxLength={120} required placeholder="예: 제주 노지 감귤 5kg (로얄과)" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>카테고리</Label><Select aria-label="카테고리" value={f.category} onChange={set("category")}>{PRODUCT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></div>
            <div><Label>SKU (선택)</Label><Input aria-label="SKU (선택)" value={f.sku} onChange={set("sku")} /></div>
          </div>
          <div><Label>대표 이미지 URL</Label><Input aria-label="대표 이미지 URL" value={f.thumbnailUrl} onChange={set("thumbnailUrl")} placeholder="https://..." /></div>
          <div><Label>상품 설명</Label><Textarea aria-label="상품 설명" value={f.description} onChange={set("description")} rows={4} placeholder="셀러가 상품을 고를 때 보는 설명입니다. 특징·구성·방송 포인트를 적어주세요." /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>판매가(원)</Label><Input aria-label="판매가(원)" value={f.salePrice} onChange={set("salePrice")} inputMode="numeric" required /></div>
            <div><Label>소비자가(원)</Label><Input aria-label="소비자가(원)" value={f.consumerPrice} onChange={set("consumerPrice")} inputMode="numeric" placeholder="미입력 시 판매가" /></div>
            <div><Label>재고</Label><Input aria-label="재고" value={f.stock} onChange={set("stock")} inputMode="numeric" required /></div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3">
            <Label>셀러 공급가(원) — 권장</Label>
            <Input aria-label="셀러 공급가(원)" value={f.supplyPrice} onChange={set("supplyPrice")} inputMode="numeric" placeholder="예: 판매가 30,000원이면 22,000" />
            <p className="mt-1 text-[11px] text-slate-600">판매되면 창고(스튜디오)는 <b>공급가</b>를 받고, 셀러는 <b>판매가 − 판매 수수료 − 공급가</b>를 받습니다. 셀러는 공급가 이상에서 판매가를 조정할 수 있습니다. 비워 두면 아래 셀러 수수료 방식으로 계산합니다.</p>
          </div>
          <div className={`grid grid-cols-2 gap-3 ${supply != null ? "opacity-50" : ""}`}>
            <div><Label>셀러 수수료 방식</Label><Select aria-label="셀러 수수료 방식" value={f.commissionType} onChange={set("commissionType")}><option value="PERCENT">정률 (%)</option><option value="FIXED">정액 (원)</option></Select></div>
            <div><Label>수수료 값</Label><Input aria-label="수수료 값" value={f.commissionValue} onChange={set("commissionValue")} inputMode="numeric" /></div>
          </div>
          <div><Label>배송 정보</Label><Input aria-label="배송 정보" value={f.shippingInfo} onChange={set("shippingInfo")} placeholder="예: 3,000원 (5만원 이상 무료)" /></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} className="h-4 w-4 accent-brand-500" />등록 후 계속 다른 상품 등록</label>
          <Button className="w-full" size="lg" disabled={loading}>{loading ? "등록 중..." : "상품 등록"}</Button>
        </form>
      </CardContent></Card>

      {/* 셀러에게 보이는 모습 미리보기 */}
      <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
        <p className="text-xs font-bold text-slate-500">셀러에게 보이는 카드</p>
        <div className="overflow-hidden rounded-2xl border-2 border-[#E9E5DC] bg-white">
          <div className="relative aspect-square bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {f.thumbnailUrl ? <img src={f.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-10 w-10 text-slate-300" /></div>}
            {off > 0 && <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">-{off}%</span>}
          </div>
          <div className="space-y-1 p-3">
            <p className="text-[11px] text-slate-500">{f.category}</p>
            <p className="line-clamp-2 text-sm font-bold text-navy">{f.name || "상품명"}</p>
            <p className="text-base font-extrabold text-brand-700">{formatKRW(sale)}</p>
            {supply != null && <p className="text-[11px] text-slate-600">공급가 {formatKRW(supply)}</p>}
            <p className="text-[11px] font-semibold text-purple-700">개당 셀러 {supply != null ? "마진" : "수익"} {formatKRW(preview)}{supply != null && " (수수료 차감 전)"}</p>
            <p className="text-[11px] text-slate-500">재고 {num(f.stock).toLocaleString()}개</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">수수료가 높고 설명이 자세할수록 셀러가 더 많이 선택합니다.</p>
      </div>
    </div>
  );
}
