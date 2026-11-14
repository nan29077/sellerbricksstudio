"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Play, VolumeX, X } from "lucide-react";
import { SAMPLE_SLIDES, toSlide, type Slide } from "@/components/home/home-broadcast-player";
import type { HomeVideoItem } from "@/lib/home-videos";
import { cn } from "@/lib/utils";

// 모바일 미니 플레이어 (2026-11-14)
//  - 모바일(1024px 미만)에서만 오른쪽 아래에 떠서 화면을 따라다닌다. PC는 왼쪽 플레이어를 그대로 쓴다.
//  - 모양: 네이버 쇼핑라이브 미니 플레이어처럼 작은 9:16 세로 화면에서 영상이 소리 없이 바로 재생된다.
//    누르면 크게 보기(소리 · 조작 · 이전/다음), 오른쪽 위 X 로 닫기. 동작 줄이기 · 데이터 절약 설정이면 사진만 보여 준다.
//  - 위치: 하단 메뉴바 위 → 문의하기 버튼 위. 하단 메뉴바는 절대 가리지 않는다.
//  - 메인(/)은 화면 안 큰 플레이어가 보이는 동안 숨고, 큰 플레이어가 화면 밖으로 나가면 나타난다.
//  - 브랜드샵은 그 브랜드 영상만 (영상이 없으면 띄우지 않음). 닫기(X)를 누르면 이번 방문 동안 닫힌다.

type Source = { key: string; title: string; slides: Slide[] } | null;

// 화면(브랜드샵 등)이 자기 영상으로 바꿀 때 쓰는 작은 저장소
let override: Source | undefined;
const listeners = new Set<() => void>();
function setOverride(v: Source | undefined) { override = v; listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
const useOverride = () => useSyncExternalStore(subscribe, () => override, () => undefined);

/** 브랜드샵 화면이 렌더하면 미니 플레이어가 그 브랜드 영상으로 바뀐다 (영상이 없으면 미니 플레이어를 띄우지 않음) */
export function MiniPlayerSource({ id, title, videos }: { id: string; title: string; videos: HomeVideoItem[] }) {
  useEffect(() => {
    const value: Source = videos.length ? { key: `brand:${id}`, title, slides: videos.map(toSlide) } : null;
    setOverride(value);
    return () => setOverride(undefined);
  }, [id, title, videos]);
  return null;
}

const CLOSED_KEY = "sb.miniPlayer.closed";
function readClosed(): string[] {
  try { return JSON.parse(sessionStorage.getItem(CLOSED_KEY) ?? "[]"); } catch { return []; }
}

export function MobileMiniPlayer({ videos }: { videos: HomeVideoItem[] | null }) {
  const pathname = usePathname() ?? "";
  const own = useOverride();
  const fallback: Source = { key: "home", title: "라이브 커머스", slides: videos?.length ? videos.map(toSlide) : SAMPLE_SLIDES };
  const source = own === undefined ? fallback : own;
  const [closed, setClosed] = useState<string[]>([]);
  const [anchorVisible, setAnchorVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [quiet, setQuiet] = useState(true); // 미리보기 자동 재생을 끌지 (동작 줄이기 · 데이터 절약)

  useEffect(() => {
    setClosed(readClosed());
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    setQuiet(!!saveData || window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  // 영상 목록이 바뀌면(다른 브랜드샵 등) 처음부터
  const sourceKey = source?.key;
  useEffect(() => { setIndex(0); setExpanded(false); }, [sourceKey]);

  // 메인: 화면 안 큰 플레이어가 보이는 동안은 숨긴다
  useEffect(() => {
    setAnchorVisible(false);
    if (pathname !== "/") return;
    const el = document.querySelector("[data-mini-anchor]");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setAnchorVisible(entry.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [pathname]);

  if (!source || !source.slides.length || closed.includes(source.key)) return null;
  const hidden = pathname === "/" && anchorVisible && !expanded;
  const slide = source.slides[Math.min(index, source.slides.length - 1)];
  const src = slide.source;
  const count = source.slides.length;
  const tab = hidden ? -1 : 0;
  // 문의하기 버튼(h-12, 하단 메뉴바 위 4.75rem)이 있는 화면은 그 위로, 없는 화면(/support)은 메뉴바 바로 위로
  const bottom = pathname === "/support" ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]" : "bottom-[calc(8.5rem+env(safe-area-inset-bottom))]";
  const place = cn("fixed right-[max(1rem,calc((100vw-716px)/2+1rem))] z-30 lg:hidden", bottom);

  function close() {
    const next = [...new Set([...readClosed(), source!.key])];
    try { sessionStorage.setItem(CLOSED_KEY, JSON.stringify(next)); } catch { /* 저장이 안 되면 이번 화면에서만 닫힘 */ }
    setClosed(next);
    setExpanded(false);
  }
  function go(step: number) { setIndex((i) => (i + step + count) % count); }

  // ── 크게 보기: 소리 · 조작 버튼이 있는 9:16 플레이어 ──────────────────────
  if (expanded) {
    return (
      <aside aria-label={`${source.title} 플레이어`} data-mini-player data-expanded
        className={cn(place, "w-[min(16rem,calc(100vw-2rem),calc((100dvh-21rem)*0.5625))] overflow-hidden rounded-[18px] bg-[#111122] text-white shadow-[0_18px_48px_#0000005c]")}>
        <div className="flex items-center gap-1 py-1.5 pl-3 pr-1">
          <p className="min-w-0 flex-1 truncate text-xs font-bold" title={slide.title}>{slide.title}</p>
          <button type="button" onClick={() => setExpanded(false)} aria-label="작게 보기" className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-white/10"><ChevronDown className="h-4 w-4" aria-hidden /></button>
          <button type="button" onClick={close} aria-label="미니 플레이어 닫기" className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-white/10"><X className="h-4 w-4" aria-hidden /></button>
        </div>
        <div className="relative aspect-[9/16] bg-black">
          {src.kind === "file" ? (
            <video key={slide.id} className="h-full w-full object-contain" src={src.src} poster={slide.poster} aria-label={slide.title} autoPlay playsInline controls preload="metadata" />
          ) : src.kind === "youtube" || src.kind === "vimeo" ? (
            <iframe key={slide.id} className="h-full w-full" title={slide.title} src={src.embed.replace("mute=1", "mute=0").replace("muted=1", "muted=0")}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          ) : (
            <>
              <Image src={slide.poster} alt="" fill unoptimized sizes="256px" className="object-cover" />
              <a href={slide.url} target="_blank" rel="noopener noreferrer" className="absolute inset-x-4 bottom-4 inline-flex h-10 items-center justify-center gap-1 rounded-full bg-white text-xs font-bold text-navy shadow">원본에서 보기<ArrowUpRight className="h-4 w-4" aria-hidden /></a>
            </>
          )}
        </div>
        {count > 1 && (
          <div className="flex items-center gap-0.5 py-1 pl-3 pr-1">
            <span className="mr-auto text-[11px] tabular-nums text-white/60">{index + 1} / {count}</span>
            <button type="button" onClick={() => go(-1)} aria-label="이전 영상" className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
            <button type="button" onClick={() => go(1)} aria-label="다음 영상" className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><ChevronRight className="h-4 w-4" aria-hidden /></button>
          </div>
        )}
      </aside>
    );
  }

  // ── 미니: 작은 9:16 화면에서 소리 없이 바로 재생 (네이버 쇼핑라이브 미니 플레이어처럼) ──
  const preview = !quiet && !hidden;
  return (
    <aside aria-label={`${source.title} 미니 플레이어`} data-mini-player aria-hidden={hidden || undefined}
      className={cn(place, "aspect-[9/16] w-[6.5rem] overflow-hidden rounded-[14px] bg-[#111122] shadow-[0_10px_28px_#00000052] ring-1 ring-black/5 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
        hidden && "pointer-events-none translate-y-3 opacity-0")}>
      {preview && src.kind === "file" ? (
        <video key={slide.id} className="absolute inset-0 h-full w-full object-cover" src={src.src} poster={slide.poster} muted autoPlay loop playsInline preload="metadata" aria-hidden />
      ) : preview && src.kind === "youtube" ? (
        // 가로 영상은 세로 화면을 꽉 채우도록 가운데를 잘라 보여 준다
        <iframe key={slide.id} aria-hidden tabIndex={-1} title={slide.title}
          className={cn("pointer-events-none absolute top-0 h-full", src.vertical ? "left-0 w-full" : "left-1/2 w-[316%] -translate-x-1/2")}
          src={`https://www.youtube-nocookie.com/embed/${src.id}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&playlist=${src.id}&modestbranding=1&rel=0&disablekb=1&iv_load_policy=3`}
          allow="autoplay; encrypted-media" />
      ) : preview && src.kind === "vimeo" ? (
        <iframe key={slide.id} aria-hidden tabIndex={-1} title={slide.title}
          className="pointer-events-none absolute left-1/2 top-0 h-full w-[316%] -translate-x-1/2"
          src={`https://player.vimeo.com/video/${src.id}?background=1&autoplay=1&muted=1&loop=1&playsinline=1`} allow="autoplay" />
      ) : (
        <Image src={slide.poster} alt="" fill unoptimized sizes="104px" className="object-cover" />
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
      {/* 화면 전체를 누르면 크게 보기 (링크 영상은 원본으로) */}
      {src.kind === "link" ? (
        <a href={slide.url} target="_blank" rel="noopener noreferrer" tabIndex={tab} aria-label={`${slide.title} 원본에서 보기`} className="absolute inset-0 z-[1]">
          <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy"><ArrowUpRight className="h-4 w-4" aria-hidden /></span>
        </a>
      ) : (
        <button type="button" onClick={() => setExpanded(true)} tabIndex={tab} aria-label={`${slide.title} 크게 보기`} className="absolute inset-0 z-[1]">
          {!preview && <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy"><Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden /></span>}
        </button>
      )}
      {preview && src.kind !== "link" && <span aria-hidden className="pointer-events-none absolute bottom-1.5 left-1.5 z-[2] grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white"><VolumeX className="h-3.5 w-3.5" /></span>}
      <button type="button" onClick={close} tabIndex={tab} aria-label="미니 플레이어 닫기"
        className="absolute right-0 top-0 z-[2] grid h-9 w-9 place-items-center">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm"><X className="h-3.5 w-3.5" aria-hidden /></span>
      </button>
    </aside>
  );
}
