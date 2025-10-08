export { AuditDb, AuditDbWithConfig, EnhancedAuditDb } from './db/index.js'
export * from './db/schema.js'
export { MigrationUtils, runMigrationCommand } from './migration-utils.js'
//export * from './gdpr-integration.js'

// Performance optimization exports
export { DatabasePartitionManager, PartitionMaintenanceScheduler } from './db/partitioning.js'
export { DatabasePerformanceMonitor } from './db/performance-monitoring.js'
export { EnhancedConnectionPool, EnhancedDatabaseClient } from './db/connection-pool.js'
export { EnhancedAuditDatabaseClient, createEnhancedAuditClient } from './db/enhanced-client.js'

// Enhanced optimization components
export { EnhancedPartitionManager } from './db/enhanced-partition-manager.js'
export { EnhancedAuditDatabaseClient as OptimizedDatabaseClient, createEnhancedAuditDatabaseClient } from './db/enhanced-database-client.js'
export { CircuitBreaker, CircuitBreakerRegistry, DatabaseCircuitBreakers, createCircuitBreaker } from './db/circuit-breaker.js'
export { EnhancedErrorHandler, createErrorHandler, GlobalErrorHandler } from './db/error-handler.js'
export { ReadReplicaRouter, createReadReplicaRouter } from './db/read-replica-router.js'
export { IntelligentIndexManager, createIntelligentIndexManager } from './db/intelligent-index-manager.js'
export { PerformanceOptimizer, OptimizedPartitionMetadata, OptimizedBatchProcessor, createPerformanceOptimizer } from './db/performance-optimizer.js'

// Redis-based distributed caching exports
export { QueryCache } from './cache/query-cache.js'
export { RedisQueryCache } from './cache/redis-query-cache.js'
export { createQueryCache, DEFAULT_CACHE_CONFIGS } from './cache/cache-factory.js'
export { CachedQueryExecutor, QueryCacheUtils } from './cache/cached-query-executor.js'
export { OptimizedLRUCache, createOptimizedLRUCache } from './cache/optimized-lru-cache.js'

// Interface definitions
export type * from './db/interfaces.js'

// Performance optimization types
export type { PartitionConfig, PartitionInfo } from './db/partitioning.js'
export type { SlowQueryInfo, IndexUsageStats, TableStats } from './db/performance-monitoring.js'
export type { ConnectionPoolStats } from './db/connection-pool.js'
export type { PerformanceReport } from './db/enhanced-client.js'

// Enhanced component types
export type { CircuitBreakerMetrics, CircuitBreakerStatus } from './db/circuit-breaker.js'
export type { ErrorMetrics, ErrorHandlerConfig } from './db/error-handler.js'
export type { ReplicaConnection, ReadReplicaConfig, RoutingDecision } from './db/read-replica-router.js'
export type { IndexRecommendation, QueryPattern, IndexOptimizationConfig } from './db/intelligent-index-manager.js'
export type { PerformanceMetrics, OptimizationResult } from './db/performance-optimizer.js'

// Redis caching types
export type { RedisQueryCacheConfig } from './cache/redis-query-cache.js'
export type { IQueryCache, CacheEntry, QueryCacheStats } from './cache/cache-factory.js'
export type { QueryResult, CachedQueryOptions } from './cache/cached-query-executor.js'
export type { CacheNode, OptimizedLRUConfig, CacheMetrics } from './cache/optimized-lru-cache.js'
