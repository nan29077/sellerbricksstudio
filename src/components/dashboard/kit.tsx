import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 역할별 대시보드 공용 위젯 (서버 컴포넌트 전용, 외부 차트 라이브러리 없음)
 * 브랜드: 네이비 #1A1A2E · 골드 #F5A623
 */

type Icon = React.ElementType;
export type Tone = "brand" | "navy" | "green" | "blue" | "violet" | "red" | "amber" | "sky" | "slate";

export const TONES: Record<Tone, { soft: string; text: string; hex: string }> = {
  brand: { soft: "bg-brand-50", text: "text-brand-700", hex: "#F5A623" },
  navy: { soft: "bg-navy/[0.06]", text: "text-navy", hex: "#1A1A2E" },
  green: { soft: "bg-emerald-50", text: "text-emerald-700", hex: "#10B981" },
  blue: { soft: "bg-blue-50", text: "text-blue-700", hex: "#3B82F6" },
  violet: { soft: "bg-violet-50", text: "text-violet-700", hex: "#8B5CF6" },
  red: { soft: "bg-rose-50", text: "text-rose-600", hex: "#F43F5E" },
  amber: { soft: "bg-amber-50", text: "text-amber-700", hex: "#F59E0B" },
  sky: { soft: "bg-sky-50", text: "text-sky-700", hex: "#0EA5E9" },
  slate: { soft: "bg-slate-100", text: "text-slate-600", hex: "#94A3B8" },
};

/* ───────────────────────── 레이아웃 ───────────────────────── */

export function DashHero({ eyebrow, title, description, chips, actions, aside }: {
  eyebrow: string; title: string; description?: string;
  chips?: { label: string; tone?: "default" | "warn" | "live" }[];
  actions?: React.ReactNode; aside?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-[28px] bg-navy text-white shadow-[0_18px_50px_#1A1A2E30]">
      <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
      <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className={cn("relative grid gap-6 p-6 sm:p-8", aside && "lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:items-center")}>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold tracking-[0.2em] text-brand-300">{eyebrow}</p>
          <h1 className="mt-2 break-keep text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          {description && <p className="mt-2 max-w-xl break-keep text-sm leading-6 text-white/70">{description}</p>}
          {chips && chips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((c) => (
                <span key={c.label} className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold",
                  c.tone === "warn" ? "border-amber-300/40 bg-amber-400/15 text-amber-200"
                    : c.tone === "live" ? "border-rose-300/40 bg-rose-500/20 text-rose-100"
                    : "border-white/20 bg-white/10 text-white/85",
                )}>
                  {c.tone === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />}
                  {c.label}
                </span>
              ))}
            </div>
          )}
          {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
        </div>
        {aside}
      </div>
    </section>
  );
}

export function HeroButton({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={cn(
      "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition",
      primary ? "bg-brand-500 text-navy hover:bg-brand-400" : "border border-white/25 bg-white/10 text-white hover:bg-white/20",
    )}>{children}</Link>
  );
}

/** 히어로 오른쪽에 들어가는 반투명 정보 카드 */
export function HeroPanel({ title, children, href, cta }: { title: string; children: React.ReactNode; href?: string; cta?: string }) {
  return (
    <div className="rounded-[22px] border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm">
      <p className="text-[11px] font-bold tracking-wider text-white/60">{title}</p>
      <div className="mt-2">{children}</div>
      {href && (
        <Link href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-300 hover:text-white">
          {cta ?? "자세히"}<ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

export function Panel({ eyebrow, title, action, children, className, bodyClassName }: {
  eyebrow?: string; title: string; action?: { href: string; label: string } | React.ReactNode;
  children: React.ReactNode; className?: string; bodyClassName?: string;
}) {
  const isLink = !!action && typeof action === "object" && "href" in (action as object) && "label" in (action as object);
  return (
    <section className={cn("min-w-0 rounded-[24px] border border-[#E9E5DC] bg-white p-5 shadow-sm sm:p-6", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-[10px] font-extrabold tracking-[0.18em] text-brand-700">{eyebrow}</p>}
          <h2 className="mt-0.5 break-keep text-base font-extrabold text-navy sm:text-lg">{title}</h2>
        </div>
        {isLink ? (
          <Link href={(action as { href: string }).href} className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-xs font-bold text-brand-700 hover:bg-brand-50 hover:text-navy">
            {(action as { label: string }).label}<ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (action as React.ReactNode)}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function SectionTitle({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-extrabold tracking-[0.18em] text-brand-700">{eyebrow}</p>
        <h2 className="mt-0.5 text-lg font-extrabold text-navy sm:text-xl">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function Empty({ icon: I, text, action }: { icon?: Icon; text: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#F9F7F2] px-4 py-8 text-center">
      {I && <I className="h-7 w-7 text-slate-300" />}
      <p className="break-keep text-sm text-slate-500">{text}</p>
      {action && (
        <Link href={action.href} className="mt-1 inline-flex items-center gap-1 rounded-full bg-navy px-3 py-1.5 text-xs font-bold text-white hover:bg-navy-700">
          {action.label}<ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

export function DataNotice() {
  return (
    <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-bold">데이터를 불러오지 못했습니다</p>
      <p className="mt-1 text-amber-800">데이터베이스 연결을 확인해 주세요. 연결되면 수치가 자동으로 표시됩니다.</p>
    </div>
  );
}

/* ───────────────────────── 지표 ───────────────────────── */

export function Delta({ value, suffix = "%", invert }: { value: number | null | undefined; suffix?: string; invert?: boolean }) {
  if (value === null || value === undefined) return <span className="text-[11px] font-semibold text-slate-400">비교 없음</span>;
  const good = invert ? value < 0 : value > 0;
  const bad = invert ? value > 0 : value < 0;
  return (
    <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-extrabold",
      good ? "bg-emerald-50 text-emerald-700" : bad ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500")}>
      {value > 0 ? "▲" : value < 0 ? "▼" : "–"} {Math.abs(value)}{suffix}
    </span>
  );
}

export function Sparkline({ values, tone = "brand", className }: { values: number[]; tone?: Tone; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 28 - (v / max) * 24] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const id = `sp-${tone}-${values.length}-${Math.round(max)}`;
  const c = TONES[tone].hex;
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn("h-8 w-full", className)} aria-hidden>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={c} stopOpacity="0.28" /><stop offset="100%" stopColor={c} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,30 ${line} 100,30`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={c} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function KpiTile({ label, value, unit, delta, deltaInvert, sub, icon: I, tone = "brand", href, spark, emphasis }: {
  label: string; value: string; unit?: string; delta?: number | null; deltaInvert?: boolean; sub?: string;
  icon?: Icon; tone?: Tone; href?: string; spark?: number[]; emphasis?: boolean;
}) {
  const t = TONES[tone];
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-bold text-slate-500">{label}</p>
        {I && <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", t.soft, t.text)}><I className="h-4 w-4" /></span>}
      </div>
      <p className={cn("mt-2 break-all text-[22px] font-extrabold leading-tight tracking-tight sm:text-2xl", emphasis ? "text-brand-700" : "text-navy")}>
        {value}{unit && <span className="ml-0.5 text-sm font-bold text-slate-400">{unit}</span>}
      </p>
      <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-1.5">
        {delta !== undefined && <Delta value={delta} invert={deltaInvert} />}
        {sub && <span className="truncate text-[11px] text-slate-500">{sub}</span>}
      </div>
      {spark && <Sparkline values={spark} tone={tone} className="mt-2" />}
    </>
  );
  const cls = cn("group relative min-w-0 rounded-[20px] border bg-white p-4 shadow-sm transition",
    emphasis ? "border-brand-200 ring-1 ring-brand-100" : "border-[#E9E5DC]",
    href && "hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md");
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** 작은 지표 묶음 (라벨: 값) */
export function MiniStats({ items, className }: { items: { label: string; value: string; hint?: string }[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}>
      {items.map((s) => (
        <div key={s.label} className="min-w-0 rounded-2xl bg-[#F9F7F2] px-3 py-2.5">
          <p className="truncate text-[11px] font-semibold text-slate-500">{s.label}</p>
          <p className="mt-0.5 truncate text-base font-extrabold text-navy" title={s.hint}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── 차트 ───────────────────────── */

/**
 * 막대(보조 지표) + 영역선(주 지표) 복합 추이 차트.
 * 각 열에 마우스를 올리면 값이 표시된다.
 */
export function TrendChart({ data, a, b, height = 170 }: {
  data: { label: string; a: number; b?: number }[];
  a: { name: string; format: (n: number) => string; tone?: Tone };
  b?: { name: string; format: (n: number) => string };
  height?: number;
}) {
  const n = data.length;
  if (n === 0) return null;
  const maxA = Math.max(1, ...data.map((d) => d.a));
  const maxB = Math.max(1, ...data.map((d) => d.b ?? 0));
  const ca = TONES[a.tone ?? "brand"].hex;
  const pts = data.map((d, i) => [((i + 0.5) / n) * 100, 100 - (d.a / maxA) * 88] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const step = Math.max(1, Math.ceil(n / 8));
  const totalA = data.reduce((s, d) => s + d.a, 0);
  const totalB = data.reduce((s, d) => s + (d.b ?? 0), 0);
  const gid = `tc-${n}-${Math.round(maxA)}`;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600"><span className="h-2 w-4 rounded-full" style={{ background: ca }} />{a.name} <b className="text-navy">{a.format(totalA)}</b></span>
        {b && <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600"><span className="h-2.5 w-2.5 rounded-sm bg-navy/25" />{b.name} <b className="text-navy">{b.format(totalB)}</b></span>}
      </div>
      <div className="relative" style={{ height }}>
        {[0, 1, 2, 3].map((g) => <div key={g} aria-hidden className="absolute inset-x-0 border-t border-dashed border-slate-100" style={{ top: `${(g / 3) * 100}%` }} />)}
        {b && (
          <div className="absolute inset-0 flex items-end">
            {data.map((d, i) => (
              <div key={i} className="flex h-full flex-1 items-end justify-center px-[18%]">
                <div className="w-full max-w-[22px] rounded-t-[5px] bg-navy/[0.13]" style={{ height: `${Math.max((d.b ?? 0) > 0 ? 3 : 0, ((d.b ?? 0) / maxB) * 80)}%` }} />
              </div>
            ))}
          </div>
        )}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={ca} stopOpacity="0.3" /><stop offset="100%" stopColor={ca} stopOpacity="0" /></linearGradient></defs>
          <polygon points={`${pts[0][0]},100 ${line} ${pts[n - 1][0]},100`} fill={`url(#${gid})`} />
          <polyline points={line} fill="none" stroke={ca} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="absolute inset-0 flex">
          {data.map((d, i) => (
            <div key={i} className="group relative flex-1">
              <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white opacity-0 shadow transition group-hover:opacity-100" style={{ left: "50%", top: `${pts[i][1]}%`, background: ca }} />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-navy px-2.5 py-1.5 text-[11px] text-white shadow-lg group-hover:block">
                <p className="font-bold text-brand-300">{d.label}</p>
                <p>{a.name} {a.format(d.a)}</p>
                {b && <p className="text-white/70">{b.name} {b.format(d.b ?? 0)}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex">
        {data.map((d, i) => (
          <span key={i} className="flex-1 truncate text-center text-[10px] text-slate-400">{i % step === (n - 1) % step ? d.label : ""}</span>
        ))}
      </div>
    </div>
  );
}

export function Donut({ segments, centerValue, centerLabel, size = 132 }: {
  segments: { label: string; value: number; tone: Tone }[]; centerValue: string; centerLabel: string; size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 15.915; // 둘레 100
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="21" cy="21" r={r} fill="none" stroke="#F1EEE8" strokeWidth="5" />
          {total > 0 && segments.map((s) => {
            const len = (s.value / total) * 100;
            const el = <circle key={s.label} cx="21" cy="21" r={r} fill="none" stroke={TONES[s.tone].hex} strokeWidth="5" strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={-acc} />;
            acc += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div><p className="text-lg font-extrabold leading-none text-navy">{centerValue}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">{centerLabel}</p></div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONES[s.tone].hex }} />
            <span className="min-w-0 flex-1 truncate text-slate-600">{s.label}</span>
            <span className="font-bold text-navy">{s.value.toLocaleString("ko-KR")}</span>
            <span className="w-11 text-right text-xs text-slate-400">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 100% 누적 막대 */
export function StackBar({ segments }: { segments: { label: string; value: number; tone: Tone }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-[#F1EEE8]">
        {total > 0 && segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} title={`${s.label} ${s.value}`} style={{ width: `${(s.value / total) * 100}%`, background: TONES[s.tone].hex }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2 w-2 rounded-full" style={{ background: TONES[s.tone].hex }} />{s.label} <b className="text-navy">{s.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Heatmap({ rows, cols, values, unit = "건" }: { rows: string[]; cols: string[]; values: number[][]; unit?: string }) {
  const max = Math.max(1, ...values.flat());
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[340px] gap-1" style={{ gridTemplateColumns: `28px repeat(${cols.length}, minmax(0,1fr))` }}>
        <span />
        {cols.map((c) => <span key={c} className="pb-1 text-center text-[10px] font-semibold text-slate-400">{c}</span>)}
        {rows.map((r, ri) => (
          <div key={r} className="contents">
            <span className="self-center text-[11px] font-bold text-slate-500">{r}</span>
            {values[ri].map((v, ci) => {
              const t = v / max;
              return (
                <span key={ci} title={`${r} ${cols[ci]} · ${v}${unit}`}
                  className={cn("grid h-7 place-items-center rounded-md text-[10px] font-bold", t > 0.55 ? "text-navy" : "text-slate-500")}
                  style={{ background: v === 0 ? "#F6F4EF" : `rgba(245,166,35,${0.15 + t * 0.75})` }}>
                  {v > 0 ? v : ""}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
        적음{[0.15, 0.35, 0.6, 0.9].map((o) => <span key={o} className="h-2.5 w-4 rounded-sm" style={{ background: `rgba(245,166,35,${o})` }} />)}많음
      </div>
    </div>
  );
}

/** 0~100 원형 게이지 */
export function Gauge({ value, label, tone = "brand" }: { value: number; label: string; tone?: Tone }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="21" cy="21" r="15.915" fill="none" stroke="#F1EEE8" strokeWidth="4.5" />
        <circle cx="21" cy="21" r="15.915" fill="none" stroke={TONES[tone].hex} strokeWidth="4.5" strokeLinecap="round" strokeDasharray={`${v} ${100 - v}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div><p className="text-lg font-extrabold leading-none text-navy">{v}%</p><p className="mt-0.5 text-[10px] text-slate-500">{label}</p></div>
      </div>
    </div>
  );
}

export function Meter({ label, value, max, right, tone = "brand", sub }: {
  label: string; value: number; max: number; right?: React.ReactNode; tone?: Tone; sub?: string;
}) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-semibold text-navy" title={label}>{label}</span>
        <span className="shrink-0 text-xs font-bold text-navy">{right ?? value.toLocaleString("ko-KR")}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#F1EEE8]">
        <div className="h-full rounded-full" style={{ width: `${Math.max(w, value > 0 ? 2 : 0)}%`, background: TONES[tone].hex }} />
      </div>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

/* ───────────────────────── 목록 ───────────────────────── */

export type TodoItem = { label: string; desc?: string; n: number; href: string; icon: Icon; tone?: Tone; urgent?: boolean };

export function TodoList({ items, emptyText = "지금 처리할 일이 없어요" }: { items: TodoItem[]; emptyText?: string }) {
  const list = items.filter((t) => t.n > 0);
  if (list.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-700">
        <CheckCircle2 className="h-5 w-5 shrink-0" />{emptyText}
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {list.map((t) => {
        const tone = TONES[t.tone ?? "brand"];
        return (
          <li key={t.label}>
            <Link href={t.href} className={cn("group flex items-center gap-3 rounded-2xl border px-3 py-3 transition hover:border-brand-300 hover:bg-brand-50/50",
              t.urgent ? "border-rose-200 bg-rose-50/40" : "border-[#EEEAE2] bg-white")}>
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone.soft, tone.text)}><t.icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-bold text-navy">
                  <span className="truncate">{t.label}</span>
                  {t.urgent && <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-px text-[9px] font-extrabold text-white">긴급</span>}
                </span>
                {t.desc && <span className="block truncate text-xs text-slate-500">{t.desc}</span>}
              </span>
              <span className="shrink-0 rounded-full bg-navy px-2.5 py-0.5 text-xs font-extrabold text-white">{t.n.toLocaleString("ko-KR")}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand-700" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function RankList({ items, empty }: {
  items: { key: string; name: string; sub?: string; value: number; valueLabel: string; href?: string }[]; empty?: string;
}) {
  if (items.length === 0) return <Empty text={empty ?? "아직 데이터가 없습니다"} />;
  const max = Math.max(1, ...items.map((i) => i.value));
  const medal = ["bg-brand-500 text-navy", "bg-slate-300 text-navy", "bg-amber-700/80 text-white"];
  return (
    <ol className="space-y-3">
      {items.map((it, i) => {
        const row = (
          <div className="flex items-center gap-3">
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold", medal[i] ?? "bg-slate-100 text-slate-500")}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-navy">{it.name}</span>
                <span className="shrink-0 text-sm font-extrabold text-navy">{it.valueLabel}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F1EEE8]"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(it.value / max) * 100}%` }} /></div>
              {it.sub && <p className="mt-1 truncate text-[11px] text-slate-500">{it.sub}</p>}
            </div>
          </div>
        );
        return <li key={it.key}>{it.href ? <Link href={it.href} className="block rounded-xl p-1 -m-1 hover:bg-brand-50/60">{row}</Link> : row}</li>;
      })}
    </ol>
  );
}

export function Feed({ items, empty }: {
  items: { key: string; title: string; sub?: string; time: string; icon?: Icon; tone?: Tone; href?: string }[]; empty?: string;
}) {
  if (items.length === 0) return <Empty text={empty ?? "최근 활동이 없습니다"} />;
  return (
    <ul className="relative space-y-1 before:absolute before:bottom-3 before:left-[17px] before:top-3 before:w-px before:bg-[#EEEAE2]">
      {items.map((it) => {
        const t = TONES[it.tone ?? "slate"];
        const I = it.icon;
        const row = (
          <div className="relative flex gap-3 rounded-xl px-1 py-2">
            <span className={cn("relative z-[1] grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-white", t.soft, t.text)}>
              {I ? <I className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="break-keep text-sm font-semibold text-navy">{it.title}</p>
              {it.sub && <p className="truncate text-xs text-slate-500">{it.sub}</p>}
            </div>
            <span className="shrink-0 pt-1 text-[11px] text-slate-400">{it.time}</span>
          </div>
        );
        return <li key={it.key}>{it.href ? <Link href={it.href} className="block rounded-xl hover:bg-brand-50/50">{row}</Link> : row}</li>;
      })}
    </ul>
  );
}

export function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: Tone }) {
  const t = TONES[tone];
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold", t.soft, t.text)}>{children}</span>;
}

/** 하루 일정 타임라인: 행(창고) × 시간축 */
export function DayTimeline({ rows, from = 8, to = 24, now }: {
  rows: { key: string; label: string; blocks: { key: string; start: number; end: number; title: string; sub?: string; tone?: Tone; href?: string }[] }[];
  from?: number; to?: number; now?: number;
}) {
  const span = to - from;
  const ticks = Array.from({ length: Math.floor(span / 2) + 1 }, (_, i) => from + i * 2);
  const pos = (h: number) => `${((Math.min(Math.max(h, from), to) - from) / span) * 100}%`;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="relative ml-28 h-5">
          {ticks.map((t) => <span key={t} className="absolute -translate-x-1/2 text-[10px] font-semibold text-slate-400" style={{ left: pos(t) }}>{t}시</span>)}
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-2">
              <span className="w-[104px] shrink-0 truncate text-xs font-bold text-navy" title={r.label}>{r.label}</span>
              <div className="relative h-11 flex-1 rounded-xl bg-[#F6F4EF]">
                {ticks.map((t) => <span key={t} aria-hidden className="absolute inset-y-0 border-l border-dashed border-white" style={{ left: pos(t) }} />)}
                {r.blocks.map((b) => {
                  const t = TONES[b.tone ?? "brand"];
                  const style = { left: pos(b.start), width: `calc(${pos(b.end)} - ${pos(b.start)})` };
                  const inner = (
                    <>
                      <span className="block truncate text-[11px] font-bold">{b.title}</span>
                      {b.sub && <span className="block truncate text-[10px] opacity-75">{b.sub}</span>}
                    </>
                  );
                  const cls = cn("absolute inset-y-1 overflow-hidden rounded-lg border-l-[3px] px-2 py-0.5 leading-tight", t.soft, t.text);
                  return b.href
                    ? <Link key={b.key} href={b.href} title={`${b.title} ${b.sub ?? ""}`} className={cn(cls, "hover:brightness-95")} style={{ ...style, borderColor: t.hex }}>{inner}</Link>
                    : <div key={b.key} title={`${b.title} ${b.sub ?? ""}`} className={cls} style={{ ...style, borderColor: t.hex }}>{inner}</div>;
                })}
                {now !== undefined && now >= from && now <= to && (
                  <span aria-label="현재 시각" className="absolute inset-y-0 z-[1] w-0.5 bg-rose-500" style={{ left: pos(now) }}>
                    <span className="absolute -left-[3px] -top-1 h-2 w-2 rounded-full bg-rose-500" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ShortcutGrid({ items, cols = "sm:grid-cols-2 xl:grid-cols-3" }: {
  items: { title: string; desc: string; href: string; icon: Icon; tone?: Tone; badge?: number }[]; cols?: string;
}) {
  return (
    <div className={cn("grid gap-2.5", cols)}>
      {items.map((a) => {
        const t = TONES[a.tone ?? "brand"];
        return (
          <Link key={a.href + a.title} href={a.href} className="group flex items-center gap-3 rounded-2xl border border-[#EEEAE2] bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-sm">
            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", t.soft, t.text)}><a.icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-navy">{a.title}</span>
              <span className="block truncate text-xs text-slate-500">{a.desc}</span>
            </span>
            {a.badge ? <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-white">{a.badge}</span>
              : <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand-700" />}
          </Link>
        );
      })}
    </div>
  );
}
