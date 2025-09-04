#!/bin/bash

# SMEDREC Audit Server Backup Script
# This script performs automated backups of PostgreSQL and Redis data

set -euo pipefail

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/backup"
REDIS_BACKUP_DIR="/redis-backup"
LOG_FILE="/var/log/backup.log"

# Environment variables with defaults
POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_DB=${POSTGRES_DB:-audit_db}
POSTGRES_USER=${POSTGRES_USER:-audit_user}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
S3_BACKUP_BUCKET=${S3_BACKUP_BUCKET:-}
REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Create backup directories
mkdir -p "$BACKUP_DIR" "$REDIS_BACKUP_DIR"

log "Starting backup process..."

# PostgreSQL Backup
log "Creating PostgreSQL backup..."
POSTGRES_BACKUP_FILE="$BACKUP_DIR/postgres_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

if pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" --verbose --no-password | gzip > "$POSTGRES_BACKUP_FILE"; then
    log "PostgreSQL backup completed: $POSTGRES_BACKUP_FILE"
    
    # Verify backup integrity
    if gunzip -t "$POSTGRES_BACKUP_FILE"; then
        log "PostgreSQL backup integrity verified"
    else
        error_exit "PostgreSQL backup integrity check failed"
    fi
else
    error_exit "PostgreSQL backup failed"
fi

# Redis Backup
log "Creating Redis backup..."
REDIS_BACKUP_FILE="$REDIS_BACKUP_DIR/redis_${TIMESTAMP}.rdb"

if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --rdb "$REDIS_BACKUP_FILE"; then
    log "Redis backup completed: $REDIS_BACKUP_FILE"
    
    # Compress Redis backup
    if gzip "$REDIS_BACKUP_FILE"; then
        log "Redis backup compressed: ${REDIS_BACKUP_FILE}.gz"
        REDIS_BACKUP_FILE="${REDIS_BACKUP_FILE}.gz"
    else
        log "WARNING: Redis backup compression failed, keeping uncompressed file"
    fi
else
    error_exit "Redis backup failed"
fi

# Upload to S3 if configured
if [ -n "$S3_BACKUP_BUCKET" ]; then
    log "Uploading backups to S3..."
    
    # Upload PostgreSQL backup
    if aws s3 cp "$POSTGRES_BACKUP_FILE" "s3://$S3_BACKUP_BUCKET/postgres/$(basename "$POSTGRES_BACKUP_FILE")"; then
        log "PostgreSQL backup uploaded to S3"
    else
        log "WARNING: Failed to upload PostgreSQL backup to S3"
    fi
    
    # Upload Redis backup
    if aws s3 cp "$REDIS_BACKUP_FILE" "s3://$S3_BACKUP_BUCKET/redis/$(basename "$REDIS_BACKUP_FILE")"; then
        log "Redis backup uploaded to S3"
    else
        log "WARNING: Failed to upload Redis backup to S3"
    fi
fi

# Cleanup old local backups
log "Cleaning up old backups (older than $BACKUP_RETENTION_DAYS days)..."

# Clean PostgreSQL backups
find "$BACKUP_DIR" -name "postgres_*.sql.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete
POSTGRES_CLEANED=$(find "$BACKUP_DIR" -name "postgres_*.sql.gz" -type f -mtime +$BACKUP_RETENTION_DAYS | wc -l)
log "Cleaned up $POSTGRES_CLEANED old PostgreSQL backups"

# Clean Redis backups
find "$REDIS_BACKUP_DIR" -name "redis_*.rdb.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete
REDIS_CLEANED=$(find "$REDIS_BACKUP_DIR" -name "redis_*.rdb.gz" -type f -mtime +$BACKUP_RETENTION_DAYS | wc -l)
log "Cleaned up $REDIS_CLEANED old Redis backups"

# Cleanup old S3 backups if configured
if [ -n "$S3_BACKUP_BUCKET" ]; then
    log "Cleaning up old S3 backups..."
    
    # Calculate cutoff date
    CUTOFF_DATE=$(date -d "$BACKUP_RETENTION_DAYS days ago" +%Y-%m-%d)
    
    # Clean PostgreSQL S3 backups
    aws s3 ls "s3://$S3_BACKUP_BUCKET/postgres/" | while read -r line; do
        FILE_DATE=$(echo "$line" | awk '{print $1}')
        FILE_NAME=$(echo "$line" | awk '{print $4}')
        
        if [[ "$FILE_DATE" < "$CUTOFF_DATE" ]]; then
            aws s3 rm "s3://$S3_BACKUP_BUCKET/postgres/$FILE_NAME"
            log "Deleted old S3 PostgreSQL backup: $FILE_NAME"
        fi
    done
    
    # Clean Redis S3 backups
    aws s3 ls "s3://$S3_BACKUP_BUCKET/redis/" | while read -r line; do
        FILE_DATE=$(echo "$line" | awk '{print $1}')
        FILE_NAME=$(echo "$line" | awk '{print $4}')
        
        if [[ "$FILE_DATE" < "$CUTOFF_DATE" ]]; then
            aws s3 rm "s3://$S3_BACKUP_BUCKET/redis/$FILE_NAME"
            log "Deleted old S3 Redis backup: $FILE_NAME"
        fi
    done
fi

# Generate backup report
POSTGRES_SIZE=$(du -h "$POSTGRES_BACKUP_FILE" | cut -f1)
REDIS_SIZE=$(du -h "$REDIS_BACKUP_FILE" | cut -f1)
TOTAL_BACKUPS_POSTGRES=$(find "$BACKUP_DIR" -name "postgres_*.sql.gz" -type f | wc -l)
TOTAL_BACKUPS_REDIS=$(find "$REDIS_BACKUP_DIR" -name "redis_*.rdb.gz" -type f | wc -l)

log "Backup completed successfully!"
log "PostgreSQL backup size: $POSTGRES_SIZE"
log "Redis backup size: $REDIS_SIZE"
log "Total PostgreSQL backups: $TOTAL_BACKUPS_POSTGRES"
log "Total Redis backups: $TOTAL_BACKUPS_REDIS"

# Send notification if webhook is configured
if [ -n "${BACKUP_WEBHOOK_URL:-}" ]; then
    curl -X POST "$BACKUP_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"status\": \"success\",
            \"timestamp\": \"$(date -Iseconds)\",
            \"postgres_backup_size\": \"$POSTGRES_SIZE\",
            \"redis_backup_size\": \"$REDIS_SIZE\",
            \"total_postgres_backups\": $TOTAL_BACKUPS_POSTGRES,
            \"total_redis_backups\": $TOTAL_BACKUPS_REDIS
        }" || log "WARNING: Failed to send backup notification"
fi

log "Backup process completed successfully"