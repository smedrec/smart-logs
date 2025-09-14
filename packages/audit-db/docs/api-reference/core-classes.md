# Core Classes API Reference

This section documents the core database client classes in the `@repo/audit-db` package, including their methods, properties, and usage patterns.

## AuditDb Class

The basic database client for simple audit logging operations.

### Constructor

```typescript
constructor(connectionString?: string)
```

**Parameters:**
- `connectionString` (optional): PostgreSQL connection string. If not provided, uses `AUDIT_DB_URL` environment variable.

### Methods

#### `getDrizzleInstance()`

Returns the underlying Drizzle ORM instance for direct database operations.

```typescript
getDrizzleInstance(): NodePgDatabase<typeof schema>
```

**Returns:** Drizzle database instance

**Example:**
```typescript
const auditDb = new AuditDb()
const db = auditDb.getDrizzleInstance()

const events = await db.select().from(auditLog).limit(10)
```

#### `checkAuditDbConnection()`

Verifies the database connection health.

```typescript
async checkAuditDbConnection(): Promise<boolean>
```

**Returns:** `true` if connection is healthy, `false` otherwise

**Example:**
```typescript
const auditDb = new AuditDb()
const isHealthy = await auditDb.checkAuditDbConnection()
if (!isHealthy) {
  throw new Error('Database connection failed')
}
```

## AuditDbWithConfig Class

Enhanced database client with configuration support.

### Constructor

```typescript
constructor(config: AuditDbConfig)
```

**Parameters:**
- `config`: Configuration object with connection and pool settings

### Configuration Interface

```typescript
interface AuditDbConfig {
  connectionString: string
  pool?: {
    max?: number
    min?: number
    idleTimeoutMillis?: number
    acquireTimeoutMillis?: number
  }
  ssl?: boolean | object
}
```

### Methods

Inherits all methods from `AuditDb` plus:

#### `getConnectionConfig()`

Returns the current connection configuration.

```typescript
getConnectionConfig(): AuditDbConfig
```

**Example:**
```typescript
const auditDb = new AuditDbWithConfig({
  connectionString: process.env.AUDIT_DB_URL!,
  pool: { max: 10, min: 2 }
})

const config = auditDb.getConnectionConfig()
console.log('Pool max:', config.pool?.max)
```

## EnhancedAuditDb Class

Advanced database client with full performance optimization features.

### Constructor

```typescript
constructor(config: EnhancedAuditDbConfig)
```

### Enhanced Configuration Interface

```typescript
interface EnhancedAuditDbConfig {
  connection?: {
    connectionString: string
    ssl?: boolean | TLSOptions
  }
  connectionPool?: ConnectionPoolConfig
  queryCache?: QueryCacheConfig
  redis?: RedisConfig
  partitioning?: PartitioningConfig
  monitoring?: MonitoringConfig
  compliance?: ComplianceConfig
}

interface ConnectionPoolConfig {
  minConnections: number
  maxConnections: number
  idleTimeout: number
  acquireTimeout: number
  createTimeout?: number
  destroyTimeout?: number
}

interface QueryCacheConfig {
  enabled: boolean
  maxSizeMB: number
  defaultTTL: number
  maxQueries: number
  keyPrefix?: string
}

interface MonitoringConfig {
  enabled: boolean
  slowQueryThreshold: number
  autoOptimization: boolean
  collectMetrics?: boolean
  enableHealthChecks?: boolean
}
```

### Methods

Inherits all methods from `AuditDbWithConfig` plus:

#### `getHealthStatus()`

Returns comprehensive health status of the database and caching systems.

```typescript
async getHealthStatus(): Promise<HealthStatus>
```

**Returns:**
```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  database: {
    connected: boolean
    responseTime: number
  }
  cache: {
    enabled: boolean
    hitRate: number
    memoryUsage: number
  }
  connectionPool: {
    active: number
    idle: number
    waiting: number
  }
}
```

#### `getPerformanceReport()`

Generates a comprehensive performance analysis report.

```typescript
async getPerformanceReport(): Promise<PerformanceReport>
```

**Returns:**
```typescript
interface PerformanceReport {
  averageQueryTime: number
  slowQueriesCount: number
  cacheHitRate: number
  connectionPoolUtilization: number
  partitionEfficiency: number
  recommendations: string[]
  needsOptimization: boolean
}
```

#### `optimizePerformance()`

Executes automatic performance optimization procedures.

```typescript
async optimizePerformance(): Promise<OptimizationResult>
```

**Returns:**
```typescript
interface OptimizationResult {
  success: boolean
  actionsPerformed: string[]
  improvementEstimate: number
  nextOptimizationDate: Date
}
```

#### `enableMonitoring()`

Enables or configures performance monitoring.

```typescript
async enableMonitoring(config?: Partial<MonitoringConfig>): Promise<void>
```

#### `getQueryCache()`

Returns the query cache instance for manual cache operations.

```typescript
getQueryCache(): IQueryCache | null
```

### Example Usage

```typescript
const enhancedDb = new EnhancedAuditDb({
  connectionPool: {
    minConnections: 5,
    maxConnections: 20,
    idleTimeout: 30000,
    acquireTimeout: 10000
  },
  queryCache: {
    enabled: true,
    maxSizeMB: 100,
    defaultTTL: 300,
    maxQueries: 1000
  },
  monitoring: {
    enabled: true,
    slowQueryThreshold: 1000,
    autoOptimization: true
  },
  partitioning: {
    enabled: true,
    strategy: 'range',
    interval: 'monthly',
    retentionDays: 2555
  }
})

// Health check
const health = await enhancedDb.getHealthStatus()
console.log('System health:', health.status)

// Performance report
const report = await enhancedDb.getPerformanceReport()
if (report.needsOptimization) {
  await enhancedDb.optimizePerformance()
}
```

## Factory Functions

### `createEnhancedAuditClient()`

Factory function for creating optimized EnhancedAuditDb instances with sensible defaults.

```typescript
function createEnhancedAuditClient(
  environment: 'development' | 'staging' | 'production',
  overrides?: Partial<EnhancedAuditDbConfig>
): EnhancedAuditDb
```

**Parameters:**
- `environment`: Target environment with preset configurations
- `overrides`: Configuration overrides for customization

**Example:**
```typescript
// Production client with custom cache size
const auditDb = createEnhancedAuditClient('production', {
  queryCache: {
    maxSizeMB: 500
  }
})
```

## Error Handling

All client classes throw specific error types for different failure scenarios:

### Connection Errors

```typescript
class AuditDbConnectionError extends Error {
  constructor(message: string, cause?: Error) {
    super(message)
    this.name = 'AuditDbConnectionError'
    this.cause = cause
  }
}
```

### Configuration Errors

```typescript
class AuditDbConfigError extends Error {
  constructor(message: string, invalidFields?: string[]) {
    super(message)
    this.name = 'AuditDbConfigError'
    this.invalidFields = invalidFields
  }
}
```

### Query Errors

```typescript
class AuditDbQueryError extends Error {
  constructor(message: string, query?: string, params?: any[]) {
    super(message)
    this.name = 'AuditDbQueryError'
    this.query = query
    this.params = params
  }
}
```

## Best Practices

### 1. Client Selection

```typescript
// Development: Use basic client
const devClient = new AuditDb()

// Production with custom config: Use configured client
const prodClient = new AuditDbWithConfig({
  connectionString: process.env.AUDIT_DB_URL!,
  pool: { max: 10, min: 2 }
})

// High-performance production: Use enhanced client
const enhancedClient = createEnhancedAuditClient('production')
```

### 2. Connection Management

```typescript
// Always check connection health
const auditDb = new EnhancedAuditDb(config)
const isHealthy = await auditDb.checkAuditDbConnection()

if (!isHealthy) {
  // Implement retry logic or failover
  throw new Error('Database unavailable')
}
```

### 3. Error Handling

```typescript
try {
  const result = await auditDb.someOperation()
  return result
} catch (error) {
  if (error instanceof AuditDbConnectionError) {
    // Handle connection issues
    await handleConnectionError(error)
  } else if (error instanceof AuditDbQueryError) {
    // Handle query issues
    await handleQueryError(error)
  } else {
    // Handle other errors
    throw error
  }
}
```

### 4. Performance Monitoring

```typescript
// Regular health checks
setInterval(async () => {
  const health = await enhancedDb.getHealthStatus()
  if (health.status !== 'healthy') {
    console.warn('Database health degraded:', health)
  }
}, 60000) // Every minute

// Periodic optimization
setInterval(async () => {
  const report = await enhancedDb.getPerformanceReport()
  if (report.needsOptimization) {
    await enhancedDb.optimizePerformance()
  }
}, 24 * 60 * 60 * 1000) // Daily
```

## Migration Between Client Types

### From AuditDb to AuditDbWithConfig

```typescript
// Before
const oldClient = new AuditDb()

// After
const newClient = new AuditDbWithConfig({
  connectionString: process.env.AUDIT_DB_URL!,
  pool: { max: 10, min: 2 }
})
```

### From AuditDbWithConfig to EnhancedAuditDb

```typescript
// Before
const oldClient = new AuditDbWithConfig({
  connectionString: process.env.AUDIT_DB_URL!,
  pool: { max: 10, min: 2 }
})

// After
const newClient = new EnhancedAuditDb({
  connectionPool: {
    maxConnections: 10,
    minConnections: 2,
    idleTimeout: 30000,
    acquireTimeout: 10000
  },
  queryCache: { enabled: true },
  monitoring: { enabled: true }
})
```

## TypeScript Integration

All client classes are fully typed with TypeScript:

```typescript
import type { 
  AuditDbConfig, 
  EnhancedAuditDbConfig, 
  HealthStatus, 
  PerformanceReport 
} from '@repo/audit-db'

// Type-safe configuration
const config: EnhancedAuditDbConfig = {
  connectionPool: {
    minConnections: 5,
    maxConnections: 20,
    idleTimeout: 30000,
    acquireTimeout: 10000
  }
  // TypeScript will enforce correct types
}

// Type-safe usage
const auditDb = new EnhancedAuditDb(config)
const health: HealthStatus = await auditDb.getHealthStatus()
```