# Changes Summary — April 25–28, 2026

## 1. Auth — Login: Payment Pending Check
**File:** `src/controllers/authController.js`

When a trial-expired owner tries to login, the system now checks if they have a `pending` PaymentProof. If yes, returns:
```json
{
  "success": false,
  "error_code": "TRIAL_EXPIRED",
  "message": "Your payment is still in verification.",
  "owner": { ... }
}
```
Previously it always returned the generic trial expired message regardless of payment status.

---

## 2. Clothing Report — Due Balance Fix
**File:** `src/services/clothingReportService.js` → `salesCostPaid()`

- Fixed phantom due balance showing when credits/returns existed
- `returns` CTE now also sums `refund_amount` from `clothing_customer_returns`
- Balance formula changed to: `due = sales - paid - refund`, clamped to `0` if negative
- When credits are fully cleared, `balance` returns `0` (never negative)

---

## 3. Subscription Expiry Cron (New)
**File:** `src/cron/subscriptionExpiryCron.js` *(new file)*

Runs daily at **midnight**. Finds all `active` owners whose `subscription_expires_at < now` and flips them to `inactive`, resets `subscription_reminder_sent: false`.

Registered in `src/app.js`:
```js
import "./cron/subscriptionExpiryCron.js";
```

---

## 4. Prisma Schema — Subscription Fields
**File:** `prisma/schema.prisma`

Added to `Owner` model (fields already existed in DB, schema was missing them):
```prisma
subscription_expires_at    DateTime?
subscription_reminder_sent Boolean   @default(false)
```
Ran `npx prisma generate` to regenerate the client.

---

## 5. Email — Account Activated (HTML Upgrade)
**File:** `src/utils/mailer.js` → `sendAccountActivatedEmail()`

Replaced plain text email with a professional HTML template matching the OTP email style:
- SmartInven branded header (blue gradient)
- Info cards: Subscription Duration (30 days), Account Status (Active), Access (Full Features Unlocked)
- Clean footer
- No login link

---

## 6. Email — Subscription Expiry Reminder (HTML Upgrade)
**File:** `src/utils/mailer.js` → `sendSubscriptionExpiryReminderEmail()`

Replaced plain text email with a professional HTML template:
- SmartInven branded header
- ⏰ warning icon
- Info cards: Expiry Date, Days Remaining (dynamic), Action Required
- Instructs user to upload payment proof via the app
- No login link

---

## 7. Payment Proof — Approve Fix
**File:** `src/controllers/paymentProofController.js`

The `approve` endpoint was failing with `Unknown argument subscription_expires_at` because the Prisma client was stale. Fixed by running `npx prisma generate` after adding the fields to the schema.

---

## Files Changed
| File | Change |
|---|---|
| `src/controllers/authController.js` | Added pending payment check on login |
| `src/services/clothingReportService.js` | Fixed due balance calculation |
| `src/cron/subscriptionExpiryCron.js` | New file — expiry cron |
| `src/app.js` | Registered subscriptionExpiryCron |
| `prisma/schema.prisma` | Added subscription fields to Owner model |
| `src/utils/mailer.js` | HTML upgrade for activation + reminder emails |
