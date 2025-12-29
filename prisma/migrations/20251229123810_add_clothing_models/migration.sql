-- CreateTable
CREATE TABLE "customers" (
    "customer_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "clothing_categories" (
    "category_id" TEXT NOT NULL,
    "category_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clothing_categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "clothing_sizes" (
    "size_id" TEXT NOT NULL,
    "size_name" TEXT NOT NULL,

    CONSTRAINT "clothing_sizes_pkey" PRIMARY KEY ("size_id")
);

-- CreateTable
CREATE TABLE "clothing_colors" (
    "color_id" TEXT NOT NULL,
    "color_name" TEXT NOT NULL,

    CONSTRAINT "clothing_colors_pkey" PRIMARY KEY ("color_id")
);

-- CreateTable
CREATE TABLE "clothing_products" (
    "product_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clothing_products_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "clothing_suppliers" (
    "supplier_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clothing_suppliers_pkey" PRIMARY KEY ("supplier_id")
);

-- CreateTable
CREATE TABLE "clothing_stock_lots" (
    "lot_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "size_id" TEXT NOT NULL,
    "color_id" TEXT NOT NULL,
    "cp" DECIMAL(10,2) NOT NULL,
    "sp" DECIMAL(10,2) NOT NULL,
    "qty_in" INTEGER NOT NULL,
    "qty_remaining" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clothing_stock_lots_pkey" PRIMARY KEY ("lot_id")
);

-- CreateTable
CREATE TABLE "clothing_sales" (
    "sales_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "total_amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clothing_sales_pkey" PRIMARY KEY ("sales_id")
);

-- CreateTable
CREATE TABLE "clothing_sales_items" (
    "sales_item_id" TEXT NOT NULL,
    "sales_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "size_id" TEXT NOT NULL,
    "color_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "cp" DECIMAL(10,2) NOT NULL,
    "sp" DECIMAL(10,2) NOT NULL,
    "line_total" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clothing_sales_items_pkey" PRIMARY KEY ("sales_item_id")
);

-- CreateTable
CREATE TABLE "clothing_customer_returns" (
    "return_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "sales_id" TEXT,
    "refund_amount" DECIMAL(10,2),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clothing_customer_returns_pkey" PRIMARY KEY ("return_id")
);

-- CreateTable
CREATE TABLE "clothing_customer_return_items" (
    "return_item_id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "sales_item_id" TEXT,
    "lot_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'good',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clothing_customer_return_items_pkey" PRIMARY KEY ("return_item_id")
);

-- CreateTable
CREATE TABLE "clothing_supplier_returns" (
    "return_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clothing_supplier_returns_pkey" PRIMARY KEY ("return_id")
);

-- CreateTable
CREATE TABLE "clothing_supplier_return_items" (
    "return_item_id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clothing_supplier_return_items_pkey" PRIMARY KEY ("return_item_id")
);

-- CreateIndex
CREATE INDEX "customers_owner_id_idx" ON "customers"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_owner_id_phone_key" ON "customers"("owner_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "clothing_categories_category_name_key" ON "clothing_categories"("category_name");

-- CreateIndex
CREATE UNIQUE INDEX "clothing_sizes_size_name_key" ON "clothing_sizes"("size_name");

-- CreateIndex
CREATE UNIQUE INDEX "clothing_colors_color_name_key" ON "clothing_colors"("color_name");

-- CreateIndex
CREATE INDEX "clothing_products_owner_id_category_id_idx" ON "clothing_products"("owner_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "clothing_products_owner_id_product_name_key" ON "clothing_products"("owner_id", "product_name");

-- CreateIndex
CREATE UNIQUE INDEX "clothing_suppliers_owner_id_phone_key" ON "clothing_suppliers"("owner_id", "phone");

-- CreateIndex
CREATE INDEX "clothing_stock_lots_product_id_idx" ON "clothing_stock_lots"("product_id");

-- CreateIndex
CREATE INDEX "clothing_stock_lots_supplier_id_idx" ON "clothing_stock_lots"("supplier_id");

-- CreateIndex
CREATE INDEX "clothing_stock_lots_product_id_size_id_color_id_idx" ON "clothing_stock_lots"("product_id", "size_id", "color_id");

-- CreateIndex
CREATE INDEX "clothing_sales_owner_id_created_at_idx" ON "clothing_sales"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "clothing_sales_customer_id_idx" ON "clothing_sales"("customer_id");

-- CreateIndex
CREATE INDEX "clothing_sales_items_sales_id_idx" ON "clothing_sales_items"("sales_id");

-- CreateIndex
CREATE INDEX "clothing_sales_items_product_id_idx" ON "clothing_sales_items"("product_id");

-- CreateIndex
CREATE INDEX "clothing_sales_items_lot_id_idx" ON "clothing_sales_items"("lot_id");

-- CreateIndex
CREATE INDEX "clothing_customer_returns_owner_id_created_at_idx" ON "clothing_customer_returns"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "clothing_customer_return_items_return_id_idx" ON "clothing_customer_return_items"("return_id");

-- CreateIndex
CREATE INDEX "clothing_customer_return_items_lot_id_idx" ON "clothing_customer_return_items"("lot_id");

-- CreateIndex
CREATE INDEX "clothing_supplier_returns_owner_id_created_at_idx" ON "clothing_supplier_returns"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "clothing_supplier_returns_owner_id_supplier_id_idx" ON "clothing_supplier_returns"("owner_id", "supplier_id");

-- CreateIndex
CREATE INDEX "clothing_supplier_return_items_return_id_idx" ON "clothing_supplier_return_items"("return_id");

-- CreateIndex
CREATE INDEX "clothing_supplier_return_items_lot_id_idx" ON "clothing_supplier_return_items"("lot_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_products" ADD CONSTRAINT "clothing_products_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_products" ADD CONSTRAINT "clothing_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "clothing_categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_suppliers" ADD CONSTRAINT "clothing_suppliers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_stock_lots" ADD CONSTRAINT "clothing_stock_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "clothing_products"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_stock_lots" ADD CONSTRAINT "clothing_stock_lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "clothing_suppliers"("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_stock_lots" ADD CONSTRAINT "clothing_stock_lots_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "clothing_sizes"("size_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_stock_lots" ADD CONSTRAINT "clothing_stock_lots_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "clothing_colors"("color_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_sales" ADD CONSTRAINT "clothing_sales_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_sales" ADD CONSTRAINT "clothing_sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_sales_items" ADD CONSTRAINT "clothing_sales_items_sales_id_fkey" FOREIGN KEY ("sales_id") REFERENCES "clothing_sales"("sales_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_sales_items" ADD CONSTRAINT "clothing_sales_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "clothing_products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_sales_items" ADD CONSTRAINT "clothing_sales_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "clothing_stock_lots"("lot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_sales_items" ADD CONSTRAINT "clothing_sales_items_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "clothing_sizes"("size_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_sales_items" ADD CONSTRAINT "clothing_sales_items_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "clothing_colors"("color_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_customer_returns" ADD CONSTRAINT "clothing_customer_returns_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_customer_returns" ADD CONSTRAINT "clothing_customer_returns_sales_id_fkey" FOREIGN KEY ("sales_id") REFERENCES "clothing_sales"("sales_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_customer_return_items" ADD CONSTRAINT "clothing_customer_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "clothing_customer_returns"("return_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_customer_return_items" ADD CONSTRAINT "clothing_customer_return_items_sales_item_id_fkey" FOREIGN KEY ("sales_item_id") REFERENCES "clothing_sales_items"("sales_item_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_customer_return_items" ADD CONSTRAINT "clothing_customer_return_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "clothing_stock_lots"("lot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_supplier_returns" ADD CONSTRAINT "clothing_supplier_returns_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_supplier_returns" ADD CONSTRAINT "clothing_supplier_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "clothing_suppliers"("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_supplier_return_items" ADD CONSTRAINT "clothing_supplier_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "clothing_supplier_returns"("return_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clothing_supplier_return_items" ADD CONSTRAINT "clothing_supplier_return_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "clothing_stock_lots"("lot_id") ON DELETE RESTRICT ON UPDATE CASCADE;
