import { VerifyEmail } from "./verify-client";

export default function VerifyEmailPage({ searchParams }: { searchParams: { token?: string } }) {
  return <VerifyEmail token={typeof searchParams.token === "string" ? searchParams.token : ""} />;
}
