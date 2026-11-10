import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";

const time = z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/, "시간은 HH:MM 형식입니다.");
const opt = (max = 300) => z.string().trim().max(max).optional().nullable().transform((v) => (v === undefined ? undefined : v || null));
const schema = z.object({
  facilityId: z.string().min(1),
  specialty: opt(300), liveSpaceInfo: opt(3000), description: opt(5000), equipment: opt(1000),
  address: z.string().trim().min(1).max(300).optional(), region: z.string().trim().min(1).max(40).optional(),
  openTime: time.optional(), closeTime: time.optional(),
  minHours: z.coerce.number().int().min(1).max(24).optional(),
  // 예약 정책
  bookingUnitMinutes: z.coerce.number().int().refine((v) => v === 30 || v === 60, "예약 단위는 30분 또는 60분입니다.").optional(),
  bufferMinutes: z.coerce.number().int().min(0).max(240).optional(),
  minLeadHours: z.coerce.number().int().min(0).max(336).optional(),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365).optional(),
  maxHours: z.coerce.number().int().min(1).max(24).optional(),
  autoApprove: z.union([z.boolean(), z.enum(["true", "false"])]).optional().transform((v) => (v === undefined ? undefined : v === true || v === "true")),
  cancelDeadlineHours: z.coerce.number().int().min(0).max(336).optional(),
  bookingNotice: opt(2000),
  capacity: z.union([z.literal(""), z.null(), z.coerce.number().int().min(1).max(10000)]).optional().transform((v) => (v === "" ? null : v)),
  contactPhone: opt(30), cancelPolicy: opt(2000), thumbnailUrl: opt(1000),
  bankName: opt(40), bankAccount: opt(40), accountHolder: opt(40),
});

// PATCH /api/facility/profile — 창고(스튜디오) 관리자가 본인 창고(스튜디오)의 소개·운영·정산 정보를 수정
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole(["FACILITY_ADMIN", "SUPER_ADMIN"]);
    let data: z.infer<typeof schema>;
    try { data = schema.parse(await req.json()); }
    catch (e) { return fail(e instanceof ZodError ? e.issues[0]?.message ?? "입력값을 확인하세요." : "입력값을 확인하세요."); }

    const facility = await prisma.facility.findUnique({ where: { id: data.facilityId }, select: { id: true, ownerId: true } });
    if (!facility) return fail("창고(스튜디오)를 찾을 수 없습니다.", 404);
    if (user.role !== "SUPER_ADMIN" && facility.ownerId !== user.id) return fail("본인 소유 창고(스튜디오)만 수정할 수 있습니다.", 403);
    if (data.openTime && data.closeTime && data.openTime >= data.closeTime) return fail("마감 시간은 오픈 시간보다 뒤여야 합니다.");
    if (data.minHours && data.maxHours && data.maxHours < data.minHours) return fail("최대 이용 시간은 최소 예약 시간보다 길어야 합니다.");

    const { facilityId, ...rest } = data;
    const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    const updated = await prisma.facility.update({ where: { id: facilityId }, data: patch });
    await audit({ actorId: user.id, action: "FACILITY_PROFILE_UPDATE", entity: "Facility", entityId: facilityId, meta: { fields: Object.keys(patch) } });
    return ok({ facility: updated });
  } catch (e) { return handleError(e); }
}
