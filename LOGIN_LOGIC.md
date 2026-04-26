# Login Logic & Response Messages

**Endpoint:** `POST /api/auth/login`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "fcm_token": "optional-device-token"
}
```

---

## Flow Diagram

```
POST /api/auth/login
        │
        ▼
  Email & Password provided?
  ├── NO  → 400 VALIDATION_REQUIRED_FIELDS
  └── YES ↓
        │
        ▼
  Owner found by email?
  ├── NO  → 401 INVALID_CREDENTIALS
  └── YES ↓
        │
        ▼
  Password matches?
  ├── NO  → 401 INVALID_CREDENTIALS
  └── YES ↓
        │
        ▼
  Owner status = "inactive"?
  ├── YES → 403 ACCOUNT_INACTIVE
  └── NO  ↓
        │
        ▼
  Owner status = "trial"?
  └── YES → Days since registration > 7?
            ├── NO  → ✅ Login Success (trial still valid)
            └── YES → Has pending payment proof?
                      ├── YES → 403 TRIAL_EXPIRED (payment in verification)
                      └── NO  → 403 TRIAL_EXPIRED (no payment submitted)
  Owner status = "active"?
  └── YES → ✅ Login Success
```

---

## All Response Cases

### ✅ Case 1: Login Success
**Status:** `200`
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "<jwt_token>",
  "owner": {
    "owner_id": "...",
    "full_name": "Smriti Gurung",
    "email": "smriti@gmail.com",
    "phone": "9814182225",
    "package_id": "...",
    "status": "active",
    "package_key": "clothing",
    "package_name": "Clothing Store"
  }
}
```
**When:** Status is `active`, OR status is `trial` and within 7 days of registration.

---

### ❌ Case 2: Missing Fields
**Status:** `400` | **error_code:** `VALIDATION_REQUIRED_FIELDS`
```json
{
  "success": false,
  "error_code": "VALIDATION_REQUIRED_FIELDS",
  "message": "Email and password are required."
}
```
**When:** Email or password not provided in request body.

---

### ❌ Case 3: Wrong Email or Password
**Status:** `401` | **error_code:** `INVALID_CREDENTIALS`
```json
{
  "success": false,
  "error_code": "INVALID_CREDENTIALS",
  "message": "Invalid email or password."
}
```
**When:** Email not found in DB, or password does not match.

---

### ❌ Case 4: Account Inactive
**Status:** `403` | **error_code:** `ACCOUNT_INACTIVE`
```json
{
  "success": false,
  "error_code": "ACCOUNT_INACTIVE",
  "message": "Your payment is pending verification. Please wait for approval."
}
```
**When:** Owner status is `inactive` (manually set by admin or system).

---

### ❌ Case 5: Trial Expired — Payment Submitted (Pending Verification)
**Status:** `403` | **error_code:** `TRIAL_EXPIRED`
```json
{
  "success": false,
  "error_code": "TRIAL_EXPIRED",
  "message": "Your payment is still in verification. Please wait for approval or upload a new payment receipt if needed.",
  "owner": {
    "owner_id": "...",
    "full_name": "Smriti Gurung",
    "email": "smriti@gmail.com",
    "phone": "9814182225",
    "package_id": "...",
    "status": "trial",
    "package_key": "clothing",
    "package_name": "Clothing Store"
  },
  "can_update_payment": true,
  "payment_status": "pending",
  "upload_url": "/api/payment-proof"
}
```
**When:** Status is `trial`, more than 7 days since registration, AND has a pending payment proof.

**Frontend Action:** Show "Update Payment Receipt" button using `can_update_payment: true`.
Upload new receipt to `POST /api/payment-proof` with `owner_id` from the `owner` object.

---

### ❌ Case 6: Trial Expired — No Payment Submitted
**Status:** `403` | **error_code:** `TRIAL_EXPIRED`
```json
{
  "success": false,
  "error_code": "TRIAL_EXPIRED",
  "message": "Your 7-day trial has expired. Please subscribe to continue.",
  "owner": {
    "owner_id": "...",
    "full_name": "Smriti Gurung",
    "email": "smriti@gmail.com",
    "phone": "9814182225",
    "package_id": "...",
    "status": "trial",
    "package_key": "clothing",
    "package_name": "Clothing Store"
  }
}
```
**When:** Status is `trial`, more than 7 days since registration, AND no payment proof submitted yet.

**Frontend Action:** Show "Subscribe Now" button. Direct user to upload payment receipt.

---

### ❌ Case 7: Server Error
**Status:** `500` | **error_code:** `SERVER_ERROR`
```json
{
  "success": false,
  "error_code": "SERVER_ERROR",
  "message": "Login failed.",
  "detail": "actual error message here"
}
```
**When:** Unexpected server/database error.

---

## Status Values Reference

| Status | Meaning |
|--------|---------|
| `trial` | New user, 7 days free access |
| `inactive` | Trial ended or manually deactivated |
| `active` | Payment verified, full access |

## Trial Period Logic

- Trial = 7 days from `owner.created_at`
- Calculated as: `Math.floor((now - created_at) / (1000 * 60 * 60 * 24)) > 7`
- No extra DB column needed — calculated on every login

## Token

JWT token is only returned on **successful login (Case 1)**.
All blocked cases return owner info but **no token**.
