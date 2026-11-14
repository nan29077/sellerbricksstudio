export const dynamic = "force-dynamic";
import { requireRole } from "@/lib/auth";
import { handleError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITY, SUPPORT_SOURCE, SUPPORT_STATUS, effectiveStatus, isSupportPriority } from "@/lib/support";
import { formatDateTime } from "@/lib/utils";

const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

// GET /api/admin/support/export — 고객 문의 CSV (최근 5,000건)
export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const rows = await prisma.supportInquiry.findMany({ orderBy: { createdAt: "desc" }, take: 5000, include: { user: { select: { email: true, role: true, profile: { select: { name: true } } } }, _count: { select: { messages: true } } } });
    const head = ["접수번호", "접수 시각", "유형", "상태", "우선순위", "경로", "작성자", "이메일", "회원 구분", "제목", "관련 번호", "첫 답변 시각", "응답 시간(시간)", "대화 수"];
    const lines = rows.map((r) => {
      const hours = r.answeredAt ? Math.round(((r.answeredAt.getTime() - r.createdAt.getTime()) / 3600000) * 10) / 10 : "";
      return [r.id, formatDateTime(r.createdAt), SUPPORT_CATEGORIES[r.category].label, SUPPORT_STATUS[effectiveStatus(r)].label, isSupportPriority(r.priority) ? SUPPORT_PRIORITY[r.priority] : r.priority,
        SUPPORT_SOURCE[r.source as keyof typeof SUPPORT_SOURCE] ?? r.source, r.user?.profile?.name ?? r.guestName ?? "", r.user?.email ?? r.guestEmail ?? "", r.user ? r.user.role : "비회원",
        r.subject, r.reference ?? "", r.answeredAt ? formatDateTime(r.answeredAt) : "", hours, r._count.messages].map(cell).join(",");
    });
    return new Response(`﻿${[head.join(","), ...lines].join("\n")}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="support-inquiries.csv"` } });
  } catch (e) { return handleError(e); }
}
