import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.round(amount)) + "원";
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul",
  }).format(date);
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(date);
}

// 한국 표준시(KST, UTC+9, DST 없음) 공용 날짜 유틸
// 사용자 입력값(타임존 없는 벽시계 문자열)을 항상 KST로 해석해 정확한 시각(UTC instant)으로 변환한다.
// 예: "2026-06-27T10:00" → 2026-06-27 10:00 KST (= 01:00 UTC)
export function parseKST(naive: string): Date {
  const m = naive
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return new Date(naive);
  const [, y, mo, d, h, mi, s] = m;
  // KST = UTC+9 → UTC 시각 = 벽시계 - 9시간 (Date.UTC가 음수/자리올림 처리)
  return new Date(Date.UTC(+y, +mo - 1, +d, +h - 9, +mi, s ? +s : 0));
}

// KST 기준 오늘 날짜 (YYYY-MM-DD). 날짜 입력 min 등에 사용.
export function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

// 셀러 예상 정산금(셀러 수익) 계산
export function calcSellerCommission(price: number, type: "PERCENT" | "FIXED", value: number): number {
  return type === "PERCENT" ? Math.round((price * value) / 100) : Math.round(value);
}

export function slugify(prefix = "live"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function orderNo(): string {
  const ymd = todayKST().replace(/-/g, ""); // KST 기준 YYYYMMDD
  return `SB${ymd}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
