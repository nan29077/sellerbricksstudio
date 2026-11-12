"use client";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings, User, Lock, Bell, Calendar, Info,
  Instagram, Youtube, Music2, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PROFILE_ANIMALS, getProfileImage } from "@/lib/profile";
import { WithdrawSection } from "./withdraw-section";
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
  avatarUrl: string | null;
  isDemo: boolean;
  showBookings: boolean;
  bookings: BookingRow[];
  /** 서버에 저장된 값 (없으면 null — 예전에 이 기기에만 저장한 값이 있으면 옮겨 온다) */
  sns?: { instagram: string; youtube: string; tiktok: string } | null;
  notifyPrefs?: { order: boolean; settlement: boolean; live: boolean } | null;
};

const BOOKING_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: "승인 대기", cls: "bg-amber-100 text-amber-700" },
  APPROVED:  { label: "승인됨",   cls: "bg-emerald-100 text-emerald-700" },
  REJECTED:  { label: "거절됨",   cls: "bg-red-100 text-red-700" },
  CANCELLED: { label: "취소됨",   cls: "bg-gray-100 text-gray-600" },
  COMPLETED: { label: "완료",     cls: "bg-blue-100 text-blue-700" },
};

const PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function prepareProfilePhoto(file: File): Promise<string> {
  if (!PROFILE_PHOTO_TYPES.includes(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error("10MB 이하의 JPG, PNG, WebP 사진을 선택해 주세요.");
  }

  const photo = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 320;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("사진을 준비할 수 없습니다.");
    const side = Math.min(photo.width, photo.height);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(photo, (photo.width - side) / 2, (photo.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    photo.close();
  }
}

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
  const router = useRouter();
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
  const [sns, setSns] = useState(props.sns ?? { instagram: "", youtube: "", tiktok: "" });
  const [imageIndex, setImageIndex] = useState(props.profileImageIndex);
  const [avatarUrl, setAvatarUrl] = useState(props.avatarUrl);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // ---- 비밀번호 ----
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // ---- 알림 ----
  const [notif, setNotif] = useState(props.notifyPrefs ?? { order: true, settlement: true, live: true });
  const [notifMsg, setNotifMsg] = useState("");

  const snsKey = `sb.sns.${email}`;
  const notifKey = `sb.notif.${email}`;

  // 예전 버전은 SNS 주소 · 알림 설정을 이 기기(브라우저)에만 저장했다. 서버에 값이 없으면 한 번 옮겨 온다.
  useEffect(() => {
    if (isDemo) return;
    try {
      const s = localStorage.getItem(snsKey);
      if (s && !props.sns) {
        const v = { instagram: "", youtube: "", tiktok: "", ...JSON.parse(s) };
        setSns(v);
        void fetch("/api/me/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sns: v }) });
      }
      const n = localStorage.getItem(notifKey);
      if (n && !props.notifyPrefs) {
        const v = { order: true, settlement: true, live: true, ...JSON.parse(n) };
        setNotif(v);
        void fetch("/api/me/notification-prefs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
      }
      localStorage.removeItem(snsKey); localStorage.removeItem(notifKey);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function choosePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setReadingPhoto(true);
    setPhotoError("");
    setProfileMsg(null);
    try {
      setAvatarUrl(await prepareProfilePhoto(file));
      setPhotoChanged(true);
    } catch (error) {
      setPhotoError(error instanceof DOMException ? "사진을 열 수 없습니다. 다른 사진을 선택해 주세요." :
        error instanceof Error ? error.message : "사진을 불러오지 못했습니다.");
    } finally {
      setReadingPhoto(false);
    }
  }

  async function saveProfile() {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, phone, profileImageIndex: imageIndex, sns,
          ...(photoChanged ? { avatarUrl } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        setProfileMsg({ tone: "error", text: json?.error ?? "저장에 실패했습니다." });
      } else if (json?.data?.demo) {
        setProfileMsg({ tone: "success", text: "데모 화면에 선택이 반영되었습니다. 저장하려면 회원 계정으로 로그인해 주세요." });
      } else {
        setProfileMsg({ tone: "success", text: "프로필이 저장되었습니다." });
        setPhotoChanged(false);
        router.refresh();
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
        setPwMsg({ tone: "success", text: "비밀번호가 변경되었습니다. 보안을 위해 다시 로그인해 주세요." });
        setTimeout(() => { void signOut({ callbackUrl: "/login" }); }, 1500);
        setPw({ current: "", next: "", confirm: "" });
      }
    } catch {
      setPwMsg({ tone: "error", text: "네트워크 오류로 변경하지 못했습니다." });
    } finally {
      setPwSaving(false);
    }
  }

  async function toggleNotif(key: keyof typeof notif) {
    const prev = notif;
    const nx = { ...prev, [key]: !prev[key] };
    setNotif(nx); setNotifMsg("");
    if (isDemo) { setNotifMsg("데모 계정은 설정이 저장되지 않습니다."); return; }
    const res = await fetch("/api/me/notification-prefs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nx) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({ ok: false })) : { ok: false };
    if (!json.ok) { setNotif(prev); setNotifMsg(json.error ?? "저장하지 못했습니다. 잠시 후 다시 시도해 주세요."); return; }
    setNotifMsg("저장했습니다.");
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
      <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-white p-1.5">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={active}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors sm:px-4",
                active ? "bg-navy text-white" : "text-muted-foreground hover:bg-brand-50 hover:text-navy",
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
        <div className="space-y-5 rounded-2xl border border-border bg-white p-4 sm:p-6">
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <div className="min-w-0 space-y-4">
              <div className="flex items-center gap-4">
                <Image
                  src={avatarUrl ?? getProfileImage(imageIndex)}
                  alt="프로필"
                  width={72}
                  height={72}
                  unoptimized
                  className="h-[72px] w-[72px] shrink-0 rounded-full border border-brand-200 bg-white object-cover"
                />
                <div>
                  <p className="font-bold text-navy">프로필 사진</p>
                  <p className="mt-1 text-xs text-muted-foreground">{avatarUrl ? "내 사진이 프로필에 우선 표시됩니다." : "선택한 동물 캐릭터가 프로필에 표시됩니다."}</p>
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="relative">
                    <input type="file" accept={PROFILE_PHOTO_TYPES.join(",")} onChange={choosePhoto} disabled={profileSaving || readingPhoto} className="peer sr-only" />
                    <span className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border bg-white px-4 text-sm font-semibold text-navy hover:bg-brand-50 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-disabled:pointer-events-none peer-disabled:opacity-50">
                      {readingPhoto ? "사진 준비 중…" : avatarUrl ? "내 사진 바꾸기" : "내 사진 선택"}
                    </span>
                  </label>
                  {avatarUrl && <Button type="button" variant="ghost" disabled={profileSaving || readingPhoto} onClick={() => {
                    setAvatarUrl(null);
                    setPhotoChanged(true);
                    setPhotoError("");
                    setProfileMsg(null);
                  }}>내 사진 제거</Button>}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">JPG, PNG, WebP · 10MB 이하</p>
                {photoError && <p role="alert" className="mt-2 text-xs text-red-700">{photoError}</p>}
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-navy">동물 캐릭터 선택</p>
                {avatarUrl && <p className="mb-2 text-xs text-muted-foreground">내 사진을 제거하면 여기서 선택한 캐릭터가 표시됩니다.</p>}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,48px))] gap-2">
                  {PROFILE_ANIMALS.map((animal, index) => (
                    <button
                      key={animal.id}
                      type="button"
                      disabled={profileSaving}
                      onClick={() => { setImageIndex(index + 1); setProfileMsg(null); }}
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-full border-2 transition",
                        imageIndex === index + 1 ? "border-brand-500 ring-2 ring-brand-200" : "border-transparent hover:border-brand-300",
                      )}
                      aria-label={animal.label}
                      title={animal.label}
                      aria-pressed={imageIndex === index + 1}
                    >
                      <Image src={getProfileImage(index + 1)} alt="" fill unoptimized className="object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="min-w-0 space-y-4 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="settings-name">이름</Label>
                  <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" />
                </div>
                <div>
                  <Label htmlFor="settings-phone">연락처</Label>
                  <Input id="settings-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-navy">SNS 링크</p>
                <div className="flex items-center gap-2">
                  <Instagram className="h-5 w-5 shrink-0 text-pink-500" />
                  <Input aria-label="인스타그램" value={sns.instagram} onChange={(e) => setSns({ ...sns, instagram: e.target.value })} placeholder="인스타그램 URL 또는 @핸들" />
                </div>
                <div className="flex items-center gap-2">
                  <Youtube className="h-5 w-5 shrink-0 text-red-500" />
                  <Input aria-label="유튜브" value={sns.youtube} onChange={(e) => setSns({ ...sns, youtube: e.target.value })} placeholder="유튜브 채널 URL" />
                </div>
                <div className="flex items-center gap-2">
                  <Music2 className="h-5 w-5 shrink-0 text-navy" />
                  <Input aria-label="틱톡" value={sns.tiktok} onChange={(e) => setSns({ ...sns, tiktok: e.target.value })} placeholder="틱톡 URL 또는 @핸들" />
                </div>
              </div>
            </div>
          </div>

          {profileMsg && <Banner tone={profileMsg.tone} text={profileMsg.text} />}
          <div className="flex justify-end border-t pt-4">
            <Button onClick={saveProfile} disabled={profileSaving || readingPhoto}>{profileSaving ? "저장 중…" : "프로필 저장"}</Button>
          </div>
        </div>
      )}

      {/* ===== 비밀번호 변경 ===== */}
      {tab === "password" && (
        <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-white p-4 sm:p-6">
          <div>
            <Label>현재 비밀번호</Label>
            <Input aria-label="현재 비밀번호" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder="현재 비밀번호" autoComplete="current-password" />
          </div>
          <div>
            <Label>새 비밀번호</Label>
            <Input aria-label="새 비밀번호" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="새 비밀번호 (8자 이상)" autoComplete="new-password" />
          </div>
          <div>
            <Label>새 비밀번호 확인</Label>
            <Input aria-label="새 비밀번호 확인" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} placeholder="새 비밀번호 다시 입력" autoComplete="new-password" />
          </div>
          {pwMsg && <Banner tone={pwMsg.tone} text={pwMsg.text} />}
          <div className="flex justify-end">
            <Button onClick={changePassword} disabled={pwSaving}>{pwSaving ? "변경 중…" : "비밀번호 변경"}</Button>
          </div>
        </div>
      )}

      {/* ===== 알림 설정 ===== */}
      {tab === "notifications" && (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {[
            { key: "order" as const, title: "주문 알림", desc: "새 주문·주문 상태 변경 시 알림을 받습니다." },
            { key: "settlement" as const, title: "정산 알림", desc: "정산 확정·지급 시 알림을 받습니다." },
            { key: "live" as const, title: "라이브 알림", desc: "라이브 방송 예약·시작 시 알림을 받습니다." },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-white p-4">
              <div>
                <p className="font-bold text-navy">{row.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{row.desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-label={row.title}
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
          <p className="text-xs text-muted-foreground sm:col-span-2 2xl:col-span-3">끈 알림은 앱 알림과 메일 모두 보내지 않습니다. 예약 · 계정 · 보안 관련 알림은 항상 받습니다.{notifMsg && <span role="status" className="ml-1 font-semibold text-navy">{notifMsg}</span>}</p>
        </div>
      )}

      {/* ===== 계정 정보 ===== */}
      {tab === "account" && (
        <div className="rounded-2xl border border-border bg-white p-4 sm:p-6">
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "이메일", value: email },
              { label: "역할", value: roleLabel },
              { label: "가입일", value: createdAtLabel },
            ].map((r) => (
              <div key={r.label} className="min-w-0 rounded-xl bg-[#F7F6F2] p-4">
                <dt className="text-sm text-muted-foreground">{r.label}</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-navy">{r.value}</dd>
              </div>
            ))}
          </dl>
          <EmailVerifyRow />
          <p className="mt-4 text-xs text-muted-foreground">계정 정보는 읽기 전용입니다. 변경이 필요하면 관리자에게 문의하세요.</p>
          {!isDemo && role !== "SUPER_ADMIN" && <WithdrawSection />}
        </div>
      )}

      {/* ===== 예약 현황 ===== */}
      {tab === "bookings" && showBookings && (
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
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

// 이메일 인증 상태 · 인증 메일 다시 보내기
function EmailVerifyRow() {
  const [state, setState] = useState<{ verified?: boolean; demo?: boolean } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; devLink?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/me/verify-email").then((r) => r.json()).then((j) => j?.ok && setState(j.data)).catch(() => {}); }, []);
  if (!state || state.demo) return null;
  async function resend() {
    setBusy(true); setMsg(null);
    const j = await fetch("/api/me/verify-email", { method: "POST" }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false);
    setMsg(j.ok ? { ok: true, text: "인증 메일을 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.", devLink: j.data?.devLink } : { ok: false, text: j.error ?? "메일을 보내지 못했습니다." });
  }
  return (
    <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-navy">
        이메일 인증 <b className={state.verified ? "text-emerald-700" : "text-amber-700"}>{state.verified ? "완료" : "필요"}</b>
        {!state.verified && <span className="ml-2 text-xs text-muted-foreground">비밀번호 찾기와 중요 알림을 받으려면 인증해 주세요.</span>}
      </p>
      {!state.verified && <Button size="sm" variant="outline" onClick={resend} disabled={busy}>{busy ? "보내는 중…" : "인증 메일 보내기"}</Button>}
      {msg && <p role="status" className={`text-xs sm:basis-full ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}{msg.devLink && <> · <a className="underline" href={msg.devLink}>개발용 링크</a></>}</p>}
    </div>
  );
}
