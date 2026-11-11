import { cn } from "@/lib/utils";

// 서버 컴포넌트에서 쓰는 가벼운 막대 차트 (외부 라이브러리 없음)
export function BarChart({ data, format = (n) => n.toLocaleString(), height = 140, highlightLast = true }: {
  data: { label: string; value: number }[]; format?: (n: number) => string; height?: number; highlightLast?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height: height + 36 }}>
      {data.map((d, i) => {
        const h = Math.max(2, Math.round((d.value / max) * height));
        const last = highlightLast && i === data.length - 1;
        return (
          <div key={d.label + i} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="hidden text-[11px] font-bold text-navy group-hover:block sm:block sm:opacity-0 sm:group-hover:opacity-100">{format(d.value)}</span>
            <div className={cn("w-full max-w-[38px] rounded-t-md transition-all", last ? "bg-brand-500" : "bg-navy/80 group-hover:bg-navy")} style={{ height: h }} title={`${d.label}: ${format(d.value)}`} />
            <span className="w-full truncate text-center text-[11px] text-slate-500">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ProgressRow({ label, value, max, right, tone = "brand" }: {
  label: string; value: number; max: number; right?: React.ReactNode; tone?: "brand" | "navy" | "green" | "red";
}) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = { brand: "bg-brand-500", navy: "bg-navy", green: "bg-emerald-500", red: "bg-red-400" }[tone];
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-sm text-slate-600" title={label}>{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", color)} style={{ width: `${w}%` }} /></div>
      <span className="w-24 shrink-0 text-right text-xs font-semibold text-navy">{right ?? value.toLocaleString()}</span>
    </div>
  );
}

export function Kpi({ label, value, sub, delta, icon: Icon, tone = "brand" }: {
  label: string; value: string; sub?: string; delta?: number | null; icon?: React.ElementType; tone?: "brand" | "green" | "blue" | "red" | "purple" | "navy";
}) {
  const toneCls = {
    brand: "bg-brand-50 text-brand-700", green: "bg-emerald-50 text-emerald-700", blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-600", purple: "bg-purple-50 text-purple-700", navy: "bg-navy/10 text-navy",
  }[tone];
  return (
    <div className="rounded-[20px] border border-[#E9E5DC] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500 sm:text-sm">{label}</p>
        {Icon && <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneCls)}><Icon className="h-4 w-4" /></span>}
      </div>
      <p className="mt-2 text-xl font-extrabold tracking-tight text-navy sm:text-2xl">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
        {delta !== undefined && delta !== null && (
          <span className={cn("font-bold", delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-slate-400")}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "−"} {Math.abs(delta)}%
          </span>
        )}
        {sub && <span className="truncate">{sub}</span>}
      </div>
    </div>
  );
}
