# System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Applications                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐   │
│  │ Admin Dashboard│  │ Operator Panel │  │  Mobile/Web App    │   │
│  │   (React/Vue)  │  │   (React/Vue)  │  │    (Customer)      │   │
│  └────────┬───────┘  └────────┬───────┘  └─────────┬──────────┘   │
└───────────┼──────────────────┼───────────────────┼─────────────────┘
            │                   │                    │
            │              REST API / WebSocket      │
            └───────────────────┼────────────────────┘
                                │
        ┌───────────────────────▼────────────────────────┐
        │              API Gateway / Load Balancer        │
        │                   (Nginx/ALB)                   │
        └───────────────────────┬────────────────────────┘
                                │
        ┌───────────────────────▼────────────────────────┐
        │          Tenant Resolution Middleware           │
        │      (Subdomain/API Key → Tenant Context)       │
        └───────────────────────┬────────────────────────┘
                                │
┌───────────────────────────────┼────────────────────────────────────┐
│                    NestJS Application Layer                         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                     Core Modules                              │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │  │
│  │  │   Auth   │ │  Orders  │ │ Payments │ │   KYC    │       │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │  │
│  │  │  Ledger  │ │  Recon.  │ │ Webhooks │ │ Dashboard│       │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              External Integration Services                    │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │  │
│  │  │   Binance    │ │     NPP      │ │   Sumsub     │        │  │
│  │  │   P2P API    │ │  Payments    │ │     KYC      │        │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                  Background Jobs                              │  │
│  │  ┌─────────────────────┐  ┌───────────────────────┐         │  │
│  │  │   Reconciliation    │  │  Order Monitoring     │         │  │
│  │  │   (Daily @ 00:00)   │  │  (Every 5 minutes)    │         │  │
│  │  └─────────────────────┘  └───────────────────────┘         │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                      │
        ▼                     ▼                      ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  PostgreSQL  │      │    Redis     │      │  Bull Queue  │
│   Database   │      │    Cache     │      │   (Jobs)     │
│              │      │              │      │              │
│ Multi-Tenant │      │  Session +   │      │  Async Task  │
│   Schemas    │      │   Caching    │      │  Processing  │
└──────────────┘      └──────────────┘      └──────────────┘
```

## Multi-Tenant Data Isolation

```
PostgreSQL Database: otc_platform
├── public schema (shared)
│   └── tenants table
│       ├── id: UUID
│       ├── subdomain: unique
│       ├── api_key: unique
│       └── config: JSONB
│
├── tenant_<uuid_1> schema
│   ├── users
│   ├── orders
│   ├── payments
│   ├── ledger_entries
│   ├── reconciliations
│   ├── webhook_logs
│   └── audit_logs
│
├── tenant_<uuid_2> schema
│   ├── users
│   ├── orders
│   ├── ... (same structure)
│   └── audit_logs
│
└── tenant_<uuid_n> schema
    └── ... (same structure)

Request Flow:
1. Client → API with subdomain/API key
2. TenantInterceptor resolves tenant
3. SET search_path TO tenant_<uuid>, public
4. Query executes in tenant schema
5. Response returns to client
```

## Request Lifecycle

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. HTTP Request
       │    (with tenant identifier)
       ▼
┌─────────────────┐
│  Load Balancer  │
└──────┬──────────┘
       │ 2. Route to backend
       ▼
┌──────────────────────┐
│ Tenant Interceptor   │──────┐
│ - Extract identifier │      │ 3. Query public.tenants
│ - Validate tenant    │      │
│ - Switch schema      │◄─────┘
└──────┬───────────────┘
       │ 4. Schema set to tenant_<uuid>
       ▼
┌──────────────────────┐
│  Auth Guard          │
│ - Verify JWT/API key │
│ - Check permissions  │
└──────┬───────────────┘
       │ 5. User authenticated
       ▼
┌──────────────────────┐
│  Controller          │
│ - Validate input     │
│ - Call service       │
└──────┬───────────────┘
       │ 6. Business logic
       ▼
┌──────────────────────┐
│  Service Layer       │
│ - Business logic     │
│ - Call integrations  │
└──────┬───────────────┘
       │ 7. Data operations
       ▼
┌──────────────────────┐
│  Database            │
│ - Execute in tenant  │
│   schema context     │
└──────┬───────────────┘
       │ 8. Return data
       ▼
┌──────────────────────┐
│  Response            │
│ - Format response    │
│ - Add metadata       │
└──────┬───────────────┘
       │ 9. HTTP Response
       ▼
┌─────────────┐
│   Client    │
└─────────────┘
```

## Order Processing Flow

```
┌──────────────┐
│   Customer   │
│ Places Order │
└──────┬───────┘
       │ POST /orders
       ▼
┌─────────────────────────┐
│  Orders Service         │
│  1. Validate order      │
│  2. Check KYC status    │─────► If not approved → Reject
│  3. Check limits        │
└──────┬──────────────────┘
       │ Order validated
       ▼
┌─────────────────────────┐
│  Binance Service        │
│  1. Create P2P ad       │
│  2. Wait for match      │
└──────┬──────────────────┘
       │ Ad created
       ▼
┌─────────────────────────┐
│  Order Status:          │
│  binance_ad_created     │
└──────┬──────────────────┘
       │
       │ ◄─── Binance Webhook: Order matched
       ▼
┌─────────────────────────┐
│  NPP Service            │
│  1. Initiate payment    │
│  2. Wait for completion │
└──────┬──────────────────┘
       │ Payment initiated
       ▼
┌─────────────────────────┐
│  Order Status:          │
│  payment_pending        │
└──────┬──────────────────┘
       │
       │ ◄─── NPP Webhook: Payment completed
       ▼
┌─────────────────────────┐
│  Ledger Service         │
│  1. Record payment      │
│  2. Record fees         │
│  3. Verify balance      │
└──────┬──────────────────┘
       │ Ledger updated
       ▼
┌─────────────────────────┐
│  Binance Service        │
│  1. Confirm order       │
│  2. Release crypto      │
└──────┬──────────────────┘
       │ Crypto released
       ▼
┌─────────────────────────┐
│  Ledger Service         │
│  1. Record crypto out   │
│  2. Update customer bal │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Order Status:          │
│  completed              │
└──────┬──────────────────┘
       │ Notify customer
       ▼
┌──────────────┐
│   Customer   │
│ Receives     │
│ Crypto       │
└──────────────┘
```

## Double-Entry Ledger System

```
Example: Customer buys 1000 USDT for 1500 AUD

Transaction 1: Customer Payment Received
┌─────────────────────┬────────┬────────┬──────────┐
│ Account             │ Debit  │ Credit │ Currency │
├─────────────────────┼────────┼────────┼──────────┤
│ asset:bank          │ 1500   │ 0      │ AUD      │ ← Bank balance increases
│ liability:customer  │ 0      │ 1500   │ AUD      │ ← We owe customer
└─────────────────────┴────────┴────────┴──────────┘
Total: Debit = Credit = 1500 AUD ✓

Transaction 2: Platform Fee (1%)
┌─────────────────────┬────────┬────────┬──────────┐
│ Account             │ Debit  │ Credit │ Currency │
├─────────────────────┼────────┼────────┼──────────┤
│ revenue:fees        │ 15     │ 0      │ AUD      │ ← Fee revenue
│ asset:bank          │ 0      │ 15     │ AUD      │ ← Reduce bank asset
└─────────────────────┴────────┴────────┴──────────┘
Total: Debit = Credit = 15 AUD ✓

Transaction 3: Crypto Release
┌─────────────────────────┬────────┬────────┬──────────┐
│ Account                 │ Debit  │ Credit │ Currency │
├─────────────────────────┼────────┼────────┼──────────┤
│ liability:customer_cryp │ 1000   │ 0      │ USDT     │ ← We owe customer crypto
│ asset:crypto            │ 0      │ 1000   │ USDT     │ ← Crypto inventory decreases
└─────────────────────────┴────────┴────────┴──────────┘
Total: Debit = Credit = 1000 USDT ✓

Final Balances:
- asset:bank (AUD): +1500 -15 = +1485 AUD
- asset:crypto (USDT): -1000 USDT
- liability:customer (AUD): -1500 AUD
- liability:customer_crypto (USDT): +1000 USDT
- revenue:fees (AUD): +15 AUD
```

## Reconciliation Process

```
Daily @ 00:00 (Cron Job)
│
├─► 1. Fetch External Balances
│   ├─► Binance API
│   │   └─► { "USDT": "50000", "BTC": "1.5", ... }
│   │
│   └─► NPP Provider API
│       └─► { "AUD": "750000" }
│
├─► 2. Calculate Ledger Balances
│   └─► Query ledger_entries
│       └─► GROUP BY account, currency
│           └─► SUM(debit) - SUM(credit)
│
├─► 3. Compare Balances
│   ├─► Binance vs Ledger (asset:crypto)
│   │   └─► If mismatch → Record discrepancy
│   │
│   └─► NPP vs Ledger (asset:bank)
│       └─► If mismatch → Record discrepancy
│
├─► 4. Create Reconciliation Record
│   └─► INSERT INTO reconciliations
│       ├─► status: matched / discrepancy_found
│       ├─► discrepancies: []
│       └─► timestamp
│
└─► 5. Alert on Discrepancies
    ├─► Email to operations team
    ├─► Slack notification
    └─► Dashboard alert

Reconciliation Record Structure:
{
  "id": "uuid",
  "date": "2024-01-15",
  "status": "matched",
  "binanceBalances": {
    "USDT": "50000.00",
    "BTC": "1.5"
  },
  "nppBalances": {
    "AUD": "750000.00"
  },
  "ledgerBalances": {
    "asset:crypto": {
      "USDT": "50000.00",
      "BTC": "1.5"
    },
    "asset:bank": {
      "AUD": "750000.00"
    }
  },
  "discrepancies": []
}
```

## Webhook Processing

```
External Service (Binance/NPP/Sumsub)
│
│ Webhook Event
│
▼
┌──────────────────────────────────┐
│  POST /webhooks/{service}        │
│  1. Log raw payload              │
│  2. Verify signature             │
└────────┬─────────────────────────┘
         │
         ├─► Invalid signature → Reject (401)
         │
         ▼
┌──────────────────────────────────┐
│  Check Idempotency               │
│  - Query webhook_logs            │
│  - Check if already processed    │
└────────┬─────────────────────────┘
         │
         ├─► Already processed → Return success (200)
         │
         ▼
┌──────────────────────────────────┐
│  Save to webhook_logs            │
│  - source: binance/npp/sumsub    │
│  - event_type: order.completed   │
│  - payload: {...}                │
│  - processed: false              │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Process Webhook                 │
│  - Route to appropriate handler  │
│  - Update order/payment/kyc      │
│  - Trigger next steps            │
└────────┬─────────────────────────┘
         │
         ├─► Success → Mark processed
         │
         └─► Error → Retry with backoff
                     ├─► Retry 1: 1s delay
                     ├─► Retry 2: 2s delay
                     ├─► Retry 3: 4s delay
                     └─► After 3 retries → Alert ops

Final State:
webhook_logs {
  processed: true,
  processed_at: timestamp,
  retry_count: 0
}
```

## Security Layers

```
┌─────────────────────────────────────────┐
│         1. Network Security             │
│  - TLS 1.3 encryption                   │
│  - Firewall rules                       │
│  - DDoS protection                      │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│         2. API Gateway                  │
│  - Rate limiting                        │
│  - IP whitelisting                      │
│  - Request validation                   │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│    3. Tenant Isolation                  │
│  - Subdomain/API key validation         │
│  - Database schema separation           │
│  - No cross-tenant queries              │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│    4. Authentication                    │
│  - JWT with refresh tokens              │
│  - Password hashing (bcrypt)            │
│  - MFA for admin users                  │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│    5. Authorization                     │
│  - Role-Based Access Control (RBAC)     │
│  - Resource-level permissions           │
│  - KYC verification checks              │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│    6. Data Protection                   │
│  - Encryption at rest (AES-256)         │
│  - Encrypted database connections       │
│  - PII field-level encryption           │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│    7. Audit & Monitoring                │
│  - All actions logged                   │
│  - Real-time anomaly detection          │
│  - Automated alerts                     │
└─────────────────────────────────────────┘
```

## Deployment Architecture (Production)

```
                        Internet
                            │
                            ▼
                    ┌──────────────┐
                    │  CloudFlare  │ ← CDN + DDoS Protection
                    │     CDN      │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │     AWS      │
                    │ Route 53 DNS │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
       ┌──────▼──────┐          ┌──────▼──────┐
       │   Region 1  │          │   Region 2  │
       │  (Primary)  │          │  (Standby)  │
       └──────┬──────┘          └─────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼────┐      ┌───────▼────┐
│  ALB   │      │   WAF      │
│ (HTTPS)│      │ (Security) │
└───┬────┘      └────────────┘
    │
    ├─► ECS Cluster (Auto-scaling)
    │   ├─► Backend Container 1
    │   ├─► Backend Container 2
    │   └─► Backend Container N
    │
    ├─► RDS PostgreSQL (Multi-AZ)
    │   ├─► Primary Instance
    │   └─► Standby Instance
    │
    ├─► ElastiCache Redis (Cluster)
    │   ├─► Primary Node
    │   └─► Replica Nodes
    │
    └─► S3 + CloudFront
        └─► Admin Dashboard (Static)
```

## Technology Stack Summary

```
┌─────────────────────────────────────────────────────┐
│                   Frontend Layer                     │
│  ┌─────────────┐  ┌─────────────┐                  │
│  │   React 18  │  │   Vue 3     │ (Alternative)    │
│  │ TypeScript  │  │ TypeScript  │                  │
│  │ Material-UI │  │  Vuetify    │                  │
│  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                  Backend Layer                       │
│  ┌───────────────────────────────────────────┐     │
│  │         NestJS 10.x (TypeScript 5.x)      │     │
│  │  ┌──────────────────────────────────┐     │     │
│  │  │  Express.js HTTP Server          │     │     │
│  │  └──────────────────────────────────┘     │     │
│  │  ┌──────────────────────────────────┐     │     │
│  │  │  Socket.io WebSocket Server      │     │     │
│  │  └──────────────────────────────────┘     │     │
│  └───────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                   Data Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │ PostgreSQL  │  │    Redis    │  │  Bull Queue ││
│  │    16.x     │  │     7.x     │  │     4.x     ││
│  │  (TypeORM)  │  │  (Caching)  │  │   (Jobs)    ││
│  └─────────────┘  └─────────────┘  └─────────────┘│
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              External Integrations                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │   Binance   │  │     NPP     │  │   Sumsub    ││
│  │   P2P API   │  │   Payment   │  │     KYC     ││
│  └─────────────┘  └─────────────┘  └─────────────┘│
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                Infrastructure                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │   Docker    │  │   Nginx     │  │   AWS/GCP   ││
│  │ Kubernetes  │  │     SSL     │  │    Azure    ││
│  └─────────────┘  └─────────────┘  └─────────────┘│
└─────────────────────────────────────────────────────┘
```

---

This architecture document provides a comprehensive visual representation of the entire system structure and data flows.
