"use client";
import { appPrompt } from "@/components/ui/app-dialog";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyText({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { (await appPrompt("복사하세요", { defaultValue: text })); } }}
      className="inline-flex max-w-full items-center gap-2 rounded-lg border border-dashed border-brand-300 bg-brand-50 px-3 py-1.5 font-mono text-sm font-bold text-brand-800 hover:bg-brand-100">
      <span className="truncate">{label ?? text}</span>{done ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
    </button>
  );
}
