-- 2026-11-12: 스토리지마켓(셀러브릭스 스튜디오)은 직접 방송을 송출하지 않는다.
-- 예전 자체 송출(카테노이드) 흔적을 지운다. 여러 번 실행해도 안전하다(이미 지웠으면 아무것도 하지 않음).
-- 개발 서버를 켤 때 scripts/ensure-db.mjs 가 `prisma db push` 전에 자동으로 실행한다.
DO $$
BEGIN
  IF to_regclass('"StreamChannel"') IS NOT NULL THEN
    DELETE FROM "StreamChannel" WHERE "type"::text = 'CATENOID';
  END IF;
  IF to_regclass('"CatenoidStreamLog"') IS NOT NULL THEN
    DROP TABLE "CatenoidStreamLog";
  END IF;
  IF to_regclass('"LiveSession"') IS NOT NULL THEN
    ALTER TABLE "LiveSession" DROP COLUMN IF EXISTS "selfStreamUrl", DROP COLUMN IF EXISTS "catenoidStreamId", DROP COLUMN IF EXISTS "catenoidPlaybackUrl";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'SnsChannelType' AND e.enumlabel = 'CATENOID') THEN
    ALTER TYPE "SnsChannelType" RENAME TO "SnsChannelType_old";
    CREATE TYPE "SnsChannelType" AS ENUM ('YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'ETC');
    ALTER TABLE "StreamChannel" ALTER COLUMN "type" TYPE "SnsChannelType" USING ("type"::text::"SnsChannelType");
    DROP TYPE "SnsChannelType_old";
  END IF;
END $$;
