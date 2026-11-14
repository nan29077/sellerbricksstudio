"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Play, VolumeX, X } from "lucide-react";
import { SAMPLE_SLIDES, toSlide, type Slide } from "@/components/home/home-broadcast-player";
import type { HomeVideoItem } from "@/lib/home-videos";
import { cn } from "@/lib/utils";
import { useSupportView } from "@/components/support/support-center";
import styles from "./mobile-mini-player.module.css";

// 모바일 미니 플레이어 (2026-11-14)
//  - 모바일(1024px 미만)에서만 오른쪽 아래에 떠서 화면을 따라다닌다. PC는 왼쪽 플레이어를 그대로 쓴다.
//  - 작은 9:16 세로 화면에서 영상이 소리 없이 바로 재생된다.
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

// 메인 화면의 큰 영상 섹션이 화면에 보이는지 — 섹션 안의 MiniPlayerAnchor 가 직접 알려 준다.
// (레이아웃에서 querySelector 로 찾으면, 화면이 늦게 붙는 휴대폰에서 섹션을 못 찾아 미니 플레이어가 같이 떠 버렸다)
type AnchorState = "none" | "visible" | "away";
let anchor: AnchorState = "none";
const anchorListeners = new Set<() => void>();
function setAnchor(v: AnchorState) { anchor = v; anchorListeners.forEach((l) => l()); }
function subscribeAnchor(l: () => void) { anchorListeners.add(l); return () => { anchorListeners.delete(l); }; }
const useAnchor = () => useSyncExternalStore(subscribeAnchor, () => anchor, () => "none" as AnchorState);

/** 메인 화면 영상 섹션 안에 둔다. 섹션이 화면에 보이는 동안 미니 플레이어를 숨긴다. */
export function MiniPlayerAnchor() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    setAnchor("visible");
    if (typeof IntersectionObserver === "undefined") return () => setAnchor("none");
    const io = new IntersectionObserver(([entry]) => setAnchor(entry.isIntersecting ? "visible" : "away"), { threshold: 0.05 });
    io.observe(el);
    return () => { io.disconnect(); setAnchor("none"); };
  }, []);
  return <span ref={ref} hidden />;
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
  const anchorState = useAnchor();
  const supportView = useSupportView(); // 문의하기 창이 열려 있으면 잠시 숨김 (같은 자리라 겹치지 않게)
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [quiet, setQuiet] = useState(true); // 미리보기 자동 재생을 끌지 (동작 줄이기 · 데이터 절약)
  const openButton = useRef<HTMLButtonElement>(null);
  const collapseButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    setClosed(readClosed());
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    setQuiet(!!saveData || window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  // 영상 목록이 바뀌면(다른 브랜드샵 등) 처음부터
  const sourceKey = source?.key;
  useEffect(() => { setIndex(0); setExpanded(false); }, [sourceKey]);

  useEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    const target = expanded ? collapseButton.current : openButton.current;
    if (target?.tabIndex === 0) target.focus({ preventScroll: true });
  }, [expanded]);

  if (!source || !source.slides.length || closed.includes(source.key)) return null;
  // 메인(/)에서는 영상 섹션이 화면 밖으로 나갔다고 확인된 뒤에만 보인다 (서버 렌더 · 첫 화면 · 섹션이 보이는 동안은 숨김)
  const hidden = (pathname === "/" && anchorState !== "away" && !expanded) || supportView !== "closed";
  const slide = source.slides[Math.min(index, source.slides.length - 1)];
  const src = slide.source;
  const count = source.slides.length;
  const tab = hidden ? -1 : 0;
  const place = cn(styles.player, pathname === "/support" && styles.aboveNav);

  function close() {
    const next = [...new Set([...readClosed(), source!.key])];
    try { sessionStorage.setItem(CLOSED_KEY, JSON.stringify(next)); } catch { /* 저장이 안 되면 이번 화면에서만 닫힘 */ }
    setClosed(next);
    setExpanded(false);
  }
  function go(step: number) { setIndex((i) => (i + step + count) % count); }
  function resize(next: boolean) {
    restoreFocus.current = true;
    setExpanded(next);
  }

  // ── 크게 보기: 소리 · 조작 버튼이 있는 9:16 플레이어 ──────────────────────
  if (expanded) {
    return (
      <aside aria-label={`${source.title} 플레이어`} data-mini-player data-expanded className={cn(place, styles.expanded)}>
        <div className={styles.toolbar}>
          <p className={styles.title} title={slide.title}>{slide.title}</p>
          <button ref={collapseButton} type="button" onClick={() => resize(false)} aria-label="작게 보기" className={styles.iconButton}><ChevronDown size={17} aria-hidden /></button>
          <button type="button" onClick={close} aria-label="미니 플레이어 닫기" className={styles.iconButton}><X size={17} aria-hidden /></button>
        </div>
        <div className={cn(styles.media, styles.expandedMedia)}>
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
          <div className={styles.toolbar}>
            <span className={styles.count}>{index + 1} / {count}</span>
            <button type="button" onClick={() => go(-1)} aria-label="이전 영상" className={styles.iconButton}><ChevronLeft size={17} aria-hidden /></button>
            <button type="button" onClick={() => go(1)} aria-label="다음 영상" className={styles.iconButton}><ChevronRight size={17} aria-hidden /></button>
          </div>
        )}
      </aside>
    );
  }

  const preview = !quiet && !hidden;
  return (
    <aside aria-label={`${source.title} 미니 플레이어`} data-mini-player aria-hidden={hidden || undefined}
      className={cn(place, styles.compact, hidden && styles.hidden)}>
      <div className={styles.media}>
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
          <Image src={slide.poster} alt="" fill unoptimized sizes="128px" className="object-cover" />
        )}
        <div className={styles.previewControls} aria-hidden>
          {preview && src.kind !== "link" && <span className={styles.muted} title="음소거 미리보기"><VolumeX size={13} /></span>}
        </div>
        {(src.kind === "link" || !preview) && (
          <span className={styles.centerIcon} aria-hidden>{src.kind === "link" ? <ArrowUpRight size={16} /> : <Play size={15} fill="currentColor" />}</span>
        )}
      </div>
      <div className={styles.caption}>
        <span className={styles.source} title={source.title}>{source.title}</span>
        <p className={styles.title} title={slide.title}>{slide.title}</p>
      </div>
      {src.kind === "link" ? (
        <a href={slide.url} target="_blank" rel="noopener noreferrer" tabIndex={tab} aria-label={`${slide.title} 원본에서 보기`} className={styles.open} />
      ) : (
        <button ref={openButton} type="button" onClick={() => resize(true)} tabIndex={tab} aria-label={`${slide.title} 크게 보기 (화면 누르기)`} className={styles.open} />
      )}
      {src.kind !== "link" && (
        <button type="button" onClick={() => resize(true)} tabIndex={tab} aria-label="크게 보기" className={cn(styles.iconButton, styles.expand)}>
          <span className={styles.closeIcon}><Maximize2 size={13} aria-hidden /></span>
        </button>
      )}
      <button type="button" onClick={close} tabIndex={tab} aria-label="미니 플레이어 닫기" className={cn(styles.iconButton, styles.close)}>
        <span className={styles.closeIcon}><X size={15} aria-hidden /></span>
      </button>
    </aside>
  );
}
