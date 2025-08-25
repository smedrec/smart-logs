export * from './db/index.js'
export * from './db/schema.js'
export * from './migration-utils.js'
export * from './gdpr-integration.js'

// Performance optimization exports
export { DatabasePartitionManager, PartitionMaintenanceScheduler } from './db/partitioning.js'
export { DatabasePerformanceMonitor } from './db/performance-monitoring.js'
export { EnhancedConnectionPool, QueryCache, EnhancedDatabaseClient } from './db/connection-pool.js'
export { EnhancedAuditDatabaseClient, createEnhancedAuditClient } from './db/enhanced-client.js'

// Performance optimization types
export type { PartitionConfig, PartitionInfo } from './db/partitioning.js'
export type { SlowQueryInfo, IndexUsageStats, TableStats } from './db/performance-monitoring.js'
export type { CacheEntry, ConnectionPoolStats, QueryCacheStats } from './db/connection-pool.js'
export type { PerformanceReport } from './db/enhanced-client.js'
