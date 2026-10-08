"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  LayoutDashboard, CreditCard, MessageSquare, ShoppingCart, Users, Package, Radio,
  TrendingUp, Star, Camera, Wifi, MapPin, Award, CheckCircle2, ArrowRight,
  FileText, Download, Loader2, Zap, Building2, Leaf, HeartHandshake,
  Receipt, Calculator, Headphones,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateSellerBricksPdf } from "./pdfGenerator";

/* ────────────────────────────────
   데이터
──────────────────────────────── */
const PLATFORM_FEATURES = [
  { icon: Calculator,      title: "정산 관리",       desc: "캠페인별 자동 정산. 방송 종료 후 수수료·금액이 자동 계산됩니다." },
  { icon: MessageSquare,   title: "CS 관리",          desc: "고객 문의를 통합 처리. 셀러는 답장 하나로 CS 완결." },
  { icon: ShoppingCart,    title: "주문서 관리",      desc: "소셜주문서 + 일반주문 통합 관리. 주문 누락 제로." },
  { icon: Users,           title: "고객(구독자) 관리", desc: "구매 이력·구독자 데이터를 한눈에. 타겟 마케팅 연계." },
  { icon: Package,         title: "상품 관리",        desc: "상품 등록부터 재고·옵션 관리까지 원스톱." },
  { icon: Radio,           title: "라이브커머스 관리", desc: "방송 세션·상품번호·실시간 주문 흐름을 플랫폼에서 직접 관리." },
];

const MARKETING_FEATURES = [
  { icon: TrendingUp, title: "유튜브 채널 성장 전략", desc: "구독자 획득부터 수익화까지 전략 수립 및 콘텐츠 기획" },
  { icon: Camera,     title: "인스타그램 · 틱톡", desc: "숏폼 콘텐츠 기획·제작 지원, 팔로워 성장 캠페인 운영" },
  { icon: LayoutDashboard, title: "채널 분석 리포트", desc: "조회수·전환율·ROAS 데이터 기반 성장 전략 수립" },
  { icon: Star,       title: "10년+ 전문팀",    desc: "검증된 디지털 마케팅 노하우로 브랜드 인지도 극대화" },
];

const BROADCAST_FEATURES = [
  { icon: Building2,  title: "전문 스튜디오 제공",   desc: "방송 장비·조명·세트 완비. 창고를 전전할 필요 없습니다." },
  { icon: Camera,     title: "방송 장비 지원",       desc: "고화질 카메라·인코더·조명 장비 포함 제공." },
  { icon: MapPin,     title: "지역 현장 방송 연계",  desc: "전라도 농수산물 현지 라이브 방송. 산지에서 바로 방송!" },
  { icon: Headphones, title: "방송 운영 전담",        desc: "방송 전 세팅부터 방송 후 정산까지 전담 지원." },
];

const SOURCING_FEATURES = [
  { icon: Package,    title: "검증 상품 소싱",       desc: "10년 이상 경력 바탕의 검증된 제품군. 품질 보장." },
  { icon: TrendingUp, title: "최저가 공급",           desc: "셀러에게 직접 최저가 공급. 마진을 지킵니다." },
  { icon: Leaf,       title: "다양한 제품군",         desc: "식품·뷰티·생활용품·농수산물 등 폭넓은 카테고리." },
];

const PAYMENT_FEATURES = [
  { icon: CreditCard, title: "신용카드 · 간편결제",   desc: "카카오페이, 네이버페이, 토스페이 등 주요 간편결제 지원." },
  { icon: ShoppingCart,title: "간편 계좌이체",         desc: "번거로운 계좌이체도 간편계좌이체 시스템으로 처리." },
  { icon: Users,      title: "소셜주문서 시스템",     desc: "어르신(실버 구매자)도 쉽게 구매할 수 있는 초간단 주문 시스템." },
];

const TAX_FEATURES = [
  { icon: Receipt,    title: "세무 처리 지원",       desc: "복잡한 세무 업무를 전문팀이 대신 처리합니다." },
  { icon: FileText,   title: "사업자 등록 지원",     desc: "처음 시작하는 셀러의 사업자 등록부터 도와드립니다." },
  { icon: Calculator, title: "부가세 신고",          desc: "부가세 신고·납부까지 파트너 세무사와 연계 처리." },
];

const REGIONS = [
  { name: "전라남도",    icon: "🏛️", desc: "전남 특산물 라이브 방송 공식 파트너" },
  { name: "목포시",     icon: "🐟", desc: "수산물·해산물 현지 직방송 연계" },
  { name: "부안군",     icon: "🌾", desc: "쌀·농산물·특산품 현지 방송" },
  { name: "전라도 농가", icon: "🍀", desc: "지역 농가 수익 창출 · 직거래 라이브" },
];

const REASONS = [
  { no: "01", title: "플랫폼 완전 지원",     desc: "정산·CS·주문·고객 관리까지 자체 플랫폼을 셀러에게 무상 제공" },
  { no: "02", title: "10년+ 마케팅 전문팀",   desc: "검증된 디지털 마케팅 노하우로 채널 성장과 매출 극대화" },
  { no: "03", title: "전문 스튜디오 완비",    desc: "장비·조명·세트 갖춘 스튜디오에서 바로 방송 시작" },
  { no: "04", title: "지역 농가 살리기 협력", desc: "전남·목포·부안 공식 협력. 지역 특산물 직방송 연계" },
  { no: "05", title: "원스톱 세무 지원",      desc: "사업자 등록부터 부가세 신고까지 파트너 세무사 연계" },
  { no: "06", title: "간편 결제 완벽 지원",   desc: "실버 세대도 쉬운 소셜주문서 + 모든 간편결제 연동" },
];

/* ────────────────────────────────
   컴포넌트
──────────────────────────────── */
function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-brand-100 text-brand-600 text-xs font-bold px-3 py-1 mb-3 tracking-wide uppercase">
      {children}
    </span>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5 hover:shadow-lg hover:border-brand-200 transition group">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 mb-3 group-hover:bg-brand-100 transition">
        <Icon className="h-5 w-5 text-brand-600" />
      </div>
      <p className="font-bold text-navy mb-1">{title}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

export default function IntroPage() {
  const [pdfLoading, setPdfLoading] = useState(false);
  return (
    <div className="flex flex-col bg-[#FFFBF0]" id="intro-content">

      {/* -- HERO -- */}
      <section className="relative overflow-hidden bg-navy py-20 md:py-28">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #F5A623 0%, transparent 50%), radial-gradient(circle at 80% 20%, #FFC107 0%, transparent 40%)" }} />
        <div className="container relative z-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-1.5 text-white text-sm font-semibold mb-6" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
            <Zap className="h-4 w-4" />
            셀러브릭스 스튜디오 공식 소개서
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-5">
            셀러에게 필요한 모든 것,<br />
            <span className="text-brand-400">셀러브릭스 스튜디오</span>가 지원합니다
          </h1>
          <p className="text-white/70 text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
            오직 방송에만 집중하세요 — 나머지는 우리가 합니다
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup/seller">
              <Button size="lg" className="bg-brand-500 hover:bg-brand-600 text-white font-bold px-8 h-12">
                <Zap className="h-5 w-5 mr-2" />무료로 시작하기
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white bg-white/10 hover:bg-white/20 gap-2 h-12"
              disabled={pdfLoading}
              onClick={() => generateSellerBricksPdf(setPdfLoading)}
            >
              {pdfLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <FileText className="h-4 w-4" />}
              {pdfLoading ? "생성 중..." : "PDF 다운로드"}
            </Button>
          </div>
        </div>
      </section>

      {/* -- 섹션 1: 셀러브릭스 플랫폼 지원 -- */}
      <section className="py-16 md:py-20 bg-white relative overflow-hidden">
        <div className="container">
          <div className="text-center mb-12">
            <SectionBadge>★ 핵심 서비스</SectionBadge>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy mb-3">
              셀러브릭스 플랫폼 완전 지원
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              셀러브릭스 자체 플랫폼을 셀러에게 무상으로 완전 지원합니다.<br />
              <strong className="text-navy">셀러는 오직 방송에만 집중할 수 있습니다.</strong>
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PLATFORM_FEATURES.map((f) => <FeatureCard key={f.title} {...f} />)}
          </div>
          <div className="mt-10 rounded-2xl bg-brand-50 border border-brand-200 p-6 text-center">
            <p className="text-brand-700 font-bold text-lg">
              복잡한 플랫폼 운영? 셀러브릭스 스튜디오가 대신합니다.
            </p>
            <p className="text-brand-600/80 text-sm mt-1">정산 · CS · 주문 · 고객 · 상품 · 라이브 — 6가지 관리를 원스톱 처리</p>
          </div>
        </div>
      </section>

      {/* -- 섹션 2: 자체 송출 라이브커머스 -- */}
      <section className="py-16 md:py-20 bg-[#FFFBF0]">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <SectionBadge>자체 송출 채널</SectionBadge>
              <h2 className="text-3xl md:text-4xl font-extrabold text-navy mb-4">
                셀러브릭스 스튜디오<br />자체 라이브커머스
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                셀러브릭스 스튜디오 자체 라이브커머스 채널을 운영합니다.
                방송 전 상품 세팅부터 방송 후 정산까지 완전한 원스톱 서비스를 제공합니다.
              </p>
              <ul className="space-y-3">
                {[
                  "전문 장비·조명·세트 완비된 스튜디오",
                  "자체 라이브커머스 채널 운영",
                  "방송 전 상품 세팅 완전 대행",
                  "방송 후 정산까지 원스톱",
                  "실시간 주문·CS 즉시 대응",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-navy">
                    <CheckCircle2 className="h-4 w-4 text-brand-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative flex items-center justify-center">
              <div className="rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 p-10 text-center text-white shadow-2xl">
                <Image src="/images/brand/mark-original-on-light.png" alt="셀러브릭스 심볼" width={112} height={112} className="mx-auto mb-4 h-28 w-28 object-contain" />
                <p className="font-extrabold text-xl mb-1">LIVE NOW</p>
                <p className="text-brand-100 text-sm">셀러브릭스 스튜디오 채널</p>
                <div className="mt-4 flex justify-center gap-4 text-sm">
                  <span className="bg-white/20 rounded-lg px-3 py-1.5">전문 장비</span>
                  <span className="bg-white/20 rounded-lg px-3 py-1.5">조명 완비</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -- 섹션 3: 마케팅 지원 -- */}
      <section className="py-16 md:py-20 bg-white relative overflow-hidden">
        <div className="container">
          <div className="text-center mb-12">
            <SectionBadge>10년+ 전문팀</SectionBadge>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy mb-3">마케팅 전문 지원</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              10년 넘게 마케팅을 진행해온 전문팀이 채널 성장부터 콘텐츠 기획까지 함께합니다.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {MARKETING_FEATURES.map((f) => <FeatureCard key={f.title} {...f} />)}
          </div>
          <div className="mt-8 rounded-2xl bg-navy text-white p-6 flex flex-col md:flex-row items-center gap-4 justify-between">
            <div>
              <p className="font-extrabold text-lg text-brand-400">10년+ 마케팅 경력</p>
              <p className="text-white/70 text-sm mt-1">유튜브 · 인스타그램 · 틱톡 채널 성장 전략 — 검증된 노하우</p>
            </div>
            <Link href="/signup/seller">
              <Button className="bg-brand-500 hover:bg-brand-600 text-white shrink-0">
                마케팅 지원 받기 <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* -- 섹션 4: 방송 지원 -- */}
      <section className="py-16 md:py-20 bg-[#FFFBF0] relative overflow-hidden">
        <div className="container">
          <div className="text-center mb-12">
            <SectionBadge>방송 지원</SectionBadge>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy mb-3">전문 스튜디오 방송 지원</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              창고를 전전할 필요 없습니다. 셀러브릭스 스튜디오가 제공합니다.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {BROADCAST_FEATURES.map((f) => <FeatureCard key={f.title} {...f} />)}
          </div>
        </div>
      </section>

      {/* -- 섹션 5: 상품 소싱 -- */}
      <section className="py-16 md:py-20 bg-white">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="rounded-3xl bg-gradient-to-br from-honey-400 to-brand-500 p-10 text-white text-center shadow-xl">
              <Image src="/images/brand/mark-original-on-light.png" alt="셀러브릭스 심볼" width={112} height={112} className="mx-auto mb-4 h-28 w-28 object-contain" />
              <p className="font-extrabold text-xl mb-2">검증 상품 직소싱</p>
              <p className="text-white/80 text-sm">10년+ 소싱 경력 · 최저가 공급</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <span className="bg-white/20 rounded-lg p-2">식품</span>
                <span className="bg-white/20 rounded-lg p-2">뷰티</span>
                <span className="bg-white/20 rounded-lg p-2">생활</span>
              </div>
            </div>
            <div>
              <SectionBadge>상품 소싱</SectionBadge>
              <h2 className="text-3xl md:text-4xl font-extrabold text-navy mb-4">
                검증된 상품을<br />최저가로 공급
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                셀러브릭스가 직접 소싱한 검증 상품을 셀러에게 최저가로 공급합니다.
                10년 이상 경력 기반의 다양한 제품군으로 방송 경쟁력을 높이세요.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {SOURCING_FEATURES.map((f) => (
                  <div key={f.title} className="bg-brand-50 rounded-xl p-4">
                    <f.icon className="h-5 w-5 text-brand-600 mb-2" />
                    <p className="font-bold text-navy text-sm">{f.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -- 섹션 6: 결제 지원 -- */}
      <section className="py-16 md:py-20 bg-[#FFFBF0]">
        <div className="container">
          <div className="text-center mb-12">
            <SectionBadge>결제 지원</SectionBadge>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy mb-3">누구나 쉬운 결제 시스템</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              어르신(실버 구매자)도 쉽게 구매할 수 있는 소셜주문서부터 모든 간편결제까지 지원합니다.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {PAYMENT_FEATURES.map((f) => <FeatureCard key={f.title} {...f} />)}
          </div>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {["카카오페이", "네이버페이", "토스페이", "신용카드"].map((p) => (
              <div key={p} className="bg-white rounded-xl border border-border p-3 text-center text-sm font-semibold text-navy shadow-sm">
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- 섹션 7: 세무 지원 -- */}
      <section className="py-16 md:py-20 bg-white">
        <div className="container">
          <div className="text-center mb-12">
            <SectionBadge>세무 지원</SectionBadge>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy mb-3">복잡한 세무, 우리가 해결</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              세무 처리가 복잡하다면 셀러브릭스 스튜디오의 전문 세무 지원을 받으세요.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {TAX_FEATURES.map((f) => <FeatureCard key={f.title} {...f} />)}
          </div>
        </div>
      </section>

      {/* -- 섹션 8: 지역 농가 살리기 -- */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-emerald-900 to-navy relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 30% 70%, #10b981 0%, transparent 50%)" }} />
        <div className="container relative z-10">
          <div className="text-center mb-12">
            <span className="inline-block rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 mb-3 tracking-wide uppercase border border-emerald-500/30">
              사회적 가치
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
              지역 농가 살리기 프로젝트
            </h2>
            <p className="text-white/70 max-w-xl mx-auto">
              전라남도·목포시·부안군과 협력하여 지역 특산물·농수산물을
              현지에서 직접 라이브방송으로 연계, 농가 수익을 창출합니다.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {REGIONS.map((r) => (
              <div key={r.name} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 text-center text-white hover:bg-white/15 transition">
                <div className="text-4xl mb-3">{r.icon}</div>
                <p className="font-extrabold text-lg mb-1">{r.name}</p>
                <p className="text-white/60 text-sm">{r.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 bg-white/10 border border-white/20 rounded-2xl p-6 text-center backdrop-blur-sm">
            <HeartHandshake className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-white font-bold text-lg mb-2">
              지역 농가와 함께 성장합니다
            </p>
            <p className="text-white/60 text-sm max-w-lg mx-auto">
              산지에서 직접 진행하는 라이브방송으로 유통 단계를 줄이고 농가 수익을 높입니다.
              셀러브릭스 스튜디오는 단순한 플랫폼을 넘어 지역 경제 활성화에 기여합니다.
            </p>
          </div>
        </div>
      </section>

      {/* -- 섹션 9: 선택해야 하는 이유 -- */}
      <section className="py-16 md:py-20 bg-[#FFFBF0]">
        <div className="container">
          <div className="text-center mb-12">
            <SectionBadge>Why 셀러브릭스 스튜디오</SectionBadge>
            <h2 className="text-3xl md:text-4xl font-extrabold text-navy mb-3">
              셀러브릭스 스튜디오를 선택해야 하는 이유
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              다른 플랫폼과 다릅니다. 셀러가 필요한 모든 것을 한 곳에서.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {REASONS.map((r) => (
              <div key={r.no} className="bg-white rounded-2xl border border-border p-6 hover:shadow-lg hover:border-brand-300 transition group">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl font-extrabold text-brand-200 group-hover:text-brand-300 transition leading-none">{r.no}</span>
                  <p className="font-extrabold text-navy">{r.title}</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- CTA -- */}
      <section className="py-20 bg-gradient-to-r from-brand-500 to-brand-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-15"
          style={{ backgroundImage: "radial-gradient(circle at 10% 90%, #1A1A2E 0%, transparent 50%)" }} />
        <div className="container relative z-10 text-center text-white">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4">
            지금 바로 시작하세요
          </h2>
          <p className="text-white/80 max-w-xl mx-auto mb-8 text-lg leading-relaxed">
            방송에만 집중하세요.<br />
            나머지는 셀러브릭스 스튜디오가 모두 합니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup/seller">
              <Button size="lg" className="bg-white text-brand-600 hover:bg-brand-50 font-bold px-10 h-12 shadow-xl">
                <Zap className="h-5 w-5 mr-2" />무료로 시작하기
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="border-white/40 text-white bg-white/10 hover:bg-white/20 h-12 gap-2"
              onClick={() => window.print()}
            >
              <Download className="h-4 w-4" />소개서 저장
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
}
