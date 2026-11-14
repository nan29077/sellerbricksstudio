import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { parseKST } from "@/lib/utils";
import { audit } from "@/lib/audit";

// POST /api/bookings/waitlist { facilityId, startAt, endAt, note? } — 이미 찬 시간대 대기 신청
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["SELLER"]);
    const body = await req.json().catch(() => ({}));
    if (typeof body.facilityId !== "string" || typeof body.startAt !== "string" || typeof body.endAt !== "string") return fail("대기할 시간을 선택하세요.");
    const startAt = parseKST(body.startAt), endAt = parseKST(body.endAt);
    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || endAt <= startAt) return fail("시간이 올바르지 않습니다.");
    if (startAt < new Date()) return fail("지난 시간은 대기 신청할 수 없습니다.");
    const f = await prisma.facility.findUnique({ where: { id: body.facilityId }, select: { id: true, status: true } });
    if (!f || f.status !== "APPROVED") return fail("공간을 찾을 수 없습니다.", 404);
    const dup = await prisma.bookingWaitlist.findFirst({ where: { sellerId: user.id, facilityId: f.id, status: "WAITING", startAt, endAt } });
    if (dup) return fail("이미 대기 신청한 시간입니다.", 409);
    const active = await prisma.bookingWaitlist.count({ where: { sellerId: user.id, status: "WAITING" } });
    if (active >= 20) return fail("대기 신청은 최대 20건까지 가능합니다.");
    const row = await prisma.bookingWaitlist.create({
      data: { facilityId: f.id, sellerId: user.id, startAt, endAt, note: typeof body.note === "string" ? body.note.slice(0, 200) : null },
    });
    await audit({ actorId: user.id, action: "WAITLIST_CREATE", entity: "BookingWaitlist", entityId: row.id });
    return ok(row, 201);
  } catch (e) { return handleError(e); }
}

// DELETE /api/bookings/waitlist?id=... — 대기 취소
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireRole(["SELLER"]);
    const id = req.nextUrl.searchParams.get("id");
    const row = id ? await prisma.bookingWaitlist.findUnique({ where: { id } }) : null;
    if (!row || row.sellerId !== user.id) return fail("대기 신청을 찾을 수 없습니다.", 404);
    await prisma.bookingWaitlist.update({ where: { id: row.id }, data: { status: "CANCELLED" } });
    return ok({ cancelled: true });
  } catch (e) { return handleError(e); }
}
