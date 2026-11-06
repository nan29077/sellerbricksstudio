"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Package, Tag, CheckSquare, Square, ChevronDown, ChevronUp,
  TrendingUp, AlertCircle, Star, Clock, Loader2,
} from "lucide-react";
import { todayKST } from "@/lib/utils";

type Facility = {
  id: string;
  name: string;
  type: string;
  region: string;
  openTime: string | null;
  closeTime: string | null;
  basePrice?: number;
  minHours?: number;
  capacity?: number | null;
  cancelPolicy?: string | null;
};

type Availability = {
  openTime: string; closeTime: string; minHours: number; basePrice: number; capacity: number | null;
  hasSlots: boolean; slots: { startTime: string; endTime: string }[]; closed: boolean; closedReason: string | null;
  booked: { start: string; end: string; status: string }[];
};

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const toHm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

type FacilityProduct = {
  id: string;
  salePrice: number;
  consumerPrice: number;
  stock: number;
  commissionType: string;
  commissionValue: number;
  isSellable: boolean;
  product: {
    id: string;
    name: string;
    category: string;
    thumbnailUrl: string | null;
  };
};

function formatKRW(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

export function BookingForm({
  facilities,
  defaultFacilityId,
  defaultStart,
  defaultEnd,
}: {
  facilities: Facility[];
  defaultFacilityId?: string;
  defaultStart?: string;
  defaultEnd?: string;
}) {
  const router = useRouter();

  // Form state
  const [facilityId, setFacilityId] = useState(defaultFacilityId ?? facilities[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [start, setStart] = useState(defaultStart ?? "10:00");
  const [end, setEnd] = useState(defaultEnd ?? "12:00");
  const [purpose, setPurpose] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [avail, setAvail] = useState<Availability | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Products state
  const [products, setProducts] = useState<FacilityProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showProducts, setShowProducts] = useState(true);

  const currentFacility = facilities.find((f) => f.id === facilityId);

  const fetchProducts = useCallback(async (fid: string) => {
    if (!fid) return;
    setProductsLoading(true);
    setSelectedIds(new Set());
    try {
      const res = await fetch(`/api/facilities/${fid}/products`);
      const json = await res.json();
      setProducts(Array.isArray(json.data) ? json.data : []);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(facilityId);
  }, [facilityId, fetchProducts]);

  // 날짜 · 창고(스튜디오)가 바뀌면 그날의 예약 현황을 불러온다.
  useEffect(() => {
    if (!facilityId || !date) { setAvail(null); return; }
    let alive = true;
    setAvailLoading(true);
    fetch(`/api/facilities/${facilityId}/availability?date=${date}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setAvail(j.ok ? j.data : null); })
      .catch(() => alive && setAvail(null))
      .finally(() => alive && setAvailLoading(false));
    return () => { alive = false; };
  }, [facilityId, date]);

  const durationMin = toMin(end) - toMin(start);
  const hours = durationMin > 0 ? durationMin / 60 : 0;
  const unitPrice = avail?.basePrice ?? currentFacilityPrice();
  const estimate = Math.round(unitPrice * hours);
  const minHours = avail?.minHours ?? facilities.find((f) => f.id === facilityId)?.minHours ?? 1;
  const conflict = avail?.booked.find((b) => toMin(start) < toMin(b.end) && toMin(end) > toMin(b.start));

  function currentFacilityPrice() {
    return facilities.find((f) => f.id === facilityId)?.basePrice ?? 0;
  }
  function setDuration(h: number) {
    const e = Math.min(toMin(start) + h * 60, 24 * 60);
    setEnd(toHm(e));
  }

  function toggleProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  }

  const selectedProducts = products.filter((p) => selectedIds.has(p.id));
  const expectedProductsText = selectedProducts.map((p) => p.product.name).join(", ");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!date) { setError("날짜를 선택하세요."); return; }
    if (!start || !end) { setError("시작/종료 시간을 선택하세요."); return; }
    if (durationMin <= 0) { setError("종료 시간은 시작 시간보다 뒤여야 합니다."); return; }
    if (hours < minHours) { setError(`최소 ${minHours}시간 이상 예약해야 합니다.`); return; }
    if (avail?.closed) { setError(`선택한 날짜는 예약할 수 없습니다. (${avail.closedReason})`); return; }
    if (conflict) { setError(`${conflict.start}~${conflict.end}에 이미 예약이 있습니다. 다른 시간을 선택하세요.`); return; }
    if (currentFacility?.cancelPolicy && !agree) { setError("취소·환불 규정에 동의해 주세요."); return; }

    setLoading(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId,
        purpose,
        expectedProducts: expectedProductsText || undefined,
        headcount: headcount ? Number(headcount) : undefined,
        requestNote: requestNote || undefined,
        startAt: `${date}T${start}:00`,
        endAt: `${date}T${end}:00`,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!json.ok) { setError(json.error ?? "예약 신청에 실패했습니다."); return; }
    router.push("/seller/bookings?status=PENDING");
    router.refresh();
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* Facility & Time selection */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <h2 className="font-bold text-navy mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand-500" />
            예약 정보
          </h2>
          <div className="space-y-4">
            <div>
              <Label>창고(스튜디오) 선택</Label>
              <Select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.type === "WAREHOUSE" ? "창고" : "스튜디오"}, {f.region})
                  </option>
                ))}
              </Select>
            </div>

            {currentFacility && (
              <div className="rounded-lg bg-brand-50 border border-brand-100 px-3 py-2 flex items-center gap-3 text-sm text-brand-700">
                <Badge tone={currentFacility.type === "WAREHOUSE" ? "blue" : "purple"}>
                  {currentFacility.type === "WAREHOUSE" ? "창고" : "스튜디오"}
                </Badge>
                <span className="font-medium">{currentFacility.region}</span>
                {currentFacility.openTime && (
                  <span className="ml-auto text-xs text-brand-600">
                    운영 {currentFacility.openTime} ~ {currentFacility.closeTime}
                  </span>
                )}
              </div>
            )}

            <div>
              <Label>방송 날짜</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={todayKST()}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>시작 시간</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <Label>종료 시간</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">이용 시간</span>
              {[1, 2, 3, 4, 6, 8].filter((h) => h >= minHours).map((h) => (
                <button key={h} type="button" onClick={() => setDuration(h)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${Math.abs(hours - h) < 0.01 ? "border-navy bg-navy text-white" : "border-border bg-white text-navy hover:border-brand-300"}`}>
                  {h}시간
                </button>
              ))}
              <span className="ml-auto text-xs font-semibold text-navy">{hours > 0 ? `${hours}시간` : "-"}{minHours > 1 && ` · 최소 ${minHours}시간`}</span>
            </div>

            {date && (
              <div className="rounded-xl border border-border bg-white p-3">
                <p className="mb-2 text-xs font-bold text-navy">{date} 예약 현황</p>
                {availLoading ? <p className="text-xs text-muted-foreground">확인 중...</p> : !avail ? <p className="text-xs text-muted-foreground">예약 현황을 불러오지 못했습니다.</p> : avail.closed ? (
                  <p className="text-xs font-semibold text-red-600">예약 불가 · {avail.closedReason}</p>
                ) : (
                  <>
                    <div className="relative h-7 overflow-hidden rounded-md bg-emerald-50">
                      {(() => {
                        const o = toMin(avail.openTime), c = Math.max(toMin(avail.closeTime), o + 60), span = c - o;
                        const pos = (a: string, b: string) => ({ left: `${Math.max(0, (toMin(a) - o) / span * 100)}%`, width: `${Math.max(0, (Math.min(toMin(b), c) - Math.max(toMin(a), o)) / span * 100)}%` });
                        return (
                          <>
                            {avail.booked.map((b, i) => <div key={i} className={`absolute inset-y-0 ${b.status === "APPROVED" ? "bg-red-300" : "bg-amber-200"}`} style={pos(b.start, b.end)} title={`${b.start}~${b.end}`} />)}
                            {durationMin > 0 && <div className={`absolute inset-y-1 rounded border-2 ${conflict ? "border-red-600" : "border-navy"}`} style={pos(start, end)} />}
                          </>
                        );
                      })()}
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>{avail.openTime}</span><span>{avail.closeTime}</span></div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {avail.booked.length === 0 ? "아직 예약이 없어 원하는 시간에 신청할 수 있어요." : `예약된 시간: ${avail.booked.map((b) => `${b.start}~${b.end}${b.status === "PENDING" ? "(대기)" : ""}`).join(", ")}`}
                    </p>
                    {avail.hasSlots && <p className="mt-0.5 text-[11px] text-muted-foreground">운영 시간대: {avail.slots.map((s) => `${s.startTime}~${s.endTime}`).join(", ")}</p>}
                    {conflict && <p className="mt-1 text-xs font-semibold text-red-600">선택한 시간이 기존 예약({conflict.start}~{conflict.end})과 겹칩니다.</p>}
                  </>
                )}
              </div>
            )}
            <div>
              <Label>방송 목적</Label>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="예: 신상 패션 라이브 / 건강식품 특가전"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
              <div>
                <Label>방문 인원</Label>
                <Input type="number" min={1} max={currentFacility?.capacity ?? 500} value={headcount} onChange={(e) => setHeadcount(e.target.value)} placeholder="명" />
                {currentFacility?.capacity ? <p className="mt-1 text-[11px] text-muted-foreground">최대 {currentFacility.capacity}명</p> : null}
              </div>
              <div>
                <Label>요청사항</Label>
                <Textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} rows={2} maxLength={1000} placeholder="예: 그린스크린 세팅, 조명 사전 점검, 주차 2대" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Selection Panel */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <button
            type="button"
            className="w-full flex items-center justify-between"
            onClick={() => setShowProducts((v) => !v)}
          >
            <h2 className="font-bold text-navy flex items-center gap-2">
              <Package className="h-4 w-4 text-brand-500" />
              판매할 상품 선택
              {selectedIds.size > 0 && (
                <span className="text-xs bg-brand-500 text-white rounded-full px-2 py-0.5 ml-1">
                  {selectedIds.size}개 선택
                </span>
              )}
            </h2>
            {showProducts ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {showProducts && (
            <div className="mt-4">
              {productsLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  상품 불러오는 중...
                </div>
              ) : products.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  이 창고(스튜디오)에 등록된 상품이 없습니다.
                </div>
              ) : (
                <>
                  {/* Select all / hint */}
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground">
                      방송에서 판매할 상품을 선택하세요. (복수 선택 가능)
                    </p>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      {selectedIds.size === products.length ? "전체 해제" : "전체 선택"}
                    </button>
                  </div>

                  {/* Product grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {products.map((fp) => {
                      const selected = selectedIds.has(fp.id);
                      const discountPct =
                        fp.consumerPrice > 0
                          ? Math.round((1 - fp.salePrice / fp.consumerPrice) * 100)
                          : 0;

                      return (
                        <button
                          key={fp.id}
                          type="button"
                          onClick={() => toggleProduct(fp.id)}
                          className={`relative text-left rounded-xl border-2 overflow-hidden transition-all ${
                            selected
                              ? "border-brand-500 shadow-md shadow-brand-100"
                              : "border-border hover:border-brand-200"
                          }`}
                        >
                          {/* Checkbox indicator */}
                          <div className={`absolute top-2 right-2 z-10 ${selected ? "text-brand-500" : "text-muted-foreground/30"}`}>
                            {selected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                          </div>

                          {/* Thumbnail */}
                          <div className="aspect-square overflow-hidden bg-muted relative">
                            {fp.product.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={fp.product.thumbnailUrl}
                                alt={fp.product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground/20" />
                              </div>
                            )}
                            {discountPct > 0 && (
                              <div className="absolute bottom-1.5 left-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                -{discountPct}%
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-2.5">
                            <p className="text-[10px] text-muted-foreground mb-0.5">{fp.product.category}</p>
                            <p className="text-xs font-semibold text-navy line-clamp-2 mb-1.5">{fp.product.name}</p>
                            <div className="flex items-center gap-1 mb-0.5">
                              <Tag className="h-3 w-3 text-brand-500 shrink-0" />
                              <span className="text-sm font-bold text-brand-700">{formatKRW(fp.salePrice)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">재고 {fp.stock}개</span>
                              <span className="text-[10px] text-purple-600 bg-purple-50 rounded px-1 py-0.5">
                                커미션 {fp.commissionValue}%
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected summary */}
                  {selectedIds.size > 0 && (
                    <div className="mt-4 rounded-xl bg-brand-50 border border-brand-100 p-3">
                      <p className="text-xs font-bold text-brand-700 flex items-center gap-1.5 mb-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        선택된 상품 ({selectedIds.size}개)
                      </p>
                      <p className="text-xs text-brand-600/80 leading-relaxed">{expectedProductsText}</p>
                    </div>
                  )}

                  {selectedIds.size === 0 && (
                    <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 p-2.5 flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        상품을 선택하지 않아도 예약할 수 있습니다. 방송 중 판매할 상품은 예약 후 라이브 세션에서도 추가할 수 있습니다.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission info */}
      {selectedIds.size > 0 && (
        <Card className="border-purple-100 bg-purple-50/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-bold text-purple-700 flex items-center gap-1.5 mb-2">
              <Star className="h-3.5 w-3.5" /> 예상 수익 안내
            </p>
            <div className="space-y-1.5">
              {selectedProducts.map((fp) => {
                const commission = fp.commissionType === "PERCENT"
                  ? Math.round(fp.salePrice * fp.commissionValue / 100)
                  : fp.commissionValue;
                return (
                  <div key={fp.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[60%]">{fp.product.name}</span>
                    <span className="font-semibold text-purple-700 shrink-0">
                      판매시 {formatKRW(commission)} 수익
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <form onSubmit={onSubmit}>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <div className="rounded-lg bg-muted/50 p-3 mb-4 space-y-1 text-xs text-muted-foreground">
              <p><span className="font-semibold text-navy">창고(스튜디오):</span> {currentFacility?.name}</p>
              {date && <p><span className="font-semibold text-navy">날짜:</span> {date} {start} ~ {end}</p>}
              {purpose && <p><span className="font-semibold text-navy">목적:</span> {purpose}</p>}
              {selectedIds.size > 0 && (
                <p><span className="font-semibold text-navy">상품:</span> {selectedIds.size}개 선택</p>
              )}
              {headcount && <p><span className="font-semibold text-navy">인원:</span> {headcount}명</p>}
              {unitPrice > 0 && hours > 0 && (
                <p className="pt-1 text-sm"><span className="font-semibold text-navy">예상 이용료:</span> <span className="font-extrabold text-brand-700">{formatKRW(estimate)}</span> <span>({formatKRW(unitPrice)} × {hours}시간)</span></p>
              )}
            </div>
            {currentFacility?.cancelPolicy && (
              <label className="mb-4 flex items-start gap-2 rounded-lg border border-border p-3 text-xs text-muted-foreground">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-500" />
                <span><span className="font-semibold text-navy">취소·환불 규정에 동의합니다.</span><br /><span className="whitespace-pre-line">{currentFacility.cancelPolicy}</span></span>
              </label>
            )}
            <Button className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />처리 중...</>
              ) : (
                "예약 신청하기"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-3">
              예약 신청 후 창고(스튜디오) 관리자의 승인이 완료되면 예약이 확정됩니다.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
