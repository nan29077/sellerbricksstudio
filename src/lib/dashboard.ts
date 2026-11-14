// 역할별 대시보드에서 공통으로 쓰는 집계 유틸 (KST 기준)
import { addDays, addMonths, kstParts, kstStartOfDay, kstStartOfMonth, WEEKDAYS } from "@/lib/kst";

/** 실제 판매로 보는 주문 상태 (결제 완료 이후) */
export const SOLD_ORDER_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;

/** 전기 대비 증감률(%) — 비교값이 없으면 null */
export function deltaPct(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export function ratio(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 1000) / 10 : 0;
}

/** 최근 n일 일별 시계열 (오늘 포함) */
export function dailySeries<T>(rows: T[], days: number, at: (r: T) => Date, val: (r: T) => number = () => 1) {
  const today = kstStartOfDay(new Date());
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(today, i - (days - 1));
    const n = addDays(d, 1);
    const p = kstParts(d);
    let v = 0;
    for (const r of rows) { const t = at(r); if (t >= d && t < n) v += val(r); }
    return { label: `${p.month}/${p.day}`, key: d.toISOString(), weekday: WEEKDAYS[p.weekday], value: v };
  });
}

/** 최근 n개월 월별 시계열 (이번 달 포함) */
export function monthlySeries<T>(rows: T[], months: number, at: (r: T) => Date, val: (r: T) => number = () => 1) {
  const cur = kstStartOfMonth(new Date());
  return Array.from({ length: months }, (_, i) => {
    const m = addMonths(cur, i - (months - 1));
    const n = addMonths(m, 1);
    let v = 0;
    for (const r of rows) { const t = at(r); if (t >= m && t < n) v += val(r); }
    return { label: `${kstParts(m).month}월`, key: m.toISOString(), value: v };
  });
}

/** 두 시계열을 하나의 차트 데이터로 합친다 */
export function zipSeries(a: { label: string; value: number }[], b: { value: number }[]) {
  return a.map((x, i) => ({ label: x.label, a: x.value, b: b[i]?.value ?? 0 }));
}

/** 요일(행) × 시간대(열) 예약 시작 분포 */
export const HEAT_HOURS = [8, 10, 12, 14, 16, 18, 20, 22];
export function weekdayHourHeatmap(starts: Date[]) {
  const grid = Array.from({ length: 7 }, () => HEAT_HOURS.map(() => 0));
  for (const s of starts) {
    const p = kstParts(s);
    let col = HEAT_HOURS.findIndex((h, i) => p.hour >= h && p.hour < (HEAT_HOURS[i + 1] ?? 24));
    if (col < 0) col = p.hour < HEAT_HOURS[0] ? 0 : HEAT_HOURS.length - 1;
    grid[p.weekday][col] += 1;
  }
  // 월요일부터 보이도록 재배열
  const order = [1, 2, 3, 4, 5, 6, 0];
  return {
    rows: order.map((w) => WEEKDAYS[w]),
    cols: HEAT_HOURS.map((h) => `${h}시`),
    values: order.map((w) => grid[w]),
  };
}

/** "09:00" → 9 */
function hourOf(t: string | null | undefined, fallback: number) {
  const m = t?.match(/^(\d{1,2}):(\d{2})/);
  return m ? +m[1] + +m[2] / 60 : fallback;
}

/** 공간 하루 운영 시간(시간) — 미입력 시 09~22시 */
export function openHoursPerDay(f: { openTime?: string | null; closeTime?: string | null }) {
  const o = hourOf(f.openTime, 9), c = hourOf(f.closeTime, 22);
  return c > o ? c - o : 24 - o + c;
}

/** 기간 내 예약이 차지한 시간(시간) */
export function overlapHours(rows: { startAt: Date; endAt: Date }[], from: Date, to: Date) {
  let h = 0;
  for (const r of rows) {
    const s = Math.max(r.startAt.getTime(), from.getTime());
    const e = Math.min(r.endAt.getTime(), to.getTime());
    if (e > s) h += (e - s) / 3600000;
  }
  return Math.round(h * 10) / 10;
}

/** 가동률(%) = 예약 시간 ÷ (운영 시간 × 일수) */
export function utilization(bookedHours: number, openPerDay: number, days: number) {
  const cap = openPerDay * days;
  return cap > 0 ? Math.min(100, Math.round((bookedHours / cap) * 100)) : 0;
}

/** 이번 달 시작부터 오늘까지 지난 일수(오늘 포함) */
export function daysElapsedThisMonth() {
  return kstParts(new Date()).day;
}

export function relativeTime(d: Date) {
  const diff = Date.now() - d.getTime();
  const future = diff < 0;
  const m = Math.round(Math.abs(diff) / 60000);
  const fmt = (v: string) => (future ? `${v} 후` : `${v} 전`);
  if (m < 1) return "방금";
  if (m < 60) return fmt(`${m}분`);
  const h = Math.round(m / 60);
  if (h < 24) return fmt(`${h}시간`);
  const day = Math.round(h / 24);
  if (day < 30) return fmt(`${day}일`);
  return fmt(`${Math.round(day / 30)}개월`);
}

/** D-day 라벨 */
export function dday(target: Date) {
  const a = kstStartOfDay(new Date()).getTime();
  const b = kstStartOfDay(target).getTime();
  const n = Math.round((b - a) / 86400000);
  return n === 0 ? "오늘" : n === 1 ? "내일" : n > 0 ? `D-${n}` : `D+${-n}`;
}

export function hoursText(h: number) {
  if (h >= 100) return `${Math.round(h).toLocaleString("ko-KR")}시간`;
  return `${Math.round(h * 10) / 10}시간`;
}

export function compactKRW(n: number) {
  const a = Math.abs(n);
  if (a >= 100_000_000) return `${(n / 100_000_000).toFixed(a >= 1_000_000_000 ? 0 : 1)}억원`;
  if (a >= 10_000) return `${Math.round(n / 10_000).toLocaleString("ko-KR")}만원`;
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

export function greeting() {
  const h = kstParts(new Date()).hour;
  if (h < 6) return "늦은 시간까지 수고 많으세요";
  if (h < 11) return "좋은 아침이에요";
  if (h < 17) return "오늘도 힘내세요";
  return "오늘 하루도 수고하셨어요";
}

export function todayLabel() {
  const p = kstParts(new Date());
  return `${p.year}년 ${p.month}월 ${p.day}일 (${WEEKDAYS[p.weekday]})`;
}
