import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/rbac";
import { resolveProfileImageIndex } from "@/lib/profile-server";
import { SettingsPanel } from "./settings-panel";

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
  const profileImageIndex = await resolveProfileImageIndex(u);

  let name = u.name ?? "";
  let phone = "";
  let companyName = "";
  let createdAtLabel = "-";

  try {
    const dbUser = await prisma.user.findUnique({ where: { id: u.id }, include: { profile: true } });
    if (dbUser) {
      name = dbUser.profile?.name ?? name;
      phone = dbUser.profile?.phone ?? "";
      companyName = dbUser.profile?.companyName ?? "";
      createdAtLabel = fmtDate(dbUser.createdAt);
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

  return (
    <SettingsPanel
      role={role}
      roleLabel={ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
      email={u.email}
      name={name}
      phone={phone}
      companyName={companyName}
      createdAtLabel={createdAtLabel}
      profileImageIndex={profileImageIndex}
      isDemo={isDemo}
      showBookings={showBookings}
      bookings={bookings}
    />
  );
}
