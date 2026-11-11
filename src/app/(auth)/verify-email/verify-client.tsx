"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function VerifyEmail({ token }: { token: string }) {
  const [state, setState] = useState<{ ok: boolean | null; text: string }>({ ok: null, text: "이메일을 인증하고 있습니다…" });
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (!token) { setState({ ok: false, text: "인증 링크가 올바르지 않습니다." }); return; }
    fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((r) => r.json())
      .then((j) => setState(j.ok ? { ok: true, text: "이메일 인증이 끝났습니다." } : { ok: false, text: j.error ?? "인증에 실패했습니다." }))
      .catch(() => setState({ ok: false, text: "인증에 실패했습니다. 잠시 후 다시 시도해 주세요." }));
  }, [token]);
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">이메일 인증</h1>
      <p role="status" className={`mt-4 text-sm ${state.ok === false ? "text-red-600" : state.ok ? "text-emerald-700" : "text-muted-foreground"}`}>{state.text}</p>
      <Link href="/login" className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-navy text-sm font-semibold text-white">로그인 화면으로</Link>
    </div>
  );
}
