import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getAccountAvatar } from "@/lib/profile-server";
import { StudioNavigation, StudioTopBar } from "@/components/home/studio-navigation";
import { HomeBackgroundArtwork } from "@/components/home/home-background-artwork";
import { StudioFooter } from "@/components/layout/studio-footer";
import { SupportCenter } from "@/components/support/support-center";
import { StudioRailGate } from "@/components/home/studio-rail-gate";
import { StudioBroadcastRail } from "@/components/home/studio-broadcast-rail";
import styles from "./studio.module.css";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const [settings, user] = await Promise.all([getSettings(), getSessionUser()]);
  const account = user ? {
    name: user.name ?? user.email,
    role: user.role,
    image: (await getAccountAvatar(user)).src,
  } : null;

  return (
    <div className={styles.shell}>
      <div className={styles.background}><HomeBackgroundArtwork id={settings.homeBackground} /></div>
      <div className={styles.column}>
        <StudioTopBar account={account} />
        <main id="studio-content">{children}</main>
        <StudioFooter />
      </div>
      <StudioRailGate><StudioBroadcastRail /></StudioRailGate>
      <div className={styles.rail}>
        <StudioNavigation account={account} />
      </div>
      <SupportCenter member={user ? { name: user.name ?? null, email: user.email ?? "" } : null} />
    </div>
  );
}
