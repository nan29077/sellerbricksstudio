import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, LayoutGrid, List } from "lucide-react";
import { ShopImage } from "@/components/shop/shop-image";
import { withParams, sp, type SP } from "@/lib/list";
import { cn } from "@/lib/utils";

// 2026-11-14: 셀러 · 브랜드 · 최고관리자 화면의 상품 카드를 하나로 통일한다.
//  - 카드형(grid) / 리스트형(list) 두 가지 보기, 주소의 ?view=list 로 바꾼다.
//  - 배지 색은 여기 정의된 tone 만 쓴다 (화면마다 제각각이던 색 정리).

export type ProductView = "grid" | "list";
export type ChipTone = "green" | "red" | "gray" | "amber" | "violet" | "navy" | "brand" | "blue";

const CHIP: Record<ChipTone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  red: "bg-rose-50 text-rose-700 ring-rose-200/70",
  gray: "bg-slate-100 text-slate-600 ring-slate-200/70",
  amber: "bg-amber-50 text-amber-700 ring-amber-200/70",
  violet: "bg-violet-50 text-violet-700 ring-violet-200/70",
  navy: "bg-navy text-white ring-navy",
  brand: "bg-brand-50 text-brand-800 ring-brand-200/70",
  blue: "bg-sky-50 text-sky-700 ring-sky-200/70",
};
// 사진 위에 올리는 상태 배지 (불투명)
const SOLID: Record<ChipTone, string> = {
  green: "bg-emerald-600 text-white", red: "bg-rose-600 text-white", gray: "bg-slate-700 text-white",
  amber: "bg-amber-500 text-white", violet: "bg-violet-600 text-white", navy: "bg-navy text-white",
  brand: "bg-brand-500 text-navy", blue: "bg-sky-600 text-white",
};

export type Chip = { label: string; tone: ChipTone };

export function ProductChip({ chip, className }: { chip: Chip; className?: string }) {
  return <span className={cn("inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-md px-1.5 text-[10.5px] font-bold leading-none ring-1 ring-inset", CHIP[chip.tone], className)}>{chip.label}</span>;
}

export function viewOf(params: SP, fallback: ProductView = "grid"): ProductView {
  const v = sp(params, "view");
  return v === "list" ? "list" : v === "grid" ? "grid" : fallback;
}

/** 카드형 · 리스트형 보기 전환 버튼 */
export function ViewToggle({ base, params, view, className }: { base: string; params: SP; view: ProductView; className?: string }) {
  const item = (value: ProductView, label: string, Icon: typeof List) => (
    <Link href={withParams(base, params, { view: value, page: null })} scroll={false} aria-label={`${label}로 보기`} aria-current={view === value ? "true" : undefined}
      className={cn("inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-bold transition",
        view === value ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy")}>
      <Icon className="h-4 w-4" aria-hidden /><span className="hidden min-[400px]:inline">{label}</span>
    </Link>
  );
  return (
    <div role="group" aria-label="보기 방식" className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-xl bg-slate-100 p-0.5", className)}>
      {item("grid", "카드형", LayoutGrid)}{item("list", "리스트형", List)}
    </div>
  );
}

/** 목록 상단 줄: 개수 · (필터) · 보기 전환 */
export function ProductToolbar({ count, unit = "개", children, toggle }: { count?: number; unit?: string; children?: ReactNode; toggle: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {count !== undefined && <p className="mr-auto text-sm font-bold text-navy">전체 <span className="text-brand-700">{count.toLocaleString("ko-KR")}</span>{unit}</p>}
      {children}
      <div className="ml-auto">{toggle}</div>
    </div>
  );
}

/** 카드형: 모바일 2줄 · 태블릿 3 · PC 4 · 넓은 PC 5개 / 리스트형: 한 줄씩 */
export function ProductGrid({ view, children, narrow = false, className }: { view: ProductView; children: ReactNode; narrow?: boolean; className?: string }) {
  return (
    <ul className={cn(view === "list" ? "flex flex-col gap-2.5"
      : narrow ? "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"
        : "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5", className)}>
      {children}
    </ul>
  );
}

export type ProductCardProps = {
  view?: ProductView;
  href?: string;
  /** 클라이언트 화면에서 사진을 누르면 상세 창을 여는 경우 */
  onOpen?: () => void;
  image?: string | null;
  fallback: string;
  title: string;
  brand?: { name: string; logo?: string | null; logoFallback?: string; href?: string };
  /** 사진 왼쪽 위 상태 배지 */
  status?: Chip;
  /** 사진 오른쪽 위 (할인율 · 순위 등) */
  corner?: ReactNode;
  /** 사진을 흐리게 덮는 문구 (품절 등) */
  cover?: string;
  subtitle?: ReactNode;
  price?: ReactNode;
  chips?: (Chip | false | null | undefined)[];
  meta?: ReactNode;
  /** 리스트형에서 오른쪽에 크게 보여 줄 숫자 묶음 */
  aside?: ReactNode;
  actions?: ReactNode;
  /** 카드 맨 아래 전체 폭 영역 (신청 상세 등) */
  footer?: ReactNode;
  detailLabel?: string;
  /** 자세히 보기 버튼 숨기기 (actions 가 대신할 때) */
  hideDetail?: boolean;
  selected?: boolean;
  dim?: boolean;
  className?: string;
  as?: "li" | "div";
};

function Media({ href, onOpen, label, children, className }: { href?: string; onOpen?: () => void; label: string; children: ReactNode; className?: string }) {
  if (href) return <Link href={href} aria-label={label} className={cn("group/media", className)}>{children}</Link>;
  if (onOpen) return <button type="button" onClick={onOpen} aria-label={label} className={cn("group/media text-left", className)}>{children}</button>;
  return <div className={className}>{children}</div>;
}

export function ProductCard(p: ProductCardProps) {
  const view = p.view ?? "grid";
  const Tag = p.as ?? "li";
  const chips = (p.chips ?? []).filter(Boolean) as Chip[];
  const label = `${p.title} 자세히 보기`;
  const img = (
    <>
      <ShopImage src={p.image} fallback={p.fallback} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover/media:scale-[1.04] motion-reduce:transition-none" />
      {p.cover && <span className="absolute inset-0 grid place-items-center bg-white/65 text-sm font-black text-slate-700 backdrop-blur-[1px]">{p.cover}</span>}
    </>
  );
  const brand = p.brand && (
    <span className="flex min-w-0 items-center gap-1.5">
      {(p.brand.logo || p.brand.logoFallback) && <ShopImage src={p.brand.logo} fallback={p.brand.logoFallback ?? p.fallback} alt="" className="h-4 w-4 shrink-0 rounded-full border border-slate-200 bg-white object-cover" />}
      {p.brand.href
        ? <Link href={p.brand.href} className="truncate text-[11px] font-semibold text-slate-500 hover:text-navy hover:underline">{p.brand.name}</Link>
        : <span className="truncate text-[11px] font-semibold text-slate-500">{p.brand.name}</span>}
    </span>
  );
  const title = p.href
    ? <Link href={p.href} className="line-clamp-2 break-keep text-[13.5px] font-extrabold leading-[1.35] tracking-tight text-navy hover:underline sm:text-sm">{p.title}</Link>
    : p.onOpen
      ? <button type="button" onClick={p.onOpen} className="line-clamp-2 break-keep text-left text-[13.5px] font-extrabold leading-[1.35] tracking-tight text-navy hover:underline sm:text-sm">{p.title}</button>
      : <p className="line-clamp-2 break-keep text-[13.5px] font-extrabold leading-[1.35] tracking-tight text-navy sm:text-sm">{p.title}</p>;
  const detail = !p.hideDetail && (p.href
    ? <Link href={p.href} className="inline-flex h-9 w-full items-center justify-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-navy transition hover:border-brand-300 hover:bg-brand-50">{p.detailLabel ?? "자세히 보기"}<ChevronRight className="h-3.5 w-3.5" aria-hidden /></Link>
    : p.onOpen
      ? <button type="button" onClick={p.onOpen} className="inline-flex h-9 w-full items-center justify-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-navy transition hover:border-brand-300 hover:bg-brand-50">{p.detailLabel ?? "자세히 보기"}<ChevronRight className="h-3.5 w-3.5" aria-hidden /></button>
      : null);
  const frame = cn("min-w-0 overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_#1A1A2E0D] transition-[border-color,box-shadow] hover:shadow-[0_8px_24px_#1A1A2E14]",
    p.selected ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200 hover:border-slate-300", p.dim && "bg-slate-50/60", p.className);

  if (view === "list") {
    return (
      <Tag className={cn(frame, "p-3")}>
       <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 gap-3">
          <Media href={p.href} onOpen={p.onOpen} label={label} className="relative block h-[84px] w-[84px] shrink-0 overflow-hidden rounded-xl bg-[#F4F0E9] sm:h-24 sm:w-24">
            {img}
            {p.status && <span className={cn("absolute left-1 top-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold shadow-sm", SOLID[p.status.tone])}>{p.status.label}</span>}
          </Media>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {brand}
            {title}
            {p.subtitle && <div className="text-[11px] text-slate-500">{p.subtitle}</div>}
            {p.price && <div className="sm:hidden">{p.price}</div>}
            {chips.length > 0 && <div className="flex flex-wrap gap-1">{chips.map((c) => <ProductChip key={c.label} chip={c} />)}</div>}
            {p.meta && <div className="text-[11px] leading-relaxed text-slate-500">{p.meta}</div>}
          </div>
        </div>
        {(p.price || p.aside) && <div className="hidden min-w-40 shrink-0 text-right sm:block">{p.aside ?? p.price}</div>}
        {(detail || p.actions) && (
          <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-slate-100 pt-3 [&>*]:min-w-[8.5rem] [&>*]:flex-1 [&>details[open]]:basis-full sm:w-44 sm:flex-col sm:flex-nowrap sm:border-0 sm:pt-0 sm:[&>*]:flex-none">
            {p.actions}{detail}
          </div>
        )}
       </div>
        {p.footer && <div className="mt-3 border-t border-slate-100 pt-3">{p.footer}</div>}
      </Tag>
    );
  }

  return (
    <Tag className={cn(frame, "flex flex-col")}>
      <Media href={p.href} onOpen={p.onOpen} label={label} className="relative block aspect-square overflow-hidden bg-[#F4F0E9]">
        {img}
        {p.status && <span className={cn("absolute left-2 top-2 rounded-md px-1.5 py-[3px] text-[10.5px] font-bold shadow-sm", SOLID[p.status.tone])}>{p.status.label}</span>}
        {p.corner && <span className="absolute right-2 top-2">{p.corner}</span>}
      </Media>
      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
        {brand}
        {title}
        {p.subtitle && <div className="truncate text-[11px] text-slate-500">{p.subtitle}</div>}
        {p.price && <div className="mt-1">{p.price}</div>}
        {chips.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{chips.map((c) => <ProductChip key={c.label} chip={c} />)}</div>}
        {p.meta && <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{p.meta}</div>}
        {(detail || p.actions) && <div className="mt-auto flex flex-col gap-1.5 pt-2.5">{p.actions}{detail}</div>}
        {p.footer && <div className={cn("pt-2", !(detail || p.actions) && "mt-auto")}>{p.footer}</div>}
      </div>
    </Tag>
  );
}

/** 가격 한 줄: 큰 금액 + 작은 설명 */
export function PriceLine({ label, value, strike, rate, tone = "navy", note }: { label?: string; value: string; strike?: string; rate?: number; tone?: "navy" | "brand" | "green"; note?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-baseline gap-x-1">
        {label && <span className="text-[11px] font-semibold text-slate-500">{label}</span>}
        {!!rate && rate > 0 && <span className="text-sm font-black text-rose-600">{rate}%</span>}
        <span className={cn("text-[15px] font-black tracking-tight", tone === "brand" ? "text-brand-700" : tone === "green" ? "text-emerald-700" : "text-navy")}>{value}</span>
        {strike && <s className="text-[11px] text-slate-400">{strike}</s>}
      </p>
      {note && <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{note}</p>}
    </div>
  );
}
