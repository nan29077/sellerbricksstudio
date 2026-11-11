"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandRequestKind, BrandRequestStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { brandRequestActions } from "@/lib/brands";
import { submitBrandCommand } from "./brand-command";

const actionLabels = {
  PENDING: "검토 중",
  AWAITING_PAYMENT: "입금 대기",
  APPROVED: "승인",
  SHIPPED: "발송 처리",
  COMPLETED: "완료 처리",
  REJECTED: "반려",
  CANCELLED: "취소",
  REFUNDED: "환불 완료 처리",
};

export function BrandRequestControls({ request, manager }: {
  request: { id: string; status: BrandRequestStatus; kind: BrandRequestKind; unitPrice: number; paymentStatus?: string }; manager: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const actions = brandRequestActions(request, manager);
  if (!actions.length) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      await submitBrandCommand({
        action: "transition", requestId: request.id, status: selected,
        ...(fields.trackingNumber && { trackingNumber: fields.trackingNumber }), ...(fields.carrier && { carrier: fields.carrier }),
        ...(fields.reason && { reason: fields.reason }),
      });
      setSelected("");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "상태를 변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3" onSubmit={submit}>
      <Label className="block flex-1">진행 처리
        <Select required value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">처리할 작업 선택</option>
          {actions.map((status) => (
            <option key={status} value={status}>{request.status === "AWAITING_PAYMENT" && status === "APPROVED" ? "입금 확인"
              : request.kind === "SUPPLY" && status === "COMPLETED" ? "입고 확인 (창고 재고 반영)"
              : request.paymentStatus === "PAID" && (status === "REJECTED" || status === "CANCELLED") ? `${actionLabels[status]} (자동 환불)` : actionLabels[status]}</option>
          ))}
        </Select>
      </Label>
      {selected === "SHIPPED" && <>
        <Label className="block flex-1">택배사<Input name="carrier" maxLength={30} placeholder="CJ대한통운" /></Label>
        <Label className="block flex-1">운송장 번호<Input name="trackingNumber" maxLength={100} required /></Label>
      </>}
      {(selected === "REJECTED" || (manager && selected === "CANCELLED")) && <Label className="block basis-full">사유{selected === "REJECTED" ? " (필수)" : ""}<Input name="reason" maxLength={300} required={selected === "REJECTED"} /></Label>}
      <Button variant="outline" disabled={!selected || busy}>적용</Button>
      {selected === "REFUNDED" && <p className="basis-full text-xs text-slate-600">구매자에게 직접 환불한 뒤 처리해 주세요.</p>}
      {selected === "APPROVED" && request.status === "AWAITING_PAYMENT" && <p className="basis-full text-xs text-slate-600">계좌의 실제 입금 내역을 확인한 뒤 처리해 주세요.</p>}
      {error && <p role="alert" className="basis-full text-sm text-red-700">{error}</p>}
    </form>
  );
}
