# Grocery Return Analytics API

## Overview
Simplified return analytics for grocery/pharmacy module (no condition tracking like clothing).

## Endpoint
```
GET /api/grocery/reports/return-analytics
```

## Authentication
Requires JWT token in Authorization header:
```
Authorization: Bearer <token>
```

## Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| start | string (ISO date) | No | 30 days ago | Start date for filtering |
| end | string (ISO date) | No | Today | End date for filtering |

## Response Structure

### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "date_range": {
      "start": "2026-04-17T00:00:00.000Z",
      "end": "2026-05-17T23:59:59.999Z"
    },
    "summary": {
      "total_returns": 15,
      "total_qty": 45.5,
      "total_refund": 12500.00,
      "return_value": 13200.00,
      "avg_return_value": 880.00
    },
    "top_products": [
      {
        "product_id": 123,
        "product_name": "Paracetamol 500mg Strip",
        "total_qty": 12.0,
        "return_value": 3600.00,
        "return_count": 5,
        "unit": "strips"
      },
      {
        "product_id": 456,
        "product_name": "Rice 25kg Bag",
        "total_qty": 8.0,
        "return_value": 4800.00,
        "return_count": 3,
        "unit": "bags"
      }
    ]
  }
}
```

## Response Fields

### date_range
- **start**: Start date of the analysis period (ISO 8601)
- **end**: End date of the analysis period (ISO 8601)

### summary
- **total_returns**: Total number of return transactions
- **total_qty**: Total quantity of items returned (supports decimals)
- **total_refund**: Total refund amount given to customers
- **return_value**: Total value of returned items (based on selling price)
- **avg_return_value**: Average return value per transaction

### top_products (Array)
Top 10 most returned products, sorted by quantity:
- **product_id**: Product identifier
- **product_name**: Name of the product
- **total_qty**: Total quantity returned for this product
- **return_value**: Total value of returns for this product
- **return_count**: Number of return transactions for this product
- **unit**: Unit of measurement (kg, strips, bottles, etc.)

## Example Requests

### Get returns for last 30 days (default)
```bash
GET /api/grocery/reports/return-analytics
Authorization: Bearer <token>
```

### Get returns for specific date range
```bash
GET /api/grocery/reports/return-analytics?start=2026-04-01&end=2026-04-30
Authorization: Bearer <token>
```

### Get returns for current month
```bash
GET /api/grocery/reports/return-analytics?start=2026-05-01&end=2026-05-17
Authorization: Bearer <token>
```

## Key Differences from Clothing Module

| Feature | Clothing | Grocery |
|---------|----------|---------|
| Condition Tracking | ✅ Yes (good/damaged) | ❌ No |
| Condition Breakdown | ✅ Yes | ❌ No |
| Always Restock | ❌ No (depends on condition) | ✅ Yes |
| Decimal Quantities | ❌ No (integer only) | ✅ Yes (2.5 kg, 1.75 L) |
| Unit Display | ❌ No | ✅ Yes |

## Business Use Cases

1. **Identify Problem Products**: See which products are returned most frequently
2. **Financial Impact**: Track total refund amounts and return values
3. **Inventory Planning**: Understand return patterns to adjust purchasing
4. **Quality Control**: High return rates may indicate quality issues
5. **Customer Satisfaction**: Monitor return trends over time

## Notes

- Returns are always restocked in grocery module (no condition check)
- Supports decimal quantities for weight-based items (kg, litres, etc.)
- Date range defaults to last 30 days if not specified
- Top products limited to 10 items
- All monetary values in system currency
- Quantities displayed with appropriate units

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error_code": "UNAUTHORIZED",
  "message": "Invalid or missing token"
}
```

### 500 Server Error
```json
{
  "success": false,
  "error_code": "SERVER_ERROR",
  "message": "Error message details"
}
```

## Implementation Files

- **Service**: `src/services/groceryReportService.js`
- **Controller**: `src/controllers/groceryReportController.js`
- **Routes**: `src/routes/groceryReportRoutes.js`
- **Registered in**: `src/app.js`
