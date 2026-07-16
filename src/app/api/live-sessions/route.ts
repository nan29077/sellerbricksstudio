import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { liveSessionSchema } from "@/lib/validations";
import { ok, fail, handleError } from "@/lib/http";
import { slugify, parseKST } from "@/lib/utils";
import { getCatenoidAdapter } from "@/lib/adapters/catenoid";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["SELLER"]);
    const body = await req.json();
    const data = liveSessionSchema.parse(body);

    // 예약 기반 생성 검증
    if (data.bookingId) {
      const booking = await prisma.booking.findUnique({ where: { id: data.bookingId } });
      if (!booking || booking.sellerId !== user.id) return fail("예약을 찾을 수 없습니다.", 404);
      if (booking.status !== "APPROVED") return fail("승인된 예약만 라이브 세션을 만들 수 있습니다.");
      const existing = await prisma.liveSession.findUnique({ where: { bookingId: data.bookingId } });
      if (existing) return fail("이미 라이브 세션이 존재합니다.", 409);
    }

    const slug = slugify("live");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // 자체 송출(카테노이드) Mock 스트림 생성
    const catenoid = getCatenoidAdapter();
    const stream = await catenoid.createLiveStream({ sessionId: slug, title: data.title });

    const session = await prisma.liveSession.create({
      data: {
        slug, bookingId: data.bookingId, sellerId: user.id, facilityId: data.facilityId,
        title: data.title, description: data.description,
        scheduledStart: data.scheduledStart ? parseKST(data.scheduledStart) : undefined,
        scheduledEnd: data.scheduledEnd ? parseKST(data.scheduledEnd) : undefined,
        status: "DRAFT",
        selfStreamUrl: stream.ingestUrl,
        catenoidStreamId: stream.streamId,
        catenoidPlaybackUrl: stream.playbackUrl,
        buyerLinkUrl: `${appUrl}/live/${slug}`,
        streamChannels: {
          create: [
            { type: "CATENOID", url: stream.playbackUrl, externalId: stream.streamId },
            ...(data.snsChannels ?? []).filter((c) => c.type !== "CATENOID").map((c) => ({ type: c.type, url: c.url })),
          ],
        },
        catenoidLogs: { create: { action: "CREATE", payload: JSON.stringify(stream) } },
      },
    });
    await audit({ actorId: user.id, action: "LIVE_CREATE", entity: "LiveSession", entityId: session.id });
    return ok(session, 201);
  } catch (e) { return handleError(e); }
}
