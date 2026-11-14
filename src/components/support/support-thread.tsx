import { Headset, User } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { ThreadItem } from "@/lib/support";
import { cn } from "@/lib/utils";

// 문의 대화 (고객 · 운영팀) — 메신저처럼 내가 보낸 말은 오른쪽, 상대 말은 왼쪽 (고객 화면 · 관리 화면 공용)
export function SupportThread({ items, viewer }: { items: ThreadItem[]; viewer: "USER" | "ADMIN" }) {
  return (
    <ol className="space-y-3">
      {items.map((m) => {
        const mine = m.author === viewer;
        const admin = m.author === "ADMIN";
        return (
          <li key={m.id} className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
            {!mine && <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", admin ? "bg-navy text-brand-300" : "bg-slate-200 text-slate-600")}>{admin ? <Headset className="h-4 w-4" /> : <User className="h-4 w-4" />}</span>}
            <div className={cn("max-w-[85%]", mine && "text-right")}>
              <p className="mb-0.5 text-[11px] font-bold text-slate-500">{admin ? "운영팀" : "고객"} <span className="font-normal text-slate-400">{formatDateTime(m.at)}</span></p>
              <div className={cn("inline-block rounded-2xl px-3.5 py-2.5 text-left text-sm leading-6", mine ? "rounded-br-md bg-navy text-white" : "rounded-bl-md border border-[#E8E5DD] bg-white text-navy")}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                {!!m.attachments.length && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.attachments.map((a) => (
                      <a key={a} href={a} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a} alt="첨부 이미지" className="h-20 w-20 rounded-xl border object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
