import type { LucideIcon } from "lucide-react";
import { ShopImage } from "./shop-image";
import { ShopNav } from "./shop-nav";

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
        <ShopNav items={links.map(({ href, label, icon: Icon }) => ({ href, label, icon: <Icon aria-hidden="true" strokeWidth={1.6} className="h-5 w-5" /> }))} />
      </div>
    </div>
  );
}
