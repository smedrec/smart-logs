# Advanced Configuration Tutorial

This tutorial covers advanced configuration options for the Smart Logs Audit Worker, including hot reloading, environment-specific configurations, security best practices, and optimization techniques.

## Table of Contents

1. [Configuration Architecture](#configuration-architecture)
2. [Environment-Specific Configurations](#environment-specific-configurations)  
3. [Hot Reloading and Dynamic Updates](#hot-reloading-and-dynamic-updates)
4. [Security and Encryption](#security-and-encryption)
5. [Database Configuration](#database-configuration)
6. [Redis and Queue Configuration](#redis-and-queue-configuration)
7. [Monitoring and Alerting](#monitoring-and-alerting)
8. [Performance Optimization](#performance-optimization)
9. [Validation and Testing](#validation-and-testing)
10. [Best Practices](#best-practices)

## Configuration Architecture

The audit worker uses a centralized ConfigurationManager that supports multiple storage backends and dynamic updates without service restarts.

### Configuration Flow

```typescript
// Configuration loading sequence
ConfigurationManager → S3/File Storage → JSON Validation → 
Environment Variable Substitution → Hot Reload Monitoring
```

### Supported Backends

- **S3**: Production recommended (AWS S3, MinIO, etc.)
- **Local File**: Development and testing
- **Environment Variables**: Minimal override capability

### Configuration Schema

The configuration follows a strict JSON schema with these top-level sections:

```typescript
interface WorkerConfiguration {
  redis: RedisConfig;
  enhancedClient: DatabaseConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  reliableProcessor: ProcessorConfig;
  worker: ServerConfig;
  logging: LoggingConfig;
}
```

## Environment-Specific Configurations

### Development Configuration

Optimized for local development with extensive logging and relaxed security:

```json
{
  "redis": {
    "host": "localhost",
    "port": 6379,
    "password": null,
    "db": 1,
    "maxRetriesPerRequest": 1,
    "connectTimeout": 5000
  },
  "enhancedClient": {
    "connectionString": "postgresql://audit_user:dev_password@localhost:5432/audit_db_dev",
    "maxConnections": 5,
    "idleTimeoutMillis": 10000,
    "monitoring": {
      "enabled": true,
      "queryLogging": true,
      "slowQueryThreshold": 500
    },
    "partitioning": {
      "enabled": false
    }
  },
  "security": {
    "encryptionKey": "dev-key-32-characters-long-test!",
    "algorithm": "aes-256-gcm",
    "keyRotation": {
      "enabled": false
    }
  },
  "monitoring": {
    "enabled": true,
    "alertThresholds": {
      "errorRate": 0.2,
      "queueDepth": 50,
      "processingLatency": 10000,
      "memoryUsage": 0.9,
      "cpuUsage": 0.9
    },
    "metricsRetentionDays": 1,
    "alertCooldownMinutes": 5
  },
  "reliableProcessor": {
    "queueName": "audit-events-dev",
    "concurrency": 2,
    "maxStalledCount": 1,
    "retryConfig": {
      "maxRetries": 2,
      "baseDelay": 500,
      "maxDelay": 5000,
      "backoffStrategy": "linear"
    },
    "circuitBreakerConfig": {
      "failureThreshold": 10,
      "recoveryTimeout": 10000,
      "monitoringPeriod": 5000
    }
  },
  "worker": {
    "port": 3001,
    "host": "localhost"
  },
  "logging": {
    "level": "debug",
    "format": "pretty",
    "destination": "stdout"
  }
}
```

### Staging Configuration

Balances production-like settings with debugging capabilities:

```json
{
  "redis": {
    "host": "redis-staging.internal",
    "port": 6379,
    "password": "${REDIS_PASSWORD}",
    "db": 0,
    "tls": {
      "rejectUnauthorized": false
    },
    "maxRetriesPerRequest": 3,
    "connectTimeout": 8000,
    "lazyConnect": true
  },
  "enhancedClient": {
    "connectionString": "postgresql://audit_user:${DB_PASSWORD}@db-staging.internal:5432/audit_db_staging",
    "maxConnections": 20,
    "ssl": {
      "rejectUnauthorized": false
    },
    "monitoring": {
      "enabled": true,
      "queryLogging": false,
      "slowQueryThreshold": 1000
    },
    "partitioning": {
      "enabled": true,
      "partitionBy": "month",
      "retentionMonths": 6
    }
  },
  "security": {
    "encryptionKey": "${ENCRYPTION_KEY}",
    "algorithm": "aes-256-gcm",
    "keyRotation": {
      "enabled": false
    }
  },
  "monitoring": {
    "enabled": true,
    "alertThresholds": {
      "errorRate": 0.02,
      "queueDepth": 2000,
      "processingLatency": 3000,
      "memoryUsage": 0.85,
      "cpuUsage": 0.85
    },
    "metricsRetentionDays": 14,
    "alertCooldownMinutes": 10
  },
  "reliableProcessor": {
    "queueName": "audit-events",
    "concurrency": 10,
    "circuitBreakerConfig": {
      "failureThreshold": 5,
      "recoveryTimeout": 60000
    },
    "deadLetterConfig": {
      "queueName": "audit-events-failed",
      "alertThreshold": 20,
      "retentionDays": 30
    }
  },
  "worker": {
    "port": 3001,
    "host": "0.0.0.0",
    "gracefulShutdownTimeoutMs": 45000
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

### Production Configuration

Optimized for high availability, security, and performance:

```json
{
  "redis": {
    "host": "redis-cluster.prod.internal",
    "port": 6380,
    "password": "${REDIS_PASSWORD}",
    "db": 0,
    "tls": {
      "rejectUnauthorized": true,
      "ca": "${REDIS_SSL_CA}",
      "cert": "${REDIS_SSL_CERT}",
      "key": "${REDIS_SSL_KEY}"
    },
    "maxRetriesPerRequest": 5,
    "retryDelayOnFailover": 200,
    "connectTimeout": 10000,
    "commandTimeout": 5000,
    "lazyConnect": true,
    "keepAlive": 60000,
    "enableReadyCheck": true,
    "maxLoadingTimeout": 10000
  },
  "enhancedClient": {
    "connectionString": "postgresql://audit_user:${DB_PASSWORD}@db-cluster-writer.prod.internal:5432/audit_db",
    "maxConnections": 100,
    "idleTimeoutMillis": 60000,
    "connectionTimeoutMillis": 5000,
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
      "retentionMonths": 36,
      "compressionEnabled": true,
      "indexOptimization": true
    },
    "readReplicas": [
      "db-cluster-reader-1.prod.internal:5432",
      "db-cluster-reader-2.prod.internal:5432"
    ]
  },
  "security": {
    "encryptionKey": "${ENCRYPTION_KEY}",
    "algorithm": "aes-256-gcm",
    "keyRotation": {
      "enabled": true,
      "rotationIntervalDays": 30,
      "keyDerivation": "pbkdf2",
      "iterations": 100000
    },
    "dataIntegrity": {
      "hashAlgorithm": "sha256",
      "signatureValidation": true
    }
  },
  "monitoring": {
    "enabled": true,
    "alertThresholds": {
      "errorRate": 0.005,
      "queueDepth": 10000,
      "processingLatency": 1000,
      "memoryUsage": 0.80,
      "cpuUsage": 0.75,
      "diskUsage": 0.85
    },
    "metricsRetentionDays": 90,
    "alertCooldownMinutes": 30,
    "healthCheckIntervalMs": 10000,
    "detailedMetrics": true
  },
  "reliableProcessor": {
    "queueName": "audit-events",
    "concurrency": 50,
    "maxStalledCount": 1,
    "maxRetriesPerRequest": 3,
    "retryConfig": {
      "maxRetries": 5,
      "baseDelay": 2000,
      "maxDelay": 60000,
      "backoffStrategy": "exponential",
      "jitter": true
    },
    "circuitBreakerConfig": {
      "failureThreshold": 3,
      "recoveryTimeout": 300000,
      "monitoringPeriod": 30000,
      "minimumThroughput": 50,
      "volumeThreshold": 20
    },
    "deadLetterConfig": {
      "queueName": "audit-events-failed",
      "alertThreshold": 5,
      "retentionDays": 180,
      "processingEnabled": true
    },
    "batchProcessing": {
      "enabled": true,
      "batchSize": 100,
      "maxBatchWaitMs": 5000
    }
  },
  "worker": {
    "port": 3001,
    "host": "0.0.0.0",
    "gracefulShutdownTimeoutMs": 120000,
    "keepAliveTimeout": 65000,
    "headersTimeout": 66000
  },
  "logging": {
    "level": "warn",
    "format": "json",
    "destination": "stdout",
    "structuredLogging": true,
    "correlationId": true
  }
}
```

## Hot Reloading and Dynamic Updates

The ConfigurationManager supports hot reloading without service interruption.

### How Hot Reloading Works

```typescript
// ConfigurationManager monitors S3 object changes
class ConfigurationManager {
  private watchForChanges() {
    setInterval(async () => {
      const lastModified = await this.getLastModified();
      if (lastModified > this.lastConfigUpdate) {
        await this.reloadConfiguration();
        this.emit('configurationUpdated', this.config);
      }
    }, this.watchInterval);
  }
}
```

### Safe Configuration Updates

1. **Validation First**: New configuration is validated before applying
2. **Gradual Rollout**: Changes are applied component by component
3. **Rollback Capability**: Previous configuration is kept for rollback
4. **Health Monitoring**: System health is monitored during updates

### Example: Updating Concurrency

```bash
# Current configuration
{
  "reliableProcessor": {
    "concurrency": 20
  }
}

# Update configuration in S3
aws s3 cp updated-config.json s3://config-bucket/worker/config.json

# Worker automatically detects change and applies it
# Log output shows:
# [2024-01-15T10:30:00] INFO: Configuration updated
# [2024-01-15T10:30:00] INFO: Processor concurrency changed: 20 -> 50
# [2024-01-15T10:30:00] INFO: Workers scaled successfully
```

### Configuration Rollback

If a configuration update causes issues:

```bash
# Automatic rollback on validation failure
# [2024-01-15T10:31:00] ERROR: New configuration validation failed
# [2024-01-15T10:31:00] INFO: Rolling back to previous configuration
# [2024-01-15T10:31:00] INFO: Rollback completed successfully

# Manual rollback
aws s3 cp s3://config-bucket/worker/config-backup.json s3://config-bucket/worker/config.json
```

## Security and Encryption

### Encryption Configuration

#### Data at Rest Encryption

```json
{
  "security": {
    "encryptionKey": "${ENCRYPTION_KEY}",
    "algorithm": "aes-256-gcm",
    "keyDerivation": "pbkdf2",
    "iterations": 100000,
    "saltLength": 32,
    "ivLength": 12,
    "tagLength": 16
  }
}
```

#### Key Rotation

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

### Environment Variable Substitution

Secure configuration with environment variable substitution:

```json
{
  "enhancedClient": {
    "connectionString": "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}",
    "ssl": {
      "ca": "${DB_SSL_CA}",
      "cert": "${DB_SSL_CERT}",
      "key": "${DB_SSL_KEY}"
    }
  },
  "redis": {
    "password": "${REDIS_PASSWORD}",
    "tls": {
      "ca": "${REDIS_SSL_CA}",
      "cert": "${REDIS_SSL_CERT}",
      "key": "${REDIS_SSL_KEY}"
    }
  }
}
```

### Secrets Management Integration

#### AWS Secrets Manager

```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name "audit-worker/database" \
  --description "Database credentials for audit worker" \
  --secret-string '{"username":"audit_user","password":"secure_password"}'

# Use in configuration
export DB_USER=$(aws secretsmanager get-secret-value --secret-id audit-worker/database --query SecretString --output text | jq -r .username)
export DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id audit-worker/database --query SecretString --output text | jq -r .password)
```

#### HashiCorp Vault

```bash
# Store secrets in Vault
vault kv put secret/audit-worker database_password="secure_password"

# Retrieve in initialization script
export DB_PASSWORD=$(vault kv get -field=database_password secret/audit-worker)
```

## Database Configuration

### Connection Pool Optimization

```json
{
  "enhancedClient": {
    "maxConnections": 100,
    "minConnections": 10,
    "acquireTimeoutMillis": 30000,
    "idleTimeoutMillis": 60000,
    "reapIntervalMillis": 10000,
    "createTimeoutMillis": 30000,
    "destroyTimeoutMillis": 5000,
    "createRetryIntervalMillis": 200
  }
}
```

### Partitioning Configuration

```json
{
  "enhancedClient": {
    "partitioning": {
      "enabled": true,
      "partitionBy": "month",
      "retentionMonths": 24,
      "compressionEnabled": true,
      "compressionAfterDays": 30,
      "indexOptimization": true,
      "parallelMaintenance": true,
      "maintenanceWindow": "02:00-04:00",
      "autoVacuum": true
    }
  }
}
```

### Read Replica Configuration

```json
{
  "enhancedClient": {
    "readReplicas": [
      "db-replica-1.internal:5432",
      "db-replica-2.internal:5432"
    ],
    "readReplicaConfig": {
      "loadBalancing": "round-robin",
      "fallbackToMaster": true,
      "healthCheckInterval": 10000,
      "maxLag": 5000
    }
  }
}
```

## Redis and Queue Configuration

### Redis Cluster Configuration

```json
{
  "redis": {
    "cluster": {
      "enabled": true,
      "nodes": [
        "redis-node-1.internal:6379",
        "redis-node-2.internal:6379",
        "redis-node-3.internal:6379"
      ],
      "options": {
        "enableReadyCheck": true,
        "maxRetriesPerRequest": 3,
        "retryDelayOnClusterDown": 300,
        "retryDelayOnFailover": 100,
        "slotsRefreshTimeout": 10000,
        "slotsRefreshInterval": 5000
      }
    }
  }
}
```

### Queue Priority Configuration

```json
{
  "reliableProcessor": {
    "queues": [
      {
        "name": "audit-events-critical",
        "priority": 1,
        "concurrency": 20
      },
      {
        "name": "audit-events-high",
        "priority": 2,  
        "concurrency": 15
      },
      {
        "name": "audit-events-normal",
        "priority": 3,
        "concurrency": 10
      }
    ]
  }
}
```

### Dead Letter Queue Configuration

```json
{
  "reliableProcessor": {
    "deadLetterConfig": {
      "queueName": "audit-events-failed",
      "alertThreshold": 10,
      "retentionDays": 90,
      "processingEnabled": true,
      "reprocessingStrategy": "exponential-backoff",
      "maxReprocessAttempts": 5,
      "reprocessingDelay": 3600000
    }
  }
}
```

## Monitoring and Alerting

### Comprehensive Monitoring

```json
{
  "monitoring": {
    "enabled": true,
    "components": ["database", "redis", "queue", "circuit-breaker", "memory", "cpu"],
    "healthCheckIntervalMs": 10000,
    "metricsCollection": {
      "interval": 15000,
      "aggregationWindow": 300000,
      "retentionDays": 30
    },
    "alerting": {
      "enabled": true,
      "channels": ["email", "slack", "pagerduty"],
      "escalation": {
        "levels": 3,
        "timeoutMinutes": [5, 15, 30]
      }
    }
  }
}
```

### Custom Alert Thresholds

```json
{
  "monitoring": {
    "alertThresholds": {
      "errorRate": {
        "warning": 0.01,
        "critical": 0.05
      },
      "queueDepth": {
        "warning": 5000,
        "critical": 10000
      },
      "processingLatency": {
        "warning": 2000,
        "critical": 5000
      },
      "memoryUsage": {
        "warning": 0.80,
        "critical": 0.90
      },
      "diskSpace": {
        "warning": 0.85,
        "critical": 0.95
      }
    }
  }
}
```

## Performance Optimization

### High Throughput Configuration

For processing millions of events per day:

```json
{
  "reliableProcessor": {
    "concurrency": 100,
    "batchProcessing": {
      "enabled": true,
      "batchSize": 500,
      "maxBatchWaitMs": 2000,
      "parallelBatches": 10
    }
  },
  "enhancedClient": {
    "maxConnections": 200,
    "partitioning": {
      "enabled": true,
      "parallelPartitions": 12
    }
  },
  "redis": {
    "pipeline": {
      "enabled": true,
      "batchSize": 100
    }
  }
}
```

### Memory Optimization

```json
{
  "reliableProcessor": {
    "memoryOptimization": {
      "maxJobsPerWorker": 1,
      "removeOnComplete": 100,
      "removeOnFail": 50
    }
  },
  "monitoring": {
    "metricsRetentionDays": 7,
    "lowMemoryMode": true
  }
}
```

## Validation and Testing

### Configuration Validation Script

```typescript
// validate-config.ts
import Ajv from 'ajv';
import { configSchema } from './config-schema';

export async function validateConfiguration(config: any): Promise<boolean> {
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(configSchema);
  
  const valid = validate(config);
  
  if (!valid) {
    console.error('Configuration validation errors:');
    validate.errors?.forEach(error => {
      console.error(`- ${error.instancePath}: ${error.message}`);
    });
    return false;
  }
  
  // Additional custom validations
  if (config.reliableProcessor.concurrency > config.enhancedClient.maxConnections) {
    console.error('Warning: Processor concurrency exceeds database connections');
  }
  
  return true;
}
```

### Configuration Testing

```bash
# Test configuration before deployment
npm run validate-config -- --config-path s3://bucket/staging-config.json

# Test with different environments
export CONFIG_PATH="s3://bucket/test-config.json"
npm run test:config

# Load test configuration
npm run test:load -- --config-path s3://bucket/performance-config.json
```

## Best Practices

### 1. Environment Separation

- **Separate S3 buckets** for each environment
- **Different encryption keys** per environment
- **Environment-specific monitoring thresholds**

### 2. Security

- **Never store secrets in configuration files**
- **Use environment variable substitution** for sensitive data
- **Enable key rotation** in production
- **Implement least-privilege access** for S3 buckets

### 3. Performance

- **Start with conservative settings** and optimize based on metrics
- **Monitor memory usage** when increasing concurrency
- **Use batching** for high-throughput scenarios
- **Enable partitioning** for large databases

### 4. Monitoring

- **Set appropriate alert thresholds** based on your SLA
- **Use multiple monitoring channels** for critical alerts
- **Implement health checks** for all components
- **Monitor configuration reload events**

### 5. Maintenance

- **Regular configuration backups** before changes
- **Test configuration changes** in staging first
- **Document configuration decisions** and their rationale
- **Review and update configurations** regularly

### Configuration Management Workflow

```mermaid
graph TD
    A[Local Development] --> B[Validation]
    B --> C[Staging Upload]
    C --> D[Integration Testing]
    D --> E[Production Deployment]
    E --> F[Monitoring]
    F --> G[Performance Review]
    G --> A
```

### Example Configuration Management Scripts

```bash
#!/bin/bash
# deploy-config.sh

ENVIRONMENT=$1
CONFIG_FILE="config-${ENVIRONMENT}.json"

# Validate configuration
node validate-config.js --file $CONFIG_FILE
if [ $? -ne 0 ]; then
    echo "Configuration validation failed"
    exit 1
fi

# Backup current configuration
aws s3 cp s3://config-bucket/worker/config.json \
          s3://config-bucket/worker/backup/config-$(date +%Y%m%d-%H%M%S).json

# Upload new configuration
aws s3 cp $CONFIG_FILE s3://config-bucket/worker/config.json

# Monitor deployment
echo "Configuration deployed. Monitoring for 5 minutes..."
for i in {1..30}; do
    curl -f http://worker:3001/healthz > /dev/null
    if [ $? -ne 0 ]; then
        echo "Health check failed. Rolling back..."
        aws s3 cp s3://config-bucket/worker/backup/config-latest.json \
                  s3://config-bucket/worker/config.json
        exit 1
    fi
    sleep 10
done

echo "Deployment successful!"
```

---

## Next Steps

- **[Monitoring Setup Tutorial](monitoring.md)** - Detailed monitoring configuration
- **[Performance Tuning Guide](performance.md)** - Optimization techniques
- **[Security Best Practices](security.md)** - Advanced security configuration

For additional configuration examples and templates, see the `config-templates/` directory in the repository.