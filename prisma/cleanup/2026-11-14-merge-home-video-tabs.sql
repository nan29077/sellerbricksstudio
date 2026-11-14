-- 2026-11-14: 메인 영상 플레이어의 '캠페인 · 행사' 탭을 '라이브 커머스' 한 탭으로 합쳤다. 여러 번 실행해도 안전하다.
DO $$
BEGIN
  IF to_regclass('"HomeVideo"') IS NOT NULL THEN
    UPDATE "HomeVideo" SET "category" = 'LIVE_COMMERCE' WHERE "category" <> 'LIVE_COMMERCE';
  END IF;
END $$;
