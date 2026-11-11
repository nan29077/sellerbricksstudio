"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

const slides = [
  {
    image: "/images/home/hero-studio.webp",
    mobileImage: "/images/home/hero-studio-mobile.webp",
    eyebrow: "LIVE COMMERCE, BETTER TOGETHER",
    title: "방송에만 집중하세요.",
    highlight: "나머지는 우리가 합니다.",
    description: "공간을 찾는 순간부터 라이브 준비, 주문과 정산 확인까지. 셀러의 아이디어가 고객에게 닿는 모든 장면을 함께 설계합니다.",
    primary: { label: "셀러로 시작하기", href: "/signup/seller" },
    secondary: { label: "브랜드 상품 보기", href: "/#brand-products" },
    caption: "라이브 스튜디오 · 연출 이미지",
  },
  {
    image: "/images/home/hero-fulfillment.webp",
    mobileImage: "/images/home/hero-fulfillment-mobile.webp",
    eyebrow: "SPACE TO SALES",
    title: "준비가 쉬워지면,",
    highlight: "라이브가 달라집니다.",
    description: "스튜디오와 창고를 탐색하고, 상품과 방송 일정을 한 흐름으로 연결하세요. 복잡한 준비를 덜고 판매에 집중할 수 있습니다.",
    primary: { label: "공간 둘러보기", href: "/facilities" },
    secondary: { label: "운영 방식 보기", href: "/intro" },
    caption: "공간과 운영 · 연출 이미지",
  },
  {
    image: "/images/home/hero-farm.webp",
    mobileImage: "/images/home/hero-farm-mobile.webp",
    eyebrow: "STORIES FROM THE SOURCE",
    title: "현장의 생생함을",
    highlight: "구매 경험으로.",
    description: "산지와 생산 현장의 이야기를 라이브로 전해보세요. 상품이 만들어진 곳의 매력을 화면 너머 고객에게 전달합니다.",
    primary: { label: "서비스 소개 보기", href: "/intro" },
    secondary: { label: "셀러 가입하기", href: "/signup/seller" },
    caption: "현장 라이브 · 연출 이미지",
  },
];

export function HeroSlider() {
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
  const select = (index: number) => {
    setPlaying(false);
    setCurrent((index + slides.length) % slides.length);
  };

  return (
    <section className="relative isolate mx-3 mt-4 flex min-h-[min(550px,calc(100svh-112px))] flex-col justify-end overflow-hidden rounded-[24px] bg-navy text-white shadow-[0_20px_48px_#1A1A2E30] sm:mx-6 sm:mt-7 sm:min-h-[458px] sm:rounded-[30px]" aria-label="스토리지마켓 주요 서비스">
      <div className="absolute inset-x-0 top-0 -z-10 h-[67%] overflow-hidden sm:inset-0 sm:h-full" aria-hidden="true">
        {slides.map((item, index) => (
          <div key={item.image} className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${index === current ? "opacity-100" : "opacity-0"}`}>
            <picture>
              <source media="(max-width: 639px)" srcSet={item.mobileImage} type="image/webp" />
              <Image src={item.image} alt="" fill priority={index === 0} loading={index === 0 ? undefined : "eager"} sizes="(min-width: 1040px) 668px, 100vw" unoptimized className="object-cover object-[60%_center]" />
            </picture>
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-navy from-[4%] via-navy/35 via-[38%] to-transparent sm:bg-gradient-to-r sm:from-[#17172B] sm:from-0% sm:via-[#17172B]/80 sm:via-50% sm:to-[#17172B]/20" />
      </div>

      <div className="absolute right-4 top-4 hidden gap-1 sm:flex">
        <button type="button" onClick={() => select(current - 1)} aria-label="이전 배너" className="grid w-11 place-items-center rounded-full bg-navy/55 text-white backdrop-blur-sm hover:bg-navy/80"><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" onClick={() => select(current + 1)} aria-label="다음 배너" className="grid w-11 place-items-center rounded-full bg-navy/55 text-white backdrop-blur-sm hover:bg-navy/80"><ChevronRight className="h-5 w-5" /></button>
      </div>

      <div className="px-5 pb-3 pt-20 sm:px-9 sm:pb-5">
        <p className="text-[11px] font-extrabold tracking-[0.18em] text-brand-200 sm:text-xs">{slide.eyebrow}</p>
        <h1 className="mt-3 break-keep text-[clamp(1.65rem,7vw,2.45rem)] font-black leading-[1.14] tracking-[-0.055em] sm:text-[2.6rem]">
          {slide.title}<br /><span className="text-[#FFD05A]">{slide.highlight}</span>
        </h1>
        <p className="mt-4 max-w-[395px] break-keep text-sm leading-6 text-white/85">{slide.description}</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href={slide.primary.href} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-500 px-4 text-xs font-extrabold text-navy hover:bg-brand-400 sm:px-5 sm:text-sm">
            {slide.primary.label}<ArrowRight className="h-4 w-4" />
          </Link>
          <Link href={slide.secondary.href} className="inline-flex min-h-11 items-center text-xs font-semibold text-white underline decoration-white/55 underline-offset-4 hover:text-brand-200 sm:text-sm">{slide.secondary.label}</Link>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {slides.map((item, index) => (
            <button key={item.image} type="button" onClick={() => select(index)} aria-label={`${index + 1}번 배너`} aria-current={index === current ? "true" : undefined} className="grid w-6 place-items-center">
              <span className={`h-1.5 rounded-full transition-all ${index === current ? "w-6 bg-brand-300" : "w-2 bg-white/45"}`} />
            </button>
          ))}
          <span className="text-[11px] font-bold tabular-nums text-white/75">0{current + 1} / 0{slides.length}</span>
          <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? "자동 재생 일시정지" : "자동 재생 시작"} className="grid w-9 place-items-center text-white/85 hover:text-brand-200">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <span className="ml-auto hidden text-[11px] text-white/70 sm:inline">{slide.caption}</span>
        </div>
      </div>
    </section>
  );
}
