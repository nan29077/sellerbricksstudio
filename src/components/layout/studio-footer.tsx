import Link from "next/link";
import { BUSINESS_INFO as B, bizInfoCheckUrl } from "@/lib/business-info";

// 메인 화면 틀(가운데 열) 아래 푸터 — 사업자 정보 · 약관 · 공지 (전자상거래법 표시 사항)
export function StudioFooter() {
  return (
    <footer className="border-t border-[#E8E5DD] bg-white px-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-6 text-xs leading-6 text-slate-500 lg:pb-6">
      <nav aria-label="바닥글" className="flex flex-wrap gap-x-4 gap-y-1 font-semibold text-slate-600">
        <Link href="/intro" className="hover:text-navy">서비스 소개</Link>
        <Link href="/notices" className="hover:text-navy">공지사항</Link>
        <Link href="/support" className="hover:text-navy">고객센터</Link>
        <Link href="/terms" className="hover:text-navy">이용약관</Link>
        <Link href="/privacy" className="font-bold text-navy hover:underline">개인정보처리방침</Link>
      </nav>
      <div className="mt-3 space-y-0.5 text-[11px] leading-5 text-slate-400">
        <p className="flex flex-wrap gap-x-3"><span>상호 {B.companyName}</span><span>대표 {B.ceoName}</span><span>사업자등록번호 {B.businessNumber} <a href={bizInfoCheckUrl(B.businessNumber)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-navy">사업자정보 확인</a></span><span>통신판매업 신고 {B.mailOrderNumber}</span></p>
        <p className="flex flex-wrap gap-x-3"><span>주소 {B.address}</span><span>고객센터 {B.phone}</span><span>이메일 {B.email}</span><span>개인정보보호책임자 {B.privacyOfficer}</span></p>
      </div>
      <p className="mt-2 text-slate-500">© {new Date().getFullYear()} 스토리지마켓</p>
    </footer>
  );
}
