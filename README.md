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

#### PC 여백과 예시 공간 이미지

최고관리자 **메인 여백 관리**에서 미리보기로 확인한 뒤 저장합니다. **사이트 설정 → 메인 여백 배경**에서도 같은 배경을 선택할 수 있습니다. 기본값은 진행자와 촬영자가 함께하는 실사형 배경이며, 선택값은 `data/settings.json`에 저장됩니다.

- `public/images/home/backgrounds/`의 인물 배경 5종은 내장 ImageGen으로 제작했습니다. 16:9 웹 배경, 가상의 한국인 성인 인물, 양옆에 배치한 얼굴과 활동, 따뜻하고 밝은 조명, 글자·로고·화면 UI 제외를 공통 프롬프트로 사용했습니다. 일러스트형은 사용자가 제공한 꽃가게 이미지를 분위기와 캐릭터 표현의 참고 자료로 사용했습니다.

| 파일 | 표현 | 장면별 생성 프롬프트 |
| --- | --- | --- |
| `studio-people.webp` | 실사형 | 크림색 블라우스의 진행자가 상품을 소개하고 네이비 셔츠의 촬영자가 카메라를 조정하는 원목·식물 스튜디오 |
| `fulfillment-people.webp` | 실사형 | 작업대에서 상품을 포장하는 여성 셀러와 배송 상자를 든 남성 셀러, 정돈된 선반과 밝은 포장 작업실 |
| `farm-people.webp` | 실사형 | 귤 바구니를 든 농가 여성과 신선한 농산물을 소개하는 남성 크리에이터, 아침 햇살의 온실·집하 공간 |
| `flower-illustration.webp` | 입체 일러스트형 | 리본을 묶는 플로리스트와 선물을 주고받는 점원·손님, 복숭아색 꽃과 세이지 앞치마, 점토 질감의 둥근 성인 캐릭터 |
| `seller-illustration.webp` | 입체 일러스트형 | 카메라 앞에서 상품을 소개하는 셀러와 소포를 준비하는 동료들, 식물과 원목 선반, 크림·세이지·골드의 동화 같은 작업실 |

배경은 화면 양옆 폭에 맞춰 인물 구역을 배치하며 관리자 미리보기에도 같은 구성을 사용합니다. 기존 인물 없는 공간 배경 5종은 관리 화면의 **기존 공간 배경 5종**에서 선택할 수 있습니다.

- `public/images/home/showcase/`의 썸네일 21종은 내장 ImageGen으로 제작했습니다. 가상의 한국 창고·스튜디오를 3:2 실내 사진으로 연출하고, 카드에서 4:3으로 잘라도 주요 피사체가 보이도록 배치했습니다. 자연스러운 재질과 부드러운 조명을 사용했고 인물·로고·글자는 제외했습니다. 추가 제작한 6종은 네이비 라이브 세트, 제품 근접 촬영실, 제주 온실 방송 공간, 도심 포장 창고, 소형 검수 창고, 제주 농산물 집하장입니다. 예시 공간에는 각자 전용 이미지를, 메인의 등록 공간에는 공간 유형에 맞는 이미지를 표시합니다. 각 장면은 `src/lib/showcase.ts`의 이미지 ID와 공간 설명에서 확인할 수 있습니다.

#### 고객지원

문의는 `/support`에서 접수하고 최고관리자 **고객 문의 관리**에서 답변합니다. 새 문의와 답변은 앱 알림에 표시됩니다. 배포 환경에서 문의 저장을 사용하려면 해당 PostgreSQL에 `npm run db:push`로 `SupportInquiry` 테이블을 반영하세요.

#### 계정 프로필

각 역할의 **설정 → 프로필 관리**에서 사진을 올리거나 동물 캐릭터를 고를 수 있습니다. 새 계정에는 동물 30종 중 하나가 무작위로 배정됩니다. 사진을 저장하면 대시보드와 메인 메뉴에 우선 표시되며, **내 사진 제거** 후 저장하면 선택한 동물이 다시 표시됩니다. 업로드한 JPG·PNG·WebP 사진은 가운데를 정사각형으로 잘라 320픽셀 JPEG로 저장합니다.

`public/images/profiles/animals/`의 동물 30종은 내장 ImageGen으로 제작했습니다. 각 동물의 귀, 무늬, 부리 등 특징이 작은 원형 프로필에서도 잘 보이도록, 둥근 얼굴과 상반신을 중앙에 두고 단색 파스텔 배경과 부드러운 봉제·점토 질감을 적용한 정사각형 아바타를 요청했습니다. 동물 이름과 파일의 대응은 `src/lib/profile.ts`에서 확인할 수 있습니다.

---

## 테스트 계정

모든 계정 비밀번호: **`password1234`**

| 역할 | 이메일 | 진입 화면 |
|------|--------|-----------|
| 최고관리자 (SUPER_ADMIN) | `admin@sellerbricks.kr` | `/admin/dashboard` |
| 중간관리자 (MANAGER) | `manager@sellerbricks.kr` | `/manager/dashboard` |
| 창고(스튜디오) 관리자 (FACILITY_ADMIN) | `facility@sellerbricks.kr` | `/facility/dashboard` |
| 브랜드사 (BRAND_ADMIN) | `brand@sellerbricks.kr` | `/brand/dashboard` |
| 셀러 (SELLER) | `seller@sellerbricks.kr` | `/seller/dashboard` |
| 구매자 (BUYER) | 로그인 불필요 | 방송 링크로 접속 |

로그인 화면에서 역할 버튼을 누르면 이메일/비밀번호가 자동 입력됩니다.

> 보안: 기존 테스트 계정은 `npm run db:seed`로 생성합니다. 브랜드사 테스트 계정은 데모 로그인이 활성화된 환경에서 첫 로그인 시 DB에 생성됩니다. 개발 환경에서 데모를 끄려면 `DEMO_LOGIN=false`를 설정하세요. 배포 환경에서 코드에 고정된 데모 로그인을 사용하려면 `DEMO_LOGIN=true`가 필요합니다. 같은 이메일로 10분 안에 5번 틀리면 10분간 로그인이 막힙니다.

### 브랜드샵과 창고(스튜디오)샵

1. 기존 개발 DB에 새 역할과 테이블을 추가하려면 `npm run db:push`를 실행합니다.
2. 브랜드사 테스트 로그인 후 샵을 만들고 공급 단가·재고, 샘플 단가·재고를 입력합니다. 샘플 단가를 비우면 미제공, 0원이면 무료입니다.
3. 최고관리자의 **브랜드샵 관리**에서 공개를 승인합니다. 셀러와 창고 관리자는 **브랜드샵**에서 공급 신청 또는 샘플 주문을 진행하고 **내 브랜드 신청**에서 상태를 확인합니다.
4. 유료 샘플은 브랜드사가 저장한 계좌이체 안내를 주문자에게 표시하고 실제 입금을 확인한 뒤 발송합니다. 공급 신청의 거래 조건과 결제는 당사자가 협의합니다.
5. 창고 관리자는 **창고(스튜디오)샵 관리**에서 공간별 디자인을 편집하고 **상품 관리**에서 예약용 판매 상품을 등록합니다. 셀러는 창고샵에서 상품을 예약에 담거나 예약 화면에서 직접 선택합니다. 최고관리자는 **창고(스튜디오) 관리**에서 샵과 상품을 편집할 수 있습니다.

샵 배너와 PC 여백은 `public/images/shop-artwork/`의 ImageGen 프리셋 또는 직접 입력한 이미지 주소를 사용합니다. 각 샵에서 배너와 여백을 개별적으로 선택할 수 있습니다.

| 파일 | 생성 장면 |
|------|-----------|
| `brand-beauty.webp` | 창업자와 연구원이 스킨케어 제품을 진열하는 뷰티 랩 |
| `brand-fashion.webp` | 패션 창업자들이 자연광 아래 옷과 소재를 정리하는 쇼룸 |
| `brand-accessories.webp` | 디자이너들이 가방과 액세서리를 배치하는 공방 |
| `brand-food.webp` | 식품 브랜드 운영자가 간식과 식재료를 준비하는 스튜디오 |
| `brand-illustration.webp` | 파스텔 톤 라이프스타일 매장에서 선물을 포장하는 3D 일러스트 |
| `facility-fulfillment.webp` | 작업자들이 박스를 포장하는 풀필먼트 창고 |
| `facility-live.webp` | 제작진이 카메라와 조명을 운영하는 라이브 스튜디오 |
| `facility-logistics.webp` | 작업자들이 선반 앞에서 재고를 점검하는 물류 센터 |
| `facility-daylight.webp` | 제작진이 자연광 아래 상품 촬영을 준비하는 스튜디오 |
| `facility-illustration.webp` | 상품을 포장하고 촬영하는 창고 스튜디오의 3D 일러스트 |

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

---

## 2026-11 예약 시스템 고도화 · 이용료 무료 전환 (적용 방법)

DB 스키마가 바뀌었습니다. 한 번만 아래 순서로 실행하세요.

```bash
npm run db:push                             # 예약 정책·예약 상품·대기 신청 테이블 반영 + Prisma Client 재생성
npx tsx prisma/backfill-free-booking.ts     # 기존 요금·이용료 0원 처리 + 기존 예약에 예약번호 부여
```

> `prisma/backfill-booking-price.ts`(이용료 소급 계산)는 더 이상 쓰지 않습니다. 실행해도 안내만 출력합니다.

### 정책
- **창고(스튜디오) 이용료는 무료**입니다. 예약 이용료(`totalPrice`)는 항상 0으로 저장되고, 화면의 이용료 표시는 "무료"로 바뀌었습니다.
- 창고(스튜디오)는 **판매 상품을 등록**하고, 셀러는 **등록된 상품을 보고 그 창고(스튜디오)를 예약**합니다.

### 셀러
- **판매 상품 둘러보기** (`/seller/products`): 모든 창고(스튜디오)의 판매 상품을 검색·카테고리·지역·유형·재고로 거르고, 많이 예약된 순·수수료 순 등으로 정렬. 상품을 수량과 함께 담으면 창고(스튜디오)별로 묶어 바로 예약.
- **예약 신청 4단계** (`/seller/bookings/new`): 장소 → 판매 상품·수량 → 일정 → 확인
  - 4주 여유 달력(여유 / 마감 임박 / 마감 / 휴무), 이용 시간 선택, 시작 시간 버튼(예약 가능 / 승인 대기중 / 예약됨), 타임라인
  - **정기 방송**: 매주 같은 요일·시간으로 최대 12주. 날짜별 가능 여부를 미리 보여주고, 안 되는 날짜만 빼고 예약 가능
  - **대기 신청**: 다른 셀러가 잡은 시간에 대기 → 그 예약이 취소·거절·변경되면 알림
  - 완판 시 매출·예상 셀러 수익 요약, 즉시 확정 공간은 바로 확정
- **예약 관리**: 예약번호, 판매 예정 상품(준비 가능/불가 표시), **일정 변경**(같은 화면에서 빈 시간 선택), 취소·변경 마감 안내, 대기 신청 목록, 승인된 예약에서 바로 "라이브 준비"
- 라이브 세션을 만들면 **예약 때 고른 상품이 상품번호 1번부터 자동 등록**됩니다. (준비 불가 상품 제외)

### 창고(스튜디오) 관리자
- **상품 관리** (메뉴 추가): 상품 수정(이름·카테고리·가격·재고·수수료·설명·이미지), 누적 예약/라이브 판매 횟수, **다가오는 예약의 판매 예정 수량과 재고 부족 경고**. 상품 등록 화면에서 셀러에게 보이는 카드를 미리 확인.
- **예약 정책 설정** (창고(스튜디오) 정보 → 예약 정책 설정): 즉시 확정, 시작 단위(정시/30분), 예약 사이 준비시간, 최소·최대 이용 시간, 최소 몇 시간 전 예약, 최대 며칠 앞까지, 셀러 직접 변경·취소 마감, 예약 안내사항
- **예약 현황**: 판매 예정 상품과 수량 확인, 상품별 **준비 가능/불가 표시**(셀러에게 알림), 정기·일정 변경 표시, 예약번호 검색. 승인하면 요청 상품은 자동으로 "준비 가능".

### 서버 규칙 (`src/lib/booking-engine.ts`, `src/lib/booking.ts`, `src/lib/booking-actions.ts`)
- 운영 시간대·휴무일·시작 단위·최소/최대 시간·선예약 기간·최소 사전 시간·**준비시간 포함 중복**을 서버에서 최종 검사
- 같은 창고(스튜디오)의 예약 생성·변경·승인은 **PostgreSQL advisory lock**으로 한 줄로 처리해 동시에 같은 시간을 잡을 수 없습니다.
- 셀러는 승인된 예약을 마감 시간 전까지만 직접 취소·변경할 수 있고, 승인된 예약을 셀러가 바꾸면 다시 승인 대기로 돌아갑니다(즉시 확정 공간 제외).
- 예약이 취소·거절되면 방송 전 라이브 세션도 함께 취소됩니다.

### 새 API
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/facilities/[id]/calendar?from=&days=` | 날짜별 예약 여유 요약 |
| GET | `/api/facilities/[id]/availability?date=&hours=&exclude=` | 하루 운영 구간·점유·시작 가능 시각 |
| POST | `/api/bookings` | `products`, `repeatWeeks`, `skipConflicts`, `dryRun` 추가 |
| PATCH | `/api/bookings/[id]` | `{action:"reschedule"}` 일정 변경, `{products:[...]}` 상품 준비 표시 |
| POST/DELETE | `/api/bookings/waitlist` | 대기 신청 / 취소 |
