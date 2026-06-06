/*
  Warnings:

  - You are about to drop the column `created_at` on the `RFQ` table. All the data in the column will be lost.
  - You are about to drop the column `reference_number` on the `RFQ` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `RFQ` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - Changed the type of `status` on the `RFQ` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `first_name` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `User` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `role` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER', 'VENDOR');

-- DropIndex
DROP INDEX "RFQ_reference_number_key";

-- AlterTable
ALTER TABLE "Quotation" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RFQ" DROP COLUMN "created_at",
DROP COLUMN "reference_number",
DROP COLUMN "updated_at",
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
ADD COLUMN     "country" TEXT,
ADD COLUMN     "first_name" TEXT NOT NULL,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "last_name" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT,
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL;
