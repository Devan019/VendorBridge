-- ─── RFQ Enhancements Migration ───────────────────────────────────────────────
-- Adds: RFQStatus enum, RFQ_Attachment table, reference_number + timestamps on
-- RFQ, description + unit_price on RFQ_Item, and Cascade FK constraints.

-- CreateEnum
CREATE TYPE "RFQStatus" AS ENUM ('DRAFT', 'SENT', 'CLOSED');

-- AlterTable RFQ: add new columns (nullable first so existing rows are safe)
ALTER TABLE "RFQ" ADD COLUMN "reference_number" TEXT;
ALTER TABLE "RFQ" ADD COLUMN "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "RFQ" ADD COLUMN "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Back-fill reference_number for any pre-existing rows (none expected in dev)
UPDATE "RFQ"
SET "reference_number" = 'RFQ-LEGACY-' || UPPER(SUBSTRING(id::TEXT, 1, 8))
WHERE "reference_number" IS NULL;

-- Now enforce NOT NULL + unique
ALTER TABLE "RFQ" ALTER COLUMN "reference_number" SET NOT NULL;
CREATE UNIQUE INDEX "RFQ_reference_number_key" ON "RFQ"("reference_number");

-- Change status from plain Text to the RFQStatus enum with a default
ALTER TABLE "RFQ"
  ALTER COLUMN "status" TYPE "RFQStatus"
    USING (COALESCE(NULLIF("status", ''), 'DRAFT')::"RFQStatus"),
  ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"RFQStatus",
  ALTER COLUMN "status" SET NOT NULL;

-- AlterTable RFQ_Item: drop old FK (no cascade), add columns, re-add FK with Cascade
ALTER TABLE "RFQ_Item" DROP CONSTRAINT IF EXISTS "RFQ_Item_rfq_id_fkey";
ALTER TABLE "RFQ_Item" ADD COLUMN "description" TEXT;
ALTER TABLE "RFQ_Item" ADD COLUMN "unit_price"  DECIMAL(65, 30);
ALTER TABLE "RFQ_Item"
  ADD CONSTRAINT "RFQ_Item_rfq_id_fkey"
  FOREIGN KEY ("rfq_id") REFERENCES "RFQ"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable RFQ_Vendor: drop old FK (no cascade), re-add with Cascade
ALTER TABLE "RFQ_Vendor" DROP CONSTRAINT IF EXISTS "RFQ_Vendor_rfq_id_fkey";
ALTER TABLE "RFQ_Vendor"
  ADD CONSTRAINT "RFQ_Vendor_rfq_id_fkey"
  FOREIGN KEY ("rfq_id") REFERENCES "RFQ"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable RFQ_Attachment
CREATE TABLE "RFQ_Attachment" (
    "id"            TEXT         NOT NULL,
    "rfq_id"        TEXT         NOT NULL,
    "filename"      TEXT         NOT NULL,
    "original_name" TEXT         NOT NULL,
    "mime_type"     TEXT         NOT NULL,
    "size_bytes"    INTEGER      NOT NULL,
    "path"          TEXT         NOT NULL,
    "uploaded_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RFQ_Attachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey on RFQ_Attachment
ALTER TABLE "RFQ_Attachment"
  ADD CONSTRAINT "RFQ_Attachment_rfq_id_fkey"
  FOREIGN KEY ("rfq_id") REFERENCES "RFQ"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
