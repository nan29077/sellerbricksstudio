import { BOOKING_STATUS } from "./status";
import { formatDateTime } from "./utils";
import { hhmm, hoursBetween } from "./kst";
import type { ManageBooking } from "@/components/booking/manage-booking-list";

type Row = {
  id: string; status: string; startAt: Date; endAt: Date; headcount: number | null; purpose: string | null;
  expectedProducts: string | null; requestNote: string | null; facilityMemo: string | null; rejectReason: string | null;
  cancelReason: string | null; createdAt: Date; sellerId: string;
  code?: string | null; groupId?: string | null; rescheduleCount?: number;
  facility: { name: string };
  seller: { email: string; profile: { name: string; phone: string | null; companyName: string | null } | null };
  products?: { id: string; nameSnapshot: string; quantity: number; priceSnapshot: number; status: string; facilityNote: string | null }[];
};

// 서버 → 클라이언트 전달용 직렬화
export function toManageBooking(b: Row, history?: Map<string, number>): ManageBooking {
  const st = BOOKING_STATUS[b.status] ?? { label: b.status, tone: "gray" as const };
  return {
    id: b.id, status: b.status, statusLabel: st.label, tone: st.tone,
    facilityName: b.facility.name, sellerName: b.seller.profile?.name ?? b.seller.email, sellerEmail: b.seller.email,
    sellerPhone: b.seller.profile?.phone ?? null, sellerCompany: b.seller.profile?.companyName ?? null,
    when: `${formatDateTime(b.startAt)} ~ ${hhmm(b.endAt)}`, hours: hoursBetween(b.startAt, b.endAt),
    headcount: b.headcount, purpose: b.purpose, expectedProducts: b.expectedProducts, requestNote: b.requestNote,
    facilityMemo: b.facilityMemo, rejectReason: b.rejectReason, cancelReason: b.cancelReason,
    started: b.startAt <= new Date(), createdAt: formatDateTime(b.createdAt), sellerHistory: history?.get(b.sellerId) ?? 0,
    code: b.code ?? null, recurring: !!b.groupId, rescheduleCount: b.rescheduleCount ?? 0,
    products: (b.products ?? []).map((p) => ({ id: p.id, name: p.nameSnapshot, quantity: p.quantity, price: p.priceSnapshot, status: p.status, note: p.facilityNote })),
  };
}
