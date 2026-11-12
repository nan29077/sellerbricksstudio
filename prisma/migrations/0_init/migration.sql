-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'MANAGER', 'FACILITY_ADMIN', 'BRAND_ADMIN', 'SELLER', 'BUYER');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('WAREHOUSE', 'STUDIO');

-- CreateEnum
CREATE TYPE "FacilityStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('CATALOG', 'AD_HOC', 'TEMP_PRODUCT');

-- CreateEnum
CREATE TYPE "LiveStatus" AS ENUM ('DRAFT', 'READY', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SnsChannelType" AS ENUM ('YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'ETC', 'CATENOID');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('ORDER_CREATED', 'PAYMENT_PENDING', 'PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('READY', 'IN_PROGRESS', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'EASY_PAY', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAID');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "FulfillmentMode" AS ENUM ('DROPSHIP', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('NEW', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "BrandShopStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BrandRequestKind" AS ENUM ('SUPPLY', 'SAMPLE');

-- CreateEnum
CREATE TYPE "BrandRequestStatus" AS ENUM ('PENDING', 'AWAITING_PAYMENT', 'APPROVED', 'SHIPPED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('ACCOUNT', 'SPACE_BOOKING', 'LIVE', 'ORDER_PAYMENT', 'SETTLEMENT', 'PARTNERSHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderClaimType" AS ENUM ('CANCEL', 'RETURN', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "OrderClaimStatus" AS ENUM ('REQUESTED', 'RESOLVED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SELLER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "profileImageIndex" INTEGER,
    "lastLoginAt" TIMESTAMP(3),
    "adminMemo" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "termsAgreedAt" TIMESTAMP(3),
    "privacyAgreedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandShop" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "bannerUrl" TEXT NOT NULL DEFAULT '',
    "backgroundUrl" TEXT NOT NULL DEFAULT '',
    "paymentInstructions" TEXT NOT NULL DEFAULT '',
    "status" "BrandShopStatus" NOT NULL DEFAULT 'PENDING',
    "moderationNote" TEXT NOT NULL DEFAULT '',
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "businessNumber" TEXT NOT NULL DEFAULT '',
    "ceoName" TEXT NOT NULL DEFAULT '',
    "csPhone" TEXT NOT NULL DEFAULT '',
    "returnAddress" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "bankAccount" TEXT NOT NULL DEFAULT '',
    "accountHolder" TEXT NOT NULL DEFAULT '',
    "feeRate" DOUBLE PRECISION,
    "requireSellerApproval" BOOLEAN NOT NULL DEFAULT false,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "bankChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandShop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandProduct" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "supplyPrice" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    "samplePrice" INTEGER,
    "sampleStock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subCategory" TEXT NOT NULL DEFAULT '',
    "sku" TEXT NOT NULL DEFAULT '',
    "consumerPrice" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "options" TEXT NOT NULL DEFAULT '',
    "allowDropship" BOOLEAN NOT NULL DEFAULT true,
    "allowWarehouse" BOOLEAN NOT NULL DEFAULT true,
    "shippingFee" INTEGER NOT NULL DEFAULT 0,
    "leadDays" INTEGER NOT NULL DEFAULT 2,
    "sampleLimitPerBuyer" INTEGER NOT NULL DEFAULT 1,
    "minSalePrice" INTEGER,
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "volume" TEXT NOT NULL DEFAULT '',
    "expiryInfo" TEXT NOT NULL DEFAULT '',
    "ingredients" TEXT NOT NULL DEFAULT '',
    "certification" TEXT NOT NULL DEFAULT '',
    "lowStockNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandRequest" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "kind" "BrandRequestKind" NOT NULL,
    "status" "BrandRequestStatus" NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "recipient" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "paymentInstructions" TEXT NOT NULL DEFAULT '',
    "trackingNumber" TEXT NOT NULL DEFAULT '',
    "carrier" TEXT NOT NULL DEFAULT '',
    "rejectReason" TEXT NOT NULL DEFAULT '',
    "facilityProductId" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'NONE',
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "pgTransactionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "brandSettlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportInquiry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "SupportCategory" NOT NULL,
    "subject" VARCHAR(100) NOT NULL,
    "message" TEXT NOT NULL,
    "reference" VARCHAR(100),
    "reply" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "companyName" TEXT,
    "businessNumber" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avatarUrl" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "accountHolder" TEXT,
    "bankChangedAt" TIMESTAMP(3),
    "snsLinks" JSONB,
    "notifyPrefs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FacilityType" NOT NULL,
    "status" "FacilityStatus" NOT NULL DEFAULT 'PENDING',
    "region" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "description" TEXT,
    "equipment" TEXT,
    "specialty" TEXT,
    "liveSpaceInfo" TEXT,
    "openTime" TEXT,
    "closeTime" TEXT,
    "basePrice" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thumbnailUrl" TEXT,
    "contactPhone" TEXT,
    "capacity" INTEGER,
    "minHours" INTEGER NOT NULL DEFAULT 1,
    "cancelPolicy" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "accountHolder" TEXT,
    "bookingUnitMinutes" INTEGER NOT NULL DEFAULT 60,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "minLeadHours" INTEGER NOT NULL DEFAULT 0,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "maxHours" INTEGER NOT NULL DEFAULT 12,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "cancelDeadlineHours" INTEGER NOT NULL DEFAULT 24,
    "bookingNotice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityInquiry" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityImage" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FacilityImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityAvailableSlot" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FacilityAvailableSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityBlackoutDate" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "FacilityBlackoutDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityTimeBlock" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacilityTimeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerFacility" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "extraPrice" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityProduct" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "salePrice" INTEGER NOT NULL,
    "consumerPrice" INTEGER NOT NULL,
    "supplyPrice" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "shippingInfo" TEXT,
    "commissionType" "CommissionType" NOT NULL DEFAULT 'PERCENT',
    "commissionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isSellable" BOOLEAN NOT NULL DEFAULT true,
    "source" "ProductSource" NOT NULL DEFAULT 'CATALOG',
    "brandProductId" TEXT,
    "fulfillment" "FulfillmentMode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT,
    "expectedProducts" TEXT,
    "rejectReason" TEXT,
    "totalPrice" INTEGER NOT NULL DEFAULT 0,
    "code" TEXT,
    "groupId" TEXT,
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "headcount" INTEGER,
    "requestNote" TEXT,
    "facilityMemo" TEXT,
    "cancelReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "noShowAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "facilitySettlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bookingId" TEXT,
    "sellerId" TEXT NOT NULL,
    "facilityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "LiveStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "selfStreamUrl" TEXT,
    "buyerLinkUrl" TEXT,
    "catenoidStreamId" TEXT,
    "catenoidPlaybackUrl" TEXT,
    "alimtalkStatus" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "numberVersion" INTEGER NOT NULL DEFAULT 0,
    "endedAt" TIMESTAMP(3),
    "shippingFee" INTEGER NOT NULL DEFAULT 0,
    "freeShippingOver" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSessionProduct" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "facilityProductId" TEXT,
    "displayNumber" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "nameSnapshot" TEXT NOT NULL,
    "priceSnapshot" INTEGER NOT NULL,
    "stockSnapshot" INTEGER NOT NULL DEFAULT 0,
    "imageSnapshot" TEXT,
    "optionSnapshot" TEXT,
    "source" "ProductSource" NOT NULL DEFAULT 'CATALOG',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "brandProductId" TEXT,
    "fulfillment" "FulfillmentMode",
    "supplyPriceSnapshot" INTEGER,
    "facilitySupplySnapshot" INTEGER,
    "commissionTypeSnapshot" "CommissionType",
    "commissionValueSnapshot" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSessionProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveProductNumberHistory" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "liveSessionProductId" TEXT NOT NULL,
    "oldNumber" INTEGER,
    "newNumber" INTEGER NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveProductNumberHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "facilityId" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerPhone" TEXT NOT NULL,
    "buyerAddress" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'ORDER_CREATED',
    "totalAmount" INTEGER NOT NULL,
    "shippingFee" INTEGER NOT NULL DEFAULT 0,
    "shipCarrier" TEXT,
    "shipTrackingNumber" TEXT,
    "localShippedAt" TIMESTAMP(3),
    "localDeliveredAt" TIMESTAMP(3),
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "couponId" TEXT,
    "couponCode" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "privacyAgreedAt" TIMESTAMP(3),
    "settlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderClaim" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "OrderClaimType" NOT NULL,
    "status" "OrderClaimStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "answer" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "liveSessionProductId" TEXT NOT NULL,
    "displayNumber" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "optionLabel" TEXT,
    "lineTotal" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "platformFee" INTEGER,
    "brandAmount" INTEGER,
    "facilityAmount" INTEGER,
    "sellerAmount" INTEGER,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'READY',
    "amount" INTEGER NOT NULL,
    "pgTransactionId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "eventKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "facilityId" TEXT,
    "commissionType" "CommissionType" NOT NULL DEFAULT 'PERCENT',
    "commissionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerCommissionRule" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "commissionType" "CommissionType" NOT NULL DEFAULT 'PERCENT',
    "commissionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerCommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "facilityId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "facilityAmount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL DEFAULT 0,
    "brandAmount" INTEGER NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "adjustmentCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KakaoChannel" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "plusFriendId" TEXT,
    "senderKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KakaoChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KakaoSubscriber" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KakaoSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT,
    "channelId" TEXT,
    "templateCode" TEXT,
    "recipient" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamChannel" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "type" "SnsChannelType" NOT NULL,
    "url" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatenoidStreamLog" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatenoidStreamLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "FacilityReview" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacilityFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilitySettlement" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "bookingCount" INTEGER NOT NULL DEFAULT 0,
    "grossAmount" INTEGER NOT NULL,
    "feeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformFee" INTEGER NOT NULL,
    "payoutAmount" INTEGER NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilitySettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingApplication" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "budget" INTEGER,
    "desiredAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerPromotion" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "channel" TEXT,
    "discountType" "CommissionType" NOT NULL DEFAULT 'PERCENT',
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "targetAmount" INTEGER,
    "resultAmount" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerCoupon" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "CommissionType" NOT NULL DEFAULT 'PERCENT',
    "discountValue" DOUBLE PRECISION NOT NULL,
    "minAmount" INTEGER NOT NULL DEFAULT 0,
    "maxDiscount" INTEGER,
    "totalQty" INTEGER,
    "usedQty" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAsset" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "content" TEXT,
    "channel" TEXT,
    "tags" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnsAccount" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "url" TEXT,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SnsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnsPost" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "memo" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "url" TEXT,
    "views" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "clicks" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SnsPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingProduct" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "facilityProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "nameSnapshot" TEXT NOT NULL,
    "priceSnapshot" INTEGER NOT NULL,
    "commissionType" "CommissionType" NOT NULL DEFAULT 'PERCENT',
    "commissionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "facilityNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingWaitlist" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerBrandProduct" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "brandProductId" TEXT NOT NULL,
    "salePrice" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerBrandProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNo" TEXT NOT NULL,
    "brandShopId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "facilityId" TEXT,
    "sellerId" TEXT NOT NULL,
    "fulfillment" "FulfillmentMode" NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'NEW',
    "recipient" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "saleAmount" INTEGER NOT NULL,
    "supplyAmount" INTEGER NOT NULL,
    "carrier" TEXT NOT NULL DEFAULT '',
    "trackingNumber" TEXT NOT NULL DEFAULT '',
    "brandMemo" TEXT NOT NULL DEFAULT '',
    "adminMemo" TEXT NOT NULL DEFAULT '',
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "cancelRequestedAt" TIMESTAMP(3),
    "cancelRequestReason" TEXT NOT NULL DEFAULT '',
    "returnReceivedAt" TIMESTAMP(3),
    "exchangeCarrier" TEXT NOT NULL DEFAULT '',
    "exchangeTrackingNumber" TEXT NOT NULL DEFAULT '',
    "exchangeShippedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "brandSettlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "brandProductId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "optionLabel" TEXT,
    "quantity" INTEGER NOT NULL,
    "supplyPrice" INTEGER NOT NULL,
    "salePrice" INTEGER NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandSettlement" (
    "id" TEXT NOT NULL,
    "brandShopId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "poCount" INTEGER NOT NULL DEFAULT 0,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "supplyAmount" INTEGER NOT NULL DEFAULT 0,
    "sampleAmount" INTEGER NOT NULL DEFAULT 0,
    "grossAmount" INTEGER NOT NULL DEFAULT 0,
    "feeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformFee" INTEGER NOT NULL DEFAULT 0,
    "adjustment" INTEGER NOT NULL DEFAULT 0,
    "autoAdjustment" INTEGER NOT NULL DEFAULT 0,
    "payoutAmount" INTEGER NOT NULL DEFAULT 0,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformPolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "salesFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "brandFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "sampleFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellerShareRate" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "pendingExpireHours" INTEGER NOT NULL DEFAULT 48,
    "noShowGraceMinutes" INTEGER NOT NULL DEFAULT 30,
    "autoCompleteBookings" BOOLEAN NOT NULL DEFAULT true,
    "reminderHoursBefore" INTEGER NOT NULL DEFAULT 24,
    "poConfirmHours" INTEGER NOT NULL DEFAULT 24,
    "sampleMaxPerOrder" INTEGER NOT NULL DEFAULT 20,
    "orderAfterEndHours" INTEGER NOT NULL DEFAULT 0,
    "liveAutoEndHours" INTEGER NOT NULL DEFAULT 2,
    "settleAfterDays" INTEGER NOT NULL DEFAULT 7,
    "piiRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "requireEmailVerify" BOOLEAN NOT NULL DEFAULT false,
    "maxPendingBookings" INTEGER NOT NULL DEFAULT 10,
    "requestReplyHours" INTEGER NOT NULL DEFAULT 72,
    "requestAutoRejectHours" INTEGER NOT NULL DEFAULT 72,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "BrandMember" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandPartner" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandThread" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brandUnread" INTEGER NOT NULL DEFAULT 0,
    "partnerUnread" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandSettlementAdjustment" (
    "id" TEXT NOT NULL,
    "brandShopId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "settlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandSettlementAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesAdjustment" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "facilityId" TEXT,
    "orderId" TEXT NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "sellerAmount" INTEGER NOT NULL,
    "facilityAmount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL,
    "brandAmount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "settlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandProductFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandProductId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandProductFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteNotice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BrandShop_ownerId_key" ON "BrandShop"("ownerId");

-- CreateIndex
CREATE INDEX "BrandShop_status_createdAt_idx" ON "BrandShop"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BrandProduct_shopId_isActive_idx" ON "BrandProduct"("shopId", "isActive");

-- CreateIndex
CREATE INDEX "BrandRequest_brandSettlementId_idx" ON "BrandRequest"("brandSettlementId");

-- CreateIndex
CREATE INDEX "BrandRequest_buyerId_createdAt_idx" ON "BrandRequest"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "BrandRequest_productId_status_idx" ON "BrandRequest"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BrandRequest_buyerId_requestKey_key" ON "BrandRequest"("buyerId", "requestKey");

-- CreateIndex
CREATE INDEX "SupportInquiry_userId_createdAt_idx" ON "SupportInquiry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportInquiry_answeredAt_createdAt_idx" ON "SupportInquiry"("answeredAt", "createdAt");

-- CreateIndex
CREATE INDEX "SupportInquiry_category_createdAt_idx" ON "SupportInquiry"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Facility_region_idx" ON "Facility"("region");

-- CreateIndex
CREATE INDEX "Facility_type_idx" ON "Facility"("type");

-- CreateIndex
CREATE INDEX "Facility_status_idx" ON "Facility"("status");

-- CreateIndex
CREATE INDEX "FacilityInquiry_facilityId_idx" ON "FacilityInquiry"("facilityId");

-- CreateIndex
CREATE INDEX "FacilityInquiry_sellerId_idx" ON "FacilityInquiry"("sellerId");

-- CreateIndex
CREATE INDEX "FacilityAvailableSlot_facilityId_idx" ON "FacilityAvailableSlot"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityBlackoutDate_facilityId_date_key" ON "FacilityBlackoutDate"("facilityId", "date");

-- CreateIndex
CREATE INDEX "FacilityTimeBlock_facilityId_startAt_idx" ON "FacilityTimeBlock"("facilityId", "startAt");

-- CreateIndex
CREATE INDEX "ManagerFacility_facilityId_idx" ON "ManagerFacility"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerFacility_managerId_facilityId_key" ON "ManagerFacility"("managerId", "facilityId");

-- CreateIndex
CREATE INDEX "FacilityProduct_facilityId_idx" ON "FacilityProduct"("facilityId");

-- CreateIndex
CREATE INDEX "FacilityProduct_brandProductId_idx" ON "FacilityProduct"("brandProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_code_key" ON "Booking"("code");

-- CreateIndex
CREATE INDEX "Booking_facilityId_startAt_idx" ON "Booking"("facilityId", "startAt");

-- CreateIndex
CREATE INDEX "Booking_groupId_idx" ON "Booking"("groupId");

-- CreateIndex
CREATE INDEX "Booking_sellerId_idx" ON "Booking"("sellerId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_facilitySettlementId_idx" ON "Booking"("facilitySettlementId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_slug_key" ON "LiveSession"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_bookingId_key" ON "LiveSession"("bookingId");

-- CreateIndex
CREATE INDEX "LiveSession_sellerId_idx" ON "LiveSession"("sellerId");

-- CreateIndex
CREATE INDEX "LiveSession_facilityId_idx" ON "LiveSession"("facilityId");

-- CreateIndex
CREATE INDEX "LiveSessionProduct_liveSessionId_idx" ON "LiveSessionProduct"("liveSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSessionProduct_liveSessionId_displayNumber_key" ON "LiveSessionProduct"("liveSessionId", "displayNumber");

-- CreateIndex
CREATE INDEX "LiveProductNumberHistory_liveSessionId_idx" ON "LiveProductNumberHistory"("liveSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNo_key" ON "Order"("orderNo");

-- CreateIndex
CREATE INDEX "Order_liveSessionId_idx" ON "Order"("liveSessionId");

-- CreateIndex
CREATE INDEX "Order_sellerId_idx" ON "Order"("sellerId");

-- CreateIndex
CREATE INDEX "Order_facilityId_idx" ON "Order"("facilityId");

-- CreateIndex
CREATE INDEX "Order_settlementId_idx" ON "Order"("settlementId");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "OrderClaim_orderId_idx" ON "OrderClaim"("orderId");

-- CreateIndex
CREATE INDEX "OrderClaim_status_idx" ON "OrderClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_eventKey_key" ON "PaymentEvent"("eventKey");

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentId_idx" ON "PaymentEvent"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerCommissionRule_managerId_key" ON "ManagerCommissionRule"("managerId");

-- CreateIndex
CREATE INDEX "Settlement_sellerId_idx" ON "Settlement"("sellerId");

-- CreateIndex
CREATE INDEX "Settlement_facilityId_idx" ON "Settlement"("facilityId");

-- CreateIndex
CREATE INDEX "KakaoChannel_sellerId_idx" ON "KakaoChannel"("sellerId");

-- CreateIndex
CREATE INDEX "KakaoSubscriber_channelId_idx" ON "KakaoSubscriber"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_code_key" ON "NotificationTemplate"("code");

-- CreateIndex
CREATE INDEX "NotificationLog_liveSessionId_idx" ON "NotificationLog"("liveSessionId");

-- CreateIndex
CREATE INDEX "StreamChannel_liveSessionId_idx" ON "StreamChannel"("liveSessionId");

-- CreateIndex
CREATE INDEX "CatenoidStreamLog_liveSessionId_idx" ON "CatenoidStreamLog"("liveSessionId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityReview_bookingId_key" ON "FacilityReview"("bookingId");

-- CreateIndex
CREATE INDEX "FacilityReview_facilityId_idx" ON "FacilityReview"("facilityId");

-- CreateIndex
CREATE INDEX "FacilityReview_sellerId_idx" ON "FacilityReview"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityFavorite_userId_facilityId_key" ON "FacilityFavorite"("userId", "facilityId");

-- CreateIndex
CREATE INDEX "FacilitySettlement_facilityId_idx" ON "FacilitySettlement"("facilityId");

-- CreateIndex
CREATE INDEX "FacilitySettlement_status_idx" ON "FacilitySettlement"("status");

-- CreateIndex
CREATE INDEX "UserNotification_userId_isRead_idx" ON "UserNotification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "MarketingApplication_sellerId_idx" ON "MarketingApplication"("sellerId");

-- CreateIndex
CREATE INDEX "MarketingApplication_status_idx" ON "MarketingApplication"("status");

-- CreateIndex
CREATE INDEX "SellerPromotion_sellerId_idx" ON "SellerPromotion"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerCoupon_code_key" ON "SellerCoupon"("code");

-- CreateIndex
CREATE INDEX "SellerCoupon_sellerId_idx" ON "SellerCoupon"("sellerId");

-- CreateIndex
CREATE INDEX "MarketingAsset_sellerId_idx" ON "MarketingAsset"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "SnsAccount_sellerId_platform_handle_key" ON "SnsAccount"("sellerId", "platform", "handle");

-- CreateIndex
CREATE INDEX "SnsPost_sellerId_scheduledAt_idx" ON "SnsPost"("sellerId", "scheduledAt");

-- CreateIndex
CREATE INDEX "BookingProduct_facilityProductId_idx" ON "BookingProduct"("facilityProductId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingProduct_bookingId_facilityProductId_key" ON "BookingProduct"("bookingId", "facilityProductId");

-- CreateIndex
CREATE INDEX "BookingWaitlist_facilityId_startAt_idx" ON "BookingWaitlist"("facilityId", "startAt");

-- CreateIndex
CREATE INDEX "BookingWaitlist_sellerId_status_idx" ON "BookingWaitlist"("sellerId", "status");

-- CreateIndex
CREATE INDEX "SellerBrandProduct_brandProductId_idx" ON "SellerBrandProduct"("brandProductId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerBrandProduct_sellerId_brandProductId_key" ON "SellerBrandProduct"("sellerId", "brandProductId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNo_key" ON "PurchaseOrder"("poNo");

-- CreateIndex
CREATE INDEX "PurchaseOrder_brandShopId_status_createdAt_idx" ON "PurchaseOrder"("brandShopId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_createdAt_idx" ON "PurchaseOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_brandSettlementId_idx" ON "PurchaseOrder"("brandSettlementId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_orderId_brandShopId_fulfillment_key" ON "PurchaseOrder"("orderId", "brandShopId", "fulfillment");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_brandProductId_idx" ON "PurchaseOrderItem"("brandProductId");

-- CreateIndex
CREATE INDEX "BrandSettlement_brandShopId_idx" ON "BrandSettlement"("brandShopId");

-- CreateIndex
CREATE INDEX "BrandSettlement_status_idx" ON "BrandSettlement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "BrandMember_userId_key" ON "BrandMember"("userId");

-- CreateIndex
CREATE INDEX "BrandMember_shopId_idx" ON "BrandMember"("shopId");

-- CreateIndex
CREATE INDEX "BrandPartner_userId_idx" ON "BrandPartner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandPartner_shopId_userId_key" ON "BrandPartner"("shopId", "userId");

-- CreateIndex
CREATE INDEX "BrandThread_partnerId_idx" ON "BrandThread"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandThread_shopId_partnerId_key" ON "BrandThread"("shopId", "partnerId");

-- CreateIndex
CREATE INDEX "BrandMessage_threadId_createdAt_idx" ON "BrandMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "BrandSettlementAdjustment_brandShopId_settlementId_idx" ON "BrandSettlementAdjustment"("brandShopId", "settlementId");

-- CreateIndex
CREATE INDEX "SalesAdjustment_sellerId_facilityId_settlementId_idx" ON "SalesAdjustment"("sellerId", "facilityId", "settlementId");

-- CreateIndex
CREATE INDEX "BrandProductFavorite_brandProductId_idx" ON "BrandProductFavorite"("brandProductId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProductFavorite_userId_brandProductId_key" ON "BrandProductFavorite"("userId", "brandProductId");

-- CreateIndex
CREATE INDEX "SiteNotice_isPublished_createdAt_idx" ON "SiteNotice"("isPublished", "createdAt");

-- AddForeignKey
ALTER TABLE "BrandShop" ADD CONSTRAINT "BrandShop_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProduct" ADD CONSTRAINT "BrandProduct_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "BrandShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRequest" ADD CONSTRAINT "BrandRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BrandProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRequest" ADD CONSTRAINT "BrandRequest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRequest" ADD CONSTRAINT "BrandRequest_brandSettlementId_fkey" FOREIGN KEY ("brandSettlementId") REFERENCES "BrandSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportInquiry" ADD CONSTRAINT "SupportInquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityInquiry" ADD CONSTRAINT "FacilityInquiry_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityInquiry" ADD CONSTRAINT "FacilityInquiry_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityImage" ADD CONSTRAINT "FacilityImage_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityAvailableSlot" ADD CONSTRAINT "FacilityAvailableSlot_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityBlackoutDate" ADD CONSTRAINT "FacilityBlackoutDate_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityTimeBlock" ADD CONSTRAINT "FacilityTimeBlock_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerFacility" ADD CONSTRAINT "ManagerFacility_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerFacility" ADD CONSTRAINT "ManagerFacility_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityProduct" ADD CONSTRAINT "FacilityProduct_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityProduct" ADD CONSTRAINT "FacilityProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityProduct" ADD CONSTRAINT "FacilityProduct_brandProductId_fkey" FOREIGN KEY ("brandProductId") REFERENCES "BrandProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_facilitySettlementId_fkey" FOREIGN KEY ("facilitySettlementId") REFERENCES "FacilitySettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionProduct" ADD CONSTRAINT "LiveSessionProduct_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionProduct" ADD CONSTRAINT "LiveSessionProduct_facilityProductId_fkey" FOREIGN KEY ("facilityProductId") REFERENCES "FacilityProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionProduct" ADD CONSTRAINT "LiveSessionProduct_brandProductId_fkey" FOREIGN KEY ("brandProductId") REFERENCES "BrandProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveProductNumberHistory" ADD CONSTRAINT "LiveProductNumberHistory_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderClaim" ADD CONSTRAINT "OrderClaim_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_liveSessionProductId_fkey" FOREIGN KEY ("liveSessionProductId") REFERENCES "LiveSessionProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerCommissionRule" ADD CONSTRAINT "ManagerCommissionRule_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KakaoChannel" ADD CONSTRAINT "KakaoChannel_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KakaoSubscriber" ADD CONSTRAINT "KakaoSubscriber_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "KakaoChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamChannel" ADD CONSTRAINT "StreamChannel_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatenoidStreamLog" ADD CONSTRAINT "CatenoidStreamLog_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityReview" ADD CONSTRAINT "FacilityReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityReview" ADD CONSTRAINT "FacilityReview_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityReview" ADD CONSTRAINT "FacilityReview_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityFavorite" ADD CONSTRAINT "FacilityFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityFavorite" ADD CONSTRAINT "FacilityFavorite_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilitySettlement" ADD CONSTRAINT "FacilitySettlement_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingApplication" ADD CONSTRAINT "MarketingApplication_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPromotion" ADD CONSTRAINT "SellerPromotion_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerCoupon" ADD CONSTRAINT "SellerCoupon_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAsset" ADD CONSTRAINT "MarketingAsset_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnsAccount" ADD CONSTRAINT "SnsAccount_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnsPost" ADD CONSTRAINT "SnsPost_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingProduct" ADD CONSTRAINT "BookingProduct_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingProduct" ADD CONSTRAINT "BookingProduct_facilityProductId_fkey" FOREIGN KEY ("facilityProductId") REFERENCES "FacilityProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingWaitlist" ADD CONSTRAINT "BookingWaitlist_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingWaitlist" ADD CONSTRAINT "BookingWaitlist_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerBrandProduct" ADD CONSTRAINT "SellerBrandProduct_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerBrandProduct" ADD CONSTRAINT "SellerBrandProduct_brandProductId_fkey" FOREIGN KEY ("brandProductId") REFERENCES "BrandProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_brandShopId_fkey" FOREIGN KEY ("brandShopId") REFERENCES "BrandShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_brandSettlementId_fkey" FOREIGN KEY ("brandSettlementId") REFERENCES "BrandSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_brandProductId_fkey" FOREIGN KEY ("brandProductId") REFERENCES "BrandProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSettlement" ADD CONSTRAINT "BrandSettlement_brandShopId_fkey" FOREIGN KEY ("brandShopId") REFERENCES "BrandShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMember" ADD CONSTRAINT "BrandMember_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "BrandShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMember" ADD CONSTRAINT "BrandMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandPartner" ADD CONSTRAINT "BrandPartner_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "BrandShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandPartner" ADD CONSTRAINT "BrandPartner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandThread" ADD CONSTRAINT "BrandThread_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "BrandShop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandThread" ADD CONSTRAINT "BrandThread_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMessage" ADD CONSTRAINT "BrandMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "BrandThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMessage" ADD CONSTRAINT "BrandMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSettlementAdjustment" ADD CONSTRAINT "BrandSettlementAdjustment_brandShopId_fkey" FOREIGN KEY ("brandShopId") REFERENCES "BrandShop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSettlementAdjustment" ADD CONSTRAINT "BrandSettlementAdjustment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSettlementAdjustment" ADD CONSTRAINT "BrandSettlementAdjustment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "BrandSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAdjustment" ADD CONSTRAINT "SalesAdjustment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProductFavorite" ADD CONSTRAINT "BrandProductFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProductFavorite" ADD CONSTRAINT "BrandProductFavorite_brandProductId_fkey" FOREIGN KEY ("brandProductId") REFERENCES "BrandProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

