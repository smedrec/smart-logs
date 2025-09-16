# Event Types API Reference

Comprehensive documentation for all audit event types, interfaces, and factory functions in the `@repo/audit` package.

## Overview

The audit system provides strongly-typed event interfaces for different categories of operations, ensuring consistency and compliance across healthcare applications.

## Core Interfaces

### AuditLogEvent

Base interface for all audit events in the system.

```typescript
interface AuditLogEvent {
  timestamp: string                    // ISO 8601 timestamp
  action: string                      // Action performed (required)
  status: AuditEventStatus           // Event status (required)
  
  // Identity & Context
  principalId?: string               // Who performed the action
  organizationId?: string            // Organization context
  targetResourceType?: string        // Type of resource affected
  targetResourceId?: string          // Specific resource identifier
  
  // Descriptive Information
  outcomeDescription?: string        // Detailed outcome description
  correlationId?: string            // Related event correlation
  eventVersion?: string             // Event schema version
  
  // Security & Integrity
  hash?: string                     // Cryptographic hash
  hashAlgorithm?: 'SHA-256'        // Hash algorithm
  signature?: string               // Digital signature
  algorithm?: SigningAlgorithm     // Signing algorithm
  
  // Classification & Context
  dataClassification?: DataClassification  // Data sensitivity level
  retentionPolicy?: string         // Data retention policy
  sessionContext?: SessionContext  // Session information
  
  // Performance Monitoring
  processingLatency?: number       // Processing time in ms
  queueDepth?: number             // Queue depth at processing
  
  // Extensible properties
  [key: string]: any              // Additional context
}
```

### AuditEventStatus

Enumeration of possible event outcomes.

```typescript
type AuditEventStatus = 'attempt' | 'success' | 'failure'
```

- **`attempt`**: Action was attempted but outcome is pending
- **`success`**: Action completed successfully
- **`failure`**: Action failed to complete

### DataClassification

Data sensitivity classification levels.

```typescript
type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'
```

- **`PUBLIC`**: Publicly available information
- **`INTERNAL`**: Internal organizational data
- **`CONFIDENTIAL`**: Sensitive business information
- **`PHI`**: Protected Health Information (HIPAA)

### SessionContext

Context information about the user session.

```typescript
interface SessionContext {
  sessionId: string        // Unique session identifier
  ipAddress: string       // Source IP address
  userAgent: string       // User agent string
  geolocation?: string    // Geographic location
}
```

## Specialized Event Interfaces

### SystemAuditEvent

Events related to system operations and maintenance.

```typescript
interface SystemAuditEvent extends BaseAuditEvent {
  category: 'system'
  action: SystemAuditAction
  systemComponent?: string
  configurationChanges?: Record<string, { old: any; new: any }>
  maintenanceDetails?: {
    type: 'scheduled' | 'emergency' | 'routine'
    duration?: number
    affectedServices?: string[]
  }
  backupDetails?: {
    type: 'full' | 'incremental' | 'differential'
    size?: number
    location?: string
  }
}
```

#### SystemAuditAction Types

```typescript
type SystemAuditAction =
  | 'system.startup'
  | 'system.shutdown'
  | 'system.configuration.change'
  | 'system.backup.created'
  | 'system.backup.restored'
  | 'system.maintenance.started'
  | 'system.maintenance.completed'
```

### AuthAuditEvent

Events related to authentication and authorization.

```typescript
interface AuthAuditEvent extends BaseAuditEvent {
  category: 'auth'
  action: AuthAuditAction
  authMethod?: 'password' | 'mfa' | 'sso' | 'api_key' | 'oauth'
  reason?: string
  securityContext?: {
    riskLevel?: 'low' | 'medium' | 'high'
    deviceTrusted?: boolean
    locationTrusted?: boolean
    authenticationStrength?: number
  }
  sessionDetails?: {
    sessionDuration?: number
    deviceFingerprint?: string
    previousLoginAt?: string
  }
}
```

#### AuthAuditAction Types

```typescript
type AuthAuditAction =
  | 'auth.login.attempt'
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.logout'
  | 'auth.password.change'
  | 'auth.mfa.enabled'
  | 'auth.mfa.disabled'
  | 'auth.session.expired'
  | 'auth.session.revoked'
  | 'auth.account.banned'
  | 'auth.permissions.check'
  | 'auth.permissions.grant'
  | 'auth.permissions.revoke'
  | 'auth.role.assign'
  | 'auth.role.unassign'
```

### DataAuditEvent

Events related to data access and manipulation.

```typescript
interface DataAuditEvent extends BaseAuditEvent {
  category: 'data'
  action: DataAuditAction
  dataCategory?: string[]
  dataVolume?: {
    recordsProcessed?: number
    recordsSuccessful?: number
    recordsFailed?: number
    bytesProcessed?: number
  }
  changes?: {
    field: string
    oldValue?: any
    newValue?: any
  }
  queryDetails?: {
    queryType?: 'select' | 'insert' | 'update' | 'delete'
    tableName?: string
    conditions?: string
    resultCount?: number
  }
}
```

#### DataAuditAction Types

```typescript
type DataAuditAction =
  | 'data.read'
  | 'data.create'
  | 'data.update'
  | 'data.delete'
  | 'data.export'
  | 'data.import'
  | 'data.share'
  | 'data.anonymize'
```

### FHIRAuditEvent

Events specific to FHIR resource interactions in healthcare systems.

```typescript
interface FHIRAuditEvent extends BaseAuditEvent {
  category: 'fhir'
  action: FHIRAuditAction
  resourceType: string
  resourceId?: string
  fhirContext: {
    version: 'DSTU2' | 'STU3' | 'R4' | 'R5'
    interaction: 'create' | 'read' | 'update' | 'delete' | 'search' | 'batch'
    compartment?: string
    endpoint?: string
    operationName?: string
    searchParameters?: Record<string, string>
  }
  clinicalContext?: {
    encounterType?: string
    specialty?: string
    urgency?: 'routine' | 'urgent' | 'emergency'
    consentStatus?: 'granted' | 'denied' | 'withdrawn'
  }
}
```

#### FHIRAuditAction Types

```typescript
type FHIRAuditAction =
  | 'fhir.patient.read'
  | 'fhir.patient.create'
  | 'fhir.patient.update'
  | 'fhir.patient.delete'
  | 'fhir.practitioner.read'
  | 'fhir.observation.create'
  | 'fhir.observation.read'
  | 'fhir.encounter.create'
  | 'fhir.medicationrequest.create'
  | 'fhir.bundle.process'
  | 'fhir.bundle.submit'
```

## Event Factory Functions

Factory functions provide a convenient way to create properly typed and validated audit events.

### createAuditEvent()

Creates a generic audit event with automatic timestamp and validation.

```typescript
function createAuditEvent(
  action: string,
  params: Partial<AuditLogEvent>,
  config?: EventFactoryConfig
): AuditLogEvent
```

#### Example

```typescript
const event = createAuditEvent('user.profile.update', {
  principalId: 'user-123',
  status: 'success',
  targetResourceType: 'UserProfile',
  targetResourceId: 'profile-456',
  outcomeDescription: 'User profile updated successfully'
})
```

### createSystemAuditEvent()

Creates a system audit event with system-specific context.

```typescript
function createSystemAuditEvent(
  action: SystemAuditAction,
  params: Partial<SystemAuditEvent>,
  config?: EventFactoryConfig
): SystemAuditEvent
```

#### Example

```typescript
const systemEvent = createSystemAuditEvent('system.backup.created', {
  status: 'success',
  principalId: 'backup-service',
  systemComponent: 'database-backup',
  backupDetails: {
    type: 'full',
    size: 1024000000, // 1GB
    location: 's3://backups/db-backup-2024-01-15.sql'
  },
  outcomeDescription: 'Full database backup completed successfully'
})
```

### createAuthAuditEvent()

Creates an authentication audit event with security context.

```typescript
function createAuthAuditEvent(
  action: AuthAuditAction,
  params: Partial<AuthAuditEvent>,
  config?: EventFactoryConfig
): AuthAuditEvent
```

#### Example

```typescript
const authEvent = createAuthAuditEvent('auth.login.success', {
  principalId: 'user-789',
  status: 'success',
  authMethod: 'mfa',
  sessionContext: {
    sessionId: 'sess-abc123',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Mobile)'
  },
  securityContext: {
    riskLevel: 'low',
    deviceTrusted: true,
    authenticationStrength: 95
  },
  outcomeDescription: 'User logged in successfully with MFA'
})
```

### createDataAuditEvent()

Creates a data audit event with data-specific context.

```typescript
function createDataAuditEvent(
  action: DataAuditAction,
  params: Partial<DataAuditEvent>,
  config?: EventFactoryConfig
): DataAuditEvent
```

#### Example

```typescript
const dataEvent = createDataAuditEvent('data.update', {
  principalId: 'admin-456',
  status: 'success',
  targetResourceType: 'PatientRecord',
  targetResourceId: 'patient-123',
  dataClassification: 'PHI',
  changes: {
    field: 'emergencyContact',
    oldValue: 'John Doe (555) 123-4567',
    newValue: 'Jane Smith (555) 987-6543'
  },
  outcomeDescription: 'Patient emergency contact updated'
})
```

### createFHIRAuditEvent()

Creates a FHIR-specific audit event with healthcare context.

```typescript
function createFHIRAuditEvent(
  action: FHIRAuditAction,
  params: Partial<FHIRAuditEvent>,
  config?: EventFactoryConfig
): FHIRAuditEvent
```

#### Example

```typescript
const fhirEvent = createFHIRAuditEvent('fhir.patient.read', {
  principalId: 'practitioner-789',
  status: 'success',
  resourceType: 'Patient',
  resourceId: 'patient-456',
  dataClassification: 'PHI',
  fhirContext: {
    version: 'R4',
    interaction: 'read',
    compartment: 'Patient/patient-456',
    endpoint: '/fhir/Patient/patient-456'
  },
  clinicalContext: {
    encounterType: 'outpatient',
    specialty: 'cardiology',
    urgency: 'routine',
    consentStatus: 'granted'
  },
  sessionContext: {
    sessionId: 'sess-def456',
    ipAddress: '10.0.1.100',
    userAgent: 'EMR-System/3.2'
  },
  outcomeDescription: 'Cardiologist accessed patient record for routine consultation'
})
```

## Event Factory Configuration

### EventFactoryConfig

Configuration options for event factory functions.

```typescript
interface EventFactoryConfig {
  generateHash?: boolean           // Generate cryptographic hash
  generateSignature?: boolean      // Generate digital signature
  includeStackTrace?: boolean      // Include stack trace for debugging
  validateOnCreation?: boolean     // Validate event on creation
  defaultDataClassification?: DataClassification
  defaultRetentionPolicy?: string
  customFields?: Record<string, any>
}
```

### Default Factory Configuration

```typescript
const DEFAULT_FACTORY_CONFIG: EventFactoryConfig = {
  generateHash: true,
  generateSignature: false,
  includeStackTrace: false,
  validateOnCreation: true,
  defaultDataClassification: 'INTERNAL',
  defaultRetentionPolicy: 'standard'
}
```

## Event Categorization

### Automatic Categorization

The system automatically categorizes events based on their action patterns:

```typescript
import { 
  isSystemAction, 
  isAuthAction, 
  isDataAction, 
  isFHIRAction 
} from '@repo/audit'

// Categorization functions
const isSystem = isSystemAction('system.startup')        // true
const isAuth = isAuthAction('auth.login.success')        // true
const isData = isDataAction('data.create')               // true
const isFHIR = isFHIRAction('fhir.patient.read')        // true
```

### Category Detection

```typescript
function detectEventCategory(action: string): EventCategory {
  if (isSystemAction(action)) return 'system'
  if (isAuthAction(action)) return 'auth'
  if (isDataAction(action)) return 'data'
  if (isFHIRAction(action)) return 'fhir'
  return 'custom'
}
```

## Compliance Extensions

### HIPAA Compliance Fields

For PHI-related events, include additional HIPAA compliance fields:

```typescript
interface HIPAAComplianceEvent extends AuditLogEvent {
  complianceContext: {
    regulation: 'HIPAA'
    accessReason: string
    minimumNecessaryJustification: string
    isBreakGlass?: boolean
    consentStatus: 'verified' | 'pending' | 'denied'
    legalBasis: string
  }
}
```

### GDPR Compliance Fields

For personal data processing events:

```typescript
interface GDPRComplianceEvent extends AuditLogEvent {
  complianceContext: {
    regulation: 'GDPR'
    legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interest'
    processingPurpose: string
    dataCategories: string[]
    retentionPeriod: number
    consentId?: string
    isAutomatedDecision?: boolean
  }
}
```

## Event Validation

### Built-in Validation

All event types include built-in validation:

```typescript
import { validateAuditEvent } from '@repo/audit'

const validation = validateAuditEvent(event)

if (!validation.isValid) {
  console.error('Validation errors:', validation.errors)
  console.warn('Validation warnings:', validation.warnings)
}
```

### Custom Validation Rules

```typescript
interface CustomValidationRule {
  field: string
  validator: (value: any) => boolean
  message: string
}

const customRules: CustomValidationRule[] = [
  {
    field: 'principalId',
    validator: (value) => /^(user|system|practitioner)-\d+$/.test(value),
    message: 'Principal ID must follow the pattern: {type}-{number}'
  }
]
```

## Usage Examples

### Healthcare Workflow

```typescript
// Patient chart access workflow
const chartAccessEvent = createFHIRAuditEvent('fhir.patient.read', {
  principalId: 'practitioner-123',
  status: 'success',
  resourceType: 'Patient',
  resourceId: 'patient-456',
  dataClassification: 'PHI',
  fhirContext: {
    version: 'R4',
    interaction: 'read',
    compartment: 'Patient/patient-456'
  },
  complianceContext: {
    regulation: 'HIPAA',
    accessReason: 'treatment',
    minimumNecessaryJustification: 'Reviewing medical history for upcoming surgery',
    consentStatus: 'verified',
    legalBasis: 'healthcare_treatment'
  }
})
```

### Authentication Flow

```typescript
// Multi-factor authentication
const mfaEvent = createAuthAuditEvent('auth.mfa.enabled', {
  principalId: 'user-789',
  status: 'success',
  authMethod: 'mfa',
  securityContext: {
    riskLevel: 'low',
    authenticationStrength: 98
  },
  outcomeDescription: 'User enabled two-factor authentication'
})
```

### Data Processing

```typescript
// Batch data import
const importEvent = createDataAuditEvent('data.import', {
  principalId: 'etl-service',
  status: 'success',
  targetResourceType: 'LabResults',
  dataClassification: 'PHI',
  dataVolume: {
    recordsProcessed: 1500,
    recordsSuccessful: 1498,
    recordsFailed: 2,
    bytesProcessed: 5242880
  },
  outcomeDescription: 'Daily lab results imported successfully'
})
```

## Best Practices

### Event Design

1. **Use descriptive action names**: `patient.chart.view` instead of `view`
2. **Include sufficient context**: Always add session context and outcome description
3. **Follow naming conventions**: Use dot notation for hierarchical actions
4. **Classify data appropriately**: Use correct data classification levels
5. **Include compliance context**: Add regulatory context for PHI and personal data

### Performance Optimization

1. **Use factory functions**: They provide optimized event creation
2. **Batch related events**: Group related events for efficient processing
3. **Avoid large objects**: Keep event details concise and relevant
4. **Use correlation IDs**: Link related events for better tracking

### Security Considerations

1. **Hash critical events**: Always generate hashes for PHI and sensitive data
2. **Sign important events**: Use digital signatures for high-value events
3. **Validate all events**: Never skip validation in production
4. **Sanitize data**: Remove sensitive information from event details

## Related APIs

- **[Audit Class](./audit-class.md)** - Main audit service methods
- **[Configuration](./configuration.md)** - Event configuration options
- **[Compliance](./compliance.md)** - HIPAA and GDPR compliance features
- **[Validation](../guides/testing-strategies.md)** - Event validation strategies