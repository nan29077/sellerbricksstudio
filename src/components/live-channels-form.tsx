"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type Ch = { type: string; url: string | null };
const TYPES: [string, string, string][] = [
  ["YOUTUBE", "유튜브 방송 주소", "https://www.youtube.com/live/..."],
  ["INSTAGRAM", "인스타그램 주소", "https://www.instagram.com/내계정"],
  ["TIKTOK", "틱톡 주소", "https://www.tiktok.com/@내계정/live"],
  ["ETC", "기타 방송 주소", "https://"],
];

// 외부 송출 채널 주소 입력 — 유튜브는 구매자 화면에 영상으로, 나머지는 '앱에서 보기' 버튼으로 나온다.
export function LiveChannelsForm({ sessionId, channels, disabled }: { sessionId: string; channels: Ch[]; disabled?: boolean }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(TYPES.map(([t]) => [t, channels.find((c) => c.type === t)?.url ?? ""])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setBusy(true); setMsg("");
    // 채운 칸만 보낸다 (비운 칸의 채널은 지워진다)
    const body = { channels: TYPES.filter(([t]) => vals[t].trim()).map(([t]) => ({ type: t, url: vals[t].trim() })) };
    const res = await fetch(`/api/live-sessions/${sessionId}/channels`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    setMsg(json.ok ? "저장했습니다. 구매자 방송 화면에 바로 반영됩니다." : json.error ?? "저장하지 못했습니다.");
    if (json.ok) router.refresh();
  }

  return (
    <div className="space-y-3 text-sm">
      {TYPES.map(([t, label, ph]) => (
        <div key={t}>
          <Label htmlFor={`ch-${t}`}>{label}</Label>
          <Input id={`ch-${t}`} type="url" inputMode="url" placeholder={ph} value={vals[t]} disabled={disabled}
            onChange={(e) => setVals((p) => ({ ...p, [t]: e.target.value }))} />
        </div>
      ))}
      <p className="text-xs text-slate-500">유튜브 주소를 넣으면 구매자 방송 화면에 영상이 바로 나옵니다. 방송을 시작한 뒤 주소가 생겨도 여기에 넣으면 됩니다.</p>
      <Button onClick={save} disabled={busy || disabled} size="sm">{busy ? "저장 중..." : "채널 주소 저장"}</Button>
      {msg && <p role="status" className="text-xs text-navy">{msg}</p>}
    </div>
  );
}
