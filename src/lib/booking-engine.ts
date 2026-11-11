// 예약 엔진 (순수 함수) — DB에 의존하지 않아 서버·클라이언트·테스트에서 같은 규칙을 쓴다.
// 시간은 모두 "해당 날짜 KST 자정부터 몇 분"(0~1440)으로 다룬다.

export type Interval = { start: number; end: number };

export type BookingPolicy = {
  openTime: string;          // "09:00"
  closeTime: string;         // "22:00"
  unit: number;              // 예약 시작 단위(분)
  buffer: number;            // 예약 사이 준비·정리 시간(분)
  minHours: number;
  maxHours: number;
  minLeadHours: number;      // 최소 몇 시간 전 예약
  maxAdvanceDays: number;    // 최대 며칠 앞까지
  autoApprove: boolean;
  cancelDeadlineHours: number;
  capacity: number | null;
};

export type FacilityPolicySource = {
  openTime?: string | null; closeTime?: string | null; minHours?: number | null; capacity?: number | null;
  bookingUnitMinutes?: number | null; bufferMinutes?: number | null; minLeadHours?: number | null;
  maxAdvanceDays?: number | null; maxHours?: number | null; autoApprove?: boolean | null; cancelDeadlineHours?: number | null;
};

export type SlotRule = { weekday: number; startTime: string; endTime: string; isActive?: boolean };

export type BusyBlock = Interval & { status: "APPROVED" | "PENDING" | "BLOCKED" | string; id?: string; reason?: string | null };

export type StartOption = {
  time: string;                                    // "10:00"
  status: "available" | "booked" | "pending" | "closed" | "past";
};

export const DAY_MIN = 24 * 60;

export const toMin = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const toHm = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const clampInt = (v: number | null | undefined, def: number, min: number, max: number) => {
  const n = Number.isFinite(v as number) ? Math.round(v as number) : def;
  return Math.min(max, Math.max(min, n));
};

export function policyOf(f: FacilityPolicySource): BookingPolicy {
  const unit = f.bookingUnitMinutes === 30 ? 30 : 60;
  const minHours = clampInt(f.minHours, 1, 1, 24);
  return {
    openTime: f.openTime || "09:00",
    closeTime: f.closeTime || "22:00",
    unit,
    buffer: clampInt(f.bufferMinutes, 0, 0, 240),
    minHours,
    maxHours: Math.max(minHours, clampInt(f.maxHours, 12, 1, 24)),
    minLeadHours: clampInt(f.minLeadHours, 0, 0, 24 * 14),
    maxAdvanceDays: clampInt(f.maxAdvanceDays, 60, 1, 365),
    autoApprove: !!f.autoApprove,
    cancelDeadlineHours: clampInt(f.cancelDeadlineHours, 24, 0, 24 * 14),
    capacity: f.capacity ?? null,
  };
}

// 겹치는 구간을 합친다.
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

// 그날 운영 구간: 휴무일이면 없음, 요일별 운영 시간대가 등록돼 있으면 그 요일 시간대, 아니면 기본 운영 시간
export function openWindows(policy: BookingPolicy, slots: SlotRule[], weekday: number, blackout: boolean): Interval[] {
  if (blackout) return [];
  const active = slots.filter((s) => s.isActive !== false);
  if (active.length > 0) {
    return mergeIntervals(active.filter((s) => s.weekday === weekday).map((s) => ({ start: toMin(s.startTime), end: s.endTime === "24:00" ? DAY_MIN : toMin(s.endTime) })));
  }
  const o = toMin(policy.openTime);
  const c = policy.closeTime === "24:00" ? DAY_MIN : toMin(policy.closeTime);
  return c > o ? [{ start: o, end: c }] : [];
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && a.end > b.start;

// 새 예약 [s,e]가 기존 예약과 준비시간(buffer)을 포함해 겹치는지
export function findClash(s: number, e: number, busy: BusyBlock[], buffer: number): BusyBlock | undefined {
  // 창고(스튜디오)가 막아 둔 시간(BLOCKED)에는 준비시간을 더하지 않는다.
  return busy.find((b) => overlaps({ start: s, end: e }, b.status === "BLOCKED" ? b : { start: b.start - buffer, end: b.end + buffer }));
}

// 예약 시작 시간 선택지 (단위마다). duration(분)짜리 예약을 그 시각에 시작할 수 있는지 상태를 붙인다.
export function startOptions(params: {
  policy: BookingPolicy; windows: Interval[]; busy: BusyBlock[]; durationMin: number; earliestMin?: number;
}): StartOption[] {
  const { policy, windows, busy, durationMin } = params;
  if (windows.length === 0) return [];
  const earliest = params.earliestMin ?? -Infinity;
  const from = Math.min(...windows.map((w) => w.start));
  const to = Math.max(...windows.map((w) => w.end));
  const first = Math.ceil(from / policy.unit) * policy.unit;
  const out: StartOption[] = [];
  for (let s = first; s < to; s += policy.unit) {
    const e = s + durationMin;
    let status: StartOption["status"] = "available";
    if (!windows.some((w) => s >= w.start && e <= w.end)) status = "closed";
    else if (s < earliest) status = "past";
    else {
      const clash = findClash(s, e, busy, policy.buffer);
      if (clash) status = clash.status === "BLOCKED" ? "closed" : clash.status === "PENDING" ? "pending" : "booked";
    }
    out.push({ time: toHm(s), status });
  }
  return out;
}

// 하루 요약 (기간 달력용)
export type DaySummary = {
  date: string; weekday: number;
  level: "closed" | "out" | "full" | "few" | "available";
  openMin: number; freeMin: number; bookable: number; reason?: string | null;
};

export function summarizeDay(params: {
  date: string; weekday: number; policy: BookingPolicy; windows: Interval[]; busy: BusyBlock[];
  earliestMin?: number; outOfRange?: boolean; closedReason?: string | null;
}): DaySummary {
  const { date, weekday, policy, windows, busy } = params;
  const openMin = windows.reduce((a, w) => a + (w.end - w.start), 0);
  if (params.outOfRange) return { date, weekday, level: "out", openMin, freeMin: 0, bookable: 0, reason: "예약 가능 기간이 아닙니다" };
  if (openMin === 0) return { date, weekday, level: "closed", openMin: 0, freeMin: 0, bookable: 0, reason: params.closedReason ?? "휴무" };
  const busyMerged = mergeIntervals(busy.map((b) => ({ start: b.start, end: b.end })));
  const used = windows.reduce((a, w) => a + busyMerged.reduce((x, b) => x + Math.max(0, Math.min(w.end, b.end) - Math.max(w.start, b.start)), 0), 0);
  const opts = startOptions({ policy, windows, busy, durationMin: policy.minHours * 60, earliestMin: params.earliestMin });
  const bookable = opts.filter((o) => o.status === "available").length;
  const freeMin = Math.max(0, openMin - used);
  const level: DaySummary["level"] = bookable === 0 ? "full" : freeMin / openMin < 0.35 ? "few" : "available";
  return { date, weekday, level, openMin, freeMin, bookable };
}

// 예약 요청 검증 (서버가 최종 판정). 실패하면 사유 문자열.
export function validateRequest(params: {
  policy: BookingPolicy; windows: Interval[]; busy: BusyBlock[];
  startMin: number; endMin: number; sameDay: boolean;
  minutesUntilStart: number;   // 지금부터 시작까지 남은 분
  daysAhead: number;           // 오늘(KST)로부터 며칠 뒤
  weekdayLabel: string; closedReason?: string | null;
}): string | null {
  const { policy, windows, busy, startMin, endMin } = params;
  if (!params.sameDay) return "예약은 하루 안에서만 가능합니다. (자정을 넘길 수 없어요)";
  if (endMin <= startMin) return "종료 시간은 시작 시간보다 뒤여야 합니다.";
  if (params.minutesUntilStart < -5) return "지난 시간은 예약할 수 없습니다.";
  if (params.minutesUntilStart < policy.minLeadHours * 60) return `이용 시작 ${policy.minLeadHours}시간 전까지만 예약할 수 있습니다.`;
  if (params.daysAhead > policy.maxAdvanceDays) return `최대 ${policy.maxAdvanceDays}일 뒤까지만 예약할 수 있습니다.`;
  const dur = endMin - startMin;
  if (dur < policy.minHours * 60) return `최소 ${policy.minHours}시간 이상 예약해야 합니다.`;
  if (dur > policy.maxHours * 60) return `한 번에 최대 ${policy.maxHours}시간까지 예약할 수 있습니다.`;
  if (startMin % policy.unit !== 0) return `시작 시간은 ${policy.unit === 30 ? "30분" : "정시"} 단위로 선택하세요.`;
  if (dur % 30 !== 0) return "이용 시간은 30분 단위로 선택하세요.";
  if (windows.length === 0) return params.closedReason ? `예약할 수 없는 날입니다. (${params.closedReason})` : `${params.weekdayLabel}요일은 운영하지 않습니다.`;
  if (!windows.some((w) => startMin >= w.start && endMin <= w.end)) {
    return `운영 시간(${windows.map((w) => `${toHm(w.start)}~${toHm(w.end)}`).join(", ")}) 안에서 예약하세요.`;
  }
  const clash = findClash(startMin, endMin, busy, policy.buffer);
  if (clash) {
    const t = `${toHm(clash.start)}~${toHm(clash.end)}`;
    if (clash.status === "BLOCKED") return `${t}은(는) 창고(스튜디오) 사정으로 예약을 받지 않는 시간입니다${clash.reason ? ` (${clash.reason})` : ""}. 다른 시간을 선택하세요.`;
    return policy.buffer > 0
      ? `기존 예약(${t})과 겹치거나 준비시간 ${policy.buffer}분이 부족합니다. 다른 시간을 선택하세요.`
      : `해당 시간대(${t})에 이미 예약이 있습니다. 다른 시간을 선택하세요.`;
  }
  return null;
}

// 셀러가 직접 취소·변경할 수 있는지 (승인된 예약은 마감 시간 전까지만)
export function sellerCanModify(status: string, startAt: Date, deadlineHours: number, now = new Date()): { ok: boolean; reason?: string } {
  if (!["PENDING", "APPROVED"].includes(status)) return { ok: false, reason: "진행 중인 예약만 변경할 수 있습니다." };
  if (startAt <= now) return { ok: false, reason: "이미 시작된 예약입니다." };
  if (status === "APPROVED" && startAt.getTime() - now.getTime() < deadlineHours * 3600000) {
    return { ok: false, reason: `이용 시작 ${deadlineHours}시간 전부터는 직접 취소·변경할 수 없습니다. 창고(스튜디오)에 문의하세요.` };
  }
  return { ok: true };
}

const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function bookingCode(ymd: string): string {
  let r = "";
  for (let i = 0; i < 5; i++) r += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `SB-${ymd.slice(2)}-${r}`;
}
