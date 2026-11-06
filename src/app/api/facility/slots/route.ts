import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { assertFacilityAccess } from "@/lib/facility-owner";
import { audit } from "@/lib/audit";

const T = /^([01]\d|2[0-4]):[0-5]\d$/;

// POST: { facilityId, weekdays: number[], startTime, endTime } — 여러 요일에 같은 운영 시간대 추가
// POST: { facilityId, preset: "weekday"|"everyday", startTime, endTime, replace: true } — 기존 슬롯 교체
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["FACILITY_ADMIN", "SUPER_ADMIN"]);
    const b = await req.json().catch(() => ({}));
    await assertFacilityAccess(user, String(b.facilityId ?? ""));
    const days: number[] = b.preset === "weekday" ? [1, 2, 3, 4, 5] : b.preset === "everyday" ? [0, 1, 2, 3, 4, 5, 6]
      : Array.isArray(b.weekdays) ? b.weekdays.map(Number).filter((d: number) => d >= 0 && d <= 6) : [Number(b.weekday)].filter((d) => d >= 0 && d <= 6);
    if (!days.length) return fail("요일을 선택하세요.");
    if (!T.test(b.startTime ?? "") || !T.test(b.endTime ?? "") || b.startTime >= b.endTime) return fail("시간대를 올바르게 입력하세요. (시작 < 종료)");

    if (b.replace) await prisma.facilityAvailableSlot.deleteMany({ where: { facilityId: b.facilityId, weekday: { in: days } } });
    const existing = await prisma.facilityAvailableSlot.findMany({ where: { facilityId: b.facilityId, weekday: { in: days } } });
    const toCreate = days.filter((d) => !existing.some((e) => e.weekday === d && e.startTime < b.endTime && e.endTime > b.startTime));
    if (!toCreate.length) return fail("선택한 요일에 겹치는 시간대가 이미 있습니다.", 409);
    await prisma.facilityAvailableSlot.createMany({ data: toCreate.map((weekday) => ({ facilityId: b.facilityId, weekday, startTime: b.startTime, endTime: b.endTime })) });
    await audit({ actorId: user.id, action: "SLOT_CREATE", entity: "Facility", entityId: b.facilityId, meta: { days: toCreate, start: b.startTime, end: b.endTime } });
    return ok({ created: toCreate.length, skipped: days.length - toCreate.length }, 201);
  } catch (e) { return handleError(e); }
}

// PATCH: { id, isActive }
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole(["FACILITY_ADMIN", "SUPER_ADMIN"]);
    const { id, isActive } = await req.json().catch(() => ({}));
    const slot = await prisma.facilityAvailableSlot.findUnique({ where: { id: String(id) } });
    if (!slot) return fail("시간대를 찾을 수 없습니다.", 404);
    await assertFacilityAccess(user, slot.facilityId);
    return ok(await prisma.facilityAvailableSlot.update({ where: { id: slot.id }, data: { isActive: !!isActive } }));
  } catch (e) { return handleError(e); }
}

// DELETE ?id=
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireRole(["FACILITY_ADMIN", "SUPER_ADMIN"]);
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const slot = await prisma.facilityAvailableSlot.findUnique({ where: { id } });
    if (!slot) return fail("시간대를 찾을 수 없습니다.", 404);
    await assertFacilityAccess(user, slot.facilityId);
    await prisma.facilityAvailableSlot.delete({ where: { id } });
    return ok(true);
  } catch (e) { return handleError(e); }
}
