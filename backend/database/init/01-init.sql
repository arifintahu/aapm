-- AAPM Database Schema
-- This file initializes the PostgreSQL database with all required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) NOT NULL UNIQUE,
    smart_account_address VARCHAR(42),
    email VARCHAR(255),
    name VARCHAR(255),
    profile_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for users
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_smart_account_address ON users(smart_account_address) WHERE smart_account_address IS NOT NULL;
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;

-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(512) NOT NULL UNIQUE,
    smart_account_address VARCHAR(42),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for sessions
CREATE INDEX idx_sessions_token ON user_sessions(token);
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);

-- Events table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'RESOLVED')),
    result VARCHAR(3) CHECK (result IN ('YES', 'NO')),
    total_yes_bets DECIMAL(20, 6) DEFAULT 0,
    total_no_bets DECIMAL(20, 6) DEFAULT 0,
    total_pool DECIMAL(20, 6) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for events
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_created_at ON events(created_at);

-- Bet records table
CREATE TABLE bet_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    bet_type VARCHAR(3) NOT NULL CHECK (bet_type IN ('YES', 'NO')),
    amount DECIMAL(20, 6) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED'))
);

-- Create indexes for bet records
CREATE INDEX idx_bet_records_user_id ON bet_records(user_id);
CREATE INDEX idx_bet_records_event_id ON bet_records(event_id);
CREATE INDEX idx_bet_records_transaction_hash ON bet_records(transaction_hash);
CREATE INDEX idx_bet_records_timestamp ON bet_records(timestamp);
CREATE INDEX idx_bet_records_status ON bet_records(status);

-- Smart accounts table
CREATE TABLE smart_accounts (
    address VARCHAR(42) PRIMARY KEY,
    owner VARCHAR(42) NOT NULL,
    is_deployed BOOLEAN DEFAULT FALSE,
    nonce INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for smart accounts
CREATE INDEX idx_smart_accounts_owner ON smart_accounts(owner);
CREATE INDEX idx_smart_accounts_is_deployed ON smart_accounts(is_deployed);

-- Insert default event
INSERT INTO events (id, question, status, total_yes_bets, total_no_bets, total_pool) 
VALUES (1, 'Will ETH be above $3,000 by the end of this month?', 'ACTIVE', 0, 0, 0);

-- Update sequence for events to start from 2
SELECT setval('events_id_seq', 1, true);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for smart_accounts table
CREATE TRIGGER update_smart_accounts_updated_at 
    BEFORE UPDATE ON smart_accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create a function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (if needed for specific user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO aapm_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO aapm_user;