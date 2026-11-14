"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Play, Video } from "lucide-react";
import { HOME_BROADCAST_CLIPS } from "@/lib/home-broadcasts";
import type { HomeVideoCategory, HomeVideoItem } from "@/lib/home-videos";
import styles from "./home-broadcast-player.module.css";

// 메인 '라이브 커머스' 영상 플레이어 (2026-11-14)
//  지난 라이브 커머스 · 숏폼 · 홍보 · 캠페인 · 행사 영상을 한 목록으로 좌우로 넘기며 본다. (탭 없음)
//  영상은 최고관리자가 사이트 관리 → 홈 영상에서 링크로 넣는다. 영상이 없으면 샘플 영상을 보여 준다.
const DEFAULT_POSTER = "/images/home/banner-live-prep.webp";

type Slide = {
  id: string; title: string; caption: string; poster: string; duration: string; sample?: boolean; url: string;
  source: HomeVideoItem["source"];
};

const SAMPLE_SLIDES: Slide[] = HOME_BROADCAST_CLIPS.map((clip) => ({
  id: clip.id, title: clip.title, caption: clip.source, poster: clip.poster, duration: clip.duration, sample: clip.sample,
  url: clip.video, source: { kind: "file", src: clip.video },
}));

const toSlide = (v: HomeVideoItem): Slide => ({
  id: v.id, title: v.title, caption: v.caption, poster: v.poster || DEFAULT_POSTER, duration: v.duration, url: v.url, source: v.source,
});

// emptyText: 영상이 없을 때 샘플 대신 보여 줄 안내 (예: 브랜드샵 — 그 브랜드가 아직 영상을 안 넣었을 때)
export function HomeBroadcastPlayer({ videos, title = "라이브 커머스", emptyText, logo }: { videos: Record<HomeVideoCategory, HomeVideoItem[]> | null; title?: string; emptyText?: string; logo?: string | null }) {
  const own = videos?.LIVE_COMMERCE.length ? videos.LIVE_COMMERCE.map(toSlide) : null;
  const slides = own ?? (emptyText ? null : SAMPLE_SLIDES);
  return (
    <section className={styles.player} aria-labelledby="home-broadcast-heading">
      <div className={styles.heading}>
        <span className={styles.headingIcon}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt="" className="h-full w-full rounded-[10px] object-cover" /> : <Video aria-hidden="true" size={19} />}
        </span>
        <h2 id="home-broadcast-heading">{title}</h2>
      </div>
      {slides ? <VideoCarousel items={slides} label={`${title} 영상`} /> : (
        <div className={styles.empty}>
          <Video aria-hidden="true" size={30} />
          <p>{emptyText}</p>
        </div>
      )}
    </section>
  );
}

function VideoCarousel({ items, label }: { items: Slide[]; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [playingId, setPlayingId] = useState<string>();
  const index = Math.max(0, items.findIndex((item) => item.id === selectedId));
  const current = items[index];

  useEffect(() => {
    if (!selectedId || selectedId === current.id) return;
    track.current?.scrollTo({ left: 0 });
    setSelectedId(undefined);
    setPlayingId(undefined);
  }, [current.id, selectedId]);

  function select(next: number) {
    const element = track.current;
    if (!element || next < 0 || next >= items.length) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ left: element.clientWidth * next, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <>
      <div ref={track} className={styles.track} aria-label={`${label} 슬라이드`}
        onScroll={(event) => {
          const { scrollLeft, clientWidth } = event.currentTarget;
          const next = items[Math.round(scrollLeft / clientWidth)];
          if (next && next.id !== current.id) {
            setSelectedId(next.id);
            setPlayingId(undefined);
          }
        }}>
        {items.map((item, position) => {
          const active = position === index;
          const playing = active && playingId === item.id;
          const src = item.source;
          return (
            <div key={item.id} className={styles.slide} aria-hidden={!active}>
              {playing && src.kind === "file" ? (
                <video className={styles.media} src={src.src} poster={item.poster} aria-label={item.title}
                  autoPlay playsInline controls preload="metadata" onEnded={() => setPlayingId(undefined)} />
              ) : playing && (src.kind === "youtube" || src.kind === "vimeo") ? (
                <iframe className={styles.liveFrame} title={item.title} src={src.embed}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
              ) : (
                <>
                  <Image src={item.poster} alt="" fill unoptimized draggable={false} sizes="(min-width: 1200px) 300px, (min-width: 716px) 660px, 100vw" className={styles.poster} />
                  <div className={styles.shade} />
                  {item.sample && <span className={styles.sampleBadge}>샘플</span>}
                  {item.duration && <span className={styles.duration}>{item.duration}</span>}
                  {src.kind === "link" ? (
                    <a className={styles.play} href={item.url} target="_blank" rel="noopener noreferrer"
                      tabIndex={active ? 0 : -1} aria-label={`${item.title} 원본에서 보기`}>
                      <ArrowUpRight size={25} aria-hidden="true" />
                    </a>
                  ) : (
                    <button type="button" tabIndex={active ? 0 : -1} aria-label={`${item.title} 재생`} className={styles.play}
                      onClick={() => setPlayingId(item.id)}><Play size={24} aria-hidden="true" fill="currentColor" /></button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className={styles.footer}>
        <div className={styles.details} aria-live="polite" aria-atomic="true">
          {current.caption && <p className={styles.source}>{current.caption}</p>}
          <h3 title={current.title}>{current.title}</h3>
        </div>
        {items.length > 1 && (
          <div className={styles.arrows}>
            <button type="button" onClick={() => select(index - 1)} disabled={index === 0} aria-label="이전 영상"><ChevronLeft size={17} aria-hidden="true" /></button>
            <button type="button" onClick={() => select(index + 1)} disabled={index === items.length - 1} aria-label="다음 영상"><ChevronRight size={17} aria-hidden="true" /></button>
          </div>
        )}
      </div>
      <div className={styles.bottom}>
        {items.length > 1 && <span className={styles.position} aria-label={`전체 ${items.length}개 중 ${index + 1}번째`}>
          <span>{index + 1}</span> / {items.length}
        </span>}
        {(current.source.kind === "youtube" || current.source.kind === "vimeo" || current.source.kind === "link") && (
          <a href={current.url} className={styles.textButton} target="_blank" rel="noopener noreferrer">
            {current.source.kind === "youtube" ? "유튜브에서 보기" : current.source.kind === "vimeo" ? "비메오에서 보기" : "원본에서 보기"} <ArrowUpRight aria-hidden="true" size={15} />
          </a>
        )}
      </div>
    </>
  );
}
