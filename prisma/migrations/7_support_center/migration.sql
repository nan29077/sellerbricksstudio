-- AlterTable
ALTER TABLE "SupportInquiry" ADD COLUMN     "adminMemo" TEXT,
ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "chatTranscript" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "guestEmail" VARCHAR(120),
ADD COLUMN     "guestName" VARCHAR(40),
ADD COLUMN     "guestPhone" VARCHAR(30),
ADD COLUMN     "guestToken" TEXT,
ADD COLUMN     "lastUserReplyAt" TIMESTAMP(3),
ADD COLUMN     "pagePath" VARCHAR(200),
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'PAGE',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTemplate" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(60) NOT NULL,
    "body" TEXT NOT NULL,
    "category" "SupportCategory",
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportMessage_inquiryId_createdAt_idx" ON "SupportMessage"("inquiryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportInquiry_guestToken_key" ON "SupportInquiry"("guestToken");

-- CreateIndex
CREATE INDEX "SupportInquiry_status_createdAt_idx" ON "SupportInquiry"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "SupportInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 예전 문의: 답변이 있으면 답변 완료, 예전 단일 답변은 대화 기록으로 옮긴다
UPDATE "SupportInquiry" SET "status" = 'ANSWERED' WHERE "answeredAt" IS NOT NULL AND "status" = 'OPEN';
INSERT INTO "SupportMessage" ("id", "inquiryId", "author", "body", "createdAt")
SELECT 'legacy-' || "id", "id", 'ADMIN', "reply", COALESCE("answeredAt", "createdAt") FROM "SupportInquiry" WHERE "reply" IS NOT NULL AND "reply" <> ''
ON CONFLICT ("id") DO NOTHING;
