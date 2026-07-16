"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Warehouse, Zap, ChevronLeft, ChevronRight } from "lucide-react";

const SLIDES = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1487611459768-bd414656ea10?w=1920&q=85&auto=format&fit=crop",
    badge: "셀러브릭스 스튜디오",
    title: "셀러에게 필요한 모든 것,",
    titleHighlight: "셀러브릭스 스튜디오가 지원합니다",
    description: "플랫폼·라이브커머스·마케팅·스튜디오·소싱·결제·세무까지\n오직 방송에만 집중하세요 — 나머지는 우리가 합니다.",
    sub: "플랫폼 완전 지원 · 10년+ 마케팅 · 전문 스튜디오 · 지역 농가 협력",
    cta1: { label: "무료로 시작하기", href: "/signup/seller", icon: "zap" },
    cta2: { label: "서비스 소개 보기", href: "/intro", icon: "warehouse" },
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=1920&q=85&auto=format&fit=crop",
    badge: "자체 송출 라이브커머스",
    title: "전문 스튜디오에서",
    titleHighlight: "바로 라이브 방송 시작",
    description: "장비·조명·세트 완비된 스튜디오를 바로 이용하세요.\n방송 전 세팅부터 방송 후 정산까지 원스톱으로 지원합니다.",
    sub: "전문 스튜디오 · 방송 장비 지원 · 지역 현장 방송 연계",
    cta1: { label: "스튜디오 예약하기", href: "/facilities?type=STUDIO", icon: "warehouse" },
    cta2: { label: "셀러로 가입하기", href: "/signup/seller", icon: "zap" },
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=1920&q=85&auto=format&fit=crop",
    badge: "지역 농가 살리기 프로젝트",
    title: "전라남도 · 목포 · 부안과 함께",
    titleHighlight: "지역 농가 라이브 직방송",
    description: "전라도 지역 특산물·농수산물을 현지에서 직접 라이브방송으로 연계합니다.\n산지에서 바로, 유통 단계 없이 소비자에게 닿습니다.",
    sub: "전남 · 목포시 · 부안군 공식 협력 파트너",
    cta1: { label: "소개서 보기", href: "/intro", icon: "zap" },
    cta2: { label: "셀러로 가입하기", href: "/signup/seller", icon: "warehouse" },
  },
];

export function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback((idx: number) => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrent(idx);
      setAnimating(false);
    }, 350);
  }, [animating]);

  const prev = () => goTo((current - 1 + SLIDES.length) % SLIDES.length);
  const next = useCallback(() => goTo((current + 1) % SLIDES.length), [current, goTo]);

  useEffect(() => {
    const t = setInterval(next, 6000);
    return () => clearInterval(t);
  }, [next]);

  const slide = SLIDES[current];

  return (
    <section className="relative w-full h-[100svh] min-h-[600px] max-h-[900px] overflow-hidden">
      {/* Background Images */}
      {SLIDES.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === current ? 1 : 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.image}
            alt=""
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
        </div>
      ))}

      {/* Content */}
      <div
        className="relative z-10 h-full flex flex-col items-center justify-center text-center text-white px-4 transition-all duration-500"
        style={{ opacity: animating ? 0 : 1, transform: animating ? "translateY(12px)" : "translateY(0)" }}
      >
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium mb-5 backdrop-blur-sm border border-white/20">
          <Zap className="h-4 w-4 text-yellow-300" />
          <span>{slide.badge}</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-4 tracking-tight max-w-4xl">
          {slide.title}<br />
          <span className="text-yellow-300">{slide.titleHighlight}</span>
        </h1>

        {/* Description */}
        <p className="text-base sm:text-lg md:text-xl text-white/80 max-w-2xl mb-3 leading-relaxed whitespace-pre-line">
          {slide.description}
        </p>
        <p className="text-sm sm:text-base text-yellow-200 font-semibold mb-8">{slide.sub}</p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={slide.cta1.href}>
            <Button size="lg" className="bg-yellow-400 text-navy hover:bg-yellow-300 font-bold text-base h-12 px-8 shadow-xl">
              {slide.cta1.icon === "zap" ? <Zap className="h-5 w-5 mr-2" /> : <Warehouse className="h-5 w-5 mr-2" />}
              {slide.cta1.label}
            </Button>
          </Link>
          <Link href={slide.cta2.href}>
            <Button size="lg" className="bg-transparent border border-white/50 text-white hover:bg-white/15 font-semibold text-base h-12 px-8 backdrop-blur-sm">
              {slide.cta2.icon === "warehouse" ? <Warehouse className="h-5 w-5 mr-2" /> : <Zap className="h-5 w-5 mr-2" />}
              {slide.cta2.label}
            </Button>
          </Link>
        </div>
      </div>

      {/* Arrow Controls */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition backdrop-blur-sm border border-white/20"
        aria-label="이전 슬라이드"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition backdrop-blur-sm border border-white/20"
        aria-label="다음 슬라이드"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Dot Indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-300 ${
              i === current ? "w-8 h-2.5 bg-yellow-400" : "w-2.5 h-2.5 bg-white/40 hover:bg-white/70"
            }`}
            aria-label={`슬라이드 ${i + 1}`}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-0.5 bg-white/10">
        <div
          key={current}
          className="h-full bg-yellow-400"
          style={{ animation: "progress 6s linear forwards" }}
        />
      </div>

      <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </section>
  );
}
