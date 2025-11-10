# OTC Automation Backend - Technical Requirements

## 1. TECHNICAL SPECIFICATIONS

### 1.1 Technology Stack

**Backend:**
- **Runtime:** Node.js 20.x LTS or Python 3.11+
- **Framework:**
  - Node.js: NestJS 10.x (recommended) or Express.js 4.x
  - Python: FastAPI 0.104+ or Django 4.2+
- **Language:** TypeScript 5.x (if Node.js) or Python
- **API Style:** RESTful + WebSocket for real-time updates

**Database:**
- **Primary:** PostgreSQL 16.x (ACID compliance for financial transactions)
- **Cache:** Redis 7.x (session management, queue, real-time data)
- **Search:** (Optional) Elasticsearch 8.x for transaction search

**Message Queue:**
- BullMQ 4.x (if Node.js) or Celery 5.x (if Python)
- For async order processing and reconciliation jobs

**Infrastructure:**
- Docker & Docker Compose
- AWS/GCP/Azure (multi-region deployment)
- Load Balancer: Nginx or AWS ALB
- CDN: CloudFlare

### 1.2 Multi-Tenant Architecture

```
┌─────────────────────────────────────┐
│         API Gateway / LB            │
└──────────────┬──────────────────────┘
               │
    ┌──────────┴──────────┐
    │   Tenant Resolver    │ (by subdomain/API key)
    └──────────┬───────────┘
               │
    ┌──────────┴───────────┐
    │  Application Layer    │
    │  (Business Logic)     │
    └──────────┬───────────┘
               │
    ┌──────────┴───────────┐
    │   Data Access Layer   │
    │  (Tenant Isolation)   │
    └──────────┬───────────┘
               │
    ┌──────────┴───────────┐
    │  Shared Database      │
    │  (Schema per tenant)  │
    └───────────────────────┘
```

**Tenant Isolation Strategy:**
- **Database:** Separate schema per tenant (e.g., `tenant_abc`, `tenant_xyz`)
- **Storage:** S3 bucket prefixes per tenant
- **Cache:** Redis key prefixes (e.g., `tenant:abc:*`)
- **Configuration:** Tenant-specific config in dedicated table

### 1.3 External API Integrations

#### Binance P2P Merchant API
```typescript
interface BinanceP2PConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: 'https://api.binance.com' | 'https://testnet.binance.vision';
  webhookUrl: string; // For order status updates
}

// Key Endpoints
POST   /sapi/v1/c2c/ads/create          // Create P2P ad
GET    /sapi/v1/c2c/ads/list            // List ads
POST   /sapi/v1/c2c/orderMatch/confirm  // Confirm order
GET    /sapi/v1/c2c/orderMatch/listOrders // List orders
```

#### NPP (New Payments Platform) Integration
```typescript
interface NPPConfig {
  merchantId: string;
  apiKey: string;
  apiSecret: string;
  baseUrl: string; // NPP provider endpoint
  callbackUrl: string; // Payment status webhooks
}

// Key Operations
- PayID resolution
- Payment initiation (real-time)
- Payment status polling
- Webhook handling for payment events
```

#### Sumsub KYC/AML Integration
```typescript
interface SumsubConfig {
  appToken: string;
  secretKey: string;
  baseUrl: 'https://api.sumsub.com';
  webhookUrl: string;
  webhookSecret: string; // For signature verification
}

// Key Endpoints
POST   /resources/applicants              // Create applicant
POST   /resources/applicants/-/info/idDoc // Upload document
GET    /resources/applicants/-/status     // Get verification status
```

### 1.4 Database Schema (PostgreSQL)

**Core Tables:**

```sql
-- Tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  api_key VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, suspended, deleted
  config JSONB, -- Custom branding, fee structure, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users (per tenant schema)
CREATE SCHEMA IF NOT EXISTS tenant_abc;

CREATE TABLE tenant_abc.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- admin, operator, customer
  kyc_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  sumsub_applicant_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE tenant_abc.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES tenant_abc.users(id),
  binance_order_id VARCHAR(255),
  type VARCHAR(20) NOT NULL, -- buy, sell
  crypto_asset VARCHAR(10) NOT NULL, -- BTC, ETH, USDT
  fiat_currency VARCHAR(10) NOT NULL, -- AUD, USD
  crypto_amount DECIMAL(18, 8) NOT NULL,
  fiat_amount DECIMAL(18, 2) NOT NULL,
  price DECIMAL(18, 2) NOT NULL,
  status VARCHAR(50) NOT NULL, -- pending, processing, completed, failed, cancelled
  npp_payment_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments
CREATE TABLE tenant_abc.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES tenant_abc.orders(id),
  npp_transaction_id VARCHAR(255) UNIQUE,
  amount DECIMAL(18, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status VARCHAR(50) NOT NULL, -- pending, completed, failed, refunded
  payment_method VARCHAR(50), -- bank_transfer, payid
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ledger (Double-Entry Accounting)
CREATE TABLE tenant_abc.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account VARCHAR(100) NOT NULL, -- asset:bank, liability:customer, revenue:fees
  debit DECIMAL(18, 2) DEFAULT 0,
  credit DECIMAL(18, 2) DEFAULT 0,
  currency VARCHAR(10) NOT NULL,
  order_id UUID REFERENCES tenant_abc.orders(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_debit_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

-- Reconciliation
CREATE TABLE tenant_abc.reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  binance_balance DECIMAL(18, 8),
  npp_balance DECIMAL(18, 2),
  ledger_balance DECIMAL(18, 2),
  discrepancy DECIMAL(18, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- pending, matched, discrepancy_found, resolved
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhooks Log
CREATE TABLE tenant_abc.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL, -- binance, npp, sumsub
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 2. FUNCTIONAL REQUIREMENTS

### FR-001: Automated Order Execution
**User Story:** As an operator, orders should be automatically matched and executed via Binance P2P API.

**Acceptance Criteria:**
- When a customer places an order, system creates Binance P2P ad
- System monitors Binance for order matches
- Upon match, system confirms order and tracks status
- All order state changes logged to database
- Errors trigger alerts to operator dashboard

**Implementation:**
```typescript
// services/binance.service.ts
class BinanceService {
  async createP2PAd(order: Order): Promise<string> {
    // Create ad on Binance
    // Return ad ID
  }

  async confirmOrder(orderId: string): Promise<void> {
    // Confirm matched order
  }

  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    // Poll order status
  }
}
```

### FR-002: NPP Payment Processing
**User Story:** As a customer, I should be able to make instant AUD payments via NPP.

**Acceptance Criteria:**
- PayID resolution within 2 seconds
- Real-time payment initiation
- Payment status updates via webhook
- Automatic matching to orders
- Failed payments trigger refund workflow

### FR-003: KYC/AML Verification
**User Story:** As the system, all customers must complete KYC before trading.

**Acceptance Criteria:**
- New users redirected to Sumsub for verification
- Verification status updated via webhooks
- Trading blocked until KYC approved
- Ongoing monitoring for sanctions list
- Document expiry alerts

### FR-004: Multi-Tenant Isolation
**User Story:** As a franchisee, my data must be completely isolated from other tenants.

**Acceptance Criteria:**
- Each tenant has dedicated database schema
- API requests routed to correct tenant based on subdomain/API key
- No cross-tenant data leakage (validated by tests)
- Tenant-specific branding and configuration
- Independent access controls

### FR-005: Revenue Split Calculation
**User Story:** As the platform owner, revenue from each transaction should be automatically split per franchise agreement.

**Acceptance Criteria:**
- Commission calculated on each completed order
- Split recorded in ledger (franchisee portion, platform portion)
- Monthly revenue reports generated
- Automated payout scheduling

### FR-006: Double-Entry Ledger
**User Story:** As an accountant, all financial transactions must follow double-entry bookkeeping.

**Acceptance Criteria:**
- Every transaction has equal debits and credits
- Account balances always accurate
- Audit trail for all entries
- Reconciliation with external systems (Binance, NPP)

### FR-007: Automated Reconciliation
**User Story:** As an operator, system should automatically reconcile balances daily.

**Acceptance Criteria:**
- Daily reconciliation job at midnight
- Compare Binance balances, NPP balances, ledger balances
- Discrepancies flagged and alerted
- Reconciliation reports generated
- Manual reconciliation tools available

### FR-008: Operator Console
**User Story:** As an operator, I need a dashboard to monitor operations.

**Acceptance Criteria:**
- Real-time order status display
- Payment tracking
- Customer KYC status
- Revenue analytics
- Alert notifications

### FR-009: Admin Dashboard (Platform Owner)
**User Story:** As platform admin, I need to manage all franchisees.

**Acceptance Criteria:**
- View all tenants
- Approve/suspend tenants
- Configure commission rates
- Global analytics
- System health monitoring

### FR-010: Webhook Handling
**User Story:** As the system, all external webhooks must be processed reliably.

**Acceptance Criteria:**
- Webhook signature verification
- Idempotency (duplicate webhooks ignored)
- Retry logic for processing failures
- All webhooks logged
- Processing status tracked

## 3. IMPLEMENTATION GUIDE

### 3.1 Project Structure (NestJS)

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/
│   │   └── tenant.decorator.ts
│   ├── guards/
│   │   ├── auth.guard.ts
│   │   └── tenant.guard.ts
│   ├── interceptors/
│   │   └── tenant.interceptor.ts
│   └── filters/
│       └── http-exception.filter.ts
├── config/
│   ├── database.config.ts
│   ├── binance.config.ts
│   ├── npp.config.ts
│   └── sumsub.config.ts
├── modules/
│   ├── auth/
│   ├── tenants/
│   ├── orders/
│   ├── payments/
│   ├── kyc/
│   ├── ledger/
│   ├── reconciliation/
│   ├── webhooks/
│   ├── dashboard/
│   └── admin/
├── integrations/
│   ├── binance/
│   │   ├── binance.service.ts
│   │   ├── binance.module.ts
│   │   └── dto/
│   ├── npp/
│   │   ├── npp.service.ts
│   │   └── npp.module.ts
│   └── sumsub/
│       ├── sumsub.service.ts
│       └── sumsub.module.ts
├── database/
│   ├── migrations/
│   └── seeds/
└── jobs/
    ├── reconciliation.job.ts
    └── order-monitoring.job.ts
```

### 3.2 Tenant Resolution Middleware

```typescript
// common/interceptors/tenant.interceptor.ts
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantService: TenantService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();

    // Get tenant from subdomain or API key
    const subdomain = this.extractSubdomain(request);
    const apiKey = request.headers['x-api-key'];

    const tenant = await this.tenantService.resolveTenant(subdomain, apiKey);

    if (!tenant) {
      throw new UnauthorizedException('Invalid tenant');
    }

    // Attach tenant to request
    request.tenant = tenant;

    // Set database schema for this request
    await this.setDatabaseSchema(tenant.id);

    return next.handle();
  }

  private async setDatabaseSchema(tenantId: string) {
    // Execute: SET search_path TO tenant_<tenantId>, public;
  }
}
```

### 3.3 Binance P2P Integration

```typescript
// integrations/binance/binance.service.ts
@Injectable()
export class BinanceService {
  private readonly httpService: HttpService;

  async createP2PAd(params: CreateAdParams): Promise<AdResponse> {
    const timestamp = Date.now();
    const signature = this.generateSignature(params, timestamp);

    const response = await this.httpService.post(
      '/sapi/v1/c2c/ads/create',
      params,
      {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
        params: {
          timestamp,
          signature,
        },
      }
    ).toPromise();

    return response.data;
  }

  async handleOrderUpdate(webhook: BinanceWebhook): Promise<void> {
    // Verify webhook signature
    if (!this.verifyWebhookSignature(webhook)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Process order update
    await this.ordersService.updateOrderStatus(
      webhook.orderId,
      webhook.status
    );

    // Trigger payment if order confirmed
    if (webhook.status === 'CONFIRMED') {
      await this.initiatePayment(webhook.orderId);
    }
  }

  private generateSignature(params: any, timestamp: number): string {
    const queryString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const signString = `${queryString}&timestamp=${timestamp}`;

    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(signString)
      .digest('hex');
  }
}
```

### 3.4 Double-Entry Ledger Implementation

```typescript
// modules/ledger/ledger.service.ts
@Injectable()
export class LedgerService {
  async recordTransaction(transaction: Transaction): Promise<void> {
    // Double-entry: Debit one account, Credit another

    if (transaction.type === 'ORDER_PAYMENT') {
      // Customer pays fiat
      await this.createEntry({
        account: 'asset:bank',
        debit: transaction.amount,
        credit: 0,
        currency: transaction.currency,
        orderId: transaction.orderId,
        description: `Received ${transaction.amount} ${transaction.currency} from customer`,
      });

      await this.createEntry({
        account: 'liability:customer',
        debit: 0,
        credit: transaction.amount,
        currency: transaction.currency,
        orderId: transaction.orderId,
        description: `Customer deposit for order ${transaction.orderId}`,
      });
    }

    // Verify balance
    await this.verifyBalance();
  }

  private async verifyBalance(): Promise<void> {
    const result = await this.db.query(`
      SELECT
        SUM(debit) as total_debit,
        SUM(credit) as total_credit
      FROM ledger_entries
    `);

    if (result.total_debit !== result.total_credit) {
      throw new Error('Ledger imbalance detected!');
    }
  }

  async getAccountBalance(account: string, currency: string): Promise<number> {
    const result = await this.db.query(`
      SELECT
        SUM(debit) - SUM(credit) as balance
      FROM ledger_entries
      WHERE account = $1 AND currency = $2
    `, [account, currency]);

    return result.balance || 0;
  }
}
```

### 3.5 Automated Reconciliation Job

```typescript
// jobs/reconciliation.job.ts
@Injectable()
export class ReconciliationJob {
  @Cron('0 0 * * *') // Daily at midnight
  async runDailyReconciliation(): Promise<void> {
    const tenants = await this.tenantService.getAllActiveTenants();

    for (const tenant of tenants) {
      await this.reconcileTenant(tenant);
    }
  }

  private async reconcileTenant(tenant: Tenant): Promise<void> {
    // 1. Get Binance balances
    const binanceBalances = await this.binanceService.getBalances(tenant);

    // 2. Get NPP balances
    const nppBalances = await this.nppService.getBalances(tenant);

    // 3. Get Ledger balances
    const ledgerBalances = await this.ledgerService.getBalances(tenant);

    // 4. Compare
    const discrepancies = this.compareBalances(
      binanceBalances,
      nppBalances,
      ledgerBalances
    );

    // 5. Record reconciliation
    await this.reconciliationService.create({
      tenantId: tenant.id,
      date: new Date(),
      binanceBalances,
      nppBalances,
      ledgerBalances,
      discrepancies,
      status: discrepancies.length > 0 ? 'discrepancy_found' : 'matched',
    });

    // 6. Alert if discrepancies
    if (discrepancies.length > 0) {
      await this.alertService.sendDiscrepancyAlert(tenant, discrepancies);
    }
  }
}
```

## 4. SECURITY & COMPLIANCE

### 4.1 Authentication & Authorization

```typescript
// JWT-based authentication
// RBAC: admin, operator, customer
// Multi-factor authentication for admin users
// API key authentication for tenant access

@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('admin', 'operator')
@Controller('orders')
export class OrdersController {
  // Protected endpoints
}
```

### 4.2 Data Encryption

- **In Transit:** TLS 1.3 for all API communication
- **At Rest:** PostgreSQL encryption (AWS RDS encryption)
- **PII Fields:** Application-level encryption for sensitive data (AES-256)

### 4.3 KYC/AML Compliance

```typescript
// Before allowing any trade
async checkKYCStatus(userId: string): Promise<boolean> {
  const user = await this.usersService.findById(userId);

  if (user.kycStatus !== 'approved') {
    throw new ForbiddenException('KYC verification required');
  }

  // Check sanctions list
  const isSanctioned = await this.sumsubService.checkSanctions(userId);
  if (isSanctioned) {
    await this.usersService.suspendUser(userId, 'Sanctioned entity');
    throw new ForbiddenException('Account suspended');
  }

  return true;
}
```

### 4.4 Audit Logging

```typescript
// Log all critical operations
@Injectable()
export class AuditService {
  async log(event: AuditEvent): Promise<void> {
    await this.db.query(`
      INSERT INTO audit_logs (
        tenant_id, user_id, action, resource, metadata, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      event.tenantId,
      event.userId,
      event.action, // e.g., 'ORDER_CREATED', 'PAYMENT_PROCESSED'
      event.resource, // e.g., 'order:123'
      event.metadata,
      event.ipAddress,
    ]);
  }
}
```

## 5. TESTING REQUIREMENTS

### 5.1 Unit Tests
- Service layer: 80%+ coverage
- Controllers: 70%+ coverage
- Utilities: 90%+ coverage

### 5.2 Integration Tests
```typescript
describe('Order Flow Integration', () => {
  it('should create order, verify KYC, execute on Binance, process payment', async () => {
    // Given: User with approved KYC
    // When: User creates buy order
    // Then: Order created, Binance ad created, payment initiated
  });

  it('should reject order if KYC not approved', async () => {
    // Given: User without KYC
    // When: User creates order
    // Then: Order rejected with 403 error
  });
});
```

### 5.3 Security Tests
- SQL injection prevention
- XSS protection
- CSRF protection
- Rate limiting
- Tenant isolation validation

## 6. DEPLOYMENT

### 6.1 Environment Variables

```bash
# .env
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/otc_platform
REDIS_URL=redis://localhost:6379

# Binance
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret
BINANCE_BASE_URL=https://api.binance.com

# NPP
NPP_MERCHANT_ID=your_merchant_id
NPP_API_KEY=your_key
NPP_API_SECRET=your_secret

# Sumsub
SUMSUB_APP_TOKEN=your_token
SUMSUB_SECRET_KEY=your_secret

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRATION=1h

# Webhooks
WEBHOOK_SECRET=your_webhook_secret
```

### 6.2 Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["node", "dist/main.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/otc
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: otc
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

volumes:
  postgres_data:
```

### 6.3 Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificates installed
- [ ] Webhook endpoints configured (Binance, NPP, Sumsub)
- [ ] Monitoring setup (Datadog, New Relic, or Prometheus)
- [ ] Log aggregation (ELK Stack or CloudWatch)
- [ ] Backup strategy implemented (daily DB backups)
- [ ] Disaster recovery plan documented
- [ ] Load testing completed (handle 1000+ orders/hour)
- [ ] Security audit completed
- [ ] API documentation published (Swagger)
- [ ] Admin accounts created
- [ ] Tenant onboarding process tested

### 6.4 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          docker build -t otc-backend .
          docker push otc-backend:latest
          # Deploy to AWS/GCP/Azure
```

## 7. SUCCESS METRICS

- **Uptime:** 99.9%+
- **Order Processing:** <5 seconds average
- **Reconciliation Accuracy:** 100%
- **KYC Approval Time:** <24 hours
- **Payment Processing:** <30 seconds (NPP)
- **API Response Time:** <500ms (p95)
- **Transaction Success Rate:** >98%
- **Zero data leakage** between tenants

## 8. TIMELINE (12 weeks)

**Weeks 1-2:** Architecture, setup, multi-tenant foundation
**Weeks 3-4:** Binance & NPP integration
**Weeks 5-6:** Sumsub KYC & ledger system
**Weeks 7-8:** Reconciliation & operator console
**Weeks 9-10:** Admin dashboard & franchise features
**Weeks 11:** Testing & security audit
**Week 12:** Deployment & documentation

**Budget Reality:** This project scope realistically requires AU $30,000-$50,000 for proper implementation. The AU $5-10k budget is severely under-budgeted for an enterprise fintech system.
