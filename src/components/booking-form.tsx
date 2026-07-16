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
};

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
}: {
  facilities: Facility[];
  defaultFacilityId?: string;
}) {
  const router = useRouter();

  // Form state
  const [facilityId, setFacilityId] = useState(defaultFacilityId ?? facilities[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("12:00");
  const [purpose, setPurpose] = useState("");
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

    setLoading(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId,
        purpose,
        expectedProducts: expectedProductsText || undefined,
        startAt: `${date}T${start}:00`,
        endAt: `${date}T${end}:00`,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!json.ok) { setError(json.error ?? "예약 신청에 실패했습니다."); return; }
    router.push("/seller/bookings");
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
              <Label>시설 선택</Label>
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
            <div>
              <Label>방송 목적</Label>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="예: 신상 패션 라이브 / 건강식품 특가전"
              />
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
                  이 시설에 등록된 상품이 없습니다.
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
              <p><span className="font-semibold text-navy">시설:</span> {currentFacility?.name}</p>
              {date && <p><span className="font-semibold text-navy">날짜:</span> {date} {start} ~ {end}</p>}
              {purpose && <p><span className="font-semibold text-navy">목적:</span> {purpose}</p>}
              {selectedIds.size > 0 && (
                <p><span className="font-semibold text-navy">상품:</span> {selectedIds.size}개 선택</p>
              )}
            </div>
            <Button className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />처리 중...</>
              ) : (
                "예약 신청하기"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-3">
              예약 신청 후 시설 운영자의 승인이 완료되면 예약이 확정됩니다.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
