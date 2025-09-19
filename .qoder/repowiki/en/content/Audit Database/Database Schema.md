# Database Schema

<cite>
**Referenced Files in This Document**   
- [audit-db.md](file://apps/docs/src/content/docs/audit/audit-db.md)
- [schema.test.ts](file://packages/audit-db/src/__tests__/schema.test.ts)
- [migration-utils.ts](file://packages/audit-db/src/migration-utils.ts)
- [basic-usage.ts](file://packages/audit-sdk/examples/basic-usage.ts)
- [examples.ts](file://packages/audit-sdk/src/__tests__/examples.ts)
- [0004_snapshot.json](file://packages/audit-db/drizzle/migrations/meta/0004_snapshot.json)
- [0003_snapshot.json](file://packages/audit-db/drizzle/migrations/meta/0003_snapshot.json)
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts)
- [audit.test.ts](file://packages/audit/src/__tests__/audit.test.ts)
- [0006_silly_tyger_tiger.sql](file://packages/audit-db/drizzle/migrations/0006_silly_tyger_tiger.sql) - *Added in recent commit*
- [schema.ts](file://packages/audit-db/src/db/schema.ts) - *Updated in recent commit*
- [gdpr-compliance.ts](file://packages/audit/src/gdpr/gdpr-compliance.ts) - *Updated in recent commit*
- [gdpr-utils.ts](file://packages/audit/src/gdpr/gdpr-utils.ts) - *Updated in recent commit*
- [0005_fluffy_donald_blake.sql](file://packages/auth/drizzle/0005_fluffy_donald_blake.sql) - *Added in recent commit*
- [authz.ts](file://packages/auth/src/db/schema/authz.ts) - *Added in recent commit*
- [permissions.ts](file://packages/auth/src/permissions.ts) - *Contains permission definitions and role logic*
- [0007_keen_ego.sql](file://packages/audit-db/drizzle/migrations/0007_keen_ego.sql) - *Added in recent commit*
- [0008_swift_black_panther.sql](file://packages/audit-db/drizzle/migrations/0008_swift_black_panther.sql) - *Added in recent commit*
</cite>

## Update Summary
**Changes Made**   
- Added new section for pseudonym_mapping table to document GDPR pseudonymization strategy and unique index changes
- Updated Data Model Diagram to include new 'strategy' column in pseudonym_mapping table and updated index type
- Enhanced pseudonym_mapping field definitions with new 'strategy' column details
- Updated Constraints and Indexes section to reflect the unique index on original_id
- Added new sources for migration files 0007_keen_ego.sql and 0008_swift_black_panther.sql
- Updated Data Validation and Business Logic section to include pseudonymization strategy details

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Data Model Diagram](#data-model-diagram)
7. [Entity Relationship Details](#entity-relationship-details)
8. [Sample Data Entries](#sample-data-entries)
9. [Constraints and Indexes](#constraints-and-indexes)
10. [Data Validation and Business Logic](#data-validation-and-business-logic)

## Introduction

This document provides comprehensive data model documentation for the Audit Database schema used in the SMEDREC smart-logs system. The audit logging system is designed to capture, store, and manage audit events with strong emphasis on compliance, data integrity, and retention policies. The schema supports healthcare-specific requirements including HIPAA and GDPR compliance through structured data classification and retention mechanisms.

The database schema is implemented using Drizzle ORM and features partitioned tables for performance optimization, integrity verification mechanisms, and compliance tracking. This documentation details the entity relationships, field definitions, constraints, indexes, and business logic encoded in the schema structure.

## Project Structure

The audit database functionality is organized within the monorepo structure with clear separation of concerns:

- **packages/audit-db**: Contains the core database schema, migrations, and low-level database operations
- **packages/audit-sdk**: Provides the client-facing interface for logging events
- **apps/docs**: Contains documentation including schema references
- **apps/server**: Implements API endpoints that interact with the audit system
- **packages/audit**: Contains core audit service logic and processing
- **packages/auth**: Manages authentication and authorization including role-based access control

The audit database package uses Drizzle ORM for schema definition and migration management, with JSON snapshots used to track schema evolution across versions.

```mermaid
graph TB
subgraph "Application Layer"
SDK["audit-sdk"]
Server["server app"]
end
subgraph "Database Layer"
DB["audit-db"]
Migrations["drizzle/migrations"]
Schema["db/schema.ts"]
end
SDK --> DB
Server --> DB
Migrations --> Schema
```

**Diagram sources**
- [audit-db.md](file://apps/docs/src/content/docs/audit/audit-db.md)
- [schema.test.ts](file://packages/audit-db/src/__tests__/schema.test.ts)

**Section sources**
- [audit-db.md](file://apps/docs/src/content/docs/audit/audit-db.md)
- [schema.test.ts](file://packages/audit-db/src/__tests__/schema.test.ts)

## Core Components

The audit database schema consists of several key components that work together to provide a robust audit logging system:

- **audit_log**: Primary table storing all audit events with comprehensive metadata
- **audit_integrity_log**: Tracks integrity verification results for audit records
- **audit_retention_policy**: Defines retention rules based on data classification
- **audit_presets**: Stores predefined logging configurations for consistent event patterns
- **alerts**: Manages alerting based on audit event patterns and anomalies
- **scheduled_reports**: Handles configuration for automated compliance reporting
- **pseudonym_mapping**: Table for GDPR pseudonymization mapping with strategy and unique constraints (updated in recent update)
- **organization_role**: Table for role-based access control with permissions (added in recent update)

The schema implements partitioning on the audit_log table by timestamp to optimize query performance and storage management. This allows efficient querying of recent data while maintaining historical records.

**Section sources**
- [schema.test.ts](file://packages/audit-db/src/__tests__/schema.test.ts)
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts)
- [0006_silly_tyger_tiger.sql](file://packages/audit-db/drizzle/migrations/0006_silly_tyger_tiger.sql) - *Added in recent commit*
- [0005_fluffy_donald_blake.sql](file://packages/auth/drizzle/0005_fluffy_donald_blake.sql) - *Added in recent commit*
- [0007_keen_ego.sql](file://packages/audit-db/drizzle/migrations/0007_keen_ego.sql) - *Added in recent commit*
- [0008_swift_black_panther.sql](file://packages/audit-db/drizzle/migrations/0008_swift_black_panther.sql) - *Added in recent commit*

## Architecture Overview

The audit database architecture follows a layered approach with clear separation between data ingestion, storage, and analysis components. Events are ingested through the audit SDK, processed by the audit service, and stored in the partitioned audit_log table. Secondary processes handle integrity verification, alert generation, and report scheduling.

```mermaid
graph TD
A["Application"] --> B["Audit SDK"]
B --> C["Audit Service"]
C --> D["audit_log (Partitioned)"]
D --> E["Integrity Verification"]
D --> F["Alert Processing"]
D --> G["Report Generation"]
E --> H["audit_integrity_log"]
F --> I["alerts"]
G --> J["scheduled_reports"]
K["audit_retention_policy"] --> D
L["audit_presets"] --> B
D --> M["pseudonym_mapping"]
N["organization_role"] --> D
```

**Diagram sources**
- [schema.test.ts](file://packages/audit-db/src/__tests__/schema.test.ts)
- [migration-utils.ts](file://packages/audit-db/src/migration-utils.ts)
- [0006_silly_tyger_tiger.sql](file://packages/audit-db/drizzle/migrations/0006_silly_tyger_tiger.sql) - *Added in recent commit*
- [0005_fluffy_donald_blake.sql](file://packages/auth/drizzle/0005_fluffy_donald_blake.sql) - *Added in recent commit*
- [0007_keen_ego.sql](file://packages/audit-db/drizzle/migrations/0007_keen_ego.sql) - *Added in recent commit*
- [0008_swift_black_panther.sql](file://packages/audit-db/drizzle/migrations/0008_swift_black_panther.sql) - *Added in recent commit*

## Detailed Component Analysis

### Audit Log Table Analysis

The audit_log table is the central component of the audit system, designed to store comprehensive event data with compliance-focused metadata.

```mermaid
classDiagram
class audit_log {
+id : serial
+timestamp : timestamp with time zone
+ttl : varchar(255)
+principal_id : varchar(255)
+organization_id : varchar(255)
+action : varchar(255)
+target_resource_type : varchar(255)
+target_resource_id : varchar(255)
+status : varchar(50)
+outcome_description : text
+hash : varchar(64)
+hash_algorithm : varchar(50)
+event_version : varchar(20)
+correlation_id : varchar(255)
+data_classification : varchar(20)
+retention_policy : varchar(50)
+processing_latency : integer
+archived_at : timestamp with time zone
+details : jsonb
}
```

**Diagram sources**
- [0004_snapshot.json](file://packages/audit-db/drizzle/migrations/meta/0004_snapshot.json)
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts)

### Integrity Verification Analysis

The audit_integrity_log table provides a mechanism for verifying the integrity of audit records and detecting potential tampering.

```mermaid
classDiagram
class audit_integrity_log {
+id : serial
+audit_log_id : integer
+verification_timestamp : timestamp with time zone
+verification_status : varchar(20)
+verification_details : jsonb
+verified_by : varchar(255)
+hash_verified : varchar(64)
+expected_hash : varchar(64)
}
```

**Diagram sources**
- [0004_snapshot.json](file://packages/audit-db/drizzle/migrations/meta/0004_snapshot.json)
- [schema.test.ts](file://packages/audit-db/src/__tests__/schema.test.ts)

### Pseudonym Mapping Analysis

The pseudonym_mapping table provides GDPR-compliant pseudonymization capabilities by maintaining a secure mapping between original identifiers and pseudonymized identifiers with strategy specification.

```mermaid
classDiagram
class pseudonym_mapping {
+id : serial
+timestamp : timestamp with time zone
+pseudonym_id : text
+original_id : text
+strategy : varchar(20)
}
```

**Diagram sources**
- [0007_keen_ego.sql](file://packages/audit-db/drizzle/migrations/0007_keen_ego.sql)
- [0008_swift_black_panther.sql](file://packages/audit-db/drizzle/migrations/0008_swift_black_panther.sql)
- [schema.ts](file://packages/audit-db/src/db/schema.ts)
- [gdpr-compliance.ts](file://packages/audit/src/gdpr/gdpr-compliance.ts)

### Organization Role Analysis

The organization_role table provides role-based access control by defining roles with specific permissions within organizations.

```mermaid
classDiagram
class organization_role {
+organization_id : varchar(50)
+name : varchar(50)
+description : text
+permissions : jsonb
+inherits : jsonb
}
```

**Diagram sources**
- [0005_fluffy_donald_blake.sql](file://packages/auth/drizzle/0005_fluffy_donald_blake.sql)
- [authz.ts](file://packages/auth/src/db/schema/authz.ts)
- [permissions.ts](file://packages/auth/src/permissions.ts)

## Data Model Diagram

```mermaid
erDiagram
audit_log {
serial id PK
timestamp with time zone timestamp
varchar(255) ttl
varchar(255) principal_id
varchar(255) organization_id
varchar(255) action
varchar(255) target_resource_type
varchar(255) target_resource_id
varchar(50) status
text outcome_description
varchar(64) hash
varchar(50) hash_algorithm
varchar(20) event_version
varchar(255) correlation_id
varchar(20) data_classification
varchar(50) retention_policy
integer processing_latency
timestamp with time zone archived_at
jsonb details
}
audit_integrity_log {
serial id PK
integer audit_log_id FK
timestamp with time zone verification_timestamp
varchar(20) verification_status
jsonb verification_details
varchar(255) verified_by
varchar(64) hash_verified
varchar(64) expected_hash
}
audit_retention_policy {
serial id PK
varchar(50) policy_name UK
integer retention_days
integer archive_after_days
varchar(20) data_classification
text description
boolean is_active
varchar(255) created_by
varchar(255) updated_by
timestamp with time zone created_at
timestamp with time zone updated_at
}
audit_presets {
serial id PK
varchar(50) name UK
jsonb fields
jsonb validation
text description
boolean is_active
varchar(255) created_by
varchar(255) updated_by
timestamp with time zone created_at
timestamp with time zone updated_at
}
alerts {
serial id PK
varchar(50) alert_type
varchar(20) severity
varchar(255) title
text description
varchar(255) source
varchar(50) status
integer count
varchar(20) error_rate
varchar(20) trend
timestamp with time zone first_occurrence
timestamp with time zone last_occurrence
jsonb affected_components
jsonb affected_users
jsonb samples
timestamp with time zone created_at
timestamp with time zone updated_at
timestamp with time zone resolved_at
varchar(255) resolved_by
}
scheduled_reports {
serial id PK
varchar(255) organization_id
varchar(50) report_type
varchar(255) template_id
varchar(255) name
text description
jsonb filters
jsonb recipients
varchar(20) frequency
varchar(20) format
boolean enabled
timestamp with time zone last_run
timestamp with time zone next_run
timestamp with time zone created_at
timestamp with time zone updated_at
varchar(255) created_by
varchar(255) updated_by
}
pseudonym_mapping {
serial id PK
timestamp with time zone timestamp
text pseudonym_id
text original_id
varchar(20) strategy
}
organization_role {
varchar(50) organization_id PK
varchar(50) name PK
text description
jsonb permissions
jsonb inherits
}
audit_log ||--o{ audit_integrity_log : "1 to many"
audit_log }|--|| audit_retention_policy : "retention_policy → policy_name"
audit_log }|--|| audit_presets : "preset references"
alerts }|--|| audit_log : "references events"
scheduled_reports }|--|| audit_presets : "uses templates"
audit_log }|--|| pseudonym_mapping : "GDPR pseudonymization"
audit_log }|--|| organization_role : "organization role management"
```

**Diagram sources**
- [0004_snapshot.json](file://packages/audit-db/drizzle/migrations/meta/0004_snapshot.json)
- [0003_snapshot.json](file://packages/audit-db/drizzle/migrations/meta/0003_snapshot.json)
- [0006_silly_tyger_tiger.sql](file://packages/audit-db/drizzle/migrations/0006_silly_tyger_tiger.sql) - *Added in recent commit*
- [schema.ts](file://packages/audit-db/src/db/schema.ts) - *Updated in recent commit*
- [0005_fluffy_donald_blake.sql](file://packages/auth/drizzle/0005_fluffy_donald_blake.sql) - *Added in recent commit*
- [0007_keen_ego.sql](file://packages/audit-db/drizzle/migrations/0007_keen_ego.sql) - *Added in recent commit*
- [0008_swift_black_panther.sql](file://packages/audit-db/drizzle/migrations/0008_swift_black_panther.sql) - *Added in recent commit*

## Entity Relationship Details

### audit_log Table

The audit_log table serves as the primary repository for all audit events in the system. It is designed with compliance and performance in mind, featuring partitioning by timestamp and comprehensive metadata fields.

**Field Definitions:**
- **id**: Serial primary key, auto-incrementing identifier
- **timestamp**: Timestamp with time zone, records when the event occurred (indexed)
- **ttl**: Time-to-live indicator for record retention
- **principal_id**: Identifier of the entity performing the action
- **organization_id**: Identifier of the organization associated with the event
- **action**: Descriptive name of the action performed (e.g., "userLoginAttempt", "dataAccess")
- **target_resource_type**: Type of resource targeted by the action
- **target_resource_id**: Identifier of the specific resource targeted
- **status**: Outcome status of the action (e.g., "success", "failure")
- **outcome_description**: Human-readable description of the outcome
- **hash**: Cryptographic hash of the event data for integrity verification
- **hash_algorithm**: Algorithm used for hashing (default: SHA-256)
- **event_version**: Version of the event schema (default: 1.0)
- **correlation_id**: Identifier for correlating related events across systems
- **data_classification**: Sensitivity level of the data involved (INTERNAL, PHI, CONFIDENTIAL, PUBLIC)
- **retention_policy**: Name of the retention policy to apply to this record
- **processing_latency**: Processing time in milliseconds
- **archived_at**: Timestamp when the record was archived
- **details**: JSONB field for additional structured data specific to the event type

**Constraints:**
- Primary Key: id
- Not Null Constraints: timestamp, action, status
- Default Values: hash_algorithm ('SHA-256'), event_version ('1.0'), data_classification ('INTERNAL'), retention_policy ('standard')

**Indexes:**
- audit_log_timestamp_idx: Index on timestamp for time-based queries
- audit_log_principal_id_idx: Index on principal_id for user activity tracking
- audit_log_action_idx: Index on action for operation type filtering
- audit_log_status_idx: Index on status for success/failure analysis
- audit_log_correlation_id_idx: Index on correlation_id for traceability
- audit_log_data_classification_idx: Index on data_classification for compliance reporting
- audit_log_retention_policy_idx: Index on retention_policy for lifecycle management
- audit_log_archived_at_idx: Index on archived_at for archival status queries

**Section sources**
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts)
- [0004_snapshot.json](file://packages/audit-db/drizzle/migrations/meta/0004_snapshot.json)

### audit_integrity_log Table

The audit_integrity_log table provides a mechanism for verifying the integrity of audit records and detecting potential tampering or data corruption.

**Field Definitions:**
- **id**: Serial primary key, auto-incrementing identifier
- **audit_log_id**: Foreign key referencing the audited record in audit_log
- **verification_timestamp**: When the integrity verification was performed
- **verification_status**: Result of the verification (e.g., "SUCCESS", "FAILURE", "WARNING")
- **verification_details**: JSONB field containing detailed verification information
- **verified_by**: Identifier of the entity or system that performed the verification
- **hash_verified**: The hash value that was verified
- **expected_hash**: The expected hash value for comparison

**Constraints:**
- Primary Key: id
- Foreign Key: audit_log_id references audit_log(id)
- Not Null Constraints: audit_log_id, verification_timestamp, verification_status
- Default Values: verification_timestamp (current timestamp)

**Indexes:**
- audit_integrity_log_audit_log_id_idx: Index on audit_log_id for event lookup
- audit_integrity_log_verification_timestamp_idx: Index on verification_timestamp for temporal analysis
- audit_integrity_log_verification_status_idx: Index on verification_status for health monitoring
- audit_integrity_log_verified_by_idx: Index on verified_by for accountability

**Section sources**
- [0004_snapshot.json](file://packages/audit-db/drizzle/migrations/meta/0004_snapshot.json)
- [schema.test.ts](file://packages/audit-db/src/__tests__/schema.test.ts)

### audit_retention_policy Table

The audit_retention_policy table defines retention rules based on data classification and regulatory requirements.

**Field Definitions:**
- **id**: Serial primary key, auto-incrementing identifier
- **policy_name**: Unique name of the retention policy
- **retention_days**: Number of days to retain records before deletion
- **archive_after_days**: Number of days after which records should be archived
- **data_classification**: Data classification level this policy applies to
- **description**: Human-readable description of the policy
- **is_active**: Boolean indicating if the policy is currently active
- **created_by**: Identifier of the entity that created the policy
- **updated_by**: Identifier of the entity that last updated the policy
- **created_at**: Timestamp when the policy was created
- **updated_at**: Timestamp when the policy was last updated

**Constraints:**
- Primary Key: id
- Unique Constraint: policy_name
- Not Null Constraints: policy_name, retention_days, archive_after_days, data_classification, is_active, created_by, created_at, updated_at
- Default Values: is_active (true), created_at (current timestamp), updated_at (current timestamp)

**Indexes:**
- audit_retention_policy_policy_name_idx: Index on policy_name for direct lookup
- audit_retention_policy_data_classification_idx: Index on data_classification for classification-based queries
- audit_retention_policy_is_active_idx: Index on is_active for active policy filtering

**Section sources**
- [migration-utils.ts](file://packages/audit-db/src/migration-utils.ts)
- [0004_snapshot.json](file://packages/audit-db/drizzle/migrations/meta/0004_snapshot.json)

### audit_presets Table

The audit_presets table stores predefined logging configurations to ensure consistency in event logging across the system.

**Field Definitions:**
- **id**: Serial primary key, auto-incrementing identifier
- **name**: Unique name of the preset
- **fields**: JSONB field defining required and optional fields for this preset
- **validation**: JSONB field containing validation rules for the preset
- **description**: Human-readable description of the preset's purpose
- **is_active**: Boolean indicating if the preset is currently active
- **created_by**: Identifier of the entity that created the preset
- **updated_by**: Identifier of the entity that last updated the preset
- **created_at**: Timestamp when the preset was created
- **updated_at**: Timestamp when the preset was last updated

**Constraints:**
- Primary Key: id
- Unique Constraint: name
- Not Null Constraints: name, fields, validation, is_active, created_by, created_at, updated_at
- Default Values: is_active (true), created_at (current timestamp), updated_at (current timestamp)

**Indexes:**
- audit_presets_name_idx: Index on name for direct lookup
- audit_presets_is_active_idx: Index on is_active for active preset filtering

**Section sources**
- [migration-utils.ts](file://packages/audit-db/src/migration-utils.ts)
- [0004_snapshot.json](file://packages/audit-db/drizzle/migrations/meta/0004_snapshot.json)

### alerts Table

The alerts table manages alerting based on audit event patterns, anomalies, and system health issues.

**Field Definitions:**
- **id**: Serial primary key, auto-incrementing identifier
- **alert_type**: Category of the alert (e.g., "SECURITY", "PERFORMANCE", "COMPLIANCE")
- **severity**: Severity level (HIGH, MEDIUM, LOW)
- **title**: Brief descriptive title of the alert
- **description**: Detailed description of the alert condition
- **source**: System or component that generated the alert
- **status**: Current status (ACTIVE, RESOLVED, ACKNOWLEDGED)
- **count**: Number of occurrences
- **error_rate**: Error rate percentage as string
- **trend**: Trend analysis (STABLE, INCREASING, DECREASING)
- **first_occurrence**: When the alert condition was first detected
- **last_occurrence**: When the alert condition was last detected
- **affected_components**: JSONB array of affected system components
- **affected_users**: JSONB array of affected users
- **samples**: JSONB array of sample event IDs for investigation
- **created_at**: Timestamp when the alert was created
- **updated_at**: Timestamp when the alert was last updated
- **resolved_at**: Timestamp when the alert was resolved
- **resolved_by**: Identifier of the entity that resolved the alert

**Constraints:**
- Primary Key: id
- Not Null Constraints: alert_type, severity, title, source, status, count, error_rate, trend, first_occurrence, last_occurrence, affected_components, affected_users, samples, created_at, updated_at
- Default Values: count (0), error_rate ('0'), trend ('STABLE'), created_at (current timestamp), updated_at (current timestamp)

**Indexes:**
- alerts_alert_type_idx: Index on alert_type for category filtering
- alerts_severity_idx: Index on severity for priority sorting
- alerts_status_idx: Index on status for workflow management
- alerts_first_occurrence_idx: Index on first_occurrence for temporal analysis
- alerts_last_occurrence_idx: Index on last_occurrence for recency filtering
- alerts_resolved_at_idx: Index on resolved_at for resolution tracking

**Section sources**
- [0004_snapshot.json](file://packages/audit-db/drizzle/migrations/meta/0004_snapshot.json)
- [resolvers.test.ts](file://apps/server/src/lib/graphql/__tests__/resolvers.test.ts)

### scheduled_reports Table

The scheduled_reports table handles configuration for automated compliance reporting.

**Field Definitions:**
- **id**: Serial primary key, auto-incrementing identifier
- **organization_id**: Identifier of the organization for which the report is scheduled
- **report_type**: Type of report (e.g., "DAILY_SUMMARY", "WEEKLY_COMPLIANCE")
- **template_id**: Identifier of the report template to use
- **name**: Descriptive name of the scheduled report
- **description**: Detailed description of the report purpose
- **filters**: JSONB object containing report filters and parameters
- **recipients**: JSONB array of email addresses or user IDs to receive the report
- **frequency**: Schedule frequency (DAILY, WEEKLY, MONTHLY)
- **format**: Output format (PDF, CSV, JSON)
- **enabled**: Boolean indicating if the schedule is active
- **last_run**: Timestamp of the last report generation
- **next_run**: Timestamp when the next report should be generated
- **created_at**: Timestamp when the schedule was created
- **updated_at**: Timestamp when the schedule was last updated
- **created_by**: Identifier of the entity that created the schedule
- **updated_by**: Identifier of the entity that last updated the schedule

**Constraints:**
- Primary Key: id
- Not Null Constraints: organization_id, report_type, template_id, name, filters, recipients, frequency, format, enabled, created_at, updated_at, created_by
- Default Values: enabled (true), created_at (current timestamp), updated_at (current timestamp)

**Indexes:**
- scheduled_reports_organization_id_idx: Index on organization_id for organizational filtering
- scheduled_reports_template_id_idx: Index on template_id for template-based queries
- scheduled_reports_enabled_idx: Index on enabled for active schedule filtering
- scheduled_reports_next_run_idx: Index on next_run for scheduling efficiency
- scheduled_reports_created_at_idx: Index on created_at for creation time sorting
- scheduled_reports_created_by_idx: Index on created_by for accountability
- scheduled_reports_org_enabled_idx: Composite index on organization_id and enabled for common queries

**Section sources**
- [0004_snapshot.json](file://packages/audit-db/drizzle/migrations/meta/0004_snapshot.json)
- [resolvers.test.ts](file://apps/server/src/lib/graphql/__tests__/resolvers.test.ts)

### pseudonym_mapping Table

The pseudonym_mapping table provides GDPR-compliant pseudonymization capabilities by securely maintaining the mapping between original identifiers and their pseudonymized counterparts. This enables data subject rights fulfillment while preserving referential integrity in audit logs. The table now includes a strategy column to specify the pseudonymization method used and a unique constraint on original_id to prevent duplicate mappings.

**Field Definitions:**
- **id**: Serial primary key, auto-incrementing identifier
- **timestamp**: Timestamp when the pseudonymization mapping was created
- **pseudonym_id**: The pseudonymized identifier used in place of the original ID
- **original_id**: The encrypted original identifier, stored securely for authorized reversal
- **strategy**: The pseudonymization strategy used (hash, token, encryption)

**Constraints:**
- Primary Key: id
- Not Null Constraints: timestamp, pseudonym_id, original_id, strategy
- Unique Constraint: original_id (ensures each original ID has only one pseudonym mapping)

**Indexes:**
- pseudonym_mapping_timestamp_idx: B-tree index on timestamp for temporal analysis of pseudonymization activities
- pseudonym_mapping_pseudonym_id_idx: B-tree index on pseudonym_id for efficient lookup of pseudonymized IDs
- pseudonym_mapping_original_id_idx: B-tree unique index on original_id for efficient lookup and prevention of duplicate mappings
- pseudonym_mapping_strategy_idx: B-tree index on strategy for querying by pseudonymization method

**Section sources**
- [0007_keen_ego.sql](file://packages/audit-db/drizzle/migrations/0007_keen_ego.sql) - *Added in recent commit*
- [0008_swift_black_panther.sql](file://packages/audit-db/drizzle/migrations/0008_swift_black_panther.sql) - *Added in recent commit*
- [schema.ts](file://packages/audit-db/src/db/schema.ts) - *Updated in recent commit*
- [gdpr-compliance.ts](file://packages/audit/src/gdpr/gdpr-compliance.ts) - *Updated in recent commit*

### organization_role Table

The organization_role table provides role-based access control by defining roles with specific permissions within organizations. Each role is scoped to an organization and contains a set of permissions that define what actions users with that role can perform.

**Field Definitions:**
- **organization_id**: Organization identifier, part of composite primary key and foreign key to organization table
- **name**: Role name, part of composite primary key (e.g., "admin", "member", "viewer")
- **description**: Human-readable description of the role's purpose and responsibilities
- **permissions**: JSONB array containing permission objects with resource and action fields
- **inherits**: JSONB array of role names that this role inherits permissions from

**Constraints:**
- Primary Key: organization_id and name (composite primary key)
- Foreign Key: organization_id references organization.id with cascade delete
- Not Null Constraints: organization_id, name, permissions

**Indexes:**
- organization_role_organization_id_idx: B-tree index on organization_id for organization-based queries
- organization_role_name_idx: B-tree index on name for role-based queries

**Section sources**
- [0005_fluffy_donald_blake.sql](file://packages/auth/drizzle/0005_fluffy_donald_blake.sql) - *Added in recent commit*
- [authz.ts](file://packages/auth/src/db/schema/authz.ts) - *Added in recent commit*
- [permissions.ts](file://packages/auth/src/permissions.ts) - *Contains permission definitions and role logic*

## Sample Data Entries

### audit_log Sample Entries

```json
{
  "id": 1001,
  "timestamp": "2024-01-15T10:30:45.123Z",
  "principal_id": "user-88888",
  "organization_id": "org-medical-001",
  "action": "authentication.mfa.enabled",
  "target_resource_type": "User",
  "target_resource_id": "user-88888",
  "status": "success",
  "outcome_description": "Multi-factor authentication enabled for user account",
  "data_classification": "INTERNAL",
  "retention_policy": "standard",
  "session_context": {
    "session_id": "sess-abc123",
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  },
  "hash": "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890",
  "hash_algorithm": "SHA-256",
  "event_version": "1.0",
  "correlation_id": "auth-mfa-2024-001"
}
```

```json
{
  "id": 1002,
  "timestamp": "2024-01-15T11:15:30.456Z",
  "principal_id": "practitioner-99999",
  "organization_id": "org-medical-001",
  "action": "fhir.patient.access",
  "target_resource_type": "Patient",
  "target_resource_id": "patient-11111",
  "status": "success",
  "outcome_description": "Accessed patient chart during emergency",
  "data_classification": "PHI",
  "retention_policy": "phi_extended",
  "clinical_context": {
    "encounter_id": "enc-77777",
    "reason_for_visit": "Emergency consultation",
    "access_purpose": "TREATMENT"
  },
  "hash": "f6e5d4c3b2a10987f6e5d4c3b2a10987f6e5d4c3b2a10987f6e5d4c3b2a10987",
  "event_version": "1.0",
  "correlation_id": "fhir-access-2024-001"
}
```

### audit_integrity_log Sample Entry

```json
{
  "id": 501,
  "audit_log_id": 1001,
  "verification_timestamp": "2024-01-16T02:00:00.000Z",
  "verification_status": "SUCCESS",
  "verification_details": {
    "algorithm": "SHA-256",
    "block_chain_verification": true,
    "signature_valid": true
  },
  "verified_by": "integrity-service",
  "hash_verified": "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890",
  "expected_hash": "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890"
}
```

### audit_retention_policy Sample Entries

```json
[
  {
    "policy_name": "standard",
    "retention_days": 2555,
    "archive_after_days": 365,
    "data_classification": "INTERNAL",
    "description": "Standard retention policy for internal audit data",
    "created_by": "system"
  },
  {
    "policy_name": "phi_extended",
    "retention_days": 2555,
    "archive_after_days": 365,
    "data_classification": "PHI",
    "description": "Extended retention policy for PHI data to meet HIPAA requirements",
    "created_by": "system"
  },
  {
    "policy_name": "minimal",
    "retention_days": 90,
    "archive_after_days": 30,
    "data_classification": "PUBLIC",
    "description": "Minimal retention policy for public data",
    "created_by": "system"
  },
  {
    "policy_name": "confidential",
    "retention_days": 1825,
    "archive_after_days": 365,
    "data_classification": "CONFIDENTIAL",
    "description": "Extended retention policy for confidential business data",
    "created_by": "system"
  }
]
```

### alerts Sample Entry

```json
{
  "id": 2001,
  "alert_type": "SECURITY",
  "severity": "HIGH",
  "title": "Multiple Failed Login Attempts",
  "description": "Detected 15 failed login attempts from suspicious IP address within 5 minutes",
  "source": "security-monitor",
  "status": "ACTIVE",
  "count": 15,
  "error_rate": "100",
  "trend": "INCREASING",
  "first_occurrence": "2024-01-15T09:30:15.000Z",
  "last_occurrence": "2024-01-15T09:35:22.000Z",
  "affected_components": ["authentication-service", "user-database"],
  "affected_users": ["user-001", "user-002", "user-003"],
  "samples": ["evt-98765", "evt-98764", "evt-98763"],
  "created_at": "2024-01-15T09:35:30.000Z"
}
```

### scheduled_reports Sample Entry

```json
{
  "id": 3001,
  "organization_id": "org-medical-001",
  "report_type": "WEEKLY_COMPLIANCE",
  "template_id": "tpl-compliance-weekly-001",
  "name": "Weekly HIPAA Compliance Report",
  "description": "Weekly summary of PHI access events and compliance metrics",
  "filters": {
    "data_classification": ["PHI"],
    "actions": ["fhir.*", "patient.*"],
    "time_range": "LAST_7_DAYS"
  },
  "recipients": ["compliance@medical.org", "security@medical.org"],
  "frequency": "WEEKLY",
  "format": "PDF",
  "enabled": true,
  "next_run": "2024-01-22T01:00:00.000Z",
  "created_at": "2024-01-01T10:00:00.000Z",
  "created_by": "admin-001"
}
```

### pseudonym_mapping Sample Entry

```json
{
  "id": 101,
  "timestamp": "2024-01-16T08:30:00.000Z",
  "pseudonym_id": "pseudo-a1b2c3d4e5f67890",
  "original_id": "encrypted:user-123:salt123",
  "strategy": "hash"
}
```

### organization_role Sample Entry

```json
{
  "organization_id": "org-medical-001",
  "name": "org:admin",
  "description": "Organization administrator with full access to audit system",
  "permissions": [
    {
      "resource": "audit.events",
      "action": "read"
    },
    {
      "resource": "audit.events",
      "action": "create"
    },
    {
      "resource": "audit.events",
      "action": "update"
    },
    {
      "resource": "audit.events",
      "action": "delete"
    },
    {
      "resource": "audit.reports",
      "action": "read"
    },
    {
      "resource": "audit.reports",
      "action": "create"
    }
  ],
  "inherits": []
}
```

**Section sources**
- [migration-utils.ts](file://packages/audit-db/src/migration-utils.ts)
- [basic-usage.ts](file://packages/audit-sdk/examples/basic-usage.ts)
- [examples.ts](file://packages/audit-sdk/src/__tests__/examples.ts)
- [0006_silly_tyger_tiger.sql](file://packages/audit-db/drizzle/migrations/0006_silly_tyger_tiger.sql) - *Added in recent commit*
- [gdpr-compliance.ts](file://packages/audit/src/gdpr/gdpr-compliance.ts) - *Updated in recent commit*
- [0005_fluffy_donald_blake.sql](file://packages/auth/drizzle/0005_fluffy_donald_blake.sql) - *Added in recent commit*
- [authz.ts](file://packages/auth/src/db/schema/authz.ts) - *Added in recent commit*
- [0007_keen_ego.sql](file://packages/audit-db/drizzle/migrations/0007_keen_ego.sql) - *Added in recent commit*
- [0008_swift_black_panther.sql](file://packages/audit-db/drizzle/migrations/0008_swift_black_panther.sql) - *Added in recent commit*

## Constraints and Indexes

The audit database schema implements comprehensive constraints and indexes to ensure data integrity, enforce business rules, and optimize query performance.

### Primary Keys
- All tables have a serial primary key named "id" for unique record identification
- audit_log.id: Primary key with auto-increment
- audit_integrity_log.id: Primary key with auto-increment
- audit_retention_policy.id: Primary key with auto-increment
- audit_presets.id: Primary key with auto-increment
- alerts.id: Primary key with auto-increment
- scheduled_reports.id: Primary key with auto-increment
- pseudonym_mapping.id: Primary key with auto-increment
- organization_role: Composite primary key on organization_id and name

### Foreign Keys
- audit_integrity_log.audit_log_id references audit_log.id: Ensures integrity records only reference existing audit events
- organization_role.organization_id references organization.id: Ensures roles are associated with valid organizations
- Other relationships are maintained through logical references rather than foreign keys to maintain performance in high-volume logging scenarios

### Unique Constraints
- audit_retention_policy.policy_name: Ensures policy names are unique
- audit_presets.name: Ensures preset names are unique
- pseudonym_mapping.original_id: Ensures each original ID has only one pseudonym mapping (added in recent update)
- organization_role: Composite primary key ensures unique role names within each organization

### Check Constraints
- Various fields have domain-specific constraints enforced at the application level through validation rules in the audit SDK
- Data classification fields are restricted to predefined values: INTERNAL, PHI, CONFIDENTIAL, PUBLIC

### Indexes
The schema includes numerous indexes to optimize common query patterns:

**audit_log Indexes:**
- audit_log_timestamp_idx: B-tree index on timestamp for time-range queries
- audit_log_principal_id_idx: B-tree index on principal_id for user activity analysis
- audit_log_action_idx: B-tree index on action for operation type filtering
- audit_log_status_idx: B-tree index on status for success/failure reporting
- audit_log_correlation_id_idx: B-tree index on correlation_id for distributed tracing
- audit_log_data_classification_idx: B-tree index on data_classification for compliance queries
- audit_log_retention_policy_idx: B-tree index on retention_policy for lifecycle management
- audit_log_archived_at_idx: B-tree index on archived_at for archival status

**audit_integrity_log Indexes:**
- audit_integrity_log_audit_log_id_idx: B-tree index on audit_log_id for event lookup
- audit_integrity_log_verification_timestamp_idx: B-tree index on verification_timestamp for temporal analysis
- audit_integrity_log_verification_status_idx: B-tree index on verification_status for health monitoring
- audit_integrity_log_verified_by_idx: B-tree index on verified_by for accountability

**audit_retention_policy Indexes:**
- audit_retention_policy_policy_name_idx: B-tree index on policy_name for direct lookup
- audit_retention_policy_data_classification_idx: B-tree index on data_classification for classification-based queries
- audit_retention_policy_is_active_idx: B-tree index on is_active for active policy filtering

**alerts Indexes:**
- alerts_alert_type_idx: B-tree index on alert_type for category filtering
- alerts_severity_idx: B-tree index on severity for priority sorting
- alerts_status_idx: B-tree index on status for workflow management
- alerts_first_occurrence_idx: B-tree index on first_occurrence for temporal analysis
- alerts_last_occurrence_idx: B-tree index on last_occurrence for recency filtering
- alerts_resolved_at_idx: B-tree index on resolved_at for resolution tracking

**scheduled_reports Indexes:**
- scheduled_reports_organization_id_idx: B-tree index on organization_id for organizational filtering
- scheduled_reports_template_id_idx: B-tree index on template_id for template-based queries
- scheduled_reports_enabled_idx: B-tree index on enabled for active schedule filtering
- scheduled_reports_next_run_idx: B-tree index on next_run for scheduling efficiency
- scheduled_reports_created_at_idx: B-tree index on created_at for creation time sorting
- scheduled_reports_created_by_idx: B-tree index on created_by for accountability
- scheduled_reports_org_enabled_idx: Composite index on organization_id and enabled for common queries

**pseudonym_mapping Indexes:**
- pseudonym_mapping_timestamp_idx: B-tree index on timestamp for temporal analysis of pseudonymization activities
- pseudonym_mapping_pseudonym_id_idx: B-tree index on pseudonym_id for efficient lookup of pseudonymized IDs
- pseudonym_mapping_original_id_idx: B-tree unique index on original_id for efficient lookup and prevention of duplicate mappings
- pseudonym_mapping_strategy_idx: B-tree index on strategy for querying by pseudonymization method

**organization_role Indexes:**
- organization_role_organization_id_idx: B-tree index on organization_id for organization-based queries
- organization_role_name_idx: B-tree index on name for role-based queries

**Section sources**
- [0004_snapshot.json](file://packages/audit-db/drizzle/migrations/meta/0004_snapshot.json)
- [0003_snapshot.json](file://packages/audit-db/drizzle/migrations/meta/0003_snapshot.json)
- [0006_silly_tyger_tiger.sql](file://packages/audit-db/drizzle/migrations/0006_silly_tyger_tiger.sql) - *Added in recent commit*
- [0005_fluffy_donald_blake.sql](file://packages/auth/drizzle/0005_fluffy_donald_blake.sql) - *Added in recent commit*
- [0007_keen_ego.sql](file://packages/audit-db/drizzle/migrations/0007_keen_ego.sql) - *Added in recent commit*
- [0008_swift_black_panther.sql](file://packages/audit-db/drizzle/migrations/0008_swift_black_panther.sql) - *Added in recent commit*

## Data Validation and Business Logic

The audit database schema incorporates several layers of data validation and business logic to ensure data quality and compliance with regulatory requirements.

### Data Classification Rules
The system implements a data classification framework with four levels:
- **PUBLIC**: Information that can be freely shared
- **INTERNAL**: General internal information not intended for public disclosure
- **CONFIDENTIAL**: Sensitive business information requiring protection
- **PHI**: Protected Health Information subject to HIPAA regulations

Each classification level has associated retention policies and access controls. The schema defaults to "INTERNAL" classification for events that don't specify a classification.

### Retention Policy Management
Retention policies are defined in the audit_retention_policy table and applied to audit events based on their data classification. The system automatically applies the appropriate policy when events are logged. Default policies are inserted during database initialization:

- **standard**: 7 years retention (2555 days) for internal data
- **phi_extended**: 7 years retention (2555 days) for PHI data, meeting HIPAA requirements
- **minimal**: 3 months retention (90 days) for public data
- **confidential**: 5 years retention (1825 days) for confidential business data

### Integrity Verification Process
The system implements cryptographic integrity verification through:
- SHA-256 hashing of audit event data
- Storage of hashes in the audit_log table
- Periodic verification recorded in audit_integrity_log
- Comparison of stored vs. recalculated hashes to detect tampering

### Event Versioning
The event_version field allows for schema evolution while maintaining backward compatibility. The current default version is "1.0", and future versions can introduce new fields or modify existing ones while preserving the ability to process historical events.

### Partitioning Strategy
The audit_log table uses range partitioning by timestamp to optimize performance:
- Partitions are created monthly
- Recent partitions remain in high-performance storage
- Older partitions can be moved to cost-effective storage
- Query performance is maintained for recent data while historical data remains accessible

### GDPR Pseudonymization
The system implements GDPR-compliant pseudonymization through the pseudonym_mapping table:
- Original identifiers are replaced with pseudonymized IDs in audit logs
- A secure mapping is maintained between original and pseudonymized IDs
- Original IDs are encrypted before storage in the mapping table
- Pseudonymization supports multiple strategies: deterministic hashing, random tokens, and encryption
- Authorized personnel can reverse the mapping for compliance investigations
- The system maintains referential integrity while protecting data subject privacy
- The pseudonym_mapping table now includes a strategy column to specify the pseudonymization method used
- A unique constraint on original_id prevents duplicate mappings and ensures data integrity

### Role-Based Access Control
The system implements role-based access control through the organization_role table:
- Roles are defined at the organization level with specific permissions
- Each role contains a JSONB array of permissions specifying allowed resources and actions
- Roles can inherit permissions from other roles through the inherits field
- Permissions follow a hierarchical structure where more specific permissions override inherited ones
- The system caches role permissions in Redis for performance optimization
- Role changes are automatically synchronized between database and cache
- Permission checks are performed with a 5-minute cache retention period to balance security and performance

### Compliance Features
The schema includes several features specifically designed for regulatory compliance:
- **Data Classification**: Explicit tagging of data sensitivity
- **Retention Policies**: Configurable retention periods based on regulations
- **Integrity Verification**: Tamper-evident logging
- **Audit Presets**: Standardized event formats for consistent logging
- **Correlation IDs**: End-to-end tracing of related operations
- **Immutable Records**: Once written, audit records cannot be modified
- **GDPR Pseudonymization**: Secure handling of personal data for data subject rights fulfillment
- **Role-Based Access Control**: Granular permission system for audit data access

These features collectively ensure that the audit system meets requirements for healthcare compliance standards including HIPAA, GDPR, and other data protection regulations.

**Section sources**
- [migration-utils.ts](file://packages/audit-db/src/migration-utils.ts)
- [basic-usage.ts](file://packages/audit-sdk/examples/basic-usage.ts)
- [partitioning.ts](file://packages/audit-db/src/db/partitioning.ts)
- [0006_silly_tyger_tiger.sql](file://packages/audit-db/drizzle/migrations/0006_silly_tyger_tiger.sql) - *Added in recent commit*
- [gdpr-compliance.ts](file://packages/audit/src/gdpr/gdpr-compliance.ts) - *Updated in recent commit*
- [gdpr-utils.ts](file://packages/audit/src/gdpr/gdpr-utils.ts) - *Updated in recent commit*
- [0005_fluffy_donald_blake.sql](file://packages/auth/drizzle/0005_fluffy_donald_blake.sql) - *Added in recent commit*
- [authz.ts](file://packages/auth/src/db/schema/authz.ts) - *Added in recent commit*
- [permissions.ts](file://packages/auth/src/permissions.ts) - *Contains permission definitions and role logic*
- [0007_keen_ego.sql](file://packages/audit-db/drizzle/migrations/0007_keen_ego.sql) - *Added in recent commit*
- [0008_swift_black_panther.sql](file://packages/audit-db/drizzle/migrations/0008_swift_black_panther.sql) - *Added in recent commit*