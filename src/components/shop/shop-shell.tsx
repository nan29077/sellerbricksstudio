import type { LucideIcon } from "lucide-react";
import { ShopImage } from "./shop-image";
import { ShopNav } from "./shop-nav";

type ShopLink = { href: string; label: string; icon: LucideIcon };

export function ShopShell({ background, fallback, links, children, frame = "shop" }: {
  background: string;
  fallback: string;
  links: ShopLink[];
  children: React.ReactNode;
  // shop: 단독 샵 화면 · inline: 메인(스튜디오) 화면이나 대시보드 안에 넣어 보여 줄 때 (2026-11-14)
  frame?: "shop" | "inline";
}) {
  if (frame === "inline") {
    return (
      <div className="relative overflow-hidden bg-[#fbf8f0] text-navy">
        <nav aria-label="샵 메뉴" className="flex gap-1.5 overflow-x-auto border-b border-[#E8E5DD] bg-white px-3 py-2 sm:px-6">
          {links.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-navy hover:text-navy">
              <Icon aria-hidden="true" strokeWidth={1.8} className="h-4 w-4" />{label}
            </a>
          ))}
        </nav>
        {children}
      </div>
    );
  }
  return (
    <div className="relative min-h-screen bg-[#eee7db] text-navy">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 hidden lg:grid lg:grid-cols-[1fr_716px_1fr]">
        <ShopImage src={background} fallback={fallback} eager className="h-screen w-full object-cover object-[8%_50%]" />
        <ShopImage src={background} fallback={fallback} eager className="col-start-3 h-screen w-full object-cover object-[92%_50%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#f9f4e8]/10 via-transparent to-[#efe5d5]/40" />
      </div>
      <div className="relative mx-auto min-h-screen w-full max-w-[716px] bg-[#fbf8f0] pb-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-[0_0_52px_#1A1A2E29] lg:pb-0">
        {children}
        <ShopNav items={links.map(({ href, label, icon: Icon }) => ({ href, label, icon: <Icon aria-hidden="true" strokeWidth={1.6} className="h-5 w-5" /> }))} />
      </div>
    </div>
  );
}
