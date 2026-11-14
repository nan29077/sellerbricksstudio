import { notFound } from "next/navigation";
import { Headset } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SUPPORT_CATEGORIES, SUPPORT_STATUS, effectiveStatus, supportThread } from "@/lib/support";
import { formatDateTime } from "@/lib/utils";
import { SupportThread } from "@/components/support/support-thread";
import { SupportFollowUp } from "@/components/support/support-follow-up";

export const metadata = { title: "문의 확인 | 스토리지마켓", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// 비회원 문의 확인 (접수 때 받은 링크 · 답변 메일의 링크)
export default async function GuestInquiry({ params }: { params: { token: string } }) {
  if (!/^[\w-]{20,80}$/.test(params.token)) notFound();
  const item = await prisma.supportInquiry.findUnique({ where: { guestToken: params.token }, include: { messages: { orderBy: { createdAt: "asc" } } } }).catch(() => null);
  if (!item || item.userId) notFound();
  const status = effectiveStatus(item);
  return (
    <article className="space-y-4 px-4 pb-12 pt-4 sm:px-6">
      <section className="rounded-[24px] border bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-brand-700">{SUPPORT_CATEGORIES[item.category].label} · 비회원 문의</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-navy">{SUPPORT_STATUS[status].label}</span>
        </div>
        <h1 className="mt-3 break-words text-2xl font-black text-navy">{item.subject}</h1>
        <p className="mt-2 text-xs text-slate-600">접수 {formatDateTime(item.createdAt)} · 답변은 {item.guestEmail}(으)로도 보내 드려요. 이 페이지 주소는 다른 사람과 나누지 마세요.</p>
      </section>
      <section className="space-y-4 rounded-[24px] border bg-[#FBFAF7] p-4 sm:p-6">
        <h2 className="flex items-center gap-2 font-extrabold text-navy"><Headset className="h-5 w-5 text-brand-700" />대화</h2>
        <SupportThread items={supportThread(item)} viewer="USER" />
        {!item.answeredAt && <p className="text-sm leading-6 text-slate-600">운영팀이 문의를 확인하고 있어요.</p>}
        <SupportFollowUp id={item.id} token={params.token} closed={status === "CLOSED"} />
      </section>
    </article>
  );
}
