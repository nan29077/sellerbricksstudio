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
npm run db:seed      # 테스트 계정/시설/상품 생성
```

> 마이그레이션 이력을 남기려면 `npm run db:push` 대신 `npm run db:migrate` 사용.

### 5. 개발 서버 실행

```bash
npm run dev
```

→ http://localhost:3007

## 카카오톡·SNS 공유 카드

사이트 링크의 미리보기에는 `public/images/social/share-card.png`(1200×630)가 사용됩니다. Open Graph와 X(Twitter) 카드의 제목·설명·이미지는 `src/app/layout.tsx`에서 설정합니다. 실제 배포 환경에서는 `NEXT_PUBLIC_APP_URL`을 공개 사이트 주소(예: `https://example.com`)로 설정하세요. 이 값이 없으면 요청 호스트를 사용합니다.

공유 이미지의 배경 원본은 `public/images/social/share-background.png`입니다. 문구나 로고를 바꾼 뒤에는 Pillow와 한글 글꼴이 있는 환경에서 `scripts/generate-share-card.py`를 실행해 최종 이미지를 다시 만들 수 있습니다. 예: `python scripts/generate-share-card.py --font /path/to/korean-bold.ttf`.

## 홈페이지 비주얼

메인 배너와 서비스 카드에는 `public/images/home/hero-studio.webp`, `hero-fulfillment.webp`, `hero-farm.webp`를 사용합니다. 생성형 이미지로 만든 **서비스 연출 이미지**이며, 실제 회원·시설 사진이나 운영 실적을 뜻하지 않습니다. 제작 프롬프트는 각각 네이비·골드 톤의 라이브커머스 스튜디오, 창고와 방송 준비 공간, 산지 현장 방송을 실사형으로 구성하고 왼쪽에 제목 공간을 두는 방향입니다. 신규 이미지로 교체할 때는 같은 경로와 비율을 유지하면 기존 레이아웃을 재사용할 수 있습니다.

---

## 테스트 계정

모든 계정 비밀번호: **`password1234`**

| 역할 | 이메일 | 진입 화면 |
|------|--------|-----------|
| 최고관리자 (SUPER_ADMIN) | `admin@sellerbricks.kr` | `/admin/dashboard` |
| 중간관리자 (MANAGER) | `manager@sellerbricks.kr` | `/manager/dashboard` |
| 창고지기 (FACILITY_ADMIN) | `facility@sellerbricks.kr` | `/facility/dashboard` |
| 셀러 (SELLER) | `seller@sellerbricks.kr` | `/seller/dashboard` |
| 구매자 (BUYER) | 로그인 불필요 | 방송 링크로 접속 |

로그인 화면에서 역할 버튼을 누르면 이메일/비밀번호가 자동 입력됩니다.

---

## 전체 플로우 체험 (5분)

1. **창고지기**로 로그인 → `상품` 메뉴에서 상품 등록 (시드에 이미 존재)
2. **셀러**로 로그인 → `예약` → 시설 검색 후 예약 신청
3. **창고지기**로 로그인 → `예약 관리`에서 **승인**
4. **셀러**로 로그인 → `라이브` → 승인된 예약으로 **라이브 세션 생성**
5. `판매 상품 선택`에서 시설 상품 추가 → **상품번호 자동/수동 부여**, 드래그로 순서 변경, 방송 중 **임시상품 추가**
6. 세션 상세에서 **방송 시작** + **카카오 알림톡 발송**(Mock) + 구매자 링크 복사
7. 구매자 링크(`/live/...`)를 새 창에서 열어 **상품번호로 장바구니 담기 → Mock 결제 → 주문 완료**
8. **셀러/창고지기/관리자** 대시보드에서 주문·매출·정산 확인

> 셀러 화면에서 상품번호를 바꾸면 구매자 화면에 약 4초 내 자동 반영됩니다(폴링).

---

## 사용자 역할 & 권한 (RBAC)

- **SUPER_ADMIN**: 전체 데이터, 시설 승인, 중간관리자/수수료 설정, 연동·감사로그
- **MANAGER**: 본인이 영업한 시설(`manager_facilities`)만 조회 — 수수료는 최고관리자만 설정
- **FACILITY_ADMIN**: 본인 소유 시설/상품/예약/주문만 관리, 방송 중 상품 추가
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
- 중간관리자는 `manager_facilities`에 연결된 시설만 접근

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
