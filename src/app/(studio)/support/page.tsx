import Link from "next/link";
import { ArrowRight, CircleHelp, Headset, ListChecks, MessageSquare } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { pageOf, type SP } from "@/lib/list";
import { SUPPORT_CATEGORIES } from "@/lib/support";
import { Pagination } from "@/components/list/pagination";
import { SupportFaq, SupportInquiryForm } from "@/components/support/help-center";
import { InquiryStatus } from "@/components/support/inquiry-status";

export const metadata = { title: "고객지원 | 셀러브릭스 스튜디오" };
export const dynamic = "force-dynamic";

export default async function SupportPage({ searchParams }: { searchParams: SP }) {
  const user = await getSessionUser();
  const { size, page } = pageOf(searchParams, 10);
  const history = user ? await (async () => {
    try {
      const where = { userId: user.id };
      const total = await prisma.supportInquiry.count({ where });
      const current = Math.min(page, Math.max(1, Math.ceil(total / size)));
      const items = await prisma.supportInquiry.findMany({
        where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: size, skip: (current - 1) * size,
        select: { id: true, subject: true, category: true, answeredAt: true, createdAt: true },
      });
      return { total, current, items };
    } catch {
      return null;
    }
  })() : null;

  return (
    <div className="space-y-5 px-4 pb-12 pt-4 sm:px-6 sm:pt-6">
      <section className="rounded-[26px] bg-navy p-5 text-white sm:p-8">
        <p className="flex items-center gap-2 text-xs font-extrabold tracking-[0.16em] text-brand-300"><Headset className="h-5 w-5" />SELLERBRICKS SUPPORT</p>
        <h1 className="mt-3 break-keep text-3xl font-black tracking-tight sm:text-4xl">무엇을 도와드릴까요?</h1>
        <p className="mt-3 max-w-md break-keep text-sm leading-6 text-white/80">예약부터 주문, 정산까지 궁금한 점을 찾아보고 운영팀에 직접 문의할 수 있어요.</p>
        <nav aria-label="고객지원 바로가기" className="mt-5 flex flex-wrap gap-2">
          <a href="#faq" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/25 px-3 text-xs font-bold hover:bg-white/10"><CircleHelp className="h-4 w-4" />자주 묻는 질문</a>
          <a href="#new-inquiry" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-500 px-3 text-xs font-extrabold text-navy hover:bg-brand-400"><MessageSquare className="h-4 w-4" />1:1 문의</a>
          {user && <a href="#my-inquiries" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/25 px-3 text-xs font-bold hover:bg-white/10"><ListChecks className="h-4 w-4" />내 문의</a>}
        </nav>
      </section>
      <SupportFaq />
      <section id="new-inquiry" className="scroll-mt-20 rounded-[24px] border bg-white p-4 sm:p-6">
        <h2 className="text-xl font-extrabold text-navy">1:1 문의하기</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">접수 내역과 운영팀의 답변은 내 문의에서 확인할 수 있습니다.</p>
        {user ? <SupportInquiryForm /> : (
          <div className="mt-4 rounded-2xl bg-brand-50 p-4">
            <p className="text-sm font-bold text-navy">문의 접수와 답변 확인은 로그인 후 이용할 수 있어요.</p>
            <Link href="/login?callbackUrl=%2Fsupport%23new-inquiry" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-4 text-sm font-bold text-white hover:bg-navy-700">로그인하고 문의하기<ArrowRight className="h-4 w-4" /></Link>
          </div>
        )}
      </section>
      {user && (
        <section id="my-inquiries" className="scroll-mt-20 rounded-[24px] border bg-white p-4 sm:p-6">
          <h2 className="text-xl font-extrabold text-navy">내 문의</h2>
          {history ? (
            history.items.length ? (
              <>
                <ul className="mt-4 divide-y divide-slate-100">
                  {history.items.map((item) => (
                    <li key={item.id}>
                      <Link href={`/support/${item.id}`} className="flex items-start justify-between gap-3 rounded-lg px-1 py-3 hover:bg-brand-50">
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-slate-500">{SUPPORT_CATEGORIES[item.category].label} · {formatDateTime(item.createdAt)}</span>
                          <span className="mt-1 block break-words text-sm font-bold text-navy">{item.subject}</span>
                        </span>
                        <InquiryStatus answered={!!item.answeredAt} />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Pagination base="/support" params={searchParams} page={history.current} size={size} total={history.total} />
              </>
            ) : <p className="mt-3 text-sm text-slate-600">접수한 문의가 없습니다.</p>
          ) : <p role="status" className="mt-3 text-sm text-slate-600">문의 내역을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>}
        </section>
      )}
    </div>
  );
}
