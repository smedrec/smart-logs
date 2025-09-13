# Database Initialization and Setup

<cite>
**Referenced Files in This Document**   
- [schema.ts](file://packages/audit-db/src/db/schema.ts#L0-L661)
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts#L0-L496)
- [connection-pool.ts](file://packages/audit-db/src/db/connection-pool.ts#L0-L348)
- [convert-to-partitioned.sql](file://packages/audit-db/src/db/migrations/convert-to-partitioned.sql#L0-L65)
- [README.md](file://packages/audit-db/README.md#L0-L107)
- [MIGRATION_GUIDE.md](file://packages/audit-db/MIGRATION_GUIDE.md#L0-L184)
- [PARTITIONING.md](file://packages/audit-db/PARTITIONING.md#L0-L112)
- [PERFORMANCE_OPTIMIZATION.md](file://packages/audit-db/PERFORMANCE_OPTIMIZATION.md#L0-L354)
- [01-init-audit-db.sql](file://apps/server/init-scripts/01-init-audit-db.sql)
</cite>

## Table of Contents
1. [Database Initialization and Setup](#database-initialization-and-setup)
2. [SQL Script Execution Process](#sql-script-execution-process)
3. [Database Schema Structure](#database-schema-structure)
4. [Drizzle ORM Schema Definition](#drizzle-orm-schema-definition)
5. [Migration Strategy Using Drizzle](#migration-strategy-using-drizzle)
6. [Database Partitioning Setup](#database-partitioning-setup)
7. [Performance Optimizations](#performance-optimizations)
8. [Backup, Restore and Disaster Recovery](#backup-restore-and-disaster-recovery)
9. [Common Initialization Issues](#common-initialization-issues)

## SQL Script Execution Process

The database initialization process begins with executing SQL scripts that set up the audit database schema and seed data. The primary initialization script is located at `apps/server/init-scripts/01-init-audit-db.sql`. This script is designed to be executed during the initial setup of the database environment, typically as part of a containerized deployment or database provisioning process.

The initialization script follows a structured approach to ensure proper database setup:

1. **Database Creation**: Creates the audit database with appropriate encoding and locale settings
2. **Extension Installation**: Installs required PostgreSQL extensions such as `pgcrypto` for cryptographic functions and `pg_stat_statements` for query performance monitoring
3. **Role and Permission Setup**: Establishes database roles with appropriate privileges for different application components
4. **Schema Initialization**: Creates the necessary schema structure before table creation
5. **Initial Data Seeding**: Inserts seed data for essential configuration tables

The script execution should be performed with a superuser account to ensure all operations can be completed successfully. After execution, the script verifies the creation of key database objects and reports any errors encountered during the process.

For automated deployments, the script can be executed using standard PostgreSQL client tools:

```bash
psql -U postgres -d postgres -f apps/server/init-scripts/01-init-audit-db.sql
```

**Section sources**
- [01-init-audit-db.sql](file://apps/server/init-scripts/01-init-audit-db.sql)

## Database Schema Structure

The audit database schema is designed to support comprehensive audit logging with compliance features for regulatory requirements such as HIPAA, GDPR, and other data protection standards. The schema consists of multiple interconnected tables that capture audit events, manage retention policies, track integrity verification, and support reporting capabilities.

### Core Tables

**audit_log**: The primary table for storing audit events with fields for timestamp, action, status, principal information, and detailed event data in JSONB format.

**audit_integrity_log**: Tracks verification attempts and results for audit event integrity, enabling cryptographic verification of audit records.

**audit_retention_policy**: Manages data lifecycle and retention policies for different data classification levels.

**error_log**: Stores structured error information for analysis and troubleshooting.

**scheduled_reports**: Contains configurations for automated compliance report scheduling and delivery.

### Table Relationships

The schema implements a relational structure with appropriate foreign key constraints:

- **audit_integrity_log** references **audit_log** via auditLogId
- **report_executions** references **scheduled_reports** via reportConfigId
- Other tables maintain referential integrity through UUID-based relationships

The schema also includes soft references through correlationId fields that allow tracking related events across different systems without strict foreign key constraints.

```mermaid
erDiagram
audit_log {
integer id PK
timestamp with time zone timestamp
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
timestamp with time zone archived_at
jsonb details
}
audit_integrity_log {
integer id PK
integer audit_log_id FK
timestamp with time zone verification_timestamp
varchar verification_status
jsonb verification_details
varchar verified_by
varchar hash_verified
varchar expected_hash
}
audit_retention_policy {
integer id PK
varchar policy_name
integer retention_days
integer archive_after_days
integer delete_after_days
varchar data_classification
text description
varchar is_active
timestamp with time zone created_at
timestamp with time zone updated_at
varchar created_by
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
timestamp with time zone last_run
timestamp with time zone next_run
timestamp with time zone created_at
varchar created_by
timestamp with time zone updated_at
varchar updated_by
}
report_executions {
varchar id PK
varchar report_config_id FK
varchar organization_id
timestamp with time zone scheduled_time
timestamp with time zone execution_time
varchar status
integer duration
integer records_processed
jsonb export_result
jsonb integrity_report
jsonb delivery_attempts
text error
timestamp with time zone created_at
}
audit_log ||--o{ audit_integrity_log : "has integrity verification"
scheduled_reports ||--o{ report_executions : "has executions"
```

**Diagram sources**
- [schema.ts](file://packages/audit-db/src/db/schema.ts#L0-L661)

**Section sources**
- [schema.ts](file://packages/audit-db/src/db/schema.ts#L0-L661)

## Drizzle ORM Schema Definition

The database schema is defined using Drizzle ORM, a TypeScript-based query builder and schema definition tool for PostgreSQL. The schema definition provides type safety and enables code generation for database interactions.

### Schema Implementation

The main schema file `packages/audit-db/src/db/schema.ts` defines all database tables using Drizzle's fluent API. Each table is created using the `pgTable` function with appropriate column types and constraints.

Key aspects of the schema definition:

- **Type Safety**: Uses TypeScript types to ensure data integrity
- **Column Definitions**: Specifies data types, nullability, defaults, and constraints
- **Index Creation**: Defines indexes for performance optimization
- **Relationships**: Establishes foreign key relationships where appropriate

### Data Types and Constraints

The schema employs various PostgreSQL data types optimized for audit logging:

- **serial**: Auto-incrementing primary keys
- **timestamp with time zone**: For accurate timestamp recording
- **varchar**: Variable length strings with appropriate size limits
- **integer**: For numeric values like latency and counts
- **jsonb**: For flexible storage of structured data in the details field
- **text**: For longer descriptive content

Constraints include NOT NULL for required fields, default values for optional fields, and appropriate length limits to prevent excessive data storage.

### Index Strategy

The schema defines a comprehensive indexing strategy to optimize query performance:

- **Core Indexes**: On frequently queried fields like timestamp, principal_id, and action
- **Compliance Indexes**: On data_classification, retention_policy, and correlation_id
- **Composite Indexes**: For common query patterns combining multiple fields
- **JSONB Indexes**: GIN indexes on the details field for efficient JSON querying

```mermaid
classDiagram
class auditLog {
+id : serial
+timestamp : timestamp with time zone
+ttl : varchar
+principalId : varchar
+organizationId : varchar
+action : varchar
+targetResourceType : varchar
+targetResourceId : varchar
+status : varchar
+outcomeDescription : text
+hash : varchar
+hashAlgorithm : varchar
+eventVersion : varchar
+correlationId : varchar
+dataClassification : varchar
+retentionPolicy : varchar
+processingLatency : integer
+archivedAt : timestamp with time zone
+details : jsonb
}
class auditIntegrityLog {
+id : serial
+auditLogId : integer
+verificationTimestamp : timestamp with time zone
+verificationStatus : varchar
+verificationDetails : jsonb
+verifiedBy : varchar
+hashVerified : varchar
+expectedHash : varchar
}
class auditRetentionPolicy {
+id : serial
+policyName : varchar
+retentionDays : integer
+archiveAfterDays : integer
+deleteAfterDays : integer
+dataClassification : varchar
+description : text
+isActive : varchar
+createdAt : timestamp with time zone
+updatedAt : timestamp with time zone
+createdBy : varchar
}
class scheduledReports {
+id : varchar
+name : varchar
+description : text
+organizationId : varchar
+templateId : varchar
+reportType : varchar
+criteria : jsonb
+format : varchar
+schedule : jsonb
+delivery : jsonb
+export : jsonb
+enabled : varchar
+lastRun : timestamp with time zone
+nextRun : timestamp with time zone
+createdAt : timestamp with time zone
+createdBy : varchar
+updatedAt : timestamp with time zone
+updatedBy : varchar
}
class reportExecutions {
+id : varchar
+reportConfigId : varchar
+organizationId : varchar
+scheduledTime : timestamp with time zone
+executionTime : timestamp with time zone
+status : varchar
+duration : integer
+recordsProcessed : integer
+exportResult : jsonb
+integrityReport : jsonb
+deliveryAttempts : jsonb
+error : text
+createdAt : timestamp with time zone
}
auditLog --> auditIntegrityLog : "1 to many"
scheduledReports --> reportExecutions : "1 to many"
```

**Diagram sources**
- [schema.ts](file://packages/audit-db/src/db/schema.ts#L0-L661)

**Section sources**
- [schema.ts](file://packages/audit-db/src/db/schema.ts#L0-L661)

## Migration Strategy Using Drizzle

The database migration strategy leverages Drizzle Kit, a powerful migration tool that integrates with the Drizzle ORM schema definition. This approach provides a structured and reliable method for evolving the database schema over time.

### Migration Workflow

The migration process follows these steps:

1. **Schema Changes**: Modify the TypeScript schema definition in `schema.ts`
2. **Migration Generation**: Use Drizzle Kit to generate SQL migration files
3. **Migration Review**: Examine the generated SQL for correctness
4. **Migration Application**: Apply migrations to the target database
5. **Verification**: Validate that migrations were applied correctly

### Migration Commands

The package.json file in the audit-db package includes scripts for managing migrations:

```bash
# Generate migration files based on schema changes
pnpm run audit-db:generate

# Apply pending migrations to the database
pnpm run audit-db:migrate

# Start Drizzle Studio for visual database management
pnpm run audit-db:studio
```

### Migration File Structure

Migration files are stored in `packages/audit-db/drizzle/migrations/` with filenames following the pattern `000X_description.sql`. Each migration file contains SQL statements to modify the database schema, with corresponding rollback statements in the `_journal.json` file.

### Example Migration

The MIGRATION_GUIDE.md document details two significant migrations:

**Migration 0005_magenta_peter_quill**: Adds compliance fields to the audit_log table including hash_algorithm, event_version, correlation_id, data_classification, retention_policy, processing_latency, and archived_at.

**Migration 0006_unknown_siren**: Transforms the audit system into a common audit system by removing resource-specific fields and leveraging the flexible details JSONB column.

### Migration Best Practices

- Always backup the database before applying migrations
- Test migrations on a copy of production data
- Use transaction blocks to ensure atomicity
- Include rollback procedures for each migration
- Document the purpose and impact of each migration

**Section sources**
- [README.md](file://packages/audit-db/README.md#L0-L107)
- [MIGRATION_GUIDE.md](file://packages/audit-db/MIGRATION_GUIDE.md#L0-L184)

## Database Partitioning Setup

The audit database implements a partitioning strategy to optimize performance and manage large datasets efficiently. The partitioning is based on time ranges, specifically monthly partitions for the audit_log table.

### Partitioning Implementation

The partitioning functionality is implemented in `packages/audit-db/src/db/partitioning.ts` with the `DatabasePartitionManager` class. This class provides methods for creating, managing, and analyzing partitions.

Key features of the partitioning implementation:

- **Range Partitioning**: Partitions by timestamp column
- **Monthly Intervals**: Each partition covers one month of data
- **Automatic Creation**: Creates partitions for current and future months
- **Retention Management**: Automatically drops expired partitions based on retention policy
- **Index Management**: Creates optimized indexes on each partition

### Partitioning Setup Options

There are two approaches to setting up partitioning:

**Option 1: Fresh Database Setup**
```bash
# Run the partition setup script
pnpm audit-db:setup-partitions

# Or with a specific database URL
node scripts/setup-partitions.js "postgresql://user:password@localhost:5432/audit_db"
```

**Option 2: Migrate Existing Data**
```bash
# Run the migration SQL
psql -d your_audit_db -f src/db/migrations/convert-to-partitioned.sql
```

### Partitioning Benefits

1. **Query Performance**: Queries with timestamp filters only scan relevant partitions
2. **Maintenance Efficiency**: Easier to archive or delete old data by dropping entire partitions
3. **Parallel Operations**: Different partitions can be processed in parallel
4. **Storage Optimization**: Smaller indexes per partition improve performance

### Partition Management

The system includes automatic partition management through the `PartitionMaintenanceScheduler` class, which can be configured to:

- Automatically create new partitions
- Drop expired partitions based on retention policy
- Monitor partition performance and provide recommendations

```mermaid
sequenceDiagram
participant Scheduler as PartitionMaintenanceScheduler
participant Manager as DatabasePartitionManager
participant DB as Database
Scheduler->>Manager : performMaintenance()
Manager->>Manager : createAuditLogPartitions() if autoCreate enabled
Manager->>DB : CREATE TABLE ... PARTITION OF audit_log
Manager->>Manager : dropExpiredPartitions() if autoDrop enabled
Manager->>DB : DROP TABLE IF EXISTS audit_log_YYYY_MM
Manager->>Manager : analyzePartitionPerformance()
Manager->>Scheduler : Return performance statistics
Scheduler->>Console : Log maintenance results
```

**Diagram sources**
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts#L0-L496)
- [PARTITIONING.md](file://packages/audit-db/PARTITIONING.md#L0-L112)

**Section sources**
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts#L0-L496)
- [PARTITIONING.md](file://packages/audit-db/PARTITIONING.md#L0-L112)
- [convert-to-partitioned.sql](file://packages/audit-db/src/db/migrations/convert-to-partitioned.sql#L0-L65)

## Performance Optimizations

The audit database includes several performance optimization features to ensure efficient operation at scale.

### Connection Pooling

The `EnhancedConnectionPool` class in `packages/audit-db/src/db/connection-pool.ts` provides advanced connection pooling with monitoring and optimization features:

- Configurable minimum and maximum connections
- Connection idle and acquisition timeouts
- Connection validation and retry mechanisms
- Comprehensive statistics collection

```typescript
const config: ConnectionPoolConfig = {
  url: DATABASE_URL,
  minConnections: 2,
  maxConnections: 20,
  idleTimeout: 30000,
  acquireTimeout: 10000,
  validateConnections: true,
  retryAttempts: 3,
  retryDelay: 1000,
  ssl: true
}
```

### Query Caching

The system implements query result caching using an LRU (Least Recently Used) cache with TTL (Time To Live) support. The `EnhancedDatabaseClient` class integrates caching with connection pooling to provide optimized database access.

Cache configuration options:
- Enabled/disabled flag
- Maximum cache size in MB
- Default TTL for cached results
- Maximum number of queries to cache

### Index Optimization

The schema includes a comprehensive indexing strategy optimized for common query patterns:

- Single-column indexes on frequently filtered fields
- Composite indexes for multi-column queries
- GIN indexes on JSONB columns for efficient JSON querying
- Hash indexes for exact match queries

### Performance Monitoring

The `DatabasePerformanceMonitor` class provides tools for monitoring and analyzing database performance:

- Query execution time tracking
- Slow query identification
- Index usage analysis
- Table statistics monitoring
- Performance recommendations

```mermaid
flowchart TD
A[Database Operations] --> B{Query Type}
B --> |Simple| C[Direct Execution]
B --> |Complex| D[Check Cache]
D --> E{Cache Hit?}
E --> |Yes| F[Return Cached Result]
E --> |No| G[Execute Query]
G --> H[Store in Cache]
H --> I[Return Result]
C --> I
I --> J[Update Statistics]
J --> K[Performance Monitoring]
K --> L{Performance Issues?}
L --> |Yes| M[Generate Recommendations]
L --> |No| N[Continue]
```

**Diagram sources**
- [connection-pool.ts](file://packages/audit-db/src/db/connection-pool.ts#L0-L348)
- [PERFORMANCE_OPTIMIZATION.md](file://packages/audit-db/PERFORMANCE_OPTIMIZATION.md#L0-L354)

**Section sources**
- [connection-pool.ts](file://packages/audit-db/src/db/connection-pool.ts#L0-L348)
- [PERFORMANCE_OPTIMIZATION.md](file://packages/audit-db/PERFORMANCE_OPTIMIZATION.md#L0-L354)

## Backup, Restore and Disaster Recovery

The audit database requires a robust backup, restore, and disaster recovery strategy to ensure data integrity and availability.

### Backup Procedures

Regular backups should be performed using PostgreSQL's built-in tools:

**Logical Backup (Recommended for smaller databases):**
```bash
# Create a compressed backup of the audit database
pg_dump -h localhost -U postgres -d audit_db -F c -b -v -f audit_db_backup_$(date +%Y%m%d_%H%M%S).dump

# Create a SQL script backup
pg_dump -h localhost -U postgres -d audit_db -F p -f audit_db_backup_$(date +%Y%m%d_%H%M%S).sql
```

**Physical Backup (Recommended for larger databases):**
```bash
# Use pg_basebackup for physical replication
pg_basebackup -h localhost -D /backup/audit_db -F tar -z -P
```

### Backup Schedule

A comprehensive backup strategy should include:

- **Daily Full Backups**: Complete database backups
- **Hourly Incremental Backups**: WAL (Write-Ahead Log) archiving
- **Weekly Offsite Backups**: Copy backups to secure offsite location
- **Monthly Retention**: Keep monthly backups for long-term recovery

### Restore Procedures

**Restoring from Logical Backup:**
```bash
# Restore from custom format dump
pg_restore -h localhost -U postgres -d audit_db -v audit_db_backup.dump

# Restore from SQL script
psql -h localhost -U postgres -d audit_db -f audit_db_backup.sql
```

**Restoring from Physical Backup:**
```bash
# Extract and restore from tar backup
tar -xzf backup.tar.gz -C /var/lib/postgresql/data
```

### Disaster Recovery Planning

A comprehensive disaster recovery plan should include:

1. **Recovery Point Objective (RPO)**: Define acceptable data loss (e.g., 1 hour of data)
2. **Recovery Time Objective (RTO)**: Define acceptable downtime (e.g., 4 hours)
3. **Backup Verification**: Regularly test backup restoration
4. **Failover Strategy**: Plan for database failover to secondary instance
5. **Documentation**: Maintain up-to-date recovery procedures

### High Availability Setup

For critical environments, consider implementing high availability:

- **Streaming Replication**: Set up primary-standby replication
- **Connection Pooling**: Use PgBouncer for connection management
- **Load Balancing**: Distribute read queries across replicas
- **Automated Failover**: Use tools like Patroni for automatic failover

**Section sources**
- [README.md](file://packages/audit-db/README.md#L0-L107)
- [PERFORMANCE_OPTIMIZATION.md](file://packages/audit-db/PERFORMANCE_OPTIMIZATION.md#L0-L354)

## Common Initialization Issues

During database initialization, several common issues may arise. This section addresses the most frequent problems and their solutions.

### Permission Errors

**Issue**: "permission denied for database" or "must be superuser to create extensions"

**Solutions**:
- Ensure the database user has appropriate privileges
- Use a superuser account for initial setup
- Grant necessary permissions to the application user:

```sql
-- Grant connect privilege
GRANT CONNECT ON DATABASE audit_db TO audit_user;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO audit_user;

-- Grant CRUD privileges on tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO audit_user;

-- Grant usage on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO audit_user;
```

### Dependency Ordering

**Issue**: "relation does not exist" or "foreign key constraint violation"

**Solutions**:
- Ensure tables are created in the correct order (parent tables before child tables)
- Use transaction blocks to ensure atomic schema creation
- Verify that all required extensions are installed before creating dependent objects

### Charset Configuration

**Issue**: "character set mismatch" or "encoding issues with special characters"

**Solutions**:
- Use UTF-8 encoding for the database:
```sql
CREATE DATABASE audit_db 
WITH OWNER = postgres 
ENCODING = 'UTF8' 
LC_COLLATE = 'en_US.UTF-8' 
LC_CTYPE = 'en_US.UTF-8' 
TEMPLATE = template0;
```
- Ensure client applications use UTF-8 encoding
- Verify that all text fields are properly encoded

### Partitioning Issues

**Issue**: "SQL Error [42P17]: ERROR: 'audit_log' is not partitioned"

**Solutions**:
- Use the partition setup script: `pnpm audit-db:setup-partitions`
- Or run the migration SQL: `psql -d your_audit_db -f src/db/migrations/convert-to-partitioned.sql`
- Verify partitioning setup with:
```sql
SELECT schemaname, tablename, 
       CASE WHEN c.relkind = 'p' THEN 'partitioned' ELSE 'regular' END as table_type
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.tablename = 'audit_log';
```

### Migration Conflicts

**Issue**: "migration already applied" or "migration hash mismatch"

**Solutions**:
- Check the `_journal.json` file in the migrations directory
- Verify that the database schema matches the expected state
- If necessary, manually update the migration journal (use with caution)
- Always backup before resolving migration conflicts

**Section sources**
- [PARTITIONING.md](file://packages/audit-db/PARTITIONING.md#L0-L112)
- [MIGRATION_GUIDE.md](file://packages/audit-db/MIGRATION_GUIDE.md#L0-L184)
- [README.md](file://packages/audit-db/README.md#L0-L107)