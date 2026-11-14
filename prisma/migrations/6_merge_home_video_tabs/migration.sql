-- 메인 영상 플레이어: 캠페인 · 행사 탭을 라이브 커머스로 합침 (2026-11-14)
UPDATE "HomeVideo" SET "category" = 'LIVE_COMMERCE' WHERE "category" <> 'LIVE_COMMERCE';
