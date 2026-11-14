export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { safeHttpUrl } from "@/lib/stream-embed";
import { videoSourceOf } from "@/lib/home-videos";
import { brandShopWhere } from "@/lib/brand-access";

// 브랜드샵 라이브 커머스 영상 (브랜드 계정 · 최고관리자) — 그 브랜드샵 화면의 PC 왼쪽 플레이어에 나온다 (2026-11-14)
const MAX_VIDEOS = 30;
const localPath = (v: string) => v.startsWith("/") && !v.startsWith("//");
const fields = {
  title: z.string().trim().min(1, "영상 제목을 입력하세요.").max(120),
  caption: z.string().trim().max(60).default(""),
  url: z.string().trim().max(500).refine((v) => !!videoSourceOf(v) && !localPath(v), "영상 주소는 http(s) 주소(유튜브 · 비메오 · mp4 · 라이브 커머스 다시보기 등)여야 합니다."),
  thumbnailUrl: z.string().trim().max(500).nullish().transform((v) => v || null).refine((v) => v === null || !!safeHttpUrl(v) || localPath(v), "썸네일은 http(s) 주소나 업로드한 이미지 주소여야 합니다."),
  duration: z.string().trim().max(10).regex(/^(\d{1,2}:)?\d{1,2}:\d{2}$|^$/, "길이는 0:30 · 12:05 · 1:02:30 처럼 적어 주세요.").default(""),
  isVisible: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(-999).max(999).default(0),
};
const createSchema = z.object({ shopId: z.string().max(64).optional(), ...fields });
const patchSchema = z.object({ id: z.string().max(64), ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])) });

async function scope(shopId?: string | null) {
  const user = await requireRole(["BRAND_ADMIN", "SUPER_ADMIN"]);
  const admin = user.role === "SUPER_ADMIN";
  const shop = admin
    ? (shopId ? await prisma.brandShop.findUnique({ where: { id: shopId }, select: { id: true } }) : null)
    : await prisma.brandShop.findFirst({ where: { ...brandShopWhere(user.id), ...(shopId && { id: shopId }) }, select: { id: true } });
  return { user, shopId: shop?.id ?? null };
}

export async function GET(req: Request) {
  try {
    const { shopId } = await scope(new URL(req.url).searchParams.get("shopId"));
    if (!shopId) return fail("브랜드샵을 먼저 만들어 주세요.", 404);
    const rows = await prisma.brandShopVideo.findMany({ where: { shopId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
    return ok(rows.map((r) => ({ ...r, kind: videoSourceOf(r.url)?.kind ?? null })));
  } catch (e) { return handleError(e); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값을 확인하세요.");
    const { user, shopId } = await scope(parsed.data.shopId);
    if (!shopId) return fail("브랜드샵을 먼저 만들어 주세요.", 404);
    if (await prisma.brandShopVideo.count({ where: { shopId } }) >= MAX_VIDEOS) return fail(`영상은 ${MAX_VIDEOS}개까지 넣을 수 있습니다. 오래된 영상을 지워 주세요.`);
    const { shopId: _ignored, ...data } = parsed.data;
    void _ignored;
    const row = await prisma.brandShopVideo.create({ data: { ...data, shopId, createdBy: user.id } });
    await audit({ actorId: user.id, action: "BRAND_VIDEO_CREATE", entity: "BrandShopVideo", entityId: row.id, meta: { shopId, title: row.title, url: row.url } });
    return ok(row, 201);
  } catch (e) { return handleError(e); }
}

export async function PATCH(req: Request) {
  try {
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값을 확인하세요.");
    const { id, ...patch } = parsed.data as { id: string } & Record<string, unknown>;
    const row = await prisma.brandShopVideo.findUnique({ where: { id }, select: { shopId: true } });
    const { user, shopId } = await scope(row?.shopId);
    if (!row || row.shopId !== shopId) return fail("영상을 찾지 못했습니다.", 404);
    const saved = await prisma.brandShopVideo.update({ where: { id }, data: Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) });
    await audit({ actorId: user.id, action: "BRAND_VIDEO_UPDATE", entity: "BrandShopVideo", entityId: id });
    return ok(saved);
  } catch (e) { return handleError(e); }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const row = await prisma.brandShopVideo.findUnique({ where: { id }, select: { shopId: true } });
    const { user, shopId } = await scope(row?.shopId);
    if (!row || row.shopId !== shopId) return fail("영상을 찾지 못했습니다.", 404);
    await prisma.brandShopVideo.delete({ where: { id } });
    await audit({ actorId: user.id, action: "BRAND_VIDEO_DELETE", entity: "BrandShopVideo", entityId: id });
    return ok({ id });
  } catch (e) { return handleError(e); }
}
