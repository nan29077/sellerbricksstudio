"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

// 비밀번호 찾기 (아이디 = 가입한 이메일)
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string; devLink?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    const res = await fetch("/api/auth/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const json = await res.json().catch(() => ({ ok: false }));
    setLoading(false);
    setMsg(json.ok ? { ok: true, text: json.data.message, devLink: json.data.devLink } : { ok: false, text: json.error ?? "요청에 실패했습니다." });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">비밀번호 찾기</h1>
      <p className="mt-1 text-sm text-muted-foreground">가입한 이메일로 비밀번호 재설정 링크를 보내 드립니다.</p>
      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        <b className="text-navy">아이디를 잊으셨나요?</b> 스토리지마켓은 가입한 이메일 주소가 아이디입니다. 이메일이 기억나지 않으면 <Link href="/support" className="font-semibold text-brand-700 underline underline-offset-2">고객센터</Link>에 가입 시 이름과 연락처를 남겨 주세요.
      </div>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div><Label htmlFor="fp-email">가입한 이메일</Label><Input id="fp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
        {msg?.devLink && <p className="break-all rounded-lg bg-amber-50 p-2 text-xs text-amber-800">개발 환경 확인용 링크: <a className="underline" href={msg.devLink}>{msg.devLink}</a></p>}
        <Button className="w-full" size="lg" disabled={loading}>{loading ? "보내는 중..." : "재설정 링크 받기"}</Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground"><Link href="/login" className="font-semibold text-navy underline underline-offset-2">로그인으로 돌아가기</Link></p>
    </div>
  );
}
