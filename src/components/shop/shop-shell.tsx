import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ShopImage } from "./shop-image";

type ShopLink = { href: string; label: string; icon: LucideIcon };

export function ShopShell({ background, fallback, links, children }: {
  background: string;
  fallback: string;
  links: ShopLink[];
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-[#eee7db] text-navy">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 hidden lg:grid lg:grid-cols-[1fr_716px_1fr]">
        <ShopImage src={background} fallback={fallback} eager className="h-screen w-full object-cover object-[8%_50%]" />
        <ShopImage src={background} fallback={fallback} eager className="col-start-3 h-screen w-full object-cover object-[92%_50%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#f9f4e8]/10 via-transparent to-[#efe5d5]/40" />
      </div>
      <div className="relative mx-auto min-h-screen w-full max-w-[716px] bg-[#fbf8f0] pb-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-[0_0_52px_#1A1A2E29] lg:pb-0">
        {children}
        <nav aria-label="샵 메뉴"
          className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-[716px] -translate-x-1/2 justify-around gap-1 border-t border-slate-200 bg-white/95 p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur lg:bottom-auto lg:left-[calc(50%+368px)] lg:top-1/2 lg:w-[90px] lg:translate-x-0 lg:-translate-y-1/2 lg:flex-col lg:rounded-[22px] lg:border lg:border-white/70 lg:p-1.5">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-center text-[10px] font-bold leading-tight text-slate-600 first:bg-brand-50 first:text-navy hover:bg-brand-50 hover:text-navy focus-visible:outline-brand-500">
              <Icon aria-hidden="true" className="h-[19px] w-[19px]" />{label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
