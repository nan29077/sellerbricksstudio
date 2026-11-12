import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { addMonths, dateKey, hhmm, kstParts, kstDate, monthKey, WEEKDAYS } from "@/lib/kst";
import { withParams, type SP } from "@/lib/list";

export type CalEvent = { id: string; start: Date; end: Date; label: string; tone?: "yellow" | "green" | "red" | "gray" | "blue"; href?: string };

const TONE: Record<string, string> = {
  yellow: "bg-amber-100 text-amber-800 border-amber-200",
  green: "bg-emerald-100 text-emerald-800 border-emerald-200",
  red: "bg-red-100 text-red-700 border-red-200",
  gray: "bg-slate-100 text-slate-500 border-slate-200 line-through",
  blue: "bg-blue-100 text-blue-800 border-blue-200",
};

// KST 기준 월간 캘린더 (서버 컴포넌트). 이전/다음 달은 ?month=YYYY-MM 링크로 이동.
export function MonthCalendar({
  month, events, blackouts = [], base, params, monthParam = "month", maxPerDay = 3,
}: {
  month: Date; events: CalEvent[]; blackouts?: { date: Date; reason?: string | null }[];
  base: string; params: SP; monthParam?: string; maxPerDay?: number;
}) {
  const p = kstParts(month);
  const first = kstDate(p.year, p.month, 1);
  const firstWeekday = kstParts(first).weekday;
  const daysInMonth = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
  const today = dateKey(new Date());

  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) {
    const k = dateKey(e.start);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  byDay.forEach((list) => list.sort((a, b) => a.start.getTime() - b.start.getTime()));
  const off = new Map(blackouts.map((b) => [dateKey(b.date), b.reason ?? "휴무"]));

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#E9E5DC] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#EEEAE2] px-4 py-3">
        <Link href={withParams(base, params, { [monthParam]: monthKey(addMonths(first, -1)) })} className="rounded-lg p-2 hover:bg-muted" aria-label="이전 달"><ChevronLeft className="h-4 w-4" /></Link>
        <div className="text-center">
          <p className="text-base font-extrabold text-navy">{p.year}년 {p.month}월</p>
          <Link href={withParams(base, params, { [monthParam]: undefined })} className="hit text-[11px] font-semibold text-brand-700 hover:underline">오늘로</Link>
        </div>
        <Link href={withParams(base, params, { [monthParam]: monthKey(addMonths(first, 1)) })} className="rounded-lg p-2 hover:bg-muted" aria-label="다음 달"><ChevronRight className="h-4 w-4" /></Link>
      </div>
      <div className="grid grid-cols-7 border-b border-[#EEEAE2] bg-[#F9F7F2] text-center text-[11px] font-bold text-slate-500">
        {WEEKDAYS.map((w, i) => <div key={w} className={cn("py-2", i === 0 && "text-red-500", i === 6 && "text-blue-600")}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="min-h-[72px] border-b border-r border-[#F2EEE7] bg-slate-50/40 sm:min-h-[104px]" />;
          const k = `${p.year}-${String(p.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const list = byDay.get(k) ?? [];
          const closed = off.get(k);
          return (
            <div key={i} className={cn("min-h-[72px] border-b border-r border-[#F2EEE7] p-1 sm:min-h-[104px] sm:p-1.5", closed && "bg-red-50/60")}>
              <div className="flex items-center justify-between">
                <span className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                  k === today ? "bg-brand-500 text-navy" : i % 7 === 0 ? "text-red-500" : i % 7 === 6 ? "text-blue-600" : "text-navy",
                )}>{d}</span>
                {list.length > 0 && <span className="rounded-full bg-navy px-1.5 text-[11px] font-bold text-white sm:hidden">{list.length}</span>}
              </div>
              {closed && <p className="mt-0.5 truncate text-[11px] font-semibold text-red-500" title={closed}>휴무{closed !== "휴무" ? ` · ${closed}` : ""}</p>}
              <div className="mt-0.5 hidden space-y-0.5 sm:block">
                {list.slice(0, maxPerDay).map((e) => {
                  const body = <span className={cn("block truncate rounded border px-1 py-0.5 text-[11px] font-semibold", TONE[e.tone ?? "blue"])} title={`${hhmm(e.start)}~${hhmm(e.end)} ${e.label}`}>{hhmm(e.start)} {e.label}</span>;
                  return e.href ? <Link key={e.id} href={e.href}>{body}</Link> : <div key={e.id}>{body}</div>;
                })}
                {list.length > maxPerDay && <p className="text-[11px] font-semibold text-slate-500">+{list.length - maxPerDay}건</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
