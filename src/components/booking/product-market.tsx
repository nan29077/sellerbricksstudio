"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package, Star, Zap, Plus, Minus, X, CalendarPlus, ShoppingBag, Truck, ChevronUp, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn, formatKRW, sellerUnitProfit } from "@/lib/utils";
import { facilityTypeLabel, facilityTypeTone } from "@/lib/status";

export type MarketItem = {
  id: string; name: string; category: string; description: string | null; image: string | null;
  salePrice: number; consumerPrice: number; stock: number; shippingInfo: string | null;
  commissionType: string; commissionValue: number; bookedCount: number; supplyPrice?: number | null;
  facility: { id: string; name: string; type: string; region: string; rating: number; autoApprove: boolean };
};
type Pick = { qty: number; name: string; facilityId: string; facilityName: string; price: number; commission: number };

const KEY = "sb.productPicks";
// 공급가 방식: 판매가 − 공급가 (판매 수수료 차감 전) · 수수료 방식: 셀러 수수료
const commissionOf = (i: { commissionType: string; commissionValue: number; salePrice: number; supplyPrice?: number | null }) => sellerUnitProfit(i);

// 상품 카드 목록 + 담은 상품(창고별) 바구니. 담은 내용은 페이지를 넘겨도 유지된다(이 브라우저 탭 한정).
export function ProductMarket({ items }: { items: MarketItem[] }) {
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<MarketItem | null>(null);

  useEffect(() => { try { setPicks(JSON.parse(sessionStorage.getItem(KEY) ?? "{}")); } catch { /* ignore */ } }, []);
  function save(next: Record<string, Pick>) { setPicks(next); try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ } }

  function setQty(i: MarketItem, qty: number) {
    const next = { ...picks };
    const max = i.stock > 0 ? i.stock : 100000;
    if (qty <= 0) delete next[i.id];
    else next[i.id] = { qty: Math.min(max, qty), name: i.name, facilityId: i.facility.id, facilityName: i.facility.name, price: i.salePrice, commission: commissionOf(i) };
    save(next);
  }

  const groups = useMemo(() => {
    const m = new Map<string, { facilityId: string; facilityName: string; items: (Pick & { id: string })[] }>();
    for (const [id, p] of Object.entries(picks)) {
      const g = m.get(p.facilityId) ?? { facilityId: p.facilityId, facilityName: p.facilityName, items: [] };
      g.items.push({ id, ...p }); m.set(p.facilityId, g);
    }
    return [...m.values()];
  }, [picks]);
  const count = Object.keys(picks).length;
  const hrefFor = (g: (typeof groups)[number]) => `/seller/bookings/new?facilityId=${g.facilityId}&products=${g.items.map((i) => `${i.id}:${i.qty}`).join(",")}`;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {items.map((i) => {
          const q = picks[i.id]?.qty ?? 0;
          const off = i.consumerPrice > i.salePrice ? Math.round((1 - i.salePrice / i.consumerPrice) * 100) : 0;
          return (
            <div key={i.id} className={cn("flex flex-col overflow-hidden rounded-2xl border-2 bg-white transition", q ? "border-brand-500 shadow-md" : "border-[#E9E5DC]")}>
              <button type="button" onClick={() => setDetail(i)} className="relative aspect-square bg-muted text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {i.image ? <img src={i.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-10 w-10 text-slate-300" /></div>}
                {off > 0 && <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">-{off}%</span>}
                {i.stock === 0 && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-bold text-slate-600">품절</span>}
              </button>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="text-[11px] text-slate-500">{i.category}{i.bookedCount > 0 && ` · ${i.bookedCount}회 예약`}</p>
                <button type="button" onClick={() => setDetail(i)} className="line-clamp-2 text-left text-sm font-bold text-navy hover:underline">{i.name}</button>
                <p className="text-base font-extrabold text-brand-700">{formatKRW(i.salePrice)}{off > 0 && <span className="ml-1 text-[11px] font-normal text-slate-400 line-through">{formatKRW(i.consumerPrice)}</span>}</p>
                {i.supplyPrice != null
                  ? <p className="text-[11px] font-semibold text-purple-700">공급가 {formatKRW(i.supplyPrice)} · 개당 마진 {formatKRW(commissionOf(i))}</p>
                  : <p className="text-[11px] font-semibold text-purple-700">개당 수익 {formatKRW(commissionOf(i))}{i.commissionType === "PERCENT" && ` (${i.commissionValue}%)`}</p>}
                <Link href={`/facilities/${i.facility.id}`} className="mt-auto flex items-center gap-1 truncate pt-1 text-[11px] text-slate-500 hover:underline">
                  <Badge tone={facilityTypeTone(i.facility.type)} className="shrink-0 px-1.5 py-0 text-[11px]">{facilityTypeLabel(i.facility.type)}</Badge>
                  <span className="truncate">{i.facility.name} · {i.facility.region}</span>
                </Link>
                <div className="mt-1.5">
                  {q === 0 ? (
                    <Button size="sm" variant="outline" className="w-full" disabled={i.stock === 0} onClick={() => setQty(i, 1)}><Plus className="h-4 w-4" />방송 상품 담기</Button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setQty(i, q - 1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border" aria-label="수량 줄이기"><Minus className="h-4 w-4" /></button>
                      <input value={q} inputMode="numeric" onChange={(e) => setQty(i, Number(e.target.value.replace(/\D/g, "")) || 0)} className="h-9 min-w-0 flex-1 rounded-lg border border-border text-center text-sm font-bold" aria-label="판매 예정 수량" />
                      <button type="button" onClick={() => setQty(i, q + 1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border" aria-label="수량 늘리기"><Plus className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 px-3 md:bottom-4 md:left-auto md:right-6 md:w-[420px] md:px-0">
          <div className="rounded-2xl border border-navy/20 bg-white shadow-2xl">
            <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
              <ShoppingBag className="h-5 w-5 text-brand-600" />
              <span className="flex-1 text-sm font-bold text-navy">담은 상품 {count}종 · 창고(스튜디오) {groups.length}곳</span>
              {open ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronUp className="h-4 w-4 text-slate-500" />}
            </button>
            {groups.length === 1 && !open && (
              <div className="px-4 pb-3"><Link href={hrefFor(groups[0])}><Button className="w-full"><CalendarPlus className="h-4 w-4" />{groups[0].facilityName} 예약하기</Button></Link></div>
            )}
            {open && (
              <div className="max-h-[50vh] space-y-3 overflow-y-auto border-t border-border px-4 py-3">
                {groups.map((g) => (
                  <div key={g.facilityId} className="space-y-1.5 rounded-xl bg-muted/40 p-3">
                    <p className="text-sm font-bold text-navy">{g.facilityName}</p>
                    {g.items.map((it) => (
                      <p key={it.id} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 truncate text-slate-600">{it.name}</span>
                        <span className="font-semibold text-navy">×{it.qty}</span>
                        <button type="button" aria-label="빼기" onClick={() => { const n = { ...picks }; delete n[it.id]; save(n); }}><X className="h-3.5 w-3.5 text-slate-400" /></button>
                      </p>
                    ))}
                    <p className="text-[11px] text-purple-700">예상 수익(완판 시) {formatKRW(g.items.reduce((a, it) => a + it.commission * it.qty, 0))}</p>
                    <Link href={hrefFor(g)}><Button size="sm" className="mt-1 w-full"><CalendarPlus className="h-4 w-4" />이 상품으로 예약하기</Button></Link>
                  </div>
                ))}
                <button type="button" onClick={() => save({})} className="w-full text-center text-xs text-slate-500 underline">모두 비우기</button>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""}
        footer={detail && <>
          <Button variant="outline" size="sm" onClick={() => setDetail(null)}>닫기</Button>
          <Button size="sm" disabled={detail.stock === 0} onClick={() => { if (!picks[detail.id]) setQty(detail, 1); setDetail(null); }}>{picks[detail.id] ? "담겨 있음" : "방송 상품 담기"}</Button>
        </>}>
        {detail && (
          <div className="space-y-3 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {detail.image && <img src={detail.image} alt="" className="aspect-video w-full rounded-xl object-cover" />}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Info label="판매가" value={formatKRW(detail.salePrice)} />
              <Info label="소비자가" value={formatKRW(detail.consumerPrice)} />
              <Info label="재고" value={`${detail.stock.toLocaleString()}개`} />
              {detail.supplyPrice != null && <Info label="셀러 공급가" value={formatKRW(detail.supplyPrice)} />}
              <Info label={detail.supplyPrice != null ? "개당 마진 (수수료 차감 전)" : "개당 셀러 수익"} value={formatKRW(commissionOf(detail))} />
            </div>
            {detail.shippingInfo && <p className="flex items-center gap-1.5 text-xs text-slate-600"><Truck className="h-3.5 w-3.5" />{detail.shippingInfo}</p>}
            {detail.description && <p className="whitespace-pre-line text-slate-600">{detail.description}</p>}
            <div className="rounded-xl border border-border p-3 text-xs">
              <p className="font-bold text-navy">{detail.facility.name}</p>
              <p className="mt-0.5 flex items-center gap-2 text-slate-500">
                {detail.facility.region} · <Star className="h-3 w-3 fill-brand-500 text-brand-500" />{detail.facility.rating.toFixed(1)}
                {detail.facility.autoApprove && <span className="flex items-center gap-0.5 font-semibold text-emerald-700"><Zap className="h-3 w-3" />즉시 확정</span>}
              </p>
              <Link href={`/facilities/${detail.facility.id}`} className="mt-1 inline-block font-semibold text-brand-700">창고(스튜디오) 보기 →</Link>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/50 px-2.5 py-2"><p className="text-slate-500">{label}</p><p className="font-bold text-navy">{value}</p></div>;
}
