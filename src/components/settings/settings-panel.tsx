"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Settings, User, Lock, Bell, Calendar, Info,
  Instagram, Youtube, Music2, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { getProfileImage } from "@/lib/profile";
import { cn } from "@/lib/utils";

type BookingRow = { id: string; facilityName: string; dateLabel: string; status: string };

export type SettingsPanelProps = {
  role: string;
  roleLabel: string;
  email: string;
  name: string;
  phone: string;
  companyName: string;
  createdAtLabel: string;
  profileImageIndex: number;
  isDemo: boolean;
  showBookings: boolean;
  bookings: BookingRow[];
};

const BOOKING_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: "승인 대기", cls: "bg-amber-100 text-amber-700" },
  APPROVED:  { label: "승인됨",   cls: "bg-emerald-100 text-emerald-700" },
  REJECTED:  { label: "거절됨",   cls: "bg-red-100 text-red-700" },
  CANCELLED: { label: "취소됨",   cls: "bg-gray-100 text-gray-600" },
  COMPLETED: { label: "완료",     cls: "bg-blue-100 text-blue-700" },
};

function Banner({ tone, text }: { tone: "success" | "error"; text: string }) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium",
      tone === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200",
    )}>
      <Icon className="h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

export function SettingsPanel(props: SettingsPanelProps) {
  const { role, roleLabel, email, createdAtLabel, isDemo, showBookings, bookings } = props;

  const TABS = [
    { key: "profile", label: "프로필 관리", icon: User },
    { key: "password", label: "비밀번호 변경", icon: Lock },
    { key: "notifications", label: "알림 설정", icon: Bell },
    { key: "account", label: "계정 정보", icon: Info },
    ...(showBookings ? [{ key: "bookings", label: "예약 현황", icon: Calendar }] : []),
  ] as const;

  const [tab, setTab] = useState<string>("profile");

  // ---- 프로필 관리 ----
  const [name, setName] = useState(props.name);
  const [phone, setPhone] = useState(props.phone);
  const [sns, setSns] = useState({ instagram: "", youtube: "", tiktok: "" });
  const [imageIndex, setImageIndex] = useState(props.profileImageIndex);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // ---- 비밀번호 ----
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // ---- 알림 ----
  const [notif, setNotif] = useState({ order: true, settlement: true, live: true });

  const snsKey = `sb.sns.${email}`;
  const notifKey = `sb.notif.${email}`;

  useEffect(() => {
    try {
      const s = localStorage.getItem(snsKey);
      if (s) setSns((prev) => ({ ...prev, ...JSON.parse(s) }));
      const n = localStorage.getItem(notifKey);
      if (n) setNotif((prev) => ({ ...prev, ...JSON.parse(n) }));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile() {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      localStorage.setItem(snsKey, JSON.stringify(sns));
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, profileImageIndex: imageIndex }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        setProfileMsg({ tone: "error", text: json?.error ?? "저장에 실패했습니다." });
      } else if (json?.data?.demo) {
        setProfileMsg({ tone: "success", text: "SNS·프로필 사진 선택은 이 브라우저에 반영됐습니다. (데모 계정은 서버 저장 안 됨)" });
      } else {
        setProfileMsg({ tone: "success", text: "프로필이 저장되었습니다." });
      }
    } catch {
      setProfileMsg({ tone: "error", text: "네트워크 오류로 저장하지 못했습니다." });
    } finally {
      setProfileSaving(false);
    }
  }

  async function changePassword() {
    setPwMsg(null);
    if (pw.next.length < 8) { setPwMsg({ tone: "error", text: "새 비밀번호는 8자 이상이어야 합니다." }); return; }
    if (pw.next !== pw.confirm) { setPwMsg({ tone: "error", text: "새 비밀번호가 서로 일치하지 않습니다." }); return; }
    setPwSaving(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        setPwMsg({ tone: "error", text: json?.error ?? "비밀번호 변경에 실패했습니다." });
      } else {
        setPwMsg({ tone: "success", text: "비밀번호가 변경되었습니다." });
        setPw({ current: "", next: "", confirm: "" });
      }
    } catch {
      setPwMsg({ tone: "error", text: "네트워크 오류로 변경하지 못했습니다." });
    } finally {
      setPwSaving(false);
    }
  }

  function toggleNotif(key: keyof typeof notif) {
    setNotif((prev) => {
      const nx = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(notifKey, JSON.stringify(nx)); } catch { /* ignore */ }
      return nx;
    });
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
          <Settings className="h-6 w-6 text-brand-600" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-navy">설정</h1>
          <p className="text-sm text-muted-foreground">{roleLabel} 계정 · 프로필과 보안, 알림을 관리합니다.</p>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
                active ? "border-brand-500 text-brand-600" : "border-transparent text-muted-foreground hover:text-navy",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {isDemo && (
        <Banner tone="error" text="데모 계정으로 로그인되어 있습니다. 프로필/비밀번호 변경은 실제 저장되지 않습니다." />
      )}

      {/* ===== 프로필 관리 ===== */}
      {tab === "profile" && (
        <div className="rounded-2xl border border-border bg-white p-6 space-y-6 max-w-3xl">
          <div className="flex items-center gap-4">
            <Image
              src={getProfileImage(imageIndex)}
              alt="프로필"
              width={72}
              height={72}
              className="rounded-full object-cover border border-brand-200 bg-white"
              style={{ height: 72, width: 72 }}
            />
            <div>
              <p className="font-bold text-navy">프로필 사진</p>
              <p className="text-xs text-muted-foreground">사진을 바꾸기 전까지 랜덤 배정된 이미지가 표시됩니다.</p>
            </div>
          </div>

          {/* 사진 선택 그리드 */}
          <div>
            <Label>프로필 사진 선택</Label>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setImageIndex(idx)}
                  className={cn(
                    "relative aspect-square rounded-full overflow-hidden border-2 transition",
                    imageIndex === idx ? "border-brand-500 ring-2 ring-brand-200" : "border-transparent hover:border-brand-300",
                  )}
                  aria-label={`프로필 이미지 ${idx}`}
                >
                  <Image src={getProfileImage(idx)} alt="" fill className="object-cover" sizes="48px" />
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" />
            </div>
            <div>
              <Label>연락처</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />
            </div>
          </div>

          <div className="space-y-3">
            <Label>SNS 링크</Label>
            <div className="flex items-center gap-2">
              <Instagram className="h-5 w-5 text-pink-500 shrink-0" />
              <Input value={sns.instagram} onChange={(e) => setSns({ ...sns, instagram: e.target.value })} placeholder="인스타그램 URL 또는 @핸들" />
            </div>
            <div className="flex items-center gap-2">
              <Youtube className="h-5 w-5 text-red-500 shrink-0" />
              <Input value={sns.youtube} onChange={(e) => setSns({ ...sns, youtube: e.target.value })} placeholder="유튜브 채널 URL" />
            </div>
            <div className="flex items-center gap-2">
              <Music2 className="h-5 w-5 text-navy shrink-0" />
              <Input value={sns.tiktok} onChange={(e) => setSns({ ...sns, tiktok: e.target.value })} placeholder="틱톡 URL 또는 @핸들" />
            </div>
          </div>

          {profileMsg && <Banner tone={profileMsg.tone} text={profileMsg.text} />}
          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={profileSaving}>{profileSaving ? "저장 중…" : "프로필 저장"}</Button>
          </div>
        </div>
      )}

      {/* ===== 비밀번호 변경 ===== */}
      {tab === "password" && (
        <div className="rounded-2xl border border-border bg-white p-6 space-y-4 max-w-lg">
          <div>
            <Label>현재 비밀번호</Label>
            <Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder="현재 비밀번호" autoComplete="current-password" />
          </div>
          <div>
            <Label>새 비밀번호</Label>
            <Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="새 비밀번호 (8자 이상)" autoComplete="new-password" />
          </div>
          <div>
            <Label>새 비밀번호 확인</Label>
            <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} placeholder="새 비밀번호 다시 입력" autoComplete="new-password" />
          </div>
          {pwMsg && <Banner tone={pwMsg.tone} text={pwMsg.text} />}
          <div className="flex justify-end">
            <Button onClick={changePassword} disabled={pwSaving}>{pwSaving ? "변경 중…" : "비밀번호 변경"}</Button>
          </div>
        </div>
      )}

      {/* ===== 알림 설정 ===== */}
      {tab === "notifications" && (
        <div className="rounded-2xl border border-border bg-white p-2 max-w-2xl divide-y divide-border">
          {[
            { key: "order" as const, title: "주문 알림", desc: "새 주문·주문 상태 변경 시 알림을 받습니다." },
            { key: "settlement" as const, title: "정산 알림", desc: "정산 확정·지급 시 알림을 받습니다." },
            { key: "live" as const, title: "라이브 알림", desc: "라이브 방송 예약·시작 시 알림을 받습니다." },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4 px-4 py-4">
              <div>
                <p className="font-bold text-navy">{row.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{row.desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notif[row.key]}
                onClick={() => toggleNotif(row.key)}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors shrink-0",
                  notif[row.key] ? "bg-brand-500" : "bg-gray-300",
                )}
              >
                <span className={cn(
                  "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  notif[row.key] && "translate-x-5",
                )} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ===== 계정 정보 ===== */}
      {tab === "account" && (
        <div className="rounded-2xl border border-border bg-white p-6 max-w-2xl">
          <dl className="divide-y divide-border">
            {[
              { label: "이메일", value: email },
              { label: "역할", value: roleLabel },
              { label: "가입일", value: createdAtLabel },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between py-3.5">
                <dt className="text-sm text-muted-foreground">{r.label}</dt>
                <dd className="text-sm font-semibold text-navy">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">계정 정보는 읽기 전용입니다. 변경이 필요하면 관리자에게 문의하세요.</p>
        </div>
      )}

      {/* ===== 예약 현황 ===== */}
      {tab === "bookings" && showBookings && (
        <div className="rounded-2xl border border-border bg-white overflow-hidden max-w-3xl">
          {bookings.length === 0 ? (
            <div className="p-10 text-center">
              <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">예약된 라이브·방송 일정이 없습니다.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {bookings.map((b) => {
                const st = BOOKING_STATUS[b.status] ?? { label: b.status, cls: "bg-gray-100 text-gray-600" };
                return (
                  <li key={b.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <p className="font-bold text-navy truncate">{b.facilityName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{b.dateLabel}</p>
                    </div>
                    <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0", st.cls)}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
