-- ─── Quotation Enhancements Migration ─────────────────────────────────────────
-- Adds: QuotationStatus enum, notes + updated_at on Quotation,
-- unique constraint [rfq_id, vendor_id], notes on Quotation_Item,
-- and Cascade delete on Quotation_Item.

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED');

-- AlterTable Quotation: add new columns
ALTER TABLE "Quotation" ADD COLUMN "notes"        TEXT;
ALTER TABLE "Quotation" ADD COLUMN "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Change status column from Text to QuotationStatus enum
ALTER TABLE "Quotation"
  ALTER COLUMN "status" TYPE "QuotationStatus"
    USING (COALESCE(NULLIF("status", ''), 'SUBMITTED')::"QuotationStatus"),
  ALTER COLUMN "status" SET DEFAULT 'SUBMITTED'::"QuotationStatus",
  ALTER COLUMN "status" SET NOT NULL;

-- Add unique constraint: one quotation per vendor per RFQ
CREATE UNIQUE INDEX "Quotation_rfq_id_vendor_id_key" ON "Quotation"("rfq_id", "vendor_id");

-- AlterTable Quotation_Item: drop old FK (no cascade), add notes, re-add FK with Cascade
ALTER TABLE "Quotation_Item" DROP CONSTRAINT IF EXISTS "Quotation_Item_quotation_id_fkey";
ALTER TABLE "Quotation_Item" ADD COLUMN "notes" TEXT;
ALTER TABLE "Quotation_Item"
  ADD CONSTRAINT "Quotation_Item_quotation_id_fkey"
  FOREIGN KEY ("quotation_id") REFERENCES "Quotation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
