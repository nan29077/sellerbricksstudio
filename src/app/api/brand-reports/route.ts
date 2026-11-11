export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { brandContext } from "@/lib/brand-access";
import { brandReport } from "@/lib/brand-report";
import { fail, handleError } from "@/lib/http";
import { addDays, parseDateKey } from "@/lib/kst";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// GET /api/brand-reports?from=YYYY-MM-DD&to=YYYY-MM-DD — 매출 리포트 CSV (상품별 · 판매처별 · 월별)
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const ctx = await brandContext(user);
    if (!ctx) return fail("브랜드사 계정이 필요합니다.", 403);
    const url = new URL(req.url);
    const today = parseDateKey(new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10))!;
    const from = parseDateKey(url.searchParams.get("from") ?? "") ?? addDays(today, -89);
    const to = parseDateKey(url.searchParams.get("to") ?? "") ?? today;
    if (to < from) return fail("기간을 확인해 주세요.");
    const r = await brandReport(ctx.shop.id, from, addDays(to, 1));
    const rows: (string | number)[][] = [["[상품별]"], ["상품", "수량", "공급가 합계", "판매 금액"], ...r.products.map((p) => [p.name, p.qty, p.supply, p.sale]), [],
      ["[판매처별]"], ["판매처", "방식", "발주 수", "공급가 합계"], ...r.partners.map((p) => [p.name, p.kind, p.orders, p.supply]), [],
      ["[월별]"], ["월", "발주 수", "공급가 합계"], ...r.months.map((m) => [m.month, m.orders, m.supply])];
    const csv = "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="brand-report.csv"` } });
  } catch (e) { return handleError(e); }
}
