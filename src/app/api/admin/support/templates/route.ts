export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleError, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { isSupportCategory } from "@/lib/support";

// 운영팀 답변 템플릿 (최고관리자) — 문의 답변 작성 칸에서 골라 넣는다
const fields = {
  title: z.string().trim().min(1, "템플릿 이름을 입력하세요.").max(60),
  body: z.string().trim().min(2, "답변 내용을 입력하세요.").max(3000),
  category: z.string().nullish().transform((v) => (isSupportCategory(v) ? v : null)),
};
export async function GET() {
  try { await requireRole(["SUPER_ADMIN"]); return ok(await prisma.supportTemplate.findMany({ orderBy: [{ category: "asc" }, { title: "asc" }], take: 200 })); }
  catch (e) { return handleError(e); }
}
export async function POST(req: Request) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const p = z.object(fields).safeParse(await req.json().catch(() => ({})));
    if (!p.success) return fail(p.error.issues[0]?.message ?? "입력값을 확인하세요.");
    return ok(await prisma.supportTemplate.create({ data: { ...p.data, createdBy: admin.id } }), 201);
  } catch (e) { return handleError(e); }
}
export async function DELETE(req: Request) {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const r = await prisma.supportTemplate.deleteMany({ where: { id } });
    return r.count ? ok({ id }) : fail("템플릿을 찾지 못했습니다.", 404);
  } catch (e) { return handleError(e); }
}
