import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { operableFacilityIds } from "@/lib/facility-owner";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { FacilityProfileEdit } from "@/components/facility/facility-profile-edit";

import { FACILITY_OPERATION_LABEL, FACILITY_STATUS_LABEL, FACILITY_TYPE_LABEL } from "@/lib/status";
import {
  MapPin, Clock, Wallet, Star, CalendarCheck, TrendingUp,
  Building2, Tag, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { ResourceForm, type Field } from "@/components/resource-form";

const OPS_FIELDS: Field[] = [
  { name: "minHours", label: "최소 예약 시간", type: "number", min: 1, max: 24, half: true },
  { name: "openTime", label: "오픈 시간", type: "time", half: true },
  { name: "closeTime", label: "마감 시간", type: "time", half: true },
  { name: "capacity", label: "최대 수용 인원", type: "number", min: 1, half: true },
  { name: "contactPhone", label: "현장 연락처", half: true, help: "승인된 예약의 셀러에게만 보여요." },
  { name: "region", label: "지역", half: true },
  { name: "address", label: "주소", half: true },
  { name: "equipment", label: "보유 장비", type: "textarea", help: "콤마로 구분: 4K 카메라, 링라이트, 그린스크린" },
  { name: "thumbnailUrl", label: "대표 이미지 URL", type: "url" },
  { name: "cancelPolicy", label: "취소·환불 규정", type: "textarea", help: "셀러가 예약할 때 동의해야 하는 규정입니다." },
];
// 예약 정책 — 셀러 예약 화면의 시작 시간 · 이용 시간 · 확정 방식에 바로 반영된다. (이용료는 무료)
const POLICY_FIELDS: Field[] = [
  { name: "autoApprove", label: "즉시 확정 (승인 없이 바로 예약 확정)", type: "checkbox", help: "끄면 예약마다 승인/거절을 직접 처리합니다." },
  { name: "bookingUnitMinutes", label: "예약 시작 단위", type: "select", half: true, options: [{ value: "60", label: "정시 (1시간)" }, { value: "30", label: "30분" }] },
  { name: "bufferMinutes", label: "예약 사이 준비시간(분)", type: "number", min: 0, max: 240, half: true, help: "세팅·정리를 위해 예약 사이에 비워둘 시간" },
  { name: "minHours", label: "최소 이용 시간", type: "number", min: 1, max: 24, half: true },
  { name: "maxHours", label: "최대 이용 시간", type: "number", min: 1, max: 24, half: true },
  { name: "minLeadHours", label: "최소 몇 시간 전 예약", type: "number", min: 0, max: 336, half: true, help: "0 = 바로 예약 가능" },
  { name: "maxAdvanceDays", label: "최대 며칠 앞까지 예약", type: "number", min: 1, max: 365, half: true },
  { name: "cancelDeadlineHours", label: "셀러 직접 변경·취소 마감(시간 전)", type: "number", min: 0, max: 336, help: "승인된 예약은 이용 시작 이 시간 전까지만 셀러가 직접 변경·취소할 수 있습니다." },
  { name: "bookingNotice", label: "예약 안내사항", type: "textarea", help: "예약 화면에 표시됩니다. 예: 상품 입고는 방송 하루 전까지, 주차 2대 가능" },
];
const BANK_FIELDS: Field[] = [
  { name: "bankName", label: "은행", half: true, placeholder: "국민은행" },
  { name: "accountHolder", label: "예금주", half: true },
  { name: "bankAccount", label: "계좌번호", placeholder: "- 없이 숫자만" },
];
// 운영 형태 · 제휴 정보 (최고관리자만)
const OPERATION_FIELDS: Field[] = [
  { name: "name", label: "공간 이름", half: true },
  { name: "type", label: "공간 유형", type: "select", half: true, options: [{ value: "STUDIO", label: "스튜디오" }, { value: "WAREHOUSE", label: "창고" }, { value: "SHOWROOM", label: "쇼룸" }] },
  { name: "operationType", label: "운영 형태", type: "select", options: [{ value: "DIRECT", label: "직영 (판매 몫은 본사 수입)" }, { value: "PARTNER", label: "제휴 (판매 몫을 계좌로 지급)" }] },
  { name: "partnerName", label: "제휴 업체명", half: true },
  { name: "partnerContactName", label: "제휴 담당자", half: true },
  { name: "partnerContactPhone", label: "담당자 연락처", half: true },
  { name: "partnerContactEmail", label: "담당자 메일", half: true, help: "제휴 창고에 메일을 넣으면 새 예약 · 출고할 주문 알림을 메일로도 보냅니다. (계정 없음)" },
];
function maskAccount(v?: string | null) {
  if (!v) return "미등록";
  return v.length <= 4 ? v : `${"*".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}`;
}

export const dynamic = "force-dynamic";

export default async function FacilityProfile() {
  const user = await requireRole(["SUPER_ADMIN", "MANAGER"]);
  const admin = user.role === "SUPER_ADMIN";

  let facilities: any[] = [];
  try {
    const ids = await operableFacilityIds(user);
    facilities = await prisma.facility.findMany({
      where: { id: { in: ids } },
      include: {
        _count: { select: { bookings: true } },
        slots: { select: { id: true } },
      },
    });
  } catch {
    // DB 연결 실패 시 빈 배열
  }

  if (facilities.length === 0) {
    return (
      <div>
        <PageHeader title="공간 정보 · 편집" description="운영하는 공간의 정보와 예약 정책을 관리합니다." />
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title={admin ? "등록된 공간이 없습니다" : "담당 공간이 없습니다"}
          description={admin ? "직영 · 제휴 공간을 등록하세요." : "최고관리자가 담당 공간을 지정하면 여기서 관리할 수 있습니다."}
          action={admin ? <Link href="/facility/register" className="inline-flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-navy hover:bg-brand-600">공간 등록하기</Link> : undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader
        title="공간 정보 · 편집"
        description="운영하는 공간의 정보와 예약 정책을 관리합니다."
        action={admin ? <Link href="/facility/register" className="inline-flex h-10 items-center rounded-lg border border-brand-300 bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50">+ 공간 등록</Link> : undefined}
      />

      {facilities.map((f: any) => {
        const specialties = f.specialty
          ? f.specialty.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [];

        return (
          <div key={f.id} className="space-y-4">
            {/* 메인 정보 카드 */}
            <Card>
              <CardContent className="pt-5">
                {/* 대표 이미지 */}
                {f.thumbnailUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={f.thumbnailUrl} alt={f.name} className="w-full h-52 object-cover rounded-2xl mb-5" />
                )}

                {/* 상태 + 이름 */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge tone={f.status === "APPROVED" ? "green" : f.status === "SUSPENDED" ? "red" : "yellow"}>
                        {FACILITY_STATUS_LABEL[f.status as keyof typeof FACILITY_STATUS_LABEL] ?? f.status}
                      </Badge>
                      <Badge tone={f.operationType === "PARTNER" ? "purple" : "navy"}>{FACILITY_OPERATION_LABEL[f.operationType as keyof typeof FACILITY_OPERATION_LABEL] ?? "직영"}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {FACILITY_TYPE_LABEL[f.type as keyof typeof FACILITY_TYPE_LABEL] ?? "창고"}
                      </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-navy">{f.name}</h2>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {f.address ?? f.region}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                      <span className="font-bold text-navy">
                        {typeof f.rating === "number" ? f.rating.toFixed(1) : "-"}
                      </span>
                    </div>
                    {f.status === "APPROVED" && (
                      <Link
                        href={`/facilities/${f.id}`}
                        target="_blank"
                        className="hit flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                      >
                        공간 페이지 보기 <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* 운영 통계 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    {
                      label: "예약 방식",
                      value: f.autoApprove ? "즉시 확정" : "승인 후 확정",
                      icon: Wallet,
                    },
                    {
                      label: "총 예약 건수",
                      value: `${f._count?.bookings ?? 0}건`,
                      icon: CalendarCheck,
                    },
                    {
                      label: "평점",
                      value: `★ ${(f.rating ?? 0).toFixed(1)}`,
                      icon: Star,
                    },
                    {
                      label: "전문 분야 수",
                      value: `${specialties.length}개`,
                      icon: Tag,
                    },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-muted/40 p-3 text-center">
                      <s.icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="font-bold text-navy text-sm">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* 운영 정보 */}
                <div className="mb-3 grid gap-2 rounded-xl border border-border p-3 text-sm sm:grid-cols-2">
                  <p className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4 shrink-0" />운영 {f.openTime ?? "09:00"} ~ {f.closeTime ?? "22:00"} · {f.minHours ?? 1}~{f.maxHours ?? 12}시간 · 이용료 무료</p>
                  <p className="text-muted-foreground sm:col-span-2">예약 정책: {f.autoApprove ? "즉시 확정" : "승인 후 확정"} · {(f.bookingUnitMinutes ?? 60) === 30 ? "30분" : "정시"} 단위 · 준비시간 {f.bufferMinutes ?? 0}분 · {f.minLeadHours ? `${f.minLeadHours}시간 전까지` : "바로"} 예약 · 최대 {f.maxAdvanceDays ?? 60}일 앞 · 변경·취소 {f.cancelDeadlineHours ?? 24}시간 전 마감</p>
                  <p className="text-muted-foreground">수용 인원 {f.capacity ? `${f.capacity}명` : "미입력"} · 연락처 {f.contactPhone ?? "미입력"}</p>
                  <p className="text-muted-foreground sm:col-span-2">취소 규정: {f.cancelPolicy ? <span className="whitespace-pre-line">{f.cancelPolicy}</span> : <span className="font-semibold text-amber-600">미입력 — 분쟁 예방을 위해 입력을 권장합니다</span>}</p>
                  {f.operationType === "PARTNER" ? (
                    <>
                      <p className="text-muted-foreground sm:col-span-2">제휴: {f.partnerName ?? "업체명 미입력"} · 담당 {f.partnerContactName ?? "미입력"} {f.partnerContactPhone ? `· ${f.partnerContactPhone}` : ""} {f.partnerContactEmail ? `· ${f.partnerContactEmail}` : ""}</p>
                      <p className="text-muted-foreground sm:col-span-2">지급 계좌: {f.bankName ?? ""} {maskAccount(f.bankAccount)} {f.accountHolder ? `(${f.accountHolder})` : ""}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground sm:col-span-2">직영 창고 — 판매 몫은 본사 수입으로 집계됩니다 (지급 없음).</p>
                  )}
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <ResourceForm url="/api/facility/profile" method="PATCH" extraBody={{ facilityId: f.id }} fields={OPS_FIELDS} title="운영 정보 수정" triggerSize="sm" triggerVariant="outline"
                      initial={{ minHours: f.minHours ?? 1, openTime: f.openTime ?? "09:00", closeTime: f.closeTime ?? "22:00", capacity: f.capacity ?? "", contactPhone: f.contactPhone ?? "", region: f.region, address: f.address, equipment: f.equipment ?? "", thumbnailUrl: f.thumbnailUrl ?? "", cancelPolicy: f.cancelPolicy ?? "" }} />
                    <ResourceForm url="/api/facility/profile" method="PATCH" extraBody={{ facilityId: f.id }} fields={POLICY_FIELDS} title="예약 정책 설정" triggerSize="sm" triggerVariant="outline"
                      initial={{ autoApprove: !!f.autoApprove, bookingUnitMinutes: String(f.bookingUnitMinutes ?? 60), bufferMinutes: f.bufferMinutes ?? 0, minHours: f.minHours ?? 1, maxHours: f.maxHours ?? 12, minLeadHours: f.minLeadHours ?? 0, maxAdvanceDays: f.maxAdvanceDays ?? 60, cancelDeadlineHours: f.cancelDeadlineHours ?? 24, bookingNotice: f.bookingNotice ?? "" }} />
                    {admin && (
                      <ResourceForm url="/api/facility/profile" method="PATCH" extraBody={{ facilityId: f.id }} fields={OPERATION_FIELDS} title="운영 형태 · 제휴 정보" triggerSize="sm" triggerVariant="outline"
                        initial={{ name: f.name, type: f.type, operationType: f.operationType ?? "DIRECT", partnerName: f.partnerName ?? "", partnerContactName: f.partnerContactName ?? "", partnerContactPhone: f.partnerContactPhone ?? "", partnerContactEmail: f.partnerContactEmail ?? "" }} />
                    )}
                    {admin && f.operationType === "PARTNER" && (
                      <ResourceForm url="/api/facility/profile" method="PATCH" extraBody={{ facilityId: f.id }} fields={BANK_FIELDS} title="제휴 지급 계좌" triggerSize="sm" triggerVariant="outline"
                        initial={{ bankName: f.bankName ?? "", accountHolder: f.accountHolder ?? "", bankAccount: f.bankAccount ?? "" }} />
                    )}
                  </div>
                </div>

                {/* 전문 분야 태그 미리보기 */}
                {specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {specialties.map((s: string) => (
                      <span key={s} className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                        {s} 전문
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 전문 분야 · 라이브 공간 편집 카드 */}
            <FacilityProfileEdit
              facilityId={f.id}
              initialSpecialty={f.specialty ?? ""}
              initialLiveSpaceInfo={f.liveSpaceInfo ?? ""}
              initialDescription={f.description ?? ""}
            />

            {/* 공간 페이지 편집 링크 */}
            <Card className="border-dashed">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-navy">공간 페이지 꾸미기</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      배너, 테마, 소개 문구, 장비 목록 등을 꾸밀 수 있습니다
                    </p>
                  </div>
                  <Link
                    href="/facility/pages"
                    className="flex items-center gap-1 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    페이지 꾸미기
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
