"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Save } from "lucide-react";
import { HomeBackgroundPicker } from "@/components/admin/home-background-picker";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";
import type { HomeBackgroundId } from "@/lib/home-backgrounds";
import type { SiteSettings } from "@/lib/settings";

export function HomeBackgroundForm({ initial }: { initial: HomeBackgroundId }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [persisted, setPersisted] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || value === persisted) return;
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const settings = await api<SiteSettings>("/api/admin/settings", "PATCH", { homeBackground: value });
      setPersisted(settings.homeBackground);
      setSaved(true);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-[22px] border bg-white p-4 shadow-sm sm:p-6">
      <HomeBackgroundPicker value={value} onChange={(next) => { setValue(next); setSaved(false); setError(""); }} disabled={busy} />
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5">
        <Button disabled={busy || value === persisted}><Save className="h-4 w-4" />{busy ? "저장 중…" : "여백 배경 저장"}</Button>
        <Link href="/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-slate-600 hover:bg-brand-50 hover:text-navy">메인페이지 확인<ExternalLink className="h-4 w-4" /></Link>
        {saved && <p role="status" className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />저장했습니다. 메인페이지를 새로고침해 확인하세요.</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>
    </form>
  );
}
