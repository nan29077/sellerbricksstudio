-- CreateTable
CREATE TABLE "ExternalBroadcast" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL DEFAULT 'ETC',
    "url" TEXT NOT NULL,
    "embedUrl" TEXT,
    "hlsUrl" TEXT,
    "thumbnailUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LIVE',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalBroadcast_status_isVisible_idx" ON "ExternalBroadcast"("status", "isVisible");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalBroadcast_source_externalId_key" ON "ExternalBroadcast"("source", "externalId");

