"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";

type B = { id: string; facilityId: string; facilityName: string; startAt: string };

export function LiveSessionCreate({ bookings, defaultBookingId }: { bookings: B[]; defaultBookingId?: string }) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState(defaultBookingId ?? bookings[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const [sns, setSns] = useState<string[]>([]);

  const toggle = (t: string) => setSns((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);

  async function create() {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b) return;
    if (!title) { setError("방송 제목을 입력하세요."); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/live-sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, facilityId: b.facilityId, title, snsChannels: sns.map((type) => ({ type })) }),
    });
    const json = await res.json(); setLoading(false);
    if (!json.ok) { setError(json.error ?? "생성 실패"); return; }
    router.push(`/seller/live-sessions/${json.data.id}/products`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div><Label>예약 선택</Label>
        <Select value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
          {bookings.map((b) => <option key={b.id} value={b.id}>{b.facilityName} · {formatDateTime(b.startAt)}</option>)}
        </Select>
      </div>
      <div><Label>방송 제목</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 주말 특가 라이브" /></div>
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
