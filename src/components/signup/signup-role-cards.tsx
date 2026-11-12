import Link from "next/link";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cardLinkClassName } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { visibleSignupRoles } from "@/lib/signup-roles";

const roleIconColors = {
  SELLER: "bg-brand-100 text-brand-800",
  BRAND_ADMIN: "bg-teal-50 text-teal-800",
  FACILITY_ADMIN: "bg-indigo-50 text-indigo-800",
};

// 가입 유형 카드: home = 메인페이지 3단 카드, page = 가입 선택 화면 세로 목록
export function SignupRoleCards({ facilityDisabled, variant }: { facilityDisabled: boolean; variant: "home" | "page" }) {
  const roles = visibleSignupRoles(facilityDisabled);
  const home = variant === "home";
  return (
    <ul className={cn("grid gap-3", home && (roles.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"))}>
      {roles.map(({ role, href, icon: Icon, title, summary, points, cta }) => (
        <li key={role} className="min-w-0">
          <Link href={href} aria-label={cta} className={cn(cardLinkClassName, "p-4")}>
            <div className={cn("flex items-center gap-3", home && "sm:flex-col sm:items-start")}>
              <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", roleIconColors[role])}>
                <Icon aria-hidden="true" strokeWidth={1.8} className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-black tracking-tight text-navy">{title}</h3>
                <p className="mt-0.5 break-keep text-sm leading-5 text-slate-600">{summary}</p>
              </div>
            </div>
            <ul className="mb-4 mt-3 flex-1 space-y-1.5 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-700">
              {points.map((point) => <li key={point} className="flex items-start gap-2"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-800" />{point}</li>)}
            </ul>
            <span className={cn(buttonVariants({ variant: "secondary" }), "w-full rounded-xl px-2 font-bold group-hover:bg-navy-700 group-focus-visible:bg-navy-700")}>
              {cta}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
