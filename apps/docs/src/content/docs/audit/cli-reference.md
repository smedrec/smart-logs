---
title: CLI Reference
description: Command Line Interface tools and utilities for @repo/audit-db.
---

# CLI Reference

The @repo/audit-db package provides a comprehensive set of command-line tools for database management, maintenance, and monitoring. These tools are designed for healthcare environments requiring high availability and compliance.

## Installation and Setup

### Global Installation

```bash
# Install CLI tools globally
npm install -g @repo/audit-db-cli

# Or use with npx
npx @repo/audit-db-cli --help
```

### Local Project Installation

```bash
# Install as dev dependency
npm install --save-dev @repo/audit-db-cli

# Add scripts to package.json
{
  "scripts": {
    "audit:setup": "audit-db setup",
    "audit:migrate": "audit-db migrate",
    "audit:backup": "audit-db backup",
    "audit:restore": "audit-db restore"
  }
}
```

### Environment Configuration

```bash
# Required environment variables
export AUDIT_DB_URL="postgresql://user:pass@localhost:5432/audit_db"
export AUDIT_REDIS_URL="redis://localhost:6379"
export AUDIT_CRYPTO_SECRET="your-256-bit-secret-key"

# Optional environment variables
export AUDIT_CLI_LOG_LEVEL="info"
export AUDIT_CLI_CONFIG_PATH="./audit-config.json"
export AUDIT_BACKUP_PATH="/var/backups/audit"
```

## Core Commands

### setup

Initialize the audit database schema and configuration.

```bash
# Basic setup
audit-db setup

# Setup with custom configuration
audit-db setup --config ./custom-config.json

# Setup with specific environment
audit-db setup --env production

# Dry run (show what would be created)
audit-db setup --dry-run
```

**Options:**
- `--config, -c`: Path to configuration file
- `--env, -e`: Environment (development, staging, production)
- `--dry-run`: Show operations without executing
- `--force`: Force setup even if database exists
- `--verbose, -v`: Verbose output

**Examples:**

```bash
# Development environment setup
audit-db setup --env development --verbose

# Production setup with custom config
audit-db setup --env production --config ./prod-config.json

# Force recreation of existing schema
audit-db setup --force --env staging
```

### migrate

Run database migrations to update schema.

```bash
# Run all pending migrations
audit-db migrate

# Run specific migration
audit-db migrate --target 20240115001_add_compliance_fields

# Rollback last migration
audit-db migrate --rollback

# Show migration status
audit-db migrate --status
```

**Options:**
- `--target, -t`: Specific migration to run
- `--rollback, -r`: Rollback last migration
- `--status, -s`: Show migration status
- `--dry-run`: Preview migrations without executing

**Examples:**

```bash
# Check current migration status
audit-db migrate --status

# Run migrations up to specific version
audit-db migrate --target 20240115003_add_partitioning

# Rollback and show what would be reverted
audit-db migrate --rollback --dry-run
```

### backup

Create database backups with healthcare-compliant encryption.

```bash
# Create full backup
audit-db backup

# Create backup with custom name
audit-db backup --name "pre-migration-backup"

# Create encrypted backup
audit-db backup --encrypt --key-file ./backup.key

# Create compressed backup
audit-db backup --compress gzip
```

**Options:**
- `--name, -n`: Custom backup name
- `--encrypt, -e`: Encrypt backup
- `--key-file`: Path to encryption key file
- `--compress`: Compression type (gzip, bzip2, none)
- `--output, -o`: Output directory
- `--include-redis`: Include Redis data
- `--exclude-table`: Exclude specific tables

**Examples:**

```bash
# Full encrypted backup for compliance
audit-db backup --encrypt --key-file ./hipaa-key.pem --name "monthly-backup"

# Backup excluding temporary tables
audit-db backup --exclude-table temp_audit_cache --compress gzip

# Backup with Redis data included
audit-db backup --include-redis --output /secure/backups/
```

### restore

Restore database from backup.

```bash
# Restore latest backup
audit-db restore

# Restore specific backup
audit-db restore --backup backup-20240115-120000.sql

# Restore encrypted backup
audit-db restore --backup encrypted-backup.sql.enc --key-file ./backup.key

# Restore to different database
audit-db restore --target-db audit_restore
```

**Options:**
- `--backup, -b`: Specific backup file
- `--key-file`: Decryption key file
- `--target-db`: Target database name
- `--confirm`: Skip confirmation prompt
- `--partial`: Restore specific tables only

**Examples:**

```bash
# Restore production backup to staging
audit-db restore --backup prod-backup.sql --target-db audit_staging

# Restore encrypted backup
audit-db restore --backup hipaa-backup.enc --key-file ./hipaa-key.pem --confirm
```

## Database Management

### schema

Manage database schema operations.

```bash
# Generate schema documentation
audit-db schema --docs

# Validate current schema
audit-db schema --validate

# Export schema DDL
audit-db schema --export schema.sql

# Compare schemas
audit-db schema --compare production staging
```

**Options:**
- `--docs`: Generate schema documentation
- `--validate`: Validate schema integrity
- `--export`: Export schema to file
- `--compare`: Compare two schemas
- `--format`: Output format (sql, json, markdown)

### partition

Manage database partitioning for large audit datasets.

```bash
# Create monthly partitions
audit-db partition --create-monthly --months 12

# Create partitions for specific date range
audit-db partition --create --start 2024-01-01 --end 2024-12-31

# Drop old partitions
audit-db partition --drop-before 2023-01-01

# List current partitions
audit-db partition --list
```

**Options:**
- `--create-monthly`: Create monthly partitions
- `--create-weekly`: Create weekly partitions
- `--months`: Number of months to create
- `--start`: Start date for partition range
- `--end`: End date for partition range
- `--drop-before`: Drop partitions before date
- `--list`: List current partitions

**Examples:**

```bash
# Setup annual partitioning
audit-db partition --create-monthly --months 12 --start 2024-01-01

# Clean up old partitions (keeping 7 years for HIPAA)
audit-db partition --drop-before 2017-01-01

# Create weekly partitions for high-volume periods
audit-db partition --create-weekly --start 2024-06-01 --end 2024-08-31
```

### index

Manage database indexes for optimal performance.

```bash
# Analyze and suggest indexes
audit-db index --analyze

# Create recommended indexes
audit-db index --create-recommended

# Drop unused indexes
audit-db index --drop-unused

# Rebuild fragmented indexes
audit-db index --rebuild
```

**Options:**
- `--analyze`: Analyze query patterns and suggest indexes
- `--create-recommended`: Create suggested indexes
- `--drop-unused`: Remove unused indexes
- `--rebuild`: Rebuild fragmented indexes
- `--report`: Generate index usage report

## Monitoring and Analytics

### monitor

Real-time monitoring of audit database performance.

```bash
# Start interactive monitoring
audit-db monitor

# Monitor specific metrics
audit-db monitor --metrics connections,queries,cache

# Export monitoring data
audit-db monitor --export --duration 24h --format json

# Set up alerting
audit-db monitor --alerts --config alerts.json
```

**Options:**
- `--metrics`: Specific metrics to monitor
- `--export`: Export monitoring data
- `--duration`: Monitoring duration
- `--format`: Export format (json, csv, prometheus)
- `--alerts`: Enable alerting
- `--threshold`: Set alert thresholds

**Examples:**

```bash
# Monitor database health for 1 hour
audit-db monitor --duration 1h --export health-report.json

# Monitor with custom alert thresholds
audit-db monitor --alerts --threshold "cpu>80,memory>90,connections>200"
```

### analytics

Generate analytics reports for audit data.

```bash
# Generate compliance report
audit-db analytics --compliance --regulation HIPAA --period monthly

# Generate performance report
audit-db analytics --performance --start 2024-01-01 --end 2024-01-31

# Generate security analytics
audit-db analytics --security --anomalies --output security-report.pdf

# Generate user activity report
audit-db analytics --user-activity --user-id user-123
```

**Options:**
- `--compliance`: Generate compliance reports
- `--performance`: Generate performance analytics
- `--security`: Generate security analytics
- `--user-activity`: Generate user activity reports
- `--regulation`: Compliance regulation (HIPAA, GDPR, SOX)
- `--period`: Report period (daily, weekly, monthly)
- `--anomalies`: Include anomaly detection
- `--output`: Output file path

### health

Check database and system health.

```bash
# Full health check
audit-db health

# Quick health check
audit-db health --quick

# Health check with recommendations
audit-db health --recommendations

# Health check in CI/CD
audit-db health --ci --exit-code
```

**Options:**
- `--quick`: Perform quick health check
- `--recommendations`: Include optimization recommendations
- `--ci`: CI/CD friendly output
- `--exit-code`: Exit with error code on issues
- `--json`: JSON output format

## Data Operations

### export

Export audit data in various formats.

```bash
# Export all data to JSON
audit-db export --format json --output audit-data.json

# Export specific date range
audit-db export --start 2024-01-01 --end 2024-01-31 --format csv

# Export with filters
audit-db export --action "fhir.patient.*" --status success --format xml

# Export for compliance audit
audit-db export --compliance --regulation HIPAA --encrypted
```

**Options:**
- `--format`: Export format (json, csv, xml, xlsx)
- `--start`: Start date filter
- `--end`: End date filter
- `--action`: Action pattern filter
- `--status`: Status filter
- `--principal-id`: User ID filter
- `--compliance`: Include compliance metadata
- `--encrypted`: Encrypt exported data

### import

Import audit data from external sources.

```bash
# Import from JSON file
audit-db import --file audit-data.json --format json

# Import with validation
audit-db import --file data.csv --format csv --validate

# Import from another database
audit-db import --source postgresql://source-db:5432/audit --migrate

# Import legacy data with transformation
audit-db import --file legacy.xml --transform legacy-transform.js
```

**Options:**
- `--file`: Input file path
- `--format`: Input format (json, csv, xml)
- `--validate`: Validate data before import
- `--source`: Source database URL
- `--migrate`: Migrate schema during import
- `--transform`: Data transformation script
- `--batch-size`: Import batch size

### cleanup

Clean up audit data based on retention policies.

```bash
# Clean based on retention policies
audit-db cleanup --apply-retention

# Preview cleanup operations
audit-db cleanup --dry-run --show-affected

# Clean specific data types
audit-db cleanup --data-type system --older-than 90d

# Emergency cleanup for storage
audit-db cleanup --emergency --free-space 50GB
```

**Options:**
- `--apply-retention`: Apply configured retention policies
- `--dry-run`: Preview cleanup without executing
- `--show-affected`: Show affected records count
- `--data-type`: Specific data type to clean
- `--older-than`: Clean data older than specified period
- `--emergency`: Emergency cleanup mode
- `--free-space`: Target free space amount

## Security Commands

### encrypt

Encrypt existing audit data.

```bash
# Encrypt all unencrypted data
audit-db encrypt --all

# Encrypt specific columns
audit-db encrypt --columns metadata,outcomeDescription

# Rotate encryption keys
audit-db encrypt --rotate-keys --backup-old-keys

# Verify encryption status
audit-db encrypt --verify
```

**Options:**
- `--all`: Encrypt all applicable data
- `--columns`: Specific columns to encrypt
- `--rotate-keys`: Rotate encryption keys
- `--backup-old-keys`: Backup old keys before rotation
- `--verify`: Verify encryption status
- `--algorithm`: Encryption algorithm (AES-256-GCM, ChaCha20-Poly1305)

### integrity

Verify data integrity and signatures.

```bash
# Verify all record hashes
audit-db integrity --verify-hashes

# Verify HMAC signatures
audit-db integrity --verify-signatures

# Generate integrity report
audit-db integrity --report --output integrity-report.pdf

# Fix corrupted hashes
audit-db integrity --fix-hashes --confirm
```

**Options:**
- `--verify-hashes`: Verify SHA-256 hashes
- `--verify-signatures`: Verify HMAC signatures
- `--report`: Generate integrity report
- `--fix-hashes`: Regenerate corrupted hashes
- `--confirm`: Confirm destructive operations
- `--sample-size`: Sample size for verification

## Configuration Management

### config

Manage audit database configuration.

```bash
# Show current configuration
audit-db config --show

# Update configuration
audit-db config --set cache.enabled=true --set cache.ttl=900

# Validate configuration
audit-db config --validate

# Export configuration
audit-db config --export config-backup.json

# Import configuration
audit-db config --import config-backup.json
```

**Options:**
- `--show`: Display current configuration
- `--set`: Set configuration value
- `--validate`: Validate configuration
- `--export`: Export configuration to file
- `--import`: Import configuration from file
- `--env`: Target environment

### secrets

Manage encryption keys and secrets.

```bash
# Generate new encryption key
audit-db secrets --generate-key --type encryption

# Rotate HMAC secret
audit-db secrets --rotate-hmac --backup

# List managed secrets
audit-db secrets --list

# Backup secrets securely
audit-db secrets --backup --encrypted --output secrets-backup.enc
```

**Options:**
- `--generate-key`: Generate new cryptographic key
- `--type`: Key type (encryption, hmac, signing)
- `--rotate-hmac`: Rotate HMAC secret
- `--backup`: Backup secrets
- `--list`: List managed secrets
- `--encrypted`: Use encryption for operations

## Troubleshooting

### diagnose

Diagnose common issues and performance problems.

```bash
# Full system diagnosis
audit-db diagnose

# Diagnose specific issue
audit-db diagnose --issue slow-queries

# Generate diagnostic report
audit-db diagnose --report --output diagnostic-report.html

# Auto-fix common issues
audit-db diagnose --auto-fix --confirm
```

**Options:**
- `--issue`: Specific issue to diagnose
- `--report`: Generate diagnostic report
- `--auto-fix`: Automatically fix issues
- `--confirm`: Confirm automatic fixes
- `--verbose`: Detailed diagnostic output

### logs

Manage and analyze audit database logs.

```bash
# View recent logs
audit-db logs --tail 100

# Search logs
audit-db logs --search "ERROR" --since 1h

# Export logs for analysis
audit-db logs --export --start 2024-01-01 --format json

# Rotate log files
audit-db logs --rotate --keep 30
```

**Options:**
- `--tail`: Show last N log entries
- `--search`: Search log content
- `--since`: Show logs since time period
- `--export`: Export logs to file
- `--rotate`: Rotate log files
- `--keep`: Number of rotated logs to keep

## Global Options

All commands support these global options:

- `--help, -h`: Show help information
- `--version, -V`: Show version information
- `--config, -c`: Configuration file path
- `--env, -e`: Environment (development, staging, production)
- `--verbose, -v`: Verbose output
- `--quiet, -q`: Suppress non-error output
- `--dry-run`: Preview operations without executing
- `--json`: JSON output format
- `--no-color`: Disable colored output

## Configuration File

Create a configuration file for commonly used settings:

```json
{
  "database": {
    "url": "postgresql://user:pass@localhost:5432/audit_db",
    "pool": {
      "min": 5,
      "max": 20
    }
  },
  "redis": {
    "url": "redis://localhost:6379",
    "prefix": "audit:"
  },
  "encryption": {
    "algorithm": "AES-256-GCM",
    "keyRotationDays": 90
  },
  "backup": {
    "path": "/var/backups/audit",
    "retention": "7-years",
    "compression": "gzip",
    "encryption": true
  },
  "monitoring": {
    "enabled": true,
    "alerting": {
      "email": "admin@healthcare.org",
      "thresholds": {
        "cpu": 80,
        "memory": 90,
        "disk": 85
      }
    }
  },
  "compliance": {
    "regulations": ["HIPAA", "GDPR"],
    "auditRetention": "7-years",
    "encryptPHI": true
  }
}
```

## Exit Codes

The CLI tools use standard exit codes:

- `0`: Success
- `1`: General error
- `2`: Configuration error
- `3`: Database connection error
- `4`: Authentication error
- `5`: Permission error
- `6`: Data validation error
- `7`: Backup/restore error
- `8`: Encryption error

## Examples

### Complete Setup Workflow

```bash
# 1. Initial setup
audit-db setup --env production --config ./prod-config.json

# 2. Create partitions for the year
audit-db partition --create-monthly --months 12

# 3. Run health check
audit-db health --recommendations

# 4. Set up monitoring
audit-db monitor --alerts --config ./alerts.json &

# 5. Create initial backup
audit-db backup --encrypt --name "initial-production-backup"
```

### Daily Maintenance Script

```bash
#!/bin/bash
# Daily maintenance script

# Health check
audit-db health --ci --exit-code || exit 1

# Backup
audit-db backup --compress gzip --encrypt

# Cleanup old data
audit-db cleanup --apply-retention

# Verify integrity (sample)
audit-db integrity --verify-hashes --sample-size 1000

# Generate daily report
audit-db analytics --compliance --period daily --output daily-report.pdf

echo "Daily maintenance completed successfully"
```

This CLI reference provides comprehensive tools for managing your audit database in healthcare environments, ensuring both operational excellence and regulatory compliance.