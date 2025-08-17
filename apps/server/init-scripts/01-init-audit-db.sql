-- Database initialization script for SMEDREC Audit Server
-- Creates necessary extensions and initial configuration

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create audit schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS audit;

-- Set default search path
ALTER DATABASE audit_db SET search_path TO audit, public;

-- Create audit user with limited privileges (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'audit_app_user') THEN
        CREATE ROLE audit_app_user WITH LOGIN PASSWORD 'audit_app_password';
    END IF;
END
$$;

-- Grant necessary permissions to audit_app_user
GRANT CONNECT ON DATABASE audit_db TO audit_app_user;
GRANT USAGE ON SCHEMA audit TO audit_app_user;
GRANT USAGE ON SCHEMA public TO audit_app_user;

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO audit_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT USAGE, SELECT ON SEQUENCES TO audit_app_user;

-- Create indexes for common query patterns (will be created by migrations, but good to have as backup)
-- These will be created by Drizzle migrations, but included here for reference

-- Performance optimization settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET log_statement = 'mod';
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_lock_waits = on;

-- Reload configuration
SELECT pg_reload_conf();