"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tag, Camera, FileText, CheckCircle2, Pencil, X, Save } from "lucide-react";

const SPECIALTY_OPTIONS = [
  "의류", "코스메틱", "패션잡화", "식품", "전자제품",
  "홈리빙", "스포츠", "반려동물", "유아동", "도서/취미",
];

const SPECIALTY_COLORS: Record<string, string> = {
  "의류": "text-purple-700 bg-purple-50 border-purple-200 data-[active=true]:bg-purple-100",
  "코스메틱": "text-pink-700 bg-pink-50 border-pink-200 data-[active=true]:bg-pink-100",
  "패션잡화": "text-blue-700 bg-blue-50 border-blue-200 data-[active=true]:bg-blue-100",
  "식품": "text-green-700 bg-green-50 border-green-200 data-[active=true]:bg-green-100",
  "전자제품": "text-slate-700 bg-slate-100 border-slate-300 data-[active=true]:bg-slate-200",
  "홈리빙": "text-amber-700 bg-amber-50 border-amber-200 data-[active=true]:bg-amber-100",
  "스포츠": "text-orange-700 bg-orange-50 border-orange-200 data-[active=true]:bg-orange-100",
  "반려동물": "text-teal-700 bg-teal-50 border-teal-200 data-[active=true]:bg-teal-100",
  "유아동": "text-cyan-700 bg-cyan-50 border-cyan-200 data-[active=true]:bg-cyan-100",
  "도서/취미": "text-indigo-700 bg-indigo-50 border-indigo-200 data-[active=true]:bg-indigo-100",
};

export function FacilityProfileEdit({
  facilityId,
  initialSpecialty,
  initialLiveSpaceInfo,
  initialDescription,
}: {
  facilityId: string;
  initialSpecialty: string;
  initialLiveSpaceInfo: string;
  initialDescription: string;
}) {
  const initial = initialSpecialty
    ? initialSpecialty.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(initial);
  const [liveSpaceInfo, setLiveSpaceInfo] = useState(initialLiveSpaceInfo ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function toggle(item: string) {
    setSelected((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
    );
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/facility/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId,
          specialty: selected.join(","),
          liveSpaceInfo: liveSpaceInfo.trim(),
          description: description.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "저장 실패");
        return;
      }
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-brand-200">
      <CardContent className="pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">Specialty & Space</p>
            <h3 className="mt-0.5 text-base font-extrabold text-navy">전문 분야 · 공간 설정</h3>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> 저장됨
              </span>
            )}
            {editing ? (
              <>
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setSelected(initial); setLiveSpaceInfo(initialLiveSpaceInfo ?? ""); setDescription(initialDescription ?? ""); }} className="gap-1">
                  <X className="h-3.5 w-3.5" /> 취소
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "저장 중..." : "저장"}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1">
                <Pencil className="h-3.5 w-3.5" /> 편집
              </Button>
            )}
          </div>
        </div>

        {/* 전문 분야 선택 */}
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <Tag className="h-4 w-4 text-brand-600" />
            <p className="text-sm font-bold text-navy">주요 취급 카테고리</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SPECIALTY_OPTIONS.map((item) => {
              const isActive = selected.includes(item);
              const colorClass = SPECIALTY_COLORS[item] ?? "text-brand-700 bg-brand-50 border-brand-200";
              return (
                <button
                  key={item}
                  data-active={isActive}
                  onClick={() => editing && toggle(item)}
                  disabled={!editing}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${colorClass} ${
                    isActive ? "ring-2 ring-offset-1 ring-current" : ""
                  } ${editing ? "cursor-pointer hover:opacity-90" : "cursor-default"}`}
                >
                  {item}
                  {isActive && <span className="ml-1 opacity-70">✓</span>}
                </button>
              );
            })}
          </div>
          {editing && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              해당 분야를 클릭하여 추가/제거할 수 있습니다 (최대 5개 권장)
            </p>
          )}
        </div>

        {/* 라이브·촬영 공간 안내 */}
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <Camera className="h-4 w-4 text-brand-600" />
            <p className="text-sm font-bold text-navy">라이브·촬영 공간 안내</p>
          </div>
          {editing ? (
            <textarea
              value={liveSpaceInfo}
              onChange={(e) => setLiveSpaceInfo(e.target.value)}
              rows={4}
              placeholder="예) 메인 스튜디오: 65㎡, 크로마키 배경, 4K 카메라 3대, 링라이트 세트&#10;부속 공간: 의상 준비실, 분장실 별도 제공&#10;조명: 전문 조명 시스템 완비"
              className="w-full resize-none rounded-xl border border-border bg-[#FAFAF8] px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          ) : liveSpaceInfo ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm leading-relaxed text-amber-900 whitespace-pre-line">{liveSpaceInfo}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground rounded-xl bg-muted/30 p-3">
              라이브·촬영 공간에 대한 안내를 입력해주세요
            </p>
          )}
        </div>

        {/* 시설 소개 */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-600" />
            <p className="text-sm font-bold text-navy">시설 소개</p>
          </div>
          {editing ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="시설 특징, 제공 서비스, 이용 조건 등을 입력하세요"
              className="w-full resize-none rounded-xl border border-border bg-[#FAFAF8] px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          ) : description ? (
            <p className="text-sm text-muted-foreground rounded-xl bg-muted/30 p-3 leading-relaxed">
              {description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground rounded-xl bg-muted/30 p-3">
              시설 소개를 입력해주세요
            </p>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-500">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
