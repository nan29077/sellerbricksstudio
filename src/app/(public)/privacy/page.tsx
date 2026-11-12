import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "개인정보처리방침 | 스토리지마켓" };

// ⚠ 기본 처리방침 초안입니다. 서비스 오픈 전에 실제 수탁사·보관 기간·책임자 연락처를 반영한 최종본으로 바꿔 주세요.
const ROWS: [string, string, string, string][] = [
  ["회원가입·계정 관리", "이메일, 비밀번호(암호화), 이름, 연락처, 회사명, 사업자등록번호", "본인 확인, 서비스 제공, 고지", "탈퇴 시까지 (법령상 보관 의무가 있으면 그 기간)"],
  ["정산", "정산 은행, 계좌번호, 예금주", "판매 대금 지급", "거래 종료 후 5년 (전자상거래법)"],
  ["구매자 주문", "이름, 연락처, 배송지", "주문 처리, 배송, 고객 응대", "거래 종료 후 5년 (전자상거래법). 브랜드사 화면에서는 배송 완료 후 운영 정책 기간이 지나면 가림 처리"],
  ["서비스 이용 기록", "접속 IP, 접속 일시, 이용 기록", "부정 이용 방지, 보안", "3개월 (통신비밀보호법)"],
];

export default function PrivacyPage() {
  return (
    <main className="container max-w-3xl py-10">
      <h1 className="text-2xl font-extrabold text-navy">개인정보처리방침</h1>
      <p className="mt-2 text-sm text-slate-500">시행일 2026년 11월 11일 · <Link href="/terms" className="underline underline-offset-2">이용약관</Link></p>
      <div className="mt-8 space-y-7 text-sm leading-6 text-slate-700">
        <section>
          <h2 className="text-base font-bold text-navy">1. 수집하는 개인정보와 이용 목적·보관 기간</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-[13px] rtable">
              <thead><tr className="border-b bg-slate-50">{["구분", "항목", "목적", "보관 기간"].map((h) => <th key={h} className="px-3 py-2 font-bold text-navy">{h}</th>)}</tr></thead>
              <tbody>{ROWS.map((r) => <tr key={r[0]} className="border-b align-top">{r.map((c, i) => <td key={i} data-label={["구분", "항목", "목적", "보관 기간"][i]} className="px-3 py-2">{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="text-base font-bold text-navy">2. 개인정보 제3자 제공</h2>
          <p className="mt-2">구매자가 주문하면 배송과 주문 처리를 위해 이름·연락처·배송지가 해당 방송의 셀러, 방송 장소인 창고(스튜디오), 상품을 직접 배송하는 브랜드사에 제공됩니다. 제공받는 자는 주문 처리 목적으로만 이용하며, 보관 기간은 1항과 같습니다.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-navy">3. 처리 위탁</h2>
          <p className="mt-2">결제 처리(PG사), 메일 발송, 카카오 알림톡 발송, 서버·파일 보관(클라우드) 업무를 외부 업체에 맡길 수 있으며, 실제 수탁사가 정해지면 이 방침에 업체명과 업무를 적습니다.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-navy">4. 정보주체의 권리</h2>
          <p className="mt-2">회원과 구매자는 언제든 자신의 개인정보 열람·정정·삭제·처리 정지를 요청할 수 있습니다. 회원은 설정 화면에서 직접 바꿀 수 있고, 구매자는 <Link href="/support" className="underline underline-offset-2">고객센터</Link>로 요청할 수 있습니다.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-navy">5. 안전성 확보 조치</h2>
          <p className="mt-2">비밀번호 암호화 저장, 접근 권한 관리, 로그인 시도 제한, 접속 기록 보관, 전송 구간 암호화(HTTPS)를 적용합니다.</p>
        </section>
        <section>
          <h2 className="text-base font-bold text-navy">6. 개인정보 보호책임자</h2>
          <p className="mt-2">주식회사 이십세기 소년들 · 개인정보 보호책임자 문의는 <Link href="/support" className="underline underline-offset-2">고객센터</Link>로 접수해 주세요.</p>
        </section>
      </div>
    </main>
  );
}
