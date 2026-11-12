export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

// 사이트 공지 관리 (최고관리자). 예전에는 관리자 브라우저(localStorage)에만 저장돼 다른 사용자에게 보이지 않았다.
const link = z.string().trim().max(300).refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//")) || /^https?:\/\//.test(v), "링크는 /로 시작하거나 http(s) 주소여야 합니다.");
const fields = {
  title: z.string().trim().min(1, "제목을 입력하세요.").max(120),
  body: z.string().max(5000).default(""),
  link: link.default(""),
  pinned: z.boolean().default(false),
  isPublished: z.boolean().default(true),
};
const createSchema = z.object(fields);
const updateSchema = z.object({ id: z.string().max(64), ...fields }).partial().required({ id: true });
const importSchema = z.object({ import: z.array(z.object({ title: fields.title, body: fields.body, pinned: fields.pinned })).max(100) });

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const rows = await prisma.siteNotice.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 200 });
    return ok(rows);
  } catch (e) { return handleError(e); }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const raw = await req.json().catch(() => ({}));
    // 브라우저에 남아 있던 예전 공지를 한 번에 옮긴다
    if (raw && Array.isArray(raw.import)) {
      const { import: items } = importSchema.parse(raw);
      if (items.length) await prisma.siteNotice.createMany({ data: items.map((n) => ({ ...n, createdBy: admin.id })) });
      await audit({ actorId: admin.id, action: "NOTICE_IMPORT", entity: "SiteNotice", meta: { count: items.length } });
      return ok({ imported: items.length });
    }
    const data = createSchema.parse(raw);
    const row = await prisma.siteNotice.create({ data: { ...data, createdBy: admin.id } });
    await audit({ actorId: admin.id, action: "NOTICE_CREATE", entity: "SiteNotice", entityId: row.id });
    return ok(row, 201);
  } catch (e) { return handleError(e); }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const { id, ...data } = updateSchema.parse(await req.json().catch(() => ({})));
    const found = await prisma.siteNotice.findUnique({ where: { id }, select: { id: true } });
    if (!found) return fail("공지를 찾지 못했습니다.", 404);
    const row = await prisma.siteNotice.update({ where: { id }, data });
    await audit({ actorId: admin.id, action: "NOTICE_UPDATE", entity: "SiteNotice", entityId: id });
    return ok(row);
  } catch (e) { return handleError(e); }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const removed = await prisma.siteNotice.deleteMany({ where: { id } });
    if (!removed.count) return fail("공지를 찾지 못했습니다.", 404);
    await audit({ actorId: admin.id, action: "NOTICE_DELETE", entity: "SiteNotice", entityId: id });
    return ok({ id });
  } catch (e) { return handleError(e); }
}
