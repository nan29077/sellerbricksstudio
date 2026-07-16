import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatKRW } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { HeroSlider } from "@/components/home/hero-slider";
import {
  Warehouse, Video, ArrowRight, Star, MapPin,
  TrendingUp, Users, Building2, BarChart3,
  CheckCircle2, Radio, Zap, Trophy,
  PieChart, CalendarCheck, Package, Clock,
  Headphones, ChevronDown, ShieldCheck,
  PlayCircle, FileText, CreditCard, BarChart2,
  UserCog, Wallet, Tractor,
} from "lucide-react";

export const dynamic = "force-dynamic";

async function getPopular() {
  try {
    return await prisma.facility.findMany({
      where: { status: "APPROVED" },
      orderBy: { rating: "desc" },
      take: 6,
      include: { _count: { select: { products: true } } },
    });
  } catch {
    return [];
  }
}

const DUMMY_FACILITIES = [
  { id: "d1", name: "강남 프리미엄 라이브 스튜디오", type: "STUDIO",    region: "서울", rating: 4.9, basePrice: 150000, thumbnailUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=70&auto=format&fit=crop", _count: { products: 248 } },
  { id: "d2", name: "마포구 대형 물류 창고",          type: "WAREHOUSE", region: "서울", rating: 4.8, basePrice: 80000,  thumbnailUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&q=70&auto=format&fit=crop", _count: { products: 512 } },
  { id: "d3", name: "성수 인더스트리얼 스튜디오",    type: "STUDIO",    region: "서울", rating: 4.7, basePrice: 120000, thumbnailUrl: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&q=70&auto=format&fit=crop", _count: { products: 186 } },
  { id: "d4", name: "인천 냉장-냉동 전문 창고",       type: "WAREHOUSE", region: "인천", rating: 4.6, basePrice: 65000,  thumbnailUrl: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=600&q=70&auto=format&fit=crop", _count: { products: 380 } },
  { id: "d5", name: "판교 IT 테크 스튜디오",         type: "STUDIO",    region: "경기", rating: 4.5, basePrice: 100000, thumbnailUrl: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&q=70&auto=format&fit=crop", _count: { products: 142 } },
  { id: "d6", name: "부산 해운대 뷰 라이브룸",       type: "STUDIO",    region: "부산", rating: 4.4, basePrice: 90000,  thumbnailUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=70&auto=format&fit=crop", _count: { products: 203 } },
];

const PLATFORM_STATS = [
  { label: "관리 중인 셀러",     value: "1,200+", icon: Users,     color: "text-brand-600 bg-brand-50" },
  { label: "운영 시설/스튜디오", value: "300+",  icon: Building2, color: "text-blue-600 bg-blue-50" },
  { label: "월간 라이브 운영",   value: "4,800건", icon: Radio,    color: "text-purple-600 bg-purple-50" },
  { label: "누적 정산 처리액",   value: "120억+",  icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
];

const HOW_IT_WORKS = [
  { step: "01", icon: UserCog,      title: "온보딩 · 매니저 배정", desc: "가입하면 전담 매니저가 배정되어 계정·운영 준비를 대신 세팅해 드립니다." },
  { step: "02", icon: CalendarCheck,title: "예약·일정 대행",    desc: "창고·스튜디오 예약과 라이브 일정을 매니지먼트팀이 함께 잡아드립니다." },
  { step: "03", icon: Radio,        title: "라이브 운영 지원",  desc: "방송 세션·상품번호·실시간 주문 운영을 곁에서 지원받습니다." },
  { step: "04", icon: Wallet,       title: "정산 자동 처리",    desc: "방송별 매출·수수료가 자동 계산되어 정산까지 알아서 챙겨드립니다." },
  { step: "05", icon: BarChart3,    title: "성장 리포트",       desc: "매출·전환 리포트를 받아보고, 다음 방송 성장을 함께 설계합니다." },
];

const LIVE_FEATURES = [
  { icon: UserCog,      title: "전담 매니지먼트",      desc: "전담 매니저가 계정·권한·일정을 대신 관리. 셀러는 판매에만 집중하면 됩니다.", badge: "전담 매니저", badgeTone: "brand" as const },
  { icon: CalendarCheck,title: "예약 · 라이브 운영 대행", desc: "창고·스튜디오 예약과 라이브 방송 세션·상품번호·실시간 주문 운영을 대신 챙겨드립니다.", badge: "운영 대행", badgeTone: "blue" as const },
  { icon: Wallet,       title: "정산 자동 처리",       desc: "방송별 매출·수수료를 자동 계산하고 정산 내역까지 알아서 정리해 드립니다.", badge: "정산 자동화", badgeTone: "green" as const },
  { icon: BarChart3,    title: "성장 리포트",          desc: "매출·전환·라이브 성과를 리포트로 받아 다음 성장을 함께 설계합니다.", badge: "성장 지원", badgeTone: "purple" as const },
];

const SELLER_SERVICES = [
  { icon: UserCog,       title: "계정 · 일정 관리 대행", desc: "등록·권한·전담 매니저 배정까지 알아서" },
  { icon: CalendarCheck, title: "예약 · 일정 대행",   desc: "창고·스튜디오 예약과 라이브 일정 챙김" },
  { icon: Radio,         title: "라이브 운영 지원",    desc: "방송 세션·상품번호·실시간 주문 지원" },
  { icon: BarChart3,     title: "매출 리포트 제공",     desc: "셀러별 일·주·월 매출 리포트 자동 제공" },
  { icon: Wallet,        title: "정산 처리 대행",       desc: "방송별 수수료 자동 계산·정산 처리" },
  { icon: Headphones,    title: "전담 매니저 밀착 지원", desc: "전담 매니저가 운영·성과를 곁에서 지원" },
  { icon: Tractor,       title: "시설·산지 예약",  desc: "농가, 공장, 창고, 스튜디오까지 다양한 시설을 예약하고 라이브 콘텐츠를 제작하세요" },
];

const TESTIMONIALS = [
  { name: "박지현", role: "뷰티 라이브 셀러 · 월 매출 2억+", text: "강남 스튜디오를 매주 예약하는데, 예약부터 정산까지 모두 셀러브릭스 하나로 해결해요. 매출이 3배 올랐습니다!", stars: 5, avatar: "박" },
  { name: "홍길동", role: "식품 라이브 셀러 · 월 예약 8건",   text: "창고 예약 후 바로 상품 출고까지 연결되는 점이 너무 편리해요. 방송 직후 당일 배송도 가능합니다.", stars: 5, avatar: "홍" },
  { name: "김미래", role: "패션 스트리머 · 팔로워 15만",      text: "이전엔 스튜디오 섭외, 물류, 정산을 각각 따로 했는데 지금은 셀러브릭스 하나로 전부 됩니다. 강력 추천!", stars: 5, avatar: "김" },
];

const FAQS = [
  { q: "셀러브릭스는 무료인가요?",         a: "기본 기능(창고/스튜디오 예약, 라이브 관리, 정산 확인)은 모두 무료입니다. 창고 예약 비용은 시설별 요금이 별도 발생합니다." },
  { q: "창고/스튜디오는 어떻게 예약하나요?", a: "가입 후 '시설 찾기'에서 원하는 공간을 검색하고, 날짜·시간을 선택해 예약 신청을 합니다. 시설 운영자 승인 후 예약이 확정됩니다." },
  { q: "정산은 언제 이루어지나요?",         a: "방송 종료 후 익월 또는 주간 단위로 자동 정산됩니다. 정산 내역은 셀러 대시보드에서 실시간으로 확인할 수 있습니다." },
  { q: "매니저는 어떤 역할인가요?",         a: "전담 매니저는 방송 성과 향상을 위한 1:1 컨설팅, 시설 추천, 방송 준비 지원 등을 제공합니다." },
  { q: "냉장·냉동 창고도 예약 가능한가요?", a: "네, 식품·냉동 제품을 위한 냉장·냉동 전용 창고도 예약 가능합니다. 시설 검색 시 '창고' 유형을 선택하세요." },
];

// 함께하는 셀러 마퀴 — 프로필 이미지는 male/female 20종에서 배정
const SELLER_MARQUEE = [
  { name: "김하늘", shop: "하늘 Pick",  category: "뷰티",   followers: "2.3만", img: "/images/profiles/female-3.png" },
  { name: "이서준", shop: "서준마켓",   category: "식품",   followers: "1.8만", img: "/images/profiles/male-2.png" },
  { name: "박지유", shop: "지유스타일", category: "패션",   followers: "3.1만", img: "/images/profiles/female-7.png" },
  { name: "최민준", shop: "민준팜",     category: "농수산", followers: "9천",   img: "/images/profiles/male-5.png" },
  { name: "정수아", shop: "수아리빙",   category: "생활",   followers: "1.2만", img: "/images/profiles/female-1.png" },
  { name: "한지원", shop: "지원키친",   category: "식품",   followers: "4.5만", img: "/images/profiles/male-8.png" },
  { name: "오세영", shop: "세영패션",   category: "패션",   followers: "2.7만", img: "/images/profiles/female-10.png" },
  { name: "임채원", shop: "채원뷰티",   category: "뷰티",   followers: "5.2만", img: "/images/profiles/female-4.png" },
  { name: "신도윤", shop: "도윤팜",     category: "농수산", followers: "1.1만", img: "/images/profiles/male-3.png" },
  { name: "강예은", shop: "예은마켓",   category: "생활",   followers: "8천",   img: "/images/profiles/female-6.png" },
  { name: "윤지호", shop: "지호픽",     category: "전자",   followers: "3.8만", img: "/images/profiles/male-9.png" },
  { name: "조하린", shop: "하린스타일", category: "패션",   followers: "2.1만", img: "/images/profiles/female-2.png" },
  { name: "권나연", shop: "나연키친",   category: "식품",   followers: "6.3만", img: "/images/profiles/female-9.png" },
  { name: "문태양", shop: "태양팜",     category: "농수산", followers: "1.5만", img: "/images/profiles/male-6.png" },
  { name: "배소율", shop: "소율뷰티",   category: "뷰티",   followers: "4.2만", img: "/images/profiles/female-5.png" },
];

export default async function HomePage() {
  const dbFacilities = await getPopular();
  const facilities = dbFacilities.length > 0 ? dbFacilities : DUMMY_FACILITIES;
  const settings = await getSettings();

  return (
    <div className="flex flex-col">

      {/* ===== ANNOUNCEMENT BANNER (사이트 설정에서 제어) ===== */}
      {settings.bannerEnabled && settings.bannerText && (
        <div className="bg-brand-600 text-white">
          <div className="container flex items-center justify-center gap-3 py-2.5 text-sm text-center">
            <span className="font-medium">{settings.bannerText}</span>
            {settings.bannerLinkUrl && settings.bannerLinkLabel && (
              <Link href={settings.bannerLinkUrl} className="shrink-0 rounded-md bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition">
                {settings.bannerLinkLabel}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ===== HERO SLIDER ===== */}
      <HeroSlider />

      {/* ===== PLATFORM STATS ===== */}
      <section className="bg-white py-10 border-b border-border">
        <div className="container">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {PLATFORM_STATS.map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-navy">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== MARKETING BANNER STRIP ===== */}
      <section className="bg-gradient-to-r from-amber-500 to-yellow-400 py-4">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-3 text-navy">
          <div className="flex items-center gap-3">
            <Image src="/images/bee/bee-2.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
            <p className="font-bold text-base md:text-lg">10년 경력 마케팅팀의 채널 성장 파트너</p>
          </div>
          <p className="text-sm font-medium opacity-80">유튜브 · 인스타그램 · 틱톡 채널 성장 전략 무료 상담</p>
          <Link href="/signup">
            <span className="rounded-full bg-white/30 border border-navy/20 px-4 py-1.5 text-xs font-bold hover:bg-white/50 transition whitespace-nowrap">
              무료 상담 신청 →
            </span>
          </Link>
        </div>
      </section>

      {/* ===== BROADCAST TYPES ===== */}
      <section className="bg-white py-16 md:py-20 relative overflow-hidden">
        <div className="container relative">
          {/* 꿀벌 데코 */}
          <Image src="/images/bee/bee-3.png" alt="" width={80} height={80} className="absolute -right-4 -top-6 w-16 md:w-20 opacity-80 pointer-events-none select-none" />
          <div className="text-center mb-10">
            <Badge tone="yellow" className="mb-3">방송 유형</Badge>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy">어디서든 라이브하세요</h2>
            <p className="mt-3 text-muted-foreground">스튜디오·창고·공장·산지 — 어떤 환경에서도 전문 라이브를 지원합니다.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "스튜디오 방송",
                desc: "전문 조명·장비 완비 스튜디오에서 고품질 방송",
                img: "/images/broadcast/studio-broadcast.png",
              },
              {
                title: "라이브 전문 스튜디오",
                desc: "라이브 커머스에 최적화된 송출 전용 스튜디오",
                img: "/images/broadcast/live-studio-broadcast.png",
              },
              {
                title: "K-뷰티 스튜디오",
                desc: "뷰티·코스메틱 방송을 위한 감각적인 촬영 공간",
                img: "/images/broadcast/kbeauty-studio.png",
              },
              {
                title: "창고 방송",
                desc: "재고와 함께하는 현장감 있는 창고 라이브",
                img: "/images/broadcast/warehouse-broadcast.png",
              },
              {
                title: "대형 물류 창고 방송",
                desc: "대량 재고를 배경으로 한 즉시 출고형 라이브",
                img: "/images/broadcast/warehouse-broadcast2.png",
              },
              {
                title: "공장 방송",
                desc: "상품 생산 현장에서 직접 진행하는 팩토리 라이브",
                img: "/images/broadcast/factory-broadcast.png",
              },
              {
                title: "식품 공장 방송",
                desc: "제조·가공 시설에서 신뢰를 전하는 식품 라이브",
                img: "/images/broadcast/factory-food-broadcast.png",
              },
              {
                title: "농가·산지 라이브",
                desc: "산지 직접 방송으로 신선함과 신뢰를 전달",
                img: "/images/broadcast/farm-broadcast.png",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl overflow-hidden border border-border hover:shadow-lg transition group">
                <div className="overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.img}
                    alt={item.title}
                    className="object-cover h-48 w-full rounded-xl group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-5 bg-white">
                  <h3 className="font-bold text-navy text-lg mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="bg-gray-50 py-16 md:py-20">
        <div className="container">
          <div className="text-center mb-12">
            <Badge tone="brand" className="mb-3">매니지먼트 흐름</Badge>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy">5단계로 받는 셀러 매니지먼트</h2>
            <p className="mt-3 text-muted-foreground">온보딩부터 정산·성장까지, 셀러브릭스가 운영 전 과정을 대신 관리해 드립니다.</p>
          </div>
          <div className="relative">
            {/* Connector line */}
            <div className="hidden lg:block absolute top-10 left-[10%] right-[10%] h-0.5 bg-brand-100 z-0" />
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 relative z-10">
              {HOW_IT_WORKS.map((item, i) => (
                <div key={item.step} className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white border-2 border-brand-200 mb-4 shadow-sm">
                    <item.icon className="h-7 w-7 text-brand-600" />
                  </div>
                  <div className="text-xs font-bold text-brand-400 mb-1">STEP {item.step}</div>
                  <h3 className="font-bold text-navy mb-1.5 text-sm">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center mt-10">
            <Link href="/register">
              <Button size="lg" className="font-bold px-10">
                <Zap className="h-5 w-5 mr-2" />매니지먼트 시작하기
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== WHY SELLERBRICKS ===== */}
      <section className="bg-white py-16 md:py-20">
        <div className="container">
          <div className="text-center mb-10">
            <Badge tone="brand" className="mb-3">셀러 매니지먼트 플랫폼</Badge>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy">당신의 셀러 운영, 우리가 맡습니다</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              셀러브릭스는 셀러가 운영을 대신 관리받는 통합 매니지먼트 플랫폼입니다.<br />
              예약·라이브 운영, 정산, 성장까지 — 복잡한 일은 우리가, 셀러는 판매에 집중하세요.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {LIVE_FEATURES.map((f) => (
              <Card key={f.title} className="border-2 border-border hover:border-brand-200 hover:shadow-lg transition group">
                <CardContent className="pt-6 pb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 mb-4 group-hover:bg-brand-100 transition">
                    <f.icon className="h-6 w-6 text-brand-600" />
                  </div>
                  <Badge tone={f.badgeTone} className="mb-2">{f.badge}</Badge>
                  <h3 className="font-bold text-navy mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SPACE BOOKING CTA ===== */}
      <section className="relative overflow-hidden py-16 md:py-20">
        {/* 카트 꿀벌 */}
        <Image src="/images/bee/logo-bee-5.png" alt="" width={80} height={80} className="absolute right-4 top-4 w-14 md:w-20 opacity-80 pointer-events-none select-none z-20" />
        {/* Background */}
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1920&q=70&auto=format&fit=crop" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-blue-900/85" />
        </div>
        <div className="relative z-10 container">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="text-white">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium mb-5 border border-white/20">
                <Warehouse className="h-4 w-4 text-yellow-300" />
                <span>창고 · 스튜디오 예약</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
                방송할 공간도<br />셀러브릭스에서 바로 예약
              </h2>
              <p className="text-white/80 mb-6 leading-relaxed">
                전국 300개 이상의 라이브 스튜디오와 물류 창고를 셀러브릭스 하나로 예약하세요.
                날짜, 시간, 지역, 유형 필터로 원하는 공간을 빠르게 찾고 즉시 신청할 수 있습니다.
              </p>
              <div className="space-y-2.5 mb-7">
                {[
                  "시간 단위 유연한 예약 — 최소 1시간부터",
                  "방송 장비·조명·네트워크 완비 스튜디오",
                  "상품 출고 연동 물류 창고 예약",
                  "예약 승인 즉시 자동 알림 발송",
                  "냉장·냉동·일반 창고 모두 가능",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-white/90">
                    <CheckCircle2 className="h-4 w-4 text-yellow-300 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/facilities">
                  <Button size="lg" className="bg-yellow-400 text-navy hover:bg-yellow-300 font-bold">
                    <Warehouse className="h-5 w-5 mr-2" />창고/스튜디오 찾기
                  </Button>
                </Link>
                <Link href="/facilities?type=STUDIO">
                  <Button size="lg" className="bg-transparent border border-white/40 text-white hover:bg-white/10">
                    스튜디오만 보기
                  </Button>
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Video,        label: "라이브 스튜디오", sub: "전문 장비 완비",      num: "100+" },
                { icon: Warehouse,    label: "물류 창고",       sub: "즉시 출고 연동",      num: "200+" },
                { icon: Clock,        label: "시간 단위 예약",  sub: "1시간~장기 가능",     num: "24h" },
                { icon: CalendarCheck,label: "즉시 예약 확정",  sub: "실시간 가용성 확인",  num: "100%" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-white/10 backdrop-blur-sm p-5 text-center border border-white/15 text-white">
                  <item.icon className="h-8 w-8 mx-auto mb-2 text-yellow-300" />
                  <p className="text-2xl font-extrabold text-yellow-300">{item.num}</p>
                  <p className="font-bold text-sm mt-0.5">{item.label}</p>
                  <p className="text-xs text-white/60 mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== MARKETING STRONG SECTION ===== */}
      <section className="bg-navy py-16 md:py-20 relative overflow-hidden">
        <div className="container relative">
          {/* 꿀벌 데코 */}
          <Image src="/images/bee/bee-2.png" alt="" width={80} height={80} className="absolute right-0 top-0 w-16 md:w-20 opacity-60 pointer-events-none select-none" />
          <div className="text-center mb-10">
            <Badge tone="yellow" className="mb-3">마케팅 지원</Badge>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">10년 이상의 마케팅 전문가가 함께합니다</h2>
            <p className="mt-3 text-white/70">유튜브·인스타그램·틱톡 채널 성장부터 콘텐츠 전략까지</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { icon: TrendingUp, title: "채널 성장 전략", desc: "SNS 알고리즘 분석·최적화로 팔로워와 조회수를 빠르게 성장시킵니다." },
              { icon: Video,      title: "콘텐츠 기획·제작", desc: "숏폼·라이브 콘텐츠 전문 제작으로 높은 전환율의 방송을 만들어 드립니다." },
              { icon: BarChart3,  title: "성과 분석 리포트", desc: "주간 채널 성과 리포트 제공으로 데이터 기반 성장 전략을 수립합니다." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-white/10 border border-white/15 p-6 text-white hover:bg-white/15 transition">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/20 mb-4">
                  <item.icon className="h-6 w-6 text-amber-400" />
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-white/70 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CS & MARKETING SUPPORT ===== */}
      <section className="bg-white py-16 md:py-20 relative overflow-hidden">
        <div className="container relative">
          {/* 꿀벌 데코 */}
          <Image src="/images/bee/bee-3.png" alt="" width={72} height={72} className="absolute -right-3 top-2 w-14 md:w-16 opacity-70 pointer-events-none select-none hidden md:block" />
          <div className="text-center mb-12">
            <Badge tone="green" className="mb-3">CS · 마케팅 지원</Badge>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy">판매 이후까지, 전담팀이 함께합니다</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              고객 응대(CS)부터 채널 성장 마케팅까지 — 셀러가 판매에 집중하는 동안 나머지는 전문 인력이 대신 챙깁니다.
            </p>
          </div>

          {/* CS 지원 */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
                <Headphones className="h-5 w-5 text-brand-600" />
              </div>
              <h3 className="text-xl font-extrabold text-navy">CS 지원 <span className="text-sm font-medium text-muted-foreground">고객 대응 전담</span></h3>
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              {[
                { icon: Headphones,  title: "주문·배송·환불 문의 대응", desc: "주문 확인, 배송 추적, 환불 요청까지 모든 고객 문의를 전담 CS팀이 실시간으로 응대합니다." },
                { icon: Star,        title: "리뷰 관리",                desc: "상품·방송 리뷰를 상시 모니터링하고, 긍정 리뷰 확산과 셀러 평판 관리를 지원합니다." },
                { icon: ShieldCheck, title: "클레임 처리 전담팀",       desc: "교환·반품·클레임을 전담팀이 신속·정확하게 처리해 셀러의 응대 부담을 덜어드립니다." },
              ].map((c) => (
                <Card key={c.title} className="border-2 border-border hover:border-brand-200 hover:shadow-lg transition group">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 mb-4 group-hover:bg-brand-100 transition">
                      <c.icon className="h-6 w-6 text-brand-600" />
                    </div>
                    <h4 className="font-bold text-navy mb-2">{c.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* 마케팅 지원 */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="text-xl font-extrabold text-navy">마케팅 지원 <span className="text-sm font-medium text-muted-foreground">채널 성장 파트너</span></h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: Video,      title: "SNS 콘텐츠 제작",           desc: "숏폼·카드뉴스·라이브 하이라이트까지 전문 제작팀이 채널에 맞는 콘텐츠를 만듭니다." },
                { icon: TrendingUp, title: "유튜브·인스타·틱톡 성장",   desc: "알고리즘 분석과 최적화로 유튜브·인스타그램·틱톡 채널을 빠르게 성장시킵니다." },
                { icon: Users,      title: "10년+ 경력 전문가",         desc: "10년 이상 경력의 마케팅 전문가가 채널 전략과 성장 로드맵을 직접 설계합니다." },
                { icon: PlayCircle, title: "라이브 기획·편집·업로드",    desc: "라이브 기획부터 촬영·편집·업로드까지 방송 전 과정을 원스톱으로 대행합니다." },
              ].map((c) => (
                <Card key={c.title} className="border-2 border-border hover:border-amber-200 hover:shadow-lg transition group">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 mb-4 group-hover:bg-amber-100 transition">
                      <c.icon className="h-6 w-6 text-amber-600" />
                    </div>
                    <h4 className="font-bold text-navy mb-2">{c.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== SELLER SERVICES ===== */}
      <section className="bg-gray-50 py-16 md:py-20 relative overflow-hidden">
        <div className="container relative">
          {/* 꿀벌 데코 */}
          <Image src="/images/bee/bee-1.png" alt="" width={72} height={72} className="absolute -left-4 top-0 w-14 md:w-18 opacity-70 pointer-events-none select-none hidden md:block" />
          <div className="text-center mb-10">
            <Badge tone="green" className="mb-3">제공 매니지먼트</Badge>
            <h2 className="text-3xl font-extrabold text-navy">셀러가 받는 매니지먼트 핵심</h2>
            <p className="mt-3 text-muted-foreground">예약부터 라이브·정산·성장까지, 운영은 우리가 대신 관리해 드립니다.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {SELLER_SERVICES.map((s) => {
              const isFarm = s.title === "시설·산지 예약";
              return (
                <div key={s.title} className={`bg-white rounded-xl border p-5 hover:shadow-md transition ${isFarm ? "border-emerald-200 hover:border-emerald-400" : "border-border"}`}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl mb-3 ${isFarm ? "bg-emerald-50" : "bg-brand-50"}`}>
                    <s.icon className={`h-5 w-5 ${isFarm ? "text-emerald-600" : "text-brand-600"}`} />
                  </div>
                  <p className="font-bold text-navy">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
                  {isFarm && (
                    <Link href="/seller/farm-reservations" className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-emerald-600 hover:underline">
                      예약하러 가기 <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-center mt-8">
            <Link href="/register">
              <Button size="lg" className="font-bold">셀러로 시작하기 <ArrowRight className="h-5 w-5 ml-2" /></Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== POPULAR FACILITIES ===== */}
      <section className="bg-white py-16 md:py-20 relative overflow-hidden">
        <div className="container relative">
          {/* 꿀벌 데코 - 벽돌 꿀벌 */}
          <Image src="/images/bee/logo-bee-6.png" alt="" width={80} height={80} className="absolute right-0 bottom-0 w-16 md:w-20 opacity-70 pointer-events-none select-none" />
          <div className="flex items-end justify-between mb-8">
            <div>
              <Badge tone="blue" className="mb-2">인기 공간</Badge>
              <h2 className="text-3xl font-extrabold text-navy">지금 뜨는 창고 · 스튜디오</h2>
              <p className="mt-1 text-muted-foreground text-sm">셀러들이 가장 많이 예약하는 공간을 만나보세요.</p>
            </div>
            <Link href="/facilities" className="text-sm text-brand-600 flex items-center gap-1 hover:underline whitespace-nowrap">
              전체보기 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {facilities.map((f: any) => (
              <Link key={f.id} href={`/facilities/${f.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition group cursor-pointer">
                  <div className="aspect-[16/9] overflow-hidden bg-muted relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.thumbnailUrl ?? "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=70&auto=format&fit=crop"}
                      alt={f.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2">
                      <Badge tone={f.type === "WAREHOUSE" ? "blue" : "purple"}>
                        {f.type === "WAREHOUSE" ? "창고" : "스튜디오"}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="pt-3 pb-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-0.5">
                        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-semibold text-navy">{(f.rating ?? 0).toFixed(1)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{f._count?.products ?? 0}개 상품</span>
                    </div>
                    <p className="font-bold text-navy line-clamp-1">{f.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />{f.region}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-brand-600 font-medium">예약하기 →</span>
                      <span className="font-bold text-navy text-sm">
                        {formatKRW(f.basePrice)}<span className="text-xs font-normal text-muted-foreground">/시간</span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FOR ROLES ===== */}
      <section className="bg-gray-50 py-16 md:py-20">
        <div className="container">
          <div className="text-center mb-10">
            <Badge tone="purple" className="mb-3">역할별 맞춤 서비스</Badge>
            <h2 className="text-3xl font-extrabold text-navy">누구든 셀러브릭스로 성장합니다</h2>
            <p className="mt-2 text-muted-foreground">셀러와 시설 운영자 — 각자의 역할에 최적화된 기능을 제공합니다.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              {
                icon: Radio,
                title: "라이브 셀러",
                color: "from-brand-500 to-brand-600",
                bg: "bg-brand-600",
                items: ["창고·스튜디오 예약", "라이브 세션 관리", "실시간 주문 확인", "자동 정산·매출 분석"],
                href: "/register?role=SELLER",
                cta: "셀러로 가입",
              },
              {
                icon: Warehouse,
                title: "시설 운영자",
                color: "from-blue-500 to-blue-600",
                bg: "bg-blue-600",
                items: ["시설 등록·관리", "예약 승인/거절", "셀러 이용 내역 조회", "매출·정산 확인"],
                href: "/register?role=FACILITY_ADMIN",
                cta: "시설 운영자로 가입",
              },
            ].map((role) => (
              <Card key={role.title} className="overflow-hidden hover:shadow-lg transition">
                <div className={`bg-gradient-to-br ${role.color} p-6 text-white`}>
                  <role.icon className="h-10 w-10 mb-3 opacity-90" />
                  <h3 className="text-xl font-extrabold">{role.title}</h3>
                </div>
                <CardContent className="pt-4 pb-5">
                  <ul className="space-y-2 mb-5">
                    {role.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link href={role.href}>
                    <Button variant="outline" className="w-full">{role.cta}</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SELLER MARQUEE ===== */}
      <section className="py-12 overflow-hidden" style={{ background: "#FFF8E7" }}>
        <div className="container mb-6 text-center">
          <Badge tone="yellow" className="mb-2">함께하는 셀러</Badge>
          <h2 className="text-2xl font-extrabold text-navy">지금 셀러브릭스와 함께하는 셀러들</h2>
        </div>
        <style>{`
          @keyframes marquee {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
          .marquee-track {
            display: flex;
            width: max-content;
            animation: marquee 30s linear infinite;
          }
          .marquee-track:hover {
            animation-play-state: paused;
          }
        `}</style>
        <div className="overflow-hidden">
          <div className="marquee-track">
            {[...SELLER_MARQUEE, ...SELLER_MARQUEE].map((seller, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 mx-3 flex items-center gap-3 rounded-2xl bg-white border border-amber-200 px-5 py-3.5 shadow-sm"
                style={{ minWidth: 220 }}
              >
                <Image
                  src={seller.img}
                  alt={seller.name}
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-full object-cover border border-amber-100"
                />
                <div>
                  <p className="font-bold text-navy text-sm">{seller.name}</p>
                  <p className="text-xs text-muted-foreground">{seller.shop}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold px-2 py-0.5">{seller.category}</span>
                    <span className="text-[10px] text-muted-foreground">팔로워 {seller.followers}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="bg-white py-16 md:py-20">
        <div className="container">
          <div className="text-center mb-10">
            <Badge tone="yellow" className="mb-3">셀러 후기</Badge>
            <h2 className="text-3xl font-extrabold text-navy">셀러들이 직접 말하는 셀러브릭스</h2>
            <p className="mt-2 text-muted-foreground">실제 라이브 셀러들의 생생한 경험을 들어보세요.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="hover:shadow-lg transition border-brand-100">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-0.5 mb-3">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 min-h-[4rem]">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-navy">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="bg-gray-50 py-16 md:py-20">
        <div className="container max-w-3xl">
          <div className="text-center mb-10">
            <Badge tone="gray" className="mb-3">자주 묻는 질문</Badge>
            <h2 className="text-3xl font-extrabold text-navy">FAQ</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details key={i} className="group rounded-xl border border-border bg-white overflow-hidden">
                <summary className="flex items-center justify-between gap-3 cursor-pointer px-5 py-4 font-semibold text-navy list-none">
                  {faq.q}
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground mb-3">더 궁금한 점이 있으신가요?</p>
            <Link href="/register">
              <Button variant="outline">무료 가입 후 문의하기</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== BEE DIVIDER (푸터 위쪽) ===== */}
      <div className="flex justify-center py-6 bg-white">
        <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 object-contain opacity-80">
          {/* 왼쪽 날개 */}
          <ellipse cx="35" cy="45" rx="22" ry="12" fill="#C8E6F7" stroke="#90CAF9" strokeWidth="1.5" opacity="0.85" transform="rotate(-25 35 45)"/>
          {/* 오른쪽 날개 */}
          <ellipse cx="85" cy="45" rx="22" ry="12" fill="#C8E6F7" stroke="#90CAF9" strokeWidth="1.5" opacity="0.85" transform="rotate(25 85 45)"/>
          {/* 몸통 */}
          <ellipse cx="60" cy="68" rx="20" ry="26" fill="#FDD835"/>
          {/* 줄무늬 */}
          <path d="M41 62 Q60 58 79 62" stroke="#333" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          <path d="M40 70 Q60 66 80 70" stroke="#333" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          <path d="M41 78 Q60 74 79 78" stroke="#333" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          {/* 머리 */}
          <circle cx="60" cy="42" r="14" fill="#FDD835"/>
          {/* 눈 */}
          <circle cx="54" cy="40" r="3" fill="#333"/>
          <circle cx="66" cy="40" r="3" fill="#333"/>
          <circle cx="55" cy="39" r="1" fill="white"/>
          <circle cx="67" cy="39" r="1" fill="white"/>
          {/* 더듬이 */}
          <line x1="54" y1="29" x2="47" y2="20" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="47" cy="19" r="2.5" fill="#FDD835" stroke="#333" strokeWidth="1"/>
          <line x1="66" y1="29" x2="73" y2="20" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="73" cy="19" r="2.5" fill="#FDD835" stroke="#333" strokeWidth="1"/>
          {/* 입 */}
          <path d="M55 47 Q60 51 65 47" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </div>

      {/* ===== BOTTOM CTA ===== */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://images.unsplash.com/photo-1487611459768-bd414656ea10?w=1920&q=70&auto=format&fit=crop" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-900/95 to-navy/90" />
        </div>
        <div className="relative z-10 container text-center text-white">
          <Trophy className="h-14 w-14 mx-auto mb-5 text-yellow-300" />
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4">
            복잡한 운영은 맡기고<br />판매에만 집중하세요
          </h2>
          <p className="text-white/80 max-w-xl mx-auto mb-3 leading-relaxed text-lg">
            예약·라이브 운영부터 정산·성장까지, 셀러브릭스가 대신 관리해 드립니다.
            셀러는 매니지먼트를 받으며 판매에만 집중하면 됩니다.
          </p>
          <p className="text-yellow-300 font-semibold mb-10 text-base">
            예약 · 라이브 · 정산 · 성장 — 매니지먼트는 셀러브릭스가!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-yellow-400 text-navy hover:bg-yellow-300 font-bold text-lg h-14 px-10 shadow-xl">
                <Zap className="h-6 w-6 mr-2" />무료로 시작하기
              </Button>
            </Link>
            <Link href="/facilities">
              <Button size="lg" className="bg-transparent border-2 border-white/50 text-white hover:bg-white/15 font-bold text-lg h-14 px-10">
                <Warehouse className="h-6 w-6 mr-2" />창고/스튜디오 예약하기
              </Button>
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-white/60">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" />무료 가입</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" />신용카드 불필요</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" />즉시 이용 가능</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" />언제든 해지 가능</span>
          </div>
        </div>
      </section>

    </div>
  );
}
                                                                                                                                                                                                                                                                                         