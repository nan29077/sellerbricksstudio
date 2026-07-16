import { SettingsView } from "@/components/settings/settings-view";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  return <SettingsView role="SUPER_ADMIN" />;
}
