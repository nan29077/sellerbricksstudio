import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";

// GET /api/facility/facilities
// FACILITY_ADMIN: 본인 소유 창고(스튜디오) 목록 반환
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  if (user.role !== "FACILITY_ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  try {
    let facilityIds: string[];
    if (user.role === "SUPER_ADMIN") {
      const all = await prisma.facility.findMany({ select: { id: true } });
      facilityIds = all.map((f) => f.id);
    } else {
      facilityIds = await ownedFacilityIds(user.id);
    }

    const facilities = await prisma.facility.findMany({
      where: { id: { in: facilityIds } },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        region: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ facilities });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const createSchema = z.object({
  name: z.string().trim().min(2, "창고(스튜디오) 이름을 2자 이상 입력하세요.").max(60),
  type: z.enum(["WAREHOUSE", "STUDIO"]),
  region: z.string().trim().min(2, "지역을 입력하세요.").max(40),
  address: z.string().trim().min(5, "주소를 입력하세요.").max(200),
  basePrice: z.coerce.number().optional(), // 이용료는 무료 — 입력값은 무시하고 0으로 저장
  openTime: z.string().regex(TIME, "운영 시작 시간을 확인하세요."),
  closeTime: z.string().regex(TIME, "운영 종료 시간을 확인하세요."),
  description: z.string().trim().max(2000).optional(),
  equipment: z.string().trim().max(500).optional(),
  specialty: z.string().trim().max(200).optional(),
  liveSpaceInfo: z.string().trim().max(1000).optional(),
}).refine((d) => d.closeTime > d.openTime, { message: "운영 종료 시간은 시작 시간보다 뒤여야 합니다.", path: ["closeTime"] });

// POST /api/facility/facilities
// FACILITY_ADMIN: 새 창고(스튜디오) 등록 신청 — 최고관리자 승인 전까지 PENDING 상태로 공개되지 않는다.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "로그인이 필요합니다" }, { status: 401 });
  if (user.role !== "FACILITY_ADMIN") return NextResponse.json({ ok: false, error: "창고(스튜디오) 관리자만 등록할 수 있습니다" }, { status: 403 });
  if (user.id.startsWith("demo-")) {
    return NextResponse.json({ ok: false, error: "데모 계정은 창고(스튜디오)를 등록할 수 없습니다. 회원가입 후 이용해 주세요." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." }, { status: 400 });
  }

  try {
    const pending = await prisma.facility.count({ where: { ownerId: user.id, status: "PENDING" } });
    if (pending >= 3) {
      return NextResponse.json({ ok: false, error: "승인 대기 중인 창고(스튜디오)가 3개 있습니다. 승인 후 추가로 등록해 주세요." }, { status: 429 });
    }
    const d = parsed.data;
    const facility = await prisma.facility.create({
      data: {
        ownerId: user.id, name: d.name, type: d.type, status: "PENDING",
        region: d.region, address: d.address, basePrice: 0,
        openTime: d.openTime, closeTime: d.closeTime,
        description: d.description || null, equipment: d.equipment || null,
        specialty: d.specialty || null, liveSpaceInfo: d.liveSpaceInfo || null,
      },
      select: { id: true, name: true, status: true },
    });
    await audit({ actorId: user.id, action: "FACILITY_CREATE", entity: "Facility", entityId: facility.id });
    return NextResponse.json({ ok: true, data: facility }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "등록 중 오류가 발생했습니다." }, { status: 500 });
  }
}
