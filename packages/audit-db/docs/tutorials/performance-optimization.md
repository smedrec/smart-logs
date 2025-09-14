# Performance Optimization Tutorial

Learn how to leverage the advanced performance features of `@repo/audit-db` including enhanced connection pooling, query monitoring, and database partitioning.

## Prerequisites

- ✅ Completed [Basic Usage Tutorial](./basic-usage.md)
- ✅ PostgreSQL with pg_stat_statements extension
- ✅ Basic understanding of database performance concepts

## Enhanced Client Setup

### Basic Enhanced Client

```typescript
import { EnhancedAuditDb } from '@repo/audit-db'

const auditDb = new EnhancedAuditDb({
  connectionPool: {
    minConnections: 5,
    maxConnections: 20,
    idleTimeout: 30000,
    acquireTimeout: 10000
  },
  monitoring: {
    enabled: true,
    slowQueryThreshold: 1000, // 1 second
    autoOptimization: true
  }
})
```

### Production-Ready Configuration

```typescript
const productionConfig = {
  connectionPool: {
    minConnections: 10,
    maxConnections: 50,
    idleTimeout: 60000,
    acquireTimeout: 15000
  },
  queryCache: {
    enabled: true,
    maxSizeMB: 500,
    defaultTTL: 900, // 15 minutes
    maxQueries: 10000
  },
  monitoring: {
    enabled: true,
    slowQueryThreshold: 500,
    autoOptimization: true,
    collectMetrics: true
  },
  partitioning: {
    enabled: true,
    strategy: 'range',
    interval: 'monthly',
    retentionDays: 2555, // 7 years
    autoMaintenance: true
  }
}

const auditDb = new EnhancedAuditDb(productionConfig)
```

## Connection Pool Optimization

### Pool Configuration

```typescript
import { EnhancedConnectionPool } from '@repo/audit-db'

// Create optimized connection pool
const pool = new EnhancedConnectionPool({
  connectionString: process.env.AUDIT_DB_URL!,
  minConnections: 5,
  maxConnections: 30,
  idleTimeout: 45000,
  acquireTimeout: 10000,
  createTimeout: 5000
})

// Monitor pool health
const stats = await pool.getStats()
console.log('Pool stats:', {
  total: stats.totalConnections,
  idle: stats.idleConnections,
  active: stats.activeConnections,
  waiting: stats.waitingClients
})
```

### Performance Monitoring

```typescript
import { DatabasePerformanceMonitor } from '@repo/audit-db'

const monitor = new DatabasePerformanceMonitor(pool)

// Get slow query analysis
const slowQueries = await monitor.getSlowQueries()
slowQueries.forEach(query => {
  console.log(`Slow query: ${query.query}`)
  console.log(`Average time: ${query.meanTime}ms`)
  console.log(`Calls: ${query.calls}`)
})

// Get index usage statistics
const indexStats = await monitor.getIndexUsageStats()
console.log('Index usage:', indexStats)

// Get optimization recommendations
const recommendations = await monitor.getOptimizationRecommendations()
console.log('Recommendations:', recommendations)
```

## Database Partitioning

### Setup Partitioning

```typescript
import { DatabasePartitionManager } from '@repo/audit-db'

const partitionManager = new DatabasePartitionManager(pool, {
  strategy: 'range',
  interval: 'monthly',
  retentionDays: 2555,
  autoMaintenance: true
})

// Create initial partitions
await partitionManager.createPartition({
  tableName: 'audit_log',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-02-01'),
  partitionName: 'audit_log_2024_01'
})

// Enable automatic partition management
await partitionManager.enableAutoMaintenance('0 2 * * 0') // Weekly at 2 AM
```

### Partition Management

```typescript
// List existing partitions
const partitions = await partitionManager.listPartitions()
console.log('Active partitions:', partitions.length)

// Analyze partition performance
const analysis = await partitionManager.analyzePartitionPerformance()
console.log('Partition analysis:', analysis)

// Clean up old partitions
await partitionManager.cleanupExpiredPartitions()
```

## Query Optimization

### Using Query Cache

```typescript
import { EnhancedAuditDatabaseClient } from '@repo/audit-db'

const client = new EnhancedAuditDatabaseClient({
  queryCache: {
    enabled: true,
    maxSizeMB: 200,
    defaultTTL: 600
  }
})

// Cached query example
const recentEvents = await client.query(`
  SELECT * FROM audit_log 
  WHERE timestamp > $1 
  ORDER BY timestamp DESC 
  LIMIT $2
`, [
  new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  100
], {
  cacheKey: 'recent_events_24h',
  ttl: 300 // 5 minutes
})
```

### Batch Operations

```typescript
// Batch insert for better performance
const events = Array.from({ length: 1000 }, (_, i) => ({
  timestamp: new Date().toISOString(),
  action: 'bulk.operation',
  status: 'success' as const,
  principalId: `user-${i}`,
  principalType: 'user',
  metadata: { batchId: 'batch-001' }
}))

// Insert in batches of 100
const batchSize = 100
for (let i = 0; i < events.length; i += batchSize) {
  const batch = events.slice(i, i + batchSize)
  await db.insert(auditLog).values(batch)
}
```

## Performance Monitoring

### Health Checks

```typescript
async function performanceHealthCheck() {
  const client = new EnhancedAuditDatabaseClient()
  
  // Get overall health status
  const health = await client.getHealthStatus()
  console.log('System health:', health)
  
  // Get performance report
  const report = await client.getPerformanceReport()
  console.log('Performance metrics:', {
    avgQueryTime: report.averageQueryTime,
    slowQueries: report.slowQueriesCount,
    cacheHitRate: report.cacheHitRate,
    connectionPoolUtilization: report.connectionPoolUtilization
  })
  
  // Run optimization if needed
  if (report.needsOptimization) {
    await client.optimizePerformance()
  }
}
```

### Custom Metrics

```typescript
// Track custom performance metrics
async function trackCustomMetrics() {
  const startTime = Date.now()
  
  // Execute operation
  const result = await db.select().from(auditLog).limit(1000)
  
  const executionTime = Date.now() - startTime
  
  // Log performance metric
  await db.insert(auditLog).values({
    timestamp: new Date().toISOString(),
    action: 'performance.metric',
    status: 'success',
    principalId: 'system',
    principalType: 'system',
    metadata: {
      operation: 'bulk_select',
      executionTime,
      recordCount: result.length,
      performanceCategory: executionTime > 1000 ? 'slow' : 'normal'
    }
  })
}
```

## CLI Performance Tools

### Using Performance CLI

```bash
# Monitor current performance
audit-db-performance monitor summary

# Analyze slow queries
audit-db-performance monitor slow-queries

# Check partition status
audit-db-performance partition analyze

# Run optimization
audit-db-performance client optimize

# Generate performance report
audit-db-performance client report
```

### Automated Performance Checks

```typescript
// Automated performance monitoring
import { spawn } from 'child_process'

async function automatedPerformanceCheck() {
  return new Promise((resolve, reject) => {
    const process = spawn('audit-db-performance', ['monitor', 'summary'])
    
    let output = ''
    process.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    process.on('close', (code) => {
      if (code === 0) {
        const metrics = JSON.parse(output)
        resolve(metrics)
      } else {
        reject(new Error(`Performance check failed with code ${code}`))
      }
    })
  })
}
```

## Best Practices

### 1. Connection Pool Sizing

```typescript
// Development
const devConfig = {
  minConnections: 2,
  maxConnections: 5
}

// Production
const prodConfig = {
  minConnections: Math.ceil(process.env.CPU_COUNT * 0.5),
  maxConnections: Math.ceil(process.env.CPU_COUNT * 2)
}
```

### 2. Query Optimization

```typescript
// Use indexes effectively
const indexedQuery = await db
  .select()
  .from(auditLog)
  .where(
    and(
      eq(auditLog.principalId, userId), // Indexed field first
      gte(auditLog.timestamp, startDate),
      eq(auditLog.status, 'success')
    )
  )
  .orderBy(desc(auditLog.timestamp))
  .limit(50) // Always limit
```

### 3. Caching Strategy

```typescript
// Cache frequently accessed data
const cacheConfig = {
  userEvents: { ttl: 300 },      // 5 minutes
  aggregations: { ttl: 900 },    // 15 minutes
  reports: { ttl: 3600 }         // 1 hour
}
```

## Performance Benchmarks

### Baseline Performance

```typescript
async function runBenchmark() {
  const iterations = 1000
  const startTime = Date.now()
  
  for (let i = 0; i < iterations; i++) {
    await db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'benchmark.test',
      status: 'success',
      principalId: `user-${i}`,
      principalType: 'user'
    })
  }
  
  const endTime = Date.now()
  const totalTime = endTime - startTime
  const avgTime = totalTime / iterations
  
  console.log(`Benchmark results:`)
  console.log(`Total time: ${totalTime}ms`)
  console.log(`Average per operation: ${avgTime}ms`)
  console.log(`Operations per second: ${1000 / avgTime}`)
}
```

## Troubleshooting Performance Issues

### Common Issues

1. **Slow Queries**: Check indexes and query patterns
2. **Connection Pool Exhaustion**: Increase pool size or reduce connection leak
3. **High Memory Usage**: Tune cache sizes
4. **Partition Issues**: Check partition pruning and maintenance

### Diagnostic Commands

```bash
# Check current performance
audit-db-performance monitor summary

# Analyze slow queries
audit-db-performance monitor slow-queries

# Check connection pool status
audit-db-performance client health

# Analyze partition performance
audit-db-performance partition analyze
```

## Next Steps

- **[Redis Caching Tutorial](./redis-caching.md)** - Implement distributed caching
- **[Partitioning Setup](./partitioning-setup.md)** - Advanced partitioning strategies
- **[Monitoring Guide](../guides/monitoring-alerts.md)** - Set up monitoring and alerts

## Summary

You've learned:
- ✅ Enhanced client configuration
- ✅ Connection pool optimization
- ✅ Database partitioning setup
- ✅ Performance monitoring and analysis
- ✅ Query optimization techniques
- ✅ CLI performance tools usage

These optimizations will significantly improve your audit system's performance and scalability.