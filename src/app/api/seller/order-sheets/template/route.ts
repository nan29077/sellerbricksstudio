import { requireRole } from "@/lib/auth";
import { handleError } from "@/lib/http";
import { sheetCatalog } from "@/lib/order-sheets";
import { sheetTemplate } from "@/lib/order-sheet-file";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET — 주문서 엑셀 양식 (내가 담을 수 있는 상품의 상품코드 시트 포함)
export async function GET() {
  try {
    const user = await requireRole(["SELLER"]);
    const buf = await sheetTemplate(await sheetCatalog(user.id));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("스토리지마켓_주문서_양식.xlsx")}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) { return handleError(e); }
}
