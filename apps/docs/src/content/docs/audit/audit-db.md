---
title: Audit Database
description: Comprehensive audit database client with advanced performance optimization, Redis-based distributed caching, compliance management, and cryptographic integrity verification.
sidebar_position: 2
---

# `@repo/audit-db`

The `@repo/audit-db` package is a powerful, feature-rich audit database client designed specifically for healthcare applications requiring HIPAA and GDPR compliance. It provides advanced performance optimization, Redis-based distributed caching, compliance management, cryptographic integrity verification, and comprehensive audit logging capabilities.

## 🚀 Key Features

### Core Database Functionality
- **Multiple Client Types**: Basic, configured, and enhanced database clients for different use cases
- **Drizzle ORM Integration**: Type-safe database operations with PostgreSQL
- **Transaction Support**: Comprehensive transaction management with rollback capabilities
- **Schema Management**: Automated migrations and schema validation

### Performance Optimization
- **Enhanced Connection Pooling**: Advanced connection management with real-time monitoring
- **Query Performance Monitoring**: Slow query detection and optimization recommendations
- **Database Partitioning**: Time-based range partitioning for large audit datasets
- **Index Optimization**: Automated index analysis and optimization

### Distributed Caching
- **Redis-Based Caching**: Distributed query caching across multiple instances
- **L1/L2 Cache Strategy**: Local memory + Redis hybrid caching architecture
- **Cache Invalidation**: Intelligent TTL-based and manual cache invalidation
- **Performance Analytics**: Cache hit rates and performance metrics tracking

### Compliance & Security
- **GDPR/HIPAA Compliance**: Built-in compliance features and automated reporting
- **Cryptographic Integrity**: SHA-256 hashing and HMAC verification for audit trails
- **Data Retention**: Automated data archival and retention policies
- **Audit Trails**: Comprehensive audit logging with tamper-proof integrity verification

### Monitoring & Observability
- **Health Monitoring**: Real-time database and cache health status
- **Performance Metrics**: Comprehensive performance tracking and analysis
- **Alerting**: Configurable alerts for performance and compliance issues
- **CLI Tools**: Command-line utilities for monitoring and optimization

## Purpose & Use Cases

- **Healthcare Audit Logging**: HIPAA-compliant audit trails for patient data access and medical records
- **Regulatory Compliance**: GDPR compliance with automated data subject rights management
- **High-Performance Applications**: Optimized for high-throughput audit logging with minimal latency
- **Enterprise Security**: Cryptographic integrity verification and tamper detection
- **Multi-Service Architecture**: Centralized audit database for microservices ecosystems

## Quick Installation

### For Monorepo Usage
To use `@repo/audit-db` in another package within your monorepo:

```bash
# Navigate to your app's or package's directory
cd apps/your-app # or packages/your-package

# Add @repo/audit-db using pnpm, ensuring it links to the workspace version
pnpm add '@repo/audit-db@workspace:*'
```

### For External Projects
If using this package in an external project:

```bash
# Install via npm/pnpm (when published)
npm install @repo/audit-db
# or
pnpm add @repo/audit-db
```

### System Requirements

- **Node.js**: 18+ (compatible with the monorepo setup)
- **PostgreSQL**: 12+ (for database storage)
- **Redis**: 6+ (for distributed caching, optional but recommended)
- **pnpm**: 10+ (package manager for monorepo development)

## Quick Setup

### Environment Variables

Configure your environment with these essential variables:

```env
# Required: Database connection
AUDIT_DB_URL="postgresql://user:password@host:port/database"

# Optional: Redis for caching (recommended for production)
REDIS_URL="redis://localhost:6379"

# Optional: Connection pool settings
AUDIT_DB_POOL_MIN=2
AUDIT_DB_POOL_MAX=10

# Optional: Performance monitoring
AUDIT_MONITORING_ENABLED=true
AUDIT_SLOW_QUERY_THRESHOLD=1000

# Optional: Compliance settings
AUDIT_GDPR_ENABLED=true
AUDIT_HIPAA_ENABLED=true
```

### Quick Start Example

```typescript
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

// Basic setup
const auditDb = new AuditDb()
const db = auditDb.getDrizzleInstance()

// Log an audit event
await db.insert(auditLog).values({
  timestamp: new Date().toISOString(),
  action: 'patient.record.access',
  status: 'success',
  principalId: 'doctor-123',
  resourceType: 'PatientRecord',
  resourceId: 'patient-456'
})
```

## Client Types Overview

The package provides three client types for different use cases:

| Client Type | Use Case | Features |
|-------------|----------|----------|
| **`AuditDb`** | Basic operations | Simple connection, basic queries |
| **`AuditDbWithConfig`** | Configured setup | Connection pooling, basic optimization |
| **`EnhancedAuditDb`** | Enterprise/Production | Full feature set with caching, monitoring, compliance |

## Basic Client: `AuditDb`

Perfect for simple applications and getting started quickly.

### Constructor

```typescript
new AuditDb(postgresUrl?: string)
```

**Parameters:**
- `postgresUrl` (optional): PostgreSQL connection URL. Uses `AUDIT_DB_URL` environment variable if not provided.

**Example:**

```typescript
import { AuditDb } from '@repo/audit-db'

// Using environment variable
const client = new AuditDb()

// Using explicit connection string
const client = new AuditDb('postgresql://user:pass@host:port/db')
```

### Core Methods

#### `getDrizzleInstance()`
Returns the configured Drizzle ORM instance for database operations.

```typescript
const db = client.getDrizzleInstance()
const events = await db.select().from(auditLog).limit(10)
```

#### `checkAuditDbConnection()`
Verifies database connectivity with a simple health check.

```typescript
const isHealthy = await client.checkAuditDbConnection()
if (!isHealthy) {
  throw new Error('Database connection failed')
}
```

## Usage Example

Here’s a comprehensive example demonstrating how to initialize `AuditDb` and use the Drizzle client to interact with the `auditLog` table (assuming the schema is imported).

```typescript
import { AuditDb } from '@repo/auditdb'
import { auditLog } from '@repo/auditdb/schema' // Import the schema

async function logAuditEvent() {
	try {
		const auditDbInstance = new AuditDb() // Uses AUDIT_DB_URL

		if (!(await auditDbInstance.checkAuditDbConnection())) {
			console.error('Audit DB connection check failed. Aborting operation.')
			return
		}

		const db = auditDbInstance.getDrizzleInstance()

		// Example: Inserting a new audit log event
		const [newEvent] = await db
			.insert(auditLog)
			.values({
				timestamp: new Date().toISOString(), // Event timestamp
				action: 'document.viewed',
				status: 'success', // 'success' or 'failure' from AuditEventStatus
				principalId: 'user-007',
				organizationId: 'org-smedrec',
				targetResourceType: 'PatientChart',
				targetResourceId: 'chart-abc-123',
				outcomeDescription: 'User successfully viewed patient chart.',
				details: { ipAddress: '192.168.1.100', sessionId: 'session-xyz' }, // Arbitrary JSON details
			})
			.returning()

		console.log('Audit event logged successfully:', newEvent)

		// Example: Querying the latest 5 audit events for a specific user
		const userEvents = await db
			.select()
			.from(auditLog)
			.where(eq(auditLog.principalId, 'user-007'))
			.orderBy(desc(auditLog.timestamp))
			.limit(5)

		console.log(`Last 5 events for user-007:`, userEvents)
	} catch (error) {
		console.error('Error during audit logging:', error)
	}
}

// Remember to import `eq` and `desc` from 'drizzle-orm' if using them
// import { eq, desc } from 'drizzle-orm';

logAuditEvent()
```

_Note: For operators like `eq` and `desc` used in queries, ensure you import them from `drizzle-orm`._

## Enhanced Client Configuration

### `EnhancedAuditDb` Setup

For production applications requiring advanced features:

```typescript
import { EnhancedAuditDb } from '@repo/audit-db'

const client = new EnhancedAuditDb({
  connection: {
    connectionString: process.env.AUDIT_DB_URL!,
    ssl: true
  },
  connectionPool: {
    minConnections: 5,
    maxConnections: 50,
    idleTimeout: 60000
  },
  queryCache: {
    enabled: true,
    maxSizeMB: 500,
    defaultTTL: 900
  },
  redis: {
    redisKeyPrefix: 'audit_cache',
    enableLocalCache: true,
    enableCompression: true
  },
  monitoring: {
    enabled: true,
    slowQueryThreshold: 500,
    autoOptimization: true
  },
  compliance: {
    gdprEnabled: true,
    hipaaEnabled: true,
    integrityVerification: true
  }
})
```

## Healthcare-Focused Examples

### Basic Healthcare Audit Logging

```typescript
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'
import { eq, desc, and, gte } from 'drizzle-orm'

// Initialize client and verify connection
const auditDb = new AuditDb()
const isConnected = await auditDb.checkAuditDbConnection()
if (!isConnected) {
  throw new Error('Database connection failed')
}
const db = auditDb.getDrizzleInstance()

// Log patient record access (HIPAA compliance)
await db.insert(auditLog).values({
  timestamp: new Date().toISOString(),
  action: 'patient.record.access',
  status: 'success',
  principalId: 'doctor-123',
  principalType: 'healthcare_provider',
  resourceId: 'patient-456',
  resourceType: 'patient_record',
  sourceIp: '10.0.1.50',
  metadata: {
    department: 'cardiology',
    accessReason: 'routine_checkup',
    patientConsent: true,
    dataElements: ['demographics', 'vitals', 'medications']
  }
})

// Query recent patient access events
const patientAccess = await db
  .select()
  .from(auditLog)
  .where(
    and(
      eq(auditLog.resourceType, 'patient_record'),
      gte(auditLog.timestamp, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    )
  )
  .orderBy(desc(auditLog.timestamp))
```

### Enhanced Performance Monitoring

``typescript
import { EnhancedAuditDb } from '@repo/audit-db'

// Production-ready configuration
const auditDb = new EnhancedAuditDb({
  // ... configuration from above ...
})

// Use cached queries for better performance
const userEvents = await auditDb.query(
  'SELECT * FROM audit_log WHERE principal_id = $1 ORDER BY timestamp DESC LIMIT 10',
  ['doctor-123'],
  {
    cacheKey: 'doctor_events_doctor-123',
    ttl: 300 // 5 minutes
  }
)

// Monitor performance
const metrics = await auditDb.getPerformanceMetrics()
console.log('Cache hit rate:', metrics.cache.hitRate)
console.log('Average query time:', metrics.queries.averageExecutionTime)

// Check system health
const health = await auditDb.getHealthStatus()
if (health.overall !== 'healthy') {
  console.warn('System health degraded:', health.components)
}
```

## Database Schema and Management

### Schema Architecture

The audit database uses a carefully designed schema optimized for healthcare compliance and high performance:

**Core Tables:**
- **`audit_log`**: Main audit events table with partitioning support
- **`audit_metadata`**: Extended metadata for complex audit events
- **`compliance_policies`**: Data retention and compliance rules
- **`integrity_checksums`**: Cryptographic integrity verification

**Key Features:**
- **Time-based Partitioning**: Automatic monthly partitioning for optimal performance
- **Compliance Columns**: Built-in GDPR and HIPAA compliance fields
- **Cryptographic Integrity**: SHA-256 hashing and HMAC verification
- **Flexible Metadata**: JSONB columns for extensible audit data

### Database Operations

#### Development Commands

```bash
# Generate migrations after schema changes
pnpm --filter @repo/audit-db db:generate

# Apply pending migrations
pnpm --filter @repo/audit-db db:migrate

# Launch Drizzle Studio for database exploration
pnpm --filter @repo/audit-db db:studio

# Push schema changes directly (development only)
pnpm --filter @repo/audit-db db:push
```

#### Production Operations

```bash
# Create backup before migration
pnpm --filter @repo/audit-db db:backup

# Migrate with production safety checks
pnpm --filter @repo/audit-db db:migrate:production

# Verify data integrity after migration
pnpm --filter @repo/audit-db db:verify-integrity

# Optimize database performance
pnpm --filter @repo/audit-db db:optimize
```

## Next Steps

### For Basic Usage
- **[Configuration Guide](./configuration)** - Learn about configuration options
- **[Basic Usage Tutorial](./basic-usage)** - Dive deeper into common operations

### For Advanced Features
- **[Performance Optimization](./performance-optimization)** - Use the enhanced client
- **[Caching Strategies](./caching-strategies)** - Implement distributed caching
- **[Database Partitioning](./partitioning-guide)** - Set up partitioning for large datasets

### For Compliance
- **[Compliance Features](./compliance-features)** - GDPR/HIPAA compliance
- **[Security Best Practices](./security)** - Security guidelines

### For Production
- **[CLI Reference](./cli-reference)** - Command-line tools and utilities
- **[FAQ](./faq)** - Frequently asked questions

## Contributing

This package is part of the smart-logs monorepo. For contribution guidelines, please refer to the main [CONTRIBUTING.md](../../../CONTRIBUTING.md) file.
