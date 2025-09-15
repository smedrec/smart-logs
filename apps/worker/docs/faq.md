# Technical FAQ

Comprehensive frequently asked questions for developers, system administrators, and technical users of the Smart Logs Audit Worker.

## Table of Contents

1. [General Architecture](#general-architecture)
2. [Configuration Management](#configuration-management)
3. [Performance and Scaling](#performance-and-scaling)
4. [Database and Storage](#database-and-storage)
5. [Security and Compliance](#security-and-compliance)
6. [Monitoring and Observability](#monitoring-and-observability)
7. [Development and Integration](#development-and-integration)
8. [Troubleshooting](#troubleshooting)
9. [Deployment and Operations](#deployment-and-operations)
10. [Best Practices](#best-practices)

## General Architecture

### Q: What is the Smart Logs Audit Worker?

**A:** The Smart Logs Audit Worker is an enterprise-grade, high-performance microservice designed for processing, storing, and managing audit events in compliance-sensitive environments. It features:

- **Event Processing**: BullMQ-based reliable event processing with circuit breaker patterns
- **Database Layer**: Enhanced PostgreSQL integration with partitioning and monitoring
- **Configuration Management**: S3-based centralized configuration with hot reloading
- **Security**: End-to-end encryption, key rotation, and comprehensive audit trails
- **Monitoring**: Built-in observability with Prometheus, Grafana, and health check endpoints
- **Compliance**: HIPAA, GDPR, and SOX compliance features

### Q: How does the worker differ from traditional audit logging solutions?

**A:** Key differentiators include:

| Feature | Traditional Solutions | Smart Logs Audit Worker |
|---------|----------------------|--------------------------|
| Configuration | Static environment variables | Dynamic S3-based configuration with hot reload |
| Scalability | Limited horizontal scaling | Auto-scaling with Kubernetes HPA/VPA |
| Reliability | Basic retry mechanisms | Circuit breaker, dead letter queues, batch processing |
| Compliance | Basic audit logging | HIPAA, GDPR compliance with data lineage tracking |
| Monitoring | Basic health checks | Comprehensive observability with bottleneck analysis |
| Security | Basic encryption | Advanced encryption with automatic key rotation |

### Q: What are the core components and how do they interact?

**A:** The architecture consists of:

```mermaid
graph TD
    A[Event Producer] --> B[Redis Queue]
    B --> C[Reliable Event Processor]
    C --> D[Enhanced Database Client]
    D --> E[PostgreSQL]
    
    F[ConfigurationManager] --> C
    F --> D
    
    G[Security Manager] --> C
    G --> D
    
    H[Monitoring Stack] --> C
    H --> D
    H --> I[Observability Dashboard]
    
    J[Health Check Manager] --> K[Load Balancer]
```

**Component Responsibilities:**

- **ConfigurationManager**: Loads and manages configuration from S3, supports hot reloading
- **ReliableEventProcessor**: Processes events with retry logic, circuit breaker, and batching  
- **EnhancedDatabaseClient**: Optimized database operations with connection pooling and monitoring
- **SecurityManager**: Handles encryption, key rotation, and data integrity
- **MonitoringStack**: Comprehensive metrics collection and performance analysis
- **HealthCheckManager**: Multi-component health monitoring for load balancing

### Q: What technologies and frameworks are used?

**A:** Technology stack:

- **Runtime**: Node.js 18+ with TypeScript 5.0+
- **Queue System**: BullMQ (Redis-based) with priority queues
- **Database**: PostgreSQL 14+ with Drizzle ORM
- **Cache Layer**: Redis 6.0+ (standalone or cluster)
- **Configuration**: S3-compatible storage (AWS S3, MinIO)
- **Monitoring**: Prometheus, Grafana, custom observability endpoints
- **Security**: AES-256-GCM encryption, AWS KMS integration
- **Testing**: Vitest for unit and integration testing
- **Container**: Docker with multi-stage builds

## Configuration Management

### Q: Why use S3-based configuration instead of environment variables?

**A:** S3-based configuration offers several advantages:

**Benefits:**
- **Centralized Management**: Single source of truth for all environments
- **Hot Reloading**: Configuration changes without service restart
- **Version Control**: S3 object versioning for configuration history
- **Security**: Environment variable substitution keeps secrets out of config files
- **Validation**: JSON schema validation before applying changes
- **Rollback**: Easy rollback to previous configurations

**Traditional Environment Variables:**
```bash
# Static, requires restart to change
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
BATCH_SIZE=100
```

**S3-Based Configuration:**
```bash
# Dynamic, supports hot reload
CONFIG_PATH="s3://config-bucket/worker/config.json"
# Secrets still via environment variables
DB_PASSWORD="${DATABASE_PASSWORD}"
```

### Q: How does hot reloading work and is it safe?

**A:** Hot reloading process:

1. **Change Detection**: ConfigurationManager polls S3 for object modifications
2. **Validation**: New configuration is validated against JSON schema
3. **Gradual Application**: Changes applied component by component
4. **Health Monitoring**: System health monitored during updates
5. **Rollback**: Automatic rollback if validation or health checks fail

**Safety Mechanisms:**
```typescript
interface HotReloadSafety {
  validationFirst: boolean;        // Validate before applying
  gradualRollout: boolean;         // Apply changes incrementally
  healthMonitoring: boolean;       // Monitor during changes
  automaticRollback: boolean;      // Rollback on failures
  rollbackTimeout: number;         // Time limit for rollback
}
```

**Safe for Production:**
- Non-disruptive configuration changes
- Automatic validation and rollback
- Audit trail of all configuration changes
- Support for blue-green deployments

### Q: How do I manage secrets in S3-based configuration?

**A:** Best practices for secret management:

**❌ Never Store Secrets in Configuration:**
```json
{
  "database": {
    "password": "actual-password"  // NEVER DO THIS
  }
}
```

**✅ Use Environment Variable Substitution:**
```json
{
  "database": {
    "connectionString": "postgresql://user:${DB_PASSWORD}@host:5432/db"
  },
  "redis": {
    "password": "${REDIS_PASSWORD}"
  }
}
```

**Integration with Secret Managers:**
```bash
# AWS Secrets Manager
export DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id prod/audit-worker/db \
  --query SecretString --output text | jq -r .password)

# HashiCorp Vault
export DB_PASSWORD=$(vault kv get -field=password secret/audit-worker/db)

# Kubernetes Secrets
kubectl create secret generic audit-worker-secrets \
  --from-literal=db-password="$DB_PASSWORD"
```

### Q: What happens if S3 is unavailable during startup?

**A:** The worker implements several fallback mechanisms:

**Startup Sequence:**
1. **Primary**: Load from S3
2. **Fallback 1**: Use cached configuration from previous startup
3. **Fallback 2**: Use embedded default configuration
4. **Fallback 3**: Fail with clear error message

**Configuration:**
```json
{
  "configurationManager": {
    "fallbackEnabled": true,
    "cacheConfiguration": true,
    "cacheLocation": "/tmp/config-cache.json",
    "startupTimeout": 60000,
    "retryAttempts": 3
  }
}
```

**S3 Availability Options:**
- **High Availability**: Use S3 Cross-Region Replication
- **Alternative Storage**: Support for MinIO or other S3-compatible storage
- **Local Cache**: Configuration cached locally for offline operation

## Performance and Scaling

### Q: What performance can I expect?

**A:** Performance benchmarks:

| Scenario | Events/Second | Latency (P95) | Memory Usage | CPU Usage |
|----------|---------------|---------------|--------------|-----------|
| Baseline | 1,000 | <100ms | <512MB | <50% |
| High Throughput | 10,000 | <200ms | <1GB | <75% |
| Peak Load | 50,000 | <500ms | <2GB | <90% |

**Factors Affecting Performance:**
- **Event Size**: Larger events require more processing time
- **Database Performance**: Connection pool size and query optimization
- **Redis Performance**: Network latency and Redis configuration
- **Concurrency**: Higher concurrency increases throughput but uses more memory
- **Batch Size**: Larger batches improve throughput but increase latency

### Q: How do I optimize for high throughput?

**A:** High-throughput optimization strategies:

**1. Batch Processing Configuration:**
```json
{
  "reliableProcessor": {
    "concurrency": 100,
    "batchProcessing": {
      "enabled": true,
      "batchSize": 500,
      "maxBatchWaitMs": 1000,
      "parallelBatches": 20
    }
  }
}
```

**2. Database Optimization:**
```json
{
  "enhancedClient": {
    "maxConnections": 200,
    "partitioning": {
      "enabled": true,
      "partitionBy": "month",
      "parallelPartitions": 12
    }
  }
}
```

**3. Redis Optimization:**
```json
{
  "redis": {
    "pipelining": {
      "enabled": true,
      "batchSize": 100
    },
    "cluster": {
      "enabled": true
    }
  }
}
```

**4. Memory Optimization:**
```bash
export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"
```

### Q: How does auto-scaling work?

**A:** Multi-layer auto-scaling approach:

**Horizontal Pod Autoscaling (HPA):**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: audit-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: audit-worker
  minReplicas: 3
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: queue_depth
      target:
        type: AverageValue
        averageValue: "1000"
```

**Application-Level Auto-scaling:**
```json
{
  "reliableProcessor": {
    "autoScaling": {
      "enabled": true,
      "strategy": "queue-depth",
      "thresholds": {
        "scaleUp": 1000,
        "scaleDown": 100,
        "maxConcurrency": 200
      }
    }
  }
}
```

**Database Auto-scaling:**
- Read replica auto-scaling based on connection pool utilization
- Connection pool size adjustment based on latency metrics
- Partition management for large datasets

### Q: What are the resource requirements?

**A:** Resource requirements by deployment size:

**Small Deployment (< 1K events/sec):**
- **CPU**: 0.5 cores
- **Memory**: 512MB
- **Storage**: 10GB
- **Database**: Single PostgreSQL instance
- **Redis**: Single Redis instance

**Medium Deployment (1K-10K events/sec):**
- **CPU**: 2 cores
- **Memory**: 2GB
- **Storage**: 100GB
- **Database**: PostgreSQL with read replicas
- **Redis**: Redis cluster (3 nodes)

**Large Deployment (10K+ events/sec):**
- **CPU**: 4+ cores  
- **Memory**: 4GB+
- **Storage**: 1TB+
- **Database**: PostgreSQL cluster with partitioning
- **Redis**: Redis cluster (6+ nodes)

## Database and Storage

### Q: Why PostgreSQL and how is it optimized?

**A:** PostgreSQL advantages for audit workloads:

**ACID Compliance**: Critical for audit data integrity
**Advanced Indexing**: Support for various index types (B-tree, GIN, GIST)
**Partitioning**: Native table partitioning for large datasets
**JSON Support**: Efficient storage and querying of JSON audit events
**Replication**: Built-in streaming replication for high availability

**Optimizations Applied:**
```sql
-- Partitioned audit logs table
CREATE TABLE audit_logs (
  id BIGSERIAL,
  timestamp TIMESTAMPTZ NOT NULL,
  principal_id TEXT NOT NULL,
  action TEXT NOT NULL,
  data JSONB,
  hash TEXT NOT NULL
) PARTITION BY RANGE (timestamp);

-- Optimized indexes
CREATE INDEX idx_audit_logs_timestamp ON audit_logs (timestamp);
CREATE INDEX idx_audit_logs_principal ON audit_logs (principal_id);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_data ON audit_logs USING GIN (data);

-- Monthly partitions
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs 
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Q: How does database partitioning work?

**A:** Automatic partitioning strategy:

**Time-Based Partitioning:**
- **Default**: Monthly partitions
- **Automatic Creation**: New partitions created before current month ends
- **Retention Policy**: Old partitions dropped based on configuration
- **Query Optimization**: Partition pruning for better performance

**Configuration:**
```json
{
  "enhancedClient": {
    "partitioning": {
      "enabled": true,
      "partitionBy": "month",
      "retentionMonths": 24,
      "automaticCreation": true,
      "compressionEnabled": true,
      "compressionAfterDays": 30
    }
  }
}
```

**Benefits:**
- **Query Performance**: Only relevant partitions scanned
- **Maintenance**: VACUUM and ANALYZE run on smaller datasets
- **Storage**: Old partitions can be compressed or archived
- **Compliance**: Easy data retention policy enforcement

### Q: How do I handle database migrations?

**A:** Migration strategy with Drizzle ORM:

**Schema Evolution:**
```typescript
// migrations/0001_initial.sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  principal_id TEXT NOT NULL,
  action TEXT NOT NULL,
  data JSONB
);

// migrations/0002_add_hash.sql  
ALTER TABLE audit_logs ADD COLUMN hash TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_audit_logs_hash ON audit_logs (hash);
```

**Migration Execution:**
```bash
# Run migrations
pnpm -F worker db:migrate

# Rollback if needed
pnpm -F worker db:rollback

# Verify migration status
pnpm -F worker db:status
```

**Zero-Downtime Migrations:**
- Use `CREATE INDEX CONCURRENTLY` for new indexes
- Add columns with default values first, then remove defaults
- Use blue-green deployment for major schema changes
- Test migrations on staging data first

### Q: What backup and recovery strategies are recommended?

**A:** Comprehensive backup strategy:

**Database Backups:**
```bash
# Continuous WAL archiving
archive_mode = on
archive_command = 'aws s3 cp %p s3://backup-bucket/wal/%f'

# Daily base backups
pg_basebackup -h localhost -U postgres -D backup-$(date +%Y%m%d) -Ft -z -P

# Point-in-time recovery
pg_restore --host=db-host --username=audit_user --dbname=audit_db_restored \
  --clean --if-exists backup-file.tar
```

**Configuration Backups:**
```bash
# Automated configuration backup
aws s3 cp s3://config-bucket/worker/config.json \
          s3://backup-bucket/config/config-$(date +%Y%m%d-%H%M%S).json
```

**Recovery Testing:**
- Weekly restore tests on non-production environment
- Automated backup verification
- Recovery time objective (RTO) < 4 hours
- Recovery point objective (RPO) < 15 minutes

## Security and Compliance

### Q: How is data encrypted and what encryption standards are used?

**A:** Multi-layer encryption approach:

**Encryption at Rest:**
- **Algorithm**: AES-256-GCM
- **Key Management**: AWS KMS or HashiCorp Vault integration
- **Database**: PostgreSQL transparent data encryption (TDE)
- **Backups**: Encrypted backup storage

**Encryption in Transit:**
- **TLS 1.3**: All network communications
- **Certificate Management**: Automatic certificate rotation
- **mTLS**: Service-to-service authentication

**Application-Level Encryption:**
```json
{
  "security": {
    "encryptionKey": "${ENCRYPTION_KEY}",
    "algorithm": "aes-256-gcm",
    "keyDerivation": "pbkdf2",
    "iterations": 100000,
    "dataIntegrity": {
      "hashAlgorithm": "sha256",
      "signatureValidation": true
    }
  }
}
```

**Compliance Standards:**
- **FIPS 140-2**: Cryptographic modules
- **Common Criteria**: EAL4+ certified components
- **NIST Cybersecurity Framework**: Comprehensive security controls

### Q: How does HIPAA compliance work?

**A:** HIPAA compliance features:

**Technical Safeguards:**
- **Access Control**: Role-based access with minimum necessary principle
- **Audit Controls**: Comprehensive audit logging of all PHI access
- **Integrity**: Digital signatures and hash verification
- **Transmission Security**: End-to-end encryption

**Administrative Safeguards:**
- **Security Officer**: Designated security responsibility
- **Workforce Training**: Security awareness and training programs
- **Incident Response**: Automated incident detection and response
- **Contingency Plan**: Disaster recovery and business continuity

**Physical Safeguards:**
- **Facility Access**: Secured data center environments
- **Workstation Security**: Hardened system configurations
- **Device Controls**: Hardware and media access controls

**HIPAA Configuration:**
```json
{
  "compliance": {
    "hipaa": {
      "enabled": true,
      "baaCompliant": true,
      "auditLogging": {
        "detailedAuditing": true,
        "retentionYears": 6,
        "immutableLogs": true
      },
      "accessControls": {
        "minimumAccess": true,
        "sessionTimeouts": true,
        "automaticLogoff": true
      }
    }
  }
}
```

### Q: What GDPR compliance features are available?

**A:** Comprehensive GDPR implementation:

**Data Subject Rights:**
```typescript
// Right to Access (DSAR)
GET /compliance/gdpr/data-subject/{id}

// Right to Rectification  
PUT /compliance/gdpr/data-subject/{id}

// Right to Erasure ("Right to be Forgotten")
DELETE /compliance/gdpr/data-subject/{id}

// Data Portability
GET /compliance/gdpr/data-export/{id}
```

**Privacy by Design:**
- **Data Minimization**: Only collect necessary data
- **Pseudonymization**: Automatic PII pseudonymization
- **Purpose Limitation**: Clear data processing purposes
- **Storage Limitation**: Automatic data retention policies

**Breach Notification:**
- **Automatic Detection**: Real-time breach detection
- **Notification Timeline**: 72-hour notification requirement
- **Risk Assessment**: Automated risk assessment and classification
- **Documentation**: Comprehensive incident documentation

### Q: How does key rotation work?

**A:** Automated key rotation system:

**Rotation Schedule:**
- **Production**: Every 30 days
- **Staging**: Every 90 days
- **Development**: Every 180 days

**Rotation Process:**
1. **Generate New Key**: Secure key generation
2. **Dual-Key Period**: Both old and new keys active
3. **Data Re-encryption**: Background re-encryption of existing data
4. **Key Retirement**: Old key retired after grace period
5. **Audit Trail**: Complete audit trail of rotation events

**Configuration:**
```json
{
  "security": {
    "keyRotation": {
      "enabled": true,
      "rotationIntervalDays": 30,
      "gracePeriodDays": 7,
      "automaticRotation": true,
      "keyVersioning": true,
      "oldKeyRetentionDays": 365
    }
  }
}
```

**Zero-Downtime Rotation:**
- No service interruption during rotation
- Gradual migration of encrypted data
- Automatic fallback to previous key if issues occur

## Monitoring and Observability

### Q: What metrics are available and how do I access them?

**A:** Comprehensive metrics collection:

**System Metrics:**
```
audit_worker_cpu_usage_percent
audit_worker_memory_usage_percent
audit_worker_uptime_seconds
audit_worker_network_connections_total
```

**Application Metrics:**
```
audit_worker_events_processed_total
audit_worker_events_failed_total
audit_worker_events_processing_duration_seconds
audit_worker_queue_depth
```

**Business Metrics:**
```
audit_worker_compliance_events_total
audit_worker_encryption_operations_total
audit_worker_key_rotations_total
audit_worker_audit_trails_created_total
```

**Access Methods:**
```bash
# Prometheus format
curl http://worker:3001/metrics

# Enhanced JSON format
curl http://worker:3001/observability/metrics/enhanced

# Real-time dashboard
curl http://worker:3001/observability/dashboard
```

### Q: How do I set up alerting?

**A:** Multi-channel alerting system:

**Prometheus Alerting Rules:**
```yaml
groups:
- name: audit_worker_alerts
  rules:
  - alert: HighEventProcessingLatency
    expr: audit_worker_events_processing_duration_seconds{quantile="0.95"} > 5
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High event processing latency"
      description: "Processing latency is {{ $value }}s"
```

**AlertManager Configuration:**
```yaml
receivers:
- name: 'audit-team'
  email_configs:
    - to: 'audit-team@company.com'
      subject: '[AUDIT] {{ .GroupLabels.alertname }}'
  slack_configs:
    - api_url: 'https://hooks.slack.com/services/...'
      channel: '#audit-alerts'
  pagerduty_configs:
    - service_key: 'PAGERDUTY_SERVICE_KEY'
```

**Built-in Smart Alerting:**
```json
{
  "monitoring": {
    "smartAlerting": {
      "enabled": true,
      "cooldownMinutes": 15,
      "escalationLevels": 3,
      "suppressionRules": [
        {
          "name": "maintenance-window",
          "cron": "0 2 * * *",
          "durationMinutes": 120
        }
      ]
    }
  }
}
```

### Q: What observability endpoints are available?

**A:** Built-in observability endpoints:

**Health and Status:**
```bash
GET /healthz                          # Overall health status
GET /health/{component}               # Component-specific health
GET /observability/system-info        # System information
GET /observability/configuration-status  # Config status
```

**Performance and Metrics:**
```bash
GET /observability/dashboard          # Real-time dashboard
GET /observability/metrics/enhanced   # Detailed metrics
GET /observability/bottlenecks        # Performance bottlenecks
GET /observability/profiling/{type}   # CPU/memory profiling
```

**Debugging and Analysis:**
```bash
GET /observability/traces             # Distributed traces
GET /observability/event-loop-lag     # Event loop monitoring
GET /observability/heap-snapshot      # Memory heap analysis
GET /observability/performance-report # Performance analysis
```

**Administrative:**
```bash
POST /admin/config/reload             # Reload configuration
POST /admin/queue/clean-stalled       # Clean stalled jobs
POST /admin/security/rotate-keys      # Manual key rotation
POST /admin/audit/integrity-check     # Audit integrity check
```

### Q: How do I integrate with existing monitoring tools?

**A:** Integration with popular monitoring stacks:

**Prometheus + Grafana:**
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'audit-worker'
    static_configs:
      - targets: ['worker:3001']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

**ELK Stack (Elasticsearch, Logstash, Kibana):**
```yaml
# filebeat.yml
filebeat.inputs:
- type: container
  paths:
    - '/var/lib/docker/containers/*/*.log'
  processors:
    - add_docker_metadata: {}

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "audit-worker-%{+yyyy.MM.dd}"
```

**DataDog:**
```yaml
# datadog-agent configuration
logs:
  - type: docker
    image: audit-worker
    service: audit-worker
    source: nodejs
```

**New Relic:**
```bash
# Environment variables
export NEW_RELIC_APP_NAME="Audit Worker"
export NEW_RELIC_LICENSE_KEY="your-license-key"
```

## Development and Integration

### Q: How do I integrate the worker with my application?

**A:** Integration approaches:

**Direct API Integration:**
```typescript
// Send events directly to worker API
const auditEvent = {
  timestamp: new Date().toISOString(),
  principalId: 'user-123',
  action: 'user.login',
  status: 'success',
  data: { ipAddress: '192.168.1.1' }
};

const response = await fetch('http://audit-worker:3001/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(auditEvent)
});
```

**Queue-Based Integration:**
```typescript
// Send events via Redis queue (recommended)
import { Queue } from 'bullmq';

const auditQueue = new Queue('audit-events', {
  connection: { host: 'redis-host', port: 6379 }
});

await auditQueue.add('audit-event', auditEvent, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
});
```

**SDK Integration:**
```typescript
// Using the audit SDK (if available)
import { AuditClient } from '@company/audit-sdk';

const auditClient = new AuditClient({
  workerUrl: 'http://audit-worker:3001',
  apiKey: process.env.AUDIT_API_KEY
});

await auditClient.logEvent(auditEvent);
```

### Q: What is the event schema and how flexible is it?

**A:** Flexible event schema:

**Core Schema:**
```typescript
interface AuditLogEvent {
  // Required fields
  timestamp: string;              // ISO 8601 timestamp
  principalId: string;            // User/system identifier
  action: string;                 // Action performed
  status: 'success' | 'failure';  // Operation result
  
  // Optional fields
  correlationId?: string;         // Request correlation ID
  sessionId?: string;             // User session ID
  ipAddress?: string;             // Client IP address
  userAgent?: string;             // Client user agent
  resource?: string;              // Resource accessed
  data?: Record<string, any>;     // Additional event data
}
```

**Schema Flexibility:**
- **Extensible**: Additional fields supported in `data` object
- **Validation**: JSON schema validation with custom rules
- **Backwards Compatible**: Schema evolution without breaking changes
- **Industry Standards**: Support for common audit log formats

**Custom Event Types:**
```typescript
// HIPAA-compliant medical records access
{
  timestamp: "2024-01-15T10:30:00.000Z",
  principalId: "doctor-123",
  action: "medical_record.view",
  status: "success",
  data: {
    patientId: "patient-456",
    recordType: "lab_results",
    accessReason: "treatment",
    hipaaCompliant: true
  }
}

// Financial transaction audit
{
  timestamp: "2024-01-15T10:30:00.000Z",
  principalId: "user-789",
  action: "transaction.create",
  status: "success",
  data: {
    transactionId: "txn-abc123",
    amount: 150.00,
    currency: "USD",
    riskScore: 0.1,
    compliance: ["PCI-DSS", "SOX"]
  }
}
```

### Q: How do I write tests for worker integration?

**A:** Testing strategies:

**Unit Tests with Vitest:**
```typescript
// test/integration.test.ts
import { describe, it, expect } from 'vitest';
import { AuditWorker } from '../src/index';

describe('Audit Worker Integration', () => {
  it('should process audit events', async () => {
    const worker = new AuditWorker(testConfig);
    await worker.initialize();
    
    const event = {
      timestamp: new Date().toISOString(),
      principalId: 'test-user',
      action: 'test.action',
      status: 'success'
    };
    
    const result = await worker.processEvent(event);
    expect(result.success).toBe(true);
  });
});
```

**Integration Tests:**
```bash
# Test with real Redis and PostgreSQL
export CONFIG_PATH="s3://test-bucket/integration-config.json"
pnpm -F worker test:integration

# Load testing
pnpm -F worker test:load
```

**Docker Compose for Testing:**
```yaml
# docker-compose.test.yml
version: '3.8'
services:
  audit-worker-test:
    build: .
    environment:
      CONFIG_PATH: "file:///app/test-config.json"
      NODE_ENV: test
    depends_on:
      - postgres-test
      - redis-test
      
  postgres-test:
    image: postgres:15
    environment:
      POSTGRES_DB: audit_test
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_pass
      
  redis-test:
    image: redis:7-alpine
```

### Q: How do I extend the worker with custom functionality?

**A:** Extension mechanisms:

**Custom Event Processors:**
```typescript
// src/processors/CustomProcessor.ts
import { EventProcessor } from '../types';

export class CustomProcessor implements EventProcessor {
  async process(event: AuditLogEvent): Promise<ProcessingResult> {
    // Custom processing logic
    const processed = await this.customLogic(event);
    return { success: true, result: processed };
  }
  
  private async customLogic(event: AuditLogEvent) {
    // Your custom implementation
  }
}
```

**Plugin System:**
```typescript
// src/plugins/CompliancePlugin.ts
import { WorkerPlugin } from '../types';

export class CompliancePlugin implements WorkerPlugin {
  name = 'compliance-plugin';
  version = '1.0.0';
  
  async initialize(worker: AuditWorker) {
    // Plugin initialization
    worker.addEventProcessor(new ComplianceProcessor());
    worker.addHealthCheck(new ComplianceHealthCheck());
  }
}

// Register plugin
worker.registerPlugin(new CompliancePlugin());
```

**Custom Configurations:**
```json
{
  "customProcessors": [
    {
      "name": "custom-processor",
      "enabled": true,
      "config": {
        "setting1": "value1",
        "setting2": "value2"
      }
    }
  ],
  "plugins": [
    {
      "name": "compliance-plugin",
      "enabled": true
    }
  ]
}
```

## Troubleshooting

### Q: What should I check first when the worker isn't processing events?

**A:** Diagnostic checklist:

**1. Health Checks:**
```bash
# Overall health
curl http://worker:3001/healthz

# Component health
curl http://worker:3001/health/queue
curl http://worker:3001/health/database
curl http://worker:3001/health/redis
```

**2. Queue Status:**
```bash
# Queue depth
redis-cli -h redis-host -p 6379 LLEN audit-events

# Stalled jobs
redis-cli -h redis-host -p 6379 ZRANGE "bull:audit-events:stalled" 0 -1

# Failed jobs
redis-cli -h redis-host -p 6379 LLEN audit-events-failed
```

**3. System Resources:**
```bash
# Memory and CPU
docker stats audit-worker

# Logs
docker logs audit-worker --tail 100
```

**4. Configuration:**
```bash
# Configuration status
curl http://worker:3001/observability/configuration-status

# Reload configuration
curl -X POST http://worker:3001/admin/config/reload
```

### Q: How do I debug performance issues?

**A:** Performance debugging steps:

**1. Identify Bottlenecks:**
```bash
# Performance dashboard
curl http://worker:3001/observability/dashboard

# Bottleneck analysis
curl http://worker:3001/observability/bottlenecks

# CPU profiling
curl "http://worker:3001/observability/profiling/cpu?duration=30s"
```

**2. Database Performance:**
```sql
-- Check slow queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
WHERE mean_time > 1000 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check connection pool
SELECT count(*), state 
FROM pg_stat_activity 
WHERE datname = 'audit_db' 
GROUP BY state;
```

**3. Queue Performance:**
```bash
# Queue metrics
curl http://worker:3001/observability/metrics | grep queue

# Redis performance
redis-cli -h redis-host -p 6379 INFO stats
```

**4. Optimization:**
- Increase concurrency for higher throughput
- Enable batch processing for better efficiency
- Optimize database indexes and queries
- Scale horizontally if needed

### Q: What are common configuration errors?

**A:** Frequent configuration mistakes:

**1. JSON Syntax Errors:**
```bash
# Validate JSON
cat config.json | jq .

# Common errors:
# - Trailing commas
# - Unescaped quotes  
# - Missing brackets
```

**2. Environment Variable Issues:**
```bash
# Check variable substitution
echo $DB_PASSWORD
docker exec audit-worker env | grep DB_PASSWORD

# Ensure variables are exported
export DB_PASSWORD="secure-password"
```

**3. Network Configuration:**
```bash
# Test connectivity
telnet db-host 5432
redis-cli -h redis-host -p 6379 ping

# Check DNS resolution
nslookup db-host
```

**4. Resource Limits:**
```yaml
# Kubernetes resource limits
resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 500m
    memory: 512Mi
```

### Q: How do I recover from data corruption?

**A:** Recovery procedures:

**1. Immediate Assessment:**
```bash
# Check data integrity
curl http://worker:3001/audit/integrity-check

# Identify corruption scope
curl "http://worker:3001/audit/verify?since=24h"
```

**2. Stop Processing:**
```bash
# Graceful shutdown
curl -X POST http://worker:3001/admin/shutdown

# Or force stop
docker stop audit-worker
```

**3. Restore from Backup:**
```bash
# Database restore
pg_restore --host=db-host --username=audit_user \
  --dbname=audit_db_recovered --clean backup.sql

# Verify restored data
psql -h db-host -U audit_user -d audit_db_recovered -c \
  "SELECT COUNT(*) FROM audit_logs WHERE timestamp > NOW() - INTERVAL '24 hours';"
```

**4. Integrity Rebuild:**
```bash
# Rebuild integrity hashes
curl -X POST http://worker:3001/admin/audit/rebuild-integrity \
  -d '{"timeframe": "24h", "verify": true}'
```

## Deployment and Operations

### Q: What are the recommended deployment patterns?

**A:** Production deployment patterns:

**Blue-Green Deployment:**
```bash
# Deploy to green environment
kubectl apply -f deployment-green.yaml

# Verify green deployment
kubectl get pods -l version=green

# Switch traffic
kubectl patch service audit-worker -p '{"spec":{"selector":{"version":"green"}}}'

# Monitor and rollback if needed
kubectl patch service audit-worker -p '{"spec":{"selector":{"version":"blue"}}}'
```

**Canary Deployment:**
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: audit-worker-rollout
spec:
  replicas: 10
  strategy:
    canary:
      steps:
      - setWeight: 10
      - pause: {duration: 300s}
      - setWeight: 50
      - pause: {duration: 600s}
      - setWeight: 100
  selector:
    matchLabels:
      app: audit-worker
  template:
    metadata:
      labels:
        app: audit-worker
    spec:
      containers:
      - name: worker
        image: audit-worker:latest
```

**Rolling Update:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: audit-worker
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 25%
  template:
    spec:
      containers:
      - name: worker
        image: audit-worker:latest
        readinessProbe:
          httpGet:
            path: /healthz
            port: 3001
          initialDelaySeconds: 30
```

### Q: How do I monitor deployment health during updates?

**A:** Deployment monitoring strategy:

**Health Checks During Deployment:**
```bash
# Continuous health monitoring
while true; do
  curl -f http://audit-worker:3001/healthz || echo "Health check failed"
  sleep 10
done

# Monitor key metrics
watch 'curl -s http://audit-worker:3001/metrics | grep -E "(events_processed|error_rate)"'
```

**Automated Rollback Triggers:**
```yaml
# Prometheus alert for deployment issues
- alert: DeploymentHealthFailure
  expr: up{job="audit-worker"} < 0.8  # Less than 80% instances healthy
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Deployment health failure detected"
```

**Canary Analysis:**
```bash
# Compare metrics between versions
kubectl exec -it deployment/audit-worker-canary -- curl localhost:3001/metrics
kubectl exec -it deployment/audit-worker-stable -- curl localhost:3001/metrics
```

### Q: What backup and disaster recovery procedures should I implement?

**A:** Comprehensive DR strategy:

**Backup Schedule:**
- **Database**: Continuous WAL archiving + daily base backups
- **Configuration**: Hourly S3 configuration backups  
- **Queue State**: Daily Redis persistence backups
- **Application State**: Stateless design, no application backups needed

**Recovery Procedures:**
```bash
# Database recovery
pg_restore --host=dr-db-host --username=audit_user \
  --dbname=audit_db --clean latest-backup.sql

# Configuration recovery
aws s3 cp s3://backup-bucket/config/latest-config.json \
          s3://config-bucket/worker/config.json

# Queue recovery
redis-cli -h dr-redis-host --rdb backup.rdb
```

**RTO/RPO Targets:**
- **Recovery Time Objective (RTO)**: < 4 hours
- **Recovery Point Objective (RPO)**: < 15 minutes
- **Data Loss Tolerance**: Zero for audit events
- **Availability Target**: 99.9% uptime

**DR Testing:**
- Monthly DR drills
- Quarterly full failover tests
- Annual disaster scenario exercises
- Automated backup verification

### Q: How do I handle maintenance windows?

**A:** Maintenance best practices:

**Planned Maintenance:**
```bash
# 1. Enable maintenance mode
curl -X POST http://worker:3001/admin/maintenance/enable

# 2. Drain queue gracefully
curl -X POST http://worker:3001/admin/queue/drain

# 3. Wait for processing to complete
while [ $(curl -s http://worker:3001/observability/metrics | grep queue_depth | cut -d' ' -f2) -gt 0 ]; do
  echo "Waiting for queue to drain..."
  sleep 30
done

# 4. Perform maintenance
kubectl apply -f updated-deployment.yaml

# 5. Verify health
kubectl rollout status deployment/audit-worker

# 6. Disable maintenance mode
curl -X POST http://worker:3001/admin/maintenance/disable
```

**Emergency Maintenance:**
```bash
# Quick failover to backup region
kubectl config use-context backup-region
kubectl scale deployment audit-worker --replicas=5

# Update DNS to point to backup region
aws route53 change-resource-record-sets --hosted-zone-id Z123 --change-batch file://failover.json
```

## Best Practices

### Q: What are the security best practices?

**A:** Security hardening guidelines:

**Container Security:**
```dockerfile
# Use minimal base image
FROM node:18-alpine

# Run as non-root user
RUN addgroup -g 1001 -S worker && adduser -S worker -u 1001
USER worker

# Scan for vulnerabilities
RUN npm audit --audit-level high
```

**Network Security:**
- Use network policies to restrict pod-to-pod communication
- Enable mTLS for service-to-service communication
- Implement API rate limiting and DDoS protection
- Use service mesh (Istio/Linkerd) for traffic encryption

**Secret Management:**
```bash
# Use external secret managers
kubectl create secret generic audit-secrets \
  --from-literal=db-password="$(vault kv get -field=password secret/db)"

# Rotate secrets regularly
kubectl annotate secret audit-secrets reloader.stakater.com/match="true"
```

**Access Control:**
```yaml
# RBAC for service account
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: audit-worker-role
rules:
- apiGroups: [""]
  resources: ["secrets", "configmaps"]
  verbs: ["get", "list"]
```

### Q: What monitoring and alerting practices should I follow?

**A:** Monitoring best practices:

**SLI/SLO Definition:**
```yaml
# Service Level Indicators
slis:
  availability:
    description: "Percentage of successful health checks"
    threshold: 99.9%
  
  latency:
    description: "95th percentile event processing latency"
    threshold: 200ms
  
  throughput:
    description: "Events processed per second"
    threshold: 1000

# Service Level Objectives  
slos:
  availability: 99.9%
  latency_p95: 200ms
  error_rate: 0.1%
```

**Alert Hierarchy:**
```yaml
alerts:
  critical:
    - service_down
    - data_corruption
    - security_breach
    
  warning:
    - high_latency
    - queue_backup
    - memory_pressure
    
  info:
    - config_reload
    - scale_event
    - backup_completion
```

**Dashboard Organization:**
- **Executive Dashboard**: High-level business metrics
- **Operations Dashboard**: System health and performance
- **Developer Dashboard**: Application-specific metrics
- **Compliance Dashboard**: Audit and compliance metrics

### Q: What performance optimization practices are recommended?

**A:** Performance optimization guidelines:

**Configuration Tuning:**
```json
{
  "reliableProcessor": {
    "concurrency": "auto",  // CPU cores * 2
    "batchProcessing": {
      "enabled": true,
      "adaptiveBatching": true
    }
  },
  "enhancedClient": {
    "connectionPooling": {
      "adaptive": true,
      "monitoringEnabled": true
    }
  }
}
```

**Resource Management:**
```yaml
# Kubernetes resource management
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi

# Quality of service
qosClass: Guaranteed
```

**Capacity Planning:**
- Monitor resource utilization trends
- Set up predictive scaling based on queue depth
- Plan for peak load scenarios (2-3x normal capacity)
- Regular performance testing and benchmarking

**Code Optimization:**
- Use connection pooling and keep-alive connections
- Implement caching for frequently accessed data
- Optimize database queries and indexes
- Use efficient serialization formats (MessagePack vs JSON)

### Q: What operational practices ensure reliability?

**A:** Reliability engineering practices:

**Circuit Breaker Pattern:**
```json
{
  "reliableProcessor": {
    "circuitBreakerConfig": {
      "failureThreshold": 5,
      "recoveryTimeout": 60000,
      "monitoringPeriod": 10000,
      "minimumThroughput": 10
    }
  }
}
```

**Graceful Degradation:**
- Continue processing with reduced functionality during partial failures
- Implement fallback mechanisms for external dependencies
- Use caching to serve requests during database outages
- Queue events locally when Redis is unavailable

**Chaos Engineering:**
```bash
# Use chaos engineering tools
kubectl apply -f chaos-mesh-experiments/

# Test network partitions
kubectl apply -f network-chaos.yaml

# Test pod failures
kubectl apply -f pod-chaos.yaml
```

**Incident Response:**
1. **Detection**: Automated alerting and monitoring
2. **Response**: On-call rotation and escalation procedures
3. **Resolution**: Runbooks and automated recovery procedures
4. **Learning**: Post-incident reviews and improvement plans

---

For additional technical information, see:
- **[Getting Started Guide](getting-started.md)** - Initial setup and configuration
- **[Configuration Tutorial](tutorials/configuration.md)** - Advanced configuration options
- **[Performance Guide](tutorials/performance.md)** - Performance optimization techniques
- **[Troubleshooting Guide](troubleshooting.md)** - Problem resolution procedures