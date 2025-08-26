export * from './db/index.js'
export * from './db/schema.js'
export * from './migration-utils.js'
export * from './gdpr-integration.js'

// Performance optimization exports
export { DatabasePartitionManager, PartitionMaintenanceScheduler } from './db/partitioning.js'
export { DatabasePerformanceMonitor } from './db/performance-monitoring.js'
export { EnhancedConnectionPool, EnhancedDatabaseClient } from './db/connection-pool.js'
export { EnhancedAuditDatabaseClient, createEnhancedAuditClient } from './db/enhanced-client.js'

// Redis-based distributed caching exports
export { QueryCache } from './cache/query-cache.js'
export { RedisQueryCache } from './cache/redis-query-cache.js'
export { createQueryCache, DEFAULT_CACHE_CONFIGS } from './cache/cache-factory.js'
export { CachedQueryExecutor, QueryCacheUtils } from './cache/cached-query-executor.js'

// Performance optimization types
export type { PartitionConfig, PartitionInfo } from './db/partitioning.js'
export type { SlowQueryInfo, IndexUsageStats, TableStats } from './db/performance-monitoring.js'
export type { ConnectionPoolStats } from './db/connection-pool.js'
export type { PerformanceReport } from './db/enhanced-client.js'

// Redis caching types
export type { RedisQueryCacheConfig } from './cache/redis-query-cache.js'
export type { IQueryCache, CacheEntry, QueryCacheStats } from './cache/cache-factory.js'
export type { QueryResult, CachedQueryOptions } from './cache/cached-query-executor.js'
