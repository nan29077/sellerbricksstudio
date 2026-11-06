"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterField =
  | { type: "search"; key: string; placeholder?: string }
  | { type: "select"; key: string; label: string; options: { value: string; label: string }[] }
  | { type: "date"; key: string; label: string };

// URL 쿼리스트링 기반 목록 필터. 적용 시 page 파라미터는 초기화된다.
export function FilterBar({ fields, className }: { fields: FilterField[]; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, params.get(f.key) ?? ""])),
  );

  function apply(next: Record<string, string>) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) { if (v) q.set(k, v); else q.delete(k); }
    q.delete("page");
    start(() => router.push(`${pathname}${q.toString() ? `?${q}` : ""}`));
  }
  const hasValue = fields.some((f) => params.get(f.key));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); apply(values); }}
      className={cn("flex flex-wrap items-end gap-2 rounded-2xl border border-[#E9E5DC] bg-white p-3 shadow-sm", pending && "opacity-70", className)}
    >
      {fields.map((f) => {
        if (f.type === "search") return (
          <div key={f.key} className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={values[f.key]} placeholder={f.placeholder ?? "검색"}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        );
        if (f.type === "select") return (
          <label key={f.key} className="flex flex-col text-[11px] font-semibold text-slate-500">
            {f.label}
            <select
              value={values[f.key]}
              onChange={(e) => { const nv = { ...values, [f.key]: e.target.value }; setValues(nv); apply(nv); }}
              className="mt-1 h-10 rounded-lg border border-border bg-white px-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">전체</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        );
        return (
          <label key={f.key} className="flex flex-col text-[11px] font-semibold text-slate-500">
            {f.label}
            <input
              type="date" value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="mt-1 h-10 rounded-lg border border-border bg-white px-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
        );
      })}
      <button type="submit" className="h-10 rounded-lg bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-700">조회</button>
      {hasValue && (
        <button
          type="button"
          onClick={() => { const empty = Object.fromEntries(fields.map((f) => [f.key, ""])); setValues(empty); apply(empty); }}
          className="flex h-10 items-center gap-1 rounded-lg border border-border px-3 text-sm text-slate-500 hover:bg-muted"
        ><RotateCcw className="h-3.5 w-3.5" />초기화</button>
      )}
    </form>
  );
}
