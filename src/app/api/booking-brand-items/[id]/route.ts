import { requireUser } from "@/lib/auth";
import { fail, handleError, ok } from "@/lib/http";
import { markDisplayArrived } from "@/lib/booking-brand-items";

// PATCH /api/booking-brand-items/[id] { action: "arrived" } — 방송 시연품 도착 확인 (공간 운영자: 최고관리자 · 담당 매니저, 또는 현장의 셀러)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    if (body.action !== "arrived") return fail("지원하지 않는 작업입니다.");
    try {
      const r = await markDisplayArrived(user, params.id);
      return ok({ id: r.id, status: r.status });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "처리하지 못했습니다.";
      if (msg === "FORBIDDEN") return fail("이 예약 상품을 처리할 권한이 없습니다.", 403);
      return fail(msg, msg.includes("찾을 수 없") ? 404 : 409);
    }
  } catch (e) { return handleError(e); }
}
