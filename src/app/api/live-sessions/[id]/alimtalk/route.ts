import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { getKakaoAdapter } from "@/lib/adapters/kakao";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["SELLER"]);
    const { channelId, templateCode } = await req.json();
    const session = await prisma.liveSession.findUnique({ where: { id: params.id } });
    if (!session || session.sellerId !== user.id) return fail("세션을 찾을 수 없습니다.", 404);

    const channel = await prisma.kakaoChannel.findUnique({ where: { id: channelId }, include: { subscribers: true } });
    if (!channel || channel.sellerId !== user.id) return fail("카카오 채널을 찾을 수 없습니다.", 404);
    if (channel.subscribers.length === 0) return fail("발송할 가입자가 없습니다.");

    const template = await prisma.notificationTemplate.findUnique({ where: { code: templateCode ?? "LIVE_OPEN" } });
    const raw = template?.content ?? "[셀러 브릭스] 라이브 방송 안내 {방송링크}";
    const link = session.buyerLinkUrl ?? "";
    const content = raw.replace("{방송링크}", link);

    const adapter = getKakaoAdapter();
    const v = adapter.validateTemplate(content);
    if (!v.valid) return fail(v.error ?? "템플릿 검증 실패");

    const result = await adapter.sendAlimtalk({
      liveSessionId: session.id, channelId: channel.id, templateCode: templateCode ?? "LIVE_OPEN",
      recipients: channel.subscribers.map((s) => ({ name: s.name, phone: s.phone })), content,
    });
    await prisma.liveSession.update({ where: { id: session.id }, data: { alimtalkStatus: "SENT" } });
    await audit({ actorId: user.id, action: "ALIMTALK_SEND", entity: "LiveSession", entityId: session.id, meta: result });
    return ok({ ...result, preview: content });
  } catch (e) { return handleError(e); }
}
