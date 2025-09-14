# Best Practices Guide

This guide outlines recommended practices for using the `@repo/audit-db` package effectively, securely, and performantly in production environments.

## Architecture Best Practices

### Client Selection Strategy

```typescript
// Development: Simple and fast setup
const devClient = new AuditDb()

// Staging: Production-like with monitoring
const stagingClient = new AuditDbWithConfig({
  connectionString: process.env.AUDIT_DB_URL!,
  pool: { max: 10, min: 2 }
})

// Production: Full feature set
const prodClient = createEnhancedAuditClient('production', {
  monitoring: { 
    enabled: true,
    autoOptimization: true 
  }
})
```

### Configuration Management

```typescript
// Use environment-specific configurations
const getConfig = () => {
  const env = process.env.NODE_ENV || 'development'
  
  const baseConfig = {
    connectionString: process.env.AUDIT_DB_URL!
  }
  
  const envConfigs = {
    development: {
      ...baseConfig,
      connectionPool: { min: 1, max: 5 },
      queryCache: { maxSizeMB: 50 }
    },
    production: {
      ...baseConfig,
      connectionPool: { min: 10, max: 50 },
      queryCache: { maxSizeMB: 500 },
      monitoring: { enabled: true },
      partitioning: { enabled: true }
    }
  }
  
  return envConfigs[env] || envConfigs.development
}
```

## Security Best Practices

### Connection Security

```typescript
// Always use SSL in production
const secureConfig = {
  connection: {
    connectionString: process.env.AUDIT_DB_URL!,
    ssl: {
      rejectUnauthorized: true,
      ca: process.env.DB_SSL_CA,
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY
    }
  }
}
```

### Input Validation

```typescript
// Always validate audit event data
function validateAuditEvent(event: any): ValidationResult {
  const errors: string[] = []
  
  // Required fields
  if (!event.action) errors.push('Action is required')
  if (!event.principalId) errors.push('Principal ID is required')
  if (!event.status) errors.push('Status is required')
  
  // Sanitize metadata
  if (event.metadata) {
    event.metadata = sanitizeMetadata(event.metadata)
  }
  
  // Validate timestamp format
  if (event.timestamp && !isValidISODate(event.timestamp)) {
    errors.push('Invalid timestamp format')
  }
  
  return { isValid: errors.length === 0, errors }
}

function sanitizeMetadata(metadata: any): any {
  // Remove potentially sensitive fields
  const sensitiveFields = ['password', 'token', 'ssn', 'creditCard']
  const sanitized = { ...metadata }
  
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  })
  
  return sanitized
}
```

### Access Control

```typescript
// Implement role-based access control
class SecureAuditLogger {
  private auditDb: EnhancedAuditDb
  
  constructor(config: EnhancedAuditDbConfig) {
    this.auditDb = new EnhancedAuditDb(config)
  }
  
  async logEvent(event: AuditEvent, userRole: string) {
    // Verify user has permission to log this type of event
    if (!this.hasPermission(userRole, event.action)) {
      throw new Error(`Insufficient permissions for action: ${event.action}`)
    }
    
    // Add audit trail for the logging action itself
    const enrichedEvent = {
      ...event,
      metadata: {
        ...event.metadata,
        loggedBy: event.principalId,
        loggedAt: new Date().toISOString(),
        userRole
      }
    }
    
    return await this.createEvent(enrichedEvent)
  }
  
  private hasPermission(role: string, action: string): boolean {
    const permissions = {
      'healthcare_provider': ['patient.*', 'medication.*', 'lab.*'],
      'admin': ['*'],
      'read_only': ['*.view', '*.read']
    }
    
    const userPermissions = permissions[role] || []
    return userPermissions.some(perm => 
      perm === '*' || action.startsWith(perm.replace('*', ''))
    )
  }
}
```

## Performance Best Practices

### Query Optimization

```typescript
// Use proper indexing strategy
const optimizedQueries = {
  // Good: Uses indexed fields in WHERE clause
  getUserEvents: async (userId: string, limit: number = 10) => {
    return await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.principalId, userId)) // Indexed field
      .orderBy(desc(auditLog.timestamp)) // Indexed field
      .limit(limit) // Always limit
  },
  
  // Good: Uses compound index
  getEventsByActionAndStatus: async (action: string, status: string) => {
    return await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, action),
          eq(auditLog.status, status)
        )
      )
      .orderBy(desc(auditLog.timestamp))
  },
  
  // Good: Date range with index
  getRecentEvents: async (hours: number = 24) => {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return await db
      .select()
      .from(auditLog)
      .where(gte(auditLog.timestamp, cutoff.toISOString()))
      .orderBy(desc(auditLog.timestamp))
      .limit(100)
  }
}
```

### Caching Strategy

```typescript
// Implement tiered caching strategy
const cacheStrategies = {
  // Frequently accessed, low volatility
  userProfiles: {
    ttl: 3600, // 1 hour
    strategy: 'write-through'
  },
  
  // Moderately accessed, medium volatility
  userEvents: {
    ttl: 300, // 5 minutes
    strategy: 'cache-aside'
  },
  
  // High volatility, real-time requirements
  activeMetrics: {
    ttl: 60, // 1 minute
    strategy: 'write-around'
  },
  
  // Analytics data, low volatility
  monthlyReports: {
    ttl: 86400, // 24 hours
    strategy: 'refresh-ahead'
  }
}

// Implement cache warming for critical queries
async function warmCriticalQueries(client: EnhancedAuditDatabaseClient) {
  const criticalQueries = [
    {
      sql: 'SELECT COUNT(*) FROM audit_log WHERE status = $1 AND timestamp > $2',
      params: ['failure', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()],
      cacheKey: 'daily_failures',
      ttl: 300
    },
    {
      sql: 'SELECT action, COUNT(*) FROM audit_log WHERE timestamp > $1 GROUP BY action',
      params: [new Date(Date.now() - 60 * 60 * 1000).toISOString()],
      cacheKey: 'hourly_action_stats',
      ttl: 600
    }
  ]
  
  await client.warmupCache(criticalQueries)
}
```

### Batch Operations

```typescript
// Implement efficient batch processing
class BatchAuditProcessor {
  private batchSize = 100
  private flushInterval = 5000 // 5 seconds
  private batch: AuditEvent[] = []
  private timer: NodeJS.Timeout | null = null
  
  constructor(private client: EnhancedAuditDatabaseClient) {
    this.startBatchTimer()
  }
  
  async addEvent(event: AuditEvent) {
    this.batch.push(event)
    
    if (this.batch.length >= this.batchSize) {
      await this.flush()
    }
  }
  
  async flush() {
    if (this.batch.length === 0) return
    
    const events = [...this.batch]
    this.batch = []
    
    try {
      await this.client.query(
        'INSERT INTO audit_log (...) VALUES ' + 
        events.map(() => '(...)').join(','),
        events.flatMap(e => Object.values(e))
      )
    } catch (error) {
      // Re-queue failed events
      this.batch.unshift(...events)
      throw error
    }
  }
  
  private startBatchTimer() {
    this.timer = setInterval(() => {
      this.flush().catch(console.error)
    }, this.flushInterval)
  }
}
```

## Monitoring and Observability

### Health Monitoring

```typescript
// Implement comprehensive health monitoring
class HealthMonitor {
  private client: EnhancedAuditDatabaseClient
  private alerts: AlertManager
  
  constructor(client: EnhancedAuditDatabaseClient) {
    this.client = client
    this.alerts = new AlertManager()
    this.startMonitoring()
  }
  
  async startMonitoring() {
    setInterval(async () => {
      try {
        await this.checkHealth()
        await this.checkPerformance()
        await this.checkResources()
      } catch (error) {
        console.error('Health check failed:', error)
      }
    }, 30000) // Every 30 seconds
  }
  
  private async checkHealth() {
    const health = await this.client.getHealthStatus()
    
    if (health.overall !== 'healthy') {
      await this.alerts.sendAlert({
        level: health.overall === 'degraded' ? 'warning' : 'critical',
        message: `Database health: ${health.overall}`,
        details: health
      })
    }
  }
  
  private async checkPerformance() {
    const metrics = await this.client.getPerformanceMetrics()
    
    // Check slow queries
    if (metrics.queries.slowQueries.length > 10) {
      await this.alerts.sendAlert({
        level: 'warning',
        message: `High number of slow queries: ${metrics.queries.slowQueries.length}`,
        details: metrics.queries.slowQueries.slice(0, 5)
      })
    }
    
    // Check cache performance
    if (metrics.cache.hitRate < 0.5) {
      await this.alerts.sendAlert({
        level: 'warning',
        message: `Low cache hit rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%`,
        details: metrics.cache
      })
    }
  }
}
```

### Metrics Collection

```typescript
// Implement custom metrics collection
class MetricsCollector {
  private prometheus = require('prom-client')
  
  constructor() {
    this.initializeMetrics()
  }
  
  private initializeMetrics() {
    // Query duration histogram
    this.queryDuration = new this.prometheus.Histogram({
      name: 'audit_db_query_duration_seconds',
      help: 'Duration of database queries',
      labelNames: ['operation', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
    })
    
    // Cache hit rate gauge
    this.cacheHitRate = new this.prometheus.Gauge({
      name: 'audit_db_cache_hit_rate',
      help: 'Cache hit rate percentage'
    })
    
    // Connection pool gauge
    this.poolConnections = new this.prometheus.Gauge({
      name: 'audit_db_pool_connections',
      help: 'Active database connections',
      labelNames: ['state']
    })
  }
  
  recordQueryDuration(operation: string, duration: number, success: boolean) {
    this.queryDuration
      .labels(operation, success ? 'success' : 'error')
      .observe(duration / 1000)
  }
  
  updateCacheHitRate(rate: number) {
    this.cacheHitRate.set(rate)
  }
  
  updatePoolConnections(active: number, idle: number, waiting: number) {
    this.poolConnections.labels('active').set(active)
    this.poolConnections.labels('idle').set(idle)
    this.poolConnections.labels('waiting').set(waiting)
  }
}
```

## Error Handling and Recovery

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  
  constructor(
    private threshold = 5,
    private timeout = 60000,
    private resetTimeout = 30000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }
    
    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private onSuccess() {
    this.failureCount = 0
    this.state = 'closed'
  }
  
  private onFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()
    
    if (this.failureCount >= this.threshold) {
      this.state = 'open'
    }
  }
}

// Usage with audit client
const circuitBreaker = new CircuitBreaker()

async function resilientQuery(sql: string, params: any[]) {
  return await circuitBreaker.execute(async () => {
    return await auditDb.query(sql, params)
  })
}
```

### Retry Strategy

```typescript
class RetryHandler {
  constructor(
    private maxRetries = 3,
    private baseDelay = 1000,
    private maxDelay = 10000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === this.maxRetries) {
          break
        }
        
        // Skip retry for certain errors
        if (this.isNonRetryableError(error)) {
          break
        }
        
        // Exponential backoff with jitter
        const delay = Math.min(
          this.baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
          this.maxDelay
        )
        
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError!
  }
  
  private isNonRetryableError(error: any): boolean {
    // Don't retry validation errors, auth errors, etc.
    return error.code === 'VALIDATION_ERROR' ||
           error.code === 'AUTH_ERROR' ||
           error.message.includes('duplicate key')
  }
}
```

## Data Management Best Practices

### Partitioning Strategy

```typescript
// Implement intelligent partitioning
const partitioningStrategy = {
  // High-volume tables: Daily partitions
  audit_log: {
    strategy: 'range',
    interval: 'daily',
    retentionDays: 2555, // 7 years
    compressionAfterDays: 90
  },
  
  // Medium-volume tables: Monthly partitions
  compliance_reports: {
    strategy: 'range',
    interval: 'monthly',
    retentionDays: 3650, // 10 years
    compressionAfterDays: 365
  },
  
  // Archive old partitions
  archival: {
    enabled: true,
    archiveAfterDays: 2190, // 6 years
    compressionLevel: 9
  }
}
```

### Data Retention

```typescript
// Implement compliant data retention
class DataRetentionManager {
  constructor(private client: EnhancedAuditDatabaseClient) {}
  
  async enforceRetentionPolicies() {
    const policies = [
      { table: 'audit_log', retentionDays: 2555, condition: 'timestamp' },
      { table: 'user_sessions', retentionDays: 90, condition: 'created_at' },
      { table: 'temp_data', retentionDays: 7, condition: 'created_at' }
    ]
    
    for (const policy of policies) {
      await this.enforcePolicy(policy)
    }
  }
  
  private async enforcePolicy(policy: any) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays)
    
    const result = await this.client.query(
      `DELETE FROM ${policy.table} WHERE ${policy.condition} < $1`,
      [cutoffDate.toISOString()]
    )
    
    console.log(`Deleted ${result.rowCount} expired records from ${policy.table}`)
  }
}
```

## Testing Best Practices

### Unit Testing

```typescript
// Mock the audit client for testing
jest.mock('@repo/audit-db', () => ({
  AuditDb: jest.fn().mockImplementation(() => ({
    getDrizzleInstance: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: 'test-id' }])
        })
      }),
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([])
            })
          })
        })
      })
    }),
    checkAuditDbConnection: jest.fn().mockResolvedValue(true)
  }))
}))
```

### Integration Testing

```typescript
// Integration test with test database
describe('AuditDb Integration Tests', () => {
  let testDb: AuditDb
  
  beforeAll(async () => {
    // Use test database
    testDb = new AuditDb(process.env.TEST_AUDIT_DB_URL)
    
    // Verify connection
    const isConnected = await testDb.checkAuditDbConnection()
    expect(isConnected).toBe(true)
  })
  
  beforeEach(async () => {
    // Clean up test data
    const db = testDb.getDrizzleInstance()
    await db.delete(auditLog)
  })
  
  test('should create and retrieve audit events', async () => {
    const db = testDb.getDrizzleInstance()
    
    // Create test event
    const event = await db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'test.action',
      status: 'success',
      principalId: 'test-user',
      principalType: 'user'
    }).returning()
    
    expect(event).toHaveLength(1)
    expect(event[0].action).toBe('test.action')
    
    // Retrieve event
    const retrieved = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, event[0].id))
    
    expect(retrieved).toHaveLength(1)
    expect(retrieved[0].action).toBe('test.action')
  })
})
```

This comprehensive best practices guide should help you implement the audit-db package effectively in production environments while maintaining security, performance, and reliability standards.