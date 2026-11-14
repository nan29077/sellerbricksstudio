import Link from "next/link";
import { CalendarClock, PackageCheck, Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Panel, Empty } from "@/components/dashboard/kit";
import { BRAND_REQUEST_STATUS } from "@/lib/brands";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

// 다가오는 방송 시연품 (브랜드 대시보드) — 언제 · 어디로 · 무엇을 보내야 하는지 한눈에 (2026-11-14)
export async function DisplayRequestsPanel({ shopId }: { shopId: string }) {
  const now = new Date();
  const rows = await prisma.bookingBrandItem.findMany({
    where: { brandProduct: { shopId }, brandRequest: { kind: "DISPLAY", status: { in: ["PENDING", "APPROVED", "SHIPPED"] } }, booking: { status: "APPROVED", startAt: { gte: now } } },
    orderBy: { dueAt: "asc" }, take: 6,
    select: {
      id: true, nameSnapshot: true, quantity: true, optionLabel: true, dueAt: true,
      brandRequest: { select: { id: true, status: true } },
      booking: { select: { startAt: true, facility: { select: { name: true } } } },
    },
  });
  const late = rows.filter((r) => r.dueAt && r.dueAt < now && r.brandRequest?.status !== "SHIPPED").length;
  return (
    <Panel eyebrow="DEMO UNITS" title={`다가오는 방송 시연품${late ? ` · 기한 지남 ${late}건` : ""}`} action={{ href: "/brand/requests?kind=DISPLAY", label: "전체 보기" }}>
      {rows.length === 0 ? <Empty icon={PackageCheck} text="보낼 방송 시연품이 없어요. 셀러가 내 상품으로 방송을 예약하면 여기에 보여요." /> : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => {
            const overdue = !!r.dueAt && r.dueAt < now && r.brandRequest?.status !== "SHIPPED";
            const shipped = r.brandRequest?.status === "SHIPPED";
            return (
              <li key={r.id}>
                <Link href={`/brand/requests?request=${r.brandRequest?.id ?? ""}`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50">
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", shipped ? "bg-emerald-50 text-emerald-700" : overdue ? "bg-rose-50 text-rose-600" : "bg-violet-50 text-violet-700")}>
                    {shipped ? <Truck className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-navy">{r.nameSnapshot}{r.optionLabel ? ` · ${r.optionLabel}` : ""} × {r.quantity}</span>
                    <span className="block truncate text-[11px] text-slate-500">{r.booking.facility.name} · 방송 {formatDateTime(r.booking.startAt)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={cn("block text-[11px] font-bold", overdue ? "text-rose-600" : "text-slate-600")}>{r.dueAt ? `${formatDateTime(r.dueAt)}까지` : ""}</span>
                    <span className="block text-[11px] text-slate-500">{r.brandRequest ? BRAND_REQUEST_STATUS[r.brandRequest.status] : ""}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
