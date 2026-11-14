import { Headset, User } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { ThreadItem } from "@/lib/support";
import { cn } from "@/lib/utils";

// 문의 대화 (고객 · 운영팀) — 고객 화면 · 관리 화면 공용
export function SupportThread({ items, viewer }: { items: ThreadItem[]; viewer: "USER" | "ADMIN" }) {
  return (
    <ol className="space-y-3">
      {items.map((m) => {
        const mine = m.author === viewer;
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-7", m.author === "ADMIN" ? "border border-brand-200 bg-brand-50 text-navy" : "border border-[#E8E5DD] bg-white text-slate-700")}>
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                {m.author === "ADMIN" ? <Headset className="h-3.5 w-3.5 text-brand-700" /> : <User className="h-3.5 w-3.5" />}
                {m.author === "ADMIN" ? "운영팀" : "고객"} · {formatDateTime(m.at)}
              </p>
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
          </li>
        );
      })}
    </ol>
  );
}
