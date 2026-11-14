export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { safeHttpUrl } from "@/lib/stream-embed";
import { isLivePlatform } from "@/lib/live-platforms";
import { allowedEmbed, isOnAir, sellerbricksFeedStatus, syncSellerbricksFeed } from "@/lib/external-broadcasts";

// 외부 방송 링크 관리 (최고관리자) — 메인 '라이브 커머스' 플레이어에 보일 방송
const httpUrl = (msg: string) => z.string().trim().max(500).refine((v) => !!safeHttpUrl(v), msg);
const optUrl = z.string().trim().max(500).nullish().transform((v) => v || null).refine((v) => v === null || !!safeHttpUrl(v) || (v.startsWith("/") && !v.startsWith("//")), "이미지 주소는 http(s) 주소나 /로 시작해야 합니다.");
const optDate = z.string().trim().max(40).nullish().transform((v, ctx) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) { ctx.addIssue({ code: "custom", message: "날짜 · 시간 형식을 확인하세요." }); return z.NEVER; }
  return d;
});
const fields = {
  title: z.string().trim().min(1, "방송 제목을 입력하세요.").max(120),
  sellerName: z.string().trim().max(60).default(""),
  platform: z.string().trim().refine(isLivePlatform, "방송 플랫폼을 고르세요."),
  url: httpUrl("시청 주소는 http(s) 주소여야 합니다."),
  embedUrl: z.string().trim().max(500).nullish().transform((v) => v || null),
  thumbnailUrl: optUrl,
  status: z.enum(["SCHEDULED", "LIVE", "ENDED"]).default("LIVE"),
  startsAt: optDate, endsAt: optDate,
  isVisible: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(-999).max(999).default(0),
};
const createSchema = z.object(fields).superRefine((d, ctx) => {
  if (d.embedUrl && !allowedEmbed(d.embedUrl)) ctx.addIssue({ code: "custom", path: ["embedUrl"], message: "끼워 넣기 주소는 허용된 호스트(https)만 쓸 수 있습니다. 유튜브는 시청 주소만 넣으면 바로 재생됩니다." });
  if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "종료 시각은 시작 시각보다 뒤여야 합니다." });
  if (d.status === "SCHEDULED" && !d.startsAt) ctx.addIssue({ code: "custom", path: ["startsAt"], message: "예정 방송은 시작 시각을 입력하세요. (시작 시각이 되면 자동으로 메인에 보입니다)" });
});
const patchSchema = z.object({ id: z.string().max(64), ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])) });

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const rows = await prisma.externalBroadcast.findMany({ orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }], take: 300 });
    const now = new Date();
    return ok({ rows: rows.map((r) => ({ ...r, onAir: isOnAir(r, now) })), feed: sellerbricksFeedStatus() });
  } catch (e) { return handleError(e); }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const raw = await req.json().catch(() => ({}));
    if (raw?.action === "sync-sellerbricks") {
      try {
        const r = await syncSellerbricksFeed();
        await audit({ actorId: admin.id, action: "SELLERBRICKS_SYNC", entity: "ExternalBroadcast", meta: r });
        return r.skipped ? fail(r.message, 409) : ok(r);
      } catch (e) { return fail(e instanceof Error ? `셀러브릭스 피드를 읽지 못했습니다. ${e.message}` : "셀러브릭스 피드를 읽지 못했습니다.", 502); }
    }
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값을 확인하세요.");
    const row = await prisma.externalBroadcast.create({ data: { ...parsed.data, source: "MANUAL", createdBy: admin.id } });
    await audit({ actorId: admin.id, action: "BROADCAST_CREATE", entity: "ExternalBroadcast", entityId: row.id, meta: { title: row.title, url: row.url } });
    return ok(row, 201);
  } catch (e) { return handleError(e); }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값을 확인하세요.");
    const { id, ...patch } = parsed.data as { id: string } & Record<string, unknown>;
    const found = await prisma.externalBroadcast.findUnique({ where: { id } });
    if (!found) return fail("방송을 찾지 못했습니다.", 404);
    // 셀러브릭스에서 받아 온 방송은 내용이 연동으로 덮어써지므로 메인 노출(숨김) · 순서만 바꾼다
    const editable = found.source === "SELLERBRICKS" ? ["isVisible", "sortOrder"] : Object.keys(fields);
    const data = Object.fromEntries(Object.entries(patch).filter(([k, v]) => v !== undefined && editable.includes(k)));
    if (!Object.keys(data).length) return fail(found.source === "SELLERBRICKS" ? "셀러브릭스 방송은 메인 노출과 순서만 바꿀 수 있습니다." : "바꿀 내용이 없습니다.");
    const merged = { ...found, ...data } as typeof found;
    const check = createSchema.safeParse({ ...merged, startsAt: merged.startsAt?.toISOString() ?? null, endsAt: merged.endsAt?.toISOString() ?? null });
    if (found.source === "MANUAL" && !check.success) return fail(check.error.issues[0]?.message ?? "입력값을 확인하세요.");
    if (data.status === "LIVE" && found.endsAt && found.endsAt <= new Date() && !("endsAt" in data)) data.endsAt = null; // 다시 켜면 지난 종료 시각은 지운다
    if (data.status === "ENDED" && !merged.endsAt) data.endsAt = new Date();
    const row = await prisma.externalBroadcast.update({ where: { id }, data });
    await audit({ actorId: admin.id, action: "BROADCAST_UPDATE", entity: "ExternalBroadcast", entityId: id, meta: { changed: Object.keys(data) } });
    return ok(row);
  } catch (e) { return handleError(e); }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const found = await prisma.externalBroadcast.findUnique({ where: { id }, select: { id: true, source: true, title: true } });
    if (!found) return fail("방송을 찾지 못했습니다.", 404);
    if (found.source === "SELLERBRICKS") return fail("셀러브릭스 방송은 지우지 않고 '메인에서 숨김'으로 관리합니다. (지워도 다음 연동 때 다시 들어옵니다)", 409);
    await prisma.externalBroadcast.delete({ where: { id } });
    await audit({ actorId: admin.id, action: "BROADCAST_DELETE", entity: "ExternalBroadcast", entityId: id, meta: { title: found.title } });
    return ok({ id });
  } catch (e) { return handleError(e); }
}
