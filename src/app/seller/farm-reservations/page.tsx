"use client";
import { useState } from "react";
import {
  Building2, MapPin, CheckCircle2, CalendarDays,
  Users, FileText, ChevronDown, Send,
  Sprout, Leaf, Factory, Warehouse, Video, Package,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

/* ───── 타입 ───── */
type FacilityType = "FARM" | "RANCH" | "FACTORY" | "WAREHOUSE" | "STUDIO" | "SORTING";
type FacilityStatus = "AVAILABLE" | "FULL";
type ReservationStatus = "PENDING" | "APPROVED" | "REJECTED";
type FilterKey = "ALL" | "FARM_RANCH" | "FACTORY_WAREHOUSE" | "STUDIO";

interface Facility {
  id: string;
  name: string;
  region: string;
  type: FacilityType;
  feature: string;
  desc: string;
  status: FacilityStatus;
}

interface MyReservation {
  id: string;
  facilityName: string;
  facilityType: FacilityType;
  date: string;
  visitors: number;
  purpose: string;
  status: ReservationStatus;
  memo: string;
}

/* ───── 유형 설정 ───── */
interface TypeConfig {
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  bannerClass: string;
  buttonClass: string;
  badgeClass: string;
  icon: LucideIcon;
}

const TYPE_CONFIG: Record<FacilityType, TypeConfig> = {
  FARM:      { label: "농장",         textColor: "text-emerald-700", bgColor: "bg-emerald-50",  borderColor: "border-emerald-200", bannerClass: "from-emerald-400 to-green-500",   buttonClass: "bg-emerald-600 hover:bg-emerald-700 text-white", badgeClass: "bg-emerald-50 text-emerald-700",  icon: Sprout    },
  RANCH:     { label: "목장",         textColor: "text-emerald-700", bgColor: "bg-emerald-50",  borderColor: "border-emerald-200", bannerClass: "from-emerald-400 to-teal-500",    buttonClass: "bg-emerald-600 hover:bg-emerald-700 text-white", badgeClass: "bg-emerald-50 text-emerald-700",  icon: Leaf      },
  FACTORY:   { label: "가공공장",     textColor: "text-blue-700",    bgColor: "bg-blue-50",     borderColor: "border-blue-200",    bannerClass: "from-blue-400 to-blue-600",       buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",       badgeClass: "bg-blue-50 text-blue-700",        icon: Factory   },
  WAREHOUSE: { label: "물류창고",     textColor: "text-orange-700",  bgColor: "bg-orange-50",   borderColor: "border-orange-200",  bannerClass: "from-orange-400 to-amber-500",    buttonClass: "bg-orange-600 hover:bg-orange-700 text-white",   badgeClass: "bg-orange-50 text-orange-700",    icon: Warehouse },
  STUDIO:    { label: "촬영스튜디오", textColor: "text-purple-700",  bgColor: "bg-purple-50",   borderColor: "border-purple-200",  bannerClass: "from-purple-400 to-violet-500",   buttonClass: "bg-purple-600 hover:bg-purple-700 text-white",   badgeClass: "bg-purple-50 text-purple-700",    icon: Video     },
  SORTING:   { label: "선별창고",     textColor: "text-orange-700",  bgColor: "bg-orange-50",   borderColor: "border-orange-200",  bannerClass: "from-orange-400 to-yellow-500",   buttonClass: "bg-orange-600 hover:bg-orange-700 text-white",   badgeClass: "bg-orange-50 text-orange-700",    icon: Package   },
};

/* ───── 더미 데이터 ───── */
const FACILITIES: Facility[] = [
  { id: "f1", name: "고창 복분자 농장",     region: "전북 고창",   type: "FARM",      feature: "복분자·딸기",      desc: "천연 복분자와 딸기를 산지에서 직접 수확·판매. 라이브 방송 최적 환경 완비.", status: "AVAILABLE" },
  { id: "f2", name: "제주 감귤 농장",       region: "제주 서귀포", type: "FARM",      feature: "감귤·한라봉",      desc: "제주 청정 지역에서 재배한 감귤·한라봉. 광활한 과수원에서 현장감 넘치는 라이브.", status: "AVAILABLE" },
  { id: "f3", name: "청양 구기자 농장",     region: "충남 청양",   type: "FARM",      feature: "구기자·고추",      desc: "청양의 대표 작물 구기자와 고추. 방문 탐색 및 가공 공정 견학 가능.", status: "AVAILABLE" },
  { id: "f4", name: "경기 물류 창고",       region: "경기 이천",   type: "WAREHOUSE", feature: "냉동·냉장 보관",   desc: "냉동·냉장 보관 설비와 포장 라인 완비. 식품 라이브 직배송 연동 가능.", status: "AVAILABLE" },
  { id: "f5", name: "서울 라이브 스튜디오", region: "서울 마포",   type: "STUDIO",    feature: "조명·음향 완비",   desc: "전문 조명·음향 장비 완비. 그린스크린 배경 지원, 라이브 커머스 전용 촬영 공간.", status: "AVAILABLE" },
  { id: "f6", name: "횡성 한우 목장",       region: "강원 횡성",   type: "RANCH",     feature: "한우·목초지",      desc: "강원도 청정 자연에서 자란 횡성 한우. 목장 체험과 프리미엄 라이브 콘텐츠 제작.", status: "AVAILABLE" },
  { id: "f7", name: "부산 수산 가공공장",   region: "부산 기장",   type: "FACTORY",   feature: "수산물 가공·HACCP", desc: "HACCP 인증 수산물 가공공장. 현장 공정 라이브 및 팩토리 투어 콘텐츠 가능.", status: "FULL"      },
  { id: "f8", name: "충북 과일 선별장",     region: "충북 충주",   type: "SORTING",   feature: "사과·배 선별",     desc: "충주 사과·배 전문 선별·포장 시설. 대용량 보관 창고 라이브 및 즉시 출고 연동.", status: "AVAILABLE" },
];

const MY_RESERVATIONS: MyReservation[] = [
  { id: "mr1", facilityName: "고창 복분자 농장",     facilityType: "FARM",   date: "2026-07-15", visitors: 3, purpose: "콘텐츠 촬영", status: "APPROVED", memo: "오전 촬영 희망, 수확 장면 포함 요청" },
  { id: "mr2", facilityName: "서울 라이브 스튜디오", facilityType: "STUDIO", date: "2026-07-28", visitors: 2, purpose: "라이브 방송", status: "PENDING",  memo: "그린스크린 세팅 및 조명 사전 점검 요청" },
];

const PURPOSES = ["콘텐츠 촬영", "라이브 방송", "제품 탐색", "공장 견학", "창고 이용", "기타"];

const STATUS_MAP: Record<ReservationStatus, { label: string; tone: "green" | "yellow" | "red" }> = {
  APPROVED: { label: "승인완료", tone: "green"  },
  PENDING:  { label: "대기중",   tone: "yellow" },
  REJECTED: { label: "거절됨",   tone: "red"    },
};

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "ALL",               label: "전체" },
  { key: "FARM_RANCH",        label: "농장·목장" },
  { key: "FACTORY_WAREHOUSE", label: "공장·창고" },
  { key: "STUDIO",            label: "스튜디오" },
];

function getFilteredFacilities(facilities: Facility[], filter: FilterKey): Facility[] {
  if (filter === "ALL")               return facilities;
  if (filter === "FARM_RANCH")        return facilities.filter(f => f.type === "FARM" || f.type === "RANCH");
  if (filter === "FACTORY_WAREHOUSE") return facilities.filter(f => f.type === "FACTORY" || f.type === "WAREHOUSE" || f.type === "SORTING");
  if (filter === "STUDIO")            return facilities.filter(f => f.type === "STUDIO");
  return facilities;
}

/* ───── 페이지 ───── */
export default function SellerFacilityReservations() {
  const [tab, setTab]               = useState<"list" | "my">("list");
  const [typeFilter, setTypeFilter] = useState<FilterKey>("ALL");

  const [form, setForm] = useState({
    facilityId: "",
    date: "",
    visitors: "",
    purpose: PURPOSES[0],
    memo: "",
  });
  const [submitted, setSubmitted]           = useState(false);
  const [myReservations, setMyReservations] = useState<MyReservation[]>(MY_RESERVATIONS);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.facilityId || !form.date || !form.visitors) return;
    const facility = FACILITIES.find(f => f.id === form.facilityId);
    if (!facility) return;
    const newRes: MyReservation = {
      id: `mr${Date.now()}`,
      facilityName: facility.name,
      facilityType: facility.type,
      date: form.date,
      visitors: Number(form.visitors),
      purpose: form.purpose,
      status: "PENDING",
      memo: form.memo,
    };
    setMyReservations(prev => [newRes, ...prev]);
    setSubmitted(true);
    setForm({ facilityId: "", date: "", visitors: "", purpose: PURPOSES[0], memo: "" });
    setTimeout(() => {
      setSubmitted(false);
      setTab("my");
    }, 1500);
  };

  const displayedFacilities = getFilteredFacilities(FACILITIES, typeFilter);

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">시설 예약</h1>
          <p className="mt-1 text-sm text-muted-foreground">농가·공장·창고·스튜디오까지 다양한 시설을 예약하고 라이브 콘텐츠를 제작하세요.</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 rounded-xl bg-muted/40 p-1 w-fit border border-border">
        {(["list", "my"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all ${
              tab === t
                ? "bg-white text-navy shadow-sm border border-border"
                : "text-muted-foreground hover:text-navy"
            }`}
          >
            {t === "list" ? "시설 목록" : "내 예약"}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 시설 목록 ── */}
      {tab === "list" && (
        <div className="space-y-4">
          {/* 유형 필터 */}
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map(ft => (
              <button
                key={ft.key}
                onClick={() => setTypeFilter(ft.key)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold border transition ${
                  typeFilter === ft.key
                    ? "bg-navy text-white border-navy"
                    : "bg-white text-muted-foreground border-border hover:border-navy/30 hover:text-navy"
                }`}
              >
                {ft.label}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedFacilities.map(facility => {
              const cfg = TYPE_CONFIG[facility.type];
              const IconComp = cfg.icon;
              return (
                <div
                  key={facility.id}
                  className={`bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition group ${cfg.borderColor}`}
                >
                  {/* 상단 컬러 배너 */}
                  <div className={`h-2 bg-gradient-to-r ${cfg.bannerClass}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cfg.bgColor} shrink-0`}>
                        <IconComp className={`h-5 w-5 ${cfg.textColor}`} />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ${cfg.badgeClass}`}>
                          {cfg.label}
                        </span>
                        <Badge tone={facility.status === "AVAILABLE" ? "green" : "red"}>
                          {facility.status === "AVAILABLE" ? "예약 가능" : "예약 마감"}
                        </Badge>
                      </div>
                    </div>
                    <h3 className="font-bold text-navy text-base mb-1">{facility.name}</h3>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {facility.region}
                    </p>
                    <p className={`text-xs font-semibold mb-3 ${cfg.textColor}`}>
                      대표 특징: {facility.feature}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-4">{facility.desc}</p>
                    <button
                      disabled={facility.status === "FULL"}
                      onClick={() => {
                        setForm(prev => ({ ...prev, facilityId: facility.id }));
                        setTab("my");
                      }}
                      className={`w-full rounded-xl py-2.5 text-sm font-semibold transition ${
                        facility.status === "AVAILABLE"
                          ? cfg.buttonClass
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      {facility.status === "AVAILABLE" ? "예약하기" : "예약 마감"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 탭 2: 내 예약 ── */}
      {tab === "my" && (
        <div className="space-y-6">

          {/* 예약 신청 폼 */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-6">
            <h2 className="text-base font-bold text-navy mb-4 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              시설 방문 예약 신청
            </h2>

            {submitted ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-emerald-600">
                <CheckCircle2 className="h-12 w-12" />
                <p className="text-base font-bold">신청 완료!</p>
                <p className="text-sm text-muted-foreground">관리자 승인 후 확정됩니다. 내 예약 목록으로 이동합니다.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 시설 선택 */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">시설 선택 *</label>
                  <div className="relative">
                    <select
                      required
                      value={form.facilityId}
                      onChange={e => setForm(p => ({ ...p, facilityId: e.target.value }))}
                      className="w-full appearance-none rounded-xl border border-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
                    >
                      <option value="">시설을 선택하세요</option>
                      {FACILITIES.filter(f => f.status === "AVAILABLE").map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.region}) — {TYPE_CONFIG[f.type].label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {/* 방문 희망일 + 방문 인원 */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">방문 희망일 *</label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">방문 인원 *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={20}
                      placeholder="인원 수 입력"
                      value={form.visitors}
                      onChange={e => setForm(p => ({ ...p, visitors: e.target.value }))}
                      className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
                    />
                  </div>
                </div>

                {/* 방문 목적 */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">방문 목적 *</label>
                  <div className="flex flex-wrap gap-2">
                    {PURPOSES.map(p => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setForm(prev => ({ ...prev, purpose: p }))}
                        className={`rounded-xl px-4 py-2 text-xs font-semibold transition border ${
                          form.purpose === p
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-muted-foreground border-border hover:border-emerald-300 hover:text-emerald-700"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 메모 */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">메모 (선택)</label>
                  <textarea
                    rows={3}
                    placeholder="방문 시 참고할 내용, 요청 사항 등을 자유롭게 입력하세요."
                    value={form.memo}
                    onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white font-semibold py-3 hover:bg-emerald-700 transition"
                >
                  <Send className="h-4 w-4" />
                  예약 신청
                </button>
              </form>
            )}
          </div>

          {/* 내 예약 내역 */}
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-bold text-navy flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                내 예약 내역
              </h2>
            </div>

            {myReservations.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                아직 예약 내역이 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {myReservations.map(r => {
                  const st  = STATUS_MAP[r.status];
                  const cfg = TYPE_CONFIG[r.facilityType];
                  const IconComp = cfg.icon;
                  return (
                    <div key={r.id} className="px-5 py-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${cfg.bgColor} shrink-0 mt-0.5`}>
                            <IconComp className={`h-4 w-4 ${cfg.textColor}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-navy text-sm">{r.facilityName}</p>
                              <span className={`inline-flex items-center rounded-lg px-1.5 py-0.5 text-[10px] font-semibold ${cfg.badgeClass}`}>
                                {cfg.label}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />{r.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />{r.visitors}명
                              </span>
                              <span>{r.purpose}</span>
                            </div>
                            {r.memo && (
                              <p className="mt-1.5 text-xs text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5 leading-relaxed">
                                {r.memo}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
