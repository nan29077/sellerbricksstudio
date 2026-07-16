"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { formatKRW } from "@/lib/utils";
import { Blocks, CreditCard, Wallet, Landmark } from "lucide-react";

type P = { id: string; displayNumber: number; name: string; price: number; stock: number };
const METHODS = [
  { v: "CARD", label: "신용카드", icon: CreditCard },
  { v: "EASY_PAY", label: "간편결제", icon: Wallet },
  { v: "BANK_TRANSFER", label: "간편 계좌이체", icon: Landmark },
];

export function CheckoutForm({ slug, title, products }: { slug: string; title: string; products: P[] }) {
  const router = useRouter();
  const [cart, setCart] = useState<{ liveSessionProductId: string; quantity: number }[]>([]);
  const [form, setForm] = useState({ buyerName: "", buyerPhone: "", buyerAddress: "" });
  const [method, setMethod] = useState("CARD");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem(`cart-${slug}`);
    if (raw) setCart(JSON.parse(raw));
  }, [slug]);

  const lines = cart.map((c) => ({ ...c, p: products.find((p) => p.id === c.liveSessionProductId)! })).filter((x) => x.p);
  const total = lines.reduce((s, x) => s + x.p.price * x.quantity, 0);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function pay() {
    if (!form.buyerName || !form.buyerPhone) { setError("이름과 연락처를 입력하세요."); return; }
    if (cart.length === 0) { setError("장바구니가 비어 있습니다."); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionSlug: slug, ...form, method, items: cart }),
    });
    const json = await res.json(); setLoading(false);
    if (!json.ok) { setError(json.error ?? "결제에 실패했습니다."); return; }
    sessionStorage.removeItem(`cart-${slug}`);
    router.push(`/order-complete/${json.data.orderId}`);
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-white"><div className="container max-w-2xl flex h-14 items-center gap-2"><Blocks className="h-6 w-6 text-brand-500" /><span className="font-bold text-navy">결제하기</span></div></header>
      <div className="container max-w-2xl py-5 space-y-4">
        <Card><CardContent className="pt-5">
          <p className="font-semibold text-navy mb-3">{title} · 주문 상품</p>
          {lines.length === 0 ? <p className="text-sm text-muted-foreground">장바구니가 비어 있습니다. <Link href={`/live/${slug}`} className="text-brand-600">방송으로 돌아가기</Link></p> :
            lines.map((x) => (
              <div key={x.liveSessionProductId} className="flex items-center gap-2 border-b py-2 last:border-0 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-500 text-xs font-bold text-white">{x.p.displayNumber}</span>
                <span className="flex-1 truncate">{x.p.name}</span><span>{x.quantity}개</span>
                <span className="w-20 text-right font-semibold">{formatKRW(x.p.price * x.quantity)}</span>
              </div>
            ))}
          <div className="mt-3 flex justify-between border-t pt-3"><span className="font-semibold">총 결제금액</span><span className="text-lg font-bold text-brand-600">{formatKRW(total)}</span></div>
        </CardContent></Card>

        <Card><CardContent className="pt-5 space-y-3">
          <p className="font-semibold text-navy">주문자 정보</p>
          <div><Label>이름</Label><Input value={form.buyerName} onChange={set("buyerName")} /></div>
          <div><Label>연락처</Label><Input value={form.buyerPhone} onChange={set("buyerPhone")} placeholder="010-0000-0000" inputMode="tel" /></div>
          <div><Label>배송지 (선택)</Label><Textarea value={form.buyerAddress} onChange={set("buyerAddress")} /></div>
        </CardContent></Card>

        <Card><CardContent className="pt-5">
          <p className="font-semibold text-navy mb-3">결제수단</p>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button key={m.v} onClick={() => setMethod(m.v)} className={`tap flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm ${method === m.v ? "border-brand-500 bg-brand-50" : "border-border"}`}>
                <m.icon className="h-5 w-5 text-brand-500" />{m.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">* 현재 Mock 결제로 동작합니다. 실제 PG 연동 시 어댑터만 교체됩니다.</p>
        </CardContent></Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button size="lg" className="w-full" onClick={pay} disabled={loading || total === 0}>{loading ? "결제 중..." : `${formatKRW(total)} 결제하기`}</Button>
      </div>
    </div>
  );
}
