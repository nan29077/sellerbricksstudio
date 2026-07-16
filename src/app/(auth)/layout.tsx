import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-navy to-blue-950 flex flex-col items-center justify-center p-4 py-8">
      <Link href="/" className="mb-6 flex flex-col items-center">
        <Image
          src="/images/auth-logo.png"
          alt="셀러브릭스 스튜디오"
          width={180}
          height={48}
          className="w-[180px] h-auto object-contain"
          priority
        />
      </Link>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-8 shadow-2xl">{children}</div>
      <p className="mt-5 text-xs text-white/50">© 2026 셀러브릭스 스튜디오 주식회사</p>
    </div>
  );
}
