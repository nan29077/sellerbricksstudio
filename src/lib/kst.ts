// KST(UTC+9) 기준 날짜 계산 유틸. 서버 타임존과 관계없이 동일하게 동작한다.
const KST = 9 * 60 * 60 * 1000;

export function kstParts(d: Date) {
  const k = new Date(d.getTime() + KST);
  return {
    year: k.getUTCFullYear(), month: k.getUTCMonth() + 1, day: k.getUTCDate(),
    weekday: k.getUTCDay(), hour: k.getUTCHours(), minute: k.getUTCMinutes(),
  };
}

// KST 벽시계 → 실제 시각
export function kstDate(year: number, month: number, day = 1, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
}

export function kstStartOfDay(d: Date): Date {
  const p = kstParts(d);
  return kstDate(p.year, p.month, p.day);
}

export function kstStartOfMonth(d: Date): Date {
  const p = kstParts(d);
  return kstDate(p.year, p.month, 1);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

export function addMonths(d: Date, n: number): Date {
  const p = kstParts(d);
  return kstDate(p.year, p.month + n, 1);
}

// "2026-11" 형식 → 해당 월 1일 (KST). 잘못된 값이면 이번 달.
export function parseMonth(v?: string | null): Date {
  const m = v?.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return kstDate(+m[1], +m[2], 1);
  return kstStartOfMonth(new Date());
}

export function monthKey(d: Date): string {
  const p = kstParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function dateKey(d: Date): string {
  const p = kstParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// "YYYY-MM-DD" → KST 자정
export function parseDateKey(v?: string | null): Date | null {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? kstDate(+m[1], +m[2], +m[3]) : null;
}

export function hhmm(d: Date): string {
  const p = kstParts(d);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function hoursBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / 3600000);
}

// KST 기준 <input type="datetime-local"> / <input type="date"> 값
export function toKstInput(d: Date | string | null | undefined, dateOnly = false): string {
  if (!d) return "";
  const t = new Date(new Date(d).getTime() + 9 * 3600000).toISOString();
  return dateOnly ? t.slice(0, 10) : t.slice(0, 16);
}
