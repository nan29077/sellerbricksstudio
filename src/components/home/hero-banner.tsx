"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Warehouse, Video, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1600&q=80&auto=format&fit=crop",
    badge: "셀러 전문 매니지먼트 플랫폼",
    title: "당신은 방송만 하세요\n나머지는 우리가 합니다",
    highlight: "나머지는 우리가 합니다",
    desc: "공간 예약, 상품 준비, 라이브 인프라, 주문 CS, 세무 지원까지\n셀러브릭스가 모든 것을 대신 준비합니다.",
    cta1: { label: "셀러로 시작하기", href: "/signup/seller", icon: Warehouse },
    cta2: { label: "공간 둘러보기", href: "/facilities", icon: Video },
    stats: [["셀러 매니지먼트", "방송만 집중"], ["세무 파트너", "세금 걱정 제로"], ["전국 시설", "창고·스튜디오"]],
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80&auto=format&fit=crop",
    badge: "전국 1,200+ 창고 & 스튜디오",
    title: "방송에 최적화된 공간\n비교하고 바로 예약하세요",
    highlight: "비교하고 바로 예약하세요",
    desc: "지역·유형·가격을 내 기준으로 필터링하고, 당일 예약도 가능합니다.\n방송 전 공간 셋업까지 전문 스태프가 함께합니다.",
    cta1: { label: "창고 예약하기", href: "/facilities?type=WAREHOUSE", icon: Warehouse },
    cta2: { label: "스튜디오 예약", href: "/facilities?type=STUDIO", icon: Video },
    stats: [["당일 예약 가능", "즉시 승인 시스템"], ["셋업 지원", "전문 스태프 배치"], ["투명한 요금", "숨겨진 비용 없음"]],
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1600&q=80&auto=format&fit=crop",
    badge: "완전한 비즈니스 파트너",
    title: "혼자 하던 시대는 끝났습니다\n함께 성장하는 파트너가 생겼습니다",
    highlight: "함께 성장하는 파트너가 생겼습니다",
    desc: "세무, 정산, CS, 방송 분석까지 팀처럼 지원합니다.\n셀러의 성장이 곧 셀러브릭스의 목표입니다.",
    cta1: { label: "무료로 시작하기", href: "/signup/seller", icon: Warehouse },
    cta2: { label: "서비스 알아보기", href: "/facilities", icon: Video },
    stats: [["파트너 셀러", "8,500+ 함께 성장"], ["평균 매출 성장", "+67%"], ["세무 파트너", "전문가 직접 지원"]],
  },
];

export function HeroBanner() {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goTo = useCallback((idx: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrent(idx);
      setIsTransitioning(false);
    }, 150);
  }, [isTransitioning]);

  const prev = () => goTo((current - 1 + SLIDES.length) % SLIDES.length);
  const next = useCallback(() => goTo((current + 1) % SLIDES.length), [current, goTo]);

  useEffect(() => {
    const t = setInterval(() => next(), 5000);
    return () => clearInterval(t);
  }, [next]);

  const slide = SLIDES[current];

  return (
    <section className="relative overflow-hidden min-h-[560px] sm:min-h-[620px]">
      {/* Background image */}
      <div
        className={cn(
          "absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-500",
          isTransitioning ? "opacity-0" : "opacity-100"
        )}
        style={{ backgroundImage: `url('${slide.image}')` }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-navy/90 via-navy/75 to-navy/60" />

      {/* Content */}
      <div className={cn("container relative py-16 sm:py-24 transition-all duration-500", isTransitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0")}>
        <span className="inline-flex items-center rounded-full bg-brand-500/20 border border-brand-400/30 px-3 py-1 text-xs font-semibold text-brand-300 mb-5">
          {slide.badge}
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight text-white whitespace-pre-line">
          {slide.title.replace(slide.highlight, "")}
          <span className="text-brand-400">{slide.highlight}</span>
        </h1>
        <p className="mt-5 max-w-xl text-base sm:text-lg text-white/80 whitespace-pre-line">{slide.desc}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link href={slide.cta1.href}>
            <Button size="lg" className="w-full sm:w-auto bg-brand-500 hover:bg-brand-600 text-white">
              <slide.cta1.icon className="h-5 w-5" />{slide.cta1.label}
            </Button>
          </Link>
          <Link href={slide.cta2.href}>
            <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white/10 text-white border-white/30 hover:bg-white/20">
              <slide.cta2.icon className="h-5 w-5" />{slide.cta2.label}
            </Button>
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
          {slide.stats.map(([a, b]) => (
            <div key={a}>
              <p className="text-lg sm:text-xl font-bold text-brand-400">{a}</p>
              <p className="text-xs sm:text-sm text-white/70">{b}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation arrows */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition"
        aria-label="이전"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition"
        aria-label="다음"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={cn(
              "rounded-full transition-all",
              i === current ? "w-6 h-2 bg-brand-400" : "w-2 h-2 bg-white/50 hover:bg-white/80"
            )}
            aria-label={`슬라이드 ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
