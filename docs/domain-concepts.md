# Domain concepts

## OTC (Over-The-Counter)

Trades agreed bilaterally between parties, not on a public order book. Typical flow: order creation → matching/counterparty → payment (fiat or crypto) → settlement → reconciliation. This backend automates that lifecycle and ties it to Binance P2P and NPP fiat rails.

## Order lifecycle

1. **Create** — Operator or client creates an OTC order (amount, currency, price).
2. **Match / execute** — Integration with Binance P2P (or similar) executes the crypto side.
3. **Payment** — Fiat (NPP) or payment confirmation is matched to the order.
4. **Settlement** — Ledger entries record the movement; order marked complete.
5. **Reconciliation** — Automated or manual checks that trades, payments, and ledger align.

## Double-entry ledger

Every financial event is recorded as two (or more) entries: debits and credits across accounts (e.g. customer, operating, revenue). Balances are derived from the sum of entries; full audit trail. Used here for multi-currency and per-tenant correctness.

## Multi-tenant

Multiple independent operators (tenants) share one codebase and infra; data is isolated per tenant (e.g. per PostgreSQL schema). Tenant is resolved from subdomain or API key; all queries run in that tenant’s schema.

## KYC/AML

Identity verification and compliance (Sumsub): document checks, risk scoring, sanctions screening. Webhooks notify the backend when verification completes or fails so orders can be gated on KYC status.
