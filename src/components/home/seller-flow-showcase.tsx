import Link from "next/link";
import { ArrowRight, CalendarCheck, PackageSearch, Radio, Truck, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

// 메인: 셀러 이용 흐름 (2026-11-14)
//  브랜드 상품 고르기 → 창고 · 스튜디오 · 쇼룸 고르기 → 날짜 예약 → 예약한 날 그 공간에서 방송
//  실제 시스템: 예약에 담은 브랜드 상품은 예약 승인 때 브랜드에 '방송 시연품'으로 자동 요청되고(방송 2일 전 도착),
//  공간 운영자가 도착을 확인한다. 판매분은 셀러가 주문서로 내면 브랜드 · 스토리지마켓이 받는 분에게 보낸다.
const STEPS = [
  { icon: PackageSearch, title: "브랜드 상품 고르기", desc: "브랜드샵에서 방송할 상품을 골라 담아요. 공급가를 보고 내 판매가를 정해요." },
  { icon: Warehouse, title: "공간 고르기", desc: "스토리지마켓이 직접 운영 · 관리하는 창고 · 스튜디오 · 쇼룸 중에서 골라요." },
  { icon: CalendarCheck, title: "날짜만 예약", desc: "예약이 확정되면 고른 상품의 시연품을 브랜드가 방송 2일 전까지 그 공간으로 보내요." },
  { icon: Radio, title: "그날 바로 방송", desc: "준비된 공간 · 장비 · 상품으로 쓰는 라이브 플랫폼에서 방송하고, 판매분은 주문서 한 장으로 발송까지." },
] as const;

const PERKS = ["공간 이용료 0원", "시연품 미리 준비", "판매분 발송 대행", "직영 · 직접 관리 공간"];

export function SellerFlowShowcase({ role }: { role?: string | null }) {
  const seller = role === "SELLER";
  const primary = seller ? { href: "/seller/bookings/new", label: "방송 공간 예약하기" } : role ? { href: "/brands", label: "브랜드 상품 둘러보기" } : { href: "/signup/seller", label: "셀러로 시작하기" };
  return (
    <section aria-labelledby="seller-flow-heading" className="px-4 pt-8 sm:px-6 sm:pt-10">
      <div className="overflow-hidden rounded-[26px] bg-[linear-gradient(150deg,#27273d,#171727_72%)] p-5 text-white shadow-[0_16px_42px_#1414273d] sm:p-7">
        <p className="text-[11px] font-extrabold tracking-[0.16em] text-brand-300">FOR SELLERS</p>
        <h2 id="seller-flow-heading" className="mt-2 break-keep text-2xl font-black leading-tight tracking-tight sm:text-3xl">
          상품 고르고, 공간 고르고, <span className="text-brand-300">날짜만 예약하세요</span>
        </h2>
        <p className="mt-2 break-keep text-sm leading-6 text-white/75">예약한 날, 그 공간에 내가 고른 브랜드 상품이 준비되어 있어요. 셀러는 방송에만 집중하면 됩니다.</p>
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="스토리지마켓 이용 혜택">
          {PERKS.map((p) => <li key={p} className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-white/90">{p}</li>)}
        </ul>
        <ol className="mt-5 grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2">
          {STEPS.map(({ icon: Icon, title, desc }, i) => (
            <li key={title} className="relative rounded-2xl border border-white/10 bg-white/[0.05] p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-300"><Icon aria-hidden="true" className="h-[18px] w-[18px]" /></span>
                <p className="text-sm font-extrabold"><span className="mr-1 text-brand-300">{i + 1}</span>{title}</p>
              </div>
              <p className="mt-2 break-keep text-xs leading-5 text-white/70">{desc}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-white/[0.06] p-3 text-xs leading-5 text-white/80">
          <Truck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
          <p className="break-keep">시연품 준비 현황(브랜드 확인 · 배송 중 · 도착)은 예약 관리에서 실시간으로 확인하고, 하루 전까지 도착하지 않으면 알림으로 알려 드려요.</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={primary.href} className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-extrabold text-navy transition hover:bg-brand-400")}>
            {primary.label}<ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Link href="#spaces" className="inline-flex min-h-11 items-center rounded-xl border border-white/30 px-4 text-sm font-bold text-white transition hover:bg-white/10">공간 먼저 보기</Link>
        </div>
      </div>
    </section>
  );
}
