# Migration: Store Supplier Payment Transactions

**Date:** 2026-07-26  
**Migration:** `20260726002920_create_store_supplier_payment_transactions`

## Problem
Supplier payments were being recorded as expenses in the `store_expenses` table. This incorrectly reduced profit calculations because:
- Supplier payments pay for inventory purchases (COGS)
- COGS is already deducted from profit
- Recording supplier payments as expenses = double-counting the cost

## Solution
Created a new table `store_supplier_payment_transactions` to track supplier payments separately from operational expenses.

### Changes Made:
1. **New Table:** `store_supplier_payment_transactions`
   - `transaction_id` (PK)
   - `owner_id` (FK to owners)
   - `supplier_id` (FK to store_suppliers)
   - `amount`
   - `payment_method` (default: "cash")
   - `note`
   - `created_at`

2. **Updated Service:** `storeSupplierService.js`
   - `recordPayment()` now creates payment transactions instead of expenses
   - `getPayments()` now queries payment transactions instead of expenses

3. **Data Migration:**
   - Automatically migrated existing supplier payments from expenses to transactions
   - Old expense records are preserved (commented out deletion in migration)

## Impact
✅ **No Frontend Changes Required** - API endpoints remain the same  
✅ **Profit Calculations Fixed** - Supplier payments no longer reduce profit  
✅ **Historical Data Preserved** - Old payments migrated to new table  
✅ **Better Reporting** - Clear separation between expenses and supplier payments

## Future Cleanup (Optional)
If you want to remove old supplier payment expense records after verifying everything works:

```sql
-- Delete migrated supplier payment expenses
DELETE FROM store_expenses 
WHERE title_id IN (SELECT title_id FROM store_expense_titles WHERE title = 'Supplier Payment')
  AND note ~ '\[SUPPLIER_PAYMENT:[a-f0-9\-]+\]';

-- Optionally delete the "Supplier Payment" expense title if no longer needed
DELETE FROM store_expense_titles WHERE title = 'Supplier Payment';
```

## Testing
1. Make a supplier payment via the app
2. Verify it appears in payment history
3. Check that profit calculations no longer deduct supplier payments
4. Verify expenses screen does not show supplier payments

## Future Enhancements
- Add `payment_method` parameter to frontend payment form (cash, bank transfer, online)
- Consider implementing this for other business types (Hardware, Clothing, Grocery)
