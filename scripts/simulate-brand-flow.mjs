// 스토리지마켓 E2E 시뮬레이션 — 브랜드 · 셀러 주문서 · 발주 · 스토리지마켓 출고 · 정산 (실제 API 호출 + DB 검증)
// 실행: DB(시드 완료) + `npm run build && npm start` 상태에서 BASE 주소를 맞추고 `node scripts/simulate-brand-flow.mjs`
// ⚠ 테스트 데이터를 만듭니다. 운영 DB에서는 실행하지 마세요.
import { PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";
import fs from "node:fs";
// 웹훅 서명 키 (.env.local / .env 에 있으면 서명해서 보낸다)
const envValue = (k) => { for (const f of [".env.local", ".env"]) { try { const m = fs.readFileSync(f, "utf8").match(new RegExp(`^\\s*${k}\\s*=\\s*"?([^"\\r\\n]*)"?`, "m")); if (m && m[1]) return m[1]; } catch { /* 파일 없음 */ } } return ""; };
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || envValue("PAYMENT_WEBHOOK_SECRET");
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
    const me = await this.req("GET", "/api/me");
    return me;
  }
  async page(path) { const r = await this.req("GET", path, undefined, true); const t = await r.text(); return { status: r.status, text: t }; }
}
const key = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

// 구매 확정 유예(배송 완료 후 n일 뒤 정산)가 켜져 있으면 방금 배송 완료한 주문은 정산 대상이 아니다.
// 정산 검증을 위해 실행 중에만 0일로 두고, 끝나면(중간에 멈춰도) 원래 값으로 되돌린다.
let prevSettleDays = null;
let liveRestore = null;
async function restoreSettleDays() {
  if (liveRestore) { await liveRestore().catch(() => null); liveRestore = null; }
  if (prevSettleDays == null) return;
  await db.platformPolicy.update({ where: { id: "default" }, data: { settleAfterDays: prevSettleDays } }).catch(() => null);
  prevSettleDays = null;
}

async function main() {
  const admin = new Client("admin"), seller = new Client("seller"), fac = new Client("facility"), brand = new Client("brand"), guest = new Client("guest");
  await db.rateLimit.deleteMany({}).catch(() => {}); // 반복 실행 시 요청 횟수 제한에 걸리지 않게
  console.log("\n[0] 로그인");
  ok((await admin.login("admin@sellerbricks.kr")).data?.user?.role === "SUPER_ADMIN", "최고관리자 로그인");
  ok((await seller.login("seller@sellerbricks.kr")).data?.user?.role === "SELLER", "셀러 로그인");
  // 2026-11-14: 창고(스튜디오) 관리자 계정은 없어졌다 — 창고는 본사가 운영. 창고 운영은 담당 창고 운영 매니저(manager@)로 검증한다
  { const old = new Client("old-facility"); ok(!(await old.login("facility@sellerbricks.kr")).data?.user, "예전 창고 관리자 계정은 로그인 불가"); }
  ok((await fac.login("manager@sellerbricks.kr")).data?.user?.role === "MANAGER", "창고 운영 매니저 로그인");
  {
    const bcrypt = (await import("bcryptjs")).default;
    const em = `oldfac${Date.now()}@test.kr`;
    await db.user.create({ data: { email: em, role: "FACILITY_ADMIN", passwordHash: await bcrypt.hash("password1234", 10) } });
    const c = new Client("oldfac-db");
    ok(!(await c.login(em)).data?.user, "DB에 남은 예전 창고 관리자 계정도 로그인 불가");
    const su = await new Client("su").req("POST", "/api/auth/signup", { email: `newfac${Date.now()}@test.kr`, password: "password1234", name: "창고", role: "FACILITY_ADMIN", agreeTerms: true, agreePrivacy: true });
    ok(su.status === 400, "창고(스튜디오) 관리자 회원가입 불가", su);
    const sm = await new Client("sm").req("POST", "/api/auth/signup", { email: `newmgr${Date.now()}@test.kr`, password: "password1234", name: "매니저", role: "MANAGER", agreeTerms: true, agreePrivacy: true });
    ok(sm.status === 400, "창고 운영 매니저는 직접 가입 불가 (최고관리자가 만든다)", sm);
  }

  console.log("\n[1] 브랜드 회원가입 (카테고리 선택) → 브랜드샵 자동 생성");
  const email = `newbrand${Date.now()}@test.kr`;
  let r = await guest.req("POST", "/api/auth/signup", { email, password: "password1234", name: "김브랜드", phone: "010-9999-0000", companyName: "", role: "BRAND_ADMIN", categories: [], agreeTerms: true, agreePrivacy: true });
  ok(r.status === 400, "브랜드명·카테고리 없으면 가입 거절", r);
  r = await guest.req("POST", "/api/auth/signup", { email, password: "password1234", name: "김브랜드", phone: "010-9999-0000", companyName: "하루 코스메틱", businessNumber: "111-22-33333", role: "BRAND_ADMIN", categories: ["코스메틱", "의류", "반려동물"], agreeTerms: true, agreePrivacy: true });
  ok(r.status === 201, "브랜드 가입 성공", r);
  const nb = await db.user.findUnique({ where: { email }, include: { brandShop: true, profile: true } });
  ok(nb?.brandShop?.status === "PENDING" && nb.brandShop.categories.length === 3 && nb.brandShop.businessNumber === "111-22-33333", "가입 시 브랜드샵(승인 대기)·카테고리·사업자번호 저장", nb?.brandShop);
  r = await guest.req("POST", "/api/auth/signup", { email: `s${Date.now()}@t.kr`, password: "password1234", name: "셀러2", role: "SELLER", categories: ["없는카테고리"], agreeTerms: true, agreePrivacy: true });
  ok(r.status === 400, "잘못된 카테고리 거절", r);
  ok((await brand.login(email)).data?.user?.role === "BRAND_ADMIN", "새 브랜드 로그인");
  r = await admin.req("POST", "/api/brands", { action: "moderate", shopId: nb.brandShop.id, status: "APPROVED", moderationNote: "", feeRate: 7 });
  ok(r.ok, "최고관리자 승인 + 브랜드별 수수료 7%", r);
  r = await brand.req("POST", "/api/brands", { action: "shop", shopId: nb.brandShop.id, name: "하루 코스메틱", tagline: "", description: "", logoUrl: "", bannerUrl: "", backgroundUrl: "", bankName: "신한", bankAccount: "110-123-456789", accountHolder: "하루", csPhone: "02-000-0000" });
  ok(r.ok, "브랜드 정산 계좌 등록", r);

  console.log("\n[2] 브랜드 상품 등록 (옵션 · 배송 방식 위탁배송/스토리지마켓 입고 · 무료/유료 샘플)");
  const base = { action: "product", shopId: nb.brandShop.id, description: "", imageUrl: "", isActive: true };
  r = await brand.req("POST", "/api/brands", { ...base, name: "하루 앰플", category: "뷰티", subCategory: "스킨케어", supplyPrice: 10000, consumerPrice: 30000, stock: 100, samplePrice: 0, sampleStock: 5, sampleLimitPerBuyer: 1, options: "용량:30ml,50ml", allowDropship: true, allowWarehouse: true });
  ok(r.status === 201, "상품 1 등록 (예전 카테고리 '뷰티' → 코스메틱 변환)", r);
  const p1 = await db.brandProduct.findUnique({ where: { id: r.data.id } });
  ok(p1.category === "코스메틱" && p1.options === "용량:30ml,50ml", "카테고리 정규화·옵션 저장", p1);
  r = await brand.req("POST", "/api/brands", { ...base, name: "하루 마스크팩", category: "코스메틱", supplyPrice: 5000, consumerPrice: 12000, stock: 50, samplePrice: 2000, sampleStock: 10, sampleLimitPerBuyer: 2, allowDropship: true, allowWarehouse: false });
  const p2 = r.data.id; ok(r.status === 201, "상품 2 등록 (유료 샘플 2,000원)", r);
  r = await brand.req("POST", "/api/brands", { ...base, name: "불가 상품", category: "코스메틱", supplyPrice: 1, stock: 1, samplePrice: null, sampleStock: 0, allowDropship: false, allowWarehouse: false });
  ok(r.status === 400, "배송방식 둘 다 끄면 거절", r);

  console.log("\n[3] 샘플 — 무료 · 계정당 한도 · 유료(플랫폼 결제) · 반려 시 자동 환불");
  const ship = { recipient: "테스트셀러", phone: "010-1234-5678", address: "서울 강남구 테헤란로 1", message: "" };
  r = await seller.req("POST", "/api/brands", { action: "request", productId: p1.id, requestKey: key(), kind: "SAMPLE", quantity: 1, expectedUnitPrice: 0, ...ship });
  ok(r.status === 201, "무료 샘플 신청", r);
  r = await seller.req("POST", "/api/brands", { action: "request", productId: p1.id, requestKey: key(), kind: "SAMPLE", quantity: 1, expectedUnitPrice: 0, ...ship });
  ok(r.status === 409 && /1회/.test(r.error), "계정당 1회 한도 초과 거절", r);
  r = await seller.req("POST", "/api/brands", { action: "request", productId: p2, requestKey: key(), kind: "SAMPLE", quantity: 2, expectedUnitPrice: 2000, method: "CARD", ...ship });
  ok(r.status === 201, "유료 샘플 신청", r);
  let paidReq = await db.brandRequest.findUnique({ where: { id: r.data.id } });
  ok(paidReq.paymentStatus === "PAID" && paidReq.paidAmount === 4000 && paidReq.status === "PENDING", "유료 샘플 플랫폼 결제 완료 (4,000원)", paidReq);
  ok((await db.brandProduct.findUnique({ where: { id: p2 } })).sampleStock === 8, "샘플 재고 차감 10→8");
  r = await brand.req("POST", "/api/brands", { action: "transition", requestId: paidReq.id, status: "REJECTED" });
  ok(r.status === 409, "반려 사유 없으면 거절", r);
  r = await brand.req("POST", "/api/brands", { action: "transition", requestId: paidReq.id, status: "REJECTED", reason: "재고 소진" });
  paidReq = await db.brandRequest.findUnique({ where: { id: paidReq.id } });
  ok(r.ok && paidReq.paymentStatus === "REFUNDED" && paidReq.rejectReason === "재고 소진", "반려 → 자동 환불", paidReq);
  ok((await db.brandProduct.findUnique({ where: { id: p2 } })).sampleStock === 10, "반려 시 샘플 재고 복구");
  r = await seller.req("POST", "/api/brands", { action: "request", productId: p2, requestKey: key(), kind: "SAMPLE", quantity: 1, expectedUnitPrice: 2000, ...ship });
  const paid2 = r.data.id;
  await brand.req("POST", "/api/brands", { action: "transition", requestId: paid2, status: "APPROVED" });
  r = await brand.req("POST", "/api/brands", { action: "transition", requestId: paid2, status: "SHIPPED", carrier: "CJ대한통운", trackingNumber: "1234" });
  ok(r.ok, "유료 샘플 승인 → 발송 (정산 대상)", r);
  r = await seller.req("POST", "/api/brands", { action: "request", productId: p1.id, requestKey: key(), kind: "SUPPLY", quantity: 1, expectedUnitPrice: 10000, ...ship });
  ok(r.status === 403, "셀러는 창고 입고 요청 불가", r);

  console.log("\n[4] 판매 상품 고르기 (셀러 위탁배송 · 스토리지마켓 입고 · 창고 직배송)");
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: p1.id, target: "SELLER", fulfillment: "DROPSHIP", salePrice: 9000 });
  ok(r.status === 400, "공급가보다 낮은 판매가 거절", r);
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: p1.id, target: "SELLER", fulfillment: "WAREHOUSE", salePrice: 25000 });
  ok(r.status === 400, "셀러는 창고 입고 방식 불가", r);
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: p1.id, target: "SELLER", fulfillment: "DROPSHIP", salePrice: 25000 });
  ok(r.status === 201, "셀러: 직배송 판매 상품으로 가져오기", r);
  const listing = r.data.id;
  const facilities = await db.facility.findMany({ where: { owner: { email: "admin@sellerbricks.kr" } }, orderBy: { createdAt: "asc" } });
  const F = facilities[0];
  // 브랜드 거래(창고 상품 가져오기 · 입고 요청)는 최고관리자(본사)가 한다 — 매니저는 막힌다
  r = await fac.req("POST", "/api/brand-imports", { action: "import", brandProductId: p1.id, target: "FACILITY", facilityId: F.id, fulfillment: "WAREHOUSE", salePrice: 28000 });
  ok(r.status === 403, "창고 운영 매니저는 브랜드 상품 가져오기 불가 (본사만)", r);
  r = await admin.req("POST", "/api/brand-imports", { action: "import", brandProductId: p1.id, target: "FACILITY", facilityId: F.id, fulfillment: "WAREHOUSE", salePrice: 28000, commissionType: "PERCENT", commissionValue: 10 });
  ok(r.status === 201 && r.data.needsStock, "창고: 위탁(창고 입고) 방식으로 가져오기", r);
  const fpW = r.data.id;
  let fpWRow = await db.facilityProduct.findUnique({ where: { id: fpW } });
  ok(fpWRow.stock === 0 && !fpWRow.isSellable && fpWRow.fulfillment === "WAREHOUSE" && fpWRow.brandProductId === p1.id, "입고 전 재고 0 · 판매 대기", fpWRow);
  r = await admin.req("POST", "/api/brand-imports", { action: "import", brandProductId: p1.id, target: "FACILITY", facilityId: F.id, fulfillment: "WAREHOUSE", salePrice: 28000 });
  ok(r.status === 409, "같은 방식 중복 가져오기 거절", r);
  r = await admin.req("POST", "/api/brand-imports", { action: "import", brandProductId: p2, target: "FACILITY", facilityId: F.id, fulfillment: "WAREHOUSE", salePrice: 9000 });
  ok(r.status === 400, "브랜드가 막은 배송방식(창고 입고) 거절", r);
  r = await admin.req("POST", "/api/brand-imports", { action: "import", brandProductId: p2, target: "FACILITY", facilityId: F.id, fulfillment: "DROPSHIP", salePrice: 9000, commissionType: "PERCENT", commissionValue: 10, stock: 20 });
  ok(r.status === 201, "창고: 직배송 방식으로 가져오기 (판매 한도 20)", r);
  const fpD = r.data.id;

  console.log("\n[5] 창고 입고 요청 → 브랜드 승인·발송 → 창고 입고 확인 → 창고 재고 반영");
  r = await admin.req("POST", "/api/brands", { action: "request", productId: p1.id, requestKey: key(), kind: "SUPPLY", quantity: 30, expectedUnitPrice: 10000, recipient: F.name, phone: "010-0000-0000", address: F.address, message: "", facilityProductId: fpW });
  ok(r.status === 201, "창고 입고 요청 (30개)", r);
  const sup = r.data.id;
  await brand.req("POST", "/api/brands", { action: "transition", requestId: sup, status: "APPROVED" });
  ok((await db.brandProduct.findUnique({ where: { id: p1.id } })).stock === 70, "승인 시 브랜드 재고 100→70");
  await brand.req("POST", "/api/brands", { action: "transition", requestId: sup, status: "SHIPPED", carrier: "로젠", trackingNumber: "999" });
  r = await admin.req("POST", "/api/brands", { action: "transition", requestId: sup, status: "COMPLETED" });
  fpWRow = await db.facilityProduct.findUnique({ where: { id: fpW } });
  ok(r.ok && fpWRow.stock === 30 && fpWRow.isSellable, "입고 확인 → 창고 재고 30 · 판매 시작", fpWRow);

  console.log("\n[6] 예약 고도화 — 시간대 차단 · 예약 · 승인");
  const day = (() => { let d = new Date(Date.now() + 9 * 3600000); d.setUTCDate(d.getUTCDate() + 3); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
  { // 반복 실행 시 이전 실행이 남긴 같은 날짜 예약·차단이 겹치지 않게 정리 (테스트 데이터만)
    const d2 = (() => { let d = new Date(Date.now() + 9 * 3600000); d.setUTCDate(d.getUTCDate() + 4); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
    for (const dd of [day, d2]) {
      const from = new Date(`${dd}T00:00:00+09:00`), to = new Date(from.getTime() + 24 * 3600000);
      await db.booking.updateMany({ where: { facilityId: F.id, status: { in: ["PENDING", "APPROVED"] }, startAt: { gte: from, lt: to } }, data: { status: "CANCELLED" } });
    }
  }
  {
    const other = facilities.find((x) => x.region === "경기"); // 매니저 담당이 아닌 창고
    const rr = await fac.req("POST", "/api/facility/time-blocks", { facilityId: other.id, date: day, start: "14:00", end: "16:00", reason: "권한 확인" });
    ok(rr.status === 403, "매니저는 담당이 아닌 창고 일정을 바꿀 수 없음", rr);
  }
  r = await fac.req("POST", "/api/facility/time-blocks", { facilityId: F.id, date: day, start: "14:00", end: "16:00", reason: "내부 촬영" });
  ok(r.status === 201, "14~16시 시간대 차단", r);
  r = await seller.req("POST", "/api/bookings", { facilityId: F.id, startAt: `${day}T14:00`, endAt: `${day}T16:00` });
  ok(r.status === 409 && /예약을 받지 않는/.test(r.error), "차단 시간 예약 거절 (사유 표시)", r);
  const avail = await seller.req("GET", `/api/facilities/${F.id}/availability?date=${day}&hours=2`);
  ok(avail.ok !== false, "예약 가능 시간 조회", avail.error);
  r = await seller.req("POST", "/api/bookings", { facilityId: F.id, startAt: `${day}T10:00`, endAt: `${day}T12:00`, purpose: "뷰티 라이브", products: [{ facilityProductId: fpW, quantity: 10 }] });
  ok(r.status === 201, "10~12시 예약 + 브랜드 위탁 상품 담기", r);
  const bookingId = r.data?.bookings?.[0]?.id;
  r = await fac.req("PATCH", `/api/bookings/${bookingId}`, { status: "APPROVED" });
  ok(r.ok, "창고 승인", r);

  console.log("\n[7] 주문서 상품 목록 · 입력 검사");
  const sellerId = (await db.user.findUnique({ where: { email: "seller@sellerbricks.kr" } })).id;
  const sheetPolicy = await db.platformPolicy.findUnique({ where: { id: "default" } });
  const SHIP = sheetPolicy?.sheetShippingFee ?? 3000;
  const rcpt = (n, extra = {}) => ({ platform: "CLICKMATE", externalOrderNo: `CM-${Date.now()}-${n}`, recipient: `받는분${n}`, phone: `010-4000-${String(n).padStart(4, "0")}`, address: `서울 마포구 월드컵로 ${n}`, memo: "문 앞", ...extra });
  const submit = (c, sheets, method = "CARD") => c.req("POST", "/api/seller/order-sheets", { sheets, method });
  const one = async (sheet) => { const res = await submit(seller, [sheet]); return { res, row: res.data?.results?.[0] }; };
  r = await seller.req("GET", "/api/seller/order-sheets/catalog");
  const cat = r.data ?? [];
  ok(r.ok && cat.some((c) => c.code === `B-${p1.id}` && c.kind === "BRAND" && c.unitCost === 10000), "주문서 상품: 고른 위탁배송 상품 (공급가)", cat.map((c) => c.code));
  ok(cat.some((c) => c.code === `S-${fpW}` && c.kind === "STOCK" && c.facilityId === F.id), "주문서 상품: 스토리지마켓 입고 재고 상품", cat.length);
  ok(!cat.some((c) => c.code === `S-${fpD}`) && !cat.some((c) => c.code === `B-${p2}`), "창고가 직배송으로 가져온 상품 · 고르지 않은 브랜드 상품은 빠짐");
  const fpWUnit = cat.find((c) => c.code === `S-${fpW}`)?.unitCost ?? 0;
  ok(fpWUnit === 28000 - 2800, "스토리지마켓 상품 공급가 = 판매가 − 셀러 수수료(10%)", fpWUnit);
  r = await guest.req("POST", "/api/seller/order-sheets", { sheets: [rcpt(1, { lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:30ml" }] })] });
  ok(r.status === 401, "비로그인 주문서 제출 차단", r);
  r = await brand.req("POST", "/api/seller/order-sheets", { sheets: [rcpt(1, { lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:30ml" }] })] });
  ok(r.status === 403, "브랜드사는 주문서 제출 불가", r);
  let x = await one(rcpt(1, { recipient: "", lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:30ml" }] }));
  ok(x.row && !x.row.ok && /받는 분/.test(x.row.error), "받는 분 없으면 거절", x.res);
  x = await one(rcpt(1, { platform: "NOPE", lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:30ml" }] }));
  ok(x.row && !x.row.ok && /플랫폼/.test(x.row.error), "없는 판매 플랫폼 거절", x.res);
  x = await one(rcpt(1, { platform: "ETC", lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:30ml" }] }));
  ok(x.row && !x.row.ok && /기타/.test(x.row.error), "기타 플랫폼은 이름 필수", x.res);
  x = await one(rcpt(1, { lines: [{ code: `B-${p1.id}`, quantity: 1 }] }));
  ok(x.row && !x.row.ok && /옵션/.test(x.row.error), "옵션 미선택 거절", x.res);
  x = await one(rcpt(1, { lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:99ml" }] }));
  ok(x.row && !x.row.ok, "없는 옵션 거절", x.res);
  x = await one(rcpt(1, { lines: [{ code: `B-${p2}`, quantity: 1 }] }));
  ok(x.row && !x.row.ok && /담을 수 없는/.test(x.row.error), "고르지 않은 브랜드 상품 거절", x.res);
  ok((await db.order.count({ where: { sellerId, buyerName: "받는분1", source: "SHEET" } })) === 0, "거절된 주문서는 주문을 만들지 않음");

  console.log("\n[8] 주문서 결제 → 브랜드 발주서 · 스토리지마켓 출고");
  const before = await db.brandProduct.findUnique({ where: { id: p1.id } });
  x = await one(rcpt(11, { lines: [{ code: `B-${p1.id}`, quantity: 2, optionLabel: "50ml" }] }));
  ok(x.res.status === 201 && x.row?.ok && x.row.orders.length === 1, "주문서 A 결제 (위탁배송 2개 · 옵션 값만 적어도 인식)", x.res);
  const order1b = x.row?.orders?.[0]?.id;
  const o1b = await db.order.findUnique({ where: { id: order1b }, include: { items: true, payment: true } });
  ok(o1b.source === "SHEET" && o1b.platform === "CLICKMATE" && !!o1b.externalOrderNo && o1b.facilityId === null && o1b.status === "PAID", "주문서 A: 판매 플랫폼 · 외부 주문번호 · 보내는 곳(브랜드) 저장", o1b);
  ok(o1b.totalAmount === 20000 && o1b.shippingFee === 0 && o1b.payment?.status === "PAID" && o1b.payment.amount === 20000, "셀러 결제 = 공급가 합계 (위탁배송은 배송비 없음)", [o1b.totalAmount, o1b.shippingFee]);
  ok(o1b.items.every((i) => i.platformFee === 0 && i.brandAmount === i.lineTotal && i.facilityAmount === 0 && i.sellerAmount === 0) && o1b.items[0].optionLabel === "용량:50ml", "위탁배송 분배: 전액 브랜드 몫 (브랜드 수수료는 브랜드 정산에서)", o1b.items);
  x = await one(rcpt(12, { lines: [{ code: `S-${fpW}`, quantity: 3, optionLabel: "용량:30ml" }] }));
  ok(x.res.status === 201 && x.row?.ok, "주문서 B 결제 (스토리지마켓 입고 상품 3개)", x.res);
  const order1 = x.row?.orders?.[0]?.id;
  const o1row = await db.order.findUnique({ where: { id: order1 } });
  ok(o1row.facilityId === F.id && o1row.shippingFee === SHIP && o1row.totalAmount === fpWUnit * 3 + SHIP, "스토리지마켓 출고 주문서: 공급가 + 출고 배송비", [o1row.totalAmount, SHIP]);
  let pos1 = [...await db.purchaseOrder.findMany({ where: { orderId: order1b }, include: { items: true } }), ...await db.purchaseOrder.findMany({ where: { orderId: order1 }, include: { items: true } })];
  const poD1 = pos1.find((p) => p.fulfillment === "DROPSHIP"), poW1 = pos1.find((p) => p.fulfillment === "WAREHOUSE");
  ok(pos1.length === 2 && poD1?.status === "NEW" && poW1?.status === "CONFIRMED", "발주서: 위탁배송(신규) · 스토리지마켓 입고분(정산용 확인)", pos1.map((p) => [p.fulfillment, p.status]));
  ok(poD1.supplyAmount === 20000 && poD1.recipient === "받는분11" && poD1.address.includes("월드컵로 11") && poD1.items[0].optionLabel === "용량:50ml", "위탁배송 발주서: 공급가 · 받는 분 · 배송지 · 옵션", poD1);
  ok(poW1.supplyAmount === 30000 && poW1.recipient === F.name, "입고분 발주서: 공급가 합계 · 출고 창고", poW1);
  ok((await db.brandProduct.findUnique({ where: { id: p1.id } })).stock === before.stock - 2, "위탁배송분만 브랜드 재고 차감");
  ok((await db.facilityProduct.findUnique({ where: { id: fpW } })).stock === 27, "입고분은 창고 재고 차감 30→27");
  ok(!!(await db.userNotification.findFirst({ where: { userId: nb.id, title: { contains: "발주서" } } })), "브랜드에 발주 알림");
  ok(!!(await db.userNotification.findFirst({ where: { title: { contains: "출고할 새 주문서" } } })), "창고 운영에 출고 알림");
  x = await one(rcpt(13, { lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:30ml" }, { code: `S-${fpW}`, quantity: 1, optionLabel: "용량:30ml" }] }));
  ok(x.row?.ok && x.row.orders.length === 2, "주문서 C (위탁배송 + 스토리지마켓 섞임) → 보내는 곳별로 주문 2건", x.res);
  const oC1 = x.row.orders.find((o) => /위탁배송/.test(o.shipper))?.id, oC2 = x.row.orders.find((o) => !/위탁배송/.test(o.shipper))?.id;
  const cRows = await db.order.findMany({ where: { id: { in: [oC1, oC2] } } });
  ok(cRows.length === 2 && cRows.every((o) => o.externalOrderNo === cRows[0].externalOrderNo) && cRows.filter((o) => o.shippingFee > 0).length === 1, "같은 외부 주문번호 · 배송비는 스토리지마켓 출고분에만", cRows.map((o) => [o.facilityId, o.shippingFee]));
  r = await submit(seller, [rcpt(14, { lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:30ml" }] }), rcpt(15, { recipient: "x", lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:30ml" }] })]);
  ok(r.status === 201 && r.data.success === 1 && r.data.failed === 1, "여러 장 제출: 한 장이 틀려도 나머지는 처리", r.data);
  const order14 = r.data.results[0].orders?.[0]?.id;

  console.log("\n[9] 발주 처리 → 주문 상태 연동");
  r = await brand.req("PATCH", `/api/purchase-orders/${poD1.id}`, { status: "SHIPPED" });
  ok(r.status === 400, "운송장 없이 출고 거절", r);
  r = await brand.req("PATCH", `/api/purchase-orders/${poW1.id}`, { status: "SHIPPED", trackingNumber: "x" });
  ok(r.status === 409, "브랜드는 입고분 발주 출고 불가 (스토리지마켓이 출고)", r);
  r = await seller.req("PATCH", `/api/orders/${order1b}`, { status: "SHIPPED", carrier: "CJ대한통운", trackingNumber: "1" });
  ok(r.status === 403, "셀러는 위탁배송 주문의 배송 상태 변경 불가 (확인만)", r);
  r = await brand.req("PATCH", `/api/purchase-orders/${poD1.id}`, { status: "SHIPPED", carrier: "CJ대한통운", trackingNumber: "5555" });
  ok(r.ok && r.data.orderStatus === "SHIPPED", "브랜드 출고 → 주문서 배송 중", r);
  ok(!!(await db.userNotification.findFirst({ where: { userId: sellerId, link: "/seller/orders", createdAt: { gte: new Date(Date.now() - 60000) } } })), "셀러에게 진행 알림");
  r = await seller.req("PATCH", `/api/orders/${order1}`, { status: "PREPARING" });
  ok(r.status === 403, "셀러는 스토리지마켓 출고 주문의 배송 상태 변경 불가", r);
  await fac.req("PATCH", `/api/orders/${order1}`, { status: "PREPARING" });
  r = await fac.req("PATCH", `/api/orders/${order1}`, { status: "SHIPPED" });
  ok(r.status === 400 && /운송장/.test(r.error ?? ""), "창고 발송은 운송장 필수", r);
  r = await fac.req("PATCH", `/api/orders/${order1}`, { status: "SHIPPED", carrier: "CJ대한통운", trackingNumber: "8888" });
  const o1 = await db.order.findUnique({ where: { id: order1 } });
  ok(r.ok && o1.status === "SHIPPED" && o1.shipTrackingNumber === "8888" && (await db.purchaseOrder.findUnique({ where: { id: poW1.id } })).status === "SHIPPED", "창고 발송(운송장) → 주문 배송 중 · 입고분 발주도 배송 중", o1);
  await fac.req("PATCH", `/api/orders/${order1}`, { status: "DELIVERED" });
  ok((await db.order.findUnique({ where: { id: order1 } })).status === "DELIVERED" && (await db.purchaseOrder.findUnique({ where: { id: poW1.id } })).status === "DELIVERED", "창고 배송 완료 → 주문 · 입고분 발주 배송 완료");
  r = await brand.req("PATCH", `/api/purchase-orders/${poD1.id}`, { status: "DELIVERED" });
  ok((await db.order.findUnique({ where: { id: order1b } })).status === "DELIVERED", "브랜드 배송 완료 → 주문서 배송 완료", r);
  // 주문서 C: 보내는 곳이 달라 각각 따로 진행된다
  const poC1 = await db.purchaseOrder.findFirst({ where: { orderId: oC1 } });
  await fac.req("PATCH", `/api/orders/${oC2}`, { status: "SHIPPED", carrier: "한진택배", trackingNumber: "4444" });
  ok((await db.order.findUnique({ where: { id: oC2 } })).status === "SHIPPED" && (await db.order.findUnique({ where: { id: oC1 } })).status === "PAID", "주문서 C: 스토리지마켓분만 배송 중 · 브랜드분은 그대로");
  await brand.req("PATCH", `/api/purchase-orders/${poC1.id}`, { status: "CONFIRMED" });
  r = await brand.req("PATCH", `/api/purchase-orders/${poC1.id}`, { status: "SHIPPED", carrier: "한진", trackingNumber: "777" });
  await brand.req("PATCH", `/api/purchase-orders/${poC1.id}`, { status: "DELIVERED" });
  await fac.req("PATCH", `/api/orders/${oC2}`, { status: "DELIVERED" });
  ok((await db.order.findUnique({ where: { id: oC1 } })).status === "DELIVERED" && (await db.order.findUnique({ where: { id: oC2 } })).status === "DELIVERED", "주문서 C 두 주문 모두 배송 완료");
  const order2 = oC1, po2 = poC1;

  const p1Before = (await db.brandProduct.findUnique({ where: { id: p1.id } })).stock;
  r = await seller.req("PATCH", `/api/orders/${order14}`, { status: "CANCELLED" });
  ok(r.status === 400, "취소 사유 없으면 거절", r);
  r = await seller.req("PATCH", `/api/orders/${order14}`, { status: "CANCELLED", reason: "고객 변심" });
  const po3 = await db.purchaseOrder.findFirst({ where: { orderId: order14 } });
  const o14 = await db.order.findUnique({ where: { id: order14 }, include: { payment: true } });
  ok(r.ok && po3.status === "CANCELLED" && o14.payment.status === "CANCELLED" && (await db.brandProduct.findUnique({ where: { id: p1.id } })).stock === p1Before + 1, "셀러가 출고 전 주문서 취소 → 발주 취소 · 결제 취소 · 브랜드 재고 복구", po3);

  r = await brand.req("GET", "/api/purchase-orders/export", undefined, true);
  const csv = await r.text();
  ok(r.status === 200 && csv.includes("발주번호") && csv.includes("용량:50ml") && csv.includes("받는분11"), "발주서 CSV 다운로드 (받는 분 포함)");
  r = await seller.req("PATCH", `/api/purchase-orders/${po2.id}`, { status: "CONFIRMED" });
  ok(r.status === 403, "셀러는 발주서 수정 불가", r);
  const otherBrand = new Client("b2"); const e2 = `other${Date.now()}@t.kr`;
  await otherBrand.req("POST", "/api/auth/signup", { email: e2, password: "password1234", name: "다른브랜드", companyName: "다른 브랜드", role: "BRAND_ADMIN", categories: ["식품"], agreeTerms: true, agreePrivacy: true });
  await otherBrand.login(e2);
  r = await otherBrand.req("PATCH", `/api/purchase-orders/${po2.id}`, { brandMemo: "x" });
  ok(r.status === 404, "다른 브랜드의 발주서 접근 차단", r);
  { const other = new Client("seller-other"); const se = `sellerx${Date.now()}@t.kr`;
    await other.req("POST", "/api/auth/signup", { email: se, password: "password1234", name: "다른셀러", role: "SELLER", livePlatforms: ["GRIP"], agreeTerms: true, agreePrivacy: true });
    await other.login(se);
    r = await other.req("PATCH", `/api/orders/${order1b}`, { status: "CANCELLED", reason: "x" });
    ok(r.status === 403, "다른 셀러의 주문서 처리 차단", r);
    const page = await other.page("/seller/orders");
    ok(page.status === 200 && !page.text.includes("받는분11"), "다른 셀러 화면에 내 받는 분 정보가 보이지 않음");
  }
  { const page = await seller.page("/seller/orders");
    ok(page.status === 200 && page.text.includes("받는분11") && page.text.includes("클릭메이트"), "셀러 주문서 화면: 받는 분 · 판매 플랫폼 표시"); }

  console.log("\n[10] 최고관리자 — 정책 · 판매 정산 · 브랜드 정산");
  prevSettleDays = (await db.platformPolicy.findUnique({ where: { id: "default" } }))?.settleAfterDays ?? 7; // 정책을 저장한 적이 없으면 기본값(7일)으로 되돌린다
  r = await admin.req("PUT", "/api/admin/policy", { salesFeeRate: 5, brandFeeRate: 5, sampleFeeRate: 10, autoCompleteBookings: true, settleAfterDays: 0, sheetShippingFee: SHIP });
  ok(r.ok, "수수료 정책 저장 (주문서 배송비 포함)", r);
  r = await admin.req("PUT", "/api/admin/policy", { sheetShippingFee: -1 });
  ok(r.status === 400, "음수 배송비 거절", r);
  r = await seller.req("PUT", "/api/admin/policy", { salesFeeRate: 0 });
  ok(r.status === 403, "셀러는 정책 수정 불가", r);
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  r = await admin.req("POST", "/api/admin/sales-settlements", { from: today, to: today });
  ok(r.status === 201 && r.data.orders >= 4, "판매 정산서 생성 (배송 완료 주문서 4건 이상)", r);
  const st = await db.settlement.findFirst({ where: { orders: { some: { id: order1 } } }, include: { orders: true } });
  const sum = st.platformFee + st.brandAmount + st.commissionAmount + st.facilityAmount;
  ok(sum === st.grossAmount, `판매 정산 금액 일치: ${st.grossAmount} = 플랫폼 ${st.platformFee} + 브랜드 ${st.brandAmount} + 셀러 ${st.commissionAmount} + 창고 ${st.facilityAmount}`);
  ok(st.facilityId === F.id && st.brandAmount >= 30000, "스토리지마켓 출고 정산서: 브랜드 입고분 공급대금 포함", st.brandAmount);
  const stOwn = await db.settlement.findFirst({ where: { orders: { some: { id: order1b } } } });
  ok(stOwn?.facilityId === null && stOwn.facilityAmount === 0 && stOwn.commissionAmount === 0 && stOwn.platformFee + stOwn.brandAmount === stOwn.grossAmount, "위탁배송 주문서 정산: 창고 · 셀러 몫 없이 브랜드 공급대금", stOwn);
  r = await admin.req("POST", "/api/admin/sales-settlements", { from: today, to: today });
  ok(r.status === 404, "같은 주문 중복 정산 방지", r);
  r = await admin.req("POST", "/api/admin/brand-settlements", { from: today, to: today });
  ok(r.status === 201, "브랜드 정산서 생성", r);
  const bs = await db.brandSettlement.findFirst({ where: { brandShopId: nb.brandShop.id } });
  ok(bs.poCount === 4 && bs.supplyAmount === 70000 && bs.sampleCount === 1 && bs.sampleAmount === 2000, "배송 완료 발주 4건 + 발송된 유료 샘플 1건 포함 (취소 건 제외)", bs);
  ok(bs.feeRate === 7 && bs.platformFee === 4900 + 200 && bs.payoutAmount === 72000 - 5100, "브랜드별 수수료 7% + 샘플 수수료 10% 반영", bs);
  r = await admin.req("PATCH", `/api/admin/brand-settlements/${bs.id}`, { adjustment: -1000, memo: "반품 차감" });
  ok(r.ok && (await db.brandSettlement.findUnique({ where: { id: bs.id } })).payoutAmount === 72000 - 5100 - 1000, "수동 조정 반영", r);
  await admin.req("PATCH", `/api/admin/brand-settlements/${bs.id}`, { status: "CONFIRMED" });
  r = await admin.req("PATCH", `/api/admin/brand-settlements/${bs.id}`, { adjustment: 500 });
  ok(r.status === 409, "확정 후 조정 불가", r);
  r = await admin.req("PATCH", `/api/admin/brand-settlements/${bs.id}`, { status: "PAID" });
  ok(r.ok && (await db.brandSettlement.findUnique({ where: { id: bs.id } })).status === "PAID", "지급 완료", r);
  r = await admin.req("PATCH", `/api/purchase-orders/${po3.id}`, { adminMemo: "취소 확인" });
  ok(r.ok, "최고관리자 발주 메모", r);
  { const page = await seller.page("/seller/settlements");
    ok(page.status === 200 && page.text.includes("결제 · 정산 내역"), "셀러 결제 · 정산 내역 화면"); }

  console.log("\n[11] 예약 자동화 — 대기 만료 · 노쇼 · 체크인 · 자동 완료");
  const day2 = (() => { let d = new Date(Date.now() + 9 * 3600000); d.setUTCDate(d.getUTCDate() + 4); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
  r = await seller.req("POST", "/api/bookings", { facilityId: F.id, startAt: `${day2}T19:00`, endAt: `${day2}T21:00` });
  const pend = r.data?.bookings?.[0]?.id;
  await db.booking.update({ where: { id: pend }, data: { createdAt: new Date(Date.now() - 49 * 3600000) } });
  r = await admin.req("PATCH", "/api/cron/bookings", {});
  const pendRow = await db.booking.findUnique({ where: { id: pend } });
  ok(r.ok && pendRow.status === "REJECTED" && /자동 만료/.test(pendRow.rejectReason ?? ""), "48시간 응답 없는 대기 예약 자동 만료", pendRow?.status);

  const late = await db.booking.create({ data: { facilityId: F.id, sellerId, startAt: new Date(Date.now() - 2 * 3600000), endAt: new Date(Date.now() + 1 * 3600000), status: "APPROVED", code: `SB-T-${Math.random().toString(36).slice(2, 7).toUpperCase()}` } });
  r = await fac.req("PATCH", `/api/bookings/${late.id}`, { status: "NO_SHOW" });
  ok(r.ok && (await db.booking.findUnique({ where: { id: late.id } })).status === "NO_SHOW", "시작 2시간 지난 미체크인 예약 노쇼 처리", r);
  r = await fac.req("PATCH", `/api/bookings/${late.id}`, { status: "COMPLETED" });
  ok(r.ok, "노쇼 → 이용 완료로 바로잡기", r);
  const soon = await db.booking.create({ data: { facilityId: F.id, sellerId, startAt: new Date(Date.now() + 30 * 60000), endAt: new Date(Date.now() + 150 * 60000), status: "APPROVED", code: `SB-T-${Math.random().toString(36).slice(2, 7).toUpperCase()}` } });
  r = await fac.req("PATCH", `/api/bookings/${soon.id}`, { status: "NO_SHOW" });
  ok(r.status === 400, "시작 전 노쇼 처리 거절", r);
  r = await fac.req("PATCH", `/api/bookings/${soon.id}`, { action: "checkin" });
  ok(r.ok && !!(await db.booking.findUnique({ where: { id: soon.id } })).checkedInAt, "체크인 (시작 30분 전)", r);
  r = await seller.req("PATCH", `/api/bookings/${soon.id}`, { action: "checkin" });
  ok(r.status === 403, "셀러는 체크인 처리 불가", r);
  const ended = await db.booking.create({ data: { facilityId: F.id, sellerId, startAt: new Date(Date.now() - 5 * 3600000), endAt: new Date(Date.now() - 3 * 3600000), status: "APPROVED", code: `SB-T-${Math.random().toString(36).slice(2, 7).toUpperCase()}` } });
  await admin.req("PATCH", "/api/cron/bookings", {});
  ok((await db.booking.findUnique({ where: { id: ended.id } })).status === "COMPLETED", "종료된 승인 예약 자동 이용 완료");
  ok(!!(await db.booking.findUnique({ where: { id: soon.id } })).reminderSentAt, "이용 전 알림 발송 기록");
  r = await guest.req("GET", "/api/cron/bookings");
  ok(r.status === 401, "비로그인 자동 처리 호출 차단", r);

  console.log("\n[11-b] 회귀 점검 — 브랜드와 무관한 창고 자체 상품 주문서");
  const plain = await db.facilityProduct.findFirst({ where: { facilityId: F.id, brandProductId: null, isSellable: true, stock: { gt: 5 } } });
  const plainStock = plain.stock;
  x = await one(rcpt(21, { lines: [{ code: `S-${plain.id}`, quantity: 1 }] }));
  ok(x.row?.ok, "창고 자체 상품 주문서 결제", x.res);
  const plainOrder = x.row?.orders?.[0]?.id;
  ok((await db.facilityProduct.findUnique({ where: { id: plain.id } })).stock === plainStock - 1, "창고 자체 상품 주문 시 창고 재고 차감");
  const plainItems = await db.orderItem.findMany({ where: { orderId: plainOrder } });
  ok(plainItems.length === 1 && plainItems.every((i) => i.facilityAmount != null && i.platformFee != null && i.brandAmount === 0), "주문 시점 수익 분배 저장 (브랜드 몫 없음)", plainItems);
  ok((await db.purchaseOrder.count({ where: { orderId: plainOrder } })) === 0, "브랜드 상품이 없으면 발주서 없음");
  r = await fac.req("PATCH", `/api/orders/${plainOrder}`, { status: "CANCELLED", reason: "재고 확인 필요" });
  ok(r.ok, "창고 운영자도 출고 전 주문서 취소 가능", r);
  ok((await db.facilityProduct.findUnique({ where: { id: plain.id } })).stock === plainStock, "취소 시 창고 재고 복구");
  ok(!!(await db.userNotification.findFirst({ where: { userId: sellerId, title: { contains: "취소" }, createdAt: { gte: new Date(Date.now() - 60000) } } })), "창고가 취소하면 셀러에게 알림");
  r = await seller.req("PATCH", `/api/orders/${plainOrder}`, { status: "CANCELLED", reason: "중복" });
  ok(r.status === 409, "이미 취소된 주문 중복 취소 거절", r);
  x = await one(rcpt(22, { lines: [{ code: `S-${plain.id}`, quantity: plainStock + 50 }] }));
  ok(x.row && !x.row.ok && (await db.facilityProduct.findUnique({ where: { id: plain.id } })).stock === plainStock, "창고 재고보다 많은 주문서 거절 (재고 그대로)", x.row);

  console.log("\n[11-e] 브랜드 상품 찜");
  r = await seller.req("POST", "/api/brand-favorites", { productId: p1.id });
  ok(r.ok && r.data.favorited === true, "브랜드 상품 찜", r);
  r = await seller.req("POST", "/api/brand-favorites", { productId: p1.id });
  ok(r.ok && r.data.favorited === false, "찜 해제", r);
  await seller.req("POST", "/api/brand-favorites", { productId: p1.id });
  r = await brand.req("POST", "/api/brand-favorites", { productId: p1.id });
  ok(r.status === 403, "브랜드사 계정은 찜 불가", r);

  console.log("\n[11-c] 주문서 배송비 정책 · 엑셀 업로드");
  await admin.req("PUT", "/api/admin/policy", { sheetShippingFee: 4000 });
  x = await one(rcpt(23, { lines: [{ code: `S-${plain.id}`, quantity: 1 }] }));
  const shipOrder = x.row?.orders?.[0]?.id ? await db.order.findUnique({ where: { id: x.row.orders[0].id } }) : null;
  ok(shipOrder?.shippingFee === 4000 && shipOrder.totalAmount === plainItems[0].unitPrice + 4000, "바꾼 주문서 배송비가 다음 주문서부터 반영", shipOrder);
  if (shipOrder) await seller.req("PATCH", `/api/orders/${shipOrder.id}`, { status: "CANCELLED", reason: "테스트" });
  await admin.req("PUT", "/api/admin/policy", { sheetShippingFee: SHIP });
  {
    const tpl = await seller.req("GET", "/api/seller/order-sheets/template", undefined, true);
    const buf = Buffer.from(await tpl.arrayBuffer());
    ok(tpl.status === 200 && buf.subarray(0, 2).toString() === "PK", "주문서 엑셀 양식 내려받기 (.xlsx)", tpl.status);
    const csvText = "﻿외부 주문번호,판매 플랫폼,받는 분,연락처,주소,상품코드,상품명,옵션,수량,배송 메모\n" +
      `X-1,그립,김엑셀,010-5000-0001,서울 종로구 1,B-${p1.id},,용량:30ml,1,\n` +
      `X-1,그립,김엑셀,010-5000-0001,서울 종로구 1,S-${plain.id},,,2,\n` +
      `X-2,,박엑셀,010-5000-0002,부산 중구 2,B-${p1.id},,용량:99ml,1,\n` +
      `,,이엑셀,010-5000-0003,대구 중구 3,,없는상품,,1,\n`;
    const parse = async (c, text, name = "orders.csv") => { const fd = new FormData(); fd.append("file", new Blob([text]), name); fd.append("platform", "MORULIVE"); const res = await fetch(BASE + "/api/seller/order-sheets/parse", { method: "POST", headers: { cookie: c.cookie() }, body: fd }); return { status: res.status, ...(await res.json().catch(() => ({}))) }; };
    r = await parse(seller, csvText);
    const sh = r.data?.sheets ?? [];
    ok(r.ok && sh.length >= 2 && sh.length <= 3, "CSV 주문서 읽기: 외부 주문번호 · 받는 분으로 묶기", r.data);
    ok(sh[0]?.lines?.length === 2 && sh[0].platform === "GRIP" && !sh[0].error && sh[0].itemsTotal === 10000 + plainItems[0].unitPrice * 2, "같은 주문번호 2줄 → 한 장 · 플랫폼 이름 인식 · 공급가 합계", sh[0]);
    ok(sh[1]?.platform === "MORULIVE" && /옵션/.test(sh[1]?.error ?? ""), "플랫폼 칸이 비면 기본 플랫폼 · 틀린 옵션 표시", sh[1]);
    ok(!!sh[2]?.error || (r.data?.errors ?? []).length > 0, "상품을 못 찾은 줄은 오류로 표시", [sh[2], r.data?.errors]);
    r = await parse(brand, csvText);
    ok(r.status === 403, "브랜드사는 주문서 파일 읽기 불가", r);
    r = await parse(seller, "그냥,아무,내용\n1,2,3\n");
    ok(r.status === 400 || (r.data?.sheets ?? []).length === 0, "양식이 아닌 파일은 거절", r);
    // 읽은 주문서 중 맞는 것만 제출
    const good = sh.filter((s) => !s.error).map(({ error, itemsTotal, ...s }) => s);
    r = await submit(seller, good);
    ok(r.status === 201 && r.data.success === good.length, "엑셀로 읽은 주문서 제출", r.data);
    const xOrders = await db.order.findMany({ where: { sellerId, externalOrderNo: "X-1" }, orderBy: { createdAt: "desc" }, take: 2 });
    ok(xOrders.length === 2 && xOrders.every((o) => o.buyerName === "김엑셀" && o.platform === "GRIP"), "엑셀 주문서도 보내는 곳별로 주문 생성", xOrders.map((o) => o.facilityId));
    for (const o of xOrders) await seller.req("PATCH", `/api/orders/${o.id}`, { status: "CANCELLED", reason: "엑셀 테스트 정리" });
  }

  const sign = { agreeTerms: true, agreePrivacy: true };

  console.log("\n[13] 동의 · 보안 헤더 · 셀러 판매 플랫폼");
  await db.rateLimit.deleteMany({}).catch(() => {}); // 가입 요청 횟수 제한(IP당 10분 10회)에 걸리지 않게
  r = await guest.req("POST", "/api/auth/signup", { email: `noagree${Date.now()}@t.kr`, password: "password1234", name: "동의안함", role: "SELLER", livePlatforms: ["GRIP"] });
  ok(r.status === 400 && /약관/.test(r.error ?? ""), "약관 동의 없이 가입 거절", r);
  r = await guest.req("POST", "/api/auth/signup", { email: `noplat${Date.now()}@t.kr`, password: "password1234", name: "플랫폼없음", role: "SELLER", ...sign });
  ok(r.status === 400 && /플랫폼/.test(r.error ?? ""), "셀러는 판매 플랫폼을 골라야 가입", r);
  r = await guest.req("POST", "/api/auth/signup", { email: `etc${Date.now()}@t.kr`, password: "password1234", name: "기타", role: "SELLER", livePlatforms: ["ETC"], ...sign });
  ok(r.status === 400, "기타 플랫폼은 이름 필수", r);
  r = await guest.req("POST", "/api/auth/signup", { email: `bad${Date.now()}@t.kr`, password: "password1234", name: "없는", role: "SELLER", livePlatforms: ["NOPE"], ...sign });
  ok(r.status === 400, "없는 플랫폼 거절", r);
  const pe = `plat${Date.now()}@t.kr`;
  r = await guest.req("POST", "/api/auth/signup", { email: pe, password: "password1234", name: "플랫폼셀러", role: "SELLER", livePlatforms: ["SELLERBRICKS", "VIBE", "ETC"], livePlatformEtc: "우리몰 라이브", ...sign });
  const pu = await db.user.findUnique({ where: { email: pe }, include: { profile: true } });
  ok(r.status === 201 && pu.profile.livePlatforms.join() === "SELLERBRICKS,VIBE,ETC" && pu.profile.livePlatformEtc === "우리몰 라이브" && pu.profileImageIndex >= 1, "판매 플랫폼 저장 · 동물 캐릭터 무작위 지정", pu.profile);
  {
    const ps = new Client("plat-seller"); await ps.login(pe);
    r = await ps.req("PATCH", "/api/me/profile", { livePlatforms: [] });
    ok(r.status === 400, "설정에서 판매 플랫폼을 모두 빼면 거절", r);
    r = await ps.req("PATCH", "/api/me/profile", { livePlatforms: ["GRIP", "TIKTOK"] });
    ok(r.ok && (await db.profile.findUnique({ where: { userId: pu.id } })).livePlatforms.join() === "GRIP,TIKTOK", "설정에서 판매 플랫폼 변경", r);
    const other = pu.profileImageIndex === 1 ? 2 : 1;
    r = await ps.req("PATCH", "/api/me/profile", { name: "플랫폼셀러", profileImageIndex: other });
    ok(r.status === 403 && (await db.user.findUnique({ where: { id: pu.id } })).profileImageIndex === pu.profileImageIndex, "동물 캐릭터는 바꿀 수 없음", r);
    r = await ps.req("PATCH", "/api/me/profile", { name: "플랫폼셀러2", profileImageIndex: pu.profileImageIndex });
    ok(r.ok, "같은 캐릭터 값과 함께 저장하면 다른 정보는 저장", r);
    r = await brand.req("PATCH", "/api/me/profile", { livePlatforms: ["GRIP"] });
    ok(r.status === 400 || r.status === 403 || (r.ok && !(await db.profile.findUnique({ where: { userId: nb.id } })).livePlatforms.length), "셀러가 아니면 판매 플랫폼 저장 안 됨", r);
    const page = await ps.page("/seller/settings");
    ok(page.status === 200 && page.text.includes("판매하는 라이브 플랫폼") && page.text.includes("바꿀 수 없습니다"), "셀러 설정: 판매 플랫폼 · 캐릭터 고정 안내");
  }
  const home = await guest.req("GET", "/", undefined, true);
  ok(home.headers.get("x-frame-options") === "SAMEORIGIN" && home.headers.get("x-content-type-options") === "nosniff", "보안 헤더 적용", [home.headers.get("x-frame-options")]);

  console.log("\n[14] 브랜드 실재고 — 여러 주문서가 같은 상품을 담을 때 초과 판매 방지");
  r = await brand.req("POST", "/api/brands", { ...base, name: "한정 수량 세럼", category: "코스메틱", supplyPrice: 5000, consumerPrice: 15000, stock: 3, samplePrice: null, sampleStock: 0, allowDropship: true, allowWarehouse: false });
  const p3 = r.data.id;
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: p3, target: "SELLER", fulfillment: "DROPSHIP", salePrice: 12000 });
  ok(r.status === 201, "셀러가 한정 상품(재고 3) 고르기", r);
  x = await one(rcpt(31, { lines: [{ code: `B-${p3}`, quantity: 2 }] }));
  ok(x.row?.ok && (await db.brandProduct.findUnique({ where: { id: p3 } })).stock === 1, "주문서 2개 → 브랜드 재고 1", x.res);
  x = await one(rcpt(32, { lines: [{ code: `B-${p3}`, quantity: 2 }] }));
  ok(x.row && !x.row.ok && /재고/.test(x.row.error ?? "") && (await db.brandProduct.findUnique({ where: { id: p3 } })).stock === 1, "남은 재고보다 많은 주문서 거절 (재고 그대로 · 결제 없음)", x.row);
  ok((await db.order.count({ where: { sellerId, buyerName: "받는분32", status: { not: "CANCELLED" } } })) === 0, "거절된 주문서는 결제 완료 주문을 남기지 않음");
  r = await submit(seller, [rcpt(33, { lines: [{ code: `B-${p3}`, quantity: 1 }] }), rcpt(34, { lines: [{ code: `B-${p3}`, quantity: 1 }] })]);
  ok(r.data?.success === 1 && r.data.failed === 1 && (await db.brandProduct.findUnique({ where: { id: p3 } })).stock === 0, "마지막 1개를 두 장이 노리면 한 장만 성공", r.data);
  ok(!!(await db.userNotification.findFirst({ where: { userId: nb.id, title: { contains: "한정 수량 세럼" } } })), "브랜드에 재고 부족·품절 알림");

  console.log("\n[15] 부분 취소 (발주서 단위)");
  // 다른 브랜드(시드 브랜드) 위탁배송 상품을 하나 더 골라, 한 주문서에 브랜드 두 곳을 담는다
  const seedBp = await db.brandProduct.findFirst({ where: { shop: { status: "APPROVED", NOT: { id: nb.brandShop.id } }, isActive: true, allowDropship: true, stock: { gt: 5 } }, orderBy: { createdAt: "asc" } });
  if (seedBp) await db.sellerBrandProduct.upsert({ where: { sellerId_brandProductId: { sellerId, brandProductId: seedBp.id } }, update: { isActive: true }, create: { sellerId, brandProductId: seedBp.id, salePrice: seedBp.supplyPrice + 5000 } });
  const seedOpt = seedBp?.options ? seedBp.options.split(",")[0].split(":").map((s) => s.trim()) : null;
  const seedLine = seedBp ? { code: `B-${seedBp.id}`, quantity: 1, optionLabel: seedOpt && seedOpt[1] ? `${seedOpt[0]}:${seedOpt[1]}` : undefined } : null;
  x = await one(rcpt(41, { lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:30ml" }, ...(seedLine ? [seedLine] : [])] }));
  const oP = x.row?.orders?.[0]?.id;
  const posP = await db.purchaseOrder.findMany({ where: { orderId: oP } });
  ok(x.row?.ok && x.row.orders.length === 1 && posP.length === 2, "브랜드 두 곳 위탁배송 → 주문 1건 · 발주서 2장", [x.row, posP.length]);
  const poDrop = posP.find((p) => p.brandShopId === nb.brandShop.id);
  const stockBefore = (await db.brandProduct.findUnique({ where: { id: p1.id } })).stock;
  r = await seller.req("PATCH", `/api/orders/${oP}`, { action: "cancel-items", purchaseOrderId: poDrop?.id, reason: "고객 일부 취소" });
  const oPRow = await db.order.findUnique({ where: { id: oP }, include: { items: true } });
  ok(r.ok && oPRow.status === "PAID" && oPRow.refundedAmount === 10000 && oPRow.items.filter((i) => i.cancelledAt).length === 1, "셀러가 출고 전 발주서 한 장만 부분 취소 (주문은 유지 · 공급가만 환불)", r);
  { const rest = await db.purchaseOrder.findMany({ where: { orderId: oP, id: { not: poDrop.id } } });
    ok((await db.purchaseOrder.findUnique({ where: { id: poDrop.id } })).status === "CANCELLED" && rest.length === 1 && rest[0].status !== "CANCELLED", "취소한 발주서만 취소, 다른 브랜드 발주는 그대로", rest.map((p) => p.status)); }
  ok((await db.brandProduct.findUnique({ where: { id: p1.id } })).stock === stockBefore + 1, "브랜드 재고 복구");
  r = await seller.req("PATCH", `/api/orders/${oP}`, { action: "cancel-items", itemIds: ["없는줄"], reason: "x" });
  ok(r.status === 400, "다른 주문의 상품 줄은 취소 불가", r);
  if (oP) await seller.req("PATCH", `/api/orders/${oP}`, { status: "CANCELLED", reason: "부분 취소 테스트 정리" });

  console.log("\n[16] 브랜드 출고 불가 요청 → 셀러 취소 / 최고관리자 발주 취소 = 셀러 결제 환불");
  x = await one(rcpt(42, { lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:50ml" }] }));
  const oQ = x.row?.orders?.[0]?.id;
  const poQ = await db.purchaseOrder.findFirst({ where: { orderId: oQ } });
  r = await brand.req("PATCH", `/api/purchase-orders/${poQ.id}`, { action: "REQUEST_CANCEL" });
  ok(r.status === 400, "사유 없는 출고 불가 요청 거절", r);
  r = await brand.req("PATCH", `/api/purchase-orders/${poQ.id}`, { action: "REQUEST_CANCEL", reason: "50ml 품절" });
  ok(r.ok && !!(await db.purchaseOrder.findUnique({ where: { id: poQ.id } })).cancelRequestedAt, "브랜드 출고 불가 요청", r);
  ok(!!(await db.userNotification.findFirst({ where: { title: { contains: poQ.poNo }, link: "/seller/orders" } })), "셀러에게 셀러 화면 링크로 알림");
  r = await seller.req("PATCH", `/api/orders/${oQ}`, { action: "cancel-items", purchaseOrderId: poQ.id, reason: "브랜드 품절" });
  const oQRow = await db.order.findUnique({ where: { id: oQ }, include: { payment: true } });
  ok(r.ok && r.data.full && oQRow.status === "CANCELLED" && oQRow.payment.status === "CANCELLED", "남은 상품이 없으면 주문서 전체 취소 · 셀러 결제 취소", r);
  x = await one(rcpt(43, { lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:30ml" }] }));
  const oR = x.row?.orders?.[0]?.id;
  const poR = await db.purchaseOrder.findFirst({ where: { orderId: oR } });
  r = await admin.req("PATCH", `/api/purchase-orders/${poR.id}`, { status: "CANCELLED", reason: "관리자 확인 결과 출고 불가" });
  const oRRow = await db.order.findUnique({ where: { id: oR }, include: { payment: true } });
  ok(r.ok && oRRow.status === "CANCELLED" && oRRow.payment.status === "CANCELLED", "최고관리자 발주 취소 → 셀러 결제도 취소 (돈만 남는 상황 방지)", r);

  console.log("\n[17] 정산 후 환불 → 다음 정산에서 자동 차감 · 반품 수령 확인");
  r = await seller.req("PATCH", `/api/orders/${order2}`, { status: "REFUNDED", reason: "정산 후 반품" });
  ok(r.status === 403, "셀러는 브랜드가 보낸 주문서를 직접 환불 불가 (최고관리자)", r);
  r = await fac.req("PATCH", `/api/orders/${order2}`, { status: "REFUNDED", reason: "정산 후 반품" });
  ok(r.status === 403, "창고 운영자는 위탁배송 주문서 처리 불가", r);
  r = await admin.req("PATCH", `/api/orders/${order2}`, { status: "REFUNDED", reason: "정산 후 반품" });
  const po2Row = await db.purchaseOrder.findUnique({ where: { id: po2.id } });
  ok(r.ok && po2Row.status === "RETURNED", "최고관리자 환불 → 발주 반품 처리", r);
  const badj = await db.brandSettlementAdjustment.findFirst({ where: { purchaseOrderId: po2.id } });
  ok(badj?.amount === -(10000 - 700), "브랜드 차감 항목 생성 (공급가 10,000 − 수수료 7%)", badj);
  const sadj = await db.salesAdjustment.findFirst({ where: { orderId: order2 } });
  ok(!!sadj && sadj.grossAmount < 0 && sadj.grossAmount === sadj.platformFee + sadj.brandAmount + sadj.sellerAmount + sadj.facilityAmount, "판매 정산 차감 항목 생성 (금액 합 일치)", sadj);
  r = await brand.req("PATCH", `/api/purchase-orders/${po2.id}`, { action: "RETURN_RECEIVED" });
  ok(r.ok && !!(await db.purchaseOrder.findUnique({ where: { id: po2.id } })).returnReceivedAt, "브랜드 반품 수령 확인", r);
  r = await fac.req("PATCH", `/api/orders/${oC2}`, { status: "REFUNDED", reason: "스토리지마켓 출고분 반품" });
  ok(r.ok && (await db.order.findUnique({ where: { id: oC2 } })).status === "REFUNDED", "스토리지마켓 출고 주문서는 창고 운영자가 환불", r);
  r = await admin.req("POST", "/api/admin/brand-settlements", { from: today, to: today, shopIds: [nb.brandShop.id] });
  const bs2 = await db.brandSettlement.findFirst({ where: { brandShopId: nb.brandShop.id }, orderBy: { createdAt: "desc" } });
  ok(r.status === 201 && bs2.autoAdjustment === -18600 && bs2.payoutAmount === bs2.grossAmount - bs2.platformFee - 18600, "다음 브랜드 정산서에 자동 차감 반영 (두 건)", { autoAdjustment: bs2.autoAdjustment, payout: bs2.payoutAmount });
  r = await admin.req("POST", "/api/admin/sales-settlements", { from: today, to: today });
  ok(r.status === 201 && r.data.adjustments >= 1, "다음 판매 정산서에 자동 차감 반영", r);
  const stmt = await brand.req("GET", `/api/brand-settlements/${bs2.id}/statement`, undefined, true);
  const stmtText = await stmt.text();
  ok(stmt.status === 200 && (stmtText.includes("정산 후 반품") || stmtText.includes("차감")), "브랜드 정산 명세 CSV 내려받기");
  r = await otherBrand.req("GET", `/api/brand-settlements/${bs2.id}/statement`);
  ok(r.status === 404, "다른 브랜드 정산 명세 접근 차단", r);

  console.log("\n[18] 결제사 웹훅 — 취소 통지 반영 · 같은 통지 중복 무시");
  x = await one(rcpt(51, { lines: [{ code: `S-${plain.id}`, quantity: 1 }] }));
  const oW = x.row?.orders?.[0]?.id;
  const payW = await db.payment.findFirst({ where: { orderId: oW } });
  const plainBefore = (await db.facilityProduct.findUnique({ where: { id: plain.id } })).stock;
  const hook = JSON.stringify({ pgTransactionId: payW.pgTransactionId, status: "CANCELLED", eventId: `evt-${Date.now()}` });
  const hookHeaders = WEBHOOK_SECRET ? { "x-signature": createHmac("sha256", WEBHOOK_SECRET).update(hook).digest("hex") } : {};
  const sendHook = async () => { const res = await fetch(BASE + "/api/webhooks/payment", { method: "POST", headers: { "content-type": "application/json", ...hookHeaders }, body: hook }); return { status: res.status, ...(await res.json().catch(() => ({}))) }; };
  r = await sendHook();
  ok(r.ok && (await db.order.findUnique({ where: { id: oW } })).status === "CANCELLED", "웹훅 취소 통지 → 주문서 취소", r);
  ok((await db.facilityProduct.findUnique({ where: { id: plain.id } })).stock === plainBefore + 1, "웹훅 취소 시 창고 재고 복구");
  r = await sendHook();
  ok(r.ok && r.data.duplicate === true, "같은 웹훅 다시 오면 무시", r);

  console.log("\n[19] 판매처 승인제 · 차단 · 최저 판매가");
  const shopBase = { action: "shop", shopId: nb.brandShop.id, name: "하루 코스메틱", tagline: "", description: "", logoUrl: "", bannerUrl: "", backgroundUrl: "" };
  r = await brand.req("POST", "/api/brands", { ...shopBase, requireSellerApproval: true });
  ok(r.ok, "브랜드 승인제 켜기", r);
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: p2, target: "SELLER", fulfillment: "DROPSHIP", salePrice: 9000 });
  ok(r.status === 403 && /판매처 신청/.test(r.error ?? ""), "승인 전에는 상품 고르기 거절", r);
  r = await seller.req("POST", "/api/brand-imports", { action: "apply", shopId: nb.brandShop.id, note: "클릭메이트 · 그립 주 3회" });
  ok(r.status === 201 && r.data.status === "PENDING", "판매처 신청", r);
  r = await brand.req("POST", "/api/brand-partners", { userId: sellerId, status: "APPROVED" });
  ok(r.ok, "브랜드가 판매처 승인", r);
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: p2, target: "SELLER", fulfillment: "DROPSHIP", salePrice: 9000 });
  ok(r.status === 201, "승인 후 고르기 성공", r);
  r = await brand.req("POST", "/api/brand-partners", { userId: sellerId, status: "BLOCKED", note: "가격 정책 위반" });
  ok(r.ok && (await db.sellerBrandProduct.count({ where: { sellerId, brandProduct: { shopId: nb.brandShop.id }, isActive: true } })) === 0, "차단 → 셀러 판매 목록 모두 중단", r);
  r = await seller.req("GET", "/api/seller/order-sheets/catalog");
  ok(!(r.data ?? []).some((c) => c.code === `B-${p1.id}` || c.code === `S-${fpW}`), "차단 → 주문서 상품 목록에서 이 브랜드 상품(입고분 포함) 빠짐", (r.data ?? []).map((c) => c.code));
  x = await one(rcpt(52, { lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:30ml" }] }));
  ok(x.row && !x.row.ok, "차단된 판매처는 이 브랜드 주문서 제출 불가", x.row);
  r = await seller.req("POST", "/api/brands", { action: "request", productId: p1.id, requestKey: key(), kind: "SAMPLE", quantity: 1, expectedUnitPrice: 0, ...ship });
  ok(r.status === 403, "차단된 판매처는 샘플 신청 불가", r);
  r = await seller.req("POST", "/api/brand-messages", { shopId: nb.brandShop.id, body: "문의드립니다" });
  ok(r.status === 403, "차단된 판매처는 문의 불가", r);
  await brand.req("POST", "/api/brand-partners", { userId: sellerId, status: "REMOVE" });
  await brand.req("POST", "/api/brands", { ...shopBase, requireSellerApproval: false });
  const p1Row = await db.brandProduct.findUnique({ where: { id: p1.id } });
  r = await brand.req("POST", "/api/brands", { ...base, productId: p1.id, revision: p1Row.updatedAt.toISOString(), name: p1Row.name, category: p1Row.category, subCategory: p1Row.subCategory, supplyPrice: p1Row.supplyPrice, consumerPrice: p1Row.consumerPrice, stock: p1Row.stock, samplePrice: p1Row.samplePrice, sampleStock: p1Row.sampleStock, sampleLimitPerBuyer: p1Row.sampleLimitPerBuyer, options: p1Row.options, allowDropship: true, allowWarehouse: true, minSalePrice: 26000 });
  ok(r.ok, "최저 판매가 26,000원 설정", r);
  r = await seller.req("POST", "/api/brand-imports", { action: "seller-update", listingId: listing, salePrice: 25000, isActive: true });
  ok(r.status === 400 && /최저 판매가/.test(r.error ?? ""), "최저 판매가 미만 판매가 거절", r);

  console.log("\n[20] 브랜드샵 공개 중지 → 주문서 즉시 중단");
  r = await seller.req("POST", "/api/brand-imports", { action: "seller-update", listingId: listing, salePrice: 27000, isActive: true });
  ok(r.ok, "판매 재개", r);
  r = await admin.req("POST", "/api/brands", { action: "moderate", shopId: nb.brandShop.id, status: "SUSPENDED", moderationNote: "서류 확인 필요" });
  ok(r.ok && !(await db.facilityProduct.findUnique({ where: { id: fpW } })).isSellable, "공개 중지 → 스토리지마켓 입고 상품 판매 중단", r);
  x = await one(rcpt(53, { lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:30ml" }] }));
  ok(x.row && !x.row.ok, "공개 중지된 브랜드 상품 주문서 거절", x.row);
  await admin.req("POST", "/api/brands", { action: "moderate", shopId: nb.brandShop.id, status: "APPROVED", moderationNote: "" });

  console.log("\n[21] 정산 계좌 변경 보호 · 팀원 계정 · 문의함 · 운송장 일괄 입력");
  r = await brand.req("POST", "/api/brands", { ...shopBase, bankName: "국민", bankAccount: "999-999-999", accountHolder: "하루" });
  ok(r.status === 403 && /비밀번호/.test(r.error ?? ""), "비밀번호 없이 정산 계좌 변경 거절", r);
  r = await brand.req("POST", "/api/brands", { ...shopBase, bankName: "국민", bankAccount: "999-999-999", accountHolder: "하루", currentPassword: "password1234" });
  ok(r.ok && !!(await db.brandShop.findUnique({ where: { id: nb.brandShop.id } })).bankChangedAt, "비밀번호 확인 후 계좌 변경 + 관리자 알림", r);
  const memberEmail = `member${Date.now()}@t.kr`;
  r = await brand.req("POST", "/api/brand-team", { action: "add", email: memberEmail, name: "출고 담당", password: "member1234" });
  ok(r.status === 201, "대표가 팀원 계정 추가", r);
  const member = new Client("member");
  ok((await member.login(memberEmail, "member1234")).data?.user?.role === "BRAND_ADMIN", "팀원 로그인");
  r = await member.req("PATCH", `/api/purchase-orders/${po2.id}`, { brandMemo: "팀원 메모" });
  ok(r.ok, "팀원도 같은 브랜드 발주서 처리 가능", r);
  r = await member.req("POST", "/api/brands", { ...shopBase, bankAccount: "111-111-111", currentPassword: "member1234" });
  ok(r.status === 403, "팀원은 정산 계좌 변경 불가", r);
  r = await member.req("POST", "/api/brand-team", { action: "add", email: `x${Date.now()}@t.kr`, name: "x", password: "member1234" });
  ok(r.status === 403, "팀원은 팀원 추가 불가", r);
  r = await seller.req("POST", "/api/brand-messages", { shopId: nb.brandShop.id, body: "샘플 일정 문의드립니다" });
  const thread = await db.brandThread.findFirst({ where: { shopId: nb.brandShop.id, partnerId: sellerId } });
  ok(r.status === 201 && thread?.brandUnread >= 1, "셀러 → 브랜드 문의 (안 읽음)", r);
  r = await member.req("POST", "/api/brand-messages", { threadId: thread.id, body: "다음 주 발송 예정입니다" });
  ok(r.status === 201 && (await db.brandThread.findUnique({ where: { id: thread.id } })).partnerUnread >= 1, "팀원이 답장 (셀러 안 읽음)", r);
  r = await otherBrand.req("POST", "/api/brand-messages", { threadId: thread.id, body: "엿보기" });
  ok(r.status === 404, "다른 브랜드는 대화에 끼어들 수 없음", r);
  const memberId = (await db.user.findUnique({ where: { email: memberEmail } })).id;
  r = await brand.req("POST", "/api/brand-team", { action: "remove", userId: memberId });
  ok(r.ok && (await member.req("GET", "/api/me")).data?.user === null, "팀원 내보내기 → 기존 로그인 즉시 끊김", r);
  await seller.req("POST", "/api/brand-imports", { action: "seller-update", listingId: listing, salePrice: 27000, isActive: true });
  x = await one(rcpt(54, { lines: [{ code: `B-${p1.id}`, quantity: 1, optionLabel: "용량:30ml" }] }));
  const poBulk = await db.purchaseOrder.findFirst({ where: { orderId: x.row?.orders?.[0]?.id } });
  r = await brand.req("POST", "/api/purchase-orders/bulk-ship", { rows: [{ poNo: poBulk?.poNo ?? "PO-X", carrier: "CJ대한통운", trackingNumber: "BULK-1" }, { poNo: "PO-000000-NONE00", carrier: "", trackingNumber: "x" }] });
  ok(r.ok && r.data.results[0].ok && !r.data.results[1].ok && (await db.purchaseOrder.findUnique({ where: { id: poBulk.id } })).status === "SHIPPED", "운송장 일괄 입력 (성공 1 · 없는 발주 1 실패)", r);

  console.log("\n[22] 이미지 업로드 · 비밀번호 재설정");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const up = async (c, buf, name, type) => { const fd = new FormData(); fd.append("file", new Blob([buf], { type }), name); fd.append("folder", "product"); const res = await fetch(BASE + "/api/uploads", { method: "POST", headers: { cookie: c.cookie() }, body: fd }); return { status: res.status, ...(await res.json().catch(() => ({}))) }; };
  r = await up(brand, png, "a.png", "image/png");
  ok(r.status === 201 && /^\/uploads\/product\/.+\.png$/.test(r.data?.url ?? ""), "PNG 이미지 업로드", r);
  if (r.data?.url) { const img = await fetch(BASE + r.data.url); ok(img.status === 200, "업로드한 이미지 열림", img.status); }
  r = await up(brand, Buffer.from("<script>alert(1)</script>"), "x.png", "image/png");
  ok(r.status === 400, "이미지가 아닌 파일은 확장자를 바꿔도 거절", r);
  r = await up(guest, png, "a.png", "image/png");
  ok(r.status === 401, "비로그인 업로드 차단", r);
  r = await guest.req("POST", "/api/auth/password-reset", { email });
  const devLink = r.data?.devLink ?? "";
  ok(r.ok && devLink.includes("/reset-password?token="), "비밀번호 재설정 메일 (개발 환경 링크)", r);
  r = await guest.req("POST", "/api/auth/password-reset", { email: `nobody${Date.now()}@t.kr` });
  ok(r.ok && !r.data?.devLink, "없는 이메일도 같은 답 (가입 여부 노출 안 함)", r);
  const token = new URL(devLink || "http://x/?token=").searchParams.get("token");
  r = await guest.req("POST", "/api/auth/password-reset/confirm", { token, password: "newpass5678" });
  ok(r.ok, "새 비밀번호 저장", r);
  r = await guest.req("POST", "/api/auth/password-reset/confirm", { token, password: "another999" });
  ok(r.status === 400, "같은 링크 재사용 불가", r);
  ok((await brand.req("GET", "/api/me")).data?.user === null, "비밀번호 재설정 → 기존 로그인 끊김");
  ok((await brand.login(email, "newpass5678")).data?.user?.role === "BRAND_ADMIN", "새 비밀번호로 로그인");
  await db.user.update({ where: { email }, data: { passwordHash: (await db.user.findUnique({ where: { email: "brand@sellerbricks.kr" } })).passwordHash } }); // 다음 실행을 위해 원래 비밀번호(password1234)로 되돌림

  console.log("\n[23] 구매자 기능 없음 · 주문 현황 카드");
  for (const [m, p] of [["POST", "/api/orders"], ["POST", "/api/orders/lookup"], ["POST", "/api/coupons/check"], ["POST", "/api/live-sessions"], ["GET", "/api/kakao/channels"]]) {
    const res = await fetch(BASE + p, { method: m, redirect: "manual", headers: { "content-type": "application/json", cookie: seller.cookie() }, body: m === "POST" ? "{}" : undefined });
    ok(res.status === 404 || res.status === 405, `구매자 · 방송 API 없음: ${m} ${p} → ${res.status}`);
  }
  for (const p of ["/order-lookup", `/live/x-${Date.now()}`, `/checkout/x-${Date.now()}`, `/order-complete/x`]) {
    const res = await guest.page(p);
    ok(res.status === 404, `구매자 화면 없음: ${p} → ${res.status}`);
  }
  for (const p of ["/seller/live-sessions", "/seller/kakao", "/seller/marketing/coupons"]) {
    const res = await seller.req("GET", p, undefined, true);
    ok([307, 308].includes(res.status) && (res.headers.get("location") ?? "").includes("/seller/orders"), `예전 메뉴 주소는 주문서 화면으로: ${p}`, res.status);
  }
  { const homeHtml = (await guest.page("/")).text;
    ok(!homeHtml.includes('href="/order-lookup"') && !homeHtml.includes('href="/signup/facility"'), "메인 화면에 주문 조회 · 창고 가입 링크 없음"); }
  for (const [c, p] of [[fac, "/facility/orders"], [seller, "/seller/orders"], [admin, "/admin/orders"]]) {
    const res = await c.page(p);
    ok(res.status === 200 && !/<td[^>]*>\s*<td/.test(res.text) && /배송지 보기|주문이 없습니다|받는 분/.test(res.text), `주문 현황 카드 (${p}) · 표 칸 중첩 없음`);
  }

  console.log("\n[12] 화면 렌더링 (역할별 주요 페이지)");
  const pages = [
    [admin, ["/admin/dashboard", "/admin/purchase-orders", "/admin/payouts", "/admin/payouts?tab=brand", "/admin/policy", "/admin/bookings", `/admin/brands/${nb.brandShop.id}`, "/admin/brands/requests", "/admin/orders", "/admin/settlements", "/admin/users", "/admin/site-management", "/admin/site-management?tab=background", "/admin/site-management?tab=notices", "/admin/site-management?tab=access"]],
    [brand, ["/brand/dashboard", "/brand/orders", "/brand/requests", "/brand/settlements", `/brands/${nb.brandShop.id}`, "/brand/claims", "/brand/messages", "/brand/reports", "/brand/team", "/brand/channels", "/brand/products", "/brand/shop", "/brand/settings"]],
    [seller, ["/seller/dashboard", "/seller/brand-products", "/seller/bookings", "/seller/orders", "/seller/orders/new", "/seller/settlements", "/seller/marketing/analytics", "/seller/settings", "/seller/brand-requests", "/seller/brands", `/seller/brands/${nb.brandShop.id}`, "/brands", `/brands/${nb.brandShop.id}`, "/seller/bookings/new", "/seller/brand-messages", `/seller/brand-messages?shop=${nb.brandShop.id}`, "/seller/brand-favorites"]],
    [fac, ["/facility/dashboard", "/facility/brand-products", "/facility/bookings", "/facility/schedule", "/facility/orders", "/facility/settlements", "/facility/products", `/brands/${nb.brandShop.id}`]],
    [guest, ["/", "/intro", "/signup/brand", "/signup/seller", "/brands", "/terms", "/privacy", "/support", "/forgot-password", "/reset-password?token=x", "/login"]],
  ];
  for (const [c, list] of pages) for (const p of list) {
    const res = await c.page(p);
    const bad = res.status >= 400 || // 오류 화면도 200으로 오므로 서버 렌더 오류 흔적까지 확인
       /Application error|Unhandled Runtime Error|PrismaClient|TypeError:|ReferenceError:|is not a function|__next_error__/.test(res.text);
    ok(!bad, `${c.name} ${p} → ${res.status}`, bad ? (res.text.match(/(TypeError|ReferenceError|PrismaClient|is not a function)[^"]{0,160}/)?.[0] ?? res.text.slice(0, 200)) : undefined);
  }

  console.log(`\n결과: 통과 ${pass} · 실패 ${failN}`);
  if (fails.length) console.log("실패 항목:", fails);
  await restoreSettleDays();
  await db.$disconnect();
}
main().catch(async (e) => { console.error("SIM CRASH", e); await restoreSettleDays(); await db.$disconnect(); process.exit(1); });
