"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ChevronRight, Loader2, ShieldCheck, ShoppingBag, Store } from "lucide-react";

const DEMO_ACCOUNTS = [
  { label: "셀러", desc: "상품 고르기 · 방송 예약 · 주문서", email: "seller@sellerbricks.kr", icon: Store, tone: "bg-brand-100 text-brand-800" },
  { label: "브랜드사", desc: "샵 · 상품 등록 · 발주 · 시연품", email: "brand@sellerbricks.kr", icon: ShoppingBag, tone: "bg-violet-100 text-violet-700" },
  { label: "최고관리자", desc: "운영 · 공간 · 정산 · 문의 관리", email: "admin@sellerbricks.kr", icon: ShieldCheck, tone: "bg-red-100 text-red-700" },
];

// 로그인 화면 (2026-11-14: 테스트 계정 여부를 서버에서 받아 처음부터 함께 그린다 — 늦게 뜨던 문제)
export function LoginForm({ demoEnabled }: { demoEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  async function handleSignIn(em: string, pw: string) {
    const res = await signIn("credentials", { email: em, password: pw, redirect: false });
    if (res?.error) {
      // 로그인 시도 제한에 걸린 경우 서버가 보낸 안내 문구를 그대로 보여준다.
      return res.error.includes("시도가 너무 많") ? res.error : false;
    }
    const me = await fetch("/api/me").then((r) => r.json()).catch(() => null);
    const requested = new URLSearchParams(window.location.search).get("callbackUrl");
    const safeCallback = requested?.startsWith("/") && !requested.startsWith("//") ? requested : null;
    router.push(safeCallback ?? me?.data?.home ?? "/");
    router.refresh();
    return true;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const ok = await handleSignIn(email, password);
    setLoading(false);
    if (ok !== true) setError(typeof ok === "string" ? ok : "이메일 또는 비밀번호가 올바르지 않습니다.");
  }

  async function onDemoLogin(em: string) {
    setDemoLoading(em);
    setError("");
    const ok = await handleSignIn(em, "password1234");
    if (ok !== true) {
      setError("테스트 계정 로그인에 실패했습니다. DB가 연결되지 않았을 수 있습니다.");
      setDemoLoading(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">로그인</h1>
      <p className="mt-1 text-sm text-muted-foreground">스토리지마켓 계정으로 로그인하세요.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div><Label>이메일</Label><Input aria-label="이메일" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
        <div><Label>비밀번호</Label><Input aria-label="비밀번호" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" size="lg" disabled={loading || !!demoLoading}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />로그인 중...</> : "로그인"}
        </Button>
      </form>

      {/* 아이디/비밀번호 찾기 */}
      <div className="mt-3 flex justify-center gap-4 text-sm text-gray-500">
        <Link href="/forgot-password?mode=id" className="py-1 underline underline-offset-2 hover:text-gray-700">아이디 찾기</Link>
        <span aria-hidden className="py-1">|</span>
        <Link href="/forgot-password" className="py-1 underline underline-offset-2 hover:text-gray-700">비밀번호 찾기</Link>
      </div>

      {/* 테스트 계정 (데모 로그인이 켜진 환경에서만) — 세로 한 줄씩 */}
      {demoEnabled && (
        <section aria-labelledby="demo-login-heading" className="mt-6 rounded-2xl border border-dashed border-border bg-muted/40 p-4">
          <p id="demo-login-heading" className="mb-3 flex items-center gap-1.5 text-xs font-bold text-navy">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-500" />테스트 계정으로 바로 로그인
          </p>
          <ul className="space-y-2">
            {DEMO_ACCOUNTS.map(({ label, desc, email: em, icon: Icon, tone }) => (
              <li key={em}>
                <button type="button" onClick={() => onDemoLogin(em)} disabled={!!demoLoading || loading}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:border-brand-300 hover:shadow-sm disabled:opacity-60">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>
                    {demoLoading === em ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-navy">{demoLoading === em ? "로그인 중..." : `${label}로 로그인`}</span>
                    <span className="block truncate text-xs text-slate-500">{desc}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[11px] text-muted-foreground">비밀번호 password1234 · 누르면 바로 로그인돼요</p>
        </section>
      )}

      <p className="mt-5 text-center text-sm text-muted-foreground">
        계정이 없으신가요? <Link href="/signup" className="font-semibold text-brand-600">회원가입</Link>
      </p>
    </div>
  );
}
