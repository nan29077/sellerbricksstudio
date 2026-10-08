import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// PATCH /api/facility/profile
// FACILITY_ADMIN이 자신의 시설 정보(전문분야, 라이브공간 안내, 설명 등)를 수정
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  if (user.role !== "FACILITY_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  try {
    const { facilityId, specialty, liveSpaceInfo, description } = await req.json();
    if (!facilityId) {
      return NextResponse.json({ error: "facilityId가 필요합니다" }, { status: 400 });
    }

    // 본인 소유 시설 확인
    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      select: { id: true, ownerId: true },
    });
    if (!facility) {
      return NextResponse.json({ error: "시설을 찾을 수 없습니다" }, { status: 404 });
    }
    if (facility.ownerId !== user.id) {
      return NextResponse.json({ error: "본인 소유 시설만 수정할 수 있습니다" }, { status: 403 });
    }

    const updateData: any = {};
    if (specialty !== undefined) updateData.specialty = specialty;
    if (liveSpaceInfo !== undefined) updateData.liveSpaceInfo = liveSpaceInfo;
    if (description !== undefined) updateData.description = description;

    const updated = await prisma.facility.update({
      where: { id: facilityId },
      data: updateData,
      select: {
        id: true,
        name: true,
        specialty: true,
        liveSpaceInfo: true,
        description: true,
      },
    });

    return NextResponse.json({ facility: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
