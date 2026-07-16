"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Play, Square, CheckCircle2, Send } from "lucide-react";

export function LiveSessionControls({ sessionId, status }: { sessionId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function setStatus(s: string) {
    setBusy(true);
    const res = await fetch(`/api/live-sessions/${sessionId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }),
    });
    const json = await res.json(); setBusy(false);
    if (!json.ok) { alert(json.error); return; }
    router.refresh();
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && <Button onClick={() => setStatus("READY")} disabled={busy} variant="outline">방송 준비</Button>}
      {(status === "DRAFT" || status === "READY") && <Button onClick={() => setStatus("LIVE")} disabled={busy}><Play className="h-4 w-4" />방송 시작</Button>}
      {status === "LIVE" && <Button onClick={() => setStatus("ENDED")} disabled={busy} variant="destructive"><Square className="h-4 w-4" />방송 종료</Button>}
      {status === "ENDED" && <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />방송이 종료되었습니다.</span>}
      {status !== "ENDED" && status !== "CANCELLED" && <Button onClick={() => setStatus("CANCELLED")} disabled={busy} variant="ghost">취소</Button>}
    </div>
  );
}

function Alimtalk({ sessionId, channels }: { sessionId: string; channels: { id: string; name: string; count: number }[] }) {
  const router = useRouter();
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");

  async function send() {
    if (!channelId) { alert("카카오 채널이 없습니다. 알림톡 메뉴에서 가입자를 등록하세요."); return; }
    if (!confirm("선택한 채널 가입자에게 방송 링크를 발송할까요?")) return;
    setBusy(true); setResult("");
    const res = await fetch(`/api/live-sessions/${sessionId}/alimtalk`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId, templateCode: "LIVE_OPEN" }),
    });
    const json = await res.json(); setBusy(false);
    if (!json.ok) { alert(json.error); return; }
    setResult(`${json.data.sent}건 발송 완료 (Mock)`);
    router.refresh();
  }

  if (channels.length === 0) return <p className="text-sm text-muted-foreground">등록된 카카오 채널/가입자가 없습니다.</p>;
  return (
    <div className="space-y-3">
      <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
        {channels.map((c) => <option key={c.id} value={c.id}>{c.name} (가입자 {c.count}명)</option>)}
      </Select>
      <Button onClick={send} disabled={busy} className="w-full"><Send className="h-4 w-4" />{busy ? "발송 중..." : "방송 링크 알림톡 발송"}</Button>
      {result && <p className="text-sm text-emerald-600">{result}</p>}
    </div>
  );
}

LiveSessionControls.Alimtalk = Alimtalk;
