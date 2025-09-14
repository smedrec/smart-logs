# Basic Usage Tutorial

This tutorial covers the fundamental operations you'll perform with the `@repo/audit-db` package. You'll learn how to perform CRUD operations, work with different client types, and implement common audit logging patterns.

## Prerequisites

- ✅ Completed [Installation](../getting-started/installation.md)
- ✅ Completed [Quick Start](../getting-started/quick-start.md)
- ✅ Database connection verified

## Client Types Overview

### 1. AuditDb - Basic Client

```typescript
import { AuditDb } from '@repo/audit-db'

const auditDb = new AuditDb()
const db = auditDb.getDrizzleInstance()
```

**Use for**: Simple applications, development, single-instance deployments

### 2. AuditDbWithConfig - Configured Client

```typescript
import { AuditDbWithConfig } from '@repo/audit-db'

const auditDb = new AuditDbWithConfig({
  connectionString: process.env.AUDIT_DB_URL,
  pool: { max: 15, min: 3, idleTimeoutMillis: 30000 }
})
```

**Use for**: Production applications with custom settings, multiple environments

### 3. EnhancedAuditDb - Advanced Client

```typescript
import { EnhancedAuditDb } from '@repo/audit-db'

const auditDb = new EnhancedAuditDb({
  connectionPool: { maxConnections: 20 },
  queryCache: { enabled: true },
  monitoring: { enabled: true }
})
```

**Use for**: High-performance applications, compliance requirements

## Core Operations

### Creating Audit Events

#### Basic Event Creation

```typescript
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

async function createBasicEvent() {
  const auditDb = new AuditDb()
  const db = auditDb.getDrizzleInstance()
  
  const event = await db
    .insert(auditLog)
    .values({
      timestamp: new Date().toISOString(),
      action: 'patient.record.access',
      status: 'success',
      principalId: 'doctor-123',
      principalType: 'healthcare_provider',
      resourceId: 'patient-456',
      resourceType: 'patient_record',
      sourceIp: '192.168.1.100',
      metadata: {
        department: 'cardiology',
        accessReason: 'treatment',
        dataElements: ['demographics', 'vitals', 'medications']
      }
    })
    .returning()
  
  return event[0]
}
```

#### Batch Event Creation

```typescript
async function createBatchEvents() {
  const auditDb = new AuditDb()
  const db = auditDb.getDrizzleInstance()
  
  const events = [
    {
      timestamp: new Date().toISOString(),
      action: 'patient.record.access',
      status: 'success',
      principalId: 'doctor-123',
      principalType: 'healthcare_provider',
      resourceId: 'patient-456',
      resourceType: 'patient_record',
      metadata: { department: 'cardiology' }
    },
    {
      timestamp: new Date().toISOString(),
      action: 'prescription.create',
      status: 'success',
      principalId: 'doctor-123',
      principalType: 'healthcare_provider',
      resourceId: 'prescription-789',
      resourceType: 'prescription',
      metadata: { patientId: 'patient-456', medication: 'aspirin' }
    }
  ]
  
  return await db.insert(auditLog).values(events).returning()
}
```

### Querying Audit Events

#### Basic Queries

```typescript
import { eq, gte, and, desc, count } from 'drizzle-orm'

async function basicQueries() {
  const auditDb = new AuditDb()
  const db = auditDb.getDrizzleInstance()
  
  // Get events for a user
  const userEvents = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.principalId, 'doctor-123'))
    .orderBy(desc(auditLog.timestamp))
    .limit(10)
  
  // Get events by action type
  const loginEvents = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.action, 'user.login'))
    .orderBy(desc(auditLog.timestamp))
  
  // Get events within date range
  const recentEvents = await db
    .select()
    .from(auditLog)
    .where(
      gte(auditLog.timestamp, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    )
    .orderBy(desc(auditLog.timestamp))
  
  return { userEvents, loginEvents, recentEvents }
}
```

#### Healthcare-Specific Queries

```typescript
import { sql } from 'drizzle-orm'

async function healthcareQueries() {
  const auditDb = new AuditDb()
  const db = auditDb.getDrizzleInstance()
  
  // Patient data access audit
  const patientAccess = await db
    .select({
      timestamp: auditLog.timestamp,
      principalId: auditLog.principalId,
      department: sql<string>`${auditLog.metadata}->>'department'`,
      accessReason: sql<string>`${auditLog.metadata}->>'accessReason'`
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.resourceType, 'patient_record'),
        eq(auditLog.resourceId, 'patient-456')
      )
    )
    .orderBy(desc(auditLog.timestamp))
  
  // Medication events
  const medicationEvents = await db
    .select({
      timestamp: auditLog.timestamp,
      action: auditLog.action,
      medication: sql<string>`${auditLog.metadata}->>'medication'`,
      dosage: sql<string>`${auditLog.metadata}->>'dosage'`,
      patientId: sql<string>`${auditLog.metadata}->>'patientId'`
    })
    .from(auditLog)
    .where(sql`${auditLog.action} LIKE 'medication.%'`)
    .orderBy(desc(auditLog.timestamp))
  
  return { patientAccess, medicationEvents }
}
```

## Error Handling and Validation

### Event Validation

```typescript
class AuditEventValidator {
  static validateEvent(eventData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    // Required fields
    if (!eventData.action) errors.push('Action is required')
    if (!eventData.principalId) errors.push('Principal ID is required')
    if (!eventData.status) errors.push('Status is required')
    
    // Status validation
    if (!['success', 'failure', 'warning'].includes(eventData.status)) {
      errors.push('Status must be success, failure, or warning')
    }
    
    // Healthcare-specific validation
    if (eventData.action?.startsWith('patient.')) {
      if (!eventData.resourceId) {
        errors.push('Patient actions require resourceId')
      }
    }
    
    return { isValid: errors.length === 0, errors }
  }
}
```

### Safe Event Creation

```typescript
async function safeEventCreation(eventData: any) {
  const auditDb = new AuditDb()
  const db = auditDb.getDrizzleInstance()
  
  try {
    // Validate the event data
    const validation = AuditEventValidator.validateEvent(eventData)
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
    }
    
    // Add timestamp if not provided
    if (!eventData.timestamp) {
      eventData.timestamp = new Date().toISOString()
    }
    
    // Create the event
    const event = await db.insert(auditLog).values(eventData).returning()
    return event[0]
    
  } catch (error) {
    console.error('Failed to create audit event:', error)
    
    // Log the failure
    await db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'audit.event.creation_failure',
      status: 'failure',
      principalId: eventData.principalId || 'unknown',
      principalType: 'system',
      metadata: {
        originalAction: eventData.action,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    
    throw error
  }
}
```

## Complete Healthcare Audit Example

```typescript
// Complete working example
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'
import { eq, desc } from 'drizzle-orm'

class HealthcareAuditSystem {
  private auditDb: AuditDb
  private db: any
  
  constructor() {
    this.auditDb = new AuditDb()
    this.db = this.auditDb.getDrizzleInstance()
  }
  
  async initialize(): Promise<boolean> {
    const isConnected = await this.auditDb.checkAuditDbConnection()
    if (!isConnected) {
      throw new Error('Database connection failed')
    }
    return true
  }
  
  // Log patient data access
  async logPatientAccess(params: {
    doctorId: string
    patientId: string
    department: string
    accessReason: string
  }) {
    return await this.db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'patient.record.access',
      status: 'success',
      principalId: params.doctorId,
      principalType: 'healthcare_provider',
      resourceId: params.patientId,
      resourceType: 'patient_record',
      metadata: {
        department: params.department,
        accessReason: params.accessReason
      }
    }).returning()
  }
  
  // Get patient access history
  async getPatientAccessHistory(patientId: string) {
    return await this.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.resourceId, patientId),
          eq(auditLog.resourceType, 'patient_record')
        )
      )
      .orderBy(desc(auditLog.timestamp))
  }
}

// Usage example
async function example() {
  const auditSystem = new HealthcareAuditSystem()
  await auditSystem.initialize()
  
  // Log patient access
  await auditSystem.logPatientAccess({
    doctorId: 'doctor-123',
    patientId: 'patient-456',
    department: 'cardiology',
    accessReason: 'routine_checkup'
  })
  
  // Get access history
  const history = await auditSystem.getPatientAccessHistory('patient-456')
  console.log(`Patient has ${history.length} access events`)
}
```

## Next Steps

Now that you understand basic usage:

1. **[Performance Optimization](./performance-optimization.md)** - Use the enhanced client
2. **[Redis Caching](./redis-caching.md)** - Implement distributed caching
3. **[Compliance Configuration](./compliance-configuration.md)** - GDPR/HIPAA compliance
4. **[API Reference](../api-reference/)** - Detailed API documentation

## Summary

You've learned:
- ✅ How to use all three client types
- ✅ Core CRUD operations for audit events
- ✅ Healthcare-specific query patterns
- ✅ Event validation and error handling
- ✅ Building a complete audit system

This foundation prepares you for the advanced features covered in subsequent tutorials.