"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function ResetPasswordForm({ token }: { token: string }) {
  const [valid, setValid] = useState<boolean | null>(null);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setValid(false); return; }
    fetch(`/api/auth/password-reset/confirm?token=${encodeURIComponent(token)}`).then((r) => r.json()).then((j) => setValid(!!j?.data?.valid)).catch(() => setValid(false));
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next.length < 8) { setMsg({ ok: false, text: "새 비밀번호는 8자 이상이어야 합니다." }); return; }
    if (pw.next !== pw.confirm) { setMsg({ ok: false, text: "새 비밀번호가 서로 일치하지 않습니다." }); return; }
    setLoading(true); setMsg(null);
    const res = await fetch("/api/auth/password-reset/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw.next }) });
    const json = await res.json().catch(() => ({ ok: false }));
    setLoading(false);
    setMsg(json.ok ? { ok: true, text: "비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요." } : { ok: false, text: json.error ?? "변경에 실패했습니다." });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">새 비밀번호 설정</h1>
      {valid === false && !msg?.ok && (
        <div className="mt-4 space-y-3">
          <p role="alert" className="text-sm text-red-600">링크가 만료되었거나 이미 사용되었습니다.</p>
          <Link href="/forgot-password" className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-navy text-sm font-semibold text-white">비밀번호 찾기 다시 하기</Link>
        </div>
      )}
      {valid && !msg?.ok && (
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div><Label htmlFor="rp-new">새 비밀번호 (8자 이상)</Label><Input id="rp-new" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={8} maxLength={100} /></div>
          <div><Label htmlFor="rp-confirm">새 비밀번호 확인</Label><Input id="rp-confirm" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></div>
          {msg && <p role="alert" className="text-sm text-red-600">{msg.text}</p>}
          <Button className="w-full" size="lg" disabled={loading}>{loading ? "저장 중..." : "비밀번호 바꾸기"}</Button>
        </form>
      )}
      {valid === null && <p className="mt-4 text-sm text-muted-foreground">링크를 확인하고 있습니다…</p>}
      {msg?.ok && (
        <div className="mt-4 space-y-3">
          <p role="status" className="text-sm text-emerald-700">{msg.text}</p>
          <Link href="/login" className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-navy text-sm font-semibold text-white">로그인하기</Link>
        </div>
      )}
    </div>
  );
}
