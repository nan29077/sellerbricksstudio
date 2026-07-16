"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function KakaoSubscriberUpload({ channelId }: { channelId: string }) {
  const router = useRouter();
  const [csv, setCsv] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  async function upload() {
    setBusy(true); setMsg("");
    const res = await fetch("/api/kakao/subscribers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId, csv }) });
    const json = await res.json(); setBusy(false);
    if (!json.ok) { setMsg(json.error); return; }
    setMsg(`${json.data.inserted}명 추가됨`); setCsv(""); router.refresh();
  }
  return (
    <div>
      <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"이름,전화번호\n홍길동,010-1234-5678"} className="text-xs h-20" />
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" onClick={upload} disabled={busy || !csv}>{busy ? "업로드 중..." : "가입자 CSV 추가"}</Button>
        {msg && <span className="text-xs text-emerald-600">{msg}</span>}
      </div>
    </div>
  );
}
