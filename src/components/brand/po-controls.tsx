"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FulfillmentMode, PurchaseOrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { PO_STATUS, poActions } from "@/lib/brands";

const ACTION_LABEL: Partial<Record<PurchaseOrderStatus, string>> = {
  CONFIRMED: "발주 확인", SHIPPED: "출고 (운송장 입력)", DELIVERED: "배송 완료", CANCELLED: "발주 취소 (구매자 부분 환불)", RETURNED: "반품·환불 처리 (구매자 부분 환불)",
};
type Extra = "REQUEST_CANCEL" | "WITHDRAW_CANCEL" | "RETURN_RECEIVED" | "EXCHANGE_SHIP";
const EXTRA_LABEL: Record<Extra, string> = {
  REQUEST_CANCEL: "출고 불가 알리기 (품절·단종 등)", WITHDRAW_CANCEL: "출고 불가 요청 철회", RETURN_RECEIVED: "반품 상품 수령 확인", EXCHANGE_SHIP: "교환 상품 재발송 (운송장 입력)",
};

export function PoControls({ po, actor }: {
  po: { id: string; status: PurchaseOrderStatus; fulfillment: FulfillmentMode; carrier: string; trackingNumber: string; brandMemo: string; adminMemo: string; cancelRequested?: boolean; returnReceived?: boolean };
  actor: "BRAND" | "ADMIN";
}) {
  const router = useRouter();
  const actions = poActions(po, actor);
  const open = po.status === "NEW" || po.status === "CONFIRMED";
  const extras: Extra[] = actor === "BRAND" ? [
    ...(po.fulfillment === "DROPSHIP" && open && !po.cancelRequested ? ["REQUEST_CANCEL" as const] : []),
    ...(open && po.cancelRequested ? ["WITHDRAW_CANCEL" as const] : []),
    ...(po.status === "RETURNED" && !po.returnReceived ? ["RETURN_RECEIVED" as const] : []),
    ...((po.status === "SHIPPED" || po.status === "DELIVERED") && po.fulfillment === "DROPSHIP" ? ["EXCHANGE_SHIP" as const] : []),
  ] : [];
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean }>();
  const extra = choice.startsWith("x:") ? (choice.slice(2) as Extra) : null;
  const status = !extra ? choice : "";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true); setMsg(undefined);
    const body: Record<string, string> = {};
    if (status) body.status = status;
    if (extra) body.action = extra;
    for (const k of ["carrier", "trackingNumber", "brandMemo", "adminMemo", "reason"]) if (k in f) body[k] = f[k];
    if (extra === "EXCHANGE_SHIP") { body.carrier = f.exchangeCarrier ?? ""; body.trackingNumber = f.exchangeTracking ?? ""; }
    const res = await fetch(`/api/purchase-orders/${po.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    if (!json.ok) { setMsg({ text: json.error ?? "처리하지 못했습니다.", error: true }); return; }
    setMsg({ text: json.data?.orderStatus ? "처리했습니다. 주문 상태도 함께 바뀌었습니다." : extra === "REQUEST_CANCEL" ? "셀러·창고(스튜디오)와 최고관리자에게 알렸습니다." : "저장했습니다.", error: false });
    setChoice(""); router.refresh();
  }

  const shipping = status === "SHIPPED";
  const needReason = status === "CANCELLED" || status === "RETURNED" || extra === "REQUEST_CANCEL";
  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
      {(actions.length > 0 || extras.length > 0) && (
        <Label className="block">처리
          <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">상태 변경 없음 (메모만 저장)</option>
            {actions.map((a) => <option key={a} value={a}>{ACTION_LABEL[a] ?? PO_STATUS[a].label}</option>)}
            {extras.map((x) => <option key={x} value={`x:${x}`}>{EXTRA_LABEL[x]}</option>)}
          </Select>
        </Label>
      )}
      {(shipping || po.trackingNumber) && po.fulfillment === "DROPSHIP" && <>
        <Label className="block">택배사<Input name="carrier" defaultValue={po.carrier} maxLength={30} placeholder="CJ대한통운" /></Label>
        <Label className="block">운송장 번호<Input name="trackingNumber" defaultValue={po.trackingNumber} maxLength={100} required={shipping} /></Label>
      </>}
      {extra === "EXCHANGE_SHIP" && <>
        <Label className="block">교환 택배사<Input name="exchangeCarrier" maxLength={30} placeholder="CJ대한통운" /></Label>
        <Label className="block">교환 운송장 번호<Input name="exchangeTracking" maxLength={100} required /></Label>
      </>}
      {needReason && <Label className="block sm:col-span-2">사유 (필수)<Input name="reason" maxLength={300} required placeholder={extra === "REQUEST_CANCEL" ? "예: 전 옵션 품절, 단종" : undefined} /></Label>}
      <Label className="block sm:col-span-2">브랜드 메모<Input name="brandMemo" defaultValue={po.brandMemo} maxLength={500} disabled={actor === "ADMIN"} /></Label>
      {actor === "ADMIN" && <Label className="block sm:col-span-2">관리자 메모<Input name="adminMemo" defaultValue={po.adminMemo} maxLength={500} /></Label>}
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button size="sm" disabled={busy}>{busy ? "처리 중…" : "저장"}</Button>
        {msg && <p role={msg.error ? "alert" : "status"} className={msg.error ? "text-sm text-red-700" : "text-sm text-emerald-700"}>{msg.text}</p>}
      </div>
    </form>
  );
}
