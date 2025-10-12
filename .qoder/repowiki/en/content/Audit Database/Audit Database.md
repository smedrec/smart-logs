# Audit Database

<cite>
**Referenced Files in This Document**   
- [schema.ts](file://packages\audit-db\src\db\schema.ts) - *Updated in recent commit*
- [pseudonym_mapping](file://packages\audit-db\drizzle\migrations\0006_silly_tyger_tiger.sql) - *Added in recent commit*
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts) - *Updated in recent commit*
- [README.md](file://packages\audit-db\README.md) - *Updated in recent commit*
- [future-enhancements.md](file://packages\audit-db\docs\future-enhancements.md) - *Updated in recent commit*
- [organization_role](file://packages\auth\drizzle\0005_fluffy_donald_blake.sql) - *Added in recent commit*
- [authz.ts](file://packages\auth\src\permissions.ts) - *Added in recent commit*
- [redis-query-cache.ts](file://packages\audit-db\src\cache\redis-query-cache.ts) - *Updated in recent commit*
- [cache-factory.ts](file://packages\audit-db\src\cache\cache-factory.ts) - *Updated in recent commit*
- [enhanced-client.ts](file://packages\audit-db\src\db\enhanced-client.ts) - *Updated in recent commit*
- [docker-compose.yml](file://docker\pgvector\docker-compose.yml) - *Updated in recent commit*
- [init-primary.sql](file://docker\pgvector\init-primary.sql) - *Added in recent commit*
- [0007_keen_ego.sql](file://packages\audit-db\drizzle\migrations\0007_keen_ego.sql) - *Updated in recent commit*
- [0008_swift_black_panther.sql](file://packages\audit-db\drizzle\migrations\0008_swift_black_panther.sql) - *Updated in recent commit*
- [0017_past_bishop.sql](file://packages\audit-db\drizzle\migrations\0017_past_bishop.sql) - *Added in recent commit*
- [circuit-breaker.ts](file://packages\audit-db\src\db\circuit-breaker.ts) - *Updated in recent commit*
- [optimized-lru-cache.ts](file://packages\audit-db\src\cache\optimized-lru-cache.ts) - *Updated in recent commit*
</cite>

## Update Summary
- Added new section on delivery system database schema including deliveryDestinations, deliveryLogs, deliveryQueue, and destinationHealth tables
- Added new section on enhanced resilience patterns with circuit breaker and optimized LRU cache implementations
- Updated GDPR Pseudonymization and Compliance section to include new strategy field and unique index for original ID in pseudonym_mapping table
- Enhanced pseudonym_mapping data model with strategy field and unique constraint on originalId
- Updated section sources to reflect new and modified migration files related to pseudonymization
- Added details about index creation and constraint changes in migration files

## Table of Contents
1. [Introduction](#introduction)
2. [Data Model](#data-model)
3. [Partitioning Strategy](#partitioning-strategy)
4. [Data Lifecycle and Retention](#data-lifecycle-and-retention)
5. [Query Caching Strategy](#query-caching-strategy)
6. [Performance Monitoring Tools](#performance-monitoring-tools)
7. [Access Control and Security](#access-control-and-security)
8. [Migration and Version Management](#migration-and-version-management)
9. [Architecture Overview](#architecture-overview)
10. [Alert Persistence with Database Integration](#alert-persistence-with-database-integration)
11. [GDPR Pseudonymization and Compliance](#gdpr-pseudonymization-and-compliance)
12. [Organization Role Management](#organization-role-management)
13. [Delivery System Database Schema](#delivery-system-database-schema)
14. [Enhanced Resilience Patterns](#enhanced-resilience-patterns)
15. [Conclusion](#conclusion)

## Introduction

The Audit Database is a comprehensive system designed to store, manage, and analyze audit events across multiple organizations. It provides robust capabilities for compliance, security monitoring, and operational visibility. Built with PostgreSQL and optimized through Drizzle ORM, the system implements advanced database techniques including time-based partitioning, Redis caching, and comprehensive performance monitoring.

This documentation provides a detailed overview of the Audit Database's data model, architecture, and operational characteristics. The system is designed to handle high-volume audit data while maintaining performance, security, and compliance with regulatory requirements such as HIPAA and GDPR.

The database schema supports a wide range of audit-related entities including audit events, alerts, compliance records, and metadata tables. It implements a multi-tenant architecture with organizational isolation, ensuring data privacy and security across different tenants.

**Section sources**
- [schema.ts](file://packages\audit-db\src\db\schema.ts)

## Data Model

### Entity Relationship Diagram

```mermaid
erDiagram
audit_log {
integer id PK
timestamp timestamp
varchar ttl
varchar principal_id
varchar organization_id
varchar action
varchar target_resource_type
varchar target_resource_id
varchar status
text outcome_description
varchar hash
varchar hash_algorithm
varchar event_version
varchar correlation_id
varchar data_classification
varchar retention_policy
integer processing_latency
timestamp archived_at
jsonb details
}
audit_preset {
integer id PK
varchar name
text description
varchar organization_id
varchar action
varchar data_classification
jsonb required_fields
jsonb default_values
jsonb validation
timestamp created_at
varchar created_by
timestamp updated_at
varchar updated_by
}
audit_integrity_log {
integer id PK
integer audit_log_id FK
timestamp verification_timestamp
varchar verification_status
jsonb verification_details
varchar verified_by
varchar hash_verified
varchar expected_hash
}
audit_retention_policy {
integer id PK
varchar policy_name
varchar organization_id
integer retention_days
integer archive_after_days
integer delete_after_days
varchar data_classification
text description
varchar is_active
timestamp created_at
timestamp updated_at
varchar created_by
}
error_log {
varchar id PK
varchar category
varchar severity
varchar code
text message
varchar component
varchar operation
varchar correlation_id
varchar user_id
varchar session_id
varchar request_id
varchar retryable
varchar aggregation_key
jsonb context
jsonb troubleshooting
timestamp timestamp
timestamp created_at
}
error_aggregation {
varchar aggregation_key PK
varchar category
varchar severity
integer count
varchar error_rate
varchar trend
timestamp first_occurrence
timestamp last_occurrence
jsonb affected_components
jsonb affected_users
jsonb samples
timestamp updated_at
}
archive_storage {
varchar id PK
jsonb metadata
text data
timestamp created_at
integer retrieved_count
timestamp last_retrieved_at
}
alerts {
varchar id PK
varchar organization_id
varchar severity
varchar type
varchar title
text description
varchar source
varchar correlation_id
jsonb metadata
varchar acknowledged
timestamp acknowledged_at
varchar acknowledged_by
varchar resolved
timestamp resolved_at
varchar resolved_by
text resolution_notes
timestamp created_at
timestamp updated_at
}
scheduled_reports {
varchar id PK
varchar name
text description
varchar organization_id
varchar template_id
varchar report_type
jsonb criteria
varchar format
jsonb schedule
jsonb delivery
jsonb export
varchar enabled
timestamp last_run
timestamp next_run
timestamp created_at
varchar created_by
timestamp updated_at
varchar updated_by
}
report_templates {
varchar id PK
varchar name
text description
varchar organization_id
varchar report_type
jsonb default_criteria
varchar default_format
jsonb default_export_config
jsonb tags
varchar is_active
timestamp created_at
varchar created_by
timestamp updated_at
varchar updated_by
}
report_executions {
varchar id PK
varchar report_config_id FK
varchar organization_id
timestamp scheduled_time
timestamp execution_time
varchar status
integer duration
integer records_processed
jsonb export_result
jsonb integrity_report
jsonb delivery_attempts
text error
timestamp created_at
}
archive_dlq_event {
integer id PK
timestamp timestamp
varchar action
varchar failure_reason
integer failure_count
timestamp first_failure_time
timestamp last_failure_time
varchar original_job_id
varchar original_queue_name
jsonb original_event
jsonb metadata
}
config_change_event {
integer id PK
timestamp timestamp
varchar field
jsonb previous_value
jsonb new_value
varchar changed_by
varchar reason
varchar environment
varchar previous_version
varchar new_version
}
pseudonym_mapping {
integer id PK
timestamp timestamp
text pseudonym_id
text original_id
varchar strategy
}
organization_role {
varchar organization_id PK
varchar name PK
text description
jsonb permissions
jsonb inherits
}
delivery_destinations {
integer id PK
varchar organization_id
varchar type
varchar label
text description
varchar icon
text instructions
varchar disabled
timestamp disabled_at
varchar disabled_by
integer count_usage
timestamp last_used_at
jsonb config
timestamp created_at
timestamp updated_at
}
delivery_logs {
integer id PK
varchar delivery_id
integer destination_id
varchar organization_id
jsonb object_details
varchar status
jsonb attempts
timestamp last_attempt_at
timestamp delivered_at
text failure_reason
varchar cross_system_reference
varchar correlation_id
varchar idempotency_key
jsonb details
timestamp created_at
timestamp updated_at
}
delivery_queue {
varchar id PK
varchar organization_id
integer destination_id
jsonb payload
integer priority
timestamp scheduled_at
timestamp processed_at
varchar status
varchar correlation_id
varchar idempotency_key
integer retry_count
integer max_retries
timestamp next_retry_at
jsonb metadata
timestamp created_at
timestamp updated_at
}
destination_health {
integer destination_id PK
varchar status
timestamp last_check_at
integer consecutive_failures
integer total_failures
integer total_deliveries
varchar success_rate
integer average_response_time
timestamp last_failure_at
timestamp last_success_at
timestamp disabled_at
text disabled_reason
varchar circuit_breaker_state
timestamp circuit_breaker_opened_at
jsonb metadata
timestamp updated_at
}
audit_log ||--o{ audit_integrity_log : "1:N"
scheduled_reports ||--o{ report_executions : "1:N"
report_templates ||--o{ scheduled_reports : "1:N"
delivery_destinations ||--o{ delivery_logs : "1:N"
delivery_destinations ||--o{ delivery_queue : "1:N"
delivery_destinations ||--o{ destination_health : "1:1"
```

**Diagram sources**
- [schema.ts](file://packages\audit-db\src\db\schema.ts)
- [authz.ts](file://packages\auth\src\permissions.ts)

**Section sources**
- [schema.ts](file://packages\audit-db\src\db\schema.ts)
- [authz.ts](file://packages\auth\src\permissions.ts)

### Core Entities

#### audit_log
The primary table storing audit events with comprehensive metadata.

**Fields:**
- **id**: serial - Primary key
- **timestamp**: timestamp with time zone - Event timestamp (ISO string format)
- **ttl**: varchar(255) - Time-to-live specification
- **principalId**: varchar(255) - Identifier of the entity performing the action
- **organizationId**: varchar(255) - Tenant identifier for multi-organizational support
- **action**: varchar(255) - Type of action performed (e.g., 'user.login', 'document.update')
- **targetResourceType**: varchar(255) - Type of resource affected (e.g., 'Patient', 'Order')
- **targetResourceId**: varchar(255) - Identifier of the specific resource
- **status**: varchar(50) - Event status ('attempt', 'success', 'failure')
- **outcomeDescription**: text - Detailed description of the outcome
- **hash**: varchar(64) - Cryptographic hash (SHA-256) for immutability
- **hashAlgorithm**: varchar(50) - Hash algorithm used (default: 'SHA-256')
- **eventVersion**: varchar(20) - Schema version (default: '1.0')
- **correlationId**: varchar(255) - Identifier for tracing related events
- **dataClassification**: varchar(20) - Data sensitivity level ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI')
- **retentionPolicy**: varchar(50) - Retention policy name (default: 'standard')
- **processingLatency**: integer - Processing time in milliseconds
- **archivedAt**: timestamp with time zone - Timestamp when archived
- **details**: jsonb - Additional structured or unstructured data

#### audit_preset
Stores predefined audit configurations for consistent event creation.

**Fields:**
- **id**: serial - Primary key
- **name**: varchar(255) - Preset name
- **description**: text - Description of the preset
- **organizationId**: varchar(255) - Owner organization
- **action**: varchar(255) - Action type this preset applies to
- **dataClassification**: varchar(20) - Required data classification
- **requiredFields**: jsonb - List of required fields for this preset
- **defaultValues**: jsonb - Default values for event fields
- **validation**: jsonb - Validation rules and configuration
- **createdAt**: timestamp - Creation timestamp
- **createdBy**: varchar(255) - User who created the preset
- **updatedAt**: timestamp - Last update timestamp
- **updatedBy**: varchar(255) - User who last updated the preset

#### alerts
Stores persistent alert records with multi-organizational support.

**Fields:**
- **id**: varchar(255) - Alert identifier (UUID)
- **organizationId**: varchar(255) - Tenant identifier
- **severity**: varchar(20) - Alert severity ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
- **type**: varchar(20) - Alert type ('SECURITY', 'COMPLIANCE', 'PERFORMANCE', 'SYSTEM')
- **title**: varchar(500) - Alert title
- **description**: text - Detailed alert description
- **source**: varchar(100) - Component that generated the alert
- **correlationId**: varchar(255) - Link to related events
- **metadata**: jsonb - Additional alert context
- **acknowledged**: varchar(10) - Acknowledgment status ('true'/'false')
- **acknowledgedAt**: timestamp - Timestamp when acknowledged
- **acknowledgedBy**: varchar(255) - User who acknowledged
- **resolved**: varchar(10) - Resolution status ('true'/'false')
- **resolvedAt**: timestamp - Timestamp when resolved
- **resolvedBy**: varchar(255) - User who resolved
- **resolutionNotes**: text - Notes about resolution
- **createdAt**: timestamp - Creation timestamp
- **updatedAt**: timestamp - Last update timestamp

#### pseudonym_mapping
Stores encrypted pseudonym-to-original ID mappings for GDPR compliance with pseudonymization strategy tracking.

**Fields:**
- **id**: serial - Primary key
- **timestamp**: timestamp with time zone - Creation timestamp
- **pseudonymId**: text - Pseudonymized identifier
- **originalId**: text - Encrypted original identifier (unique constraint)
- **strategy**: varchar(20) - Pseudonymization strategy used ('hash', 'token', 'encryption')

#### organization_role
Stores role definitions and permissions for organizational access control.

**Fields:**
- **organizationId**: varchar(50) - Organization identifier (composite primary key)
- **name**: varchar(50) - Role name (composite primary key)
- **description**: text - Role description
- **permissions**: jsonb - Array of permission objects with resource and action
- **inherits**: jsonb - Array of role names that this role inherits from

## Partitioning Strategy

The Audit Database implements a sophisticated partitioning strategy to optimize performance and manageability of large audit datasets. The system uses range partitioning based on the timestamp column, creating monthly partitions for the audit_log table.

### Partitioning Implementation

```mermaid
flowchart TD
Start([Initialize Partitioning]) --> CreateParent["Create audit_log parent table<br/>PARTITION BY RANGE (timestamp)"]
CreateParent --> CreateFunction["Create partition management functions"]
CreateFunction --> Schedule["Start maintenance scheduler"]
Schedule --> CreateMonthly["Create monthly partitions<br/>(current + next 6 months)"]
CreateMonthly --> Monitor["Monitor partition usage"]
Monitor --> DropExpired["Drop expired partitions<br/>(older than retention period)"]
DropExpired --> Analyze["Analyze partition performance"]
Analyze --> Optimize["Generate optimization recommendations"]
Optimize --> End([Partitioning Complete])
```

**Diagram sources**
- [partitioning.ts](file://packages\audit-db\src\db\partitioning.ts)

**Section sources**
- [partitioning.ts](file://packages\audit-db\src\db\partitioning.ts)

### Key Features

- **Time-based partitioning**: The audit_log table is partitioned by timestamp using range partitioning with monthly intervals.
- **Automatic partition creation**: The system automatically creates partitions for the current month and the next six months.
- **Retention-based cleanup**: Expired partitions are automatically dropped based on the configured retention policy.
- **Optimized indexing**: Each partition has a comprehensive set of indexes tailored for common query patterns.

### Configuration

The partitioning strategy is configured through the `PartitionConfig` interface:

```typescript
interface PartitionConfig {
  strategy: 'range' | 'hash' | 'list'
  partitionColumn: string
  interval?: 'monthly' | 'quarterly' | 'yearly'
  partitionCount?: number
  retentionDays: number
}
```

For the audit_log table, the configuration uses:
- **strategy**: 'range' (only supported strategy for audit_log)
- **partitionColumn**: 'timestamp'
- **interval**: 'monthly' (default)
- **retentionDays**: 2555 (7 years)

### Performance Benefits

1. **Query performance**: Queries that include timestamp filters can leverage partition pruning, significantly reducing the amount of data scanned.
2. **Maintenance efficiency**: Operations like VACUUM and ANALYZE can be performed on individual partitions rather than the entire table.
3. **Storage optimization**: Older partitions can be moved to slower, cheaper storage while keeping recent data on faster storage.
4. **Backup and recovery**: Individual partitions can be backed up and restored independently.

The `DatabasePartitionManager` class handles all partitioning operations, including creating partitions, managing indexes, and cleaning up expired partitions. The `PartitionMaintenanceScheduler` runs periodic maintenance tasks to ensure the partitioning system remains optimized.

## Data Lifecycle and Retention

The Audit Database implements a comprehensive data lifecycle management system that ensures compliance with regulatory requirements while optimizing storage and performance.

### Retention Policies

The system enforces a 7-year retention policy for audit data, implemented through the `audit_retention_policy` table:

```typescript
interface AuditRetentionPolicy {
  policyName: string
  retentionDays: number // 2555 days = 7 years
  archiveAfterDays?: number
  deleteAfterDays?: number
  dataClassification: DataClassification
  description: string
  isActive: string
  createdAt: Date
  updatedAt: Date
  createdBy: string
}
```

### Archival Rules

Data is archived according to the following rules:
1. **Active retention**: Data remains in the primary audit_log table for the full retention period (7 years).
2. **Partition management**: Monthly partitions are automatically created and expired partitions are dropped when they exceed the retention period.
3. **Compression**: Archived data is compressed and stored in the archive_storage table using base64 encoding.
4. **Integrity verification**: Cryptographic hashes are stored to ensure data integrity during archival.

### Data Lifecycle Process

```mermaid
stateDiagram-v2
[*] --> Active
Active --> Archived : "After retention period"
Archived --> Deleted : "After extended retention"
Active --> Purged : "On explicit deletion request"
Archived --> Purged : "On explicit deletion request"
note right of Active
Data in active partitions
Optimized for queries
Full indexing
end note
note right of Archived
Compressed in archive_storage
Limited retrieval
Lower storage cost
end note
note right of Deleted
Data permanently removed
Meets regulatory requirements
end note
note right of Purged
Immediate deletion
Requires authorization
Audit trail maintained
end note
```

**Diagram sources**
- [schema.ts](file://packages\audit-db\src\db\schema.ts)
- [partitioning.ts](file://packages\audit-db\src\db\partitioning.ts)

**Section sources**
- [schema.ts](file://packages\audit-db\src\db\schema.ts)
- [partitioning.ts](file://packages\audit-db\src\db\partitioning.ts)

The `dropExpiredPartitions` method in the `DatabasePartitionManager` class automatically removes partitions that are older than the retention period. This process runs on a scheduled basis through the `PartitionMaintenanceScheduler`.

## Query Caching Strategy

The Audit Database implements a sophisticated caching strategy using Redis to optimize query performance and reduce database load.

### Caching Architecture

```mermaid
graph TB
Client[Application Client] --> EC[EnhancedClient]
EC --> QC[QueryCache]
QC --> LC[Local Cache L1]
QC --> RC[Redis Cache L2]
RC --> Redis[(Redis Server)]
EC --> DB[(PostgreSQL Database)]
subgraph "Caching Layers"
LC
RC
end
subgraph "Data Storage"
DB
Redis
end
style LC fill:#f9f,stroke:#333
style RC fill:#f9f,stroke:#333
style Redis fill:#bbf,stroke:#333
style DB fill:#bbf,stroke:#333
```

**Diagram sources**
- [redis-query-cache.ts](file://packages\audit-db\src\cache\redis-query-cache.ts)
- [query-cache.ts](file://packages\audit-db\src\cache\query-cache.ts)

**Section sources**
- [redis-query-cache.ts](file://packages\audit-db\src\cache\redis-query-cache.ts)
- [query-cache.ts](file://packages\audit-db\src\cache\query-cache.ts)

### Implementation Details

The caching system is implemented through several key components:

#### QueryCache Class
The base in-memory cache implementation with LRU eviction and TTL support:

```typescript
class QueryCache {
  private cache = new Map<string, CacheEntry>()
  private accessOrder: string[] = []
  
  get<T>(key: string): T | null
  set<T>(key: string, data: T, ttl?: number): void
  delete(key: string): boolean
  clear(): void
}
```

#### RedisQueryCache Class
The distributed cache implementation that uses Redis as the primary store with optional local L1 cache:

```typescript
class RedisQueryCache {
  private redis: Redis
  private localCache?: QueryCache
  
  async get<T>(key: string): Promise<T | null>
  async set<T>(key: string, data: T, ttl?: number): Promise<void>
  async delete(key: string): Promise<boolean>
  async clear(): Promise<void>
}
```

### Cache Configuration

The caching strategy is configured through the `RedisQueryCacheConfig` interface:

```typescript
interface RedisQueryCacheConfig extends QueryCacheConfig {
  redisKeyPrefix: string
  enableLocalCache: boolean
  localCacheSizeMB: number
  enableCompression: boolean
  serializationFormat: 'json' | 'msgpack'
}
```

Default configuration:
- **enabled**: true
- **maxSizeMB**: 100
- **defaultTTL**: 300 seconds (5 minutes)
- **maxQueries**: 1000
- **keyPrefix**: 'audit_cache'
- **redisKeyPrefix**: 'audit_redis_cache'
- **enableLocalCache**: true
- **localCacheSizeMB**: 20
- **enableCompression**: true (for values > 1KB)

### Cache Access Pattern

The system uses a multi-layer cache access pattern:

1. **L1 Cache Check**: First check the local in-memory cache
2. **L2 Cache Check**: If not found, check Redis
3. **Database Query**: If not found in cache, query the database
4. **Cache Population**: Store results in both L1 and L2 caches

This approach minimizes latency for frequently accessed data while maintaining consistency across distributed application instances.

### Authorization Layer Caching

The authorization system implements Redis caching for role-based access control with the following configuration:

```typescript
interface AuthorizationCacheConfig {
  roleCachePrefix: string
  permissionCachePrefix: string
  retentionPeriod: number
  enableCompression: boolean
}
```

Key features:
- **Role caching**: Stores role definitions in Redis with `authz:roles:` prefix
- **Permission caching**: Caches permission checks for 5 minutes with `authz:permissions:` prefix
- **Cache invalidation**: Provides methods to clear user-specific or global permission caches
- **Cache warming**: Pre-loads default roles during service initialization

The `AuthorizationService` class implements the following cache methods:

```typescript
class AuthorizationService {
  async hasPermission(session: Session, resource: string, action: string): Promise<boolean>
  async clearUserCache(userId: string): Promise<void>
  async clearCache(): Promise<void>
  async getRole(roleName: string): Promise<Role | undefined>
  async getAllRoles(): Promise<Role[]>
}
```

**Section sources**
- [authz.ts](file://packages\auth\src\permissions.ts)
- [redis-query-cache.ts](file://packages\audit-db\src\cache\redis-query-cache.ts)

## Performance Monitoring Tools

The Audit Database includes comprehensive performance monitoring capabilities to ensure optimal operation and identify potential issues.

### Monitoring Architecture

```mermaid
graph TD
DB[(PostgreSQL)] --> PM[PerformanceMonitor]
PM --> S1[Slow Query Detection]
PM --> S2[Index Usage Analysis]
PM --> S3[Table Statistics]
PM --> S4[Query Plan Analysis]
PM --> S5[Configuration Optimization]
EC[EnhancedClient] --> PM
EC --> PR[PerformanceReporter]
PR --> Alert[Alert System]
PR --> Log[Log System]
S1 --> Rec[Optimization Recommendations]
S2 --> Rec
S3 --> Rec
S4 --> Rec
S5 --> Rec
Rec --> Auto[Auto-Optimization]
Auto --> DB
```

**Diagram sources**
- [performance-monitoring.ts](file://packages\audit-db\src\db\performance-monitoring.ts)
- [enhanced-client.ts](file://packages\audit-db\src\db\enhanced-client.ts)

**Section sources**
- [performance-monitoring.ts](file://packages\audit-db\src\db\performance-monitoring.ts)
- [enhanced-client.ts](file://packages\audit-db\src\db\enhanced-client.ts)

### Key Monitoring Components

#### DatabasePerformanceMonitor Class
The core performance monitoring class that provides various diagnostic capabilities:

```typescript
class DatabasePerformanceMonitor {
  async getSlowQueries(limit = 20, minExecutionTime = 1000): Promise<SlowQueryInfo[]>
  async getIndexUsageStats(): Promise<IndexUsageStats[]>
  async getTableStats(): Promise<TableStats[]>
  async getUnusedIndexes(): Promise<IndexUsageStats[]>
  async suggestMissingIndexes(): Promise<string[]>
  async analyzeQueryPlan(query: string): Promise<QueryPlanAnalysis>
  async getPerformanceSummary(): Promise<PerformanceSummary>
  async optimizeConfiguration(): Promise<ConfigurationOptimization>
  async runMaintenance(): Promise<MaintenanceResults>
}
```

#### Performance Metrics

The system tracks the following key performance indicators:

- **Slow queries**: Queries with mean execution time exceeding the threshold (default: 1000ms)
- **Index usage**: Identification of unused indexes that consume storage without providing benefit
- **Table statistics**: Row counts, table sizes, and access patterns
- **Cache hit ratio**: Percentage of queries served from cache
- **Connection pool metrics**: Connection acquisition times and success rates

### Automatic Optimization

The EnhancedAuditDatabaseClient implements automatic optimization based on performance monitoring:

```mermaid
flowchart TD
Start([Performance Report]) --> CheckCache["Check cache hit ratio < 10%"]
CheckCache --> |Yes| ClearCache["Clear cache"]
CheckCache --> |No| CheckSlowQueries["Check slow queries > 10"]
CheckSlowQueries --> |Yes| RunMaintenance["Run VACUUM/ANALYZE"]
CheckSlowQueries --> |No| CheckSuggestions["Check performance suggestions"]
CheckSuggestions --> |Yes| LogSuggestions["Log optimization suggestions"]
CheckSuggestions --> |No| End([Optimization Complete])
```

**Diagram sources**
- [enhanced-client.ts](file://packages\audit-db\src\db\enhanced-client.ts)

The system generates performance reports every 5 minutes and takes automatic actions when certain thresholds are exceeded, such as clearing the cache when the hit ratio is very low or running maintenance operations when there are many slow queries.

## Access Control and Security

The Audit Database implements robust security measures to protect sensitive audit data and ensure compliance with regulatory requirements.

### Enhanced Client Security

The `EnhancedAuditDatabaseClient` provides comprehensive access control through the enhanced client implementation:

```mermaid
graph TD
App[Application] --> EC[EnhancedClient]
EC --> Auth[Authentication]
EC --> RBAC[Role-Based Access Control]
EC --> Tenant[Tenant Isolation]
EC --> Audit[Audit Trail]
Auth --> JWT[JWT Validation]
Auth --> Session[Session Management]
RBAC --> Roles[Predefined Roles]
RBAC --> Permissions[Granular Permissions]
Tenant --> OrgID[Organization ID]
Tenant --> RowLevel[Row-Level Security]
Audit --> Log[Security Event Logging]
Audit --> Integrity[Data Integrity Verification]
```

**Diagram sources**
- [enhanced-client.ts](file://packages\audit-db\src\db\enhanced-client.ts)

**Section sources**
- [enhanced-client.ts](file://packages\audit-db\src\db\enhanced-client.ts)

### Security Features

#### Data Encryption
- **Encryption at rest**: All data is encrypted when stored on disk
- **Cryptographic hashing**: Audit events are hashed using SHA-256 to ensure immutability
- **Integrity verification**: The audit_integrity_log table tracks all verification attempts and results

#### Access Control
- **Multi-tenant isolation**: All queries include organization_id filters to prevent cross-tenant data access
- **Row-level security**: Database policies ensure users can only access data belonging to their organization
- **Authentication**: Integration with the authentication system to validate user identities
- **Authorization**: Role-based access control to limit operations based on user privileges

#### Audit Trail
- **Self-auditing**: The system logs its own security-relevant operations
- **Immutable records**: Once created, audit records cannot be modified or deleted
- **Chain of custody**: Cryptographic hashes create a verifiable chain of custody for audit data

### Security Configuration

The enhanced client is configured with security best practices:

```typescript
const defaultConfig: EnhancedClientConfig = {
  connectionPool: {
    ssl: true,
    validateConnections: true,
  },
  monitoring: {
    enabled: true,
    slowQueryThreshold: 1000,
  },
  // Other security-related defaults
}
```

The system also implements defense-in-depth principles with multiple layers of security controls, including network security, database security, application security, and operational security.

## Migration and Version Management

The Audit Database uses Drizzle ORM for migration and version management, ensuring reliable schema evolution and deployment.

### Migration Strategy

```mermaid
flowchart LR
Dev[Development] --> Schema["Define schema in TypeScript"]
Schema --> Generate["Generate migration files"]
Generate --> Review["Review migration SQL"]
Review --> Test["Test migrations in staging"]
Test --> Deploy["Deploy to production"]
Deploy --> Verify["Verify migration success"]
Verify --> Monitor["Monitor post-migration performance"]
```

**Section sources**
- [schema.ts](file://packages\audit-db\src\db\schema.ts)

### Drizzle ORM Implementation

The system uses Drizzle ORM for type-safe database interactions and migration management:

1. **Schema Definition**: Database schema is defined in TypeScript using Drizzle's fluent API
2. **Migration Generation**: Drizzle generates SQL migration files from schema changes
3. **Migration Execution**: Migrations are applied in order using timestamp-based versioning
4. **Rollback Support**: Migration history is tracked to enable rollbacks if needed

### Migration Files

Migration files are stored in the drizzle/migrations directory with sequential numbering:

```
drizzle/migrations/
├── 0000_burly_namor.sql
├── 0001_aberrant_natasha_romanoff.sql
├── 0002_tearful_blonde_phantom.sql
├── 0003_easy_prowler.sql
├── 0004_mixed_roughhouse.sql
├── 0005_marvelous_christian_walker.sql
├── 0006_silly_tyger_tiger.sql
├── 0007_keen_ego.sql
├── 0008_swift_black_panther.sql
├── 0009_ambiguous_carnage.sql
├── 0010_thin_revanche.sql
├── 0011_shiny_quasar.sql
├── 0012_good_carnage.sql
├── 0013_happy_leo.sql
├── 0014_low_molecule_man.sql
├── 0015_broad_jazinda.sql
├── 0016_fresh_fallen_one.sql
├── 0017_past_bishop.sql
└── 0018_nebulous_mole_man.sql
```

Each migration file contains the SQL statements needed to upgrade the database schema, along with a corresponding rollback section.

### Version Management

The system implements version management through:

- **Schema versioning**: Each audit event includes an eventVersion field (default: '1.0')
- **Migration versioning**: Sequential migration files with timestamps
- **Compatibility management**: Support for multiple schema versions during transitions
- **Rollback capability**: Ability to revert to previous schema versions if issues are detected

The MIGRATION_GUIDE.md document provides detailed instructions for creating and managing migrations, including best practices for backward compatibility and data migration.

## Architecture Overview

### System Architecture

```mermaid
graph TD
subgraph "Application Layer"
Web[Web Application]
Native[Native App]
API[REST API]
end
subgraph "Service Layer"
Server[Server]
Worker[Worker]
Inngest[Inngest Functions]
end
subgraph "Data Layer"
AuditDB[Audit Database]
Redis[Redis Cache]
Archive[Archive Storage]
end
Web --> Server
Native --> Server
API --> Server
Server --> AuditDB
Server --> Redis
Worker --> AuditDB
Worker --> Redis
Inngest --> AuditDB
Inngest --> Redis
AuditDB --> Archive
subgraph "Monitoring"
PM[Performance Monitor]
Alert[Alert System]
Log[Logging]
end
AuditDB --> PM
PM --> Alert
PM --> Log
Server --> PM
style AuditDB fill:#f96,stroke:#333
style Redis fill:#bbf,stroke:#333
style Archive fill:#6f9,stroke:#333
```

**Diagram sources**
- [project_structure](file://)
- [enhanced-client.ts](file://packages\audit-db\src\db\enhanced-client.ts)

**Section sources**
- [project_structure](file://)
- [enhanced-client.ts](file://packages\audit-db\src\db\enhanced-client.ts)

### Data Access Patterns

The Audit Database supports several key data access patterns:

1. **Time-range queries**: Most common pattern, leveraging partition pruning for efficiency
2. **Organization-scoped queries**: All queries include organization_id for multi-tenancy
3. **Event-type queries**: Filtering by action type for specific audit trails
4. **Principal-based queries**: Tracking activities by specific users or services
5. **Compliance queries**: Complex queries for regulatory reporting

### Integration Points

The system integrates with several external components:

- **Authentication system**: For user identity and access control
- **Alerting system**: For real-time monitoring and notifications
- **Reporting system**: For scheduled compliance reports
- **Archival system**: For long-term data retention
- **Monitoring tools**: For system health and performance tracking

The architecture is designed to be scalable and maintainable, with clear separation of concerns and well-defined interfaces between components.

## Alert Persistence with Database Integration

The Audit Database now supports persistent alert storage through the DatabaseAlertHandler class, which integrates with the EnhancedAuditDatabaseClient to store and manage alerts in the PostgreSQL database.

### Database Alert Handler Architecture

```mermaid
graph TD
MS[MonitoringService] --> DAH[DatabaseAlertHandler]
DAH --> EADB[EnhancedAuditDatabaseClient]
EADB --> DB[(PostgreSQL)]
EADB --> RC[Redis Cache]
DAH --> RC
MS --> RC
subgraph "Alert Persistence"
DAH
EADB
end
subgraph "Data Storage"
DB
RC
end
style DAH fill:#f96,stroke:#333
style EADB fill:#f96,stroke:#333
style DB fill:#bbf,stroke:#333
style RC fill:#bbf,stroke:#333
```

**Diagram sources**
- [database-alert-handler.ts](file://packages\audit\src\monitor\database-alert-handler.ts)
- [enhanced-client.ts](file://packages\audit-db\src\db\enhanced-client.ts)

**Section sources**
- [database-alert-handler.ts](file://packages\audit\src\monitor\database-alert-handler.ts)
- [database-alert-integration.ts](file://packages\audit\src\examples\database-alert-integration.ts)

### DatabaseAlertHandler Class

The DatabaseAlertHandler class implements the AlertHandler interface to provide persistent storage of alerts in the database:

```typescript
class DatabaseAlertHandler implements AlertHandler {
  private client: EnhancedAuditDatabaseClient
  private db: PostgresJsDatabase<any>
  
  constructor(auditDbInstance: EnhancedAuditDb) {
    this.client = auditDbInstance.getEnhancedClientInstance()
    this.db = this.client.getDatabase()
  }
  
  async sendAlert(alert: Alert): Promise<void>
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<{ success: boolean }>
  async resolveAlert(alertId: string, resolvedBy: string, resolutionData?: AlertResolution): Promise<{ success: boolean }>
  async getActiveAlerts(organizationId?: string): Promise<Alert[]>
  async getAlerts(filters: AlertQueryFilters): Promise<Alert[]>
  async getAlertById(alertId: string, organizationId: string): Promise<Alert | null>
  async getAlertStatistics(organizationId?: string): Promise<AlertStatistics>
  async cleanupResolvedAlerts(organizationId: string, retentionDays: number = 90): Promise<number>
}
```

### Key Features

- **Multi-organizational support**: All alerts are stored with organization_id for tenant isolation
- **Persistent storage**: Alerts are stored in the PostgreSQL database for reliability
- **Caching integration**: Uses Redis caching for improved query performance
- **Comprehensive querying**: Supports filtering by severity, type, status, and other criteria
- **Statistics and metrics**: Provides alert statistics by severity, type, and status
- **Retention management**: Automatically cleans up resolved alerts based on retention policy

### Integration Example

The integration example has been updated to use the EnhancedAuditDb client instead of direct database connections:

```typescript
export async function setupMonitoringWithDatabaseAlerts() {
  // Initialize configuration
  if (!configManager) {
    configManager = new ConfigurationManager(process.env.CONFIG_PATH!, 's3')
    await configManager.initialize()
  }
  const config = configManager.getConfig()

  if (!connection) connection = getSharedRedisConnectionWithConfig(config.redis)

  if (!auditDbInstance) {
    auditDbInstance = new EnhancedAuditDb(connection, config.enhancedClient)
    const isConnected = await auditDbInstance.checkAuditDbConnection()
    if (!isConnected) {
      console.error('Failed to connect to the audit database. Exiting.')
      process.exit(1)
    }
  }

  // Create database alert handler
  if (!databaseAlertHandler) databaseAlertHandler = new DatabaseAlertHandler(auditDbInstance)

  if (!monitoringService) {
    if (!metricsCollector) metricsCollector = new RedisMetricsCollector(connection)
    monitoringService = new MonitoringService(config.monitoring, metricsCollector)
    monitoringService.addAlertHandler(databaseAlertHandler)
  }

  return {
    monitoringService,
    databaseAlertHandler,
    cleanup: () => auditDbInstance?.getEnhancedClientInstance().close(),
  }
}
```

**Section sources**
- [database-alert-integration.ts](file://packages\audit\src\examples\database-alert-integration.ts)

### Alert Data Model

The alerts table in the database stores the following fields:

- **id**: varchar(255) - Alert identifier (UUID)
- **organizationId**: varchar(255) - Tenant identifier for multi-organizational support
- **severity**: varchar(20) - Alert severity ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
- **type**: varchar(20) - Alert type ('SECURITY', 'COMPLIANCE', 'PERFORMANCE', 'SYSTEM')
- **title**: varchar(500) - Alert title
- **description**: text - Detailed alert description
- **source**: varchar(100) - Component that generated the alert
- **correlationId**: varchar(255) - Link to related events
- **metadata**: jsonb - Additional alert context
- **acknowledged**: varchar(10) - Acknowledgment status ('true'/'false')
- **acknowledgedAt**: timestamp - Timestamp when acknowledged
- **acknowledgedBy**: varchar(255) - User who acknowledged
- **resolved**: varchar(10) - Resolution status ('true'/'false')
- **resolvedAt**: timestamp - Timestamp when resolved
- **resolvedBy**: varchar(255) - User who resolved
- **resolutionNotes**: text - Notes about resolution
- **createdAt**: timestamp - Creation timestamp
- **updatedAt**: timestamp - Last update timestamp

### Usage Patterns

The DatabaseAlertHandler supports several key usage patterns:

1. **Alert creation**: Persist alerts generated by monitoring systems
2. **Alert acknowledgment**: Track when alerts have been acknowledged by users
3. **Alert resolution**: Record when alerts have been resolved and by whom
4. **Alert querying**: Retrieve alerts with various filters and sorting options
5. **Alert statistics**: Get summary statistics about active alerts
6. **Alert cleanup**: Automatically remove old resolved alerts based on retention policy

## GDPR Pseudonymization and Compliance

The Audit Database now supports GDPR-compliant pseudonymization through the GDPRComplianceService class, which integrates with the EnhancedAuditDatabaseClient to manage pseudonymized data while maintaining referential integrity.

### GDPR Pseudonymization Architecture

```mermaid
graph TD
US[User System] --> GCS[GDPRComplianceService]
GCS --> EADB[EnhancedAuditDatabaseClient]
EADB --> DB[(PostgreSQL)]
EADB --> RC[Redis Cache]
GCS --> KMS[InfisicalKMS]
KMS --> EADB
subgraph "GDPR Compliance"
GCS
KMS
end
subgraph "Data Storage"
DB
RC
end
style GCS fill:#f96,stroke:#333
style KMS fill:#f96,stroke:#333
style DB fill:#bbf,stroke:#333
style RC fill:#bbf,stroke:#333
```

**Diagram sources**
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts)
- [enhanced-client.ts](file://packages\audit-db\src\db\enhanced-client.ts)
- [pseudonym_mapping](file://packages\audit-db\drizzle\migrations\0006_silly_tyger_tiger.sql)
- [0007_keen_ego.sql](file://packages\audit-db\drizzle\migrations\0007_keen_ego.sql)
- [0008_swift_black_panther.sql](file://packages\audit-db\drizzle\migrations\0008_swift_black_panther.sql)

**Section sources**
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts)
- [pseudonymMapping](file://packages\audit-db\src\db\schema.ts)
- [0007_keen_ego.sql](file://packages\audit-db\drizzle\migrations\0007_keen_ego.sql)
- [0008_swift_black_panther.sql](file://packages\audit-db\drizzle\migrations\0008_swift_black_panther.sql)

### GDPRComplianceService Class

The GDPRComplianceService class implements GDPR requirements for data subject rights and privacy-by-design principles:

```typescript
class GDPRComplianceService {
  private db: PostgresJsDatabase<typeof auditSchema>

  constructor(
    private client: EnhancedAuditDatabaseClient,
    private audit: Audit,
    private kms: InfisicalKmsClient
  ) {
    this.db = this.client.getDatabase()
  }
  
  async exportUserData(request: GDPRDataExportRequest): Promise<GDPRDataExport>
  async pseudonymizeUserData(principalId: string, strategy: PseudonymizationStrategy, requestedBy: string): Promise<{ pseudonymId: string; recordsAffected: number }>
  async applyRetentionPolicies(): Promise<ArchivalResult[]>
  async deleteUserDataWithAuditTrail(principalId: string, requestedBy: string, preserveComplianceAudits: boolean): Promise<{ recordsDeleted: number; complianceRecordsPreserved: number }>
  async getOriginalId(pseudonymId: string): Promise<string | undefined>
}
```

### Key Features

- **Persistent pseudonym mapping**: Stores encrypted pseudonym-to-original ID mappings in the pseudonym_mapping table
- **Multiple pseudonymization strategies**: Supports hash, token, and encryption strategies
- **Referential integrity**: Maintains relationships between pseudonymized records
- **Authorized reverse lookup**: Allows authorized users to retrieve original IDs for compliance investigations
- **Comprehensive audit trail**: Logs all GDPR-related activities for compliance verification
- **Data subject rights**: Implements access, rectification, erasure, portability, and restriction rights

### Pseudonym Mapping Data Model

The pseudonym_mapping table stores the following fields:

- **id**: serial - Primary key
- **timestamp**: timestamp with time zone - Creation timestamp
- **pseudonymId**: text - Pseudonymized identifier
- **originalId**: text - Encrypted original identifier (unique constraint)
- **strategy**: varchar(20) - Pseudonymization strategy used ('hash', 'token', 'encryption')

### Pseudonymization Strategies

The system supports three pseudonymization strategies:

1. **Hash-based**: Uses SHA-256 hashing with salt for deterministic pseudonymization
2. **Token-based**: Generates random tokens for non-deterministic pseudonymization
3. **Encryption-based**: Uses KMS encryption for reversible pseudonymization

### Integration Example

```typescript
// Initialize GDPR compliance service
const gdprService = new GDPRComplianceService(
  enhancedAuditDbClient,
  auditService,
  kmsClient
)

// Pseudonymize user data
const result = await gdprService.pseudonymizeUserData(
  'user-123',
  'hash',
  'admin-user'
)

console.log('Pseudonym ID:', result.pseudonymId)
console.log('Records affected:', result.recordsAffected)

// Retrieve original ID (authorized use only)
const originalId = await gdprService.getOriginalId(result.pseudonymId)
console.log('Original ID:', originalId)

// Export user data for GDPR compliance
const exportRequest = {
  principalId: 'user-123',
  organizationId: 'org-456',
  requestType: 'access',
  format: 'json',
  requestedBy: 'admin-user',
  requestTimestamp: new Date().toISOString()
}

const exportResult = await gdprService.exportUserData(exportRequest)
console.log('Export completed:', exportResult.recordCount, 'records')
```

**Section sources**
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts)

### Usage Patterns

The GDPRComplianceService supports several key usage patterns:

1. **User data export**: Export audit data in portable formats (JSON, CSV, XML) for data subject access requests
2. **Data pseudonymization**: Replace original identifiers with pseudonyms while maintaining referential integrity
3. **Right to erasure**: Delete user data while preserving compliance-critical audit trails
4. **Retention policy enforcement**: Automatically archive and delete data based on retention policies
5. **Authorized investigation**: Retrieve original identifiers for compliance investigations with proper authorization
6. **Compliance reporting**: Generate reports for regulatory audits and compliance verification

### Migration Details

The pseudonymization system has been enhanced with two new migration files:

**Migration 0007_keen_ego.sql:**
```sql
ALTER TABLE "pseudonym_mapping" ADD COLUMN "strategy" varchar(20) NOT NULL;
CREATE INDEX "pseudonym_mapping_strategy_idx" ON "pseudonym_mapping" USING btree ("strategy");
```

This migration adds a new `strategy` column to track the pseudonymization method used and creates an index for efficient querying by strategy.

**Migration 0008_swift_black_panther.sql:**
```sql
DROP INDEX "pseudonym_mapping_original_id_idx";
CREATE UNIQUE INDEX "pseudonym_mapping_original_id_idx" ON "pseudonym_mapping" USING btree ("original_id");
```

This migration replaces the existing index on `original_id` with a unique constraint to prevent duplicate original identifiers in the pseudonym mapping table, ensuring data integrity.

**Section sources**
- [0007_keen_ego.sql](file://packages\audit-db\drizzle\migrations\0007_keen_ego.sql)
- [0008_swift_black_panther.sql](file://packages\audit-db\drizzle\migrations\0008_swift_black_panther.sql)

## Organization Role Management

The Audit Database now supports organization-level role management through the AuthorizationService class, which integrates with the EnhancedAuditDatabaseClient to manage role-based access control with Redis caching and PostgreSQL persistence.

### Organization Role Management Architecture

```mermaid
graph TD
US[User System] --> AS[AuthorizationService]
AS --> EADB[EnhancedAuditDatabaseClient]
EADB --> DB[(PostgreSQL)]
EADB --> RC[Redis Cache]
AS --> RC
US --> RC
subgraph "Role Management"
AS
EADB
end
subgraph "Data Storage"
DB
RC
end
style AS fill:#f96,stroke:#333
style EADB fill:#f96,stroke:#333
style DB fill:#bbf,stroke:#333
style RC fill:#bbf,stroke:#333
```

**Diagram sources**
- [authz.ts](file://packages\auth\src\permissions.ts)
- [enhanced-client.ts](file://packages\audit-db\src\db\enhanced-client.ts)
- [organization_role](file://packages\auth\drizzle\0005_fluffy_donald_blake.sql)

**Section sources**
- [authz.ts](file://packages\auth\src\permissions.ts)
- [organization_role](file://packages\auth\drizzle\0005_fluffy_donald_blake.sql)

### AuthorizationService Class

The AuthorizationService class implements role-based access control for organizational permissions:

```typescript
class AuthorizationService {
  private readonly roleCachePrefix = 'authz:roles:'
  private readonly permissionCachePrefix = 'authz:permissions:'
  private readonly retentionPeriod = 5 * 60 // 5 minutes

  constructor(
    private db: PostgresJsDatabase<typeof authSchema>,
    private redis: RedisInstanceType
  ) {
    this.initializeRoles()
  }
  
  async hasPermission(session: Session, resource: string, action: string, context?: Record<string, any>): Promise<boolean>
  async getUserPermissions(session: Session): Promise<Permission[]>
  async getRole(roleName: string): Promise<Role | undefined>
  async getAllRoles(): Promise<Role[]>
  private async initializeRoles(): Promise<void>
  private async getRolePermissions(role: Role): Promise<Permission[]>
  private async checkRolePermissions(role: Role, resource: string, action: string, context?: Record<string, any>): Promise<boolean>
  private async checkResourceSpecificPermissions(session: Session, resource: string, action: string, context?: Record<string, any>): Promise<boolean>
  private async addRoleToDatabase(role: Role): Promise<void>
  private async removeRoleFromDatabase(roleName: string): Promise<void>
}
```

### Key Features

- **Organization-specific roles**: Stores roles with organization_id and name as composite primary key
- **Permission inheritance**: Supports role inheritance through the inherits field
- **Redis caching**: Caches roles and permissions for improved performance
- **PostgreSQL persistence**: Stores role definitions in the organization_role table
- **Composite primary key**: Uses organization_id and name as composite primary key for uniqueness
- **Foreign key constraint**: Enforces referential integrity with the organization table
- **Index optimization**: Includes indexes on organization_id and name for query performance

### Organization Role Data Model

The organization_role table stores the following fields:

- **organizationId**: varchar(50) - Organization identifier (composite primary key)
- **name**: varchar(50) - Role name (composite primary key)
- **description**: text - Role description
- **permissions**: jsonb - Array of permission objects with resource and action
- **inherits**: jsonb - Array of role names that this role inherits from

### Role Management Usage

The AuthorizationService supports several key usage patterns:

1. **Permission checking**: Verify if a user has permission to perform an action on a resource
2. **Role retrieval**: Get role definitions from cache or database
3. **Permission caching**: Cache permission results for 5 minutes to reduce database load
4. **Role inheritance**: Support hierarchical role structures through inheritance
5. **Resource-specific permissions**: Handle ownership and organization-level access rules
6. **System integration**: Integrate with GraphQL resolvers and other services for access control

### Integration Example

```typescript
// Initialize authorization service
const authorizationService = createAuthorizationService(db, redis)

// Check if user has permission
const hasPermission = await authorizationService.hasPermission(
  session,
  'audit.events',
  'read',
  { organizationId: 'org-123' }
)

if (!hasPermission) {
  throw new Error('Access denied')
}

// Get user permissions
const permissions = await authorizationService.getUserPermissions(session)
console.log('User permissions:', permissions)

// Get specific role
const role = await authorizationService.getRole('org-123:admin')
if (role) {
  console.log('Role permissions:', role.permissions)
}
```

**Section sources**
- [authz.ts](file://packages\auth\src\permissions.ts)
- [organization_role](file://packages\auth\drizzle\0005_fluffy_donald_blake.sql)

## Delivery System Database Schema

The Audit Database now includes a comprehensive delivery system for managing and tracking the delivery of audit data, reports, and other content to various destinations.

### Delivery System Architecture

```mermaid
graph TD
DS[Delivery System] --> DD[DeliveryDestinations]
DD --> DL[DeliveryLogs]
DD --> DQ[DeliveryQueue]
DD --> DH[DestinationHealth]
DQ --> DB[(PostgreSQL)]
DL --> DB
DH --> DB
DD --> DB
subgraph "Delivery System"
DD
DL
DQ
DH
end
subgraph "Data Storage"
DB
end
style DD fill:#f96,stroke:#333
style DL fill:#f96,stroke:#333
style DQ fill:#f96,stroke:#333
style DH fill:#f96,stroke:#333
style DB fill:#bbf,stroke:#333
```

**Diagram sources**
- [schema.ts](file://packages\audit-db\src\db\schema.ts)
- [0017_past_bishop.sql](file://packages\audit-db\drizzle\migrations\0017_past_bishop.sql)

**Section sources**
- [schema.ts](file://packages\audit-db\src\db\schema.ts)
- [0017_past_bishop.sql](file://packages\audit-db\drizzle\migrations\0017_past_bishop.sql)

### Core Delivery Entities

#### deliveryDestinations
Stores configuration for delivery destinations where audit data, reports, and other content can be sent.

**Fields:**
- **id**: serial - Primary key
- **organizationId**: varchar(255) - Tenant identifier for multi-organizational support
- **type**: varchar(50) - Destination type ('email', 's3', 'ftp', 'webhook', etc.)
- **label**: varchar(255) - Human-readable label for the destination
- **description**: text - Description of the destination
- **icon**: varchar(255) - URL or icon name for visual representation
- **instructions**: text - Setup or usage instructions
- **disabled**: varchar(10) - Whether the destination is disabled ('true'/'false')
- **disabledAt**: timestamp - Timestamp when disabled
- **disabledBy**: varchar(255) - User who disabled the destination
- **countUsage**: integer - Usage count (number of deliveries)
- **lastUsedAt**: timestamp - Timestamp of last delivery
- **config**: jsonb - Configuration details specific to the destination type
- **createdAt**: timestamp - Creation timestamp
- **updatedAt**: timestamp - Last update timestamp

#### deliveryLogs
Tracks the delivery history and status of all delivery attempts.

**Fields:**
- **id**: serial - Primary key
- **deliveryId**: varchar(255) - Global delivery identifier
- **destinationId**: integer - Foreign key to delivery_destinations
- **organizationId**: varchar(255) - Tenant identifier for multi-organizational support
- **objectDetails**: jsonb - Details about the delivered object (type, id, name, size, format, etc.)
- **status**: varchar(20) - Delivery status ('pending', 'delivered', 'failed', 'retrying')
- **attempts**: jsonb - Array of attempt timestamps and statuses
- **lastAttemptAt**: timestamp - Timestamp of last delivery attempt
- **deliveredAt**: timestamp - Timestamp when successfully delivered
- **failureReason**: text - Reason for delivery failure
- **crossSystemReference**: varchar(255) - External tracking reference
- **correlationId**: varchar(255) - For request correlation
- **idempotencyKey**: varchar(255) - For duplicate detection
- **details**: jsonb - Additional delivery details
- **createdAt**: timestamp - Creation timestamp
- **updatedAt**: timestamp - Last update timestamp

#### deliveryQueue
Manages the queue of pending deliveries with priority and retry logic.

**Fields:**
- **id**: varchar(255) - Primary key (UUID)
- **organizationId**: varchar(255) - Tenant identifier for multi-organizational support
- **destinationId**: integer - Foreign key to delivery_destinations
- **payload**: jsonb - Delivery payload (content to be delivered)
- **priority**: integer - Delivery priority (0-10, higher = more priority)
- **scheduledAt**: timestamp - Scheduled delivery time
- **processedAt**: timestamp - Timestamp when processed
- **status**: varchar(20) - Queue status ('pending', 'processing', 'completed', 'failed')
- **correlationId**: varchar(255) - For request correlation
- **idempotencyKey**: varchar(255) - For duplicate detection
- **retryCount**: integer - Number of retry attempts
- **maxRetries**: integer - Maximum number of retries allowed
- **nextRetryAt**: timestamp - Next retry scheduled time
- **metadata**: jsonb - Additional metadata
- **createdAt**: timestamp - Creation timestamp
- **updatedAt**: timestamp - Last update timestamp

#### destinationHealth
Monitors the health and performance of delivery destinations.

**Fields:**
- **destinationId**: integer - Primary key (foreign key to delivery_destinations)
- **status**: varchar(20) - Health status ('healthy', 'degraded', 'unhealthy', 'disabled')
- **lastCheckAt**: timestamp - Timestamp of last health check
- **consecutiveFailures**: integer - Number of consecutive failures
- **totalFailures**: integer - Total number of failures
- **totalDeliveries**: integer - Total number of deliveries
- **successRate**: varchar(10) - Success rate percentage as string
- **averageResponseTime**: integer - Average response time in milliseconds
- **lastFailureAt**: timestamp - Timestamp of last failure
- **lastSuccessAt**: timestamp - Timestamp of last success
- **disabledAt**: timestamp - Timestamp when disabled
- **disabledReason**: text - Reason for disabling
- **circuitBreakerState**: varchar(20) - Circuit breaker state ('closed', 'open', 'half-open')
- **circuitBreakerOpenedAt**: timestamp - Timestamp when circuit breaker opened
- **metadata**: jsonb - Additional health metadata
- **updatedAt**: timestamp - Last update timestamp

### Delivery System Features

- **Multi-destination support**: Supports various delivery types including email, S3, FTP, and webhooks
- **Priority queuing**: Deliveries can be prioritized based on importance
- **Retry logic**: Failed deliveries are automatically retried with exponential backoff
- **Idempotency**: Idempotency keys prevent duplicate deliveries
- **Health monitoring**: Continuous monitoring of destination health and performance
- **Circuit breaker integration**: Prevents overwhelming failing destinations
- **Comprehensive logging**: Detailed logs of all delivery attempts and outcomes
- **Multi-tenancy**: Full organizational isolation for all delivery operations

### Usage Patterns

The delivery system supports several key usage patterns:

1. **Scheduled report delivery**: Automatically deliver compliance reports to designated recipients
2. **Real-time alert notifications**: Send security and compliance alerts to stakeholders
3. **Data exports**: Deliver audit data exports to external systems or partners
4. **Backup and archival**: Send audit data to backup storage locations
5. **Integration with external systems**: Connect with third-party services through webhooks
6. **Health monitoring and alerting**: Monitor delivery destination health and alert on issues

## Enhanced Resilience Patterns

The Audit Database has been enhanced with advanced resilience patterns to improve system reliability and fault tolerance.

### Resilience Architecture

```mermaid
graph TD
EC[EnhancedClient] --> CB[CircuitBreaker]
EC --> LRU[OptimizedLRUCache]
CB --> DB[(PostgreSQL)]
LRU --> Redis[(Redis)]
CB --> Redis
subgraph "Resilience Layer"
CB
LRU
end
subgraph "Data Storage"
DB
Redis
end
style CB fill:#f96,stroke:#333
style LRU fill:#f96,stroke:#333
style DB fill:#bbf,stroke:#333
style Redis fill:#bbf,stroke:#333
```

**Diagram sources**
- [circuit-breaker.ts](file://packages\audit-db\src\db\circuit-breaker.ts)
- [optimized-lru-cache.ts](file://packages\audit-db\src\cache\optimized-lru-cache.ts)

**Section sources**
- [circuit-breaker.ts](file://packages\audit-db\src\db\circuit-breaker.ts)
- [optimized-lru-cache.ts](file://packages\audit-db\src\cache\optimized-lru-cache.ts)

### Circuit Breaker Implementation

The CircuitBreaker class implements the circuit breaker pattern to prevent cascading failures and improve system resilience.

```typescript
class CircuitBreaker implements ICircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failureCount = 0
  private successCount = 0
  private nextAttemptTime: Date | null = null
  private metrics: CircuitBreakerMetrics
  private readonly logger: StructuredLogger

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig
  ) {
    // Initialize logger and metrics
  }

  async execute<T>(operation: () => Promise<T>): Promise<T>
  getState(): CircuitBreakerState
  reset(): void
  getStatus(): CircuitBreakerStatus
  private onSuccess(): void
  private onFailure(error: Error): void
  private openCircuit(): void
  private shouldAttemptReset(): boolean
  private calculateBackoff(): number
}
```

#### Circuit Breaker States

- **CLOSED**: Normal operation, requests are allowed
- **OPEN**: Circuit is broken, requests are rejected
- **HALF_OPEN**: Circuit is testing recovery, limited requests allowed

#### Circuit Breaker Configuration

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number // Number of failures before opening circuit
  timeoutMs: number // Operation timeout in milliseconds
  resetTimeoutMs: number // Time to wait before attempting reset
}
```

#### Key Features

- **Failure threshold**: Automatically opens circuit after configurable number of failures
- **Timeout protection**: Prevents hanging operations with configurable timeouts
- **Exponential backoff**: Increases wait time between retry attempts
- **Jitter**: Adds randomness to backoff to prevent thundering herd
- **Metrics collection**: Tracks requests, failures, timeouts, and circuit state changes
- **Logging**: Comprehensive logging for monitoring and debugging
- **Registry**: Central registry for managing multiple circuit breakers

### Optimized LRU Cache

The OptimizedLRUCache class provides a high-performance LRU cache implementation with O(1) operations.

```typescript
class OptimizedLRUCache<T = any> implements IQueryCache {
  private readonly keyMap = new Map<string, CacheNode<T>>()
  private readonly head: CacheNode<T>
  private readonly tail: CacheNode<T>
  private currentSizeBytes = 0
  private metrics: CacheMetrics
  private cleanupTimer: NodeJS.Timeout | null = null
  private readonly logger: StructuredLogger

  constructor(private config: OptimizedLRUConfig)

  async get<U = T>(key: string): Promise<U | null>
  async set<U = T>(key: string, value: U, ttlSeconds?: number): Promise<void>
  async invalidate(pattern: string): Promise<number>
  async stats(): Promise<QueryCacheStats>
  async delete(key: string): Promise<boolean>
  clear(): void
  cleanup(): number
  destroy(): void
}
```

#### Cache Configuration

```typescript
interface OptimizedLRUConfig {
  maxSizeMB: number // Maximum cache size in MB
  defaultTTL: number // Default time-to-live in seconds
  keyPrefix: string // Key prefix for namespacing
  enabled: boolean // Whether cache is enabled
  maxKeys: number // Maximum number of keys
  cleanupInterval: number // Interval for cleaning expired entries
}
```

#### Key Features

- **O(1) operations**: HashMap + Doubly Linked List implementation ensures constant time complexity
- **Memory tracking**: Tracks memory usage in bytes for size-based eviction
- **TTL support**: Time-to-live for automatic expiration of entries
- **Size-based eviction**: Evicts entries when cache exceeds maximum size
- **Count-based eviction**: Limits maximum number of keys
- **Periodic cleanup**: Regular cleanup of expired entries
- **Pattern invalidation**: Invalidate entries by pattern matching
- **Detailed metrics**: Comprehensive metrics for monitoring and optimization
- **Size estimation**: Estimates object size in bytes for accurate memory tracking

### Resilience Integration

The enhanced client integrates both circuit breaker and cache patterns to provide comprehensive resilience:

```typescript
class EnhancedAuditDatabaseClient {
  private circuitBreaker: CircuitBreaker
  private cache: OptimizedLRUCache

  constructor(config: EnhancedClientConfig) {
    this.circuitBreaker = createCircuitBreaker('audit-db', config.circuitBreaker)
    this.cache = createOptimizedLRUCache(config.cache)
  }

  async query<T>(sql: string, params?: any[]): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      const cacheKey = this.generateCacheKey(sql, params)
      const cached = await this.cache.get<T>(cacheKey)
      
      if (cached) {
        return cached
      }

      const result = await this.executeQuery(sql, params)
      await this.cache.set(cacheKey, result, this.config.cache.defaultTTL)
      
      return result
    })
  }
}
```

### Usage Patterns

The resilience patterns support several key usage patterns:

1. **Database operation protection**: Wrap database operations with circuit breaker for fault tolerance
2. **Query caching**: Cache frequent queries to reduce database load
3. **Health monitoring**: Monitor circuit breaker state and cache metrics for system health
4. **Performance optimization**: Use cache hit ratio and operation times to identify optimization opportunities
5. **Failure recovery**: Automatically recover from temporary failures with circuit breaker
6. **Resource protection**: Prevent overwhelming downstream services with circuit breaker
7. **Memory management**: Control cache memory usage with size and count limits

## Conclusion

The Audit Database is a comprehensive, high-performance system designed to meet the demanding requirements of modern audit and compliance scenarios. By implementing advanced database techniques such as time-based partitioning, Redis caching, and comprehensive performance monitoring, the system delivers excellent performance even with large volumes of audit data.

Key strengths of the system include:

- **Scalability**: The partitioning strategy allows the system to handle massive amounts of data while maintaining query performance.
- **Compliance**: Built-in support for regulatory requirements with 7-year retention, cryptographic integrity verification, and comprehensive audit trails.
- **Security**: Robust access control, encryption at rest, and multi-tenant isolation ensure data protection.
- **Maintainability**: Automated maintenance tasks and comprehensive monitoring reduce operational overhead.
- **Extensibility**: The modular architecture and Drizzle ORM integration make it easy to evolve the schema as requirements change.
- **Alert Persistence**: The new DatabaseAlertHandler provides reliable, persistent storage of alerts with multi-organizational support and comprehensive querying capabilities.
- **GDPR Compliance**: The GDPRComplianceService and pseudonym_mapping table provide robust support for data subject rights and privacy-by-design principles, now enhanced with strategy tracking and unique constraints.
- **Organization Role Management**: The AuthorizationService and organization_role table provide fine-grained access control with Redis caching and PostgreSQL persistence.
- **Delivery System**: The new delivery system with deliveryDestinations, deliveryLogs, deliveryQueue, and destinationHealth tables provides comprehensive delivery management with priority queuing, retry logic, and health monitoring.
- **Enhanced Resilience**: The CircuitBreaker and OptimizedLRUCache implementations provide advanced fault tolerance and performance optimization patterns.

The system is well-positioned to serve as the foundation for audit and compliance capabilities across various domains, with particular strength in healthcare applications requiring HIPAA compliance. By following the documented patterns and best practices, organizations can ensure their audit data is secure, reliable, and available when needed.