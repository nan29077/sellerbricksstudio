"use client";

import { useState } from "react";
import { MessageSquare, Send, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FacilityInquiryButton({
  facilityId,
  facilityName,
  isSeller,
  isLoggedIn,
}: {
  facilityId: string;
  facilityName: string;
  isSeller: boolean;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (!isLoggedIn) {
    return (
      <a
        href={`/login?callbackUrl=${encodeURIComponent(`/facilities/${facilityId}`)}`}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
      >
        <MessageSquare className="h-4 w-4" />
        로그인하고 문의하기
      </a>
    );
  }

  if (!isSeller) {
    return null;
  }

  async function handleSubmit() {
    if (!message.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/facilities/${facilityId}/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "전송에 실패했습니다");
        return;
      }
      setSent(true);
      setMessage("");
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setSent(false); setError(""); }}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
      >
        <MessageSquare className="h-4 w-4" />
        시설에 문의하기
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-navy">시설 문의</h3>
                <p className="mt-0.5 text-xs text-slate-400">{facilityName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            {sent ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <p className="mt-3 text-base font-black text-navy">문의가 전송되었습니다</p>
                <p className="mt-1 text-sm text-slate-400">시설 관리자가 확인 후 답변을 드립니다</p>
                <Button
                  className="mt-6"
                  variant="outline"
                  onClick={() => { setOpen(false); setSent(false); }}
                >
                  닫기
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-800">
                    예약 가능 여부, 시설 상태, 특별 요청 등을 자유롭게 문의해보세요
                  </p>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="예) 다음 주 월요일 오후에 의류 촬영을 위해 예약하고 싶습니다. 조명 장비 지원이 가능한가요?"
                  className="w-full resize-none rounded-2xl border border-border bg-[#FAFAF8] px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                    취소
                  </Button>
                  <Button
                    className="flex-1 gap-1.5"
                    onClick={handleSubmit}
                    disabled={sending || !message.trim()}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sending ? "전송 중..." : "문의 보내기"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
