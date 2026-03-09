# Quick Start Guide

Get the OTC Automation Backend running in 5 minutes.

## Prerequisites

- Node.js 20.x LTS
- Docker & Docker Compose
- Git

## Installation Steps

### 1. Navigate to Backend Directory

```bash
cd crypto-otc-automation-backend/backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your configuration (you can use the defaults for local development).

### 4. Start Services with Docker

```bash
docker-compose up -d
```

This starts:
- PostgreSQL database on port 5432
- Redis cache on port 6379
- PgAdmin on port 5050 (optional)

### 5. Initialize Database

```bash
# Wait for PostgreSQL to be ready (about 10 seconds)
sleep 10

# Initialize database with schema
docker exec -i otc-postgres psql -U postgres -d otc_platform < scripts/init-db.sql
```

### 6. Start the Backend

```bash
npm run start:dev
```

The backend will start on http://localhost:3000

### 7. Access API Documentation

Open your browser to:
```
http://localhost:3000/api/docs
```

You'll see the interactive Swagger API documentation.

## Verify Installation

### Check Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response: `{"status":"ok"}`

### Check Database Connection

```bash
# Connect to PostgreSQL
docker exec -it otc-postgres psql -U postgres -d otc_platform

# List tables
\dt

# Exit
\q
```

### Check Redis Connection

```bash
# Connect to Redis
docker exec -it otc-redis redis-cli

# Test
PING

# Exit
exit
```

## Create Your First Tenant

Currently, tenant creation requires database access. Here's how:

```bash
# Connect to PostgreSQL
docker exec -it otc-postgres psql -U postgres -d otc_platform

# Create a tenant
INSERT INTO tenants (name, subdomain, api_key, config) VALUES
('Demo Company', 'demo', 'demo_api_key_12345', '{
    "fees": {
        "platformFeePercent": 0.5,
        "franchiseeFeePercent": 1.0
    },
    "limits": {
        "minOrderAmount": 100,
        "maxOrderAmount": 50000
    }
}');

# Get the tenant ID
SELECT id, name, subdomain, api_key FROM tenants WHERE subdomain = 'demo';

# Create tenant schema (replace <tenant-id> with actual UUID)
SELECT create_tenant_schema('<tenant-id>');

# Exit
\q
```

Save the `api_key` for API requests.

## Test API Endpoints

### Using Tenant API Key

```bash
# Example: List orders (will be empty initially)
curl -X GET "http://localhost:3000/orders" \
  -H "X-API-Key: demo_api_key_12345"

# Example: With subdomain query parameter (for development)
curl -X GET "http://localhost:3000/orders?subdomain=demo"
```

## Useful Commands

### View Backend Logs

```bash
docker-compose logs -f backend
```

### View Database Logs

```bash
docker-compose logs -f postgres
```

### Stop All Services

```bash
docker-compose down
```

### Reset Everything

```bash
# Stop and remove all containers, volumes, and networks
docker-compose down -v

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Start fresh
docker-compose up -d
```

### Access PgAdmin

1. Open http://localhost:5050
2. Login with:
   - Email: admin@otc-platform.com
   - Password: admin
3. Add server:
   - Host: postgres
   - Port: 5432
   - Username: postgres
   - Password: password
   - Database: otc_platform

## Development Workflow

### Running in Development Mode

```bash
# Watch mode (auto-restart on changes)
npm run start:dev

# Debug mode
npm run start:debug
```

### Building for Production

```bash
npm run build
npm run start:prod
```

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Troubleshooting

### Port Already in Use

If you see "port already in use" errors:

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart PostgreSQL
docker-compose restart postgres

# Check PostgreSQL logs
docker-compose logs postgres
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker ps | grep redis

# Restart Redis
docker-compose restart redis

# Test Redis connection
docker exec -it otc-redis redis-cli ping
```

### Module Not Found Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json dist
npm install
```

## Next Steps

1. **Read the Documentation**
   - [README.md](backend/README.md) - Full project documentation
   - [DEPLOYMENT.md](backend/docs/DEPLOYMENT.md) - Deployment guide
   - [INTEGRATIONS.md](backend/docs/INTEGRATIONS.md) - Integration guide

2. **Configure External Integrations**
   - Set up Binance API keys
   - Configure NPP credentials
   - Set up Sumsub account

3. **Implement Remaining Modules**
   - Authentication module
   - Orders module
   - Payments module
   - See [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) for details

4. **Build Admin Dashboard**
   - Follow [admin-dashboard/README.md](admin-dashboard/README.md)

## Support

Need help? Check these resources:

- **Project Summary**: [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)
- **Requirements**: [REQUIREMENTS.md](REQUIREMENTS.md)
- **Issues**: Create an issue in your repository

## Quick Reference

### Important URLs (Local Development)

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3000 |
| API Docs | http://localhost:3000/api/docs |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| PgAdmin | http://localhost:5050 |

### Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| PostgreSQL | postgres | password |
| PgAdmin | admin@otc-platform.com | admin |

### Environment Files

- `.env` - Local development (git-ignored)
- `.env.example` - Template with all variables
- `.env.production` - Production config (git-ignored)

---

**You're all set!** The foundation is ready. Time to build the remaining modules and bring this platform to life.
