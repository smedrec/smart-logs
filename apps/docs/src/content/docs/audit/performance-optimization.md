---
title: Performance Optimization
description: Advanced performance optimization techniques for high-throughput audit logging with enhanced connection pooling, query monitoring, and database partitioning.
sidebar_position: 5
---

# Performance Optimization

Learn how to leverage the advanced performance features of `@repo/audit-db` for high-throughput audit logging in healthcare environments.

## 🚀 Enhanced Client Configuration

### Production-Ready Setup

```typescript
import { EnhancedAuditDb } from '@repo/audit-db'

const auditDb = new EnhancedAuditDb({
  connection: {
    connectionString: process.env.AUDIT_DB_URL!,
    ssl: true
  },
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
    retentionDays: 2555, // 7 years for HIPAA compliance
    autoMaintenance: true
  }
})
```

### Environment-Specific Configurations

```typescript
// Development Configuration
const developmentConfig = {
  connectionPool: {
    minConnections: 2,
    maxConnections: 5,
    idleTimeout: 30000
  },
  queryCache: {
    enabled: true,
    maxSizeMB: 50,
    defaultTTL: 300
  },
  monitoring: {
    enabled: true,
    slowQueryThreshold: 1000,
    autoOptimization: false
  }
}

// Production Configuration
const productionConfig = {
  connectionPool: {
    minConnections: Math.ceil(process.env.CPU_COUNT * 0.5),
    maxConnections: Math.ceil(process.env.CPU_COUNT * 2),
    idleTimeout: 60000
  },
  queryCache: {
    enabled: true,
    maxSizeMB: 1000,
    defaultTTL: 1800
  },
  monitoring: {
    enabled: true,
    slowQueryThreshold: 200,
    autoOptimization: true,
    alerting: {
      enabled: true,
      slowQueryAlerts: true,
      connectionPoolAlerts: true
    }
  }
}
```

## 🔄 Connection Pool Optimization

### Dynamic Pool Management

```typescript
import { EnhancedAuditDb } from '@repo/audit-db'

class AdaptiveAuditClient {
  private client: EnhancedAuditDb
  
  constructor() {
    this.client = new EnhancedAuditDb(productionConfig)
    this.setupAdaptivePooling()
  }
  
  private async setupAdaptivePooling() {
    // Monitor pool performance and adjust dynamically
    setInterval(async () => {
      const stats = await this.client.getPoolStats()
      
      // Scale up if waiting clients exceed threshold
      if (stats.waitingClients > 5) {
        await this.client.resizePool({ 
          max: Math.min(stats.config.max + 5, 100) 
        })
        console.log('Scaled up connection pool')
      }
      
      // Scale down if utilization is low
      if (stats.activeConnections < stats.config.min * 0.5 && 
          stats.config.max > 10) {
        await this.client.resizePool({ 
          max: Math.max(stats.config.max - 2, 10) 
        })
        console.log('Scaled down connection pool')
      }
    }, 30000) // Check every 30 seconds
  }
  
  async getPoolMetrics() {
    const stats = await this.client.getPoolStats()
    return {
      utilization: (stats.activeConnections / stats.totalConnections) * 100,
      waitingClients: stats.waitingClients,
      averageAcquisitionTime: stats.metrics.averageAcquisitionTime
    }
  }
}
```

### Pool Health Monitoring

```typescript
async function monitorPoolHealth() {
  const client = new EnhancedAuditDb(productionConfig)
  
  const health = await client.getHealthStatus()
  const poolStats = await client.getPoolStats()
  
  console.log('Connection Pool Health:', {
    overall: health.components.connectionPool.status,
    activeConnections: poolStats.activeConnections,
    utilization: `${(poolStats.activeConnections / poolStats.totalConnections * 100).toFixed(2)}%`,
    waitingRequests: poolStats.waitingClients,
    avgAcquisitionTime: `${poolStats.metrics.averageAcquisitionTime}ms`
  })
  
  // Alert if performance degrades
  if (health.components.connectionPool.status !== 'healthy') {
    await sendAlert({
      severity: 'warning',
      message: 'Connection pool performance degraded',
      details: health.components.connectionPool.details
    })
  }
}
```

## 📊 Database Partitioning

### Automated Partition Management

```typescript
class PartitionManager {
  private client: EnhancedAuditDb
  
  constructor() {
    this.client = new EnhancedAuditDb({
      partitioning: {
        enabled: true,
        strategy: 'range',
        interval: 'monthly',
        retentionDays: 2555,
        autoMaintenance: true,
        maintenanceSchedule: '0 2 * * 0' // Sunday 2 AM
      }
    })
  }
  
  async setupPartitioning() {
    // Create partitions for the next 12 months
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const startDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const endDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1)
      
      await this.client.createPartition({
        startDate,
        endDate,
        name: `audit_log_${startDate.getFullYear()}_${String(startDate.getMonth() + 1).padStart(2, '0')}`
      })
    }
  }
  
  async getPartitionMetrics() {
    const partitions = await this.client.getPartitionInfo()
    
    return {
      totalPartitions: partitions.length,
      averageSize: partitions.reduce((sum, p) => sum + p.sizeBytes, 0) / partitions.length,
      totalRecords: partitions.reduce((sum, p) => sum + p.recordCount, 0),
      oldestPartition: Math.min(...partitions.map(p => p.startDate.getTime())),
      newestPartition: Math.max(...partitions.map(p => p.endDate.getTime()))
    }
  }
  
  async optimizePartitions() {
    await this.client.maintainPartitions({
      analyzeTables: true,
      updateStatistics: true,
      reindexIfNeeded: true,
      compressOldPartitions: true
    })
  }
}
```

## ⚡ Query Optimization

### Smart Caching Strategies

```typescript
class SmartCacheManager {
  private client: EnhancedAuditDb
  private cacheStrategies: Map<string, CacheStrategy>
  
  constructor() {
    this.client = new EnhancedAuditDb(productionConfig)
    this.setupCacheStrategies()
  }
  
  private setupCacheStrategies() {
    this.cacheStrategies = new Map([
      ['user_events', { ttl: 300, refreshThreshold: 0.8 }],
      ['dashboard_metrics', { ttl: 900, refreshThreshold: 0.9 }],
      ['compliance_reports', { ttl: 3600, refreshThreshold: 0.95 }],
      ['system_health', { ttl: 60, refreshThreshold: 0.5 }]
    ])
  }
  
  async getCachedQuery(
    cacheType: string,
    sql: string,
    params: any[]
  ) {
    const strategy = this.cacheStrategies.get(cacheType)
    if (!strategy) {
      return await this.client.query(sql, params)
    }
    
    const cacheKey = `${cacheType}_${this.hashParams(params)}`
    
    return await this.client.query(sql, params, {
      cacheKey,
      ttl: strategy.ttl,
      refreshCache: Math.random() > strategy.refreshThreshold
    })
  }
  
  private hashParams(params: any[]): string {
    return Buffer.from(JSON.stringify(params)).toString('base64')
  }
  
  async warmupCache() {
    const commonQueries = [
      {
        type: 'dashboard_metrics',
        sql: 'SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = $1) as successful FROM audit_log WHERE timestamp >= $2',
        params: ['success', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]
      },
      {
        type: 'system_health',
        sql: 'SELECT action, COUNT(*) as count FROM audit_log WHERE timestamp >= $1 GROUP BY action ORDER BY count DESC LIMIT 10',
        params: [new Date(Date.now() - 60 * 60 * 1000).toISOString()]
      }
    ]
    
    await Promise.all(
      commonQueries.map(q => 
        this.getCachedQuery(q.type, q.sql, q.params)
      )
    )
  }
}
```

### Batch Operations

```typescript
class BatchProcessor {
  private client: EnhancedAuditDb
  private batchQueue: any[] = []
  private batchTimer: NodeJS.Timeout | null = null
  
  constructor() {
    this.client = new EnhancedAuditDb(productionConfig)
  }
  
  async addToBatch(event: AuditEvent) {
    this.batchQueue.push(event)
    
    // Process batch when it reaches optimal size or after timeout
    if (this.batchQueue.length >= 100) {
      await this.processBatch()
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processBatch(), 5000)
    }
  }
  
  private async processBatch() {
    if (this.batchQueue.length === 0) return
    
    const events = [...this.batchQueue]
    this.batchQueue = []
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    
    try {
      // Use transaction for batch insert
      await this.client.transaction(async (tx) => {
        // Insert in chunks of 50 for optimal performance
        const chunkSize = 50
        for (let i = 0; i < events.length; i += chunkSize) {
          const chunk = events.slice(i, i + chunkSize)
          await tx.query(
            `INSERT INTO audit_log (timestamp, action, status, principal_id, principal_type, resource_type, metadata) 
             VALUES ${chunk.map((_, idx) => `($${idx * 7 + 1}, $${idx * 7 + 2}, $${idx * 7 + 3}, $${idx * 7 + 4}, $${idx * 7 + 5}, $${idx * 7 + 6}, $${idx * 7 + 7})`).join(', ')}`,
            chunk.flatMap(event => [
              event.timestamp,
              event.action,
              event.status,
              event.principalId,
              event.principalType,
              event.resourceType,
              JSON.stringify(event.metadata)
            ])
          )
        }
      })
      
      console.log(`Successfully processed batch of ${events.length} events`)
    } catch (error) {
      console.error('Batch processing failed:', error)
      // Re-queue events for retry
      this.batchQueue.unshift(...events)
    }
  }
}
```

## 📈 Performance Monitoring

### Real-time Metrics Dashboard

```typescript
class PerformanceDashboard {
  private client: EnhancedAuditDb
  
  constructor() {
    this.client = new EnhancedAuditDb(productionConfig)
  }
  
  async getSystemMetrics() {
    const [
      performanceMetrics,
      healthStatus,
      cacheStats,
      poolStats
    ] = await Promise.all([
      this.client.getPerformanceMetrics(),
      this.client.getHealthStatus(),
      this.client.getCacheStats(),
      this.client.getPoolStats()
    ])
    
    return {
      database: {
        averageQueryTime: performanceMetrics.queries.averageExecutionTime,
        slowQueries: performanceMetrics.queries.slowQueries.length,
        totalQueries: performanceMetrics.queries.total,
        successRate: (performanceMetrics.queries.successful / performanceMetrics.queries.total) * 100
      },
      cache: {
        hitRate: cacheStats.hitRate,
        memoryUsage: cacheStats.memoryUsage.percentage,
        evictionRate: cacheStats.evictionRate
      },
      connectionPool: {
        utilization: (poolStats.activeConnections / poolStats.totalConnections) * 100,
        waitingClients: poolStats.waitingClients,
        avgAcquisitionTime: poolStats.metrics.averageAcquisitionTime
      },
      health: {
        overall: healthStatus.overall,
        uptime: healthStatus.uptime,
        components: Object.entries(healthStatus.components).map(([name, status]) => ({
          name,
          status: status.status,
          responseTime: status.responseTime
        }))
      }
    }
  }
  
  async generatePerformanceReport() {
    const metrics = await this.getSystemMetrics()
    const partitionMetrics = await this.client.getPartitionInfo()
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        overallHealth: metrics.health.overall,
        averageResponseTime: metrics.database.averageQueryTime,
        cacheEfficiency: metrics.cache.hitRate,
        systemLoad: metrics.connectionPool.utilization
      },
      details: metrics,
      partitions: {
        total: partitionMetrics.length,
        totalSize: partitionMetrics.reduce((sum, p) => sum + p.sizeBytes, 0),
        oldestData: Math.min(...partitionMetrics.map(p => p.startDate.getTime()))
      },
      recommendations: this.generateRecommendations(metrics)
    }
  }
  
  private generateRecommendations(metrics: any) {
    const recommendations = []
    
    if (metrics.cache.hitRate < 80) {
      recommendations.push({
        type: 'cache',
        priority: 'high',
        message: 'Cache hit rate is below 80%. Consider increasing cache size or adjusting TTL values.'
      })
    }
    
    if (metrics.database.averageQueryTime > 500) {
      recommendations.push({
        type: 'database',
        priority: 'medium',
        message: 'Average query time is above 500ms. Review slow queries and consider adding indexes.'
      })
    }
    
    if (metrics.connectionPool.utilization > 80) {
      recommendations.push({
        type: 'pool',
        priority: 'high',
        message: 'Connection pool utilization is above 80%. Consider increasing pool size.'
      })
    }
    
    return recommendations
  }
}
```

## 🔧 Performance Tuning

### Automated Optimization

```typescript
class AutoOptimizer {
  private client: EnhancedAuditDb
  
  constructor() {
    this.client = new EnhancedAuditDb(productionConfig)
  }
  
  async runOptimization() {
    console.log('Starting automated optimization...')
    
    const results = await this.client.optimizePerformance({
      analyzeSlowQueries: true,
      optimizeIndexes: true,
      cleanupCache: true,
      maintainPartitions: true,
      updateStatistics: true
    })
    
    console.log('Optimization results:', results)
    
    // Log optimization results for audit trail
    await this.client.query(
      `INSERT INTO audit_log (timestamp, action, status, principal_id, metadata) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        new Date().toISOString(),
        'system.optimization.complete',
        'success',
        'auto_optimizer',
        JSON.stringify({
          duration: results.duration,
          improvementsApplied: results.improvements,
          performanceGain: results.performanceGain
        })
      ]
    )
    
    return results
  }
  
  async scheduleOptimization() {
    // Run optimization during low-traffic hours
    const schedule = '0 3 * * *' // Daily at 3 AM
    
    setInterval(async () => {
      const now = new Date()
      if (now.getHours() === 3 && now.getMinutes() === 0) {
        await this.runOptimization()
      }
    }, 60000) // Check every minute
  }
}
```

## 📋 Performance Best Practices

### 1. Query Optimization Guidelines

```typescript
// ✅ Good: Use indexed fields and appropriate limits
const optimizedQuery = await client.query(`
  SELECT id, timestamp, action, principal_id, status 
  FROM audit_log 
  WHERE principal_id = $1 
    AND timestamp >= $2 
    AND status = $3
  ORDER BY timestamp DESC 
  LIMIT $4
`, [userId, startDate, 'success', 50])

// ❌ Bad: No indexes, no limits
const unoptimizedQuery = await client.query(`
  SELECT * 
  FROM audit_log 
  WHERE metadata->>'department' = $1
  ORDER BY timestamp DESC
`, ['cardiology'])

// ✅ Better: Use proper indexing strategy
const improvedQuery = await client.query(`
  SELECT id, timestamp, action, principal_id, status 
  FROM audit_log 
  WHERE department_indexed = $1 
    AND timestamp >= $2
  ORDER BY timestamp DESC 
  LIMIT $3
`, ['cardiology', startDate, 100])
```

### 2. Connection Management

```typescript
// ✅ Good: Proper connection reuse
class AuditService {
  private client: EnhancedAuditDb
  
  constructor() {
    this.client = new EnhancedAuditDb(config)
  }
  
  async logEvent(event: AuditEvent) {
    return await this.client.query(
      'INSERT INTO audit_log (...) VALUES (...)',
      [event.data]
    )
  }
}

// ❌ Bad: Creating new connections
async function logEvent(event: AuditEvent) {
  const client = new EnhancedAuditDb(config) // Don't do this
  return await client.query('INSERT INTO audit_log (...) VALUES (...)', [event.data])
}
```

### 3. Caching Strategy

```typescript
const cacheConfig = {
  // High-frequency, low-change data
  userProfiles: { ttl: 3600, priority: 'high' },
  
  // Medium-frequency data
  dashboardMetrics: { ttl: 900, priority: 'medium' },
  
  // Low-frequency, expensive queries
  complianceReports: { ttl: 7200, priority: 'low' },
  
  // Real-time data (minimal caching)
  liveMetrics: { ttl: 30, priority: 'high' }
}
```

## 🎯 Benchmarking

### Performance Testing Suite

```typescript
class PerformanceBenchmark {
  private client: EnhancedAuditDb
  
  constructor() {
    this.client = new EnhancedAuditDb(productionConfig)
  }
  
  async runInsertBenchmark(iterations: number = 1000) {
    console.log(`Running insert benchmark with ${iterations} iterations...`)
    
    const startTime = Date.now()
    const events = Array.from({ length: iterations }, (_, i) => ({
      timestamp: new Date().toISOString(),
      action: 'benchmark.insert',
      status: 'success',
      principalId: `user-${i}`,
      principalType: 'user',
      metadata: { benchmarkId: 'insert-test', iteration: i }
    }))
    
    // Batch insert for better performance
    await this.client.queryBatch(
      events.map(event => ({
        sql: 'INSERT INTO audit_log (timestamp, action, status, principal_id, principal_type, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
        params: [event.timestamp, event.action, event.status, event.principalId, event.principalType, JSON.stringify(event.metadata)]
      }))
    )
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    return {
      totalTime: duration,
      averageTime: duration / iterations,
      operationsPerSecond: Math.round((iterations / duration) * 1000),
      iterations
    }
  }
  
  async runQueryBenchmark() {
    console.log('Running query benchmark...')
    
    const queries = [
      { name: 'recent_events', sql: 'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100' },
      { name: 'user_filter', sql: 'SELECT * FROM audit_log WHERE principal_id = $1 LIMIT 50', params: ['user-1'] },
      { name: 'date_range', sql: 'SELECT COUNT(*) FROM audit_log WHERE timestamp >= $1', params: [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()] }
    ]
    
    const results = []
    
    for (const query of queries) {
      const startTime = Date.now()
      await this.client.query(query.sql, query.params || [])
      const endTime = Date.now()
      
      results.push({
        name: query.name,
        duration: endTime - startTime
      })
    }
    
    return results
  }
}
```

## 🚨 Monitoring and Alerting

### Automated Alert System

```typescript
class PerformanceAlertSystem {
  private client: EnhancedAuditDb
  private thresholds = {
    slowQueryThreshold: 1000,
    cacheHitRateThreshold: 75,
    connectionUtilizationThreshold: 85,
    errorRateThreshold: 5
  }
  
  constructor() {
    this.client = new EnhancedAuditDb(productionConfig)
    this.startMonitoring()
  }
  
  private startMonitoring() {
    setInterval(async () => {
      await this.checkPerformanceThresholds()
    }, 60000) // Check every minute
  }
  
  private async checkPerformanceThresholds() {
    const metrics = await this.client.getPerformanceMetrics()
    const health = await this.client.getHealthStatus()
    
    // Check slow queries
    if (metrics.queries.averageExecutionTime > this.thresholds.slowQueryThreshold) {
      await this.sendAlert({
        type: 'slow_queries',
        severity: 'warning',
        message: `Average query time (${metrics.queries.averageExecutionTime}ms) exceeds threshold`,
        threshold: this.thresholds.slowQueryThreshold,
        current: metrics.queries.averageExecutionTime
      })
    }
    
    // Check cache performance
    if (metrics.cache.hitRate < this.thresholds.cacheHitRateThreshold) {
      await this.sendAlert({
        type: 'cache_performance',
        severity: 'warning',
        message: `Cache hit rate (${metrics.cache.hitRate}%) below threshold`,
        threshold: this.thresholds.cacheHitRateThreshold,
        current: metrics.cache.hitRate
      })
    }
    
    // Check connection pool
    const poolUtilization = (metrics.connectionPool.activeConnections / metrics.connectionPool.totalAcquired) * 100
    if (poolUtilization > this.thresholds.connectionUtilizationThreshold) {
      await this.sendAlert({
        type: 'connection_pool',
        severity: 'critical',
        message: `Connection pool utilization (${poolUtilization.toFixed(2)}%) exceeds threshold`,
        threshold: this.thresholds.connectionUtilizationThreshold,
        current: poolUtilization
      })
    }
  }
  
  private async sendAlert(alert: any) {
    // Log alert to audit system
    await this.client.query(
      `INSERT INTO audit_log (timestamp, action, status, principal_id, metadata) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        new Date().toISOString(),
        'system.performance.alert',
        'warning',
        'performance_monitor',
        JSON.stringify(alert)
      ]
    )
    
    // Send to external alerting system
    console.warn('Performance Alert:', alert)
  }
}
```

## 📖 Next Steps

Continue your performance optimization journey:

- **[Caching Strategies](./caching-strategies)** - Advanced Redis caching patterns
- **[Database Partitioning](./partitioning-guide)** - Comprehensive partitioning strategies  
- **[Security](./security)** - Performance with security best practices
- **[CLI Reference](./cli-reference)** - Performance monitoring tools

## 🎯 Summary

You've learned how to:

- ✅ Configure enhanced clients for optimal performance
- ✅ Implement adaptive connection pool management
- ✅ Set up database partitioning for large datasets
- ✅ Use smart caching strategies for better response times
- ✅ Monitor performance metrics and health status
- ✅ Implement automated optimization routines
- ✅ Set up alerting for performance degradation

These techniques will ensure your audit system can handle high-throughput healthcare workloads while maintaining HIPAA and GDPR compliance requirements.