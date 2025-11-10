-- OTC Automation Backend - Database Initialization Script
-- This script creates the initial database structure for the multi-tenant platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create the main tenants table in the public schema
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on tenants
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON public.tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_api_key ON public.tenants(api_key);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);

-- Function to create tenant schema with all required tables
CREATE OR REPLACE FUNCTION create_tenant_schema(tenant_id UUID) RETURNS VOID AS $$
DECLARE
    schema_name TEXT;
BEGIN
    schema_name := 'tenant_' || REPLACE(tenant_id::TEXT, '-', '_');

    -- Create schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

    -- Create users table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            phone VARCHAR(20),
            role VARCHAR(50) NOT NULL DEFAULT ''customer'' CHECK (role IN (''admin'', ''operator'', ''customer'')),
            kyc_status VARCHAR(50) DEFAULT ''pending'' CHECK (kyc_status IN (''pending'', ''in_review'', ''approved'', ''rejected'', ''expired'')),
            sumsub_applicant_id VARCHAR(255),
            kyc_approved_at TIMESTAMP,
            kyc_expires_at TIMESTAMP,
            is_active BOOLEAN DEFAULT true,
            mfa_enabled BOOLEAN DEFAULT false,
            mfa_secret VARCHAR(255),
            last_login_at TIMESTAMP,
            last_login_ip VARCHAR(45),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- Create orders table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES %I.users(id),
            binance_order_id VARCHAR(255),
            binance_ad_id VARCHAR(255),
            type VARCHAR(20) NOT NULL CHECK (type IN (''buy'', ''sell'')),
            crypto_asset VARCHAR(10) NOT NULL,
            fiat_currency VARCHAR(10) NOT NULL,
            crypto_amount DECIMAL(18, 8) NOT NULL,
            fiat_amount DECIMAL(18, 2) NOT NULL,
            price DECIMAL(18, 2) NOT NULL,
            fee_amount DECIMAL(18, 2) DEFAULT 0,
            fee_percent DECIMAL(5, 2) DEFAULT 0,
            status VARCHAR(50) NOT NULL DEFAULT ''pending'',
            npp_payment_id VARCHAR(255),
            failure_reason TEXT,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )', schema_name, schema_name);

    -- Create payments table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID REFERENCES %I.orders(id),
            npp_transaction_id VARCHAR(255) UNIQUE,
            external_reference VARCHAR(255),
            amount DECIMAL(18, 2) NOT NULL,
            currency VARCHAR(10) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT ''pending'',
            payment_method VARCHAR(50) DEFAULT ''npp'',
            payer_name VARCHAR(255),
            payer_account VARCHAR(255),
            payee_name VARCHAR(255),
            payee_account VARCHAR(255),
            failure_reason TEXT,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )', schema_name, schema_name);

    -- Create ledger_entries table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.ledger_entries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            account VARCHAR(100) NOT NULL,
            debit DECIMAL(18, 2) DEFAULT 0,
            credit DECIMAL(18, 2) DEFAULT 0,
            currency VARCHAR(10) NOT NULL,
            order_id UUID REFERENCES %I.orders(id),
            reference_type VARCHAR(255),
            reference_id UUID,
            description TEXT,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT check_debit_credit CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
        )', schema_name, schema_name);

    -- Create reconciliations table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.reconciliations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            date DATE NOT NULL,
            binance_balances JSONB,
            npp_balances JSONB,
            ledger_balances JSONB,
            discrepancies JSONB,
            status VARCHAR(50) DEFAULT ''pending'' CHECK (status IN (''pending'', ''matched'', ''discrepancy_found'', ''resolved'')),
            notes TEXT,
            resolved_by UUID,
            resolved_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- Create webhook_logs table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.webhook_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source VARCHAR(50) NOT NULL CHECK (source IN (''binance'', ''npp'', ''sumsub'')),
            event_type VARCHAR(100) NOT NULL,
            payload JSONB NOT NULL,
            signature TEXT,
            processed BOOLEAN DEFAULT false,
            error_message TEXT,
            retry_count INTEGER DEFAULT 0,
            processed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- Create audit_logs table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            user_id UUID,
            action VARCHAR(100) NOT NULL,
            resource VARCHAR(100) NOT NULL,
            metadata JSONB,
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_users_email ON %I.users(email)', schema_name, schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_orders_user_id ON %I.orders(user_id)', schema_name, schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_orders_status ON %I.orders(status)', schema_name, schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_payments_order_id ON %I.payments(order_id)', schema_name, schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_ledger_account ON %I.ledger_entries(account)', schema_name, schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_ledger_order_id ON %I.ledger_entries(order_id)', schema_name, schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_webhooks_source ON %I.webhook_logs(source)', schema_name, schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_webhooks_processed ON %I.webhook_logs(processed)', schema_name, schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_audit_user_id ON %I.audit_logs(user_id)', schema_name, schema_name);

    RAISE NOTICE 'Tenant schema % created successfully', schema_name;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sample data (optional - for development)
-- Uncomment to insert sample tenant
/*
INSERT INTO public.tenants (name, subdomain, api_key, config) VALUES
('Demo Tenant', 'demo', 'demo_api_key_12345', '{
    "branding": {
        "logo": "https://example.com/logo.png",
        "primaryColor": "#0066cc",
        "secondaryColor": "#00cc66"
    },
    "fees": {
        "platformFeePercent": 0.5,
        "franchiseeFeePercent": 1.0
    },
    "limits": {
        "minOrderAmount": 100,
        "maxOrderAmount": 50000,
        "dailyLimit": 100000
    }
}');

-- Create schema for demo tenant
SELECT create_tenant_schema((SELECT id FROM public.tenants WHERE subdomain = 'demo'));
*/

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Database initialization completed!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run migrations: npm run migration:run';
    RAISE NOTICE '2. Create first tenant via API';
    RAISE NOTICE '3. Configure external integrations';
    RAISE NOTICE '========================================';
END $$;
