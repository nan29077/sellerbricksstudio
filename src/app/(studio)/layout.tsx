import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getAccountAvatar } from "@/lib/profile-server";
import { StudioNavigation, StudioTopBar } from "@/components/home/studio-navigation";
import { HomeBackgroundArtwork } from "@/components/home/home-background-artwork";
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
        <footer className="border-t border-[#E8E5DD] bg-white px-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-6 text-xs text-slate-500 lg:pb-6">
          © {new Date().getFullYear()} Sellerbricks Studio
        </footer>
      </div>
      <div className={styles.rail}>
        <StudioNavigation account={account} />
      </div>
    </div>
  );
}
