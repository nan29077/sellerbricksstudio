// 창고(스튜디오) 계정 제거 · 본사 운영 E2E 시뮬레이션 (2026-11-14)
//  창고 계정 가입 · 로그인 불가 · 최고관리자 창고 등록(직영/제휴 · 공개/비공개) · 창고 운영 매니저(담당 창고만)
//  · 알림 받는 사람(최고관리자 + 담당 매니저) · 운영 형태 · 제휴 정보 권한 · 화면 접근 · 매니저 비활성화
// 실행: 개발 서버(npm run dev) + DB(시드 완료) 상태에서 `node scripts/simulate-storage-ops.mjs`
// ⚠ 테스트 데이터를 만듭니다. 운영 DB에서는 실행하지 마세요.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const db = new PrismaClient();
const BASE = process.env.SIM_BASE ?? "http://localhost:3007";
let pass = 0, failN = 0; const fails = [];
const ok = (cond, name, extra) => { if (cond) { pass++; console.log("  ✔", name); } else { failN++; fails.push(name); console.log("  ✘", name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); } };

class Client {
  constructor() { this.jar = {}; }
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
  async page(path) { const r = await this.req("GET", path, undefined, true); return { status: r.status, location: r.headers.get("location") ?? "", text: (await r.text()).replace(/<!-- -->/g, "") }; }
}

const stamp = Date.now().toString(36);
// 평일 n일 뒤 날짜 (KST)
const weekday = (n) => { const d = new Date(Date.now() + 9 * 3600000); d.setUTCDate(d.getUTCDate() + n); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const redirected = (p) => (p.status >= 300 && p.status < 400) || /NEXT_REDIRECT/.test(p.text);

async function main() {
  const admin = new Client(), manager = new Client(), seller = new Client(), guest = new Client(), brand = new Client();
  await db.rateLimit.deleteMany({}).catch(() => {});

  console.log("\n[1] 창고(스튜디오) 계정 — 가입 · 로그인 · 화면에서 없어짐");
  ok((await admin.login("admin@sellerbricks.kr")).data?.user?.role === "SUPER_ADMIN", "최고관리자 로그인");
  ok((await manager.login("manager@sellerbricks.kr")).data?.user?.role === "MANAGER", "창고 운영 매니저 로그인");
  ok((await seller.login("seller@sellerbricks.kr")).data?.user?.role === "SELLER", "셀러 로그인");
  const oldEmail = `legacyfac-${stamp}@test.kr`;
  await db.user.create({ data: { email: oldEmail, role: "FACILITY_ADMIN", passwordHash: await bcrypt.hash("password1234", 10), profile: { create: { name: "예전 창고" } } } });
  ok(!(await new Client().login(oldEmail)).data?.user, "예전 창고 관리자 계정 로그인 불가");
  ok(!(await new Client().login("facility@sellerbricks.kr")).data?.user, "예전 데모 창고 계정(facility@) 로그인 불가");
  let r = await guest.req("POST", "/api/auth/signup", { email: `fac-${stamp}@test.kr`, password: "password1234", name: "창고", role: "FACILITY_ADMIN", agreeTerms: true, agreePrivacy: true });
  ok(r.status === 400, "창고 관리자 회원가입 API 거절", r);
  let pg = await guest.page("/signup");
  ok(pg.status === 200 && !pg.text.includes("/signup/facility") && pg.text.includes("/signup/seller") && pg.text.includes("/signup/brand"), "가입 선택 화면: 셀러 · 브랜드사만 (창고 버튼 없음)");
  pg = await guest.page("/");
  ok(pg.status === 200 && !pg.text.includes("창고(스튜디오)로 가입"), "메인 화면: 창고 가입 카드 없음");
  pg = await guest.page("/signup/facility");
  ok(redirected(pg), "예전 창고 가입 주소는 가입 선택으로 이동", { status: pg.status, location: pg.location });
  pg = await guest.page("/login");
  ok(pg.status === 200 && !pg.text.includes("facility@sellerbricks.kr"), "로그인 화면: 창고 데모 버튼 없음");
  r = await admin.req("PATCH", `/api/admin/users/${(await db.user.findUnique({ where: { email: "seller@sellerbricks.kr" } })).id}`, { role: "FACILITY_ADMIN" });
  ok(r.status === 400, "회원 관리: 창고 관리자 역할로 바꿀 수 없음", r);

  console.log("\n[2] 최고관리자 창고 등록 — 직영/제휴 · 공개/비공개 · 쇼룸");
  const base = { region: "서울", address: "서울 성동구 왕십리로 1", openTime: "09:00", closeTime: "21:00" };
  r = await manager.req("POST", "/api/facility/facilities", { ...base, name: `매니저 등록 ${stamp}`, type: "STUDIO" });
  ok(r.status === 403, "창고 운영 매니저는 창고 등록 불가", r);
  r = await admin.req("POST", "/api/facility/facilities", { ...base, name: `직영 쇼룸 ${stamp}`, type: "SHOWROOM", operationType: "DIRECT", publish: false });
  ok(r.status === 201 && r.data?.status === "PENDING", "직영 쇼룸 등록 (비공개 · 준비 중)", r);
  const showroomId = r.data?.id;
  r = await admin.req("POST", "/api/facility/facilities", { ...base, name: `제휴 창고 ${stamp}`, type: "WAREHOUSE", operationType: "PARTNER", publish: true, partnerName: "제휴물류", partnerContactName: "박담당", partnerContactPhone: "010-1111-2222", partnerContactEmail: `partner-${stamp}@test.kr` });
  ok(r.status === 201 && r.data?.status === "APPROVED", "제휴 창고 등록 (바로 공개)", r);
  const partnerId = r.data?.id;
  const adminUser = await db.user.findFirst({ where: { role: "SUPER_ADMIN" }, orderBy: { createdAt: "asc" } });
  const rows = await db.facility.findMany({ where: { id: { in: [showroomId, partnerId] } } });
  const sr = rows.find((x) => x.id === showroomId), pt = rows.find((x) => x.id === partnerId);
  ok(sr?.type === "SHOWROOM" && sr?.operationType === "DIRECT" && sr?.basePrice === 0 && sr?.ownerId === adminUser.id, "쇼룸 · 직영 · 이용료 0 · 본사 운영 계정 소유", sr);
  ok(pt?.operationType === "PARTNER" && pt?.partnerContactEmail === `partner-${stamp}@test.kr` && pt?.partnerName === "제휴물류", "제휴 정보 저장 (계정 없음)", pt);
  pg = await guest.page("/facilities");
  ok(pg.text.includes(`제휴 창고 ${stamp}`) && !pg.text.includes(`직영 쇼룸 ${stamp}`), "셀러 검색: 공개 창고만 보이고 비공개는 숨김");
  pg = await guest.page(`/facilities?type=SHOWROOM`);
  ok(pg.status === 200 && pg.text.includes("쇼룸"), "창고 검색: 쇼룸 유형 탭");
  pg = await guest.page(`/facilities/${showroomId}`);
  ok(pg.status === 404, "비공개 창고 상세는 일반 사용자에게 404", { status: pg.status });
  pg = await admin.page(`/facilities/${showroomId}`);
  ok(pg.status === 200, "비공개 창고 상세는 최고관리자 미리보기 가능", { status: pg.status });
  r = await admin.req("PATCH", `/api/admin/facilities/${showroomId}`, { status: "APPROVED" });
  ok(r.ok && (await db.facility.findUnique({ where: { id: showroomId } })).status === "APPROVED", "창고 목록에서 공개 처리", r);

  console.log("\n[3] 운영 형태 · 제휴 정보 · 정산 계좌는 최고관리자만");
  const assigned = await db.managerFacility.findMany({ where: { manager: { email: "manager@sellerbricks.kr" } }, select: { facilityId: true } });
  const mine = assigned.map((a) => a.facilityId);
  const F = await db.facility.findFirst({ where: { id: { in: mine }, operationType: "PARTNER" } }) ?? await db.facility.findFirst({ where: { id: { in: mine } } });
  const notMine = await db.facility.findFirst({ where: { id: { notIn: mine }, status: "APPROVED" } });
  r = await manager.req("PATCH", "/api/facility/profile", { facilityId: F.id, openTime: "08:00" });
  ok(r.ok, "매니저: 담당 창고 운영 시간 수정 가능", r);
  r = await manager.req("PATCH", "/api/facility/profile", { facilityId: F.id, operationType: "DIRECT" });
  ok(r.status === 403, "매니저: 운영 형태 변경 불가", r);
  r = await manager.req("PATCH", "/api/facility/profile", { facilityId: F.id, bankAccount: "999" });
  ok(r.status === 403, "매니저: 정산 계좌 변경 불가", r);
  r = await manager.req("PATCH", "/api/facility/profile", { facilityId: notMine.id, openTime: "08:00" });
  ok(r.status === 403, "매니저: 담당이 아닌 창고 수정 불가", r);
  r = await admin.req("PATCH", "/api/facility/profile", { facilityId: partnerId, operationType: "PARTNER", partnerContactEmail: "잘못된메일" });
  ok(r.status === 400, "제휴 담당자 메일 형식 검사", r);
  r = await admin.req("PATCH", "/api/facility/profile", { facilityId: showroomId, operationType: "PARTNER", partnerName: "쇼룸파트너", type: "SHOWROOM" });
  ok(r.ok && (await db.facility.findUnique({ where: { id: showroomId } })).operationType === "PARTNER", "최고관리자: 운영 형태 변경 가능", r);
  r = await manager.req("GET", "/api/facility/facilities");
  ok(Array.isArray(r.facilities) && r.facilities.length === mine.length && r.facilities.every((f) => mine.includes(f.id)), "매니저: 운영 가능한 창고 목록 = 담당 창고만", r);
  r = await admin.req("GET", "/api/facility/facilities");
  ok(Array.isArray(r.facilities) && r.facilities.length === await db.facility.count(), "최고관리자: 모든 창고 운영", { n: r.facilities?.length });

  console.log("\n[4] 예약 알림 받는 사람 = 최고관리자 + 담당 매니저 · 매니저 승인");
  const offset = 8 + (Date.now() % 40); // 다시 돌려도 겹치지 않게
  const day = weekday(offset);
  const mgrUser = await db.user.findUnique({ where: { email: "manager@sellerbricks.kr" } });
  const before = new Date();
  r = await seller.req("POST", "/api/bookings", { facilityId: F.id, startAt: `${day}T10:00`, endAt: `${day}T12:00`, purpose: "운영 시뮬" });
  ok(r.status === 201, "셀러 예약 신청 (담당 창고)", r);
  const bookingId = r.data?.bookings?.[0]?.id;
  await new Promise((res) => setTimeout(res, 300));
  const notes = await db.userNotification.findMany({ where: { createdAt: { gte: before }, type: "BOOKING" }, select: { userId: true, title: true } });
  ok(notes.some((n) => n.userId === adminUser.id), "새 예약 알림 → 최고관리자", notes);
  ok(notes.some((n) => n.userId === mgrUser.id), "새 예약 알림 → 담당 매니저", notes);
  const legacy = await db.user.findUnique({ where: { email: oldEmail } });
  ok(!notes.some((n) => n.userId === legacy.id), "예전 창고 계정에는 알림이 가지 않음");
  r = await manager.req("PATCH", `/api/bookings/${bookingId}`, { status: "APPROVED" });
  ok(r.ok && (await db.booking.findUnique({ where: { id: bookingId } })).status === "APPROVED", "담당 매니저가 예약 승인", r);
  r = await manager.req("PATCH", `/api/bookings/${bookingId}`, { facilityMemo: "매니저 메모" });
  ok(r.ok, "담당 매니저가 내부 메모 저장", r);
  // 담당이 아닌 창고 예약은 처리 불가
  const day2 = weekday(offset + 1);
  r = await seller.req("POST", "/api/bookings", { facilityId: notMine.id, startAt: `${day2}T10:00`, endAt: `${day2}T12:00` });
  const otherBooking = r.data?.bookings?.[0]?.id;
  ok(!!otherBooking, "셀러 예약 신청 (담당이 아닌 창고)", r);
  r = await manager.req("PATCH", `/api/bookings/${otherBooking}`, { status: "APPROVED" });
  ok(r.status === 403 || r.ok === false, "매니저: 담당이 아닌 창고 예약 승인 불가", r);
  r = await admin.req("PATCH", `/api/bookings/${otherBooking}`, { status: "APPROVED" });
  ok(r.ok, "최고관리자: 모든 창고 예약 승인", r);

  console.log("\n[5] 창고 운영 콘솔 · 메뉴 접근");
  pg = await admin.page("/facility/dashboard");
  ok(pg.status === 200 && pg.text.includes("창고 운영"), "최고관리자: 창고 운영 콘솔 열림", { status: pg.status });
  pg = await manager.page("/facility/bookings");
  ok(pg.status === 200, "매니저: 창고 운영 콘솔 예약 현황 열림", { status: pg.status });
  pg = await manager.page("/facility/register");
  ok(redirected(pg), "매니저: 창고 등록 화면은 대시보드로 이동", { status: pg.status });
  pg = await seller.page("/facility/dashboard");
  ok(redirected(pg), "셀러: 창고 운영 콘솔 접근 불가", { status: pg.status });
  pg = await admin.page("/facility/settlements");
  ok(pg.status === 200 && pg.text.includes("창고 매출") && pg.text.includes("직영"), "창고 매출: 직영 · 제휴 구분 표시", { status: pg.status });
  pg = await admin.page("/admin/facilities");
  ok(pg.status === 200 && pg.text.includes("창고(스튜디오) 등록") && pg.text.includes("제휴") && !pg.text.includes("수수료율 설정"), "관리자 창고 목록: 등록 버튼 · 운영 형태 · 이용료 수수료 버튼 없음", { status: pg.status });
  pg = await admin.page("/admin/settlements");
  ok(redirected(pg), "예전 창고 이용료 정산 화면은 판매 · 브랜드 정산으로 이동", { status: pg.status });
  pg = await seller.page("/seller/settlements");
  ok(pg.status === 200 && !pg.text.includes("이용 내역"), "셀러 정산: 이용료 탭 없음", { status: pg.status });
  pg = await seller.page("/seller/bookings");
  ok(pg.status === 200, "셀러 예약 메뉴 정상");
  pg = await admin.page("/admin/site-management?tab=access");
  ok(pg.status === 200 && !pg.text.includes("창고(스튜디오) 이용자 비활성화"), "메뉴 권한: 창고 이용자 비활성화 스위치 없음");

  console.log("\n[6] 브랜드 화면에 본사 계정 표시 · 매니저는 브랜드 거래 불가");
  const bp = await db.brandProduct.findFirst({ where: { isActive: true, samplePrice: { not: null } } });
  r = await manager.req("POST", "/api/brands", { action: "request", productId: bp.id, requestKey: crypto.randomUUID().replace(/-/g, ""), kind: "SAMPLE", quantity: 1, expectedUnitPrice: bp.samplePrice, recipient: "매니저", phone: "010-0000-0000", address: "서울시 성동구 어딘가 1", message: "" });
  ok(r.status === 403, "매니저: 브랜드 샘플 · 입고 신청 불가", r);
  pg = await brand.page("/");
  void pg;
  const bt = await db.profile.findFirst({ where: { user: { role: "SUPER_ADMIN" } }, select: { companyName: true } });
  ok(bt?.companyName === "스토리지마켓", "본사 계정 회사명 '스토리지마켓' (브랜드 화면 판매처 표시)", bt);
  pg = await manager.page("/facility/brand-products");
  ok(redirected(pg), "매니저: 브랜드 판매 상품 화면은 상품 관리로 이동", { status: pg.status });

  console.log("\n[7] 창고 운영 매니저 비활성화 스위치");
  r = await admin.req("PATCH", "/api/admin/settings", { managerDisabled: true });
  ok(r.ok, "매니저 비활성화 켬", r);
  try {
    r = await manager.req("PATCH", "/api/facility/profile", { facilityId: F.id, openTime: "09:00" });
    ok(r.status === 403, "비활성화 중에는 매니저가 담당 창고도 수정 불가", r);
    r = await admin.req("PATCH", "/api/facility/profile", { facilityId: F.id, openTime: "09:00" });
    ok(r.ok, "최고관리자는 계속 운영 가능", r);
  } finally {
    await admin.req("PATCH", "/api/admin/settings", { managerDisabled: false });
  }
  r = await manager.req("PATCH", "/api/facility/profile", { facilityId: F.id, openTime: "09:00" });
  ok(r.ok, "다시 켜면 매니저 운영 가능", r);
  void brand;
}

main()
  .catch((e) => { failN++; fails.push("SIM CRASH"); console.error("SIM CRASH", e); })
  .finally(async () => {
    console.log(`\n결과: 통과 ${pass} · 실패 ${failN}`);
    if (fails.length) console.log(fails);
    await db.$disconnect();
    process.exit(failN ? 1 : 0);
  });
