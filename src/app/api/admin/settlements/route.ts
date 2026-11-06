import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { getPlatformFeeRate, splitFee } from "@/lib/booking";
import { addDays, parseDateKey } from "@/lib/kst";

// POST { from, to (YYYY-MM-DD), facilityIds? } — 기간 내 이용 완료 · 미정산 예약을 창고(스튜디오)별 정산서로 묶는다.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const b = await req.json().catch(() => ({}));
    const from = parseDateKey(b.from), to = parseDateKey(b.to);
    if (!from || !to || to < from) return fail("정산 기간을 올바르게 선택하세요.");
    const end = addDays(to, 1);
    const bookings = await prisma.booking.findMany({
      where: {
        status: "COMPLETED", facilitySettlementId: null, startAt: { gte: from, lt: end },
        ...(Array.isArray(b.facilityIds) && b.facilityIds.length && { facilityId: { in: b.facilityIds.map(String) } }),
      },
      select: { id: true, facilityId: true, totalPrice: true },
    });
    if (bookings.length === 0) return fail("해당 기간에 정산할 이용 완료 예약이 없습니다.", 404);

    const byFacility = new Map<string, typeof bookings>();
    for (const bk of bookings) byFacility.set(bk.facilityId, [...(byFacility.get(bk.facilityId) ?? []), bk]);

    const created: string[] = [];
    for (const [facilityId, list] of Array.from(byFacility.entries())) {
      const gross = list.reduce((s, x) => s + x.totalPrice, 0);
      const feeRate = await getPlatformFeeRate(facilityId);
      const { platformFee, payoutAmount } = splitFee(gross, feeRate);
      const st = await prisma.$transaction(async (tx) => {
        const s = await tx.facilitySettlement.create({
          data: { facilityId, periodStart: from, periodEnd: to, bookingCount: list.length, grossAmount: gross, feeRate, platformFee, payoutAmount },
        });
        await tx.booking.updateMany({ where: { id: { in: list.map((x) => x.id) }, facilitySettlementId: null }, data: { facilitySettlementId: s.id } });
        return s;
      });
      created.push(st.id);
      const f = await prisma.facility.findUnique({ where: { id: facilityId }, select: { ownerId: true, name: true } });
      if (f) await notify({ userId: f.ownerId, type: "SETTLEMENT", title: "정산서가 생성되었습니다", body: `${f.name} · ${list.length}건 · 지급 예정액 ${payoutAmount.toLocaleString()}원`, link: "/facility/settlements" });
    }
    await audit({ actorId: admin.id, action: "SETTLEMENT_GENERATE", entity: "FacilitySettlement", meta: { from: b.from, to: b.to, count: created.length } });
    return ok({ created: created.length, bookings: bookings.length }, 201);
  } catch (e) { return handleError(e); }
}
