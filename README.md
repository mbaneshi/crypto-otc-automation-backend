# Crypto OTC Automation Backend

Multi-tenant backend for OTC (over-the-counter) crypto operations: Binance P2P, NPP fiat rails, Sumsub KYC, double-entry ledger, and reconciliation. For learners and engineers building institutional-style crypto trade lifecycle and risk tooling.

## Concepts

- **OTC (Over-The-Counter):** Trades agreed bilaterally (not on a public order book); order lifecycle, payment matching, settlement.
- **Order lifecycle:** Create → match → payment confirmation → settlement → reconciliation.
- **Double-entry ledger:** Every movement recorded as debits/credits; balances and audit trail.
- **Multi-tenant:** Per-tenant data isolation (e.g. per franchise); tenant resolution via subdomain or API key.
- **KYC/AML:** Identity verification and compliance (Sumsub); webhooks for status updates.

## Quick start

```bash
git clone https://github.com/mbaneshi/crypto-otc-automation-backend.git
cd crypto-otc-automation-backend/backend

npm install
cp .env.example .env
# Edit .env as needed

docker-compose up -d
sleep 10
docker exec -i otc-postgres psql -U postgres -d otc_platform < scripts/init-db.sql

npm run start:dev
```

API: [http://localhost:3000](http://localhost:3000). See [QUICKSTART.md](QUICKSTART.md) and [docs/tutorial-01-setup.md](docs/tutorial-01-setup.md).

## Documentation

| Doc | Description |
|-----|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System diagram, multi-tenant, integrations |
| [docs/architecture.md](docs/architecture.md) | Same (copy for docs/ layout) |
| [docs/domain-concepts.md](docs/domain-concepts.md) | OTC, ledger, reconciliation |
| [docs/tutorial-01-setup.md](docs/tutorial-01-setup.md) | Prerequisites and run locally |
| [docs/tutorial-02-first-order.md](docs/tutorial-02-first-order.md) | First OTC order flow |
| [backend/docs/API_SPECIFICATION.md](backend/docs/API_SPECIFICATION.md) | API reference |
| [backend/docs/INTEGRATIONS.md](backend/docs/INTEGRATIONS.md) | Binance, NPP, Sumsub |
| [backend/docs/DEPLOYMENT.md](backend/docs/DEPLOYMENT.md) | Deployment |

## Tech stack

- **Backend:** NestJS, TypeScript, PostgreSQL, Redis, Bull
- **Integrations:** Binance P2P, NPP, Sumsub (webhooks)

## License

MIT. Original project scope: [docs/ORIGINAL_SCOPE.md](docs/ORIGINAL_SCOPE.md).
