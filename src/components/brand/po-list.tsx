import Link from "next/link";
import type { Prisma, PurchaseOrderStatus } from "@prisma/client";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { FULFILLMENT_LABEL, PO_STATUS, maskAddress, maskName, maskPhone, piiExpired } from "@/lib/brands";
import { dateRange, pageOf, sp, withParams, type SP } from "@/lib/list";
import { formatKRW } from "@/lib/utils";
import { getPolicy } from "@/lib/policy";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Pagination } from "@/components/list/pagination";
import { StatusTabs } from "@/components/list/status-tabs";
import { PoControls } from "./po-controls";

const fmt = (d: Date | null) => d ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(d) : "";

export async function PurchaseOrderList({ scope, actor, base, params }: {
  scope: Prisma.PurchaseOrderWhereInput; actor: "BRAND" | "ADMIN"; base: string; params: SP;
}) {
  const { page, size, skip, take } = pageOf(params);
  const status = Object.keys(PO_STATUS).find((v) => v === sp(params, "status")) as PurchaseOrderStatus | undefined;
  const mode = sp(params, "mode");
  const q = sp(params, "q")?.slice(0, 60);
  const poId = sp(params, "po");
  const range = dateRange(params);
  const where: Prisma.PurchaseOrderWhereInput = {
    ...scope,
    ...(status && { status }),
    ...((mode === "DROPSHIP" || mode === "WAREHOUSE") && { fulfillment: mode }),
    ...(range && { createdAt: range }),
    ...(poId && { id: poId }),
    ...(q && { OR: [{ poNo: { contains: q, mode: "insensitive" } }, { recipient: { contains: q } }, { order: { orderNo: { contains: q, mode: "insensitive" } } }, { items: { some: { productName: { contains: q, mode: "insensitive" } } } }] }),
  };
  const [rows, total, counts, policy] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      include: {
        items: true, brandShop: { select: { name: true } }, facility: { select: { name: true } },
        order: { select: { orderNo: true, status: true } }, seller: { select: { profile: { select: { name: true } }, email: true } },
        brandSettlement: { select: { id: true, status: true } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.groupBy({ by: ["status"], where: scope, _count: true }),
    getPolicy(),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const late = (d: Date, s: PurchaseOrderStatus) => s === "NEW" && Date.now() - d.getTime() > policy.poConfirmHours * 3600000;
  const exportHref = `/api/purchase-orders/export?${new URLSearchParams(Object.entries({ status: status ?? "", from: sp(params, "from") ?? "", to: sp(params, "to") ?? "" }).filter(([, v]) => v)).toString()}`;

  return (
    <div className="space-y-4">
      <StatusTabs base={base} params={params} tabs={[
        { value: "", label: "전체", count: counts.reduce((s, c) => s + c._count, 0) },
        ...(Object.keys(PO_STATUS) as PurchaseOrderStatus[]).map((s) => ({ value: s, label: PO_STATUS[s].label, count: countOf(s) })),
      ]} />
      <form action={base} className="flex flex-wrap items-center gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <Input name="q" defaultValue={q} placeholder="발주번호 · 주문번호 · 받는 분 · 상품명" maxLength={60} className="max-w-xs" />
        <Select name="mode" defaultValue={mode ?? ""} className="w-auto" aria-label="배송 방식">
          <option value="">전체 배송방식</option><option value="DROPSHIP">위탁배송(브랜드 배송)</option><option value="WAREHOUSE">스토리지마켓 입고</option>
        </Select>
        <Input type="date" name="from" defaultValue={sp(params, "from")} className="w-auto" aria-label="시작일" />
        <Input type="date" name="to" defaultValue={sp(params, "to")} className="w-auto" aria-label="종료일" />
        <Button variant="outline">조회</Button>
        <a href={exportHref} className={buttonVariants({ variant: "outline" })}><Download className="h-4 w-4" />엑셀(CSV)</a>
        {poId && <Link href={withParams(base, params, { po: undefined })} className="text-sm font-semibold text-brand-800 underline">전체 보기</Link>}
      </form>
      {rows.length === 0 && <p className="rounded-2xl border bg-white p-6 text-sm text-slate-600">해당하는 발주서가 없습니다. 셀러·창고(스튜디오)가 가져간 상품이 방송에서 판매되면 여기에 자동으로 들어옵니다.</p>}
      {rows.map((po) => (
        <article key={po.id} className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${late(po.createdAt, po.status) ? "border-amber-300" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">{po.poNo} · {fmt(po.createdAt)}{actor === "ADMIN" && ` · ${po.brandShop.name}`}</p>
              <h2 className="mt-1 font-black text-navy">{po.items.map((i) => i.productName).join(", ")}</h2>
              <p className="mt-0.5 text-xs text-slate-600">주문 {po.order.orderNo} · {(po.facility?.name ?? "셀러 공간")} · 셀러 {po.seller.profile?.name ?? po.seller.email}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge tone={po.fulfillment === "DROPSHIP" ? "blue" : "gray"}>{FULFILLMENT_LABEL[po.fulfillment]}</Badge>
              <Badge tone={PO_STATUS[po.status].tone}>{PO_STATUS[po.status].label}</Badge>
              {late(po.createdAt, po.status) && <Badge tone="yellow">확인 지연</Badge>}
              {po.brandSettlement && <Badge tone="green">정산서 포함</Badge>}
            </div>
          </div>
          <table className="mt-3 w-full text-sm rtable">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">상품</th><th>옵션</th><th className="text-right">수량</th><th className="text-right">공급가</th><th className="text-right">합계</th></tr></thead>
            <tbody>
              {po.items.map((it) => (
                <tr key={it.id} className="border-t"><td data-label="상품" className="py-1.5">{it.productName}</td><td data-label="옵션" className="text-xs text-slate-600">{it.optionLabel ?? "-"}</td>
                  <td data-label="수량" className="text-right">{it.quantity}</td><td data-label="공급가" className="text-right">{formatKRW(it.supplyPrice)}</td><td data-label="합계" className="text-right font-semibold">{formatKRW(it.supplyPrice * it.quantity)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
            {actor === "BRAND" && piiExpired(po, policy.piiRetentionDays)
              ? <p className="text-slate-600">배송지: <b className="text-navy">{maskName(po.recipient)}</b> · {maskPhone(po.phone)} · {maskAddress(po.address)} <span className="text-xs text-slate-500">(배송 완료 {policy.piiRetentionDays}일이 지나 구매자 정보를 가렸습니다)</span></p>
              : <p className="text-slate-600">{po.fulfillment === "DROPSHIP" ? "배송지" : "출고 창고"}: <b className="text-navy">{po.recipient}</b> · {po.phone} · {po.address || "주소 없음"}</p>}
            <p className="font-black text-navy">공급가 합계 {formatKRW(po.supplyAmount)}{actor === "ADMIN" && <span className="ml-2 text-xs font-medium text-slate-500">판매 {formatKRW(po.saleAmount)}</span>}</p>
          </div>
          {po.trackingNumber && <p className="mt-1 text-sm">운송장 {po.carrier} {po.trackingNumber}{po.shippedAt && ` · ${fmt(po.shippedAt)} 출고`}</p>}
          {po.cancelReason && <p className="mt-1 text-sm text-red-700">사유: {po.cancelReason}</p>}
          {po.cancelRequestedAt && (po.status === "NEW" || po.status === "CONFIRMED") && <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-sm text-red-700">출고 불가 요청 중 · {po.cancelRequestReason} — 셀러·창고(스튜디오)가 부분 취소하면 발주가 취소됩니다.</p>}
          {po.status === "RETURNED" && <p className="mt-1 text-sm text-slate-700">반품 상품 {po.returnReceivedAt ? `수령 확인 (${fmt(po.returnReceivedAt)})` : "수령 대기 — 받으면 '반품 수령 확인'을 눌러 주세요"}</p>}
          {po.exchangeTrackingNumber && <p className="mt-1 text-sm text-slate-700">교환 발송 {po.exchangeCarrier} {po.exchangeTrackingNumber}{po.exchangeShippedAt && ` · ${fmt(po.exchangeShippedAt)}`}</p>}
          {po.adminMemo && actor === "ADMIN" && <p className="mt-1 text-xs text-amber-700">관리자 메모: {po.adminMemo}</p>}
          {po.fulfillment === "WAREHOUSE" && <p className="mt-1 text-xs text-slate-500">창고에 위탁 입고된 재고에서 창고가 출고합니다. 배송 완료되면 정산 대상이 됩니다.</p>}
          <PoControls actor={actor} po={{ id: po.id, status: po.status, fulfillment: po.fulfillment, carrier: po.carrier, trackingNumber: po.trackingNumber, brandMemo: po.brandMemo, adminMemo: po.adminMemo, cancelRequested: !!po.cancelRequestedAt, returnReceived: !!po.returnReceivedAt }} />
        </article>
      ))}
      <Pagination base={base} params={params} page={page} size={size} total={total} />
    </div>
  );
}
