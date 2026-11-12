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
  // 방송 채널 주소 (선택). 스토리지마켓은 직접 송출하지 않고, 셀러의 외부 채널을 주문 화면에 연결한다.
  const [urls, setUrls] = useState<Record<string, string>>({ YOUTUBE: "", INSTAGRAM: "", TIKTOK: "", ETC: "" });
  const setUrl = (t: string, v: string) => setUrls((p) => ({ ...p, [t]: v }));

  async function create() {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b && bookingId !== OWN) return;
    if (!title) { setError("방송 제목을 입력하세요."); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/live-sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(b && { bookingId, facilityId: b.facilityId }), title, snsChannels: Object.entries(urls).filter(([, u]) => u.trim()).map(([type, url]) => ({ type, url: url.trim() })) }),
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
        <Label htmlFor="lc-youtube">유튜브 방송 주소 (선택)</Label>
        <Input id="lc-youtube" type="url" inputMode="url" value={urls.YOUTUBE} onChange={(e) => setUrl("YOUTUBE", e.target.value)} placeholder="https://www.youtube.com/live/..." />
        <p className="mt-1 text-xs text-slate-500">방송은 내 채널(유튜브 · 인스타그램 · 틱톡 등)에서 켭니다. 주소를 넣으면 구매자 주문 화면에 영상이 나오고, 나중에 방송 상세에서 넣어도 됩니다.</p>
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer select-none py-1 text-xs font-semibold text-brand-700">다른 채널 주소 넣기</summary>
          <div className="mt-2 space-y-2">
            {([["INSTAGRAM", "인스타그램", "https://www.instagram.com/내계정"], ["TIKTOK", "틱톡", "https://www.tiktok.com/@내계정/live"], ["ETC", "기타 채널", "https://"]] as const).map(([t, label, ph]) => (
              <div key={t}><Label htmlFor={`lc-${t}`}>{label}</Label><Input id={`lc-${t}`} type="url" inputMode="url" value={urls[t]} onChange={(e) => setUrl(t, e.target.value)} placeholder={ph} /></div>
            ))}
          </div>
        </details>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={create} disabled={loading}>{loading ? "생성 중..." : "라이브 세션 생성"}</Button>
    </div>
  );
}
