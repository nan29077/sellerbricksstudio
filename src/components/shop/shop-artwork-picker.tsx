"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ShopImage } from "./shop-image";

export function ShopArtworkPicker({ label, presets, value, onChange }: {
  label: string;
  presets: ReadonlyArray<{ url: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputId = useId();
  return (
    <fieldset className="space-y-3">
      <legend className="font-bold text-navy">{label}</legend>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
        {presets.map((preset) => (
          <button type="button" key={preset.url} aria-pressed={preset.url === value}
            onClick={() => onChange(preset.url)}
            className={cn("relative overflow-hidden rounded-xl border bg-white text-left hover:border-brand-400",
              preset.url === value ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200")}>
            <ShopImage src={preset.url} fallback={presets[0].url} className="aspect-[16/8] w-full object-cover" />
            <span className="block px-2 py-2 text-xs font-semibold text-navy">{preset.label}</span>
            {preset.url === value && <Check className="absolute right-1 top-1 h-5 w-5 rounded-full bg-brand-300 p-0.5 text-navy" />}
          </button>
        ))}
      </div>
      <Label htmlFor={inputId}>직접 이미지 주소</Label>
      <Input id={inputId} value={value} maxLength={500} onChange={(event) => onChange(event.target.value)} placeholder="https://…" />
    </fieldset>
  );
}
