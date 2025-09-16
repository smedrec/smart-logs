# Troubleshooting Guide

This comprehensive troubleshooting guide helps you diagnose and resolve common issues with the `@repo/audit` package in healthcare environments.

## 🚨 Common Issues

### Installation and Setup Issues

#### Issue: Package Installation Fails

**Symptoms:**
- `pnpm install` fails with dependency conflicts
- TypeScript compilation errors during installation
- Missing peer dependencies warnings

**Diagnosis:**
```bash
# Check Node.js version
node --version  # Should be 18+ 

# Check pnpm version  
pnpm --version  # Should be 8+

# Check for conflicting dependencies
pnpm ls --depth=0
```

**Solutions:**
```bash
# Clear package manager cache
pnpm store prune

# Remove node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Install peer dependencies explicitly
pnpm add ioredis bullmq drizzle-orm
```

#### Issue: Database Connection Fails

**Symptoms:**
- `connection refused` errors
- `authentication failed` messages
- Timeout errors during database operations

**Diagnosis:**
```typescript
// Test database connection
import { db } from '@repo/audit-db'

async function testDbConnection() {
  try {
    const result = await db.execute('SELECT 1 as test')
    console.log('✅ Database connected:', result)
  } catch (error) {
    console.error('❌ Database connection failed:', error)
  }
}
```

**Solutions:**
```bash
# Check PostgreSQL service
pg_isready -h localhost -p 5432

# Verify credentials
psql -h localhost -U your_user -d audit_db

# Check connection string format
DATABASE_URL=postgresql://username:password@host:port/database
```

#### Issue: Redis Connection Problems

**Symptoms:**
- Redis connection timeout
- Queue operations failing
- `ECONNREFUSED` errors

**Diagnosis:**
```typescript
// Test Redis connection
import { getSharedRedisConnection } from '@repo/redis-client'

async function testRedisConnection() {
  try {
    const redis = getSharedRedisConnection()
    const result = await redis.ping()
    console.log('✅ Redis connected:', result)
  } catch (error) {
    console.error('❌ Redis connection failed:', error)
  }
}
```

**Solutions:**
```bash
# Check Redis service
redis-cli ping

# Verify Redis configuration
redis-cli config get "*"

# Check Redis logs
tail -f /var/log/redis/redis-server.log

# Test connection manually
redis-cli -h localhost -p 6379 -a your_password
```

### Runtime Issues

#### Issue: Events Not Processing

**Symptoms:**
- Events logged but not appearing in database
- Queue depth continuously growing
- Processing appears stuck

**Diagnosis:**
```typescript
// Check queue health
const health = await auditService.getHealth()
console.log('Queue stats:', health.details.queue)

// Check worker status
const stats = await auditService.getQueueStats()
console.log('Queue statistics:', {
  waiting: stats.waiting,
  active: stats.active,
  failed: stats.failed
})

// Check for failed jobs
const failedJobs = await queue.getFailed()
console.log('Failed jobs:', failedJobs.length)
```

**Solutions:**
1. **Restart Queue Workers:**
```typescript
// Gracefully restart audit service
await auditService.closeConnection()
const newAuditService = new Audit(config, db)
```

2. **Check Worker Configuration:**
```typescript
const config = {
  reliableProcessor: {
    concurrency: 5,        // Increase if queue is backing up
    maxRetries: 3,         // Ensure retries are configured
    enableCircuitBreaker: true
  }
}
```

3. **Clear Stuck Jobs:**
```typescript
// Clear failed jobs (use with caution)
await queue.clean(0, 'failed')

// Retry failed jobs
const failedJobs = await queue.getFailed()
for (const job of failedJobs) {
  await job.retry()
}
```

#### Issue: High Memory Usage

**Symptoms:**
- Application memory usage continuously growing
- Out of memory errors
- Slow performance

**Diagnosis:**
```typescript
// Monitor memory usage
const memUsage = process.memoryUsage()
console.log('Memory usage:', {
  heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
  heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB'
})

// Check for memory leaks
setInterval(() => {
  const usage = process.memoryUsage()
  console.log('Heap used:', Math.round(usage.heapUsed / 1024 / 1024), 'MB')
}, 10000)
```

**Solutions:**
1. **Optimize Batch Size:**
```typescript
const config = {
  reliableProcessor: {
    batchSize: 50,         // Reduce from default 100
    maxBatchWait: 500,     // Process smaller batches more frequently
  }
}
```

2. **Enable Garbage Collection:**
```bash
# Start with garbage collection flags
node --expose-gc --max-old-space-size=512 your-app.js
```

3. **Implement Memory Monitoring:**
```typescript
class MemoryMonitor {
  constructor() {
    setInterval(() => {
      const usage = process.memoryUsage()
      if (usage.heapUsed > 400 * 1024 * 1024) { // 400MB threshold
        console.warn('High memory usage detected')
        if (global.gc) global.gc()
      }
    }, 30000)
  }
}
```

### Validation and Compliance Issues

#### Issue: Event Validation Failures

**Symptoms:**
- `AuditValidationError` exceptions
- Events rejected with validation messages
- Missing required fields errors

**Diagnosis:**
```typescript
// Test event validation
import { validateAuditEvent } from '@repo/audit'

const testEvent = {
  action: 'test.action',
  status: 'success',
  // Missing required fields...
}

const validation = validateAuditEvent(testEvent)
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors)
  console.warn('Validation warnings:', validation.warnings)
}
```

**Solutions:**
1. **Fix Required Fields:**
```typescript
// Ensure all required fields are present
const completeEvent = {
  timestamp: new Date().toISOString(),  // Auto-generated if omitted
  action: 'user.login',                 // Required
  status: 'success',                    // Required
  principalId: 'user-123',             // Recommended
  outcomeDescription: 'User logged in' // Recommended
}
```

2. **Use Event Factory Functions:**
```typescript
// Use factory functions to ensure proper structure
import { createAuthAuditEvent } from '@repo/audit'

const authEvent = createAuthAuditEvent('auth.login.success', {
  principalId: 'user-123',
  status: 'success'
})
```

3. **Custom Validation Configuration:**
```typescript
const customValidation = {
  ...DEFAULT_VALIDATION_CONFIG,
  maxStringLength: 1000,     // Increase limits if needed
  allowedEventVersions: ['1.0', '2.0']
}

await auditService.log(event, {
  validationConfig: customValidation
})
```

#### Issue: HIPAA Compliance Violations

**Symptoms:**
- Compliance validation errors
- Missing PHI protection fields
- Audit trail gaps

**Diagnosis:**
```typescript
// Check HIPAA compliance
import { ComplianceValidationService } from '@repo/audit'

const validation = ComplianceValidationService.validateHIPAACompliance(event)
if (!validation.isCompliant) {
  console.error('HIPAA violations:', validation.violations)
}
```

**Solutions:**
1. **Include Required HIPAA Fields:**
```typescript
const hipaaCompliantEvent = {
  principalId: 'user-123',           // Who accessed
  action: 'phi.patient.read',        // What action
  targetResourceType: 'Patient',     // What resource type
  targetResourceId: 'patient-456',   // Specific resource
  sessionContext: {                  // Session details
    sessionId: 'sess-789',
    ipAddress: '192.168.1.100'
  },
  complianceContext: {
    regulation: 'HIPAA',
    accessReason: 'treatment',
    minimumNecessaryJustification: 'Reviewing patient chart for appointment'
  }
}
```

2. **Use HIPAA Audit Service:**
```typescript
import { HIPAAAuditService } from '@repo/audit'

await HIPAAAuditService.logPHIAccess({
  principalId: 'doctor-123',
  patientId: 'patient-456',
  action: 'chart_view',
  accessReason: 'routine_checkup',
  minimumNecessaryJustification: 'Reviewing vitals for scheduled appointment',
  sessionId: 'sess-789',
  ipAddress: '192.168.1.100',
  department: 'cardiology'
})
```

### Performance Issues

#### Issue: Slow Event Processing

**Symptoms:**
- High processing latency (>1000ms)
- Queue backup during peak hours
- Database query timeouts

**Diagnosis:**
```typescript
// Monitor processing performance
const startTime = Date.now()
await auditService.log(event)
const processingTime = Date.now() - startTime

console.log('Processing time:', processingTime, 'ms')

// Check database performance
const dbStartTime = Date.now()
const result = await db.select().from(auditLog).limit(1)
const dbTime = Date.now() - dbStartTime
console.log('Database query time:', dbTime, 'ms')
```

**Solutions:**
1. **Enable Batch Processing:**
```typescript
const performanceConfig = {
  reliableProcessor: {
    batchSize: 100,              // Process events in batches
    maxBatchWait: 100,           // Wait max 100ms for batch
    concurrency: 10,             // Increase concurrent workers
    enableBatching: true
  }
}
```

2. **Optimize Database Indexes:**
```sql
-- Add performance indexes
CREATE INDEX CONCURRENTLY idx_audit_log_timestamp ON audit_log (timestamp DESC);
CREATE INDEX CONCURRENTLY idx_audit_log_principal_id ON audit_log (principal_id);
CREATE INDEX CONCURRENTLY idx_audit_log_action ON audit_log (action);
```

3. **Implement Connection Pooling:**
```typescript
const dbConfig = {
  max: 20,                    // Maximum connections
  idle_timeout: 20,           // Close idle connections
  connect_timeout: 10         // Connection timeout
}
```

#### Issue: Database Performance Problems

**Symptoms:**
- Slow database queries
- Connection pool exhaustion
- Lock timeouts

**Diagnosis:**
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE query LIKE '%audit_log%' 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Check connection usage
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';

-- Check table size
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename = 'audit_log';
```

**Solutions:**
1. **Implement Table Partitioning:**
```sql
-- Monthly partitions for large tables
CREATE TABLE audit_log_y2024m01 PARTITION OF audit_log
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

2. **Optimize Queries:**
```typescript
// Use efficient queries with proper indexing
const events = await db.select()
  .from(auditLog)
  .where(
    and(
      gte(auditLog.timestamp, startTime),
      eq(auditLog.principalId, userId)
    )
  )
  .orderBy(desc(auditLog.timestamp))
  .limit(100)
```

3. **Regular Maintenance:**
```sql
-- Regular maintenance tasks
VACUUM ANALYZE audit_log;
REINDEX INDEX CONCURRENTLY idx_audit_log_timestamp;
```

### Security Issues

#### Issue: Hash Verification Failures

**Symptoms:**
- Tamper detection alerts
- Hash mismatch errors
- Event integrity warnings

**Diagnosis:**
```typescript
// Test hash verification
const originalEvent = { /* event data */ }
const storedHash = auditService.generateEventHash(originalEvent)

// Later verification
const isValid = auditService.verifyEventHash(originalEvent, storedHash)
if (!isValid) {
  console.error('Hash verification failed - possible tampering')
}
```

**Solutions:**
1. **Check Hash Consistency:**
```typescript
// Ensure consistent hash generation
const crypto = new CryptoService({
  algorithm: 'SHA-256',
  signingAlgorithm: 'HMAC-SHA256'
})

// Use same configuration across all instances
```

2. **Implement Integrity Monitoring:**
```typescript
class IntegrityMonitor {
  async verifyEventIntegrity(eventId: string) {
    const event = await this.getEventFromDatabase(eventId)
    const computedHash = auditService.generateEventHash(event)
    
    if (event.hash !== computedHash) {
      await auditService.logCritical({
        principalId: 'integrity-monitor',
        action: 'security.integrity.violation',
        status: 'failure',
        targetResourceId: eventId,
        securityContext: {
          expectedHash: event.hash,
          computedHash: computedHash,
          integrityViolation: true
        }
      })
    }
  }
}
```

## 🔧 Diagnostic Tools

### Health Check Script

```typescript
#!/usr/bin/env node
// health-check.ts

import { Audit } from '@repo/audit'
import { db } from '@repo/audit-db'

async function runHealthCheck() {
  console.log('🏥 Running Audit System Health Check...\n')
  
  try {
    // 1. Database Connection
    console.log('📋 Checking database connection...')
    const dbResult = await db.execute('SELECT 1')
    console.log('✅ Database: Connected\n')
    
    // 2. Redis Connection
    console.log('🔴 Checking Redis connection...')
    const auditService = new Audit(config, db)
    const queueStats = await auditService.getQueueStats()
    console.log('✅ Redis: Connected')
    console.log(`   Queue depth: ${queueStats.waiting} waiting, ${queueStats.active} active\n`)
    
    // 3. Event Processing Test
    console.log('⚡ Testing event processing...')
    const startTime = Date.now()
    await auditService.log({
      principalId: 'health-check',
      action: 'system.health.test',
      status: 'success'
    })
    const processingTime = Date.now() - startTime
    console.log(`✅ Event processing: ${processingTime}ms\n`)
    
    // 4. Compliance Validation
    console.log('📋 Testing compliance validation...')
    const testEvent = {
      principalId: 'test-user',
      action: 'test.action',
      status: 'success',
      dataClassification: 'PHI'
    }
    const validation = validateAuditEvent(testEvent)
    console.log(`✅ Validation: ${validation.isValid ? 'Passed' : 'Failed'}\n`)
    
    console.log('🎉 All health checks passed!')
    
  } catch (error) {
    console.error('❌ Health check failed:', error)
    process.exit(1)
  }
}

runHealthCheck()
```

### Performance Monitoring Script

```typescript
#!/usr/bin/env node
// performance-monitor.ts

class PerformanceMonitor {
  async monitor() {
    console.log('📊 Audit Performance Monitor\n')
    
    setInterval(async () => {
      // System metrics
      const memUsage = process.memoryUsage()
      console.log(`Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`)
      
      // Queue metrics
      const stats = await auditService.getQueueStats()
      console.log(`Queue: ${stats.waiting} waiting, ${stats.active} active, ${stats.failed} failed`)
      
      // Database metrics
      const dbStats = await this.getDatabaseStats()
      console.log(`DB Connections: ${dbStats.activeConnections}/${dbStats.maxConnections}`)
      
      console.log('---')
    }, 10000)
  }
  
  async getDatabaseStats() {
    const result = await db.execute(`
      SELECT count(*) as active_connections,
             setting::int as max_connections
      FROM pg_stat_activity, pg_settings 
      WHERE name = 'max_connections'
    `)
    return result[0]
  }
}

new PerformanceMonitor().monitor()
```

## 📋 Troubleshooting Checklist

### Before Deployment
- [ ] All dependencies installed correctly
- [ ] Database schema up to date
- [ ] Redis service running and accessible
- [ ] Environment variables configured
- [ ] Health checks passing
- [ ] Performance benchmarks met

### During Issues
- [ ] Check service logs for errors
- [ ] Verify database and Redis connectivity
- [ ] Monitor queue depth and processing
- [ ] Check memory and CPU usage
- [ ] Validate event structure and compliance
- [ ] Review recent configuration changes

### After Resolution
- [ ] Document the issue and solution
- [ ] Update monitoring thresholds if needed
- [ ] Review and improve error handling
- [ ] Consider preventive measures
- [ ] Update team knowledge base

## 📞 Getting Additional Help

### Log Analysis
Enable detailed logging for troubleshooting:

```typescript
const debugConfig = {
  observability: {
    enableMetrics: true,
    enableTracing: true,
    logging: {
      level: 'debug',
      enableStructuredLogging: true
    }
  }
}
```

### Community Support
1. Check existing issues in project repository
2. Search documentation and FAQ
3. Review example implementations
4. Follow contribution guidelines for bug reports

### Professional Support
For production issues requiring immediate attention:
1. Collect diagnostic information
2. Document steps to reproduce
3. Include configuration and logs
4. Follow enterprise support procedures

This troubleshooting guide covers the most common issues encountered in healthcare audit system implementations. Keep this reference handy for quick problem resolution!