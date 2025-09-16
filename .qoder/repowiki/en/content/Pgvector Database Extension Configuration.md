# Pgvector Database Extension Configuration

<cite>
**Referenced Files in This Document**   
- [docker-compose.yml](file://docker/pgvector/docker-compose.yml)
- [postgres.conf](file://docker/pgvector/postgres.conf)
- [01-init-audit-db.sql](file://apps/server/init-scripts/01-init-audit-db.sql)
- [performance-monitoring.ts](file://packages/audit-db/src/db/performance-monitoring.ts)
- [enhanced-client.ts](file://packages/audit-db/src/db/enhanced-client.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document provides comprehensive documentation for pgvector integration within the SMEDREC Audit Server ecosystem. It covers the purpose of pgvector, PostgreSQL configuration requirements, vector indexing strategies, query patterns, performance considerations, and migration guidance. The pgvector extension enables efficient storage and querying of vector embeddings in PostgreSQL, facilitating advanced similarity search capabilities for audit data analysis.

## Project Structure
The pgvector configuration is organized within a dedicated Docker environment that integrates with the main application stack. The structure includes configuration files for PostgreSQL with pgvector support and initialization scripts for database setup.

```mermaid
graph TB
subgraph "Docker Configuration"
PGV[docker/pgvector]
PGV --> DC[docker-compose.yml]
PGV --> PC[postgres.conf]
end
subgraph "Database Initialization"
IS[init-scripts]
IS --> IA[01-init-audit-db.sql]
end
subgraph "Application Layer"
AD[audit-db]
AD --> PM[performance-monitoring.ts]
AD --> EC[enhanced-client.ts]
end
DC --> PGV
PC --> PGV
IA --> IS
PM --> AD
EC --> AD
```

**Diagram sources**
- [docker-compose.yml](file://docker/pgvector/docker-compose.yml)
- [postgres.conf](file://docker/pgvector/postgres.conf)
- [01-init-audit-db.sql](file://apps/server/init-scripts/01-init-audit-db.sql)

**Section sources**
- [docker-compose.yml](file://docker/pgvector/docker-compose.yml)
- [postgres.conf](file://docker/pgvector/postgres.conf)

## Core Components
The core components of the pgvector integration include the Docker configuration for the PostgreSQL container with pgvector extension, the PostgreSQL configuration file that enables necessary extensions, and the database initialization script that sets up the required environment. These components work together to provide a robust vector database capability for the audit system.

**Section sources**
- [docker-compose.yml](file://docker/pgvector/docker-compose.yml)
- [postgres.conf](file://docker/pgvector/postgres.conf)
- [01-init-audit-db.sql](file://apps/server/init-scripts/01-init-audit-db.sql)

## Architecture Overview
The architecture implements pgvector as a PostgreSQL extension within a Docker container, integrated with the Electric SQL replication system. The setup provides vector similarity search capabilities while maintaining compatibility with existing database operations and monitoring tools.

```mermaid
graph TB
subgraph "Application Layer"
Web[Web Application]
Server[Audit Server]
end
subgraph "Database Layer"
PGV[PostgreSQL with pgvector]
ESQL[Electric SQL]
end
subgraph "Infrastructure"
Redis[Redis Cache]
Monitoring[Monitoring System]
end
Web --> Server
Server --> PGV
Server --> Redis
PGV --> ESQL
PGV --> Monitoring
ESQL --> PGV
style PGV fill:#f9f,stroke:#333
style ESQL fill:#bbf,stroke:#333
```

**Diagram sources**
- [docker-compose.yml](file://docker/pgvector/docker-compose.yml)
- [01-init-audit-db.sql](file://apps/server/init-scripts/01-init-audit-db.sql)

## Detailed Component Analysis

### Pgvector Configuration Analysis
The pgvector configuration is implemented through Docker Compose, specifying the pgvector/pgvector:pg17 image with appropriate environment variables and volume mappings. The configuration exposes port 25432 and includes health checks to ensure database availability before dependent services start.

#### Configuration Parameters:
```mermaid
classDiagram
class PgvectorConfig {
+string image : pgvector/pgvector : pg17
+string container_name : pgvector
+string restart : always
+string[] ports : ['25432 : 5432']
+string[] volumes : [pgvector : /var/lib/postgresql/data]
+string command : postgres -c shared_preload_libraries='pg_stat_statements' -c wal_level=logical
}
class HealthCheckConfig {
+string[] test : ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER} -d ${AUDIT_DB}']
+string interval : 10s
+string timeout : 5s
+int retries : 5
}
class ElectricConfig {
+string image : docker.io/electricsql/electric : latest
+string container_name : electric
+string DATABASE_URL : postgresql : //${POSTGRES_USER} : ${POSTGRES_PASSWORD}@postgres : 5432/${AUDIT_DB}?sslmode=disable
+boolean ELECTRIC_INSECURE : true
}
PgvectorConfig --> HealthCheckConfig : "has"
PgvectorConfig --> ElectricConfig : "depends on"
```

**Diagram sources**
- [docker-compose.yml](file://docker/pgvector/docker-compose.yml)

### PostgreSQL Configuration Analysis
The PostgreSQL configuration file enables essential extensions and settings for optimal pgvector performance. It configures the database to support logical replication and statement statistics collection, which are critical for monitoring and performance optimization.

#### Key Configuration Settings:
```mermaid
flowchart TD
Start([PostgreSQL Configuration]) --> Listen["listen_addresses = '*'"]
Listen --> WalLevel["wal_level = logical"]
WalLevel --> SharedLibs["shared_preload_libraries = 'pg_stat_statements'"]
SharedLibs --> End([Configuration Complete])
style Listen fill:#f9f,stroke:#333
style WalLevel fill:#f9f,stroke:#333
style SharedLibs fill:#f9f,stroke:#333
```

**Diagram sources**
- [postgres.conf](file://docker/pgvector/postgres.conf)

### Database Initialization Analysis
The database initialization script creates necessary extensions, schemas, and users for the audit system. It establishes proper permissions and configuration settings to support pgvector operations and ensures the database is properly configured for production use.

#### Initialization Workflow:
```mermaid
sequenceDiagram
participant Script as Initialization Script
participant DB as PostgreSQL
participant User as audit_app_user
Script->>DB : CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
Script->>DB : CREATE EXTENSION IF NOT EXISTS "pgcrypto"
Script->>DB : CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"
Script->>DB : CREATE SCHEMA IF NOT EXISTS audit
Script->>DB : ALTER DATABASE audit_db SET search_path
Script->>DB : CREATE ROLE audit_app_user (if not exists)
Script->>DB : GRANT CONNECT ON DATABASE audit_db
Script->>DB : GRANT USAGE ON SCHEMAS
Script->>DB : ALTER DEFAULT PRIVILEGES
Script->>DB : ALTER SYSTEM SET configurations
Script->>DB : SELECT pg_reload_conf()
```

**Diagram sources**
- [01-init-audit-db.sql](file://apps/server/init-scripts/01-init-audit-db.sql)

## Dependency Analysis
The pgvector implementation has dependencies on several components within the system architecture. The primary dependency is on PostgreSQL 17 with the pgvector extension, which provides the vector storage and similarity search capabilities. The Electric SQL service depends on the pgvector container and requires it to be healthy before starting. The audit application server depends on both the database and caching layers to provide complete functionality.

```mermaid
graph TD
Electric --> Postgres
Postgres --> Volume
Postgres --> Network
Server --> Postgres
Server --> Redis
Monitoring --> Postgres
style Postgres fill:#f9f,stroke:#333
style Electric fill:#bbf,stroke:#333
classDef database fill:#f9f,stroke:#333;
classDef service fill:#bbf,stroke:#333;
class Postgres database
class Electric service
```

**Diagram sources**
- [docker-compose.yml](file://docker/pgvector/docker-compose.yml)
- [01-init-audit-db.sql](file://apps/server/init-scripts/01-init-audit-db.sql)

## Performance Considerations
The system includes comprehensive performance monitoring capabilities that can be leveraged for pgvector operations. The performance monitoring module collects index usage statistics, query execution metrics, and system resource utilization to identify optimization opportunities for vector queries.

```mermaid
flowchart TD
A[Query Execution] --> B{Performance Monitoring}
B --> C[Collect Execution Time]
B --> D[Collect Memory Usage]
B --> E[Store Query Metrics]
C --> F[Analyze Slow Queries]
D --> F
E --> F
F --> G{Optimization Needed?}
G --> |Yes| H[Generate Recommendations]
G --> |No| I[Continue Monitoring]
H --> J[Add Indexes]
H --> K[Optimize Queries]
H --> L[Adjust Configuration]
```

**Diagram sources**
- [performance-monitoring.ts](file://packages/audit-db/src/db/performance-monitoring.ts)
- [enhanced-client.ts](file://packages/audit-db/src/db/enhanced-client.ts)

## Troubleshooting Guide
When troubleshooting pgvector integration issues, check the following common problem areas:

1. **Container Health**: Verify the pgvector container is running and passing health checks
2. **Extension Loading**: Ensure pgvector extension is properly loaded in PostgreSQL
3. **Network Configuration**: Confirm network settings allow communication between services
4. **Resource Limits**: Check memory and CPU allocation for the database container
5. **Index Performance**: Monitor vector index usage and query performance

**Section sources**
- [docker-compose.yml](file://docker/pgvector/docker-compose.yml)
- [postgres.conf](file://docker/pgvector/postgres.conf)
- [01-init-audit-db.sql](file://apps/server/init-scripts/01-init-audit-db.sql)

## Conclusion
The pgvector integration provides powerful vector database capabilities for the SMEDREC Audit Server, enabling advanced similarity search and analysis of audit data. The configuration is robust, with proper Docker setup, PostgreSQL configuration, and initialization scripts. The system is designed with performance monitoring and optimization in mind, ensuring efficient operation of vector queries. Future enhancements could include specialized vector indexing strategies and optimized query patterns for specific use cases.