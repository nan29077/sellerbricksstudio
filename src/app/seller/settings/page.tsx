import { SettingsView } from "@/components/settings/settings-view";

export const dynamic = "force-dynamic";

export default function SellerSettingsPage() {
  return <SettingsView role="SELLER" showBookings />;
}
