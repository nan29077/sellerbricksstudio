import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { MARKETING_RESOURCES, isMarketingResource } from "@/lib/marketing-resources";
import { ZodError } from "zod";

async function own(resource: string, id: string, sellerId: string) {
  if (!isMarketingResource(resource)) return null;
  const cfg = MARKETING_RESOURCES[resource];
  const row = await (prisma as any)[cfg.model].findUnique({ where: { id } });
  return row && row.sellerId === sellerId ? { cfg, row } : null;
}

// 부분 수정 허용: 보낸 필드만 검증 후 반영
export async function PATCH(req: NextRequest, { params }: { params: { resource: string; id: string } }) {
  try {
    const user = await requireRole(["SELLER"]);
    const found = await own(params.resource, params.id, user.id);
    if (!found) return fail("항목을 찾을 수 없습니다.", 404);
    if (params.resource === "applications" && found.row.status !== "PENDING") return fail("검토가 시작된 신청은 수정할 수 없습니다.", 409);
    const body = await req.json().catch(() => ({}));
    const base: any = (found.cfg.schema as any)._def?.schema ?? found.cfg.schema; // refine 래핑 해제
    const merged = { ...serialize(found.row), ...body };
    let data: any;
    try { data = found.cfg.schema.parse(merged); }
    catch (e) { return fail(e instanceof ZodError ? e.issues[0]?.message ?? "입력값을 확인하세요." : "입력값을 확인하세요."); }
    const keys = Object.keys(base.shape ?? data);
    const patch = Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]]));
    const row = await (prisma as any)[found.cfg.model].update({ where: { id: params.id }, data: patch });
    return ok(row);
  } catch (e) { return handleError(e); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { resource: string; id: string } }) {
  try {
    const user = await requireRole(["SELLER"]);
    const found = await own(params.resource, params.id, user.id);
    if (!found) return fail("항목을 찾을 수 없습니다.", 404);
    if (params.resource === "applications" && !["PENDING", "REJECTED"].includes(found.row.status)) return fail("진행 중인 신청은 삭제할 수 없습니다.", 409);
    await (prisma as any)[found.cfg.model].delete({ where: { id: params.id } });
    return ok(true);
  } catch (e) { return handleError(e); }
}

// DB 행을 스키마 입력 형태(문자열 날짜 등)로 변환
function serialize(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) {
      const kst = new Date(v.getTime() + 9 * 3600000).toISOString().slice(0, 16);
      out[k] = kst;
    } else out[k] = v;
  }
  return out;
}
