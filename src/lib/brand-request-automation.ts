import { prisma } from "./prisma";
import { getPolicy } from "./policy";
import { notify, notifyAdmins } from "./notify";
import { audit } from "./audit";
import { brandRecipients } from "./brand-access";
import { BRAND_REQUEST_KIND } from "./brands";
import { getPaymentAdapter } from "./adapters/payment";

// 샘플·창고 입고 요청 응대 기한 자동 처리
//  1) 브랜드가 '검토 중' 요청을 응대 기한(requestReplyHours) 안에 처리하지 않으면 브랜드에 한 번 더 알린다.
//  2) 그 뒤로 requestAutoRejectHours 가 더 지나도 그대로면 자동 반려하고, 샘플 재고를 되돌리고, 유료 샘플은 환불한다.
// 결제 대기(AWAITING_PAYMENT) 요청은 브랜드가 아니라 신청자 차례이므로 대상이 아니다.
export const AUTO_REJECT_REASON = "브랜드 응대 기한이 지나 자동 반려되었습니다.";

let lastRun = 0;

export async function runBrandRequestMaintenance(opts: { force?: boolean; now?: Date } = {}) {
  const nowMs = (opts.now ?? new Date()).getTime();
  if (!opts.force && nowMs - lastRun < 60_000) return { skipped: true, reminded: 0, rejected: 0 };
  lastRun = nowMs;
  const result = { skipped: false, reminded: 0, rejected: 0 };
  try {
    const policy = await getPolicy();
    if (policy.requestReplyHours <= 0) return result;
    const replyBefore = new Date(nowMs - policy.requestReplyHours * 3600000);

    // 1) 재알림
    const late = await prisma.brandRequest.findMany({
      where: { status: "PENDING", remindedAt: null, createdAt: { lt: replyBefore } },
      select: { id: true, kind: true, productName: true, product: { select: { shopId: true } } },
      take: 200,
    });
    for (const r of late) {
      const marked = await prisma.brandRequest.updateMany({ where: { id: r.id, status: "PENDING", remindedAt: null }, data: { remindedAt: new Date(nowMs) } });
      if (marked.count !== 1) continue;
      result.reminded += 1;
      await notify({
        userId: await brandRecipients(r.product.shopId), type: "SYSTEM",
        title: `응대 기한 지남 · ${BRAND_REQUEST_KIND[r.kind]}`,
        body: policy.requestAutoRejectHours > 0
          ? `${r.productName} — ${policy.requestAutoRejectHours}시간 안에 처리하지 않으면 자동 반려됩니다.`
          : r.productName,
        link: `/brand/requests?request=${r.id}`,
      });
    }

    // 2) 자동 반려
    if (policy.requestAutoRejectHours <= 0) return result;
    const rejectBefore = new Date(nowMs - policy.requestAutoRejectHours * 3600000);
    const expired = await prisma.brandRequest.findMany({
      where: { status: "PENDING", remindedAt: { lt: rejectBefore } },
      select: { id: true },
      take: 200,
    });
    for (const { id } of expired) {
      const done = await prisma.$transaction(async (tx) => {
        const r = await tx.brandRequest.findUnique({
          where: { id },
          select: { id: true, kind: true, status: true, quantity: true, productId: true, productName: true, buyerId: true, paymentStatus: true, pgTransactionId: true, paidAmount: true, product: { select: { shopId: true } } },
        });
        if (!r || r.status !== "PENDING") return null;
        const moved = await tx.brandRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: "REJECTED", rejectReason: AUTO_REJECT_REASON } });
        if (moved.count !== 1) return null;
        // 샘플은 신청할 때 샘플 재고를 잡아 두므로 되돌린다. (입고 요청은 승인할 때 재고를 빼므로 검토 중에는 되돌릴 것이 없다)
        if (r.kind === "SAMPLE") await tx.brandProduct.update({ where: { id: r.productId }, data: { sampleStock: { increment: r.quantity } } });
        return r;
      });
      if (!done) continue;
      result.rejected += 1;
      let refundNote = "";
      if (done.paymentStatus === "PAID" && done.pgTransactionId) {
        const refunded = await getPaymentAdapter().refundPayment(done.pgTransactionId, done.paidAmount, AUTO_REJECT_REASON).catch(() => ({ success: false }));
        await prisma.brandRequest.update({
          where: { id: done.id },
          data: refunded.success ? { paymentStatus: "REFUNDED" } : { rejectReason: `${AUTO_REJECT_REASON} 환불 처리 실패 — 최고관리자가 확인합니다.` },
        });
        if (refunded.success) refundNote = " (결제 환불)";
        else await notifyAdmins({ type: "SYSTEM", title: "샘플 환불 실패 확인 필요", body: done.productName, link: `/admin/brands/requests?request=${done.id}` });
      }
      await audit({ actorId: null, action: "BRAND_REQUEST_AUTO_REJECT", entity: "BrandRequest", entityId: done.id, meta: { kind: done.kind } });
      await notify({ userId: done.buyerId, type: "SYSTEM", title: `브랜드 신청 · 자동 반려${refundNote}`, body: `${done.productName} · ${AUTO_REJECT_REASON}`, link: `/brand-requests?request=${done.id}` });
      await notify({ userId: await brandRecipients(done.product.shopId), type: "SYSTEM", title: `응대 기한 초과로 자동 반려 · ${BRAND_REQUEST_KIND[done.kind]}`, body: done.productName, link: `/brand/requests?request=${done.id}` });
    }
  } catch (error) {
    console.error("[brand-request-maintenance]", error);
  }
  return result;
}
