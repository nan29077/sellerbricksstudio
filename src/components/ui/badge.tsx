import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  default: "bg-brand-100 text-brand-700 border-brand-300",
  brand:   "bg-brand-100 text-brand-700 border-brand-300",
  gray:    "bg-slate-100 text-slate-700 border-slate-200",
  green:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  red:     "bg-red-50 text-red-700 border-red-200",
  yellow:  "bg-honey-100 text-amber-700 border-honey-300",
  blue:    "bg-blue-50 text-blue-700 border-blue-200",
  navy:    "bg-navy text-white border-navy",
  purple:  "bg-purple-50 text-purple-700 border-purple-200",
};

export function Badge({ children, tone = "default", className }: { children: React.ReactNode; tone?: keyof typeof styles; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", styles[tone], className)}>{children}</span>;
}
