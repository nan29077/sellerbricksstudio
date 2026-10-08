import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatKRW } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { HeroSlider } from "@/components/home/hero-slider";
import {
  ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Camera,
  Check, ChevronRight, ClipboardList, MapPin, PackageCheck,
  Radio, Store, Wallet,
} from "lucide-react";

export const dynamic = "force-dynamic";

async function getFeaturedFacilities() {
  try {
    const facilities = await prisma.facility.findMany({
      where: { status: "APPROVED" },
      orderBy: { rating: "desc" },
      take: 3,
    });
    return { facilities, available: true };
  } catch {
    return { facilities: [], available: false };
  }
}

const serviceCards = [
  {
    eyebrow: "01 · LIVE STUDIO",
    title: "방송의 첫인상은 공간에서 시작됩니다",
    description: "촬영 목적에 맞는 스튜디오를 찾고, 장비와 동선까지 고려해 라이브를 준비하세요.",
    image: "/images/home/hero-studio.webp",
    href: "/facilities?type=STUDIO",
    label: "스튜디오 살펴보기",
    position: "object-[62%_center]",
  },
  {
    eyebrow: "02 · SPACE & LOGISTICS",
    title: "상품과 공간을 한 흐름으로",
    description: "창고와 판매 현장을 연결해 상품 준비부터 방송까지 필요한 단계를 정리합니다.",
    image: "/images/home/hero-fulfillment.webp",
    href: "/facilities?type=WAREHOUSE",
    label: "창고 살펴보기",
    position: "object-[65%_center]",
  },
  {
    eyebrow: "03 · ON LOCATION",
    title: "산지의 이야기를 생생하게",
    description: "농가와 생산 현장의 매력을 콘텐츠로 전해 고객이 상품을 더 깊이 이해하게 하세요.",
    image: "/images/home/hero-farm.webp",
    href: "/intro",
    label: "현장 라이브 알아보기",
    position: "object-[67%_center]",
  },
];

const journey = [
  { icon: Store, number: "01", title: "공간 탐색", description: "방송 목적과 지역에 맞는 시설을 둘러보고 예약을 신청합니다." },
  { icon: ClipboardList, number: "02", title: "상품·일정 준비", description: "라이브에 사용할 상품과 번호, 방송 일정을 한곳에서 정리합니다." },
  { icon: Radio, number: "03", title: "라이브 운영", description: "방송 상태와 주문 흐름을 확인하며 판매에 집중합니다." },
  { icon: BarChart3, number: "04", title: "결과 확인", description: "방송 후 주문과 정산 내역을 살펴보고 다음 계획을 세웁니다." },
];

const capabilities = [
  { icon: CalendarDays, title: "예약 관리", description: "공간과 날짜를 선택하고 예약 진행 상태를 확인하세요." },
  { icon: Camera, title: "라이브 준비", description: "상품 순서와 방송 정보를 정리해 진행을 매끄럽게 만드세요." },
  { icon: PackageCheck, title: "주문 운영", description: "방송 중 들어오는 주문을 한 화면에서 확인하세요." },
  { icon: Wallet, title: "정산 확인", description: "판매 이후의 정산 내역까지 흐름을 이어갑니다." },
];

const faqs = [
  { question: "어떤 공간을 찾을 수 있나요?", answer: "등록된 라이브 스튜디오와 창고를 지역과 유형별로 탐색할 수 있습니다. 이용 가능 여부와 상세 조건은 각 시설 페이지에서 확인해 주세요." },
  { question: "예약은 어떻게 진행하나요?", answer: "시설 상세 페이지에서 원하는 날짜와 시간을 선택해 신청합니다. 신청 이후의 진행 상태는 대시보드에서 확인할 수 있습니다." },
  { question: "방송에 사용할 상품도 관리할 수 있나요?", answer: "라이브 세션에서 판매할 상품을 선택하고 상품번호와 순서를 관리할 수 있습니다." },
  { question: "판매 이후에는 무엇을 확인할 수 있나요?", answer: "주문과 정산 내역을 해당 계정의 대시보드에서 확인할 수 있습니다. 이용 가능한 기능은 계정 역할에 따라 다릅니다." },
];

export default async function HomePage() {
  const [{ facilities, available }, settings] = await Promise.all([getFeaturedFacilities(), getSettings()]);

  return (
    <div className="overflow-hidden bg-[#FCFBF8]">
      {settings.bannerEnabled && settings.bannerText && (
        <div className="bg-[#F5A623] text-navy">
          <div className="container flex min-h-11 flex-wrap items-center justify-center gap-x-4 gap-y-1 py-2 text-center text-xs font-bold sm:text-sm">
            <span>{settings.bannerText}</span>
            {settings.bannerLinkUrl && settings.bannerLinkLabel && (
              <Link href={settings.bannerLinkUrl} className="inline-flex items-center gap-1 underline underline-offset-4 hover:opacity-70">
                {settings.bannerLinkLabel}<ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}

      <HeroSlider />

      <section className="border-b border-[#E9E5DC] bg-white" aria-label="서비스 흐름">
        <div className="container grid grid-cols-2 gap-4 py-6 md:grid-cols-4 md:gap-0 md:py-8">
          {[
            { icon: Camera, title: "콘텐츠에 맞는 공간", detail: "스튜디오·현장 방송" },
            { icon: CalendarDays, title: "체계적인 준비", detail: "예약·일정·상품 관리" },
            { icon: Radio, title: "집중할 수 있는 라이브", detail: "방송과 주문 흐름" },
            { icon: Wallet, title: "판매 이후까지", detail: "주문·정산 확인" },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 md:border-l md:border-[#ECE8E0] md:pl-6 first:md:border-0 first:md:pl-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><item.icon className="h-5 w-5" /></div>
              <div><p className="text-sm font-bold text-navy">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{item.detail}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="services" className="container py-20 sm:py-28">
        <div className="grid items-end gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <p className="text-xs font-extrabold tracking-[0.2em] text-brand-700">WHAT WE DO</p>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-navy sm:text-5xl">셀러의 좋은 아이디어가<br /><span className="text-brand-600">좋은 방송이 되는 과정</span></h2>
          </div>
          <p className="max-w-lg text-base leading-8 text-slate-600 lg:ml-auto">공간, 상품, 방송, 주문을 따로 관리하면 중요한 순간을 놓치기 쉽습니다. 셀러브릭스 스튜디오는 흩어진 과정을 하나의 운영 흐름으로 이어줍니다.</p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {serviceCards.map((card) => (
            <Link key={card.eyebrow} href={card.href} className="group relative isolate flex min-h-[390px] overflow-hidden rounded-[28px] bg-navy p-7 text-white shadow-[0_18px_50px_rgba(22,30,53,0.12)] transition hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(22,30,53,0.2)] sm:min-h-[440px]">
              <Image src={card.image} alt="" fill sizes="(max-width: 1024px) 100vw, 33vw" className={`object-cover transition duration-700 group-hover:scale-105 ${card.position}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F172C] via-[#0F172C]/45 to-transparent" />
              <div className="relative mt-auto">
                <span className="text-[11px] font-bold tracking-[0.18em] text-brand-300">{card.eyebrow}</span>
                <h3 className="mt-3 max-w-xs text-2xl font-extrabold leading-snug tracking-tight">{card.title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-white/75">{card.description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-200">{card.label}<ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-navy py-20 text-white sm:py-28">
        <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #F5A623 0, transparent 35%)" }} />
        <div className="container relative grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <p className="text-xs font-extrabold tracking-[0.2em] text-brand-300">ONE CONNECTED WORKFLOW</p>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">준비부터 결과까지,<br />흐름이 보이는 운영</h2>
            <p className="mt-6 max-w-md text-base leading-8 text-white/65">처음 시작하는 셀러에게는 명확한 순서가, 경험 많은 셀러에게는 시간을 아껴주는 도구가 필요합니다. 단계별로 필요한 작업을 이어가세요.</p>
            <Link href="/intro" className="mt-8 inline-flex min-h-11 items-center gap-2 border-b border-brand-400 pb-1 text-sm font-bold text-brand-200 hover:text-white">운영 방식 자세히 보기<ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {journey.map((step) => (
              <div key={step.number} className="rounded-2xl border border-white/15 bg-white/[0.06] p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[0.2em] text-brand-300">STEP {step.number}</span><step.icon className="h-6 w-6 text-brand-300" /></div>
                <h3 className="mt-8 text-xl font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-20 sm:py-28">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-xs font-extrabold tracking-[0.2em] text-brand-700">EXPLORE SPACES</p><h2 className="mt-4 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">방송에 어울리는 공간을 찾아보세요</h2><p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">실제 등록된 시설의 정보를 확인하고 내 콘텐츠에 맞는 공간을 선택하세요.</p></div>
          <Link href="/facilities" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-bold text-brand-700 hover:text-navy">전체 공간 보기<ArrowRight className="h-4 w-4" /></Link>
        </div>
        {facilities.length > 0 ? (
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {facilities.map((facility) => (
              <Link key={facility.id} href={`/facilities/${facility.id}`} className="group overflow-hidden rounded-[24px] border border-[#E9E5DC] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="relative h-56 overflow-hidden bg-brand-50">
                  <Image src={facility.thumbnailUrl || "/images/home/hero-studio.webp"} alt={facility.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" />
                  <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-navy shadow-sm">{facility.type === "STUDIO" ? "스튜디오" : "창고"}</span>
                </div>
                <div className="p-6">
                  <h3 className="truncate text-lg font-bold text-navy">{facility.name}</h3>
                  <p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin className="h-4 w-4" />{facility.region}</p>
                  <div className="mt-6 flex items-center justify-between border-t border-[#F0ECE5] pt-4"><span className="text-sm font-bold text-navy">{facility.basePrice ? `${formatKRW(facility.basePrice)}부터` : "요금 문의"}</span><ArrowUpRight className="h-5 w-5 text-brand-700" /></div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-[24px] border border-[#E9E5DC] bg-white p-7 sm:flex-row sm:items-center sm:p-10">
            <div><p className="text-lg font-bold text-navy">{available ? "아직 등록된 공간이 없습니다" : "시설 목록을 불러올 수 없습니다"}</p><p className="mt-2 text-sm leading-6 text-slate-600">{available ? "새로운 공간이 등록되면 이곳에서 바로 확인할 수 있습니다." : "잠시 후 다시 시도하거나 서비스 소개에서 이용 방식을 확인해 주세요."}</p></div>
            <Link href="/intro" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-brand-50 px-5 text-sm font-bold text-brand-700 hover:bg-brand-100">서비스 소개 보기<ChevronRight className="h-4 w-4" /></Link>
          </div>
        )}
      </section>

      <section className="bg-[#F4F1EA] py-20 sm:py-28">
        <div className="container grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div><p className="text-xs font-extrabold tracking-[0.2em] text-brand-700">BUILT FOR SELLERS</p><h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-navy sm:text-4xl">도구는 하나,<br />해야 할 일은 더 명확하게</h2><p className="mt-5 max-w-md text-base leading-8 text-slate-600">셀러, 창고(스튜디오) 관리자, 관리자에게 필요한 화면을 역할에 맞게 제공합니다. 오늘 해야 할 일부터 방송 후 확인할 내용까지 이어집니다.</p><Link href="/signup" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-6 text-sm font-bold text-white transition hover:bg-navy-700">시작하기<ArrowRight className="h-4 w-4" /></Link></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {capabilities.map((item) => <div key={item.title} className="rounded-2xl border border-[#E8E3D9] bg-white p-6 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF3D0] text-brand-700"><item.icon className="h-5 w-5" /></div><h3 className="mt-5 text-lg font-bold text-navy">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p></div>)}
          </div>
        </div>
      </section>

      <section className="container py-20 sm:py-28">
        <div className="overflow-hidden rounded-[32px] bg-navy text-white lg:grid lg:grid-cols-2">
          <div className="relative min-h-[310px] lg:min-h-[470px]"><Image src="/images/home/hero-farm.webp" alt="산지 라이브 촬영을 연상시키는 연출 이미지" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover object-[70%_center]" /><span className="absolute bottom-5 left-5 rounded-full border border-white/30 bg-navy/60 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur">서비스 연출 이미지</span></div>
          <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16"><p className="text-xs font-extrabold tracking-[0.2em] text-brand-300">BEYOND THE STUDIO</p><h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">좋은 상품의 이야기는<br /><span className="text-brand-300">현장에서 더 선명해집니다</span></h2><p className="mt-5 text-sm leading-7 text-white/70 sm:text-base">스튜디오 방송부터 산지와 생산 현장의 라이브까지. 상품의 강점이 가장 잘 드러나는 방식으로 콘텐츠를 구상해 보세요.</p><div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-white/75"><span className="flex items-center gap-1"><Check className="h-4 w-4 text-brand-300" />현장감 있는 콘텐츠</span><span className="flex items-center gap-1"><Check className="h-4 w-4 text-brand-300" />상품 스토리 전달</span></div><Link href="/intro" className="mt-8 inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-brand-500 px-6 text-sm font-bold text-navy hover:bg-brand-400">서비스 더 알아보기<ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </section>

      <section className="border-t border-[#ECE8E0] bg-white py-20 sm:py-28">
        <div className="container grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div><p className="text-xs font-extrabold tracking-[0.2em] text-brand-700">FREQUENTLY ASKED</p><h2 className="mt-4 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">궁금한 점을 확인하세요</h2><p className="mt-4 max-w-sm text-sm leading-7 text-slate-600">이용 과정에서 자주 확인하는 내용을 모았습니다. 더 자세한 서비스 구성은 소개 페이지에서 볼 수 있습니다.</p><Link href="/intro" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-navy">서비스 소개<ArrowRight className="h-4 w-4" /></Link></div>
          <div className="divide-y divide-[#E9E5DC] border-t border-b border-[#E9E5DC]">{faqs.map((faq) => <details key={faq.question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-bold text-navy marker:hidden">{faq.question}<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition group-open:rotate-90"><ChevronRight className="h-4 w-4" /></span></summary><p className="max-w-2xl pb-1 pr-10 pt-3 text-sm leading-7 text-slate-600">{faq.answer}</p></details>)}</div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-brand-500 py-16 text-navy sm:py-20"><div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 85% 0%, #fff 0, transparent 30%)" }} /><div className="container relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center"><div><p className="text-xs font-extrabold tracking-[0.18em]">START WITH SELLERBRICKS</p><h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">다음 라이브, 더 가볍게 시작하세요.</h2><p className="mt-3 text-sm font-medium text-navy/75 sm:text-base">공간을 찾고, 방송을 준비하고, 판매 이후를 확인하는 흐름을 만나보세요.</p></div><Link href="/signup/seller" className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-navy px-7 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-navy-700">셀러로 시작하기<ArrowRight className="h-4 w-4" /></Link></div></section>
    </div>
  );
}
