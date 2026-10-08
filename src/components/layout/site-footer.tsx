import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

const footerLinks = [
  { title: "서비스", links: [{ href: "/intro", label: "서비스 소개" }, { href: "/facilities", label: "창고(스튜디오) 찾기" }, { href: "/facilities?type=STUDIO", label: "스튜디오" }, { href: "/facilities?type=WAREHOUSE", label: "창고" }] },
  { title: "시작하기", links: [{ href: "/signup/seller", label: "셀러 가입" }, { href: "/signup/facility", label: "창고(스튜디오) 관리자 가입" }, { href: "/login", label: "로그인" }] },
];

export function SiteFooter() {
  return (
    <footer className="bg-[#11172B] text-white">
      <div className="container grid gap-12 py-16 sm:py-20 lg:grid-cols-[1.5fr_1fr] lg:gap-20">
        <div>
          <Link href="/" className="inline-block"><Image src="/images/brand/logo-original-on-dark.png" alt="셀러브릭스 스튜디오" width={210} height={56} className="h-14 w-auto object-contain" /></Link>
          <h2 className="mt-8 text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl">방송에만 집중하세요.<br /><span className="text-brand-300">나머지는 우리가 합니다.</span></h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-white/55">라이브커머스의 공간 탐색부터 운영과 판매 이후의 확인까지, 셀러의 다음 단계를 함께 준비합니다.</p>
          <Link href="/signup/seller" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-bold text-white transition hover:border-brand-400 hover:text-brand-300">셀러로 시작하기<ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid grid-cols-2 gap-8">
          {footerLinks.map((group) => <div key={group.title}><p className="text-xs font-extrabold tracking-[0.18em] text-brand-300">{group.title}</p><ul className="mt-5 space-y-3">{group.links.map((item) => <li key={item.href}><Link href={item.href} className="group inline-flex items-center gap-1 text-sm text-white/60 transition hover:text-white">{item.label}<ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" /></Link></li>)}</ul></div>)}
        </div>
      </div>
      <div className="border-t border-white/10"><div className="container flex flex-col gap-2 py-5 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} Sellerbricks Studio. All rights reserved.</p><p>Made for the moments that move your business forward.</p></div></div>
    </footer>
  );
}
