# Configuration Guide

This guide covers the comprehensive configuration options for the `@repo/audit` package, including environment-specific settings, security configurations, and healthcare compliance options.

## 📋 Overview

The audit system uses a hierarchical configuration system that supports:

- **Environment-specific configurations** (development, staging, production, test)
- **Hot reloading capabilities** for dynamic updates
- **Encrypted configuration storage** with AES-256-GCM
- **Comprehensive validation** with schema enforcement
- **Integration with external services** (AWS S3, local storage)

## 🔧 Basic Configuration

### Minimal Configuration

For development or simple setups:

```typescript
import { Audit, AuditConfig } from '@repo/audit'
import { db } from '@repo/audit-db'

const config: AuditConfig = {
  version: '1.0',
  environment: 'development',
  reliableProcessor: {
    queueName: 'audit-events'
  }
}

const auditService = new Audit(config, db)
```

### Standard Configuration

For production healthcare environments:

```typescript
const config: AuditConfig = {
  version: '1.0',
  environment: 'production',
  
  // Reliable event processing configuration
  reliableProcessor: {
    queueName: 'healthcare-audit',
    maxRetries: 3,
    retryDelay: 1000,
    batchSize: 50,
    concurrency: 5,
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 10
  },
  
  // Security and cryptography settings
  security: {
    crypto: {
      algorithm: 'SHA-256',
      signingAlgorithm: 'HMAC-SHA256'
    },
    enableEncryption: true,
    enableTamperDetection: true,
    requireDigitalSignatures: true
  },
  
  // Healthcare compliance configuration
  compliance: {
    hipaa: {
      enabled: true,
      requiredFields: ['principalId', 'targetResourceType', 'sessionContext'],
      retentionYears: 6,
      enableSecurityIncidentReporting: true
    },
    gdpr: {
      enabled: true,
      defaultLegalBasis: 'legitimate_interest',
      retentionDays: 2190, // 6 years
      enableDataSubjectRights: true
    },
    defaultRetentionDays: 2190
  },
  
  // Monitoring and observability
  observability: {
    enableMetrics: true,
    metricsInterval: 30000,
    enableTracing: true,
    enableHealthChecks: true,
    enableProfiling: false
  }
}
```

## 🏥 Healthcare-Specific Configuration

### HIPAA Compliance Configuration

```typescript
const hipaaConfig: AuditConfig = {
  // ... base config
  compliance: {
    hipaa: {
      enabled: true,
      
      // Required fields for HIPAA compliance
      requiredFields: [
        'principalId',        // Who performed the action
        'targetResourceType', // What type of resource was accessed
        'sessionContext',     // Session details for audit trail
        'timestamp',          // When the action occurred
        'action'             // What action was performed
      ],
      
      // 6-year retention requirement
      retentionYears: 6,
      
      // Enable security incident reporting
      enableSecurityIncidentReporting: true,
      
      // PHI handling configuration
      phiHandling: {
        enablePseudonymization: true,
        enableDataMinimization: true,
        requireConsentTracking: true
      }
    }
  },
  
  // Enhanced security for PHI
  security: {
    crypto: {
      algorithm: 'SHA-256',
      signingAlgorithm: 'HMAC-SHA256',
      keyDerivation: 'PBKDF2'
    },
    enableEncryption: true,
    enableTamperDetection: true,
    requireDigitalSignatures: true,
    
    // Encryption configuration
    encryption: {
      algorithm: 'AES-256-GCM',
      keyRotationDays: 90,
      enableKeyEscrow: true
    }
  }
}
```

### GDPR Compliance Configuration

```typescript
const gdprConfig: AuditConfig = {
  // ... base config
  compliance: {
    gdpr: {
      enabled: true,
      
      // Legal basis for processing
      defaultLegalBasis: 'legitimate_interest',
      allowedLegalBases: [
        'consent',
        'contract',
        'legal_obligation',
        'vital_interests',
        'public_task',
        'legitimate_interest'
      ],
      
      // Data retention policies
      retentionDays: 365,
      
      // Data subject rights
      enableDataSubjectRights: true,
      dataSubjectRights: {
        enableDataExport: true,
        enableDataDeletion: true,
        enableDataPortability: true,
        enableConsentWithdrawal: true
      },
      
      // Data processing tracking
      enableProcessingRecords: true,
      enableConsentManagement: true,
      enableDataMinimization: true
    }
  }
}
```

## 🔒 Security Configuration

### Cryptographic Configuration

```typescript
const securityConfig: AuditConfig = {
  // ... base config
  security: {
    // Primary cryptographic settings
    crypto: {
      algorithm: 'SHA-256',
      signingAlgorithm: 'HMAC-SHA256',
      keyDerivation: 'PBKDF2',
      iterations: 100000
    },
    
    // Encryption settings
    encryption: {
      algorithm: 'AES-256-GCM',
      keySize: 256,
      ivSize: 96,
      tagSize: 128,
      keyRotationDays: 90
    },
    
    // Digital signature settings
    signing: {
      algorithm: 'HMAC-SHA256',
      keySize: 256,
      enableTimestamping: true,
      requireCountersignature: false
    },
    
    // Tamper detection
    enableTamperDetection: true,
    tamperDetection: {
      hashChain: true,
      merkleTree: false,
      digitalSignatures: true
    },
    
    // Key management
    keyManagement: {
      provider: 'infisical',
      rotationInterval: 30, // days
      enableEscrow: true,
      enableHSM: false
    }
  }
}
```

### Key Management Integration

```typescript
// Using Infisical KMS
const kmsConfig: AuditConfig = {
  // ... base config
  security: {
    keyManagement: {
      provider: 'infisical',
      infisical: {
        apiUrl: process.env.INFISICAL_API_URL,
        token: process.env.INFISICAL_TOKEN,
        projectId: process.env.INFISICAL_PROJECT_ID,
        environment: 'production',
        keyPath: '/audit/encryption-keys'
      }
    }
  }
}
```

## ⚡ Performance Configuration

### High-Performance Settings

```typescript
const performanceConfig: AuditConfig = {
  // ... base config
  reliableProcessor: {
    queueName: 'high-volume-audit',
    
    // Batch processing for high throughput
    batchSize: 100,
    maxBatchWait: 1000,
    
    // Concurrency settings
    concurrency: 10,
    maxConcurrency: 20,
    
    // Retry configuration
    maxRetries: 5,
    retryDelay: 2000,
    exponentialBackoff: true,
    maxRetryDelay: 30000,
    
    // Circuit breaker for resilience
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 50,
    circuitBreakerTimeout: 60000,
    
    // Queue management
    enableDLQ: true,
    dlqMaxRetries: 3,
    enablePriority: true
  },
  
  // Database optimization
  database: {
    connectionPool: {
      min: 5,
      max: 20,
      idleTimeout: 30000,
      acquireTimeout: 60000
    },
    
    // Query optimization
    enableQueryOptimization: true,
    enableIndexHints: true,
    enableBatching: true,
    
    // Partitioning strategy
    partitioning: {
      enabled: true,
      strategy: 'monthly',
      retentionPeriod: '6 years'
    }
  }
}
```

## 📊 Monitoring Configuration

### Observability Settings

```typescript
const monitoringConfig: AuditConfig = {
  // ... base config
  observability: {
    // Metrics collection
    enableMetrics: true,
    metricsInterval: 30000,
    metricsExporter: 'prometheus',
    
    // Distributed tracing
    enableTracing: true,
    tracingExporter: 'jaeger',
    tracingSampleRate: 0.1,
    
    // Health checks
    enableHealthChecks: true,
    healthCheckInterval: 15000,
    healthCheckEndpoint: '/health',
    
    // Logging configuration
    logging: {
      level: 'info',
      format: 'json',
      enableStructuredLogging: true,
      enableCorrelationIds: true
    },
    
    // Performance monitoring
    enableProfiling: true,
    profilingInterval: 60000,
    enableBottleneckDetection: true,
    
    // Alerting
    alerting: {
      enabled: true,
      channels: ['email', 'slack', 'pagerduty'],
      thresholds: {
        processingLatency: 1000,
        queueDepth: 1000,
        errorRate: 0.05
      }
    }
  }
}
```

## 🌍 Environment-Specific Configuration

### Configuration by Environment

```typescript
// config/audit-config.ts
export function getAuditConfig(environment: string): AuditConfig {
  const baseConfig: Partial<AuditConfig> = {
    version: '1.0',
    environment
  }
  
  switch (environment) {
    case 'development':
      return {
        ...baseConfig,
        reliableProcessor: {
          queueName: 'dev-audit',
          maxRetries: 1,
          concurrency: 1
        },
        security: {
          enableEncryption: false,
          enableTamperDetection: false
        },
        observability: {
          enableMetrics: false,
          enableTracing: false
        }
      } as AuditConfig
      
    case 'staging':
      return {
        ...baseConfig,
        reliableProcessor: {
          queueName: 'staging-audit',
          maxRetries: 2,
          concurrency: 3
        },
        security: {
          enableEncryption: true,
          enableTamperDetection: true
        },
        compliance: {
          hipaa: { enabled: true, retentionYears: 1 },
          gdpr: { enabled: true, retentionDays: 365 }
        }
      } as AuditConfig
      
    case 'production':
      return {
        ...baseConfig,
        reliableProcessor: {
          queueName: 'prod-audit',
          maxRetries: 3,
          concurrency: 10,
          enableCircuitBreaker: true
        },
        security: {
          enableEncryption: true,
          enableTamperDetection: true,
          requireDigitalSignatures: true
        },
        compliance: {
          hipaa: { 
            enabled: true, 
            retentionYears: 6,
            enableSecurityIncidentReporting: true
          },
          gdpr: { 
            enabled: true, 
            retentionDays: 2190,
            enableDataSubjectRights: true
          }
        },
        observability: {
          enableMetrics: true,
          enableTracing: true,
          enableHealthChecks: true
        }
      } as AuditConfig
      
    default:
      throw new Error(`Unknown environment: ${environment}`)
  }
}

// Usage
const config = getAuditConfig(process.env.NODE_ENV || 'development')
const auditService = new Audit(config, db)
```

## 🔧 Advanced Configuration

### Configuration File Management

```typescript
// Using configuration files
import { ConfigManager } from '@repo/audit'

const configManager = new ConfigManager({
  configDir: './config',
  environment: process.env.NODE_ENV,
  enableHotReload: true,
  enableEncryption: true
})

// Load configuration
const config = await configManager.loadConfig('audit-config.json')

// Watch for changes
configManager.on('configChanged', (newConfig) => {
  console.log('Configuration updated:', newConfig)
  // Handle configuration updates
})
```

### Remote Configuration

```typescript
// Using remote configuration (AWS S3)
const remoteConfig = {
  storage: {
    provider: 's3',
    bucket: 'audit-configs',
    region: 'us-west-2',
    key: `configs/${environment}/audit-config.json`
  },
  encryption: {
    enabled: true,
    kmsKeyId: 'alias/audit-config-key'
  }
}

const configManager = new ConfigManager(remoteConfig)
const config = await configManager.loadRemoteConfig()
```

## ✅ Configuration Validation

### Schema Validation

The audit system automatically validates configuration using JSON Schema:

```typescript
import { validateAuditConfig } from '@repo/audit'

const config: AuditConfig = {
  // ... your configuration
}

const validation = validateAuditConfig(config)

if (!validation.isValid) {
  console.error('Configuration validation failed:')
  validation.errors.forEach(error => {
    console.error(`- ${error.path}: ${error.message}`)
  })
  process.exit(1)
}
```

### Runtime Validation

```typescript
// Enable runtime validation
const config: AuditConfig = {
  // ... base config
  validation: {
    enableRuntimeValidation: true,
    enableStrictMode: true,
    validateIncomingEvents: true,
    validateConfiguration: true
  }
}
```

## 🚨 Common Configuration Issues

### Issue: Invalid Redis Connection

**Problem**: Cannot connect to Redis queue

**Solution**:
```typescript
const config: AuditConfig = {
  // ... base config
  reliableProcessor: {
    queueName: 'audit-events',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      connectTimeout: 10000,
      lazyConnect: true,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    }
  }
}
```

### Issue: Database Schema Mismatch

**Problem**: Database schema version mismatch

**Solution**:
```bash
# Update database schema
pnpm db:push

# Or run migrations
pnpm db:migrate
```

### Issue: Encryption Key Missing

**Problem**: Encryption enabled but no key provided

**Solution**:
```typescript
// Generate encryption key
const crypto = require('crypto')
const encryptionKey = crypto.randomBytes(32).toString('hex')

// Set in environment
process.env.AUDIT_ENCRYPTION_KEY = encryptionKey

// Or in configuration
const config: AuditConfig = {
  // ... base config
  security: {
    encryption: {
      key: process.env.AUDIT_ENCRYPTION_KEY
    }
  }
}
```

## 📝 Next Steps

Once configuration is complete:

1. **Create your first audit event**: [First Audit Event](./first-audit-event.md)
2. **Explore healthcare tutorials**: [Healthcare Compliance](../tutorials/healthcare-compliance.md)
3. **Set up monitoring**: [Monitoring Setup](../tutorials/monitoring-setup.md)
4. **Review security best practices**: [Security Best Practices](../guides/security-best-practices.md)

## 💡 Configuration Tips

- **Start simple**: Begin with minimal configuration and add complexity as needed
- **Environment separation**: Use different configurations for each environment
- **Security first**: Always enable encryption and tamper detection in production
- **Monitor performance**: Enable observability features to track system health
- **Validate early**: Use configuration validation to catch errors early
- **Document changes**: Keep configuration changes documented and versioned

Need help with configuration? Check the [Configuration Troubleshooting](../troubleshooting/configuration-problems.md) guide.