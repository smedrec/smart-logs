/**
 * GraphQL schema extensions for performance optimization
 * Requirements 8.1, 8.2, 8.3, 8.4, 8.5: GraphQL performance optimization implementation
 */

export const performanceTypeDefs = `
  # Performance metrics and monitoring types
  type PerformanceMetrics {
    timestamp: DateTime!
    requestsPerSecond: Float!
    averageResponseTime: Float!
    memoryUsage: MemoryUsage!
    cacheStats: CacheStats!
    concurrency: ConcurrencyStats!
    slowRequests: SlowRequestStats!
  }

  type MemoryUsage {
    used: Float!
    total: Float!
    percentage: Float!
  }

  type CacheStats {
    hitRatio: Float!
    totalRequests: Int!
    totalHits: Int!
    totalMisses: Int!
  }

  type ConcurrencyStats {
    activeRequests: Int!
    queuedRequests: Int!
    maxConcurrentRequests: Int!
  }

  type SlowRequestStats {
    count: Int!
    averageTime: Float!
    slowestEndpoints: [SlowEndpoint!]!
  }

  type SlowEndpoint {
    endpoint: String!
    averageTime: Float!
    count: Int!
  }

  type PerformanceHealth {
    status: HealthStatus!
    details: PerformanceHealthDetails!
  }

  type PerformanceHealthDetails {
    cache: ComponentHealth!
    concurrency: ComponentHealth!
    memory: ComponentHealth!
  }

  type ComponentHealth {
    status: String!
    hitRatio: Float
    utilization: Float
    usage: Float
  }

  # Pagination types
  input PaginationInput {
    limit: Int = 50
    offset: Int = 0
    cursor: String
    sort: SortInput
  }

  input SortInput {
    field: String!
    direction: SortDirection = DESC
  }

  enum SortDirection {
    ASC
    DESC
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
    total: Int
  }

  # Optimized audit event connection
  type OptimizedAuditEventConnection {
    edges: [AuditEventEdge!]!
    pageInfo: PageInfo!
    totalCount: Int
    cacheInfo: CacheInfo
  }

  type AuditEventEdge {
    node: AuditEvent!
    cursor: String!
  }

  type CacheInfo {
    cached: Boolean!
    cacheKey: String
    ttl: Int
    hitRatio: Float
  }

  # Bulk operation results
  type BulkCreateResult {
    created: Int!
    batches: Int!
    results: [AuditEvent!]!
    performance: BulkPerformanceStats!
  }

  type BulkPerformanceStats {
    totalTime: Float!
    averageTimePerEvent: Float!
    concurrencyUtilization: Float!
  }

  # Cache management types
  type CacheInvalidationResult {
    pattern: String!
    invalidated: Int!
    timestamp: DateTime!
  }

  type CacheWarmupResult {
    warmedUp: Int!
    failed: Int!
    total: Int!
    timestamp: DateTime!
  }

  # Database optimization types
  type DatabasePerformanceReport {
    timestamp: DateTime!
    connectionPool: ConnectionPoolStats!
    queryCache: QueryCacheStats!
    partitions: PartitionStats!
    performance: DatabasePerformanceStats!
  }

  type ConnectionPoolStats {
    totalConnections: Int!
    activeConnections: Int!
    averageAcquisitionTime: Float!
    successRate: Float!
  }

  type QueryCacheStats {
    hitRatio: Float!
    totalSizeMB: Float!
    evictions: Int!
  }

  type PartitionStats {
    totalPartitions: Int!
    totalSizeGB: Float!
    recommendations: [String!]!
  }

  type DatabasePerformanceStats {
    slowQueries: Int!
    unusedIndexes: Int!
    cacheHitRatio: Float!
    suggestions: [String!]!
  }

  type DatabaseOptimizationResult {
    partitionOptimization: [String!]!
    indexOptimization: [String!]!
    maintenanceResults: MaintenanceResults!
    configOptimization: [ConfigRecommendation!]!
    timestamp: DateTime!
  }

  type MaintenanceResults {
    vacuumResults: [String!]!
    analyzeResults: [String!]!
    reindexResults: [String!]!
  }

  type ConfigRecommendation {
    setting: String!
    currentValue: String!
    recommendedValue: String!
    reason: String!
  }

  type DatabaseHealthStatus {
    overall: HealthStatus!
    components: DatabaseHealthComponents!
    recommendations: [String!]!
  }

  type DatabaseHealthComponents {
    connectionPool: ComponentHealthDetail!
    queryCache: ComponentHealthDetail!
    partitions: ComponentHealthDetail!
    performance: ComponentHealthDetail!
  }

  type ComponentHealthDetail {
    status: String!
    details: JSON
  }

  # Extended Query type
  extend type Query {
    # Performance monitoring
    performanceMetrics: PerformanceMetrics!
    performanceHealth: PerformanceHealth!

    # Optimized audit events with caching and pagination
    optimizedAuditEvents(
      filter: AuditEventFilter
      pagination: PaginationInput
      useCache: Boolean = true
      cacheTTL: Int = 300
    ): OptimizedAuditEventConnection!

    # Cache management
    cacheStats: CacheStats!

    # Database optimization
    databasePerformanceReport: DatabasePerformanceReport!
    databaseHealthStatus: DatabaseHealthStatus!
  }

  # Extended Mutation type
  extend type Mutation {
    # Bulk operations
    bulkCreateAuditEvents(
      events: [CreateAuditEventInput!]!
      batchSize: Int = 10
    ): BulkCreateResult!

    # Cache management
    invalidateCache(pattern: String!): CacheInvalidationResult!
    warmupCache(
      organizationIds: [String!]
      preloadDays: Int = 7
    ): CacheWarmupResult!

    # Database optimization
    optimizeDatabase: DatabaseOptimizationResult!
  }

  # Extended Subscription type
  extend type Subscription {
    # Real-time performance metrics
    performanceMetricsUpdated: PerformanceMetrics!

    # Cache events
    cacheInvalidated(pattern: String): CacheInvalidationResult!

    # Performance alerts
    performanceAlert(severity: AlertSeverity): PerformanceAlert!
  }

  type PerformanceAlert {
    id: ID!
    severity: AlertSeverity!
    type: String!
    title: String!
    description: String!
    timestamp: DateTime!
    source: String!
    metadata: JSON
  }

  # Input types for bulk operations
  input CreateAuditEventInput {
    action: String!
    targetResourceType: String!
    targetResourceId: String
    principalId: String!
    organizationId: String!
    status: AuditEventStatus!
    outcomeDescription: String
    dataClassification: DataClassification!
    metadata: JSON
  }

  # Filter input for optimized queries
  input AuditEventFilter {
    dateRange: DateRangeInput
    principalIds: [String!]
    organizationIds: [String!]
    actions: [String!]
    statuses: [AuditEventStatus!]
    dataClassifications: [DataClassification!]
    resourceTypes: [String!]
    verifiedOnly: Boolean
  }

  input DateRangeInput {
    startDate: DateTime!
    endDate: DateTime!
  }

  enum AuditEventStatus {
    ATTEMPT
    SUCCESS
    FAILURE
  }

  enum DataClassification {
    PUBLIC
    INTERNAL
    CONFIDENTIAL
    PHI
  }

  enum HealthStatus {
    HEALTHY
    WARNING
    CRITICAL
  }

  enum AlertSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  # Scalar types
  scalar DateTime
  scalar JSON
`
