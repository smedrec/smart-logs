# Audit Class API Reference

The `Audit` class is the core component of the audit logging system, providing methods for logging events with cryptographic integrity, reliable processing, and healthcare compliance.

## Class Overview

```typescript
export class Audit {
  constructor(
    config: AuditConfig,
    db: PostgresJsDatabase<any>,
    redisOrUrlOrOptions?: string | Redis | { url?: string; options?: RedisOptions },
    directConnectionOptions?: RedisOptions
  )
}
```

## Constructor

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config` | `AuditConfig` | ✅ | Audit service configuration |
| `db` | `PostgresJsDatabase<any>` | ✅ | Drizzle database instance |
| `redisOrUrlOrOptions` | `string \| Redis \| object` | ❌ | Redis connection configuration |
| `directConnectionOptions` | `RedisOptions` | ❌ | Additional Redis options |

### Constructor Examples

```typescript
import { Audit } from '@repo/audit'
import { db } from '@repo/audit-db'

// Basic usage with shared Redis connection
const auditService = new Audit(config, db)

// With dedicated Redis URL
const auditService = new Audit(config, db, 'redis://localhost:6379')

// With Redis instance
const redis = new Redis('redis://localhost:6379')
const auditService = new Audit(config, db, redis)

// With connection options
const auditService = new Audit(config, db, {
  url: 'redis://localhost:6379',
  options: { maxRetriesPerRequest: 3 }
})
```

## Core Methods

### log()

Logs a standard audit event to the queue for processing.

```typescript
async log(
  eventDetails: Omit<AuditLogEvent, 'timestamp'>,
  options?: {
    generateHash?: boolean
    generateSignature?: boolean
    correlationId?: string
    eventVersion?: string
    skipValidation?: boolean
    validationConfig?: ValidationConfig
  }
): Promise<void>
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `eventDetails` | `Omit<AuditLogEvent, 'timestamp'>` | ✅ | - | Event data (timestamp auto-generated) |
| `options.generateHash` | `boolean` | ❌ | `true` | Generate cryptographic hash |
| `options.generateSignature` | `boolean` | ❌ | `true` | Generate digital signature |
| `options.correlationId` | `string` | ❌ | - | Correlation ID for related events |
| `options.eventVersion` | `string` | ❌ | `"1.0"` | Event schema version |
| `options.skipValidation` | `boolean` | ❌ | `false` | Skip event validation |
| `options.validationConfig` | `ValidationConfig` | ❌ | - | Custom validation configuration |

#### Example

```typescript
await auditService.log({
  principalId: 'user-123',
  action: 'user.login',
  status: 'success',
  sessionContext: {
    sessionId: 'sess-abc123',
    ipAddress: '192.168.1.100',
    userAgent: 'Browser/1.0'
  },
  outcomeDescription: 'User successfully logged in'
}, {
  generateHash: true,
  generateSignature: true,
  correlationId: 'login-flow-456'
})
```

### logAuth()

Logs authentication-related events with enhanced security context.

```typescript
async logAuth(event: AuthAuditEvent): Promise<void>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event` | `AuthAuditEvent` | ✅ | Authentication audit event |

#### Example

```typescript
await auditService.logAuth({
  principalId: 'user-123',
  action: 'auth.login.success',
  status: 'success',
  authMethod: 'password',
  sessionContext: {
    sessionId: 'sess-def456',
    ipAddress: '10.0.1.50',
    userAgent: 'Mobile-App/2.1'
  },
  securityContext: {
    riskLevel: 'low',
    deviceTrusted: true
  }
})
```

### logFHIR()

Logs FHIR resource interactions for healthcare compliance.

```typescript
async logFHIR(event: FHIRAuditEvent): Promise<void>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event` | `FHIRAuditEvent` | ✅ | FHIR audit event |

#### Example

```typescript
await auditService.logFHIR({
  principalId: 'practitioner-456',
  action: 'fhir.patient.read',
  status: 'success',
  resourceType: 'Patient',
  resourceId: 'patient-789',
  fhirContext: {
    version: 'R4',
    interaction: 'read',
    compartment: 'Patient/patient-789'
  },
  sessionContext: {
    sessionId: 'sess-ghi789',
    ipAddress: '192.168.1.200',
    userAgent: 'EMR-System/3.2'
  },
  dataClassification: 'PHI'
})
```

### logData()

Logs data access and modification events.

```typescript
async logData(event: DataAuditEvent): Promise<void>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event` | `DataAuditEvent` | ✅ | Data audit event |

#### Example

```typescript
await auditService.logData({
  principalId: 'nurse-789',
  action: 'data.update',
  status: 'success',
  targetResourceType: 'PatientRecord',
  targetResourceId: 'record-123',
  dataClassification: 'PHI',
  changes: {
    field: 'contactPhone',
    oldValue: '(555) 123-4567',
    newValue: '(555) 987-6543'
  },
  dataVolume: {
    recordsModified: 1
  }
})
```

### logCritical()

Logs high-priority events with immediate processing and notifications.

```typescript
async logCritical(
  event: AuditLogEvent,
  options?: {
    priority?: number
    compliance?: string[]
    notify?: string[]
    escalate?: boolean
  }
): Promise<void>
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `event` | `AuditLogEvent` | ✅ | - | Critical audit event |
| `options.priority` | `number` | ❌ | `1` | Processing priority (1-10) |
| `options.compliance` | `string[]` | ❌ | `[]` | Compliance frameworks |
| `options.notify` | `string[]` | ❌ | `[]` | Notification recipients |
| `options.escalate` | `boolean` | ❌ | `false` | Escalate to management |

#### Example

```typescript
await auditService.logCritical({
  principalId: 'security-system',
  action: 'security.breach.detected',
  status: 'failure',
  dataClassification: 'CONFIDENTIAL',
  securityContext: {
    threatLevel: 'high',
    attackVector: 'brute_force'
  }
}, {
  priority: 1,
  compliance: ['hipaa'],
  notify: ['security-team', 'compliance-officer'],
  escalate: true
})
```

## Cryptographic Methods

### generateEventHash()

Generates SHA-256 hash for event integrity verification.

```typescript
generateEventHash(event: AuditLogEvent): string
```

#### Example

```typescript
const event = { /* audit event */ }
const hash = auditService.generateEventHash(event)
console.log('Event hash:', hash)
```

### verifyEventHash()

Verifies the integrity of an audit event using its hash.

```typescript
verifyEventHash(event: AuditLogEvent, expectedHash: string): boolean
```

#### Example

```typescript
const isValid = auditService.verifyEventHash(event, expectedHash)
if (!isValid) {
  console.error('Event integrity compromised!')
}
```

### generateEventSignature()

Generates cryptographic signature for event authenticity.

```typescript
async generateEventSignature(
  event: AuditLogEvent,
  signingAlgorithm?: SigningAlgorithm
): Promise<EventSignatureResponse>
```

#### Example

```typescript
const signatureResponse = await auditService.generateEventSignature(event)
console.log('Signature:', signatureResponse.signature)
console.log('Algorithm:', signatureResponse.algorithm)
```

### verifyEventSignature()

Verifies the authenticity of an audit event using its signature.

```typescript
async verifyEventSignature(
  event: AuditLogEvent,
  signature: string,
  signingAlgorithm?: SigningAlgorithm
): Promise<boolean>
```

#### Example

```typescript
const isAuthentic = await auditService.verifyEventSignature(event, signature)
if (!isAuthentic) {
  console.error('Event signature verification failed!')
}
```

## Monitoring Methods

### getHealth()

Returns the health status of the audit service.

```typescript
async getHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  details: {
    database: boolean
    redis: boolean
    queue: QueueStats
    circuitBreaker: CircuitBreakerStatus
  }
}>
```

#### Example

```typescript
const health = await auditService.getHealth()
console.log('Service status:', health.status)
console.log('Database healthy:', health.details.database)
console.log('Queue depth:', health.details.queue.waiting)
```

### getQueueStats()

Returns detailed queue statistics.

```typescript
async getQueueStats(): Promise<{
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
}>
```

#### Example

```typescript
const stats = await auditService.getQueueStats()
console.log('Queue statistics:', {
  waiting: stats.waiting,
  active: stats.active,
  completed: stats.completed,
  failed: stats.failed
})
```

### getMetrics()

Returns performance and system metrics.

```typescript
async getMetrics(): Promise<{
  processingLatency: number
  throughput: number
  errorRate: number
  queueDepth: number
  systemLoad: number
}>
```

#### Example

```typescript
const metrics = await auditService.getMetrics()
console.log('Average latency:', metrics.processingLatency, 'ms')
console.log('Throughput:', metrics.throughput, 'events/sec')
console.log('Error rate:', metrics.errorRate * 100, '%')
```

## Configuration Methods

### updateConfig()

Updates the audit service configuration at runtime.

```typescript
async updateConfig(newConfig: Partial<AuditConfig>): Promise<void>
```

#### Example

```typescript
await auditService.updateConfig({
  reliableProcessor: {
    ...currentConfig.reliableProcessor,
    maxRetries: 5
  }
})
```

### getConfig()

Returns the current configuration.

```typescript
getConfig(): AuditConfig
```

#### Example

```typescript
const config = auditService.getConfig()
console.log('Current environment:', config.environment)
console.log('Queue name:', config.reliableProcessor.queueName)
```

## Connection Management

### closeConnection()

Gracefully closes the audit service connections.

```typescript
async closeConnection(): Promise<void>
```

#### Example

```typescript
// Graceful shutdown
process.on('SIGTERM', async () => {
  await auditService.closeConnection()
  process.exit(0)
})
```

### isConnected()

Checks if the service is connected and ready.

```typescript
isConnected(): boolean
```

#### Example

```typescript
if (!auditService.isConnected()) {
  console.warn('Audit service not connected')
}
```

## Error Handling

The Audit class throws specific error types for different failure scenarios:

### AuditValidationError

Thrown when event validation fails.

```typescript
try {
  await auditService.log(invalidEvent)
} catch (error) {
  if (error instanceof AuditValidationError) {
    console.error('Validation failed:', error.field, error.code)
  }
}
```

### AuditConnectionError

Thrown when Redis or database connection fails.

```typescript
try {
  await auditService.log(event)
} catch (error) {
  if (error.name === 'AuditConnectionError') {
    console.error('Connection failed:', error.message)
    // Implement retry logic
  }
}
```

### AuditProcessingError

Thrown when event processing fails.

```typescript
try {
  await auditService.log(event)
} catch (error) {
  if (error.name === 'AuditProcessingError') {
    console.error('Processing failed:', error.message)
    // Implement fallback logic
  }
}
```

## Best Practices

### Initialization

```typescript
// Healthcare-compliant initialization
const config: AuditConfig = {
  version: '1.0',
  environment: 'production',
  reliableProcessor: {
    queueName: 'healthcare-audit',
    maxRetries: 3,
    enableCircuitBreaker: true
  },
  security: {
    enableEncryption: true,
    enableTamperDetection: true
  },
  compliance: {
    hipaa: { enabled: true, retentionYears: 6 },
    gdpr: { enabled: true, retentionDays: 365 }
  }
}

const auditService = new Audit(config, db)
```

### Event Logging

```typescript
// Always include sufficient context
await auditService.log({
  principalId: 'user-123',
  action: 'patient.chart.view',
  status: 'success',
  targetResourceType: 'PatientChart',
  targetResourceId: 'chart-456',
  dataClassification: 'PHI',
  sessionContext: {
    sessionId: 'sess-789',
    ipAddress: '192.168.1.100',
    userAgent: 'EMR-Browser/1.0'
  },
  outcomeDescription: 'Physician viewed patient chart for routine checkup'
})
```

### Error Handling

```typescript
// Robust error handling
async function logEventSafely(event: AuditLogEvent) {
  try {
    await auditService.log(event)
  } catch (error) {
    // Log the error but don't throw - audit failures shouldn't break the app
    console.error('Audit logging failed:', error)
    
    // Implement fallback storage
    await fallbackAuditStorage.store(event)
  }
}
```

### Resource Management

```typescript
// Proper cleanup
class HealthcareApp {
  private auditService: Audit
  
  async shutdown() {
    try {
      await this.auditService.closeConnection()
      console.log('Audit service closed gracefully')
    } catch (error) {
      console.error('Error during audit service shutdown:', error)
    }
  }
}
```

## Performance Considerations

- **Batch Operations**: Use batch processing for high-volume scenarios
- **Connection Pooling**: Reuse audit service instances
- **Queue Monitoring**: Monitor queue depth and processing latency
- **Circuit Breaker**: Enable circuit breaker for resilience
- **Resource Cleanup**: Always close connections during shutdown

## Related APIs

- **[Event Types](./event-types.md)** - Event interfaces and structures
- **[Configuration](./configuration.md)** - Configuration options
- **[Cryptography](./cryptography.md)** - Security functions
- **[Monitoring](./monitoring.md)** - Health and metrics APIs