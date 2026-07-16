import { SettingsView } from "@/components/settings/settings-view";

export const dynamic = "force-dynamic";

export default function FacilitySettingsPage() {
  return <SettingsView role="FACILITY_ADMIN" showBookings />;
}
