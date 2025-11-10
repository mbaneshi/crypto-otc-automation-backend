# API Specification

Complete API specification for the OTC Automation Backend.

## Base URL

```
Development: http://localhost:3000
Production: https://api.otc-platform.com
```

## Authentication

### API Key Authentication (Tenant)

Include in request header:
```
X-API-Key: tenant_api_key_here
```

Or via subdomain query parameter (development only):
```
?subdomain=tenant_subdomain
```

### JWT Authentication (User)

Include in request header:
```
Authorization: Bearer <jwt_token>
```

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Pagination Response

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## API Endpoints

### Authentication

#### POST /auth/register
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+61412345678"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "customer",
      "kycStatus": "pending"
    },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

#### POST /auth/login
User login.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

#### POST /auth/refresh
Refresh access token.

**Request:**
```json
{
  "refreshToken": "refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_token",
    "refreshToken": "new_refresh_token"
  }
}
```

#### POST /auth/logout
User logout (invalidate tokens).

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Users

#### GET /users/me
Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Smith",
    "role": "customer",
    "kycStatus": "approved",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### PATCH /users/me
Update current user profile.

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+61412345678"
}
```

#### GET /users
List all users (admin/operator only).

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `role` - Filter by role
- `kycStatus` - Filter by KYC status
- `search` - Search by email or name

---

### Orders

#### POST /orders
Create a new order.

**Request:**
```json
{
  "type": "buy",
  "cryptoAsset": "USDT",
  "fiatCurrency": "AUD",
  "cryptoAmount": "1000.00",
  "price": "1.50"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "buy",
    "cryptoAsset": "USDT",
    "fiatCurrency": "AUD",
    "cryptoAmount": "1000.00",
    "fiatAmount": "1500.00",
    "price": "1.50",
    "status": "pending",
    "binanceAdId": "ad_123",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### GET /orders
List orders.

**Query Parameters:**
- `page` - Page number
- `limit` - Items per page
- `status` - Filter by status
- `type` - Filter by type (buy/sell)
- `userId` - Filter by user (admin only)
- `startDate` - Filter from date
- `endDate` - Filter to date

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "buy",
      "cryptoAsset": "USDT",
      "status": "completed",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": { ... }
}
```

#### GET /orders/:id
Get order details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    },
    "type": "buy",
    "cryptoAsset": "USDT",
    "fiatCurrency": "AUD",
    "cryptoAmount": "1000.00",
    "fiatAmount": "1500.00",
    "price": "1.50",
    "feeAmount": "15.00",
    "feePercent": "1.00",
    "status": "completed",
    "binanceOrderId": "B123456",
    "nppPaymentId": "NPP789",
    "payment": {
      "id": "uuid",
      "status": "completed",
      "transactionId": "NPP789"
    },
    "timeline": [
      {
        "status": "pending",
        "timestamp": "2024-01-15T10:30:00Z"
      },
      {
        "status": "payment_processing",
        "timestamp": "2024-01-15T10:31:00Z"
      },
      {
        "status": "completed",
        "timestamp": "2024-01-15T10:35:00Z"
      }
    ],
    "createdAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:35:00Z"
  }
}
```

#### POST /orders/:id/cancel
Cancel an order.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "cancelled"
  }
}
```

---

### Payments

#### GET /payments
List payments.

**Query Parameters:**
- `page` - Page number
- `limit` - Items per page
- `status` - Filter by status
- `orderId` - Filter by order

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "orderId": "uuid",
      "amount": "1500.00",
      "currency": "AUD",
      "status": "completed",
      "paymentMethod": "npp",
      "nppTransactionId": "NPP789",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": { ... }
}
```

#### GET /payments/:id
Get payment details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "order": {
      "id": "uuid",
      "cryptoAsset": "USDT"
    },
    "amount": "1500.00",
    "currency": "AUD",
    "status": "completed",
    "paymentMethod": "npp",
    "nppTransactionId": "NPP789",
    "payerName": "John Smith",
    "payeeAccount": "12345678",
    "metadata": { ... },
    "createdAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:35:00Z"
  }
}
```

#### POST /payments/:id/refund
Refund a payment.

**Request:**
```json
{
  "reason": "Customer request"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "refunded",
    "refundedAt": "2024-01-15T11:00:00Z"
  }
}
```

---

### KYC

#### POST /kyc/initiate
Initiate KYC verification.

**Response:**
```json
{
  "success": true,
  "data": {
    "applicantId": "sumsub_applicant_id",
    "accessToken": "sumsub_access_token",
    "status": "pending"
  }
}
```

#### GET /kyc/status
Get current user's KYC status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "approved",
    "applicantId": "sumsub_applicant_id",
    "reviewStatus": "completed",
    "approvedAt": "2024-01-15T10:00:00Z",
    "expiresAt": "2025-01-15T10:00:00Z"
  }
}
```

#### GET /kyc/status/:userId
Get KYC status for specific user (admin only).

---

### Ledger

#### GET /ledger/entries
List ledger entries.

**Query Parameters:**
- `page` - Page number
- `limit` - Items per page
- `account` - Filter by account
- `orderId` - Filter by order
- `startDate` - Filter from date
- `endDate` - Filter to date

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "account": "asset:bank",
      "debit": "1500.00",
      "credit": "0.00",
      "currency": "AUD",
      "orderId": "uuid",
      "description": "Payment received for order",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": { ... }
}
```

#### GET /ledger/balance/:account
Get account balance.

**Query Parameters:**
- `currency` - Currency code (optional, returns all if not specified)

**Response:**
```json
{
  "success": true,
  "data": {
    "account": "asset:bank",
    "balances": {
      "AUD": "150000.00",
      "USD": "100000.00"
    }
  }
}
```

#### GET /ledger/order/:orderId
Get all ledger entries for an order.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "account": "asset:bank",
      "debit": "1500.00",
      "credit": "0.00",
      "description": "Payment received"
    },
    {
      "id": "uuid",
      "account": "liability:customer",
      "debit": "0.00",
      "credit": "1500.00",
      "description": "Customer deposit"
    }
  ]
}
```

---

### Reconciliation

#### GET /reconciliation
List reconciliation records.

**Query Parameters:**
- `page` - Page number
- `limit` - Items per page
- `status` - Filter by status
- `startDate` - Filter from date
- `endDate` - Filter to date

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "date": "2024-01-15",
      "status": "matched",
      "binanceBalances": {
        "USDT": "10000.00",
        "BTC": "0.5"
      },
      "nppBalances": {
        "AUD": "150000.00"
      },
      "ledgerBalances": {
        "asset:bank": {
          "AUD": "150000.00"
        },
        "asset:crypto": {
          "USDT": "10000.00",
          "BTC": "0.5"
        }
      },
      "discrepancies": [],
      "createdAt": "2024-01-15T00:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

#### GET /reconciliation/:id
Get reconciliation details.

#### POST /reconciliation/manual
Run manual reconciliation.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "matched",
    "discrepancies": []
  }
}
```

---

### Dashboard

#### GET /dashboard/overview
Get dashboard overview statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalOrders": 1250,
    "totalRevenue": "187500.00",
    "activeTenants": 10,
    "successRate": 98.5,
    "recentOrders": [ ... ],
    "revenueData": [
      {
        "date": "2024-01-15",
        "revenue": "15000.00"
      }
    ]
  }
}
```

#### GET /dashboard/analytics
Get detailed analytics.

**Query Parameters:**
- `startDate` - From date
- `endDate` - To date
- `groupBy` - Group by day/week/month

---

### Admin (Platform Owner)

#### GET /admin/tenants
List all tenants.

#### POST /admin/tenants
Create new tenant.

**Request:**
```json
{
  "name": "Acme Corporation",
  "subdomain": "acme",
  "config": {
    "fees": {
      "platformFeePercent": 0.5,
      "franchiseeFeePercent": 1.0
    },
    "limits": {
      "minOrderAmount": 100,
      "maxOrderAmount": 50000
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Acme Corporation",
    "subdomain": "acme",
    "apiKey": "generated_api_key",
    "status": "active",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### PATCH /admin/tenants/:id
Update tenant.

#### POST /admin/tenants/:id/suspend
Suspend tenant.

#### POST /admin/tenants/:id/activate
Activate suspended tenant.

#### GET /admin/analytics/global
Get platform-wide analytics.

---

### Webhooks

#### POST /webhooks/binance
Binance webhook handler.

#### POST /webhooks/npp
NPP webhook handler.

#### POST /webhooks/sumsub
Sumsub webhook handler.

---

## WebSocket Events

### Connection

```javascript
const socket = io('ws://localhost:3000', {
  auth: {
    token: 'jwt_token'
  }
});
```

### Events

#### order:created
New order created.

```json
{
  "id": "uuid",
  "type": "buy",
  "status": "pending",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### order:updated
Order status updated.

```json
{
  "id": "uuid",
  "status": "completed",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

#### payment:completed
Payment completed.

```json
{
  "orderId": "uuid",
  "paymentId": "uuid",
  "amount": "1500.00"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| UNAUTHORIZED | Invalid or missing authentication |
| FORBIDDEN | Insufficient permissions |
| NOT_FOUND | Resource not found |
| VALIDATION_ERROR | Request validation failed |
| KYC_REQUIRED | KYC verification required |
| INSUFFICIENT_BALANCE | Insufficient account balance |
| ORDER_LIMIT_EXCEEDED | Order exceeds limits |
| PAYMENT_FAILED | Payment processing failed |
| INTEGRATION_ERROR | External service error |
| INTERNAL_ERROR | Internal server error |

---

## Rate Limits

| Endpoint | Rate Limit |
|----------|------------|
| Auth endpoints | 5 requests/minute |
| Order creation | 10 requests/minute |
| General API | 100 requests/minute |
| Webhooks | Unlimited |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```

---

## Testing

### Postman Collection

Import the Postman collection from: `/docs/postman/OTC-API.postman_collection.json`

### Example Requests

See `/docs/examples/` for complete request/response examples.

---

This specification provides a complete reference for all API endpoints to be implemented.
