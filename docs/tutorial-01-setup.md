# Tutorial 01: Setup

Run the OTC Automation Backend locally.

## Prerequisites

- Node.js 20.x LTS
- Docker and Docker Compose
- Git

## Steps

1. **Clone and enter backend**

   ```bash
   git clone https://github.com/mbaneshi/crypto-otc-automation-backend.git
   cd crypto-otc-automation-backend/backend
   ```

2. **Install and env**

   ```bash
   npm install
   cp .env.example .env
   ```

   Edit `.env` (DB, Redis, Binance/NPP/Sumsub if you have keys; defaults are fine for local).

3. **Start PostgreSQL and Redis**

   ```bash
   docker-compose up -d
   sleep 10
   ```

4. **Init database**

   ```bash
   docker exec -i otc-postgres psql -U postgres -d otc_platform < scripts/init-db.sql
   ```

5. **Run backend**

   ```bash
   npm run start:dev
   ```

API: [http://localhost:3000](http://localhost:3000). See [QUICKSTART.md](../QUICKSTART.md) for more options (e.g. PgAdmin).

## Next

- [Tutorial 02: First OTC order](tutorial-02-first-order.md)
- [Architecture](architecture.md)
- [Domain concepts](domain-concepts.md)
