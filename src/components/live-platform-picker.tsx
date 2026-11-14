"use client";
import { Check } from "lucide-react";
import { LIVE_PLATFORMS, LIVE_PLATFORM_GROUPS } from "@/lib/live-platforms";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// 셀러가 판매하는 라이브 커머스 플랫폼 고르기 (여러 개 선택)
export function LivePlatformPicker({ value, onChange, etc, onEtcChange, idPrefix = "lp" }: {
  value: string[]; onChange: (v: string[]) => void; etc: string; onEtcChange: (v: string) => void; idPrefix?: string;
}) {
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  return (
    <div className="space-y-3">
      {LIVE_PLATFORM_GROUPS.map((g) => (
        <div key={g}>
          <p className="mb-1.5 text-[11px] font-bold text-slate-500">{g === "전문" ? "라이브 커머스 전문" : g === "쇼핑몰" ? "쇼핑몰 · 홈쇼핑 라이브" : g}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={g}>
            {LIVE_PLATFORMS.filter((p) => p.group === g).map((p) => {
              const on = value.includes(p.code);
              return (
                <button key={p.code} type="button" aria-pressed={on} onClick={() => toggle(p.code)}
                  className={cn("inline-flex min-h-10 items-center gap-1 rounded-full border px-3 text-xs font-bold transition-colors",
                    on ? "border-navy bg-navy text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300")}>
                  {on && <Check aria-hidden="true" className="h-3.5 w-3.5" />}{p.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {value.includes("ETC") && (
        <div>
          <label htmlFor={`${idPrefix}-etc`} className="mb-1 block text-xs font-semibold text-slate-600">기타 플랫폼 이름</label>
          <Input id={`${idPrefix}-etc`} value={etc} onChange={(e) => onEtcChange(e.target.value)} maxLength={60} placeholder="예: 자사몰 라이브, 밴드 라이브" />
        </div>
      )}
    </div>
  );
}
