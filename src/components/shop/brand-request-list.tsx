import { Prisma } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/list/pagination";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { BRAND_REQUEST_KIND, BRAND_REQUEST_STATUS } from "@/lib/brands";
import { pageOf, sp, type SP } from "@/lib/list";
import { formatKRW } from "@/lib/utils";
import { BrandRequestControls } from "./brand-request-controls";

export async function BrandRequestList({ scope, manager, params, base }: {
  scope: Prisma.BrandRequestWhereInput; manager: boolean; params: SP; base: string;
}) {
  const { page, size, skip, take } = pageOf(params);
  const filter = sp(params, "status");
  const status = Object.keys(BRAND_REQUEST_STATUS).find((value) => value === filter) as keyof typeof BRAND_REQUEST_STATUS | undefined;
  const requestId = sp(params, "request");
  const where: Prisma.BrandRequestWhereInput = { ...scope, ...(status && { status }), ...(requestId && { id: requestId }) };
  const [requests, total] = await Promise.all([
    prisma.brandRequest.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      include: { product: { select: { shop: { select: { id: true, name: true } } } } },
    }),
    prisma.brandRequest.count({ where }),
  ]);

  return (
    <div className="space-y-4">
      <form action={base} className="flex flex-wrap items-center gap-2">
        <Select aria-label="진행 상태" name="status" defaultValue={status ?? ""} className="w-auto">
          <option value="">전체 상태</option>
          {Object.entries(BRAND_REQUEST_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        {manager && <Input aria-label="신청 번호" name="request" placeholder="신청 번호" maxLength={64} defaultValue={requestId} className="max-w-52" />}
        <Button variant="outline">조회</Button>
        {requestId && <Link href={base} className="px-2 py-2 text-sm font-semibold text-brand-800 hover:underline">전체 신청 보기</Link>}
      </form>
      {requests.length === 0 && <p className="rounded-2xl border bg-white p-6 text-sm text-slate-600">해당하는 신청 내역이 없습니다.</p>}
      {requests.map((request) => (
        <article key={request.id} className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-600">{request.product.shop.name} · {BRAND_REQUEST_KIND[request.kind]}</p>
              <h2 className="mt-1 text-lg font-black text-navy">{request.productName}</h2>
            </div>
            <Badge tone={request.status === "AWAITING_PAYMENT" ? "yellow" : request.status === "COMPLETED" ? "green" : "gray"}>{BRAND_REQUEST_STATUS[request.status]}</Badge>
          </div>
          <p className="mt-2 text-sm font-bold">{request.quantity.toLocaleString("ko-KR")}개 · {request.kind === "SAMPLE" && request.unitPrice === 0 ? "무료" : formatKRW(request.quantity * request.unitPrice)}</p>
          <p className="mt-1 break-all text-xs text-slate-500">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(request.createdAt)} · {request.id}</p>
          <p className="mt-3 break-words text-sm text-slate-600">{request.recipient} · {request.phone}<br />{request.address}</p>
          {request.message && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{request.message}</p>}
          {request.trackingNumber && <p className="mt-3 text-sm font-semibold">배송 조회 · {request.trackingNumber}</p>}
          {request.status === "AWAITING_PAYMENT" && (
            <div className="mt-3 rounded-xl bg-brand-50 p-3 text-sm">
              <p className="font-bold">계좌이체 안내</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{request.paymentInstructions}</p>
              {!manager && <p className="mt-2 text-xs text-slate-600">이미 입금했다면 주문을 취소하기 전에 브랜드사에 문의해 주세요.</p>}
            </div>
          )}
          <BrandRequestControls request={{ id: request.id, status: request.status, kind: request.kind, unitPrice: request.unitPrice }} manager={manager} />
        </article>
      ))}
      <Pagination base={base} params={params} page={page} size={size} total={total} />
    </div>
  );
}
