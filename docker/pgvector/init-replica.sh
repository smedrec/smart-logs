#!/bin/bash
set -e

# Wait for primary to be ready
until pg_isready -h "$POSTGRES_PRIMARY_HOST" -p "$POSTGRES_PRIMARY_PORT" -U "$POSTGRES_REPLICATION_USER"; do
  echo "Waiting for primary database to be ready..."
  sleep 2
done

# Check if this is the first run (no data directory)
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "Setting up streaming replication..."
  
  # Remove any existing data
  rm -rf "$PGDATA"/*
  
  # Create base backup from primary
  pg_basebackup -h "$POSTGRES_PRIMARY_HOST" -p "$POSTGRES_PRIMARY_PORT" -U "$POSTGRES_REPLICATION_USER" -D "$PGDATA" -Fp -Xs -P -R
  
  # Set proper permissions
  chmod 700 "$PGDATA"
  
  echo "Streaming replication setup complete"
fi