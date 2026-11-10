import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSupportCategory, SUPPORT_CATEGORIES } from "@/lib/support";
import { formatDateTime } from "@/lib/utils";
import { pageOf, sp, type SP } from "@/lib/list";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Pagination } from "@/components/list/pagination";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { InquiryStatus } from "@/components/support/inquiry-status";
import { SupportReplyForm } from "@/components/support/support-reply-form";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage({ searchParams }: { searchParams: SP }) {
  const admin = await requireRole(["SUPER_ADMIN"]);
  const account = await prisma.user.findFirst({
    where: { id: admin.id, role: "SUPER_ADMIN", isActive: true }, select: { id: true },
  }).catch(() => null);
  if (!account) {
    return <PageHeader title="고객 문의 관리" description="문의 내역을 보려면 DB에 연결된 최고관리자 계정으로 로그인해 주세요." />;
  }

  const status = sp(searchParams, "status");
  const query = sp(searchParams, "q")?.slice(0, 100) ?? "";
  const category = sp(searchParams, "category");
  const { page, size } = pageOf(searchParams, 15);
  const where: Prisma.SupportInquiryWhereInput = {
    ...(status === "waiting" && { answeredAt: null }),
    ...(status === "answered" && { answeredAt: { not: null } }),
    ...(isSupportCategory(category) && { category }),
    ...(query && {
      OR: [
        { id: { contains: query, mode: "insensitive" } },
        { subject: { contains: query, mode: "insensitive" } },
        { reference: { contains: query, mode: "insensitive" } },
        { user: { email: { contains: query, mode: "insensitive" } } },
        { user: { profile: { name: { contains: query, mode: "insensitive" } } } },
      ],
    }),
  };
  const queue = await (async () => {
    try {
      const [total, waiting, answered] = await Promise.all([
        prisma.supportInquiry.count({ where }),
        prisma.supportInquiry.count({ where: { answeredAt: null } }),
        prisma.supportInquiry.count({ where: { answeredAt: { not: null } } }),
      ]);
      const current = Math.min(page, Math.max(1, Math.ceil(total / size)));
      const items = await prisma.supportInquiry.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: size,
        skip: (current - 1) * size,
        include: { user: { select: { email: true, profile: { select: { name: true } } } } },
      });
      return { current, total, waiting, answered, items };
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-5">
      <PageHeader title="고객 문의 관리" description="고객지원으로 접수된 1:1 문의를 확인하고 운영팀 답변을 등록하세요." />
      {queue ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/admin/support?status=waiting" className="rounded-2xl border bg-white p-4 hover:bg-brand-50"><span className="block text-sm font-bold text-slate-600">답변 대기</span><strong className="mt-1 block text-2xl text-navy">{queue.waiting.toLocaleString()}</strong></Link>
            <Link href="/admin/support?status=answered" className="rounded-2xl border bg-white p-4 hover:bg-emerald-50"><span className="block text-sm font-bold text-slate-600">답변 완료</span><strong className="mt-1 block text-2xl text-navy">{queue.answered.toLocaleString()}</strong></Link>
          </div>
          <form action="/admin/support" className="grid grid-cols-2 gap-2 rounded-2xl border bg-white p-4 lg:grid-cols-[1fr_10rem_9rem_auto]">
            <Input className="col-span-2 lg:col-span-1" type="search" name="q" aria-label="문의 검색" defaultValue={query} maxLength={100} placeholder="제목, 접수번호, 주문·예약번호, 작성자 검색" />
            <Select name="category" aria-label="문의 유형" defaultValue={isSupportCategory(category) ? category : ""}>
              <option value="">전체 유형</option>
              {Object.entries(SUPPORT_CATEGORIES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
            </Select>
            <Select name="status" aria-label="답변 상태" defaultValue={status === "waiting" || status === "answered" ? status : ""}>
              <option value="">전체 상태</option>
              <option value="waiting">답변 대기</option>
              <option value="answered">답변 완료</option>
            </Select>
            <Button className="col-span-2 lg:col-span-1"><Search className="h-4 w-4" />검색</Button>
          </form>
          {queue.items.map((item) => (
            <details key={item.id} open={queue.items.length === 1 || undefined} className="group rounded-2xl border bg-white p-4 sm:p-5">
              <summary className="cursor-pointer rounded-lg text-sm text-navy">
                <span className="ml-2 font-extrabold">{item.subject}</span>
                <span className="ml-2 inline-block"><InquiryStatus answered={!!item.answeredAt} /></span>
                <span className="mt-2 block break-words text-xs text-slate-600">{SUPPORT_CATEGORIES[item.category].label} · {item.user.profile?.name ?? item.user.email} · {formatDateTime(item.createdAt)}</span>
              </summary>
              <dl className="mt-4 space-y-1 break-all rounded-xl bg-[#F7F7F4] p-3 text-xs text-slate-600">
                <div><dt className="mr-2 inline font-bold">접수번호</dt><dd className="inline">{item.id}</dd></div>
                <div><dt className="mr-2 inline font-bold">이메일</dt><dd className="inline">{item.user.email}</dd></div>
                {item.reference && <div><dt className="mr-2 inline font-bold">관련 번호</dt><dd className="inline">{item.reference}</dd></div>}
              </dl>
              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-navy">{item.message}</p>
              {item.answeredAt ? (
                <div className="mt-4 rounded-xl bg-emerald-50 p-4">
                  <p className="text-xs font-bold text-emerald-800">운영팀 답변 · {formatDateTime(item.answeredAt)}</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-navy">{item.reply}</p>
                </div>
              ) : <SupportReplyForm id={item.id} />}
            </details>
          ))}
          {!queue.items.length && <p className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-slate-600">조건에 맞는 문의가 없습니다.</p>}
          <Pagination base="/admin/support" params={searchParams} page={queue.current} size={size} total={queue.total} />
        </>
      ) : (
        <p role="status" className="rounded-xl border bg-white p-5 text-sm text-slate-600">문의 내역을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>
      )}
    </div>
  );
}
