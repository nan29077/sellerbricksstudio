"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";

type B = { id: string; facilityId: string; facilityName: string; startAt: string };

const OWN = "OWN";

// 방송 장소: 승인된 창고(스튜디오) 예약 또는 셀러 본인 공간(가져온 브랜드 직배송 상품 판매)
export function LiveSessionCreate({ bookings, defaultBookingId }: { bookings: B[]; defaultBookingId?: string }) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState(defaultBookingId ?? bookings[0]?.id ?? OWN);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const [sns, setSns] = useState<string[]>([]);

  const toggle = (t: string) => setSns((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);

  async function create() {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b && bookingId !== OWN) return;
    if (!title) { setError("방송 제목을 입력하세요."); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/live-sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(b && { bookingId, facilityId: b.facilityId }), title, snsChannels: sns.map((type) => ({ type })) }),
    });
    const json = await res.json(); setLoading(false);
    if (!json.ok) { setError(json.error ?? "생성 실패"); return; }
    router.push(`/seller/live-sessions/${json.data.id}/products`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div><Label>방송 장소</Label>
        <Select aria-label="방송 장소" value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
          {bookings.map((b) => <option key={b.id} value={b.id}>{b.facilityName} · {formatDateTime(b.startAt)} (예약)</option>)}
          <option value={OWN}>내 공간에서 방송 — 가져온 브랜드 직배송 상품</option>
        </Select>
        <p className="mt-1 text-xs text-slate-500">{bookingId === OWN
          ? "창고(스튜디오) 예약 없이 셀러 본인 공간에서 방송합니다. '내 브랜드 판매 상품'을 올릴 수 있고, 주문은 브랜드가 구매자에게 바로 배송합니다."
          : "예약한 창고(스튜디오)의 판매 상품으로 방송합니다. 주문은 창고(스튜디오)가 배송합니다."}</p>
      </div>
      <div><Label>방송 제목</Label><Input aria-label="방송 제목" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 주말 특가 라이브" /></div>
      <div>
        <Label>송출 채널 (자체 송출은 자동 포함)</Label>
        <div className="flex flex-wrap gap-2">
          {["YOUTUBE", "INSTAGRAM", "TIKTOK", "ETC"].map((t) => (
            <button key={t} type="button" onClick={() => toggle(t)} className={`rounded-full border px-3 py-1.5 text-sm ${sns.includes(t) ? "bg-navy text-white" : "bg-white"}`}>{t}</button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={create} disabled={loading}>{loading ? "생성 중..." : "라이브 세션 생성"}</Button>
    </div>
  );
}
