"use client";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Dialog } from "./dialog";
import { Button } from "./button";

// ---------------------------------------------------------------------------
// 브라우저 기본 alert / confirm / prompt 대신 쓰는 앱 디자인 대화상자.
//   await appConfirm("삭제할까요?")   → true / false
//   await appPrompt("사유를 입력하세요", { required: true }) → 문자열 / null(취소)
//   appAlert("저장했습니다")
// ---------------------------------------------------------------------------
type Kind = "alert" | "confirm" | "prompt";
type Opts = { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; defaultValue?: string; required?: boolean; multiline?: boolean; placeholder?: string };

function AppDialog({ kind, message, opts, done }: { kind: Kind; message: string; opts: Opts; done: (v: { ok: boolean; value?: string }) => void }) {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState(opts.defaultValue ?? "");
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const okBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => { (kind === "prompt" ? input.current : okBtn.current)?.focus(); }, [kind]);
  const close = (ok: boolean) => { setOpen(false); done({ ok, value }); };
  const blocked = kind === "prompt" && opts.required && !value.trim();
  return (
    <Dialog open={open} onClose={() => close(kind === "alert")} title={opts.title ?? (kind === "alert" ? "알림" : "확인")}
      footer={<>
        {kind !== "alert" && <Button variant="outline" onClick={() => close(false)}>{opts.cancelLabel ?? "취소"}</Button>}
        <Button ref={okBtn} disabled={blocked} onClick={() => close(true)} className={opts.danger ? "bg-red-600 hover:bg-red-700" : undefined}>{opts.confirmLabel ?? "확인"}</Button>
      </>}>
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{message}</p>
      {kind === "prompt" && (opts.multiline
        ? <textarea ref={input} value={value} onChange={(e) => setValue(e.target.value)} rows={3} maxLength={1000} placeholder={opts.placeholder} aria-label={message} className="mt-3 w-full rounded-lg border border-border p-2 text-sm" />
        : <input ref={input} value={value} onChange={(e) => setValue(e.target.value)} maxLength={300} placeholder={opts.placeholder} aria-label={message}
            onKeyDown={(e) => { if (e.key === "Enter" && !blocked) close(true); }} className="mt-3 h-11 w-full rounded-lg border border-border px-3 text-sm" />)}
    </Dialog>
  );
}

function show(kind: Kind, message: string, opts: Opts = {}) {
  return new Promise<{ ok: boolean; value?: string }>((resolve) => {
    if (typeof document === "undefined") return resolve({ ok: kind === "alert" });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(<AppDialog kind={kind} message={message} opts={opts} done={(v) => {
      resolve(v);
      setTimeout(() => { root.unmount(); host.remove(); }, 0);
    }} />);
  });
}

export async function appAlert(message: string, opts?: Opts) { await show("alert", message, opts); }
export async function appConfirm(message: string, opts?: Opts) { return (await show("confirm", message, opts)).ok; }
export async function appPrompt(message: string, opts?: Opts) {
  const r = await show("prompt", message, opts);
  return r.ok ? (r.value ?? "") : null;
}
