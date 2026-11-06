import Link from "next/link";
import { cn } from "@/lib/utils";
import { withParams, type SP } from "@/lib/list";

export function StatusTabs({
  base, params, tabs, paramKey = "status",
}: {
  base: string; params: SP; paramKey?: string;
  tabs: { value: string; label: string; count?: number }[];
}) {
  const current = (Array.isArray(params[paramKey]) ? params[paramKey]?.[0] : params[paramKey]) ?? "";
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => {
        const active = current === t.value;
        return (
          <Link
            key={t.value || "all"}
            href={withParams(base, params, { [paramKey]: t.value, page: undefined })}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
              active ? "border-navy bg-navy text-white" : "border-[#E5E0D6] bg-white text-slate-600 hover:border-brand-300",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("rounded-full px-1.5 text-[11px]", active ? "bg-white/20" : "bg-slate-100 text-slate-500")}>{t.count}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
