import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getPolicy } from "@/lib/policy";
import { splitLine } from "@/lib/settlement";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { ResourceForm } from "@/components/resource-form";
import { formatKRW } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPolicy() {
  await requireRole(["SUPER_ADMIN"]);
  const [policy, overrides, last] = await Promise.all([
    getPolicy(),
    prisma.brandShop.findMany({ where: { feeRate: { not: null } }, select: { id: true, name: true, feeRate: true }, orderBy: { name: "asc" } }),
    prisma.platformPolicy.findUnique({ where: { id: "default" }, select: { updatedAt: true, updatedBy: true } }).catch(() => null),
  ]);
  // 예시: 판매가 30,000원 · 공급가 18,000원 · 셀러 수수료 10%
  const ex1 = splitLine({ lineTotal: 30000, unitPrice: 30000, quantity: 1, supplyPrice: 18000, facilityCommission: { type: "PERCENT", value: 10 }, sellerBrand: false }, policy);
  const ex2 = splitLine({ lineTotal: 30000, unitPrice: 30000, quantity: 1, supplyPrice: 18000, facilityCommission: null, sellerBrand: true }, policy);
  const brandFee = Math.round(18000 * policy.brandFeeRate / 100);
  const rows: [string, string, string][] = [
    ["판매 수수료", `${policy.salesFeeRate}%`, "구매자 결제금액 기준. 플랫폼이 가져가고 나머지를 브랜드·창고(스튜디오)·셀러에게 나눕니다."],
    ["브랜드 수수료 (기본)", `${policy.brandFeeRate}%`, "브랜드 공급대금 기준. 브랜드샵 관리에서 브랜드별로 따로 정할 수 있습니다."],
    ["유료 샘플 수수료", `${policy.sampleFeeRate}%`, "유료 샘플 결제금액 기준."],
    ["셀러 몫 (셀러가 가져온 직배송 상품)", `${policy.sellerShareRate}%`, "판매가−공급가−판매 수수료 중 셀러 몫. 나머지는 방송한 창고(스튜디오)."],
    ["승인 대기 예약 자동 만료", policy.pendingExpireHours ? `${policy.pendingExpireHours}시간` : "끔", "창고(스튜디오)가 이 시간 안에 승인하지 않으면 자동 거절되고 셀러에게 알립니다."],
    ["노쇼 처리 가능 시점", `시작 ${policy.noShowGraceMinutes}분 후`, "체크인 없이 이 시간이 지나면 창고(스튜디오)가 노쇼로 처리할 수 있습니다."],
    ["이용 완료 자동 처리", policy.autoCompleteBookings ? "켬" : "끔", "종료 시간이 지난 승인 예약을 이용 완료로 바꿉니다."],
    ["이용 전 알림", policy.reminderHoursBefore ? `${policy.reminderHoursBefore}시간 전` : "끔", "셀러와 창고(스튜디오)에게 앱 알림을 보냅니다."],
    ["발주 확인 권장 시간", `${policy.poConfirmHours}시간`, "이 시간이 지나도 확인하지 않은 직배송 발주는 '확인 지연'으로 표시됩니다."],
    ["샘플 주문당 최대 수량", `${policy.sampleMaxPerOrder}개`, "상품별 계정당 신청 한도는 브랜드가 상품마다 정합니다."],
    ["방송 종료 후 주문", policy.orderAfterEndHours ? `${policy.orderAfterEndHours}시간까지` : "종료 즉시 마감", "방송을 종료한 뒤에도 이 시간 동안은 구매자가 주문할 수 있습니다."],
    ["구매 확정 유예", policy.settleAfterDays ? `배송 완료 ${policy.settleAfterDays}일 후` : "배송 완료 즉시", "배송 완료 후 이 기간이 지나야 판매·브랜드 정산 대상이 됩니다. 반품을 받는 기간에 맞춰 보통 7일로 둡니다."],
    ["구매자 정보 보관", `배송 완료 ${policy.piiRetentionDays}일 후 가림`, "이 기간이 지나면 브랜드 발주서 화면과 CSV에서 구매자 연락처·주소를 가립니다."],
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="수수료 · 운영 정책" description="플랫폼 수수료와 예약 · 발주 · 샘플 운영 규칙을 정합니다. 바꾼 값은 다음 계산과 정산서부터 적용됩니다."
        action={<ResourceForm url="/api/admin/policy" method="PUT" title="정책 수정" triggerSize="sm" initial={policy} successMessage="정책을 저장했습니다."
          fields={[
            { name: "salesFeeRate", label: "판매 수수료(%)", type: "number", min: 0, max: 100, half: true, required: true },
            { name: "brandFeeRate", label: "브랜드 수수료 기본값(%)", type: "number", min: 0, max: 100, half: true, required: true },
            { name: "sampleFeeRate", label: "유료 샘플 수수료(%)", type: "number", min: 0, max: 100, half: true, required: true },
            { name: "sellerShareRate", label: "셀러 몫 — 셀러 직배송 상품(%)", type: "number", min: 0, max: 100, half: true, required: true },
            { name: "pendingExpireHours", label: "승인 대기 자동 만료(시간, 0=끔)", type: "number", min: 0, half: true, required: true },
            { name: "noShowGraceMinutes", label: "노쇼 처리 가능(시작 후 분)", type: "number", min: 0, half: true, required: true },
            { name: "reminderHoursBefore", label: "이용 전 알림(시간 전, 0=끔)", type: "number", min: 0, half: true, required: true },
            { name: "poConfirmHours", label: "발주 확인 권장(시간)", type: "number", min: 1, half: true, required: true },
            { name: "sampleMaxPerOrder", label: "샘플 주문당 최대 수량", type: "number", min: 1, half: true, required: true },
            { name: "orderAfterEndHours", label: "방송 종료 후 주문 허용(시간, 0=즉시 마감)", type: "number", min: 0, half: true, required: true },
            { name: "settleAfterDays", label: "구매 확정 유예(배송 완료 후 일)", type: "number", min: 0, half: true, required: true },
            { name: "piiRetentionDays", label: "구매자 정보 가림(배송 완료 후 일)", type: "number", min: 7, half: true, required: true },
            { name: "autoCompleteBookings", label: "종료된 승인 예약 자동 이용 완료", type: "checkbox" },
          ]} />} />
      <Card><CardContent className="divide-y p-0">
        {rows.map(([k, v, d]) => (
          <div key={k} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
            <p className="w-56 shrink-0 text-sm font-bold text-navy">{k}</p>
            <p className="w-32 shrink-0 text-lg font-extrabold text-brand-700">{v}</p>
            <p className="text-xs text-slate-500">{d}</p>
          </div>
        ))}
      </CardContent></Card>
      {last && <p className="text-xs text-slate-500">마지막 수정 {new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(last.updatedAt)}</p>}

      <Card><CardContent className="space-y-3 p-4 sm:p-5">
        <p className="font-extrabold text-navy">정산 예시 — 판매가 30,000원 · 브랜드 공급가 18,000원</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[["창고(스튜디오) 상품 (셀러 수수료 10%)", ex1], ["셀러가 가져온 직배송 상품", ex2]].map(([label, r]) => {
            const x = r as typeof ex1;
            return (
              <div key={label as string} className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="mb-1 font-bold">{label as string}</p>
                <p>플랫폼 판매 수수료 {formatKRW(x.platformFee)} + 브랜드 수수료 {formatKRW(brandFee)}</p>
                <p>브랜드 지급 {formatKRW(x.brand - brandFee)} · 셀러 {formatKRW(x.seller)} · 창고(스튜디오) {formatKRW(x.facility)}</p>
              </div>
            );
          })}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4 sm:p-5">
        <p className="mb-2 font-extrabold text-navy">브랜드별 수수료 예외</p>
        {overrides.length === 0 ? <p className="text-sm text-slate-500">모든 브랜드가 기본 수수료를 사용합니다. 브랜드샵 관리 → 브랜드 선택 → 공개 관리에서 브랜드별 수수료를 정할 수 있습니다.</p>
          : <ul className="space-y-1 text-sm">{overrides.map((o) => <li key={o.id}><Link href={`/admin/brands/${o.id}`} className="font-semibold text-brand-800 underline">{o.name}</Link> · {o.feeRate}%</li>)}</ul>}
        <p className="mt-3 text-xs text-slate-500">창고(스튜디오) 상품별 셀러 수수료는 각 상품에서, 기존 창고(스튜디오) 이용료 수수료는 <Link href="/admin/settlements" className="underline">정산 관리</Link>에서 관리합니다.</p>
      </CardContent></Card>
    </div>
  );
}
