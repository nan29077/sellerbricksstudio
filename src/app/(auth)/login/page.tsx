"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Loader2, ShieldCheck, Store, Warehouse } from "lucide-react";

const DEMO_ACCOUNTS = [
  { label: "최고관리자", role: "SUPER_ADMIN", email: "admin@sellerbricks.kr", icon: ShieldCheck, color: "text-red-600 bg-red-50 border-red-200" },
  { label: "창고(스튜디오) 관리자", role: "FACILITY_ADMIN", email: "facility@sellerbricks.kr", icon: Warehouse, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { label: "셀러", role: "SELLER", email: "seller@sellerbricks.kr", icon: Store, color: "text-brand-600 bg-brand-50 border-brand-200" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [flags, setFlags] = useState<{ facilityDisabled?: boolean }>({});

  useEffect(() => {
    fetch("/api/site-flags")
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setFlags(j.data ?? {}); })
      .catch(() => {});
  }, []);

  const visibleAccounts = DEMO_ACCOUNTS.filter((a) => {
    if (a.role === "FACILITY_ADMIN" && flags.facilityDisabled) return false;
    return true;
  });

  async function handleSignIn(em: string, pw: string) {
    const res = await signIn("credentials", { email: em, password: pw, redirect: false });
    if (res?.error) return false;
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
    if (!ok) setError("이메일 또는 비밀번호가 올바르지 않습니다.");
  }

  async function onDemoLogin(em: string) {
    setDemoLoading(em);
    setError("");
    const ok = await handleSignIn(em, "password1234");
    if (!ok) {
      setError("테스트 계정 로그인에 실패했습니다. DB가 연결되지 않았을 수 있습니다.");
      setDemoLoading(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">로그인</h1>
      <p className="mt-1 text-sm text-muted-foreground">셀러 브릭스 계정으로 로그인하세요.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div><Label>이메일</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
        <div><Label>비밀번호</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" size="lg" disabled={loading || !!demoLoading}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />로그인 중...</> : "로그인"}
        </Button>
      </form>

      {/* 아이디/비밀번호 찾기 */}
      <div className="flex justify-center gap-4 text-xs text-gray-400 mt-2">
        <button type="button" onClick={() => alert('아이디 찾기는 준비 중입니다.')} className="hover:text-gray-600 underline underline-offset-2">
          아이디 찾기
        </button>
        <span>|</span>
        <button type="button" onClick={() => alert('비밀번호 찾기는 준비 중입니다.')} className="hover:text-gray-600 underline underline-offset-2">
          비밀번호 찾기
        </button>
      </div>

      {/* 소셜 로그인 */}
      <div className="mt-5">
        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">또는 소셜 로그인</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {/* 카카오 */}
          <button
            type="button"
            disabled
            title="카카오 로그인 (API 연동 예정)"
            className="flex items-center justify-center gap-2 h-11 rounded-lg border border-[#F9E000] bg-[#FEE500] text-[#3C1E1E] text-sm font-semibold opacity-70 cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M9 1C4.582 1 1 3.82 1 7.286c0 2.214 1.48 4.16 3.724 5.28L3.88 16.08a.3.3 0 00.448.322L8.74 13.53c.086.005.172.008.26.008 4.418 0 8-2.82 8-6.252C17 3.82 13.418 1 9 1z" fill="#3C1E1E"/>
            </svg>
            카카오
          </button>
          {/* 네이버 */}
          <button
            type="button"
            disabled
            title="네이버 로그인 (API 연동 예정)"
            className="flex items-center justify-center gap-2 h-11 rounded-lg border border-[#03C75A] bg-[#03C75A] text-white text-sm font-semibold opacity-70 cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"/>
            </svg>
            네이버
          </button>
          {/* 구글 */}
          <button
            type="button"
            disabled
            title="구글 로그인 (API 연동 예정)"
            className="flex items-center justify-center gap-2 h-11 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-semibold opacity-70 cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            구글
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">소셜 로그인은 API 연동 후 활성화됩니다</p>
      </div>

      {/* 테스트 계정 */}
      <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/50 p-4">
        <p className="text-xs font-semibold text-navy mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-500" />
          테스트 계정으로 즉시 로그인
        </p>
        <div className="grid grid-cols-2 gap-2">
          {visibleAccounts.map(({ label, email: em, icon: Icon, color }) => (
            <button
              key={em}
              type="button"
              onClick={() => onDemoLogin(em)}
              disabled={!!demoLoading || loading}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition hover:shadow-sm disabled:opacity-60 ${color}`}
            >
              {demoLoading === em ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4 shrink-0" />
              )}
              <span>{demoLoading === em ? "로그인 중..." : label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">비밀번호: password1234 · 클릭 한 번으로 즉시 로그인</p>
      </div>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        계정이 없으신가요? <Link href="/signup" className="font-semibold text-brand-600">회원가입</Link>
      </p>
    </div>
  );
}
