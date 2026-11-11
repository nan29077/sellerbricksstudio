import Link from "next/link";
import { SiteLogo } from "@/components/layout/site-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-navy to-blue-950 flex flex-col items-center justify-center p-4 py-8">
      <Link href="/" className="mb-6 flex flex-col items-center">
        <SiteLogo theme="dark" className="w-[270px] sm:w-[300px]" priority />
      </Link>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-8 shadow-2xl">{children}</div>
      <p className="mt-5 text-xs text-white/50">© {new Date().getFullYear()} 스토리지마켓</p>
    </div>
  );
}
