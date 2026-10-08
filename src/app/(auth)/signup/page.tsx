"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Store, Warehouse } from "lucide-react";

const roles = [
  { href: "/signup/seller", role: "SELLER", icon: Store, title: "셀러로 가입", desc: "창고/스튜디오를 예약하고 라이브 방송으로 판매하세요." },
  { href: "/signup/facility", role: "FACILITY_ADMIN", icon: Warehouse, title: "창고(스튜디오) 관리자로 가입", desc: "창고, 스튜디오, 농장, 공장, 농가 등 시설을 보유하고 운영하는 분들을 위한 계정입니다." },
];

export default function SignupPage() {
  const router = useRouter();
  const [flags, setFlags] = useState<{ facilityDisabled?: boolean }>({});

  useEffect(() => {
    fetch("/api/site-flags")
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setFlags(j.data ?? {}); })
      .catch(() => {});
  }, []);

  const visibleRoles = roles.filter((r) => {
    if (r.role === "FACILITY_ADMIN" && flags.facilityDisabled) return false;
    return true;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">회원가입</h1>
      <p className="mt-1 text-sm text-muted-foreground">가입 유형을 선택하세요.</p>
      <div className="mt-6 space-y-3">
        {visibleRoles.map((r) => (
          <Link key={r.href} href={r.href} className="flex items-start gap-3 rounded-xl border border-border p-4 hover:border-brand-500 hover:bg-brand-50 transition">
            <r.icon className="h-6 w-6 text-brand-500 shrink-0 mt-0.5" />
            <div><p className="font-semibold text-navy">{r.title}</p><p className="text-sm text-muted-foreground">{r.desc}</p></div>
          </Link>
        ))}
      </div>

      {/* 소셜 로그인 */}
      <div className="mt-4">
        <div className="relative flex items-center">
          <div className="flex-1 border-t border-gray-200"/>
          <span className="px-3 text-xs text-gray-400">또는 소셜 계정으로 가입</span>
          <div className="flex-1 border-t border-gray-200"/>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => alert('카카오 소셜 로그인은 준비 중입니다.')}
            className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-medium"
            style={{ backgroundColor: '#FEE500', color: '#000' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.636 1.644 4.953 4.126 6.278L5.2 20.25a.375.375 0 0 0 .55.392l4.75-2.675A11.9 11.9 0 0 0 12 18c5.523 0 10-3.477 10-7.5S17.523 3 12 3z"/>
            </svg>
            카카오
          </button>
          <button
            type="button"
            onClick={() => alert('네이버 소셜 로그인은 준비 중입니다.')}
            className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-medium"
            style={{ backgroundColor: '#03C75A', color: '#fff' }}
          >
            <span className="font-bold text-sm">N</span>
            네이버
          </button>
          <button
            type="button"
            onClick={() => alert('구글 소셜 로그인은 준비 중입니다.')}
            className="flex items-center justify-center gap-1.5 border border-gray-300 rounded-lg py-2.5 text-xs font-medium bg-white text-gray-700"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            구글
          </button>
        </div>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="w-full border border-gray-300 rounded-lg py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          이미 계정이 있으신가요? 로그인하기
        </button>
      </div>
    </div>
  );
}
