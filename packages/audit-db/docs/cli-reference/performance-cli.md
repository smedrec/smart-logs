# Performance CLI Reference

The `audit-db-performance` command-line tool provides advanced performance monitoring, optimization, and management capabilities for the audit database.

## Installation

The performance CLI is included with the `@repo/audit-db` package:

```bash
# CLI available as
audit-db-performance --help
```

## Global Options

All commands support these global options:

```bash
--config <file>     Configuration file path
--verbose           Enable verbose output
--json              Output in JSON format
--no-color          Disable colored output
--timeout <ms>      Operation timeout (default: 30000)
```

## Monitoring Commands

### `monitor summary`

Display a comprehensive performance summary.

```bash
audit-db-performance monitor summary [options]

Options:
  --refresh <seconds>   Auto-refresh interval (0 to disable)
  --format <format>     Output format: table, json, csv (default: table)
  --include <metrics>   Specific metrics: queries,cache,pool,partitions
```

**Examples:**

```bash
# Basic summary
audit-db-performance monitor summary

# Auto-refresh every 5 seconds
audit-db-performance monitor summary --refresh 5

# JSON output for automation
audit-db-performance monitor summary --json
```

**Sample Output:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Performance Summary                      │
├─────────────────────────────────────────────────────────────┤
│ Database Status:          ✅ Healthy                        │
│ Average Query Time:       12ms                             │
│ Active Connections:       8/20                             │
│ Cache Hit Rate:          89.2%                             │
│ Slow Queries (1h):       3                                │
│ Partition Efficiency:    94.5%                             │
└─────────────────────────────────────────────────────────────┘
```

### `monitor slow-queries`

Analyze and display slow queries.

```bash
audit-db-performance monitor slow-queries [options]

Options:
  --threshold <ms>      Slow query threshold (default: 1000)
  --limit <number>      Number of queries to show (default: 10)
  --period <duration>   Time period: 1h, 24h, 7d (default: 1h)
  --order <field>       Sort by: time, calls, mean_time (default: mean_time)
```

**Examples:**

```bash
# Show top 10 slow queries
audit-db-performance monitor slow-queries

# Custom threshold and limit
audit-db-performance monitor slow-queries --threshold 500 --limit 20

# Last 24 hours, sorted by call count
audit-db-performance monitor slow-queries --period 24h --order calls
```

**Sample Output:**
```json
{
  "slowQueries": [
    {
      "query": "SELECT * FROM audit_log WHERE metadata->>'department' = $1",
      "calls": 156,
      "meanTime": 2340,
      "totalTime": 365040,
      "stddev": 890,
      "firstSeen": "2024-01-15T08:30:00Z",
      "lastSeen": "2024-01-15T10:45:00Z"
    }
  ],
  "recommendations": [
    "Consider adding an index on (metadata->>'department')",
    "Review query pattern for optimization opportunities"
  ]
}
```

### `monitor indexes`

Display index usage statistics and recommendations.

```bash
audit-db-performance monitor indexes [options]

Options:
  --table <name>        Specific table name
  --unused             Show only unused indexes
  --recommendations    Include optimization recommendations
```

**Examples:**

```bash
# All index statistics
audit-db-performance monitor indexes

# Unused indexes only
audit-db-performance monitor indexes --unused

# With recommendations
audit-db-performance monitor indexes --recommendations
```

### `monitor tables`

Show table statistics and health information.

```bash
audit-db-performance monitor tables [options]

Options:
  --size              Sort by table size
  --activity          Sort by activity level
  --maintenance       Show maintenance status
```

## Partition Management

### `partition create`

Create new database partitions.

```bash
audit-db-performance partition create [options]

Options:
  --table <name>        Table name (default: audit_log)
  --start-date <date>   Partition start date (ISO format)
  --end-date <date>     Partition end date (ISO format)
  --interval <period>   Partition interval: daily, weekly, monthly
  --dry-run            Show what would be created without executing
```

**Examples:**

```bash
# Create next month's partition
audit-db-performance partition create --interval monthly

# Create specific date range
audit-db-performance partition create \
  --start-date 2024-02-01 \
  --end-date 2024-03-01

# Dry run to preview
audit-db-performance partition create --dry-run --interval daily
```

### `partition list`

List existing partitions with statistics.

```bash
audit-db-performance partition list [options]

Options:
  --table <name>        Filter by table name
  --active             Show only active partitions
  --stats              Include detailed statistics
  --format <format>    Output format: table, json, csv
```

### `partition analyze`

Analyze partition performance and efficiency.

```bash
audit-db-performance partition analyze [options]

Options:
  --table <name>        Analyze specific table
  --recommendations    Include optimization recommendations
  --detail             Show detailed analysis
```

**Sample Output:**
```json
{
  "analysis": {
    "totalPartitions": 12,
    "activePartitions": 8,
    "efficiency": 94.5,
    "recommendations": [
      "Consider dropping partition audit_log_2023_01 (no recent access)",
      "Partition audit_log_2024_01 is approaching size limit"
    ]
  },
  "partitions": [
    {
      "name": "audit_log_2024_01",
      "size": "2.3GB",
      "records": 1250000,
      "efficiency": 89.2,
      "lastAccess": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### `partition cleanup`

Clean up old or unused partitions.

```bash
audit-db-performance partition cleanup [options]

Options:
  --dry-run            Show what would be cleaned without executing
  --retention <days>   Retention period in days (default: 2555)
  --force              Force cleanup without confirmation
  --backup             Create backup before cleanup
```

## Client Management

### `client health`

Check health status of enhanced audit clients.

```bash
audit-db-performance client health [options]

Options:
  --all               Check all client instances
  --format <format>   Output format: table, json, summary
  --watch             Continuous monitoring mode
```

**Examples:**

```bash
# Basic health check
audit-db-performance client health

# Continuous monitoring
audit-db-performance client health --watch

# JSON output for monitoring systems
audit-db-performance client health --json
```

### `client report`

Generate comprehensive performance report.

```bash
audit-db-performance client report [options]

Options:
  --period <duration>   Report period: 1h, 24h, 7d, 30d (default: 24h)
  --output <file>       Save report to file
  --format <format>     Report format: json, html, pdf (default: json)
  --include <sections>  Sections: performance, cache, errors, recommendations
```

**Examples:**

```bash
# 24-hour performance report
audit-db-performance client report --period 24h

# Comprehensive report with all sections
audit-db-performance client report \
  --period 7d \
  --format html \
  --output weekly-report.html \
  --include performance,cache,errors,recommendations
```

### `client optimize`

Execute automatic performance optimization.

```bash
audit-db-performance client optimize [options]

Options:
  --dry-run            Show optimization plan without executing
  --type <types>       Optimization types: indexes, cache, pool, vacuum
  --aggressive         Enable aggressive optimization (use with caution)
  --schedule           Schedule optimization for off-peak hours
```

**Examples:**

```bash
# Basic optimization
audit-db-performance client optimize

# Preview optimization plan
audit-db-performance client optimize --dry-run

# Index optimization only
audit-db-performance client optimize --type indexes

# Aggressive optimization (production use with caution)
audit-db-performance client optimize --aggressive
```

## Configuration Commands

### `config show`

Display current performance configuration.

```bash
audit-db-performance config show [options]

Options:
  --section <name>     Show specific section: pool, cache, monitoring
  --format <format>    Output format: json, yaml, table
```

### `config validate`

Validate performance configuration.

```bash
audit-db-performance config validate [options]

Options:
  --file <path>        Configuration file to validate
  --strict            Enable strict validation mode
  --recommendations   Include configuration recommendations
```

### `config tune`

Auto-tune configuration based on current workload.

```bash
audit-db-performance config tune [options]

Options:
  --workload <type>    Workload type: read-heavy, write-heavy, mixed
  --environment <env>  Environment: development, staging, production
  --apply             Apply tuned configuration automatically
  --backup            Backup current configuration before applying
```

## Maintenance Commands

### `maintenance vacuum`

Execute database maintenance operations.

```bash
audit-db-performance maintenance vacuum [options]

Options:
  --table <name>       Specific table name
  --analyze           Include ANALYZE operation
  --full              Full vacuum (use with caution)
  --schedule          Schedule for off-peak hours
```

### `maintenance reindex`

Rebuild database indexes.

```bash
audit-db-performance maintenance reindex [options]

Options:
  --table <name>       Specific table name
  --concurrent        Use concurrent reindexing
  --unused            Rebuild only unused indexes
  --schedule          Schedule for off-peak hours
```

## Automation Examples

### Performance Monitoring Script

```bash
#!/bin/bash
# monitor-performance.sh

# Set thresholds
SLOW_QUERY_THRESHOLD=1000
CACHE_HIT_THRESHOLD=80
CONNECTION_THRESHOLD=80

# Check performance metrics
METRICS=$(audit-db-performance monitor summary --json)

# Extract key metrics
AVG_QUERY_TIME=$(echo $METRICS | jq '.averageQueryTime')
CACHE_HIT_RATE=$(echo $METRICS | jq '.cacheHitRate * 100')
CONNECTION_USAGE=$(echo $METRICS | jq '.connectionPoolUtilization * 100')

# Check thresholds and alert if needed
if (( $(echo "$AVG_QUERY_TIME > $SLOW_QUERY_THRESHOLD" | bc -l) )); then
    echo "ALERT: Average query time too high: ${AVG_QUERY_TIME}ms"
    audit-db-performance monitor slow-queries --limit 5
fi

if (( $(echo "$CACHE_HIT_RATE < $CACHE_HIT_THRESHOLD" | bc -l) )); then
    echo "ALERT: Cache hit rate too low: ${CACHE_HIT_RATE}%"
fi

if (( $(echo "$CONNECTION_USAGE > $CONNECTION_THRESHOLD" | bc -l) )); then
    echo "ALERT: High connection pool usage: ${CONNECTION_USAGE}%"
fi
```

### Daily Optimization Script

```bash
#!/bin/bash
# daily-optimize.sh

echo "🔧 Starting daily optimization..."

# Health check first
if ! audit-db-performance client health --json | jq -e '.status == "healthy"' > /dev/null; then
    echo "❌ System unhealthy, skipping optimization"
    exit 1
fi

# Generate performance report
audit-db-performance client report \
    --period 24h \
    --output "reports/daily-$(date +%Y%m%d).json"

# Run optimization if needed
OPTIMIZATION_NEEDED=$(audit-db-performance client report --json | jq '.needsOptimization')

if [ "$OPTIMIZATION_NEEDED" = "true" ]; then
    echo "🔧 Running optimization..."
    audit-db-performance client optimize --type indexes,cache
    echo "✅ Optimization completed"
else
    echo "✅ No optimization needed"
fi

# Cleanup old partitions
audit-db-performance partition cleanup --dry-run

echo "✅ Daily optimization completed"
```

### Partition Management Script

```bash
#!/bin/bash
# manage-partitions.sh

# Create next month's partition
NEXT_MONTH=$(date -d "next month" +%Y-%m-01)
audit-db-performance partition create \
    --start-date $NEXT_MONTH \
    --interval monthly

# Analyze partition efficiency
EFFICIENCY=$(audit-db-performance partition analyze --json | jq '.efficiency')

if (( $(echo "$EFFICIENCY < 90" | bc -l) )); then
    echo "⚠️  Partition efficiency low: ${EFFICIENCY}%"
    audit-db-performance partition analyze --recommendations
fi

# Cleanup old partitions (dry run first)
audit-db-performance partition cleanup --dry-run
```

## Configuration File

Create `.audit-performance.config.js`:

```javascript
module.exports = {
  monitoring: {
    slowQueryThreshold: 1000,
    refreshInterval: 30000,
    enableAlerts: true
  },
  
  optimization: {
    autoOptimize: false,
    aggressiveMode: false,
    scheduleOptimization: '0 2 * * *' // 2 AM daily
  },
  
  partitioning: {
    retentionDays: 2555,
    autoCleanup: true,
    compressionThreshold: 90 // days
  },
  
  reporting: {
    defaultPeriod: '24h',
    format: 'json',
    includeRecommendations: true
  }
}
```

## Best Practices

### 1. Regular Monitoring

```bash
# Add to crontab for regular checks
0 */6 * * * /path/to/monitor-performance.sh
```

### 2. Scheduled Optimization

```bash
# Weekly optimization during low traffic
0 2 * * 0 audit-db-performance client optimize --type indexes
```

### 3. Partition Maintenance

```bash
# Monthly partition management
0 1 1 * * /path/to/manage-partitions.sh
```

### 4. Performance Baseline

```bash
# Establish baseline after deployment
audit-db-performance client report --period 7d --output baseline.json
```

This performance CLI provides comprehensive tools for monitoring and optimizing your audit database performance.