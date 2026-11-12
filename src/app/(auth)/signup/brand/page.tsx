import { getSettings } from "@/lib/settings";
import { SignupForm } from "@/components/signup-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { facilityDisabled } = await getSettings();
  return <SignupForm role="BRAND_ADMIN" facilityDisabled={facilityDisabled} />;
}
