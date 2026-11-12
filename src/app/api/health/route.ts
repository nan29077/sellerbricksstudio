export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/health — 서버 · DB 동작 확인 (배포 상태 점검 · 업타임 모니터링용). 내부 정보는 내보내지 않는다.
export async function GET() {
  const started = Date.now();
  let db = false;
  try { await prisma.$queryRaw`SELECT 1`; db = true; } catch { db = false; }
  return NextResponse.json({ ok: db, db, ms: Date.now() - started, time: new Date().toISOString() }, { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
