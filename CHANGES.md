# Code Changes Document

## 1. Stock Flow Report Fix

### File Changed
`src/services/clothingReportService.js`

### Method
`stockFlow()`

### Issue Fixed
Stock flow report was showing days with only stock-in (no sales) as "0 profit", making it look like a loss.

### Change
Added WHERE clause to filter out days with no stock-out activity.

```sql
WHERE (COALESCE(o.qty_out, 0) > 0 OR COALESCE(r.qty_returned, 0) > 0)
```

### Result
Only days with actual sales or returns now appear in the report.

---

## 2. Issue Report API

### New Files Created
- `src/controllers/issueReportController.js`
- `src/routes/issueReportRoutes.js`

### Files Modified
- `src/utils/mailer.js` - Added `sendIssueReport()` function
- `src/app.js` - Mounted route at `/api/issue-report`
- `.env` - Added `SUPPORT_EMAIL` variable

### API Endpoint
```
POST /api/issue-report
```

### Request Body
```json
{
  "name": "User Name",
  "email": "user@example.com",
  "subject": "Issue Subject",
  "description": "Issue description"
}
```

### Environment Variable
```
SUPPORT_EMAIL=elevatetch@gmail.com
```

### Result
Users can now submit issue reports from the app, which are sent via email to the support team.

---

## 3. Hardware Category Name Normalization

### File Changed
`src/services/hardwareCategoryService.js`

### Methods Updated
- `createCategory()`
- `updateCategory()`

### Issue Fixed
Hardware categories "Nails" and "nails" were accepted as different categories, allowing duplicates.

### Change
Added `.toLowerCase()` to normalize category names before saving.

```javascript
const name = String(category_name || "").trim().toLowerCase();
```

### API Endpoint
```
POST /api/hardware/categories
```

### Request Body
```json
{
  "category_name": "Nails"
}
```

### Result
Category names are now case-insensitive. "Nails", "NAILS", "nails" all become "nails" and duplicates are prevented.

---

## 4. Hardware Stock-In SP vs CP Validation

### File Changed
`src/services/hardwareStockInService.js`

### Method
`stockIn()`

### Issue Fixed
Selling price (sp) could be set lower than cost price (cp), resulting in automatic losses.

### Change
Added validation to ensure sp >= cp.

```javascript
if (spNum < cpNum) {
  const err = new Error("sp cannot be less than cp (selling price should not be below cost price)");
  err.status = 400;
  err.code = "VALIDATION_SP_LESS_THAN_CP";
  throw err;
}
```

### Result
Hardware stock-in now prevents setting a selling price below the cost price, protecting against unintended losses.

---

## 5. Hardware Stock-Out Payment Validation Removed

### File Changed
`src/services/hardwareStockOutService.js`

### Method
`createStockOut()`

### Issue Fixed
Customers were not allowed to pay more than the total amount.

### Change
Removed the validation that blocked overpayments.

```javascript
// REMOVED:
// if (paid > totalAmount) {
//   const err = new Error("paid_amount cannot be greater than total_amount");
//   throw err;
// }
```

### Result
Customers can now pay any amount they want, including more than the total amount (overpayment). The system will mark it as "paid" if `paid >= totalAmount`.

---

## 6. Hardware Stock-Out Payment API

### Files Modified
- `src/services/hardwareStockOutService.js` - Added `addPayment()` method
- `src/controllers/hardwareStockOutController.js` - Added `addPayment()` controller
- `src/routes/hardwareStockOutRoutes.js` - Added payment route

### Issue Fixed
No API existed to add payments to hardware stock-out transactions with due amounts.

### API Endpoint
```
POST /api/hardware/stock-out/:stockout_id/payments
```

### Request Body
```json
{
  "amount": 500
}
```

### Result
Customers can now make additional payments on hardware stock-out transactions. Payment status automatically updates to "partial" or "paid" based on the total paid amount.

---

## 7. Customer Phone Number Validation

### Files Modified
- `src/services/clothingSalesService.js` - Added phone validation in `createSale()`
- `src/services/hardwareStockOutService.js` - Added phone validation in `createStockOut()`

### Issue Fixed
Customer phone numbers were not validated when creating clothing sales or hardware stock-out transactions.

### Change
Added phone number validation using existing utility functions.

```javascript
const normalizedPhone = normalizeNepalPhone(String(customer.phone).trim());
if (!isValidNepalPhone(normalizedPhone)) {
  const err = new Error("Invalid phone number. Please enter a valid 10-digit Nepali number.");
  err.status = 400;
  err.code = "VALIDATION_PHONE_INVALID";
  throw err;
}
```

### Result
Customer phone numbers are now validated to be exactly 10 digits. The system normalizes the phone (removes spaces, dashes, +977 prefix) and validates the format before creating sales or stock-out records.

---

## 8. Owner Status Field

### Files Modified
- `prisma/schema.prisma` - Added `OwnerStatus` enum and `status` field to Owner model

### Issue Fixed
No way to track owner account status (trial, active, inactive).

### Change
Added status enum and field to Owner model.

```prisma
enum OwnerStatus {
  trial
  active
  inactive
}

model Owner {
  // ...
  status OwnerStatus @default(trial)
  // ...
}
```

### Migration
```
npx prisma migrate dev --name add_owner_status
```

### Result
Owner accounts now have a status field that defaults to "trial". This allows tracking of account lifecycle and can be used for access control or feature restrictions based on subscription status.

Owners can optionally specify their status during registration by including a `status` field in the request body with one of: `trial`, `active`, or `inactive`. If not provided, it defaults to `trial`.

**Login Changes:**
- Login now returns the owner's `status` in the response
- Accounts with `status: "inactive"` are blocked from logging in with error code `ACCOUNT_INACTIVE`
- The `/me` endpoint now includes the `status` field
