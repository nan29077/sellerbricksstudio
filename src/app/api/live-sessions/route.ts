import { NextRequest } from "next/server";
import { brandSnapshotForFacilityProduct } from "@/lib/brand-links";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { liveSessionSchema } from "@/lib/validations";
import { ok, fail, handleError } from "@/lib/http";
import { slugify, parseKST } from "@/lib/utils";
import { looksLikeChannel, safeHttpUrl } from "@/lib/stream-embed";
import { audit } from "@/lib/audit";
import { emailVerifyBlock } from "@/lib/account-guards";
import { getSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["SELLER"]);
    const body = await req.json();
    const data = liveSessionSchema.parse(body);
    const blocked = await emailVerifyBlock(user);
    if (blocked) return fail(blocked, 403);
    // 최고관리자가 '메뉴 권한 설정'에서 라이브 기능을 끄면 화면뿐 아니라 새 방송 만들기도 막는다.
    if (!(await getSettings()).liveEnabled) return fail("지금은 라이브 기능이 꺼져 있어 방송을 만들 수 없습니다. 최고관리자에게 문의해 주세요.", 403);

    // 방송 장소
    //  - 창고(스튜디오) 방송: 승인된 예약으로만 만든다. (예약 시간 · 장소와 방송이 항상 연결되게) 창고 상품을 판다.
    //  - 셀러 공간 방송(예약 · 창고 없음): 셀러가 가져온 브랜드 직배송 상품을 판다. 배송은 브랜드가 한다.
    if (!data.bookingId && data.facilityId) return fail("창고(스튜디오)에서 방송하려면 승인된 예약을 선택해 주세요.");
    let booking: Awaited<ReturnType<typeof prisma.booking.findUnique>> = null;
    if (data.bookingId) {
      booking = await prisma.booking.findUnique({ where: { id: data.bookingId } });
      if (!booking || booking.sellerId !== user.id) return fail("예약을 찾을 수 없습니다.", 404);
      if (booking.status !== "APPROVED") return fail("승인된 예약만 라이브 세션을 만들 수 있습니다.");
      if (data.facilityId && booking.facilityId !== data.facilityId) return fail("예약한 창고(스튜디오)와 방송 장소가 다릅니다.");
      if (booking.endAt.getTime() < Date.now()) return fail("이용 시간이 끝난 예약입니다. 새 예약으로 방송을 만들어 주세요.");
      const existing = await prisma.liveSession.findUnique({ where: { bookingId: data.bookingId } });
      if (existing) return fail("이미 라이브 세션이 존재합니다.", 409);
      const facility = await prisma.facility.findUnique({ where: { id: booking.facilityId }, select: { status: true } });
      if (!facility || facility.status !== "APPROVED") return fail("방송할 수 없는 창고(스튜디오)입니다.", 404);
    }
    const facilityId = booking?.facilityId ?? null;

    const slug = slugify("live");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // 방송 채널: 스토리지마켓은 직접 송출하지 않는다. 셀러가 외부 채널(유튜브 등) 주소를 넣으면 구매자 화면에 연결된다.
    const channels: { type: "YOUTUBE" | "INSTAGRAM" | "TIKTOK" | "ETC"; url: string }[] = [];
    for (const c of data.snsChannels ?? []) {
      if (channels.some((x) => x.type === c.type)) continue;
      const raw = (c.url ?? "").trim();
      if (!raw) continue; // 빈 칸은 저장하지 않는다
      const url = safeHttpUrl(raw);
      if (!url || !looksLikeChannel(c.type, url)) return fail("방송 채널 주소를 확인해 주세요. (https:// 로 시작하는 해당 서비스 주소)");
      channels.push({ type: c.type, url });
    }

    const session = await prisma.liveSession.create({
      data: {
        slug, bookingId: booking?.id ?? null, sellerId: user.id, facilityId,
        title: data.title, description: data.description,
        scheduledStart: data.scheduledStart ? parseKST(data.scheduledStart) : booking?.startAt,
        scheduledEnd: data.scheduledEnd ? parseKST(data.scheduledEnd) : booking?.endAt,
        status: "DRAFT",
        buyerLinkUrl: `${appUrl}/live/${slug}`,
        ...(channels.length && { streamChannels: { create: channels } }),
      },
    });
    // 예약할 때 고른 상품을 판매 상품으로 자동 등록 (상품번호 1번부터, 준비 불가 표시된 상품 제외)
    if (booking) {
      const picked = await prisma.bookingProduct.findMany({
        where: { bookingId: booking.id, status: { not: "UNAVAILABLE" }, facilityProduct: { isSellable: true } },
        include: { facilityProduct: { include: { product: true } } }, orderBy: { createdAt: "asc" },
      });
      if (picked.length) {
        await prisma.$transaction(async (tx) => {
          let n = 0;
          for (const bp of picked) {
            n += 1;
            const fp = bp.facilityProduct;
            const lsp = await tx.liveSessionProduct.create({
              data: {
                liveSessionId: session.id, displayNumber: n, sortOrder: n - 1, facilityProductId: fp.id,
                nameSnapshot: fp.product.name, priceSnapshot: fp.salePrice, stockSnapshot: fp.stock,
                imageSnapshot: fp.product.thumbnailUrl, source: "CATALOG",
                ...(await brandSnapshotForFacilityProduct(tx, fp.id)),
              },
            });
            await tx.liveProductNumberHistory.create({ data: { liveSessionId: session.id, liveSessionProductId: lsp.id, newNumber: n, changedBy: user.id } });
          }
          await tx.liveSession.update({ where: { id: session.id }, data: { numberVersion: { increment: 1 } } });
        });
      }
    }
    await audit({ actorId: user.id, action: "LIVE_CREATE", entity: "LiveSession", entityId: session.id });
    return ok(session, 201);
  } catch (e) { return handleError(e); }
}
