import { NextResponse } from "next/server";
import { getOnAirBroadcasts } from "@/lib/external-broadcasts";

export const dynamic = "force-dynamic";

// GET /api/broadcasts/on-air — 지금 방송 중인 외부 방송 (최고관리자 입력 + 셀러브릭스 연동). 누구나 볼 수 있다.
export async function GET() {
  try {
    return NextResponse.json(await getOnAirBroadcasts(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "방송 목록을 불러오지 못했습니다." }, { status: 503 });
  }
}
