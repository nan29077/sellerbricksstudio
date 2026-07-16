import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatKRW } from "@/lib/utils";
import {
  Star, MapPin, Clock, Package, ChevronLeft,
  Warehouse, Video, Wifi, Zap, ShieldCheck,
  Calendar, Users, TrendingUp, CheckCircle2, Tag,
  Info, Camera, Thermometer,
} from "lucide-react";

export const dynamic = "force-dynamic";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

const DUMMY_FACILITY = {
  id: "d1",
  name: "강남 프리미엄 라이브 스튜디오",
  type: "STUDIO",
  status: "APPROVED",
  region: "서울 강남구",
  address: "서울 강남구 테헤란로 123 8층",
  description: `국내 최고 수준의 라이브 커머스 전용 스튜디오입니다.

전문 방송 장비와 완벽한 조명 시스템을 갖추고 있어 셀러가 방송에만 집중할 수 있는 환경을 제공합니다.
그린스크린 배경 교체, 다채널 카메라, 고속 인터넷(1Gbps)이 기본 제공됩니다.

방송 중 스태프 1인 상시 대기하며 기술적 지원을 드립니다.`,
  equipment: "전문 카메라 3대, LED 조명 시스템, 그린스크린, 고속 인터넷 1Gbps, 음향장비, 모니터 4대",
  openTime: "09:00",
  closeTime: "22:00",
  basePrice: 150000,
  rating: 4.9,
  thumbnailUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80&auto=format&fit=crop",
  images: [
    { id: "i1", url: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800&q=70&auto=format&fit=crop", sortOrder: 1 },
    { id: "i2", url: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=70&auto=format&fit=crop", sortOrder: 2 },
    { id: "i3", url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=70&auto=format&fit=crop", sortOrder: 3 },
  ],
  slots: [
    { id: "s1", weekday: 1, startTime: "09:00", endTime: "13:00", price: 150000, isActive: true },
    { id: "s2", weekday: 1, startTime: "14:00", endTime: "18:00", price: 150000, isActive: true },
    { id: "s3", weekday: 2, startTime: "09:00", endTime: "13:00", price: 150000, isActive: true },
    { id: "s4", weekday: 5, startTime: "10:00", endTime: "22:00", price: 130000, isActive: true },
    { id: "s5", weekday: 6, startTime: "10:00", endTime: "22:00", price: 130000, isActive: true },
  ],
  products: [
    { id: "fp1", isSellable: true, salePrice: 45000, consumerPrice: 65000, stock: 200, commissionType: "PERCENT", commissionValue: 15, product: { id: "p1", name: "퀄리티 뷰티 세럼 A", category: "뷰티", description: "피부 탄력 개선 세럼", thumbnailUrl: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=300&q=70" } },
    { id: "fp2", isSellable: true, salePrice: 28000, consumerPrice: 42000, stock: 350, commissionType: "PERCENT", commissionValue: 12, product: { id: "p2", name: "선크림 SPF50+ PA++++", category: "뷰티", description: "자외선 차단 선크림", thumbnailUrl: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=300&q=70" } },
    { id: "fp3", isSellable: true, salePrice: 89000, consumerPrice: 120000, stock: 80, commissionType: "PERCENT", commissionValue: 18, product: { id: "p3", name: "홍삼 진액 선물세트", category: "건강식품", description: "6년근 고려 홍삼 진액", thumbnailUrl: "https://images.unsplash.com/photo-1553909489-cd47e0907980?w=300&q=70" } },
    { id: "fp4", isSellable: true, salePrice: 35000, consumerPrice: 52000, stock: 150, commissionType: "PERCENT", commissionValue: 14, product: { id: "p4", name: "캐시미어 니트 가디건", category: "패션", description: "소프트 캐시미어 혼방 가디건", thumbnailUrl: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=300&q=70" } },
    { id: "fp5", isSellable: true, salePrice: 12000, consumerPrice: 18000, stock: 500, commissionType: "PERCENT", commissionValue: 10, product: { id: "p5", name: "제주 감귤 2kg 박스", category: "식품", description: "신선한 제주 감귤", thumbnailUrl: "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=300&q=70" } },
    { id: "fp6", isSellable: true, salePrice: 199000, consumerPrice: 280000, stock: 30, commissionType: "PERCENT", commissionValue: 20, product: { id: "p6", name: "에어프라이어 5.5L", category: "주방용품", description: "대용량 스마트 에어프라이어", thumbnailUrl: "https://images.unsplash.com/photo-1585515320310-259814833e62?w=300&q=70" } },
  ],
};

export default async function FacilityDetail({ params }: { params: { id: string } }) {
  let f: any = null;
  let user = null;

  try {
    [f, user] = await Promise.all([
      prisma.facility.findUnique({
        where: { id: params.id },
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          slots: { where: { isActive: true }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
          products: {
            where: { isSellable: true },
            include: { product: { include: { images: { take: 1 } } } },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      getSessionUser(),
    ]);
  } catch {
    /* DB 없을 때 dummy 사용 */
  }

  if (!f) {
    // params.id가 dummy id가 아니면 notFound()
    // demo 환경에서는 더미 데이터 사용
    f = { ...DUMMY_FACILITY, id: params.id };
  } else if (f.status !== "APPROVED") {
    notFound();
  }

  const bookHref = !user ? "/login" : user.role === "SELLER" ? `/seller/bookings/new?facilityId=${f.id}` : `/login`;
  const mainImage = f.thumbnailUrl ?? f.images?.[0]?.url ?? "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80";
  const subImages = f.images?.slice(0, 3) ?? [];
  const equipmentList = f.equipment ? f.equipment.split(",").map((e: string) => e.trim()).filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back nav */}
      <div className="bg-white border-b border-border">
        <div className="container py-3">
          <Link href="/facilities" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy transition">
            <ChevronLeft className="h-4 w-4" /> 시설 목록으로
          </Link>
        </div>
      </div>

      {/* Gallery */}
      <div className="bg-black">
        <div className="container py-4">
          <div className="grid grid-cols-3 gap-2 rounded-xl overflow-hidden max-h-[480px]">
            {/* Main large image */}
            <div className="col-span-2 row-span-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mainImage} alt={f.name} className="w-full h-full object-cover" style={{ maxHeight: 480 }} />
            </div>
            {/* Sub images */}
            {subImages.slice(0, 2).map((img: any, i: number) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={img.id ?? i} src={img.url} alt="" className="w-full h-full object-cover" style={{ maxHeight: 236 }} />
            ))}
            {subImages.length < 2 && (
              <div className="bg-gray-800 flex items-center justify-center" style={{ maxHeight: 236 }}>
                <Camera className="h-8 w-8 text-gray-600" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-8">
        <div className="grid lg:grid-cols-3 gap-8">

          {/* LEFT: Info + Products + Slots */}
          <div className="lg:col-span-2 space-y-6">

            {/* Basic Info */}
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge tone={f.type === "WAREHOUSE" ? "blue" : "purple"}>
                        {f.type === "WAREHOUSE" ? "창고" : "스튜디오"}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                        <span className="text-sm font-bold text-navy">{(f.rating ?? 0).toFixed(1)}</span>
                        {f.reviewCount > 0 && <span className="text-sm text-muted-foreground">({f.reviewCount}개 리뷰)</span>}
                      </div>
                    </div>
                    <h1 className="text-2xl font-extrabold text-navy">{f.name}</h1>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-4 w-4 shrink-0" /> {f.address ?? f.region}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">기본 요금</p>
                    <p className="text-2xl font-extrabold text-brand-600">{formatKRW(f.basePrice)}</p>
                    <p className="text-xs text-muted-foreground">/시간</p>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <Clock className="h-5 w-5 mx-auto text-brand-500 mb-1" />
                    <p className="text-xs text-muted-foreground">운영 시간</p>
                    <p className="text-sm font-bold text-navy">{f.openTime ?? "09:00"} ~ {f.closeTime ?? "22:00"}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <Package className="h-5 w-5 mx-auto text-brand-500 mb-1" />
                    <p className="text-xs text-muted-foreground">판매 상품</p>
                    <p className="text-sm font-bold text-navy">{f.products?.length ?? 0}개</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <Calendar className="h-5 w-5 mx-auto text-brand-500 mb-1" />
                    <p className="text-xs text-muted-foreground">예약 슬롯</p>
                    <p className="text-sm font-bold text-navy">{f.slots?.length ?? 0}개</p>
                  </div>
                </div>

                {/* Description */}
                {f.description && (
                  <div>
                    <h2 className="flex items-center gap-2 font-bold text-navy mb-2">
                      <Info className="h-4 w-4 text-brand-500" /> 시설 소개
                    </h2>
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{f.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Equipment */}
            {equipmentList.length > 0 && (
              <Card>
                <CardContent className="pt-5 pb-5">
                  <h2 className="flex items-center gap-2 font-bold text-navy mb-4">
                    {f.type === "WAREHOUSE" ? <Thermometer className="h-4 w-4 text-blue-500" /> : <Camera className="h-4 w-4 text-purple-500" />}
                    {f.type === "WAREHOUSE" ? "창고 설비" : "방송 장비"}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {equipmentList.map((eq: string) => (
                      <div key={eq} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="text-xs font-medium text-navy">{eq}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Available Slots */}
            {f.slots && f.slots.length > 0 && (
              <Card>
                <CardContent className="pt-5 pb-5">
                  <h2 className="flex items-center gap-2 font-bold text-navy mb-4">
                    <Clock className="h-4 w-4 text-brand-500" /> 이용 가능 시간대
                  </h2>
                  <div className="space-y-2">
                    {f.slots.map((slot: any) => (
                      <div key={slot.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:border-brand-200 hover:bg-brand-50/30 transition">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 shrink-0">
                          <span className="text-xs font-bold text-brand-700">{WEEK[slot.weekday]}</span>
                        </div>
                        <div className="flex-1">
                          <span className="text-sm text-navy">{slot.startTime} ~ {slot.endTime}</span>
                        </div>
                        <span className="text-sm font-bold text-brand-600 shrink-0">
                          {formatKRW(slot.price ?? f.basePrice)}/시간
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Products Section */}
            {f.products && f.products.length > 0 && (
              <Card>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="flex items-center gap-2 font-bold text-navy">
                      <Package className="h-4 w-4 text-brand-500" />
                      판매 가능 상품 ({f.products.length}개)
                    </h2>
                    <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                      방송 시 판매 가능한 상품 목록
                    </span>
                  </div>

                  {/* Product grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {f.products.map((fp: any) => {
                      const p = fp.product;
                      const thumbUrl = p?.thumbnailUrl ?? p?.images?.[0]?.url;
                      const discountPct = fp.consumerPrice > 0
                        ? Math.round((1 - fp.salePrice / fp.consumerPrice) * 100)
                        : 0;
                      return (
                        <div key={fp.id} className="rounded-xl border border-border overflow-hidden hover:shadow-md transition group">
                          <div className="aspect-square bg-muted overflow-hidden relative">
                            {thumbUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumbUrl} alt={p?.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground/30" />
                              </div>
                            )}
                            {discountPct > 0 && (
                              <div className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                -{discountPct}%
                              </div>
                            )}
                            {fp.stock <= 20 && (
                              <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                품절임박
                              </div>
                            )}
                          </div>
                          <div className="p-2.5">
                            <p className="text-xs text-muted-foreground mb-0.5">{p?.category}</p>
                            <p className="text-xs font-semibold text-navy line-clamp-2 mb-1.5">{p?.name}</p>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Tag className="h-3 w-3 text-brand-500 shrink-0" />
                                <span className="text-sm font-bold text-brand-700">{formatKRW(fp.salePrice)}</span>
                              </div>
                              {fp.consumerPrice > fp.salePrice && (
                                <p className="text-[10px] text-muted-foreground line-through pl-4">{formatKRW(fp.consumerPrice)}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground pl-4">재고 {fp.stock}개</p>
                            </div>
                            <div className="mt-1.5 text-[10px] text-purple-600 bg-purple-50 rounded px-1.5 py-0.5 inline-block">
                              커미션 {fp.commissionValue}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-xl bg-brand-50 border border-brand-100 p-3">
                    <p className="text-xs text-brand-700 font-semibold flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      이 시설의 상품으로 라이브 방송 시 커미션 수익을 추가로 얻을 수 있습니다.
                    </p>
                    <p className="text-[11px] text-brand-600/70 mt-0.5 pl-5">
                      예약 후 라이브 세션에서 원하는 상품을 선택해 판매하세요.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>

          {/* RIGHT: Booking Sidebar */}
          <div className="lg:sticky lg:top-24 h-fit space-y-4">
            <Card className="shadow-lg border-brand-100">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">기본 요금 (1시간)</p>
                    <p className="text-2xl font-extrabold text-navy">{formatKRW(f.basePrice)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                    <span className="font-bold text-navy">{(f.rating ?? 0).toFixed(1)}</span>
                  </div>
                </div>

                {/* Features list */}
                <div className="space-y-2 mb-5">
                  {[
                    { icon: f.type === "WAREHOUSE" ? Warehouse : Video, text: f.type === "WAREHOUSE" ? "물류 창고" : "라이브 스튜디오" },
                    { icon: MapPin,    text: f.region },
                    { icon: Clock,    text: `${f.openTime ?? "09:00"} ~ ${f.closeTime ?? "22:00"} 운영` },
                    { icon: Users,    text: "예약 후 즉시 이용 가능" },
                    { icon: Package,  text: `${f.products?.length ?? 0}개 상품 판매 연동` },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <item.icon className="h-4 w-4 text-brand-400 shrink-0" />
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>

                {user ? (
                  <>
                    {user.role === "SELLER" ? (
                      <>
                        <Link href={bookHref}>
                          <Button className="w-full font-bold" size="lg">
                            <Calendar className="h-5 w-5 mr-2" />예약 신청하기
                          </Button>
                        </Link>
                        <p className="text-center text-xs text-muted-foreground mt-3">
                          예약 신청 후 시설 운영자 승인이 필요합니다
                        </p>
                      </>
                    ) : (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
                        <p className="text-xs text-amber-800 font-semibold">셀러 계정으로만 예약 가능합니다</p>
                        <Link href="/register?role=SELLER">
                          <Button variant="outline" size="sm" className="mt-2 border-amber-300">셀러로 가입하기</Button>
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Link href="/login">
                      <Button className="w-full font-bold" size="lg">
                        <Zap className="h-5 w-5 mr-2" />로그인 후 예약하기
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button variant="outline" className="w-full mt-2">무료 가입하기</Button>
                    </Link>
                    <p className="text-center text-xs text-muted-foreground mt-2">
                      셀러 계정으로 가입하면 바로 예약할 수 있습니다
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Trust badges */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="space-y-2.5">
                  {[
                    { icon: ShieldCheck, text: "안전한 결제 보장" },
                    { icon: CheckCircle2, text: "예약 취소 가능" },
                    { icon: Wifi, text: "고속 인터넷 제공" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <item.icon className="h-4 w-4 text-emerald-500 shrink-0" />
                      {item.text}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* CTA back to list */}
            <Link href="/facilities">
              <Button variant="outline" className="w-full">
                다른 시설 찾아보기
              </Button>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
