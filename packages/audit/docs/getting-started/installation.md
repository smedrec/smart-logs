# Installation Guide

This guide will walk you through installing and setting up the `@repo/audit` package in your healthcare application.

## 📋 Prerequisites

Before installing the audit package, ensure your environment meets these requirements:

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **pnpm**: Version 8.0.0 or higher (monorepo package manager)
- **PostgreSQL**: Version 12.0 or higher
- **Redis**: Version 6.0 or higher

### Required Services

The audit system depends on two external services:

1. **PostgreSQL Database**: For persistent audit log storage
2. **Redis**: For reliable message queuing with BullMQ

## 🚀 Installation Steps

### 1. Install Dependencies

Since `@repo/audit` is part of a monorepo, installation depends on your use case:

#### Option A: Using Within the Monorepo

If you're developing another package within the same monorepo:

```bash
# Navigate to your package directory
cd apps/your-app

# Add the audit dependency
pnpm add @repo/audit
```

#### Option B: External Package Installation

If you're using this in an external project:

```bash
# Install the audit package and required peer dependencies
pnpm add @repo/audit ioredis bullmq drizzle-orm
```

### 2. Database Setup

The audit system requires a PostgreSQL database with the proper schema:

#### Step 2.1: Database Creation

```sql
-- Connect to PostgreSQL and create the audit database
CREATE DATABASE smart_logs_audit;
```

#### Step 2.2: Apply Database Schema

```bash
# From the monorepo root, push the database schema
pnpm db:push
```

This will create all necessary tables:
- `audit_log` - Main audit events table
- `alerts` - System alerts and notifications
- `audit_retention_policy` - Data retention policies
- `audit_integrity_log` - Cryptographic integrity tracking

### 3. Redis Setup

Configure Redis for the audit queue system:

#### Local Development (Docker)

```bash
# Start Redis using Docker
docker run -d \
  --name audit-redis \
  -p 6379:6379 \
  redis:7-alpine
```

#### Production Setup

For production environments, configure Redis with persistence:

```bash
# Redis configuration for audit workloads
redis-server --appendonly yes --save 900 1 --save 300 10
```

### 4. Environment Configuration

Configure environment variables for your application:

#### Required Environment Variables

```bash
# Database connection
DATABASE_URL=postgresql://username:password@localhost:5432/smart_logs_audit

# Redis connection (shared)
REDIS_URL=redis://localhost:6379

# Optional: Dedicated audit Redis instance
AUDIT_REDIS_URL=redis://localhost:6379/1
```

#### Development Environment (.env)

Create a `.env` file in your application root:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/smart_logs_audit

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Audit Configuration
AUDIT_QUEUE_NAME=healthcare-audit
AUDIT_LOG_LEVEL=info

# Security Configuration
AUDIT_ENCRYPTION_KEY=your-32-character-encryption-key
AUDIT_SIGNING_SECRET=your-signing-secret-key
```

#### Production Environment

For production, use secure credential management:

```bash
# Use environment variables or secrets management
export DATABASE_URL="postgresql://user:pass@prod-db:5432/audit"
export REDIS_URL="redis://prod-redis:6379"
export AUDIT_ENCRYPTION_KEY="$(openssl rand -hex 32)"
export AUDIT_SIGNING_SECRET="$(openssl rand -hex 64)"
```

## 🔧 Package Configuration

### TypeScript Configuration

Ensure your `tsconfig.json` includes the audit package:

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": [
    "src/**/*",
    "node_modules/@repo/audit/dist/**/*"
  ]
}
```

### ESLint Configuration

Add audit package rules to your ESLint configuration:

```javascript
module.exports = {
  extends: ['@repo/eslint-config'],
  rules: {
    // Audit-specific rules
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_' 
    }]
  }
}
```

## ✅ Verification

Verify your installation with these steps:

### 1. Database Connection Test

```typescript
// test-db-connection.ts
import { db } from '@repo/audit-db'

async function testDatabaseConnection() {
  try {
    // Test database connection
    const result = await db.execute('SELECT 1 as test')
    console.log('✅ Database connection successful:', result)
  } catch (error) {
    console.error('❌ Database connection failed:', error)
  }
}

testDatabaseConnection()
```

### 2. Redis Connection Test

```typescript
// test-redis-connection.ts
import { getSharedRedisConnection } from '@repo/redis-client'

async function testRedisConnection() {
  try {
    const redis = getSharedRedisConnection()
    await redis.ping()
    console.log('✅ Redis connection successful')
  } catch (error) {
    console.error('❌ Redis connection failed:', error)
  }
}

testRedisConnection()
```

### 3. Audit Package Test

```typescript
// test-audit-package.ts
import { Audit } from '@repo/audit'
import { db } from '@repo/audit-db'

async function testAuditPackage() {
  try {
    const config = {
      version: '1.0',
      environment: 'test',
      reliableProcessor: {
        queueName: 'test-audit'
      }
    }
    
    const audit = new Audit(config, db)
    console.log('✅ Audit package loaded successfully')
    
    // Clean up
    await audit.closeConnection()
  } catch (error) {
    console.error('❌ Audit package test failed:', error)
  }
}

testAuditPackage()
```

## 🚨 Common Installation Issues

### Issue: Database Connection Errors

**Problem**: `connection refused` or `authentication failed`

**Solution**:
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify credentials
psql -h localhost -U your_user -d smart_logs_audit

# Check firewall/network settings
telnet localhost 5432
```

### Issue: Redis Connection Errors

**Problem**: Redis connection timeout or refused

**Solution**:
```bash
# Check Redis is running
redis-cli ping

# Verify Redis configuration
redis-cli config get "*"

# Check Redis logs
tail -f /var/log/redis/redis-server.log
```

### Issue: TypeScript Compilation Errors

**Problem**: Cannot find module `@repo/audit`

**Solution**:
```bash
# Rebuild TypeScript references
pnpm build

# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Issue: Permission Errors

**Problem**: Database or file permission errors

**Solution**:
```bash
# Check database permissions
GRANT ALL PRIVILEGES ON DATABASE smart_logs_audit TO your_user;

# Check file permissions
chmod 644 .env
chown user:group .env
```

## 📝 Next Steps

Once installation is complete:

1. **Configure the audit system**: [Configuration Guide](./configuration.md)
2. **Create your first audit event**: [First Audit Event](./first-audit-event.md)
3. **Explore healthcare-specific features**: [Healthcare Compliance Tutorial](../tutorials/healthcare-compliance.md)
4. **Set up monitoring**: [Monitoring Setup Tutorial](../tutorials/monitoring-setup.md)

## 💡 Pro Tips

- **Development**: Use Docker Compose for local services setup
- **Testing**: Set up separate test databases for each environment
- **Production**: Use managed services (AWS RDS, Redis ElastiCache) for reliability
- **Security**: Store credentials in environment variables or secrets management
- **Monitoring**: Set up health checks for database and Redis connections

Need help? Check the [Troubleshooting Guide](../troubleshooting/common-issues.md) for common solutions.