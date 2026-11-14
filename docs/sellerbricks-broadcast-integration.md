# 셀러브릭스 → 스토리지마켓 방송 연동 명세 (v1, 2026-11-14)

셀러브릭스에서 **자체 송출 중인 라이브** 소식을 스토리지마켓이 받아 두기 위한 연동입니다.

> 상태 (2026-11-14): 메인 플레이어의 '온에어' 탭은 없어졌습니다. 메인 영상(라이브 커머스 · 캠페인/행사)은 최고관리자가 사이트 관리 → 홈 영상에서 링크로 넣습니다.
> 이 연동은 받는 쪽(스토리지마켓)만 준비되어 있으며, 받은 방송은 `GET /api/broadcasts/on-air` 로만 확인할 수 있습니다. 나중에 '지금 방송 중' 표시나 끝난 방송의 다시보기 자동 등록에 씁니다.
스토리지마켓은 송출하지 않고, 셀러브릭스가 알려 준 방송을 **소개 · 재생(끼워 넣기) · 링크**만 합니다.

두 방식 중 하나 이상을 셀러브릭스 쪽에서 구현합니다. **웹훅(A)을 권장**하고, 피드(B)는 웹훅이 어려울 때나 보조로 씁니다.

## 공통 방송 데이터 (SellerbricksLive)

| 필드 | 필수 | 설명 |
|---|---|---|
| `id` | ✔ | 셀러브릭스 방송 ID (같은 방송은 항상 같은 값) |
| `title` | ✔ | 방송 제목 (120자) |
| `watchUrl` | ✔ | 시청 페이지 주소 (https). 메인에서 '셀러브릭스에서 보기'로 열림 |
| `status` |  | `scheduled` · `live` · `ended` (이벤트로 정해지면 생략 가능) |
| `sellerName` |  | 셀러 · 진행자 이름 |
| `embedUrl` |  | 끼워 넣기(iframe) 플레이어 주소 (https · `*.sellerbricks.co.kr`). 있으면 메인에서 바로 재생 |
| `hlsUrl` |  | HLS(.m3u8) 주소. 지금은 저장만 하고 재생은 `embedUrl` 로 함 |
| `thumbnailUrl` |  | 썸네일 이미지 (https, 16:9 권장) |
| `scheduledAt` · `startedAt` · `endedAt` |  | ISO-8601 시각 (예: `2026-11-14T20:00:00+09:00`) |

- `embedUrl` 페이지는 스토리지마켓 도메인에서 iframe 으로 열 수 있어야 합니다 → 응답 헤더에 `X-Frame-Options: DENY/SAMEORIGIN` 을 빼고 `Content-Security-Policy: frame-ancestors https://<스토리지마켓 도메인>` 을 넣어 주세요. 자동 재생은 음소거 시작을 권장합니다.
- 허용 호스트는 스토리지마켓 환경변수 `SELLERBRICKS_EMBED_HOSTS` (기본 `sellerbricks.co.kr,*.sellerbricks.co.kr`). 다른 호스트의 플레이어 주소는 버리고 링크로만 보여 줍니다.

## A. 웹훅 (셀러브릭스 → 스토리지마켓, 권장)

`POST https://<스토리지마켓 도메인>/api/integrations/sellerbricks/broadcasts`

헤더
- `Content-Type: application/json`
- `x-sellerbricks-timestamp`: 유닉스 초 (5분 넘게 차이 나면 거절 — 재전송 공격 방지)
- `x-sellerbricks-signature`: `hex(HMAC-SHA256("${timestamp}.${본문 원문}", SELLERBRICKS_WEBHOOK_SECRET))`

본문
```json
{ "event": "live.started", "broadcast": { "id": "L123", "title": "겨울 니트 특가", "sellerName": "브릭스셀러",
  "watchUrl": "https://sellerbricks.co.kr/live/L123", "embedUrl": "https://player.sellerbricks.co.kr/embed/L123",
  "thumbnailUrl": "https://sellerbricks.co.kr/t/L123.jpg", "startedAt": "2026-11-14T20:00:00+09:00" } }
```

| event | 언제 | 결과 |
|---|---|---|
| `live.scheduled` | 방송 예약 | 예정으로 저장 (시작 시각이 되면 메인에 보임) |
| `live.started` | 송출 시작 | 메인 온에어에 바로 보임 |
| `live.updated` | 제목 · 썸네일 변경 + **5~10분마다 하트비트** | 정보 갱신, 마지막 수신 시각 갱신 |
| `live.ended` | 송출 종료 (`broadcast.id` 만 있어도 됨) | 메인에서 내림 |
| `live.snapshot` | (선택) 주기적으로 지금 방송 전체 목록 `{"event":"live.snapshot","broadcasts":[...]}` | 목록에 없는 방송은 종료 처리 |

- 응답: 성공 `200 {"ok":true,...}`, 서명 오류 `401`, 형식 오류 `400`. 실패하면 셀러브릭스에서 재시도해 주세요 (같은 내용을 여러 번 보내도 안전 — 방송 `id` 기준으로 덮어씀).
- 종료 알림을 놓쳐도 계속 떠 있지 않도록, 스토리지마켓은 `SELLERBRICKS_STALE_MINUTES`(기본 30분) 동안 소식이 없는 방송을 자동으로 내립니다. 그래서 방송 중에는 `live.updated` 하트비트를 보내 주세요.

서명 예 (Node.js)
```js
const ts = Math.floor(Date.now() / 1000).toString();
const body = JSON.stringify(payload);
const sig = crypto.createHmac("sha256", process.env.STORAGEMARKET_WEBHOOK_SECRET).update(`${ts}.${body}`).digest("hex");
await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-sellerbricks-timestamp": ts, "x-sellerbricks-signature": sig }, body });
```

## B. 피드 (스토리지마켓이 읽어 감)

셀러브릭스가 `GET` 주소 하나를 열어 두면, 스토리지마켓이 1분에 한 번까지 읽습니다. (`SELLERBRICKS_LIVE_FEED_URL`, 필요하면 `SELLERBRICKS_API_KEY` → `Authorization: Bearer`)

```json
{ "broadcasts": [ { "id": "L123", "title": "...", "watchUrl": "...", "status": "live", "embedUrl": "..." } ] }
```
- 목록은 **지금 방송 중 · 예정**인 방송 전체여야 합니다. 목록에서 빠진 방송은 종료로 처리합니다.
- 5초 안에 응답하지 않으면 이번 회차는 건너뜁니다.
- 피드를 켜면 피드가 기준이 되므로, 웹훅과 함께 쓸 때는 피드에도 웹훅으로 보낸 방송이 모두 들어 있어야 합니다.

## 스토리지마켓 쪽 설정 · 운영

- 환경변수: `SELLERBRICKS_WEBHOOK_SECRET`(필수, 배포 환경에서 비면 웹훅 거절), `SELLERBRICKS_LIVE_FEED_URL` · `SELLERBRICKS_API_KEY`(피드), `SELLERBRICKS_EMBED_HOSTS`, `SELLERBRICKS_STALE_MINUTES`
- 연동 설정 화면(최고관리자 → 연동 설정)에서 키 설정 여부를 확인할 수 있습니다.

## 다음 단계 (선택)

- 셀러 계정 연결: 셀러브릭스 셀러와 스토리지마켓 셀러를 이메일 · 연동 코드로 묶으면, 방송에 그 셀러의 상품 · 주문서를 연결할 수 있습니다.
- 판매 수량 연동: 같은 서명 방식으로 `order.created` 웹훅을 받으면 셀러브릭스 판매분을 주문서로 자동 생성할 수 있습니다 (현재는 셀러가 주문서를 직접 입력).
