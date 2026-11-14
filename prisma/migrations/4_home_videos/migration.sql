-- CreateTable
CREATE TABLE "HomeVideo" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'LIVE_COMMERCE',
    "title" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "duration" TEXT NOT NULL DEFAULT '',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeVideo_category_isVisible_sortOrder_idx" ON "HomeVideo"("category", "isVisible", "sortOrder");

