// 이즈뷰 벤치마킹 접목 기능 E2E 시뮬레이션 (2026-11-12)
// 공급가 비공개 · MOQ · 상품 정보 고시 · 샘플/입고 응대 기한 자동 처리 · 직거래 경고 · 공지 DB 저장 · 푸터 사업자 정보
// 실행: DB(시드 완료) + 서버 실행 상태에서 `node scripts/simulate-izbeau-features.mjs` (CRON_SECRET 이 있으면 크론도 시험)
// ⚠ 테스트 데이터를 만듭니다. 운영 DB에서는 실행하지 마세요.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
const envValue = (k) => { for (const f of [".env.local", ".env"]) { try { const m = fs.readFileSync(f, "utf8").match(new RegExp(`^\\s*${k}\\s*=\\s*"?([^"\\r\\n]*)"?`, "m")); if (m && m[1]) return m[1]; } catch { /* 파일 없음 */ } } return ""; };
const CRON_SECRET = process.env.CRON_SECRET || envValue("CRON_SECRET");
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
const H = 3600000;

async function runCron(admin) {
  // CRON_SECRET 이 있으면 외부 스케줄러처럼, 없으면 최고관리자 로그인으로 호출
  if (CRON_SECRET) {
    const res = await fetch(BASE + "/api/cron/bookings", { method: "POST", headers: { authorization: `Bearer ${CRON_SECRET}` } });
    return res.json();
  }
  return admin.req("POST", "/api/cron/bookings");
}

async function main() {
  const admin = new Client("admin"), seller = new Client("seller"), fac = new Client("facility"), brand = new Client("brand"), guest = new Client("guest");
  await db.rateLimit.deleteMany({}).catch(() => {});
  const prevPolicy = await db.platformPolicy.findUnique({ where: { id: "default" } });
  try {
  console.log("\n[A0] 준비 — 로그인 · 테스트 브랜드");
  ok((await admin.login("admin@sellerbricks.kr")).data?.user?.role === "SUPER_ADMIN", "최고관리자 로그인");
  ok((await seller.login("seller@sellerbricks.kr")).data?.user?.role === "SELLER", "셀러 로그인");
  // 2026-11-14: 창고(스튜디오) 관리자 계정은 없어졌다 — 창고는 본사가 운영. 창고 운영은 담당 창고 운영 매니저(manager@)로 검증한다
  { const old = new Client("old-facility"); ok(!(await old.login("facility@sellerbricks.kr")).data?.user, "예전 창고 관리자 계정은 로그인 불가"); }
  ok((await fac.login("admin@sellerbricks.kr")).data?.user?.role === "SUPER_ADMIN", "본사(최고관리자) 로그인 — 창고 브랜드 거래 주체");
  const email = `izbrand${Date.now()}@test.kr`;
  let r = await guest.req("POST", "/api/auth/signup", { email, password: "password1234", name: "이즈브랜드", phone: "010-8888-0000", companyName: `이즈 테스트 ${Date.now() % 100000}`, businessNumber: "222-33-44444", role: "BRAND_ADMIN", categories: ["코스메틱"], agreeTerms: true, agreePrivacy: true });
  ok(r.status === 201, "테스트 브랜드 가입", r);
  const nb = await db.user.findUnique({ where: { email }, include: { brandShop: true } });
  ok((await brand.login(email)).data?.user?.role === "BRAND_ADMIN", "테스트 브랜드 로그인");
  r = await admin.req("POST", "/api/brands", { action: "moderate", shopId: nb.brandShop.id, status: "APPROVED", moderationNote: "" });
  ok(r.ok, "브랜드샵 승인", r);
  const shopId = nb.brandShop.id;
  const base = { action: "product", shopId, description: "", imageUrl: "", isActive: true };

  console.log("\n[A1] 상품 등록 — MOQ · 상품 정보 고시");
  const SUPPLY = 13579;
  r = await brand.req("POST", "/api/brands", { ...base, name: "이즈 앰플", category: "코스메틱", supplyPrice: SUPPLY, consumerPrice: 39000, stock: 200, samplePrice: 0, sampleStock: 5, sampleLimitPerBuyer: 3, allowDropship: true, allowWarehouse: true,
    minOrderQty: 10, volume: "50ml", expiryInfo: "제조일로부터 24개월", ingredients: "정제수, 글리세린, 나이아신아마이드", certification: "기능성화장품 심사 완료", minSalePrice: 20000 });
  ok(r.status === 201, "MOQ 10 · 고시 항목 포함 상품 등록", r);
  const pid = r.data.id;
  let p = await db.brandProduct.findUnique({ where: { id: pid } });
  ok(p.minOrderQty === 10 && p.volume === "50ml" && p.expiryInfo.includes("24개월") && p.ingredients.includes("글리세린") && p.certification.includes("기능성"), "MOQ·고시 항목 저장", p);
  r = await brand.req("POST", "/api/brands", { ...base, productId: pid, revision: p.updatedAt.toISOString(), name: p.name, category: p.category, supplyPrice: p.supplyPrice, consumerPrice: p.consumerPrice, stock: p.stock, samplePrice: p.samplePrice, sampleStock: p.sampleStock, sampleLimitPerBuyer: 3, allowDropship: true, allowWarehouse: true, minSalePrice: 20000 });
  p = await db.brandProduct.findUnique({ where: { id: pid } });
  ok(r.ok && p.minOrderQty === 10 && p.volume === "50ml", "MOQ·고시 항목을 보내지 않는 기존 수정 요청은 값 유지 (하위 호환)", { r, p });
  r = await brand.req("POST", "/api/brands", { ...base, name: "잘못된 MOQ", category: "코스메틱", supplyPrice: 1000, stock: 1, samplePrice: null, sampleStock: 0, allowDropship: true, allowWarehouse: true, minOrderQty: 0 });
  ok(r.status === 400, "MOQ 0 거절", r);

  console.log("\n[A2] 공급가 비공개 — 비로그인 · 구매자 화면");
  const priceText = SUPPLY.toLocaleString("ko-KR");
  let pg = await guest.page(`/brands/${shopId}`);
  ok(pg.status === 200 && !pg.text.includes(priceText) && pg.text.includes("로그인하면 볼 수 있습니다"), "비로그인: 브랜드샵에 공급가 숨김 + 안내 문구", { status: pg.status, has: pg.text.includes(priceText) });
  ok(!pg.text.includes("최저 판매가"), "비로그인: 최저 판매가 숨김");
  ok(pg.text.includes("39,000"), "비로그인: 권장 소비자가는 표시");
  ok(pg.text.includes("창고 입고(최소 10개)"), "MOQ 표시");
  pg = await guest.page(`/brands/${shopId}?product=${pid}`);
  ok(pg.text.includes("상품 정보 고시") && pg.text.includes("제조일로부터 24개월") && pg.text.includes("기능성화장품 심사 완료"), "상품 상세에 상품 정보 고시 표시");
  ok(!pg.text.includes(priceText), "비로그인: 상품 상세에도 공급가 없음");
  pg = await seller.page(`/brands/${shopId}`);
  ok(pg.text.includes(priceText) && pg.text.includes("최저 판매가"), "셀러: 공급가·최저 판매가 표시");
  pg = await fac.page(`/brands/${shopId}`);
  ok(pg.text.includes(priceText), "창고: 공급가 표시");
  pg = await admin.page(`/brands/${shopId}`);
  ok(pg.text.includes(priceText), "최고관리자: 공급가 표시");
  pg = await brand.page(`/brands/${shopId}`);
  ok(pg.text.includes(priceText), "자기 브랜드: 공급가 표시");
  pg = await guest.page("/brands");
  ok(pg.status === 200 && !pg.text.includes(priceText) && !/공급가 [0-9,]+원~/.test(pg.text), "비로그인: 브랜드 목록·새 상품에 공급가 없음", pg.status);
  pg = await seller.page("/brands");
  ok(pg.text.includes(priceText), "셀러: 브랜드 목록 새 상품 공급가 표시");
  pg = await guest.page("/");
  ok(pg.status === 200 && !pg.text.includes(priceText) && !pg.text.includes(`"supplyPrice":${SUPPLY}`), "비로그인: 메인 상품 선반 HTML·데이터에 공급가 없음", pg.status);
  pg = await seller.page("/");
  ok(pg.text.includes(priceText), "셀러: 메인 상품 선반 공급가 표시");
  const facRow = await db.facility.findFirst({ where: { status: "APPROVED" }, select: { id: true } });
  if (facRow) {
    pg = await guest.page(`/facilities/${facRow.id}`);
    ok(pg.status === 200 && !/"supplyPrice":\d/.test(pg.text) && !/\\"supplyPrice\\":\d/.test(pg.text), "비로그인: 창고샵 데이터에 셀러 공급가 미포함", pg.status);
  }

  console.log("\n[A3] 창고 입고 MOQ");
  const F = await db.facility.findFirst({ where: { owner: { email: "admin@sellerbricks.kr" } }, orderBy: { createdAt: "asc" } });
  r = await fac.req("POST", "/api/brand-imports", { action: "import", brandProductId: pid, target: "FACILITY", facilityId: F.id, fulfillment: "WAREHOUSE", salePrice: 39000, commissionType: "PERCENT", commissionValue: 10 });
  ok(r.status === 201, "창고: 위탁 방식으로 가져오기", r);
  const fpW = r.data?.id;
  const sup = { recipient: F.name, phone: "010-0000-0000", address: F.address, message: "", facilityProductId: fpW };
  r = await fac.req("POST", "/api/brands", { action: "request", productId: pid, requestKey: key(), kind: "SUPPLY", quantity: 5, expectedUnitPrice: SUPPLY, ...sup });
  ok(r.status === 409 && /최소 10개/.test(r.error ?? ""), "MOQ 미만(5개) 입고 요청 거절", r);
  r = await fac.req("POST", "/api/brands", { action: "request", productId: pid, requestKey: key(), kind: "SUPPLY", quantity: 10, expectedUnitPrice: SUPPLY, ...sup });
  ok(r.status === 201, "MOQ(10개) 입고 요청 접수", r);
  const supplyReq = r.data?.id;
  r = await seller.req("POST", "/api/brands", { action: "request", productId: pid, requestKey: key(), kind: "SAMPLE", quantity: 1, expectedUnitPrice: 0, recipient: "셀러", phone: "010-1234-5678", address: "서울 강남구 테헤란로 1", message: "" });
  ok(r.status === 201, "샘플은 MOQ와 무관하게 1개 신청 가능", r);
  const sampleReq = r.data?.id;
  pg = await fac.page("/facility/brand-products");
  ok(pg.status === 200 && pg.text.includes("이즈 앰플"), "창고 판매 상품 화면 열림", pg.status);

  console.log("\n[A4] 샘플·입고 요청 응대 기한 — 재알림 → 자동 반려 · 재고 복구 · 유료 환불");
  await db.platformPolicy.upsert({ where: { id: "default" }, update: { requestReplyHours: 72, requestAutoRejectHours: 72 }, create: { id: "default", requestReplyHours: 72, requestAutoRejectHours: 72 } });
  // 유료 샘플 상품
  r = await brand.req("POST", "/api/brands", { ...base, name: "이즈 유료샘플", category: "코스메틱", supplyPrice: 5000, consumerPrice: 15000, stock: 10, samplePrice: 3000, sampleStock: 4, sampleLimitPerBuyer: 2, allowDropship: true, allowWarehouse: false });
  const paidPid = r.data?.id;
  r = await seller.req("POST", "/api/brands", { action: "request", productId: paidPid, requestKey: key(), kind: "SAMPLE", quantity: 2, expectedUnitPrice: 3000, method: "CARD", recipient: "셀러", phone: "010-1234-5678", address: "서울 강남구 테헤란로 1", message: "" });
  ok(r.status === 201, "유료 샘플 신청 (2개 6,000원)", r);
  const paidReq = r.data?.id;
  ok((await db.brandProduct.findUnique({ where: { id: paidPid } })).sampleStock === 2, "유료 샘플 재고 4→2");
  const ids = [supplyReq, sampleReq, paidReq].filter(Boolean);
  // 아직 기한 전 → 아무 일 없음
  let c = await runCron(admin);
  let rows = await db.brandRequest.findMany({ where: { id: { in: ids } } });
  ok(c.ok && rows.every((x) => x.status === "PENDING" && !x.remindedAt), "기한 전에는 처리 안 함", c);
  // 73시간 경과
  await db.brandRequest.updateMany({ where: { id: { in: ids } }, data: { createdAt: new Date(Date.now() - 73 * H) } });
  c = await runCron(admin);
  rows = await db.brandRequest.findMany({ where: { id: { in: ids } } });
  ok(c.ok && rows.every((x) => x.status === "PENDING" && x.remindedAt) && c.data?.brandRequests?.reminded >= 3, "응대 기한(72시간) 지남 → 재알림 표시", c.data?.brandRequests);
  const brandNoti = await db.userNotification.count({ where: { userId: nb.id, title: { startsWith: "응대 기한 지남" } } });
  ok(brandNoti >= 3, "브랜드에 재알림 전송", brandNoti);
  c = await runCron(admin);
  ok((await db.userNotification.count({ where: { userId: nb.id, title: { startsWith: "응대 기한 지남" } } })) === brandNoti, "재알림은 한 번만");
  pg = await brand.page("/brand/requests");
  ok(pg.status === 200 && pg.text.includes("응대 기한 지남"), "브랜드 신청 관리 화면에 기한 지남 표시", pg.status);
  // 재알림 후 73시간 경과 → 자동 반려
  await db.brandRequest.updateMany({ where: { id: { in: ids } }, data: { remindedAt: new Date(Date.now() - 73 * H) } });
  c = await runCron(admin);
  rows = await db.brandRequest.findMany({ where: { id: { in: ids } } });
  ok(rows.every((x) => x.status === "REJECTED" && x.rejectReason.includes("자동 반려")), "재알림 후 72시간 → 자동 반려", rows.map((x) => x.status));
  ok(rows.find((x) => x.id === paidReq)?.paymentStatus === "REFUNDED", "유료 샘플 자동 환불");
  ok((await db.brandProduct.findUnique({ where: { id: paidPid } })).sampleStock === 4, "자동 반려 시 유료 샘플 재고 복구 2→4");
  ok((await db.brandProduct.findUnique({ where: { id: pid } })).sampleStock === 5, "자동 반려 시 무료 샘플 재고 복구");
  ok((await db.brandProduct.findUnique({ where: { id: pid } })).stock === 200, "입고 요청 자동 반려 — 브랜드 재고 변화 없음(승인 전이라 차감 안 됨)");
  ok((await db.userNotification.count({ where: { title: { startsWith: "브랜드 신청 · 자동 반려" } } })) >= 3, "신청자에게 자동 반려 알림");
  ok((await db.auditLog.count({ where: { action: "BRAND_REQUEST_AUTO_REJECT", entityId: { in: ids } } })) === 3, "자동 반려 감사 기록");
  c = await runCron(admin);
  ok(c.data?.brandRequests?.rejected === 0, "이미 반려된 요청은 다시 처리 안 함(중복 환불 없음)", c.data?.brandRequests);
  // 처리된(승인) 요청은 대상 아님 + 정책 끄기
  r = await fac.req("POST", "/api/brands", { action: "request", productId: pid, requestKey: key(), kind: "SUPPLY", quantity: 10, expectedUnitPrice: SUPPLY, ...sup });
  const approvedReq = r.data?.id;
  await brand.req("POST", "/api/brands", { action: "transition", requestId: approvedReq, status: "APPROVED" });
  r = await fac.req("POST", "/api/brands", { action: "request", productId: pid, requestKey: key(), kind: "SUPPLY", quantity: 10, expectedUnitPrice: SUPPLY, ...sup });
  const offReq = r.data?.id;
  await db.brandRequest.updateMany({ where: { id: { in: [approvedReq, offReq] } }, data: { createdAt: new Date(Date.now() - 200 * H) } });
  r = await admin.req("PUT", "/api/admin/policy", { requestReplyHours: 0 });
  ok(r.ok, "관리자: 응대 기한 끄기(0)", r);
  await new Promise((res) => setTimeout(res, 10500)); // 정책 캐시(10초) 만료 대기
  c = await runCron(admin);
  rows = await db.brandRequest.findMany({ where: { id: { in: [approvedReq, offReq] } } });
  ok(rows.find((x) => x.id === approvedReq)?.status === "APPROVED" && rows.find((x) => x.id === offReq)?.status === "PENDING" && !rows.find((x) => x.id === offReq)?.remindedAt, "승인된 요청 제외 · 기한 끄면 처리 안 함", rows.map((x) => [x.status, x.remindedAt]));
  r = await admin.req("PUT", "/api/admin/policy", { requestReplyHours: 72, requestAutoRejectHours: 72 });
  ok(r.ok && (await db.platformPolicy.findUnique({ where: { id: "default" } })).requestAutoRejectHours === 72, "관리자: 응대 기한 72·72 저장", r);
  r = await admin.req("PUT", "/api/admin/policy", { requestReplyHours: -1 });
  ok(r.status === 400, "음수 응대 기한 거절", r);
  pg = await admin.page("/admin/policy");
  ok(pg.status === 200 && pg.text.includes("샘플·입고 요청 응대 기한"), "정책 화면에 응대 기한 표시", pg.status);
  await brand.req("POST", "/api/brands", { action: "transition", requestId: offReq, status: "REJECTED", reason: "테스트 정리" });

  console.log("\n[A5] 직거래 경고 — 연락처·계좌 메시지 표시·기록");
  r = await seller.req("POST", "/api/brand-messages", { shopId, body: "안녕하세요, 샘플 일정 문의드립니다." });
  ok(r.status === 201 && !r.data?.warning, "일반 메시지는 경고 없음", r);
  const threadId = r.data?.threadId;
  const plain = await db.brandMessage.findFirst({ where: { threadId }, orderBy: { createdAt: "desc" } });
  ok(plain && plain.flagged === false, "일반 메시지 flagged=false");
  const samples = ["제 번호 010-1234-5678 로 연락주세요", "국민 123456-01-123456 으로 입금해 주시면 됩니다", "카톡 아이디 abc123 추가해주세요", "메일 test@example.com 으로 주세요", "대표번호 02-555-1234"];
  for (const text of samples) {
    r = await seller.req("POST", "/api/brand-messages", { threadId, body: text });
    const m = await db.brandMessage.findFirst({ where: { threadId }, orderBy: { createdAt: "desc" } });
    ok(r.status === 201 && r.data?.warning && m.flagged, `감지: ${text.slice(0, 18)}…`, { r, flagged: m?.flagged });
  }
  const negatives = ["주문번호 SB-20261112-0001 확인 부탁드립니다", "2026-11-20 방송 확정입니다", "사이즈 90-95-100 있어요", "수량 100개, 단가 13,579원입니다", "11월 15일 오후 2시에 방송합니다"];
  for (const text of negatives) {
    r = await brand.req("POST", "/api/brand-messages", { threadId, body: text });
    const m = await db.brandMessage.findFirst({ where: { threadId }, orderBy: { createdAt: "desc" } });
    ok(r.status === 201 && !r.data?.warning && !m.flagged, `오탐 없음: ${text.slice(0, 18)}…`, { r, flagged: m?.flagged });
  }
  ok((await db.auditLog.count({ where: { action: "BRAND_MESSAGE_CONTACT_FLAG", meta: { contains: threadId } } })) === samples.length, "직거래 의심 메시지 감사 기록");
  pg = await brand.page(`/brand/messages?t=${threadId}`);
  ok(pg.status === 200 && pg.text.includes("직거래는 이용약관에 따라"), "브랜드 메시지 화면에 경고 표시", pg.status);
  pg = await seller.page(`/seller/brand-messages?t=${threadId}`);
  ok(pg.status === 200 && pg.text.includes("직거래는 이용약관에 따라"), "셀러 메시지 화면에 경고 표시", pg.status);

  console.log("\n[A6] 공지사항 — DB 저장 · 공개 페이지");
  r = await seller.req("POST", "/api/admin/notices", { title: "셀러가 쓴 공지" });
  ok(r.status === 403 || r.status === 401, "최고관리자 외 공지 작성 불가", r);
  r = await guest.req("GET", "/api/admin/notices");
  ok(r.status === 401, "비로그인 공지 관리 API 차단", r);
  const t1 = `점검 공지 ${Date.now()}`;
  r = await admin.req("POST", "/api/admin/notices", { title: t1, body: "11월 20일 새벽 점검", pinned: true });
  ok(r.status === 201, "공지 작성", r);
  const n1 = r.data?.id;
  r = await admin.req("POST", "/api/admin/notices", { title: "" });
  ok(r.status === 400, "제목 없는 공지 거절", r);
  r = await admin.req("POST", "/api/admin/notices", { title: "위험 링크", link: "javascript:alert(1)" });
  ok(r.status === 400, "javascript: 링크 거절", r);
  const t2 = `비공개 공지 ${Date.now()}`;
  r = await admin.req("POST", "/api/admin/notices", { title: t2, isPublished: false });
  const n2 = r.data?.id;
  pg = await guest.page("/notices");
  ok(pg.status === 200 && pg.text.includes(t1) && !pg.text.includes(t2), "공개 공지만 /notices 에 표시", pg.status);
  r = await admin.req("PATCH", "/api/admin/notices", { id: n1, title: `${t1} (수정)`, pinned: false });
  ok(r.ok && (await db.siteNotice.findUnique({ where: { id: n1 } })).title.endsWith("(수정)"), "공지 수정", r);
  r = await admin.req("POST", "/api/admin/notices", { import: [{ title: "옮겨온 공지", body: "브라우저 저장분", pinned: false }] });
  ok(r.ok && r.data?.imported === 1, "예전 브라우저 공지 옮기기", r);
  r = await admin.req("GET", "/api/admin/notices");
  ok(r.ok && r.data.some((n) => n.id === n1), "공지 목록 조회", r.status);
  for (const id of [n1, n2]) await admin.req("DELETE", `/api/admin/notices?id=${id}`);
  await db.siteNotice.deleteMany({ where: { title: "옮겨온 공지" } });
  ok((await db.siteNotice.count({ where: { id: { in: [n1, n2] } } })) === 0, "공지 삭제");
  r = await admin.req("DELETE", "/api/admin/notices?id=nope");
  ok(r.status === 404, "없는 공지 삭제 404", r);
  pg = await admin.page("/admin/site-management");
  ok(pg.status === 200, "관리자 사이트 관리 화면 열림", pg.status);

  console.log("\n[A7] 푸터 사업자 정보 · 약관");
  pg = await guest.page("/terms");
  ok(pg.text.includes("사업자등록번호") && pg.text.includes("통신판매업 신고") && pg.text.includes("사업자정보 확인") && pg.text.includes("개인정보보호책임자"), "푸터 사업자 정보 표시");
  ok(pg.text.includes("직접 거래") && pg.text.includes("응대 기한") && pg.text.includes("판매·홍보하는 목적으로만"), "약관에 직거래 금지·응대 기한·상품 정보 사용 범위 조항");
  ok(pg.text.includes("/notices"), "푸터에 공지사항 링크");

  console.log("\n[A8] 화면 렌더링 회귀 (500 없음)");
  const pages = [[guest, "/"], [guest, "/brands"], [guest, `/brands/${shopId}`], [guest, "/notices"], [guest, "/terms"], [seller, "/seller/brand-requests"], [seller, "/seller/brand-messages"], [fac, "/facility/brand-requests"], [fac, "/facility/brand-products"], [brand, "/brand/requests"], [brand, "/brand/messages"], [brand, "/brand/products"], [brand, "/brand/shop"], [admin, "/admin/policy"], [admin, "/admin/site-management"]];
  for (const [cl, path] of pages) { const x = await cl.page(path); ok(x.status === 200, `${cl.name} ${path}`, x.status); }
  } finally {
    // 정책 원복
    if (prevPolicy) { const { id: _i, updatedAt: _u, ...rest } = prevPolicy; await db.platformPolicy.update({ where: { id: "default" }, data: rest }).catch(() => null); }
  }
  console.log(`\n결과: 통과 ${pass} · 실패 ${failN}`);
  if (failN) console.log(fails);
  await db.$disconnect();
  process.exit(failN ? 1 : 0);
}
main().catch(async (e) => { console.error("SIM CRASH", e); await db.$disconnect(); process.exit(2); });
