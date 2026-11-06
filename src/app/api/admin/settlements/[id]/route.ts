import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

const NEXT: Record<string, string[]> = { PENDING: ["CONFIRMED"], CONFIRMED: ["PAID", "PENDING"], PAID: [] };
const LABEL: Record<string, string> = { CONFIRMED: "지급 예정으로 확정", PAID: "지급 완료", PENDING: "정산 대기로 되돌림" };

// PATCH { status?, memo? }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const b = await req.json().catch(() => ({}));
    const s = await prisma.facilitySettlement.findUnique({ where: { id: params.id }, include: { facility: { select: { ownerId: true, name: true, bankAccount: true } } } });
    if (!s) return fail("정산서를 찾을 수 없습니다.", 404);
    const data: Record<string, unknown> = {};
    if (typeof b.memo === "string") data.memo = b.memo.slice(0, 500) || null;
    if (b.status) {
      if (!(NEXT[s.status] ?? []).includes(b.status)) return fail("현재 상태에서는 변경할 수 없습니다.", 409);
      if (b.status === "PAID" && !s.facility.bankAccount) return fail("정산 계좌가 등록되지 않은 창고(스튜디오)입니다.");
      data.status = b.status;
      if (b.status === "CONFIRMED") data.confirmedAt = new Date();
      if (b.status === "PAID") data.paidAt = new Date();
      if (b.status === "PENDING") data.confirmedAt = null;
    }
    const updated = await prisma.facilitySettlement.update({ where: { id: s.id }, data });
    await audit({ actorId: admin.id, action: b.status ? `SETTLEMENT_${b.status}` : "SETTLEMENT_MEMO", entity: "FacilitySettlement", entityId: s.id });
    if (b.status && b.status !== "PENDING") {
      await notify({ userId: s.facility.ownerId, type: "SETTLEMENT", title: `정산이 ${LABEL[b.status]}되었습니다`, body: `${s.facility.name} · ${s.payoutAmount.toLocaleString()}원`, link: "/facility/settlements" });
    }
    return ok(updated);
  } catch (e) { return handleError(e); }
}

// DELETE — 정산 대기 상태만 삭제 가능 (예약은 다시 미정산으로)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const s = await prisma.facilitySettlement.findUnique({ where: { id: params.id } });
    if (!s) return fail("정산서를 찾을 수 없습니다.", 404);
    if (s.status !== "PENDING") return fail("정산 대기 상태만 삭제할 수 있습니다.", 409);
    await prisma.$transaction([
      prisma.booking.updateMany({ where: { facilitySettlementId: s.id }, data: { facilitySettlementId: null } }),
      prisma.facilitySettlement.delete({ where: { id: s.id } }),
    ]);
    await audit({ actorId: admin.id, action: "SETTLEMENT_DELETE", entity: "FacilitySettlement", entityId: s.id });
    return ok(true);
  } catch (e) { return handleError(e); }
}
