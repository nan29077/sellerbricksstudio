"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { formatKRW, calcSellerCommission } from "@/lib/utils";

export function ProductForm({ facilities }: { facilities: { id: string; name: string }[] }) {
  const router = useRouter();
  const [f, setF] = useState({
    facilityId: facilities[0]?.id ?? "", name: "", sku: "", category: "식품", description: "",
    thumbnailUrl: "", salePrice: "", consumerPrice: "", stock: "", shippingInfo: "",
    commissionType: "PERCENT", commissionValue: "10",
  });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const preview = f.salePrice ? calcSellerCommission(Number(f.salePrice), f.commissionType as "PERCENT" | "FIXED", Number(f.commissionValue || 0)) : 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    const res = await fetch("/api/facility-products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, salePrice: Number(f.salePrice), consumerPrice: Number(f.consumerPrice), stock: Number(f.stock), commissionValue: Number(f.commissionValue), isSellable: true }),
    });
    const json = await res.json(); setLoading(false);
    if (!json.ok) { setError(json.error ?? "등록 실패"); return; }
    router.push("/facility/products"); router.refresh();
  }

  return (
    <Card className="max-w-2xl"><CardContent className="pt-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div><Label>시설</Label><Select value={f.facilityId} onChange={set("facilityId")}>{facilities.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>
        <div><Label>상품명</Label><Input value={f.name} onChange={set("name")} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>SKU</Label><Input value={f.sku} onChange={set("sku")} /></div>
          <div><Label>카테고리</Label><Select value={f.category} onChange={set("category")}>{["식품","패션","뷰티","스포츠","레저","리빙","디지털"].map((c) => <option key={c}>{c}</option>)}</Select></div>
        </div>
        <div><Label>대표 이미지 URL</Label><Input value={f.thumbnailUrl} onChange={set("thumbnailUrl")} placeholder="https://..." /></div>
        <div><Label>설명</Label><Textarea value={f.description} onChange={set("description")} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>판매가</Label><Input value={f.salePrice} onChange={set("salePrice")} inputMode="numeric" required /></div>
          <div><Label>소비자가</Label><Input value={f.consumerPrice} onChange={set("consumerPrice")} inputMode="numeric" required /></div>
          <div><Label>재고</Label><Input value={f.stock} onChange={set("stock")} inputMode="numeric" required /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>셀러 수수료 타입</Label><Select value={f.commissionType} onChange={set("commissionType")}><option value="PERCENT">정률 (%)</option><option value="FIXED">정액 (원)</option></Select></div>
          <div><Label>수수료 값</Label><Input value={f.commissionValue} onChange={set("commissionValue")} inputMode="numeric" /></div>
        </div>
        <div><Label>배송 정보</Label><Input value={f.shippingInfo} onChange={set("shippingInfo")} placeholder="예: 3,000원 (5만원 이상 무료)" /></div>
        <div className="rounded-lg bg-brand-50 p-3 text-sm text-navy">예상 셀러 정산금: <span className="font-bold text-brand-600">{formatKRW(preview)}</span> / 개</div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" size="lg" disabled={loading}>{loading ? "등록 중..." : "상품 등록"}</Button>
      </form>
    </CardContent></Card>
  );
}
