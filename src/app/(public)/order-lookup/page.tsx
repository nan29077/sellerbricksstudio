"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PackageSearch } from "lucide-react";

export default function OrderLookupPage() {
  const router = useRouter();
  const [orderNo, setOrderNo] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo, phone }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setError(json.error ?? "조회에 실패했습니다."); return; }
      router.push(`/order-complete/${json.data.orderId}`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container max-w-md py-14">
      <div className="mb-6 text-center">
        <PackageSearch className="mx-auto h-10 w-10 text-brand-500" />
        <h1 className="mt-3 text-2xl font-extrabold text-navy">주문 조회</h1>
        <p className="mt-2 text-sm text-slate-500">라이브 방송에서 주문하신 내역과 배송 상태를 확인할 수 있습니다.</p>
      </div>
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="ol-no">주문번호</Label>
              <Input id="ol-no" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="예: SB20261015-AB12C" autoComplete="off" required />
            </div>
            <div>
              <Label htmlFor="ol-phone">주문 시 입력한 연락처</Label>
              <Input id="ol-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "조회 중..." : "주문 조회"}</Button>
          </form>
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-xs text-slate-400">주문번호는 주문 완료 화면에서 확인할 수 있습니다.</p>
    </div>
  );
}
