"use client";
import { Check } from "lucide-react";
import { CATEGORY_TREE } from "@/lib/categories";
import { cn } from "@/lib/utils";

// 대분류 카테고리 여러 개 선택 (회원가입 · 브랜드샵 설정)
export function CategoryPicker({ value, onChange, max = 17, name }: {
  value: string[]; onChange: (next: string[]) => void; max?: number; name?: string;
}) {
  const toggle = (c: string) => {
    if (value.includes(c)) onChange(value.filter((v) => v !== c));
    else if (value.length < max) onChange([...value, c]);
  };
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="카테고리 선택">
      {CATEGORY_TREE.map(({ name: c, subs }) => {
        const on = value.includes(c);
        return (
          <button type="button" key={c} onClick={() => toggle(c)} aria-pressed={on}
            title={subs.length ? subs.join(" · ") : undefined}
            className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              on ? "border-brand-500 bg-brand-50 text-navy" : "border-border bg-white text-slate-600 hover:border-brand-300")}>
            {on && <Check className="h-3.5 w-3.5 text-brand-600" />}{c}
          </button>
        );
      })}
      {name && value.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
    </div>
  );
}
