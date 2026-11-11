import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MessageComposer } from "./message-composer";

const fmt = (d: Date) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(d);

// 브랜드 ↔ 판매처 문의 화면 (목록 + 선택한 대화). side 에 따라 상대 이름과 읽음 표시가 바뀐다.
export async function MessageCenter({ side, scope, base, selected, startShop, me }: {
  side: "BRAND" | "PARTNER"; scope: { shopId: string } | { partnerId: string }; base: string; selected?: string; startShop?: { id: string; name: string } | null; me: string;
}) {
  const threads = await prisma.brandThread.findMany({
    where: scope, orderBy: { lastMessageAt: "desc" }, take: 100,
    include: {
      shop: { select: { name: true } },
      partner: { select: { email: true, role: true, profile: { select: { name: true, companyName: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
    },
  });
  const current = threads.find((t) => t.id === selected) ?? (startShop ? threads.find((t) => t.shopId === startShop.id) : undefined);
  if (current) {
    // 내 쪽 안 읽음 표시 지우기
    await prisma.brandThread.update({ where: { id: current.id }, data: side === "BRAND" ? { brandUnread: 0 } : { partnerUnread: 0 } }).catch(() => {});
  }
  const messages = current ? await prisma.brandMessage.findMany({
    where: { threadId: current.id }, orderBy: { createdAt: "asc" }, take: 300,
    select: { id: true, body: true, createdAt: true, senderId: true, sender: { select: { role: true, profile: { select: { name: true } } } } },
  }) : [];
  const nameOf = (t: (typeof threads)[number]) => side === "BRAND"
    ? (t.partner.profile?.companyName || t.partner.profile?.name || t.partner.email.split("@")[0]) + (t.partner.role === "SELLER" ? " · 셀러" : " · 창고(스튜디오)")
    : t.shop.name;
  const unread = (t: (typeof threads)[number]) => (side === "BRAND" ? t.brandUnread : t.partnerUnread);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-2xl border bg-white">
        <p className="border-b px-4 py-3 text-sm font-bold text-navy">대화 {threads.length}개</p>
        {!threads.length && <p className="px-4 py-6 text-sm text-slate-500">{side === "BRAND" ? "판매처 관리에서 판매처에게 먼저 메시지를 보낼 수 있습니다." : "브랜드샵에서 '브랜드 문의'를 눌러 대화를 시작하세요."}</p>}
        <ul className="max-h-[60vh] divide-y overflow-y-auto">
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={`${base}?t=${t.id}`} aria-current={current?.id === t.id ? "page" : undefined}
                className={`block px-4 py-3 hover:bg-slate-50 ${current?.id === t.id ? "bg-brand-50/60" : ""}`}>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-navy">{nameOf(t)}</span>
                  {unread(t) > 0 && current?.id !== t.id && <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{unread(t)}</span>}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{t.messages[0]?.body ?? "새 대화"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section className="flex min-h-[420px] flex-col rounded-2xl border bg-white">
        {current || startShop ? <>
          <p className="border-b px-4 py-3 text-sm font-bold text-navy">{current ? nameOf(current) : startShop!.name}</p>
          <ol className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {!messages.length && <li className="text-sm text-slate-500">첫 메시지를 보내 보세요. 샘플, 입고 일정, 방송 계획 등을 자유롭게 문의할 수 있습니다.</li>}
            {messages.map((m) => {
              const mine = m.senderId === me;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-navy text-white" : "bg-slate-100 text-navy"}`}>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-1 text-[11px] ${mine ? "text-white/60" : "text-slate-500"}`}>{m.sender.profile?.name ?? ""} · {fmt(m.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <MessageComposer threadId={current?.id} shopId={!current ? startShop?.id : undefined} />
        </> : <p className="m-auto px-4 text-sm text-slate-500">왼쪽에서 대화를 고르세요.</p>}
      </section>
    </div>
  );
}
