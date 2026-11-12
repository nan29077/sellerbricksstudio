// 사이트 하단(푸터)에 표시하는 사업자 정보.
// 전자상거래법상 통신판매업자 표시 사항입니다. 실제 값이 정해지면 이 파일만 고치면 됩니다.
// TODO: 아래 값은 임시입니다. 출시 전 실제 정보로 교체하세요.
export const BUSINESS_INFO = {
  companyName: "주식회사 이십세기 소년들",
  ceoName: "구영",
  businessNumber: "000-00-00000", // 사업자등록번호
  mailOrderNumber: "제0000-서울00-0000호", // 통신판매업 신고번호
  address: "서울특별시 (주소 입력 예정)",
  phone: "0000-0000", // 고객센터
  email: "help@example.com", // 고객 문의 메일
  privacyOfficer: "구영", // 개인정보보호책임자
};

/** 공정거래위원회 사업자정보 확인 링크 (사업자등록번호 숫자만 사용) */
export function bizInfoCheckUrl(businessNumber: string) {
  return `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${businessNumber.replace(/\D/g, "")}`;
}
