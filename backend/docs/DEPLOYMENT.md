# Deployment Guide

Complete deployment guide for the OTC Automation Backend system.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Docker Deployment](#docker-deployment)
5. [Cloud Deployment](#cloud-deployment)
6. [SSL Configuration](#ssl-configuration)
7. [Monitoring Setup](#monitoring-setup)
8. [Backup Strategy](#backup-strategy)
9. [Disaster Recovery](#disaster-recovery)

## Pre-Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations prepared
- [ ] SSL certificates obtained
- [ ] Webhook endpoints configured
- [ ] External API credentials verified
- [ ] Monitoring tools set up
- [ ] Log aggregation configured
- [ ] Backup strategy implemented
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] Documentation reviewed
- [ ] Team trained on operations

## Environment Configuration

### Production Environment Variables

Create `.env.production` file:

```bash
# Application
NODE_ENV=production
PORT=3000
APP_NAME=OTC Automation Backend

# Database
DATABASE_HOST=prod-db.example.com
DATABASE_PORT=5432
DATABASE_USER=otc_prod_user
DATABASE_PASSWORD=<strong-password>
DATABASE_NAME=otc_platform
DATABASE_SSL=true
DATABASE_LOGGING=false

# Redis
REDIS_HOST=prod-redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>
REDIS_DB=0

# JWT Authentication
JWT_SECRET=<generated-secret-256-bit>
JWT_EXPIRATION=1h
JWT_REFRESH_SECRET=<generated-secret-256-bit>
JWT_REFRESH_EXPIRATION=7d

# Binance P2P API
BINANCE_API_KEY=<production-api-key>
BINANCE_API_SECRET=<production-api-secret>
BINANCE_BASE_URL=https://api.binance.com
BINANCE_WEBHOOK_SECRET=<webhook-secret>

# NPP (New Payments Platform)
NPP_MERCHANT_ID=<merchant-id>
NPP_API_KEY=<api-key>
NPP_API_SECRET=<api-secret>
NPP_BASE_URL=https://api.npp-provider.com
NPP_CALLBACK_URL=https://api.otc-platform.com/webhooks/npp

# Sumsub KYC
SUMSUB_APP_TOKEN=<app-token>
SUMSUB_SECRET_KEY=<secret-key>
SUMSUB_BASE_URL=https://api.sumsub.com
SUMSUB_WEBHOOK_URL=https://api.otc-platform.com/webhooks/sumsub
SUMSUB_WEBHOOK_SECRET=<webhook-secret>

# Webhook Security
WEBHOOK_GLOBAL_SECRET=<global-webhook-secret>

# Encryption
ENCRYPTION_KEY=<32-character-encryption-key>
ENCRYPTION_ALGORITHM=aes-256-gcm

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGIN=https://dashboard.otc-platform.com,https://admin.otc-platform.com
CORS_CREDENTIALS=true

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/otc-backend

# Email (for alerts)
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=<sendgrid-api-key>
EMAIL_FROM=noreply@otc-platform.com

# Monitoring
SENTRY_DSN=<sentry-dsn>
```

### Generating Secrets

```bash
# Generate JWT secret (256-bit)
openssl rand -base64 32

# Generate encryption key (32 characters)
openssl rand -hex 16

# Generate webhook secret
openssl rand -hex 32
```

## Database Setup

### 1. Create Production Database

```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create database
CREATE DATABASE otc_platform;

-- Create user
CREATE USER otc_prod_user WITH ENCRYPTED PASSWORD '<strong-password>';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE otc_platform TO otc_prod_user;

-- Connect to database
\c otc_platform

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO otc_prod_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO otc_prod_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO otc_prod_user;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
```

### 2. Run Migrations

```bash
# Set production environment
export NODE_ENV=production

# Run migrations
npm run migration:run

# Verify migrations
npm run migration:show
```

### 3. Create Initial Tenant

```bash
# Connect to the backend container or server
docker exec -it otc-backend sh

# Run seed script
node dist/scripts/create-tenant.js \
  --name "Platform Admin" \
  --subdomain "admin" \
  --email "admin@otc-platform.com"
```

## Docker Deployment

### 1. Build Production Image

```bash
# Build the image
docker build -t otc-backend:1.0.0 -t otc-backend:latest .

# Test the image locally
docker run --rm -p 3000:3000 \
  --env-file .env.production \
  otc-backend:latest
```

### 2. Push to Registry

```bash
# Tag for your registry
docker tag otc-backend:1.0.0 registry.example.com/otc-backend:1.0.0

# Push to registry
docker push registry.example.com/otc-backend:1.0.0
docker push registry.example.com/otc-backend:latest
```

### 3. Deploy with Docker Compose

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  backend:
    image: registry.example.com/otc-backend:1.0.0
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: ${DATABASE_USER}
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
      POSTGRES_DB: ${DATABASE_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
```

## Cloud Deployment

### AWS Deployment

#### 1. Setup RDS PostgreSQL

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier otc-postgres \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 16.1 \
  --master-username otc_admin \
  --master-user-password <password> \
  --allocated-storage 100 \
  --storage-type gp3 \
  --backup-retention-period 7 \
  --multi-az \
  --publicly-accessible false \
  --vpc-security-group-ids sg-xxxxx
```

#### 2. Setup ElastiCache Redis

```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id otc-redis \
  --cache-node-type cache.t3.medium \
  --engine redis \
  --num-cache-nodes 1 \
  --port 6379
```

#### 3. Setup ECS Service

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name otc-cluster

# Create task definition
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster otc-cluster \
  --service-name otc-backend \
  --task-definition otc-backend:1 \
  --desired-count 2 \
  --launch-type FARGATE
```

#### 4. Setup Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name otc-alb \
  --subnets subnet-xxxxx subnet-yyyyy \
  --security-groups sg-xxxxx

# Create target group
aws elbv2 create-target-group \
  --name otc-backend-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxxxx \
  --health-check-path /health
```

### Google Cloud Platform Deployment

#### 1. Setup Cloud SQL

```bash
# Create Cloud SQL instance
gcloud sql instances create otc-postgres \
  --database-version=POSTGRES_16 \
  --tier=db-n1-standard-2 \
  --region=us-central1 \
  --backup \
  --enable-bin-log
```

#### 2. Setup Memorystore Redis

```bash
# Create Redis instance
gcloud redis instances create otc-redis \
  --size=5 \
  --region=us-central1 \
  --redis-version=redis_7_0
```

#### 3. Deploy to Google Kubernetes Engine

```bash
# Create GKE cluster
gcloud container clusters create otc-cluster \
  --num-nodes=3 \
  --machine-type=n1-standard-2 \
  --region=us-central1

# Deploy application
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

### Azure Deployment

#### 1. Setup Azure Database for PostgreSQL

```bash
# Create PostgreSQL server
az postgres server create \
  --resource-group otc-rg \
  --name otc-postgres \
  --location westus2 \
  --admin-user otc_admin \
  --admin-password <password> \
  --sku-name GP_Gen5_2 \
  --version 16
```

#### 2. Setup Azure Cache for Redis

```bash
# Create Redis cache
az redis create \
  --resource-group otc-rg \
  --name otc-redis \
  --location westus2 \
  --sku Standard \
  --vm-size c1
```

#### 3. Deploy to Azure Kubernetes Service

```bash
# Create AKS cluster
az aks create \
  --resource-group otc-rg \
  --name otc-cluster \
  --node-count 3 \
  --node-vm-size Standard_D2s_v3 \
  --enable-managed-identity

# Deploy application
kubectl apply -f k8s/deployment.yaml
```

## SSL Configuration

### Using Let's Encrypt with Certbot

```bash
# Install Certbot
apt-get install certbot python3-certbot-nginx

# Obtain certificate
certbot --nginx -d api.otc-platform.com

# Auto-renewal
certbot renew --dry-run
```

### Nginx SSL Configuration

```nginx
server {
    listen 80;
    server_name api.otc-platform.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.otc-platform.com;

    ssl_certificate /etc/letsencrypt/live/api.otc-platform.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.otc-platform.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring Setup

### 1. Setup Prometheus

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'otc-backend'
    static_configs:
      - targets: ['backend:3000']
```

### 2. Setup Grafana

```bash
# Deploy Grafana
docker run -d \
  --name grafana \
  -p 3001:3000 \
  -e "GF_SECURITY_ADMIN_PASSWORD=admin" \
  grafana/grafana
```

### 3. Setup Sentry

Add Sentry DSN to environment variables and the SDK will automatically capture errors.

## Backup Strategy

### Database Backups

```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/otc_platform_$DATE.sql"

pg_dump -h localhost -U postgres otc_platform > $BACKUP_FILE
gzip $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE.gz s3://otc-backups/postgres/

# Keep only last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
```

### Automated Backup with Cron

```bash
# Add to crontab
0 2 * * * /scripts/backup-database.sh
```

## Disaster Recovery

### Recovery Time Objective (RTO): 1 hour
### Recovery Point Objective (RPO): 24 hours

### Database Recovery

```bash
# Download latest backup from S3
aws s3 cp s3://otc-backups/postgres/latest.sql.gz .

# Decompress
gunzip latest.sql.gz

# Restore
psql -h localhost -U postgres otc_platform < latest.sql
```

### Full System Recovery

1. Provision new infrastructure
2. Restore database from backup
3. Deploy application from Docker registry
4. Update DNS records
5. Verify all services are running
6. Run smoke tests
7. Monitor for errors

## Post-Deployment Verification

```bash
# Check health endpoint
curl https://api.otc-platform.com/health

# Check API documentation
curl https://api.otc-platform.com/api/docs

# Test authentication
curl -X POST https://api.otc-platform.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Check logs
docker-compose logs -f backend

# Monitor metrics
curl https://api.otc-platform.com/metrics
```

## Rollback Procedure

```bash
# 1. Identify last working version
docker images | grep otc-backend

# 2. Stop current deployment
docker-compose down

# 3. Deploy previous version
docker-compose up -d otc-backend:1.0.0

# 4. Revert database migrations if needed
npm run migration:revert

# 5. Verify system is working
curl https://api.otc-platform.com/health
```

## Support Contacts

- **DevOps Team**: devops@otc-platform.com
- **Security Team**: security@otc-platform.com
- **On-Call Engineer**: +1-XXX-XXX-XXXX

## Additional Resources

- [AWS Best Practices](https://aws.amazon.com/architecture/well-architected/)
- [GCP Best Practices](https://cloud.google.com/architecture/framework)
- [Azure Best Practices](https://learn.microsoft.com/en-us/azure/architecture/best-practices/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)
