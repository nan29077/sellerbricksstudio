"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

async function post(body: Record<string, unknown>) {
  return fetch("/api/brand-team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false }));
}

export function TeamAddForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    setBusy(true); setMsg(null);
    const json = await post({ action: "add", ...f });
    setBusy(false);
    if (!json.ok) { setMsg({ ok: false, text: json.error ?? "추가하지 못했습니다." }); return; }
    form.reset();
    setMsg({ ok: true, text: "팀원 계정을 만들었습니다. 임시 비밀번호를 전달하고, 첫 로그인 후 설정에서 비밀번호를 바꾸도록 안내해 주세요." });
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
      <Label className="block">이름<Input name="name" required maxLength={40} autoComplete="off" /></Label>
      <Label className="block">이메일 (로그인 아이디)<Input name="email" type="email" required autoComplete="off" /></Label>
      <Label className="block">임시 비밀번호 (8자 이상)<Input name="password" type="password" required minLength={8} maxLength={100} autoComplete="new-password" /></Label>
      <div className="flex items-center gap-3 sm:col-span-3">
        <Button disabled={busy}>{busy ? "추가 중…" : "팀원 추가"}</Button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}

export function TeamRemoveButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true); setError("");
    const json = await post({ action: "remove", userId });
    setBusy(false);
    if (!json.ok) { setError(json.error ?? "처리하지 못했습니다."); return; }
    router.refresh();
  }
  if (!confirm) return <button type="button" onClick={() => setConfirm(true)} className="inline-flex h-9 items-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700" aria-label={`${name} 내보내기`}>내보내기</button>;
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-rose-800">
      계정이 비활성화됩니다.
      <button type="button" disabled={busy} onClick={remove} className="inline-flex h-9 items-center rounded-lg bg-rose-600 px-3 font-bold text-white disabled:opacity-60">내보내기</button>
      <button type="button" onClick={() => setConfirm(false)} className="inline-flex h-9 items-center rounded-lg border bg-white px-3 font-bold text-navy">취소</button>
      {error && <span role="alert" className="basis-full text-red-600">{error}</span>}
    </span>
  );
}
