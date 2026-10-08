/* ────────────────────────────────────────────────────────────
   PDF 생성 — 허니비 테마 (html2canvas + jsPDF CDN 동적 로드)
   ※ 이 파일은 .ts (not .tsx) 로 분리 — TSX 파서 충돌 방지
──────────────────────────────────────────────────────────── */

export async function generateSellerBricksPdf(
  setLoading: (v: boolean) => void
): Promise<void> {
  setLoading(true);
  try {
    const loadScript = (src: string) =>
      new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`스크립트 로드 실패: ${src}`));
        document.head.appendChild(s);
      });

    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
    );
    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
    );

    const today = new Date().toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric",
    });
    const year  = new Date().getFullYear();
    const origin = window.location.origin;
    const W = 794;
    const H = 1122;
    const F = "'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif";

    /* ── 공통 헬퍼 ── */
    const badge = (t: string) =>
      '<div style="display:inline-block;background:#FEF3C7;color:#C47A0D;' +
      'font-size:11px;font-weight:700;letter-spacing:1.5px;padding:4px 14px;' +
      'border-radius:6px;margin-bottom:16px;">' + t + '</div>';

    const footer = (n: number) =>
      '<div style="position:absolute;bottom:32px;left:0;right:0;display:flex;' +
      'justify-content:space-between;padding:0 60px;color:#78716C;font-size:11px;' +
      'font-family:' + F + ';box-sizing:border-box;">' +
        '<span>SELLERBRICKS STUDIO</span><span>' + n + '</span>' +
      '</div>';

    /* ── 페이지 HTML ── */
    const pages: string[] = [];

    /* ━━━ 표지 ━━━ */
    pages.push(
      '<div style="width:' + W + 'px;height:' + H + 'px;background:#1C1917;' +
      'position:relative;overflow:hidden;box-sizing:border-box;font-family:' + F + ';">' +
        '<div style="position:absolute;top:-120px;right:-120px;width:450px;height:450px;' +
        'border-radius:50%;background:#F5A623;opacity:0.10;"></div>' +
        '<div style="position:absolute;bottom:-100px;left:-100px;width:350px;height:350px;' +
        'border-radius:50%;background:#E8921A;opacity:0.07;"></div>' +
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'height:100%;padding:80px;box-sizing:border-box;text-align:center;position:relative;">' +
          '<img src="' + origin + '/images/brand/logo-original-on-dark.png" ' +
          'style="height:50px;margin-bottom:44px;object-fit:contain;" />' +
          '<div style="background:#F5A623;color:#1C1917;font-size:11px;font-weight:700;' +
          'letter-spacing:2px;padding:5px 18px;border-radius:20px;margin-bottom:32px;">' +
            'OFFICIAL INTRODUCTION ' + year +
          '</div>' +
          '<div style="color:#FFFFFF;font-size:54px;font-weight:900;line-height:1.1;' +
          'letter-spacing:-2px;margin-bottom:14px;">SELLERBRICKS<br/>STUDIO</div>' +
          '<div style="color:#F5A623;font-size:17px;font-weight:600;margin-bottom:52px;">' +
            '라이브 커머스 셀러를 위한 올인원 플랫폼' +
          '</div>' +
          '<div style="width:80px;height:3px;background:#F5A623;border-radius:2px;margin-bottom:52px;"></div>' +
          '<div style="display:flex;gap:20px;justify-content:center;">' +
            '<div style="background:rgba(245,166,35,0.12);border:1px solid rgba(245,166,35,0.28);' +
            'border-radius:16px;padding:22px 34px;text-align:center;">' +
              '<div style="color:#F5A623;font-size:22px;font-weight:900;">Connect</div>' +
              '<div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:5px;">연결</div>' +
            '</div>' +
            '<div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.28);' +
            'border-radius:16px;padding:22px 34px;text-align:center;">' +
              '<div style="color:#10B981;font-size:22px;font-weight:900;">Grow</div>' +
              '<div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:5px;">성장</div>' +
            '</div>' +
            '<div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.28);' +
            'border-radius:16px;padding:22px 34px;text-align:center;">' +
              '<div style="color:#10B981;font-size:22px;font-weight:900;">Earn</div>' +
              '<div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:5px;">수익</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="position:absolute;bottom:32px;left:0;right:0;text-align:center;' +
        'color:rgba(255,255,255,0.2);font-size:11px;font-family:' + F + ';">' +
          '발행일: ' + today + ' &nbsp;|&nbsp; sellerbricks.co.kr' +
        '</div>' +
      '</div>'
    );

    /* ━━━ 서비스 개요 ━━━ */
    const serviceItems = ["예약 관리", "제품 관리", "마케팅 지원", "라이브 방송", "정산 & 수익", "농가 예약"];
    const serviceItemsHtml = serviceItems.map(function(s) {
      return '<div style="background:rgba(245,166,35,0.12);border:1px solid rgba(245,166,35,0.22);' +
             'border-radius:10px;padding:11px 18px;color:#FFFFFF;font-size:13px;font-weight:600;">' +
             s + '</div>';
    }).join('');

    pages.push(
      '<div style="width:' + W + 'px;height:' + H + 'px;background:#FFFBF0;' +
      'position:relative;overflow:hidden;box-sizing:border-box;font-family:' + F + ';">' +
        '<div style="height:8px;background:#F5A623;"></div>' +
        '<div style="padding:56px 60px 0;">' +
          badge('SECTION 01 — 서비스 개요') +
          '<h2 style="color:#1C1917;font-size:34px;font-weight:900;margin:0 0 14px;line-height:1.2;">' +
            '셀러브릭스 스튜디오란?' +
          '</h2>' +
          '<p style="color:#78716C;font-size:14px;line-height:1.85;margin:0 0 36px;">' +
            '라이브 커머스 셀러(인플루언서)와 농가·공장을 연결하는 B2B 올인원 플랫폼입니다.<br/>' +
            '예약 관리, 마케팅 지원, 콘텐츠 제작, 라이브 방송까지 원스톱으로 지원합니다.' +
          '</p>' +
          '<div style="display:flex;gap:16px;margin-bottom:36px;">' +
            '<div style="flex:1;background:#1C1917;border-radius:16px;padding:28px;text-align:center;">' +
              '<div style="color:#F5A623;font-size:26px;font-weight:900;margin-bottom:8px;">Connect</div>' +
              '<div style="color:rgba(255,255,255,0.65);font-size:12px;line-height:1.65;">' +
                '셀러와 농가·공장을<br/>직접 연결</div>' +
            '</div>' +
            '<div style="flex:1;background:#F5A623;border-radius:16px;padding:28px;text-align:center;">' +
              '<div style="color:#1C1917;font-size:26px;font-weight:900;margin-bottom:8px;">Grow</div>' +
              '<div style="color:rgba(28,25,23,0.65);font-size:12px;line-height:1.65;">' +
                '채널 성장과<br/>브랜드 구축</div>' +
            '</div>' +
            '<div style="flex:1;background:#10B981;border-radius:16px;padding:28px;text-align:center;">' +
              '<div style="color:#FFFFFF;font-size:26px;font-weight:900;margin-bottom:8px;">Earn</div>' +
              '<div style="color:rgba(255,255,255,0.8);font-size:12px;line-height:1.65;">' +
                '투명한 정산으로<br/>안정적 수익 창출</div>' +
            '</div>' +
          '</div>' +
          '<div style="background:#1C1917;border-radius:16px;padding:30px;">' +
            '<div style="color:#F5A623;font-size:13px;font-weight:700;margin-bottom:16px;">핵심 서비스 구성</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:10px;">' + serviceItemsHtml + '</div>' +
          '</div>' +
        '</div>' +
        footer(1) +
      '</div>'
    );

    /* ━━━ 핵심 기능 ━━━ */
    const featureData = [
      { icon: "📅", title: "예약 관리",   desc: "농가·공장 방문 예약, 일정 조율, 승인 관리까지 한 곳에서 처리합니다." },
      { icon: "📦", title: "제품 관리",   desc: "바코드 스캔으로 제품 등록, 재고 확인, 셀러 공유 기능을 제공합니다." },
      { icon: "📢", title: "마케팅 지원", desc: "YouTube / Instagram / TikTok / Facebook SNS 지표 연동 및 마케팅 신청." },
      { icon: "📡", title: "라이브 방송", desc: "실시간 라이브 커머스, 게임, 쿠폰 발급 등 인터랙티브 방송 지원." },
      { icon: "💰", title: "정산 & 수익", desc: "투명한 커미션 정산, 실시간 수익 리포트를 제공합니다." },
      { icon: "🌾", title: "농가 예약",   desc: "산지 직접 방문 예약, 콘텐츠 촬영 지원, 현지 라이브 연계." },
    ];
    const featureCardsHtml = featureData.map(function(f) {
      return '<div style="width:calc(50% - 8px);box-sizing:border-box;background:#FFFBF0;' +
             'border:1px solid #FEF3C7;border-radius:16px;padding:22px;' +
             'display:flex;align-items:flex-start;gap:14px;">' +
               '<div style="width:46px;height:46px;min-width:46px;background:#F5A623;' +
               'border-radius:12px;display:flex;align-items:center;justify-content:center;' +
               'font-size:20px;">' + f.icon + '</div>' +
               '<div>' +
                 '<div style="color:#1C1917;font-size:15px;font-weight:700;margin-bottom:6px;">' + f.title + '</div>' +
                 '<div style="color:#78716C;font-size:12px;line-height:1.7;">' + f.desc + '</div>' +
               '</div>' +
             '</div>';
    }).join('');

    pages.push(
      '<div style="width:' + W + 'px;height:' + H + 'px;background:#FFFFFF;' +
      'position:relative;overflow:hidden;box-sizing:border-box;font-family:' + F + ';">' +
        '<div style="height:8px;background:#F5A623;"></div>' +
        '<div style="padding:52px 60px 0;">' +
          badge('SECTION 02 — 핵심 기능') +
          '<h2 style="color:#1C1917;font-size:34px;font-weight:900;margin:0 0 30px;line-height:1.2;">핵심 기능</h2>' +
          '<div style="display:flex;flex-wrap:wrap;gap:16px;">' + featureCardsHtml + '</div>' +
        '</div>' +
        footer(2) +
      '</div>'
    );

    /* ━━━ 역할별 기능 ━━━ */
    const sellerTags  = ["예약 관리", "라이브 방송", "마케팅 신청", "농가 예약", "정산 확인", "제품 공유"];
    const facilTags   = ["예약 승인/거절", "제품 등록", "바코드 스캔", "라이브 세션 관리", "정산 현황", "일정 관리"];
    const adminTags   = ["전체 통계", "마케팅 지원 관리", "농가 예약 관리", "회원 관리", "커미션 설정", "시스템 설정"];

    const tagsHtml = function(items: string[], tagStyle: string) {
      return items.map(function(t) {
        return '<span style="' + tagStyle + '">' + t + '</span>';
      }).join('');
    };

    pages.push(
      '<div style="width:' + W + 'px;height:' + H + 'px;background:#FFFBF0;' +
      'position:relative;overflow:hidden;box-sizing:border-box;font-family:' + F + ';">' +
        '<div style="height:8px;background:#F5A623;"></div>' +
        '<div style="padding:52px 60px 0;">' +
          badge('SECTION 03 — 역할별 기능') +
          '<h2 style="color:#1C1917;font-size:34px;font-weight:900;margin:0 0 28px;line-height:1.2;">역할별 기능</h2>' +
          '<div style="display:flex;flex-direction:column;gap:16px;">' +
            '<div style="background:#F5A623;border-radius:20px;padding:26px 30px;">' +
              '<div style="color:#1C1917;font-size:15px;font-weight:800;margin-bottom:14px;">셀러 (인플루언서)</div>' +
              '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
                tagsHtml(sellerTags,
                  'background:rgba(28,25,23,0.12);color:#1C1917;font-size:12px;padding:5px 12px;border-radius:8px;') +
              '</div>' +
            '</div>' +
            '<div style="background:#1C1917;border-radius:20px;padding:26px 30px;">' +
              '<div style="color:#F5A623;font-size:15px;font-weight:800;margin-bottom:14px;">시설 관리자</div>' +
              '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
                tagsHtml(facilTags,
                  'background:rgba(245,166,35,0.15);color:rgba(255,255,255,0.85);font-size:12px;padding:5px 12px;border-radius:8px;') +
              '</div>' +
            '</div>' +
            '<div style="background:#10B981;border-radius:20px;padding:26px 30px;">' +
              '<div style="color:#FFFFFF;font-size:15px;font-weight:800;margin-bottom:14px;">관리자</div>' +
              '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
                tagsHtml(adminTags,
                  'background:rgba(255,255,255,0.18);color:#FFFFFF;font-size:12px;padding:5px 12px;border-radius:8px;') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="background:#1C1917;border-radius:16px;padding:22px 28px;display:flex;' +
          'align-items:center;gap:18px;margin-top:16px;">' +
            '<div style="font-size:28px;min-width:36px;">🐝</div>' +
            '<div>' +
              '<div style="color:#F5A623;font-size:13px;font-weight:700;margin-bottom:4px;">하나의 플랫폼, 세 가지 역할</div>' +
              '<div style="color:rgba(255,255,255,0.55);font-size:12px;">' +
                '셀러 · 시설 관리자 · 관리자가 유기적으로 연결되는 통합 관리 시스템' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        footer(3) +
      '</div>'
    );

    /* ━━━ 플랫폼 장점 + 도입 효과 ━━━ */
    const advantageData = [
      { icon: "📊", title: "실시간 데이터", desc: "SNS 지표 실시간 연동" },
      { icon: "🔄", title: "올인원",         desc: "예약→제품→라이브→정산 한 곳에서" },
      { icon: "✅", title: "투명한 정산",    desc: "실시간 커미션 자동 계산" },
      { icon: "🌱", title: "산지 직거래",    desc: "농가와 셀러 직접 연결" },
    ];
    const advantageHtml = advantageData.map(function(a) {
      return '<div style="width:calc(50% - 6px);box-sizing:border-box;background:#FFFBF0;' +
             'border-left:4px solid #F5A623;border-radius:0 12px 12px 0;' +
             'padding:16px 20px;display:flex;gap:14px;align-items:center;">' +
               '<span style="font-size:24px;min-width:28px;">' + a.icon + '</span>' +
               '<div>' +
                 '<div style="color:#1C1917;font-size:14px;font-weight:700;margin-bottom:3px;">' + a.title + '</div>' +
                 '<div style="color:#78716C;font-size:12px;">' + a.desc + '</div>' +
               '</div>' +
             '</div>';
    }).join('');

    const metricData = [
      { value: "3x",  label: "라이브 매출", sub: "평균 증가" },
      { value: "40%", label: "마케팅 비용", sub: "절감" },
      { value: "80%", label: "예약 관리",   sub: "시간 단축" },
      { value: "4.8", label: "셀러 만족도", sub: "/ 5.0" },
    ];
    const metricHtml = metricData.map(function(m) {
      return '<div style="flex:1;background:#1C1917;border-radius:16px;padding:26px 16px;text-align:center;">' +
               '<div style="color:#F5A623;font-size:36px;font-weight:900;line-height:1;">' + m.value + '</div>' +
               '<div style="color:#FFFFFF;font-size:12px;margin-top:12px;font-weight:600;">' + m.label + '</div>' +
               '<div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:3px;">' + m.sub + '</div>' +
             '</div>';
    }).join('');

    pages.push(
      '<div style="width:' + W + 'px;height:' + H + 'px;background:#FFFFFF;' +
      'position:relative;overflow:hidden;box-sizing:border-box;font-family:' + F + ';">' +
        '<div style="height:8px;background:#F5A623;"></div>' +
        '<div style="padding:52px 60px 0;">' +
          badge('SECTION 04 — 플랫폼 장점') +
          '<h2 style="color:#1C1917;font-size:30px;font-weight:900;margin:0 0 22px;line-height:1.2;">플랫폼 장점</h2>' +
          '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:44px;">' + advantageHtml + '</div>' +
          badge('SECTION 05 — 도입 효과') +
          '<h2 style="color:#1C1917;font-size:30px;font-weight:900;margin:0 0 22px;line-height:1.2;">도입 효과</h2>' +
          '<div style="display:flex;gap:14px;">' + metricHtml + '</div>' +
        '</div>' +
        footer(4) +
      '</div>'
    );

    /* ━━━ 연락처 & CTA ━━━ */
    const ctaTags = ["무료 시작", "즉시 지원", "원스톱 서비스"];
    const ctaTagsHtml = ctaTags.map(function(t) {
      return '<div style="background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.22);' +
             'border-radius:12px;padding:12px 20px;color:#F5A623;font-size:12px;font-weight:600;">' +
             t + '</div>';
    }).join('');

    pages.push(
      '<div style="width:' + W + 'px;height:' + H + 'px;background:#1C1917;' +
      'position:relative;overflow:hidden;box-sizing:border-box;font-family:' + F + ';">' +
        '<div style="position:absolute;top:-120px;right:-120px;width:450px;height:450px;' +
        'border-radius:50%;background:#F5A623;opacity:0.08;"></div>' +
        '<div style="position:absolute;bottom:-100px;left:-100px;width:350px;height:350px;' +
        'border-radius:50%;background:#E8921A;opacity:0.06;"></div>' +
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'height:100%;padding:80px;box-sizing:border-box;text-align:center;position:relative;">' +
          '<img src="' + origin + '/images/brand/logo-original-on-dark.png" ' +
          'style="height:44px;margin-bottom:36px;object-fit:contain;" />' +
          '<div style="color:#F5A623;font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:16px;">' +
            'GET STARTED TODAY' +
          '</div>' +
          '<div style="color:#FFFFFF;font-size:46px;font-weight:900;line-height:1.15;margin-bottom:18px;">' +
            '지금 바로<br/>시작하세요' +
          '</div>' +
          '<p style="color:rgba(255,255,255,0.55);font-size:15px;margin:0 0 48px;' +
          'max-width:380px;line-height:1.75;">' +
            '방송에만 집중하세요.<br/>나머지는 셀러브릭스 스튜디오가 모두 합니다.' +
          '</p>' +
          '<div style="background:#F5A623;border-radius:20px;padding:30px 52px;margin-bottom:32px;">' +
            '<div style="color:#1C1917;font-size:12px;font-weight:700;margin-bottom:10px;">도입 문의</div>' +
            '<div style="color:#1C1917;font-size:18px;font-weight:900;margin-bottom:6px;">sellerbricks.co.kr</div>' +
            '<div style="color:rgba(28,25,23,0.55);font-size:12px;">무료로 시작 · 즉시 지원</div>' +
          '</div>' +
          '<div style="display:flex;gap:12px;justify-content:center;">' + ctaTagsHtml + '</div>' +
        '</div>' +
        '<div style="position:absolute;bottom:32px;left:0;right:0;text-align:center;' +
        'color:rgba(255,255,255,0.18);font-size:11px;font-family:' + F + ';">' +
          '© ' + year + ' SELLERBRICKS STUDIO. All rights reserved.' +
        '</div>' +
      '</div>'
    );

    /* ━━━ 렌더링 & PDF 저장 ━━━ */
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "position:fixed;top:-99999px;left:-99999px;z-index:-9999;pointer-events:none;";
    document.body.appendChild(wrapper);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { jsPDF } = (window as any).jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    for (let i = 0; i < pages.length; i++) {
      wrapper.innerHTML = pages[i];
      const el = wrapper.firstElementChild as HTMLElement;
      await new Promise<void>(r => setTimeout(r, 500));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvas = await (window as any).html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
        width: W,
        height: H,
      });
      if (i > 0) pdf.addPage();
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
    }

    document.body.removeChild(wrapper);
    pdf.save("셀러브릭스스튜디오_소개서.pdf");

  } catch (err) {
    console.error("PDF 생성 실패:", err);
    alert("PDF 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    setLoading(false);
  }
}
