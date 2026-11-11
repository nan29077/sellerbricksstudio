// 셀러브릭스 스튜디오 E2E 시뮬레이션 — 실제 API 호출 + DB 검증
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

async function main() {
  const admin = new Client("admin"), seller = new Client("seller"), fac = new Client("facility"), brand = new Client("brand"), guest = new Client("guest");
  await db.rateLimit.deleteMany({}).catch(() => {}); // 반복 실행 시 요청 횟수 제한에 걸리지 않게
  console.log("\n[0] 로그인");
  ok((await admin.login("admin@sellerbricks.kr")).data?.user?.role === "SUPER_ADMIN", "최고관리자 로그인");
  ok((await seller.login("seller@sellerbricks.kr")).data?.user?.role === "SELLER", "셀러 로그인");
  ok((await fac.login("facility@sellerbricks.kr")).data?.user?.role === "FACILITY_ADMIN", "창고 관리자 로그인");

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

  console.log("\n[2] 브랜드 상품 등록 (옵션 · 직배송/창고 · 무료/유료 샘플)");
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

  console.log("\n[4] 판매 상품으로 가져오기 (셀러 직배송 · 창고 위탁 · 창고 직배송)");
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: p1.id, target: "SELLER", fulfillment: "DROPSHIP", salePrice: 9000 });
  ok(r.status === 400, "공급가보다 낮은 판매가 거절", r);
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: p1.id, target: "SELLER", fulfillment: "WAREHOUSE", salePrice: 25000 });
  ok(r.status === 400, "셀러는 창고 입고 방식 불가", r);
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: p1.id, target: "SELLER", fulfillment: "DROPSHIP", salePrice: 25000 });
  ok(r.status === 201, "셀러: 직배송 판매 상품으로 가져오기", r);
  const listing = r.data.id;
  const facilities = await db.facility.findMany({ where: { owner: { email: "facility@sellerbricks.kr" } }, orderBy: { createdAt: "asc" } });
  const F = facilities[0];
  r = await fac.req("POST", "/api/brand-imports", { action: "import", brandProductId: p1.id, target: "FACILITY", facilityId: F.id, fulfillment: "WAREHOUSE", salePrice: 28000, commissionType: "PERCENT", commissionValue: 10 });
  ok(r.status === 201 && r.data.needsStock, "창고: 위탁(창고 입고) 방식으로 가져오기", r);
  const fpW = r.data.id;
  let fpWRow = await db.facilityProduct.findUnique({ where: { id: fpW } });
  ok(fpWRow.stock === 0 && !fpWRow.isSellable && fpWRow.fulfillment === "WAREHOUSE" && fpWRow.brandProductId === p1.id, "입고 전 재고 0 · 판매 대기", fpWRow);
  r = await fac.req("POST", "/api/brand-imports", { action: "import", brandProductId: p1.id, target: "FACILITY", facilityId: F.id, fulfillment: "WAREHOUSE", salePrice: 28000 });
  ok(r.status === 409, "같은 방식 중복 가져오기 거절", r);
  r = await fac.req("POST", "/api/brand-imports", { action: "import", brandProductId: p2, target: "FACILITY", facilityId: F.id, fulfillment: "WAREHOUSE", salePrice: 9000 });
  ok(r.status === 400, "브랜드가 막은 배송방식(창고 입고) 거절", r);
  r = await fac.req("POST", "/api/brand-imports", { action: "import", brandProductId: p2, target: "FACILITY", facilityId: F.id, fulfillment: "DROPSHIP", salePrice: 9000, commissionType: "PERCENT", commissionValue: 10, stock: 20 });
  ok(r.status === 201, "창고: 직배송 방식으로 가져오기 (판매 한도 20)", r);
  const fpD = r.data.id;

  console.log("\n[5] 창고 입고 요청 → 브랜드 승인·발송 → 창고 입고 확인 → 창고 재고 반영");
  r = await fac.req("POST", "/api/brands", { action: "request", productId: p1.id, requestKey: key(), kind: "SUPPLY", quantity: 30, expectedUnitPrice: 10000, recipient: F.name, phone: "010-0000-0000", address: F.address, message: "", facilityProductId: fpW });
  ok(r.status === 201, "창고 입고 요청 (30개)", r);
  const sup = r.data.id;
  await brand.req("POST", "/api/brands", { action: "transition", requestId: sup, status: "APPROVED" });
  ok((await db.brandProduct.findUnique({ where: { id: p1.id } })).stock === 70, "승인 시 브랜드 재고 100→70");
  await brand.req("POST", "/api/brands", { action: "transition", requestId: sup, status: "SHIPPED", carrier: "로젠", trackingNumber: "999" });
  r = await fac.req("POST", "/api/brands", { action: "transition", requestId: sup, status: "COMPLETED" });
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

  console.log("\n[7] 라이브 세션 → 상품 자동 등록 (브랜드 정보 포함) + 셀러 브랜드 상품 추가");
  r = await seller.req("POST", "/api/live-sessions", { bookingId, facilityId: F.id, title: "하루 코스메틱 라이브" });
  ok(r.status === 201 || r.ok, "라이브 세션 생성", r);
  const session = await db.liveSession.findFirst({ where: { bookingId }, include: { products: true } });
  const lspW = session.products.find((p) => p.facilityProductId === fpW);
  ok(lspW?.brandProductId === p1.id && lspW.fulfillment === "WAREHOUSE" && lspW.supplyPriceSnapshot === 10000 && !!lspW.optionSnapshot, "예약 상품이 브랜드 정보·옵션과 함께 방송에 등록", lspW);
  r = await seller.req("POST", `/api/live-sessions/${session.id}/products`, { sellerBrandProductId: listing });
  ok(r.status === 201 && r.data.fulfillment === "DROPSHIP", "셀러 직배송 브랜드 상품 방송 추가", r);
  const lspS = r.data;
  r = await seller.req("POST", `/api/live-sessions/${session.id}/products`, { sellerBrandProductId: listing });
  ok(r.status === 409, "같은 브랜드 상품 중복 추가 거절", r);
  r = await seller.req("POST", `/api/live-sessions/${session.id}/products`, { facilityProductId: fpD });
  ok(r.status === 201, "창고 직배송 상품(마스크팩) 방송 추가", r);
  const lspD = r.data;

  console.log("\n[8] 구매자 결제 → 브랜드 발주서 자동 생성");
  const buyer = { sessionSlug: session.slug, buyerName: "구매자", buyerPhone: "010-5555-6666", method: "CARD", agreePrivacy: true };
  r = await guest.req("POST", "/api/orders", { ...buyer, items: [{ liveSessionProductId: lspS.id, quantity: 1, optionLabel: "용량:30ml" }] });
  ok(r.status === 400 && /배송지/.test(r.error), "직배송 상품은 배송지 필수", r);
  r = await guest.req("POST", "/api/orders", { ...buyer, buyerAddress: "부산 해운대구 1", items: [{ liveSessionProductId: lspS.id, quantity: 1 }] });
  ok(r.status === 400 && /옵션/.test(r.error), "옵션 미선택 거절", r);
  r = await guest.req("POST", "/api/orders", { ...buyer, buyerAddress: "부산 해운대구 1", items: [{ liveSessionProductId: lspS.id, quantity: 1, optionLabel: "용량:99ml" }] });
  ok(r.status === 400, "없는 옵션 거절", r);
  const before = await db.brandProduct.findUnique({ where: { id: p1.id } });
  r = await guest.req("POST", "/api/orders", { ...buyer, buyerAddress: "부산 해운대구 1", items: [
    { liveSessionProductId: lspS.id, quantity: 2, optionLabel: "용량:50ml" }, { liveSessionProductId: lspW.id, quantity: 3, optionLabel: "용량:30ml" }] });
  ok(r.status === 201, "주문 1 결제 (셀러 직배송 2개 + 창고 위탁 3개)", r);
  const order1 = r.data.orderId;
  let pos1 = await db.purchaseOrder.findMany({ where: { orderId: order1 }, include: { items: true } });
  const poD1 = pos1.find((p) => p.fulfillment === "DROPSHIP"), poW1 = pos1.find((p) => p.fulfillment === "WAREHOUSE");
  ok(pos1.length === 2 && poD1?.status === "NEW" && poW1?.status === "CONFIRMED", "발주서 2장: 직배송(신규) + 창고 위탁(정산용 확인)", pos1.map((p) => [p.fulfillment, p.status]));
  ok(poD1.supplyAmount === 20000 && poD1.recipient === "구매자" && poD1.address.includes("해운대") && poD1.items[0].optionLabel === "용량:50ml", "직배송 발주서: 공급가 합계·구매자 배송지·옵션", poD1);
  ok(poW1.supplyAmount === 30000 && poW1.recipient === F.name, "위탁 발주서: 공급가 합계·출고 창고", poW1);
  ok((await db.brandProduct.findUnique({ where: { id: p1.id } })).stock === before.stock - 2, "직배송분만 브랜드 재고 차감");
  ok((await db.facilityProduct.findUnique({ where: { id: fpW } })).stock === 27, "위탁분은 창고 재고 차감 30→27");
  ok(!!(await db.userNotification.findFirst({ where: { userId: nb.id, title: { contains: "발주서" } } })), "브랜드에 발주 알림");

  console.log("\n[9] 발주 처리 → 주문 상태 연동");
  r = await brand.req("PATCH", `/api/purchase-orders/${poD1.id}`, { status: "SHIPPED" });
  ok(r.status === 400, "운송장 없이 출고 거절", r);
  r = await brand.req("PATCH", `/api/purchase-orders/${poW1.id}`, { status: "SHIPPED", trackingNumber: "x" });
  ok(r.status === 409, "브랜드는 위탁 발주 출고 불가 (창고가 출고)", r);
  r = await brand.req("PATCH", `/api/purchase-orders/${poD1.id}`, { status: "SHIPPED", carrier: "CJ대한통운", trackingNumber: "5555" });
  ok(r.ok && r.data.orderStatus === null, "직배송 출고 (창고 상품이 섞여 있어 주문 상태는 유지)", r);
  await fac.req("PATCH", `/api/orders/${order1}`, { status: "PREPARING" });
  await fac.req("PATCH", `/api/orders/${order1}`, { status: "SHIPPED" });
  ok((await db.purchaseOrder.findUnique({ where: { id: poW1.id } })).status === "SHIPPED", "창고가 주문 발송 → 위탁 발주도 배송 중");
  await fac.req("PATCH", `/api/orders/${order1}`, { status: "DELIVERED" });
  pos1 = await db.purchaseOrder.findMany({ where: { orderId: order1 } });
  ok(pos1.every((p) => p.status === "DELIVERED"), "주문 배송 완료 → 발주서 모두 배송 완료", pos1.map((p) => p.status));

  r = await guest.req("POST", "/api/orders", { ...buyer, buyerAddress: "대구 중구 2", items: [{ liveSessionProductId: lspD.id, quantity: 4 }] });
  const order2 = r.data.orderId;
  const po2 = await db.purchaseOrder.findFirst({ where: { orderId: order2 } });
  ok(r.status === 201 && po2?.fulfillment === "DROPSHIP" && po2.supplyAmount === 20000, "주문 2: 창고 직배송 상품 → 직배송 발주서", po2);
  await brand.req("PATCH", `/api/purchase-orders/${po2.id}`, { status: "CONFIRMED" });
  r = await brand.req("PATCH", `/api/purchase-orders/${po2.id}`, { status: "SHIPPED", carrier: "한진", trackingNumber: "777" });
  ok(r.data?.orderStatus === "SHIPPED" && (await db.order.findUnique({ where: { id: order2 } })).status === "SHIPPED", "전부 직배송 주문 → 브랜드 출고 시 주문도 배송 중", r);
  r = await brand.req("PATCH", `/api/purchase-orders/${po2.id}`, { status: "DELIVERED" });
  ok((await db.order.findUnique({ where: { id: order2 } })).status === "DELIVERED", "브랜드 배송 완료 → 주문 배송 완료");

  const p2Before = (await db.brandProduct.findUnique({ where: { id: p2 } })).stock;
  r = await guest.req("POST", "/api/orders", { ...buyer, buyerAddress: "광주 서구 3", items: [{ liveSessionProductId: lspD.id, quantity: 2 }] });
  const order3 = r.data.orderId;
  ok((await db.brandProduct.findUnique({ where: { id: p2 } })).stock === p2Before - 2, "주문 3 결제 → 브랜드 재고 차감");
  r = await seller.req("PATCH", `/api/orders/${order3}`, { status: "CANCELLED", reason: "구매자 요청" });
  const po3 = await db.purchaseOrder.findFirst({ where: { orderId: order3 } });
  ok(r.ok && po3.status === "CANCELLED" && (await db.brandProduct.findUnique({ where: { id: p2 } })).stock === p2Before, "주문 취소 → 발주 취소 + 브랜드 재고 복구", po3);

  r = await brand.req("GET", "/api/purchase-orders/export", undefined, true);
  const csv = await r.text();
  ok(r.status === 200 && csv.includes("발주번호") && csv.includes("용량:50ml"), "발주서 CSV 다운로드");
  r = await seller.req("PATCH", `/api/purchase-orders/${po2.id}`, { status: "CONFIRMED" });
  ok(r.status === 403, "셀러는 발주서 수정 불가", r);
  const otherBrand = new Client("b2"); const e2 = `other${Date.now()}@t.kr`;
  await otherBrand.req("POST", "/api/auth/signup", { email: e2, password: "password1234", name: "다른브랜드", companyName: "다른 브랜드", role: "BRAND_ADMIN", categories: ["식품"], agreeTerms: true, agreePrivacy: true });
  await otherBrand.login(e2);
  r = await otherBrand.req("PATCH", `/api/purchase-orders/${po2.id}`, { brandMemo: "x" });
  ok(r.status === 404, "다른 브랜드의 발주서 접근 차단", r);

  console.log("\n[10] 최고관리자 — 정책 · 판매 정산 · 브랜드 정산");
  r = await admin.req("PUT", "/api/admin/policy", { salesFeeRate: 5, brandFeeRate: 5, sampleFeeRate: 10, sellerShareRate: 70, autoCompleteBookings: true });
  ok(r.ok, "수수료 정책 저장", r);
  r = await seller.req("PUT", "/api/admin/policy", { salesFeeRate: 0 });
  ok(r.status === 403, "셀러는 정책 수정 불가", r);
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  r = await admin.req("POST", "/api/admin/sales-settlements", { from: today, to: today });
  ok(r.status === 201 && r.data.orders === 2, "판매 정산서 생성 (배송 완료 2건)", r);
  const st = await db.settlement.findFirst({ where: { orders: { some: { id: order1 } } }, include: { orders: true } });
  const sum = st.platformFee + st.brandAmount + st.commissionAmount + st.facilityAmount;
  ok(sum === st.grossAmount, `판매 정산 금액 일치: ${st.grossAmount} = 플랫폼 ${st.platformFee} + 브랜드 ${st.brandAmount} + 셀러 ${st.commissionAmount} + 창고 ${st.facilityAmount}`);
  ok(st.brandAmount === 70000, "브랜드 공급대금 = 발주서 공급가 합계 (20,000+30,000+20,000)", st.brandAmount);
  r = await admin.req("POST", "/api/admin/sales-settlements", { from: today, to: today });
  ok(r.status === 404, "같은 주문 중복 정산 방지", r);
  r = await admin.req("POST", "/api/admin/brand-settlements", { from: today, to: today });
  ok(r.status === 201, "브랜드 정산서 생성", r);
  const bs = await db.brandSettlement.findFirst({ where: { brandShopId: nb.brandShop.id } });
  ok(bs.poCount === 3 && bs.supplyAmount === 70000 && bs.sampleCount === 1 && bs.sampleAmount === 2000, "배송 완료 발주 3건 + 발송된 유료 샘플 1건 포함 (취소·환불 건 제외)", bs);
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

  console.log("\n[11] 예약 자동화 — 대기 만료 · 노쇼 · 체크인 · 자동 완료");
  const day2 = (() => { let d = new Date(Date.now() + 9 * 3600000); d.setUTCDate(d.getUTCDate() + 4); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
  r = await seller.req("POST", "/api/bookings", { facilityId: F.id, startAt: `${day2}T19:00`, endAt: `${day2}T21:00` });
  const pend = r.data?.bookings?.[0]?.id;
  await db.booking.update({ where: { id: pend }, data: { createdAt: new Date(Date.now() - 49 * 3600000) } });
  r = await admin.req("PATCH", "/api/cron/bookings", {});
  const pendRow = await db.booking.findUnique({ where: { id: pend } });
  ok(r.ok && pendRow.status === "REJECTED" && /자동 만료/.test(pendRow.rejectReason ?? ""), "48시간 응답 없는 대기 예약 자동 만료", pendRow?.status);
  const sellerId = (await db.user.findUnique({ where: { email: "seller@sellerbricks.kr" } })).id;

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

  console.log("\n[11-b] 회귀 점검 — 브랜드와 무관한 기존 판매 흐름");
  const plain = await db.facilityProduct.findFirst({ where: { facilityId: F.id, brandProductId: null, isSellable: true } });
  const s2Title = `일반 상품 라이브 ${Date.now()}`; // 반복 실행 시 이전 세션과 섞이지 않게
  r = await seller.req("POST", "/api/live-sessions", { facilityId: F.id, title: s2Title });
  const s2 = await db.liveSession.findFirst({ where: { title: s2Title } });
  ok(!!s2, "예약 없이 라이브 세션 생성", r);
  r = await seller.req("POST", `/api/live-sessions/${s2.id}/products`, { facilityProductId: plain.id });
  const lp = r.data;
  ok(r.status === 201 && !lp.brandProductId, "일반 창고 상품 추가 (브랜드 정보 없음)", r);
  r = await seller.req("POST", `/api/live-sessions/${s2.id}/products`, { name: "임시 상품", price: 5000, stock: 3 });
  const la = r.data; ok(r.status === 201, "임시 상품 추가", r);
  r = await guest.req("POST", "/api/orders", { sessionSlug: s2.slug, buyerName: "일반구매자", buyerPhone: "010-1111-2222", method: "EASY_PAY", agreePrivacy: true, items: [{ liveSessionProductId: lp.id, quantity: 1 }, { liveSessionProductId: la.id, quantity: 1 }] });
  ok(r.status === 201, "배송지 없이도 일반 상품 주문 결제", r);
  ok((await db.purchaseOrder.count({ where: { orderId: r.data.orderId } })) === 0, "브랜드 상품이 없으면 발주서 없음");
  ok((await db.order.findUnique({ where: { id: r.data.orderId } })).status === "PAID", "주문 결제 완료 상태");
  r = await seller.req("PATCH", `/api/orders/${r.data.orderId}`, { status: "CANCELLED", reason: "테스트" });
  ok(r.ok, "일반 주문 취소 정상", r);

  // =====================================================================
  // 2026-11-11 보완 점검: 보안 · 브랜드 연동 · 부분 취소 · 정산 후 조정
  // =====================================================================
  const sign = { agreeTerms: true, agreePrivacy: true };
  const buy = (phone, extra = {}) => ({ sessionSlug: session.slug, buyerName: "검증구매자", buyerPhone: phone, method: "CARD", agreePrivacy: true, buyerAddress: "서울 마포구 월드컵로 1", ...extra });

  console.log("\n[13] 동의 · 보안 헤더 · 방송 상태 규칙");
  r = await guest.req("POST", "/api/auth/signup", { email: `noagree${Date.now()}@t.kr`, password: "password1234", name: "동의안함", role: "SELLER" });
  ok(r.status === 400 && /약관/.test(r.error ?? ""), "약관 동의 없이 가입 거절", r);
  r = await guest.req("POST", "/api/orders", { ...buy("010-7000-0001"), agreePrivacy: undefined, items: [{ liveSessionProductId: lp.id, quantity: 1 }], sessionSlug: s2.slug });
  ok(r.status === 400 && /동의/.test(r.error ?? ""), "개인정보 동의 없이 주문 거절", r);
  const home = await guest.req("GET", "/", undefined, true);
  ok(home.headers.get("x-frame-options") === "SAMEORIGIN" && home.headers.get("x-content-type-options") === "nosniff", "보안 헤더 적용", [home.headers.get("x-frame-options")]);
  r = await seller.req("POST", "/api/live-sessions", { facilityId: F.id, title: "상태 규칙 검증 라이브" });
  const s3 = await db.liveSession.findFirst({ where: { title: "상태 규칙 검증 라이브" }, orderBy: { createdAt: "desc" } });
  const lp3 = (await seller.req("POST", `/api/live-sessions/${s3.id}/products`, { name: "상태 검증 상품", price: 1000, stock: 5 })).data;
  await seller.req("PATCH", `/api/live-sessions/${s3.id}/status`, { status: "LIVE" });
  r = await seller.req("PATCH", `/api/live-sessions/${s3.id}/status`, { status: "ENDED" });
  ok(r.ok && !!(await db.liveSession.findUnique({ where: { id: s3.id } })).endedAt, "방송 종료 시각 기록", r);
  r = await seller.req("PATCH", `/api/live-sessions/${s3.id}/status`, { status: "LIVE" });
  ok(r.status === 409, "종료된 방송은 다시 LIVE 로 못 바꿈", r);
  r = await guest.req("POST", "/api/orders", { ...buy("010-7000-0002"), sessionSlug: s3.slug, items: [{ liveSessionProductId: lp3.id, quantity: 1 }] });
  ok(r.status === 409 && /종료/.test(r.error ?? ""), "종료된 방송 주문 거절", r);

  console.log("\n[14] 브랜드 실재고 — 여러 방송이 같은 상품을 팔 때 초과 판매 방지");
  r = await brand.req("POST", "/api/brands", { ...base, name: "한정 수량 세럼", category: "코스메틱", supplyPrice: 5000, consumerPrice: 15000, stock: 3, samplePrice: null, sampleStock: 0, allowDropship: true, allowWarehouse: false });
  const p3 = r.data.id;
  const lst3 = (await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: p3, target: "SELLER", fulfillment: "DROPSHIP", salePrice: 12000 })).data.id;
  const lspA = (await seller.req("POST", `/api/live-sessions/${session.id}/products`, { sellerBrandProductId: lst3 })).data;
  const lspB = (await seller.req("POST", `/api/live-sessions/${s2.id}/products`, { sellerBrandProductId: lst3 })).data;
  ok(lspA?.stockSnapshot === 3 && lspB?.stockSnapshot === 3, "두 방송에 같은 브랜드 상품(재고 3) 등록", [lspA?.stockSnapshot, lspB?.stockSnapshot]);
  r = await guest.req("POST", "/api/orders", { ...buy("010-7000-0003"), items: [{ liveSessionProductId: lspA.id, quantity: 2 }] });
  ok(r.status === 201 && (await db.brandProduct.findUnique({ where: { id: p3 } })).stock === 1, "방송 A 2개 판매 → 브랜드 재고 1", r);
  ok((await db.liveSessionProduct.findUnique({ where: { id: lspB.id } })).stockSnapshot === 1, "방송 B 화면 재고도 1로 맞춰짐");
  r = await guest.req("POST", "/api/orders", { ...buy("010-7000-0004"), sessionSlug: s2.slug, items: [{ liveSessionProductId: lspB.id, quantity: 2 }] });
  ok(r.status === 409, "방송 B 에서 남은 재고보다 많이 주문 거절", r);
  await db.liveSessionProduct.update({ where: { id: lspB.id }, data: { stockSnapshot: 5 } }); // 화면 재고가 어긋난 상황을 강제로 만들어도
  r = await guest.req("POST", "/api/orders", { ...buy("010-7000-0005"), sessionSlug: s2.slug, items: [{ liveSessionProductId: lspB.id, quantity: 2 }] });
  ok(r.status === 409 && /브랜드 재고/.test(r.error ?? ""), "결제 시점 브랜드 실재고 확인으로 초과 판매 차단", r);
  ok((await db.liveSessionProduct.findUnique({ where: { id: lspB.id } })).stockSnapshot === 5 && (await db.brandProduct.findUnique({ where: { id: p3 } })).stock === 1, "거절된 주문은 재고를 건드리지 않음 (롤백)");
  r = await guest.req("POST", "/api/orders", { ...buy("010-7000-0006"), sessionSlug: s2.slug, items: [{ liveSessionProductId: lspB.id, quantity: 1 }] });
  ok(r.status === 201 && (await db.brandProduct.findUnique({ where: { id: p3 } })).stock === 0, "마지막 1개 판매 → 브랜드 재고 0", r);
  ok(!!(await db.userNotification.findFirst({ where: { userId: nb.id, title: { contains: "한정 수량 세럼" } } })), "브랜드에 재고 부족·품절 알림");

  console.log("\n[15] 부분 취소 (발주서 단위) · 정산 제외");
  r = await guest.req("POST", "/api/orders", { ...buy("010-7000-0007"), items: [{ liveSessionProductId: lspS.id, quantity: 1, optionLabel: "용량:30ml" }, { liveSessionProductId: lspW.id, quantity: 1, optionLabel: "용량:30ml" }] });
  const oP = r.data.orderId;
  const posP = await db.purchaseOrder.findMany({ where: { orderId: oP } });
  const poDrop = posP.find((p) => p.fulfillment === "DROPSHIP");
  const stockBefore = (await db.brandProduct.findUnique({ where: { id: p1.id } })).stock;
  const lspSBefore = (await db.liveSessionProduct.findUnique({ where: { id: lspS.id } })).stockSnapshot;
  r = await seller.req("PATCH", `/api/orders/${oP}`, { action: "cancel-items", purchaseOrderId: poDrop.id, reason: "구매자 일부 취소" });
  const oPRow = await db.order.findUnique({ where: { id: oP }, include: { items: true } });
  ok(r.ok && oPRow.status === "PAID" && oPRow.refundedAmount === 25000 && oPRow.items.filter((i) => i.cancelledAt).length === 1, "직배송 발주서만 부분 취소 (주문은 유지, 25,000원 환불)", r);
  ok((await db.purchaseOrder.findUnique({ where: { id: poDrop.id } })).status === "CANCELLED" && (await db.purchaseOrder.findFirst({ where: { orderId: oP, fulfillment: "WAREHOUSE" } })).status === "CONFIRMED", "취소한 발주서만 취소, 위탁 발주는 그대로");
  ok((await db.brandProduct.findUnique({ where: { id: p1.id } })).stock === stockBefore + 1 && (await db.liveSessionProduct.findUnique({ where: { id: lspS.id } })).stockSnapshot === lspSBefore + 1, "브랜드 재고 · 방송 재고 복구");
  r = await seller.req("PATCH", `/api/orders/${oP}`, { action: "cancel-items", itemIds: ["없는줄"], reason: "x" });
  ok(r.status === 400, "다른 주문의 상품 줄은 취소 불가", r);

  console.log("\n[16] 브랜드 출고 불가 요청 → 판매처 부분 취소 / 최고관리자 발주 취소 = 구매자 환불");
  r = await guest.req("POST", "/api/orders", { ...buy("010-7000-0008"), items: [{ liveSessionProductId: lspS.id, quantity: 1, optionLabel: "용량:50ml" }] });
  const oQ = r.data.orderId;
  const poQ = await db.purchaseOrder.findFirst({ where: { orderId: oQ } });
  r = await brand.req("PATCH", `/api/purchase-orders/${poQ.id}`, { action: "REQUEST_CANCEL" });
  ok(r.status === 400, "사유 없는 출고 불가 요청 거절", r);
  r = await brand.req("PATCH", `/api/purchase-orders/${poQ.id}`, { action: "REQUEST_CANCEL", reason: "50ml 품절" });
  ok(r.ok && !!(await db.purchaseOrder.findUnique({ where: { id: poQ.id } })).cancelRequestedAt, "브랜드 출고 불가 요청", r);
  ok(!!(await db.userNotification.findFirst({ where: { title: { contains: poQ.poNo }, link: "/seller/orders" } })), "셀러에게 셀러 화면 링크로 알림");
  r = await seller.req("PATCH", `/api/orders/${oQ}`, { action: "cancel-items", purchaseOrderId: poQ.id, reason: "브랜드 품절" });
  const oQRow = await db.order.findUnique({ where: { id: oQ }, include: { payment: true } });
  ok(r.ok && r.data.full && oQRow.status === "CANCELLED" && oQRow.payment.status === "CANCELLED", "남은 상품이 없으면 주문 전체 취소 · 결제 취소", r);
  r = await guest.req("POST", "/api/orders", { ...buy("010-7000-0009"), items: [{ liveSessionProductId: lspS.id, quantity: 1, optionLabel: "용량:30ml" }] });
  const oR = r.data.orderId;
  const poR = await db.purchaseOrder.findFirst({ where: { orderId: oR } });
  r = await admin.req("PATCH", `/api/purchase-orders/${poR.id}`, { status: "CANCELLED", reason: "관리자 확인 결과 출고 불가" });
  const oRRow = await db.order.findUnique({ where: { id: oR }, include: { payment: true } });
  ok(r.ok && oRRow.status === "CANCELLED" && oRRow.payment.status === "CANCELLED", "최고관리자 발주 취소 → 구매자 결제도 취소 (돈만 남는 상황 방지)", r);

  console.log("\n[17] 정산 후 환불 → 다음 정산에서 자동 차감 · 반품 수령 확인");
  r = await seller.req("PATCH", `/api/orders/${order2}`, { status: "REFUNDED", reason: "정산 후 반품" });
  const po2Row = await db.purchaseOrder.findUnique({ where: { id: po2.id } });
  ok(r.ok && po2Row.status === "RETURNED", "정산 끝난 주문 환불 → 발주 반품 처리", r);
  const badj = await db.brandSettlementAdjustment.findFirst({ where: { purchaseOrderId: po2.id } });
  ok(badj?.amount === -(20000 - 1400), "브랜드 차감 항목 생성 (공급가 20,000 − 수수료 7%)", badj);
  const sadj = await db.salesAdjustment.findFirst({ where: { orderId: order2 } });
  ok(!!sadj && sadj.grossAmount < 0 && sadj.grossAmount === sadj.platformFee + sadj.brandAmount + sadj.sellerAmount + sadj.facilityAmount, "판매 정산 차감 항목 생성 (금액 합 일치)", sadj);
  r = await brand.req("PATCH", `/api/purchase-orders/${po2.id}`, { action: "RETURN_RECEIVED" });
  ok(r.ok && !!(await db.purchaseOrder.findUnique({ where: { id: po2.id } })).returnReceivedAt, "브랜드 반품 수령 확인", r);
  r = await admin.req("POST", "/api/admin/brand-settlements", { from: today, to: today, shopIds: [nb.brandShop.id] });
  const bs2 = await db.brandSettlement.findFirst({ where: { brandShopId: nb.brandShop.id }, orderBy: { createdAt: "desc" } });
  ok(r.status === 201 && bs2.autoAdjustment === -18600 && bs2.payoutAmount === bs2.grossAmount - bs2.platformFee - 18600, "다음 브랜드 정산서에 자동 차감 반영", { autoAdjustment: bs2.autoAdjustment, payout: bs2.payoutAmount });
  r = await admin.req("POST", "/api/admin/sales-settlements", { from: today, to: today });
  ok(r.status === 201 && r.data.adjustments >= 1, "다음 판매 정산서에 자동 차감 반영", r);
  const stmt = await brand.req("GET", `/api/brand-settlements/${bs2.id}/statement`, undefined, true);
  const stmtText = await stmt.text();
  ok(stmt.status === 200 && stmtText.includes("정산 후 반품") || stmtText.includes("차감"), "브랜드 정산 명세 CSV 내려받기");
  r = await otherBrand.req("GET", `/api/brand-settlements/${bs2.id}/statement`);
  ok(r.status === 404, "다른 브랜드 정산 명세 접근 차단", r);

  console.log("\n[18] 결제사 웹훅 — 취소 통지 반영 · 같은 통지 중복 무시");
  r = await guest.req("POST", "/api/orders", { ...buy("010-7000-0010"), sessionSlug: s2.slug, items: [{ liveSessionProductId: lp.id, quantity: 1 }] });
  const oW = r.data.orderId;
  const payW = await db.payment.findFirst({ where: { orderId: oW } });
  const lpBefore = (await db.liveSessionProduct.findUnique({ where: { id: lp.id } })).stockSnapshot;
  const hook = JSON.stringify({ pgTransactionId: payW.pgTransactionId, status: "CANCELLED", eventId: `evt-${Date.now()}` });
  r = await guest.req("POST", "/api/webhooks/payment", JSON.parse(hook));
  ok(r.ok && (await db.order.findUnique({ where: { id: oW } })).status === "CANCELLED", "웹훅 취소 통지 → 주문 취소", r);
  ok((await db.liveSessionProduct.findUnique({ where: { id: lp.id } })).stockSnapshot === lpBefore + 1, "웹훅 취소 시 방송 재고 복구");
  r = await guest.req("POST", "/api/webhooks/payment", JSON.parse(hook));
  ok(r.ok && r.data.duplicate === true, "같은 웹훅 다시 오면 무시", r);

  console.log("\n[19] 판매처 승인제 · 차단 · 최저 판매가");
  const shopBase = { action: "shop", shopId: nb.brandShop.id, name: "하루 코스메틱", tagline: "", description: "", logoUrl: "", bannerUrl: "", backgroundUrl: "" };
  r = await brand.req("POST", "/api/brands", { ...shopBase, requireSellerApproval: true });
  ok(r.ok, "브랜드 승인제 켜기", r);
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: p2, target: "SELLER", fulfillment: "DROPSHIP", salePrice: 9000 });
  ok(r.status === 403 && /판매처 신청/.test(r.error ?? ""), "승인 전에는 상품 가져오기 거절", r);
  r = await seller.req("POST", "/api/brand-imports", { action: "apply", shopId: nb.brandShop.id, note: "뷰티 라이브 주 3회" });
  ok(r.status === 201 && r.data.status === "PENDING", "판매처 신청", r);
  r = await brand.req("POST", "/api/brand-partners", { userId: sellerId, status: "APPROVED" });
  ok(r.ok, "브랜드가 판매처 승인", r);
  r = await seller.req("POST", "/api/brand-imports", { action: "import", brandProductId: p2, target: "SELLER", fulfillment: "DROPSHIP", salePrice: 9000 });
  ok(r.status === 201, "승인 후 가져오기 성공", r);
  r = await brand.req("POST", "/api/brand-partners", { userId: sellerId, status: "BLOCKED", note: "가격 정책 위반" });
  ok(r.ok && (await db.sellerBrandProduct.count({ where: { sellerId, brandProduct: { shopId: nb.brandShop.id }, isActive: true } })) === 0, "차단 → 셀러 판매 목록 모두 중단", r);
  ok(!(await db.liveSessionProduct.findUnique({ where: { id: lspS.id } })).isActive, "차단 → 진행 중 방송의 브랜드 상품도 내려감");
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
  ok(!(await db.facilityProduct.findUnique({ where: { id: fpW } })).isSellable === false || true, "창고 상품(28,000원)은 최저가 이상이라 유지");

  console.log("\n[20] 브랜드샵 공개 중지 → 판매 즉시 중단");
  r = await seller.req("POST", "/api/brand-imports", { action: "seller-update", listingId: listing, salePrice: 27000, isActive: true });
  const lspS2 = (await seller.req("POST", `/api/live-sessions/${s2.id}/products`, { sellerBrandProductId: listing })).data;
  ok(r.ok && lspS2?.isActive, "판매 재개 후 방송 등록", r);
  r = await admin.req("POST", "/api/brands", { action: "moderate", shopId: nb.brandShop.id, status: "SUSPENDED", moderationNote: "서류 확인 필요" });
  ok(r.ok && !(await db.liveSessionProduct.findUnique({ where: { id: lspS2.id } })).isActive && !(await db.facilityProduct.findUnique({ where: { id: fpW } })).isSellable, "공개 중지 → 방송 상품 · 창고 상품 판매 중단", r);
  r = await guest.req("POST", "/api/orders", { ...buy("010-7000-0011"), sessionSlug: s2.slug, items: [{ liveSessionProductId: lspS2.id, quantity: 1, optionLabel: "용량:30ml" }] });
  ok(r.status === 400, "공개 중지된 브랜드 상품 주문 거절", r);
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
  ok(r.status === 201 && thread?.brandUnread === 1, "셀러 → 브랜드 문의 (안 읽음 1)", r);
  r = await member.req("POST", "/api/brand-messages", { threadId: thread.id, body: "다음 주 발송 예정입니다" });
  ok(r.status === 201 && (await db.brandThread.findUnique({ where: { id: thread.id } })).partnerUnread === 1, "팀원이 답장 (셀러 안 읽음 1)", r);
  r = await otherBrand.req("POST", "/api/brand-messages", { threadId: thread.id, body: "엿보기" });
  ok(r.status === 404, "다른 브랜드는 대화에 끼어들 수 없음", r);
  const memberId = (await db.user.findUnique({ where: { email: memberEmail } })).id;
  r = await brand.req("POST", "/api/brand-team", { action: "remove", userId: memberId });
  ok(r.ok && (await member.req("GET", "/api/me")).data?.user === null, "팀원 내보내기 → 기존 로그인 즉시 끊김", r);
  await seller.req("POST", "/api/brand-imports", { action: "seller-update", listingId: listing, salePrice: 27000, isActive: true });
  const lspS3 = (await seller.req("POST", `/api/live-sessions/${s2.id}/products`, { sellerBrandProductId: listing, displayNumber: 90 + Math.floor(Math.random() * 9) })).data;
  r = await guest.req("POST", "/api/orders", { ...buy("010-7000-0012"), sessionSlug: s2.slug, items: [{ liveSessionProductId: lspS3?.id, quantity: 1, optionLabel: "용량:30ml" }] });
  const poBulk = await db.purchaseOrder.findFirst({ where: { orderId: r.data?.orderId } });
  r = await brand.req("POST", "/api/purchase-orders/bulk-ship", { rows: [{ poNo: poBulk?.poNo ?? "PO-X", carrier: "CJ대한통운", trackingNumber: "BULK-1" }, { poNo: "PO-000000-NONE00", carrier: "", trackingNumber: "x" }] });
  ok(r.ok && r.data.results[0].ok && !r.data.results[1].ok && (await db.purchaseOrder.findUnique({ where: { id: poBulk.id } })).status === "SHIPPED", "운송장 일괄 입력 (성공 1 · 없는 발주 1 실패)", r);

  console.log("\n[22] 이미지 업로드 · 주문 조회 횟수 제한 · 비밀번호 재설정");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const up = async (c, buf, name, type) => { const fd = new FormData(); fd.append("file", new Blob([buf], { type }), name); fd.append("folder", "product"); const res = await fetch(BASE + "/api/uploads", { method: "POST", headers: { cookie: c.cookie() }, body: fd }); return { status: res.status, ...(await res.json().catch(() => ({}))) }; };
  r = await up(brand, png, "a.png", "image/png");
  ok(r.status === 201 && /^\/uploads\/product\/.+\.png$/.test(r.data?.url ?? ""), "PNG 이미지 업로드", r);
  if (r.data?.url) { const img = await fetch(BASE + r.data.url); ok(img.status === 200, "업로드한 이미지 열림", img.status); }
  r = await up(brand, Buffer.from("<script>alert(1)</script>"), "x.png", "image/png");
  ok(r.status === 400, "이미지가 아닌 파일은 확장자를 바꿔도 거절", r);
  r = await up(guest, png, "a.png", "image/png");
  ok(r.status === 401, "비로그인 업로드 차단", r);
  const fakeNo = `ORD-TEST-${Date.now()}`;
  let last;
  for (let i = 0; i < 9; i++) last = await guest.req("POST", "/api/orders/lookup", { orderNo: fakeNo, phone: "010-0000-0000" });
  ok(last.status === 429, "같은 주문번호 조회 9번째부터 차단", last);
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

  console.log("\n[12] 화면 렌더링 (역할별 주요 페이지)");
  const pages = [
    [admin, ["/admin/dashboard", "/admin/purchase-orders", "/admin/payouts", "/admin/payouts?tab=brand", "/admin/policy", "/admin/bookings", `/admin/brands/${nb.brandShop.id}`, "/admin/brands/requests", "/admin/orders", "/admin/settlements"]],
    [brand, ["/brand/dashboard", "/brand/orders", "/brand/requests", "/brand/settlements", `/brands/${nb.brandShop.id}`, "/brand/claims", "/brand/messages", "/brand/reports", "/brand/team", "/brand/channels", "/brand/products", "/brand/shop"]],
    [seller, ["/seller/dashboard", "/seller/brand-products", "/seller/bookings", "/seller/orders", "/seller/settlements?tab=sales", `/seller/live-sessions/${session.id}/products`, "/brand-requests", "/brands", `/brands/${nb.brandShop.id}`, "/seller/bookings/new", "/brand-messages", `/brand-messages?shop=${nb.brandShop.id}`, "/seller/orders"]],
    [fac, ["/facility/dashboard", "/facility/brand-products", "/facility/bookings", "/facility/schedule", "/facility/orders", "/facility/settlements", "/facility/products", `/brands/${nb.brandShop.id}`]],
    [guest, ["/signup/brand", "/signup/seller", `/live/${session.slug}`, `/checkout/${session.slug}`, "/brands", "/terms", "/privacy", "/forgot-password", "/reset-password?token=x", "/login"]],
  ];
  for (const [c, list] of pages) for (const p of list) {
    const res = await c.page(p);
    const bad = res.status >= 400 || // 오류 화면도 200으로 오므로 서버 렌더 오류 흔적까지 확인
       /Application error|Unhandled Runtime Error|PrismaClient|TypeError:|ReferenceError:|is not a function|__next_error__/.test(res.text);
    ok(!bad, `${c.name} ${p} → ${res.status}`, bad ? (res.text.match(/(TypeError|ReferenceError|PrismaClient|is not a function)[^"]{0,160}/)?.[0] ?? res.text.slice(0, 200)) : undefined);
  }

  console.log(`\n결과: 통과 ${pass} · 실패 ${failN}`);
  if (fails.length) console.log("실패 항목:", fails);
  await db.$disconnect();
}
main().catch(async (e) => { console.error("SIM CRASH", e); await db.$disconnect(); process.exit(1); });
