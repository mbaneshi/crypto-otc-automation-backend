# Tutorial 02: First OTC order

Walk through creating and processing an OTC order (conceptual; exact endpoints depend on your tenant and API keys).

## Prerequisites

- [Tutorial 01: Setup](tutorial-01-setup.md) done; backend and DB running.
- Tenant created (via admin or seed) and API key or subdomain for tenant resolution.

## Flow

1. **Auth** — Obtain JWT via `/auth/login` (or register).
2. **Create order** — POST to orders API with amount, currency, side; backend creates order and may trigger Binance P2P creation if integrated.
3. **Payment** — When fiat (NPP) or payment is received, webhook or operator marks payment; backend matches payment to order.
4. **Settlement** — Ledger entries are written; order status → completed.
5. **Reconciliation** — Reconciliation job (or manual) matches trades and payments; discrepancies reported.

## API reference

See [backend/docs/API_SPECIFICATION.md](../backend/docs/API_SPECIFICATION.md) and [backend/docs/INTEGRATIONS.md](../backend/docs/INTEGRATIONS.md) for Binance, NPP, and Sumsub.

## Next

- [Domain concepts](domain-concepts.md)
- [ARCHITECTURE.md](../ARCHITECTURE.md)
