import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/facility-owner";
import { parseKST } from "@/lib/utils";
import { audit } from "@/lib/audit";

// POST { facilityId, date: "YYYY-MM-DD", start: "HH:mm", end: "HH:mm", reason?, repeatWeeks? } — 하루 중 일부 시간 예약 막기
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["FACILITY_ADMIN", "SUPER_ADMIN"]);
    const b = await req.json().catch(() => ({}));
    await assertFacilityAccess(user, String(b.facilityId ?? ""));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date ?? "")) || !/^\d{2}:\d{2}$/.test(String(b.start ?? "")) || !/^(\d{2}:\d{2}|24:00)$/.test(String(b.end ?? ""))) {
      return fail("날짜와 시간을 올바르게 입력하세요.");
    }
    const startAt = parseKST(`${b.date}T${b.start}`);
    const endAt = b.end === "24:00" ? new Date(parseKST(`${b.date}T00:00`).getTime() + 86400000) : parseKST(`${b.date}T${b.end}`);
    if (!(endAt > startAt)) return fail("종료 시간은 시작 시간보다 뒤여야 합니다.");
    const weeks = Math.max(1, Math.min(12, Math.round(Number(b.repeatWeeks) || 1)));
    const reason = String(b.reason ?? "").trim().slice(0, 100) || null;
    const rows = Array.from({ length: weeks }, (_, i) => ({
      facilityId: String(b.facilityId), startAt: new Date(startAt.getTime() + i * 7 * 86400000), endAt: new Date(endAt.getTime() + i * 7 * 86400000), reason,
    }));
    // 이미 잡힌 예약과 겹치면 알려준다 (등록은 하되 경고)
    const conflicts = await prisma.booking.count({
      where: { facilityId: String(b.facilityId), status: { in: ["APPROVED", "PENDING"] }, OR: rows.map((r) => ({ startAt: { lt: r.endAt }, endAt: { gt: r.startAt } })) },
    });
    const r = await prisma.facilityTimeBlock.createMany({ data: rows });
    await audit({ actorId: user.id, action: "TIME_BLOCK_CREATE", entity: "Facility", entityId: String(b.facilityId), meta: { date: b.date, start: b.start, end: b.end, weeks } });
    return ok({ created: r.count, conflicts }, 201);
  } catch (e) { return handleError(e); }
}

// DELETE ?id=
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireRole(["FACILITY_ADMIN", "SUPER_ADMIN"]);
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const row = await prisma.facilityTimeBlock.findUnique({ where: { id } });
    if (!row) return fail("차단 시간을 찾을 수 없습니다.", 404);
    await assertFacilityAccess(user, row.facilityId);
    await prisma.facilityTimeBlock.delete({ where: { id } });
    await audit({ actorId: user.id, action: "TIME_BLOCK_DELETE", entity: "Facility", entityId: row.facilityId });
    return ok(true);
  } catch (e) { return handleError(e); }
}
