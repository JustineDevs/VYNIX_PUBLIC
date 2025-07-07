-- Testnet Automation Bot Database Schema
-- Run this in your Supabase SQL Editor

-- ALTER DATABASE postgres SET "app.jwt_secret" TO 'your_jwt_secret_key_here_make_it_long_and_secure';

-- Drop existing objects to ensure a clean run
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS wallet_status CASCADE;
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS task_type CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;

DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS network_configs CASCADE;
DROP TABLE IF EXISTS token_configs CASCADE;

-- Create custom types
CREATE TYPE user_role AS ENUM ('user', 'admin', 'premium');
CREATE TYPE wallet_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE task_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE task_type AS ENUM ('swap', 'transfer', 'liquidity', 'deploy', 'checkin');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE TYPE payment_method AS ENUM ('crypto', 'gcash', 'paymaya', 'coins', 'grabpay');

-- Users table
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallets table
CREATE TABLE wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    private_key_encrypted TEXT NOT NULL,
    network VARCHAR(50) NOT NULL,
    status wallet_status DEFAULT 'active',
    balance_decimal DECIMAL(30, 18) DEFAULT 0,
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activities table
CREATE TABLE activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    network VARCHAR(50) NOT NULL,
    description TEXT,
    tx_hash VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    type task_type NOT NULL,
    status task_status DEFAULT 'pending',
    network VARCHAR(50) NOT NULL,
    parameters JSONB NOT NULL,
    result JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    method payment_method NOT NULL,
    status payment_status DEFAULT 'pending',
    reference_id VARCHAR(255),
    payment_details JSONB,
    instructions TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    payment_id UUID REFERENCES payments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Network configurations table
CREATE TABLE network_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    chain_id INTEGER NOT NULL,
    rpc_url VARCHAR(500) NOT NULL,
    explorer_url VARCHAR(500),
    native_currency JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Token configurations table
CREATE TABLE token_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    network_id UUID REFERENCES network_configs(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    decimals INTEGER DEFAULT 18,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_network ON wallets(network);
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_network ON activities(network);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_network_configs_updated_at BEFORE UPDATE ON network_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default network configurations
INSERT INTO network_configs (name, chain_id, rpc_url, explorer_url, native_currency) VALUES
('Pharos Testnet', 1337, 'https://rpc.pharos.testnet', 'https://explorer.pharos.testnet', '{"name": "Pharos", "symbol": "PHR", "decimals": 18}'),
('Monad Testnet', 1338, 'https://rpc.monad.testnet', 'https://explorer.monad.testnet', '{"name": "Monad", "symbol": "MON", "decimals": 18}'),
('Ethereum Sepolia', 11155111, 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID', 'https://sepolia.etherscan.io', '{"name": "Ethereum", "symbol": "ETH", "decimals": 18}'),
('Polygon Mumbai', 80001, 'https://polygon-mumbai.infura.io/v3/YOUR_PROJECT_ID', 'https://mumbai.polygonscan.com', '{"name": "MATIC", "symbol": "MATIC", "decimals": 18}'),
('BSC Testnet', 97, 'https://data-seed-prebsc-1-s1.binance.org:8545', 'https://testnet.bscscan.com', '{"name": "BNB", "symbol": "tBNB", "decimals": 18}');

-- Insert default token configurations
INSERT INTO token_configs (network_id, symbol, name, address, decimals) 
SELECT 
    nc.id,
    'USDT',
    'Tether USD',
    '0x0000000000000000000000000000000000000000', -- Replace with actual USDT address
    6
FROM network_configs nc 
WHERE nc.name IN ('Pharos Testnet', 'Monad Testnet', 'Ethereum Sepolia', 'Polygon Mumbai', 'BSC Testnet');

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies before creating them
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view own wallets" ON wallets;
DROP POLICY IF EXISTS "Users can insert own wallets" ON wallets;
DROP POLICY IF EXISTS "Users can update own wallets" ON wallets;
DROP POLICY IF EXISTS "Users can delete own wallets" ON wallets;
DROP POLICY IF EXISTS "Users can view own activities" ON activities;
DROP POLICY IF EXISTS "Users can insert own activities" ON activities;
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON payments;
DROP POLICY IF EXISTS "Admins can manage all payments" ON payments;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Enable read access for all users" ON network_configs;
DROP POLICY IF EXISTS "Enable read access for all users" ON token_configs;

-- Create RLS policies
-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own wallets" ON wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallets" ON wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wallets" ON wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own wallets" ON wallets FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own activities" ON activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activities" ON activities FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Network and token configs are public (read-only)
CREATE POLICY "Anyone can view network configs" ON network_configs FOR SELECT USING (true);
CREATE POLICY "Anyone can view token configs" ON token_configs FOR SELECT USING (true);

-- Create a function to get user dashboard stats
CREATE OR REPLACE FUNCTION get_user_dashboard_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_wallets', (SELECT COUNT(*) FROM wallets WHERE user_id = user_uuid),
        'active_tasks', (SELECT COUNT(*) FROM tasks WHERE user_id = user_uuid AND status IN ('pending', 'running')),
        'completed_tasks', (SELECT COUNT(*) FROM tasks WHERE user_id = user_uuid AND status = 'completed'),
        'total_activities', (SELECT COUNT(*) FROM activities WHERE user_id = user_uuid),
        'recent_activities', (
            SELECT json_agg(
                json_build_object(
                    'id', a.id,
                    'type', a.type,
                    'network', a.network,
                    'status', a.status,
                    'created_at', a.created_at
                )
            )
            FROM activities a 
            WHERE a.user_id = user_uuid 
            ORDER BY a.created_at DESC 
            LIMIT 5
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 