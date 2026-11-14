import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/facility-owner";
import { addDays, dateKey, parseDateKey } from "@/lib/kst";
import { audit } from "@/lib/audit";

// POST: { facilityId, date, endDate?, reason? } — 기간을 주면 하루씩 휴무일 등록 (최대 62일)
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["SUPER_ADMIN", "MANAGER"]);
    const b = await req.json().catch(() => ({}));
    await assertFacilityAccess(user, String(b.facilityId ?? ""));
    const from = parseDateKey(b.date);
    const to = parseDateKey(b.endDate || b.date);
    if (!from || !to || to < from) return fail("날짜를 올바르게 선택하세요.");
    const days: Date[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
    if (days.length > 62) return fail("한 번에 62일까지 등록할 수 있습니다.");

    // 이미 승인된 예약과 겹치면 알려준다 (등록은 막지 않고 경고)
    const conflicts = await prisma.booking.count({
      where: { facilityId: b.facilityId, status: { in: ["APPROVED", "PENDING"] }, startAt: { lt: addDays(to, 1) }, endAt: { gt: from } },
    });
    const reason = String(b.reason ?? "").trim().slice(0, 100) || null;
    const r = await prisma.facilityBlackoutDate.createMany({
      data: days.map((date) => ({ facilityId: b.facilityId, date, reason })), skipDuplicates: true,
    });
    await audit({ actorId: user.id, action: "BLACKOUT_CREATE", entity: "Facility", entityId: b.facilityId, meta: { from: dateKey(from), to: dateKey(to) } });
    return ok({ created: r.count, conflicts }, 201);
  } catch (e) { return handleError(e); }
}

// DELETE ?id=
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireRole(["SUPER_ADMIN", "MANAGER"]);
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const row = await prisma.facilityBlackoutDate.findUnique({ where: { id } });
    if (!row) return fail("휴무일을 찾을 수 없습니다.", 404);
    await assertFacilityAccess(user, row.facilityId);
    await prisma.facilityBlackoutDate.delete({ where: { id } });
    return ok(true);
  } catch (e) { return handleError(e); }
}
