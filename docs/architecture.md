# Architecture

Full system architecture is in the root [ARCHITECTURE.md](../ARCHITECTURE.md). Summary:

- **Clients:** Admin dashboard, operator panel, mobile/web app → REST/WebSocket.
- **NestJS:** Auth, Orders, Payments, KYC, Ledger, Reconciliation, Webhooks, Dashboard; integrations: Binance P2P, NPP, Sumsub.
- **Data:** PostgreSQL (multi-tenant schemas), Redis, Bull for jobs.
- **Tenant resolution:** Subdomain or API key → `search_path` set to tenant schema.

See [ARCHITECTURE.md](../ARCHITECTURE.md) for diagrams and request lifecycle.
