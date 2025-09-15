# Smart Logs Audit Worker

A high-performance, enterprise-grade audit log processing worker built with Node.js, BullMQ, and advanced monitoring capabilities. This worker consumes audit events from Redis queues and provides comprehensive audit trail processing, compliance reporting, and real-time monitoring.

## 🏗️ Architecture Overview

The Audit Worker is a sophisticated event processing system designed for enterprise audit logging requirements:

### Core Components

- **Reliable Event Processor**: Built on BullMQ with circuit breaker pattern and retry mechanisms
- **Configuration Manager**: S3-based dynamic configuration management (no more env variables!)
- **Enhanced Database Layer**: Drizzle ORM with PostgreSQL, partitioning, and monitoring
- **Redis Integration**: High-performance caching, metrics, and queue management
- **Observability Stack**: Comprehensive tracing, metrics collection, and bottleneck analysis
- **Health Check System**: Multi-component health monitoring with alerting
- **Monitoring Dashboard**: Real-time monitoring and alerting system

### Key Features

- ✅ **Dynamic Configuration**: S3-based configuration management with hot reloading
- ✅ **Circuit Breaker Pattern**: Automatic failure detection and recovery
- ✅ **Advanced Retry Logic**: Exponential backoff with dead letter queue
- ✅ **Real-time Monitoring**: Performance metrics, bottleneck analysis, and alerting
- ✅ **Distributed Tracing**: Complete request tracing with span correlation
- ✅ **Health Checks**: Comprehensive system health monitoring
- ✅ **Compliance APIs**: HIPAA, GDPR, and general compliance reporting
- ✅ **Data Integrity**: Cryptographic verification and audit trails
- ✅ **High Performance**: Optimized for high-throughput event processing

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+**
- **PostgreSQL 14+**
- **Redis 6+**
- **pnpm** package manager
- **S3-compatible storage** for configuration
- **TypeScript** knowledge

### Configuration Setup

**⚠️ Important**: The worker now uses the ConfigurationManager service for configuration instead of environment variables.

1. **Prepare your configuration file** (JSON format):

```json
{
  "redis": {
    "host": "localhost",
    "port": 6379,
    "password": null,
    "db": 0
  },
  "enhancedClient": {
    "connectionString": "postgresql://user:pass@localhost:5432/audit_db",
    "maxConnections": 20,
    "monitoring": {
      "enabled": false
    },
    "partitioning": {
      "enabled": false
    }
  },
  "security": {
    "encryptionKey": "your-256-bit-encryption-key-here",
    "algorithm": "aes-256-gcm"
  },
  "monitoring": {
    "alertThresholds": {
      "errorRate": 0.05,
      "queueDepth": 1000,
      "processingLatency": 5000
    }
  },
  "reliableProcessor": {
    "queueName": "audit-events",
    "concurrency": 5,
    "circuitBreakerConfig": {
      "failureThreshold": 5,
      "recoveryTimeout": 60000
    },
    "deadLetterConfig": {
      "queueName": "audit-events-failed",
      "alertThreshold": 10
    }
  },
  "worker": {
    "port": 3001
  }
}
```

2. **Upload configuration to S3**:
   - Upload your config file to S3
   - Note the S3 path (e.g., `s3://your-bucket/config/worker-config.json`)

3. **Set environment variables**:

```bash
# Configuration source
CONFIG_PATH="s3://your-bucket/config/worker-config.json"

# Optional: Logging level
LOG_LEVEL="info"
```

### Installation & Setup

1. **Install dependencies**:
   ```bash
   # From monorepo root
   pnpm install
   ```

2. **Build the worker**:
   ```bash
   # From monorepo root
   pnpm -F worker build
   
   # Or from worker directory
   cd apps/worker
   pnpm build
   ```

3. **Start the worker**:
   ```bash
   # Development mode (with hot reload)
   pnpm -F worker dev
   
   # Production mode
   pnpm -F worker start
   ```

## 🎯 Core Functionality

### Audit Event Processing

The worker processes audit events with the following workflow:

1. **Event Ingestion**: Consumes events from Redis queue
2. **Validation**: Validates event structure and required fields
3. **Hash Verification**: Verifies cryptographic integrity (if hash provided)
4. **Storage**: Persists events to PostgreSQL with optimized schema
5. **Monitoring**: Tracks performance metrics and patterns
6. **Alerting**: Generates alerts for suspicious patterns or system issues

### Event Schema

```typescript
interface AuditLogEvent {
  timestamp: string                    // ISO 8601 timestamp
  principalId: string                  // User/service identifier
  organizationId?: string              // Tenant identifier
  action: string                       // Action performed
  targetResourceType?: string          // Resource type (e.g., "Patient")
  targetResourceId?: string           // Resource identifier
  status: 'success' | 'failure'      // Operation outcome
  outcomeDescription?: string         // Human-readable outcome
  hash?: string                       // Cryptographic hash
  hashAlgorithm?: string             // Hash algorithm used
  eventVersion?: string              // Event schema version
  correlationId?: string             // Request correlation ID
  dataClassification?: string        // Data sensitivity level
  retentionPolicy?: string           // Retention requirements
  sessionContext?: {                 // Session information
    sessionId?: string
    ipAddress?: string
    userAgent?: string
  }
  // Additional fields stored in 'details' JSONB column
  [key: string]: any
}
```

## 🔧 Configuration Management

### ConfigurationManager Features

- **S3 Integration**: Store configurations in S3 buckets
- **Hot Reloading**: Dynamic configuration updates without restart
- **Validation**: Schema validation for configuration integrity
- **Fallback**: Local file fallback if S3 is unavailable
- **Caching**: Intelligent caching with TTL

### Configuration Structure

```typescript
interface WorkerConfig {
  redis: RedisConfig
  enhancedClient: DatabaseConfig
  security: SecurityConfig
  monitoring: MonitoringConfig
  reliableProcessor: ProcessorConfig
  worker: {
    port: number
  }
}
```

## 📊 Monitoring & Observability

### Health Check Endpoints

```bash
# Overall system health
GET /healthz

# Component-specific health
GET /health/database
GET /health/redis
GET /health/queue
GET /health/circuit-breaker

# System metrics
GET /metrics
```

### Observability Endpoints

```bash
# Monitoring dashboard data
GET /observability/dashboard

# Enhanced metrics (JSON or Prometheus format)
GET /observability/metrics/enhanced?format=prometheus

# Bottleneck analysis
GET /observability/bottlenecks

# Distributed traces
GET /observability/traces?traceId=12345

# Performance profiling
GET /observability/profiling
```

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:ci

# Watch mode
pnpm test:watch
```

### Integration Tests
```bash
# Test compliance API
pnpm test src/__tests__/compliance-api.test.ts

# Test monitoring integration
pnpm test src/__tests__/monitoring-integration.test.ts
```

## 📚 Documentation

- **[Getting Started Guide](docs/getting-started.md)** - Complete setup walkthrough
- **[Configuration Guide](docs/tutorials/configuration.md)** - Advanced configuration options
- **[Monitoring Setup](docs/tutorials/monitoring.md)** - Observability configuration
- **[Troubleshooting](docs/troubleshooting.md)** - Common issues and solutions
- **[FAQ](docs/faq.md)** - Frequently asked questions

---

**Note**: This is an enterprise-grade application designed for technical personnel with experience in distributed systems, audit logging, and compliance requirements.
