import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// PATCH /api/facilities/[id]/inquiries/[iqId]
// FACILITY_ADMIN: 답변 달기 + isRead 처리
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; iqId: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  if (user.role !== "FACILITY_ADMIN" && user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  }

  const { reply, isRead } = await req.json();

  try {
    // 권한 확인: FACILITY_ADMIN은 본인 시설 문의만
    if (user.role === "FACILITY_ADMIN") {
      const facility = await prisma.facility.findUnique({
        where: { id: params.id },
        select: { ownerId: true },
      });
      if (facility?.ownerId !== user.id) {
        return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
      }
    }

    const updateData: any = {};
    if (typeof isRead === "boolean") updateData.isRead = isRead;
    if (reply !== undefined) {
      updateData.reply = reply.trim() || null;
      updateData.repliedAt = reply.trim() ? new Date() : null;
    }

    const inquiry = await (prisma as any).facilityInquiry.update({
      where: { id: params.iqId, facilityId: params.id },
      data: updateData,
    });

    return NextResponse.json({ inquiry });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// DELETE — SUPER_ADMIN 또는 문의 작성 셀러만
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; iqId: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  try {
    const inquiry = await (prisma as any).facilityInquiry.findUnique({
      where: { id: params.iqId },
      select: { sellerId: true },
    });
    if (!inquiry) return NextResponse.json({ error: "문의를 찾을 수 없습니다" }, { status: 404 });

    const canDelete = user.role === "SUPER_ADMIN" || inquiry.sellerId === user.id;
    if (!canDelete) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });

    await (prisma as any).facilityInquiry.delete({ where: { id: params.iqId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
