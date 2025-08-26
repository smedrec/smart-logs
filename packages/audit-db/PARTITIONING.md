# Audit Database Partitioning Setup

## Problem

If you're getting the error:

```
SQL Error [42P17]: ERROR: "audit_log" is not partitioned
```

This means your `audit_log` table was created as a regular table instead of a partitioned table.

## Solution

### Option 1: Fresh Database Setup (Recommended)

If you don't have existing data or can recreate your database:

1. **Run the partition setup script:**

   ```bash
   # From the audit-db package directory
   pnpm audit-db:setup-partitions

   # Or with a specific database URL
   node scripts/setup-partitions.js "postgresql://user:password@localhost:5432/audit_db"
   ```

2. **Verify the setup:**
   ```bash
   # Check that partitions were created
   pnpm audit-db:partition-analyze
   ```

### Option 2: Migrate Existing Data

If you have existing data in the `audit_log` table:

1. **Run the migration SQL:**

   ```bash
   # Connect to your database and run the migration
   psql -d your_audit_db -f src/db/migrations/convert-to-partitioned.sql
   ```

2. **Verify the migration:**
   ```sql
   -- Check that the table is now partitioned
   SELECT
       schemaname,
       tablename,
       pg_get_expr(c.relpartbound, c.oid) as partition_expression
   FROM pg_tables t
   JOIN pg_class c ON c.relname = t.tablename
   WHERE t.tablename LIKE 'audit_log%'
   AND t.schemaname = 'public'
   ORDER BY t.tablename;
   ```

## How Partitioning Works

The audit_log table is partitioned by timestamp using monthly ranges:

- **Partition Strategy**: Range partitioning by `timestamp` column
- **Partition Interval**: Monthly (e.g., `audit_log_2025_08`, `audit_log_2025_09`)
- **Auto-creation**: Partitions are automatically created for current month + 6 months ahead
- **Retention**: Old partitions can be automatically dropped based on retention policy

## Benefits

1. **Query Performance**: Queries with timestamp filters only scan relevant partitions
2. **Maintenance**: Easier to archive/delete old data by dropping entire partitions
3. **Parallel Operations**: Different partitions can be processed in parallel
4. **Storage Optimization**: Indexes are smaller per partition

## Maintenance

The system includes automatic partition management:

- **Auto-creation**: New partitions are created monthly
- **Auto-cleanup**: Old partitions are dropped based on retention policy
- **Monitoring**: Partition statistics and health monitoring

## Troubleshooting

### Check if table is partitioned:

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

### List existing partitions:

```sql
SELECT create_audit_log_partitions();
SELECT * FROM get_audit_partition_stats();
```

### Manual partition creation:

```sql
-- Create partition for specific month
CREATE TABLE audit_log_2025_08 PARTITION OF audit_log
FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
```
