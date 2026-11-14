"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Warehouse, Clapperboard, Store, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FormState = {
  name: string; type: "STUDIO" | "WAREHOUSE" | "SHOWROOM"; region: string; address: string;
  openTime: string; closeTime: string;
  description: string; equipment: string; specialty: string; liveSpaceInfo: string;
  operationType: "DIRECT" | "PARTNER"; publish: boolean;
  partnerName: string; partnerContactName: string; partnerContactPhone: string; partnerContactEmail: string;
};

const REGIONS = ["서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

export function FacilityRegisterForm() {
  const router = useRouter();
  const [f, setF] = useState<FormState>({
    name: "", type: "STUDIO", region: "서울", address: "",
    openTime: "09:00", closeTime: "22:00", description: "", equipment: "", specialty: "", liveSpaceInfo: "",
    operationType: "DIRECT", publish: false,
    partnerName: "", partnerContactName: "", partnerContactPhone: "", partnerContactEmail: "",
  });
  const [published, setPublished] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((prev) => ({ ...prev, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/facility/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setError(json.error ?? "등록에 실패했습니다."); return; }
      setDone(json.data?.name ?? f.name);
      setPublished(json.data?.status === "APPROVED");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <p className="mt-3 text-lg font-bold text-navy">&lsquo;{done}&rsquo;을(를) 등록했습니다</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {published ? "셀러에게 공개되어 바로 예약을 받을 수 있습니다." : "비공개(준비 중)로 저장했습니다. 사진 · 일정 · 상품을 준비한 뒤 창고 목록에서 공개하세요."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => router.push("/facility/profile")}>창고(스튜디오) 정보 보기</Button>
            <Button onClick={() => { setDone(null); setF((p) => ({ ...p, name: "", address: "", description: "" })); }}>하나 더 등록</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="grid items-start gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>기본 정보</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>공간 유형</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {([
                { v: "STUDIO", label: "스튜디오", desc: "촬영·라이브 방송 공간", icon: Clapperboard },
                { v: "WAREHOUSE", label: "창고", desc: "상품 보관·현장 방송 공간", icon: Warehouse },
                { v: "SHOWROOM", label: "쇼룸", desc: "상품 전시·체험 · 방송 공간", icon: Store },
              ] as const).map((o) => (
                <button
                  type="button" key={o.v} onClick={() => set("type", o.v)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                    f.type === o.v ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-border hover:border-brand-300",
                  )}
                >
                  <o.icon className={cn("h-5 w-5", f.type === o.v ? "text-brand-600" : "text-muted-foreground")} />
                  <span>
                    <span className="block text-sm font-bold text-navy">{o.label}</span>
                    <span className="block text-xs text-muted-foreground">{o.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>운영 형태</Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="운영 형태">
              {([
                { v: "DIRECT", label: "직영", desc: "스토리지마켓이 직접 운영" },
                { v: "PARTNER", label: "제휴", desc: "긴밀하게 연동된 제휴 창고" },
              ] as const).map((o) => (
                <button type="button" key={o.v} role="radio" aria-checked={f.operationType === o.v} onClick={() => set("operationType", o.v)}
                  className={cn("rounded-xl border p-3 text-left transition", f.operationType === o.v ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-border hover:border-brand-300")}>
                  <span className="block text-sm font-bold text-navy">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.desc}</span>
                </button>
              ))}
            </div>
          </div>
          {f.operationType === "PARTNER" && (
            <div className="space-y-3 rounded-xl border border-border bg-slate-50 p-3">
              <p className="text-xs text-slate-600">제휴 창고는 계정 없이 정보만 저장합니다. 담당자 메일을 넣으면 새 예약 · 출고할 주문 알림을 메일로도 보냅니다.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="fr-pname">제휴 업체명</Label><Input id="fr-pname" value={f.partnerName} onChange={(e) => set("partnerName", e.target.value)} maxLength={60} /></div>
                <div><Label htmlFor="fr-pcontact">담당자</Label><Input id="fr-pcontact" value={f.partnerContactName} onChange={(e) => set("partnerContactName", e.target.value)} maxLength={40} /></div>
                <div><Label htmlFor="fr-pphone">담당자 연락처</Label><Input id="fr-pphone" inputMode="tel" value={f.partnerContactPhone} onChange={(e) => set("partnerContactPhone", e.target.value)} maxLength={30} /></div>
                <div><Label htmlFor="fr-pemail">담당자 메일</Label><Input id="fr-pemail" type="email" value={f.partnerContactEmail} onChange={(e) => set("partnerContactEmail", e.target.value)} maxLength={120} /></div>
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="fr-name">창고(스튜디오) 이름 *</Label>
            <Input id="fr-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="예: 성수 라이브 스튜디오 A" maxLength={60} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="fr-region">지역 *</Label>
              <Select id="fr-region" value={f.region} onChange={(e) => set("region", e.target.value)}>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="fr-address">주소 *</Label>
              <Input id="fr-address" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="도로명 주소와 상세 주소" maxLength={200} required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>이용료</Label>
              <p className="flex h-11 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-700">무료 (셀러 이용료 없음)</p>
            </div>
            <div>
              <Label htmlFor="fr-open">운영 시작</Label>
              <Input id="fr-open" type="time" value={f.openTime} onChange={(e) => set("openTime", e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="fr-close">운영 종료</Label>
              <Input id="fr-close" type="time" value={f.closeTime} onChange={(e) => set("closeTime", e.target.value)} required />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>공간 안내</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="fr-desc">소개</Label>
            <Textarea id="fr-desc" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="공간의 특징, 주차·출입 안내 등을 적어주세요." maxLength={2000} rows={4} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fr-spec">전문 카테고리</Label>
              <Input id="fr-spec" value={f.specialty} onChange={(e) => set("specialty", e.target.value)} placeholder="예: 의류, 코스메틱, 식품 (쉼표로 구분)" maxLength={200} />
            </div>
            <div>
              <Label htmlFor="fr-eq">보유 장비</Label>
              <Input id="fr-eq" value={f.equipment} onChange={(e) => set("equipment", e.target.value)} placeholder="예: 링라이트, 4K 카메라, 크로마키" maxLength={500} />
            </div>
          </div>
          <div>
            <Label htmlFor="fr-live">라이브 공간 안내</Label>
            <Textarea id="fr-live" value={f.liveSpaceInfo} onChange={(e) => set("liveSpaceInfo", e.target.value)} placeholder="조명·인터넷 속도·방음 등 방송 환경을 적어주세요." maxLength={1000} rows={3} />
          </div>
        </CardContent>
      </Card>

      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy xl:col-span-2">
        <input type="checkbox" className="h-4 w-4" checked={f.publish} onChange={(e) => set("publish", e.target.checked)} />
        바로 공개 (끄면 비공개 · 준비 중으로 저장)
      </label>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 xl:col-span-2">{error}</p>}
      <div className="flex justify-end gap-2 xl:col-span-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>취소</Button>
        <Button type="submit" disabled={saving}>
          {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />등록 중...</> : "등록"}
        </Button>
      </div>
    </form>
  );
}
