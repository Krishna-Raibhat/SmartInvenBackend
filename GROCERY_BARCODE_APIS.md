# Grocery Barcode APIs - Complete

## ✅ All Barcode APIs Implemented

Grocery now has **all the same barcode APIs as clothing**!

---

## 📡 Available Endpoints

### 1. Create Stock Lot (with Barcode)
```
POST /api/grocery/stock-lots
```

**Request Body:**
```json
{
  "product_id": "uuid",
  "supplier_id": "uuid",
  "qty_in": 100,
  "cp": 50.00,
  "sp": 75.00,
  "batch_no": "BATCH-001",
  "expiry_date": "2025-12-31"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lot": {
      "lot_id": "...",
      "barcode": "LOT-L5K2M3N-AB4C",
      "barcode_image_url": "barcodes/....png",
      "qty_in": 100.0,
      "qty_remaining": 100.0,
      "cp": 50.00,
      "sp": 75.00,
      ...
    }
  }
}
```

---

### 2. Get All Stock Lots
```
GET /api/grocery/stock-lots
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "lot_id": "...",
      "barcode": "LOT-L5K2M3N-AB4C",
      "barcode_image_url": "barcodes/....png",
      ...
    }
  ]
}
```

---

### 3. ✨ Get Lot by Barcode Scan (NEW)
```
GET /api/grocery/stock-lots/scan/:barcode
```

**Example:**
```bash
GET /api/grocery/stock-lots/scan/LOT-L5K2M3N-AB4C
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lot_id": "...",
    "barcode": "LOT-L5K2M3N-AB4C",
    "barcode_image_url": "https://s3-np1.datahub.com.np/{BUCKET}/barcodes/....png",
    "qty_in": 100.0,
    "qty_remaining": 85.0,
    "cp": 50.00,
    "sp": 75.00,
    "batch_no": "BATCH-001",
    "expiry_date": "2025-12-31T00:00:00.000Z",
    "product": {
      "product_id": "...",
      "product_name": "Paracetamol 500mg",
      "category": { "category_name": "Medicine" },
      "brand": { "brand_name": "XYZ Pharma" },
      "unit": { "unit_name": "strips" }
    },
    "supplier": {
      "supplier_id": "...",
      "supplier_name": "ABC Suppliers",
      "phone": "9841234567"
    }
  }
}
```

**Use Case:**
- Scan barcode with scanner device
- Get complete lot details instantly
- Use for sales, inventory checks, returns

**Error Response (404):**
```json
{
  "success": false,
  "error_code": "LOT_NOT_FOUND",
  "message": "Lot not found for this barcode"
}
```

---

### 4. ✨ Get Barcode Image (NEW)
```
GET /api/grocery/stock-lots/:lot_id/barcode-image
```

**Example:**
```bash
GET /api/grocery/stock-lots/a1b2c3d4-e5f6-7890-abcd-ef1234567890/barcode-image
```

**Response:**
- **Content-Type**: `image/png`
- **Body**: PNG image stream (barcode image)

**Use Case:**
- Display barcode image in frontend
- Print barcode labels
- Download barcode for offline use

**Error Response (404):**
```json
{
  "success": false,
  "error_code": "NOT_FOUND",
  "message": "Barcode image not found"
}
```

---

### 5. Get Stock Lots by Product
```
GET /api/grocery/stock-lots/product/:product_id
```

---

### 6. Get Single Stock Lot by ID
```
GET /api/grocery/stock-lots/:lot_id
```

---

### 7. Update Stock Lot
```
PUT /api/grocery/stock-lots/:lot_id
```

---

### 8. Delete Stock Lot
```
DELETE /api/grocery/stock-lots/:lot_id
```

---

## 🎯 Frontend Integration Examples

### 1. Barcode Scanner Integration
```javascript
// Scan barcode and get lot details
async function scanBarcode(barcodeValue) {
  try {
    const response = await fetch(
      `/api/grocery/stock-lots/scan/${barcodeValue}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const { data } = await response.json();
    
    // Display lot details
    console.log('Product:', data.product.product_name);
    console.log('Remaining:', data.qty_remaining, data.product.unit.unit_name);
    console.log('Price:', data.sp);
    
    return data;
  } catch (error) {
    console.error('Barcode not found:', error);
  }
}
```

### 2. Display Barcode Image
```jsx
function BarcodeDisplay({ lotId }) {
  const barcodeImageUrl = `/api/grocery/stock-lots/${lotId}/barcode-image`;
  
  return (
    <div>
      <h3>Barcode</h3>
      <img 
        src={barcodeImageUrl} 
        alt="Barcode"
        style={{ width: '200px' }}
      />
    </div>
  );
}
```

### 3. Print Barcode Label
```javascript
function printBarcodeLabel(lot) {
  const barcodeImageUrl = `/api/grocery/stock-lots/${lot.lot_id}/barcode-image`;
  
  const printWindow = window.open('', '', 'width=400,height=300');
  printWindow.document.write(`
    <html>
      <head>
        <title>Barcode Label</title>
        <style>
          body { text-align: center; padding: 20px; font-family: Arial; }
          img { width: 250px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <h3>${lot.product.product_name}</h3>
        <p>Batch: ${lot.batch_no || 'N/A'}</p>
        <p>Expiry: ${lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString() : 'N/A'}</p>
        <img src="${barcodeImageUrl}" />
        <p><strong>${lot.barcode}</strong></p>
        <p>Price: Rs. ${lot.sp}</p>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}
```

### 4. Sales with Barcode Scanner
```javascript
async function addToCartByBarcode(barcodeValue) {
  try {
    // Scan and get lot details
    const response = await fetch(
      `/api/grocery/stock-lots/scan/${barcodeValue}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    const { data: lot } = await response.json();
    
    // Check if stock available
    if (lot.qty_remaining <= 0) {
      alert('Out of stock!');
      return;
    }
    
    // Add to cart
    addToCart({
      lot_id: lot.lot_id,
      product_id: lot.product.product_id,
      product_name: lot.product.product_name,
      unit: lot.product.unit.unit_name,
      price: lot.sp,
      available_qty: lot.qty_remaining,
      qty: 1 // Default quantity
    });
    
  } catch (error) {
    alert('Product not found!');
  }
}
```

---

## 🔍 Comparison with Clothing

| Feature | Clothing | Grocery | Status |
|---------|----------|---------|--------|
| Create with Barcode | ✅ | ✅ | Same |
| Get All Lots | ✅ | ✅ | Same |
| Scan by Barcode | ✅ | ✅ | ✅ **NEW** |
| Get Barcode Image | ✅ | ✅ | ✅ **NEW** |
| Barcode Format | Code128 | Code128 | Same |
| S3 Storage | ✅ | ✅ | Same |
| Unique Constraint | ✅ | ✅ | Same |

**Result**: Grocery now has **100% feature parity** with Clothing for barcode functionality!

---

## 📝 Implementation Files

### Service
- **File**: `src/services/groceryStockLotService.js`
- **New Method**: `getByBarcode(owner_id, barcode)`
- **Returns**: Lot with full S3 URL for barcode image

### Controller
- **File**: `src/controllers/groceryStockLotController.js`
- **New Methods**:
  - `getByBarcode()` - Scan barcode and get lot
  - `getBarcodeImage()` - Stream barcode image from S3

### Routes
- **File**: `src/routes/groceryStockLotRoutes.js`
- **New Routes**:
  - `GET /scan/:barcode` - Barcode scanning
  - `GET /:lot_id/barcode-image` - Image preview

---

## ✅ Ready to Use!

All barcode APIs are now **fully functional** for grocery module:
- ✅ Create stock lots with automatic barcode generation
- ✅ Scan barcodes to get lot details
- ✅ Display barcode images
- ✅ Print barcode labels
- ✅ Use in sales operations
- ✅ Track inventory by barcode

---

**Implementation Date**: May 19, 2026  
**Status**: ✅ Complete - All APIs Available
