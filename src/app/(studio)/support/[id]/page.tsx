import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Headset } from "lucide-react";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SUPPORT_CATEGORIES } from "@/lib/support";
import { formatDateTime } from "@/lib/utils";
import { InquiryStatus } from "@/components/support/inquiry-status";

export const metadata = { title: "문의 상세 | 스토리지마켓", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SupportDetail({ params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const user = await getSessionUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(`/support/${params.id}`)}`);
  const item = await prisma.supportInquiry.findFirst({ where: { id: params.id, userId: user.id } });
  if (!item) notFound();

  return (
    <article className="space-y-4 px-4 pb-12 pt-4 sm:px-6">
      <Link href="/support#my-inquiries" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-navy hover:text-brand-700"><ArrowLeft className="h-4 w-4" />내 문의로 돌아가기</Link>
      <section className="rounded-[24px] border bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-brand-700">{SUPPORT_CATEGORIES[item.category].label}</p>
          <InquiryStatus answered={!!item.answeredAt} />
        </div>
        <h1 className="mt-3 break-words text-2xl font-black text-navy">{item.subject}</h1>
        <dl className="mt-3 space-y-1 break-all text-xs text-slate-600">
          <div><dt className="mr-2 inline font-bold">접수번호</dt><dd className="inline">{item.id}</dd></div>
          <div><dt className="mr-2 inline font-bold">접수 시각</dt><dd className="inline">{formatDateTime(item.createdAt)}</dd></div>
          {item.reference && <div><dt className="mr-2 inline font-bold">관련 번호</dt><dd className="inline">{item.reference}</dd></div>}
        </dl>
        <p className="mt-5 whitespace-pre-wrap break-words border-t pt-4 text-sm leading-7 text-slate-700">{item.message}</p>
      </section>
      <section className="rounded-[24px] border border-brand-200 bg-brand-50 p-5 sm:p-7">
        <h2 className="flex items-center gap-2 font-extrabold text-navy"><Headset className="h-5 w-5 text-brand-700" />운영팀 답변</h2>
        {item.answeredAt && item.reply ? (
          <>
            <p className="mt-2 text-xs text-slate-600">{formatDateTime(item.answeredAt)}</p>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-navy">{item.reply}</p>
          </>
        ) : <p className="mt-3 text-sm leading-6 text-slate-700">운영팀이 문의를 확인하고 있습니다. 답변이 등록되면 앱 알림으로 알려드려요.</p>}
      </section>
    </article>
  );
}
