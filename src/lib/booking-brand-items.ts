import type { BrandRequestStatus, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { notify } from "./notify";
import { audit } from "./audit";
import { brandRecipients } from "./brand-access";
import { notifyFacility, canOperateFacility } from "./facility-owner";
import { parseOptions } from "./brands";
import { formatDateTime } from "./utils";
import type { SessionUser } from "./auth";

// ---------------------------------------------------------------------------
// 예약에 담은 브랜드 상품 → 방송 시연품 (2026-11-14)
//  셀러: 브랜드 상품 고르기 → 창고 · 스튜디오 · 쇼룸 예약(브랜드 상품 담기) → 예약 승인
//   → 브랜드에 '방송 시연품' 요청 자동 발송(도착 기한: 방송 2일 전) → 브랜드 발송 → 공간 운영자 도착 확인 → 예약한 날 그 공간에서 방송
//  판매는 셀러가 외부 라이브 플랫폼에서 하고, 판매분은 주문서로 낸다 (위탁배송 = 브랜드가 받는 분에게 바로 발송).
//  시연품은 브랜드 무료 제공이 원칙이다 (공급가 결제 없음). 방송 뒤 처리(반송 · 보관 등)는 브랜드가 요청 메시지로 정한다.
// ---------------------------------------------------------------------------

import { DISPLAY_DUE_HOURS, earliestDisplayStart, normalizeOptionLabel, readVariants, variantOf } from "./brand-pricing";
export { DISPLAY_DUE_HOURS }; // 도착 기한: 방송 시작 2일 전
export const MAX_BRAND_ITEMS = 20;
export const MAX_DISPLAY_QTY = 5;

export type BrandItemInput = { brandProductId: string; quantity?: number; optionLabel?: string | null };

export { displayState } from "./booking-brand-items-view";

/** 셀러가 담은 브랜드 상품을 확인하고 저장할 값으로 바꾼다 (셀러가 고른 위탁배송 상품만) */
export async function resolveBrandItems(sellerId: string, input: BrandItemInput[] | undefined, startAt?: Date) {
  const wanted = new Map<string, { quantity: number; optionLabel: string | null }>();
  for (const it of input ?? []) {
    if (!it?.brandProductId) continue;
    wanted.set(it.brandProductId, { quantity: Math.max(1, Math.min(MAX_DISPLAY_QTY, Math.round(Number(it.quantity) || 1))), optionLabel: (it.optionLabel ?? "").trim().slice(0, 100) || null });
  }
  if (wanted.size > MAX_BRAND_ITEMS) throw new Error(`브랜드 상품은 한 예약에 ${MAX_BRAND_ITEMS}개까지 담을 수 있습니다.`);
  if (!wanted.size) return [];
  const listings = await prisma.sellerBrandProduct.findMany({
    where: { sellerId, brandProductId: { in: [...wanted.keys()] } },
    include: { brandProduct: { include: { shop: { select: { id: true, name: true, status: true, owner: { select: { isActive: true, role: true } }, partners: { where: { userId: sellerId }, select: { status: true } } } } } } },
  });
  return [...wanted.entries()].map(([id, w]) => {
    const l = listings.find((x) => x.brandProductId === id);
    if (!l) throw new Error("내가 고른 브랜드 상품만 예약에 담을 수 있습니다. 브랜드샵에서 먼저 판매 상품으로 골라 주세요.");
    const bp = l.brandProduct;
    if (!l.isActive || !bp.isActive || bp.shop.status !== "APPROVED" || !bp.shop.owner.isActive || bp.shop.partners.some((p) => p.status === "BLOCKED")) {
      throw new Error(`지금 판매할 수 없는 브랜드 상품입니다: ${bp.name}`);
    }
    const opts = parseOptions(bp.options);
    let optionLabel: string | null = null;
    if (opts.length) {
      optionLabel = normalizeOptionLabel(opts, w.optionLabel);
      if (!optionLabel) throw new Error(`${bp.name}: 옵션을 골라 주세요 (${opts.map((g) => `${g.name}: ${g.values.join("/")}`).join(", ")}).`);
      if (variantOf(readVariants(bp.optionVariants, opts), optionLabel)?.soldOut) throw new Error(`${bp.name}: 고른 옵션은 품절입니다. 다른 옵션을 골라 주세요.`);
    }
    if (bp.stock <= 0) throw new Error(`${bp.name}: 브랜드 재고가 없어 시연품을 받을 수 없습니다.`);
    // 브랜드가 보내고 공간에 방송 2일 전까지 도착하려면 시간이 필요하다
    if (startAt) {
      const earliest = earliestDisplayStart(bp.leadDays);
      if (startAt < earliest) throw new Error(`${bp.name}: 시연품을 받으려면 ${formatDateTime(earliest)} 이후 방송으로 예약해 주세요. (브랜드 출고 ${Math.max(1, bp.leadDays)}일 + 방송 2일 전 도착) 상품을 빼고 공간만 예약할 수도 있어요.`);
    }
    return { brandProductId: bp.id, sellerBrandProductId: l.id, nameSnapshot: bp.name, supplyPriceSnapshot: bp.supplyPrice, optionLabel, quantity: w.quantity };
  });
}

/** 예약 승인 시: 아직 요청하지 않은 브랜드 상품마다 브랜드에 방송 시연품 요청을 보낸다 */
export async function requestDisplayItems(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      facility: { select: { id: true, name: true, address: true, contactPhone: true } },
      seller: { select: { email: true, profile: { select: { name: true, companyName: true } } } },
      brandItems: { where: { brandRequestId: null }, include: { brandProduct: { select: { id: true, shopId: true, name: true, isActive: true, shop: { select: PUBLIC_BRAND_SHOP_SELECT } } } } },
    },
  });
  if (!booking || booking.status !== "APPROVED" || !booking.brandItems.length) return 0;
  const sellerName = booking.seller.profile?.companyName || booking.seller.profile?.name || booking.seller.email;
  const due = new Date(booking.startAt.getTime() - DISPLAY_DUE_HOURS * 3600000);
  let made = 0;
  for (const item of booking.brandItems) {
    if (!item.brandProduct.isActive || item.brandProduct.shop.status !== "APPROVED") {
      await notify({ userId: booking.sellerId, type: "BOOKING", title: "방송 상품 하나는 준비할 수 없습니다", body: `${item.nameSnapshot} · 브랜드가 판매를 멈췄습니다`, link: "/seller/bookings" });
      continue;
    }
    const message = [
      `[방송 시연품] ${sellerName} 셀러가 ${formatDateTime(booking.startAt)}에 ${booking.facility.name}에서 이 상품으로 방송합니다.`,
      `${formatDateTime(due)}까지 도착하도록 보내 주세요.${item.optionLabel ? ` 옵션: ${item.optionLabel}` : ""}`,
      "방송 뒤 처리(반송 · 보관 · 셀러 전달)가 필요하면 브랜드 메시지로 알려 주세요.",
    ].join("\n");
    const req = await prisma.$transaction(async (tx) => {
      const created = await tx.brandRequest.create({
        data: {
          productId: item.brandProductId, buyerId: booking.sellerId, requestKey: `display-${item.id}`.slice(0, 64), kind: "DISPLAY", status: "PENDING",
          productName: item.nameSnapshot, quantity: item.quantity, unitPrice: 0,
          recipient: `${booking.facility.name} (방송 시연품 · ${booking.code ?? ""})`.slice(0, 80), phone: booking.facility.contactPhone ?? "",
          address: booking.facility.address, message: message.slice(0, 1000),
        },
      });
      await tx.bookingBrandItem.update({ where: { id: item.id }, data: { brandRequestId: created.id, dueAt: due } });
      return created;
    });
    made++;
    await notify({ userId: await brandRecipients(item.brandProduct.shopId), type: "SYSTEM", title: "새 방송 시연품 요청", body: `${item.nameSnapshot} · ${booking.facility.name} · ${formatDateTime(due)}까지 도착`, link: `/brand/requests?request=${req.id}` });
  }
  if (made) await audit({ action: "BOOKING_DISPLAY_REQUEST", entity: "Booking", entityId: bookingId, meta: { count: made } });
  return made;
}
const PUBLIC_BRAND_SHOP_SELECT = { status: true } satisfies Prisma.BrandShopSelect;

/** 예약 취소 · 거절 · 노쇼: 아직 보내지 않은 시연품 요청은 취소하고 브랜드에 알린다 */
export async function cancelDisplayItems(bookingId: string, reason: string) {
  const items = await prisma.bookingBrandItem.findMany({
    where: { bookingId, brandRequest: { status: { in: ["PENDING", "APPROVED", "AWAITING_PAYMENT"] } } },
    include: { brandRequest: { select: { id: true, productName: true } }, brandProduct: { select: { shopId: true } } },
  });
  for (const it of items) {
    await prisma.brandRequest.update({ where: { id: it.brandRequest!.id }, data: { status: "CANCELLED", rejectReason: reason.slice(0, 200) } });
    await notify({ userId: await brandRecipients(it.brandProduct.shopId), type: "SYSTEM", title: "방송 시연품 요청이 취소되었습니다", body: `${it.brandRequest!.productName} · ${reason}`, link: `/brand/requests?request=${it.brandRequest!.id}` });
  }
  return items.length;
}

/** 일정 변경: 도착 기한을 새 일정에 맞추고, 진행 중인 요청이면 브랜드에 알린다 */
/** 일정 변경 전에: 아직 보내지 않은 시연품이 새 일정에 맞출 수 있는지 (안 되면 안내 문구) */
export async function displayRescheduleError(bookingId: string, startAt: Date): Promise<string | null> {
  const items = await prisma.bookingBrandItem.findMany({
    where: { bookingId },
    select: { nameSnapshot: true, brandRequest: { select: { status: true } }, brandProduct: { select: { leadDays: true } } },
  });
  for (const it of items) {
    const status = it.brandRequest?.status;
    if (status && !["PENDING", "APPROVED"].includes(status)) continue; // 이미 발송 · 도착 · 취소된 것은 상관없다
    const earliest = earliestDisplayStart(it.brandProduct.leadDays);
    if (startAt < earliest) return `${it.nameSnapshot} 시연품이 도착할 시간이 부족합니다. ${formatDateTime(earliest)} 이후로 바꿔 주세요.`;
  }
  return null;
}

export async function rescheduleDisplayItems(bookingId: string, startAt: Date) {
  const due = new Date(startAt.getTime() - DISPLAY_DUE_HOURS * 3600000);
  const items = await prisma.bookingBrandItem.findMany({ where: { bookingId }, include: { brandRequest: { select: { id: true, status: true, productName: true } }, brandProduct: { select: { shopId: true } } } });
  for (const it of items) {
    await prisma.bookingBrandItem.update({ where: { id: it.id }, data: { dueAt: it.brandRequestId ? due : null, remindedAt: null } });
    if (it.brandRequest && ["PENDING", "APPROVED", "SHIPPED"].includes(it.brandRequest.status)) {
      await notify({ userId: await brandRecipients(it.brandProduct.shopId), type: "SYSTEM", title: "방송 일정이 바뀌었습니다 (시연품)", body: `${it.brandRequest.productName} · ${formatDateTime(due)}까지 도착`, link: `/brand/requests?request=${it.brandRequest.id}` });
    }
  }
}

/** 공간 운영자(또는 현장의 셀러)가 시연품 도착을 확인한다 */
export async function markDisplayArrived(user: SessionUser, itemId: string) {
  const item = await prisma.bookingBrandItem.findUnique({
    where: { id: itemId },
    include: { booking: { select: { id: true, sellerId: true, facilityId: true, status: true, facility: { select: { name: true } } } }, brandRequest: true, brandProduct: { select: { shopId: true } } },
  });
  if (!item) throw new Error("예약 상품을 찾을 수 없습니다.");
  const operator = await canOperateFacility(user, item.booking.facilityId);
  if (!operator && item.booking.sellerId !== user.id) throw new Error("FORBIDDEN");
  if (!item.brandRequest) throw new Error("아직 브랜드에 요청하지 않은 상품입니다. 예약이 승인되면 자동으로 요청됩니다.");
  if (item.brandRequest.status === "COMPLETED") return item.brandRequest;
  if (!["APPROVED", "SHIPPED"].includes(item.brandRequest.status)) throw new Error("브랜드가 발송을 준비 중이거나 발송한 상품만 도착 확인할 수 있습니다.");
  const updated = await prisma.brandRequest.update({ where: { id: item.brandRequest.id }, data: { status: "COMPLETED", receivedAt: new Date() } });
  await audit({ actorId: user.id, action: "BOOKING_DISPLAY_ARRIVED", entity: "BookingBrandItem", entityId: item.id });
  const body = `${item.nameSnapshot} · ${item.booking.facility.name}`;
  await notify({ userId: await brandRecipients(item.brandProduct.shopId), type: "SYSTEM", title: "방송 시연품이 도착했습니다", body, link: `/brand/requests?request=${item.brandRequest.id}` });
  if (item.booking.sellerId !== user.id) await notify({ userId: item.booking.sellerId, type: "BOOKING", title: "방송 상품이 공간에 도착했습니다", body, link: "/seller/bookings" });
  return updated;
}

/** 정기 처리: 방송 하루 전까지 도착하지 않은 시연품을 셀러 · 공간 운영자 · 브랜드에 알린다 (한 번만) */
export async function remindLateDisplayItems(now = new Date()) {
  const items = await prisma.bookingBrandItem.findMany({
    where: {
      remindedAt: null, brandRequest: { status: { in: ["PENDING", "APPROVED", "SHIPPED"] } },
      booking: { status: "APPROVED", startAt: { gt: now, lte: new Date(now.getTime() + 24 * 3600000) } },
    },
    include: { booking: { select: { id: true, sellerId: true, facilityId: true, startAt: true, facility: { select: { name: true } } } }, brandRequest: { select: { id: true, status: true } }, brandProduct: { select: { shopId: true } } },
    take: 200,
  });
  for (const it of items) {
    const body = `${it.nameSnapshot} · ${it.booking.facility.name} · 방송 ${formatDateTime(it.booking.startAt)}`;
    await notify({ userId: it.booking.sellerId, type: "BOOKING", title: "방송 상품이 아직 도착하지 않았습니다", body, link: "/seller/bookings" });
    await notifyFacility(it.booking.facilityId, { type: "BOOKING", title: "방송 시연품 미도착 (내일 방송)", body, link: "/facility/bookings?status=APPROVED" });
    await notify({ userId: await brandRecipients(it.brandProduct.shopId), type: "SYSTEM", title: "방송 시연품 도착 확인이 안 됐습니다 (내일 방송)", body, link: `/brand/requests?request=${it.brandRequest!.id}` });
    await prisma.bookingBrandItem.update({ where: { id: it.id }, data: { remindedAt: now } });
  }
  return items.length;
}
