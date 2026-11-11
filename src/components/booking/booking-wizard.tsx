"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Warehouse, Package, CalendarDays, ClipboardCheck, Check, Search, Star, Zap, Minus, Plus, Loader2,
  AlertCircle, ChevronLeft, ChevronRight, Repeat, Gift, MapPin, Heart, CheckCircle2, Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { SlotPicker, endOf, type PickerPolicy, type SlotValue } from "./slot-picker";
import { cn, formatKRW } from "@/lib/utils";

export type WizardFacility = {
  id: string; name: string; type: string; region: string; address: string; rating: number; thumbnailUrl: string | null;
  productCount: number; autoApprove: boolean; capacity: number | null; cancelPolicy: string | null; bookingNotice: string | null;
  specialty: string | null; favorite: boolean; cancelDeadlineHours: number;
};
type FacilityProduct = {
  id: string; salePrice: number; consumerPrice: number; stock: number; shippingInfo: string | null;
  commissionType: string; commissionValue: number; bookedCount: number;
  product: { id: string; name: string; category: string; description: string | null; thumbnailUrl: string | null };
};
type Occ = { date: string; start: string; end: string; ok: boolean; reason?: string | null };
type Created = { id: string; code: string | null; status: string; startAt: string; endAt: string };

const STEPS = [
  { key: "facility", label: "장소", icon: Warehouse },
  { key: "products", label: "상품", icon: Package },
  { key: "schedule", label: "일정", icon: CalendarDays },
  { key: "confirm", label: "확인", icon: ClipboardCheck },
] as const;

const commissionOf = (p: FacilityProduct) => p.commissionType === "PERCENT" ? Math.round((p.salePrice * p.commissionValue) / 100) : Math.round(p.commissionValue);

export function BookingWizard({
  facilities, defaults,
}: {
  facilities: WizardFacility[];
  defaults: { facilityId?: string; products?: Record<string, number>; date?: string; start?: string; hours?: number };
}) {
  const router = useRouter();
  const initialFacility = facilities.find((f) => f.id === defaults.facilityId);
  const [step, setStep] = useState(initialFacility ? (defaults.products && Object.keys(defaults.products).length ? 2 : 1) : 0);
  const [facilityId, setFacilityId] = useState(initialFacility?.id ?? "");
  const facility = facilities.find((f) => f.id === facilityId);

  // 1. 장소
  const [fq, setFq] = useState("");
  const [ftype, setFtype] = useState("");
  // 2. 상품
  const [products, setProducts] = useState<FacilityProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [picks, setPicks] = useState<Record<string, number>>(defaults.products ?? {});
  const [pq, setPq] = useState("");
  const [pcat, setPcat] = useState("");
  // 3. 일정
  const [slot, setSlot] = useState<SlotValue>({ date: defaults.date ?? "", start: defaults.start ?? "", hours: defaults.hours ?? 2 });
  const [slotStatus, setSlotStatus] = useState<string | null>(null);
  const [policy, setPolicy] = useState<PickerPolicy | null>(null);
  const [repeat, setRepeat] = useState(1);
  const [occ, setOcc] = useState<Occ[] | null>(null);
  const [occLoading, setOccLoading] = useState(false);
  const [skipConflicts, setSkipConflicts] = useState(true);
  // 4. 확인
  const [purpose, setPurpose] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ bookings: Created[]; autoApproved: boolean } | null>(null);
  const [notice, setNotice] = useState("");

  // 장소가 바뀌면 상품을 불러오고, 다른 창고 상품 선택은 정리
  const loadProducts = useCallback(async (fid: string, signal: AbortSignal) => {
    setProductsLoading(true);
    setProducts([]);
    try {
      const r = await fetch(`/api/facilities/${fid}/products`, { signal }); const j = await r.json();
      if (signal.aborted) return;
      const list: FacilityProduct[] = Array.isArray(j.data) ? j.data : [];
      setProducts(list);
      setPicks((prev) => Object.fromEntries(list.flatMap((product) => (
        prev[product.id] && product.stock > 0 ? [[product.id, Math.min(prev[product.id], product.stock)]] : []
      ))));
    } catch { /* 빈 상품 목록 유지 */ }
    finally { if (!signal.aborted) setProductsLoading(false); }
  }, []);
  useEffect(() => {
    if (!facilityId) return;
    const controller = new AbortController();
    void loadProducts(facilityId, controller.signal);
    return () => controller.abort();
  }, [facilityId, loadProducts]);

  // 반복 예약 미리 확인
  useEffect(() => {
    if (repeat <= 1 || !slot.date || !slot.start || !facilityId) { setOcc(null); return; }
    let alive = true; setOccLoading(true);
    fetch("/api/bookings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId, startAt: `${slot.date}T${slot.start}:00`, endAt: `${slot.date}T${endOf(slot.start, slot.hours)}:00`, repeatWeeks: repeat, dryRun: true }),
    }).then((r) => r.json()).then((j) => { if (alive) setOcc(j.ok ? j.data.results : null); })
      .catch(() => alive && setOcc(null)).finally(() => alive && setOccLoading(false));
    return () => { alive = false; };
  }, [repeat, slot.date, slot.start, slot.hours, facilityId]);

  const filteredFacilities = useMemo(() => facilities.filter((f) =>
    (!ftype || f.type === ftype) &&
    (!fq || `${f.name} ${f.region} ${f.address} ${f.specialty ?? ""}`.toLowerCase().includes(fq.toLowerCase()))), [facilities, fq, ftype]);
  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.product.category))).sort(), [products]);
  const filteredProducts = products.filter((p) => (!pcat || p.product.category === pcat) && (!pq || p.product.name.toLowerCase().includes(pq.toLowerCase())));
  const picked = products.filter((p) => picks[p.id]);
  const expectedRevenue = picked.reduce((a, p) => a + p.salePrice * picks[p.id], 0);
  const expectedCommission = picked.reduce((a, p) => a + commissionOf(p) * picks[p.id], 0);
  const endTime = slot.start ? endOf(slot.start, slot.hours) : "";
  const okOcc = occ?.filter((o) => o.ok).length ?? (slot.start ? 1 : 0);

  function setQty(id: string, q: number, stock: number) {
    setPicks((prev) => {
      const next = { ...prev };
      if (q <= 0 || stock <= 0) delete next[id]; else next[id] = Math.min(stock, q);
      return next;
    });
  }

  function chooseFacility(id: string) {
    if (id !== facilityId) { setSlot((s) => ({ ...s, date: "", start: "" })); setRepeat(1); }
    setFacilityId(id); setStep(1);
  }

  async function joinWaitlist(v: SlotValue) {
    setNotice("");
    try {
      const r = await fetch("/api/bookings/waitlist", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, startAt: `${v.date}T${v.start}:00`, endAt: `${v.date}T${endOf(v.start, v.hours)}:00` }) });
      const j = await r.json();
      setNotice(j.ok ? "대기 신청했습니다. 자리가 나면 알림으로 알려드려요. (예약 관리 → 대기 신청에서 확인)" : j.error ?? "대기 신청에 실패했습니다.");
    } catch { setNotice("대기 신청에 실패했습니다."); }
  }

  function goNext() {
    setError("");
    if (step === 0 && !facilityId) return setError("예약할 창고(스튜디오)를 선택하세요.");
    if (step === 2) {
      if (!slot.date || !slot.start) return setError("날짜와 시작 시간을 선택하세요.");
      if (slotStatus !== "available") return setError("선택한 시간은 예약할 수 없습니다. 다른 시간을 선택하세요.");
      if (repeat > 1 && occ && occ.some((o) => !o.ok) && !skipConflicts) return setError("예약할 수 없는 날짜가 있습니다. '안 되는 날짜는 빼고 예약'을 선택하거나 반복 횟수를 줄이세요.");
    }
    setStep((s) => Math.min(3, s + 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setError("");
    if (!facility) return;
    if (facility.cancelPolicy && !agree) return setError("취소·환불 규정에 동의해 주세요.");
    if (facility.capacity && headcount && Number(headcount) > facility.capacity) return setError(`최대 수용 인원은 ${facility.capacity}명입니다.`);
    setSubmitting(true);
    try {
      const end = endTime; // "24:00" 은 다음날 0시로 해석된다
      const r = await fetch("/api/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId, purpose: purpose || undefined, headcount: headcount ? Number(headcount) : undefined, requestNote: requestNote || undefined,
          startAt: `${slot.date}T${slot.start}:00`, endAt: `${slot.date}T${end}:00`,
          products: picked.map((p) => ({ facilityProductId: p.id, quantity: picks[p.id] })),
          repeatWeeks: repeat, skipConflicts,
        }),
      });
      const j = await r.json();
      if (!j.ok) { setError(j.error ?? "예약 신청에 실패했습니다."); return; }
      setDone({ bookings: j.data.bookings, autoApproved: j.data.autoApproved });
      try { sessionStorage.removeItem("sb.productPicks"); } catch { /* ignore */ }
      router.refresh();
    } catch { setError("네트워크 오류로 예약하지 못했습니다. 다시 시도하세요."); }
    finally { setSubmitting(false); }
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-5 p-6 text-center sm:p-8">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
          <div>
            <h2 className="text-2xl font-extrabold text-navy">{done.autoApproved ? "예약이 확정되었습니다" : "예약을 신청했습니다"}</h2>
            <p className="mt-2 text-sm text-slate-500">{done.autoApproved ? "이 창고(스튜디오)는 즉시 확정 공간이라 바로 이용할 수 있어요." : "창고(스튜디오) 관리자가 승인하면 알림으로 알려드려요."}</p>
          </div>
          <div className="space-y-2 rounded-2xl bg-muted/50 p-4 text-left text-sm">
            <p className="font-bold text-navy">{facility?.name}</p>
            {done.bookings.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 first:border-0 first:pt-0">
                <span className="text-slate-700">{new Date(b.startAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="font-mono text-xs font-bold text-navy">{b.code}</span>
              </div>
            ))}
            {picked.length > 0 && <p className="border-t border-border/60 pt-2 text-xs text-slate-500">판매 예정 상품 {picked.length}종 — 라이브 세션을 만들면 상품번호와 함께 자동으로 등록됩니다.</p>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/seller/bookings"><Button className="w-full sm:w-auto">예약 관리로 이동</Button></Link>
            {done.autoApproved && <Link href="/seller/live-sessions"><Button variant="outline" className="w-full sm:w-auto">라이브 준비하기</Button></Link>}
            <Button variant="ghost" onClick={() => { setDone(null); setStep(2); setSlot((s) => ({ ...s, start: "" })); }}>같은 곳 추가 예약</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        {/* 단계 표시 */}
        <ol className="grid grid-cols-4 gap-1.5">
          {STEPS.map((s, i) => {
            const reachable = i === 0 || (!!facilityId && (i < 3 || (slot.date && slot.start && slotStatus === "available")));
            return (
              <li key={s.key}>
                <button type="button" disabled={!reachable} onClick={() => { setError(""); setStep(i); }}
                  className={cn("flex w-full flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-xs font-bold transition sm:flex-row sm:justify-center sm:text-sm",
                    i === step ? "border-navy bg-navy text-white" : i < step ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-white text-slate-400")}>
                  {i < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                  <span>{i + 1}. {s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {step === 0 && (
          <Card><CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={fq} onChange={(e) => setFq(e.target.value)} placeholder="이름 · 지역 · 전문 분야 검색" className="pl-9" />
              </div>
              <div className="flex gap-1.5">
                {[["", "전체"], ["STUDIO", "스튜디오"], ["WAREHOUSE", "창고"]].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setFtype(v)} className={cn("h-11 rounded-lg border px-3 text-sm font-semibold", ftype === v ? "border-navy bg-navy text-white" : "border-border bg-white text-navy")}>{l}</button>
                ))}
              </div>
            </div>
            {filteredFacilities.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">조건에 맞는 창고(스튜디오)가 없습니다.</p> : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {filteredFacilities.map((f) => (
                  <button key={f.id} type="button" onClick={() => chooseFacility(f.id)}
                    className={cn("flex gap-3 rounded-2xl border-2 p-3 text-left transition", f.id === facilityId ? "border-brand-500 bg-brand-50/60" : "border-border bg-white hover:border-brand-200")}>
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {f.thumbnailUrl ? <img src={f.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Warehouse className="h-7 w-7 text-slate-300" /></div>}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge tone={f.type === "STUDIO" ? "purple" : "blue"} className="px-2 py-0 text-[10px]">{f.type === "STUDIO" ? "스튜디오" : "창고"}</Badge>
                        {f.autoApprove && <Badge tone="green" className="px-2 py-0 text-[10px]"><Zap className="mr-0.5 h-3 w-3" />즉시 확정</Badge>}
                        {f.favorite && <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />}
                      </div>
                      <p className="truncate font-bold text-navy">{f.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-slate-500"><MapPin className="h-3 w-3 shrink-0" />{f.region} · {f.address}</p>
                      <p className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-brand-500 text-brand-500" />{f.rating.toFixed(1)}</span>
                        <span>상품 {f.productCount}개</span>
                        <span className="font-bold text-emerald-700">이용료 무료</span>
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent></Card>
        )}

        {step === 1 && facility && (
          <Card><CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-lg font-extrabold text-navy">{facility.name}의 판매 상품</p>
                <p className="text-xs text-slate-500">방송에서 판매할 상품과 수량을 고르세요. 예약 후 라이브 세션을 만들면 상품번호가 자동으로 붙습니다.</p>
              </div>
              {products.length > 0 && <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setPicks(Object.keys(picks).length === products.length ? {} : Object.fromEntries(products.map((p) => [p.id, picks[p.id] ?? 1])))}>{Object.keys(picks).length === products.length ? "전체 해제" : "전체 선택"}</button>}
            </div>
            {productsLoading ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />상품 불러오는 중...</div>
              : products.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  <Package className="mx-auto mb-2 h-8 w-8 text-slate-300" />아직 이 창고(스튜디오)에 등록된 상품이 없습니다.<br />상품 없이 예약하고, 방송 때 임시 상품을 추가할 수 있어요.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="상품명 검색" className="pl-9" />
                    </div>
                    {categories.length > 1 && <Select value={pcat} onChange={(e) => setPcat(e.target.value)} className="sm:w-40"><option value="">전체 카테고리</option>{categories.map((c) => <option key={c}>{c}</option>)}</Select>}
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {filteredProducts.map((p) => {
                      const q = picks[p.id] ?? 0;
                      const off = p.consumerPrice > p.salePrice ? Math.round((1 - p.salePrice / p.consumerPrice) * 100) : 0;
                      return (
                        <div key={p.id} className={cn("flex gap-3 rounded-2xl border-2 p-3 transition", q ? "border-brand-500 bg-brand-50/50" : "border-border bg-white")}>
                          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {p.product.thumbnailUrl ? <img src={p.product.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-7 w-7 text-slate-300" /></div>}
                            {off > 0 && <span className="absolute bottom-1 left-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">-{off}%</span>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-slate-500">{p.product.category}{p.bookedCount > 0 && ` · ${p.bookedCount}회 예약됨`}</p>
                            <p className="line-clamp-2 text-sm font-bold text-navy">{p.product.name}</p>
                            <p className="mt-0.5 text-sm font-extrabold text-brand-700">{formatKRW(p.salePrice)}</p>
                            <p className="text-[11px] text-slate-500">재고 {p.stock.toLocaleString()}개 · <span className="font-semibold text-purple-700">개당 수익 {formatKRW(commissionOf(p))}</span></p>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              {q === 0 ? (
                                <Button type="button" size="sm" variant="outline" onClick={() => setQty(p.id, 1, p.stock)} disabled={p.stock === 0}>{p.stock === 0 ? "품절" : "담기"}</Button>
                              ) : (
                                <>
                                  <button type="button" onClick={() => setQty(p.id, q - 1, p.stock)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white" aria-label="수량 줄이기"><Minus className="h-4 w-4" /></button>
                                  <input value={q} inputMode="numeric" onChange={(e) => setQty(p.id, Number(e.target.value.replace(/\D/g, "")) || 0, p.stock)} className="h-9 w-16 rounded-lg border border-border text-center text-sm font-bold" aria-label="판매 예정 수량" />
                                  <button type="button" onClick={() => setQty(p.id, q + 1, p.stock)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white" aria-label="수량 늘리기"><Plus className="h-4 w-4" /></button>
                                  <span className="text-[11px] text-slate-500">개 판매 예정</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
          </CardContent></Card>
        )}

        {step === 2 && facility && (
          <Card><CardContent className="space-y-4 p-4 sm:p-5">
            {facility.bookingNotice && <p className="flex gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-900"><Info className="h-4 w-4 shrink-0" /><span className="whitespace-pre-line">{facility.bookingNotice}</span></p>}
            <SlotPicker facilityId={facility.id} value={slot} onChange={setSlot} onPolicy={setPolicy} onWaitlist={joinWaitlist} onStatusChange={setSlotStatus} />
            {notice && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>}
            <div className="rounded-2xl border border-border p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-navy"><Repeat className="h-4 w-4 text-brand-500" />정기 방송 (매주 같은 요일·시간)</p>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 4, 8, 12].map((n) => (
                  <button key={n} type="button" onClick={() => setRepeat(n)} className={cn("min-h-[40px] rounded-full border px-3.5 text-sm font-semibold", repeat === n ? "border-navy bg-navy text-white" : "border-border bg-white text-navy")}>{n === 1 ? "반복 안 함" : `${n}주`}</button>
                ))}
              </div>
              {repeat > 1 && (
                <div className="mt-3 space-y-1.5">
                  {!slot.start ? <p className="text-xs text-muted-foreground">시작 시간을 고르면 날짜별 예약 가능 여부를 보여드려요.</p>
                    : occLoading ? <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />날짜별 확인 중...</p>
                    : occ && (
                      <>
                        <div className="grid gap-1 sm:grid-cols-2">
                          {occ.map((o) => (
                            <p key={o.date} className={cn("flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs", o.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>
                              {o.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                              <span><b>{o.date}</b> {o.start}~{o.end}{!o.ok && <span className="block text-[11px]">{o.reason}</span>}</span>
                            </p>
                          ))}
                        </div>
                        {occ.some((o) => !o.ok) && (
                          <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-navy">
                            <input type="checkbox" checked={skipConflicts} onChange={(e) => setSkipConflicts(e.target.checked)} className="h-4 w-4 accent-brand-500" />
                            안 되는 날짜는 빼고 {occ.filter((o) => o.ok).length}회만 예약
                          </label>
                        )}
                      </>
                    )}
                </div>
              )}
            </div>
          </CardContent></Card>
        )}

        {step === 3 && facility && (
          <Card><CardContent className="space-y-4 p-4 sm:p-5">
            <div>
              <Label>방송 제목·목적</Label>
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={200} placeholder="예: 겨울 신상 니트 라이브 / 제철 감귤 특가전" />
            </div>
            <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
              <div>
                <Label>방문 인원</Label>
                <Input type="number" min={1} max={facility.capacity ?? 500} value={headcount} onChange={(e) => setHeadcount(e.target.value)} placeholder="명" />
                {facility.capacity ? <p className="mt-1 text-[11px] text-muted-foreground">최대 {facility.capacity}명</p> : null}
              </div>
              <div>
                <Label>요청사항</Label>
                <Textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} rows={3} maxLength={1000} placeholder="예: 그린스크린 세팅, 상품 진열대 2개, 주차 2대, 상품 사전 검수 요청" />
              </div>
            </div>
            {facility.cancelPolicy && (
              <label className="flex items-start gap-2 rounded-xl border border-border p-3 text-xs text-slate-600">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-500" />
                <span><b className="text-navy">취소·환불 규정에 동의합니다.</b><br /><span className="whitespace-pre-line">{facility.cancelPolicy}</span></span>
              </label>
            )}
            <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-slate-600">
              {facility.autoApprove ? "이 공간은 신청 즉시 예약이 확정됩니다." : "창고(스튜디오) 관리자가 승인하면 예약이 확정됩니다."}{" "}
              승인된 예약은 이용 {facility.cancelDeadlineHours}시간 전까지 직접 일정 변경·취소할 수 있어요.
            </p>
          </CardContent></Card>
        )}

        {error && <p className="flex items-start gap-2 whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

        <div className="sticky bottom-20 z-10 flex gap-2 rounded-2xl border border-[#E9E5DC] bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-3">
          {step > 0 && <Button type="button" variant="outline" onClick={() => { setError(""); setStep(step - 1); }}><ChevronLeft className="h-4 w-4" />이전</Button>}
          {step < 3 ? (
            <Button type="button" className="flex-1" onClick={goNext} disabled={step === 0 && !facilityId}>
              {step === 1 ? (picked.length ? `상품 ${picked.length}종 선택 · 다음` : "상품 없이 다음") : "다음"}<ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" className="flex-1" size="lg" onClick={submit} disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />처리 중...</> : facility?.autoApprove ? `${okOcc > 1 ? `${okOcc}회 ` : ""}바로 예약 확정` : `${okOcc > 1 ? `${okOcc}회 ` : ""}예약 신청하기`}
            </Button>
          )}
        </div>
      </div>

      {/* 요약 */}
      <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
        <Card><CardContent className="space-y-3 p-4">
          <p className="flex items-center justify-between text-sm font-extrabold text-navy">예약 요약 <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700"><Gift className="h-3.5 w-3.5" />이용료 무료</span></p>
          <Row label="장소" value={facility ? facility.name : "선택 전"} />
          <Row label="일정" value={slot.date && slot.start ? `${slot.date} ${slot.start}~${endTime} (${slot.hours}시간)` : "선택 전"} />
          {repeat > 1 && <Row label="반복" value={`매주 · ${occ ? `${occ.filter((o) => o.ok).length}/${occ.length}회 가능` : `${repeat}회`}`} />}
          <Row label="확정 방식" value={facility ? (facility.autoApprove ? "즉시 확정" : "관리자 승인") : "-"} />
          {policy && <Row label="변경·취소" value={`이용 ${policy.cancelDeadlineHours}시간 전까지`} />}
          <div className="border-t border-border pt-3">
            <p className="mb-1.5 text-xs font-bold text-navy">판매 예정 상품 {picked.length}종</p>
            {picked.length === 0 ? <p className="text-xs text-muted-foreground">선택한 상품이 없습니다.</p> : (
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                {picked.map((p) => <li key={p.id} className="flex justify-between gap-2"><span className="truncate text-slate-600">{p.product.name}</span><span className="shrink-0 font-semibold text-navy">×{picks[p.id]}</span></li>)}
              </ul>
            )}
            {picked.length > 0 && (
              <div className="mt-2 space-y-0.5 rounded-xl bg-purple-50 p-2.5 text-xs">
                <p className="flex justify-between text-slate-600"><span>완판 시 매출</span><b className="text-navy">{formatKRW(expectedRevenue)}</b></p>
                <p className="flex justify-between text-purple-700"><span>예상 셀러 수익</span><b>{formatKRW(expectedCommission)}</b></p>
              </div>
            )}
          </div>
        </CardContent></Card>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <p className="flex justify-between gap-3 text-xs"><span className="shrink-0 text-slate-500">{label}</span><span className="text-right font-semibold text-navy">{value}</span></p>;
}
