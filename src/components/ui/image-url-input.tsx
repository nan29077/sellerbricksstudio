"use client";
import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

// 이미지 주소 입력칸 + 파일 올리기 버튼. 올리면 받은 주소를 입력칸에 채운다. (폼에는 name 으로 그대로 전송)
export function ImageUrlInput({ name, defaultValue = "", folder = "misc", placeholder = "https://… 또는 파일 올리기", id, maxLength = 500 }: {
  name: string; defaultValue?: string; folder?: string; placeholder?: string; id?: string; maxLength?: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);

  async function upload(f: File) {
    setBusy(true); setError("");
    const body = new FormData();
    body.append("file", f);
    body.append("folder", folder);
    const json = await fetch("/api/uploads", { method: "POST", body }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (json.ok) setValue(json.data.url);
    else setError(json.error ?? "업로드에 실패했습니다.");
  }

  return (
    <span className="block">
      <span className="flex gap-2">
        <Input id={id} name={name} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} maxLength={maxLength} className="min-w-0 flex-1" />
        <button type="button" onClick={() => file.current?.click()} disabled={busy}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
          {busy ? "올리는 중" : "파일 올리기"}
        </button>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" aria-label="이미지 파일 선택"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
      </span>
      {error && <span role="alert" className="mt-1 block text-xs font-normal text-red-600">{error}</span>}
    </span>
  );
}
