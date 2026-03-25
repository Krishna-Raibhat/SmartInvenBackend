/*
  Warnings:

  - A unique constraint covering the columns `[barcode]` on the table `clothing_stock_lots` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "clothing_stock_lots" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "barcode_image_url" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clothing_stock_lots_barcode_key" ON "clothing_stock_lots"("barcode");
