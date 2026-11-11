import Link from "next/link";
import { formatKRW } from "@/lib/utils";
import { defaultProfileFor, FACILITY_PAGE_THEMES, type FacilityPageConfig } from "@/lib/facility-page";
import { FACILITY_ARTWORK } from "@/lib/shop-artwork";
import { ShopShell } from "@/components/shop/shop-shell";
import { ShopImage } from "@/components/shop/shop-image";
import { FacilityInquiryButton } from "@/components/facility/facility-inquiry-button";
import { FavoriteButton } from "@/components/booking/favorite-button";
import {
  ArrowRight, BadgeCheck, Boxes, CalendarDays, Camera,
  CheckCircle2, ChevronLeft, Clock3, Home, LayoutTemplate, MapPin,
  MessageSquare, ShieldCheck, Store, Tag, UserRound,
  Warehouse, Wifi, Star,
} from "lucide-react";

type PublicReview = { id: string; rating: number; content: string; reply: string | null; createdAt: string; author: string };

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
  reviews = [],
  favorited = false,
  products,
}: {
  facility: any;
  pageConfig: FacilityPageConfig;
  user: { role?: string; id?: string } | null;
  reviews?: PublicReview[];
  favorited?: boolean;
  products: Array<{ id: string; stock: number; salePrice: number; supplyPrice?: number | null; product: { name: string; category: string; thumbnailUrl: string | null } }>;
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
  const bookable = f.status === "APPROVED" && (isSeller || !isLoggedIn);
  const artwork = FACILITY_ARTWORK[isWarehouse ? 0 : 1].url;
  const bookingHref = isSeller
    ? directBookingHref
    : `/login?callbackUrl=${encodeURIComponent(directBookingHref)}`;
  const bookingLabel = isSeller ? pageConfig.ctaLabel : "로그인하고 예약하기";
  const bookingHrefForSlot = (slot: any) => isSeller
    ? `${directBookingHref}&start=${encodeURIComponent(slot.startTime)}&end=${encodeURIComponent(slot.endTime)}`
    : bookingHref;
  const management = user?.role === "SUPER_ADMIN" && f.ownerId ? `/admin/facilities/${f.id}/shop` : user?.id && user.id === f.ownerId ? `/facility/pages/${f.id}` : null;
  const shopLinks = [
    { href: "#store-home", label: "샵 홈", icon: Home },
    ...(pageConfig.showProducts ? [{ href: "#store-products", label: "상품", icon: Boxes }] : []),
    ...(bookable ? [{ href: "#store-booking", label: "예약", icon: CalendarDays }] : []),
    { href: "#store-info", label: "공간 정보", icon: UserRound },
    { href: "#store-inquiry", label: "문의", icon: MessageSquare },
    ...(management ? [{ href: management, label: "샵 관리", icon: LayoutTemplate }] : []),
  ];

  return (
    <ShopShell background={pageConfig.backgroundUrl} fallback={artwork} links={shopLinks}>
      {/* 상단 헤더 */}
      <div className="border-b border-[#EEEAE0] bg-white">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand-100 bg-brand-50">
              <ShopImage src={pageConfig.profileImageUrl} fallback={defaultProfileFor(f.id)} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-navy sm:text-base">{pageConfig.pageTitle}</p>
              <p className="text-[11px] font-semibold text-muted-foreground">스토리지마켓 파트너 창고(스튜디오)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === "SELLER" && <FavoriteButton facilityId={f.id} initial={favorited} className="h-10 rounded-xl border-2 border-navy px-3 shadow-[2px_2px_0_#1A1A2E]" />}
            <a href="#store-inquiry" aria-label="창고(스튜디오) 문의" className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-navy bg-white text-navy shadow-[2px_2px_0_#1A1A2E] transition hover:-translate-y-0.5">
              <MessageSquare className="h-5 w-5" />
            </a>
            {bookable && <Link href={bookingHref} aria-label="창고(스튜디오) 예약" className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-navy bg-[#FFD552] text-navy shadow-[2px_2px_0_#1A1A2E] transition hover:-translate-y-0.5">
              <CalendarDays className="h-5 w-5" />
            </Link>}
          </div>
        </div>
      </div>

      {/* 배너 */}
      <section id="store-home" className="relative mx-3 mt-4 h-[230px] overflow-hidden rounded-[26px] bg-navy sm:mx-6 sm:mt-6 sm:h-[300px]">
        <ShopImage src={pageConfig.bannerUrl} fallback={artwork} eager className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/5" />
        <Link href="/facilities" className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/30 px-3 py-2 text-xs font-bold text-white backdrop-blur-md hover:bg-black/45 sm:left-6">
          <ChevronLeft className="h-4 w-4" /> 창고(스튜디오) 목록
        </Link>
        {/* 전문 분야 배지 (배너 오른쪽 하단) */}
        {specialties.length > 0 && (
          <div className="absolute bottom-4 right-4 flex flex-wrap justify-end gap-1.5">
            {specialties.slice(0, 3).map((s: string) => (
              <span key={s} className="rounded-full border border-white/30 bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                {s} 전문
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 메인 카드 */}
      <main className="relative z-10 mx-auto -mt-8 px-3 sm:-mt-10 sm:px-6">
        <section className="relative mx-2 rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_14px_40px_rgba(26,26,46,0.14)] sm:mx-5 sm:p-6">
          <div className="flex items-center gap-3">
            <ShopImage src={pageConfig.profileImageUrl} fallback={defaultProfileFor(f.id)} className="h-14 w-14 shrink-0 rounded-full border bg-brand-50 object-cover" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-xl font-black text-navy sm:text-2xl">{pageConfig.pageTitle}</h1>
                {f.status === "APPROVED" && <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border-2 border-navy bg-[#FFD552] text-navy">
                  <BadgeCheck className="h-4 w-4" />
                </span>}
              </div>
              <p className="mt-1 hidden items-center gap-1 text-xs font-semibold text-muted-foreground sm:flex">
                <MapPin className="h-3.5 w-3.5" />{f.address ?? f.region}
              </p>
            </div>
          </div>

          {/* 통계 */}
          <div className="mt-7 grid grid-cols-3 divide-x divide-[#E8E8EC] rounded-2xl bg-[#F8F9FB] px-2 py-5 sm:mt-8">
            {[
              { value: (f.rating ?? 0).toFixed(1), label: "창고(스튜디오) 평점" },
              { value: specialties.length > 0 ? `${specialties.length}개` : "-", label: "전문 분야" },
              { value: slotCount.toLocaleString(), label: "예약 일정" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-lg font-black text-navy sm:text-2xl">{stat.value}</p>
                <p className="mt-1 text-[11px] font-medium text-slate-400 sm:text-xs">{stat.label}</p>
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
          {bookable && <Link
            href={bookingHref}
            className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#D99000] px-3 py-2 text-center text-sm font-black text-navy shadow-sm transition hover:brightness-105 sm:text-base"
            style={{ backgroundColor: accent }}
          >
            <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="break-keep">{bookingLabel}</span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          </Link>}
          {f.status !== "APPROVED" && <p className="mt-3 text-xs font-bold text-amber-800">비공개 미리보기</p>}

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

        {pageConfig.showProducts && <section id="store-products" className="mt-5 scroll-mt-4 rounded-[24px] border bg-white p-4 sm:p-6">
          <h2 className="text-xl font-black text-navy">예약과 함께 고르는 판매 상품</h2>
          {products.length === 0 ? <p className="mt-3 text-sm text-slate-600">공개된 판매 상품이 없습니다.</p> : <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products.map(({ id, stock, salePrice, supplyPrice, product }) => <article key={id} className="overflow-hidden rounded-xl border">
                <ShopImage src={product.thumbnailUrl} fallback={artwork} className="aspect-[4/3] w-full object-cover" />
                <div className="space-y-1 p-2.5">
                  <p className="text-xs text-slate-600">{product.category}</p>
                  <h3 className="break-words text-sm font-bold">{product.name}</h3>
                  <p className="text-xs font-semibold">판매가 {formatKRW(salePrice)} · {stock > 0 ? `재고 ${stock}개` : "품절"}</p>
                  {isSeller && supplyPrice != null && <p className="text-[11px] font-semibold text-purple-700">셀러 공급가 {formatKRW(supplyPrice)} · 마진 {formatKRW(Math.max(0, salePrice - supplyPrice))}</p>}
                  {bookable && isSeller && stock > 0 && <Link href={`${directBookingHref}&products=${encodeURIComponent(`${id}:1`)}`}
                    className="mt-1 inline-flex min-h-9 items-center text-xs font-bold text-brand-800 hover:underline">예약에 담기 <ArrowRight className="ml-1 h-3 w-3" /></Link>}
                </div>
              </article>)}
            </div>
            {bookable && isSeller && <Link href={directBookingHref} className="mt-3 inline-flex min-h-10 items-center text-sm font-bold text-brand-800 hover:underline">예약 화면에서 전체 상품 선택 <ArrowRight className="ml-1 h-4 w-4" /></Link>}
          </>}
        </section>}

        {/* 퀵 예약 */}
        {bookable && <section id="store-booking" className="mt-5 scroll-mt-6 overflow-hidden rounded-[26px] border border-[#E9DFC5] bg-white shadow-[0_10px_30px_rgba(26,26,46,0.08)]">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="min-w-0 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="break-keep text-2xl font-black text-navy">예약 시간 선택</h2>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">창고(스튜디오)와 시간이 미리 선택된 예약 신청서로 바로 연결됩니다.</p>
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7D6] text-brand-700">
                  <CalendarDays className="h-6 w-6" />
                </span>
              </div>

              {slotCount > 0 && (
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-black text-navy">빠른 시간 선택</p>
                    <p className="text-[11px] font-bold text-slate-400">날짜는 신청서에서 선택</p>
                  </div>
                  <div className="grid gap-2">
                    {f.slots.slice(0, 3).map((slot: any) => (
                      <Link key={slot.id} href={bookingHrefForSlot(slot)} className="group flex items-center justify-between rounded-xl border border-[#E8E4DA] bg-[#FCFBF7] px-3 py-3 transition hover:border-brand-400 hover:bg-brand-50">
                        <div>
                          <p className="text-[11px] font-black text-brand-700">{WEEK[slot.weekday]}요일</p>
                          <p className="mt-0.5 text-xs font-black text-navy">{slot.startTime}–{slot.endTime}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-col justify-between bg-[#171B30] p-5 text-white sm:p-6">
              <div>
                <p className="text-xs font-bold text-white/55">창고(스튜디오) 이용료</p>
                <p className="mt-2 text-3xl font-black text-[#FFD552]">무료</p>
                <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                  <p className="flex items-center gap-2 text-xs font-bold text-white/75">
                    <Clock3 className="h-4 w-4 text-[#FFD552]" /> 운영 {f.openTime ?? "09:00"}–{f.closeTime ?? "22:00"}
                  </p>
                  <p className="flex items-center gap-2 text-xs font-bold text-white/75">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 예약 후 진행 상태 확인
                  </p>
                  <p className="flex items-center gap-2 text-xs font-bold text-white/75">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" /> 스토리지마켓 안전 예약
                  </p>
                </div>
              </div>
              <Link href={bookingHref} className="mt-7 flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#FFD552] px-4 py-3.5 text-sm font-black text-navy transition hover:-translate-y-0.5 hover:bg-brand-300">
                <CalendarDays className="h-4 w-4" />{bookingLabel}<ArrowRight className="h-4 w-4" />
              </Link>
              {!isSeller && (
                <p className="mt-3 text-center text-[11px] font-medium text-white/45">
                  예약 신청은 셀러 계정으로 진행할 수 있습니다.
                </p>
              )}
            </div>
          </div>
        </section>}

        {/* 페이지 내비 */}
        <div className="mt-5 space-y-5">
          {/* 주요 취급 카테고리 */}
          <section id="store-specialty" className="scroll-mt-36 rounded-[24px] border border-[#EEEAE0] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-700">Specialty</p>
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
                          <p className="text-[11px] text-slate-400">전문 취급</p>
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
          {pageConfig.showSchedule && bookable && (
            <section id="store-schedule" className="scroll-mt-36 rounded-[24px] border border-[#EEEAE0] bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-700">Booking schedule</p>
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
                        <p className="text-xs font-black text-emerald-700">무료</p>
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

          {/* 창고(스튜디오) 정보 */}
          <section id="store-info" className="scroll-mt-36 rounded-[24px] border border-[#EEEAE0] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-700">Facility guide</p>
              <h2 className="mt-1 text-xl font-black text-navy">창고(스튜디오) 정보</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: isWarehouse ? Warehouse : Camera, label: "창고(스튜디오) 유형", value: isWarehouse ? "물류 창고" : "라이브 스튜디오" },
                { icon: MapPin, label: "위치", value: f.address ?? f.region },
                { icon: Clock3, label: "운영 시간", value: `${f.openTime ?? "09:00"} – ${f.closeTime ?? "22:00"}` },
                { icon: Store, label: "이용료", value: "무료" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-[#F8F9FB] p-4">
                  <item.icon className="h-5 w-5 text-brand-600" />
                  <p className="mt-3 text-[11px] font-bold text-slate-400">{item.label}</p>
                  <p className="mt-1 text-sm font-black leading-snug text-navy">{item.value}</p>
                </div>
              ))}
            </div>

            {pageConfig.showEquipment && equipment.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-navy">
                  <Boxes className="h-4 w-4 text-brand-600" /> 제공 창고(스튜디오)·장비
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
                { icon: Wifi, text: "창고(스튜디오) 연결 지원" },
                { icon: CheckCircle2, text: "마케팅 지원 연동" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <item.icon className="h-4 w-4 text-emerald-500" />{item.text}
                </div>
              ))}
            </div>
          </section>

          {/* 리뷰 섹션 */}
          <section id="store-reviews" className="scroll-mt-36 rounded-[24px] border border-[#EEEAE0] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-700">Reviews</p>
                <h2 className="mt-1 text-xl font-black text-navy">이용 셀러 리뷰 <span className="text-brand-700">{reviews.length}</span></h2>
                <p className="mt-1 text-xs text-slate-400">실제로 이용을 마친 셀러만 남길 수 있는 리뷰입니다</p>
              </div>
              <div className="text-right">
                <p className="flex items-center gap-1 text-2xl font-black text-navy"><Star className="h-6 w-6 fill-brand-500 text-brand-500" />{Number(f.rating ?? 0).toFixed(1)}</p>
              </div>
            </div>
            {reviews.length === 0 ? (
              <p className="rounded-2xl bg-[#FBF8EE] py-8 text-center text-sm text-slate-400">아직 리뷰가 없습니다. 첫 이용 셀러가 되어보세요!</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-[#F0ECE3] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-brand-700">{"★".repeat(r.rating)}<span className="text-slate-300">{"★".repeat(5 - r.rating)}</span></span>
                      <span className="text-[11px] text-slate-400">{r.author} · {new Date(r.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{r.content}</p>
                    {r.reply && <p className="mt-2 rounded-xl bg-[#FBF8EE] px-3 py-2 text-xs text-slate-600"><b className="text-navy">사장님 답글</b> · {r.reply}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 문의 섹션 */}
          <section id="store-inquiry" className="scroll-mt-36 rounded-[24px] border border-[#EEEAE0] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-700">Inquiry</p>
                <h2 className="mt-1 text-xl font-black text-navy">창고(스튜디오)에 문의하기</h2>
                <p className="mt-1 text-xs text-slate-400">예약 가능 여부, 창고(스튜디오) 상태, 특별 요청 등을 문의해보세요</p>
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
            <ChevronLeft className="h-4 w-4" /> 다른 창고(스튜디오) 둘러보기
          </Link>
        </div>
      </main>

    </ShopShell>
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
