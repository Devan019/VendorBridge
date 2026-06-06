/*
  Warnings:

  - The `status` column on the `Approval` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `total` on the `Invoice` table. All the data in the column will be lost.
  - The `status` column on the `Invoice` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `PurchaseOrder` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `RFQ` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[reference_number]` on the table `RFQ` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `created_by` to the `PurchaseOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `PurchaseOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vendor_id` to the `PurchaseOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reference_number` to the `RFQ` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `RFQ` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'REVIEWER';

-- DropForeignKey
ALTER TABLE "Approval" DROP CONSTRAINT "Approval_quotation_id_fkey";

-- AlterTable
ALTER TABLE "Approval" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "status",
ADD COLUMN     "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "decided_at" DROP NOT NULL,
ALTER COLUMN "decided_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "total",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "email_sent_at" TIMESTAMP(3),
ADD COLUMN     "grand_total" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "invoice_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "tax_amount" SET DEFAULT 0,
DROP COLUMN "status",
ADD COLUMN     "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "entity_id" TEXT,
ADD COLUMN     "entity_type" TEXT,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'INFO';

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "created_by" TEXT NOT NULL,
ADD COLUMN     "grand_total" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "gst_rate" DECIMAL(65,30) NOT NULL DEFAULT 18,
ADD COLUMN     "issued_at" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "tax_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "terms" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "vendor_id" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "POStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "RFQ" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "reference_number" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "RFQStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "name" TEXT NOT NULL,
ALTER COLUMN "first_name" SET DEFAULT '',
ALTER COLUMN "last_name" SET DEFAULT '',
ALTER COLUMN "role" SET DEFAULT 'VENDOR';

-- CreateTable
CREATE TABLE "PO_Item" (
    "id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price" DECIMAL(65,30) NOT NULL,
    "gst_rate" DECIMAL(65,30) NOT NULL DEFAULT 18,
    "tax_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "PO_Item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RFQ_reference_number_key" ON "RFQ"("reference_number");

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PO_Item" ADD CONSTRAINT "PO_Item_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
