"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatKRW } from "@/lib/utils";
import { Blocks, Search, ShoppingCart, Plus, Minus, X, Radio } from "lucide-react";

type Item = { id: string; displayNumber: number; name: string; price: number; stock: number; image: string | null; option: string | null };

export function BuyerLive({
  slug, sessionId, title, sellerName, facilityName, status, playbackUrl, initial,
}: { slug: string; sessionId: string; title: string; sellerName: string; facilityName: string; status: string; playbackUrl: string | null; initial: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initial);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);

  // 실시간 폴링 (상품번호/목록 변경 즉시 반영)
  const poll = useCallback(async () => {
    const r = await fetch(`/api/live-sessions/${sessionId}/poll`).then((r) => r.json()).catch(() => null);
    if (r?.ok && r.data.numberVersion !== version) {
      setItems(r.data.products.map((p: any) => ({ id: p.id, displayNumber: p.displayNumber, name: p.nameSnapshot, price: p.priceSnapshot, stock: p.stockSnapshot, image: p.imageSnapshot, option: null })));
      setVersion(r.data.numberVersion);
    }
  }, [sessionId, version]);
  useEffect(() => { const t = setInterval(poll, 4000); return () => clearInterval(t); }, [poll]);

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((i) => String(i.displayNumber) === query || i.name.toLowerCase().includes(q));
  }, [items, query]);

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const dec = (id: string) => setCart((c) => { const n = (c[id] ?? 0) - 1; const next = { ...c }; if (n <= 0) delete next[id]; else next[id] = n; return next; });
  const cartItems = Object.entries(cart).map(([id, qty]) => ({ item: items.find((i) => i.id === id)!, qty })).filter((x) => x.item);
  const cartCount = cartItems.reduce((s, x) => s + x.qty, 0);
  const cartTotal = cartItems.reduce((s, x) => s + x.item.price * x.qty, 0);

  function goCheckout() {
    const payload = cartItems.map((x) => ({ liveSessionProductId: x.item.id, quantity: x.qty }));
    sessionStorage.setItem(`cart-${slug}`, JSON.stringify(payload));
    router.push(`/checkout/${slug}`);
  }

  const live = status === "LIVE";

  return (
    <div className="min-h-screen bg-muted/30 pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-white">
        <div className="container max-w-3xl flex h-14 items-center gap-2">
          <Blocks className="h-6 w-6 text-brand-500" />
          <div className="flex-1 min-w-0"><p className="font-bold text-navy truncate">{title}</p></div>
          {live ? <Badge tone="red"><span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />LIVE</Badge> : <Badge tone="gray">{status === "ENDED" ? "방송종료" : "방송예정"}</Badge>}
        </div>
      </header>

      <div className="container max-w-3xl py-4">
        {/* 영상 영역 */}
        <div className="aspect-video w-full rounded-xl bg-navy flex flex-col items-center justify-center text-white/70">
          <Radio className="h-10 w-10 mb-2 text-brand-500" />
          <p className="text-sm">{live ? "라이브 방송 중" : "방송 대기 중"}</p>
          {playbackUrl && <p className="mt-1 text-xs text-white/40 px-4 text-center break-all">재생 URL: {playbackUrl}</p>}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{sellerName} · {facilityName}</p>

        {/* 상품번호 검색 */}
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-white px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="상품번호 또는 상품명 검색" className="h-12 flex-1 bg-transparent text-base outline-none" inputMode="text" />
          {query && <button onClick={() => setQuery("")} className="tap p-1"><X className="h-4 w-4" /></button>}
        </div>

        {/* 상품 리스트 */}
        <div className="mt-4 space-y-2">
          {filtered.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">상품이 없습니다.</p>}
          {filtered.map((it) => {
            const qty = cart[it.id] ?? 0;
            const sold = it.stock <= 0;
            return (
              <div key={it.id} className="flex items-center gap-3 rounded-xl border border-border bg-white p-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-2xl font-extrabold text-white">{it.displayNumber}</div>
                {it.image && /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={it.image} alt="" className="h-14 w-14 rounded-lg object-cover bg-muted shrink-0 hidden xs:block sm:block" />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-navy truncate">{it.name}</p>
                  <p className="text-sm text-muted-foreground">{formatKRW(it.price)}{sold && <span className="ml-2 text-red-500">품절</span>}</p>
                </div>
                {qty > 0 ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => dec(it.id)} className="tap flex h-9 w-9 items-center justify-center rounded-lg border"><Minus className="h-4 w-4" /></button>
                    <span className="w-6 text-center font-semibold">{qty}</span>
                    <button onClick={() => add(it.id)} disabled={qty >= it.stock} className="tap flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <Button size="sm" disabled={sold} onClick={() => add(it.id)}>담기</Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 장바구니 바 */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-white p-3">
          <div className="container max-w-3xl flex items-center gap-3">
            <button onClick={() => setCartOpen(!cartOpen)} className="relative tap p-2">
              <ShoppingCart className="h-6 w-6 text-navy" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">{cartCount}</span>
            </button>
            <div className="flex-1"><p className="text-xs text-muted-foreground">총 결제금액</p><p className="font-bold text-navy">{formatKRW(cartTotal)}</p></div>
            <Button size="lg" onClick={goCheckout}>주문하기</Button>
          </div>
          {cartOpen && (
            <div className="container max-w-3xl mt-3 max-h-60 overflow-y-auto border-t pt-3 space-y-2">
              {cartItems.map((x) => (
                <div key={x.item.id} className="flex items-center gap-2 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-500 text-xs font-bold text-white">{x.item.displayNumber}</span>
                  <span className="flex-1 truncate">{x.item.name}</span>
                  <span>{x.qty}개</span><span className="w-20 text-right font-semibold">{formatKRW(x.item.price * x.qty)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
