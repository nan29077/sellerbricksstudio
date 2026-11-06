import { parseDateKey, addDays } from "./kst";

export type SP = Record<string, string | string[] | undefined>;

export function sp(params: SP, key: string): string | undefined {
  const v = params[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

export function pageOf(params: SP, size = 20) {
  const page = Math.max(1, parseInt(sp(params, "page") ?? "1", 10) || 1);
  return { page, size, skip: (page - 1) * size, take: size };
}

// from/to (YYYY-MM-DD, KST) → Prisma 날짜 범위 조건
export function dateRange(params: SP, fromKey = "from", toKey = "to") {
  const from = parseDateKey(sp(params, fromKey));
  const to = parseDateKey(sp(params, toKey));
  if (!from && !to) return undefined;
  return { ...(from && { gte: from }), ...(to && { lt: addDays(to, 1) }) };
}

// 현재 쿼리스트링에 값을 덮어쓴 href 생성
export function withParams(base: string, params: SP, patch: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) q.set(k, s);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === "") q.delete(k); else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 1000) / 10 : 0;
}

// 증감률 (%)
export function growth(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}
