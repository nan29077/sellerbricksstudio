import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { CHANNEL_LABEL, looksLikeChannel, safeHttpUrl } from "@/lib/stream-embed";

// PUT /api/live-sessions/[id]/channels — 외부 송출 채널(유튜브 · 인스타그램 · 틱톡 · 기타) 주소 저장
//  구매자 방송 화면에 유튜브는 영상으로, 나머지는 '앱에서 보기' 버튼으로 나온다.
const schema = z.object({
  channels: z.array(z.object({
    type: z.enum(["YOUTUBE", "INSTAGRAM", "TIKTOK", "ETC"]),
    url: z.string().max(500).optional().nullable(),
  })).max(8),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const s = await prisma.liveSession.findUnique({ where: { id: params.id }, include: { facility: { select: { ownerId: true } } } });
    if (!s) return fail("방송을 찾을 수 없습니다.", 404);
    if (!(s.sellerId === user.id || s.facility?.ownerId === user.id || user.role === "SUPER_ADMIN")) return fail("권한이 없습니다.", 403);
    if (s.status === "CANCELLED" || s.status === "ENDED") return fail("종료되거나 취소된 방송은 바꿀 수 없습니다.", 409);
    const { channels } = schema.parse(await req.json().catch(() => ({})));

    const rows: { type: "YOUTUBE" | "INSTAGRAM" | "TIKTOK" | "ETC"; url: string }[] = [];
    for (const c of channels) {
      const raw = (c.url ?? "").trim();
      if (!raw) continue; // 빈 칸은 그 채널을 지운다
      const url = safeHttpUrl(raw);
      if (!url) return fail(`${CHANNEL_LABEL[c.type]} 주소는 https:// 로 시작하는 주소로 입력해 주세요.`);
      if (!looksLikeChannel(c.type, url)) return fail(`${CHANNEL_LABEL[c.type]} 주소가 아닌 것 같습니다. 주소를 확인해 주세요.`);
      if (rows.some((r) => r.type === c.type)) continue; // 같은 채널은 하나만
      rows.push({ type: c.type, url });
    }

    await prisma.$transaction([
      prisma.streamChannel.deleteMany({ where: { liveSessionId: s.id } }),
      ...(rows.length ? [prisma.streamChannel.createMany({ data: rows.map((r) => ({ liveSessionId: s.id, type: r.type, url: r.url })) })] : []),
    ]);
    await audit({ actorId: user.id, action: "LIVE_CHANNELS_UPDATE", entity: "LiveSession", entityId: s.id, meta: { channels: rows } });
    const saved = await prisma.streamChannel.findMany({ where: { liveSessionId: s.id }, orderBy: { createdAt: "asc" } });
    return ok(saved);
  } catch (e) { return handleError(e); }
}
