// 셀러 주문서 E2E 시뮬레이션 (2026-11-14 비즈니스 모델 변경)
//  구매자는 스토리지마켓에서 사지 않는다. 셀러가 외부 라이브 플랫폼에서 판 주문을 주문서(화면 · 엑셀)로 내고,
//  공급가(+ 스토리지마켓 출고 배송비)를 결제하면 브랜드 발주서 · 스토리지마켓 출고로 이어진다.
// 실행: 개발 서버(http://localhost:3007) + 시드된 DB 상태에서 `node scripts/simulate-order-sheets.mjs`
// ⚠ 테스트 데이터를 만듭니다. 운영 DB에서는 실행하지 마세요.
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

const db = new PrismaClient();
const BASE = process.env.SIM_BASE ?? "http://localhost:3007";
let pass = 0, failN = 0; const fails = [];
const ok = (cond, name, extra) => { if (cond) { pass++; console.log("  ✔", name); } else { failN++; fails.push(name); console.log("  ✘", name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); } };

class Client {
  constructor(name) { this.name = name; this.jar = {}; }
  cookie() { return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; "); }
  store(res) { for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); this.jar[kv.slice(0, i)] = kv.slice(i + 1); } }
  async req(method, path, body, raw = false) {
    const res = await fetch(BASE + path, { method, redirect: "manual", headers: { cookie: this.cookie(), ...(body !== undefined && { "content-type": "application/json" }) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    this.store(res);
    if (raw) return res;
    const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
    return { status: res.status, ...json };
  }
  async login(email, password = "password1234") {
    const csrf = await this.req("GET", "/api/auth/csrf");
    const res = await fetch(BASE + "/api/auth/callback/credentials", { method: "POST", redirect: "manual", headers: { cookie: this.cookie(), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, json: "true" }) });
    this.store(res);
    return this.req("GET", "/api/me");
  }
  async page(path) { const r = await this.req("GET", path, undefined, true); const t = await r.text(); return { status: r.status, text: t, location: r.headers.get("location") }; }
  async upload(path, file, name, fields = {}) {
    const fd = new FormData(); fd.append("file", new Blob([file]), name);
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const res = await fetch(BASE + path, { method: "POST", headers: { cookie: this.cookie() }, body: fd });
    return { status: res.status, ...(await res.json().catch(() => ({}))) };
  }
}
const noErr = (t) => !/Application error|Unhandled Runtime Error|PrismaClient|TypeError:|ReferenceError:|is not a function|__next_error__/.test(t);

async function main() {
  await db.rateLimit.deleteMany({}).catch(() => {});
  const admin = new Client("admin"), brand = new Client("brand"), manager = new Client("manager"), guest = new Client("guest");
  console.log("\n[0] 준비 — 새 셀러(판매 플랫폼 선택) · 브랜드 상품(배송 방식별)");
  ok((await admin.login("admin@sellerbricks.kr")).data?.user?.role === "SUPER_ADMIN", "최고관리자 로그인");
  ok((await brand.login("brand@sellerbricks.kr")).data?.user?.role === "BRAND_ADMIN", "브랜드 로그인");
  ok((await manager.login("manager@sellerbricks.kr")).data?.user?.role === "MANAGER", "창고 운영 매니저 로그인");
  const stamp = Date.now();
  const email = `sheet${stamp}@t.kr`;
  let r = await guest.req("POST", "/api/auth/signup", { email, password: "password1234", name: "주문서셀러", phone: "010-7777-0000", role: "SELLER", livePlatforms: ["CLICKMATE", "MORULIVE", "YOUTUBE"], agreeTerms: true, agreePrivacy: true });
  ok(r.status === 201, "셀러 가입 (클릭메이트 · 모루라이브 · 유튜브 직접)", r);
  const seller = new Client("seller");
  ok((await seller.login(email)).data?.user?.role === "SELLER", "새 셀러 로그인");
  const sellerRow = await db.user.findUnique({ where: { email } });

  const shop = await db.brandShop.findFirst({ where: { owner: { email: "brand@sellerbricks.kr" } } });
  const base = { action: "product", shopId: shop.id, description: "", imageUrl: "", isActive: true, category: "코스메틱", samplePrice: null, sampleStock: 0 };
  r = await brand.req("POST", "/api/brands", { ...base, name: `위탁배송 립밤 ${stamp}`, supplyPrice: 4000, consumerPrice: 9900, stock: 50, options: "색상:코랄,누드", allowDropship: true, allowWarehouse: false });
  ok(r.status === 201, "상품 등록: 위탁배송(브랜드 배송)만", r);
  const pDrop = r.data?.id;
  r = await brand.req("POST", "/api/brands", { ...base, name: `입고 전용 토너 ${stamp}`, supplyPrice: 7000, consumerPrice: 18000, stock: 100, allowDropship: false, allowWarehouse: true });
  ok(r.status === 201, "상품 등록: 스토리지마켓 입고만", r);
  const pWh = r.data?.id;
  r = await brand.req("POST", "/api/brands", { ...base, name: "방식 없음", supplyPrice: 1000, stock: 1, allowDropship: false, allowWarehouse: false });
  ok(r.status === 400 && /위탁배송/.test(r.error ?? ""), "배송 방식을 고르지 않으면 등록 거절 (안내 문구)", r);
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: pWh, target: "SELLER", fulfillment: "DROPSHIP", salePrice: 15000 });
  ok(r.status === 400, "스토리지마켓 입고 전용 상품은 셀러가 위탁배송으로 고를 수 없음", r);
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: pDrop, target: "SELLER", fulfillment: "DROPSHIP", salePrice: 8900 });
  ok(r.status === 201, "셀러가 위탁배송 상품 고르기", r);
  const pg0 = await brand.page("/brand/products");
  ok(pg0.status === 200 && noErr(pg0.text) && pg0.text.includes("위탁배송"), "브랜드 상품 화면: 배송 방식 표시 (위탁배송 · 스토리지마켓 입고)");

  // 창고 재고 상품 (브랜드 무관) 하나
  const F = await db.facility.findFirst({ where: { status: "APPROVED", managerAssignments: { some: { manager: { email: "manager@sellerbricks.kr" } } } } }).catch(() => null)
    ?? await db.facility.findFirst({ where: { status: "APPROVED" }, orderBy: { createdAt: "asc" } });
  const plain = await db.facilityProduct.findFirst({ where: { facilityId: F.id, brandProductId: null, isSellable: true, stock: { gt: 10 } } });
  ok(!!plain, "스토리지마켓 창고 자체 상품 준비", F?.name);

  console.log("\n[1] 주문서 작성 화면 · 상품 목록");
  r = await seller.req("GET", "/api/seller/order-sheets/catalog");
  const cat = r.data ?? [];
  ok(cat.some((c) => c.code === `B-${pDrop}` && c.options[0]?.values.includes("코랄")), "상품 목록: 고른 위탁배송 상품 + 옵션", cat.length);
  ok(cat.some((c) => c.code === `S-${plain.id}`) && !cat.some((c) => c.code === `B-${pWh}`), "상품 목록: 스토리지마켓 재고 포함 · 입고 전용 브랜드 상품은 빠짐");
  let pg = await seller.page("/seller/orders/new");
  ok(pg.status === 200 && noErr(pg.text) && pg.text.includes("주문서") && pg.text.includes("클릭메이트"), "주문서 작성 화면 (내 판매 플랫폼 표시)");
  r = await guest.req("GET", "/api/seller/order-sheets/catalog");
  ok(r.status === 401, "비로그인 상품 목록 차단", r);
  r = await brand.req("GET", "/api/seller/order-sheets/catalog");
  ok(r.status === 403, "브랜드사는 주문서 상품 목록 접근 불가", r);

  console.log("\n[2] 엑셀(.xlsx) 양식 → 작성 → 업로드 → 미리보기 → 제출");
  const tpl = await seller.req("GET", "/api/seller/order-sheets/template", undefined, true);
  const tplBuf = Buffer.from(await tpl.arrayBuffer());
  ok(tpl.status === 200 && /spreadsheetml/.test(tpl.headers.get("content-type") ?? ""), "양식 내려받기 (.xlsx)", tpl.status);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(tplBuf);
  const ws = wb.getWorksheet("주문서"), codes = wb.getWorksheet("상품코드");
  ok(!!ws && !!codes, "양식에 '주문서' · '상품코드' 시트", wb.worksheets.map((w) => w.name));
  const codeCol = []; codes?.eachRow((row) => codeCol.push(String(row.getCell(1).value ?? "")));
  ok(codeCol.includes(`B-${pDrop}`) && codeCol.includes(`S-${plain.id}`), "상품코드 시트에 내 상품코드가 들어 있음", codeCol.slice(0, 5));
  const header = []; ws.getRow(1).eachCell((c) => header.push(String(c.value)));
  ok(header.includes("받는 분") && header.includes("상품코드") && header.includes("수량"), "주문서 시트 머리글", header);
  // 사용자가 엑셀에서 채운 것처럼 줄을 추가한다 (예시 줄은 남겨 둬도 건너뛴다)
  const at = (name) => header.indexOf(name) + 1;
  const rowsIn = [
    { ext: `MR-${stamp}-1`, plat: "모루라이브", to: "최엑셀", ph: "010-6000-0001", addr: "서울 성동구 왕십리로 1", code: `B-${pDrop}`, opt: "코랄", qty: 2 },
    { ext: `MR-${stamp}-1`, plat: "모루라이브", to: "최엑셀", ph: "010-6000-0001", addr: "서울 성동구 왕십리로 1", code: `S-${plain.id}`, opt: "", qty: 1 },
    { ext: `MR-${stamp}-2`, plat: "", to: "정엑셀", ph: "01060000002", addr: "경기 성남시 분당구 1", code: `B-${pDrop}`, opt: "색상:누드", qty: 1 },
    { ext: `MR-${stamp}-3`, plat: "", to: "한엑셀", ph: "010-6000-0003", addr: "인천 남동구 1", code: `B-${pDrop}`, opt: "블루", qty: 1 },
  ];
  let rn = ws.rowCount + 1;
  for (const x of rowsIn) {
    const row = ws.getRow(rn++);
    row.getCell(at("외부 주문번호")).value = x.ext; row.getCell(at("판매 플랫폼")).value = x.plat; row.getCell(at("받는 분")).value = x.to;
    row.getCell(at("연락처")).value = x.ph; row.getCell(at("주소")).value = x.addr; row.getCell(at("상품코드")).value = x.code;
    row.getCell(at("옵션")).value = x.opt; row.getCell(at("수량")).value = x.qty; row.commit();
  }
  const filled = Buffer.from(await wb.xlsx.writeBuffer());
  r = await seller.upload("/api/seller/order-sheets/parse", filled, "orders.xlsx", { platform: "CLICKMATE" });
  const sh = r.data?.sheets ?? [];
  ok(r.ok && sh.length === 3, "엑셀 읽기: 외부 주문번호별로 3장 (예시 줄 건너뜀)", { n: sh.length, errors: r.data?.errors });
  const s1 = sh.find((s) => s.externalOrderNo === `MR-${stamp}-1`), s2 = sh.find((s) => s.externalOrderNo === `MR-${stamp}-2`), s3 = sh.find((s) => s.externalOrderNo === `MR-${stamp}-3`);
  ok(s1?.lines?.length === 2 && s1.platform === "MORULIVE" && !s1.error, "같은 주문번호 2줄 → 한 장 · '모루라이브' 인식", s1);
  ok(s2?.platform === "CLICKMATE" && !s2.error, "플랫폼 칸이 비면 기본 플랫폼(클릭메이트)", s2);
  ok(!!s3?.error && /옵션/.test(s3.error), "틀린 옵션은 미리보기에서 오류 표시", s3);
  r = await seller.upload("/api/seller/order-sheets/parse", filled, "orders.xlsx", { platform: "NOPE" });
  ok(r.status === 400, "기본 판매 플랫폼이 틀리면 거절", r);
  r = await seller.upload("/api/seller/order-sheets/parse", Buffer.from("not a zip"), "orders.xlsx", { platform: "CLICKMATE" });
  ok(r.status === 400, "깨진 엑셀 파일 거절", r);
  const dropBefore = (await db.brandProduct.findUnique({ where: { id: pDrop } })).stock;
  const plainBefore = (await db.facilityProduct.findUnique({ where: { id: plain.id } })).stock;
  const submitList = [s1, s2].map(({ error, itemsTotal, ...s }) => s);
  r = await seller.req("POST", "/api/seller/order-sheets", { sheets: submitList, method: "EASY_PAY" });
  ok(r.status === 201 && r.data.success === 2 && r.data.failed === 0, "미리보기에서 맞는 주문서 2장 제출", r.data);
  const res1 = r.data?.results?.find((x) => x.ref === s1.ref) ?? r.data?.results?.[0];
  ok(res1?.orders?.length === 2, "주문서 1(위탁배송 + 스토리지마켓) → 보내는 곳별 주문 2건", res1);
  ok((await db.brandProduct.findUnique({ where: { id: pDrop } })).stock === dropBefore - 3 && (await db.facilityProduct.findUnique({ where: { id: plain.id } })).stock === plainBefore - 1, "브랜드 재고 −3 · 창고 재고 −1");
  const orders = await db.order.findMany({ where: { sellerId: sellerRow.id, source: "SHEET" }, include: { payment: true, purchaseOrders: true, items: true } });
  ok(orders.length === 3 && orders.every((o) => o.status === "PAID" && o.payment?.status === "PAID" && o.payment.method === "EASY_PAY"), "주문 3건 결제 완료 (간편결제)", orders.map((o) => [o.status, o.payment?.status]));
  const facOrder = orders.find((o) => o.facilityId);
  const dropOrder = orders.find((o) => !o.facilityId && o.buyerName === "최엑셀");
  ok(facOrder?.totalAmount === facOrder.items.reduce((s, i) => s + i.lineTotal, 0) + facOrder.shippingFee && facOrder.shippingFee > 0, "스토리지마켓 출고 주문: 공급가 + 배송비", facOrder && [facOrder.totalAmount, facOrder.shippingFee]);
  ok(dropOrder?.totalAmount === 8000 && dropOrder.purchaseOrders.length === 1 && dropOrder.purchaseOrders[0].recipient === "최엑셀" && dropOrder.purchaseOrders[0].phone === "010-6000-0001", "위탁배송 발주서: 받는 분 · 연락처 그대로", dropOrder?.purchaseOrders?.[0]);

  console.log("\n[3] 각 역할 화면에 주문서가 보이는지");
  pg = await seller.page("/seller/orders");
  ok(pg.status === 200 && noErr(pg.text) && pg.text.includes("최엑셀") && pg.text.includes("모루라이브") && pg.text.includes(`MR-${stamp}-1`), "셀러: 주문서 · 배송 현황 (받는 분 · 플랫폼 · 외부 주문번호)");
  pg = await seller.page(`/seller/orders?q=MR-${stamp}-2`);
  ok(pg.status === 200 && pg.text.includes("정엑셀") && !pg.text.includes("최엑셀"), "셀러: 외부 주문번호로 검색");
  pg = await seller.page("/seller/dashboard");
  ok(pg.status === 200 && noErr(pg.text) && pg.text.includes("최근 주문서") && pg.text.includes("주문서 작성"), "셀러 대시보드: 주문서 중심");
  pg = await seller.page("/seller/settlements");
  ok(pg.status === 200 && noErr(pg.text) && pg.text.includes(dropOrder.orderNo), "셀러 결제 · 정산 내역에 주문서 결제 표시");
  pg = await brand.page("/brand/orders");
  ok(pg.status === 200 && noErr(pg.text) && pg.text.includes(dropOrder.purchaseOrders[0].poNo), "브랜드: 발주서 목록에 주문서 발주 표시");
  pg = await manager.page("/facility/orders");
  ok(pg.status === 200 && noErr(pg.text) && pg.text.includes(facOrder.orderNo), "창고 운영 매니저: 출고할 주문서 표시");
  pg = await admin.page("/admin/dashboard");
  ok(pg.status === 200 && noErr(pg.text) && pg.text.includes("최근 셀러 주문서"), "최고관리자 대시보드: 최근 셀러 주문서");
  pg = await admin.page(`/admin/users?q=${encodeURIComponent(email)}`);
  ok(pg.status === 200 && noErr(pg.text) && pg.text.includes("클릭메이트") && pg.text.includes("모루라이브"), "회원 관리: 셀러 판매 플랫폼 표시");
  pg = await seller.page("/seller/marketing/analytics");
  ok(pg.status === 200 && noErr(pg.text) && pg.text.includes("판매 플랫폼별 주문서"), "마케팅 분석: 판매 플랫폼별 주문서 (쿠폰 카드 대체)");

  console.log("\n[4] 출고 · 취소 권한");
  const other = new Client("other-seller"); const oe = `sheet-other${stamp}@t.kr`;
  await guest.req("POST", "/api/auth/signup", { email: oe, password: "password1234", name: "남셀러", role: "SELLER", livePlatforms: ["GRIP"], agreeTerms: true, agreePrivacy: true });
  await other.login(oe);
  r = await other.req("PATCH", `/api/orders/${facOrder.id}`, { status: "CANCELLED", reason: "x" });
  ok(r.status === 403, "다른 셀러는 남의 주문서 취소 불가", r);
  pg = await other.page("/seller/orders");
  ok(pg.status === 200 && !pg.text.includes("최엑셀"), "다른 셀러 화면에 남의 받는 분 정보 없음");
  r = await manager.req("PATCH", `/api/orders/${facOrder.id}`, { status: "SHIPPED", carrier: "CJ대한통운", trackingNumber: `T${stamp}` });
  ok(r.ok && (await db.order.findUnique({ where: { id: facOrder.id } })).status === "SHIPPED", "창고 운영 매니저 출고 (운송장)", r);
  r = await seller.req("PATCH", `/api/orders/${facOrder.id}`, { status: "CANCELLED", reason: "늦게 취소" });
  ok(r.status === 403 || r.status === 409, "출고된 주문서는 셀러가 취소 불가", r);
  const dropPo = dropOrder.purchaseOrders[0];
  r = await brand.req("PATCH", `/api/purchase-orders/${dropPo.id}`, { status: "CONFIRMED" });
  ok(r.ok, "브랜드 발주 확인", r);
  r = await seller.req("PATCH", `/api/orders/${dropOrder.id}`, { status: "CANCELLED", reason: "고객 취소" });
  const dropAfter = await db.order.findUnique({ where: { id: dropOrder.id }, include: { payment: true, purchaseOrders: true } });
  ok(r.ok && dropAfter.status === "CANCELLED" && dropAfter.payment.status === "CANCELLED" && dropAfter.purchaseOrders[0].status === "CANCELLED", "발주 확인 후·출고 전에는 셀러가 취소 → 결제 · 발주 취소", r);
  ok((await db.brandProduct.findUnique({ where: { id: pDrop } })).stock === dropBefore - 1, "취소분 브랜드 재고 복구");
  ok(!!(await db.userNotification.findFirst({ where: { userId: shop.ownerId, title: "발주가 취소되었습니다", body: { contains: dropPo.poNo } } })), "브랜드에 발주 취소 알림");

  console.log("\n[5] 프로필 동물 캐릭터 고정");
  const me = await db.user.findUnique({ where: { id: sellerRow.id } });
  ok(me.profileImageIndex >= 1 && me.profileImageIndex <= 30, "가입 시 동물 캐릭터 무작위 지정", me.profileImageIndex);
  r = await seller.req("PATCH", "/api/me/profile", { name: "주문서셀러", profileImageIndex: me.profileImageIndex === 30 ? 29 : me.profileImageIndex + 1 });
  ok(r.status === 403, "동물 캐릭터 변경 거절", r);
  r = await seller.req("PATCH", "/api/me/profile", { name: "주문서셀러", profileImageIndex: 999 });
  ok(r.status === 403, "없는 캐릭터 번호도 거절", r);
  ok((await db.user.findUnique({ where: { id: sellerRow.id } })).profileImageIndex === me.profileImageIndex, "캐릭터 그대로");
  pg = await seller.page("/seller/settings");
  ok(pg.status === 200 && noErr(pg.text) && !pg.text.includes("동물 캐릭터 선택") && pg.text.includes("바꿀 수 없습니다"), "설정 화면: 캐릭터 고르기 없음 · 고정 안내");
  pg = await brand.page("/brand/settings");
  ok(pg.status === 200 && !pg.text.includes("동물 캐릭터 선택"), "브랜드 설정도 캐릭터 고르기 없음");

  console.log("\n[6] 최고관리자 사이트 관리 (탭 병합)");
  for (const [tab, word] of [["basic", "사이트 기본 정보"], ["background", "메인페이지 양옆"], ["notices", "공지사항 관리"], ["access", "역할별"]]) {
    pg = await admin.page(`/admin/site-management?tab=${tab}`);
    ok(pg.status === 200 && noErr(pg.text) && (pg.text.includes(word) || (tab === "access" && pg.text.includes("매니저"))), `사이트 관리 탭: ${tab}`);
  }
  for (const [old, tab] of [["/admin/site-settings", "basic"], ["/admin/home-background", "background"], ["/admin/live-settings", "access"]]) {
    pg = await admin.page(old);
    ok([307, 308].includes(pg.status) && (pg.location ?? "").includes(`tab=${tab}`), `예전 주소 ${old} → 사이트 관리 ${tab} 탭`, pg.status);
  }
  pg = await admin.page("/admin/dashboard");
  ok(!pg.text.includes('href="/admin/site-settings"') && !pg.text.includes('href="/admin/home-background"'), "관리자 메뉴에 예전 사이트 설정 · 여백 관리 링크 없음");
  r = await admin.req("PATCH", "/api/admin/settings", { bannerText: `점검 배너 ${stamp}` });
  ok(r.ok, "사이트 설정 저장 API 그대로 동작", r);
  pg = await seller.page("/admin/site-management");
  ok(pg.status !== 200 || !pg.text.includes("사이트 기본 정보"), "셀러는 사이트 관리 접근 불가", pg.status);

  console.log("\n[7] 정책 · 안내 문구");
  pg = await admin.page("/admin/policy");
  ok(pg.status === 200 && noErr(pg.text) && pg.text.includes("주문서 배송비") && !pg.text.includes("방송 종료 후 주문"), "정책 화면: 주문서 배송비 · 방송 주문 항목 없음");
  pg = await guest.page("/terms");
  ok(pg.text.includes("주문서") && !pg.text.includes("라이브 방송 링크를 통해 상품을 주문"), "약관: 주문서 · 구매자 직접 주문 문구 없음");
  pg = await guest.page("/privacy");
  ok(pg.text.includes("받는 분") && !pg.text.includes("구매자가 주문하면"), "개인정보처리방침: 받는 분 정보 제공 안내");
  pg = await guest.page("/support");
  ok(pg.status === 200 && pg.text.includes("주문서") && !pg.text.includes("주문 조회 화면"), "고객센터 FAQ: 주문서 안내");
  pg = await guest.page("/intro");
  ok(pg.status === 200 && pg.text.includes("주문서") && !pg.text.includes("실버 구매자"), "서비스 소개: 주문서 · 발송 섹션");

  // 정리: 남은 결제 완료 주문 취소 (재고 되돌림)
  for (const o of await db.order.findMany({ where: { sellerId: sellerRow.id, status: "PAID" } })) await seller.req("PATCH", `/api/orders/${o.id}`, { status: "CANCELLED", reason: "시뮬레이션 정리" });
}

main()
  .catch((e) => { failN++; fails.push("SIM CRASH"); console.error("SIM CRASH", e); })
  .finally(async () => {
    console.log(`\n결과: 통과 ${pass} · 실패 ${failN}`);
    if (fails.length) console.log("실패 항목:", fails);
    await db.$disconnect();
    process.exit(failN ? 1 : 0);
  });
