export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { safeHttpUrl } from "@/lib/stream-embed";
import { isVideoShown, videoSourceOf } from "@/lib/home-videos";

// 메인 영상 플레이어 영상 관리 (최고관리자) — 라이브 커머스 탭에 넣을 영상 링크 (지난 라이브 · 숏폼 · 홍보 · 캠페인 · 행사)
const localPath = (v: string) => v.startsWith("/") && !v.startsWith("//");
const optDate = z.string().trim().max(40).nullish().transform((v, ctx) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) { ctx.addIssue({ code: "custom", message: "날짜 · 시간 형식을 확인하세요." }); return z.NEVER; }
  return d;
});
const fields = {
  category: z.enum(["LIVE_COMMERCE"], { errorMap: () => ({ message: "영상 탭은 라이브 커머스 하나입니다." }) }).default("LIVE_COMMERCE"),
  title: z.string().trim().min(1, "영상 제목을 입력하세요.").max(120),
  caption: z.string().trim().max(60).default(""),
  url: z.string().trim().max(500).refine((v) => !!videoSourceOf(v), "영상 주소는 http(s) 주소(유튜브 · 비메오 · mp4 등)이거나 /로 시작하는 사이트 안 영상 파일이어야 합니다."),
  thumbnailUrl: z.string().trim().max(500).nullish().transform((v) => v || null).refine((v) => v === null || !!safeHttpUrl(v) || localPath(v), "썸네일은 http(s) 주소나 /로 시작하는 이미지 주소여야 합니다."),
  duration: z.string().trim().max(10).regex(/^(\d{1,2}:)?\d{1,2}:\d{2}$|^$/, "길이는 0:30 · 12:05 · 1:02:30 처럼 적어 주세요.").default(""),
  isVisible: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(-999).max(999).default(0),
  startsAt: optDate, endsAt: optDate,
};
const checkPeriod = (d: { startsAt?: Date | null; endsAt?: Date | null }, ctx: z.RefinementCtx) => {
  if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "노출 종료는 노출 시작보다 뒤여야 합니다." });
};
const createSchema = z.object(fields).superRefine(checkPeriod);
const patchSchema = z.object({ id: z.string().max(64), ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])) });

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const rows = await prisma.homeVideo.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }], take: 300 });
    const now = new Date();
    return ok(rows.map((r) => ({ ...r, shown: isVideoShown(r, now), kind: videoSourceOf(r.url)?.kind ?? null })));
  } catch (e) { return handleError(e); }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값을 확인하세요.");
    const row = await prisma.homeVideo.create({ data: { ...parsed.data, createdBy: admin.id } });
    await audit({ actorId: admin.id, action: "HOME_VIDEO_CREATE", entity: "HomeVideo", entityId: row.id, meta: { category: row.category, title: row.title, url: row.url } });
    return ok(row, 201);
  } catch (e) { return handleError(e); }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값을 확인하세요.");
    const { id, ...patch } = parsed.data as { id: string } & Record<string, unknown>;
    const found = await prisma.homeVideo.findUnique({ where: { id } });
    if (!found) return fail("영상을 찾지 못했습니다.", 404);
    const data = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (!Object.keys(data).length) return fail("바꿀 내용이 없습니다.");
    const merged = { ...found, ...data } as typeof found;
    const check = createSchema.safeParse({ ...merged, startsAt: merged.startsAt?.toISOString() ?? null, endsAt: merged.endsAt?.toISOString() ?? null });
    if (!check.success) return fail(check.error.issues[0]?.message ?? "입력값을 확인하세요.");
    const row = await prisma.homeVideo.update({ where: { id }, data });
    await audit({ actorId: admin.id, action: "HOME_VIDEO_UPDATE", entity: "HomeVideo", entityId: id, meta: { changed: Object.keys(data) } });
    return ok(row);
  } catch (e) { return handleError(e); }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const found = await prisma.homeVideo.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!found) return fail("영상을 찾지 못했습니다.", 404);
    await prisma.homeVideo.delete({ where: { id } });
    await audit({ actorId: admin.id, action: "HOME_VIDEO_DELETE", entity: "HomeVideo", entityId: id, meta: { title: found.title } });
    return ok({ id });
  } catch (e) { return handleError(e); }
}
