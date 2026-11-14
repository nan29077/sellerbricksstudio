"use client";
import { appAlert, appConfirm } from "@/components/ui/app-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, CheckCircle2, Ban, NotebookPen, Phone, Mail, Users, Package, Repeat, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { BrandItemList, type BrandItemView } from "./brand-item-list";

export type ManageBookingProduct = { id: string; name: string; quantity: number; price: number; status: string; note: string | null };
export type ManageBooking = {
  id: string; status: string; statusLabel: string; tone: "yellow" | "green" | "red" | "gray" | "blue";
  facilityName: string; sellerName: string; sellerEmail: string; sellerPhone: string | null; sellerCompany: string | null;
  when: string; hours: number; headcount: number | null; purpose: string | null; expectedProducts: string | null;
  requestNote: string | null; facilityMemo: string | null; rejectReason: string | null; cancelReason: string | null;
  started: boolean; createdAt: string; sellerHistory?: number;
  code?: string | null; recurring?: boolean; rescheduleCount?: number; products?: ManageBookingProduct[];
  brandItems?: BrandItemView[];
  checkedIn?: boolean; canCheckIn?: boolean; canNoShow?: boolean; noShowCount?: number; cancelCount?: number;
};

type Act = { kind: "REJECTED" | "CANCELLED" | "memo"; ids: string[] } | null;
const BP: Record<string, { label: string; cls: string }> = {
  REQUESTED: { label: "확인 전", cls: "border-slate-200 bg-white text-slate-600" },
  CONFIRMED: { label: "준비 가능", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  UNAVAILABLE: { label: "준비 불가", cls: "border-red-200 bg-red-50 text-red-600" },
};

// 공간 관리자 · 최고관리자 공용 예약 처리 목록 (체크박스 일괄 처리 · 판매 예정 상품 확인 포함)
export function ManageBookingList({ rows, showFacility = true }: { rows: ManageBooking[]; showFacility?: boolean }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [act, setAct] = useState<Act>(null);
  const [text, setText] = useState("");
  const [prodFor, setProdFor] = useState<ManageBooking | null>(null);
  const [prodState, setProdState] = useState<Record<string, { status: string; note: string }>>({});
  const pendingIds = rows.filter((r) => r.status === "PENDING").map((r) => r.id);
  const selected = rows.filter((r) => sel.has(r.id));

  async function run(ids: string[], status: string, reason?: string) {
    setBusy(true);
    try {
      if (ids.length === 1) await api(`/api/bookings/${ids[0]}`, "PATCH", { status, reason });
      else {
        const r = await api<{ success: number; failed: { id: string; error: string }[] }>("/api/bookings/bulk", "POST", { ids, status, reason });
        void appAlert(`${r.success}건 처리 완료${r.failed.length ? `\n실패 ${r.failed.length}건: ${r.failed[0].error}` : ""}`);
      }
      setSel(new Set()); setAct(null); setText(""); router.refresh();
    } catch (e) { void appAlert((e as Error).message); } finally { setBusy(false); }
  }
  async function saveMemo(id: string) {
    setBusy(true);
    try { await api(`/api/bookings/${id}`, "PATCH", { facilityMemo: text }); setAct(null); router.refresh(); }
    catch (e) { void appAlert((e as Error).message); } finally { setBusy(false); }
  }
  function openProducts(b: ManageBooking) {
    setProdFor(b);
    setProdState(Object.fromEntries((b.products ?? []).map((p) => [p.id, { status: p.status, note: p.note ?? "" }])));
  }
  async function saveProducts() {
    if (!prodFor) return;
    setBusy(true);
    try {
      await api(`/api/bookings/${prodFor.id}`, "PATCH", { products: Object.entries(prodState).map(([id, v]) => ({ id, status: v.status, note: v.note })) });
      setProdFor(null); router.refresh();
    } catch (e) { void appAlert((e as Error).message); } finally { setBusy(false); }
  }
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-3">
      {pendingIds.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-[#E9E5DC] bg-white/95 p-3 shadow-sm backdrop-blur md:top-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-navy">
            <input type="checkbox" className="h-4 w-4 accent-brand-500"
              checked={pendingIds.length > 0 && pendingIds.every((id) => sel.has(id))}
              onChange={(e) => setSel(e.target.checked ? new Set(pendingIds) : new Set())} />
            대기 건 전체 선택
          </label>
          <span className="text-xs text-muted-foreground">{sel.size}건 선택</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="success" disabled={!sel.size || busy} onClick={async () => (await appConfirm(`${sel.size}건을 승인할까요?`)) && run([...sel], "APPROVED")}><Check className="h-4 w-4" />일괄 승인</Button>
            <Button size="sm" variant="outline" disabled={!sel.size || busy} onClick={() => setAct({ kind: "REJECTED", ids: [...sel] })}><X className="h-4 w-4" />일괄 거절</Button>
          </div>
        </div>
      )}

      {rows.map((b) => {
        const prods = b.products ?? [];
        const unavailable = prods.filter((p) => p.status === "UNAVAILABLE").length;
        return (
          <Card key={b.id} className={sel.has(b.id) ? "ring-2 ring-brand-400" : ""}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex gap-3">
                {b.status === "PENDING" && <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-brand-500" checked={sel.has(b.id)} onChange={() => toggle(b.id)} aria-label="선택" />}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={b.tone}>{b.statusLabel}</Badge>
                    {b.recurring && <Badge tone="gray"><Repeat className="mr-1 h-3 w-3" />정기</Badge>}
                    {!!b.rescheduleCount && <Badge tone="gray"><CalendarClock className="mr-1 h-3 w-3" />일정 변경 {b.rescheduleCount}회</Badge>}
                    {b.code && <span className="font-mono text-xs font-bold text-slate-500">{b.code}</span>}
                    {showFacility && <span className="text-xs font-semibold text-slate-500">{b.facilityName}</span>}
                    <span className="ml-auto text-[11px] text-muted-foreground">신청 {b.createdAt}</span>
                  </div>
                  <p className="text-base font-bold text-navy">{b.sellerName}{b.sellerCompany && <span className="ml-1 text-xs font-medium text-slate-500">· {b.sellerCompany}</span>}
                    {b.sellerHistory ? <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">이용 {b.sellerHistory}회</span> : <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">첫 이용</span>}
                    {!!b.noShowCount && <span className="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">노쇼 {b.noShowCount}회</span>}
                    {!!b.cancelCount && b.cancelCount >= 3 && <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">취소 {b.cancelCount}회</span>}
                    {b.checkedIn && <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">체크인 완료</span>}
                  </p>
                  <p className="text-sm text-slate-700">{b.when} <span className="text-muted-foreground">· {b.hours}시간</span></p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{b.sellerEmail}</span>
                    {b.sellerPhone && <a href={`tel:${b.sellerPhone}`} className="hit flex items-center gap-1 hover:underline"><Phone className="h-3 w-3" />{b.sellerPhone}</a>}
                    {b.headcount && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{b.headcount}명</span>}
                    {b.purpose && <span>목적: {b.purpose}</span>}
                  </div>
                  {prods.length > 0 ? (
                    <div className="rounded-xl border border-border bg-muted/30 p-2.5">
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-navy"><Package className="h-3.5 w-3.5 text-brand-500" />판매 예정 상품 {prods.length}종 · 총 {prods.reduce((a, p) => a + p.quantity, 0).toLocaleString()}개
                        {unavailable > 0 && <span className="text-red-600">· 준비 불가 {unavailable}</span>}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {prods.map((p) => <span key={p.id} className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", BP[p.status]?.cls)}>{p.name} ×{p.quantity}</span>)}
                      </div>
                    </div>
                  ) : b.expectedProducts ? <p className="truncate text-xs text-slate-500">판매 예정 상품: {b.expectedProducts}</p> : null}
                  {!!b.brandItems?.length && <BrandItemList items={b.brandItems} canConfirm={b.status === "APPROVED"} />}
                  {b.requestNote && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">요청사항: {b.requestNote}</p>}
                  {b.facilityMemo && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">📝 내부 메모: {b.facilityMemo}</p>}
                  {b.rejectReason && b.status === "REJECTED" && <p className="text-xs text-red-600">거절 사유: {b.rejectReason}</p>}
                  {b.cancelReason && b.status === "CANCELLED" && <p className="text-xs text-slate-500">취소 사유: {b.cancelReason}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {b.status === "PENDING" && <>
                      <Button size="sm" variant="success" disabled={busy} onClick={async () => (await appConfirm("이 예약을 승인할까요? 판매 예정 상품은 '준비 가능'으로 확정됩니다.")) && run([b.id], "APPROVED")}><Check className="h-4 w-4" />승인</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setAct({ kind: "REJECTED", ids: [b.id] })}><X className="h-4 w-4" />거절</Button>
                    </>}
                    {prods.length > 0 && ["PENDING", "APPROVED"].includes(b.status) && <Button size="sm" variant="outline" onClick={() => openProducts(b)}><Package className="h-4 w-4" />상품 준비 확인</Button>}
                    {b.canCheckIn && <Button size="sm" variant="success" disabled={busy} onClick={async () => { setBusy(true); try { await api(`/api/bookings/${b.id}`, "PATCH", { action: "checkin" }); router.refresh(); } catch (e) { void appAlert((e as Error).message); } finally { setBusy(false); } }}><CheckCircle2 className="h-4 w-4" />체크인</Button>}
                    {b.status === "APPROVED" && b.started && <Button size="sm" disabled={busy} onClick={async () => (await appConfirm("이용 완료로 처리할까요?")) && run([b.id], "COMPLETED")}><CheckCircle2 className="h-4 w-4" />이용 완료</Button>}
                    {b.canNoShow && <Button size="sm" variant="outline" className="text-red-600" disabled={busy} onClick={async () => (await appConfirm("체크인 없이 나타나지 않았나요? 노쇼로 처리하면 셀러의 노쇼 기록에 남습니다.")) && run([b.id], "NO_SHOW")}><Ban className="h-4 w-4" />노쇼</Button>}
                    {b.status === "NO_SHOW" && <Button size="sm" variant="ghost" disabled={busy} onClick={async () => (await appConfirm("노쇼 처리를 취소하고 이용 완료로 바꿀까요?")) && run([b.id], "COMPLETED")}>노쇼 취소 (이용 완료)</Button>}
                    {b.status === "APPROVED" && !b.started && <Button size="sm" variant="outline" className="text-red-600" disabled={busy} onClick={() => setAct({ kind: "CANCELLED", ids: [b.id] })}><Ban className="h-4 w-4" />예약 취소</Button>}
                    <Button size="sm" variant="ghost" onClick={() => { setText(b.facilityMemo ?? ""); setAct({ kind: "memo", ids: [b.id] }); }}><NotebookPen className="h-4 w-4" />메모</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!act} onClose={() => setAct(null)}
        title={act?.kind === "memo" ? "내부 메모 (셀러 비공개)" : act?.kind === "REJECTED" ? `예약 거절 (${act.ids.length}건)` : "예약 취소"}
        footer={<>
          <Button size="sm" variant="outline" onClick={() => setAct(null)}>닫기</Button>
          <Button size="sm" variant={act?.kind === "memo" ? "default" : "destructive"} disabled={busy || (act?.kind !== "memo" && !text.trim())}
            onClick={() => act && (act.kind === "memo" ? saveMemo(act.ids[0]) : run(act.ids, act.kind, text))}>{busy ? "처리중..." : act?.kind === "memo" ? "저장" : "확인"}</Button>
        </>}>
        {act?.kind !== "memo" && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(act?.kind === "REJECTED"
              ? ["해당 시간대 내부 일정으로 이용이 어렵습니다.", "요청하신 상품 준비가 어렵습니다.", "요청하신 장비 지원이 어렵습니다.", "수용 인원을 초과합니다."]
              : ["시설 점검으로 이용이 어렵습니다.", "불가피한 내부 사정으로 취소합니다."]).map((t) => (
              <button key={t} type="button" onClick={() => setText(t)} className="rounded-full border border-border px-2.5 py-1 text-xs text-slate-600 hover:border-brand-300">{t}</button>
            ))}
          </div>
        )}
        <Label>{act?.kind === "memo" ? "메모" : "사유 (셀러에게 알림으로 전달됩니다)"}</Label>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={act?.kind === "memo" ? 2000 : 300} />
        {selected.length > 0 && act?.kind === "REJECTED" && act.ids.length > 1 && <p className="mt-2 text-xs text-muted-foreground">대상: {selected.map((s) => s.sellerName).join(", ")}</p>}
      </Dialog>

      <Dialog open={!!prodFor} onClose={() => setProdFor(null)} title="판매 예정 상품 준비 확인"
        footer={<><Button size="sm" variant="outline" onClick={() => setProdFor(null)}>닫기</Button><Button size="sm" disabled={busy} onClick={saveProducts}>{busy ? "저장중..." : "저장하고 셀러에게 알리기"}</Button></>}>
        <p className="mb-3 text-xs text-slate-500">{prodFor?.sellerName} · {prodFor?.when}<br />준비가 어려운 상품은 &lsquo;준비 불가&rsquo;로 표시하면 셀러에게 알림이 가고, 라이브 판매 상품에서 자동으로 빠집니다.</p>
        <div className="space-y-2.5">
          {(prodFor?.products ?? []).map((p) => (
            <div key={p.id} className="rounded-xl border border-border p-3">
              <p className="text-sm font-bold text-navy">{p.name} <span className="font-medium text-slate-500">×{p.quantity} · {p.price.toLocaleString()}원</span></p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(BP).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setProdState((s) => ({ ...s, [p.id]: { ...s[p.id], status: k } }))}
                    className={cn("rounded-full border px-3 py-1 text-xs font-semibold", prodState[p.id]?.status === k ? v.cls + " ring-2 ring-offset-1 ring-navy/30" : "border-border bg-white text-slate-500")}>{v.label}</button>
                ))}
              </div>
              <Input className="mt-2 h-9" value={prodState[p.id]?.note ?? ""} maxLength={200} placeholder="메모 (예: 재고 30개만 가능)"
                onChange={(e) => setProdState((s) => ({ ...s, [p.id]: { ...s[p.id], note: e.target.value } }))} />
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
