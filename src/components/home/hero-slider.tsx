"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const slides = [
  {
    image: "/images/home/hero-market-partners.webp",
    mobileImage: "/images/home/hero-market-partners-mobile.webp",
    title: "셀러·창고·브랜드를",
    highlight: "한곳에서 연결합니다",
    description: "셀러는 방송 공간과 상품을 찾고, 창고·스튜디오는 공간을 열고, 브랜드는 새로운 판매 파트너를 만납니다.",
    primary: { label: "서비스 둘러보기", href: "/intro" },
    secondary: { label: "공간 찾아보기", href: "#spaces" },
  },
  {
    image: "/images/home/hero-fulfillment.webp",
    mobileImage: "/images/home/hero-fulfillment-mobile.webp",
    title: "창고와 스튜디오에서",
    highlight: "새로운 방송이 시작됩니다",
    description: "공간 운영자는 셀러를 맞이하고, 셀러는 방송에 맞는 공간과 일정을 찾아 예약할 수 있습니다.",
    primary: { label: "공간 둘러보기", href: "#spaces" },
    secondary: { label: "등록 공간 보기", href: "/facilities" },
  },
  {
    image: "/images/home/hero-farm.webp",
    mobileImage: "/images/home/hero-farm-mobile.webp",
    title: "브랜드 상품이",
    highlight: "새로운 판매처를 만납니다",
    description: "브랜드는 상품과 샘플을 소개하고, 셀러와 공간 운영자는 라이브에서 판매할 상품을 찾을 수 있습니다.",
    primary: { label: "브랜드샵 보기", href: "/brands" },
    secondary: { label: "브랜드 상품 보기", href: "#brand-products" },
  },
];

export function HeroSlider({ showSignup }: { showSignup: boolean }) {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setCurrent((index) => (index + 1) % slides.length), 7500);
    return () => window.clearInterval(timer);
  }, [playing]);

  const slide = slides[current];
  const primary = current === 0 && showSignup ? { label: "가입 유형 보기", href: "#signup-roles" } : slide.primary;
  const secondary = current === 0 && showSignup ? slide.primary : slide.secondary;
  const select = (index: number) => {
    setPlaying(false);
    setCurrent((index + slides.length) % slides.length);
  };

  return (
    <section className="relative isolate mx-4 mt-4 flex flex-col justify-end overflow-hidden rounded-[24px] bg-navy text-white shadow-[0_12px_34px_#1A1A2E20] sm:mx-6 sm:mt-6 sm:min-h-[390px] sm:rounded-[28px]" aria-label="스토리지마켓 주요 서비스">
      <div className="relative -z-10 aspect-[1.7] max-h-[280px] overflow-hidden sm:absolute sm:inset-0 sm:h-full sm:max-h-none sm:aspect-auto" aria-hidden="true">
        {slides.map((item, index) => (
          <div key={item.image} className={cn(
            "absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none",
            index === 0 && "min-[720px]:left-12",
            index === current ? "opacity-100" : "opacity-0",
          )}>
            <picture>
              <source media="(max-width: 639px)" srcSet={item.mobileImage} type="image/webp" />
              <Image src={item.image} alt="" fill priority={index === 0} loading={index === 0 ? undefined : "eager"} sizes="(min-width: 1040px) 668px, 100vw" unoptimized
                className={cn("object-cover object-center sm:object-[58%_center]", index === 0 && "min-[720px]:object-left")} />
            </picture>
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-transparent via-[40%] to-transparent sm:bg-gradient-to-r sm:from-navy sm:via-navy/85 sm:via-[38%] sm:to-navy/10" />
      </div>

      <div className="absolute right-4 top-4 hidden gap-1 sm:flex">
        <button type="button" onClick={() => select(current - 1)} aria-label="이전 배너" className="grid w-11 place-items-center rounded-full bg-navy/55 text-white backdrop-blur-sm hover:bg-navy/80"><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" onClick={() => select(current + 1)} aria-label="다음 배너" className="grid w-11 place-items-center rounded-full bg-navy/55 text-white backdrop-blur-sm hover:bg-navy/80"><ChevronRight className="h-5 w-5" /></button>
      </div>

      <div className="px-5 pb-2 pt-2 sm:px-8 sm:pb-4 sm:pt-12">
        <div aria-live={playing ? "off" : "polite"}>
          <h1 className="break-keep text-[clamp(1.5rem,6.6vw,2.25rem)] font-black leading-tight tracking-[-0.055em] sm:text-[2.4rem]">
            {slide.title}<br /><span className="text-brand-300">{slide.highlight}</span>
          </h1>
          <p className="mt-3 max-w-[320px] break-keep text-sm leading-6 text-white/90">{slide.description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link href={primary.href} className={cn(buttonVariants(), "rounded-xl bg-brand-300 px-3 text-xs font-bold text-navy hover:bg-brand-200 min-[390px]:text-sm sm:px-5")}>{primary.label}</Link>
            <Link href={secondary.href} className={cn(buttonVariants({ variant: "outline" }), "rounded-xl border-white/45 bg-navy/65 px-3 text-xs font-bold text-white hover:border-brand-200 hover:bg-navy-700 min-[390px]:text-sm sm:px-5")}>{secondary.label}</Link>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-0.5">
          {slides.map((item, index) => (
            <button key={item.image} type="button" onClick={() => select(index)} aria-label={`${index + 1}번 배너`} aria-current={index === current ? "true" : undefined} className="grid w-9 place-items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-300">
              <span className={`h-1.5 rounded-full transition-all ${index === current ? "w-6 bg-brand-300" : "w-2 bg-white/45"}`} />
            </button>
          ))}
          <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? "자동 재생 일시정지" : "자동 재생 시작"} className="grid w-10 place-items-center rounded-lg text-white/85 hover:text-brand-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-300">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </section>
  );
}
