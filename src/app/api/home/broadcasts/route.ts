import { NextResponse } from "next/server";
import { getHomeLiveBroadcasts } from "@/lib/home-live-broadcasts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const broadcasts = await getHomeLiveBroadcasts();
    return NextResponse.json(broadcasts, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "방송 목록을 불러오지 못했습니다." }, { status: 503 });
  }
}
