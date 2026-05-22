# Grocery Notification API

## Overview
Manage grocery/pharmacy notifications (low stock alerts, etc.)

## Base URL
```
/api/grocery/notifications
```

## Authentication
All endpoints require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

---

## Endpoints

### 1. List Notifications
Get all notifications for the owner (last 100, newest first)

**Endpoint:**
```
GET /api/grocery/notifications
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "notification_id": "uuid",
      "owner_id": "uuid",
      "type": "LOW_STOCK",
      "title": "Low Stock Alert 🚨",
      "message": "Paracetamol 500mg is low (5 strips left)",
      "product_id": "uuid",
      "read_at": null,
      "created_at": "2026-05-18T10:30:00.000Z"
    }
  ],
  "unreadCount": 3
}
```

---

### 2. Mark Notification as Read
Mark a single notification as read

**Endpoint:**
```
POST /api/grocery/notifications/:id/read
```

**Parameters:**
- `id` (path) - Notification ID

**Response:**
```json
{
  "success": true,
  "data": {
    "notification_id": "uuid",
    "owner_id": "uuid",
    "type": "LOW_STOCK",
    "title": "Low Stock Alert 🚨",
    "message": "Paracetamol 500mg is low (5 strips left)",
    "product_id": "uuid",
    "read_at": "2026-05-18T11:00:00.000Z",
    "created_at": "2026-05-18T10:30:00.000Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error_code": "NOT_FOUND",
  "message": "Notification not found"
}
```

---

### 3. Mark All Notifications as Read
Mark all unread notifications as read for the owner

**Endpoint:**
```
POST /api/grocery/notifications/read-all
```

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked read"
}
```

---

### 4. Delete Notification
Delete a single notification

**Endpoint:**
```
DELETE /api/grocery/notifications/:id
```

**Parameters:**
- `id` (path) - Notification ID

**Response:**
```json
{
  "success": true,
  "message": "Deleted"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error_code": "NOT_FOUND",
  "message": "Notification not found"
}
```

---

## Notification Types

| Type | Description |
|------|-------------|
| LOW_STOCK | Product quantity is below threshold |

---

## Example Usage

### Get all notifications
```bash
curl -X GET http://localhost:3000/api/grocery/notifications \
  -H "Authorization: Bearer <token>"
```

### Mark notification as read
```bash
curl -X POST http://localhost:3000/api/grocery/notifications/abc-123/read \
  -H "Authorization: Bearer <token>"
```

### Mark all as read
```bash
curl -X POST http://localhost:3000/api/grocery/notifications/read-all \
  -H "Authorization: Bearer <token>"
```

### Delete notification
```bash
curl -X DELETE http://localhost:3000/api/grocery/notifications/abc-123 \
  -H "Authorization: Bearer <token>"
```

---

## Notes

- Notifications are automatically created by the low stock cron job
- Low stock notifications have a 24-hour cooldown (won't create duplicate within 24h)
- FCM push notifications are sent if owner has a valid FCM token
- Maximum 100 notifications returned (newest first)
- Notifications are owner-scoped (can only see/manage your own)

---

## Related

- **Low Stock API**: `/api/grocery/low-stock`
- **Cron Job**: `src/cron/lowStockCronAll.js` (runs every 5 minutes)
- **Service**: `src/services/groceryNotificationService.js`

---

## Implementation Files

- **Controller**: `src/controllers/groceryNotificationController.js`
- **Routes**: `src/routes/groceryNotificationRoutes.js`
- **Service**: `src/services/groceryNotificationService.js`
- **Registered in**: `src/app.js`
