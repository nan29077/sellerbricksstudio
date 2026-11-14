"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LivePlatformPicker } from "@/components/live-platform-picker";
import { CheckCircle2 } from "lucide-react";

// 셀러 설정: 판매하는 라이브 플랫폼
export function SellerPlatformsForm({ initial, initialEtc }: { initial: string[]; initialEtc: string }) {
  const [value, setValue] = useState(initial);
  const [etc, setEtc] = useState(initialEtc);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function save() {
    if (!value.length) { setMsg({ ok: false, text: "플랫폼을 1개 이상 선택하세요." }); return; }
    if (value.includes("ETC") && !etc.trim()) { setMsg({ ok: false, text: "기타 플랫폼 이름을 입력하세요." }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/me/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ livePlatforms: value, livePlatformEtc: etc }) });
      const j = await res.json().catch(() => ({}));
      setMsg(j.ok ? { ok: true, text: "저장했습니다." } : { ok: false, text: j.error ?? "저장하지 못했습니다." });
    } finally { setBusy(false); }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">판매하는 라이브 플랫폼</CardTitle>
        <p className="text-xs text-muted-foreground">주문서를 쓸 때 이 플랫폼 중에서 고릅니다.</p></CardHeader>
      <CardContent className="space-y-3">
        <LivePlatformPicker value={value} onChange={setValue} etc={etc} onEtcChange={setEtc} idPrefix="st-lp" />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={busy}>{busy ? "저장 중..." : "저장"}</Button>
          {msg && <p role="status" className={msg.ok ? "flex items-center gap-1 text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-600"}>{msg.ok && <CheckCircle2 className="h-4 w-4" />}{msg.text}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
