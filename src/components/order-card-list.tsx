import { Badge } from "@/components/ui/badge";
import { LocalShipChip, PoChips } from "@/components/brand/po-chips";
import { OrderStatusActions } from "@/components/order-status-actions";
import { OrderDetail } from "@/components/order-detail";
import { ORDER_STATUS } from "@/lib/status";
import { formatKRW, formatDateTime } from "@/lib/utils";
import { orderActionProps } from "@/lib/order-action-props";
import { orderDetailProps } from "@/lib/order-view";
import type { OrderActor } from "@/lib/order-fulfillment";
import { livePlatformLabel } from "@/lib/live-platforms";

type Show = { seller?: boolean; place?: boolean };

// 주문서 · 주문 현황 목록 (창고 운영 · 셀러 · 최고관리자 공통). 금액은 셀러 주문서면 셀러 결제액.
// 표 대신 주문 한 건을 카드 한 장으로 보여 준다. 모바일에서도 좌우로 밀지 않고 상품 · 배송지 · 상태 · 처리 버튼을 한 번에 볼 수 있다.
export function OrderCardList({ orders, actor, piiRetentionDays, show = {} }: { orders: any[]; actor: OrderActor; piiRetentionDays: number; show?: Show }) {
  return (
    <ul className="mt-4 space-y-3">
      {orders.map((o) => {
        const st = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS] ?? { label: o.status, tone: "gray" as const };
        const meta: [string, React.ReactNode][] = [
          ...(show.seller ? [["셀러", o.seller?.profile?.name ?? "-"] as [string, React.ReactNode]] : []),
          ...(o.source === "SHEET"
            ? [["판매 플랫폼", `${livePlatformLabel(o.platform)}${o.externalOrderNo ? ` · ${o.externalOrderNo}` : ""}`] as [string, React.ReactNode],
               ["보내는 곳", o.facility?.name ? `스토리지마켓 (${o.facility.name})` : "위탁배송(브랜드 배송)"] as [string, React.ReactNode]]
            : [["방송", o.liveSession?.title ?? "-"] as [string, React.ReactNode], ...(show.place ? [["방송 장소", o.facility?.name ?? "셀러 공간"] as [string, React.ReactNode]] : [])]),
          ...(o.sheetMemo ? [["배송 메모", o.sheetMemo] as [string, React.ReactNode]] : []),
        ];
        return (
          <li key={o.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="break-all font-mono text-xs font-semibold text-navy">{o.orderNo}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{formatDateTime(o.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-base font-extrabold text-navy">{formatKRW(o.totalAmount)}</span>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
              {meta.map(([label, value]) => (
                <div key={label} className="flex min-w-0 gap-2">
                  <dt className="w-16 shrink-0 text-slate-500">{label}</dt>
                  <dd className="min-w-0 break-words font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
            <LocalShipChip order={o} />
            <PoChips pos={o.purchaseOrders} />
            <OrderDetail detail={orderDetailProps(o, actor, piiRetentionDays)} />
            <div className="mt-3 border-t border-slate-100 pt-3">
              <OrderStatusActions {...orderActionProps(o, actor)} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
