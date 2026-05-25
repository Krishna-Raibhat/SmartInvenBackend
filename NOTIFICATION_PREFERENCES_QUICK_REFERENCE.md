# Notification Preferences - Quick Reference

## What Was Implemented?
A system that allows users to toggle notifications on/off for different types in the Grocery module.

## How It Works

### User Toggles Notification in Flutter
```
Flutter App → PUT /api/grocery/notification-preferences/
Body: { "type": "low_stock", "is_enabled": false }
```

### Backend Stores Preference
```
GroceryNotification table
- owner_id: user's ID
- type: "low_stock"
- is_enabled: false
- created_at: timestamp
```

### Before Sending Notification
```javascript
// In groceryNotificationService.js
const shouldSend = await groceryNotificationPreferenceService.shouldSendNotification(
  owner_id,
  "low_stock"
);

if (!shouldSend) {
  return null; // Skip notification
}
// Otherwise, send notification
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/grocery/notification-preferences/` | Get all preferences |
| GET | `/api/grocery/notification-preferences/type?type=low_stock` | Get specific preference |
| PUT | `/api/grocery/notification-preferences/` | Update single preference |
| PUT | `/api/grocery/notification-preferences/batch` | Update multiple preferences |

## Notification Types
- `low_stock` - Low stock alerts
- `expiry` - Product expiry warnings
- `sale` - Sale notifications
- `return` - Return notifications

## Default Behavior
- All notifications enabled by default
- If no preference exists, defaults to enabled
- Latest preference is used (ordered by created_at DESC)

## Files Created
1. `src/routes/groceryNotificationPreferenceRoutes.js` - API routes
2. `src/services/groceryNotificationPreferenceService.js` - Business logic
3. `src/controllers/groceryNotificationPreferenceController.js` - Request handlers
4. `prisma/migrations/20260525000000_add_notification_preferences/migration.sql` - DB migration

## Files Modified
1. `prisma/schema.prisma` - Added is_enabled field
2. `src/app.js` - Registered routes
3. `src/services/groceryNotificationService.js` - Added preference checks

## Database Changes
- Added `is_enabled` BOOLEAN column to grocery_notifications table
- Added index on (owner_id, is_enabled) for fast queries
- Migration deployed successfully ✅

## Testing
```bash
# Get all preferences
curl -X GET http://localhost:3000/api/grocery/notification-preferences/ \
  -H "Authorization: Bearer <token>"

# Disable low stock notifications
curl -X PUT http://localhost:3000/api/grocery/notification-preferences/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type":"low_stock","is_enabled":false}'

# Update multiple preferences
curl -X PUT http://localhost:3000/api/grocery/notification-preferences/batch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"low_stock":false,"expiry":true,"sale":false,"return":true}'
```

## Status
✅ **COMPLETE AND DEPLOYED**
- Schema updated
- Migration deployed
- Prisma client generated
- Routes registered
- Preference checks integrated
- Ready for Flutter integration
