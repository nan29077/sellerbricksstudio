import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardList, Headset, Radio, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { registeredSpaceThumbnail, SHOWCASE_SPACES, type SpaceCard } from "@/lib/showcase";
import { HeroSlider } from "@/components/home/hero-slider";
import { SpaceMarketplace } from "@/components/home/space-marketplace";

export const dynamic = "force-dynamic";

async function getRegisteredSpaces(): Promise<{ spaces: SpaceCard[]; available: boolean }> {
  try {
    const facilities = await prisma.facility.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ rating: "desc" }, { id: "asc" }],
      take: 24,
      select: { id: true, name: true, type: true, region: true, basePrice: true, specialty: true },
    });
    return {
      available: true,
      spaces: facilities.map((facility) => ({
        id: facility.id,
        name: facility.name,
        type: facility.type,
        region: facility.region,
        location: facility.region,
        image: registeredSpaceThumbnail(facility.id, facility.type),
        price: facility.basePrice,
        demo: false,
        tags: (facility.specialty ?? "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 2),
      })),
    };
  } catch {
    return { spaces: [], available: false };
  }
}

const steps = [
  { icon: CalendarDays, title: "공간 예약", description: "필요한 공간과 날짜를 선택해 예약을 신청하세요." },
  { icon: ClipboardList, title: "상품·일정 준비", description: "방송 상품과 순서, 일정을 한곳에서 정리하세요." },
  { icon: Radio, title: "라이브 운영", description: "방송 상태와 주문 흐름을 확인하며 판매에 집중하세요." },
  { icon: Wallet, title: "판매·정산 확인", description: "방송 후 주문과 정산 내역을 확인하세요." },
];

export default async function HomePage() {
  const [{ spaces, available }, settings] = await Promise.all([getRegisteredSpaces(), getSettings()]);

  return (
    <>
      {settings.bannerEnabled && settings.bannerText && (
        <div className="flex min-h-11 flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-brand-500 px-4 py-2 text-center text-xs font-bold text-navy">
          <span>{settings.bannerText}</span>
          {settings.bannerLinkUrl && settings.bannerLinkLabel && (
            <Link href={settings.bannerLinkUrl} className="inline-flex items-center gap-1 underline underline-offset-4 hover:opacity-70">{settings.bannerLinkLabel}<ArrowRight className="h-3.5 w-3.5" /></Link>
          )}
        </div>
      )}
      <HeroSlider />
      <SpaceMarketplace spaces={[...spaces, ...SHOWCASE_SPACES]} registeredAvailable={available} />
      <section className="border-y border-[#E8E5DD] bg-white px-4 py-9 sm:px-6 sm:py-12">
        <p className="text-[11px] font-extrabold tracking-[0.2em] text-brand-700">YOUR LIVE WORKFLOW</p>
        <h2 className="mt-2 break-keep text-2xl font-black tracking-tight text-navy sm:text-3xl">공간을 찾은 뒤에도 함께합니다</h2>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {steps.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-2xl border border-[#EFE9DC] bg-[#FAF8F3] p-4">
              <Icon className="h-5 w-5 text-brand-700" />
              <h3 className="mt-3 text-sm font-bold text-navy">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
            </div>
          ))}
        </div>
        <Link href="/intro" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-700 hover:text-navy">서비스 자세히 보기<ArrowRight className="h-4 w-4" /></Link>
      </section>
      <section className="px-4 py-9 sm:px-6 sm:py-12">
        <div className="rounded-[24px] bg-navy p-5 text-white sm:p-7">
          <Headset className="h-6 w-6 text-brand-300" />
          <h2 className="mt-3 text-xl font-extrabold">이용에 도움이 필요하신가요?</h2>
          <p className="mt-2 text-sm leading-6 text-white/75">자주 묻는 질문을 찾아보거나, 운영팀에 1:1 문의를 남기세요.</p>
          <Link href="/support" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-500 px-5 text-sm font-extrabold text-navy hover:bg-brand-400">문의하기<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </>
  );
}
