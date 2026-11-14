import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isFacilityOperatorRole, operableFacilityIds, primaryAdminId } from "@/lib/facility-owner";

// GET /api/facility/facilities
// 창고 운영자: 운영할 수 있는 창고(스튜디오) 목록 (최고관리자 전체 · 매니저 담당 창고)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  if (!isFacilityOperatorRole(user.role)) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });

  try {
    const facilityIds = await operableFacilityIds(user);
    const facilities = await prisma.facility.findMany({
      where: { id: { in: facilityIds } },
      select: { id: true, name: true, type: true, status: true, region: true, operationType: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ facilities });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const opt = (max: number) => z.string().trim().max(max).optional();
const createSchema = z.object({
  name: z.string().trim().min(2, "창고(스튜디오) 이름을 2자 이상 입력하세요.").max(60),
  type: z.enum(["WAREHOUSE", "STUDIO", "SHOWROOM"]),
  region: z.string().trim().min(2, "지역을 입력하세요.").max(40),
  address: z.string().trim().min(5, "주소를 입력하세요.").max(200),
  basePrice: z.coerce.number().optional(), // 이용료는 무료 — 입력값은 무시하고 0으로 저장
  openTime: z.string().regex(TIME, "운영 시작 시간을 확인하세요."),
  closeTime: z.string().regex(TIME, "운영 종료 시간을 확인하세요."),
  description: opt(2000),
  equipment: opt(500),
  specialty: opt(200),
  liveSpaceInfo: opt(1000),
  operationType: z.enum(["DIRECT", "PARTNER"]).default("DIRECT"),
  publish: z.boolean().optional(), // true: 바로 공개 · false: 비공개(준비 중)
  partnerName: opt(60),
  partnerContactName: opt(40),
  partnerContactPhone: opt(30),
  partnerContactEmail: z.union([z.literal(""), z.string().trim().email("담당자 메일 형식을 확인하세요.").max(120)]).optional(),
}).refine((d) => d.closeTime > d.openTime, { message: "운영 종료 시간은 시작 시간보다 뒤여야 합니다.", path: ["closeTime"] });

// POST /api/facility/facilities
// 최고관리자: 창고(스튜디오) 등록. 외부 업체의 가입 · 등록 신청은 없다 — 본사 직영 또는 제휴 창고를 본사가 직접 등록한다.
// ownerId 는 본사 운영 계정(가장 먼저 만든 최고관리자) — 브랜드 거래의 주체로 쓴다.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "로그인이 필요합니다" }, { status: 401 });
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ ok: false, error: "창고(스튜디오)는 최고관리자만 등록할 수 있습니다" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." }, { status: 400 });
  }

  try {
    const d = parsed.data;
    const ownerId = user.id.startsWith("demo-") ? await primaryAdminId() : (await primaryAdminId()) ?? user.id;
    if (!ownerId) return NextResponse.json({ ok: false, error: "본사 운영 계정(최고관리자)을 찾을 수 없습니다." }, { status: 400 });
    const partner = d.operationType === "PARTNER";
    const facility = await prisma.facility.create({
      data: {
        ownerId, name: d.name, type: d.type, status: d.publish ? "APPROVED" : "PENDING",
        region: d.region, address: d.address, basePrice: 0,
        openTime: d.openTime, closeTime: d.closeTime,
        description: d.description || null, equipment: d.equipment || null,
        specialty: d.specialty || null, liveSpaceInfo: d.liveSpaceInfo || null,
        operationType: d.operationType,
        partnerName: partner ? d.partnerName || null : null,
        partnerContactName: partner ? d.partnerContactName || null : null,
        partnerContactPhone: partner ? d.partnerContactPhone || null : null,
        partnerContactEmail: partner ? d.partnerContactEmail || null : null,
      },
      select: { id: true, name: true, status: true },
    });
    await audit({ actorId: user.id.startsWith("demo-") ? undefined : user.id, action: "FACILITY_CREATE", entity: "Facility", entityId: facility.id, meta: { operationType: d.operationType, status: facility.status } });
    return NextResponse.json({ ok: true, data: facility }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "등록 중 오류가 발생했습니다." }, { status: 500 });
  }
}
