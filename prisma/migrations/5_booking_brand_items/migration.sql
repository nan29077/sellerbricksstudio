-- AlterEnum
ALTER TYPE "BrandRequestKind" ADD VALUE 'DISPLAY';

-- CreateTable
CREATE TABLE "BookingBrandItem" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "brandProductId" TEXT NOT NULL,
    "sellerBrandProductId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "supplyPriceSnapshot" INTEGER NOT NULL DEFAULT 0,
    "optionLabel" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "brandRequestId" TEXT,
    "dueAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingBrandItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingBrandItem_brandRequestId_key" ON "BookingBrandItem"("brandRequestId");

-- CreateIndex
CREATE INDEX "BookingBrandItem_brandProductId_idx" ON "BookingBrandItem"("brandProductId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingBrandItem_bookingId_brandProductId_key" ON "BookingBrandItem"("bookingId", "brandProductId");

-- AddForeignKey
ALTER TABLE "BookingBrandItem" ADD CONSTRAINT "BookingBrandItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingBrandItem" ADD CONSTRAINT "BookingBrandItem_brandProductId_fkey" FOREIGN KEY ("brandProductId") REFERENCES "BrandProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingBrandItem" ADD CONSTRAINT "BookingBrandItem_brandRequestId_fkey" FOREIGN KEY ("brandRequestId") REFERENCES "BrandRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

