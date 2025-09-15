# Getting Started with Smart Logs Audit Worker

This comprehensive guide will walk you through setting up and running the Smart Logs Audit Worker, from initial configuration to production deployment. The guide covers the new ConfigurationManager-based architecture and advanced monitoring capabilities.

## Table of Contents

1. [Prerequisites & System Requirements](#prerequisites--system-requirements)
2. [Understanding the New Architecture](#understanding-the-new-architecture)
3. [Configuration Setup](#configuration-setup)
4. [Development Environment](#development-environment)
5. [Production Deployment](#production-deployment)
6. [Monitoring & Observability](#monitoring--observability)
7. [Testing & Validation](#testing--validation)
8. [Troubleshooting](#troubleshooting)

## Prerequisites & System Requirements

### Minimum Requirements

- **Node.js**: Version 18.0 or higher
- **pnpm**: Version 8.0 or higher (package manager)
- **PostgreSQL**: Version 14 or higher
- **Redis**: Version 6.0 or higher
- **TypeScript**: Version 5.0 or higher (for development)

### Infrastructure Requirements

- **S3-Compatible Storage**: For configuration management (AWS S3, MinIO, etc.)
- **Minimum RAM**: 1GB available memory
- **Disk Space**: 2GB for logs and temporary files
- **Network**: Stable connection to database and Redis instances

### Knowledge Prerequisites

- **TypeScript/JavaScript**: Intermediate level
- **Database Management**: PostgreSQL administration
- **Redis**: Basic understanding of Redis operations
- **AWS S3**: Basic S3 operations (uploading, downloading files)
- **Docker**: Optional, for containerized deployment

## Understanding the New Architecture

### Major Changes from Previous Version

The audit worker has been completely redesigned with enterprise-grade features:

#### Old vs New Configuration

**❌ Old Way (Environment Variables):**

```bash
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
AUDIT_QUEUE_NAME="audit"
LOG_LEVEL="info"
```

**✅ New Way (ConfigurationManager):**

```bash
CONFIG_PATH="default/audit-development.json"
LOG_LEVEL="info"  # Optional override
```

#### New Components Overview

1. **ConfigurationManager**: Centralized, S3-based configuration with hot reloading
2. **ReliableEventProcessor**: Advanced BullMQ processor with circuit breaker
3. **Observability Stack**: Comprehensive tracing, metrics, and monitoring
4. **Health Check System**: Multi-component health monitoring
5. **Enhanced Database Layer**: Optimized with partitioning and monitoring

## Configuration Setup

### Step 1: Create Your Configuration File

Create a comprehensive configuration file in JSON format:

```json
{
	"redis": {
		"host": "localhost",
		"port": 6379,
		"password": null,
		"db": 0,
		"family": 4,
		"maxRetriesPerRequest": 3,
		"retryDelayOnFailover": 100,
		"lazyConnect": true,
		"keepAlive": 30000
	},
	"enhancedClient": {
		"connectionString": "postgresql://audit_user:secure_password@localhost:5432/audit_db",
		"maxConnections": 20,
		"idleTimeoutMillis": 30000,
		"connectionTimeoutMillis": 2000,
		"monitoring": {
			"enabled": false,
			"queryLogging": false,
			"slowQueryThreshold": 1000
		},
		"partitioning": {
			"enabled": false,
			"partitionBy": "month",
			"retentionMonths": 12
		}
	},
	"security": {
		"encryptionKey": "a-very-secure-256-bit-encryption-key-goes-here-32-chars",
		"algorithm": "aes-256-gcm",
		"keyRotation": {
			"enabled": false,
			"rotationIntervalDays": 90
		}
	},
	"monitoring": {
		"enabled": true,
		"alertThresholds": {
			"errorRate": 0.05,
			"queueDepth": 1000,
			"processingLatency": 5000,
			"memoryUsage": 0.8,
			"cpuUsage": 0.8
		},
		"metricsRetentionDays": 7,
		"alertCooldownMinutes": 15
	},
	"reliableProcessor": {
		"queueName": "audit-events",
		"concurrency": 5,
		"maxStalledCount": 1,
		"maxRetriesPerRequest": 3,
		"retryConfig": {
			"maxRetries": 3,
			"baseDelay": 1000,
			"maxDelay": 30000,
			"backoffStrategy": "exponential"
		},
		"circuitBreakerConfig": {
			"failureThreshold": 5,
			"recoveryTimeout": 60000,
			"monitoringPeriod": 10000,
			"minimumThroughput": 10
		},
		"deadLetterConfig": {
			"queueName": "audit-events-failed",
			"alertThreshold": 10,
			"retentionDays": 30
		}
	},
	"worker": {
		"port": 3001,
		"host": "0.0.0.0",
		"gracefulShutdownTimeoutMs": 30000
	},
	"logging": {
		"level": "info",
		"format": "json",
		"destination": "stdout"
	}
}
```

### Step 2: Upload Configuration to S3

#### Using AWS CLI

```bash
# Upload configuration to S3
aws s3 cp worker-config.json s3://your-config-bucket/worker/config.json

# Verify upload
aws s3 ls s3://your-config-bucket/worker/

# Set appropriate permissions (if needed)
aws s3api put-object-acl --bucket your-config-bucket --key worker/config.json --acl private
```

#### Using MinIO Client

```bash
# Configure MinIO client
mc alias set myminio http://minio-server:9000 ACCESS_KEY SECRET_KEY

# Upload configuration
mc cp worker-config.json myminio/config-bucket/worker/config.json

# Verify upload
mc ls myminio/config-bucket/worker/
```

### Step 3: Environment Variables

Set the minimal required environment variables:

```bash
# Primary configuration
export CONFIG_PATH="default/audit-development.json"

# Optional: Override logging level
export LOG_LEVEL="info"

# Optional: AWS credentials (if not using IAM roles)
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
```

### Step 4: Configuration Validation

Create a simple validation script to test your configuration:

```typescript
// validate-config.ts
import { ConfigurationManager } from '@repo/audit'

async function validateConfig() {
	try {
		const configManager = new ConfigurationManager(process.env.CONFIG_PATH!, 's3')

		await configManager.initialize()
		const config = configManager.getConfig()

		console.log('✅ Configuration loaded successfully')
		console.log('Redis host:', config.redis.host)
		console.log('Database configured:', !!config.enhancedClient.connectionString)
		console.log('Worker port:', config.worker.port)
	} catch (error) {
		console.error('❌ Configuration validation failed:', error)
		process.exit(1)
	}
}

validateConfig()
```

Run validation:

```bash
npx tsx validate-config.ts
```

## Development Environment

### Step 1: Install Dependencies

From the monorepo root:

```bash
# Install all dependencies
pnpm install

# Verify worker package is properly linked
cd apps/worker
pnpm list
```

### Step 2: Setup Development Database

#### Using Docker Compose

Create `docker-compose.dev.yml`:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: audit_db_dev
      POSTGRES_USER: audit_user
      POSTGRES_PASSWORD: dev_password
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

Start development services:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

#### Manual Setup

```bash
# PostgreSQL setup
createdb audit_db_dev
psql audit_db_dev -c "CREATE USER audit_user WITH PASSWORD 'dev_password';"
psql audit_db_dev -c "GRANT ALL PRIVILEGES ON DATABASE audit_db_dev TO audit_user;"

# Redis (if using package manager)
# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis-server

# macOS
brew install redis
brew services start redis
```

### Step 3: Development Configuration

Create a development-specific configuration file:

```json
{
	"redis": {
		"host": "localhost",
		"port": 6379,
		"password": null,
		"db": 0
	},
	"enhancedClient": {
		"connectionString": "postgresql://audit_user:dev_password@localhost:5432/audit_db_dev",
		"maxConnections": 10,
		"monitoring": {
			"enabled": true,
			"queryLogging": true
		}
	},
	"security": {
		"encryptionKey": "dev-key-32-characters-long-test",
		"algorithm": "aes-256-gcm"
	},
	"monitoring": {
		"enabled": true,
		"alertThresholds": {
			"errorRate": 0.1,
			"queueDepth": 100,
			"processingLatency": 10000
		}
	},
	"reliableProcessor": {
		"queueName": "audit-events-dev",
		"concurrency": 2,
		"circuitBreakerConfig": {
			"failureThreshold": 10,
			"recoveryTimeout": 30000
		}
	},
	"worker": {
		"port": 3001
	},
	"logging": {
		"level": "debug",
		"format": "pretty"
	}
}
```

Upload to S3 as development config:

```bash
aws s3 cp dev-config.json s3://your-config-bucket/worker/dev-config.json
```

### Step 4: Run in Development Mode

```bash
# Set development environment
export CONFIG_PATH="s3://your-config-bucket/worker/dev-config.json"
export NODE_ENV="development"

# Start in development mode with hot reload
pnpm -F worker dev

# Alternative: Start with debug logging
LOG_LEVEL=debug pnpm -F worker dev
```

### Step 5: Development Testing

Test the development setup:

```bash
# Check health endpoint
curl http://localhost:3001/healthz

# Check metrics
curl http://localhost:3001/metrics

# Check component health
curl http://localhost:3001/health/database
curl http://localhost:3001/health/redis
```

## Production Deployment

### Step 1: Production Configuration

Create a production-optimized configuration:

```json
{
	"redis": {
		"host": "redis-cluster.production.com",
		"port": 6379,
		"password": "${REDIS_PASSWORD}",
		"db": 0,
		"tls": {
			"rejectUnauthorized": true
		},
		"maxRetriesPerRequest": 3,
		"connectTimeout": 10000
	},
	"enhancedClient": {
		"connectionString": "postgresql://audit_user:${DB_PASSWORD}@db-cluster.production.com:5432/audit_db",
		"maxConnections": 50,
		"ssl": {
			"rejectUnauthorized": true,
			"ca": "${DB_SSL_CA}",
			"cert": "${DB_SSL_CERT}",
			"key": "${DB_SSL_KEY}"
		},
		"monitoring": {
			"enabled": true,
			"queryLogging": false,
			"slowQueryThreshold": 1000
		},
		"partitioning": {
			"enabled": true,
			"partitionBy": "month",
			"retentionMonths": 24
		}
	},
	"security": {
		"encryptionKey": "${ENCRYPTION_KEY}",
		"algorithm": "aes-256-gcm",
		"keyRotation": {
			"enabled": true,
			"rotationIntervalDays": 90
		}
	},
	"monitoring": {
		"enabled": true,
		"alertThresholds": {
			"errorRate": 0.01,
			"queueDepth": 5000,
			"processingLatency": 2000,
			"memoryUsage": 0.85,
			"cpuUsage": 0.8
		},
		"metricsRetentionDays": 30
	},
	"reliableProcessor": {
		"queueName": "audit-events",
		"concurrency": 20,
		"circuitBreakerConfig": {
			"failureThreshold": 3,
			"recoveryTimeout": 120000
		},
		"deadLetterConfig": {
			"queueName": "audit-events-failed",
			"alertThreshold": 5,
			"retentionDays": 90
		}
	},
	"worker": {
		"port": 3001,
		"host": "0.0.0.0",
		"gracefulShutdownTimeoutMs": 60000
	},
	"logging": {
		"level": "warn",
		"format": "json"
	}
}
```

### Step 2: Environment Variable Management

#### Using Docker Secrets

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

# Copy application
COPY dist/ ./dist/

# Create non-root user
RUN addgroup -g 1001 -S worker && adduser -S worker -u 1001
USER worker

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/healthz || exit 1

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

#### Using Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: worker-secrets
type: Opaque
data:
  redis-password: <base64-encoded-password>
  db-password: <base64-encoded-password>
  encryption-key: <base64-encoded-key>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: audit-worker
spec:
  replicas: 3
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
          image: your-registry/audit-worker:latest
          env:
            - name: CONFIG_PATH
              value: 's3://prod-config-bucket/worker/config.json'
            - name: NODE_ENV
              value: 'production'
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: worker-secrets
                  key: redis-password
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: worker-secrets
                  key: db-password
            - name: ENCRYPTION_KEY
              valueFrom:
                secretKeyRef:
                  name: worker-secrets
                  key: encryption-key
          ports:
            - containerPort: 3001
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3001
            initialDelaySeconds: 60
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /healthz
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
```

### Step 3: Production Build

```bash
# Build for production
pnpm -F worker build

# Verify build output
ls -la apps/worker/dist/

# Test production build locally
NODE_ENV=production CONFIG_PATH="s3://..." node apps/worker/dist/index.js
```

### Step 4: Deployment Monitoring

Setup monitoring for deployment:

```bash
# Monitor logs in real-time
kubectl logs -f deployment/audit-worker

# Check metrics endpoint
curl http://worker-service:3001/metrics

# Monitor health
watch curl -s http://worker-service:3001/healthz
```

## Monitoring & Observability

### Built-in Monitoring Endpoints

The worker provides comprehensive monitoring out of the box:

#### Health Checks

```bash
# Overall system health
curl http://localhost:3001/healthz

# Component-specific health
curl http://localhost:3001/health/database
curl http://localhost:3001/health/redis
curl http://localhost:3001/health/queue
curl http://localhost:3001/health/circuit-breaker
```

Expected health check response:

```json
{
	"status": "OK",
	"timestamp": "2024-01-15T10:30:00.000Z",
	"uptime": 3600,
	"components": {
		"database": {
			"status": "OK",
			"message": "Database connection healthy",
			"responseTime": 12,
			"lastCheck": "2024-01-15T10:30:00.000Z"
		},
		"redis": {
			"status": "OK",
			"message": "Redis connection ready",
			"responseTime": 5,
			"lastCheck": "2024-01-15T10:30:00.000Z"
		},
		"queue": {
			"status": "OK",
			"message": "Queue processing normally",
			"queueDepth": 45,
			"processedCount": 15420,
			"lastCheck": "2024-01-15T10:30:00.000Z"
		}
	}
}
```

#### Metrics Collection

```bash
# Basic metrics
curl http://localhost:3001/metrics

# Enhanced metrics (Prometheus format)
curl "http://localhost:3001/observability/metrics/enhanced?format=prometheus"

# JSON metrics
curl "http://localhost:3001/observability/metrics/enhanced?format=json"
```

#### Observability Dashboard

```bash
# Get dashboard data
curl http://localhost:3001/observability/dashboard

# Bottleneck analysis
curl http://localhost:3001/observability/bottlenecks

# Distributed traces
curl http://localhost:3001/observability/traces

# Performance profiling
curl http://localhost:3001/observability/profiling
```

### Integration with External Monitoring

#### Prometheus Integration

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'audit-worker'
    static_configs:
      - targets: ['worker-host:3001']
    metrics_path: '/observability/metrics/enhanced'
    params:
      format: ['prometheus']
    scrape_interval: 15s
```

#### Grafana Dashboard

Import the provided Grafana dashboard configuration or create custom panels:

- **System Health**: Overall health status and uptime
- **Event Processing**: Throughput, latency, and error rates
- **Queue Metrics**: Queue depth, processing rates, and backlog
- **Resource Usage**: CPU, memory, and database connections
- **Circuit Breaker**: Status and failure rates

## Testing & Validation

### Unit Tests

```bash
# Run all tests
pnpm -F worker test

# Run with coverage
pnpm -F worker test:ci

# Run specific test files
pnpm -F worker test compliance-api
pnpm -F worker test monitoring-integration
```

### Integration Testing

```bash
# Test with real Redis and PostgreSQL
export CONFIG_PATH="s3://test-bucket/integration-config.json"
pnpm -F worker test

# Load testing (if available)
pnpm -F worker test:load
```

### Manual Testing

#### Event Processing Test

Create a simple test event:

```bash
# Using Redis CLI to send test event
redis-cli LPUSH audit-events-dev '{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "principalId": "test-user-123",
  "action": "test.event",
  "status": "success",
  "correlationId": "test-correlation-123"
}'

# Monitor processing
curl http://localhost:3001/metrics
```

#### Configuration Hot Reload Test

```bash
# Update configuration in S3
aws s3 cp updated-config.json s3://your-bucket/worker/config.json

# Check if worker picks up changes (check logs)
# No restart should be required
```

## Troubleshooting

### Common Issues

#### Configuration Loading Errors

```bash
# Error: Cannot load configuration from S3
# Solution: Check AWS credentials and S3 permissions
aws s3 ls s3://your-bucket/
aws sts get-caller-identity

# Error: Invalid configuration format
# Solution: Validate JSON configuration
cat config.json | jq .
```

#### Database Connection Issues

```bash
# Error: Database connection failed
# Solution: Test database connectivity
psql "postgresql://audit_user:password@host:5432/audit_db" -c "SELECT 1;"

# Check if database exists and user has permissions
psql -h host -U audit_user -d audit_db -c "\dt"
```

#### Redis Connection Issues

```bash
# Error: Redis connection refused
# Solution: Test Redis connectivity
redis-cli -h redis-host -p 6379 ping

# Check Redis configuration
redis-cli -h redis-host -p 6379 CONFIG GET "*"
```

#### High Memory Usage

```bash
# Check memory usage
curl http://localhost:3001/observability/profiling

# Solutions:
# 1. Reduce concurrency in configuration
# 2. Implement batching
# 3. Increase available memory
```

### Debugging Tools

#### Enable Debug Logging

```bash
# Temporary debug logging
LOG_LEVEL=debug pnpm -F worker dev

# Or update configuration file
{
  "logging": {
    "level": "debug",
    "format": "pretty"
  }
}
```

#### Health Check Debugging

```bash
# Detailed health information
curl -s http://localhost:3001/healthz | jq .

# Individual component debugging
curl -s http://localhost:3001/health/database | jq .
curl -s http://localhost:3001/health/redis | jq .
```

### Performance Optimization

#### High Throughput Configuration

For processing large volumes of events:

```json
{
	"reliableProcessor": {
		"concurrency": 50,
		"batchSize": 100
	},
	"enhancedClient": {
		"maxConnections": 100,
		"partitioning": {
			"enabled": true
		}
	}
}
```

#### Memory Optimization

```json
{
	"monitoring": {
		"metricsRetentionDays": 1
	},
	"reliableProcessor": {
		"maxStalledCount": 1,
		"maxRetriesPerRequest": 2
	}
}
```

---

## Next Steps

After successful setup:

1. **[Configuration Guide](tutorials/configuration.md)** - Advanced configuration options
2. **[Monitoring Setup](tutorials/monitoring.md)** - Detailed monitoring configuration
3. **[Compliance Setup](tutorials/compliance.md)** - HIPAA, GDPR compliance configuration
4. **[Performance Tuning](tutorials/performance.md)** - Optimization for high-throughput environments
5. **[Troubleshooting Guide](troubleshooting.md)** - Comprehensive problem-solving guide

**Congratulations!** You now have a fully functional, enterprise-grade audit worker with advanced monitoring and configuration management.
