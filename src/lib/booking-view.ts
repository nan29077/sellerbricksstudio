import { BOOKING_STATUS } from "./status";
import { formatDateTime } from "./utils";
import { hhmm, hoursBetween } from "./kst";
import type { ManageBooking } from "@/components/booking/manage-booking-list";
import type { BrandItemView } from "@/components/booking/brand-item-list";
import type { BrandRequestStatus, Prisma } from "@prisma/client";
import { displayState } from "./booking-brand-items-view";

/** 예약 조회 시 같이 읽을 브랜드 상품(시연품) */
export const BRAND_ITEMS_INCLUDE = {
  orderBy: { createdAt: "asc" },
  include: { brandProduct: { select: { shop: { select: { name: true } } } }, brandRequest: { select: { status: true, carrier: true, trackingNumber: true, rejectReason: true } } },
} satisfies Prisma.Booking$brandItemsArgs;
type BrandItemRow = {
  id: string; nameSnapshot: string; quantity: number; optionLabel: string | null; dueAt: Date | null;
  brandProduct: { shop: { name: string } }; brandRequest: { status: BrandRequestStatus; carrier: string; trackingNumber: string; rejectReason: string } | null;
};
export function toBrandItemView(i: BrandItemRow): BrandItemView {
  const st = displayState(i.brandRequest?.status);
  return {
    id: i.id, name: i.nameSnapshot, brandName: i.brandProduct.shop.name, quantity: i.quantity, optionLabel: i.optionLabel,
    state: st.key, stateLabel: st.label, due: i.dueAt ? formatDateTime(i.dueAt) : null,
    carrier: i.brandRequest?.carrier || null, trackingNumber: i.brandRequest?.trackingNumber || null,
    reason: st.key === "UNAVAILABLE" ? i.brandRequest?.rejectReason || null : null,
  };
}

type Row = {
  id: string; status: string; startAt: Date; endAt: Date; headcount: number | null; purpose: string | null;
  expectedProducts: string | null; requestNote: string | null; facilityMemo: string | null; rejectReason: string | null;
  cancelReason: string | null; createdAt: Date; sellerId: string;
  code?: string | null; groupId?: string | null; rescheduleCount?: number; checkedInAt?: Date | null;
  facility: { name: string };
  seller: { email: string; profile: { name: string; phone: string | null; companyName: string | null } | null };
  products?: { id: string; nameSnapshot: string; quantity: number; priceSnapshot: number; status: string; facilityNote: string | null }[];
  brandItems?: BrandItemRow[];
};

// 서버 → 클라이언트 전달용 직렬화
export function toManageBooking(b: Row, history?: Map<string, number>, extra?: {
  reliability?: Map<string, { completed: number; noShow: number; cancelled: number }>; noShowGraceMinutes?: number;
}): ManageBooking {
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
    checkedIn: !!b.checkedInAt,
    canCheckIn: b.status === "APPROVED" && !b.checkedInAt && Date.now() >= b.startAt.getTime() - 2 * 3600000 && Date.now() <= b.endAt.getTime(),
    canNoShow: b.status === "APPROVED" && !b.checkedInAt && Date.now() >= b.startAt.getTime() + (extra?.noShowGraceMinutes ?? 30) * 60000,
    noShowCount: extra?.reliability?.get(b.sellerId)?.noShow ?? 0,
    cancelCount: extra?.reliability?.get(b.sellerId)?.cancelled ?? 0,
    products: (b.products ?? []).map((p) => ({ id: p.id, name: p.nameSnapshot, quantity: p.quantity, price: p.priceSnapshot, status: p.status, note: p.facilityNote })),
    brandItems: (b.brandItems ?? []).map(toBrandItemView),
  };
}
