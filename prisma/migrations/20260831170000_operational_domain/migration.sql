CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'COMPANY');
CREATE TYPE "CustomerAddressType" AS ENUM ('BILLING', 'OPERATIONAL', 'DELIVERY', 'OTHER');
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED');
CREATE TYPE "ResourceOperationalStatus" AS ENUM ('AVAILABLE', 'MAINTENANCE', 'UNAVAILABLE', 'RETIRED');

CREATE TABLE "Unit" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "phone" TEXT,
  "email" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "state" TEXT,
  "postalCode" TEXT,
  "country" TEXT NOT NULL DEFAULT 'BR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Customer" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "type" "CustomerType" NOT NULL,
  "legalName" TEXT NOT NULL,
  "tradeName" TEXT,
  "document" TEXT,
  "normalizedDocument" TEXT,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "email" TEXT,
  "phone" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerContact" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "title" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "whatsapp" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerAddress" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "type" "CustomerAddressType" NOT NULL,
  "label" TEXT,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'BR',
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contract" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contract_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Contract_valid_period_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate")
);

CREATE TABLE "ContractUnit" (
  "tenantId" UUID NOT NULL,
  "contractId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractUnit_pkey" PRIMARY KEY ("contractId", "unitId")
);

CREATE TABLE "ResourceCategory" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResourceCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Resource" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "serialNumber" TEXT,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "operationalStatus" "ResourceOperationalStatus" NOT NULL DEFAULT 'AVAILABLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Unit_tenantId_code_key" ON "Unit"("tenantId", "code");
CREATE UNIQUE INDEX "Unit_tenantId_id_key" ON "Unit"("tenantId", "id");
CREATE INDEX "Unit_tenantId_status_idx" ON "Unit"("tenantId", "status");
CREATE UNIQUE INDEX "Customer_tenantId_normalizedDocument_key" ON "Customer"("tenantId", "normalizedDocument");
CREATE UNIQUE INDEX "Customer_tenantId_id_key" ON "Customer"("tenantId", "id");
CREATE INDEX "Customer_tenantId_status_idx" ON "Customer"("tenantId", "status");
CREATE INDEX "Customer_tenantId_legalName_idx" ON "Customer"("tenantId", "legalName");
CREATE INDEX "CustomerContact_tenantId_customerId_status_idx" ON "CustomerContact"("tenantId", "customerId", "status");
CREATE INDEX "CustomerAddress_tenantId_customerId_status_idx" ON "CustomerAddress"("tenantId", "customerId", "status");
CREATE UNIQUE INDEX "Contract_tenantId_code_key" ON "Contract"("tenantId", "code");
CREATE UNIQUE INDEX "Contract_tenantId_id_key" ON "Contract"("tenantId", "id");
CREATE INDEX "Contract_tenantId_status_idx" ON "Contract"("tenantId", "status");
CREATE INDEX "Contract_tenantId_customerId_idx" ON "Contract"("tenantId", "customerId");
CREATE INDEX "ContractUnit_tenantId_unitId_idx" ON "ContractUnit"("tenantId", "unitId");
CREATE UNIQUE INDEX "ResourceCategory_tenantId_code_key" ON "ResourceCategory"("tenantId", "code");
CREATE UNIQUE INDEX "ResourceCategory_tenantId_id_key" ON "ResourceCategory"("tenantId", "id");
CREATE INDEX "ResourceCategory_tenantId_status_idx" ON "ResourceCategory"("tenantId", "status");
CREATE UNIQUE INDEX "Resource_tenantId_code_key" ON "Resource"("tenantId", "code");
CREATE UNIQUE INDEX "Resource_tenantId_id_key" ON "Resource"("tenantId", "id");
CREATE INDEX "Resource_tenantId_status_operationalStatus_idx" ON "Resource"("tenantId", "status", "operationalStatus");
CREATE INDEX "Resource_tenantId_unitId_idx" ON "Resource"("tenantId", "unitId");
CREATE INDEX "Resource_tenantId_categoryId_idx" ON "Resource"("tenantId", "categoryId");

ALTER TABLE "Unit" ADD CONSTRAINT "Unit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractUnit" ADD CONSTRAINT "ContractUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContractUnit" ADD CONSTRAINT "ContractUnit_tenantId_contractId_fkey" FOREIGN KEY ("tenantId", "contractId") REFERENCES "Contract"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractUnit" ADD CONSTRAINT "ContractUnit_tenantId_unitId_fkey" FOREIGN KEY ("tenantId", "unitId") REFERENCES "Unit"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResourceCategory" ADD CONSTRAINT "ResourceCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_tenantId_unitId_fkey" FOREIGN KEY ("tenantId", "unitId") REFERENCES "Unit"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_tenantId_categoryId_fkey" FOREIGN KEY ("tenantId", "categoryId") REFERENCES "ResourceCategory"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
