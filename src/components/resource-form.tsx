"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client-api";

export type Field = {
  name: string; label: string;
  type?: "text" | "textarea" | "number" | "select" | "datetime" | "date" | "checkbox" | "url" | "time";
  options?: { value: string; label: string }[];
  required?: boolean; placeholder?: string; help?: string; half?: boolean; min?: number; max?: number;
};

// 공통 생성/수정 폼 (다이얼로그). id가 있으면 PATCH {url}/{id}, 없으면 POST {url}
export function ResourceForm({
  url, fields, initial, id, title, triggerLabel, triggerVariant = "default", triggerSize = "default", iconOnly = false, method,
  extraBody, onDone, successMessage,
}: {
  url: string; fields: Field[]; initial?: Record<string, any>; id?: string; title: string; triggerLabel?: string;
  triggerVariant?: ButtonProps["variant"]; triggerSize?: ButtonProps["size"]; iconOnly?: boolean; method?: string;
  extraBody?: Record<string, unknown>; onDone?: () => void; successMessage?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const init = () => Object.fromEntries(fields.map((f) => [f.name, initial?.[f.name] ?? (f.type === "checkbox" ? false : f.type === "select" ? f.options?.[0]?.value ?? "" : "")]));
  const [values, setValues] = useState<Record<string, any>>(init);

  async function save() {
    setError("");
    for (const f of fields) if (f.required && (values[f.name] === "" || values[f.name] === null)) { setError(`${f.label}을(를) 입력하세요.`); return; }
    setBusy(true);
    try {
      const body = { ...values, ...extraBody };
      for (const f of fields) if (f.type === "number" && body[f.name] !== "") body[f.name] = Number(body[f.name]);
      await api(id ? `${url}/${id}` : url, method ?? (id ? "PATCH" : "POST"), body);
      setOpen(false);
      if (successMessage) alert(successMessage);
      onDone?.();
      router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const set = (k: string, v: any) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <>
      <Button type="button" variant={triggerVariant} size={iconOnly ? "sm" : triggerSize} onClick={() => { setValues(init()); setError(""); setOpen(true); }} aria-label={title}>
        {id ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}{!iconOnly && (triggerLabel ?? title)}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}
        footer={<><Button variant="outline" size="sm" onClick={() => setOpen(false)}>취소</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "저장중..." : "저장"}</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.name} className={f.half ? "col-span-2 sm:col-span-1" : "col-span-2"}>
              {f.type === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm font-medium text-navy">
                  <input type="checkbox" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} className="h-4 w-4 accent-brand-500" />{f.label}
                </label>
              ) : (
                <>
                  <Label>{f.label}{f.required && <span className="text-red-500"> *</span>}</Label>
                  {f.type === "textarea" ? (
                    <Textarea value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} rows={4} />
                  ) : f.type === "select" ? (
                    <Select value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  ) : (
                    <Input
                      type={f.type === "datetime" ? "datetime-local" : f.type === "url" ? "url" : f.type ?? "text"}
                      value={values[f.name] ?? ""} min={f.min} max={f.max}
                      onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder}
                    />
                  )}
                </>
              )}
              {f.help && <p className="mt-1 text-[11px] text-muted-foreground">{f.help}</p>}
            </div>
          ))}
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </Dialog>
    </>
  );
}

export function DeleteButton({ url, confirmText = "삭제할까요? 되돌릴 수 없습니다.", label }: { url: string; confirmText?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button type="button" size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={busy}
      onClick={async () => {
        if (!confirm(confirmText)) return;
        setBusy(true);
        try { await api(url, "DELETE"); router.refresh(); } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
      }}>
      <Trash2 className="h-3.5 w-3.5" />{label}
    </Button>
  );
}

// 단일 필드 즉시 변경 (예: 활성/비활성 토글)
export function PatchButton({ url, body, children, confirmText, ...props }: { url: string; body: Record<string, unknown>; confirmText?: string } & ButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button type="button" size="sm" disabled={busy} {...props}
      onClick={async () => {
        if (confirmText && !confirm(confirmText)) return;
        setBusy(true);
        try { await api(url, "PATCH", body); router.refresh(); } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
      }}>{busy ? "처리중..." : children}</Button>
  );
}
