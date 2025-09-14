# Basic Operations Examples

This section provides practical code examples for common audit database operations using the `@repo/audit-db` package.

## Client Initialization Examples

### Basic Client Setup

```typescript
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

// Simple initialization
const auditDb = new AuditDb()
const db = auditDb.getDrizzleInstance()

// Verify connection
const isConnected = await auditDb.checkAuditDbConnection()
if (!isConnected) {
  throw new Error('Database connection failed')
}

console.log('✅ Connected to audit database')
```

### Enhanced Client Setup

```typescript
import { EnhancedAuditDb, createEnhancedAuditClient } from '@repo/audit-db'

// Using factory function (recommended)
const auditDb = createEnhancedAuditClient('production', {
  queryCache: { maxSizeMB: 200 },
  monitoring: { slowQueryThreshold: 500 }
})

// Manual configuration
const manualClient = new EnhancedAuditDb({
  connectionPool: {
    minConnections: 5,
    maxConnections: 20,
    idleTimeout: 30000
  },
  queryCache: {
    enabled: true,
    maxSizeMB: 100,
    defaultTTL: 300
  },
  monitoring: {
    enabled: true,
    autoOptimization: true
  }
})
```

## CRUD Operations

### Creating Audit Events

#### Single Event Creation

```typescript
import { auditLog } from '@repo/audit-db/schema'

async function createSingleEvent() {
  const db = auditDb.getDrizzleInstance()
  
  const event = await db
    .insert(auditLog)
    .values({
      timestamp: new Date().toISOString(),
      action: 'user.login',
      status: 'success',
      principalId: 'user-123',
      principalType: 'user',
      resourceType: 'authentication',
      sourceIp: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (compatible)',
      metadata: {
        loginMethod: 'email',
        sessionId: 'sess-abc123'
      }
    })
    .returning()
  
  console.log('Created event:', event[0])
  return event[0]
}
```

#### Batch Event Creation

```typescript
async function createBatchEvents() {
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
      metadata: { 
        patientId: 'patient-456',
        medication: 'Lisinopril',
        dosage: '10mg'
      }
    }
  ]
  
  const insertedEvents = await db
    .insert(auditLog)
    .values(events)
    .returning()
  
  console.log(`Created ${insertedEvents.length} events`)
  return insertedEvents
}
```

### Reading Audit Events

#### Basic Queries

```typescript
import { eq, gte, lte, and, or, desc, asc } from 'drizzle-orm'

// Get recent events
async function getRecentEvents(limit: number = 10) {
  const db = auditDb.getDrizzleInstance()
  
  return await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.timestamp))
    .limit(limit)
}

// Get events by user
async function getUserEvents(userId: string) {
  const db = auditDb.getDrizzleInstance()
  
  return await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.principalId, userId))
    .orderBy(desc(auditLog.timestamp))
}

// Get events by action
async function getEventsByAction(action: string) {
  const db = auditDb.getDrizzleInstance()
  
  return await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.action, action))
    .orderBy(desc(auditLog.timestamp))
}

// Get events in date range
async function getEventsInDateRange(startDate: Date, endDate: Date) {
  const db = auditDb.getDrizzleInstance()
  
  return await db
    .select()
    .from(auditLog)
    .where(
      and(
        gte(auditLog.timestamp, startDate.toISOString()),
        lte(auditLog.timestamp, endDate.toISOString())
      )
    )
    .orderBy(desc(auditLog.timestamp))
}
```

#### Complex Filtering

```typescript
import { sql } from 'drizzle-orm'

// Multiple conditions
async function getFailedLoginAttempts(ipAddress?: string) {
  const db = auditDb.getDrizzleInstance()
  
  let conditions = and(
    eq(auditLog.action, 'user.login'),
    eq(auditLog.status, 'failure')
  )
  
  if (ipAddress) {
    conditions = and(conditions, eq(auditLog.sourceIp, ipAddress))
  }
  
  return await db
    .select()
    .from(auditLog)
    .where(conditions)
    .orderBy(desc(auditLog.timestamp))
}

// Metadata filtering
async function getEventsByDepartment(department: string) {
  const db = auditDb.getDrizzleInstance()
  
  return await db
    .select()
    .from(auditLog)
    .where(
      sql`${auditLog.metadata}->>'department' = ${department}`
    )
    .orderBy(desc(auditLog.timestamp))
}

// Text search in metadata
async function searchEventsByKeyword(keyword: string) {
  const db = auditDb.getDrizzleInstance()
  
  return await db
    .select()
    .from(auditLog)
    .where(
      or(
        sql`${auditLog.action} ILIKE ${'%' + keyword + '%'}`,
        sql`${auditLog.metadata}::text ILIKE ${'%' + keyword + '%'}`
      )
    )
    .orderBy(desc(auditLog.timestamp))
}
```

### Updating Audit Events

> **Note**: Audit events should generally be immutable. These examples are for specific use cases like correcting data entry errors.

```typescript
// Update event metadata (use with caution)
async function updateEventMetadata(eventId: string, newMetadata: any) {
  const db = auditDb.getDrizzleInstance()
  
  // Log the update action first
  await db.insert(auditLog).values({
    timestamp: new Date().toISOString(),
    action: 'audit.event.metadata_update',
    status: 'success',
    principalId: 'system',
    principalType: 'system',
    resourceId: eventId,
    resourceType: 'audit_event',
    metadata: {
      originalMetadata: 'logged_separately',
      newMetadata,
      reason: 'data_correction'
    }
  })
  
  // Update the original event
  const updatedEvent = await db
    .update(auditLog)
    .set({ 
      metadata: newMetadata,
      updatedAt: new Date().toISOString()
    })
    .where(eq(auditLog.id, eventId))
    .returning()
  
  return updatedEvent[0]
}
```

### Deleting Audit Events

> **Note**: Deletion should be rare and only for compliance reasons (e.g., GDPR right to erasure).

```typescript
// Soft delete (recommended)
async function softDeleteEvent(eventId: string, reason: string) {
  const db = auditDb.getDrizzleInstance()
  
  // Log the deletion
  await db.insert(auditLog).values({
    timestamp: new Date().toISOString(),
    action: 'audit.event.soft_delete',
    status: 'success',
    principalId: 'system',
    principalType: 'system',
    resourceId: eventId,
    resourceType: 'audit_event',
    metadata: { reason }
  })
  
  // Mark as deleted
  return await db
    .update(auditLog)
    .set({ 
      status: 'deleted',
      metadata: sql`${auditLog.metadata} || ${{
        deletedAt: new Date().toISOString(),
        deletionReason: reason
      }}`
    })
    .where(eq(auditLog.id, eventId))
    .returning()
}

// Hard delete (use only when required by law)
async function hardDeleteEvent(eventId: string, reason: string) {
  const db = auditDb.getDrizzleInstance()
  
  // Log the deletion first
  await db.insert(auditLog).values({
    timestamp: new Date().toISOString(),
    action: 'audit.event.hard_delete',
    status: 'success',
    principalId: 'system',
    principalType: 'system',
    resourceId: eventId,
    resourceType: 'audit_event',
    metadata: { reason, deletedEventId: eventId }
  })
  
  // Actually delete the event
  return await db
    .delete(auditLog)
    .where(eq(auditLog.id, eventId))
    .returning()
}
```

## Transaction Examples

### Simple Transaction

```typescript
async function createRelatedEvents() {
  const db = auditDb.getDrizzleInstance()
  
  return await db.transaction(async (tx) => {
    // Create main event
    const mainEvent = await tx
      .insert(auditLog)
      .values({
        timestamp: new Date().toISOString(),
        action: 'patient.discharge',
        status: 'success',
        principalId: 'doctor-123',
        principalType: 'healthcare_provider',
        resourceId: 'patient-456',
        resourceType: 'patient_record'
      })
      .returning()
    
    // Create related events
    const relatedEvents = await tx
      .insert(auditLog)
      .values([
        {
          timestamp: new Date().toISOString(),
          action: 'bed.release',
          status: 'success',
          principalId: 'system',
          principalType: 'system',
          resourceId: 'bed-A12',
          resourceType: 'hospital_bed',
          metadata: { 
            relatedTo: mainEvent[0].id,
            patientId: 'patient-456'
          }
        },
        {
          timestamp: new Date().toISOString(),
          action: 'billing.generate',
          status: 'success',
          principalId: 'system',
          principalType: 'system',
          resourceId: 'bill-789',
          resourceType: 'billing_record',
          metadata: { 
            relatedTo: mainEvent[0].id,
            patientId: 'patient-456'
          }
        }
      ])
      .returning()
    
    return {
      mainEvent: mainEvent[0],
      relatedEvents
    }
  })
}
```

### Complex Transaction with Error Handling

```typescript
async function complexAuditTransaction() {
  const db = auditDb.getDrizzleInstance()
  
  try {
    return await db.transaction(async (tx) => {
      // Step 1: Verify prerequisites
      const existingPatient = await tx
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.resourceId, 'patient-456'),
            eq(auditLog.action, 'patient.admission')
          )
        )
        .limit(1)
      
      if (existingPatient.length === 0) {
        throw new Error('Patient not found or not admitted')
      }
      
      // Step 2: Create treatment events
      const treatmentEvents = await tx
        .insert(auditLog)
        .values([
          {
            timestamp: new Date().toISOString(),
            action: 'treatment.start',
            status: 'success',
            principalId: 'doctor-123',
            principalType: 'healthcare_provider',
            resourceId: 'treatment-001',
            resourceType: 'treatment_plan'
          },
          {
            timestamp: new Date().toISOString(),
            action: 'medication.prescribe',
            status: 'success',
            principalId: 'doctor-123',
            principalType: 'healthcare_provider',
            resourceId: 'prescription-002',
            resourceType: 'prescription'
          }
        ])
        .returning()
      
      // Step 3: Create summary event
      const summaryEvent = await tx
        .insert(auditLog)
        .values({
          timestamp: new Date().toISOString(),
          action: 'treatment.session.complete',
          status: 'success',
          principalId: 'doctor-123',
          principalType: 'healthcare_provider',
          resourceId: 'session-003',
          resourceType: 'treatment_session',
          metadata: {
            treatmentCount: treatmentEvents.length,
            relatedEvents: treatmentEvents.map(e => e.id)
          }
        })
        .returning()
      
      return {
        treatmentEvents,
        summaryEvent: summaryEvent[0]
      }
    })
    
  } catch (error) {
    console.error('Transaction failed:', error)
    
    // Log the failure
    await db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'audit.transaction.failure',
      status: 'failure',
      principalId: 'system',
      principalType: 'system',
      metadata: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        transactionType: 'treatment_session'
      }
    })
    
    throw error
  }
}
```

## Aggregation Examples

### Basic Aggregations

```typescript
import { count, sum, avg, max, min } from 'drizzle-orm'

// Count events by status
async function getEventCountByStatus() {
  const db = auditDb.getDrizzleInstance()
  
  return await db
    .select({
      status: auditLog.status,
      count: count()
    })
    .from(auditLog)
    .groupBy(auditLog.status)
}

// Daily event counts
async function getDailyEventCounts(days: number = 7) {
  const db = auditDb.getDrizzleInstance()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  
  return await db
    .select({
      date: sql<string>`DATE(${auditLog.timestamp})`,
      total: count(),
      successful: sql<number>`COUNT(*) FILTER (WHERE ${auditLog.status} = 'success')`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${auditLog.status} = 'failure')`
    })
    .from(auditLog)
    .where(gte(auditLog.timestamp, cutoff.toISOString()))
    .groupBy(sql`DATE(${auditLog.timestamp})`)
    .orderBy(sql`DATE(${auditLog.timestamp})`)
}

// Top users by activity
async function getTopUsersByActivity(limit: number = 10) {
  const db = auditDb.getDrizzleInstance()
  
  return await db
    .select({
      principalId: auditLog.principalId,
      principalType: auditLog.principalType,
      eventCount: count(),
      lastActivity: max(auditLog.timestamp)
    })
    .from(auditLog)
    .groupBy(auditLog.principalId, auditLog.principalType)
    .orderBy(desc(count()))
    .limit(limit)
}
```

### Complex Aggregations

```typescript
// Activity analysis by time periods
async function getActivityAnalysis() {
  const db = auditDb.getDrizzleInstance()
  
  return await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${auditLog.timestamp})`,
      dayOfWeek: sql<number>`EXTRACT(DOW FROM ${auditLog.timestamp})`,
      eventCount: count(),
      uniqueUsers: sql<number>`COUNT(DISTINCT ${auditLog.principalId})`,
      avgEventsPerUser: sql<number>`COUNT(*)::float / COUNT(DISTINCT ${auditLog.principalId})`
    })
    .from(auditLog)
    .where(
      gte(auditLog.timestamp, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    )
    .groupBy(
      sql`EXTRACT(HOUR FROM ${auditLog.timestamp})`,
      sql`EXTRACT(DOW FROM ${auditLog.timestamp})`
    )
    .orderBy(
      sql`EXTRACT(DOW FROM ${auditLog.timestamp})`,
      sql`EXTRACT(HOUR FROM ${auditLog.timestamp})`
    )
}
```

## Error Handling Examples

### Comprehensive Error Handling

```typescript
class AuditEventManager {
  constructor(private auditDb: AuditDb) {}
  
  async createEventSafely(eventData: any) {
    try {
      // Validate input
      this.validateEventData(eventData)
      
      // Add timestamp if missing
      if (!eventData.timestamp) {
        eventData.timestamp = new Date().toISOString()
      }
      
      const db = this.auditDb.getDrizzleInstance()
      const event = await db
        .insert(auditLog)
        .values(eventData)
        .returning()
      
      console.log('✅ Event created successfully:', event[0].id)
      return event[0]
      
    } catch (error) {
      console.error('❌ Failed to create event:', error)
      
      // Log the failure
      await this.logFailure(eventData, error)
      
      // Re-throw for caller to handle
      throw error
    }
  }
  
  private validateEventData(data: any) {
    const required = ['action', 'principalId', 'status']
    const missing = required.filter(field => !data[field])
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`)
    }
    
    if (!['success', 'failure', 'warning'].includes(data.status)) {
      throw new Error('Invalid status value')
    }
  }
  
  private async logFailure(originalData: any, error: any) {
    try {
      const db = this.auditDb.getDrizzleInstance()
      await db.insert(auditLog).values({
        timestamp: new Date().toISOString(),
        action: 'audit.event.creation_failure',
        status: 'failure',
        principalId: originalData.principalId || 'unknown',
        principalType: 'system',
        metadata: {
          originalAction: originalData.action,
          errorMessage: error.message,
          originalData: originalData
        }
      })
    } catch (logError) {
      console.error('Failed to log creation failure:', logError)
    }
  }
}
```

## Complete Working Examples

### Healthcare Audit System

```typescript
// Complete healthcare audit example
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

class HealthcareAuditSystem {
  private auditDb: AuditDb
  private db: any
  
  constructor() {
    this.auditDb = new AuditDb()
    this.db = this.auditDb.getDrizzleInstance()
  }
  
  async initialize() {
    const connected = await this.auditDb.checkAuditDbConnection()
    if (!connected) {
      throw new Error('Failed to connect to audit database')
    }
    console.log('Healthcare audit system initialized')
  }
  
  // Patient record access
  async logPatientAccess(doctorId: string, patientId: string, department: string) {
    return await this.db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'patient.record.access',
      status: 'success',
      principalId: doctorId,
      principalType: 'healthcare_provider',
      resourceId: patientId,
      resourceType: 'patient_record',
      metadata: {
        department,
        accessTime: new Date().toISOString(),
        consentVerified: true
      }
    }).returning()
  }
  
  // Medication prescription
  async logMedicationPrescription(params: {
    doctorId: string
    patientId: string
    medication: string
    dosage: string
    duration: string
  }) {
    return await this.db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'medication.prescribe',
      status: 'success',
      principalId: params.doctorId,
      principalType: 'healthcare_provider',
      resourceId: `${params.patientId}-${params.medication}`,
      resourceType: 'prescription',
      metadata: {
        patientId: params.patientId,
        medication: params.medication,
        dosage: params.dosage,
        duration: params.duration,
        prescribedAt: new Date().toISOString()
      }
    }).returning()
  }
  
  // Get patient audit trail
  async getPatientAuditTrail(patientId: string) {
    return await this.db
      .select({
        timestamp: auditLog.timestamp,
        action: auditLog.action,
        principalId: auditLog.principalId,
        principalType: auditLog.principalType,
        status: auditLog.status,
        metadata: auditLog.metadata
      })
      .from(auditLog)
      .where(
        or(
          eq(auditLog.resourceId, patientId),
          sql`${auditLog.metadata}->>'patientId' = ${patientId}`
        )
      )
      .orderBy(desc(auditLog.timestamp))
  }
  
  // Generate compliance report
  async generateComplianceReport(startDate: Date, endDate: Date) {
    const events = await this.db
      .select()
      .from(auditLog)
      .where(
        and(
          gte(auditLog.timestamp, startDate.toISOString()),
          lte(auditLog.timestamp, endDate.toISOString()),
          sql`${auditLog.action} LIKE 'patient.%'`
        )
      )
      .orderBy(desc(auditLog.timestamp))
    
    return {
      reportPeriod: { startDate, endDate },
      totalEvents: events.length,
      eventsByAction: this.groupByAction(events),
      eventsByUser: this.groupByUser(events),
      complianceScore: this.calculateComplianceScore(events)
    }
  }
  
  private groupByAction(events: any[]) {
    return events.reduce((acc, event) => {
      acc[event.action] = (acc[event.action] || 0) + 1
      return acc
    }, {})
  }
  
  private groupByUser(events: any[]) {
    return events.reduce((acc, event) => {
      acc[event.principalId] = (acc[event.principalId] || 0) + 1
      return acc
    }, {})
  }
  
  private calculateComplianceScore(events: any[]) {
    const total = events.length
    const successful = events.filter(e => e.status === 'success').length
    return total > 0 ? (successful / total) * 100 : 100
  }
}

// Usage example
async function example() {
  const auditSystem = new HealthcareAuditSystem()
  await auditSystem.initialize()
  
  // Log patient access
  await auditSystem.logPatientAccess(
    'doctor-123',
    'patient-456',
    'cardiology'
  )
  
  // Log prescription
  await auditSystem.logMedicationPrescription({
    doctorId: 'doctor-123',
    patientId: 'patient-456',
    medication: 'Lisinopril',
    dosage: '10mg',
    duration: '30 days'
  })
  
  // Get audit trail
  const auditTrail = await auditSystem.getPatientAuditTrail('patient-456')
  console.log('Patient audit trail:', auditTrail)
  
  // Generate compliance report
  const report = await auditSystem.generateComplianceReport(
    new Date('2024-01-01'),
    new Date('2024-12-31')
  )
  console.log('Compliance report:', report)
}

example().catch(console.error)
```

These examples provide a solid foundation for implementing audit logging in your applications. Adapt them based on your specific requirements and use cases.