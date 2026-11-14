-- AlterTable
ALTER TABLE "SupportInquiry" ADD COLUMN     "adminReadAt" TIMESTAMP(3),
ADD COLUMN     "lastAdminReplyAt" TIMESTAMP(3),
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "ratingNote" TEXT,
ADD COLUMN     "userReadAt" TIMESTAMP(3);


-- 기존 답변은 마지막 답변 시각으로 채운다
UPDATE "SupportInquiry" i SET "lastAdminReplyAt" = COALESCE((SELECT MAX(m."createdAt") FROM "SupportMessage" m WHERE m."inquiryId" = i.id AND m.author = 'ADMIN'), i."answeredAt") WHERE "lastAdminReplyAt" IS NULL;
