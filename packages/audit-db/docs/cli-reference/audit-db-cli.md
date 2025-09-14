# audit-db CLI Reference

The `audit-db` command-line interface provides tools for database management, schema operations, and basic administration tasks.

## Installation

The CLI is automatically installed with the `@repo/audit-db` package:

```bash
# Install the package
pnpm add '@repo/audit-db@workspace:*'

# CLI is available as
audit-db --help
```

## Global Commands

### `audit-db --version`

Display the current version of the audit-db package.

```bash
audit-db --version
# Output: @repo/audit-db v0.1.0
```

### `audit-db --help`

Show help information for all available commands.

```bash
audit-db --help
```

## Database Commands

### `audit-db verify`

Verify database connection and schema integrity.

```bash
audit-db verify [options]

Options:
  --url <url>         Database connection URL (defaults to AUDIT_DB_URL)
  --timeout <ms>      Connection timeout in milliseconds (default: 5000)
  --verbose           Show detailed verification steps
```

**Examples:**

```bash
# Basic verification
audit-db verify

# Verify with custom URL
audit-db verify --url postgresql://user:pass@host:5432/audit_db

# Verbose output
audit-db verify --verbose
```

**Output:**
```
✅ Database connection: OK
✅ Schema version: 0.1.0
✅ Required tables: audit_log, migrations
✅ Indexes: All required indexes present
✅ Constraints: All constraints valid
Database verification completed successfully
```

### `audit-db rollback`

Rollback database migrations to a previous version.

```bash
audit-db rollback [options] <target-version>

Options:
  --dry-run           Show what would be rolled back without executing
  --force             Force rollback even if data loss may occur
  --backup            Create backup before rollback
```

**Examples:**

```bash
# Rollback to specific version
audit-db rollback 0.0.5

# Dry run to see what would happen
audit-db rollback --dry-run 0.0.5

# Force rollback with backup
audit-db rollback --force --backup 0.0.5
```

## Policy Management

### `audit-db seed-policies`

Seed the database with default compliance policies.

```bash
audit-db seed-policies [options]

Options:
  --type <type>       Policy type: gdpr, hipaa, or all (default: all)
  --overwrite         Overwrite existing policies
  --validate          Validate policies after seeding
```

**Examples:**

```bash
# Seed all default policies
audit-db seed-policies

# Seed only GDPR policies
audit-db seed-policies --type gdpr

# Overwrite existing policies
audit-db seed-policies --overwrite
```

### `audit-db seed-presets`

Load preset configurations for different environments.

```bash
audit-db seed-presets [options] <environment>

Arguments:
  environment         Target environment: development, staging, production

Options:
  --preset <name>     Specific preset name
  --validate          Validate configuration after loading
```

**Examples:**

```bash
# Load production presets
audit-db seed-presets production

# Load specific preset
audit-db seed-presets --preset healthcare-basic staging
```

## Compliance Commands

### `audit-db verify-compliance`

Verify compliance with regulations and standards.

```bash
audit-db verify-compliance [options]

Options:
  --standard <std>    Compliance standard: gdpr, hipaa, sox (default: all)
  --report            Generate detailed compliance report
  --output <file>     Output report to file
  --format <fmt>      Report format: json, csv, html (default: json)
```

**Examples:**

```bash
# Basic compliance check
audit-db verify-compliance

# GDPR compliance only
audit-db verify-compliance --standard gdpr

# Generate HTML report
audit-db verify-compliance --report --format html --output compliance.html
```

**Sample Output:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "standards": {
    "gdpr": {
      "status": "compliant",
      "score": 95,
      "issues": [
        {
          "severity": "warning",
          "message": "Data retention policy not set for user_sessions table"
        }
      ]
    },
    "hipaa": {
      "status": "compliant",
      "score": 98,
      "issues": []
    }
  }
}
```

## Migration Commands

### Database Schema Migration

```bash
# Generate new migration
pnpm --filter @repo/audit-db audit-db:generate

# Apply migrations
pnpm --filter @repo/audit-db audit-db:migrate

# Open database studio
pnpm --filter @repo/audit-db audit-db:studio
```

## Environment Variables

The CLI respects these environment variables:

```bash
# Database connection
AUDIT_DB_URL="postgresql://user:password@host:port/database"

# CLI behavior
AUDIT_CLI_VERBOSE=true
AUDIT_CLI_TIMEOUT=10000
AUDIT_CLI_NO_COLOR=false
```

## Configuration File

Create `.audit-db.config.js` in your project root:

```javascript
module.exports = {
  // Database configuration
  database: {
    url: process.env.AUDIT_DB_URL,
    timeout: 5000
  },
  
  // CLI defaults
  cli: {
    verbose: false,
    color: true
  },
  
  // Compliance settings
  compliance: {
    standards: ['gdpr', 'hipaa'],
    reportFormat: 'json'
  }
}
```

## Scripting Examples

### Backup Script

```bash
#!/bin/bash
# backup-audit-db.sh

set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="audit_db_backup_${DATE}.sql"

echo "Creating backup: $BACKUP_FILE"

# Verify database before backup
audit-db verify --verbose

# Create backup
pg_dump $AUDIT_DB_URL > $BACKUP_FILE

# Verify backup integrity
echo "Verifying backup integrity..."
if [ -s $BACKUP_FILE ]; then
    echo "✅ Backup created successfully: $BACKUP_FILE"
else
    echo "❌ Backup failed or is empty"
    exit 1
fi

# Compress backup
gzip $BACKUP_FILE
echo "✅ Backup compressed: ${BACKUP_FILE}.gz"
```

### Health Check Script

```bash
#!/bin/bash
# health-check.sh

echo "🔍 Running audit database health check..."

# Database connectivity
if audit-db verify --timeout 3000; then
    echo "✅ Database: Healthy"
else
    echo "❌ Database: Unhealthy"
    exit 1
fi

# Compliance check
if audit-db verify-compliance --standard gdpr; then
    echo "✅ GDPR Compliance: Passed"
else
    echo "⚠️  GDPR Compliance: Issues detected"
fi

if audit-db verify-compliance --standard hipaa; then
    echo "✅ HIPAA Compliance: Passed"
else
    echo "⚠️  HIPAA Compliance: Issues detected"
fi

echo "✅ Health check completed"
```

### Deployment Script

```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 Deploying audit database updates..."

# Verify current state
audit-db verify

# Backup before migration
./backup-audit-db.sh

# Apply migrations
pnpm --filter @repo/audit-db audit-db:migrate

# Seed policies if needed
audit-db seed-policies --validate

# Final verification
audit-db verify --verbose

# Compliance check
audit-db verify-compliance --report --output deployment-compliance.json

echo "✅ Deployment completed successfully"
```

## Error Codes

The CLI uses these exit codes:

- `0`: Success
- `1`: General error
- `2`: Database connection error
- `3`: Schema validation error
- `4`: Compliance verification failed
- `5`: Migration error
- `6`: Configuration error

## Troubleshooting

### Common Issues

**Connection Refused:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Verify connection string
echo $AUDIT_DB_URL
```

**Permission Denied:**
```bash
# Verify database user permissions
psql $AUDIT_DB_URL -c "\du"
```

**Schema Mismatch:**
```bash
# Reset schema (development only)
audit-db rollback --force 0.0.1
pnpm --filter @repo/audit-db audit-db:migrate
```

### Debug Mode

Enable debug output for troubleshooting:

```bash
DEBUG=audit-db:* audit-db verify --verbose
```

### Logging

CLI logs are written to:
- Console (stdout/stderr)
- Log file (if configured): `~/.audit-db/cli.log`

Configure logging in `.audit-db.config.js`:

```javascript
module.exports = {
  logging: {
    level: 'debug',
    file: '~/.audit-db/cli.log',
    console: true
  }
}
```

## Best Practices

### 1. Always Verify Before Operations

```bash
# Good practice
audit-db verify && audit-db seed-policies

# Not recommended
audit-db seed-policies
```

### 2. Use Configuration Files

```bash
# Create environment-specific configs
cp .audit-db.config.js .audit-db.production.config.js

# Use with environment flag
AUDIT_CONFIG=.audit-db.production.config.js audit-db verify
```

### 3. Automate Compliance Checks

```bash
# Add to CI/CD pipeline
audit-db verify-compliance --report --output compliance-report.json
```

### 4. Regular Backups

```bash
# Schedule daily backups
0 2 * * * /path/to/backup-audit-db.sh
```

This CLI reference provides comprehensive guidance for managing your audit database using command-line tools.