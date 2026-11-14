import { requireRole } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { sheetCatalog } from "@/lib/order-sheets";

export const dynamic = "force-dynamic";

// GET — 셀러가 주문서에 담을 수 있는 상품 (고른 브랜드 직배송 상품 + 스토리지마켓 창고 재고)
export async function GET() {
  try {
    const user = await requireRole(["SELLER"]);
    return ok(await sheetCatalog(user.id));
  } catch (e) { return handleError(e); }
}
