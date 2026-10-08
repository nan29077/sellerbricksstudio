"use client";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, Building2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ROLE_HOME } from "@/lib/rbac";

export function SiteHeader() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const role = (session?.user as any)?.role;
  const home = role ? ROLE_HOME[role as keyof typeof ROLE_HOME] : null;

  const farmHref =
    role === "SUPER_ADMIN" ? "/admin/farm-reservations" : "/seller/farm-reservations";

  const nav = [
    { href: "/", label: "홈" },
    { href: "/intro", label: "서비스 소개" },
    { href: "/facilities", label: "공간 찾기" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#ECE8E0] bg-white/95 backdrop-blur-xl">
      <div className="container flex h-[72px] items-center justify-between">
        <Link href="/" className="flex items-center gap-1">
          <Image
            src="/images/bee/studio-logo-headset.png"
            alt="셀러브릭스 스튜디오"
            width={180}
            height={40}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>
        <nav className="hidden md:flex items-center gap-1 rounded-full bg-[#F7F5EF] p-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-full px-4 py-2 text-sm font-semibold text-navy/75 hover:bg-white hover:text-brand-700 transition-colors"
            >
              {n.label}
            </Link>
          ))}
          {(role === "SELLER" || role === "SUPER_ADMIN") && (
            <Link
              href={farmHref}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-white transition-colors"
            >
              <Building2 className="h-3.5 w-3.5" />
              시설 예약
            </Link>
          )}
        </nav>
        <div className="hidden md:flex items-center gap-2">
          {session ? (
            <>
              {home && (
                <Link href={home}>
                  <Button variant="outline" size="sm" className="rounded-full border-brand-300 text-brand-700 hover:bg-brand-50">
                    대시보드
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
                로그아웃
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="rounded-full">로그인</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="rounded-full bg-navy px-5 text-white hover:bg-navy-700 font-semibold">
                  시작하기
                </Button>
              </Link>
            </>
          )}
        </div>
        <button className="md:hidden tap p-2" onClick={() => setOpen(!open)} aria-label="메뉴">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-white px-4 py-3 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-brand-50 hover:text-brand-600"
              onClick={() => setOpen(false)}
            >
              {n.label}
            </Link>
          ))}
          {(role === "SELLER" || role === "SUPER_ADMIN") && (
            <Link
              href={farmHref}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
              onClick={() => setOpen(false)}
            >
              <Building2 className="h-3.5 w-3.5" />
              시설 예약
            </Link>
          )}
          <div className="pt-2 border-t border-border mt-2 flex flex-col gap-2">
            {session ? (
              <>
                {home && (
                  <Link href={home}>
                    <Button variant="outline" className="w-full border-brand-300">대시보드</Button>
                  </Link>
                )}
                <Button variant="ghost" className="w-full" onClick={() => signOut({ callbackUrl: "/" })}>
                  로그아웃
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="outline" className="w-full">로그인</Button>
                </Link>
                <Link href="/signup">
                  <Button className="w-full bg-brand-500 hover:bg-brand-600 text-white">무료 시작하기</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
