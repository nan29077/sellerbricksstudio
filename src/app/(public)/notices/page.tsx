import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedNotices } from "@/lib/notices";

export const metadata: Metadata = { title: "공지사항 | 스토리지마켓" };
export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(iso));

export default async function NoticesPage() {
  const notices = await getPublishedNotices();
  return (
    <main className="container max-w-3xl py-10">
      <h1 className="text-2xl font-extrabold text-navy">공지사항</h1>
      <div className="mt-8 divide-y rounded-2xl border bg-white">
        {notices === null && <p className="p-6 text-sm text-slate-600">공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
        {notices?.length === 0 && <p className="p-6 text-sm text-slate-600">등록된 공지사항이 없습니다.</p>}
        {notices?.map((n) => (
          <details key={n.id} id={n.id} className="group p-4 sm:p-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
              <span className="min-w-0">
                {n.pinned && <span className="mr-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-800">고정</span>}
                <span className="break-words font-bold text-navy">{n.title}</span>
              </span>
              <span className="shrink-0 text-xs text-slate-500">{fmt(n.createdAt)}</span>
            </summary>
            {n.body && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{n.body}</p>}
            {n.link && <Link href={n.link} className="mt-3 inline-block text-sm font-bold text-brand-800 hover:underline">자세히 보기 →</Link>}
          </details>
        ))}
      </div>
    </main>
  );
}
