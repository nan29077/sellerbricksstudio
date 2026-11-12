"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { formatKRW, shippingFeeFor, shippingLabel } from "@/lib/utils";
import { Blocks, CreditCard, Wallet, Landmark } from "lucide-react";
import { AddressSearchButton } from "@/components/address-search";
import { BUSINESS_INFO } from "@/lib/business-info";

type P = { id: string; displayNumber: number; name: string; price: number; stock: number };
const METHODS = [
  { v: "CARD", label: "신용카드", icon: CreditCard },
  { v: "EASY_PAY", label: "간편결제", icon: Wallet },
  { v: "BANK_TRANSFER", label: "간편 계좌이체", icon: Landmark },
];

type Shipping = { shippingFee: number; freeShippingOver: number | null };
type SellerInfo = { name: string; businessNumber?: string | null; place?: string | null; placePhone?: string | null; brandShip?: boolean };

export function CheckoutForm({ slug, title, products, shipping = { shippingFee: 0, freeShippingOver: null }, seller }: { slug: string; title: string; products: P[]; shipping?: Shipping; seller?: SellerInfo }) {
  const router = useRouter();
  const [cart, setCart] = useState<{ liveSessionProductId: string; quantity: number; optionLabel?: string }[]>([]);
  const [form, setForm] = useState({ buyerName: "", buyerPhone: "", buyerAddress: "" });
  const [method, setMethod] = useState("CARD");
  const [agree, setAgree] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; name: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem(`cart-${slug}`);
    if (raw) { try { const v = JSON.parse(raw); if (Array.isArray(v)) setCart(v); } catch { /* 잘못된 장바구니는 무시 */ } }
  }, [slug]);

  const lines = cart.map((c) => ({ ...c, p: products.find((p) => p.id === c.liveSessionProductId)! })).filter((x) => x.p);
  const subtotal = lines.reduce((s, x) => s + x.p.price * x.quantity, 0);
  const shippingFee = lines.length ? shippingFeeFor(shipping, subtotal) : 0;
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const total = subtotal - discount + shippingFee;
  // 장바구니가 바뀌면 쿠폰을 다시 확인하게 한다
  const cartKey = JSON.stringify(cart);
  useEffect(() => { setCoupon(null); setCouponMsg(""); }, [cartKey]);

  async function applyCoupon() {
    if (!couponInput.trim() || !cart.length) return;
    setCouponBusy(true); setCouponMsg("");
    const res = await fetch("/api/coupons/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionSlug: slug, code: couponInput, items: cart.map((c) => ({ liveSessionProductId: c.liveSessionProductId, quantity: c.quantity })) }) });
    const json = await res.json().catch(() => ({ ok: false }));
    setCouponBusy(false);
    if (!json.ok) { setCoupon(null); setCouponMsg(json.error ?? "쿠폰을 확인하지 못했습니다."); return; }
    setCoupon(json.data); setCouponMsg(`${json.data.name} · ${formatKRW(json.data.discount)} 할인`);
  }
  const addrRef = useRef<HTMLTextAreaElement>(null);
  const pickAddress = useCallback((address: string) => {
    setForm((f) => ({ ...f, buyerAddress: address }));
    setTimeout(() => { const el = addrRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 50);
  }, []);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function pay() {
    if (!form.buyerName || !form.buyerPhone) { setError("이름과 연락처를 입력하세요."); return; }
    if (form.buyerAddress.trim().length < 5) { setError("배송지를 입력하세요."); return; }
    if (cart.length === 0) { setError("장바구니가 비어 있습니다."); return; }
    if (!agree) { setError("개인정보 수집·이용 및 판매자 제공에 동의해 주세요."); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionSlug: slug, ...form, method, items: cart, agreePrivacy: agree, ...(coupon && { couponCode: coupon.code }) }),
    });
    const json = await res.json(); setLoading(false);
    if (!json.ok) { setError(json.error ?? "결제에 실패했습니다."); return; }
    sessionStorage.removeItem(`cart-${slug}`);
    router.push(`/order-complete/${json.data.orderId}`);
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-white"><div className="container max-w-2xl flex h-14 items-center gap-2"><Blocks className="h-6 w-6 text-brand-500" /><h1 className="text-base font-bold text-navy">결제하기</h1></div></header>
      <div className="container max-w-2xl py-5 space-y-4">
        <Card><CardContent className="pt-5">
          <p className="font-semibold text-navy mb-3">{title} · 주문 상품</p>
          {lines.length === 0 ? <p className="text-sm text-muted-foreground">장바구니가 비어 있습니다. <Link href={`/live/${slug}`} className="text-brand-600">방송으로 돌아가기</Link></p> :
            lines.map((x) => (
              <div key={`${x.liveSessionProductId}-${x.optionLabel ?? ""}`} className="flex items-center gap-2 border-b py-2 last:border-0 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-500 text-xs font-bold text-white">{x.p.displayNumber}</span>
                <span className="flex-1 truncate">{x.p.name}{x.optionLabel && <span className="ml-1 text-xs text-muted-foreground">({x.optionLabel})</span>}</span><span>{x.quantity}개</span>
                <span className="w-20 text-right font-semibold">{formatKRW(x.p.price * x.quantity)}</span>
              </div>
            ))}
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">상품 금액</span><span>{formatKRW(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-emerald-700"><span>쿠폰 할인</span><span>-{formatKRW(discount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">배송비 <span className="text-xs">({shippingLabel(shipping)})</span></span><span>{shippingFee ? formatKRW(shippingFee) : "무료"}</span></div>
          </div>
          <div className="mt-2 flex justify-between border-t pt-3"><span className="font-semibold">총 결제금액</span><span className="text-lg font-bold text-brand-600">{formatKRW(total)}</span></div>
        </CardContent></Card>

        <Card><CardContent className="pt-5 space-y-3">
          <p className="font-semibold text-navy">주문자 정보</p>
          <div><Label htmlFor="co-name">이름</Label><Input id="co-name" autoComplete="name" value={form.buyerName} onChange={set("buyerName")} /></div>
          <div><Label htmlFor="co-phone">연락처</Label><Input id="co-phone" autoComplete="tel" value={form.buyerPhone} onChange={set("buyerPhone")} placeholder="010-0000-0000" inputMode="tel" /></div>
          <div>
            <div className="mb-1 flex items-end justify-between gap-2"><Label htmlFor="co-addr" className="mb-0">배송지 (필수)</Label><AddressSearchButton onSelect={pickAddress} /></div>
            <Textarea id="co-addr" ref={addrRef} autoComplete="street-address" value={form.buyerAddress} onChange={set("buyerAddress")} placeholder="주소 검색 후 동 · 호수 등 상세 주소를 이어서 적어 주세요" />
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-5">
          <Label htmlFor="co-coupon">쿠폰 코드 (선택)</Label>
          <div className="flex gap-2">
            <Input id="co-coupon" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="셀러가 알려 준 쿠폰 코드" autoComplete="off" maxLength={20} />
            {coupon
              ? <Button variant="outline" onClick={() => { setCoupon(null); setCouponMsg(""); setCouponInput(""); }}>빼기</Button>
              : <Button variant="outline" onClick={applyCoupon} disabled={couponBusy || !couponInput.trim() || !lines.length}>{couponBusy ? "확인 중" : "적용"}</Button>}
          </div>
          {couponMsg && <p role="status" className={`mt-1.5 text-xs ${coupon ? "text-emerald-700" : "text-red-600"}`}>{couponMsg}</p>}
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
        </CardContent></Card>

        <Card><CardContent className="pt-5">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#F5A623]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span><b className="text-navy">(필수)</b> 주문 처리와 배송을 위해 이름·연락처·배송지를 수집하고, 방송 셀러·창고(스튜디오)·배송하는 브랜드사에 제공하는 데 동의합니다. 보관 기간은 거래 후 5년입니다. <Link href="/privacy" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">개인정보처리방침</Link></span>
          </label>
        </CardContent></Card>

        <Card><CardContent className="pt-5 text-xs leading-relaxed text-slate-600 space-y-1.5">
          <p className="text-sm font-semibold text-navy">판매자 · 교환 · 환불 안내</p>
          {seller && <p><span className="text-slate-500">판매자</span> {seller.name}{seller.businessNumber ? ` · 사업자등록번호 ${seller.businessNumber}` : ""}</p>}
          {seller?.place && <p><span className="text-slate-500">출고지</span> {seller.place}{seller.placePhone ? ` · ${seller.placePhone}` : ""}</p>}
          {seller?.brandShip && <p><span className="text-slate-500">배송</span> 일부 상품은 브랜드가 직접 배송합니다.</p>}
          <p>결제 후 출고 전에는 주문 화면에서 취소를 요청할 수 있고, 상품을 받은 날부터 7일 이내에 반품 · 교환을 요청할 수 있습니다. 단순 변심 반품의 배송비는 구매자가 부담합니다.</p>
          <p className="text-[11px] text-slate-500">{BUSINESS_INFO.companyName}는 통신판매중개자로서 거래 당사자가 아니며, 상품 · 거래 정보와 거래에 대한 책임은 판매자에게 있습니다. <Link href="/terms" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">이용약관</Link></p>
        </CardContent></Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button size="lg" className="w-full" onClick={pay} disabled={loading || total === 0}>{loading ? "결제 중..." : `${formatKRW(total)} 결제하기`}</Button>
        <p className="text-center text-[11px] text-slate-500">주문 내용과 위 안내를 확인했으며 결제에 동의합니다.</p>
      </div>
    </div>
  );
}
