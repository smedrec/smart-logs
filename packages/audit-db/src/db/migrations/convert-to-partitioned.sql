-- Migration to convert audit_log table to partitioned table
-- This assumes you have existing data that needs to be preserved

BEGIN;

-- Step 1: Rename existing table
ALTER TABLE audit_log RENAME TO audit_log_old;

-- Step 2: Create new partitioned table with same structure
CREATE TABLE audit_log (
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

-- Step 3: Create initial partitions for existing data and future months
-- You'll need to adjust these dates based on your data range
SELECT create_audit_log_partitions();

-- Step 4: Copy data from old table to new partitioned table
-- This will automatically route data to appropriate partitions
INSERT INTO audit_log SELECT * FROM audit_log_old;

-- Step 5: Recreate indexes (they don't transfer automatically)
-- Core audit indexes
CREATE INDEX audit_log_timestamp_idx ON audit_log (timestamp);
CREATE INDEX audit_log_principal_id_idx ON audit_log (principal_id);
CREATE INDEX audit_log_organization_id_idx ON audit_log (organization_id);
CREATE INDEX audit_log_action_idx ON audit_log (action);
CREATE INDEX audit_log_status_idx ON audit_log (status);
CREATE INDEX audit_log_hash_idx ON audit_log (hash);
CREATE INDEX audit_log_target_resource_type_idx ON audit_log (target_resource_type);
CREATE INDEX audit_log_target_resource_id_idx ON audit_log (target_resource_id);

-- Compliance indexes
CREATE INDEX audit_log_correlation_id_idx ON audit_log (correlation_id);
CREATE INDEX audit_log_data_classification_idx ON audit_log (data_classification);
CREATE INDEX audit_log_retention_policy_idx ON audit_log (retention_policy);
CREATE INDEX audit_log_archived_at_idx ON audit_log (archived_at);

-- Composite indexes
CREATE INDEX audit_log_timestamp_status_idx ON audit_log (timestamp, status);
CREATE INDEX audit_log_principal_action_idx ON audit_log (principal_id, action);
CREATE INDEX audit_log_classification_retention_idx ON audit_log (data_classification, retention_policy);
CREATE INDEX audit_log_resource_type_id_idx ON audit_log (target_resource_type, target_resource_id);

-- Step 6: Drop old table (uncomment when you're confident the migration worked)
-- DROP TABLE audit_log_old;

COMMIT;