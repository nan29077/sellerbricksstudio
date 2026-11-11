"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Loader2, ShieldCheck, ShoppingBag, Store, Warehouse } from "lucide-react";

const DEMO_ACCOUNTS = [
  { label: "최고관리자", role: "SUPER_ADMIN", email: "admin@sellerbricks.kr", icon: ShieldCheck, color: "text-red-600 bg-red-50 border-red-200" },
  { label: "창고(스튜디오) 관리자", role: "FACILITY_ADMIN", email: "facility@sellerbricks.kr", icon: Warehouse, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { label: "셀러", role: "SELLER", email: "seller@sellerbricks.kr", icon: Store, color: "text-brand-600 bg-brand-50 border-brand-200" },
  { label: "브랜드사", role: "BRAND_ADMIN", email: "brand@sellerbricks.kr", icon: ShoppingBag, color: "text-violet-600 bg-violet-50 border-violet-200" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [flags, setFlags] = useState<{ facilityDisabled?: boolean; brandDemoEnabled?: boolean; demoEnabled?: boolean }>({});

  useEffect(() => {
    fetch("/api/site-flags")
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setFlags(j.data ?? {}); })
      .catch(() => {});
  }, []);

  const visibleAccounts = DEMO_ACCOUNTS.filter((a) => {
    if (a.role === "FACILITY_ADMIN" && flags.facilityDisabled) return false;
    if (a.role === "BRAND_ADMIN" && !flags.brandDemoEnabled) return false;
    return true;
  });

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

      {/* 테스트 계정 (데모 로그인이 켜진 환경에서만) */}
      {flags.demoEnabled && <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/50 p-4">
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
      </div>}

      <p className="mt-5 text-center text-sm text-muted-foreground">
        계정이 없으신가요? <Link href="/signup" className="font-semibold text-brand-600">회원가입</Link>
      </p>
    </div>
  );
}
