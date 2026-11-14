"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Maximize2, Minimize2, Play, X } from "lucide-react";
import { SAMPLE_SLIDES, toSlide, type Slide } from "@/components/home/home-broadcast-player";
import type { HomeVideoItem } from "@/lib/home-videos";
import { cn } from "@/lib/utils";

// 모바일 미니 플레이어 (2026-11-14)
//  - 모바일(1024px 미만)에서만 오른쪽 아래에 떠서 화면을 따라다닌다. PC는 왼쪽 플레이어를 그대로 쓴다.
//  - 모양: 작게는 3:4 세로형 카드(쇼핑 라이브 · 숏폼 위젯처럼), 크게 보기는 9:16. 가로 영상은 위아래 여백을 두고 보여 준다.
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
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setClosed(readClosed()); }, []);
  // 영상 목록이 바뀌면(다른 브랜드샵 등) 처음부터
  const sourceKey = source?.key;
  useEffect(() => { setIndex(0); setPlaying(false); }, [sourceKey]);

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
  const hidden = pathname === "/" && anchorVisible && !playing;
  const slide = source.slides[Math.min(index, source.slides.length - 1)];
  const src = slide.source;
  const count = source.slides.length;
  // 문의하기 버튼(h-12, 하단 메뉴바 위 4.75rem)이 있는 화면은 그 위로, 없는 화면(/support)은 메뉴바 바로 위로
  const bottom = pathname === "/support" ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]" : "bottom-[calc(8.5rem+env(safe-area-inset-bottom))]";

  function close() {
    const next = [...new Set([...readClosed(), source!.key])];
    try { sessionStorage.setItem(CLOSED_KEY, JSON.stringify(next)); } catch { /* 저장이 안 되면 이번 화면에서만 닫힘 */ }
    setClosed(next);
    setPlaying(false);
  }
  function go(step: number) {
    setIndex((i) => (i + step + count) % count);
    setPlaying(false);
  }

  const tab = hidden ? -1 : 0;
  const iconBtn = "grid place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/75";
  return (
    <aside aria-label={`${source.title} 미니 플레이어`} data-mini-player
      className={cn("fixed right-[max(1rem,calc((100vw-716px)/2+1rem))] z-30 overflow-hidden rounded-2xl border border-white/10 bg-navy text-white shadow-[0_12px_32px_#1A1A2E59] transition-[opacity,transform,width] duration-200 motion-reduce:transition-none lg:hidden",
        bottom, expanded ? "w-[min(15rem,calc(100vw-2rem),calc((100dvh-17rem)*0.5625))]" : "w-28",
        hidden && "pointer-events-none translate-y-3 opacity-0")}
      aria-hidden={hidden || undefined}>
      {/* 작게: 3:4 세로형 카드(쇼핑 라이브 · 숏폼 위젯처럼) · 크게: 9:16 */}
      <div className={cn("relative bg-black", expanded ? "aspect-[9/16]" : "aspect-[3/4]")}>
        {playing && src.kind === "file" ? (
          <video className="h-full w-full object-contain" src={src.src} poster={slide.poster} aria-label={slide.title}
            autoPlay playsInline controls={expanded} preload="metadata" onEnded={() => setPlaying(false)} />
        ) : playing && (src.kind === "youtube" || src.kind === "vimeo") ? (
          <iframe className="h-full w-full" title={slide.title} src={src.embed}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        ) : (
          <>
            <Image src={slide.poster} alt="" fill unoptimized sizes="240px" className="object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-navy/85 via-transparent to-navy/40" />
            <p className={cn("absolute inset-x-2 bottom-2 line-clamp-2 break-keep font-bold leading-snug", expanded ? "text-xs" : "text-[10px]")} title={slide.title}>{slide.title}</p>
            {src.kind === "link" ? (
              <a href={slide.url} target="_blank" rel="noopener noreferrer" aria-label={`${slide.title} 원본에서 보기`} tabIndex={tab}
                className={cn("absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy shadow", expanded ? "h-12 w-12" : "h-9 w-9")}><ArrowUpRight className="h-4 w-4" aria-hidden /></a>
            ) : (
              <button type="button" onClick={() => setPlaying(true)} aria-label={`${slide.title} 재생`} tabIndex={tab}
                className={cn("absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-navy shadow", expanded ? "h-12 w-12" : "h-9 w-9")}><Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden /></button>
            )}
          </>
        )}
        <button type="button" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "작게 보기" : "크게 보기"} tabIndex={tab}
          className={cn("absolute left-1 top-1 z-10 h-7 w-7", iconBtn)}>{expanded ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}</button>
        <button type="button" onClick={close} aria-label="미니 플레이어 닫기" tabIndex={tab}
          className={cn("absolute right-1 top-1 z-10 h-7 w-7", iconBtn)}><X className="h-4 w-4" aria-hidden /></button>
      </div>
      {expanded && count > 1 && (
        <div className="flex items-center justify-end gap-0.5 px-1 py-1">
          <span className="mr-auto pl-2 text-[11px] tabular-nums text-white/60">{index + 1} / {count}</span>
          <button type="button" onClick={() => go(-1)} aria-label="이전 영상" tabIndex={tab} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
          <button type="button" onClick={() => go(1)} aria-label="다음 영상" tabIndex={tab} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><ChevronRight className="h-4 w-4" aria-hidden /></button>
        </div>
      )}
    </aside>
  );
}
