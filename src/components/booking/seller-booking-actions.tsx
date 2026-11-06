"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarPlus, MessageSquareText, RotateCcw, Star, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client-api";

type Props = {
  booking: { id: string; status: string; startAt: string; endAt: string; facilityId: string; facilityName: string; address?: string | null; purpose?: string | null };
  review?: { id: string; rating: number; content: string; reply: string | null } | null;
};

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function SellerBookingActions({ booking, review }: Props) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [content, setContent] = useState(review?.content ?? "");
  const [busy, setBusy] = useState(false);
  const upcoming = new Date(booking.startAt) > new Date();

  async function cancel() {
    setBusy(true);
    try { await api(`/api/bookings/${booking.id}`, "PATCH", { status: "CANCELLED", reason }); setCancelOpen(false); router.refresh(); }
    catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  }
  async function saveReview() {
    setBusy(true);
    try {
      if (review) await api(`/api/reviews/${review.id}`, "PATCH", { rating, content });
      else await api(`/api/reviews`, "POST", { bookingId: booking.id, rating, content });
      setReviewOpen(false); router.refresh();
    } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  }
  function downloadIcs() {
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SellerBricks//Studio//KO", "BEGIN:VEVENT",
      `UID:${booking.id}@sellerbricks`, `DTSTAMP:${icsDate(new Date().toISOString())}`,
      `DTSTART:${icsDate(booking.startAt)}`, `DTEND:${icsDate(booking.endAt)}`,
      `SUMMARY:[셀러브릭스] ${booking.facilityName}${booking.purpose ? ` - ${booking.purpose}` : ""}`,
      booking.address ? `LOCATION:${booking.address}` : "", "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `booking-${booking.id}.ics`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {booking.status === "APPROVED" && upcoming && (
        <Button size="sm" variant="outline" onClick={downloadIcs}><CalendarPlus className="h-3.5 w-3.5" />내 캘린더에 추가</Button>
      )}
      {booking.status === "COMPLETED" && (
        <Button size="sm" variant={review ? "outline" : "default"} onClick={() => setReviewOpen(true)}>
          <Star className="h-3.5 w-3.5" />{review ? "리뷰 수정" : "리뷰 쓰기"}
        </Button>
      )}
      <Link href={`/facilities/${booking.facilityId}`}><Button size="sm" variant="ghost"><MessageSquareText className="h-3.5 w-3.5" />창고 보기·문의</Button></Link>
      {["COMPLETED", "CANCELLED", "REJECTED"].includes(booking.status) && (
        <Link href={`/seller/bookings/new?facilityId=${booking.facilityId}`}><Button size="sm" variant="ghost"><RotateCcw className="h-3.5 w-3.5" />다시 예약</Button></Link>
      )}
      {["PENDING", "APPROVED"].includes(booking.status) && upcoming && (
        <Button size="sm" variant="outline" className="text-red-600" onClick={() => setCancelOpen(true)}><XCircle className="h-3.5 w-3.5" />예약 취소</Button>
      )}

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="예약 취소"
        footer={<><Button variant="outline" size="sm" onClick={() => setCancelOpen(false)}>닫기</Button><Button variant="destructive" size="sm" disabled={busy} onClick={cancel}>{busy ? "처리중..." : "예약 취소하기"}</Button></>}>
        <p className="mb-3 text-sm text-slate-600">{booking.facilityName} 예약을 취소합니다. 창고(스튜디오)의 취소·환불 규정을 확인해 주세요.</p>
        <Label>취소 사유 (선택)</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 방송 일정 변경" maxLength={300} />
      </Dialog>

      <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)} title={review ? "리뷰 수정" : "이용 리뷰 작성"}
        footer={<><Button variant="outline" size="sm" onClick={() => setReviewOpen(false)}>닫기</Button><Button size="sm" disabled={busy || content.trim().length < 5} onClick={saveReview}>{busy ? "저장중..." : "저장"}</Button></>}>
        <p className="mb-2 text-sm font-semibold text-navy">{booking.facilityName}</p>
        <div className="mb-3 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n}점`}>
              <Star className={`h-8 w-8 ${n <= rating ? "fill-brand-500 text-brand-500" : "text-slate-300"}`} />
            </button>
          ))}
        </div>
        <Label>리뷰 내용</Label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} maxLength={1000} placeholder="장비 상태, 방음, 직원 응대, 주차 등 다른 셀러에게 도움이 되는 내용을 남겨주세요. (5자 이상)" />
        {review?.reply && <div className="mt-3 rounded-lg bg-muted/60 p-3 text-xs text-slate-600"><b className="text-navy">창고(스튜디오) 답글</b><br />{review.reply}</div>}
      </Dialog>
    </div>
  );
}
