# Troubleshooting Guide

This guide helps you diagnose and resolve common issues when using the `@repo/audit-db` package.

## Common Issues

### Database Connection Issues

#### Problem: Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Causes & Solutions:**

1. **PostgreSQL not running**
   ```bash
   # Check if PostgreSQL is running
   sudo systemctl status postgresql
   
   # Start PostgreSQL
   sudo systemctl start postgresql
   ```

2. **Wrong connection string**
   ```typescript
   // Verify your connection string format
   const correctFormat = "postgresql://username:password@host:port/database"
   ```

3. **Network/firewall issues**
   ```bash
   # Test connection
   telnet localhost 5432
   
   # Check firewall rules
   sudo ufw status
   ```

#### Problem: Authentication Failed
```
Error: password authentication failed for user "audit_user"
```

**Solutions:**
1. **Verify credentials**
   ```sql
   -- Reset password in PostgreSQL
   ALTER USER audit_user PASSWORD 'new_password';
   ```

2. **Check pg_hba.conf**
   ```bash
   # Edit PostgreSQL configuration
   sudo nano /etc/postgresql/15/main/pg_hba.conf
   
   # Add or modify line:
   local   audit_db    audit_user                    md5
   ```

#### Problem: Database Does Not Exist
```
Error: database "audit_db" does not exist
```

**Solution:**
```sql
-- Create the database
CREATE DATABASE audit_db;
GRANT ALL PRIVILEGES ON DATABASE audit_db TO audit_user;
```

### Performance Issues

#### Problem: Slow Query Performance

**Diagnostic Steps:**

1. **Enable slow query logging**
   ```typescript
   const enhancedDb = new EnhancedAuditDb({
     monitoring: {
       enabled: true,
       slowQueryThreshold: 1000 // 1 second
     }
   })
   
   // Check slow queries
   const slowQueries = await enhancedDb.getPerformanceReport()
   console.log('Slow queries:', slowQueries.slowQueriesCount)
   ```

2. **Analyze query execution**
   ```sql
   -- Use EXPLAIN ANALYZE
   EXPLAIN ANALYZE SELECT * FROM audit_log WHERE principal_id = 'user-123';
   ```

3. **Check indexes**
   ```sql
   -- List indexes on audit_log table
   \d+ audit_log
   
   -- Create missing indexes
   CREATE INDEX CONCURRENTLY idx_audit_log_principal_id ON audit_log(principal_id);
   CREATE INDEX CONCURRENTLY idx_audit_log_timestamp ON audit_log(timestamp);
   ```

**Solutions:**

1. **Add proper indexes**
   ```sql
   -- Common audit query patterns
   CREATE INDEX CONCURRENTLY idx_audit_log_principal_timestamp 
   ON audit_log(principal_id, timestamp DESC);
   
   CREATE INDEX CONCURRENTLY idx_audit_log_action_status 
   ON audit_log(action, status);
   
   CREATE INDEX CONCURRENTLY idx_audit_log_resource 
   ON audit_log(resource_type, resource_id);
   ```

2. **Use partitioning for large tables**
   ```typescript
   const auditDb = new EnhancedAuditDb({
     partitioning: {
       enabled: true,
       strategy: 'range',
       interval: 'monthly',
       retentionDays: 2555
     }
   })
   ```

#### Problem: Connection Pool Exhaustion
```
Error: Pool exhausted. Unable to acquire connection within timeout
```

**Solutions:**

1. **Increase pool size**
   ```typescript
   const auditDb = new EnhancedAuditDb({
     connectionPool: {
       minConnections: 10,
       maxConnections: 50, // Increased from default
       acquireTimeout: 15000 // 15 seconds
     }
   })
   ```

2. **Fix connection leaks**
   ```typescript
   // Always use try/finally or transactions
   const db = auditDb.getDrizzleInstance()
   
   try {
     const result = await db.transaction(async (tx) => {
       // Your operations here
       return await tx.select().from(auditLog).limit(10)
     })
   } catch (error) {
     console.error('Transaction failed:', error)
     throw error
   }
   // Connection automatically released
   ```

3. **Monitor pool usage**
   ```typescript
   const enhancedDb = new EnhancedAuditDb(config)
   
   setInterval(async () => {
     const health = await enhancedDb.getHealthStatus()
     console.log('Pool utilization:', health.connectionPool)
     
     if (health.connectionPool.waiting > 5) {
       console.warn('High connection pool pressure')
     }
   }, 60000)
   ```

### Caching Issues

#### Problem: Redis Connection Failure
```
Error: Redis connection failed: ECONNREFUSED
```

**Solutions:**

1. **Check Redis status**
   ```bash
   # Test Redis connection
   redis-cli ping
   
   # Start Redis if not running
   sudo systemctl start redis
   ```

2. **Fallback to local cache**
   ```typescript
   const auditDb = new EnhancedAuditDb({
     queryCache: {
       enabled: true,
       maxSizeMB: 100
     },
     redis: {
       enableLocalCache: true, // Fallback enabled
       redisKeyPrefix: 'audit_cache'
     }
   })
   ```

#### Problem: Poor Cache Hit Rate

**Diagnostic:**
```typescript
const cacheStats = await enhancedDb.getCacheStats()
console.log('Cache hit rate:', cacheStats.hitRate)

if (cacheStats.hitRate < 0.5) {
  console.warn('Low cache hit rate detected')
}
```

**Solutions:**

1. **Optimize cache keys and TTL**
   ```typescript
   // Use consistent cache keys
   const cacheKey = `user_events_${userId}_${dateRange}`
   
   // Adjust TTL based on data volatility
   const result = await client.query(sql, params, {
     cacheKey,
     ttl: 900 // 15 minutes for moderately volatile data
   })
   ```

2. **Implement cache warming**
   ```typescript
   // Warm up frequently accessed data
   await client.warmupCache([
     {
       sql: 'SELECT COUNT(*) FROM audit_log WHERE action = $1',
       params: ['user.login'],
       cacheKey: 'login_count',
       ttl: 600
     }
   ])
   ```

### Migration Issues

#### Problem: Migration Failures
```
Error: Migration failed: relation "audit_log" already exists
```

**Solutions:**

1. **Check migration state**
   ```bash
   # Check current schema version
   pnpm --filter @repo/audit-db audit-db:studio
   ```

2. **Reset migrations (development only)**
   ```sql
   -- DANGER: Only in development
   DROP TABLE IF EXISTS audit_log CASCADE;
   DROP TABLE IF EXISTS __drizzle_migrations;
   ```

3. **Manual migration recovery**
   ```bash
   # Generate new migration
   pnpm --filter @repo/audit-db audit-db:generate
   
   # Apply specific migration
   pnpm --filter @repo/audit-db audit-db:migrate
   ```

#### Problem: Schema Mismatch
```
Error: column "new_column" does not exist
```

**Solution:**
```bash
# Ensure schema is up to date
pnpm --filter @repo/audit-db audit-db:migrate

# If using db:push instead of migrations
pnpm --filter @repo/audit-db db:push
```

### Partitioning Issues

#### Problem: Partition Pruning Not Working

**Diagnostic:**
```sql
-- Check if partition pruning is working
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM audit_log 
WHERE timestamp >= '2024-01-01' AND timestamp < '2024-02-01';
```

**Solutions:**

1. **Ensure proper WHERE clauses**
   ```typescript
   // Good: Uses partition key in WHERE clause
   const events = await db
     .select()
     .from(auditLog)
     .where(
       and(
         gte(auditLog.timestamp, '2024-01-01'),
         lt(auditLog.timestamp, '2024-02-01')
       )
     )
   
   // Bad: No partition key in WHERE clause
   const allEvents = await db.select().from(auditLog).limit(1000)
   ```

2. **Check partition constraints**
   ```sql
   -- Verify partition constraints
   SELECT schemaname, tablename, definition 
   FROM pg_views 
   WHERE tablename LIKE 'audit_log_%';
   ```

## Diagnostic Tools

### Health Check Script

```typescript
// health-check.ts
import { EnhancedAuditDb } from '@repo/audit-db'

async function runHealthCheck() {
  const auditDb = new EnhancedAuditDb({
    monitoring: { enabled: true }
  })
  
  try {
    // 1. Connection test
    const connected = await auditDb.checkAuditDbConnection()
    console.log('✅ Database connection:', connected ? 'OK' : 'FAILED')
    
    // 2. Health status
    const health = await auditDb.getHealthStatus()
    console.log('✅ Overall health:', health.status)
    
    // 3. Performance metrics
    const performance = await auditDb.getPerformanceReport()
    console.log('✅ Average query time:', performance.averageQueryTime, 'ms')
    
    // 4. Cache status
    if (performance.cacheHitRate !== undefined) {
      console.log('✅ Cache hit rate:', (performance.cacheHitRate * 100).toFixed(1), '%')
    }
    
    // 5. Recommendations
    if (performance.recommendations.length > 0) {
      console.log('⚠️  Recommendations:')
      performance.recommendations.forEach(rec => console.log('  -', rec))
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', error)
    process.exit(1)
  }
}

runHealthCheck()
```

### Performance Monitor Script

```typescript
// performance-monitor.ts
async function monitorPerformance() {
  const enhancedDb = new EnhancedAuditDb({
    monitoring: {
      enabled: true,
      slowQueryThreshold: 500
    }
  })
  
  // Monitor every 30 seconds
  setInterval(async () => {
    try {
      const metrics = await enhancedDb.getPerformanceMetrics()
      
      console.log('Performance Snapshot:')
      console.log('  Active connections:', metrics.connectionPool.activeConnections)
      console.log('  Cache hit rate:', (metrics.cache.hitRate * 100).toFixed(1), '%')
      console.log('  Slow queries:', metrics.queries.slowQueries.length)
      
      if (metrics.queries.slowQueries.length > 0) {
        console.log('  Slowest query:', metrics.queries.slowQueries[0].averageTime, 'ms')
      }
      
    } catch (error) {
      console.error('Monitor error:', error)
    }
  }, 30000)
}
```

### Log Analysis

```bash
# Analyze PostgreSQL logs for errors
sudo tail -f /var/log/postgresql/postgresql-15-main.log | grep ERROR

# Monitor slow queries
sudo tail -f /var/log/postgresql/postgresql-15-main.log | grep "slow query"

# Check connection patterns
sudo tail -f /var/log/postgresql/postgresql-15-main.log | grep "connection"
```

## Getting Help

### Information to Collect

When reporting issues, include:

1. **Environment details**
   ```bash
   node --version
   pnpm --version
   psql --version
   redis-cli --version
   ```

2. **Configuration**
   ```typescript
   // Sanitized configuration (remove passwords)
   const config = {
     connectionPool: { /* your settings */ },
     queryCache: { /* your settings */ },
     // ... other config
   }
   ```

3. **Error details**
   ```typescript
   try {
     // problematic code
   } catch (error) {
     console.error('Error name:', error.name)
     console.error('Error message:', error.message)
     console.error('Error stack:', error.stack)
   }
   ```

4. **Performance metrics**
   ```typescript
   const health = await auditDb.getHealthStatus()
   const performance = await auditDb.getPerformanceReport()
   // Include these in your report
   ```

### Common Solutions

1. **Restart services**
   ```bash
   sudo systemctl restart postgresql
   sudo systemctl restart redis
   ```

2. **Clear cache**
   ```typescript
   await enhancedDb.clearCache()
   ```

3. **Reset connection pool**
   ```typescript
   await enhancedDb.resizePool({ min: 1, max: 5 })
   ```

4. **Run optimization**
   ```typescript
   await enhancedDb.optimizePerformance()
   ```

### Emergency Procedures

#### Database Unavailable
```typescript
// Implement circuit breaker pattern
let failureCount = 0
const maxFailures = 5

async function safeQuery(sql, params) {
  if (failureCount >= maxFailures) {
    throw new Error('Circuit breaker open - database unavailable')
  }
  
  try {
    const result = await auditDb.query(sql, params)
    failureCount = 0 // Reset on success
    return result
  } catch (error) {
    failureCount++
    throw error
  }
}
```

#### High Load Mitigation
```typescript
// Reduce load during incidents
const emergencyConfig = {
  connectionPool: {
    maxConnections: 10, // Reduced
    acquireTimeout: 5000 // Shorter timeout
  },
  queryCache: {
    enabled: true,
    defaultTTL: 60 // Shorter TTL to reduce memory
  }
}

const emergencyClient = new EnhancedAuditDb(emergencyConfig)
```

This troubleshooting guide should help you resolve most common issues. For complex problems, consider enabling debug logging and consulting the [FAQ](../faq.md) or creating a GitHub issue.