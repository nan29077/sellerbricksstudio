"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Clock, Hourglass, Info } from "lucide-react";
import { cn, todayKST } from "@/lib/utils";

export type PickerPolicy = {
  openTime: string; closeTime: string; unit: number; buffer: number; minHours: number; maxHours: number;
  minLeadHours: number; maxAdvanceDays: number; autoApprove: boolean; cancelDeadlineHours: number; capacity: number | null;
};
type DaySummary = { date: string; weekday: number; level: "closed" | "out" | "full" | "few" | "available"; openMin: number; freeMin: number; bookable: number; reason?: string | null };
type StartOption = { time: string; status: "available" | "booked" | "pending" | "closed" | "past" };
type DayDetail = {
  date: string; durationMin: number; closed: boolean; closedReason: string | null;
  windows: { start: string; end: string }[]; booked: { start: string; end: string; status: string }[]; options: StartOption[];
  notice?: string | null;
};
export type SlotValue = { date: string; start: string; hours: number };

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const toHm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const endOf = (start: string, hours: number) => { const e = toMin(start) + Math.round(hours * 60); return e >= 1440 ? "24:00" : toHm(e); };
const addDaysKey = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
};
const LEVEL: Record<DaySummary["level"], { cls: string; label: string }> = {
  available: { cls: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400", label: "여유" },
  few: { cls: "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400", label: "마감 임박" },
  full: { cls: "border-red-100 bg-red-50/70 text-red-400", label: "마감" },
  closed: { cls: "border-slate-100 bg-slate-50 text-slate-300", label: "휴무" },
  out: { cls: "border-transparent bg-transparent text-slate-300", label: "" },
};

// 날짜(여유 달력) → 이용 시간 → 시작 시각을 고르는 예약 슬롯 선택기
export function SlotPicker({
  facilityId, value, onChange, excludeBookingId, onPolicy, onWaitlist, onStatusChange, compact = false,
}: {
  facilityId: string; value: SlotValue; onChange: (v: SlotValue) => void; excludeBookingId?: string;
  onPolicy?: (p: PickerPolicy) => void; onWaitlist?: (v: SlotValue) => void; compact?: boolean;
  onStatusChange?: (status: StartOption["status"] | null) => void;
}) {
  const today = todayKST();
  const [from, setFrom] = useState(today);
  const [days, setDays] = useState<DaySummary[]>([]);
  const [policy, setPolicy] = useState<PickerPolicy | null>(null);
  const [calLoading, setCalLoading] = useState(false);
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const span = compact ? 14 : 28;

  useEffect(() => {
    let alive = true;
    setCalLoading(true);
    fetch(`/api/facilities/${facilityId}/calendar?from=${from}&days=${span}`).then((r) => r.json()).then((j) => {
      if (!alive || !j.ok) return;
      setDays(j.data.days); setPolicy(j.data.policy); onPolicy?.(j.data.policy);
    }).catch(() => undefined).finally(() => alive && setCalLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, from, span]);

  // 이용 시간이 정책 범위를 벗어나면 보정
  useEffect(() => {
    if (!policy) return;
    const h = Math.min(policy.maxHours, Math.max(policy.minHours, value.hours || policy.minHours));
    if (h !== value.hours) onChange({ ...value, hours: h });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy]);

  useEffect(() => {
    if (!value.date) { setDetail(null); return; }
    let alive = true;
    setDetailLoading(true);
    const q = new URLSearchParams({ date: value.date, hours: String(value.hours || 1) });
    if (excludeBookingId) q.set("exclude", excludeBookingId);
    fetch(`/api/facilities/${facilityId}/availability?${q}`).then((r) => r.json())
      .then((j) => { if (alive) setDetail(j.ok ? j.data : null); })
      .catch(() => alive && setDetail(null))
      .finally(() => alive && setDetailLoading(false));
    return () => { alive = false; };
  }, [facilityId, value.date, value.hours, excludeBookingId]);

  const durations = useMemo(() => {
    if (!policy) return [1, 2, 3, 4];
    const step = policy.unit === 30 ? 0.5 : 1;
    const out: number[] = [];
    for (let h = policy.minHours; h <= policy.maxHours + 1e-9; h += step) out.push(Math.round(h * 2) / 2);
    return out.length > 14 ? out.filter((h) => Number.isInteger(h)) : out;
  }, [policy]);

  const selected = detail?.options.find((o) => o.time === value.start);
  const selStatus = detailLoading ? null : selected?.status ?? null;
  useEffect(() => { onStatusChange?.(selStatus); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selStatus]);
  const firstWd = days[0]?.weekday ?? 0;
  const canPrev = from > today;

  return (
    <div className="space-y-4">
      {/* 날짜 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-bold text-navy">날짜 선택</p>
          <div className="flex items-center gap-1">
            <button type="button" disabled={!canPrev} onClick={() => setFrom(addDaysKey(from, -span) < today ? today : addDaysKey(from, -span))}
              className="rounded-lg border border-border p-1.5 text-navy disabled:opacity-30" aria-label="이전 기간"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-[96px] text-center text-xs font-semibold text-slate-500">{from.slice(5).replace("-", "/")} ~ {addDaysKey(from, span - 1).slice(5).replace("-", "/")}</span>
            <button type="button" disabled={!!policy && addDaysKey(from, span) > addDaysKey(today, policy.maxAdvanceDays)} onClick={() => setFrom(addDaysKey(from, span))}
              className="rounded-lg border border-border p-1.5 text-navy disabled:opacity-30" aria-label="다음 기간"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WD.map((w, i) => <span key={w} className={cn("pb-1 text-[11px] font-semibold", i === 0 ? "text-red-500" : i === 6 ? "text-blue-600" : "text-slate-400")}>{w}</span>)}
          {Array.from({ length: firstWd }).map((_, i) => <span key={`b${i}`} />)}
          {calLoading && days.length === 0 ? (
            <div className="col-span-7 flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />예약 현황 확인 중...</div>
          ) : days.map((d) => {
            const disabled = d.level === "closed" || d.level === "out" || d.level === "full";
            const active = value.date === d.date;
            return (
              <button key={d.date} type="button" disabled={disabled && !active}
                onClick={() => onChange({ ...value, date: d.date, start: "" })}
                title={d.reason ?? LEVEL[d.level].label}
                className={cn("flex min-h-[52px] flex-col items-center justify-center rounded-xl border text-sm font-bold transition", LEVEL[d.level].cls,
                  active && "!border-navy !bg-navy !text-white shadow-md", disabled && !active && "cursor-not-allowed")}>
                <span>{Number(d.date.slice(8))}</span>
                <span className={cn("text-[11px] font-semibold", active ? "text-white/80" : "")}>{d.date === today ? "오늘" : LEVEL[d.level].label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-300" />여유</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-amber-300" />마감 임박</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-red-200" />마감</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-slate-200" />휴무</span>
        </div>
      </div>

      {/* 이용 시간 */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-navy"><Hourglass className="h-4 w-4 text-brand-500" />이용 시간</p>
        <div className="flex flex-wrap gap-1.5">
          {durations.map((h) => (
            <button key={h} type="button" onClick={() => onChange({ ...value, hours: h, start: "" })}
              className={cn("min-h-[40px] rounded-full border px-3.5 text-sm font-semibold", Math.abs(value.hours - h) < 0.01 ? "border-navy bg-navy text-white" : "border-border bg-white text-navy hover:border-brand-300")}>
              {h}시간
            </button>
          ))}
        </div>
        {policy && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            최소 {policy.minHours}시간 · 최대 {policy.maxHours}시간{policy.buffer ? ` · 예약 사이 준비시간 ${policy.buffer}분` : ""}{policy.minLeadHours ? ` · 이용 ${policy.minLeadHours}시간 전까지 예약` : ""}
          </p>
        )}
      </div>

      {/* 시작 시각 */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-navy"><Clock className="h-4 w-4 text-brand-500" />시작 시간 {value.date && <span className="text-xs font-medium text-slate-500">· {value.date}</span>}</p>
        {!value.date ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">위 달력에서 날짜를 먼저 선택하세요.</p>
        ) : detailLoading && !detail ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />시간 확인 중...</div>
        ) : !detail ? (
          <p className="text-sm text-red-600">예약 현황을 불러오지 못했습니다.</p>
        ) : detail.closed ? (
          <p className="rounded-xl bg-red-50 px-3 py-4 text-center text-sm font-semibold text-red-600">예약 불가 · {detail.closedReason}</p>
        ) : (
          <>
            <Timeline detail={detail} start={value.start} hours={value.hours} />
            <div className={cn("mt-3 grid gap-1.5", compact ? "grid-cols-4" : "grid-cols-4 sm:grid-cols-6")}>
              {detail.options.filter((o) => o.status !== "closed").map((o) => {
                const active = value.start === o.time;
                const busy = o.status === "booked" || o.status === "pending";
                return (
                  <button key={o.time} type="button"
                    disabled={o.status === "past" || (o.status === "booked" && !onWaitlist)}
                    onClick={() => onChange({ ...value, start: o.time })}
                    className={cn("min-h-[44px] rounded-xl border text-sm font-bold transition",
                      o.status === "available" && "border-emerald-200 bg-white text-navy hover:border-emerald-500",
                      o.status === "pending" && "border-amber-200 bg-amber-50 text-amber-700",
                      o.status === "booked" && "border-slate-200 bg-slate-100 text-slate-400 line-through",
                      o.status === "past" && "border-slate-100 bg-slate-50 text-slate-300",
                      active && "!border-navy !bg-navy !text-white !no-underline")}>
                    {o.time}
                    {busy && <span className="block text-[11px] font-semibold no-underline">{o.status === "pending" ? "승인 대기중" : "예약됨"}</span>}
                  </button>
                );
              })}
            </div>
            {detail.options.every((o) => o.status !== "available") && (
              <p className="mt-2 text-xs font-semibold text-amber-700">선택한 이용 시간으로는 남은 자리가 없습니다. 이용 시간을 줄이거나 다른 날짜를 선택하세요.</p>
            )}
            {value.start && selected && (
              selected.status === "available" ? (
                <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800">✓ {value.date} {value.start} ~ {endOf(value.start, value.hours)} ({value.hours}시간) 예약 가능</p>
              ) : (selected.status === "pending" || selected.status === "booked") && onWaitlist ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                  <Info className="h-4 w-4 shrink-0" />
                  <span className="flex-1">이 시간은 다른 셀러가 {selected.status === "pending" ? "먼저 신청해 승인 대기 중" : "예약"}입니다. 대기 신청하면 자리가 났을 때 알려드려요.</span>
                  <button type="button" onClick={() => onWaitlist({ ...value })} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white">대기 신청</button>
                </div>
              ) : null
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Timeline({ detail, start, hours }: { detail: DayDetail; start: string; hours: number }) {
  const o = Math.min(...detail.windows.map((w) => toMin(w.start)));
  const c = Math.max(...detail.windows.map((w) => (w.end === "24:00" ? 1440 : toMin(w.end))));
  const span = Math.max(60, c - o);
  const pos = (a: number, b: number) => ({ left: `${Math.max(0, ((a - o) / span) * 100)}%`, width: `${Math.max(0, ((Math.min(b, c) - Math.max(a, o)) / span) * 100)}%` });
  const marks = [] as number[];
  for (let m = Math.ceil(o / 120) * 120; m <= c; m += 120) marks.push(m);
  return (
    <div>
      <div className="relative h-8 overflow-hidden rounded-lg bg-slate-100">
        {detail.windows.map((w, i) => <div key={i} className="absolute inset-y-0 bg-emerald-100" style={pos(toMin(w.start), w.end === "24:00" ? 1440 : toMin(w.end))} />)}
        {detail.booked.map((b, i) => <div key={i} className={cn("absolute inset-y-0", b.status === "BLOCKED" ? "bg-slate-300" : b.status === "APPROVED" ? "bg-red-300" : "bg-amber-200")} style={pos(toMin(b.start), b.end === "24:00" ? 1440 : toMin(b.end))} title={`${b.start}~${b.end}`} />)}
        {start && <div className="absolute inset-y-1 rounded border-2 border-navy bg-navy/10" style={pos(toMin(start), toMin(start) + hours * 60)} />}
      </div>
      <div className="relative mt-1 h-3 text-[11px] text-muted-foreground">
        {marks.map((m) => <span key={m} className="absolute -translate-x-1/2" style={{ left: `${((m - o) / span) * 100}%` }}>{toHm(m).slice(0, 2)}시</span>)}
      </div>
    </div>
  );
}
