---
title: Comprehensive Examples
description: Practical examples and implementation patterns for the SMEDREC Audit System across various scenarios and use cases.
sidebar_position: 4
---

# Comprehensive Examples

Practical examples and implementation patterns for the SMEDREC Audit System across various scenarios and use cases.

## 🚀 Quick Start Examples

### Basic Client Initialization

```typescript
import { AuditDb, EnhancedAuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

// Basic client for simple applications
const basicClient = new AuditDb()
const db = basicClient.getDrizzleInstance()

// Verify connection
const isConnected = await basicClient.checkAuditDbConnection()
if (!isConnected) {
  throw new Error('Database connection failed')
}

// Enhanced client for production
const enhancedClient = new EnhancedAuditDb({
  connection: {
    connectionString: process.env.AUDIT_DB_URL!,
    ssl: process.env.NODE_ENV === 'production'
  },
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
    slowQueryThreshold: 1000,
    autoOptimization: true
  }
})
```

### Simple Healthcare Audit Event

```typescript
// Log patient record access
await db.insert(auditLog).values({
  timestamp: new Date().toISOString(),
  action: 'patient.record.access',
  status: 'success',
  principalId: 'doctor-123',
  principalType: 'healthcare_provider',
  resourceId: 'patient-456',
  resourceType: 'patient_record',
  sourceIp: '10.0.1.50',
  userAgent: 'EMR-System/2.1',
  metadata: {
    department: 'cardiology',
    accessReason: 'routine_checkup',
    patientConsent: true,
    dataElements: ['demographics', 'vitals', 'medications']
  }
})
```

## 🏥 Healthcare-Specific Examples

### HIPAA-Compliant Patient Data Access

```typescript
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'
import { eq, desc, and, gte } from 'drizzle-orm'

class HIPAAAuditLogger {
  private db: ReturnType<AuditDb['getDrizzleInstance']>
  
  constructor() {
    const auditDb = new AuditDb()
    this.db = auditDb.getDrizzleInstance()
  }
  
  // Log patient record access with HIPAA compliance
  async logPatientAccess({
    doctorId,
    patientId,
    department,
    accessReason,
    dataElements
  }: {
    doctorId: string
    patientId: string
    department: string
    accessReason: string
    dataElements: string[]
  }) {
    return await this.db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'hipaa.patient_data.access',
      status: 'success',
      principalId: doctorId,
      principalType: 'healthcare_provider',
      resourceId: patientId,
      resourceType: 'patient_record',
      sourceIp: this.getClientIP(),
      metadata: {
        department,
        accessReason,
        dataElements,
        minimumNecessary: true,
        patientConsent: await this.verifyPatientConsent(patientId),
        hipaaCompliant: true,
        retentionPeriod: 2555 // 7 years
      }
    }).returning()
  }
  
  // Log prescription creation
  async logPrescriptionCreation({
    doctorId,
    patientId,
    medication,
    dosage,
    frequency,
    duration
  }: {
    doctorId: string
    patientId: string
    medication: string
    dosage: string
    frequency: string
    duration: string
  }) {
    return await this.db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'prescription.create',
      status: 'success',
      principalId: doctorId,
      principalType: 'healthcare_provider',
      resourceId: `prescription-${Date.now()}`,
      resourceType: 'prescription',
      metadata: {
        patientId,
        medication,
        dosage,
        frequency,
        duration,
        prescribedAt: new Date().toISOString(),
        dea_number: await this.getDEANumber(doctorId),
        controlledSubstance: await this.isControlledSubstance(medication)
      }
    }).returning()
  }
  
  // Log lab result access
  async logLabResultAccess({
    userId,
    userType,
    patientId,
    labResultId,
    testType
  }: {
    userId: string
    userType: 'physician' | 'nurse' | 'lab_tech' | 'patient'
    patientId: string
    labResultId: string
    testType: string
  }) {
    return await this.db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'lab_result.access',
      status: 'success',
      principalId: userId,
      principalType: userType,
      resourceId: labResultId,
      resourceType: 'lab_result',
      metadata: {
        patientId,
        testType,
        accessedBy: userType,
        criticality: await this.getLabCriticality(labResultId),
        dataClassification: 'PHI'
      }
    }).returning()
  }
  
  // Query patient audit trail for compliance reporting
  async getPatientAuditTrail(patientId: string, startDate?: Date, endDate?: Date) {
    let conditions = eq(auditLog.resourceId, patientId)
    
    if (startDate && endDate) {
      conditions = and(
        conditions,
        gte(auditLog.timestamp, startDate.toISOString()),
        gte(auditLog.timestamp, endDate.toISOString())
      )
    }
    
    return await this.db
      .select({
        timestamp: auditLog.timestamp,
        action: auditLog.action,
        principalId: auditLog.principalId,
        principalType: auditLog.principalType,
        status: auditLog.status,
        sourceIp: auditLog.sourceIp,
        metadata: auditLog.metadata
      })
      .from(auditLog)
      .where(conditions)
      .orderBy(desc(auditLog.timestamp))
  }
  
  private async verifyPatientConsent(patientId: string): Promise<boolean> {
    // Implementation to verify patient consent
    return true
  }
  
  private async getDEANumber(doctorId: string): Promise<string> {
    // Implementation to get doctor's DEA number
    return 'DEA123456'
  }
  
  private async isControlledSubstance(medication: string): Promise<boolean> {
    // Implementation to check if medication is controlled
    return false
  }
  
  private async getLabCriticality(labResultId: string): Promise<string> {
    // Implementation to get lab result criticality
    return 'normal'
  }
  
  private getClientIP(): string {
    // Implementation to get client IP
    return '10.0.1.50'
  }
}
```

### GDPR Compliance Examples

```typescript
class GDPRAuditLogger {
  private db: ReturnType<AuditDb['getDrizzleInstance']>
  
  constructor() {
    const auditDb = new AuditDb()
    this.db = auditDb.getDrizzleInstance()
  }
  
  // Log data subject access request
  async logDataSubjectAccessRequest({
    dataSubjectId,
    requestType,
    dataElements,
    legalBasis
  }: {
    dataSubjectId: string
    requestType: 'access' | 'rectification' | 'erasure' | 'portability'
    dataElements: string[]
    legalBasis: string
  }) {
    return await this.db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: `gdpr.data_subject.${requestType}`,
      status: 'success',
      principalId: dataSubjectId,
      principalType: 'data_subject',
      resourceType: 'personal_data',
      metadata: {
        requestType,
        dataElements,
        legalBasis,
        processingLawfulness: true,
        dataMinimization: true,
        purposeLimitation: true,
        accuracyEnsured: true,
        storageLimitation: true,
        integrityConfidentiality: true,
        accountability: true,
        gdprCompliant: true
      }
    }).returning()
  }
  
  // Log consent management
  async logConsentChange({
    dataSubjectId,
    consentType,
    granted,
    purpose,
    dataCategories
  }: {
    dataSubjectId: string
    consentType: 'marketing' | 'analytics' | 'processing' | 'sharing'
    granted: boolean
    purpose: string
    dataCategories: string[]
  }) {
    return await this.db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'gdpr.consent.change',
      status: 'success',
      principalId: dataSubjectId,
      principalType: 'data_subject',
      resourceType: 'consent_record',
      metadata: {
        consentType,
        granted,
        purpose,
        dataCategories,
        consentMethod: 'explicit',
        withdrawable: true,
        granular: true,
        consentDate: new Date().toISOString()
      }
    }).returning()
  }
  
  // Log data processing activity
  async logDataProcessing({
    processorId,
    dataSubjectId,
    processingPurpose,
    dataCategories,
    legalBasis
  }: {
    processorId: string
    dataSubjectId: string
    processingPurpose: string
    dataCategories: string[]
    legalBasis: string
  }) {
    return await this.db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'gdpr.data.processing',
      status: 'success',
      principalId: processorId,
      principalType: 'data_processor',
      resourceId: dataSubjectId,
      resourceType: 'personal_data',
      metadata: {
        processingPurpose,
        dataCategories,
        legalBasis,
        retentionPeriod: this.calculateRetentionPeriod(processingPurpose),
        dataMinimizationApplied: true,
        pseudonymized: true
      }
    }).returning()
  }
  
  private calculateRetentionPeriod(purpose: string): number {
    // Implementation based on GDPR requirements
    const retentionPolicies: Record<string, number> = {
      'contract_fulfillment': 365 * 6, // 6 years
      'legal_obligation': 365 * 7, // 7 years
      'legitimate_interest': 365 * 3, // 3 years
      'consent': 365 * 2 // 2 years
    }
    return retentionPolicies[purpose] || 365 * 2
  }
}
```

## 📊 Enhanced Database Operations

### Performance-Optimized Queries

```typescript
import { EnhancedAuditDb } from '@repo/audit-db'
import { eq, gte, lte, and, or, desc, asc, count, sql } from 'drizzle-orm'

class PerformanceOptimizedQueries {
  private client: EnhancedAuditDb
  
  constructor() {
    this.client = new EnhancedAuditDb({
      connection: {
        connectionString: process.env.AUDIT_DB_URL!,
        ssl: true
      },
      connectionPool: {
        minConnections: 10,
        maxConnections: 50,
        idleTimeout: 60000
      },
      queryCache: {
        enabled: true,
        maxSizeMB: 500,
        defaultTTL: 900
      },
      monitoring: {
        enabled: true,
        slowQueryThreshold: 500,
        autoOptimization: true
      }
    })
  }
  
  // Cached query for frequently accessed user events
  async getUserEventsOptimized(userId: string, limit: number = 10) {
    return await this.client.query(
      `SELECT * FROM audit_log 
       WHERE principal_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [userId, limit],
      {
        cacheKey: `user_events_${userId}_${limit}`,
        ttl: 300 // 5 minutes
      }
    )
  }
  
  // Batch query for dashboard analytics
  async getDashboardMetrics() {
    const results = await this.client.queryBatch([
      {
        sql: 'SELECT COUNT(*) as total FROM audit_log WHERE timestamp >= $1',
        params: [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()],
        options: { cacheKey: 'daily_count', ttl: 300 }
      },
      {
        sql: 'SELECT COUNT(*) as failures FROM audit_log WHERE status = $1 AND timestamp >= $2',
        params: ['failure', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()],
        options: { cacheKey: 'daily_failures', ttl: 300 }
      },
      {
        sql: 'SELECT COUNT(DISTINCT principal_id) as unique_users FROM audit_log WHERE timestamp >= $1',
        params: [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()],
        options: { cacheKey: 'daily_users', ttl: 300 }
      }
    ])
    
    return {
      totalEvents: results[0].data?.[0]?.total || 0,
      failedEvents: results[1].data?.[0]?.failures || 0,
      uniqueUsers: results[2].data?.[0]?.unique_users || 0
    }
  }
  
  // Transaction with performance monitoring
  async createAuditEventWithMetrics(eventData: any) {
    return await this.client.transaction(async (tx) => {
      const startTime = Date.now()
      
      // Create the main audit event
      const event = await tx.query(
        `INSERT INTO audit_log (timestamp, action, status, principal_id, resource_type, metadata) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [
          eventData.timestamp,
          eventData.action,
          eventData.status,
          eventData.principalId,
          eventData.resourceType,
          eventData.metadata
        ]
      )
      
      const executionTime = Date.now() - startTime
      
      // Log performance metrics if slow
      if (executionTime > 100) {
        await tx.query(
          `INSERT INTO audit_log (timestamp, action, status, principal_id, metadata) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            new Date().toISOString(),
            'performance.slow_query',
            'warning',
            'system',
            {
              originalAction: eventData.action,
              executionTime,
              threshold: 100
            }
          ]
        )
      }
      
      return event[0]
    })
  }
  
  // Complex aggregation with caching
  async getComplianceReport(startDate: Date, endDate: Date) {
    const cacheKey = `compliance_report_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`
    
    return await this.client.query(
      `SELECT 
         action,
         COUNT(*) as event_count,
         COUNT(DISTINCT principal_id) as unique_users,
         COUNT(*) FILTER (WHERE status = 'success') as successful_events,
         COUNT(*) FILTER (WHERE status = 'failure') as failed_events,
         ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - timestamp)) * 1000), 2) as avg_processing_time
       FROM audit_log 
       WHERE timestamp BETWEEN $1 AND $2
         AND action LIKE 'patient.%'
       GROUP BY action
       ORDER BY event_count DESC`,
      [startDate.toISOString(), endDate.toISOString()],
      {
        cacheKey,
        ttl: 3600 // 1 hour for compliance reports
      }
    )
  }
  
  // Get performance metrics
  async getSystemPerformanceMetrics() {
    const metrics = await this.client.getPerformanceMetrics()
    const health = await this.client.getHealthStatus()
    
    return {
      cache: {
        hitRate: metrics.cache.hitRate,
        memoryUsage: metrics.cache.memoryUsage
      },
      database: {
        activeConnections: metrics.connectionPool.activeConnections,
        averageQueryTime: metrics.queries.averageExecutionTime
      },
      health: {
        overall: health.overall,
        components: health.components
      }
    }
  }
}
```

### Transaction Management Examples

```typescript
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

class TransactionManager {
  private db: ReturnType<AuditDb['getDrizzleInstance']>
  
  constructor() {
    const auditDb = new AuditDb()
    this.db = auditDb.getDrizzleInstance()
  }
  
  // Patient treatment session with multiple related events
  async logTreatmentSession({
    doctorId,
    patientId,
    treatmentType,
    medications,
    procedures
  }: {
    doctorId: string
    patientId: string
    treatmentType: string
    medications: Array<{name: string, dosage: string}>
    procedures: Array<{name: string, duration: number}>
  }) {
    return await this.db.transaction(async (tx) => {
      const sessionId = `session-${Date.now()}`
      const timestamp = new Date().toISOString()
      
      // Log session start
      const sessionStart = await tx
        .insert(auditLog)
        .values({
          timestamp,
          action: 'treatment.session.start',
          status: 'success',
          principalId: doctorId,
          principalType: 'healthcare_provider',
          resourceId: sessionId,
          resourceType: 'treatment_session',
          metadata: {
            patientId,
            treatmentType,
            sessionId
          }
        })
        .returning()
      
      // Log medications prescribed
      const medicationEvents = []
      for (const med of medications) {
        const medEvent = await tx
          .insert(auditLog)
          .values({
            timestamp: new Date().toISOString(),
            action: 'medication.prescribe',
            status: 'success',
            principalId: doctorId,
            principalType: 'healthcare_provider',
            resourceId: `med-${Date.now()}-${Math.random()}`,
            resourceType: 'prescription',
            metadata: {
              patientId,
              sessionId,
              medication: med.name,
              dosage: med.dosage,
              relatedTo: sessionStart[0].id
            }
          })
          .returning()
        medicationEvents.push(medEvent[0])
      }
      
      // Log procedures performed
      const procedureEvents = []
      for (const proc of procedures) {
        const procEvent = await tx
          .insert(auditLog)
          .values({
            timestamp: new Date().toISOString(),
            action: 'procedure.perform',
            status: 'success',
            principalId: doctorId,
            principalType: 'healthcare_provider',
            resourceId: `proc-${Date.now()}-${Math.random()}`,
            resourceType: 'medical_procedure',
            metadata: {
              patientId,
              sessionId,
              procedure: proc.name,
              duration: proc.duration,
              relatedTo: sessionStart[0].id
            }
          })
          .returning()
        procedureEvents.push(procEvent[0])
      }
      
      // Log session completion
      const sessionEnd = await tx
        .insert(auditLog)
        .values({
          timestamp: new Date().toISOString(),
          action: 'treatment.session.complete',
          status: 'success',
          principalId: doctorId,
          principalType: 'healthcare_provider',
          resourceId: sessionId,
          resourceType: 'treatment_session',
          metadata: {
            patientId,
            sessionId,
            medicationCount: medications.length,
            procedureCount: procedures.length,
            relatedEvents: [
              sessionStart[0].id,
              ...medicationEvents.map(e => e.id),
              ...procedureEvents.map(e => e.id)
            ]
          }
        })
        .returning()
      
      return {
        sessionStart: sessionStart[0],
        medications: medicationEvents,
        procedures: procedureEvents,
        sessionEnd: sessionEnd[0]
      }
    })
  }
  
  // Error handling with rollback
  async safeAuditOperation(operations: Array<() => Promise<any>>) {
    try {
      return await this.db.transaction(async (tx) => {
        const results = []
        
        for (const operation of operations) {
          const result = await operation()
          results.push(result)
        }
        
        // Log successful batch operation
        await tx.insert(auditLog).values({
          timestamp: new Date().toISOString(),
          action: 'audit.batch.success',
          status: 'success',
          principalId: 'system',
          principalType: 'system',
          metadata: {
            operationCount: operations.length,
            completedAt: new Date().toISOString()
          }
        })
        
        return results
      })
    } catch (error) {
      // Log the failure outside the transaction
      await this.db.insert(auditLog).values({
        timestamp: new Date().toISOString(),
        action: 'audit.batch.failure',
        status: 'failure',
        principalId: 'system',
        principalType: 'system',
        metadata: {
          operationCount: operations.length,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date().toISOString()
        }
      })
      
      throw error
    }
  }
}
```

## Integration Examples

### Express.js Middleware

```typescript
import { NextFunction, Request, Response } from 'express'

import { Audit } from '@repo/audit'

const auditService = new Audit('api-audit-queue')

export function auditMiddleware() {
	return async (req: Request, res: Response, next: NextFunction) => {
		const startTime = Date.now()

		// Capture original end method
		const originalEnd = res.end

		res.end = function (chunk?: any, encoding?: any) {
			const processingTime = Date.now() - startTime

			// Log the API request
			auditService
				.log({
					principalId: req.user?.id || 'anonymous',
					action: `api.${req.method.toLowerCase()}.${req.route?.path || req.path}`,
					status: res.statusCode < 400 ? 'success' : 'failure',
					outcomeDescription: `API ${req.method} ${req.path} - ${res.statusCode}`,
					processingLatency: processingTime,
					sessionContext: {
						sessionId: req.sessionID || 'no-session',
						ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
						userAgent: req.get('User-Agent') || 'unknown',
					},
					apiDetails: {
						method: req.method,
						path: req.path,
						statusCode: res.statusCode,
						contentLength: res.get('Content-Length'),
					},
				})
				.catch((error) => {
					console.error('Failed to log audit event:', error)
				})

			// Call original end method
			originalEnd.call(this, chunk, encoding)
		}

		next()
	}
}

// Usage in Express app
app.use(auditMiddleware())
```

### React Hook for Client-Side Auditing

```typescript
import { useCallback } from 'react'

interface AuditEvent {
  action: string
  targetResourceType?: string
  targetResourceId?: string
  status: 'attempt' | 'success' | 'failure'
  outcomeDescription?: string
  [key: string]: any
}

export function useAudit() {
  const logEvent = useCallback(async (event: AuditEvent) => {
    try {
      await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...event,
          sessionContext: {
            sessionId: sessionStorage.getItem('sessionId'),
            ipAddress: 'client-side', // Will be replaced server-side
            userAgent: navigator.userAgent
          }
        })
      })
    } catch (error) {
      console.error('Failed to log audit event:', error)
    }
  }, [])

  return { logEvent }
}

// Usage in React component
function PatientView({ patientId }: { patientId: string }) {
  const { logEvent } = useAudit()

  useEffect(() => {
    // Log patient view
    logEvent({
      action: 'ui.patient.view',
      targetResourceType: 'Patient',
      targetResourceId: patientId,
      status: 'success',
      outcomeDescription: 'User viewed patient details page'
    })
  }, [patientId, logEvent])

  return <div>Patient details...</div>
}
```

## Testing Examples

### Unit Testing Audit Events

```typescript
import { Redis } from 'ioredis'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Audit } from '@repo/audit'

describe('Audit Service', () => {
	let auditService: Audit
	let mockRedis: Redis

	beforeEach(() => {
		mockRedis = new Redis({
			host: 'localhost',
			port: 6380, // Test Redis instance
			db: 1, // Use different database for tests
		})
		auditService = new Audit('test-audit-queue', mockRedis)
	})

	afterEach(async () => {
		await auditService.closeConnection()
		await mockRedis.quit()
	})

	it('should log audit event successfully', async () => {
		const eventDetails = {
			principalId: 'test-user',
			action: 'test.action',
			status: 'success' as const,
			outcomeDescription: 'Test event logged successfully',
		}

		await expect(auditService.log(eventDetails)).resolves.not.toThrow()
	})

	it('should generate and verify event hash', () => {
		const event = {
			timestamp: '2024-01-01T00:00:00Z',
			action: 'test.action',
			status: 'success' as const,
			principalId: 'test-user',
		}

		const hash = auditService.generateEventHash(event)
		expect(hash).toBeTruthy()
		expect(typeof hash).toBe('string')

		const isValid = auditService.verifyEventHash(event, hash)
		expect(isValid).toBe(true)
	})

	it('should validate required fields', async () => {
		const invalidEvent = {
			// Missing required 'action' field
			status: 'success' as const,
		}

		await expect(auditService.log(invalidEvent as any)).rejects.toThrow('Validation Error')
	})
})
```

### Integration Testing

```typescript
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

describe('Audit Database Integration', () => {
	let auditDb: AuditDb
	let db: ReturnType<AuditDb['getDrizzleInstance']>

	beforeAll(async () => {
		auditDb = new AuditDb(process.env.TEST_AUDIT_DB_URL)
		db = auditDb.getDrizzleInstance()

		// Verify connection
		const isConnected = await auditDb.checkAuditDbConnection()
		expect(isConnected).toBe(true)
	})

	it('should store and retrieve audit events', async () => {
		const testEvent = {
			timestamp: new Date().toISOString(),
			action: 'test.database.operation',
			status: 'success',
			principalId: 'test-user-db',
			outcomeDescription: 'Database integration test',
		}

		// Insert test event
		const [inserted] = await db.insert(auditLog).values(testEvent).returning()

		expect(inserted).toBeTruthy()
		expect(inserted.action).toBe(testEvent.action)

		// Retrieve test event
		const retrieved = await db.select().from(auditLog).where(eq(auditLog.id, inserted.id)).limit(1)

		expect(retrieved).toHaveLength(1)
		expect(retrieved[0].action).toBe(testEvent.action)

		// Cleanup
		await db.delete(auditLog).where(eq(auditLog.id, inserted.id))
	})
})
```

## 🔗 Advanced Integration Examples

### Express.js Middleware

```typescript
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

const auditDb = new AuditDb()
const db = auditDb.getDrizzleInstance()

export function auditMiddleware() {
  return async (req: any, res: any, next: any) => {
    const startTime = Date.now()
    
    res.on('finish', async () => {
      const processingTime = Date.now() - startTime
      
      await db.insert(auditLog).values({
        timestamp: new Date().toISOString(),
        action: `api.${req.method.toLowerCase()}.${req.path}`,
        status: res.statusCode < 400 ? 'success' : 'failure',
        principalId: req.user?.id || 'anonymous',
        principalType: req.user?.type || 'anonymous',
        sourceIp: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          processingTime
        }
      })
    })
    
    next()
  }
}
```

### React Audit Hook

```typescript
import { useCallback } from 'react'

export function useAudit() {
  const logEvent = useCallback(async (event: any) => {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...event,
        timestamp: new Date().toISOString(),
        sessionContext: {
          userAgent: navigator.userAgent,
          url: window.location.href
        }
      })
    })
  }, [])
  
  return { logEvent }
}
```

## 🧪 Testing Examples

### Basic Test Suite

```typescript
import { describe, it, expect } from 'vitest'
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

describe('Audit Database', () => {
  it('should create and retrieve audit events', async () => {
    const auditDb = new AuditDb(process.env.TEST_AUDIT_DB_URL)
    const db = auditDb.getDrizzleInstance()
    
    const testEvent = {
      timestamp: new Date().toISOString(),
      action: 'test.action',
      status: 'success',
      principalId: 'test-user',
      principalType: 'user'
    }
    
    const [created] = await db.insert(auditLog).values(testEvent).returning()
    expect(created.action).toBe(testEvent.action)
    
    // Cleanup
    await db.delete(auditLog).where(eq(auditLog.id, created.id))
  })
})
```

## 📊 Best Practices Summary

### Performance Optimization
- Use `EnhancedAuditDb` for production workloads
- Enable query caching for frequently accessed data
- Implement connection pooling with appropriate sizes
- Use batch operations for multiple related events

### Security & Compliance
- Always specify data classification levels (PHI, PII, etc.)
- Include source IP addresses and user agents
- Implement proper access controls for audit data
- Use cryptographic integrity verification for critical events

### Monitoring & Alerting
- Monitor database performance metrics
- Set up alerts for failed audit events
- Track cache hit rates and query performance
- Implement health checks for system components

These examples provide a solid foundation for implementing comprehensive audit logging in healthcare applications with HIPAA and GDPR compliance.
