"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import type { SiteSettings } from "@/lib/settings";
import { Save, Image as ImageIcon, Globe, CheckCircle2 } from "lucide-react";

export function SiteSettingsForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<SiteSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setBusy(true); setSaved(false);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    if (!json.ok) { alert(json.error ?? "저장에 실패했습니다."); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-5">
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
        <Button onClick={save} disabled={busy}><Save className="h-4 w-4" />{busy ? "저장 중..." : "설정 저장"}</Button>
        {saved && <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />저장되었습니다.</span>}
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
