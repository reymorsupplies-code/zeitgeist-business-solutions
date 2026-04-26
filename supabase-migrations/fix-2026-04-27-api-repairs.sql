-- Fix LegalNotice: make leaseId, propertyId, unitId nullable
ALTER TABLE "LegalNotice" ALTER COLUMN "leaseId" DROP NOT NULL;
ALTER TABLE "LegalNotice" ALTER COLUMN "propertyId" DROP NOT NULL;
ALTER TABLE "LegalNotice" ALTER COLUMN "unitId" DROP NOT NULL;
