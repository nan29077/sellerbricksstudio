import { Prisma } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/list/pagination";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { BRAND_REQUEST_KIND, BRAND_REQUEST_STATUS, brandProductHref } from "@/lib/brands";
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
  const kindFilter = sp(params, "kind");
  if (kindFilter === "SAMPLE" || kindFilter === "SUPPLY") where.kind = kindFilter;
  const [requests, total] = await Promise.all([
    prisma.brandRequest.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
      include: {
        product: { select: { isActive: true, shop: { select: { id: true, name: true } } } },
        buyer: { select: { id: true, role: true, email: true, profile: { select: { name: true, companyName: true, categories: true } } } },
      },
    }),
    prisma.brandRequest.count({ where }),
  ]);
  // 브랜드사 화면: 신청자 정보 + 샘플 후 실제 판매로 이어졌는지(전환) 표시
  const buyerIds = Array.from(new Set(requests.map((r) => r.buyerId)));
  const productIds = Array.from(new Set(requests.map((r) => r.productId)));
  const [liveCounts, snsCounts, sellerListings, facilityListings, soldItems] = manager && buyerIds.length ? await Promise.all([
    prisma.liveSession.groupBy({ by: ["sellerId"], where: { sellerId: { in: buyerIds } }, _count: true }),
    prisma.snsAccount.groupBy({ by: ["sellerId"], where: { sellerId: { in: buyerIds } }, _count: true, _sum: { followers: true } }).catch(() => []),
    prisma.sellerBrandProduct.findMany({ where: { sellerId: { in: buyerIds }, brandProductId: { in: productIds } }, select: { sellerId: true, brandProductId: true } }),
    prisma.facilityProduct.findMany({ where: { brandProductId: { in: productIds }, facility: { ownerId: { in: buyerIds } } }, select: { brandProductId: true, facility: { select: { ownerId: true } } } }),
    prisma.purchaseOrderItem.findMany({
      where: { brandProductId: { in: productIds }, purchaseOrder: { status: { notIn: ["CANCELLED", "RETURNED"] }, OR: [{ sellerId: { in: buyerIds } }, { facility: { ownerId: { in: buyerIds } } }] } },
      select: { brandProductId: true, quantity: true, purchaseOrder: { select: { sellerId: true, facility: { select: { ownerId: true } } } } },
    }),
  ]) : [[], [], [], [], []];
  const liveMap = new Map(liveCounts.map((x) => [x.sellerId, x._count]));
  const snsMap = new Map((snsCounts as { sellerId: string; _count: number; _sum: { followers: number | null } }[]).map((x) => [x.sellerId, x]));
  // 신청자 본인 화면: 샘플을 받은 뒤 판매 목록에 담았는지 확인해 다음 단계(판매 → 발주서)로 안내
  const [mySellerListings, myFacilityListings] = !manager && buyerIds.length ? await Promise.all([
    prisma.sellerBrandProduct.findMany({ where: { sellerId: { in: buyerIds }, brandProductId: { in: productIds } }, select: { sellerId: true, brandProductId: true } }),
    prisma.facilityProduct.findMany({ where: { brandProductId: { in: productIds }, facility: { ownerId: { in: buyerIds } } }, select: { brandProductId: true, facility: { select: { ownerId: true } } } }),
  ]) : [[], []];
  const listed = new Set([...sellerListings, ...mySellerListings].map((x) => `${x.sellerId}:${x.brandProductId}`)
    .concat([...facilityListings, ...myFacilityListings].map((x) => `${x.facility.ownerId}:${x.brandProductId}`)));
  const sold = new Map<string, number>();
  for (const it of soldItems) {
    for (const owner of Array.from(new Set([it.purchaseOrder.sellerId, it.purchaseOrder.facility?.ownerId].filter((v): v is string => !!v)))) {
      const key = `${owner}:${it.brandProductId}`; sold.set(key, (sold.get(key) ?? 0) + it.quantity);
    }
  }

  return (
    <div className="space-y-4">
      <form action={base} className="flex flex-wrap items-center gap-2">
        <Select aria-label="진행 상태" name="status" defaultValue={status ?? ""} className="w-auto">
          <option value="">전체 상태</option>
          {Object.entries(BRAND_REQUEST_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Select aria-label="신청 종류" name="kind" defaultValue={kindFilter ?? ""} className="w-auto">
          <option value="">전체 종류</option><option value="SAMPLE">샘플 주문</option><option value="SUPPLY">창고 입고 요청</option>
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
          <p className="mt-2 text-sm font-bold">{request.quantity.toLocaleString("ko-KR")}개 · {request.kind === "SAMPLE" && request.unitPrice === 0 ? "무료" : formatKRW(request.quantity * request.unitPrice)}
            {request.paymentStatus === "PAID" && <Badge tone="green" className="ml-2">결제 완료</Badge>}
            {request.paymentStatus === "REFUNDED" && <Badge tone="gray" className="ml-2">환불 완료</Badge>}
            {request.kind === "SUPPLY" && <span className="ml-2 text-xs font-medium text-slate-600">위탁 입고 · 판매분만 정산</span>}
          </p>
          {manager && (() => {
            const key = `${request.buyerId}:${request.productId}`;
            const soldQty = sold.get(key) ?? 0;
            return (
              <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                <p><b>신청자</b> {request.buyer.profile?.companyName || request.buyer.profile?.name || request.buyer.email} · {request.buyer.role === "SELLER" ? "셀러" : "창고(스튜디오)"}
                  {request.buyer.role === "SELLER" && <> · 라이브 {liveMap.get(request.buyerId) ?? 0}회 · SNS {snsMap.get(request.buyerId)?._count ?? 0}개(팔로워 {(snsMap.get(request.buyerId)?._sum.followers ?? 0).toLocaleString()})</>}</p>
                {!!request.buyer.profile?.categories?.length && <p className="mt-0.5">관심 카테고리: {request.buyer.profile.categories.join(", ")}</p>}
                <p className="mt-0.5"><b>판매 전환</b> {listed.has(key) ? "판매 목록에 담음" : "아직 판매 목록에 없음"} · 판매 {soldQty.toLocaleString()}개</p>
              </div>
            );
          })()}
          <p className="mt-1 break-all text-xs text-slate-500">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(request.createdAt)} · {request.id}
            {request.status === "PENDING" && request.remindedAt && <span className="ml-2 font-bold text-red-700">응대 기한 지남{manager ? " — 처리하지 않으면 자동 반려됩니다" : ""}</span>}</p>
          <p className="mt-3 break-words text-sm text-slate-600">{request.recipient} · {request.phone}<br />{request.address}</p>
          {request.message && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{request.message}</p>}
          {request.trackingNumber && <p className="mt-3 text-sm font-semibold">배송 조회 · {request.carrier && `${request.carrier} `}{request.trackingNumber}</p>}
          {request.rejectReason && <p className="mt-2 text-sm text-red-700">사유: {request.rejectReason}</p>}
          {request.receivedAt && <p className="mt-2 text-sm text-emerald-700">창고 입고 완료 · 창고 판매 재고에 {request.quantity.toLocaleString()}개 반영</p>}
          {request.paymentInstructions && request.status !== "AWAITING_PAYMENT" && !manager && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">브랜드 안내: {request.paymentInstructions}</p>}
          {request.status === "AWAITING_PAYMENT" && (
            <div className="mt-3 rounded-xl bg-brand-50 p-3 text-sm">
              <p className="font-bold">계좌이체 안내</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{request.paymentInstructions}</p>
              {!manager && <p className="mt-2 text-xs text-slate-600">이미 입금했다면 주문을 취소하기 전에 브랜드사에 문의해 주세요.</p>}
            </div>
          )}
          {!manager && request.kind === "SAMPLE" && ["APPROVED", "SHIPPED", "COMPLETED"].includes(request.status) && (() => {
            const onList = listed.has(`${request.buyerId}:${request.productId}`);
            const manage = request.buyer.role === "SELLER" ? "/seller/brand-products" : "/facility/brand-products";
            const orders = request.buyer.role === "SELLER" ? "/seller/orders" : "/facility/orders";
            return (
              <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 p-3 text-xs text-slate-700">
                <p className="font-bold text-navy">{onList ? "판매 목록에 담긴 상품입니다" : "샘플이 마음에 드셨나요? 바로 판매해 보세요"}</p>
                <p className="mt-1 break-keep">판매 목록에 담아 방송에 올리면, 주문이 들어올 때마다 배송 정보가 담긴 발주서가 브랜드사로 자동 전달됩니다. 직배송 상품은 브랜드사가 출고·운송장 입력을 하고, 진행 상태는 주문 관리에서 확인할 수 있습니다.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {onList
                    ? <><Link href={manage} className="hit font-bold text-brand-800 hover:underline">판매 상품 관리 →</Link><Link href={orders} className="hit font-bold text-brand-800 hover:underline">주문 · 발주 현황 →</Link></>
                    : request.product.isActive
                      ? <Link href={brandProductHref(request.product.shop.id, request.productId)} className="font-bold text-brand-800 hover:underline">판매 상품으로 가져오기 →</Link>
                      : <span className="text-slate-500">브랜드가 판매를 중단한 상품입니다.</span>}
                </div>
              </div>
            );
          })()}
          {!manager && request.kind === "SUPPLY" && ["COMPLETED", "REJECTED", "CANCELLED"].includes(request.status) && request.product.isActive && (
            <p className="mt-3 text-xs"><Link href="/facility/brand-products" className="font-bold text-brand-800 hover:underline">같은 상품 다시 입고 요청 →</Link></p>
          )}
          <BrandRequestControls request={{ id: request.id, status: request.status, kind: request.kind, unitPrice: request.unitPrice, paymentStatus: request.paymentStatus }} manager={manager} />
        </article>
      ))}
      <Pagination base={base} params={params} page={page} size={size} total={total} />
    </div>
  );
}
