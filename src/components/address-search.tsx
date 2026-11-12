"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";

// 우편번호 · 도로명 주소 검색 (다음 우편번호 서비스, 무료 · 키 불필요)
// 검색 결과를 "(우편번호) 도로명 주소 " 형태로 돌려주고, 상세 주소는 이어서 직접 적는다.
// 스크립트를 불러오지 못하면(네트워크 차단 등) 안내만 하고 직접 입력은 그대로 쓸 수 있다.
const SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

type DaumData = { zonecode: string; roadAddress: string; jibunAddress: string; buildingName?: string; apartment?: string };
declare global {
  interface Window { daum?: { Postcode: new (opts: { oncomplete: (d: DaumData) => void; width?: string; height?: string }) => { embed: (el: HTMLElement) => void } } }
}

let loading: Promise<void> | null = null;
function loadScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.daum?.Postcode) return Promise.resolve();
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SRC; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { loading = null; reject(new Error("load failed")); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export function AddressSearchButton({ onSelect, className = "" }: { onSelect: (address: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !box.current || !window.daum) return;
      box.current.innerHTML = "";
      new window.daum.Postcode({
        width: "100%", height: "100%",
        oncomplete: (d) => {
          const extra = d.buildingName && d.apartment === "Y" ? ` (${d.buildingName})` : "";
          onSelect(`(${d.zonecode}) ${d.roadAddress || d.jibunAddress}${extra} `);
          setOpen(false);
        },
      }).embed(box.current);
    }).catch(() => { if (!cancelled) { setError("주소 검색을 불러오지 못했습니다. 주소를 직접 입력해 주세요."); setOpen(false); } });
    return () => { cancelled = true; };
  }, [open, onSelect]);

  return (
    <>
      <button type="button" onClick={() => { setError(""); setOpen(true); }}
        className={`inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-navy ${className}`}>
        <MapPin className="h-4 w-4 text-brand-500" />주소 검색
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label="주소 검색">
          <div className="flex h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white sm:h-[560px] sm:rounded-2xl">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="font-bold text-navy">주소 검색</span>
              <button type="button" aria-label="주소 검색 닫기" onClick={() => setOpen(false)} className="tap flex h-10 w-10 items-center justify-center"><X className="h-5 w-5" /></button>
            </div>
            <div ref={box} className="flex-1"><p className="p-4 text-sm text-slate-500">불러오는 중...</p></div>
          </div>
        </div>
      )}
    </>
  );
}
