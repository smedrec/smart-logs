# Installation Guide

This guide will walk you through installing and setting up the `@repo/audit-db` package in your environment.

## Prerequisites

Before installing the package, ensure you have the following:

### Required Dependencies
- **Node.js**: Version 18 or higher
- **pnpm**: Version 10.15.1 or higher (used by the monorepo)
- **PostgreSQL**: Version 12 or higher

### Optional Dependencies (for advanced features)
- **Redis**: Version 6 or higher (for distributed caching)
- **Docker**: For containerized database setup

## Installation Methods

### Method 1: Monorepo Workspace Installation (Recommended)

If you're working within the smart-logs monorepo:

```bash
# From the monorepo root
pnpm install

# The package is already included in the workspace
```

### Method 2: Adding to Another Workspace Package

If you're adding this to another package within the monorepo:

```bash
# Navigate to your target package
cd apps/your-app
# or
cd packages/your-package

# Add the dependency
pnpm add '@repo/audit-db@workspace:*'
```

### Method 3: Standalone Installation

If you're using this package outside the monorepo (not recommended for internal use):

```bash
# Install from local workspace
pnpm add 'file:../packages/audit-db'
```

## Database Setup

### PostgreSQL Installation

#### Option 1: Using Docker (Recommended for Development)

```bash
# Using the provided docker-compose setup
cd packages/audit-db
docker-compose up -d

# This will start:
# - PostgreSQL on port 5432
# - Redis on port 6379 (if Redis features are needed)
```

#### Option 2: Local PostgreSQL Installation

**macOS (using Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from [PostgreSQL official website](https://www.postgresql.org/download/windows/)

### Database Configuration

1. **Create the audit database:**
```sql
-- Connect to PostgreSQL as superuser
CREATE DATABASE audit_db;
CREATE USER audit_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE audit_db TO audit_user;

-- Enable required extensions
\c audit_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- For performance monitoring
```

2. **Set up environment variables:**
```bash
# Development environment
export AUDIT_DB_URL="postgresql://audit_user:your_secure_password@localhost:5432/audit_db"

# Production environment (with SSL)
export AUDIT_DB_URL="postgresql://audit_user:your_secure_password@your-db-host:5432/audit_db?sslmode=require"
```

## Redis Setup (Optional - for Caching Features)

### Using Docker
```bash
# Start Redis container
docker run -d --name audit-redis -p 6379:6379 redis:7-alpine

# With persistence
docker run -d --name audit-redis \
  -p 6379:6379 \
  -v audit-redis-data:/data \
  redis:7-alpine redis-server --appendonly yes
```

### Local Installation

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt install redis-server
sudo systemctl start redis-server
```

### Redis Configuration
```bash
# Set Redis connection URL
export REDIS_URL="redis://localhost:6379"

# With authentication
export REDIS_URL="redis://username:password@host:port/database"
```

## Environment Configuration

### Development Environment

Create a `.env` file in your application root:

```env
# Database Configuration
AUDIT_DB_URL="postgresql://audit_user:password@localhost:5432/audit_db"

# Redis Configuration (optional)
REDIS_URL="redis://localhost:6379"

# Performance Settings
AUDIT_DB_POOL_MIN=2
AUDIT_DB_POOL_MAX=10
AUDIT_DB_POOL_IDLE_TIMEOUT=30000

# Caching Settings
AUDIT_CACHE_ENABLED=true
AUDIT_CACHE_TTL=300
AUDIT_CACHE_MAX_SIZE_MB=50

# Monitoring Settings
AUDIT_MONITORING_ENABLED=true
AUDIT_SLOW_QUERY_THRESHOLD=1000
```

### Production Environment

```env
# Database Configuration (with SSL)
AUDIT_DB_URL="postgresql://audit_user:secure_password@prod-db-host:5432/audit_db?sslmode=require"

# Redis Configuration (with TLS)
REDIS_URL="rediss://username:password@prod-redis-host:6380/0"

# Performance Settings
AUDIT_DB_POOL_MIN=5
AUDIT_DB_POOL_MAX=50
AUDIT_DB_POOL_IDLE_TIMEOUT=60000
AUDIT_DB_POOL_ACQUIRE_TIMEOUT=10000

# Caching Settings
AUDIT_CACHE_ENABLED=true
AUDIT_CACHE_TTL=900
AUDIT_CACHE_MAX_SIZE_MB=500
AUDIT_REDIS_CACHE_ENABLED=true
AUDIT_REDIS_LOCAL_CACHE_MB=100

# Monitoring Settings
AUDIT_MONITORING_ENABLED=true
AUDIT_SLOW_QUERY_THRESHOLD=500
AUDIT_AUTO_OPTIMIZATION=true

# Partitioning Settings
AUDIT_PARTITIONING_ENABLED=true
AUDIT_PARTITION_INTERVAL=monthly
AUDIT_RETENTION_DAYS=2555

# Compliance Settings
AUDIT_GDPR_ENABLED=true
AUDIT_HIPAA_ENABLED=true
AUDIT_INTEGRITY_VERIFICATION=true
```

## Database Schema Setup

### Automatic Setup (Recommended)

```bash
# Run database migrations
pnpm --filter @repo/audit-db audit-db:migrate

# Seed initial data (compliance policies, etc.)
pnpm --filter @repo/audit-db audit-db:seed-policies
```

### Manual Setup

```bash
# Generate migration files (if schema changes)
pnpm --filter @repo/audit-db audit-db:generate

# Apply migrations
pnpm --filter @repo/audit-db audit-db:migrate

# Open Drizzle Studio to verify setup
pnpm --filter @repo/audit-db audit-db:studio
```

## Verification

### 1. Basic Installation Verification

```typescript
// test-installation.ts
import { AuditDb } from '@repo/audit-db'

async function testInstallation() {
  try {
    const auditDb = new AuditDb()
    const isConnected = await auditDb.checkAuditDbConnection()
    
    if (isConnected) {
      console.log('✅ Database connection successful')
    } else {
      console.log('❌ Database connection failed')
    }
  } catch (error) {
    console.error('❌ Installation test failed:', error)
  }
}

testInstallation()
```

```bash
# Run the test
npx tsx test-installation.ts
```

### 2. Enhanced Features Verification

```typescript
// test-enhanced-features.ts
import { EnhancedAuditDb, createQueryCache } from '@repo/audit-db'

async function testEnhancedFeatures() {
  try {
    // Test enhanced client
    const enhancedDb = new EnhancedAuditDb({
      monitoring: { enabled: true }
    })
    
    const health = await enhancedDb.getHealthStatus()
    console.log('✅ Enhanced client working:', health.status)
    
    // Test Redis cache (if Redis is available)
    const cache = createQueryCache({
      type: 'redis',
      queryCache: { enabled: true }
    })
    
    await cache.set('test-key', { test: 'data' }, 60)
    const retrieved = await cache.get('test-key')
    
    if (retrieved) {
      console.log('✅ Redis caching working')
    }
    
  } catch (error) {
    console.error('❌ Enhanced features test failed:', error)
  }
}

testEnhancedFeatures()
```

### 3. CLI Tools Verification

```bash
# Test CLI installation
audit-db --version

# Test performance CLI
audit-db-performance --help

# Run health check
audit-db-performance client health
```

## Troubleshooting

### Common Issues

#### Database Connection Issues

**Issue**: `ECONNREFUSED` error
```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions**:
1. Ensure PostgreSQL is running: `sudo systemctl status postgresql`
2. Check connection string format
3. Verify database exists and user has permissions
4. Check firewall settings

#### Redis Connection Issues

**Issue**: Redis connection timeout
```bash
Error: Redis connection timeout
```

**Solutions**:
1. Ensure Redis is running: `redis-cli ping`
2. Check Redis URL format
3. Verify Redis is accepting connections: `redis-cli -h host -p port ping`

#### Permission Issues

**Issue**: Database permission denied
```bash
Error: permission denied for table audit_log
```

**Solutions**:
1. Grant proper permissions:
```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO audit_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO audit_user;
```

### Performance Tuning

#### PostgreSQL Configuration

For better performance, add to `postgresql.conf`:

```ini
# Connection settings
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB

# Performance monitoring
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
```

#### Redis Configuration

For production Redis setup, add to `redis.conf`:

```ini
# Memory management
maxmemory 1gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Security
requirepass your_redis_password
```

## Next Steps

Once installation is complete:

1. **[Quick Start Tutorial](./quick-start.md)** - Get familiar with basic operations
2. **[Configuration Guide](./configuration.md)** - Learn about configuration options
3. **[Basic Usage Tutorial](../tutorials/basic-usage.md)** - Explore common use cases

## Getting Help

If you encounter issues during installation:

1. Check the [Troubleshooting Guide](../guides/troubleshooting.md)
2. Review the [FAQ](../faq.md)
3. Check existing GitHub issues
4. Create a new issue with your environment details