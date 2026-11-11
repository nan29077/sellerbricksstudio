"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { BrandRequestKind } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { BRAND_REQUEST_KIND } from "@/lib/brands";
import { formatKRW } from "@/lib/utils";
import { submitBrandCommand } from "./brand-command";

export function BrandOrderButton({ productId, name, kind, unitPrice, stock, maxQuantity = 20, facilityProductId, defaults, limitNote }: {
  productId: string; name: string; kind: BrandRequestKind; unitPrice: number; stock: number;
  maxQuantity?: number; facilityProductId?: string; limitNote?: string;
  defaults?: { recipient?: string; phone?: string; address?: string };
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const requestKey = useRef<string>();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState("CARD");
  const sample = kind === "SAMPLE";
  const free = sample && unitPrice === 0;
  const label = free ? "무료 샘플 신청" : BRAND_REQUEST_KIND[kind];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      const request = await submitBrandCommand({
        ...fields, action: "request", productId, kind, requestKey: requestKey.current, expectedUnitPrice: unitPrice, quantity,
        ...(facilityProductId && { facilityProductId }), ...(sample && !free && { method }),
      });
      requestKey.current = undefined;
      dialog.current?.close();
      router.push(`/brand-requests?request=${request.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "신청을 접수하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant={sample ? "outline" : "default"} disabled={stock < 1}
        onClick={() => {
          requestKey.current ??= Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
          setError("");
          dialog.current?.showModal();
        }}>
        {stock < 1 ? `${sample ? "샘플" : "공급"} 품절` : label}
      </Button>
      <dialog ref={dialog} aria-label={`${name} ${label}`}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[460px] overflow-auto rounded-3xl bg-white p-5 text-navy shadow-2xl backdrop:bg-navy/55 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 className="text-xl font-black">{label}</h2><p className="mt-1 text-sm text-slate-600">{name}</p></div>
          <Button type="button" variant="ghost" size="icon" aria-label="닫기" onClick={() => dialog.current?.close()} disabled={busy}><X className="h-5 w-5" /></Button>
        </div>
        <form className="space-y-3" onSubmit={submit}>
          <Label className="block">수량
            <Input type="number" min={1} max={Math.min(stock, sample ? maxQuantity : 10000)} required value={quantity || ""}
              onChange={(event) => setQuantity(Number(event.target.value))} />
          </Label>
          <Label className="block">받는 분<Input name="recipient" required minLength={2} maxLength={60} autoComplete="shipping name" defaultValue={defaults?.recipient} /></Label>
          <Label className="block">연락처<Input name="phone" type="tel" required minLength={8} maxLength={30} autoComplete="shipping tel" defaultValue={defaults?.phone} /></Label>
          <Label className="block">배송 주소<Input name="address" required minLength={5} maxLength={300} autoComplete="shipping street-address" defaultValue={defaults?.address} /></Label>
          <Label className="block">요청 사항<Textarea name="message" maxLength={1000} rows={2} /></Label>
          <div className="rounded-xl bg-brand-50 p-3 text-sm">
            <p className="font-bold">{sample ? "샘플 금액" : "예상 공급 금액"} <span className="float-right">{free ? "무료" : formatKRW(unitPrice * quantity)}</span></p>
            <p className="mt-1 text-xs text-slate-600">
              {free ? "접수 후 브랜드사의 확인을 기다려 주세요." : sample ? "셀러브릭스에서 바로 결제됩니다. 브랜드사가 반려하거나 발송 전에 취소하면 자동 환불됩니다." : "위탁 입고라 지금 결제하지 않습니다. 판매된 수량만큼 플랫폼이 브랜드사에 정산합니다."}
            </p>
            {limitNote && <p className="mt-1 text-xs font-semibold text-brand-800">{limitNote}</p>}
          </div>
          {sample && !free && (
            <Label className="block">결제수단
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="CARD">신용카드</option><option value="EASY_PAY">간편결제</option><option value="BANK_TRANSFER">간편 계좌이체</option>
              </Select>
            </Label>
          )}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <Button className="w-full" disabled={busy}>{busy ? "접수 중…" : sample && !free ? `${formatKRW(unitPrice * quantity)} 결제하고 신청` : label}</Button>
        </form>
      </dialog>
    </>
  );
}
