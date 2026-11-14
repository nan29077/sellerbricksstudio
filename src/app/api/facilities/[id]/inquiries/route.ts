import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

import { canOperateFacility, notifyFacility } from "@/lib/facility-owner";

// GET /api/facilities/[id]/inquiries
// - SELLER: 본인 문의 목록
// - 창고 운영자(최고관리자 · 담당 매니저): 해당 창고(스튜디오)의 모든 문의
// - SUPER_ADMIN: 전체 문의
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const facilityId = params.id;

  try {
    let where: any = { facilityId };

    if (user.role === "SELLER") {
      where.sellerId = user.id;
    } else if (!(await canOperateFacility(user, facilityId))) {
      // 창고 운영자(최고관리자 · 담당 매니저)만 그 창고의 문의를 본다
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const inquiries = await (prisma as any).facilityInquiry.findMany({
      where,
      include: {
        seller: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ inquiries });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// POST /api/facilities/[id]/inquiries
// SELLER만 새 문의 작성
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  if (user.role !== "SELLER") {
    return NextResponse.json({ error: "셀러 계정만 문의할 수 있습니다" }, { status: 403 });
  }

  const { message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "문의 내용을 입력하세요" }, { status: 400 });
  }

  try {
    const facility = await prisma.facility.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, name: true },
    });
    if (!facility || facility.status !== "APPROVED") {
      return NextResponse.json({ error: "창고(스튜디오)를 찾을 수 없습니다" }, { status: 404 });
    }

    const inquiry = await (prisma as any).facilityInquiry.create({
      data: {
        facilityId: params.id,
        sellerId: user.id,
        message: message.trim().slice(0, 2000),
      },
    });
    await notifyFacility(facility.id, { type: "INQUIRY", partnerEmail: true, title: "새 셀러 문의가 도착했습니다", body: `${facility.name} · ${message.trim().slice(0, 60)}`, link: "/facility/inquiries" });

    return NextResponse.json({ inquiry }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
