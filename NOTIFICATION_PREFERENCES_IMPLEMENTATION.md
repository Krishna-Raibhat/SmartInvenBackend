# Grocery Notification Preferences System - Implementation Complete ✅

## Overview
Implemented a user notification preferences system for the Grocery module that allows users to enable/disable notifications for different types (low_stock, expiry, sale, return).

## Design Decision
**Chosen Approach: Option 3 - Add `is_enabled` to GroceryNotification table**
- Simplest implementation
- No extra table joins needed
- Minimal schema changes
- Stores user preferences as notification records
- Default: notifications enabled (is_enabled = true)

## Database Changes

### Schema Update (prisma/schema.prisma)
```prisma
model GroceryNotification {
  notification_id String          @id @default(uuid())
  owner_id        String
  type            String
  title           String
  message         String
  product_id      String?
  read_at         DateTime?
  is_enabled      Boolean         @default(true)  // ✅ NEW FIELD
  created_at      DateTime        @default(now())
  owner           Owner           @relation(fields: [owner_id], references: [owner_id], onDelete: Cascade)
  product         GroceryProduct? @relation(fields: [product_id], references: [product_id])

  @@index([owner_id, created_at])
  @@index([owner_id, read_at])
  @@index([owner_id, is_enabled])  // ✅ NEW INDEX
  @@map("grocery_notifications")
}
```

### Migration Applied
- **File**: `prisma/migrations/20260525000000_add_notification_preferences/migration.sql`
- **Status**: ✅ Successfully deployed
- **Changes**:
  - Added `is_enabled` BOOLEAN column with DEFAULT true
  - Created index on (owner_id, is_enabled) for efficient queries

## Implementation Files

### 1. Service Layer
**File**: `src/services/groceryNotificationPreferenceService.js`

Methods:
- `getPreference(owner_id, type)` - Get preference for a notification type (defaults to true)
- `setPreference(owner_id, type, is_enabled)` - Create/update preference record
- `shouldSendNotification(owner_id, type)` - Check if notification should be sent
- `getAllPreferences(owner_id)` - Get all preferences for user
- `updateMultiplePreferences(owner_id, preferencesMap)` - Batch update preferences

### 2. Controller Layer
**File**: `src/controllers/groceryNotificationPreferenceController.js`

Endpoints:
- `getPreferences()` - GET all preferences for user
- `getPreferenceByType()` - GET specific type preference
- `updatePreference()` - PUT single preference
- `updateMultiplePreferences()` - PUT multiple preferences

### 3. Routes
**File**: `src/routes/groceryNotificationPreferenceRoutes.js`

```
GET    /api/grocery/notification-preferences/          → getPreferences()
GET    /api/grocery/notification-preferences/type      → getPreferenceByType(type)
PUT    /api/grocery/notification-preferences/          → updatePreference()
PUT    /api/grocery/notification-preferences/batch     → updateMultiplePreferences()
```

### 4. Integration with Notification Services
**File**: `src/services/groceryNotificationService.js`

Updated functions:
- `sendGroceryLowStockNotification()` - Checks preference before sending
- `sendGroceryExpiryNotification()` - Checks preference before sending

**Workflow**:
1. Before sending any notification, call `shouldSendNotification(owner_id, type)`
2. If returns false, skip notification (log: "⏭️ Notification skipped (disabled)")
3. If returns true, proceed with notification creation and FCM send

## API Usage Examples

### Get All Preferences
```bash
GET /api/grocery/notification-preferences/
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "low_stock": true,
    "expiry": true,
    "sale": false,
    "return": true
  }
}
```

### Get Specific Preference
```bash
GET /api/grocery/notification-preferences/type?type=low_stock
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "type": "low_stock",
    "is_enabled": true
  }
}
```

### Update Single Preference
```bash
PUT /api/grocery/notification-preferences/
Authorization: Bearer <token>

Body:
{
  "type": "low_stock",
  "is_enabled": false
}

Response:
{
  "success": true,
  "message": "low_stock notifications disabled",
  "data": { ... }
}
```

### Update Multiple Preferences
```bash
PUT /api/grocery/notification-preferences/batch
Authorization: Bearer <token>

Body:
{
  "low_stock": false,
  "expiry": true,
  "sale": false,
  "return": true
}

Response:
{
  "success": true,
  "message": "Preferences updated successfully",
  "data": [ ... ]
}
```

## Notification Types Supported
- `low_stock` - Low stock alerts
- `expiry` - Product expiry warnings
- `sale` - Sale notifications
- `return` - Return notifications

## User Workflow

### From Flutter App
1. User navigates to Notification Settings
2. User toggles notification type (e.g., disable low_stock)
3. App calls: `PUT /api/grocery/notification-preferences/`
4. Backend creates preference record with `is_enabled = false`
5. Next time low stock alert triggers, it checks preference and skips notification

### Default Behavior
- All notifications enabled by default (is_enabled = true)
- If no preference exists for a type, defaults to enabled
- User can toggle at any time

## Files Modified/Created

### Created
- ✅ `src/routes/groceryNotificationPreferenceRoutes.js`
- ✅ `src/services/groceryNotificationPreferenceService.js`
- ✅ `src/controllers/groceryNotificationPreferenceController.js`
- ✅ `prisma/migrations/20260525000000_add_notification_preferences/migration.sql`

### Modified
- ✅ `prisma/schema.prisma` - Added is_enabled field and index
- ✅ `src/app.js` - Registered notification preference routes
- ✅ `src/services/groceryNotificationService.js` - Added preference checks

## Deployment Steps Completed

1. ✅ Created migration file
2. ✅ Updated Prisma schema
3. ✅ Deployed migration: `npx prisma migrate deploy`
4. ✅ Generated Prisma client: `npx prisma generate`
5. ✅ Created service layer
6. ✅ Created controller layer
7. ✅ Created routes
8. ✅ Registered routes in app.js
9. ✅ Integrated preference checks in notification services

## Testing Checklist

- [ ] Test GET all preferences endpoint
- [ ] Test GET specific preference endpoint
- [ ] Test PUT single preference endpoint
- [ ] Test PUT batch preferences endpoint
- [ ] Verify low stock notification respects preference
- [ ] Verify expiry notification respects preference
- [ ] Test default behavior (no preference = enabled)
- [ ] Test with Flutter app integration

## Next Steps

1. Test endpoints with Postman/Thunder Client
2. Integrate with Flutter app
3. Test end-to-end notification flow
4. Monitor logs for preference checks
5. Consider adding similar preferences for other modules (clothing, hardware)

## Notes

- Preferences are stored as notification records for simplicity
- Each preference change creates a new record (audit trail)
- Latest preference is used (ordered by created_at DESC)
- No separate NotificationPreference table needed
- Minimal performance impact with indexed queries
