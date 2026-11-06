import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { APPLICATION_STATUS } from "@/lib/marketing-labels";

// PATCH { status?, adminNote? }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(["SUPER_ADMIN"]);
    const b = await req.json().catch(() => ({}));
    const app = await prisma.marketingApplication.findUnique({ where: { id: params.id } });
    if (!app) return fail("신청을 찾을 수 없습니다.", 404);
    const data: Record<string, unknown> = {};
    if (b.status !== undefined) {
      if (!(b.status in APPLICATION_STATUS)) return fail("허용되지 않은 상태입니다.");
      if (b.status === "REJECTED" && !String(b.adminNote ?? app.adminNote ?? "").trim()) return fail("반려 사유를 답변란에 입력하세요.");
      data.status = b.status;
    }
    if (typeof b.adminNote === "string") data.adminNote = b.adminNote.trim().slice(0, 2000) || null;
    const updated = await prisma.marketingApplication.update({ where: { id: app.id }, data });
    await audit({ actorId: admin.id, action: `MARKETING_APP_${b.status ?? "NOTE"}`, entity: "MarketingApplication", entityId: app.id });
    if (b.status && b.status !== app.status) {
      await notify({ userId: app.sellerId, type: "MARKETING", title: `마케팅 지원 신청이 '${APPLICATION_STATUS[b.status].label}' 상태가 되었습니다`, body: `${app.title}${data.adminNote ? ` · ${String(data.adminNote).slice(0, 60)}` : ""}`, link: "/seller/marketing" });
    }
    return ok(updated);
  } catch (e) { return handleError(e); }
}
