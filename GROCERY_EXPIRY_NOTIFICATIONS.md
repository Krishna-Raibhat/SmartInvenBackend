# Grocery Expiry Notifications

## ✅ Feature: Automatic Expiry Warnings

Products with expiry dates are monitored automatically. When a product lot is expiring within 7 days, the system sends notifications to alert the owner.

---

## 🎯 How It Works

### Notification Trigger
- **When**: Product lot expires within 7 days
- **Condition**: Lot still has remaining stock (`qty_remaining > 0`)
- **Frequency**: Daily check at 9:00 AM (Asia/Kathmandu timezone)
- **Cooldown**: 24 hours (won't send duplicate notifications within 24h)

### Notification Content
```
Title: "Product Expiring Soon ⚠️"
Message: "{Product Name} (Batch: {Batch No}) expires in {X} days ({Expiry Date})"
```

**Example:**
```
Product Expiring Soon ⚠️
Paracetamol 500mg (Batch: BATCH-001) expires in 5 days (05/26/2026)
```

---

## 📊 Notification Details

### Database Record
Stored in `grocery_notifications` table:
```javascript
{
  notification_id: "uuid",
  owner_id: "uuid",
  type: "EXPIRY_WARNING",
  title: "Product Expiring Soon ⚠️",
  message: "Paracetamol 500mg (Batch: BATCH-001) expires in 5 days (05/26/2026)",
  product_id: "uuid",
  read_at: null,
  created_at: "2026-05-19T09:00:00.000Z"
}
```

### FCM Push Notification
If owner has FCM token, sends push notification:
```javascript
{
  notification: {
    title: "Product Expiring Soon ⚠️",
    body: "Paracetamol 500mg (Batch: BATCH-001) expires in 5 days (05/26/2026)"
  },
  data: {
    type: "EXPIRY_WARNING",
    module: "grocery",
    lot_id: "uuid",
    product_id: "uuid",
    batch_no: "BATCH-001",
    expiry_date: "2026-05-26T00:00:00.000Z",
    days_until_expiry: "5",
    notification_id: "uuid"
  }
}
```

---

## ⚙️ Configuration

### Warning Period
```javascript
const EXPIRY_WARNING_DAYS = 7; // Notify 7 days before expiry
```

**Can be changed to:**
- 3 days: More urgent warnings
- 14 days: Earlier warnings
- 30 days: Very early warnings

### Cron Schedule
```javascript
"0 9 * * *" // Daily at 9:00 AM
```

**Can be changed to:**
- `"0 8 * * *"` - 8:00 AM
- `"0 */6 * * *"` - Every 6 hours
- `"0 9,17 * * *"` - 9:00 AM and 5:00 PM

### Cooldown Period
```javascript
24 hours // Won't send duplicate within 24h
```

Prevents notification spam for the same product.

---

## 📱 API Integration

### Get Expiry Notifications
```bash
GET /api/grocery/notifications
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "notification_id": "...",
      "type": "EXPIRY_WARNING",
      "title": "Product Expiring Soon ⚠️",
      "message": "Paracetamol 500mg (Batch: BATCH-001) expires in 5 days (05/26/2026)",
      "product_id": "...",
      "read_at": null,
      "created_at": "2026-05-19T09:00:00.000Z"
    }
  ],
  "unreadCount": 3
}
```

### Mark as Read
```bash
POST /api/grocery/notifications/:id/read
```

### Get Expiring Products (Manual Check)
You can also create an API endpoint to manually check expiring products:

```javascript
// Example: Get all lots expiring within 7 days
const expiringLots = await prisma.groceryStockLot.findMany({
  where: {
    owner_id,
    expiry_date: {
      gte: new Date(), // Not yet expired
      lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Within 7 days
    },
    qty_remaining: { gt: 0 },
  },
  include: {
    product: {
      select: {
        product_name: true,
        unit: { select: { unit_name: true } },
      },
    },
  },
  orderBy: { expiry_date: 'asc' },
});
```

---

## 🎨 Frontend Display Examples

### Notification Badge
```jsx
function NotificationBell({ unreadCount }) {
  return (
    <div className="notification-bell">
      <BellIcon />
      {unreadCount > 0 && (
        <span className="badge">{unreadCount}</span>
      )}
    </div>
  );
}
```

### Notification List
```jsx
function NotificationList({ notifications }) {
  return (
    <div className="notifications">
      {notifications.map(notif => (
        <div 
          key={notif.notification_id}
          className={`notification ${notif.type.toLowerCase()}`}
        >
          <div className="icon">
            {notif.type === 'EXPIRY_WARNING' ? '⚠️' : '🚨'}
          </div>
          <div className="content">
            <h4>{notif.title}</h4>
            <p>{notif.message}</p>
            <span className="time">
              {formatTimeAgo(notif.created_at)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Expiring Products Dashboard Widget
```jsx
function ExpiringProductsWidget() {
  const [expiringLots, setExpiringLots] = useState([]);
  
  useEffect(() => {
    fetchExpiringLots();
  }, []);
  
  return (
    <div className="widget expiring-products">
      <h3>⚠️ Expiring Soon</h3>
      {expiringLots.map(lot => {
        const daysLeft = Math.ceil(
          (new Date(lot.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
        );
        
        return (
          <div key={lot.lot_id} className="expiring-item">
            <div className="product-info">
              <strong>{lot.product.product_name}</strong>
              {lot.batch_no && <span>Batch: {lot.batch_no}</span>}
            </div>
            <div className={`days-left ${daysLeft <= 3 ? 'urgent' : ''}`}>
              {daysLeft} days
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

## 🔔 Notification Types

| Type | Icon | Description | Priority |
|------|------|-------------|----------|
| EXPIRY_WARNING | ⚠️ | Product expiring within 7 days | High |
| LOW_STOCK | 🚨 | Product quantity below threshold | Medium |

---

## 📋 Use Cases

### 1. Pharmacy
- **Critical**: Medicines must not be sold after expiry
- **Action**: Remove from shelves, return to supplier, or dispose
- **Benefit**: Avoid legal issues and customer safety

### 2. Grocery Store
- **Important**: Food items lose quality after expiry
- **Action**: Discount pricing, promotions, or remove
- **Benefit**: Reduce waste, maximize sales

### 3. Inventory Management
- **Planning**: Order fresh stock before expiry
- **Action**: Adjust purchasing patterns
- **Benefit**: Better inventory turnover

---

## 🛠️ Implementation Files

### Service
- **File**: `src/services/groceryNotificationService.js`
- **Method**: `sendGroceryExpiryNotification()`
- **Purpose**: Create notification and send FCM push

### Cron Job
- **File**: `src/cron/groceryExpiryCron.js`
- **Schedule**: Daily at 9:00 AM
- **Purpose**: Check expiring lots and send notifications

### Registration
- **File**: `src/app.js`
- **Import**: `import "./cron/groceryExpiryCron.js"`

---

## 📊 Database Schema

### GroceryStockLot
```prisma
model GroceryStockLot {
  lot_id        String    @id @default(uuid())
  owner_id      String
  product_id    String
  supplier_id   String
  qty_in        Decimal   @db.Decimal(10, 3)
  qty_remaining Decimal   @db.Decimal(10, 3)
  cp            Decimal   @db.Decimal(10, 2)
  sp            Decimal   @db.Decimal(10, 2)
  batch_no      String?
  expiry_date   DateTime? // ✅ Used for expiry notifications
  notes         String?
  barcode       String?   @unique
  barcode_image_url String?
  created_at    DateTime  @default(now())
  // ... relations
}
```

### GroceryNotification
```prisma
model GroceryNotification {
  notification_id String    @id @default(uuid())
  owner_id        String
  type            String    // "EXPIRY_WARNING" or "LOW_STOCK"
  title           String
  message         String
  product_id      String?
  read_at         DateTime?
  created_at      DateTime  @default(now())
  // ... relations
}
```

---

## ✅ Testing

### Manual Test
1. Create a stock lot with expiry date 5 days from now
2. Wait for cron to run (or trigger manually)
3. Check notifications table
4. Verify FCM push notification received

### Test Query
```javascript
// Find lots expiring within 7 days
const expiringLots = await prisma.groceryStockLot.findMany({
  where: {
    owner_id: "your-owner-id",
    expiry_date: {
      gte: new Date(),
      lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    qty_remaining: { gt: 0 },
  },
  include: {
    product: true,
  },
});

console.log('Expiring lots:', expiringLots);
```

---

## 🎉 Benefits

✅ **Proactive Management**: Know about expiring products before it's too late  
✅ **Reduce Waste**: Take action to sell or return products  
✅ **Compliance**: Avoid selling expired products (legal requirement)  
✅ **Customer Safety**: Especially critical for medicines and food  
✅ **Better Planning**: Adjust purchasing based on expiry patterns  
✅ **Cost Savings**: Minimize losses from expired inventory  

---

**Implementation Date**: May 19, 2026  
**Status**: ✅ Complete and Active  
**Cron Schedule**: Daily at 9:00 AM (Asia/Kathmandu)
