import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { FavoriteButton } from "@/components/booking/favorite-button";
import { BOOKING_STATUS } from "@/lib/status";
import { formatDateTime, formatKRW } from "@/lib/utils";
import { addDays, addMonths, hhmm, parseMonth } from "@/lib/kst";
import { sp, withParams, type SP } from "@/lib/list";
import { cn } from "@/lib/utils";
import { CalendarDays, Heart, MessageSquare, Star, MapPin, Clock, CalendarPlus } from "lucide-react";

export const dynamic = "force-dynamic";
const BASE = "/seller/farm-reservations";
const TABS = [
  { key: "calendar", label: "예약 캘린더", icon: CalendarDays },
  { key: "favorites", label: "찜한 창고(스튜디오)", icon: Heart },
  { key: "inquiries", label: "문의 내역", icon: MessageSquare },
] as const;

export default async function SellerReservationOverview({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SELLER"]);
  const tab = (TABS.find((t) => t.key === sp(searchParams, "tab"))?.key ?? "calendar") as (typeof TABS)[number]["key"];
  const month = parseMonth(sp(searchParams, "month"));

  const [monthBookings, next7, favorites, inquiries, unreadReplies] = await Promise.all([
    tab === "calendar" ? prisma.booking.findMany({
      where: { sellerId: user.id, startAt: { gte: month, lt: addMonths(month, 1) } },
      include: { facility: { select: { name: true } } }, orderBy: { startAt: "asc" },
    }) : Promise.resolve([]),
    prisma.booking.findMany({
      where: { sellerId: user.id, status: { in: ["APPROVED", "PENDING"] }, startAt: { gte: new Date(), lt: addDays(new Date(), 7) } },
      include: { facility: { select: { name: true, address: true } } }, orderBy: { startAt: "asc" },
    }),
    tab === "favorites" ? prisma.facilityFavorite.findMany({
      where: { userId: user.id }, orderBy: { createdAt: "desc" },
      include: { facility: { include: { _count: { select: { reviews: true } } } } },
    }) : Promise.resolve([]),
    tab === "inquiries" ? prisma.facilityInquiry.findMany({
      where: { sellerId: user.id }, orderBy: { createdAt: "desc" }, take: 50, include: { facility: { select: { id: true, name: true } } },
    }) : Promise.resolve([]),
    prisma.facilityInquiry.count({ where: { sellerId: user.id, reply: { not: null }, repliedAt: { gte: addDays(new Date(), -7) } } }),
  ]);


  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="창고(스튜디오) 예약 현황" description="월간 일정, 자주 찾는 창고(스튜디오), 보낸 문의를 한눈에 확인하세요."
        action={<Link href="/seller/bookings/new"><Button><CalendarPlus className="h-4 w-4" />예약 신청</Button></Link>} />

      <div className="flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <Link key={t.key} href={withParams(BASE, {}, { tab: t.key === "calendar" ? undefined : t.key })}
            className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold", tab === t.key ? "border-navy bg-navy text-white" : "border-[#E5E0D6] bg-white text-slate-600")}>
            <t.icon className="h-4 w-4" />{t.label}
            {t.key === "inquiries" && unreadReplies > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[11px] text-white">{unreadReplies}</span>}
          </Link>
        ))}
      </div>

      {tab === "calendar" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div className="space-y-2">
            <MonthCalendar month={month} base={BASE} params={searchParams}
              events={monthBookings.map((b) => ({ id: b.id, start: b.startAt, end: b.endAt, label: b.facility.name, tone: BOOKING_STATUS[b.status]?.tone, href: `/seller/bookings?q=${encodeURIComponent(b.facility.name)}` }))} />
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {Object.entries(BOOKING_STATUS).map(([k, v]) => <span key={k} className="flex items-center gap-1"><Badge tone={v.tone}>{v.label}</Badge></span>)}
              <span className="ml-auto font-semibold text-navy">이 달 확정 {monthBookings.filter((b) => ["APPROVED", "COMPLETED"].includes(b.status)).length}건 · 이용료 무료</span>
            </div>
          </div>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-brand-500" />7일 이내 일정</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {next7.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">7일 안에 잡힌 예약이 없습니다.</p> : next7.map((b) => (
                <div key={b.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2"><Badge tone={BOOKING_STATUS[b.status].tone}>{BOOKING_STATUS[b.status].label}</Badge><span className="truncate text-sm font-bold text-navy">{b.facility.name}</span></div>
                  <p className="mt-1 text-xs text-slate-600">{formatDateTime(b.startAt)} ~ {hhmm(b.endAt)}</p>
                  <p className="text-[11px] text-muted-foreground">{b.facility.address}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "favorites" && (favorites.length === 0 ? (
        <EmptyState icon={<Heart className="h-10 w-10" />} title="찜한 창고(스튜디오)가 없습니다" description="창고(스튜디오) 상세 화면에서 하트를 눌러 자주 쓰는 곳을 모아두세요."
          action={<Link href="/facilities"><Button variant="outline">창고(스튜디오) 둘러보기</Button></Link>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {favorites.map(({ facility: f }) => (
            <Card key={f.id} className="overflow-hidden">
              <div className="relative h-36 bg-gradient-to-br from-navy to-[#2a3352]">
                {f.thumbnailUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.thumbnailUrl} alt={f.name} className="h-full w-full object-cover opacity-90" />}
                <div className="absolute right-3 top-3"><FavoriteButton facilityId={f.id} initial /></div>
                <Badge tone={f.type === "STUDIO" ? "purple" : "blue"} className="absolute left-3 top-3">{f.type === "STUDIO" ? "스튜디오" : "창고"}</Badge>
              </div>
              <CardContent className="space-y-2 pt-4">
                <Link href={`/facilities/${f.id}`} className="block truncate text-base font-bold text-navy hover:underline">{f.name}</Link>
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{f.region} · {f.address}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-xs"><Star className="h-3.5 w-3.5 fill-brand-500 text-brand-500" />{f.rating.toFixed(1)} <span className="text-muted-foreground">({f._count.reviews})</span></span>
                  <span className="text-sm font-bold text-emerald-700">이용료 무료</span>
                </div>
                {f.status !== "APPROVED" ? <p className="text-xs font-semibold text-red-500">현재 예약을 받지 않는 곳입니다.</p> : (
                  <Link href={`/seller/bookings/new?facilityId=${f.id}`}><Button className="mt-1 w-full" size="sm">바로 예약</Button></Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      {tab === "inquiries" && (inquiries.length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-10 w-10" />} title="보낸 문의가 없습니다" description="창고(스튜디오) 상세 화면에서 궁금한 점을 문의할 수 있습니다." />
      ) : (
        <div className="space-y-3">
          {inquiries.map((iq) => (
            <Card key={iq.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={iq.reply ? "green" : "yellow"}>{iq.reply ? "답변 완료" : "답변 대기"}</Badge>
                  <Link href={`/facilities/${iq.facility.id}`} className="text-sm font-bold text-navy hover:underline">{iq.facility.name}</Link>
                  <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(iq.createdAt)}</span>
                </div>
                <p className="whitespace-pre-line text-sm text-slate-700">{iq.message}</p>
                {iq.reply && (
                  <div className="rounded-xl bg-brand-50/60 p-3 text-sm">
                    <p className="mb-1 text-xs font-bold text-brand-700">답변 · {iq.repliedAt ? formatDateTime(iq.repliedAt) : ""}</p>
                    <p className="whitespace-pre-line text-slate-700">{iq.reply}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}
