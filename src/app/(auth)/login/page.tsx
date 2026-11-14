import { demoLoginEnabled } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm demoEnabled={demoLoginEnabled()} />;
}
