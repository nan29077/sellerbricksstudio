import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { audit } from "@/lib/audit";
import { applySellerbricksSnapshot, upsertSellerbricksLive, verifySellerbricksSignature } from "@/lib/external-broadcasts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/integrations/sellerbricks/broadcasts — 셀러브릭스 → 스토리지마켓 방송 웹훅
//  헤더: x-sellerbricks-timestamp (유닉스 초), x-sellerbricks-signature = hex(HMAC-SHA256(`${timestamp}.${본문}`, SELLERBRICKS_WEBHOOK_SECRET))
//  본문:
//   { "event": "live.started" | "live.updated" | "live.scheduled" | "live.ended", "broadcast": { id, title, sellerName, watchUrl, embedUrl?, hlsUrl?, thumbnailUrl?, scheduledAt?, startedAt?, endedAt? } }
//   { "event": "live.snapshot", "broadcasts": [ ...지금 방송 중 · 예정인 전체 목록 ] }   ← 목록에 없는 방송은 종료 처리
export async function POST(req: Request) {
  const body = await req.text();
  if (body.length > 1_000_000) return fail("본문이 너무 큽니다.", 413);
  const v = verifySellerbricksSignature(body, req.headers.get("x-sellerbricks-timestamp"), req.headers.get("x-sellerbricks-signature"));
  if (!v.ok) return fail(v.error, v.status);
  let json: { event?: string; broadcast?: unknown; broadcasts?: unknown[] };
  try { json = JSON.parse(body); } catch { return fail("JSON 본문이 아닙니다."); }
  const event = String(json.event ?? "");
  if (event === "live.snapshot") {
    if (!Array.isArray(json.broadcasts)) return fail("broadcasts 배열이 필요합니다.");
    const r = await applySellerbricksSnapshot(json.broadcasts);
    await audit({ action: "SELLERBRICKS_WEBHOOK", entity: "ExternalBroadcast", meta: { event, saved: r.saved, ended: r.ended, errors: r.errors.slice(0, 5) } });
    return ok(r);
  }
  const status = event === "live.started" ? "LIVE" : event === "live.scheduled" ? "SCHEDULED" : event === "live.ended" ? "ENDED" : event === "live.updated" ? undefined : null;
  if (status === null) return fail("알 수 없는 event 입니다. (live.started · live.updated · live.scheduled · live.ended · live.snapshot)");
  if (event === "live.ended") {
    const b = (json.broadcast ?? {}) as Record<string, unknown>;
    const id = typeof b.id === "string" ? b.id.trim() : "";
    if (!id) return fail("방송 id 가 없습니다.");
    const found = await prisma.externalBroadcast.findUnique({ where: { source_externalId: { source: "SELLERBRICKS", externalId: id } }, select: { id: true } });
    if (!found) return ok({ ended: 0 }); // 받은 적 없는 방송의 종료 — 무시
    await prisma.externalBroadcast.update({ where: { id: found.id }, data: { status: "ENDED", endsAt: new Date(), lastSyncedAt: new Date() } });
    return ok({ ended: 1 });
  }
  const r = await upsertSellerbricksLive({ ...(json.broadcast as object), ...(status ? { status: status.toLowerCase() } : {}) }, status ?? undefined);
  if (!r.ok) return fail(r.error);
  return ok({ id: r.row.id, status: r.row.status });
}
