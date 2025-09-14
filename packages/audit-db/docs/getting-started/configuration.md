# Configuration Guide

This guide covers all configuration options available in the `@repo/audit-db` package, from basic database connections to advanced performance optimization settings.

## Configuration Overview

The `@repo/audit-db` package supports multiple configuration approaches:

- **Environment Variables**: For simple configurations and secrets
- **Configuration Objects**: For programmatic configuration
- **Configuration Files**: For complex environment-specific settings
- **Runtime Configuration**: For dynamic configuration changes

## Basic Configuration

### Environment Variables

The package uses these core environment variables:

```env
# Required: Database connection
AUDIT_DB_URL="postgresql://user:password@host:port/database"

# Optional: Redis for caching
REDIS_URL="redis://localhost:6379"

# Optional: Basic pool settings
AUDIT_DB_POOL_MIN=2
AUDIT_DB_POOL_MAX=10
```

### Simple Client Configuration

For basic use cases, configure the client with minimal settings:

```typescript
import { AuditDb, AuditDbWithConfig } from '@repo/audit-db'

// Basic client (uses AUDIT_DB_URL from environment)
const basicClient = new AuditDb()

// Client with simple configuration
const configuredClient = new AuditDbWithConfig({
  connectionString: process.env.AUDIT_DB_URL,
  pool: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000
  }
})
```

## Advanced Configuration

### Enhanced Client Configuration

The `EnhancedAuditDb` client provides comprehensive configuration options:

```typescript
import { EnhancedAuditDb } from '@repo/audit-db'

const enhancedClient = new EnhancedAuditDb({
  // Database connection settings
  connection: {
    connectionString: process.env.AUDIT_DB_URL,
    ssl: process.env.NODE_ENV === 'production'
  },
  
  // Connection pool configuration
  connectionPool: {
    minConnections: 2,
    maxConnections: 20,
    idleTimeout: 30000,
    acquireTimeout: 10000,
    createTimeout: 5000,
    destroyTimeout: 5000,
    reapInterval: 1000,
    createRetryInterval: 200
  },
  
  // Query caching configuration
  queryCache: {
    enabled: true,
    maxSizeMB: 100,
    defaultTTL: 300, // 5 minutes
    maxQueries: 1000,
    keyPrefix: 'audit_query'
  },
  
  // Redis caching configuration
  redis: {
    redisKeyPrefix: 'audit_cache',
    enableLocalCache: true,
    localCacheSizeMB: 50,
    enableCompression: true,
    serializationFormat: 'json'
  },
  
  // Database partitioning configuration
  partitioning: {
    enabled: true,
    strategy: 'range',
    interval: 'monthly',
    retentionDays: 2555, // 7 years for compliance
    autoMaintenance: true,
    maintenanceSchedule: '0 2 * * 0' // Weekly at 2 AM
  },
  
  // Performance monitoring configuration
  monitoring: {
    enabled: true,
    slowQueryThreshold: 1000, // 1 second
    autoOptimization: true,
    collectMetrics: true,
    enableHealthChecks: true
  },
  
  // Compliance configuration
  compliance: {
    gdprEnabled: true,
    hipaaEnabled: true,
    integrityVerification: true,
    retentionPolicies: {
      patient_data: 2555, // 7 years
      audit_logs: 2555,
      system_logs: 365
    }
  }
})
```

## Configuration by Environment

### Development Configuration

Optimized for development with debugging features:

```typescript
// config/development.ts
export const developmentConfig = {
  connection: {
    connectionString: process.env.AUDIT_DB_URL || 'postgresql://audit_user:password@localhost:5432/audit_db'
  },
  
  connectionPool: {
    minConnections: 1,
    maxConnections: 5,
    idleTimeout: 10000
  },
  
  queryCache: {
    enabled: true,
    maxSizeMB: 50,
    defaultTTL: 60, // Short TTL for development
    maxQueries: 100
  },
  
  redis: {
    redisKeyPrefix: 'dev_audit',
    enableLocalCache: false, // Use only local cache in dev
    enableCompression: false
  },
  
  partitioning: {
    enabled: false, // Disable partitioning in development
    autoMaintenance: false
  },
  
  monitoring: {
    enabled: true,
    slowQueryThreshold: 500,
    autoOptimization: false, // Manual optimization in dev
    collectMetrics: true
  },
  
  compliance: {
    gdprEnabled: false, // Simplified compliance in dev
    hipaaEnabled: false,
    integrityVerification: false
  }
}
```

### Staging Configuration

Balanced configuration for testing:

```typescript
// config/staging.ts
export const stagingConfig = {
  connection: {
    connectionString: process.env.AUDIT_DB_URL,
    ssl: true
  },
  
  connectionPool: {
    minConnections: 2,
    maxConnections: 10,
    idleTimeout: 30000
  },
  
  queryCache: {
    enabled: true,
    maxSizeMB: 100,
    defaultTTL: 300,
    maxQueries: 500
  },
  
  redis: {
    redisKeyPrefix: 'staging_audit',
    enableLocalCache: true,
    localCacheSizeMB: 25,
    enableCompression: true
  },
  
  partitioning: {
    enabled: true,
    strategy: 'range',
    interval: 'weekly', // Shorter intervals for testing
    retentionDays: 90,
    autoMaintenance: true
  },
  
  monitoring: {
    enabled: true,
    slowQueryThreshold: 1000,
    autoOptimization: true,
    collectMetrics: true
  },
  
  compliance: {
    gdprEnabled: true,
    hipaaEnabled: true,
    integrityVerification: true,
    retentionPolicies: {
      patient_data: 90,
      audit_logs: 90,
      system_logs: 30
    }
  }
}
```

### Production Configuration

Optimized for performance, security, and compliance:

```typescript
// config/production.ts
export const productionConfig = {
  connection: {
    connectionString: process.env.AUDIT_DB_URL,
    ssl: {
      rejectUnauthorized: true,
      ca: process.env.DB_SSL_CA,
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY
    }
  },
  
  connectionPool: {
    minConnections: 5,
    maxConnections: 50,
    idleTimeout: 60000,
    acquireTimeout: 10000
  },
  
  queryCache: {
    enabled: true,
    maxSizeMB: 500,
    defaultTTL: 900, // 15 minutes
    maxQueries: 10000,
    keyPrefix: 'prod_audit_query'
  },
  
  redis: {
    redisKeyPrefix: 'prod_audit_cache',
    enableLocalCache: true,
    localCacheSizeMB: 100,
    enableCompression: true,
    serializationFormat: 'msgpack' // More efficient than JSON
  },
  
  partitioning: {
    enabled: true,
    strategy: 'range',
    interval: 'monthly',
    retentionDays: 2555, // 7 years
    autoMaintenance: true,
    maintenanceSchedule: '0 2 * * 0', // Sunday 2 AM
    compressionEnabled: true
  },
  
  monitoring: {
    enabled: true,
    slowQueryThreshold: 500,
    autoOptimization: true,
    collectMetrics: true,
    enableHealthChecks: true,
    alerting: {
      enabled: true,
      slowQueryAlerts: true,
      connectionPoolAlerts: true,
      cachePerformanceAlerts: true
    }
  },
  
  compliance: {
    gdprEnabled: true,
    hipaaEnabled: true,
    integrityVerification: true,
    auditIntegrityChecks: true,
    retentionPolicies: {
      patient_data: 2555,
      audit_logs: 2555,
      system_logs: 365,
      security_logs: 2555
    },
    encryptionAtRest: true,
    encryptionInTransit: true
  }
}
```

## Configuration Loading

### Using Configuration Factory

```typescript
// config/index.ts
import { developmentConfig } from './development.js'
import { stagingConfig } from './staging.js'
import { productionConfig } from './production.js'

export function getConfig() {
  const env = process.env.NODE_ENV || 'development'
  
  switch (env) {
    case 'development':
      return developmentConfig
    case 'staging':
      return stagingConfig
    case 'production':
      return productionConfig
    default:
      return developmentConfig
  }
}

// Usage
import { EnhancedAuditDb } from '@repo/audit-db'
import { getConfig } from './config/index.js'

const config = getConfig()
const auditDb = new EnhancedAuditDb(config)
```

### Environment-Specific Configuration Files

Create configuration files for each environment:

```typescript
// config/config.development.json
{
  "database": {
    "url": "postgresql://audit_user:password@localhost:5432/audit_db_dev",
    "pool": {
      "min": 1,
      "max": 5
    }
  },
  "cache": {
    "enabled": true,
    "maxSizeMB": 50,
    "ttl": 60
  },
  "monitoring": {
    "enabled": true,
    "debugMode": true
  }
}
```

```typescript
// config/config.production.json
{
  "database": {
    "url": "${AUDIT_DB_URL}",
    "pool": {
      "min": 5,
      "max": 50
    },
    "ssl": true
  },
  "cache": {
    "enabled": true,
    "maxSizeMB": 500,
    "ttl": 900
  },
  "redis": {
    "enabled": true,
    "keyPrefix": "prod_audit"
  },
  "monitoring": {
    "enabled": true,
    "alerting": true
  }
}
```

### Configuration Validation

Validate configuration at startup:

```typescript
import { z } from 'zod'

const configSchema = z.object({
  connection: z.object({
    connectionString: z.string().url(),
    ssl: z.boolean().optional()
  }),
  connectionPool: z.object({
    minConnections: z.number().min(1),
    maxConnections: z.number().min(1),
    idleTimeout: z.number().positive()
  }),
  queryCache: z.object({
    enabled: z.boolean(),
    maxSizeMB: z.number().positive(),
    defaultTTL: z.number().positive()
  })
})

export function validateConfig(config: unknown) {
  try {
    return configSchema.parse(config)
  } catch (error) {
    console.error('Invalid configuration:', error)
    throw new Error('Configuration validation failed')
  }
}

// Usage
const config = getConfig()
const validatedConfig = validateConfig(config)
const auditDb = new EnhancedAuditDb(validatedConfig)
```

## Performance Tuning Configuration

### High-Performance Configuration

For high-throughput applications:

```typescript
export const highPerformanceConfig = {
  connectionPool: {
    minConnections: 10,
    maxConnections: 100,
    idleTimeout: 120000,
    acquireTimeout: 5000
  },
  
  queryCache: {
    enabled: true,
    maxSizeMB: 1000,
    defaultTTL: 1800,
    maxQueries: 50000
  },
  
  redis: {
    enableLocalCache: true,
    localCacheSizeMB: 500,
    enableCompression: true,
    compressionLevel: 6
  },
  
  partitioning: {
    enabled: true,
    interval: 'daily',
    autoMaintenance: true,
    parallelMaintenance: true
  },
  
  monitoring: {
    slowQueryThreshold: 100,
    batchMetrics: true,
    metricsInterval: 10000
  }
}
```

### Memory-Optimized Configuration

For memory-constrained environments:

```typescript
export const memoryOptimizedConfig = {
  connectionPool: {
    minConnections: 1,
    maxConnections: 5,
    idleTimeout: 15000
  },
  
  queryCache: {
    enabled: true,
    maxSizeMB: 25,
    defaultTTL: 300,
    maxQueries: 100
  },
  
  redis: {
    enableLocalCache: false,
    enableCompression: true,
    compressionLevel: 9
  },
  
  monitoring: {
    collectMetrics: false,
    enableHealthChecks: true
  }
}
```

## Security Configuration

### Encryption Configuration

```typescript
export const securityConfig = {
  connection: {
    ssl: {
      rejectUnauthorized: true,
      ca: process.env.DB_SSL_CA,
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY
    }
  },
  
  encryption: {
    enabled: true,
    algorithm: 'aes-256-gcm',
    keyRotationInterval: 86400000, // 24 hours
    encryptSensitiveFields: true
  },
  
  authentication: {
    requireClientCerts: true,
    allowedCertificates: process.env.ALLOWED_CERTS?.split(',')
  },
  
  compliance: {
    auditIntegrityChecks: true,
    encryptionAtRest: true,
    encryptionInTransit: true,
    keyManagement: 'aws-kms' // or 'azure-keyvault', 'gcp-kms'
  }
}
```

## Compliance Configuration

### GDPR Configuration

```typescript
export const gdprConfig = {
  compliance: {
    gdprEnabled: true,
    dataClassification: {
      personalData: ['patient_id', 'name', 'email', 'phone'],
      sensitiveData: ['medical_record', 'diagnosis', 'treatment'],
      publicData: ['timestamp', 'action', 'status']
    },
    retentionPolicies: {
      personal_data: 2555, // 7 years
      sensitive_data: 2555,
      public_data: 3650 // 10 years
    },
    rightsManagement: {
      rightToAccess: true,
      rightToRectification: true,
      rightToErasure: true,
      rightToPortability: true
    },
    consentManagement: {
      trackConsent: true,
      consentExpiry: 730 // 2 years
    }
  }
}
```

### HIPAA Configuration

```typescript
export const hipaaConfig = {
  compliance: {
    hipaaEnabled: true,
    accessControls: {
      roleBasedAccess: true,
      minimumNecessary: true,
      accessLogging: true
    },
    auditControls: {
      integrityVerification: true,
      tamperDetection: true,
      auditLogEncryption: true
    },
    transmission: {
      encryptionRequired: true,
      integrityChecks: true,
      accessControls: true
    },
    dataIntegrity: {
      checksumVerification: true,
      digitalSignatures: true,
      immutableLogs: true
    }
  }
}
```

## Configuration Best Practices

### 1. Environment Separation

```typescript
// Never mix environments
const config = {
  development: developmentConfig,
  staging: stagingConfig,
  production: productionConfig
}[process.env.NODE_ENV || 'development']
```

### 2. Secret Management

```typescript
// Use environment variables for secrets
const config = {
  connection: {
    connectionString: process.env.AUDIT_DB_URL,
    ssl: {
      ca: process.env.DB_SSL_CA,
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY
    }
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY
  }
}
```

### 3. Configuration Validation

```typescript
// Always validate configuration
function createAuditClient(config: any) {
  const validatedConfig = validateConfig(config)
  return new EnhancedAuditDb(validatedConfig)
}
```

### 4. Performance Monitoring

```typescript
// Monitor configuration effectiveness
const config = {
  monitoring: {
    enabled: true,
    configMetrics: true,
    performanceBaseline: true
  }
}
```

## Configuration Reference

### Complete Configuration Schema

```typescript
interface AuditDbConfig {
  connection: {
    connectionString: string
    ssl?: boolean | TLSOptions
  }
  
  connectionPool: {
    minConnections: number
    maxConnections: number
    idleTimeout: number
    acquireTimeout: number
    createTimeout?: number
    destroyTimeout?: number
    reapInterval?: number
    createRetryInterval?: number
  }
  
  queryCache: {
    enabled: boolean
    maxSizeMB: number
    defaultTTL: number
    maxQueries: number
    keyPrefix?: string
  }
  
  redis?: {
    redisKeyPrefix: string
    enableLocalCache: boolean
    localCacheSizeMB: number
    enableCompression: boolean
    compressionLevel?: number
    serializationFormat: 'json' | 'msgpack'
  }
  
  partitioning?: {
    enabled: boolean
    strategy: 'range' | 'hash'
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly'
    retentionDays: number
    autoMaintenance: boolean
    maintenanceSchedule?: string
    compressionEnabled?: boolean
    parallelMaintenance?: boolean
  }
  
  monitoring?: {
    enabled: boolean
    slowQueryThreshold: number
    autoOptimization: boolean
    collectMetrics: boolean
    enableHealthChecks: boolean
    batchMetrics?: boolean
    metricsInterval?: number
    alerting?: {
      enabled: boolean
      slowQueryAlerts: boolean
      connectionPoolAlerts: boolean
      cachePerformanceAlerts: boolean
    }
  }
  
  compliance?: {
    gdprEnabled: boolean
    hipaaEnabled: boolean
    integrityVerification: boolean
    auditIntegrityChecks?: boolean
    retentionPolicies: Record<string, number>
    encryptionAtRest?: boolean
    encryptionInTransit?: boolean
    dataClassification?: {
      personalData: string[]
      sensitiveData: string[]
      publicData: string[]
    }
  }
}
```

## Next Steps

Now that you understand configuration:

1. **[Basic Usage Tutorial](../tutorials/basic-usage.md)** - Apply your configuration
2. **[Performance Optimization](../tutorials/performance-optimization.md)** - Use advanced features
3. **[Environment Setup Guide](../guides/environment-setup.md)** - Production deployment
4. **[Security Best Practices](../guides/security-compliance.md)** - Secure your configuration

For specific configuration help, see:
- **[Troubleshooting Guide](../guides/troubleshooting.md)** - Configuration issues
- **[FAQ](../faq.md)** - Common configuration questions