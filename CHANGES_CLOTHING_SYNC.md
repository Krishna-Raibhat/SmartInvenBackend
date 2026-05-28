# 🎯 Clothing Module - Frontend Sync Implementation

**Date**: May 28, 2026  
**Status**: ✅ Complete  
**Module**: Clothing (Flutter Frontend)

---

## 📋 Overview

Implemented complete offline sync system for the Clothing module in the Flutter frontend, mirroring the existing Grocery sync implementation. This enables users to create/update clothing inventory data offline and automatically sync when connectivity is restored.

---

## 📁 Files Created

### **Main Sync Service**
- **File**: `lib/services/sync/clothing_sync_service.dart`
- **Purpose**: Main orchestrator for clothing sync operations
- **Functionality**:
  - Collects pending data from local Hive boxes
  - Sends batch sync request to backend: `POST /api/clothing/sync`
  - Handles response with ID mappings
  - Calls individual handlers to update local records
  - Removes successfully synced items from queue
  - Handles errors and duplicates

### **Notification Preference Service**
- **File**: `lib/services/clothing_notification_preference_service.dart`
- **Purpose**: Manage clothing notification preferences
- **Functionality**:
  - Get all notification preferences
  - Get preference for specific type
  - Update single preference
  - Update multiple preferences
  - Check if notification should be sent

### **Sync Handlers** (8 files in `lib/services/sync/handlers/`)

1. **clothing_category_sync_handler.dart**
   - Updates local category records with server IDs
   - Maps: `local_id` → `category_id`

2. **clothing_color_sync_handler.dart**
   - Updates local color records with server IDs
   - Maps: `local_id` → `color_id`

3. **clothing_size_sync_handler.dart**
   - Updates local size records with server IDs
   - Maps: `local_id` → `size_id`

4. **clothing_supplier_sync_handler.dart**
   - Updates local supplier records with server IDs
   - Maps: `local_id` → `supplier_id`

5. **clothing_product_sync_handler.dart**
   - Updates local product records with server IDs
   - Maps: `local_id` → `product_id`

6. **clothing_stock_lot_sync_handler.dart**
   - Updates local stock lot records with server IDs
   - Maps: `local_id` → `lot_id`

7. **clothing_sales_sync_handler.dart**
   - Updates local sales records with server IDs
   - Maps: `local_id` → `sales_id`

8. **clothing_return_sync_handler.dart**
   - Updates local return records with server IDs
   - Maps: `local_id` → `return_id`

---

## 🔄 Sync Flow

```
User creates clothing data offline
    ↓
Data stored in local Hive boxes with local_id (UUID)
    ↓
Data queued in clothingSyncQueue
    ↓
When connectivity restored:
    ↓
ClothingSyncService.syncPendingData() called
    ↓
Collects from all entity types:
  - categories
  - colors
  - sizes
  - suppliers
  - products
  - stock_lots
  - sales
  - returns
    ↓
POST /api/clothing/sync with batch payload
    ↓
Backend processes and returns:
  - synced: {categories: [...], colors: [...], ...}
  - failed: [...]
  - id_mapping: {local_id: server_id, ...}
    ↓
For each entity type:
  - Call corresponding handler
  - Handler updates local record:
    * Replace local_id with server_id
    * Set is_synced: true
    * Delete old local_id entry
    * Save with server_id as key
    ↓
Remove successfully synced items from queue
    ↓
✅ Sync complete
```

---

## 🔌 Integration Points

### **1. Initialize Hive Boxes** (in `main.dart`)

```dart
// Add to Hive initialization
await Hive.openBox('clothingSyncQueue');      // Sync queue
await Hive.openBox('clothingCategories');     // Categories
await Hive.openBox('clothingColors');         // Colors
await Hive.openBox('clothingSizes');          // Sizes
await Hive.openBox('clothingSuppliers');      // Suppliers
await Hive.openBox('clothingProducts');       // Products
await Hive.openBox('clothingStockLots');      // Stock lots
await Hive.openBox('clothingSales');          // Sales
await Hive.openBox('clothingReturns');        // Returns
```

### **2. Call Sync When Online** (in connectivity listener)

```dart
import 'services/sync/clothing_sync_service.dart';

// When connectivity is restored
void onConnectivityRestored() {
  ClothingSyncService.syncPendingData();
}
```

### **3. Queue Data When Creating** (in create operations)

```dart
// When user creates a clothing category offline
final localId = uuid.v4();
final categoryData = {
  'local_id': localId,
  'category_name': 'T-Shirts',
  // ... other fields
};

// Save to local box
await Hive.box('clothingCategories').put(localId, categoryData);

// Queue for sync
await Hive.box('clothingSyncQueue').add({
  'type': 'category',
  'action': 'create',
  'data': categoryData,
});
```

### **4. Notification Preferences** (in settings/preferences screen)

```dart
import 'services/clothing_notification_preference_service.dart';

// Get all preferences
final prefs = await ClothingNotificationPreferenceService.getAllPreferences();

// Get specific preference
final lowStockEnabled = await ClothingNotificationPreferenceService.getPreference('low_stock');

// Update single preference
await ClothingNotificationPreferenceService.updatePreference('low_stock', false);

// Update multiple preferences
await ClothingNotificationPreferenceService.updateMultiplePreferences({
  'low_stock': true,
});

// Check before sending notification
final shouldSend = await ClothingNotificationPreferenceService.shouldSendNotification('low_stock');
if (shouldSend) {
  // Send notification
}
```

---

## 📊 Entity Types Supported

| Entity | Local Box | Queue Type | Server ID Field | Status |
|--------|-----------|-----------|-----------------|--------|
| Category | clothingCategories | category | category_id | ✅ |
| Color | clothingColors | color | color_id | ✅ |
| Size | clothingSizes | size | size_id | ✅ |
| Supplier | clothingSuppliers | supplier | supplier_id | ✅ |
| Product | clothingProducts | product | product_id | ✅ |
| Stock Lot | clothingStockLots | stock_lot | lot_id | ✅ |
| Sale | clothingSales | sale | sales_id | ✅ |
| Return | clothingReturns | return | return_id | ✅ |

---

## 🔐 Error Handling

The sync service handles:

1. **No Internet**: Skips sync, data remains in queue
2. **Duplicate Items**: Removes from queue if backend reports "already exists"
3. **Deleted Items**: Removes from queue if backend reports "not found"
4. **Sync Failures**: Logs error, keeps data in queue for retry
5. **Partial Failures**: Removes only successfully synced items

---

## 📝 Backend Endpoint

**Endpoint**: `POST /api/clothing/sync`

**Request Body**:
```json
{
  "categories": [...],
  "colors": [...],
  "sizes": [...],
  "suppliers": [...],
  "products": [...],
  "stock_lots": [...],
  "sales": [...],
  "returns": [...]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "synced": {
      "categories": [...],
      "colors": [...],
      ...
    },
    "failed": [...],
    "id_mapping": {
      "local_id_1": "server_id_1",
      "local_id_2": "server_id_2",
      ...
    }
  }
}
```

---

## ✅ Testing Checklist

- [ ] Initialize all Hive boxes in main.dart
- [ ] Import ClothingSyncService in connectivity listener
- [ ] Call ClothingSyncService.syncPendingData() when online
- [ ] Create clothing data offline
- [ ] Verify data is queued in clothingSyncQueue
- [ ] Go online and verify sync is triggered
- [ ] Check that local_id is replaced with server_id
- [ ] Verify is_synced flag is set to true
- [ ] Confirm synced items are removed from queue
- [ ] Test error scenarios (duplicates, not found)
- [ ] Test notification preferences GET endpoint
- [ ] Test notification preferences PUT endpoint
- [ ] Test notification preferences BATCH endpoint
- [ ] Verify low_stock notifications respect preference setting
- [ ] Test disabling notifications and verify they don't send

---

## 🔄 Comparison with Grocery Sync

| Aspect | Grocery | Clothing | Status |
|--------|---------|----------|--------|
| Service Class | SyncService | ClothingSyncService | ✅ Same pattern |
| Endpoint | /grocery/sync/batch | /clothing/sync | ✅ Consistent |
| Entity Types | 8 | 8 | ✅ Same count |
| Handlers | 8 | 8 | ✅ Same pattern |
| ID Mapping | ✅ | ✅ | ✅ Identical |
| Error Handling | ✅ | ✅ | ✅ Identical |
| Queue Management | ✅ | ✅ | ✅ Identical |

---

## 📦 Dependencies

- `hive`: Local storage
- `http`: HTTP requests
- `shared_preferences`: Token storage
- `connectivity_plus`: Connectivity detection
- `uuid`: Generate local IDs

All dependencies already exist in the project.

---

## 🚀 Next Steps

1. ✅ Clothing sync implementation complete
2. ✅ Clothing notification preferences complete
3. ⏳ Hardware sync implementation (similar pattern)
4. ⏳ Hardware notification preferences
5. ⏳ Integration testing with real backend
6. ⏳ UI updates to show sync status
7. ⏳ Sync progress indicators

---

## 📞 Support

For issues or questions about the clothing sync implementation:
- Check sync logs in console
- Verify Hive boxes are initialized
- Ensure connectivity listener is calling sync service
- Check backend endpoint is accessible

---

**Implementation Date**: May 28, 2026  
**Status**: Ready for Integration Testing
