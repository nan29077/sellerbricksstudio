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

export const PO_CHIP_INCLUDE = { select: { id: true, poNo: true, status: true, fulfillment: true, carrier: true, trackingNumber: true, cancelRequestedAt: true, cancelRequestReason: true, brandShop: { select: { name: true } } } } as const;
