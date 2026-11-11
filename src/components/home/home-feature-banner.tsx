import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type HomeFeatureBannerProps = {
  id: string;
  title: string;
  description: string;
  image: string;
  href: string;
  linkLabel: string;
  tone: "light" | "dark";
  className?: string;
};

export function HomeFeatureBanner({ id, title, description, image, href, linkLabel, tone, className }: HomeFeatureBannerProps) {
  const dark = tone === "dark";

  return (
    <section
      aria-labelledby={id}
      className={cn(
        "mx-4 grid overflow-hidden rounded-[24px] border sm:mx-6 sm:grid-cols-[1.1fr_1fr]",
        dark ? "border-navy bg-navy text-white" : "border-[#EBDDCA] bg-[#FFF5E2] text-navy",
        className,
      )}
    >
      <div className="row-start-2 self-center p-5 sm:row-start-1 sm:p-6">
        <h2 id={id} className="break-keep text-xl font-black leading-snug tracking-tight sm:text-[1.45rem]">{title}</h2>
        <p className={cn("mt-2 break-keep text-sm leading-6", dark ? "text-white/80" : "text-slate-700")}>{description}</p>
        <Link
          href={href}
          className={cn(
            "mt-3 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
            dark ? "bg-brand-500 text-navy hover:bg-brand-400 focus-visible:outline-brand-300" : "bg-navy text-white hover:bg-navy-700 focus-visible:outline-navy",
          )}
        >
          {linkLabel}<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        </Link>
      </div>
      <div className="relative row-start-1 aspect-[2.5/1] overflow-hidden sm:col-start-2 sm:aspect-auto">
        <Image src={image} alt="" fill unoptimized className="object-cover" />
      </div>
    </section>
  );
}
