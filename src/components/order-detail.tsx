import { formatKRW } from "@/lib/utils";
import { SHIPPER_LABEL, type OrderDetailView } from "@/lib/order-view";

// 주문 목록의 '상품 · 배송지' 펼침. 출고 담당이 무엇을 어디로 보내는지 확인한다.
export function OrderDetail({ detail, defaultOpen = false }: { detail: OrderDetailView; defaultOpen?: boolean }) {
  const open = detail.lines.filter((l) => !l.cancelled);
  const qty = open.reduce((s, l) => s + l.quantity, 0);
  return (
    <details open={defaultOpen} className="mt-3 w-full max-w-xl whitespace-normal text-xs text-slate-700">
      <summary className="cursor-pointer select-none font-semibold text-brand-800 hover:underline">{open.length ? `상품 ${open.length}종 · ${qty}개` : `상품 ${detail.lines.length}종 (모두 취소)`} · 배송지 보기</summary>
      <ul className="mt-2 space-y-1.5 rounded-lg bg-slate-50 p-2.5">
        {detail.lines.map((l) => (
          <li key={l.id} className={l.cancelled ? "text-slate-400 line-through" : ""}>
            <span className="font-semibold text-navy">{l.name}</span>{l.option && <span> ({l.option})</span>} × {l.quantity}
            <span className="ml-1 text-slate-500">· {formatKRW(l.lineTotal)}</span>
            <span className="ml-1 inline-block whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600">{l.cancelled ? "취소" : SHIPPER_LABEL[l.shipper]}</span>
          </li>
        ))}
        {detail.shippingFee > 0 && <li className="text-slate-500">배송비 {formatKRW(detail.shippingFee)}</li>}
      </ul>
      <dl className="mt-2 space-y-0.5 rounded-lg border border-slate-200 p-2.5">
        <div className="flex gap-2"><dt className="w-12 shrink-0 text-slate-500">받는 분</dt><dd className="font-semibold text-navy">{detail.shipTo.name}</dd></div>
        <div className="flex gap-2"><dt className="w-12 shrink-0 text-slate-500">연락처</dt><dd>{detail.shipTo.phone}</dd></div>
        <div className="flex gap-2"><dt className="w-12 shrink-0 text-slate-500">배송지</dt><dd className="break-words">{detail.shipTo.address || "주소 없음"}</dd></div>
        {detail.shipTo.note && <p className="pt-1 text-[11px] text-slate-500">{detail.shipTo.note}</p>}
      </dl>
    </details>
  );
}
