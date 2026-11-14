-- 2026-11-14: 창고(스튜디오) 관리자 계정을 없앤다. 창고는 본사(최고관리자 · 담당 매니저)가 직접 운영한다.
-- 예전 창고 관리자 계정이 가진 창고를 가장 먼저 만든 최고관리자 계정(본사 운영 계정)으로 넘긴다.
-- 계정 자체는 지우지 않는다(거래 기록 보존). 로그인은 코드에서 막는다.
-- 여러 번 실행해도 안전하다. 개발 서버를 켤 때 scripts/ensure-db.mjs 가 `prisma db push` 전에 자동으로 실행한다.
DO $$
BEGIN
  IF to_regclass('"Facility"') IS NOT NULL AND to_regclass('"User"') IS NOT NULL THEN
    UPDATE "Facility" f SET "ownerId" = a.id
    FROM (SELECT id FROM "User" WHERE "role"::text = 'SUPER_ADMIN' AND "isActive" = true AND "withdrawnAt" IS NULL ORDER BY "createdAt" ASC LIMIT 1) a
    WHERE f."ownerId" IN (SELECT id FROM "User" WHERE "role"::text = 'FACILITY_ADMIN');
  END IF;
END $$;

-- 브랜드사 화면에 본사 계정이 '스토리지마켓'으로 보이도록 회사명이 비어 있으면 채운다
DO $$
BEGIN
  IF to_regclass('"Profile"') IS NOT NULL THEN
    UPDATE "Profile" p SET "companyName" = '스토리지마켓'
    FROM "User" u WHERE u.id = p."userId" AND u."role"::text = 'SUPER_ADMIN' AND (p."companyName" IS NULL OR p."companyName" = '');
  END IF;
END $$;
