"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Play } from "lucide-react";

const slides = [
  {
    image: "/images/home/hero-studio.webp",
    mobileImage: "/images/home/hero-studio-mobile.webp",
    eyebrow: "LIVE COMMERCE, BETTER TOGETHER",
    title: "방송에만 집중하세요.",
    highlight: "나머지는 우리가 합니다.",
    description: "공간을 찾는 순간부터 라이브 준비, 주문과 정산 확인까지. 셀러의 아이디어가 고객에게 닿는 모든 장면을 함께 설계합니다.",
    primary: { label: "셀러로 시작하기", href: "/signup/seller" },
    secondary: { label: "서비스 살펴보기", href: "/intro" },
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

  useEffect(() => {
    const timer = window.setInterval(() => setCurrent((index) => (index + 1) % slides.length), 7500);
    return () => window.clearInterval(timer);
  }, []);

  const slide = slides[current];
  const change = (direction: number) => setCurrent((index) => (index + direction + slides.length) % slides.length);

  return (
    <section className="relative isolate overflow-hidden bg-navy text-white sm:min-h-[680px] lg:min-h-[710px]" aria-label="셀러브릭스 주요 서비스">
      <div className="relative aspect-[3/2] overflow-hidden sm:absolute sm:inset-0 sm:aspect-auto">
        {slides.map((item, index) => (
          <div key={item.image} className={`absolute inset-0 transition-opacity duration-700 ${index === current ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
            <picture>
              <source media="(max-width: 639px)" srcSet={item.mobileImage} type="image/webp" />
              <Image src={item.image} alt="" fill priority={index === 0} loading={index === 0 ? undefined : "eager"} sizes="100vw" unoptimized className="object-cover" />
            </picture>
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-navy to-transparent sm:hidden" />
      </div>
      <div className="absolute inset-0 hidden bg-gradient-to-r from-[#11172d] via-[#11172d]/85 to-[#11172d]/5 sm:block" />
      <div className="absolute inset-0 hidden bg-gradient-to-t from-[#11172d]/55 via-transparent to-transparent sm:block" />
      <div className="absolute -left-20 top-1/3 hidden h-80 w-80 rounded-full bg-brand-500/10 blur-3xl sm:block" />

      <div className="container relative z-10 flex items-center pb-24 pt-5 sm:min-h-[680px] sm:py-24 lg:min-h-[710px]">
        <div className="w-full max-w-[690px] sm:pb-0">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-brand-200 backdrop-blur-sm sm:mb-7 sm:px-4 sm:py-2 sm:text-xs sm:tracking-[0.18em]">
            <span className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_12px_#F5A623]" />
            {slide.eyebrow}
          </span>
          <h1 className="break-keep text-[clamp(1.55rem,7vw,2.6rem)] font-extrabold leading-[1.2] tracking-[-0.055em] sm:text-[clamp(2.5rem,4.7vw,4.7rem)] sm:leading-[1.16]">
            {slide.title}<br />
            <span className="text-[#FFD05A]">{slide.highlight}</span>
          </h1>
          <p className="mt-4 max-w-[575px] text-sm leading-6 text-white/80 sm:mt-7 sm:text-lg sm:leading-8">{slide.description}</p>
          <div className="mt-6 flex flex-col gap-2.5 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <Link href={slide.primary.href} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-500 px-6 text-sm font-bold text-navy shadow-[0_14px_36px_rgba(245,166,35,0.28)] transition hover:-translate-y-0.5 hover:bg-[#FFC353]">
              {slide.primary.label}<ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={slide.secondary.href} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/35 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20">
              <Play className="h-4 w-4 fill-current" />{slide.secondary.label}
            </Link>
          </div>
          <div className="mt-11 hidden flex-wrap gap-x-5 gap-y-2 text-xs font-medium tracking-wide text-white/55 sm:flex sm:text-sm">
            <span>공간 탐색</span><span className="text-brand-400">✦</span><span>라이브 운영</span><span className="text-brand-400">✦</span><span>판매 관리</span><span className="text-brand-400">✦</span><span>정산 확인</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-4 right-4 z-20 flex items-center justify-between gap-3 sm:bottom-8 sm:left-auto sm:right-10 sm:w-[430px]">
        <div className="flex items-center gap-3 text-xs font-bold tracking-[0.12em] text-white/75">
          <span className="text-brand-300">0{current + 1}</span><span className="h-px w-10 bg-white/40" /><span>0{slides.length}</span>
          <span className="hidden whitespace-nowrap font-medium tracking-normal text-white/60 sm:inline">{slide.caption}</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => change(-1)} aria-label="이전 배너" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm transition hover:bg-white/25"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => change(1)} aria-label="다음 배너" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm transition hover:bg-white/25"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
    </section>
  );
}
