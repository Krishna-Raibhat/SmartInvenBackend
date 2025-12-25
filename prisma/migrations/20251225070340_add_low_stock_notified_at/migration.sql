/*
  Warnings:

  - You are about to alter the column `cp` on the `hardware_stock_lots` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `sp` on the `hardware_stock_lots` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `total_amount` on the `hardware_stock_out` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `paid_amount` on the `hardware_stock_out` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `cp` on the `hardware_stock_out_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `sp` on the `hardware_stock_out_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `line_total` on the `hardware_stock_out_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "hardware_products" ADD COLUMN     "last_low_stock_notified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "hardware_stock_lots" ALTER COLUMN "cp" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "sp" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "hardware_stock_out" ALTER COLUMN "total_amount" DROP DEFAULT,
ALTER COLUMN "total_amount" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "paid_amount" DROP DEFAULT,
ALTER COLUMN "paid_amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "hardware_stock_out_items" ALTER COLUMN "cp" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "sp" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "line_total" SET DATA TYPE DECIMAL(10,2);
