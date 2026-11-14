"use client";
import { appAlert } from "@/components/ui/app-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, CalendarPlus, MessageSquareText, RotateCcw, Star, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { SlotPicker, endOf, type SlotValue } from "./slot-picker";

type Props = {
  booking: {
    id: string; status: string; startAt: string; endAt: string; facilityId: string; facilityName: string;
    address?: string | null; purpose?: string | null; code?: string | null; cancelDeadlineHours: number; hasLive?: boolean;
  };
  review?: { id: string; rating: number; content: string; reply: string | null } | null;
};

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600000).toISOString();

export function SellerBookingActions({ booking, review }: Props) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [content, setContent] = useState(review?.content ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const hours = (new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()) / 3600000;
  const [slot, setSlot] = useState<SlotValue>({ date: kst(booking.startAt).slice(0, 10), start: "", hours });
  const [slotStatus, setSlotStatus] = useState<string | null>(null);

  const now = Date.now();
  const startMs = new Date(booking.startAt).getTime();
  const upcoming = startMs > now;
  const active = ["PENDING", "APPROVED"].includes(booking.status) && upcoming;
  // 승인된 예약은 취소·변경 마감 전까지만 직접 변경 가능 (대기 중 예약은 언제든)
  const modifiable = active && (booking.status === "PENDING" || startMs - now >= booking.cancelDeadlineHours * 3600000);

  async function cancel() {
    setBusy(true); setErr("");
    try { await api(`/api/bookings/${booking.id}`, "PATCH", { status: "CANCELLED", reason }); setCancelOpen(false); router.refresh(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function move() {
    if (!slot.date || !slot.start || slotStatus !== "available") { setErr("변경할 날짜와 시간을 선택하세요."); return; }
    setBusy(true); setErr("");
    try {
      await api(`/api/bookings/${booking.id}`, "PATCH", { action: "reschedule", startAt: `${slot.date}T${slot.start}:00`, endAt: `${slot.date}T${endOf(slot.start, slot.hours)}:00` });
      setMoveOpen(false); router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function saveReview() {
    setBusy(true);
    try {
      if (review) await api(`/api/reviews/${review.id}`, "PATCH", { rating, content });
      else await api(`/api/reviews`, "POST", { bookingId: booking.id, rating, content });
      setReviewOpen(false); router.refresh();
    } catch (e) { void appAlert((e as Error).message); } finally { setBusy(false); }
  }
  function downloadIcs() {
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Storage Market//Booking//KO", "BEGIN:VEVENT",
      `UID:${booking.id}@sellerbricks`, `DTSTAMP:${icsDate(new Date().toISOString())}`,
      `DTSTART:${icsDate(booking.startAt)}`, `DTEND:${icsDate(booking.endAt)}`,
      `SUMMARY:[스토리지마켓] ${booking.facilityName}${booking.purpose ? ` - ${booking.purpose}` : ""}`,
      booking.code ? `DESCRIPTION:예약번호 ${booking.code}` : "",
      booking.address ? `LOCATION:${booking.address}` : "", "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `booking-${booking.code ?? booking.id}.ics`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2 lg:justify-end">
      {booking.status === "APPROVED" && upcoming && (
        <Button size="sm" variant="outline" onClick={downloadIcs}><CalendarPlus className="h-3.5 w-3.5" />캘린더 추가</Button>
      )}
      {booking.status === "COMPLETED" && (
        <Button size="sm" variant={review ? "outline" : "default"} onClick={() => setReviewOpen(true)}>
          <Star className="h-3.5 w-3.5" />{review ? "리뷰 수정" : "리뷰 쓰기"}
        </Button>
      )}
      {modifiable && <Button size="sm" variant="outline" onClick={() => { setErr(""); setMoveOpen(true); }}><CalendarClock className="h-3.5 w-3.5" />일정 변경</Button>}
      <Link href={`/facilities/${booking.facilityId}`}><Button size="sm" variant="ghost"><MessageSquareText className="h-3.5 w-3.5" />창고 보기·문의</Button></Link>
      {["COMPLETED", "CANCELLED", "REJECTED"].includes(booking.status) && (
        <Link href={`/seller/bookings/new?facilityId=${booking.facilityId}`}><Button size="sm" variant="ghost"><RotateCcw className="h-3.5 w-3.5" />다시 예약</Button></Link>
      )}
      {modifiable && (
        <Button size="sm" variant="outline" className="text-red-600" onClick={() => { setErr(""); setCancelOpen(true); }}><XCircle className="h-3.5 w-3.5" />예약 취소</Button>
      )}
      {active && !modifiable && <p className="w-full text-right text-[11px] text-slate-500">이용 {booking.cancelDeadlineHours}시간 전이 지나 변경·취소는 창고(스튜디오)에 문의하세요.</p>}

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="예약 취소"
        footer={<><Button variant="outline" size="sm" onClick={() => setCancelOpen(false)}>닫기</Button><Button variant="destructive" size="sm" disabled={busy} onClick={cancel}>{busy ? "처리중..." : "예약 취소하기"}</Button></>}>
        <p className="mb-3 text-sm text-slate-600">{booking.facilityName} 예약{booking.code ? `(${booking.code})` : ""}을 취소합니다.</p>
        <Label>취소 사유 (선택)</Label>
        <Textarea aria-label="취소 사유 (선택)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 방송 일정 변경" maxLength={300} />
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </Dialog>

      <Dialog open={moveOpen} onClose={() => setMoveOpen(false)} title="예약 일정 변경" className="sm:max-w-2xl"
        footer={<><Button variant="outline" size="sm" onClick={() => setMoveOpen(false)}>닫기</Button><Button size="sm" disabled={busy || slotStatus !== "available"} onClick={move}>{busy ? "변경 중..." : "이 시간으로 변경"}</Button></>}>
        <p className="mb-3 text-xs text-slate-600">
          {booking.status === "APPROVED" ? "승인된 예약의 일정을 바꾸면 창고(스튜디오)의 재승인이 필요할 수 있어요. " : ""}
          판매 상품과 요청사항은 그대로 유지됩니다.
        </p>
        {moveOpen && <SlotPicker facilityId={booking.facilityId} value={slot} onChange={setSlot} excludeBookingId={booking.id} onStatusChange={setSlotStatus} compact />}
        {err && <p className="mt-2 whitespace-pre-line text-sm text-red-600">{err}</p>}
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
        <Textarea aria-label="리뷰 내용" value={content} onChange={(e) => setContent(e.target.value)} rows={5} maxLength={1000} placeholder="장비 상태, 방음, 직원 응대, 주차 등 다른 셀러에게 도움이 되는 내용을 남겨주세요. (5자 이상)" />
        {review?.reply && <div className="mt-3 rounded-lg bg-muted/60 p-3 text-xs text-slate-600"><b className="text-navy">창고(스튜디오) 답글</b><br />{review.reply}</div>}
      </Dialog>
    </div>
  );
}
