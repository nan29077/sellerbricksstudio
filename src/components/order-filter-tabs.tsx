import Link from "next/link";
import { cn } from "@/lib/utils";
import { withParams, type SP } from "@/lib/list";
import { ORDER_FILTERS } from "@/lib/order-view";

// 주문 현황 상단: 상태 필터 + 주문번호 · 받는 분 검색 + 출고 대기 목록(엑셀) 내려받기
export function OrderFilterTabs({ base, params, current, q, exportHref }: { base: string; params: SP; current: string; q: string; exportHref?: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {ORDER_FILTERS.map((f) => (
          <Link key={f.key} href={withParams(base, params, { status: f.key || undefined, page: undefined })}
            className={cn("inline-flex min-h-[40px] items-center rounded-full border px-3 text-xs font-bold", current === f.key ? "border-navy bg-navy text-white" : "border-border bg-white text-slate-600 hover:bg-brand-50")}>{f.label}</Link>
        ))}
      </div>
      <form action={base} className="ml-auto flex items-center gap-1.5">
        {current && <input type="hidden" name="status" value={current} />}
        <input name="q" defaultValue={q} placeholder="주문번호 · 받는 분" aria-label="주문 검색" className="h-10 w-40 rounded-lg border border-border px-2.5 text-sm" />
        <button className="h-10 rounded-lg border border-border bg-white px-3 text-xs font-bold text-navy hover:bg-brand-50">검색</button>
      </form>
      {exportHref && <a href={exportHref} className="inline-flex h-10 items-center rounded-lg bg-navy px-3 text-xs font-bold text-white hover:opacity-90">출고 대기 목록 내려받기</a>}
    </div>
  );
}
