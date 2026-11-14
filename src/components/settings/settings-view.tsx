import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/rbac";
import { resolveProfileAvatar } from "@/lib/profile";
import { SettingsPanel } from "./settings-panel";
import { SellerPlatformsForm } from "./seller-platforms-form";
import { PayoutAccountForm } from "./payout-account-form";
import { readNotifyPrefs } from "@/lib/notify";

function fmtDate(d: Date): string {
  // 하이드레이션 불일치 방지를 위해 서버에서 문자열로 고정 포맷
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}. ${m}. ${day}`;
}

function fmtDateTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${fmtDate(d)} ${h}:${mm}`;
}

export async function SettingsView({ role, showBookings = false }: { role: string; showBookings?: boolean }) {
  const u = await getSessionUser();
  if (!u) return null; // 레이아웃에서 이미 로그인 가드됨

  const isDemo = u.id.startsWith("demo-");
  let avatar = resolveProfileAvatar(null, null, u.email ?? u.id);

  let name = u.name ?? "";
  let phone = "";
  let companyName = "";
  let createdAtLabel = "-";
  let sns: { instagram: string; youtube: string; tiktok: string } | null = null;
  let notifyPrefs: { order: boolean; settlement: boolean; live: boolean } | null = null;
  let livePlatforms: string[] = [];
  let livePlatformEtc = "";

  try {
    const dbUser = await prisma.user.findUnique({ where: { id: u.id }, include: { profile: true } });
    if (dbUser) {
      avatar = resolveProfileAvatar(dbUser.profileImageIndex, dbUser.profile?.avatarUrl, u.email ?? u.id);
      name = dbUser.profile?.name ?? name;
      phone = dbUser.profile?.phone ?? "";
      companyName = dbUser.profile?.companyName ?? "";
      createdAtLabel = fmtDate(dbUser.createdAt);
      const raw = dbUser.profile?.snsLinks as Record<string, unknown> | null | undefined;
      if (raw && typeof raw === "object") sns = { instagram: String(raw.instagram ?? ""), youtube: String(raw.youtube ?? ""), tiktok: String(raw.tiktok ?? "") };
      livePlatforms = dbUser.profile?.livePlatforms ?? [];
      livePlatformEtc = dbUser.profile?.livePlatformEtc ?? "";
      if (dbUser.profile?.notifyPrefs) notifyPrefs = readNotifyPrefs(dbUser.profile.notifyPrefs);
    }
  } catch { /* DB 미가동 등 — 기본값 사용 */ }

  let bookings: { id: string; facilityName: string; dateLabel: string; status: string }[] = [];
  if (showBookings) {
    try {
      const rows = await prisma.booking.findMany({
        where: role === "SELLER" ? { sellerId: u.id } : { facility: { ownerId: u.id } },
        include: { facility: { select: { name: true } } },
        orderBy: { startAt: "desc" },
        take: 20,
      });
      bookings = rows.map((b) => ({
        id: b.id,
        facilityName: b.facility?.name ?? "-",
        dateLabel: `${fmtDateTime(b.startAt)} ~ ${fmtDateTime(b.endAt)}`,
        status: b.status,
      }));
    } catch { /* DB 미가동 등 — 빈 목록 */ }
  }

  const payout = role === "SELLER" ? "정산 조정 · 환불 차액 등 셀러에게 돌려드릴 금액이 있을 때 이 계좌로 입금됩니다. (주문서 결제 취소는 결제 수단으로 바로 환불됩니다)"
    : role === "MANAGER" ? "영업 수수료가 이 계좌로 지급됩니다." : null;
  return (
    <>
    <SettingsPanel
      role={role}
      roleLabel={ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
      email={u.email}
      name={name}
      phone={phone}
      companyName={companyName}
      createdAtLabel={createdAtLabel}
      profileImageIndex={avatar.imageIndex}
      avatarUrl={avatar.photoUrl}
      isDemo={isDemo}
      showBookings={showBookings}
      bookings={bookings}
      sns={sns}
      notifyPrefs={notifyPrefs}
    />
    {role === "SELLER" && !isDemo && <div className="mt-5 max-w-2xl"><SellerPlatformsForm initial={livePlatforms} initialEtc={livePlatformEtc} /></div>}
    {payout && !isDemo && <div className="mt-5 max-w-2xl"><PayoutAccountForm description={payout} /></div>}
    </>
  );
}
