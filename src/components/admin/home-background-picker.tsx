"use client";

import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { HOME_BACKGROUNDS, HOME_BACKGROUND_SAMPLES, LEGACY_HOME_BACKGROUNDS, homeBackgroundImage, type HomeBackgroundId } from "@/lib/home-backgrounds";
import { HomeBackgroundArtwork } from "@/components/home/home-background-artwork";

export function HomeBackgroundPicker({ value, onChange, disabled = false }: {
  value: HomeBackgroundId;
  onChange: (value: HomeBackgroundId) => void;
  disabled?: boolean;
}) {
  const selected = HOME_BACKGROUNDS.find((background) => background.id === value)!;
  const renderOption = (background: (typeof HOME_BACKGROUNDS)[number]) => (
    <label key={background.id} className="relative cursor-pointer">
      <input type="radio" name="home-background" className="peer sr-only" checked={value === background.id} onChange={() => onChange(background.id)} />
      <span className="block h-full overflow-hidden rounded-2xl border-2 border-slate-200 bg-white transition peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-focus-visible:ring-2 peer-focus-visible:ring-navy">
        <span className="relative block aspect-video overflow-hidden bg-navy">
          <Image src={homeBackgroundImage(background.id)} alt="" fill unoptimized className="object-cover" />
          {"style" in background && <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-navy">{background.style}</span>}
          {value === background.id && <CheckCircle2 aria-hidden="true" className="absolute right-2 top-2 h-6 w-6 rounded-full bg-navy text-brand-300" />}
        </span>
        <span className="block p-3">
          <span className="block text-sm font-extrabold text-navy">{background.label}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-600">{background.description}</span>
        </span>
      </span>
    </label>
  );

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-navy">선택 미리보기 <span className="font-normal text-slate-600">· {selected.label}</span></p>
          <p className="text-xs text-slate-500">PC 양옆 여백에 적용됩니다</p>
        </div>
        <div className="relative grid aspect-[16/9] max-w-3xl grid-cols-[27%_42%_31%] overflow-hidden rounded-2xl bg-navy" aria-hidden="true">
          <HomeBackgroundArtwork id={value} />
          <div className="relative col-start-2 flex min-w-0 flex-col gap-2 bg-[#F8F9FA] p-2 shadow-xl sm:gap-3 sm:p-4">
            <div className="flex items-center gap-1 border-b pb-2"><span className="h-2 w-2 rounded-sm bg-brand-500" /><span className="h-1.5 w-1/2 rounded-full bg-navy/60" /></div>
            <div className="flex h-[38%] shrink-0 flex-col justify-end gap-2 rounded-lg bg-navy p-2 sm:p-3">
              <span className="h-1.5 w-3/4 rounded-full bg-white/80" />
              <span className="h-1.5 w-1/2 rounded-full bg-brand-300" />
            </div>
            <span className="h-1.5 w-4/5 rounded-full bg-navy/25" />
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-2"><span className="rounded-lg bg-brand-100" /><span className="rounded-lg bg-brand-100" /></div>
          </div>
          <div className="relative ml-1.5 flex w-[15%] min-w-3 flex-col justify-center self-center gap-1 rounded-lg border border-white/80 bg-white/95 p-1 shadow-lg sm:ml-2 sm:gap-2 sm:p-1.5">
            <span className="aspect-square rounded-sm bg-brand-200" />
            <span className="aspect-square rounded-sm bg-slate-200" />
            <span className="aspect-square rounded-sm bg-slate-200" />
            <span className="aspect-square rounded-sm bg-slate-200" />
          </div>
        </div>
      </div>
      <fieldset disabled={disabled}>
        <legend className="mb-3 text-sm font-bold text-navy">인물 배경 샘플 5종</legend>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {HOME_BACKGROUND_SAMPLES.map(renderOption)}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-600">실사형 3종과 일러스트형 2종으로 구성한 생성형 이미지입니다.</p>
        <details className="mt-5 rounded-xl border bg-[#F8F9FA] p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">기존 공간 배경 5종</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{LEGACY_HOME_BACKGROUNDS.map(renderOption)}</div>
        </details>
      </fieldset>
    </div>
  );
}
