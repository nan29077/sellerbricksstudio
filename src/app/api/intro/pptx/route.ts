import { NextResponse } from "next/server";

// PptxGenJS를 서버사이드에서 사용
export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PptxGenJS = require("pptxgenjs");
    const pptx = new PptxGenJS();

    pptx.layout = "LAYOUT_WIDE";
    pptx.title = "셀러브릭스 스튜디오 소개서";
    pptx.author = "셀러브릭스 스튜디오";

    const BRAND = "#F5A623";
    const NAVY = "#1A1A2E";
    const WHITE = "#FFFFFF";
    const LIGHT = "#FFFBF0";

    // 헬퍼: 섹션 슬라이드 생성
    function addSectionSlide(title: string, subtitle: string, items: string[], badgeText: string) {
      const slide = pptx.addSlide();
      slide.background = { color: LIGHT };
      // 배지
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 0.4, w: 2.2, h: 0.35, fill: { color: "FFF3D0" }, line: { color: BRAND, width: 1 }, rectRadius: 0.1 });
      slide.addText(badgeText, { x: 0.5, y: 0.4, w: 2.2, h: 0.35, fontSize: 9, bold: true, color: "C2760B", align: "center" });
      // 타이틀
      slide.addText(title, { x: 0.5, y: 0.9, w: 12.3, h: 0.7, fontSize: 28, bold: true, color: NAVY });
      slide.addText(subtitle, { x: 0.5, y: 1.65, w: 12.3, h: 0.4, fontSize: 13, color: "555555" });
      // 아이템 목록
      items.forEach((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 0.5 + col * 6.5;
        const y = 2.3 + row * 0.9;
        slide.addShape(pptx.ShapeType.roundRect, { x, y, w: 6.0, h: 0.75, fill: { color: WHITE }, line: { color: "E8D0A0", width: 1 }, rectRadius: 0.1 });
        slide.addShape(pptx.ShapeType.rect, { x, y, w: 0.07, h: 0.75, fill: { color: BRAND } });
        slide.addText(item, { x: x + 0.2, y, w: 5.7, h: 0.75, fontSize: 12, color: NAVY, valign: "middle" });
      });
    }

    /* ── 슬라이드 1: 표지 ── */
    {
      const s = pptx.addSlide();
      s.background = { color: NAVY };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: BRAND } });
      s.addText("셀러브릭스 스튜디오", { x: 1.5, y: 1.8, w: 10, h: 1.2, fontSize: 44, bold: true, color: BRAND, align: "center" });
      s.addText("SELLERBRICKS STUDIO", { x: 1.5, y: 2.9, w: 10, h: 0.5, fontSize: 18, color: "888888", align: "center", charSpacing: 4 });
      s.addShape(pptx.ShapeType.rect, { x: 5.0, y: 3.55, w: 3.33, h: 0.04, fill: { color: BRAND } });
      s.addText("셀러에게 필요한 모든 것, 셀러브릭스 스튜디오가 지원합니다", {
        x: 1.0, y: 3.8, w: 11.33, h: 0.6, fontSize: 15, color: WHITE, align: "center",
      });
      s.addText("오직 방송에만 집중하세요 — 나머지는 우리가 합니다", {
        x: 1.0, y: 4.45, w: 11.33, h: 0.5, fontSize: 13, color: "BBBBBB", align: "center",
      });
      s.addText("2026 · sellerbricks.kr", { x: 1, y: 6.8, w: 11.33, h: 0.3, fontSize: 10, color: "666666", align: "center" });
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 7.3, w: 13.33, h: 0.08, fill: { color: BRAND } });
    }

    /* ── 슬라이드 2: 목차 ── */
    {
      const s = pptx.addSlide();
      s.background = { color: WHITE };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: BRAND } });
      s.addText("목차", { x: 0.5, y: 0.5, w: 12, h: 0.8, fontSize: 32, bold: true, color: NAVY });
      const items = [
        "01  셀러브릭스 플랫폼 완전 지원",
        "02  자체 송출 라이브커머스",
        "03  마케팅 전문 지원 (10년+)",
        "04  방송 지원 & 전문 스튜디오",
        "05  상품 소싱",
        "06  결제 지원",
        "07  세무 지원",
        "08  지역 농가 살리기 프로젝트",
        "09  셀러브릭스 스튜디오를 선택해야 하는 이유",
      ];
      items.forEach((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        s.addText(item, { x: 0.8 + col * 6.5, y: 1.5 + row * 0.8, w: 6.0, h: 0.6, fontSize: 13, color: NAVY, bold: col === 0 && row === 0 });
      });
    }

    /* ── 슬라이드 3: 플랫폼 지원 ── */
    addSectionSlide(
      "셀러브릭스 플랫폼 완전 지원",
      "정산·CS·주문·고객·상품·라이브커머스 관리를 자체 플랫폼으로 원스톱 제공",
      ["정산 관리 — 캠페인별 자동 정산", "CS 관리 — 고객 문의 통합 처리", "주문서 관리 — 소셜+일반 통합", "고객(구독자) 관리", "상품 관리", "라이브커머스 관리"],
      "★ 핵심 서비스",
    );

    /* ── 슬라이드 4: 라이브커머스 ── */
    addSectionSlide(
      "자체 송출 라이브커머스",
      "셀러브릭스 스튜디오 자체 라이브커머스 채널 운영 — 원스톱 방송 서비스",
      ["전문 장비·조명·세트 완비 스튜디오", "자체 라이브커머스 채널 운영", "방송 전 상품 세팅 완전 대행", "방송 후 정산까지 원스톱", "실시간 주문·CS 즉시 대응"],
      "자체 송출 채널",
    );

    /* ── 슬라이드 5: 마케팅 ── */
    addSectionSlide(
      "마케팅 전문 지원",
      "10년 넘게 마케팅을 진행해온 전문팀 — 채널 성장부터 콘텐츠 기획까지",
      ["유튜브 채널 성장 전략", "인스타그램 · 틱톡 콘텐츠 기획", "SNS 채널 분석 리포트", "10년+ 검증된 디지털 마케팅"],
      "10년+ 전문팀",
    );

    /* ── 슬라이드 6: 방송 지원 ── */
    addSectionSlide(
      "전문 스튜디오 방송 지원",
      "창고를 전전할 필요 없습니다 — 셀러브릭스 스튜디오가 제공합니다",
      ["전문 장비·조명·세트 완비 스튜디오", "방송 장비 지원", "지역 현장 방송 연계 (현지 직방송)", "방송 전 세팅부터 방송 후 정산까지"],
      "방송 지원",
    );

    /* ── 슬라이드 7: 상품 소싱 ── */
    addSectionSlide(
      "검증된 상품 소싱",
      "10년 이상 경력 기반의 검증 상품을 셀러에게 최저가로 공급",
      ["직접 소싱한 검증 상품", "셀러 최저가 공급", "식품·뷰티·생활·농수산물 등 다양한 카테고리"],
      "상품 소싱",
    );

    /* ── 슬라이드 8: 결제 ── */
    addSectionSlide(
      "누구나 쉬운 결제 시스템",
      "신용카드, 간편결제, 소셜주문서 — 어르신도 쉬운 결제 환경",
      ["신용카드 결제", "카카오페이 · 네이버페이 · 토스페이", "간편 계좌이체", "소셜주문서 — 실버 구매자 맞춤"],
      "결제 지원",
    );

    /* ── 슬라이드 9: 세무 ── */
    addSectionSlide(
      "복잡한 세무, 우리가 해결",
      "사업자 등록부터 부가세 신고까지 파트너 세무사 연계 처리",
      ["세무 처리 전문 지원", "사업자 등록 지원", "부가세 신고 · 납부 연계"],
      "세무 지원",
    );

    /* ── 슬라이드 10: 지역 농가 ── */
    {
      const s = pptx.addSlide();
      s.background = { color: "0F3324" };
      s.addText("🌱 지역 농가 살리기 프로젝트", { x: 0.5, y: 0.4, w: 12, h: 0.4, fontSize: 11, bold: true, color: "6EE7B7" });
      s.addText("지역 농가 살리기 프로젝트", { x: 0.5, y: 0.9, w: 12, h: 0.8, fontSize: 30, bold: true, color: WHITE });
      s.addText("전라남도 · 목포시 · 부안군과 협력 — 지역 특산물·농수산물 현지 직방송 연계", {
        x: 0.5, y: 1.75, w: 12, h: 0.5, fontSize: 13, color: "AAAAAA",
      });
      const regions = [
        { name: "전라남도", desc: "전남 특산물 라이브 방송 공식 파트너" },
        { name: "목포시", desc: "수산물·해산물 현지 직방송 연계" },
        { name: "부안군", desc: "쌀·농산물·특산품 현지 방송" },
        { name: "전라도 농가", desc: "지역 농가 수익 창출 · 직거래 라이브" },
      ];
      regions.forEach((r, i) => {
        const x = 0.5 + i * 3.15;
        s.addShape(pptx.ShapeType.roundRect, { x, y: 2.5, w: 2.8, h: 1.8, fill: { color: "1A3D2E" }, line: { color: "4ADE80", width: 1 }, rectRadius: 0.15 });
        s.addText(r.name, { x, y: 2.8, w: 2.8, h: 0.4, fontSize: 15, bold: true, color: WHITE, align: "center" });
        s.addText(r.desc, { x, y: 3.25, w: 2.8, h: 0.8, fontSize: 10, color: "AAAAAA", align: "center", wrap: true });
      });
      s.addText("산지에서 직접 진행하는 라이브방송으로 유통 단계를 줄이고 농가 수익을 높입니다.", {
        x: 0.5, y: 5.2, w: 12, h: 0.5, fontSize: 12, color: "6EE7B7", align: "center",
      });
    }

    /* ── 슬라이드 11: 선택 이유 ── */
    {
      const s = pptx.addSlide();
      s.background = { color: LIGHT };
      s.addText("Why 셀러브릭스 스튜디오", { x: 0.5, y: 0.3, w: 12, h: 0.35, fontSize: 10, bold: true, color: "C2760B" });
      s.addText("셀러브릭스 스튜디오를 선택해야 하는 이유", { x: 0.5, y: 0.75, w: 12, h: 0.7, fontSize: 28, bold: true, color: NAVY });
      const reasons = [
        { no: "01", t: "플랫폼 완전 지원", d: "정산·CS·주문·고객 관리 원스톱" },
        { no: "02", t: "10년+ 마케팅 전문팀", d: "채널 성장 · 콘텐츠 기획 · 분석" },
        { no: "03", t: "전문 스튜디오 완비", d: "장비·조명·세트 즉시 방송 가능" },
        { no: "04", t: "지역 농가 협력", d: "전남·목포·부안 공식 파트너" },
        { no: "05", t: "원스톱 세무 지원", d: "사업자 등록부터 부가세 신고까지" },
        { no: "06", t: "간편 결제 완벽 지원", d: "소셜주문서 + 모든 간편결제" },
      ];
      reasons.forEach((r, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 0.5 + col * 4.2;
        const y = 1.7 + row * 1.9;
        s.addShape(pptx.ShapeType.roundRect, { x, y, w: 3.8, h: 1.6, fill: { color: WHITE }, line: { color: "E8D0A0", width: 1.5 }, rectRadius: 0.15 });
        s.addText(r.no, { x: x + 0.2, y: y + 0.15, w: 0.8, h: 0.5, fontSize: 22, bold: true, color: "FFE099" });
        s.addText(r.t, { x: x + 0.15, y: y + 0.6, w: 3.5, h: 0.4, fontSize: 13, bold: true, color: NAVY });
        s.addText(r.d, { x: x + 0.15, y: y + 1.05, w: 3.5, h: 0.4, fontSize: 10, color: "666666" });
      });
    }

    /* ── 슬라이드 12: 마무리 ── */
    {
      const s = pptx.addSlide();
      s.background = { color: BRAND };
      s.addText("지금 바로 시작하세요", { x: 1, y: 2.0, w: 11.33, h: 1.0, fontSize: 40, bold: true, color: WHITE, align: "center" });
      s.addText("방송에만 집중하세요. 나머지는 셀러브릭스 스튜디오가 모두 합니다.", {
        x: 1, y: 3.1, w: 11.33, h: 0.6, fontSize: 16, color: "1A1A2E", align: "center",
      });
      s.addText("📩 hello@sellerbricks.kr  |  📞 1588-0000  |  🌐 sellerbricks.kr", {
        x: 1, y: 5.5, w: 11.33, h: 0.5, fontSize: 13, color: WHITE, align: "center",
      });
    }

    const buffer = await pptx.write({ outputType: "arraybuffer" });
    const bytes = new Uint8Array(buffer as ArrayBuffer);

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": 'attachment; filename*=UTF-8\'\'%EC%85%80%EB%9F%AC%EB%B8%8C%EB%A6%AD%EC%8A%A4%EC%8A%A4%ED%8A%9C%EB%94%94%EC%98%A4_%EC%86%8C%EA%B0%9C%EC%84%9C.pptx',
      },
    });
  } catch (err: any) {
    console.error("PPTX generation error:", err);
    return new NextResponse(JSON.stringify({ error: "PPT 생성 실패", detail: String(err?.message ?? err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
