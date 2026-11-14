import Link from "next/link";
import { ArrowRight, CalendarDays, Camera, ClipboardList, Headset, PackageCheck, Radio, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getSessionUser } from "@/lib/auth";
import { SignupRoleCards } from "@/components/signup/signup-role-cards";
import { getHomeBrandProducts } from "@/lib/home-brand-products";
import { canSeeSupplyPrice } from "@/lib/brands";
import { registeredSpaceThumbnail, SHOWCASE_SPACES, type SpaceCard } from "@/lib/showcase";
import { BrandProductShowcase } from "@/components/home/brand-product-showcase";
import { HeroSlider } from "@/components/home/hero-slider";
import { HomeFeatureBanner } from "@/components/home/home-feature-banner";
import { SpaceMarketplace } from "@/components/home/space-marketplace";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const liveChecklist = [
  { icon: Camera, title: "공간과 장비", description: "예약 가능 시간, 기본 조명·마이크 제공 여부, 인터넷 연결을 확인하세요." },
  { icon: PackageCheck, title: "상품과 재고", description: "시연할 샘플과 판매 가능한 수량을 확인하고, 옵션별 가격을 정리하세요." },
  { icon: ClipboardList, title: "방송 순서", description: "상품 소개 순서와 번호를 맞춰 두고, 방송 전에 화면과 소리를 점검하세요." },
];

export default async function HomePage() {
  // 공급가 공개 여부는 로그인 계정에 따라 달라지므로 계정을 먼저 확인한다
  const user = await getSessionUser().catch(() => null);
  const [{ spaces, available }, settings, brandProducts] = await Promise.all([getRegisteredSpaces(), getSettings(), getHomeBrandProducts(new Date(), canSeeSupplyPrice(user?.role))]);

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
      <HeroSlider showSignup={!user} />
      {!user && (
        <section id="signup-roles" aria-labelledby="signup-roles-heading" className="scroll-mt-20 px-4 pt-8 sm:px-6 sm:pt-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="signup-roles-heading" className="break-keep text-xl font-black tracking-tight text-navy min-[390px]:text-2xl sm:text-3xl">어떤 회원으로 시작할까요?</h2>
            <Link href="/login" className="inline-flex min-h-11 items-center px-1 text-xs font-bold text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-navy sm:px-2 sm:text-sm">로그인</Link>
          </div>
          <div className="mt-4"><SignupRoleCards variant="home" /></div>
        </section>
      )}
      <BrandProductShowcase data={brandProducts} />
      <HomeFeatureBanner
        id="brand-samples-heading"
        title="다음 방송 상품, 샘플부터 살펴보세요"
        description="직접 써보거나 시연해 보고 싶은 상품이 있다면, 샘플을 신청할 수 있는 브랜드를 찾아보세요."
        image="/images/home/banner-brand-samples.webp"
        href="/brands?sample=1"
        linkLabel="샘플 가능한 브랜드 보기"
        tone="light"
        className="mt-7 sm:mt-9"
      />
      <SpaceMarketplace spaces={[...spaces, ...SHOWCASE_SPACES]} registeredAvailable={available} />
      <HomeFeatureBanner
        id="live-prep-heading"
        title="첫 라이브를 준비하고 있나요?"
        description="공간을 고른 뒤, 장비부터 상품 소개 순서까지 방송 전에 챙길 항목을 확인해 보세요."
        image="/images/home/banner-live-prep.webp"
        href="#live-checklist"
        linkLabel="방송 준비 체크리스트"
        tone="dark"
        className="mb-8 sm:mb-10"
      />
      <section className="border-y border-slate-200 bg-white px-4 py-9 sm:px-6 sm:py-12">
        <h2 className="break-keep text-2xl font-black tracking-tight text-navy sm:text-3xl">예약부터 판매·정산까지</h2>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {steps.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-100 text-brand-800"><Icon aria-hidden="true" className="h-4 w-4" /></span>
              <h3 className="mt-3 text-sm font-bold text-navy">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
            </div>
          ))}
        </div>
        <Link href="/intro" className={buttonVariants({ variant: "outline", className: "mt-4 rounded-xl px-4" })}>서비스 자세히 보기</Link>
      </section>
      <section id="live-checklist" aria-labelledby="live-checklist-heading" className="scroll-mt-20 px-4 pt-9 sm:px-6 sm:pt-12">
        <h2 id="live-checklist-heading" className="break-keep text-2xl font-black tracking-tight text-navy sm:text-3xl">방송 전 체크리스트</h2>
        <ul className="mt-4 divide-y divide-[#E8E5DD] overflow-hidden rounded-2xl border border-[#E8E5DD] bg-white sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {liveChecklist.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex gap-3 p-4 sm:block">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-800">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="sm:mt-3">
                <h3 className="text-sm font-extrabold text-navy">{title}</h3>
                <p className="mt-1 break-keep text-sm leading-6 text-slate-600">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="px-4 py-9 sm:px-6 sm:py-12">
        <div className="rounded-[24px] bg-navy p-5 text-white sm:p-7">
          <Headset className="h-6 w-6 text-brand-300" />
          <h2 className="mt-3 text-xl font-extrabold">이용에 도움이 필요하신가요?</h2>
          <p className="mt-2 text-sm leading-6 text-white/75">자주 묻는 질문을 찾아보거나, 운영팀에 1:1 문의를 남기세요.</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/support#faq" className={cn(buttonVariants(), "rounded-xl bg-brand-300 px-4 font-bold text-navy hover:bg-brand-200")}>
              자주 묻는 질문
            </Link>
            <Link href="/support#new-inquiry" className={cn(buttonVariants({ variant: "outline" }), "rounded-xl border-white/40 bg-transparent px-4 text-white hover:border-brand-300 hover:bg-navy-700")}>1:1 문의하기</Link>
          </div>
        </div>
      </section>
    </>
  );
}
