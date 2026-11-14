"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Camera, ChevronDown, LayoutGrid, MapPin, Search, Store, Warehouse } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cardActionClassName, cardLinkClassName } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { SPACE_TYPE_LABELS, type SpaceCard } from "@/lib/showcase";
import { cn } from "@/lib/utils";

const pageSize = 6;
const spaceTypes = [
  { value: "all", label: "전체", icon: LayoutGrid },
  { value: "WAREHOUSE", label: "창고", icon: Warehouse },
  { value: "STUDIO", label: "스튜디오", icon: Camera },
  { value: "SHOWROOM", label: "쇼룸", icon: Store },
] as const;
// 스토리지마켓이 직접 운영(직영)하거나 직접 관리하는 제휴 공간만 보여 준다 (2026-11-14). 예시(가상) 공간은 넣지 않는다.
const OPERATION_LABEL = { DIRECT: "직영", PARTNER: "직접 관리" } as const;

export function SpaceMarketplace({ spaces: input, registeredAvailable }: { spaces: SpaceCard[]; registeredAvailable: boolean }) {
  const spaces = input.filter((space) => !space.demo);
  const [type, setType] = useState<string>("all");
  const [region, setRegion] = useState("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(pageSize);
  const regions = Array.from(new Set(spaces.map((space) => space.region))).sort((a, b) => a.localeCompare(b, "ko"));
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = spaces.filter((space) => {
    if (type !== "all" && space.type !== type) return false;
    if (region !== "all" && space.region !== region) return false;
    const searchable = [space.name, space.location, SPACE_TYPE_LABELS[space.type], ...space.tags].join(" ").toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });

  function reset() {
    setType("all");
    setRegion("all");
    setQuery("");
    setLimit(pageSize);
  }

  return (
    <section id="spaces" className="scroll-mt-20 px-4 pb-12 pt-10 sm:px-6 sm:pt-12">
      <h2 className="break-keep text-2xl font-black tracking-tight text-navy sm:text-3xl">창고 · 스튜디오 · 쇼룸 찾기</h2>
      <p className="mt-2 break-keep text-sm leading-6 text-slate-600">스토리지마켓이 직접 운영하거나 직접 관리하는 공간만 모았어요. 고른 브랜드 상품을 미리 준비해 두고, 예약한 날 바로 방송할 수 있습니다.</p>

      <div className="mt-5 rounded-[20px] border border-slate-200 bg-white p-3 sm:p-4">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2" role="group" aria-label="공간 유형">
          {spaceTypes.map(({ value, label, icon: Icon }) => (
            <button key={value} type="button" aria-pressed={type === value} onClick={() => { setType(value); setLimit(pageSize); }} className={cn("flex min-h-11 items-center justify-center gap-1 rounded-xl border px-1 text-xs font-bold transition sm:gap-1.5 sm:px-2 sm:text-sm", type === value ? "border-navy bg-navy text-white" : "border-slate-200 bg-[#F8F9FA] text-navy hover:bg-brand-50")}>
              <Icon className="h-4 w-4 shrink-0" />{label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.6fr]">
          <Select aria-label="지역" value={region} onChange={(event) => { setRegion(event.target.value); setLimit(pageSize); }}>
            <option value="all">전체 지역</option>
            {regions.map((name) => <option key={name} value={name}>{name}</option>)}
          </Select>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
            <Input type="search" aria-label="공간 검색" placeholder="공간 이름, 시설, 지역" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(pageSize); }} className="pl-9" />
          </div>
        </div>
      </div>

      <div className="my-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p role="status" className="text-xs font-semibold text-slate-600">공간 <strong className="text-navy">{filtered.length}</strong>곳</p>
          <p className="text-[11px] text-slate-500">썸네일은 생성형 연출 이미지입니다</p>
        </div>
        <Link href="/facilities" className={buttonVariants({ variant: "outline", className: "rounded-xl px-3 text-xs" })}>전체 등록 공간</Link>
      </div>
      {!registeredAvailable && <p className="mb-3 rounded-xl bg-brand-50 p-3 text-xs leading-5 text-navy">등록 공간을 불러오지 못했습니다. 등록 공간 페이지에서 다시 확인할 수 있습니다.</p>}
      {filtered.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {filtered.slice(0, limit).map((space) => (
            <Link key={space.id} href={`/facilities/${space.id}`} aria-label={`${space.name} 공간 보기`} className={cardLinkClassName}>
              <div className="relative aspect-[4/3] overflow-hidden bg-brand-100">
                <Image src={space.image} alt="" fill unoptimized className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-navy px-2 py-1 text-[11px] font-bold text-white shadow-sm"><BadgeCheck aria-hidden="true" className="h-3 w-3 text-brand-300" />{space.operation ? OPERATION_LABEL[space.operation] : "스토리지마켓"}</span>
              </div>
              <div className="flex flex-1 flex-col p-3 sm:p-4">
                <p className="flex items-start gap-1 text-xs font-medium text-slate-600"><MapPin aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />{space.location} · {SPACE_TYPE_LABELS[space.type]}</p>
                <h3 className="mb-2.5 mt-1.5 break-keep text-sm font-extrabold leading-snug tracking-tight text-navy [overflow-wrap:anywhere] sm:text-base">{space.name}</h3>
                {space.tags.length > 0 && <div className="mb-3 flex flex-wrap gap-1">
                  {space.tags.map((tag) => <span key={tag} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">{tag}</span>)}
                </div>}
                <div className="mt-auto space-y-2.5 border-t border-slate-100 pt-2.5">
                  {/* 공간 이용료는 기존에 저장된 요금과 관계없이 무료로 표시한다. */}
                  <p className="text-xs font-bold text-slate-600">이용료 <strong className="text-sm font-extrabold text-emerald-800">무료</strong> · 상품 미리 준비</p>
                  <span className={cardActionClassName}>공간 보기 · 예약</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-white p-6 text-center">
          <p className="font-bold text-navy">조건에 맞는 공간이 없습니다</p>
          <p className="mt-1 text-sm text-slate-600">{spaces.length ? "다른 지역을 선택하거나 검색어를 바꿔 보세요." : "운영 중인 공간을 준비하고 있어요."}</p>
          <button type="button" onClick={reset} className="mt-3 rounded-full bg-brand-50 px-5 text-sm font-bold text-navy hover:bg-brand-100">필터 초기화</button>
        </div>
      )}
      {limit < filtered.length && (
        <button type="button" onClick={() => setLimit(limit + pageSize)} className="mx-auto mt-5 flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-navy hover:bg-brand-50">
          공간 더 보기 <span className="text-xs font-medium text-slate-500">{limit} / {filtered.length}</span><ChevronDown className="h-4 w-4" />
        </button>
      )}
    </section>
  );
}
