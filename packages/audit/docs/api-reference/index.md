# API Reference

Complete API documentation for the `@repo/audit` package. This reference provides detailed information about all classes, interfaces, functions, and configuration options.

## 📚 API Overview

The `@repo/audit` package provides a comprehensive audit logging system with the following main components:

### Core Classes
- **[Audit Class](./audit-class.md)** - Main audit service class for logging events

### Data Types & Interfaces
- **[Event Types](./event-types.md)** - Audit event interfaces and types

### System Components
- **[Configuration](./configuration.md)** - Configuration management and validation
- **[Cryptography](./cryptography.md)** - Cryptographic services and security
- **[Monitoring](./monitoring.md)** - Real-time monitoring and alerting
- **[Compliance](./compliance.md)** - HIPAA and GDPR compliance systems
- **[Utilities](./utilities.md)** - Validation, sanitization, and helper functions

## 🔧 Core API Components

### Primary Interface

```typescript
import { Audit, AuditConfig, AuditLogEvent } from '@repo/audit'

// Initialize audit service
const auditService = new Audit(config, db)

// Log an event
await auditService.log(event)
```

### Main Exports

| Export | Type | Description |
|--------|------|-------------|
| `Audit` | Class | Main audit service class |
| `AuditConfig` | Interface | Configuration interface |
| `AuditLogEvent` | Interface | Base audit event interface |
| `CryptoService` | Class | Cryptographic operations |
| `MonitoringService` | Class | System monitoring and health checks |
| `ConfigurationManager` | Class | Configuration management |

## 🏥 Healthcare-Specific APIs

### HIPAA Compliance

```typescript
import { HIPAAAuditService } from '@repo/audit'

// Log PHI access with HIPAA compliance
await HIPAAAuditService.logPHIAccess({
  principalId: 'dr.smith',
  patientId: 'patient-123',
  action: 'chart_view',
  accessReason: 'routine_checkup',
  minimumNecessaryJustification: 'Reviewing vitals for appointment'
})
```

### GDPR Compliance

```typescript
import { GDPRAuditService } from '@repo/audit'

// Log data processing with GDPR compliance
await GDPRAuditService.logDataProcessing({
  principalId: 'nurse-456',
  dataSubjectId: 'patient-123',
  processingPurpose: 'medical_treatment',
  legalBasis: 'vital_interests'
})
```

## 🔒 Security APIs

For comprehensive cryptographic operations, see **[Cryptography API](./cryptography.md)**.

### Quick Example

```typescript
import { CryptoService } from '@repo/audit'

const crypto = new CryptoService(securityConfig)

// Generate event hash
const hash = crypto.generateHash(event)

// Generate digital signature
const signature = await crypto.generateEventSignature(event)

// Verify integrity
const isValid = crypto.verifyHash(event, expectedHash)
```

## 📊 Monitoring APIs

For comprehensive monitoring and observability, see **[Monitoring API](./monitoring.md)**.

### Quick Example

```typescript
import { MonitoringService, HealthCheckService } from '@repo/audit'

// Initialize monitoring
const monitoring = new MonitoringService(config)

// Check system health
const health = await HealthCheckService.checkAll()

// Process events with monitoring
await monitoring.processEvent(auditEvent)
```

## 🔧 Configuration APIs

For comprehensive configuration management, see **[Configuration API](./configuration.md)**.

### Quick Example

```typescript
import { ConfigurationManager } from '@repo/audit'

// Initialize with hot reloading
const configManager = new ConfigurationManager({
  enableHotReload: true,
  enableSecureStorage: true
})

// Load and validate
const config = await configManager.loadConfig()
const validation = configManager.validateConfig(config)
```

## 🏥 Compliance APIs

For HIPAA and GDPR compliance features, see **[Compliance API](./compliance.md)**.

### Quick Example

```typescript
import { HIPAAComplianceService, GDPRComplianceService } from '@repo/audit'

// HIPAA compliance
const hipaaService = new HIPAAComplianceService(config)
await hipaaService.logPHIAccess(phiEvent)

// GDPR compliance
const gdprService = new GDPRComplianceService(client, audit, kms)
const exportData = await gdprService.exportUserData(request)
```

## 🛠️ Utilities APIs

For validation, sanitization, and helper functions, see **[Utilities API](./utilities.md)**.

### Quick Example

```typescript
import { validateAuditEvent, sanitizeAuditEvent, GDPRUtils } from '@repo/audit'

// Validate event
const validation = validateAuditEvent(event)

// Sanitize event
const sanitized = sanitizeAuditEvent(event)

// GDPR utilities
const pseudonym = GDPRUtils.generateDeterministicPseudonym(originalId)
```

## 🚀 Advanced APIs

### Reliable Processing

```typescript
import { ReliableEventProcessor } from '@repo/audit'

// Configure reliable processing
const processor = new ReliableEventProcessor({
  maxRetries: 3,
  retryDelay: 1000,
  enableCircuitBreaker: true,
  enableDLQ: true
})
```

### Dead Letter Queue

```typescript
import { DeadLetterQueue } from '@repo/audit'

// Handle failed events
const dlq = new DeadLetterQueue('audit-dlq')
const failedEvents = await dlq.getFailedEvents()
```

### Circuit Breaker

```typescript
import { CircuitBreaker } from '@repo/audit'

// Monitor system health
const breaker = new CircuitBreaker({
  threshold: 10,
  timeout: 30000
})

const isOpen = breaker.isOpen()
```

## 📝 Type Definitions

### Core Types

```typescript
// Event status
type AuditEventStatus = 'attempt' | 'success' | 'failure'

// Data classification
type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'

// Action types
type SystemAuditAction = 'system.startup' | 'system.shutdown' | ...
type AuthAuditAction = 'auth.login.attempt' | 'auth.login.success' | ...
type DataAuditAction = 'data.read' | 'data.create' | 'data.update' | ...
type FHIRAuditAction = 'fhir.patient.read' | 'fhir.patient.create' | ...
```

### Configuration Types

```typescript
interface AuditConfig {
  version: string
  environment: string
  reliableProcessor: ReliableProcessorConfig
  security: SecurityConfig
  compliance: ComplianceConfig
  observability: ObservabilityConfig
}
```

## 🔗 Quick Navigation

### Essential APIs
- **[Audit Class](./audit-class.md)** - Core functionality
- **[Event Types](./event-types.md)** - Event structures
- **[Configuration](./configuration.md)** - System configuration
- **[Cryptography](./cryptography.md)** - Security and integrity
- **[Monitoring](./monitoring.md)** - System monitoring
- **[Compliance](./compliance.md)** - Regulatory compliance
- **[Utilities](./utilities.md)** - Helper functions

## 💡 Usage Patterns

### Basic Usage
```typescript
// Simple event logging
await auditService.log({
  principalId: 'user-123',
  action: 'user.login',
  status: 'success'
})
```

### Healthcare Usage
```typescript
// PHI access with compliance
await auditService.logFHIR({
  principalId: 'dr.smith',
  action: 'fhir.patient.read',
  resourceId: 'patient-456',
  status: 'success'
})
```

### Enterprise Usage
```typescript
// High-volume with monitoring
await auditService.logCritical(event, {
  priority: 1,
  compliance: ['hipaa'],
  notify: ['security-team']
})
```

## 📞 Support

- **[Examples](../examples/)** - Practical usage examples
- **[Guides](../guides/)** - Implementation guides
- **[Troubleshooting](../troubleshooting/)** - Common issues
- **[FAQ](../faq/)** - Frequently asked questions

This API reference provides comprehensive documentation for all available functionality in the `@repo/audit` package.