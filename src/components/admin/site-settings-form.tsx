"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import type { SiteSettings } from "@/lib/settings";
import { HOME_BACKGROUNDS, homeBackgroundImage } from "@/lib/home-backgrounds";
import { api } from "@/lib/client-api";
import { Save, Image as ImageIcon, Globe, CheckCircle2 } from "lucide-react";

const editableKeys = ["homeBackground", "siteName", "siteDescription", "bannerEnabled", "bannerText", "bannerLinkLabel", "bannerLinkUrl"] as const;

export function SiteSettingsForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<SiteSettings>(initial);
  const [persisted, setPersisted] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
    setError("");
  }

  async function save() {
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const patch = Object.fromEntries(editableKeys.filter((key) => form[key] !== persisted[key]).map((key) => [key, form[key]]));
      const next = await api<SiteSettings>("/api/admin/settings", "PATCH", patch);
      setPersisted(next);
      setSaved(true);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-5 w-5 text-brand-500" />메인 PC 배경 이미지
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm leading-6 text-slate-600">PC에서 모바일형 화면 뒤에 표시할 배경을 고르고 설정을 저장하세요.</p>
          <div className="relative mb-4 grid aspect-[2/1] max-h-72 grid-cols-[1fr_36%_1fr] overflow-hidden rounded-2xl bg-navy" aria-hidden="true">
            <Image src={homeBackgroundImage(form.homeBackground)} alt="" fill sizes="(min-width: 1280px) 900px, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-navy/40" />
            <div className="relative col-start-2 flex flex-col gap-2 bg-[#FCFBF8] p-2 shadow-xl sm:p-4">
              <div className="h-2 w-3/5 rounded-full bg-navy/20" />
              <div className="h-2/5 rounded-lg bg-navy/90" />
              <div className="grid flex-1 grid-cols-2 gap-2"><span className="rounded-lg bg-brand-100" /><span className="rounded-lg bg-brand-100" /></div>
            </div>
            <div className="relative my-auto ml-3 flex w-1/2 flex-col gap-2 rounded-xl bg-navy/80 p-2 sm:p-3">
              <div className="h-2 rounded-full bg-white/30" />
              <div className="h-2 rounded-full bg-white/30" />
              <div className="h-3 rounded-full bg-brand-500" />
            </div>
          </div>
          <fieldset className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" disabled={busy}>
            <legend className="sr-only">배경 이미지 선택</legend>
            {HOME_BACKGROUNDS.map((background) => (
              <label key={background.id} className="relative cursor-pointer">
                <input type="radio" name="home-background" className="peer sr-only" checked={form.homeBackground === background.id} onChange={() => set("homeBackground", background.id)} />
                <span className="block h-full overflow-hidden rounded-xl border-2 border-transparent bg-muted peer-checked:border-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-navy">
                  <span className="relative block aspect-video bg-navy">
                    <Image src={homeBackgroundImage(background.id)} alt="" fill sizes="(min-width: 1280px) 230px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                    {form.homeBackground === background.id && <CheckCircle2 aria-hidden="true" className="absolute right-2 top-2 h-6 w-6 rounded-full bg-navy text-brand-300" />}
                  </span>
                  <span className="block px-3 py-2">
                    <span className="block text-sm font-bold text-navy">{background.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-600">{background.description}</span>
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </CardContent>
      </Card>
      {/* 사이트 관리 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5 text-brand-500" />사이트 관리
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>사이트 이름</Label>
            <Input value={form.siteName} onChange={(e) => set("siteName", e.target.value)} placeholder="셀러 브릭스" />
          </div>
          <div>
            <Label>사이트 설명</Label>
            <Textarea value={form.siteDescription} onChange={(e) => set("siteDescription", e.target.value)}
              placeholder="라이브 커머스 셀러를 위한 셀러 매니지먼트 플랫폼" />
          </div>
        </CardContent>
      </Card>

      {/* 배너 관리 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-5 w-5 text-brand-500" />상단 배너 관리
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between rounded-lg border border-border px-4 py-3 cursor-pointer">
            <div>
              <p className="font-medium text-navy text-sm">배너 표시</p>
              <p className="text-xs text-muted-foreground">메인 페이지 상단에 안내 배너를 노출합니다.</p>
            </div>
            <Toggle on={form.bannerEnabled} onChange={(v) => set("bannerEnabled", v)} />
          </label>
          <div>
            <Label>배너 문구</Label>
            <Input value={form.bannerText} onChange={(e) => set("bannerText", e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>버튼 라벨</Label>
              <Input value={form.bannerLinkLabel} onChange={(e) => set("bannerLinkLabel", e.target.value)} />
            </div>
            <div>
              <Label>버튼 링크</Label>
              <Input value={form.bannerLinkUrl} onChange={(e) => set("bannerLinkUrl", e.target.value)} placeholder="/register" />
            </div>
          </div>
          {form.bannerEnabled && (
            <div className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm flex items-center justify-between gap-3">
              <span className="truncate">{form.bannerText}</span>
              <span className="shrink-0 rounded-md bg-white/20 px-3 py-1 text-xs font-semibold">{form.bannerLinkLabel}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy || editableKeys.every((key) => form[key] === persisted[key])}><Save className="h-4 w-4" />{busy ? "저장 중..." : "설정 저장"}</Button>
        {saved && <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />저장되었습니다.</span>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${on ? "bg-brand-500" : "bg-muted-foreground/30"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}
