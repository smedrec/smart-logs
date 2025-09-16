# Performance Optimization Guide

This guide provides comprehensive strategies for optimizing the performance of the `@repo/audit` package in high-volume healthcare environments, ensuring optimal throughput while maintaining compliance and security.

## 🎯 Performance Objectives

### Key Performance Indicators
- **Throughput**: > 10,000 events per second
- **Latency**: < 100ms average processing time
- **Queue Depth**: < 1,000 pending events
- **Memory Usage**: < 512MB per instance
- **CPU Utilization**: < 70% under normal load

### Healthcare-Specific Requirements
- **High Availability**: 99.9% uptime for audit logging
- **HIPAA Compliance**: Maintain security while optimizing
- **Real-time Processing**: Near real-time audit event processing
- **Scalability**: Handle peak loads during busy clinical hours

## ⚡ High-Throughput Configuration

### Optimized Audit Configuration

```typescript
const highPerformanceConfig: AuditConfig = {
  version: '1.0',
  environment: 'production',
  
  reliableProcessor: {
    queueName: 'high-volume-audit',
    
    // Batch processing for maximum throughput
    batchSize: 500,              // Process 500 events at once
    maxBatchWait: 100,           // Wait max 100ms for batch
    
    // Concurrency optimization
    concurrency: 20,             // 20 concurrent workers
    maxConcurrency: 50,          // Scale up to 50 workers
    
    // Retry configuration
    maxRetries: 3,
    retryDelay: 500,
    exponentialBackoff: true,
    maxRetryDelay: 5000,
    
    // Circuit breaker for resilience
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 100,
    circuitBreakerTimeout: 30000,
    
    // Queue optimization
    enableDLQ: true,
    enablePriority: true,
    enableBatching: true,
    
    // Redis optimization
    redis: {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableAutoPipelining: true,
      maxMemoryPolicy: 'allkeys-lru'
    }
  },
  
  // Optimized security (balance security with performance)
  security: {
    enableEncryption: true,
    enableTamperDetection: true,
    
    crypto: {
      algorithm: 'SHA-256',
      signingAlgorithm: 'HMAC-SHA256'
    },
    
    // Batch crypto operations
    enableBatchHashing: true,
    enableBatchSigning: true
  },
  
  // Performance monitoring
  observability: {
    enableMetrics: true,
    metricsInterval: 10000,      // 10-second intervals
    enableProfiling: true,
    enableBottleneckDetection: true,
    
    // Alert thresholds
    alertThresholds: {
      processingLatency: 200,    // Alert if > 200ms
      queueDepth: 2000,          // Alert if > 2000 events
      errorRate: 0.05,           // Alert if > 5% error rate
      memoryUsage: 512           // Alert if > 512MB
    }
  }
}
```

### Batch Processing Implementation

```typescript
class BatchAuditProcessor {
  private batchSize: number = 500
  private batchTimeout: number = 100
  private eventBatch: AuditLogEvent[] = []
  private batchTimer: NodeJS.Timeout | null = null

  constructor(private auditService: Audit) {}

  /**
   * Add event to batch for processing
   */
  async addToBatch(event: AuditLogEvent): Promise<void> {
    this.eventBatch.push(event)
    
    // Process batch if it reaches the configured size
    if (this.eventBatch.length >= this.batchSize) {
      await this.processBatch()
      return
    }
    
    // Set timeout to process batch if it hasn't been processed yet
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(async () => {
        await this.processBatch()
      }, this.batchTimeout)
    }
  }

  /**
   * Process current batch of events
   */
  private async processBatch(): Promise<void> {
    if (this.eventBatch.length === 0) return
    
    const currentBatch = [...this.eventBatch]
    this.eventBatch = []
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    try {
      // Process batch with performance metrics
      const startTime = Date.now()
      
      // Use Promise.all for concurrent processing
      await Promise.all(
        this.chunkArray(currentBatch, 100).map(chunk => 
          this.processBatchChunk(chunk)
        )
      )
      
      const processingTime = Date.now() - startTime
      
      // Log performance metrics
      await this.recordBatchMetrics({
        batchSize: currentBatch.length,
        processingTime,
        throughput: currentBatch.length / (processingTime / 1000)
      })
      
    } catch (error) {
      console.error('Batch processing failed:', error)
      // Implement retry logic for failed batch
      await this.handleBatchFailure(currentBatch, error)
    }
  }

  private async processBatchChunk(chunk: AuditLogEvent[]): Promise<void> {
    // Pre-generate hashes for the entire chunk
    const hashedEvents = await this.batchGenerateHashes(chunk)
    
    // Batch insert to queue
    await this.batchInsertToQueue(hashedEvents)
  }

  private async batchGenerateHashes(events: AuditLogEvent[]): Promise<AuditLogEvent[]> {
    return Promise.all(
      events.map(async event => ({
        ...event,
        hash: this.auditService.generateEventHash(event)
      }))
    )
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }
}
```

## 🗄️ Database Optimization

### Connection Pool Configuration

```typescript
import postgres from 'postgres'

const optimizedDbConfig = {
  // Connection pool settings
  max: 50,                    // Maximum connections
  idle_timeout: 20,           // Close idle connections after 20s
  connect_timeout: 10,        // Connection timeout
  prepare: false,             // Disable prepared statements for flexibility
  
  // Performance settings
  transform: postgres.camel,  // Convert snake_case to camelCase
  debug: false,              // Disable debug in production
  onnotice: () => {},        // Suppress notices
  
  // Optimization settings
  fetch_types: false,        // Skip type fetching for performance
  publications: undefined,   // Disable publications
  types: {},                // Custom type parsers
}

export const createOptimizedDb = () => {
  const sql = postgres(process.env.DATABASE_URL!, optimizedDbConfig)
  return drizzle(sql)
}
```

### Query Optimization

```typescript
class OptimizedAuditQueries {
  /**
   * Optimized bulk insert for audit events
   */
  static async bulkInsertEvents(events: AuditLogEvent[]): Promise<void> {
    const CHUNK_SIZE = 1000
    const chunks = this.chunkArray(events, CHUNK_SIZE)
    
    // Process chunks in parallel with connection pooling
    await Promise.all(
      chunks.map(chunk => this.insertChunk(chunk))
    )
  }

  private static async insertChunk(events: AuditLogEvent[]): Promise<void> {
    const db = createOptimizedDb()
    
    try {
      // Use batch insert with ON CONFLICT handling
      await db.insert(auditLog)
        .values(events)
        .onConflictDoNothing() // Handle duplicate prevention
        .execute()
    } catch (error) {
      // Implement retry logic with exponential backoff
      await this.retryInsertWithBackoff(events, error)
    }
  }

  /**
   * Optimized audit log queries with proper indexing
   */
  static async getRecentEvents(params: {
    startTime: Date
    endTime: Date
    principalId?: string
    dataClassification?: DataClassification
    limit?: number
  }): Promise<AuditLogEvent[]> {
    const db = createOptimizedDb()
    
    let query = db.select()
      .from(auditLog)
      .where(
        and(
          gte(auditLog.timestamp, params.startTime.toISOString()),
          lte(auditLog.timestamp, params.endTime.toISOString())
        )
      )
      .orderBy(desc(auditLog.timestamp))
    
    // Add filters with proper index usage
    if (params.principalId) {
      query = query.where(eq(auditLog.principalId, params.principalId))
    }
    
    if (params.dataClassification) {
      query = query.where(eq(auditLog.dataClassification, params.dataClassification))
    }
    
    if (params.limit) {
      query = query.limit(params.limit)
    }
    
    return await query.execute()
  }
}
```

### Database Schema Optimization

```sql
-- Optimized indexes for high-performance queries
CREATE INDEX CONCURRENTLY idx_audit_log_timestamp_desc ON audit_log (timestamp DESC);
CREATE INDEX CONCURRENTLY idx_audit_log_principal_id ON audit_log (principal_id);
CREATE INDEX CONCURRENTLY idx_audit_log_action ON audit_log (action);
CREATE INDEX CONCURRENTLY idx_audit_log_data_classification ON audit_log (data_classification);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_audit_log_principal_time ON audit_log (principal_id, timestamp DESC);
CREATE INDEX CONCURRENTLY idx_audit_log_classification_time ON audit_log (data_classification, timestamp DESC);

-- Partial indexes for PHI access monitoring
CREATE INDEX CONCURRENTLY idx_audit_log_phi_access ON audit_log (timestamp DESC, principal_id) 
WHERE data_classification = 'PHI';

-- Hash index for exact lookups
CREATE INDEX CONCURRENTLY idx_audit_log_hash ON audit_log USING hash (hash);
```

### Table Partitioning Strategy

```sql
-- Monthly partitioning for large audit tables
CREATE TABLE audit_log_y2024m01 PARTITION OF audit_log
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE audit_log_y2024m02 PARTITION OF audit_log
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Automatic partition creation function
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name text, start_date date)
RETURNS void AS $$
DECLARE
    partition_name text;
    end_date date;
BEGIN
    partition_name := table_name || '_y' || EXTRACT(year FROM start_date) || 'm' || 
                     LPAD(EXTRACT(month FROM start_date)::text, 2, '0');
    end_date := start_date + interval '1 month';
    
    EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;
```

## 🔴 Redis Optimization

### Redis Configuration

```typescript
const optimizedRedisConfig = {
  // Connection optimization
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  
  // Performance settings
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableAutoPipelining: true,
  maxMemoryPolicy: 'allkeys-lru',
  
  // Connection pool
  family: 4,
  keepAlive: true,
  
  // Retry strategy
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  
  // Clustering (for high availability)
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  
  // Memory optimization
  compression: 'gzip',
  keyPrefix: 'audit:',
  
  // Custom commands for batch operations
  showFriendlyErrorStack: false
}
```

### Redis Batch Operations

```typescript
class OptimizedRedisOperations {
  private redis: Redis

  constructor(redis: Redis) {
    this.redis = redis
  }

  /**
   * Batch enqueue operations for better performance
   */
  async batchEnqueue(queueName: string, jobs: any[]): Promise<void> {
    const pipeline = this.redis.pipeline()
    
    for (const job of jobs) {
      pipeline.lpush(`bull:${queueName}:waiting`, JSON.stringify(job))
    }
    
    // Execute all operations in a single round trip
    await pipeline.exec()
  }

  /**
   * Optimized queue statistics collection
   */
  async getQueueStatsOptimized(queueName: string): Promise<{
    waiting: number
    active: number
    completed: number
    failed: number
  }> {
    const pipeline = this.redis.pipeline()
    
    pipeline.llen(`bull:${queueName}:waiting`)
    pipeline.llen(`bull:${queueName}:active`)
    pipeline.llen(`bull:${queueName}:completed`)
    pipeline.llen(`bull:${queueName}:failed`)
    
    const results = await pipeline.exec()
    
    return {
      waiting: results![0][1] as number,
      active: results![1][1] as number,
      completed: results![2][1] as number,
      failed: results![3][1] as number
    }
  }

  /**
   * Memory-efficient event caching
   */
  async cacheRecentEvents(events: AuditLogEvent[], ttl: number = 3600): Promise<void> {
    const pipeline = this.redis.pipeline()
    
    for (const event of events) {
      const key = `recent_event:${event.timestamp}:${event.principalId}`
      const compressedEvent = await this.compressEvent(event)
      
      pipeline.setex(key, ttl, compressedEvent)
    }
    
    await pipeline.exec()
  }

  private async compressEvent(event: AuditLogEvent): Promise<string> {
    const zlib = require('zlib')
    const jsonString = JSON.stringify(event)
    const compressed = zlib.gzipSync(jsonString)
    return compressed.toString('base64')
  }
}
```

## 📊 Performance Monitoring

### Real-Time Performance Metrics

```typescript
class PerformanceMonitor {
  private metricsCollector: Map<string, number[]> = new Map()
  private alertThresholds: Record<string, number>

  constructor(thresholds: Record<string, number>) {
    this.alertThresholds = thresholds
    this.startMonitoring()
  }

  /**
   * Record performance metric
   */
  recordMetric(name: string, value: number): void {
    if (!this.metricsCollector.has(name)) {
      this.metricsCollector.set(name, [])
    }
    
    const metrics = this.metricsCollector.get(name)!
    metrics.push(value)
    
    // Keep only last 1000 measurements
    if (metrics.length > 1000) {
      metrics.shift()
    }
    
    // Check for threshold violations
    this.checkThreshold(name, value)
  }

  /**
   * Get performance statistics
   */
  getStats(name: string): {
    avg: number
    min: number
    max: number
    p95: number
    p99: number
    count: number
  } | null {
    const metrics = this.metricsCollector.get(name)
    if (!metrics || metrics.length === 0) return null
    
    const sorted = [...metrics].sort((a, b) => a - b)
    const count = sorted.length
    
    return {
      avg: sorted.reduce((a, b) => a + b, 0) / count,
      min: sorted[0],
      max: sorted[count - 1],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
      count
    }
  }

  private checkThreshold(name: string, value: number): void {
    const threshold = this.alertThresholds[name]
    if (threshold && value > threshold) {
      this.alertOnThresholdViolation(name, value, threshold)
    }
  }

  private async alertOnThresholdViolation(name: string, value: number, threshold: number): Promise<void> {
    await auditService.logCritical({
      principalId: 'performance-monitor',
      action: 'performance.threshold.violation',
      status: 'failure',
      dataClassification: 'INTERNAL',
      details: {
        metric: name,
        value,
        threshold,
        violationRatio: value / threshold
      },
      outcomeDescription: `Performance threshold violated: ${name} = ${value} (threshold: ${threshold})`
    }, {
      priority: 2,
      notify: ['ops-team']
    })
  }

  /**
   * Start continuous monitoring
   */
  private startMonitoring(): void {
    setInterval(() => {
      this.collectSystemMetrics()
    }, 10000) // Every 10 seconds
  }

  private async collectSystemMetrics(): Promise<void> {
    const process = require('process')
    
    // Memory usage
    const memUsage = process.memoryUsage()
    this.recordMetric('memory.heap.used', memUsage.heapUsed / 1024 / 1024) // MB
    this.recordMetric('memory.heap.total', memUsage.heapTotal / 1024 / 1024) // MB
    
    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage()
    this.recordMetric('cpu.user', cpuUsage.user / 1000) // ms
    this.recordMetric('cpu.system', cpuUsage.system / 1000) // ms
    
    // Event loop lag
    const start = process.hrtime.bigint()
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e6 // ms
      this.recordMetric('eventloop.lag', lag)
    })
  }
}
```

### Automated Performance Optimization

```typescript
class AutoPerformanceOptimizer {
  private performanceMonitor: PerformanceMonitor
  private auditService: Audit
  private optimizationRules: OptimizationRule[]

  constructor(performanceMonitor: PerformanceMonitor, auditService: Audit) {
    this.performanceMonitor = performanceMonitor
    this.auditService = auditService
    this.optimizationRules = this.createOptimizationRules()
    this.startOptimization()
  }

  private createOptimizationRules(): OptimizationRule[] {
    return [
      {
        name: 'queue_depth_optimization',
        condition: () => {
          const stats = this.performanceMonitor.getStats('queue.depth')
          return stats && stats.avg > 1000
        },
        action: async () => {
          // Increase concurrency temporarily
          await this.adjustConcurrency(1.5)
        }
      },
      {
        name: 'memory_pressure_optimization',
        condition: () => {
          const stats = this.performanceMonitor.getStats('memory.heap.used')
          return stats && stats.avg > 400 // 400MB
        },
        action: async () => {
          // Trigger garbage collection and reduce batch size
          global.gc && global.gc()
          await this.adjustBatchSize(0.8)
        }
      },
      {
        name: 'high_latency_optimization',
        condition: () => {
          const stats = this.performanceMonitor.getStats('processing.latency')
          return stats && stats.p95 > 500 // 500ms
        },
        action: async () => {
          // Enable batch processing
          await this.enableBatchProcessing()
        }
      }
    ]
  }

  private startOptimization(): void {
    setInterval(() => {
      this.runOptimizationRules()
    }, 30000) // Every 30 seconds
  }

  private async runOptimizationRules(): Promise<void> {
    for (const rule of this.optimizationRules) {
      if (rule.condition()) {
        try {
          await rule.action()
          await this.logOptimizationAction(rule.name)
        } catch (error) {
          console.error(`Optimization rule ${rule.name} failed:`, error)
        }
      }
    }
  }

  private async logOptimizationAction(ruleName: string): Promise<void> {
    await this.auditService.log({
      principalId: 'auto-performance-optimizer',
      action: 'performance.optimization.applied',
      status: 'success',
      details: {
        optimizationRule: ruleName,
        timestamp: new Date().toISOString()
      },
      outcomeDescription: `Applied performance optimization: ${ruleName}`
    })
  }
}

interface OptimizationRule {
  name: string
  condition: () => boolean
  action: () => Promise<void>
}
```

## 🚀 Load Testing and Benchmarking

### Automated Load Testing

```typescript
class AuditLoadTester {
  private auditService: Audit
  private performanceMonitor: PerformanceMonitor

  constructor(auditService: Audit, performanceMonitor: PerformanceMonitor) {
    this.auditService = auditService
    this.performanceMonitor = performanceMonitor
  }

  /**
   * Run comprehensive load test
   */
  async runLoadTest(params: {
    duration: number        // Test duration in seconds
    targetTPS: number      // Target transactions per second
    rampUpTime: number     // Ramp up time in seconds
  }): Promise<LoadTestResults> {
    console.log(`Starting load test: ${params.targetTPS} TPS for ${params.duration}s`)
    
    const startTime = Date.now()
    const endTime = startTime + (params.duration * 1000)
    const rampUpEnd = startTime + (params.rampUpTime * 1000)
    
    let totalEvents = 0
    let successfulEvents = 0
    let failedEvents = 0
    const latencies: number[] = []

    const testEvents = this.generateTestEvents(params.targetTPS * params.duration)
    
    // Ramp up phase
    await this.rampUpLoad(testEvents, params.targetTPS, params.rampUpTime)
    
    // Sustained load phase
    const sustainedEvents = testEvents.slice(params.targetTPS * params.rampUpTime)
    const results = await this.sustainedLoad(sustainedEvents, params.targetTPS)
    
    return {
      duration: params.duration,
      targetTPS: params.targetTPS,
      actualTPS: results.actualTPS,
      totalEvents: results.totalEvents,
      successfulEvents: results.successfulEvents,
      failedEvents: results.failedEvents,
      averageLatency: results.averageLatency,
      p95Latency: results.p95Latency,
      p99Latency: results.p99Latency,
      errorRate: results.failedEvents / results.totalEvents
    }
  }

  private generateTestEvents(count: number): AuditLogEvent[] {
    const events: AuditLogEvent[] = []
    const actions = ['patient.view', 'patient.update', 'auth.login', 'fhir.read']
    const users = Array.from({length: 100}, (_, i) => `user-${i}`)
    
    for (let i = 0; i < count; i++) {
      events.push({
        timestamp: new Date().toISOString(),
        principalId: users[i % users.length],
        action: actions[i % actions.length],
        status: 'success',
        targetResourceType: 'Patient',
        targetResourceId: `patient-${i % 1000}`,
        dataClassification: 'PHI',
        sessionContext: {
          sessionId: `sess-${i}`,
          ipAddress: `192.168.1.${(i % 254) + 1}`,
          userAgent: 'LoadTest/1.0'
        }
      })
    }
    
    return events
  }

  private async sustainedLoad(events: AuditLogEvent[], targetTPS: number): Promise<{
    actualTPS: number
    totalEvents: number
    successfulEvents: number
    failedEvents: number
    averageLatency: number
    p95Latency: number
    p99Latency: number
  }> {
    const startTime = Date.now()
    const intervalMs = 1000 / targetTPS
    let eventIndex = 0
    let successfulEvents = 0
    let failedEvents = 0
    const latencies: number[] = []

    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        if (eventIndex >= events.length) {
          clearInterval(interval)
          
          const duration = (Date.now() - startTime) / 1000
          const sortedLatencies = latencies.sort((a, b) => a - b)
          
          resolve({
            actualTPS: events.length / duration,
            totalEvents: events.length,
            successfulEvents,
            failedEvents,
            averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
            p95Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)],
            p99Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)]
          })
          return
        }

        const event = events[eventIndex++]
        const eventStartTime = Date.now()

        try {
          await this.auditService.log(event)
          successfulEvents++
        } catch (error) {
          failedEvents++
        }

        latencies.push(Date.now() - eventStartTime)
      }, intervalMs)
    })
  }
}

interface LoadTestResults {
  duration: number
  targetTPS: number
  actualTPS: number
  totalEvents: number
  successfulEvents: number
  failedEvents: number
  averageLatency: number
  p95Latency: number
  p99Latency: number
  errorRate: number
}
```

## 📋 Performance Optimization Checklist

### Configuration Optimization
- [ ] **Batch Processing**: Enabled with optimal batch size (100-500 events)
- [ ] **Concurrency**: Set to appropriate level for your infrastructure
- [ ] **Connection Pooling**: Database and Redis pools properly configured
- [ ] **Memory Management**: Heap size and garbage collection optimized
- [ ] **Queue Configuration**: Proper queue settings for your workload

### Database Optimization
- [ ] **Indexing**: All critical queries have appropriate indexes
- [ ] **Partitioning**: Large tables partitioned by time/organization
- [ ] **Connection Limits**: Database connections within recommended limits
- [ ] **Query Optimization**: Slow queries identified and optimized
- [ ] **Maintenance**: Regular VACUUM, ANALYZE, and REINDEX operations

### Redis Optimization
- [ ] **Memory Configuration**: Appropriate memory limits and eviction policies
- [ ] **Persistence**: Balanced persistence settings for performance vs durability
- [ ] **Clustering**: Redis cluster for high availability if needed
- [ ] **Pipelining**: Batch operations where possible
- [ ] **Monitoring**: Redis metrics monitored continuously

### Application Optimization
- [ ] **Event Validation**: Optimized validation with appropriate caching
- [ ] **Cryptographic Operations**: Batch hashing and signing where possible
- [ ] **Memory Leaks**: Regular memory leak detection and prevention
- [ ] **Error Handling**: Efficient error handling without performance impact
- [ ] **Logging**: Structured logging with appropriate levels

## 💡 Performance Best Practices

1. **Start with Baseline**: Establish performance baseline before optimization
2. **Monitor Continuously**: Implement comprehensive performance monitoring
3. **Optimize Gradually**: Make incremental optimizations and measure impact
4. **Test Thoroughly**: Load test all optimizations before production deployment
5. **Plan for Scale**: Design for future growth and peak loads
6. **Balance Security**: Maintain security while optimizing performance
7. **Document Changes**: Keep detailed records of optimization changes
8. **Regular Reviews**: Conduct regular performance reviews and updates

Your audit system is now optimized for high-performance healthcare environments!