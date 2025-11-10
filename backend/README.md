# OTC Automation Backend

Multi-tenant OTC (Over-The-Counter) cryptocurrency automation platform with Binance P2P integration, NPP payment processing, and KYC verification.

## Features

- **Multi-Tenant Architecture**: Complete tenant isolation with separate database schemas
- **Binance P2P Integration**: Automated P2P ad creation and order management
- **NPP Payment Processing**: Real-time AUD payments via New Payments Platform
- **Sumsub KYC**: Automated KYC/AML verification workflow
- **Double-Entry Ledger**: Complete accounting system with automatic reconciliation
- **Real-Time Updates**: WebSocket support for live order and payment status
- **Comprehensive API**: RESTful API with Swagger documentation
- **Automated Reconciliation**: Daily balance reconciliation across all systems

## Technology Stack

- **Framework**: NestJS 10.x with TypeScript 5.x
- **Database**: PostgreSQL 16.x with TypeORM
- **Cache**: Redis 7.x with Bull queue
- **Authentication**: JWT with RBAC
- **API Documentation**: Swagger/OpenAPI
- **Containerization**: Docker & Docker Compose

## Getting Started

### Prerequisites

- Node.js 20.x LTS
- PostgreSQL 16.x
- Redis 7.x
- Docker & Docker Compose (optional)

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start services with Docker Compose**

```bash
docker-compose up -d
```

5. **Run database migrations**

```bash
npm run migration:run
```

6. **Start the development server**

```bash
npm run start:dev
```

The server will start on http://localhost:3000
API documentation available at http://localhost:3000/api/docs

### Alternative: Running with Docker

```bash
# Build and start all services
docker-compose up --build

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

## Project Structure

```
src/
├── main.ts                      # Application entry point
├── app.module.ts                # Root module
├── common/                      # Shared code
│   ├── decorators/              # Custom decorators
│   ├── guards/                  # Auth & permission guards
│   ├── interceptors/            # Request interceptors
│   └── filters/                 # Exception filters
├── config/                      # Configuration files
│   ├── database.config.ts
│   ├── binance.config.ts
│   ├── npp.config.ts
│   └── sumsub.config.ts
├── database/
│   ├── entities/                # TypeORM entities
│   ├── migrations/              # Database migrations
│   └── seeds/                   # Seed data
├── integrations/                # External API integrations
│   ├── binance/                 # Binance P2P API
│   ├── npp/                     # NPP payment API
│   └── sumsub/                  # Sumsub KYC API
├── modules/                     # Feature modules
│   ├── auth/                    # Authentication
│   ├── tenants/                 # Tenant management
│   ├── users/                   # User management
│   ├── orders/                  # Order processing
│   ├── payments/                # Payment processing
│   ├── kyc/                     # KYC verification
│   ├── ledger/                  # Double-entry ledger
│   ├── reconciliation/          # Reconciliation
│   ├── webhooks/                # Webhook handlers
│   ├── dashboard/               # Operator dashboard
│   └── admin/                   # Admin operations
└── jobs/                        # Scheduled jobs
    ├── reconciliation.job.ts
    └── order-monitoring.job.ts
```

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Refresh access token

### Tenants
- `GET /tenants` - List tenants (admin only)
- `POST /tenants` - Create tenant (admin only)
- `PATCH /tenants/:id` - Update tenant
- `DELETE /tenants/:id` - Delete tenant

### Orders
- `GET /orders` - List orders
- `POST /orders` - Create order
- `GET /orders/:id` - Get order details
- `PATCH /orders/:id` - Update order
- `POST /orders/:id/cancel` - Cancel order

### Payments
- `GET /payments` - List payments
- `GET /payments/:id` - Get payment details
- `POST /payments/:id/refund` - Refund payment

### KYC
- `POST /kyc/initiate` - Start KYC verification
- `GET /kyc/status/:userId` - Get KYC status
- `POST /kyc/webhook` - Sumsub webhook handler

### Ledger
- `GET /ledger/entries` - List ledger entries
- `GET /ledger/balance/:account` - Get account balance
- `GET /ledger/order/:orderId` - Get order ledger entries

### Reconciliation
- `GET /reconciliation` - List reconciliations
- `GET /reconciliation/:id` - Get reconciliation details
- `POST /reconciliation/manual` - Run manual reconciliation

### Webhooks
- `POST /webhooks/binance` - Binance webhook handler
- `POST /webhooks/npp` - NPP webhook handler
- `POST /webhooks/sumsub` - Sumsub webhook handler

## Multi-Tenant Architecture

### Tenant Identification

Tenants are identified by:
1. **Subdomain**: `tenant1.otc-platform.com`
2. **API Key**: `X-API-Key` header

### Schema Isolation

Each tenant has a dedicated PostgreSQL schema:
- `tenant_<uuid>` - Contains all tenant-specific tables
- `public` - Contains shared tables (tenants table)

### Request Flow

1. Request arrives at the API
2. TenantInterceptor extracts tenant identifier
3. Tenant is resolved from database
4. Database schema is switched to tenant schema
5. Request proceeds with tenant context
6. Response is returned

### Creating a New Tenant

```bash
POST /tenants
Content-Type: application/json
X-API-Key: <admin-api-key>

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

## Double-Entry Ledger

### Account Types

- **Assets**: `asset:bank`, `asset:crypto`
- **Liabilities**: `liability:customer`, `liability:customer_crypto`
- **Revenue**: `revenue:fees`, `revenue:commission`
- **Expenses**: `expense:refund`, `expense:chargeback`

### Example Transaction

When a customer pays for an order:

```typescript
// Debit: Bank asset increases
{
  account: 'asset:bank',
  debit: 1000.00,
  credit: 0,
  currency: 'AUD'
}

// Credit: Customer liability increases
{
  account: 'liability:customer',
  debit: 0,
  credit: 1000.00,
  currency: 'AUD'
}
```

### Balance Verification

The ledger automatically verifies that total debits equal total credits for each currency.

## Reconciliation

### Daily Reconciliation Job

Runs daily at midnight (configurable):

1. Fetch Binance balances for all crypto assets
2. Fetch NPP balances for all fiat currencies
3. Fetch ledger balances for all accounts
4. Compare and identify discrepancies
5. Create reconciliation record
6. Send alerts if discrepancies found

### Manual Reconciliation

```bash
POST /reconciliation/manual
X-API-Key: <tenant-api-key>
```

## Testing

### Unit Tests

```bash
npm run test
```

### Integration Tests

```bash
npm run test:e2e
```

### Test Coverage

```bash
npm run test:cov
```

## Deployment

### Environment Variables

See `.env.example` for all required environment variables.

### Production Deployment

1. **Build the application**

```bash
npm run build
```

2. **Run migrations**

```bash
npm run migration:run
```

3. **Start the production server**

```bash
npm run start:prod
```

### Docker Production Deployment

```bash
# Build production image
docker build -t otc-backend:latest .

# Run container
docker run -d \
  --name otc-backend \
  -p 3000:3000 \
  --env-file .env.production \
  otc-backend:latest
```

### Cloud Deployment

See `docs/DEPLOYMENT.md` for detailed cloud deployment guides for:
- AWS (ECS, RDS, ElastiCache)
- Google Cloud Platform (GKE, Cloud SQL, Memorystore)
- Azure (AKS, Azure Database, Redis Cache)

## Security

### Authentication

- JWT-based authentication with refresh tokens
- API key authentication for tenant access
- Multi-factor authentication for admin users

### Authorization

- Role-Based Access Control (RBAC)
- Tenant-level permission isolation
- Resource-level permissions

### Data Protection

- TLS 1.3 for all API communication
- Database encryption at rest
- Application-level encryption for PII (AES-256)
- Webhook signature verification

### Compliance

- KYC/AML verification via Sumsub
- Audit logging for all critical operations
- GDPR-compliant data handling

## Monitoring & Logging

### Health Check

```bash
GET /health
```

### Metrics

Metrics available at `/metrics` (Prometheus format)

### Logging

- Structured JSON logging
- Log levels: error, warn, info, debug
- Log aggregation via ELK Stack or CloudWatch

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Test connection
psql -h localhost -U postgres -d otc_platform
```

### Redis Connection Issues

```bash
# Check Redis is running
docker-compose ps redis

# Test connection
redis-cli ping
```

### Webhook Issues

1. Check webhook signature verification
2. Verify webhook URL is accessible
3. Check webhook logs in database
4. Review error messages in logs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

Proprietary - All rights reserved

## Support

For support, contact: support@otc-platform.com

## Documentation

- [API Documentation](http://localhost:3000/api/docs)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Security Guide](docs/SECURITY.md)
- [Integration Guide](docs/INTEGRATIONS.md)
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
