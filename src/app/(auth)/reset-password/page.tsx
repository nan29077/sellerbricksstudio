import { ResetPasswordForm } from "./reset-form";

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  return <ResetPasswordForm token={typeof searchParams.token === "string" ? searchParams.token : ""} />;
}
