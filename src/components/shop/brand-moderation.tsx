"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandShopStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { BRAND_SHOP_STATUS } from "@/lib/brands";
import { submitBrandCommand } from "./brand-command";

export function BrandModeration({ id, status, note, feeRate, defaultFeeRate }: { id: string; status: BrandShopStatus; note: string; feeRate?: number | null; defaultFeeRate?: number }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    try {
      const { feeRate: fee, ...rest } = fields;
      await submitBrandCommand({ ...rest, action: "moderate", shopId: id, feeRate: fee === "" || fee === undefined ? null : Number(fee) });
      setMessage("운영 상태를 저장했습니다.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "운영 상태를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-white p-4 sm:p-6">
      <h2 className="text-lg font-extrabold text-navy">샵 공개 승인</h2>
      <Label className="block">공개 상태
        <Select name="status" defaultValue={status}>
          {Object.entries(BRAND_SHOP_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </Label>
      <Label className="block">브랜드 수수료율 (%) — 비우면 플랫폼 기본값{defaultFeeRate !== undefined && ` ${defaultFeeRate}%`}
        <Input type="number" name="feeRate" min={0} max={100} step="any" defaultValue={feeRate ?? ""} />
      </Label>
      <Label className="block">브랜드사에 표시할 사유<Textarea name="moderationNote" defaultValue={note} maxLength={500} rows={2} /></Label>
      {message && <p role="status" className="text-sm">{message}</p>}
      <Button disabled={busy}>운영 상태 저장</Button>
    </form>
  );
}
