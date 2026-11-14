"use client";

import { useEffect, useSyncExternalStore } from "react";

// 브랜드샵 화면에서 메인 화면 틀의 위쪽 로고를 그 브랜드 로고로 바꾸기 위한 작은 저장소 (2026-11-14)
export type StudioBrand = { id: string; name: string; logo: string | null } | null;
let current: StudioBrand = null;
const listeners = new Set<() => void>();
function set(v: StudioBrand) { current = v; listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export function useStudioBrand() {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** 브랜드샵 화면이 렌더하면 위쪽 머리글이 이 브랜드 로고 · 이름으로 바뀐다 */
export function StudioBrandMark({ id, name, logo }: { id: string; name: string; logo: string | null }) {
  useEffect(() => {
    set({ id, name, logo });
    return () => { if (current?.id === id) set(null); };
  }, [id, name, logo]);
  return null;
}
