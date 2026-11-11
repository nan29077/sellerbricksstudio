import { PO_STATUS } from "@/lib/brands";

type Po = { status: keyof typeof PO_STATUS; fulfillment: "DROPSHIP" | "WAREHOUSE"; carrier: string; trackingNumber: string; brandShop: { name: string } };

// 주문 목록에서 브랜드 발주 진행 상황 표시
export function PoChips({ pos }: { pos?: Po[] | null }) {
  if (!pos?.length) return null;
  return (
    <div className="mt-1 flex flex-col gap-0.5">
      {pos.map((p, i) => (
        <span key={i} className="text-[11px] text-slate-600">
          {p.fulfillment === "DROPSHIP" ? "직배송" : "위탁"} · {p.brandShop.name} · <b>{PO_STATUS[p.status].label}</b>{p.trackingNumber && ` · ${p.carrier} ${p.trackingNumber}`}
        </span>
      ))}
    </div>
  );
}

// 직접 출고분(창고(스튜디오) · 셀러) 배송 상태
export function LocalShipChip({ order }: { order: { facilityId?: string | null; localShippedAt?: Date | string | null; localDeliveredAt?: Date | string | null; shipCarrier?: string | null; shipTrackingNumber?: string | null; status?: string } }) {
  if (!order.localShippedAt) return null;
  return (
    <span className="mt-1 block text-[11px] text-slate-600">
      {order.facilityId ? "창고 출고" : "셀러 출고"} · <b>{order.localDeliveredAt ? "배송 완료" : "배송 중"}</b>{order.shipTrackingNumber && ` · ${order.shipCarrier ?? ""} ${order.shipTrackingNumber}`}
    </span>
  );
}

export const PO_CHIP_INCLUDE = { select: { id: true, poNo: true, status: true, fulfillment: true, carrier: true, trackingNumber: true, cancelRequestedAt: true, cancelRequestReason: true, brandShop: { select: { name: true } } } } as const;
