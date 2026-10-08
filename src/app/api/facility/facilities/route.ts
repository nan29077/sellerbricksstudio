import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ownedFacilityIds } from "@/lib/rbac";

// GET /api/facility/facilities
// FACILITY_ADMIN: 본인 소유 시설 목록 반환
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
