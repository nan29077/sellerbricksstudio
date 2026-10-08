import Link from "next/link";
import { formatKRW } from "@/lib/utils";
import { FACILITY_PAGE_THEMES, type FacilityPageConfig } from "@/lib/facility-page";
import { FacilityInquiryButton } from "@/components/facility/facility-inquiry-button";
import {
  ArrowRight, BadgeCheck, Boxes, CalendarDays, Camera,
  CheckCircle2, ChevronLeft, Clock3, Home, MapPin,
  MessageSquare, ShieldCheck, Store, Tag, UserRound,
  Warehouse, Wifi,
} from "lucide-react";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

// 주요 카테고리 아이콘/색상 매핑
const SPECIALTY_META: Record<string, { color: string; bg: string }> = {
  "의류": { color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  "코스메틱": { color: "text-pink-700", bg: "bg-pink-50 border-pink-200" },
  "패션잡화": { color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  "식품": { color: "text-green-700", bg: "bg-green-50 border-green-200" },
  "전자제품": { color: "text-slate-700", bg: "bg-slate-100 border-slate-200" },
  "홈리빙": { color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  "스포츠": { color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  "반려동물": { color: "text-teal-700", bg: "bg-teal-50 border-teal-200" },
  "유아동": { color: "text-cyan-700", bg: "bg-cyan-50 border-cyan-200" },
  "도서/취미": { color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
};

export function FacilityStorefront({
  facility: f,
  pageConfig,
  user,
}: {
  facility: any;
  pageConfig: FacilityPageConfig;
  user: { role?: string; id?: string } | null;
}) {
  const accent = FACILITY_PAGE_THEMES[pageConfig.theme].accent;
  const isWarehouse = f.type === "WAREHOUSE";
  const slotCount = f.slots?.length ?? 0;
  const equipment = f.equipment?.split(",").map((item: string) => item.trim()).filter(Boolean) ?? [];
  const specialties = f.specialty
    ? f.specialty.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];
  const directBookingHref = `/seller/bookings/new?facilityId=${f.id}`;
  const isSeller = user?.role === "SELLER";
  const isLoggedIn = !!user;
  const bookingHref = isSeller
    ? directBookingHref
    : user
      ? "/signup/seller"
      : `/login?callbackUrl=${encodeURIComponent(directBookingHref)}`;
  const bookingLabel = isSeller ? pageConfig.ctaLabel : user ? "셀러 계정으로 예약하기" : "로그인하고 예약하기";
  const bookingHrefForSlot = (slot: any) => isSeller
    ? `${directBookingHref}&start=${encodeURIComponent(slot.startTime)}&end=${encodeURIComponent(slot.endTime)}`
    : bookingHref;

  return (
    <div className="min-h-screen bg-[#FBF8EE] pb-20 md:pb-0">
      {/* 상단 헤더 */}
      <div className="border-b border-[#EEEAE0] bg-white">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand-100 bg-brand-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pageConfig.profileImageUrl} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-navy sm:text-base">{pageConfig.pageTitle}</p>
              <p className="text-[10px] font-semibold text-muted-foreground">셀러브릭스 파트너 시설</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="#store-inquiry" aria-label="시설 문의" className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-navy bg-white text-navy shadow-[2px_2px_0_#1A1A2E] transition hover:-translate-y-0.5">
              <MessageSquare className="h-5 w-5" />
            </a>
            <Link href={bookingHref} aria-label="시설 예약" className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-navy bg-[#FFD552] text-navy shadow-[2px_2px_0_#1A1A2E] transition hover:-translate-y-0.5">
              <CalendarDays className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 배너 */}
      <section id="store-home" className="relative mx-auto h-[280px] max-w-[1440px] overflow-hidden bg-navy sm:h-[360px] lg:h-[430px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pageConfig.bannerUrl} alt={`${pageConfig.pageTitle} 커버`} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/5" />
        <Link href="/facilities" className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/30 px-3 py-2 text-xs font-bold text-white backdrop-blur-md hover:bg-black/45 sm:left-6">
          <ChevronLeft className="h-4 w-4" /> 시설 목록
        </Link>
        {/* 전문 분야 배지 (배너 오른쪽 하단) */}
        {specialties.length > 0 && (
          <div className="absolute bottom-4 right-4 flex flex-wrap justify-end gap-1.5">
            {specialties.slice(0, 3).map((s: string) => (
              <span key={s} className="rounded-full border border-white/30 bg-black/40 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                {s} 전문
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 메인 카드 */}
      <main className="relative z-10 mx-auto -mt-16 max-w-5xl px-3 sm:-mt-20 sm:px-6">
        <section className="relative rounded-[28px] border border-white/80 bg-white p-5 pt-14 shadow-[0_14px_40px_rgba(26,26,46,0.14)] sm:p-8 sm:pt-16">
          <div className="absolute -top-12 left-5 flex h-24 w-24 items-center justify-center rounded-full border-[5px] border-white bg-brand-50 shadow-md sm:-top-14 sm:left-8 sm:h-28 sm:w-28">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pageConfig.profileImageUrl} alt={`${f.name} 프로필`} className="h-full w-full rounded-full object-cover" />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-500 px-3 py-1 text-[10px] font-black text-white shadow-sm">
              ● OPEN
            </span>
          </div>

          <div className="flex items-start justify-between gap-3 pl-[108px] sm:pl-[132px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-black text-navy sm:text-3xl">{pageConfig.pageTitle}</h1>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border-2 border-navy bg-[#FFD552] text-navy">
                  <BadgeCheck className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-1 hidden items-center gap-1 text-xs font-semibold text-muted-foreground sm:flex">
                <MapPin className="h-3.5 w-3.5" />{f.address ?? f.region}
              </p>
            </div>
          </div>

          {/* 통계 */}
          <div className="mt-7 grid grid-cols-3 divide-x divide-[#E8E8EC] rounded-2xl bg-[#F8F9FB] px-2 py-5 sm:mt-8">
            {[
              { value: (f.rating ?? 0).toFixed(1), label: "시설 평점" },
              { value: specialties.length > 0 ? `${specialties.length}개` : "-", label: "전문 분야" },
              { value: slotCount.toLocaleString(), label: "예약 일정" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-lg font-black text-navy sm:text-2xl">{stat.value}</p>
                <p className="mt-1 text-[10px] font-medium text-slate-400 sm:text-xs">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <p className="text-sm font-bold leading-relaxed text-slate-500 sm:text-base">{pageConfig.tagline}</p>
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400 sm:text-sm">{pageConfig.intro}</p>
          </div>

          {/* 전문 분야 태그 */}
          {specialties.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {specialties.map((s: string) => {
                const meta = SPECIALTY_META[s] ?? { color: "text-brand-700", bg: "bg-brand-50 border-brand-200" };
                return (
                  <span key={s} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${meta.bg} ${meta.color}`}>
                    <Tag className="h-3 w-3" />
                    {s} 전문
                  </span>
                );
              })}
            </div>
          )}

          {/* 예약 CTA */}
          <Link
            href={bookingHref}
            className="mt-6 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-[#D99000] px-5 text-base font-black text-navy shadow-sm transition hover:brightness-105 sm:text-lg"
            style={{ backgroundColor: accent }}
          >
            <span className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-black text-white">● 예약</span>
            {bookingLabel}
            <ArrowRight className="h-5 w-5" />
          </Link>

          {/* 문의 버튼 */}
          <div className="mt-3">
            <FacilityInquiryButton
              facilityId={f.id}
              facilityName={f.name}
              isSeller={isSeller}
              isLoggedIn={isLoggedIn}
            />
          </div>
        </section>

        {/* 퀵 예약 */}
        <section id="store-booking" className="mt-5 scroll-mt-6 overflow-hidden rounded-[26px] border border-[#E9DFC5] bg-white shadow-[0_10px_30px_rgba(26,26,46,0.08)]">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-5 sm:p-7 lg:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-700">Quick booking</p>
                  <h2 className="mt-1 text-2xl font-black text-navy sm:text-3xl">원하는 시간으로 바로 예약하세요</h2>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">시설과 시간이 미리 선택된 예약 신청서로 바로 연결됩니다.</p>
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7D6] text-brand-700">
                  <CalendarDays className="h-6 w-6" />
                </span>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                {[
                  { step: "01", title: "시간 선택" },
                  { step: "02", title: "신청서 작성" },
                  { step: "03", title: "관리자 승인" },
                ].map((item) => (
                  <div key={item.step} className="rounded-2xl bg-[#F8F9FB] px-2 py-4 text-center">
                    <span className="text-[10px] font-black text-brand-700">STEP {item.step}</span>
                    <p className="mt-1 text-xs font-black text-navy sm:text-sm">{item.title}</p>
                  </div>
                ))}
              </div>

              {slotCount > 0 && (
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-black text-navy">빠른 시간 선택</p>
                    <p className="text-[10px] font-bold text-slate-400">날짜는 신청서에서 선택</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {f.slots.slice(0, 3).map((slot: any) => (
                      <Link key={slot.id} href={bookingHrefForSlot(slot)} className="group flex items-center justify-between rounded-xl border border-[#E8E4DA] bg-[#FCFBF7] px-3 py-3 transition hover:border-brand-400 hover:bg-brand-50">
                        <div>
                          <p className="text-[10px] font-black text-brand-700">{WEEK[slot.weekday]}요일</p>
                          <p className="mt-0.5 text-xs font-black text-navy">{slot.startTime}–{slot.endTime}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between bg-[#171B30] p-5 text-white sm:p-7 lg:p-8">
              <div>
                <p className="text-xs font-bold text-white/55">기본 이용료 · 1시간</p>
                <p className="mt-2 text-3xl font-black text-[#FFD552]">{formatKRW(f.basePrice)}</p>
                <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                  <p className="flex items-center gap-2 text-xs font-bold text-white/75">
                    <Clock3 className="h-4 w-4 text-[#FFD552]" /> 운영 {f.openTime ?? "09:00"}–{f.closeTime ?? "22:00"}
                  </p>
                  <p className="flex items-center gap-2 text-xs font-bold text-white/75">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 승인 전에는 결제되지 않습니다
                  </p>
                  <p className="flex items-center gap-2 text-xs font-bold text-white/75">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" /> 셀러브릭스 안전 예약
                  </p>
                </div>
              </div>
              <Link href={bookingHref} className="mt-7 flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#FFD552] px-4 py-3.5 text-sm font-black text-navy transition hover:-translate-y-0.5 hover:bg-brand-300">
                <CalendarDays className="h-4 w-4" />{bookingLabel}<ArrowRight className="h-4 w-4" />
              </Link>
              {!isSeller && (
                <p className="mt-3 text-center text-[10px] font-medium text-white/45">
                  예약 신청은 셀러 계정으로 진행할 수 있습니다.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* 페이지 내비 */}
        <nav className="mt-5 hidden grid-cols-4 overflow-hidden rounded-2xl border border-[#ECE8DD] bg-white p-1.5 shadow-sm md:grid">
          {[
            { href: "#store-home", label: "홈", icon: Home },
            { href: "#store-specialty", label: "전문 분야", icon: Tag },
            { href: "#store-schedule", label: "예약 일정", icon: CalendarDays },
            { href: "#store-info", label: "시설 정보", icon: UserRound },
          ].map((item, index) => (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2.5 text-[10px] font-bold transition hover:bg-brand-50 sm:flex-row sm:text-xs ${index === 0 ? "bg-brand-50 text-brand-800" : "text-slate-400"}`}>
              <item.icon className="h-4 w-4" />{item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-5 space-y-5">
          {/* 주요 취급 카테고리 */}
          <section id="store-specialty" className="scroll-mt-36 rounded-[24px] border border-[#EEEAE0] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-700">Specialty</p>
                <h2 className="mt-1 text-xl font-black text-navy">주요 취급 카테고리</h2>
              </div>
              <Tag className="h-6 w-6 text-brand-500" />
            </div>

            {specialties.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {specialties.map((s: string) => {
                    const meta = SPECIALTY_META[s] ?? { color: "text-brand-700", bg: "bg-brand-50 border-brand-200" };
                    return (
                      <div key={s} className={`flex items-center gap-3 rounded-2xl border p-4 ${meta.bg}`}>
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 ${meta.color}`}>
                          <Tag className="h-5 w-5" />
                        </div>
                        <div>
                          <p className={`text-sm font-extrabold ${meta.color}`}>{s}</p>
                          <p className="text-[10px] text-slate-400">전문 취급</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 라이브 공간 정보 */}
                {f.liveSpaceInfo && (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Camera className="h-4 w-4 text-amber-700" />
                      <p className="text-sm font-black text-amber-800">라이브·촬영 공간 안내</p>
                    </div>
                    <p className="text-sm leading-relaxed text-amber-900 whitespace-pre-line">{f.liveSpaceInfo}</p>
                  </div>
                )}
              </>
            ) : (
              <EmptyPanel icon={Tag} text="카테고리 정보를 준비 중입니다" />
            )}
          </section>

          {/* 예약 일정 */}
          {pageConfig.showSchedule && (
            <section id="store-schedule" className="scroll-mt-36 rounded-[24px] border border-[#EEEAE0] bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-700">Booking schedule</p>
                  <h2 className="mt-1 text-xl font-black text-navy">예약 가능한 일정</h2>
                </div>
                <Clock3 className="h-6 w-6 text-brand-500" />
              </div>
              {slotCount > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {f.slots.map((slot: any) => (
                    <Link key={slot.id} href={bookingHrefForSlot(slot)} className="group flex items-center gap-3 rounded-2xl border border-[#EEEAE0] bg-[#FCFBF7] p-4 transition hover:border-brand-300 hover:bg-brand-50">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-sm font-black text-white">
                        {WEEK[slot.weekday]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-navy">{slot.startTime} – {slot.endTime}</p>
                        <p className="mt-0.5 text-xs text-slate-400">예약 가능 시간</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-brand-700">{formatKRW(slot.price ?? f.basePrice)}</p>
                        <ArrowRight className="mt-1 h-4 w-4 text-slate-300 group-hover:text-brand-500" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyPanel icon={CalendarDays} text="예약 일정을 준비하고 있습니다" />
              )}
            </section>
          )}

          {/* 시설 정보 */}
          <section id="store-info" className="scroll-mt-36 rounded-[24px] border border-[#EEEAE0] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-700">Facility guide</p>
              <h2 className="mt-1 text-xl font-black text-navy">시설 정보</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: isWarehouse ? Warehouse : Camera, label: "시설 유형", value: isWarehouse ? "물류 창고" : "라이브 스튜디오" },
                { icon: MapPin, label: "위치", value: f.address ?? f.region },
                { icon: Clock3, label: "운영 시간", value: `${f.openTime ?? "09:00"} – ${f.closeTime ?? "22:00"}` },
                { icon: Store, label: "기본 이용료", value: `${formatKRW(f.basePrice)} / 시간` },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-[#F8F9FB] p-4">
                  <item.icon className="h-5 w-5 text-brand-600" />
                  <p className="mt-3 text-[10px] font-bold text-slate-400">{item.label}</p>
                  <p className="mt-1 text-sm font-black leading-snug text-navy">{item.value}</p>
                </div>
              ))}
            </div>

            {pageConfig.showEquipment && equipment.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-navy">
                  <Boxes className="h-4 w-4 text-brand-600" /> 제공 시설·장비
                </h3>
                <div className="flex flex-wrap gap-2">
                  {equipment.map((item: string) => (
                    <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E4DA] bg-[#FCFBF7] px-3 py-2 text-xs font-bold text-navy">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />{item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-2 border-t border-[#EEEAE0] pt-5 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, text: "안전한 예약·결제" },
                { icon: Wifi, text: "시설 연결 지원" },
                { icon: CheckCircle2, text: "마케팅 지원 연동" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <item.icon className="h-4 w-4 text-emerald-500" />{item.text}
                </div>
              ))}
            </div>
          </section>

          {/* 문의 섹션 */}
          <section id="store-inquiry" className="scroll-mt-36 rounded-[24px] border border-[#EEEAE0] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-700">Inquiry</p>
                <h2 className="mt-1 text-xl font-black text-navy">시설에 문의하기</h2>
                <p className="mt-1 text-xs text-slate-400">예약 가능 여부, 시설 상태, 특별 요청 등을 문의해보세요</p>
              </div>
              <MessageSquare className="h-6 w-6 text-brand-500" />
            </div>
            <FacilityInquiryButton
              facilityId={f.id}
              facilityName={f.name}
              isSeller={isSeller}
              isLoggedIn={isLoggedIn}
            />
          </section>
        </div>

        <div className="py-8 text-center">
          <Link href="/facilities" className="inline-flex items-center gap-1 text-sm font-black text-slate-400 hover:text-brand-700">
            <ChevronLeft className="h-4 w-4" /> 다른 시설 둘러보기
          </Link>
        </div>
      </main>

      {/* 모바일 하단 내비 */}
      <nav aria-label="시설 페이지 메뉴" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 items-center border-t border-[#E8E5DE] bg-white/95 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-3px_16px_rgba(26,26,46,0.05)] backdrop-blur md:hidden">
        {[
          { href: "#store-home", label: "홈", icon: Home },
          { href: "#store-specialty", label: "카테고리", icon: Tag },
          { href: bookingHref, label: "예약", icon: CalendarDays },
          { href: "#store-inquiry", label: "문의", icon: MessageSquare },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold text-slate-500 transition hover:bg-[#FAF8F3] hover:text-navy">
            <item.icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function EmptyPanel({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl bg-[#F8F9FB] text-slate-300">
      <Icon className="h-10 w-10" />
      <p className="mt-3 text-sm font-bold">{text}</p>
    </div>
  );
}
