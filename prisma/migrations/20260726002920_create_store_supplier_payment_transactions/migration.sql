-- CreateTable
CREATE TABLE "store_supplier_payment_transactions" (
    "transaction_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" TEXT NOT NULL DEFAULT 'cash',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_supplier_payment_transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateIndex
CREATE INDEX "store_supplier_payment_transactions_owner_id_supplier_id_idx" ON "store_supplier_payment_transactions"("owner_id", "supplier_id");

-- CreateIndex
CREATE INDEX "store_supplier_payment_transactions_created_at_idx" ON "store_supplier_payment_transactions"("created_at");

-- AddForeignKey
ALTER TABLE "store_supplier_payment_transactions" ADD CONSTRAINT "store_supplier_payment_transactions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_supplier_payment_transactions" ADD CONSTRAINT "store_supplier_payment_transactions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "store_suppliers"("supplier_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing supplier payments from expenses to payment transactions
-- This finds all expenses with [SUPPLIER_PAYMENT:xxx] tags and creates corresponding payment transactions
INSERT INTO "store_supplier_payment_transactions" ("transaction_id", "owner_id", "supplier_id", "amount", "payment_method", "note", "created_at")
SELECT 
    gen_random_uuid(),
    se.owner_id,
    SUBSTRING(se.note FROM '\[SUPPLIER_PAYMENT:([a-f0-9\-]+)\]') as supplier_id,
    se.amount,
    'cash' as payment_method,
    REGEXP_REPLACE(se.note, ' \[SUPPLIER_PAYMENT:[a-f0-9\-]+\]$', '') as note,
    se.created_at
FROM store_expenses se
JOIN store_expense_titles set ON set.title_id = se.title_id
WHERE set.title = 'Supplier Payment'
  AND se.note ~ '\[SUPPLIER_PAYMENT:[a-f0-9\-]+\]';

-- Optional: Delete old supplier payment expenses (comment out if you want to keep historical data)
-- DELETE FROM store_expenses 
-- WHERE title_id IN (SELECT title_id FROM store_expense_titles WHERE title = 'Supplier Payment')
--   AND note ~ '\[SUPPLIER_PAYMENT:[a-f0-9\-]+\]';
