import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { withParams, type SP } from "@/lib/list";

export function Pagination({ base, params, page, size, total }: { base: string; params: SP; page: number; size: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return <p className="mt-3 text-xs text-slate-500">총 {total.toLocaleString()}건</p>;
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const btn = "flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-semibold";
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-slate-500">총 {total.toLocaleString()}건 · {page}/{pages} 페이지</p>
      <div className="flex gap-1">
        {page > 1 && <Link className={cn(btn, "border-border bg-white")} href={withParams(base, params, { page: page - 1 })}><ChevronLeft className="h-4 w-4" /></Link>}
        {nums.map((n) => (
          <Link key={n} href={withParams(base, params, { page: n })}
            className={cn(btn, n === page ? "border-navy bg-navy text-white" : "border-border bg-white text-navy hover:bg-brand-50")}>{n}</Link>
        ))}
        {page < pages && <Link className={cn(btn, "border-border bg-white")} href={withParams(base, params, { page: page + 1 })}><ChevronRight className="h-4 w-4" /></Link>}
      </div>
    </div>
  );
}
