-- AlterTable
ALTER TABLE "LiveSession" ADD COLUMN     "isOrderSheet" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "externalOrderNo" TEXT,
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "sheetMemo" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'LIVE';

-- AlterTable
ALTER TABLE "PlatformPolicy" ADD COLUMN     "sheetShippingFee" INTEGER NOT NULL DEFAULT 3000;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "livePlatformEtc" TEXT,
ADD COLUMN     "livePlatforms" TEXT[] DEFAULT ARRAY[]::TEXT[];

