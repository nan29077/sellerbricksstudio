"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { AddressSearchButton } from "@/components/address-search";
import { appConfirm } from "@/components/ui/app-dialog";
import { LIVE_PLATFORMS, livePlatformLabel } from "@/lib/live-platforms";
import { cn, formatKRW } from "@/lib/utils";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Minus, PenLine, Plus, Search, Trash2, Upload, XCircle } from "lucide-react";

type CatalogItem = {
  code: string; kind: "BRAND" | "STOCK"; name: string; brandName: string | null; facilityName: string | null; facilityId: string | null;
  unitCost: number; stock: number; options: { name: string; values: string[] }[]; shipper: string; imageUrl: string | null; shippingNote: string;
  variants?: { key: string; extra: number; saleExtra: number; soldOut: boolean }[];
};
// 옵션 조합별 추가 공급가 · 품절 (브랜드가 상품 등록 때 정함)
const variantFor = (c: CatalogItem, opts: Record<string, string>) => { const key = c.options.map((o) => opts[o.name]).join(" / "); return c.variants?.find((v) => v.key === key) ?? null; };
const unitOf = (c: CatalogItem | undefined, opts: Record<string, string>) => (c ? Math.max(0, c.unitCost + (variantFor(c, opts)?.extra ?? 0)) : 0);
type Line = { code: string; quantity: number; opts: Record<string, string> };
type Result = { ref?: string; ok: boolean; error?: string; orders?: { id: string; orderNo: string; total: number; shipper: string }[] };
type PreviewSheet = {
  platform: string; platformEtc?: string | null; externalOrderNo?: string | null; recipient: string; phone: string; address: string; memo?: string | null;
  lines: { code: string; optionLabel?: string | null; quantity: number }[]; ref?: string; error: string | null; itemsTotal: number;
};

const PHONE = /^[+\d ()-]{8,30}$/;

export function OrderSheetForm({ catalog, platforms, platformEtc, shippingFee }: { catalog: CatalogItem[]; platforms: string[]; platformEtc: string; shippingFee: number }) {
  const [tab, setTab] = useState<"form" | "file">("form");
  const myPlatforms = platforms.length ? platforms : LIVE_PLATFORMS.map((p) => p.code);
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5" role="tablist" aria-label="주문서 작성 방식">
        {([["form", "직접 작성", PenLine], ["file", "엑셀 업로드", FileSpreadsheet]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", tab === k ? "border-navy bg-navy text-white" : "border-[#E5E0D6] bg-white text-slate-600")}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      {catalog.length === 0 ? (
        <Card><CardContent className="space-y-3 py-8 text-center">
          <p className="font-bold text-navy">주문서에 담을 상품이 없습니다</p>
          <p className="text-sm text-slate-600">브랜드샵에서 판매할 상품을 고르면(위탁배송으로 가져오기) 주문서에 담을 수 있습니다.</p>
          <Link href="/brands" className={buttonVariants({ variant: "secondary" })}>브랜드샵 둘러보기</Link>
        </CardContent></Card>
      ) : tab === "form" ? (
        <DirectForm catalog={catalog} platforms={myPlatforms} defaultEtc={platformEtc} shippingFee={shippingFee} />
      ) : (
        <FileUpload platforms={myPlatforms} defaultEtc={platformEtc} shippingFee={shippingFee} catalog={catalog} />
      )}
    </div>
  );
}

function PlatformField({ platforms, value, onChange, etc, onEtc, id }: { platforms: string[]; value: string; onChange: (v: string) => void; etc: string; onEtc: (v: string) => void; id: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor={id}>판매한 플랫폼</Label>
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {platforms.map((c) => <option key={c} value={c}>{livePlatformLabel(c)}</option>)}
          {!platforms.includes("ETC") && <option value="ETC">기타 플랫폼</option>}
        </Select>
      </div>
      {value === "ETC" && (
        <div><Label htmlFor={`${id}-etc`}>기타 플랫폼 이름</Label><Input id={`${id}-etc`} value={etc} onChange={(e) => onEtc(e.target.value)} maxLength={60} /></div>
      )}
    </div>
  );
}

function ResultList({ results, onReset }: { results: Result[]; onReset: () => void }) {
  const okCount = results.filter((r) => r.ok).length;
  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <p className="text-lg font-bold text-navy">주문서 {results.length}장 중 {okCount}장 접수{results.length - okCount ? ` · ${results.length - okCount}장 실패` : ""}</p>
        <ul className="divide-y divide-[#F0ECE6] text-sm">
          {results.map((r, i) => (
            <li key={i} className="flex items-start gap-2 py-2">
              {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
              <div className="min-w-0">
                <p className="font-semibold text-navy">{r.ref ?? `주문서 ${i + 1}`}</p>
                {r.ok ? r.orders?.map((o) => <p key={o.id} className="text-xs text-slate-600">{o.orderNo} · {o.shipper} · 결제 {formatKRW(o.total)}</p>)
                  : <p className="text-xs text-red-600">{r.error}</p>}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Link href="/seller/orders" className={buttonVariants({ variant: "secondary" })}>주문서 · 배송 현황 보기</Link>
          <Button type="button" variant="outline" onClick={onReset}>새 주문서 작성</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 직접 작성
// ---------------------------------------------------------------------------
function DirectForm({ catalog, platforms, defaultEtc, shippingFee }: { catalog: CatalogItem[]; platforms: string[]; defaultEtc: string; shippingFee: number }) {
  const router = useRouter();
  const map = useMemo(() => new Map(catalog.map((c) => [c.code, c])), [catalog]);
  const [platform, setPlatform] = useState(platforms[0] ?? "ETC");
  const [etc, setEtc] = useState(defaultEtc);
  const [ext, setExt] = useState("");
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);

  const found = catalog.filter((c) => !q.trim() || `${c.name} ${c.brandName ?? ""} ${c.code}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30);
  const add = (c: CatalogItem) => setLines((ls) => [...ls, { code: c.code, quantity: 1, opts: Object.fromEntries(c.options.map((o) => [o.name, o.values[0] ?? ""])) }]);
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const subtotal = lines.reduce((s, l) => s + unitOf(map.get(l.code), l.opts) * l.quantity, 0);
  const stockFacilities = new Set(lines.map((l) => map.get(l.code)).filter((c) => c?.kind === "STOCK").map((c) => c!.facilityId));
  const shipping = stockFacilities.size * shippingFee;

  function reset() { setLines([]); setRecipient(""); setPhone(""); setAddress(""); setMemo(""); setExt(""); setResults(null); setError(""); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!lines.length) return setError("상품을 1개 이상 담으세요.");
    if (recipient.trim().length < 2) return setError("받는 분 이름을 입력하세요.");
    if (!PHONE.test(phone.trim()) || phone.replace(/\D/g, "").length < 8) return setError("받는 분 연락처를 확인하세요.");
    if (address.trim().length < 5) return setError("배송지 주소를 입력하세요.");
    if (platform === "ETC" && !etc.trim()) return setError("기타 플랫폼 이름을 입력하세요.");
    for (const l of lines) { const c = map.get(l.code)!; if (l.quantity > c.stock) return setError(`${c.name}: 재고(${c.stock}개)보다 많이 담았습니다.`); }
    if (!(await appConfirm(`공급가 ${formatKRW(subtotal)}${shipping ? ` + 출고 배송비 ${formatKRW(shipping)}` : ""} = ${formatKRW(subtotal + shipping)}을 결제하고 발주할까요?`))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/seller/order-sheets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheets: [{
          platform, platformEtc: platform === "ETC" ? etc : null, externalOrderNo: ext || null, recipient, phone, address, memo: memo || null, ref: "주문서",
          lines: lines.map((l) => { const c = map.get(l.code)!; return { code: l.code, quantity: l.quantity, optionLabel: c.options.length ? c.options.map((o) => `${o.name}:${l.opts[o.name]}`).join(" / ") : null }; }),
        }] }),
      });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) setError(j.error ?? "주문서를 접수하지 못했습니다.");
      else { setResults(j.data.results); router.refresh(); }
    } finally { setBusy(false); }
  }

  if (results) return <ResultList results={results} onReset={reset} />;
  return (
    <form onSubmit={submit} className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">1. 판매 정보 · 받는 분</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <PlatformField platforms={platforms} value={platform} onChange={setPlatform} etc={etc} onEtc={setEtc} id="os-platform" />
            <div><Label htmlFor="os-ext">외부 주문번호 (선택)</Label><Input id="os-ext" value={ext} onChange={(e) => setExt(e.target.value)} maxLength={60} placeholder="플랫폼에서 받은 주문번호" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="os-name">받는 분</Label><Input id="os-name" value={recipient} onChange={(e) => setRecipient(e.target.value)} maxLength={40} autoComplete="off" /></div>
              <div><Label htmlFor="os-phone">연락처</Label><Input id="os-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} inputMode="tel" placeholder="010-0000-0000" /></div>
            </div>
            <div>
              <div className="mb-1 flex items-end justify-between gap-2"><Label htmlFor="os-addr" className="mb-0">배송지 주소</Label><AddressSearchButton onSelect={(a) => setAddress(a)} /></div>
              <Input id="os-addr" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} placeholder="(우편번호) 도로명 주소 상세 주소" />
            </div>
            <div><Label htmlFor="os-memo">배송 메모 (선택)</Label><Textarea id="os-memo" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={300} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">2. 상품 담기</CardTitle>
            <p className="text-xs text-muted-foreground">고른 위탁배송(브랜드 배송) 상품과 스토리지마켓 창고 재고 상품을 담을 수 있습니다. 더 고르려면 <Link href="/brands" className="font-semibold text-brand-800 underline">브랜드샵</Link>에서 가져오세요.</p></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input aria-label="상품 검색" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품명 · 브랜드 · 상품코드" /></div>
            <ul className="max-h-80 divide-y divide-[#F0ECE6] overflow-y-auto rounded-xl border border-[#EDE8DF]">
              {found.map((c) => (
                <li key={c.code} className="flex items-center gap-3 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">{c.name}</p>
                    <p className="truncate text-xs text-slate-500">{c.shipper} · 공급가 {formatKRW(c.unitCost)} · 재고 {c.stock.toLocaleString()}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" disabled={c.stock <= 0} onClick={() => add(c)}><Plus className="h-4 w-4" />담기</Button>
                </li>
              ))}
              {found.length === 0 && <li className="p-4 text-center text-sm text-slate-500">검색 결과가 없습니다.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card className="xl:sticky xl:top-20">
        <CardHeader><CardTitle className="text-base">3. 담은 상품 · 결제</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {lines.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">아직 담은 상품이 없습니다.</p> : (
            <ul className="space-y-2">
              {lines.map((l, i) => {
                const c = map.get(l.code)!;
                return (
                  <li key={i} className="space-y-2 rounded-xl border border-[#EDE8DF] p-2.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-navy">{c.name}</p><p className="text-[11px] text-slate-500">{c.shipper}</p></div>
                      <button type="button" aria-label={`${c.name} 빼기`} className="hit text-slate-400 hover:text-red-500" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></button>
                    </div>
                    {c.options.map((o) => (
                      <Select key={o.name} aria-label={`${c.name} ${o.name}`} value={l.opts[o.name]} onChange={(e) => setLine(i, { opts: { ...l.opts, [o.name]: e.target.value } })}>
                        {o.values.map((v) => <option key={v} value={v}>{o.name}: {v}</option>)}
                      </Select>
                    ))}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button type="button" size="sm" variant="outline" aria-label="수량 줄이기" onClick={() => setLine(i, { quantity: Math.max(1, l.quantity - 1) })}><Minus className="h-4 w-4" /></Button>
                        <Input aria-label={`${c.name} 수량`} className="h-9 w-16 text-center" inputMode="numeric" value={l.quantity} onChange={(e) => setLine(i, { quantity: Math.max(1, Math.min(9999, Number(e.target.value.replace(/\D/g, "")) || 1)) })} />
                        <Button type="button" size="sm" variant="outline" aria-label="수량 늘리기" onClick={() => setLine(i, { quantity: Math.min(9999, l.quantity + 1) })}><Plus className="h-4 w-4" /></Button>
                      </div>
                      <b className="text-sm text-navy">{variantFor(c, l.opts)?.soldOut ? <span className="text-red-600">품절 옵션</span> : formatKRW(unitOf(c, l.opts) * l.quantity)}</b>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="space-y-1 border-t border-[#F0ECE6] pt-3 text-sm">
            <p className="flex justify-between"><span>상품 공급가</span><b>{formatKRW(subtotal)}</b></p>
            <p className="flex justify-between"><span>스토리지마켓 출고 배송비{stockFacilities.size > 1 ? ` (창고 ${stockFacilities.size}곳)` : ""}</span><b>{formatKRW(shipping)}</b></p>
            <p className="flex justify-between text-base"><span className="font-bold text-navy">결제 금액</span><b className="text-brand-800">{formatKRW(subtotal + shipping)}</b></p>
            <p className="text-[11px] text-slate-500">위탁배송(브랜드 배송) 상품의 택배비는 공급가에 포함됩니다. 결제하면 브랜드 · 창고로 바로 발주됩니다. 출고 전에는 주문서 현황에서 취소할 수 있습니다.</p>
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={busy || !lines.length}>{busy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />처리 중...</> : "결제하고 발주하기"}</Button>
        </CardContent>
      </Card>
    </form>
  );
}

// ---------------------------------------------------------------------------
// 엑셀 업로드
// ---------------------------------------------------------------------------
function FileUpload({ platforms, defaultEtc, shippingFee, catalog }: { platforms: string[]; defaultEtc: string; shippingFee: number; catalog: CatalogItem[] }) {
  const router = useRouter();
  const map = useMemo(() => new Map(catalog.map((c) => [c.code, c])), [catalog]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [platform, setPlatform] = useState(platforms[0] ?? "ETC");
  const [etc, setEtc] = useState(defaultEtc);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ sheets: PreviewSheet[]; errors: { row: number; error: string }[]; rowCount: number } | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  async function parse() {
    const f = fileRef.current?.files?.[0];
    setError(""); setPreview(null);
    if (!f) return setError("파일을 선택하세요.");
    if (platform === "ETC" && !etc.trim()) return setError("기타 플랫폼 이름을 입력하세요.");
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f); fd.append("platform", platform); fd.append("platformEtc", etc);
      const res = await fetch("/api/seller/order-sheets/parse", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) setError(j.error ?? "파일을 읽지 못했습니다.");
      else setPreview(j.data);
    } finally { setBusy(false); }
  }

  const valid = preview?.sheets.filter((s) => !s.error) ?? [];
  const shipOf = (s: PreviewSheet) => new Set(s.lines.map((l) => map.get(l.code)).filter((c) => c?.kind === "STOCK").map((c) => c!.facilityId)).size * shippingFee;
  const total = valid.reduce((sum, s) => sum + s.itemsTotal + shipOf(s), 0);

  async function submit() {
    if (!valid.length) return;
    if (!(await appConfirm(`문제없는 주문서 ${valid.length}장, 합계 ${formatKRW(total)}을 결제하고 발주할까요? (오류가 있는 주문서는 빠집니다)`))) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/seller/order-sheets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheets: valid.map(({ error: _e, itemsTotal: _t, ...s }) => { void _e; void _t; return s; }) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) setError(j.error ?? "주문서를 접수하지 못했습니다.");
      else { setResults(j.data.results); router.refresh(); }
    } finally { setBusy(false); }
  }

  if (results) return <ResultList results={results} onReset={() => { setResults(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }} />;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">엑셀로 여러 주문서 한 번에</CardTitle>
          <p className="text-xs text-muted-foreground">양식을 내려받아 플랫폼에서 받은 주문을 붙여 넣고 올리세요. 한 행이 상품 한 줄이고, 같은 외부 주문번호(없으면 받는 분 · 연락처 · 주소가 같은 행)는 주문서 한 장으로 묶입니다. CSV도 됩니다.</p></CardHeader>
        <CardContent className="space-y-3">
          <a href="/api/seller/order-sheets/template" className={buttonVariants({ variant: "outline" })}><Download className="h-4 w-4" />주문서 양식 내려받기 (.xlsx · 내 상품코드 포함)</a>
          <PlatformField platforms={platforms} value={platform} onChange={setPlatform} etc={etc} onEtc={setEtc} id="up-platform" />
          <p className="-mt-1 text-[11px] text-slate-500">엑셀의 &lsquo;판매 플랫폼&rsquo; 칸이 비어 있는 행은 위에서 고른 플랫폼으로 들어갑니다.</p>
          <div><Label htmlFor="up-file">파일 (.xlsx · .csv, 5MB까지)</Label>
            <input id="up-file" ref={fileRef} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="block w-full rounded-lg border border-border bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-white" /></div>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="button" onClick={parse} disabled={busy}>{busy && !preview ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}파일 읽고 확인하기</Button>
        </CardContent>
      </Card>
      {preview && (
        <Card>
          <CardHeader><CardTitle className="text-base">확인 — {preview.rowCount}행 · 주문서 {preview.sheets.length}장</CardTitle>
            <p className="text-xs text-muted-foreground">문제없는 주문서 {valid.length}장 · 결제 합계 {formatKRW(total)}{preview.errors.length + preview.sheets.length - valid.length ? ` · 오류 ${preview.errors.length + preview.sheets.length - valid.length}건 (빠짐)` : ""}</p></CardHeader>
          <CardContent className="space-y-3">
            {preview.errors.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {preview.errors.slice(0, 50).map((e, i) => <li key={i}>{e.row}행: {e.error}</li>)}
                {preview.errors.length > 50 && <li>외 {preview.errors.length - 50}건</li>}
              </ul>
            )}
            <ul className="divide-y divide-[#F0ECE6] rounded-xl border border-[#EDE8DF]">
              {preview.sheets.map((s, i) => (
                <li key={i} className="space-y-1 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.error ? <XCircle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    <b className="text-navy">{s.ref}</b>
                    <span className="text-xs text-slate-500">{livePlatformLabel(s.platform, s.platformEtc)}{s.externalOrderNo ? ` · ${s.externalOrderNo}` : ""}</span>
                    <span className="ml-auto text-sm font-bold text-navy">{formatKRW(s.itemsTotal + shipOf(s))}</span>
                  </div>
                  <p className="text-xs text-slate-600">{s.recipient} · {s.phone} · {s.address}</p>
                  <p className="text-xs text-slate-500">{s.lines.map((l) => `${map.get(l.code)?.name ?? l.code}${l.optionLabel ? `(${l.optionLabel})` : ""} ×${l.quantity}`).join(", ")}</p>
                  {s.error && <p className="text-xs font-semibold text-red-600">{s.error}</p>}
                </li>
              ))}
            </ul>
            <Button type="button" className="w-full" size="lg" disabled={busy || !valid.length} onClick={submit}>{busy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />처리 중...</> : `주문서 ${valid.length}장 결제하고 발주하기`}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
