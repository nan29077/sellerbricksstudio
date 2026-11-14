-- CreateEnum
CREATE TYPE "FacilityOperation" AS ENUM ('DIRECT', 'PARTNER');

-- AlterEnum
ALTER TYPE "FacilityType" ADD VALUE 'SHOWROOM';

-- AlterTable
ALTER TABLE "Facility" ADD COLUMN     "operationType" "FacilityOperation" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN     "partnerContactEmail" TEXT,
ADD COLUMN     "partnerContactName" TEXT,
ADD COLUMN     "partnerContactPhone" TEXT,
ADD COLUMN     "partnerName" TEXT;


-- 창고(스튜디오) 관리자 계정을 없애고 본사가 직접 운영한다 (2026-11-14).
-- 예전 창고 관리자 계정이 가진 창고는 가장 먼저 만든 최고관리자 계정(본사 운영 계정)으로 넘긴다.
UPDATE "Facility" f SET "ownerId" = a.id
FROM (SELECT id FROM "User" WHERE "role" = 'SUPER_ADMIN' AND "isActive" = true AND "withdrawnAt" IS NULL ORDER BY "createdAt" ASC LIMIT 1) a
WHERE f."ownerId" IN (SELECT id FROM "User" WHERE "role" = 'FACILITY_ADMIN');
