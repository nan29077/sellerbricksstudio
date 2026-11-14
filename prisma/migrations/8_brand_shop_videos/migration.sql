-- CreateTable
CREATE TABLE "BrandShopVideo" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "duration" TEXT NOT NULL DEFAULT '',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandShopVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrandShopVideo_shopId_isVisible_sortOrder_idx" ON "BrandShopVideo"("shopId", "isVisible", "sortOrder");

-- AddForeignKey
ALTER TABLE "BrandShopVideo" ADD CONSTRAINT "BrandShopVideo_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "BrandShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

