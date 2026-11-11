"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Store, Warehouse } from "lucide-react";

const roles = [
  { href: "/signup/seller", role: "SELLER", icon: Store, title: "셀러로 가입", desc: "창고/스튜디오를 예약하고 라이브 방송으로 판매하세요." },
  { href: "/signup/brand", role: "BRAND_ADMIN", icon: ShoppingBag, title: "브랜드사로 가입", desc: "브랜드샵을 만들고 판매용 상품과 샘플을 셀러와 창고 운영자에게 소개하세요." },
  { href: "/signup/facility", role: "FACILITY_ADMIN", icon: Warehouse, title: "창고(스튜디오) 관리자로 가입", desc: "창고, 스튜디오, 농장, 공장, 농가 등 라이브 현장을 보유하고 운영하는 분들을 위한 계정입니다." },
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
