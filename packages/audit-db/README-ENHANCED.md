# Audit Database Package - Comprehensive Documentation

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Performance Optimization](#performance-optimization)
- [Deployment Guide](#deployment-guide)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

## Overview

The `@repo/audit-db` package provides a production-ready, high-performance audit logging system designed for healthcare and compliance-critical applications. It implements advanced database optimization techniques including partitioning, intelligent caching, read replica support, and circuit breaker patterns.

### Key Features

- **🚀 High Performance**: O(1) cache operations, optimized partitioning, intelligent indexing
- **🔄 Fault Tolerance**: Circuit breaker patterns, automatic failover, error recovery
- **📊 Scalable Architecture**: Read replica support, connection pooling, load balancing
- **🛡️ Compliance Ready**: HIPAA/GDPR compliant audit trails, data retention policies
- **📈 Intelligent Monitoring**: Performance metrics, health checks, auto-optimization
- **🔧 Production Ready**: Race condition prevention, structured error handling

### Architecture Highlights

```mermaid
graph TB
    subgraph "Application Layer"
        APP[Your Application]
        SDK[Audit SDK]
    end

    subgraph "Audit Database Package"
        API[Enhanced Database Client]
        CACHE[Optimized LRU Cache]
        CIRCUIT[Circuit Breakers]
        PARTITION[Partition Manager]
        INDEX[Index Manager]
        REPLICA[Read Replica Router]
    end

    subgraph "Storage Layer"
        MASTER[(Master Database)]
        READ1[(Read Replica 1)]
        READ2[(Read Replica N)]
        REDIS[(Redis Cache)]
    end

    APP --> SDK
    SDK --> API
    API --> CACHE
    API --> CIRCUIT
    API --> PARTITION
    API --> INDEX
    API --> REPLICA
    
    CACHE --> REDIS
    CIRCUIT --> MASTER
    REPLICA --> READ1
    REPLICA --> READ2
    PARTITION --> MASTER
```

## Quick Start

### Installation

```bash
npm install @repo/audit-db
```

### Basic Usage

```typescript
import { createEnhancedAuditDatabaseClient } from '@repo/audit-db'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import Redis from 'ioredis'

// Initialize database connection
const postgresClient = postgres(process.env.DATABASE_URL!)
const db = drizzle(postgresClient)

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL!)

// Create enhanced audit database client
const auditDb = createEnhancedAuditDatabaseClient(redis, db, {
  cache: {
    enabled: true,
    maxSizeMB: 100,
    defaultTTL: 300
  },
  partition: {
    strategy: 'range',
    interval: 'monthly',
    retentionDays: 2555, // 7 years
    autoMaintenance: true
  }
})

// Insert audit log
await auditDb.insert({
  action: 'user_login',
  principal_id: 'user123',
  organization_id: 'org456',
  status: 'success',
  timestamp: new Date(),
  details: { ip_address: '192.168.1.1' }
})

// Query audit logs
const logs = await auditDb.query({
  organization_id: 'org456',
  timestamp: {
    gte: new Date('2024-01-01'),
    lte: new Date('2024-12-31')
  }
})

// Check health
const health = await auditDb.getHealthStatus()
console.log('Database health:', health.overall)
```

### Configuration Options

```typescript
interface EnhancedDatabaseConfig {
  database: {
    url: string
    poolSize: number
    connectionTimeout: number
    queryTimeout: number
    ssl: boolean
    maxConnectionAttempts: number
  }
  partition: {
    strategy: 'range' | 'hash' | 'list'
    partitionColumn: string
    interval: 'monthly' | 'quarterly' | 'yearly'
    retentionDays: number
    autoMaintenance: boolean
    maintenanceInterval: number
  }
  cache: {
    enabled: boolean
    maxSizeMB: number
    defaultTTL: number
  }
  circuitBreaker: {
    enabled: boolean
    failureThreshold: number
    timeoutMs: number
    resetTimeoutMs: number
  }
  monitoring: {
    enabled: boolean
    slowQueryThreshold: number
    metricsRetentionDays: number
  }
}
```

## Architecture

### Component Overview

The audit database package is built with a modular, dependency-injection architecture that promotes maintainability and testability.

#### Core Components

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| **Enhanced Database Client** | Main interface for audit operations | Transaction support, health monitoring, metrics |
| **Partition Manager** | Automatic table partitioning | Time-based partitioning, cleanup, optimization |
| **Circuit Breaker** | Fault tolerance and resilience | Exponential backoff, failure tracking, auto-recovery |
| **Read Replica Router** | Load balancing and scaling | Intelligent routing, health checks, failover |
| **Index Manager** | Automatic index optimization | Usage analysis, recommendations, auto-creation |
| **LRU Cache** | High-performance caching | O(1) operations, TTL support, memory management |
| **Error Handler** | Structured error management | Classification, recovery, alerting |

#### Data Flow

1. **Request Processing**: Application makes audit log request through enhanced client
2. **Circuit Breaker**: Request passes through circuit breaker for fault tolerance
3. **Caching Layer**: Check optimized LRU cache for read operations
4. **Routing**: Read replica router selects optimal database for queries
5. **Partition Management**: Automatic partition selection based on timestamp
6. **Error Handling**: Comprehensive error classification and recovery

### Database Schema Optimization

#### Partitioning Strategy

```sql
-- Monthly partitioning for optimal performance
CREATE TABLE audit_log (
    id serial,
    timestamp timestamp with time zone NOT NULL,
    organization_id varchar(255),
    principal_id varchar(255),
    action varchar(255) NOT NULL,
    status varchar(50) NOT NULL,
    details jsonb
) PARTITION BY RANGE (timestamp);

-- Automatic partition creation
CREATE TABLE audit_log_2024_01 PARTITION OF audit_log
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

#### Index Strategy

```sql
-- High-performance indexes for common query patterns
CREATE INDEX CONCURRENTLY audit_log_org_timestamp_idx 
ON audit_log (organization_id, timestamp);

CREATE INDEX CONCURRENTLY audit_log_principal_action_idx 
ON audit_log (principal_id, action);

CREATE INDEX CONCURRENTLY audit_log_details_gin_idx 
ON audit_log USING gin (details);
```

## API Reference

### Enhanced Database Client

#### `createEnhancedAuditDatabaseClient(redis, database, config)`

Creates an optimized audit database client with all performance enhancements enabled.

**Parameters:**
- `redis: Redis` - Redis connection instance
- `database: PostgresJsDatabase` - Drizzle database instance
- `config: Partial<EnhancedDatabaseConfig>` - Configuration options

**Returns:** `EnhancedAuditDatabaseClient`

#### Methods

##### `insert<T>(data: T): Promise<void>`

Insert audit log entry with automatic partitioning and cache invalidation.

```typescript
await auditDb.insert({
  action: 'data_access',
  principal_id: 'user123',
  organization_id: 'org456',
  target_resource_type: 'patient_record',
  target_resource_id: 'patient789',
  status: 'success',
  timestamp: new Date(),
  details: {
    fields_accessed: ['name', 'dob', 'ssn'],
    access_reason: 'treatment'
  }
})
```

##### `query<T>(filters: Record<string, any>): Promise<T[]>`

Query audit logs with intelligent caching and read replica routing.

```typescript
const logs = await auditDb.query({
  organization_id: 'org456',
  action: 'data_access',
  timestamp: {
    gte: new Date('2024-01-01'),
    lte: new Date('2024-01-31')
  },
  status: 'success'
})
```

##### `transaction<T>(callback): Promise<T>`

Execute multiple operations in a database transaction.

```typescript
await auditDb.transaction(async (tx) => {
  await tx.insert(auditLog).values(entry1)
  await tx.insert(auditLog).values(entry2)
  // Both entries committed together
})
```

##### `getHealthStatus(): Promise<DatabaseHealth>`

Get comprehensive health status of all database components.

```typescript
const health = await auditDb.getHealthStatus()
console.log({
  overall: health.overall, // 'healthy' | 'degraded' | 'unhealthy'
  components: health.components,
  metrics: health.metrics
})
```

### Circuit Breaker

#### `createCircuitBreaker(name, config)`

Create a circuit breaker for database operations.

```typescript
import { createCircuitBreaker } from '@repo/audit-db'

const circuitBreaker = createCircuitBreaker('audit-operations', {
  failureThreshold: 5,
  timeoutMs: 30000,
  resetTimeoutMs: 60000
})

// Execute with protection
await circuitBreaker.execute(async () => {
  return await someDbOperation()
})
```

### Read Replica Router

#### `createReadReplicaRouter(config)`

Create intelligent read replica router for load balancing.

```typescript
import { createReadReplicaRouter, RoutingStrategy } from '@repo/audit-db'

const router = createReadReplicaRouter({
  replicas: [
    { id: 'replica-1', url: 'postgresql://replica1.example.com/db' },
    { id: 'replica-2', url: 'postgresql://replica2.example.com/db' }
  ],
  strategy: RoutingStrategy.LEAST_LATENCY,
  healthCheckInterval: 30000,
  fallbackToMaster: true
})

// Route query to optimal replica
const result = await router.route(async () => {
  return await db.select().from(auditLog).limit(100)
})
```

### Index Manager

#### `createIntelligentIndexManager(db, config)`

Create intelligent index manager for automatic optimization.

```typescript
import { createIntelligentIndexManager } from '@repo/audit-db'

const indexManager = createIntelligentIndexManager(db, {
  enableAutoCreation: true,
  enableAutoDrop: false, // Conservative default
  unusedThresholdDays: 30,
  analysisInterval: 86400000 // 24 hours
})

// Analyze and get recommendations
const recommendations = await indexManager.generateIndexRecommendations()
console.log('Index recommendations:', recommendations)

// Execute recommendations
await indexManager.executeRecommendations(recommendations)
```

## Performance Optimization

### Caching Strategy

The package implements a multi-tier caching strategy:

1. **L1 Cache (Memory)**: Optimized LRU cache with O(1) operations
2. **L2 Cache (Redis)**: Distributed cache for cross-instance consistency
3. **L3 Cache (Database)**: PostgreSQL query plan cache

#### Cache Configuration

```typescript
// Optimized LRU cache configuration
const cache = createOptimizedLRUCache({
  maxSizeMB: 100,
  defaultTTL: 300,
  maxKeys: 10000,
  cleanupInterval: 60000
})

// Cache statistics
const stats = await cache.stats()
console.log({
  hitRatio: stats.hitRatio,
  memoryUsage: stats.memoryUsageMB,
  evictions: stats.evictions
})
```

### Partitioning Strategy

#### Monthly Partitioning

Optimal for audit logs with time-based access patterns:

```typescript
// Automatic monthly partitioning
const partitionManager = new EnhancedPartitionManager(db, redis)

await partitionManager.createAuditLogPartitions({
  strategy: 'range',
  partitionColumn: 'timestamp',
  interval: 'monthly',
  retentionDays: 2555 // 7 years for compliance
})
```

#### Partition Maintenance

```typescript
// Monitor partition health
const status = await partitionManager.getPartitionStatus()
console.log('Partition status:', status)

// Analyze performance
const analysis = await partitionManager.analyzePartitionPerformance()
console.log('Recommendations:', analysis.recommendations)
```

### Connection Pooling

```typescript
// Enhanced connection pool configuration
const poolConfig = {
  url: process.env.DATABASE_URL!,
  minConnections: 5,
  maxConnections: 20,
  idleTimeout: 30000,
  acquireTimeout: 10000,
  validateConnections: true,
  retryAttempts: 3,
  ssl: true
}
```

## Deployment Guide

### Production Deployment

#### Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/database
AUDIT_DB_POOL_SIZE=20
AUDIT_DB_SSL=true

# Redis Configuration
REDIS_URL=redis://redis.example.com:6379
REDIS_CLUSTER_MODE=true

# Read Replicas
AUDIT_DB_READ_REPLICA_1=postgresql://replica1.example.com/db
AUDIT_DB_READ_REPLICA_2=postgresql://replica2.example.com/db

# Performance Tuning
AUDIT_DB_CACHE_SIZE_MB=200
AUDIT_DB_PARTITION_RETENTION_DAYS=2555
AUDIT_DB_AUTO_INDEX_OPTIMIZATION=true

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
SLOW_QUERY_THRESHOLD=1000
```

#### Docker Configuration

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node ./dist/health-check.js

EXPOSE 3000

CMD ["node", "./dist/index.js"]
```

#### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: audit-db-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: audit-db-service
  template:
    metadata:
      labels:
        app: audit-db-service
    spec:
      containers:
      - name: audit-db
        image: audit-db:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Database Setup

#### Initial Schema Creation

```sql
-- Create database with optimized settings
CREATE DATABASE audit_db 
WITH 
  ENCODING = 'UTF8'
  LC_COLLATE = 'C'
  LC_CTYPE = 'C'
  TEMPLATE = template0;

-- Optimize PostgreSQL settings for audit workload
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Enable query statistics
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

#### Partition Initialization

```sql
-- Initialize partitioned audit_log table
SELECT create_audit_log_partitions();

-- Create initial partitions (6 months ahead)
SELECT create_monthly_partitions('audit_log', CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months');

-- Setup automatic cleanup job
SELECT cron.schedule('partition-cleanup', '0 2 * * 0', 'SELECT drop_old_audit_partitions(2555)');
```

### Monitoring Setup

#### Prometheus Metrics

```typescript
// metrics.ts
import { register, Histogram, Counter, Gauge } from 'prom-client'

export const dbOperationDuration = new Histogram({
  name: 'audit_db_operation_duration_seconds',
  help: 'Duration of audit database operations',
  labelNames: ['operation', 'status'],
  buckets: [0.001, 0.01, 0.1, 1, 5, 10]
})

export const cacheHitRate = new Gauge({
  name: 'audit_db_cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_type']
})

export const circuitBreakerState = new Gauge({
  name: 'audit_db_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['component']
})
```

#### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Audit Database Performance",
    "panels": [
      {
        "title": "Database Operation Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, audit_db_operation_duration_seconds_bucket)",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "audit_db_cache_hit_rate",
            "legendFormat": "Hit Rate %"
          }
        ]
      }
    ]
  }
}
```

## Troubleshooting

### Common Issues

#### High Memory Usage

**Problem**: Cache consuming too much memory

**Solution**:
```typescript
// Reduce cache size
const auditDb = createEnhancedAuditDatabaseClient(redis, db, {
  cache: {
    enabled: true,
    maxSizeMB: 50, // Reduced from 100
    defaultTTL: 300
  }
})

// Monitor cache metrics
const stats = await auditDb.cache.stats()
if (stats.memoryUsageMB > 80) {
  auditDb.cache.clear() // Emergency cleanup
}
```

#### Circuit Breaker Opening

**Problem**: Circuit breaker frequently opening

**Solution**:
```typescript
// Adjust circuit breaker sensitivity
const circuitBreaker = createCircuitBreaker('audit-db', {
  failureThreshold: 10, // Increased from 5
  timeoutMs: 60000,     // Increased timeout
  resetTimeoutMs: 30000 // Faster reset
})

// Monitor circuit breaker status
const status = circuitBreaker.getStatus()
console.log('Circuit breaker failures:', status.failureCount)
```

#### Slow Queries

**Problem**: Query performance degradation

**Solution**:
```typescript
// Enable index optimization
const indexManager = createIntelligentIndexManager(db, {
  enableAutoCreation: true,
  analysisInterval: 3600000 // Check hourly
})

// Manual analysis
const recommendations = await indexManager.generateIndexRecommendations()
await indexManager.executeRecommendations(recommendations)
```

#### Partition Issues

**Problem**: Partition creation failing

**Solution**:
```typescript
// Check partition health
const partitionManager = new EnhancedPartitionManager(db, redis)
const status = await partitionManager.getPartitionStatus()

// Manual partition creation
await partitionManager.createPartition(
  'audit_log',
  new Date('2024-01-01'),
  new Date('2024-02-01')
)
```

### Debug Logging

```typescript
// Enable debug logging
LoggerFactory.setDefaultConfig({
  level: 'debug',
  enablePerformanceLogging: true,
  enableErrorTracking: true,
  format: 'json'
})

// Component-specific debugging
const auditDb = createEnhancedAuditDatabaseClient(redis, db, {
  monitoring: {
    enabled: true,
    slowQueryThreshold: 100, // Log queries > 100ms
    metricsRetentionDays: 7
  }
})
```

### Performance Monitoring

```typescript
// Real-time performance monitoring
setInterval(async () => {
  const health = await auditDb.getHealthStatus()
  
  if (health.overall !== 'healthy') {
    console.error('Database health degraded:', health)
    // Alert logic here
  }
  
  console.log('Performance metrics:', {
    successRate: health.metrics.successRate,
    averageResponseTime: health.metrics.averageResponseTime,
    cacheHitRatio: health.components.cache.hitRatio
  })
}, 30000) // Check every 30 seconds
```

## Examples

### Healthcare Audit Logging

```typescript
// Patient data access logging
await auditDb.insert({
  action: 'patient_data_access',
  principal_id: 'dr_smith_123',
  organization_id: 'hospital_456',
  target_resource_type: 'patient_record',
  target_resource_id: 'patient_789',
  status: 'success',
  timestamp: new Date(),
  data_classification: 'PHI',
  retention_policy: 'healthcare_7_years',
  details: {
    fields_accessed: ['name', 'dob', 'medical_history'],
    access_method: 'web_portal',
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0...',
    session_id: 'session_abc123'
  }
})

// Compliance query - find all PHI access in last 30 days
const phiAccess = await auditDb.query({
  data_classification: 'PHI',
  timestamp: {
    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  },
  organization_id: 'hospital_456'
})
```

### Financial Transaction Auditing

```typescript
// Financial transaction logging
await auditDb.insert({
  action: 'payment_processed',
  principal_id: 'system_payment_processor',
  organization_id: 'bank_789',
  target_resource_type: 'transaction',
  target_resource_id: 'txn_456789',
  status: 'success',
  timestamp: new Date(),
  correlation_id: 'req_abc123',
  data_classification: 'FINANCIAL',
  retention_policy: 'financial_7_years',
  details: {
    amount: 1250.00,
    currency: 'USD',
    payment_method: 'credit_card',
    card_last_four: '1234',
    merchant_id: 'merchant_123',
    authorization_code: 'auth_789'
  }
})
```

### System Access Control

```typescript
// Authentication events
await auditDb.insert({
  action: 'user_authentication',
  principal_id: 'user_alice_123',
  organization_id: 'company_456',
  status: 'success',
  timestamp: new Date(),
  details: {
    authentication_method: 'multi_factor',
    factors_used: ['password', 'totp'],
    ip_address: '10.0.0.50',
    location: 'New York, NY, US',
    device_fingerprint: 'device_abc123'
  }
})

// Failed login attempts monitoring
const failedLogins = await auditDb.query({
  action: 'user_authentication',
  status: 'failure',
  timestamp: {
    gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
  }
})

// Alert if too many failed attempts
if (failedLogins.length > 10) {
  console.warn('High number of failed logins detected:', failedLogins.length)
}
```

## Best Practices

### Performance Best Practices

1. **Use Appropriate Cache TTL**: Set cache TTL based on data volatility
2. **Monitor Circuit Breaker State**: Alert on circuit breaker openings
3. **Regular Partition Maintenance**: Enable automatic partition cleanup
4. **Index Optimization**: Run index analysis regularly
5. **Connection Pooling**: Configure appropriate pool sizes for your workload

### Security Best Practices

1. **Data Classification**: Always classify audit data appropriately
2. **Retention Policies**: Implement proper data retention policies
3. **Access Control**: Restrict access to audit logs
4. **Encryption**: Enable encryption in transit and at rest
5. **Integrity Verification**: Use hash verification for audit records

### Compliance Best Practices

1. **Complete Audit Trails**: Log all relevant activities
2. **Tamper Evidence**: Implement hash-based integrity checking
3. **Data Retention**: Follow industry-specific retention requirements
4. **Regular Monitoring**: Implement continuous monitoring and alerting
5. **Documentation**: Maintain comprehensive audit documentation

---

For more information, see the [API Reference](/docs/api), [Performance Guide](/docs/performance), and [Deployment Guide](/docs/deployment).