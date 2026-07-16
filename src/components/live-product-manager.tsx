"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatKRW } from "@/lib/utils";
import { GripVertical, Pencil, Trash2, Plus, Hash, RefreshCw, PackagePlus, Check, X } from "lucide-react";

type LSP = {
  id: string; displayNumber: number; nameSnapshot: string; priceSnapshot: number;
  stockSnapshot: number; imageSnapshot: string | null; source: string; sortOrder: number;
};
type Catalog = { id: string; name: string; salePrice: number; stock: number; category: string; thumbnailUrl: string | null };

export function LiveProductManager({
  sessionId, initial, catalog,
}: { sessionId: string; initial: LSP[]; catalog: Catalog[] }) {
  const [items, setItems] = useState<LSP[]>(initial);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"board" | "catalog" | "adhoc">("board");
  const dragId = useRef<string | null>(null);

  // 실시간 폴링 (상품번호 변경 즉시 반영)
  const poll = useCallback(async () => {
    const r = await fetch(`/api/live-sessions/${sessionId}/poll`).then((r) => r.json()).catch(() => null);
    if (r?.ok && r.data.numberVersion !== version) {
      setItems(r.data.products);
      setVersion(r.data.numberVersion);
    }
  }, [sessionId, version]);

  useEffect(() => {
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [poll]);

  async function refresh() {
    const r = await fetch(`/api/live-sessions/${sessionId}/poll`).then((r) => r.json());
    if (r.ok) { setItems(r.data.products); setVersion(r.data.numberVersion); }
  }

  async function saveNumber(id: string) {
    const newNumber = parseInt(editValue, 10);
    if (!newNumber || newNumber < 1) { setEditing(null); return; }
    setBusy(true);
    const res = await fetch(`/api/live-sessions/${sessionId}/products/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newNumber }),
    });
    const json = await res.json(); setBusy(false); setEditing(null);
    if (!json.ok) { alert(json.error); return; }
    await refresh();
  }

  async function removeItem(id: string) {
    if (!confirm("이 상품을 방송에서 제거할까요?")) return;
    await fetch(`/api/live-sessions/${sessionId}/products/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function addCatalog(c: Catalog) {
    setBusy(true);
    const res = await fetch(`/api/live-sessions/${sessionId}/products`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facilityProductId: c.id }),
    });
    const json = await res.json(); setBusy(false);
    if (!json.ok) { alert(json.error); return; }
    await refresh(); setTab("board");
  }

  async function autoRenumber() {
    if (!confirm("현재 순서대로 1번부터 자동으로 번호를 다시 매길까요?")) return;
    // 정렬 순서 기준 임시 큰 번호로 회피 후 순차 적용
    const ordered = [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.displayNumber - b.displayNumber);
    setBusy(true);
    for (let i = 0; i < ordered.length; i++) {
      await fetch(`/api/live-sessions/${sessionId}/products/${ordered[i].id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newNumber: 1000 + i }),
      });
    }
    for (let i = 0; i < ordered.length; i++) {
      await fetch(`/api/live-sessions/${sessionId}/products/${ordered[i].id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newNumber: i + 1 }),
      });
    }
    setBusy(false); await refresh();
  }

  async function commitOrder(newItems: LSP[]) {
    setItems(newItems);
    await fetch(`/api/live-sessions/${sessionId}/numbering`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: newItems.map((i) => i.id) }),
    });
  }

  function onDrop(targetId: string) {
    const from = dragId.current;
    if (!from || from === targetId) return;
    const arr = [...items];
    const fromIdx = arr.findIndex((i) => i.id === from);
    const toIdx = arr.findIndex((i) => i.id === targetId);
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    commitOrder(arr);
    dragId.current = null;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setTab("board")} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === "board" ? "bg-navy text-white" : "bg-white border"}`}>판매 보드 ({items.length})</button>
        <button onClick={() => setTab("catalog")} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === "catalog" ? "bg-navy text-white" : "bg-white border"}`}>상품 추가</button>
        <button onClick={() => setTab("adhoc")} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === "adhoc" ? "bg-navy text-white" : "bg-white border"}`}>임시상품</button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={autoRenumber} disabled={busy || items.length === 0}><Hash className="h-4 w-4" />자동번호</Button>
          <Button variant="ghost" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {tab === "board" && (
        items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            판매할 상품이 없습니다. "상품 추가"에서 시설 상품을 선택하세요.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} draggable onDragStart={() => (dragId.current = it.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(it.id)}
                className="flex items-center gap-3 rounded-xl border border-border bg-white p-3">
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab shrink-0" />
                {/* 큰 상품번호 */}
                {editing === it.id ? (
                  <div className="flex items-center gap-1">
                    <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveNumber(it.id)}
                      className="h-14 w-14 rounded-lg border-2 border-brand-500 text-center text-2xl font-extrabold" inputMode="numeric" />
                    <button onClick={() => saveNumber(it.id)} className="tap p-1 text-emerald-600"><Check className="h-5 w-5" /></button>
                    <button onClick={() => setEditing(null)} className="tap p-1 text-red-500"><X className="h-5 w-5" /></button>
                  </div>
                ) : (
                  <button onClick={() => { setEditing(it.id); setEditValue(String(it.displayNumber)); }}
                    className="tap flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-2xl font-extrabold text-white">
                    {it.displayNumber}
                  </button>
                )}
                {it.imageSnapshot && /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={it.imageSnapshot} alt="" className="h-12 w-12 rounded-lg object-cover bg-muted shrink-0 hidden sm:block" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-navy truncate">{it.nameSnapshot}</p>
                    {it.source !== "CATALOG" && <Badge tone="yellow">임시</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{formatKRW(it.priceSnapshot)} · 재고 {it.stockSnapshot}</p>
                </div>
                <button onClick={() => { setEditing(it.id); setEditValue(String(it.displayNumber)); }} className="tap p-2 text-muted-foreground hover:text-navy"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => removeItem(it.id)} className="tap p-2 text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "catalog" && (
        <div className="space-y-2">
          {catalog.length === 0 && <p className="text-sm text-muted-foreground">시설에 등록된 상품이 없습니다.</p>}
          {catalog.map((c) => {
            const added = items.some((i) => i.nameSnapshot === c.name);
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumbnailUrl ?? ""} alt="" className="h-12 w-12 rounded-lg object-cover bg-muted shrink-0" />
                <div className="flex-1 min-w-0"><p className="font-semibold text-navy truncate">{c.name}</p><p className="text-sm text-muted-foreground">{formatKRW(c.salePrice)} · 재고 {c.stock}</p></div>
                <Button size="sm" disabled={busy || added} onClick={() => addCatalog(c)}>{added ? "추가됨" : <><Plus className="h-4 w-4" />추가</>}</Button>
              </div>
            );
          })}
        </div>
      )}

      {tab === "adhoc" && <AdHocForm sessionId={sessionId} onAdded={() => { refresh(); setTab("board"); }} />}
    </div>
  );
}

function AdHocForm({ sessionId, onAdded }: { sessionId: string; onAdded: () => void }) {
  const [name, setName] = useState(""); const [price, setPrice] = useState(""); const [stock, setStock] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function add() {
    if (!name || !price) { setErr("상품명과 가격을 입력하세요."); return; }
    setBusy(true); setErr("");
    const res = await fetch(`/api/live-sessions/${sessionId}/products`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price: Number(price), stock: Number(stock || 0) }),
    });
    const json = await res.json(); setBusy(false);
    if (!json.ok) { setErr(json.error); return; }
    setName(""); setPrice(""); setStock(""); onAdded();
  }
  return (
    <div className="rounded-xl border border-border bg-white p-4 max-w-lg">
      <p className="flex items-center gap-2 font-semibold text-navy mb-3"><PackagePlus className="h-5 w-5 text-brand-500" />방송 중 임시상품 추가</p>
      <p className="text-xs text-muted-foreground mb-3">등록되지 않은 상품도 즉시 추가됩니다. 방송 후 정식 상품으로 전환할 수 있습니다.</p>
      <div className="space-y-3">
        <div><Label>상품명</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>가격(원)</Label><Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" /></div>
          <div><Label>재고</Label><Input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" /></div>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <Button onClick={add} disabled={busy} className="w-full">{busy ? "추가 중..." : "임시상품 추가"}</Button>
      </div>
    </div>
  );
}
