import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/http";
import { checkSheet, sheetCatalog } from "@/lib/order-sheets";
import { parseSheetFile } from "@/lib/order-sheet-file";
import { isLivePlatform } from "@/lib/live-platforms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST (multipart: file, platform, platformEtc) — 엑셀 · CSV 주문서를 읽어 미리보기용 주문서 목록과 오류를 돌려준다. (아직 제출하지 않음)
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["SELLER"]);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) return fail("파일을 선택하세요.");
    if (file.size > 5 * 1024 * 1024) return fail("파일은 5MB까지 올릴 수 있습니다.");
    const platform = String(form.get("platform") ?? "");
    if (!isLivePlatform(platform)) return fail("기본 판매 플랫폼을 선택하세요.");
    const platformEtc = String(form.get("platformEtc") ?? "").trim().slice(0, 60) || null;
    const catalog = await sheetCatalog(user.id);
    let parsed;
    try { parsed = await parseSheetFile(file.name, Buffer.from(await file.arrayBuffer()), catalog, { platform, platformEtc }); }
    catch (e) { return fail(e instanceof Error ? e.message : "파일을 읽지 못했습니다."); }
    const map = new Map(catalog.map((c) => [c.code, c]));
    const sheets = parsed.sheets.map((s) => {
      const check = checkSheet(s, map);
      const total = s.lines.reduce((sum, l) => sum + (map.get(l.code)?.unitCost ?? 0) * l.quantity, 0);
      return { ...s, error: check.ok ? null : check.error, itemsTotal: total };
    });
    return ok({ sheets, errors: parsed.errors, rowCount: parsed.rowCount });
  } catch (e) { return handleError(e); }
}
