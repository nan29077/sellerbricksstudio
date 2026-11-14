import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table } from "@/components/ui/table";
import { CsvButton } from "@/components/list/csv-button";
import { ORDER_STATUS } from "@/lib/status";
import { formatDateTime, formatKRW } from "@/lib/utils";
import type { revenueLines } from "@/lib/settlement";

type Rows = Awaited<ReturnType<typeof revenueLines>>;

// 판매별 내 수익 (셀러 · 스토리지마켓 화면). 금액은 주문할 때 확정된 분배 기준이다.
export function RevenueTable({ rows, perspective }: { rows: Rows; perspective: "SELLER" | "FACILITY" }) {
  const mine = (r: Rows[number]) => (perspective === "SELLER" ? r.seller : r.facility);
  const other = perspective === "SELLER" ? "공간" : "셀러";
  const total = rows.reduce((s, r) => s + mine(r), 0);
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">판매별 내 수익 (최근 {rows.length}건)</CardTitle>
          <p className="text-xs text-muted-foreground">
            주문할 때 확정된 금액입니다. 판매가 = 플랫폼 수수료 + 브랜드 공급대금 + 공간 몫 + 셀러 몫 · 배송비는 택배를 보내는 쪽 몫(창고가 출고하면 창고, 브랜드 직배송 · 셀러 공간 방송은 셀러)에 포함.
            배송 완료 후 정산서에 들어갑니다.
          </p>
        </div>
        <CsvButton label="CSV" filename={perspective === "SELLER" ? "셀러_판매수익" : "창고_판매수익"}
          headers={["주문일", "주문번호", "방송", other, "상품", "결제금액", "배송비", "배송비 받는 쪽", "플랫폼 수수료", "브랜드 공급대금", "창고 몫", "셀러 몫", "상태", "정산"]}
          rows={rows.map((r) => [formatDateTime(r.createdAt), r.orderNo, r.title, perspective === "SELLER" ? r.facilityName : r.sellerName, r.lines.map((l) => `${l.name}×${l.quantity}`).join(", "), r.gross, r.shipping, r.shipping ? (r.shippingTo === "FACILITY" ? "창고" : "셀러") : "", r.platformFee, r.brand, r.facility, r.seller, ORDER_STATUS[r.status]?.label, r.settled ? "정산서 포함" : "미정산"])} />
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">아직 판매된 주문이 없습니다.</p> : (
          <>
            <p className="text-sm">합계 내 수익 <b className="text-brand-700">{formatKRW(total)}</b></p>
            <Table headers={["주문일", "주문", other, "상품", "결제금액", "수수료", "브랜드", "창고 몫", "셀러 몫", "상태"]}
              rows={rows.map((r) => [
                formatDateTime(r.createdAt), <span key="o" className="font-mono text-xs">{r.orderNo}</span>, perspective === "SELLER" ? r.facilityName : r.sellerName,
                <span key="p" className="text-xs">{r.lines.map((l) => `${l.name}×${l.quantity}`).join(", ").slice(0, 40)}</span>,
                formatKRW(r.gross), <span key="f" className="text-slate-500">{formatKRW(r.platformFee)}</span>, <span key="b" className="text-slate-500">{formatKRW(r.brand)}</span>,
                perspective === "FACILITY" ? <b key="fa">{formatKRW(r.facility)}{r.shipping && r.shippingTo === "FACILITY" ? <span className="ml-1 text-[11px] font-normal text-slate-500">(배송비 {formatKRW(r.shipping)})</span> : null}</b> : formatKRW(r.facility),
                perspective === "SELLER" ? <b key="se">{formatKRW(r.seller)}{r.shipping && r.shippingTo === "SELLER" ? <span className="ml-1 text-[11px] font-normal text-slate-500">(배송비 {formatKRW(r.shipping)})</span> : null}</b> : formatKRW(r.seller),
                <span key="s"><Badge tone={ORDER_STATUS[r.status]?.tone}>{ORDER_STATUS[r.status]?.label}</Badge>{r.settled && <span className="ml-1 text-[11px] text-slate-500">정산서</span>}</span>,
              ])} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
