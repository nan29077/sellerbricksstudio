import ExcelJS from "exceljs";
import type { CatalogItem, SheetInput } from "./order-sheets";
import { LIVE_PLATFORMS, livePlatformCodeOf } from "./live-platforms";

// ---------------------------------------------------------------------------
// 셀러 주문서 엑셀(.xlsx) · CSV 업로드
//  - 한 행 = 상품 한 줄. 같은 '외부 주문번호'(없으면 받는 분 · 연락처 · 주소가 같은 행)는 주문서 한 장으로 묶는다.
//  - 플랫폼 칸이 비어 있으면 화면에서 고른 기본 플랫폼을 쓴다.
//  - 상품코드 대신 상품명을 정확히 적어도 된다 (주문서에 담을 수 있는 상품 중 이름이 하나뿐일 때)
// ---------------------------------------------------------------------------
export const SHEET_COLUMNS = ["외부 주문번호", "판매 플랫폼", "받는 분", "연락처", "주소", "상품코드", "상품명", "옵션", "수량", "배송 메모"] as const;

const ALIASES: Record<string, (typeof SHEET_COLUMNS)[number]> = {
  "외부주문번호": "외부 주문번호", "주문번호": "외부 주문번호", "플랫폼주문번호": "외부 주문번호",
  "판매플랫폼": "판매 플랫폼", "플랫폼": "판매 플랫폼",
  "받는분": "받는 분", "수령인": "받는 분", "수취인": "받는 분", "받는사람": "받는 분", "이름": "받는 분",
  "연락처": "연락처", "전화번호": "연락처", "휴대폰": "연락처", "휴대전화": "연락처", "수령인연락처": "연락처",
  "주소": "주소", "배송지": "주소", "배송지주소": "주소", "받는분주소": "주소",
  "상품코드": "상품코드", "코드": "상품코드",
  "상품명": "상품명", "상품": "상품명",
  "옵션": "옵션", "옵션정보": "옵션",
  "수량": "수량", "주문수량": "수량",
  "배송메모": "배송 메모", "메모": "배송 메모", "배송요청사항": "배송 메모",
};
const norm = (s: string) => s.replace(/\s|\(.*?\)|\*/g, "");

export type ParsedRow = { row: number; values: Partial<Record<(typeof SHEET_COLUMNS)[number], string>> };
export type ParseResult = { sheets: SheetInput[]; errors: { row: number; error: string }[]; rowCount: number };

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v) return String(v.result ?? "");
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return "";
  }
  return String(v);
}

async function readXlsx(buf: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets.find((w) => w.name.includes("주문")) ?? wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    const vals = (row.values as ExcelJS.CellValue[]).slice(1).map(cellText);
    rows[n - 1] = vals;
  });
  return rows.map((r) => r ?? []);
}

function decodeText(buf: Buffer): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, ""); }
  catch { return new TextDecoder("euc-kr").decode(buf); } // 엑셀에서 'CSV'로 저장한 한글 파일
}

function readCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

export async function parseSheetFile(name: string, buf: Buffer, catalog: CatalogItem[], defaults: { platform: string; platformEtc?: string | null }): Promise<ParseResult> {
  const lower = name.toLowerCase();
  let table: string[][];
  if (lower.endsWith(".xlsx")) table = await readXlsx(buf);
  else if (lower.endsWith(".csv") || lower.endsWith(".txt")) table = readCsv(decodeText(buf));
  else throw new Error("엑셀(.xlsx) 또는 CSV 파일을 올려 주세요. (.xls 는 엑셀에서 .xlsx 로 저장해 주세요)");

  // 머리글 행 찾기 (위쪽 10행 안에서 '수량'과 '받는 분'이 있는 행)
  const headerIdx = table.slice(0, 10).findIndex((r) => {
    const cols = r.map((c) => ALIASES[norm(c)] ?? null);
    return cols.includes("수량") && cols.includes("받는 분");
  });
  if (headerIdx < 0) throw new Error("머리글(받는 분 · 수량 등)을 찾지 못했습니다. 주문서 양식을 내려받아 그대로 채워 주세요.");
  const header = table[headerIdx].map((c) => ALIASES[norm(c)] ?? null);

  const rows: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < table.length; i++) {
    const r = table[i] ?? [];
    if (!r.some((c) => c && c.trim())) continue;
    const values: ParsedRow["values"] = {};
    header.forEach((h, idx) => { if (h) values[h] = (r[idx] ?? "").trim(); });
    if ((values["받는 분"] ?? "").startsWith("예)")) continue; // 양식의 예시 행
    rows.push({ row: i + 1, values });
  }
  if (rows.length > 2000) throw new Error("한 번에 2,000행까지 올릴 수 있습니다. 나눠서 올려 주세요.");

  const byCode = new Map(catalog.map((c) => [c.code, c]));
  const byName = new Map<string, CatalogItem[]>();
  for (const c of catalog) byName.set(c.name.trim(), [...(byName.get(c.name.trim()) ?? []), c]);

  const errors: ParseResult["errors"] = [];
  const groups = new Map<string, { sheet: SheetInput; rows: number[] }>();
  let last: { sheet: SheetInput; rows: number[] } | null = null;
  for (const { row, values: v } of rows) {
    // 상품
    let code = (v["상품코드"] ?? "").trim();
    if (!code && v["상품명"]) {
      const hits = byName.get(v["상품명"].trim()) ?? [];
      if (hits.length === 1) code = hits[0].code;
      else { errors.push({ row, error: hits.length ? `상품명 '${v["상품명"]}'이 여러 개입니다. 상품코드를 적어 주세요.` : `상품 '${v["상품명"]}'을(를) 주문서 상품에서 찾지 못했습니다.` }); continue; }
    }
    if (!code) { errors.push({ row, error: "상품코드 또는 상품명을 입력하세요." }); continue; }
    if (!byCode.has(code)) { errors.push({ row, error: `주문서에 담을 수 없는 상품코드입니다 (${code}).` }); continue; }
    const quantity = Number(String(v["수량"] ?? "").replace(/[,개\s]/g, ""));
    if (!Number.isInteger(quantity) || quantity < 1) { errors.push({ row, error: "수량을 숫자로 입력하세요." }); continue; }
    // 플랫폼
    let platform = defaults.platform;
    let platformEtc = defaults.platformEtc ?? null;
    if (v["판매 플랫폼"]) {
      const c = livePlatformCodeOf(v["판매 플랫폼"]);
      if (c) { platform = c; platformEtc = c === "ETC" ? (defaults.platformEtc ?? null) : null; }
      else { platform = "ETC"; platformEtc = v["판매 플랫폼"].slice(0, 60); }
    }
    // 묶기: 외부 주문번호 → 같은 주문서, 없으면 받는 사람 정보가 같으면 묶고, 받는 사람 칸이 비어 있으면 바로 위 주문서에 붙인다
    const ext = (v["외부 주문번호"] ?? "").trim();
    const hasPerson = !!(v["받는 분"] || v["연락처"] || v["주소"]);
    let g: { sheet: SheetInput; rows: number[] } | undefined;
    const key = ext ? `E:${platform}:${ext}` : hasPerson ? `P:${v["받는 분"]}|${v["연락처"]}|${v["주소"]}` : "";
    if (key) g = groups.get(key);
    else if (last) g = last;
    if (!g) {
      if (!hasPerson) { errors.push({ row, error: "받는 분 · 연락처 · 주소를 입력하세요." }); continue; }
      g = {
        sheet: {
          platform, platformEtc, externalOrderNo: ext || null, recipient: v["받는 분"] ?? "", phone: v["연락처"] ?? "", address: v["주소"] ?? "",
          memo: v["배송 메모"] || null, lines: [], ref: `${row}행`,
        },
        rows: [],
      };
      groups.set(key || `R:${row}`, g);
    }
    g.sheet.lines.push({ code, optionLabel: v["옵션"] || null, quantity });
    g.rows.push(row);
    if (g.rows.length > 1) g.sheet.ref = `${g.rows[0]}~${row}행`;
    last = g;
  }
  return { sheets: Array.from(groups.values()).map((g) => g.sheet), errors, rowCount: rows.length };
}

/** 주문서 양식(.xlsx): '주문서' 시트(머리글 + 예시) + '상품코드' 시트(이 셀러가 담을 수 있는 상품) + '플랫폼' 시트 */
export async function sheetTemplate(catalog: CatalogItem[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "스토리지마켓";
  const ws = wb.addWorksheet("주문서");
  ws.addRow([...SHEET_COLUMNS]);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5A623" } };
  const ex = catalog[0];
  ws.addRow(["(선택) 플랫폼 주문번호", "그립", "예) 홍길동", "010-1234-5678", "서울 강남구 테헤란로 152 101호", ex?.code ?? "B-상품코드", ex?.name ?? "", ex?.options.length ? ex.options.map((o) => `${o.name}:${o.values[0]}`).join(" / ") : "", 1, "문 앞에 놓아 주세요"]);
  ws.getRow(2).font = { color: { argb: "FF94A3B8" }, italic: true };
  [18, 14, 12, 16, 40, 30, 28, 22, 8, 24].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.addRow([]);
  ws.addRow(["* 2행(예시)은 지우지 않아도 됩니다. 받는 분이 '예)'로 시작하는 행은 건너뜁니다."]);
  ws.addRow(["* 같은 외부 주문번호(없으면 받는 분 · 연락처 · 주소가 같은 행)는 주문서 한 장으로 묶입니다. 받는 분 칸을 비우면 바로 위 주문서에 상품이 추가됩니다."]);
  ws.addRow(["* 판매 플랫폼 칸을 비우면 업로드 화면에서 고른 플랫폼으로 들어갑니다. 상품코드는 '상품코드' 시트에서 복사하세요."]);

  const cs = wb.addWorksheet("상품코드");
  cs.addRow(["상품코드", "상품명", "브랜드", "옵션 (이 중에서 고르기)", "개당 공급가", "보내는 곳", "현재 재고"]);
  cs.getRow(1).font = { bold: true };
  for (const c of catalog) {
    cs.addRow([c.code, c.name, c.brandName ?? "", c.options.map((o) => `${o.name}: ${o.values.join("/")}`).join(" · "), c.unitCost, c.shipper, c.stock]);
  }
  [30, 30, 16, 36, 12, 28, 10].forEach((w, i) => { cs.getColumn(i + 1).width = w; });

  const ps = wb.addWorksheet("플랫폼");
  ps.addRow(["판매 플랫폼 (이름을 그대로 적어 주세요)"]);
  ps.getRow(1).font = { bold: true };
  for (const p of LIVE_PLATFORMS) ps.addRow([p.label]);
  ps.getColumn(1).width = 30;

  return Buffer.from(await wb.xlsx.writeBuffer());
}
