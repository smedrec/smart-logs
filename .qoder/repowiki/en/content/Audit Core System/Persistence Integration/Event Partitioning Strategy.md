# Event Partitioning Strategy

<cite>
**Referenced Files in This Document**   
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts)
- [setup-partitions.js](file://packages/audit-db/scripts/setup-partitions.js)
- [setup-partitions.ts](file://packages/audit-db/src/db/setup-partitions.ts)
- [schema.ts](file://packages/audit-db/src/db/schema.ts)
- [convert-to-partitioned.sql](file://packages/audit-db/src/db/migrations/convert-to-partitioned.sql)
- [PARTITIONING.md](file://packages/audit-db/PARTITIONING.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Partitioning Rationale](#partitioning-rationale)
3. [Implementation Details](#implementation-details)
4. [Automation and Initialization](#automation-and-initialization)
5. [Schema Evolution and Query Optimization](#schema-evolution-and-query-optimization)
6. [Operational Guidance](#operational-guidance)
7. [Troubleshooting Common Issues](#troubleshooting-common-issues)

## Introduction
The Event Partitioning Strategy in audit-db implements a time-based partitioning system for audit log data to enhance query performance and manage large datasets efficiently. This document details the rationale, implementation, automation, and operational aspects of the partitioning strategy, focusing on monthly partitioning of the audit_log table.

**Section sources**
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts#L1-L50)
- [PARTITIONING.md](file://packages/audit-db/PARTITIONING.md#L1-L10)

## Partitioning Rationale
Time-based table partitioning, specifically monthly partitioning, is employed to address performance and maintenance challenges associated with large audit datasets. By dividing the audit_log table into smaller, time-specific partitions (e.g., audit_log_2025_08), the system achieves several benefits:

- **Improved Query Performance**: Queries with timestamp filters can leverage partition pruning, scanning only relevant partitions instead of the entire dataset.
- **Efficient Data Management**: Old data can be archived or deleted by dropping entire partitions, which is faster and less resource-intensive than row-by-row deletion.
- **Parallel Processing**: Different partitions can be processed in parallel for operations like backups, indexing, or analysis.
- **Storage Optimization**: Indexes are smaller and more efficient when created on individual partitions rather than the entire table.

The partitioning strategy is designed to handle the high volume of audit events while maintaining compliance with data retention policies.

**Section sources**
- [PARTITIONING.md](file://packages/audit-db/PARTITIONING.md#L70-L90)
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts#L1-L20)

## Implementation Details
The partitioning implementation is centered around the DatabasePartitionManager class in partitioning.ts, which handles the creation, management, and maintenance of partitions.

### DDL Generation and Attachment/Detachment Logic
The system uses PostgreSQL's native range partitioning on the timestamp column. The DatabasePartitionManager class provides methods to create and manage partitions:

```mermaid
classDiagram
class DatabasePartitionManager {
+createAuditLogPartitions(config)
+createPartition(tableName, partition)
+createPartitionIndexes(partitionName)
+calculatePartitionsNeeded(interval, retentionDays)
+dropExpiredPartitions(retentionDays)
+getPartitionInfo()
+analyzePartitionPerformance()
+initializePartitionedTable()
+createPartitionManagementFunctions()
}
class PartitionMaintenanceScheduler {
+start()
+stop()
+performMaintenance()
}
DatabasePartitionManager --> PartitionMaintenanceScheduler : "uses"
```

**Diagram sources**
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts#L45-L495)

**Section sources**
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts#L45-L495)

The `createAuditLogPartitions` method generates DDL for new partitions based on the specified interval (monthly, quarterly, or yearly). For monthly partitioning, it creates partitions named audit_log_YYYY_MM. The `createPartition` method executes the DDL to create a partition as a child table of audit_log with a specific date range.

The `initializePartitionedTable` method sets up the parent partitioned table and creates database functions for automated partition management:

```typescript
await this.db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_log (
        id serial,
        timestamp timestamp with time zone NOT NULL,
        ttl varchar(255),
        principal_id varchar(255),
        organization_id varchar(255),
        action varchar(255) NOT NULL,
        target_resource_type varchar(255),
        target_resource_id varchar(255),
        status varchar(50) NOT NULL,
        outcome_description text,
        hash varchar(64),
        hash_algorithm varchar(50) DEFAULT 'SHA-256',
        event_version varchar(20) DEFAULT '1.0',
        correlation_id varchar(255),
        data_classification varchar(20) DEFAULT 'INTERNAL',
        retention_policy varchar(50) DEFAULT 'standard',
        processing_latency integer,
        archived_at timestamp with time zone,
        details jsonb
    ) PARTITION BY RANGE (timestamp);
`)
```

**Section sources**
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts#L294-L325)
- [schema.ts](file://packages/audit-db/src/db/schema.ts#L60-L100)

The `createPartitionManagementFunctions` method creates PL/pgSQL functions for automated partition creation and cleanup:

```typescript
await this.db.execute(sql`
    CREATE OR REPLACE FUNCTION create_audit_log_partitions()
    RETURNS void AS $$$
    DECLARE
        start_date date;
        end_date date;
        partition_name text;
    BEGIN
        -- Create partitions for current month and next 6 months
        FOR i IN 0..6 LOOP
            start_date := date_trunc('month', CURRENT_DATE + (i || ' months')::interval);
            end_date := start_date + interval '1 month';
            partition_name := 'audit_log_' || to_char(start_date, 'YYYY_MM');
            
            -- Create partition if it doesn't exist
            EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date);
        END LOOP;
    END;
    $$ LANGUAGE plpgsql;
`)
```

**Section sources**
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts#L330-L360)

## Automation and Initialization
The partitioning setup is automated through scripts that can be run during deployment or initialization.

### setup-partitions.js and setup-partitions.ts
The setup-partitions.js script is a CLI tool that initializes partitioning for the audit_log table. It imports the setupPartitions function from setup-partitions.ts and executes it with the provided PostgreSQL URL.

```mermaid
sequenceDiagram
participant CLI as setup-partitions.js
participant Setup as setup-partitions.ts
participant Manager as DatabasePartitionManager
participant DB as PostgreSQL
CLI->>Setup : setupPartitions(postgresUrl)
Setup->>Manager : new DatabasePartitionManager(db)
Manager->>DB : initializePartitionedTable()
DB-->>Manager : Table created
Manager->>DB : createPartitionManagementFunctions()
DB-->>Manager : Functions created
Manager->>DB : SELECT create_audit_log_partitions()
DB-->>Manager : Partitions created
Manager-->>Setup : Success
Setup-->>CLI : Success
```

**Diagram sources**
- [setup-partitions.js](file://packages/audit-db/scripts/setup-partitions.js#L1-L30)
- [setup-partitions.ts](file://packages/audit-db/src/db/setup-partitions.ts#L1-L50)

**Section sources**
- [setup-partitions.js](file://packages/audit-db/scripts/setup-partitions.js#L1-L30)
- [setup-partitions.ts](file://packages/audit-db/src/db/setup-partitions.ts#L1-L50)

The setupPartitions function in setup-partitions.ts orchestrates the initialization process:

```typescript
export async function setupPartitions(postgresUrl?: string): Promise<void> {
    const auditDb = new AuditDb(postgresUrl)
    const db = auditDb.getDrizzleInstance()
    const partitionManager = new DatabasePartitionManager(db)

    try {
        console.log('🔧 Setting up partitioned audit_log table...')

        // Initialize the partitioned table and functions
        await partitionManager.initializePartitionedTable()

        console.log('✅ Partitioned audit_log table setup complete!')
        console.log('📊 Getting partition info...')

        // Show partition information
        const partitionInfo = await partitionManager.getPartitionInfo()
        console.log(`📈 Created ${partitionInfo.length} partitions:`)
        partitionInfo.forEach((partition) => {
            console.log(`  - ${partition.partitionName}: ${partition.partitionExpression}`)
        })
    } catch (error) {
        console.error('❌ Failed to setup partitions:', error)
        throw error
    } finally {
        await auditDb.end()
    }
}
```

**Section sources**
- [setup-partitions.ts](file://packages/audit-db/src/db/setup-partitions.ts#L1-L50)

For existing databases with data, the convert-to-partitioned.sql migration script handles the conversion:

```sql
-- Step 1: Rename existing table
ALTER TABLE audit_log RENAME TO audit_log_old;

-- Step 2: Create new partitioned table with same structure
CREATE TABLE audit_log (
    -- Same columns as before
) PARTITION BY RANGE (timestamp);

-- Step 3: Create initial partitions
SELECT create_audit_log_partitions();

-- Step 4: Copy data from old table to new partitioned table
INSERT INTO audit_log SELECT * FROM audit_log_old;

-- Step 5: Recreate indexes
-- ... index creation statements

-- Step 6: Drop old table (after verification)
-- DROP TABLE audit_log_old;
```

**Section sources**
- [convert-to-partitioned.sql](file://packages/audit-db/src/db/migrations/convert-to-partitioned.sql#L1-L65)

## Schema Evolution and Query Optimization
The partitioning strategy is designed to accommodate schema evolution while maintaining query performance.

### Schema Definition
The audit_log table schema, defined in schema.ts, includes fields essential for audit logging and compliance:

```typescript
export const auditLog = pgTable(
    'audit_log',
    {
        id: serial('id'),
        timestamp: timestamp('timestamp', { withTimezone: true, mode: 'string' }).notNull(),
        ttl: varchar('ttl', { length: 255 }),
        principalId: varchar('principal_id', { length: 255 }),
        organizationId: varchar('organization_id', { length: 255 }),
        action: varchar('action', { length: 255 }).notNull(),
        targetResourceType: varchar('target_resource_type', { length: 255 }),
        targetResourceId: varchar('target_resource_id', { length: 255 }),
        status: varchar('status', { length: 50 })
            .$type<AuditEventStatus>()
            .notNull(),
        outcomeDescription: text('outcome_description'),
        hash: varchar('hash', { length: 64 }),
        hashAlgorithm: varchar('hash_algorithm', { length: 50 }).default('SHA-256'),
        eventVersion: varchar('event_version', { length: 20 }).default('1.0'),
        correlationId: varchar('correlation_id', { length: 255 }),
        dataClassification: varchar('data_classification', { length: 20 })
            .$type<DataClassification>()
            .default('INTERNAL'),
        retentionPolicy: varchar('retention_policy', { length: 50 }).default('standard'),
        processingLatency: integer('processing_latency'),
        archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
        details: jsonb('details'),
    },
    // Indexes defined here
)
```

**Section sources**
- [schema.ts](file://packages/audit-db/src/db/schema.ts#L60-L150)

### Query Optimization
The system creates optimized indexes on each partition to support common query patterns:

```typescript
private async createPartitionIndexes(partitionName: string): Promise<void> {
    const indexes = [
        // Primary performance indexes
        `CREATE INDEX IF NOT EXISTS ${partitionName}_id_idx ON ${partitionName} (id)`,
        `CREATE INDEX IF NOT EXISTS ${partitionName}_timestamp_idx ON ${partitionName} (timestamp)`,
        `CREATE INDEX IF NOT EXISTS ${partitionName}_principal_id_idx ON ${partitionName} (principal_id)`,
        `CREATE INDEX IF NOT EXISTS ${partitionName}_organization_id_idx ON ${partitionName} (organization_id)`,
        `CREATE INDEX IF NOT EXISTS ${partitionName}_action_idx ON ${partitionName} (action)`,
        `CREATE INDEX IF NOT EXISTS ${partitionName}_status_idx ON ${partitionName} (status)`,

        // Compliance query indexes
        `CREATE INDEX IF NOT EXISTS ${partitionName}_data_classification_idx ON ${partitionName} (data_classification)`,
        `CREATE INDEX IF NOT EXISTS ${partitionName}_retention_policy_idx ON ${partitionName} (retention_policy)`,
        `CREATE INDEX IF NOT EXISTS ${partitionName}_correlation_id_idx ON ${partitionName} (correlation_id)`,

        // Composite indexes for common query patterns
        `CREATE INDEX IF NOT EXISTS ${partitionName}_org_timestamp_idx ON ${partitionName} (organization_id, timestamp)`,
        `CREATE INDEX IF NOT EXISTS ${partitionName}_principal_action_idx ON ${partitionName} (principal_id, action)`,
        `CREATE INDEX IF NOT EXISTS ${partitionName}_classification_retention_idx ON ${partitionName} (data_classification, retention_policy)`,
        `CREATE INDEX IF NOT EXISTS ${partitionName}_resource_type_id_idx ON ${partitionName} (target_resource_type, target_resource_id)`,

        // Hash index for integrity verification
        `CREATE INDEX IF NOT EXISTS ${partitionName}_hash_idx ON ${partitionName} USING hash (hash)`,

        // JSONB indexes for details column
        `CREATE INDEX IF NOT EXISTS ${partitionName}_details_gin_idx ON ${partitionName} USING gin (details)`,
    ]

    for (const indexSql of indexes) {
        try {
            await this.db.execute(sql.raw(indexSql))
        } catch (error) {
            console.warn(`Failed to create index: ${indexSql}`, error)
        }
    }
}
```

**Section sources**
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts#L80-L130)

These indexes ensure that queries filtering by organization, principal, action, status, or timestamp are efficient. The composite indexes support multi-column queries commonly used in compliance reporting.

## Operational Guidance
### Monitoring Partition Health
The system provides methods to monitor partition health and performance:

```typescript
async getPartitionInfo(): Promise<PartitionInfo[]> {
    const result = await this.db.execute(sql`
        SELECT 
            t.schemaname,
            t.tablename,
            'RANGE' as partition_type,
            pg_get_expr(c.relpartbound, c.oid) as partition_expression,
            obj_description(c.oid) as description,
            pg_total_relation_size(c.oid) as size_bytes,
            (SELECT reltuples::bigint FROM pg_class WHERE relname = t.tablename) as record_count
        FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE t.tablename LIKE 'audit_log_%'
        AND t.schemaname = 'public'
        AND c.relispartition = true
        ORDER BY t.tablename
    `)

    return result.map((row) => ({
        tableName: 'audit_log',
        partitionName: row.tablename as string,
        partitionType: row.partition_type as string,
        partitionExpression: row.partition_expression as string,
        createdAt: new Date(),
        recordCount: Number(row.record_count) || 0,
        sizeBytes: Number(row.size_bytes) || 0,
    }))
}
```

**Section sources**
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts#L206-L252)

### Handling Partition Rotation
Partition rotation is automated through the PartitionMaintenanceScheduler:

```typescript
private async performMaintenance(): Promise<void> {
    if (this.config.autoCreatePartitions) {
        await this.partitionManager.createAuditLogPartitions({
            strategy: 'range',
            partitionColumn: 'timestamp',
            interval: 'monthly',
            retentionDays: this.config.retentionDays,
        })
    }

    if (this.config.autoDropPartitions) {
        const droppedPartitions = await this.partitionManager.dropExpiredPartitions(
            this.config.retentionDays
        )
        if (droppedPartitions.length > 0) {
            console.log(`Dropped expired partitions: ${droppedPartitions.join(', ')}`)
        }
    }

    // Log partition statistics
    const stats = await this.partitionManager.analyzePartitionPerformance()
    console.log('Partition statistics:', {
        totalPartitions: stats.totalPartitions,
        totalSizeGB: (stats.totalSize / (1024 * 1024 * 1024)).toFixed(2),
        totalRecords: stats.totalRecords,
        recommendations: stats.recommendations,
    })
}
```

**Section sources**
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts#L455-L495)

The scheduler runs at regular intervals to create new partitions and drop expired ones based on the retention policy.

## Troubleshooting Common Issues
### Missing Partitions
If partitions are missing, verify that the partitioning setup was completed:

```bash
# Run the setup script
node scripts/setup-partitions.js "postgresql://user:password@localhost:5432/audit_db"

# Or use pnpm script
pnpm audit-db:setup-partitions
```

Check if the audit_log table is partitioned:

```sql
SELECT
    schemaname,
    tablename,
    CASE WHEN c.relkind = 'p' THEN 'partitioned' ELSE 'regular' END as table_type
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.tablename = 'audit_log'
AND t.schemaname = 'public';
```

**Section sources**
- [PARTITIONING.md](file://packages/audit-db/PARTITIONING.md#L95-L104)

### Incorrect Routing
If data is not being routed to the correct partitions, ensure that the partitioning functions are properly created:

```sql
-- Check that the partition management functions exist
\df create_audit_log_partitions
\df drop_old_audit_partitions
\df get_audit_partition_stats

-- Manually create a partition if needed
CREATE TABLE audit_log_2025_08 PARTITION OF audit_log
FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
```

**Section sources**
- [PARTITIONING.md](file://packages/audit-db/PARTITIONING.md#L105-L112)

### Performance Issues
If query performance is suboptimal, analyze partition performance:

```typescript
const stats = await partitionManager.analyzePartitionPerformance()
console.log('Partition statistics:', stats)
```

This will provide recommendations for optimization, such as increasing the partition interval or cleaning up empty partitions.

**Section sources**
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts#L254-L292)