# 셀러 브릭스 (Seller Bricks)

라이브 커머스 셀러를 위한 **창고·스튜디오 예약 → 상품 선택/상품번호 부여 → 라이브 판매 → 주문/Mock결제 → 자체송출/카카오 알림톡** 올인원 플랫폼.

외부 API 키(PG, 카테노이드, 카카오 알림톡)가 없어도 **Mock 어댑터**로 전체 플로우가 동작합니다.

---

## 기술 스택

- **Frontend/Backend**: Next.js 14 (App Router) + React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn 스타일 컴포넌트 + lucide-react
- **DB**: PostgreSQL (docker-compose)
- **ORM**: Prisma
- **Auth**: NextAuth(Auth.js) Credentials + JWT 세션
- **Validation**: React Hook Form 호환 + Zod
- **Data**: Server Components + TanStack Query
- **외부연동**: Adapter 패턴 (PaymentAdapter / CatenoidAdapter / KakaoAlimtalkAdapter) — 키 없으면 Mock 동작
- **실시간**: 상품번호 변경 폴링(`numberVersion`) 기반 즉시 반영

---

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env`에서 최소 `DATABASE_URL`, `NEXTAUTH_SECRET`만 채우면 됩니다.
(나머지 PG/카테노이드/카카오 키는 비워두면 자동으로 Mock 동작)

```env
DATABASE_URL="postgresql://sellerbricks:sellerbricks@localhost:5432/sellerbricks?schema=public"
NEXTAUTH_SECRET="아무_긴_랜덤_문자열"
NEXTAUTH_URL="http://localhost:3007"
NEXT_PUBLIC_APP_URL="http://localhost:3007"
```

### 3. DB 띄우기 (Docker)

```bash
npm run db:up        # docker compose up -d (Postgres 16)
```

### 4. 스키마 적용 + 시드 데이터

```bash
npm run db:push      # Prisma 스키마를 DB에 반영
npm run db:seed      # 테스트 계정/창고(스튜디오)/상품 생성
```

> 마이그레이션 이력을 남기려면 `npm run db:push` 대신 `npm run db:migrate` 사용.

### 5. 개발 서버 실행

```bash
npm run dev
```

→ http://localhost:3007

## 카카오톡·SNS 공유 카드

사이트 링크의 미리보기에는 `public/images/social/share-card-v7.jpg`(1200×630)가 사용됩니다. Open Graph와 X(Twitter) 카드의 제목·설명·절대 이미지 URL은 `src/app/layout.tsx`에서 설정합니다. 실제 배포 환경에서는 `NEXT_PUBLIC_APP_URL`을 공개 사이트 주소(예: `https://example.com`)로 설정하세요. 이 값이 없으면 요청 호스트를 사용합니다.

공유 이미지의 배경 원본은 `public/images/social/share-background.png`입니다. 네이비·골드 톤의 라이브커머스 촬영 스튜디오를 생성형 이미지로 제작하고, 로고와 한글 문구는 코드로 선명하게 합성했습니다. 문구를 바꾼 뒤에는 Pillow와 한글 글꼴이 있는 환경에서 `scripts/generate-share-card.py`를 실행하면 PNG 원본과 공유용 JPEG를 함께 다시 만들 수 있습니다. 예: `python scripts/generate-share-card.py --font /path/to/korean-bold.ttf`. 로고를 바꿀 때는 `scripts/generate-brand-assets.py`를 먼저 실행하세요. 공유 카드가 크게 바뀌면 JPEG 파일 이름의 버전을 올려 카카오톡 등 외부 서비스의 기존 이미지 캐시를 피하세요.

## 홈페이지 비주얼

메인 배너와 서비스 카드에는 `public/images/home/hero-studio.webp`, `hero-fulfillment.webp`, `hero-farm.webp`를 사용합니다. 생성형 이미지로 만든 **서비스 연출 이미지**이며, 실제 회원·창고(스튜디오) 사진이나 운영 실적을 뜻하지 않습니다. 제작 프롬프트는 각각 네이비·골드 톤의 라이브커머스 스튜디오, 창고와 방송 준비 공간, 산지 현장 방송을 실사형으로 구성하고 왼쪽에 제목 공간을 두는 방향입니다. 신규 이미지로 교체할 때는 같은 경로와 비율을 유지하면 기존 레이아웃을 재사용할 수 있습니다.

휴대폰 배너에는 별도의 `hero-studio-mobile.webp`, `hero-fulfillment-mobile.webp`, `hero-farm-mobile.webp`를 사용합니다. 원본의 장소와 분위기를 참고해 핵심 피사체가 중앙에 모인 3:2 구도로 생성했고, 모바일에서는 사진과 문구를 분리해 사진이 잘리지 않게 했습니다. 브랜드 로고의 심볼은 스튜디오 전용 마크(골드 창고 + 재생 버튼 + 빨간 REC 점, 원본 `public/images/brand/studio-favicon-source.svg`)이고, 글자는 기존 셀러브릭스 로고에서 추출한 `public/images/brand/original-logo-source.png`의 SELLERBRICKS 글자에 `STUDIO`를 하단에 붙인 것입니다. 밝은 배경용 `logo-original-on-light.png`와 어두운 배경용 `logo-original-on-dark.png`가 있으며, 심볼 이미지(`mark-original-on-*.png`), 파비콘과 함께 `scripts/generate-brand-assets.py`로 다시 만들 수 있습니다.

---

## 테스트 계정

모든 계정 비밀번호: **`password1234`**

| 역할 | 이메일 | 진입 화면 |
|------|--------|-----------|
| 최고관리자 (SUPER_ADMIN) | `admin@sellerbricks.kr` | `/admin/dashboard` |
| 중간관리자 (MANAGER) | `manager@sellerbricks.kr` | `/manager/dashboard` |
| 창고(스튜디오) 관리자 (FACILITY_ADMIN) | `facility@sellerbricks.kr` | `/facility/dashboard` |
| 셀러 (SELLER) | `seller@sellerbricks.kr` | `/seller/dashboard` |
| 구매자 (BUYER) | 로그인 불필요 | 방송 링크로 접속 |

로그인 화면에서 역할 버튼을 누르면 이메일/비밀번호가 자동 입력됩니다.

> 보안: 위 계정은 `npm run db:seed`로 DB에 만들어진 계정입니다. DB가 없어도 들어갈 수 있도록 코드에 고정된 데모 로그인은 **개발 환경에서만** 동작하며, 배포 환경에서는 `DEMO_LOGIN=true`를 설정했을 때만 허용됩니다. 같은 이메일로 10분 안에 5번 틀리면 10분간 로그인이 막힙니다.

---

## 전체 플로우 체험 (5분)

1. **창고(스튜디오) 관리자**로 로그인 → `상품` 메뉴에서 상품 등록 (시드에 이미 존재)
2. **셀러**로 로그인 → `예약` → 창고(스튜디오) 검색 후 예약 신청
3. **창고(스튜디오) 관리자**로 로그인 → `예약 관리`에서 **승인**
4. **셀러**로 로그인 → `라이브` → 승인된 예약으로 **라이브 세션 생성**
5. `판매 상품 선택`에서 창고(스튜디오) 상품 추가 → **상품번호 자동/수동 부여**, 드래그로 순서 변경, 방송 중 **임시상품 추가**
6. 세션 상세에서 **방송 시작** + **카카오 알림톡 발송**(Mock) + 구매자 링크 복사
7. 구매자 링크(`/live/...`)를 새 창에서 열어 **상품번호로 장바구니 담기 → Mock 결제 → 주문 완료**
8. **셀러/창고(스튜디오) 관리자/관리자** 대시보드에서 주문·매출·정산 확인

> 셀러 화면에서 상품번호를 바꾸면 구매자 화면에 약 4초 내 자동 반영됩니다(폴링).

### 운영 흐름 (추가)

- **창고(스튜디오) 등록**: 창고(스튜디오) 관리자 → `창고(스튜디오) 등록` 메뉴에서 신청 → 최고관리자 `창고(스튜디오) 관리`에서 **승인 / 운영 정지 / 운영 재개**
- **주문 처리**: 셀러·창고(스튜디오) 관리자·최고관리자의 `주문` 화면에서 **상품 준비 → 발송 처리 → 배송 완료**, 배송 전 **주문 취소**(결제 취소 + 재고 복구), 배송 후 **환불**
- **구매자 주문 조회**: `/order-lookup`에서 주문번호 + 연락처로 조회
- **회원 정지**: 최고관리자 `회원 관리`에서 계정 정지/활성화 (정지 즉시 로그인·이용 차단)
- **중간관리자 등록**: 최고관리자 `회원 관리` → `중간 관리자 등록` (담당 창고(스튜디오) 이름이 하나와 일치하면 자동 연결)

---

## 사용자 역할 & 권한 (RBAC)

- **SUPER_ADMIN**: 전체 데이터, 창고(스튜디오) 승인, 중간관리자/수수료 설정, 연동·감사로그
- **MANAGER**: 본인이 영업한 창고(스튜디오)(`manager_facilities`)만 조회 — 수수료는 최고관리자만 설정
- **FACILITY_ADMIN**: 본인 소유 창고(스튜디오)/상품/예약/주문만 관리, 방송 중 상품 추가
- **SELLER**: 본인 예약/방송/상품번호/주문/정산
- **BUYER**: 공개 방송 링크 + 본인 주문 결과

권한 체크는 모든 API Route/Server Action에서 `requireRole()` / 소유권 검증으로 적용, 주요 변경은 `audit_logs`에 기록됩니다.

---

## Adapter 구조 (키 없으면 Mock)

| 어댑터 | 위치 | Mock 동작 |
|--------|------|-----------|
| `PaymentAdapter` | `src/lib/adapters/payment.ts` | 결제 생성→승인 자동 성공, webhook 검증 통과 |
| `CatenoidAdapter` | `src/lib/adapters/catenoid.ts` | Mock 송출 URL / playback URL 생성 |
| `KakaoAlimtalkAdapter` | `src/lib/adapters/kakao.ts` | `notification_logs`에 발송 로그만 저장 |

실제 연동 시 `.env`에 키를 채우고 각 파일의 `get*Adapter()`에서 실제 어댑터로 교체하면 됩니다. **키는 코드에 하드코딩하지 않고 `.env`로만 관리합니다.**

---

## 주요 라우트

**Public**: `/` · `/facilities` · `/facilities/[id]` · `/live/[sessionSlug]` · `/checkout/[sessionSlug]` · `/order-complete/[orderId]`
**Auth**: `/login` · `/signup` · `/signup/{seller,facility,manager}`
**Seller**: `/seller/{dashboard,bookings,bookings/new,live-sessions,live-sessions/[id],.../products,.../numbering,orders,settlements,kakao}`
**Facility**: `/facility/{dashboard,profile,products,products/new,schedule,bookings,live-sessions,orders,settlements}`
**Manager**: `/manager/{dashboard,facilities,bookings,sales,commissions}`
**Admin**: `/admin/{dashboard,users,facilities,managers,commission-rules,bookings,orders,payments,settlements,integrations,audit-logs}`

---

## 데이터 모델 핵심 제약

- `live_session_products`: `(liveSessionId, displayNumber)` **unique** — 상품번호 중복 방지
- 동일 `facilityId` 동일 시간대 `booking` 중복 방지 (API에서 overlap 검사)
- 상품번호 변경 시 `live_product_number_history`에 이력 저장 + `numberVersion` 증가(실시간 반영)
- 주문은 `liveSessionId / sellerId / facilityId`와 연결
- 중간관리자는 `manager_facilities`에 연결된 창고(스튜디오)만 접근

---

## 스크립트

```bash
npm run dev        # 개발 서버
npm run build      # prisma generate + next build
npm run start      # 프로덕션 실행
npm run typecheck  # 타입 체크
npm run db:up      # Postgres (docker)
npm run db:push    # 스키마 반영
npm run db:seed    # 시드
npm run db:reset   # DB 초기화 + 재시드
```

---

## 참고

- 금액은 원화(KRW), 시간은 한국 시간(Asia/Seoul) 기준
- UI 텍스트 한국어, 빈/로딩/에러 상태 UI 포함, 모바일 우선(터치 타겟 ≥44px, 셀러 하단 탭/구매자 하단 장바구니바)
- 데모 단계라 결제/송출/알림톡은 Mock입니다. 실제 키 연동 시 어댑터만 교체하면 됩니다.

---

## 2026-11 메뉴 고도화 (적용 방법)

이번 업데이트로 DB 스키마가 바뀌었습니다. 처음 한 번 아래 순서로 실행하세요.

```bash
npm run db:push                          # 새 테이블·필드 반영 + Prisma Client 재생성
npx tsx prisma/backfill-booking-price.ts  # 기존 예약의 이용료(totalPrice) 소급 계산 + 기본 수수료율 10% 생성
```

### 추가된 데이터
- 예약: 이용료(`totalPrice` = 시간당 요금 × 이용 시간), 방문 인원, 요청사항, 창고(스튜디오) 내부 메모, 취소 사유, 승인·취소·완료 시각
- 창고(스튜디오): 연락처, 수용 인원, 최소 예약 시간, 취소·환불 규정, 정산 계좌
- 새 테이블: `FacilityReview`(리뷰), `FacilityFavorite`(찜), `FacilitySettlement`(창고 정산서), `UserNotification`(알림),
  `MarketingApplication`(마케팅 지원 신청), `SellerPromotion`(이벤트), `SellerCoupon`(쿠폰), `MarketingAsset`(광고 소재), `SnsAccount`·`SnsPost`(SNS 채널·콘텐츠 캘린더)

### 공통
- 상단 **알림 벨**: 예약 요청·승인·거절·취소, 문의·답변, 리뷰, 정산, 마케팅 신청 상태가 실시간(1분) 알림으로 옵니다.
- 모든 목록: 상태 탭(건수), 검색·기간 필터, 페이지네이션, **엑셀(CSV) 다운로드**, 월간 **달력 보기**
- 예약 검증 강화: 운영 시간 · 요일별 운영 시간대 · 휴무일 · 최소 이용 시간 · 수용 인원 · 중복 예약을 서버에서 검사
- 데모 로그인: 같은 이메일의 DB 계정이 있으면 **DB 계정을 우선** 사용합니다. (데모 id로 로그인해 데이터가 저장되지 않던 문제 해결)

### 셀러
- 예약 관리: 다가오는 예약·이번 달 이용료 지표, 취소 사유 입력, 이용 완료 후 **리뷰 작성/수정**, 다시 예약, 내 캘린더(.ics) 추가
- 예약 신청: 날짜별 예약 현황 타임라인, 이용 시간 빠른 선택, 예상 이용료, 취소 규정 동의, 찜한 곳 우선 정렬
- 창고(스튜디오) 예약 현황: 월간 캘린더 · 7일 일정 · **찜 목록** · 보낸 문의/답변 내역
- 마케팅: SNS 채널 관리, 콘텐츠 캘린더·성과 입력, 마케팅 지원 신청 / 이벤트·프로모션(목표 대비 달성률, 복제) / 쿠폰(코드 발급·사용 집계·일시 중지) / 광고 소재 보관함(태그·즐겨찾기·문구 복사) / 실데이터 기반 마케팅 분석
- 정산 내역: 창고(스튜디오) 이용료 12개월 추이·창고별 지출, 판매 정산 탭

### 창고(스튜디오) 관리자
- 예약 관리: **일괄 승인/거절**, 거절·취소 사유 템플릿, 이용 완료 처리, 셀러 비공개 내부 메모, 첫 이용/재이용 셀러 표시
- 일정 관리: 요일별 운영 시간대 편집, 휴무일(기간) 등록, 향후 7일 가동률, 인기 요일·시간
- 정보·편집: 시간당 요금·최소 시간·수용 인원·연락처·취소 규정·**정산 계좌** 편집
- 리뷰 관리(신규): 평점 분포, 답글 템플릿 / 셀러 문의: 답변 대기 필터·검색·평균 응답 시간·답변 템플릿
- 정산 내역: 정산 예정액, 정산서(대기→지급 예정→지급 완료), 월별 매출

### 최고관리자
- 회원: 검색·역할/상태/미접속 필터, 정보·역할 변경, 관리자 메모, 최근 로그인
- 창고(스튜디오): 승인·정지(사유 알림), **창고별 수수료율**, 이번 달 실적, 미입력 항목 점검
- 매니저: 담당 창고 배정, 이용 완료 매출 기준 수수료 자동 계산
- 예약 현황: 전체 예약 대리 처리·일괄 처리 / 창고(스튜디오)별 현황: 가동률·매출·대기 비교
- 정산 관리: 기간별 **정산서 자동 생성**, 확정·지급 처리, 이체용 CSV, 기본 수수료율 설정
- 마케팅 지원: 신청 검토(검토중·승인·반려·완료), 진행 중 셀러 이벤트 / 리뷰 관리(신규): 숨김·삭제
- 연동 설정: 실제 환경변수 설정 여부·DB 응답·알림/결제 현황 점검 / 감사 로그: 필터·상세 보기·CSV

### 중간관리자
- 사이드 메뉴 복구: 대시보드 · 담당 창고(스튜디오) · 예약 현황 · 매출 현황 · 내 수수료 · 설정
- 담당 창고 점검 항목(계좌·규정·운영 시간대 미설정, 30일 무예약, 승인 지연), 12개월 매출, 월별 수수료·예정 수수료
