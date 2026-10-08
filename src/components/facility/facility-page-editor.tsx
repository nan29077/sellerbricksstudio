"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { FACILITY_BANNERS, FACILITY_PAGE_THEMES, FACILITY_PROFILE_IMAGES, type FacilityPageConfig } from "@/lib/facility-page";
import { cn } from "@/lib/utils";
import {
  Check, ExternalLink, Eye, Image as ImageIcon, LayoutTemplate,
  Loader2, RotateCcw, Save, Sparkles, UserRound,
} from "lucide-react";

type FacilitySummary = {
  id: string;
  name: string;
  type: string;
  region: string;
  address: string;
};

export function FacilityPageEditor({
  facility,
  initialConfig,
}: {
  facility: FacilitySummary;
  initialConfig: FacilityPageConfig;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const set = <K extends keyof FacilityPageConfig>(key: K, value: FacilityPageConfig[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
  };

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/facility-pages/${facility.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "저장하지 못했습니다.");
      setForm(result.data);
      setMessage("페이지가 저장되었습니다.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const accent = FACILITY_PAGE_THEMES[form.theme].accent;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(460px,0.9fr)]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-navy">페이지 기본 정보</h2>
              <p className="text-xs text-muted-foreground">방문자에게 가장 먼저 보이는 소개 문구입니다.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pageTitle">페이지 제목</Label>
              <Input id="pageTitle" value={form.pageTitle} maxLength={60} onChange={(e) => set("pageTitle", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="tagline">한 줄 소개</Label>
              <Input id="tagline" value={form.tagline} maxLength={100} onChange={(e) => set("tagline", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="intro">상세 소개</Label>
              <Textarea id="intro" className="min-h-32" value={form.intro} maxLength={1000} onChange={(e) => set("intro", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ctaLabel">예약 버튼 문구</Label>
              <Input id="ctaLabel" value={form.ctaLabel} maxLength={30} onChange={(e) => set("ctaLabel", e.target.value)} />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <div className="flex items-center gap-4 border-b border-[#EEEAE0] bg-gradient-to-r from-[#FFF9E8] to-white p-5">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-brand-50 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.profileImageUrl} alt="선택한 시설 프로필" className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-navy/75 py-1 text-center text-[8px] font-black text-white">PROFILE</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-brand-700" />
                <h2 className="font-extrabold text-navy">시설 프로필 이미지</h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">시설마다 20개 이미지 중 하나가 자동 배정됩니다. 원하는 이미지로 선택해 고정할 수도 있습니다.</p>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {FACILITY_PROFILE_IMAGES.map((profile) => {
                const selected = form.profileImageUrl === profile.url;
                return (
                  <button
                    key={profile.url}
                    type="button"
                    title={profile.label}
                    onClick={() => set("profileImageUrl", profile.url)}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-full border-2 bg-slate-50 p-0.5 transition hover:-translate-y-0.5 hover:border-brand-300",
                      selected ? "border-brand-500 ring-2 ring-brand-100" : "border-white shadow-sm",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={profile.url} alt={profile.label} className="h-full w-full rounded-full object-cover" />
                    {selected && <span className="absolute inset-0 flex items-center justify-center rounded-full bg-navy/25"><Check className="h-4 w-4 text-white drop-shadow" /></span>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-navy">생성형 AI 기본 배너</h2>
              <p className="text-xs text-muted-foreground">처음에는 5종 중 하나가 자동 배정되며, 선택하면 그 이미지로 고정됩니다.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FACILITY_BANNERS.map((banner) => {
              const selected = form.bannerUrl === banner.url;
              return (
                <button
                  type="button"
                  key={banner.url}
                  onClick={() => set("bannerUrl", banner.url)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border-2 bg-muted text-left transition",
                    selected ? "border-brand-500 ring-2 ring-brand-100" : "border-transparent hover:border-brand-200",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={banner.url} alt={banner.label} className="aspect-[16/7] w-full object-cover" />
                  <span className="block truncate bg-white px-2.5 py-2 text-xs font-semibold text-navy">{banner.label}</span>
                  {selected && (
                    <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white shadow">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <Label htmlFor="bannerUrl">직접 배너 URL 입력</Label>
            <div className="relative">
              <ImageIcon className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input id="bannerUrl" className="pl-9" value={form.bannerUrl} onChange={(e) => set("bannerUrl", e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-extrabold text-navy">디자인과 노출 섹션</h2>
          <div className="mb-5">
            <Label htmlFor="theme">포인트 컬러</Label>
            <Select id="theme" value={form.theme} onChange={(e) => set("theme", e.target.value as FacilityPageConfig["theme"])}>
              {Object.entries(FACILITY_PAGE_THEMES).map(([key, theme]) => (
                <option key={key} value={key}>{theme.label}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              ["showEquipment", "시설·장비"],
              ["showSchedule", "이용 시간"],
              ["showProducts", "연동 상품"],
            ] as const).map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => set(key, !form[key])}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold transition",
                  form[key] ? "border-brand-300 bg-brand-50 text-brand-800" : "border-border bg-muted/30 text-muted-foreground",
                )}
              >
                {label}
                <span className={cn("h-2.5 w-2.5 rounded-full", form[key] ? "bg-brand-500" : "bg-slate-300")} />
              </button>
            ))}
          </div>
        </section>

        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-white/95 p-3 shadow-xl backdrop-blur">
          <Button type="button" variant="ghost" onClick={() => setForm(initialConfig)}>
            <RotateCcw className="h-4 w-4" /> 되돌리기
          </Button>
          <div className="flex items-center gap-3">
            {message && <p className={cn("text-xs font-semibold", message.includes("저장되었습니다") ? "text-emerald-600" : "text-red-600")}>{message}</p>}
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              저장하기
            </Button>
          </div>
        </div>
      </div>

      <aside className="xl:sticky xl:top-6 xl:h-fit">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-extrabold text-navy"><Eye className="h-4 w-4" /> 실시간 미리보기</div>
          <Link href={`/facilities/${facility.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline">
            공개 페이지 열기 <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-hidden rounded-[24px] border-8 border-navy bg-[#FBF8EE] shadow-2xl">
          <div className="flex h-14 items-center justify-between border-b bg-white px-4">
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-8 w-8 overflow-hidden rounded-full border-2 border-brand-100 bg-brand-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.profileImageUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <p className="truncate text-xs font-black text-navy">{form.pageTitle || facility.name}</p>
            </div>
            <div className="flex gap-1.5"><span className="h-7 w-7 rounded-lg border-2 border-navy bg-[#FFD552]" /><span className="h-7 w-7 rounded-lg border-2 border-navy bg-[#FFD552]" /></div>
          </div>
          <div className="relative aspect-[16/8] overflow-hidden bg-navy">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.bannerUrl} alt="배너 미리보기" className="h-full w-full object-cover" />
          </div>
          <div className="relative -mt-10 px-3 pb-4">
            <div className="relative rounded-[22px] border border-white bg-white p-4 pt-10 shadow-xl">
              <div className="absolute -top-8 left-4 h-16 w-16 rounded-full border-4 border-white bg-brand-50 shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.profileImageUrl} alt="" className="h-full w-full rounded-full object-cover" />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-2 py-0.5 text-[7px] font-black text-white">● OPEN</span>
              </div>
              <div className="pl-[68px]">
                <p className="truncate text-base font-black text-navy">{form.pageTitle || facility.name}</p>
                <p className="mt-0.5 truncate text-[9px] font-semibold text-slate-400">{facility.type === "WAREHOUSE" ? "물류 창고" : "라이브 스튜디오"} · {facility.region}</p>
              </div>
              <div className="mt-4 grid grid-cols-3 divide-x rounded-xl bg-[#F8F9FB] py-3 text-center">
                {[['4.9', '시설 평점'], ['0', '연동 상품'], ['0', '예약 일정']].map(([value, label]) => (
                  <div key={label}><p className="text-sm font-black text-navy">{value}</p><p className="mt-0.5 text-[8px] text-slate-400">{label}</p></div>
                ))}
              </div>
              <p className="mt-3 line-clamp-2 text-[10px] font-bold leading-relaxed text-slate-500">{form.tagline}</p>
              <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-slate-400">{form.intro}</p>
              <div className="mt-4 rounded-xl border border-[#D99000] py-2.5 text-center text-[11px] font-black text-navy shadow-sm" style={{ backgroundColor: accent }}>
                <span className="mr-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[7px] text-white">● 예약</span>{form.ctaLabel}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 rounded-xl border bg-white p-1 text-center text-[8px] font-bold text-slate-400">
              {['홈', '상품', '예약', '시설'].map((label, index) => <div key={label} className={cn('rounded-lg py-2', index === 0 && 'bg-brand-50 text-navy')}>{label}</div>)}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
