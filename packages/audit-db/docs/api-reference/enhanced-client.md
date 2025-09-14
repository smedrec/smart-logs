# Enhanced Client API Reference

The `EnhancedAuditDatabaseClient` provides advanced database operations with performance optimization, monitoring, and caching capabilities.

## EnhancedAuditDatabaseClient Class

### Constructor

```typescript
constructor(config: EnhancedClientConfig)
```

**Configuration Interface:**
```typescript
interface EnhancedClientConfig {
  connectionPool: ConnectionPoolConfig
  queryCache?: QueryCacheConfig
  redis?: RedisConfig
  monitoring?: MonitoringConfig
  partitioning?: PartitioningConfig
}
```

### Core Methods

#### `query()`

Execute SQL queries with automatic caching and performance monitoring.

```typescript
async query<T = any>(
  sql: string, 
  params?: any[], 
  options?: QueryOptions
): Promise<T[]>
```

**Parameters:**
- `sql`: SQL query string
- `params`: Query parameters
- `options`: Query execution options

**Options Interface:**
```typescript
interface QueryOptions {
  cacheKey?: string
  ttl?: number
  skipCache?: boolean
  refreshCache?: boolean
  timeout?: number
}
```

**Example:**
```typescript
const client = new EnhancedAuditDatabaseClient(config)

// Cached query
const events = await client.query(
  'SELECT * FROM audit_log WHERE principal_id = $1 ORDER BY timestamp DESC LIMIT $2',
  ['user-123', 10],
  {
    cacheKey: 'user_events_user-123',
    ttl: 300 // 5 minutes
  }
)

// Non-cached real-time query
const liveData = await client.query(
  'SELECT COUNT(*) FROM audit_log WHERE status = $1',
  ['failure'],
  { skipCache: true }
)
```

#### `queryBatch()`

Execute multiple queries efficiently in a batch operation.

```typescript
async queryBatch(queries: BatchQuery[]): Promise<BatchResult[]>
```

**Batch Query Interface:**
```typescript
interface BatchQuery {
  sql: string
  params?: any[]
  options?: QueryOptions
}

interface BatchResult {
  success: boolean
  data?: any[]
  error?: Error
  executionTime: number
}
```

**Example:**
```typescript
const results = await client.queryBatch([
  {
    sql: 'SELECT COUNT(*) FROM audit_log WHERE action = $1',
    params: ['user.login'],
    options: { cacheKey: 'login_count', ttl: 600 }
  },
  {
    sql: 'SELECT COUNT(*) FROM audit_log WHERE status = $1',
    params: ['failure'],
    options: { cacheKey: 'failure_count', ttl: 300 }
  }
])
```

#### `transaction()`

Execute multiple operations within a database transaction.

```typescript
async transaction<T>(
  callback: (tx: TransactionClient) => Promise<T>
): Promise<T>
```

**Example:**
```typescript
const result = await client.transaction(async (tx) => {
  const event1 = await tx.query(
    'INSERT INTO audit_log (...) VALUES (...) RETURNING *',
    [params1]
  )
  
  const event2 = await tx.query(
    'INSERT INTO audit_log (...) VALUES (...) RETURNING *',
    [params2]
  )
  
  return { event1: event1[0], event2: event2[0] }
})
```

### Performance and Monitoring

#### `getPerformanceMetrics()`

Retrieve detailed performance metrics for the client.

```typescript
async getPerformanceMetrics(): Promise<PerformanceMetrics>
```

**Metrics Interface:**
```typescript
interface PerformanceMetrics {
  queries: {
    total: number
    successful: number
    failed: number
    averageExecutionTime: number
    slowQueries: SlowQuery[]
  }
  cache: {
    hitRate: number
    missRate: number
    evictions: number
    memoryUsage: number
  }
  connectionPool: {
    activeConnections: number
    idleConnections: number
    waitingRequests: number
    totalAcquired: number
    acquisitionTime: number
  }
  partitions: {
    activePartitions: number
    partitionEfficiency: number
    lastMaintenance: Date
  }
}
```

#### `getHealthStatus()`

Get comprehensive health status of all client components.

```typescript
async getHealthStatus(): Promise<ClientHealthStatus>
```

**Health Status Interface:**
```typescript
interface ClientHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  components: {
    database: ComponentHealth
    cache: ComponentHealth
    connectionPool: ComponentHealth
    partitioning: ComponentHealth
  }
  lastChecked: Date
  uptime: number
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  errorRate: number
  details: Record<string, any>
}
```

#### `optimizePerformance()`

Execute automatic performance optimization.

```typescript
async optimizePerformance(options?: OptimizationOptions): Promise<OptimizationResult>
```

**Options Interface:**
```typescript
interface OptimizationOptions {
  analyzeSlow Queries?: boolean
  optimizeIndexes?: boolean
  cleanupCache?: boolean
  maintainPartitions?: boolean
  updateStatistics?: boolean
}
```

### Cache Management

#### `getCacheStats()`

Retrieve cache performance statistics.

```typescript
async getCacheStats(): Promise<CacheStats>
```

**Cache Stats Interface:**
```typescript
interface CacheStats {
  hitRate: number
  missRate: number
  evictionRate: number
  memoryUsage: {
    used: number
    available: number
    percentage: number
  }
  topQueries: Array<{
    key: string
    hits: number
    lastAccessed: Date
  }>
}
```

#### `clearCache()`

Clear cache entries based on patterns or keys.

```typescript
async clearCache(pattern?: string | string[]): Promise<number>
```

**Example:**
```typescript
// Clear all cache
await client.clearCache()

// Clear specific pattern
await client.clearCache('user_events_*')

// Clear multiple keys
await client.clearCache(['key1', 'key2', 'key3'])
```

#### `warmupCache()`

Pre-populate cache with frequently accessed queries.

```typescript
async warmupCache(queries: WarmupQuery[]): Promise<WarmupResult>
```

**Warmup Query Interface:**
```typescript
interface WarmupQuery {
  sql: string
  params?: any[]
  cacheKey: string
  ttl?: number
}

interface WarmupResult {
  successful: number
  failed: number
  totalTime: number
  errors: Error[]
}
```

### Connection Pool Management

#### `getPoolStats()`

Get connection pool statistics and health information.

```typescript
async getPoolStats(): Promise<PoolStats>
```

**Pool Stats Interface:**
```typescript
interface PoolStats {
  totalConnections: number
  activeConnections: number
  idleConnections: number
  waitingClients: number
  config: {
    min: number
    max: number
    idleTimeout: number
    acquireTimeout: number
  }
  metrics: {
    totalAcquired: number
    totalReleased: number
    totalCreated: number
    totalDestroyed: number
    averageAcquisitionTime: number
  }
}
```

#### `resizePool()`

Dynamically resize the connection pool.

```typescript
async resizePool(newSize: { min?: number; max?: number }): Promise<void>
```

**Example:**
```typescript
// Scale up for high load
await client.resizePool({ min: 10, max: 50 })

// Scale down for maintenance
await client.resizePool({ min: 2, max: 10 })
```

### Partition Management

#### `getPartitionInfo()`

Retrieve information about database partitions.

```typescript
async getPartitionInfo(): Promise<PartitionInfo[]>
```

**Partition Info Interface:**
```typescript
interface PartitionInfo {
  name: string
  tableName: string
  startDate: Date
  endDate: Date
  recordCount: number
  sizeBytes: number
  indexCount: number
  lastMaintenance: Date
  efficiency: number
}
```

#### `createPartition()`

Create a new partition for the specified date range.

```typescript
async createPartition(config: PartitionConfig): Promise<PartitionResult>
```

#### `maintainPartitions()`

Execute partition maintenance operations.

```typescript
async maintainPartitions(options?: MaintenanceOptions): Promise<MaintenanceResult>
```

## Factory Functions

### `createEnhancedAuditClient()`

Create an optimized client with environment-specific defaults.

```typescript
function createEnhancedAuditClient(
  environment: 'development' | 'staging' | 'production',
  customConfig?: Partial<EnhancedClientConfig>
): EnhancedAuditDatabaseClient
```

**Environment Presets:**

**Development:**
```typescript
{
  connectionPool: { min: 2, max: 5 },
  queryCache: { enabled: true, maxSizeMB: 50 },
  monitoring: { enabled: true, autoOptimization: false },
  partitioning: { enabled: false }
}
```

**Production:**
```typescript
{
  connectionPool: { min: 10, max: 50 },
  queryCache: { enabled: true, maxSizeMB: 500 },
  monitoring: { enabled: true, autoOptimization: true },
  partitioning: { enabled: true, interval: 'monthly' }
}
```

## Event Listeners

The enhanced client supports event-driven monitoring:

### `on()`

Register event listeners for monitoring and debugging.

```typescript
client.on(event: ClientEvent, listener: EventListener): void
```

**Available Events:**
- `query.start`: Query execution started
- `query.complete`: Query execution completed
- `query.error`: Query execution failed
- `cache.hit`: Cache hit occurred
- `cache.miss`: Cache miss occurred
- `pool.acquire`: Connection acquired from pool
- `pool.release`: Connection released to pool
- `health.degraded`: System health degraded
- `optimization.complete`: Performance optimization completed

**Example:**
```typescript
client.on('query.start', (event) => {
  console.log(`Query started: ${event.sql}`)
})

client.on('cache.miss', (event) => {
  console.log(`Cache miss for key: ${event.cacheKey}`)
})

client.on('health.degraded', (event) => {
  console.warn(`Health degraded: ${event.component} - ${event.reason}`)
})
```

## Error Handling

### Custom Error Types

```typescript
class EnhancedClientError extends Error {
  constructor(message: string, code: string, details?: any) {
    super(message)
    this.name = 'EnhancedClientError'
    this.code = code
    this.details = details
  }
}

class CacheError extends EnhancedClientError {
  constructor(message: string, operation: string) {
    super(message, 'CACHE_ERROR', { operation })
  }
}

class PoolError extends EnhancedClientError {
  constructor(message: string, poolStats: PoolStats) {
    super(message, 'POOL_ERROR', { poolStats })
  }
}
```

### Error Recovery

```typescript
try {
  const result = await client.query(sql, params, options)
  return result
} catch (error) {
  if (error instanceof CacheError) {
    // Fallback to database without cache
    return await client.query(sql, params, { skipCache: true })
  } else if (error instanceof PoolError) {
    // Wait and retry with smaller pool
    await client.resizePool({ max: 10 })
    return await client.query(sql, params, options)
  }
  throw error
}
```

## Best Practices

### 1. Configuration Tuning

```typescript
// Start with conservative settings
const config = {
  connectionPool: {
    minConnections: 5,
    maxConnections: 20,
    idleTimeout: 30000
  },
  queryCache: {
    enabled: true,
    maxSizeMB: 100,
    defaultTTL: 300
  }
}

// Monitor and adjust based on metrics
setInterval(async () => {
  const metrics = await client.getPerformanceMetrics()
  if (metrics.connectionPool.waitingRequests > 5) {
    await client.resizePool({ max: 30 })
  }
}, 60000)
```

### 2. Cache Strategy

```typescript
// Use appropriate TTL based on data volatility
const cacheStrategies = {
  userEvents: { ttl: 300 },      // 5 minutes
  aggregations: { ttl: 900 },    // 15 minutes
  reports: { ttl: 3600 },        // 1 hour
  staticData: { ttl: 86400 }     // 24 hours
}
```

### 3. Health Monitoring

```typescript
// Regular health checks
setInterval(async () => {
  const health = await client.getHealthStatus()
  if (health.overall !== 'healthy') {
    await notifyOpsTeam(health)
  }
}, 30000) // Every 30 seconds
```