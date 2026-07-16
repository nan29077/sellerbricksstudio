import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { getKakaoAdapter } from "@/lib/adapters/kakao";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["SELLER"]);
    const { channelId, csv } = await req.json();
    const channel = await prisma.kakaoChannel.findUnique({ where: { id: channelId } });
    if (!channel || channel.sellerId !== user.id) return fail("채널을 찾을 수 없습니다.", 404);
    const result = await getKakaoAdapter().uploadSubscribersCsv(channelId, csv ?? "");
    return ok(result);
  } catch (e) { return handleError(e); }
}
