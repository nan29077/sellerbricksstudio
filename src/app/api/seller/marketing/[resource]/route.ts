import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { MARKETING_RESOURCES, isMarketingResource } from "@/lib/marketing-resources";
import { notifyAdmins } from "@/lib/notify";
import { ZodError } from "zod";

function zodMessage(e: unknown) {
  return e instanceof ZodError ? e.issues[0]?.message ?? "입력값을 확인하세요." : null;
}

export async function GET(_req: NextRequest, { params }: { params: { resource: string } }) {
  try {
    const user = await requireRole(["SELLER"]);
    if (!isMarketingResource(params.resource)) return fail("알 수 없는 항목입니다.", 404);
    const cfg = MARKETING_RESOURCES[params.resource];
    const rows = await (prisma as any)[cfg.model].findMany({ where: { sellerId: user.id }, orderBy: cfg.orderBy, take: 500 });
    return ok(rows);
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest, { params }: { params: { resource: string } }) {
  try {
    const user = await requireRole(["SELLER"]);
    if (!isMarketingResource(params.resource)) return fail("알 수 없는 항목입니다.", 404);
    const cfg = MARKETING_RESOURCES[params.resource];
    let data: any;
    try { data = cfg.schema.parse(await req.json()); } catch (e) { return fail(zodMessage(e) ?? "입력값을 확인하세요."); }
    if (params.resource === "sns-accounts") {
      const dup = await prisma.snsAccount.findFirst({ where: { sellerId: user.id, platform: data.platform, handle: data.handle } });
      if (dup) return fail("이미 등록한 계정입니다.", 409);
    }
    const row = await (prisma as any)[cfg.model].create({ data: { ...data, sellerId: user.id } });
    if (params.resource === "applications") {
      await notifyAdmins({ type: "MARKETING", title: "새 마케팅 지원 신청", body: `${user.name ?? user.email} · ${data.title}`, link: "/admin/marketing" });
    }
    return ok(row, 201);
  } catch (e) { return handleError(e); }
}
