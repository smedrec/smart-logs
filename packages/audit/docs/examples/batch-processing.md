# Batch Processing

This document provides comprehensive examples of implementing high-volume audit logging using the `@repo/audit` package. These examples demonstrate scalable patterns for healthcare environments processing thousands of events per minute, including bulk operations, archival processing, compliance reporting, and performance optimization strategies.

## 📚 Table of Contents

- [High-Volume Event Processing](#high-volume-event-processing)
- [Bulk Data Operations](#bulk-data-operations)
- [Archival Processing](#archival-processing)
- [Compliance Reporting](#compliance-reporting)
- [Performance Optimization](#performance-optimization)
- [Queue Management](#queue-management)
- [Error Handling and Recovery](#error-handling-and-recovery)
- [Testing Strategies](#testing-strategies)

## ⚡ High-Volume Event Processing

### Real-Time Hospital System Processing

```typescript
import { Audit, AuditConfig } from '@repo/audit'

class HighVolumeAuditProcessor {
  private batchQueue: AuditEvent[] = []
  private readonly BATCH_SIZE = 1000
  private readonly FLUSH_INTERVAL = 5000

  constructor(private auditService: Audit, private metricsCollector: MetricsCollector) {
    this.startBatchProcessor()
  }

  async processHospitalEvents(events: AuditEvent[]) {
    const correlationId = `hospital-batch-${Date.now()}`
    const startTime = Date.now()
    
    try {
      if (events.length > 10000) {
        throw new Error('Batch size exceeds maximum limit of 10,000 events')
      }

      // Preprocess events for healthcare compliance
      const processedEvents = await this.preprocessHealthcareEvents(events)
      
      // Partition events by priority
      const partitionedEvents = this.partitionEventsByPriority(processedEvents)
      
      // Process critical events immediately
      if (partitionedEvents.critical.length > 0) {
        await this.processCriticalEvents(partitionedEvents.critical, correlationId)
      }

      // Queue standard events for batch processing
      for (const event of partitionedEvents.standard) {
        await this.queueEvent(event)
      }

      await this.auditService.log({
        principalId: 'hospital-system',
        action: 'audit.batch.hospital_processing.started',
        status: 'success',
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Bulk Processing',
          processingType: 'Real-time hospital events'
        },
        details: {
          totalEvents: events.length,
          criticalEvents: partitionedEvents.critical.length,
          standardEvents: partitionedEvents.standard.length,
          batchId: correlationId
        }
      })

      this.metricsCollector.incrementCounter('hospital_events_processed', events.length)
      
      return {
        processed: events.length,
        criticalEventsProcessed: partitionedEvents.critical.length,
        standardEventsQueued: partitionedEvents.standard.length,
        batchId: correlationId
      }
      
    } catch (error) {
      this.metricsCollector.incrementCounter('hospital_events_failed', events.length)
      
      await this.auditService.log({
        principalId: 'hospital-system',
        action: 'audit.batch.hospital_processing.failed',
        status: 'failure',
        correlationId,
        details: { error: error.message, eventsAttempted: events.length }
      })
      
      throw error
    }
  }

  private async preprocessHealthcareEvents(events: AuditEvent[]): Promise<AuditEvent[]> {
    return events.map(event => ({
      ...event,
      complianceContext: {
        ...event.complianceContext,
        regulation: event.complianceContext?.regulation || 'HIPAA',
        dataClassification: this.classifyHealthcareData(event),
        retentionPeriod: this.calculateRetentionPeriod(event)
      },
      processingMetadata: {
        receivedAt: new Date(),
        batchProcessed: true,
        processingVersion: '1.0'
      }
    }))
  }

  private partitionEventsByPriority(events: AuditEvent[]) {
    const critical: AuditEvent[] = []
    const standard: AuditEvent[] = []
    
    for (const event of events) {
      if (this.isCriticalEvent(event)) {
        critical.push(event)
      } else {
        standard.push(event)
      }
    }
    
    return { critical, standard }
  }

  private isCriticalEvent(event: AuditEvent): boolean {
    const criticalActions = [
      'emergency.access',
      'security.breach',
      'patient.death',
      'medication.error',
      'system.failure'
    ]
    
    return criticalActions.some(action => event.action.includes(action)) ||
           event.complianceContext?.securityIncident ||
           event.details?.severity === 'critical'
  }

  private async processCriticalEvents(events: AuditEvent[], correlationId: string) {
    const promises = events.map(event => 
      this.auditService.logCritical(event, {
        priority: 1,
        immediate: true,
        correlationId
      })
    )
    
    await Promise.all(promises)
  }

  private async queueEvent(event: AuditEvent) {
    this.batchQueue.push(event)
    
    if (this.batchQueue.length >= this.BATCH_SIZE) {
      await this.flushBatch()
    }
  }

  private startBatchProcessor() {
    setInterval(async () => {
      if (this.batchQueue.length > 0) {
        await this.flushBatch()
      }
    }, this.FLUSH_INTERVAL)
  }

  private async flushBatch() {
    if (this.batchQueue.length === 0) return
    
    const batch = this.batchQueue.splice(0, this.BATCH_SIZE)
    const batchId = `batch-${Date.now()}`
    
    try {
      const startTime = Date.now()
      await this.auditService.logBatch(batch)
      const processingTime = Date.now() - startTime
      
      this.metricsCollector.recordHistogram('batch_processing_duration', processingTime)
      this.metricsCollector.incrementCounter('batches_processed', 1)
      
      await this.auditService.log({
        principalId: 'batch-processor',
        action: 'audit.batch.flushed',
        status: 'success',
        details: {
          batchId,
          eventCount: batch.length,
          processingTime,
          throughput: batch.length / (processingTime / 1000)
        }
      })
      
    } catch (error) {
      this.batchQueue.unshift(...batch) // Re-queue failed events
      this.metricsCollector.incrementCounter('batch_failures', 1)
      
      await this.auditService.log({
        principalId: 'batch-processor',
        action: 'audit.batch.flush_failed',
        status: 'failure',
        details: { batchId, eventCount: batch.length, error: error.message }
      })
    }
  }
}
```

### Laboratory Information System Integration

```typescript
class LaboratoryBatchProcessor {
  constructor(private auditService: Audit, private labSystemConnector: LaboratorySystemConnector) {}

  async processLabResultsBatch(labResults: LabResult[], sessionContext: SessionContext) {
    const correlationId = `lab-batch-${Date.now()}`
    const startTime = Date.now()
    
    try {
      // Validate lab results batch
      const validationResults = await this.validateLabResults(labResults)
      
      if (validationResults.hasErrors) {
        await this.auditService.log({
          principalId: 'lab-system',
          action: 'audit.batch.lab_validation.failed',
          status: 'failure',
          sessionContext,
          correlationId,
          details: {
            totalResults: labResults.length,
            validationErrors: validationResults.errors,
            failedResults: validationResults.failedResults.length
          }
        })
        throw new Error('Lab results validation failed')
      }

      // Process results in parallel batches
      const batchSize = 100
      const batches = this.chunkArray(labResults, batchSize)
      const processedBatches = []
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const batchStartTime = Date.now()
        
        try {
          const auditEvents = await this.createLabAuditEvents(batch, sessionContext)
          await this.auditService.logBatch(auditEvents)
          
          // Check for critical results
          const criticalResults = batch.filter(result => this.isCriticalResult(result))
          
          if (criticalResults.length > 0) {
            await this.processCriticalLabResults(criticalResults, correlationId, sessionContext)
          }
          
          processedBatches.push({
            batchIndex: i,
            resultCount: batch.length,
            criticalCount: criticalResults.length,
            processingTime: Date.now() - batchStartTime
          })
          
        } catch (batchError) {
          await this.auditService.log({
            principalId: 'lab-system',
            action: 'audit.batch.lab_processing.batch_failed',
            status: 'failure',
            sessionContext,
            correlationId,
            details: { batchIndex: i, batchSize: batch.length, error: batchError.message }
          })
          continue
        }
      }

      await this.auditService.log({
        principalId: 'lab-system',
        action: 'audit.batch.lab_processing.completed',
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'CLIA',
          dataClassification: 'Laboratory Results',
          qualityAssurance: 'Validated'
        },
        details: {
          totalResults: labResults.length,
          processedBatches: processedBatches.length,
          totalProcessingTime: Date.now() - startTime,
          averageBatchTime: processedBatches.reduce((sum, b) => sum + b.processingTime, 0) / processedBatches.length,
          criticalResultsDetected: processedBatches.reduce((sum, b) => sum + b.criticalCount, 0)
        }
      })

      return { processed: labResults.length, batches: processedBatches, processingTime: Date.now() - startTime }
      
    } catch (error) {
      await this.auditService.log({
        principalId: 'lab-system',
        action: 'audit.batch.lab_processing.failed',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message, resultsAttempted: labResults.length }
      })
      throw error
    }
  }

  private async createLabAuditEvents(labResults: LabResult[], sessionContext: SessionContext): Promise<AuditEvent[]> {
    return labResults.map(result => ({
      principalId: result.technician || 'lab-system',
      action: 'fhir.diagnosticreport.processed',
      resourceType: 'DiagnosticReport',
      resourceId: result.resultId,
      status: 'success',
      sessionContext,
      complianceContext: {
        regulation: 'CLIA',
        dataClassification: 'PHI',
        labAccreditation: result.labAccreditation
      },
      details: {
        patientId: result.patientId,
        testCode: result.testCode,
        testName: result.testName,
        resultValue: result.value,
        isCritical: this.isCriticalResult(result),
        batchProcessed: true
      }
    }))
  }

  private async processCriticalLabResults(criticalResults: LabResult[], correlationId: string, sessionContext: SessionContext) {
    const criticalEvents = criticalResults.map(result => ({
      principalId: result.technician || 'lab-system',
      action: 'lab.critical_result.detected',
      targetResourceId: result.resultId,
      status: 'success',
      sessionContext,
      correlationId,
      complianceContext: {
        regulation: 'CLIA',
        dataClassification: 'Critical Value',
        notificationRequired: true
      },
      details: {
        patientId: result.patientId,
        testCode: result.testCode,
        criticalValue: result.value,
        orderingPhysician: result.orderingPhysician
      }
    }))

    for (const event of criticalEvents) {
      await this.auditService.logCritical(event, {
        priority: 1,
        notify: ['ordering-physician', 'lab-director'],
        escalate: true
      })
    }
  }
}
```

## 📦 Bulk Data Operations

### Healthcare Data Migration Auditing

```typescript
class DataMigrationAuditor {
  constructor(private auditService: Audit, private migrationService: MigrationService) {}

  async auditDataMigration(migrationJob: MigrationJob, sessionContext: SessionContext) {
    const correlationId = `migration-${migrationJob.id}`
    const startTime = Date.now()
    
    try {
      await this.auditService.log({
        principalId: migrationJob.initiatedBy,
        action: 'data.migration.started',
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Bulk PHI Transfer',
          migrationCompliance: 'Validated'
        },
        details: {
          migrationId: migrationJob.id,
          sourceSystem: migrationJob.sourceSystem,
          targetSystem: migrationJob.targetSystem,
          estimatedRecords: migrationJob.estimatedRecords,
          dataTypes: migrationJob.dataTypes
        }
      })

      // Process migration in chunks
      const CHUNK_SIZE = 1000
      let processedRecords = 0
      let errors = []
      
      while (processedRecords < migrationJob.estimatedRecords) {
        const chunkStartTime = Date.now()
        
        try {
          const chunk = await this.migrationService.processChunk(
            migrationJob.id,
            processedRecords,
            CHUNK_SIZE
          )
          
          await this.auditService.log({
            principalId: migrationJob.initiatedBy,
            action: 'data.migration.chunk_processed',
            status: 'success',
            sessionContext,
            correlationId,
            details: {
              migrationId: migrationJob.id,
              chunkIndex: Math.floor(processedRecords / CHUNK_SIZE),
              recordsProcessed: chunk.recordsProcessed,
              chunkProcessingTime: Date.now() - chunkStartTime,
              dataIntegrityChecks: chunk.integrityResults
            }
          })
          
          processedRecords += chunk.recordsProcessed
          
        } catch (chunkError) {
          errors.push({
            chunkIndex: Math.floor(processedRecords / CHUNK_SIZE),
            error: chunkError.message
          })
          
          await this.auditService.log({
            principalId: migrationJob.initiatedBy,
            action: 'data.migration.chunk_failed',
            status: 'failure',
            sessionContext,
            correlationId,
            details: {
              migrationId: migrationJob.id,
              chunkIndex: Math.floor(processedRecords / CHUNK_SIZE),
              error: chunkError.message
            }
          })
          
          processedRecords += CHUNK_SIZE
        }
      }

      // Verify migration integrity
      const integrityVerification = await this.migrationService.verifyIntegrity(migrationJob.id)
      
      await this.auditService.log({
        principalId: migrationJob.initiatedBy,
        action: 'data.migration.completed',
        status: errors.length === 0 ? 'success' : 'partial_failure',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Bulk PHI Transfer',
          migrationCompliance: 'Completed',
          integrityVerified: integrityVerification.verified
        },
        details: {
          migrationId: migrationJob.id,
          totalRecordsProcessed: processedRecords,
          failedChunks: errors.length,
          totalMigrationTime: Date.now() - startTime,
          integrityVerification
        }
      })

      return { migrationId: migrationJob.id, processedRecords, errors, integrityVerified: integrityVerification.verified }
      
    } catch (error) {
      await this.auditService.log({
        principalId: migrationJob.initiatedBy,
        action: 'data.migration.failed',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { migrationId: migrationJob.id, error: error.message }
      })
      throw error
    }
  }
}
```

## 🗄️ Archival Processing

### Automated Data Archival System

```typescript
class ArchivalProcessor {
  constructor(private auditService: Audit, private archivalService: ArchivalService) {}

  async processArchivalJob(archivalJob: ArchivalJob, sessionContext: SessionContext) {
    const correlationId = `archival-${archivalJob.id}`
    const startTime = Date.now()
    
    try {
      await this.auditService.log({
        principalId: archivalJob.initiatedBy,
        action: 'data.archival.initiated',
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Data Lifecycle Management',
          retentionCompliance: 'Automated'
        },
        details: {
          archivalJobId: archivalJob.id,
          dataTypes: archivalJob.dataTypes,
          retentionPeriod: archivalJob.retentionPeriod,
          estimatedRecords: archivalJob.estimatedRecords,
          cutoffDate: archivalJob.cutoffDate
        }
      })

      const archivalResults = []
      
      for (const dataType of archivalJob.dataTypes) {
        try {
          const eligibleRecords = await this.archivalService.getEligibleRecords(
            dataType,
            archivalJob.cutoffDate
          )
          
          if (eligibleRecords.length === 0) {
            await this.auditService.log({
              principalId: archivalJob.initiatedBy,
              action: 'data.archival.no_records',
              status: 'success',
              sessionContext,
              correlationId,
              details: { archivalJobId: archivalJob.id, dataType, cutoffDate: archivalJob.cutoffDate }
            })
            continue
          }

          // Archive records in batches
          const BATCH_SIZE = 500
          const batches = this.chunkArray(eligibleRecords, BATCH_SIZE)
          let archivedCount = 0
          
          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex]
            
            try {
              const archiveResult = await this.archivalService.archiveBatch(batch, archivalJob.strategy)
              const integrityCheck = await this.archivalService.verifyArchiveIntegrity(archiveResult.archiveId)
              
              if (!integrityCheck.verified) {
                throw new Error(`Archive integrity verification failed for batch ${batchIndex}`)
              }
              
              archivedCount += batch.length
              
              await this.auditService.log({
                principalId: archivalJob.initiatedBy,
                action: 'data.archival.batch_completed',
                status: 'success',
                sessionContext,
                correlationId,
                details: {
                  archivalJobId: archivalJob.id,
                  dataType,
                  batchIndex,
                  recordsArchived: batch.length,
                  archiveId: archiveResult.archiveId,
                  integrityVerified: integrityCheck.verified
                }
              })
              
            } catch (batchError) {
              await this.auditService.log({
                principalId: archivalJob.initiatedBy,
                action: 'data.archival.batch_failed',
                status: 'failure',
                sessionContext,
                correlationId,
                details: { archivalJobId: archivalJob.id, dataType, batchIndex, error: batchError.message }
              })
            }
          }
          
          archivalResults.push({ dataType, recordsArchived: archivedCount, batches: batches.length })
          
        } catch (dataTypeError) {
          await this.auditService.log({
            principalId: archivalJob.initiatedBy,
            action: 'data.archival.datatype_failed',
            status: 'failure',
            sessionContext,
            correlationId,
            details: { archivalJobId: archivalJob.id, dataType, error: dataTypeError.message }
          })
        }
      }

      await this.auditService.log({
        principalId: archivalJob.initiatedBy,
        action: 'data.archival.completed',
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Data Lifecycle Management',
          archivalCompleted: true
        },
        details: {
          archivalJobId: archivalJob.id,
          dataTypesProcessed: archivalResults.length,
          totalRecordsArchived: archivalResults.reduce((sum, result) => sum + result.recordsArchived, 0),
          processingTime: Date.now() - startTime
        }
      })

      return { archivalJobId: archivalJob.id, archivalResults, processingTime: Date.now() - startTime }
      
    } catch (error) {
      await this.auditService.log({
        principalId: archivalJob.initiatedBy,
        action: 'data.archival.failed',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { archivalJobId: archivalJob.id, error: error.message }
      })
      throw error
    }
  }
}
```

## 📊 Compliance Reporting

### Automated Compliance Report Generation

```typescript
class ComplianceReportingProcessor {
  constructor(private auditService: Audit, private reportGenerator: ReportGenerator) {}

  async generateComplianceReports(reportConfig: ComplianceReportConfig, sessionContext: SessionContext) {
    const correlationId = `compliance-report-${Date.now()}`
    const startTime = Date.now()
    
    try {
      await this.auditService.log({
        principalId: reportConfig.requestedBy,
        action: 'compliance.report.generation.started',
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: reportConfig.regulation,
          dataClassification: 'Compliance Reporting',
          reportingPeriod: reportConfig.reportingPeriod
        },
        details: {
          reportId: reportConfig.id,
          regulation: reportConfig.regulation,
          reportTypes: reportConfig.reportTypes,
          startDate: reportConfig.startDate,
          endDate: reportConfig.endDate
        }
      })

      const reportResults = []
      
      for (const reportType of reportConfig.reportTypes) {
        try {
          const reportData = await this.reportGenerator.generateReport(reportType, reportConfig)
          
          await this.auditService.log({
            principalId: reportConfig.requestedBy,
            action: 'compliance.report.type_completed',
            status: 'success',
            sessionContext,
            correlationId,
            details: {
              reportId: reportConfig.id,
              reportType,
              recordCount: reportData.recordCount,
              reportSize: reportData.sizeBytes,
              generationTime: reportData.generationTime
            }
          })
          
          reportResults.push({ reportType, ...reportData })
          
        } catch (reportError) {
          await this.auditService.log({
            principalId: reportConfig.requestedBy,
            action: 'compliance.report.type_failed',
            status: 'failure',
            sessionContext,
            correlationId,
            details: { reportId: reportConfig.id, reportType, error: reportError.message }
          })
        }
      }

      await this.auditService.log({
        principalId: reportConfig.requestedBy,
        action: 'compliance.report.generation.completed',
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: reportConfig.regulation,
          dataClassification: 'Compliance Reporting',
          reportGenerated: true
        },
        details: {
          reportId: reportConfig.id,
          reportsGenerated: reportResults.length,
          totalRecords: reportResults.reduce((sum, r) => sum + r.recordCount, 0),
          totalSize: reportResults.reduce((sum, r) => sum + r.sizeBytes, 0),
          processingTime: Date.now() - startTime
        }
      })

      return { reportId: reportConfig.id, reportResults, processingTime: Date.now() - startTime }
      
    } catch (error) {
      await this.auditService.log({
        principalId: reportConfig.requestedBy,
        action: 'compliance.report.generation.failed',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { reportId: reportConfig.id, error: error.message }
      })
      throw error
    }
  }
}
```

## ⚡ Performance Optimization

### Auto-Scaling Audit Infrastructure

```typescript
class AutoScalingAuditProcessor {
  private workerCount = 1
  private readonly MAX_WORKERS = 10
  private readonly MIN_WORKERS = 1
  private queueMonitor: NodeJS.Timeout

  constructor(private auditService: Audit, private queueService: QueueService) {
    this.startQueueMonitoring()
  }

  private startQueueMonitoring() {
    this.queueMonitor = setInterval(async () => {
      const queueStats = await this.queueService.getStats()
      
      if (queueStats.waiting > 1000 && this.workerCount < this.MAX_WORKERS) {
        await this.scaleUp()
      } else if (queueStats.waiting < 100 && this.workerCount > this.MIN_WORKERS) {
        await this.scaleDown()
      }
    }, 30000) // Check every 30 seconds
  }

  private async scaleUp() {
    this.workerCount++
    
    await this.auditService.log({
      principalId: 'auto-scaler',
      action: 'audit.infrastructure.scaled_up',
      status: 'success',
      details: {
        newWorkerCount: this.workerCount,
        reason: 'High queue depth',
        timestamp: Date.now()
      }
    })
  }

  private async scaleDown() {
    this.workerCount--
    
    await this.auditService.log({
      principalId: 'auto-scaler',
      action: 'audit.infrastructure.scaled_down',
      status: 'success',
      details: {
        newWorkerCount: this.workerCount,
        reason: 'Low queue depth',
        timestamp: Date.now()
      }
    })
  }
}
```

## 🧪 Testing Strategies

### Batch Processing Testing

```typescript
describe('Batch Processing', () => {
  it('should process high-volume hospital events', async () => {
    const mockAuditService = createMockAuditService()
    const processor = new HighVolumeAuditProcessor(mockAuditService, mockMetricsCollector)
    
    const events = Array.from({ length: 5000 }, (_, i) => createMockAuditEvent(`event-${i}`))
    
    const result = await processor.processHospitalEvents(events)
    
    expect(result.processed).toBe(5000)
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'audit.batch.hospital_processing.started'
      })
    )
  })

  it('should handle lab results batch processing', async () => {
    const mockAuditService = createMockAuditService()
    const labProcessor = new LaboratoryBatchProcessor(mockAuditService, mockLabConnector)
    
    const labResults = Array.from({ length: 1000 }, (_, i) => createMockLabResult(`result-${i}`))
    
    const result = await labProcessor.processLabResultsBatch(labResults, mockSessionContext)
    
    expect(result.processed).toBe(1000)
    expect(mockAuditService.logBatch).toHaveBeenCalled()
  })

  it('should handle archival processing', async () => {
    const mockAuditService = createMockAuditService()
    const archivalProcessor = new ArchivalProcessor(mockAuditService, mockArchivalService)
    
    const archivalJob = createMockArchivalJob()
    
    const result = await archivalProcessor.processArchivalJob(archivalJob, mockSessionContext)
    
    expect(result.archivalJobId).toBe(archivalJob.id)
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'data.archival.initiated'
      })
    )
  })
})
```

This comprehensive batch processing documentation provides healthcare developers with scalable, performance-optimized examples for implementing audit logging in high-volume environments, from real-time hospital systems to automated archival and compliance reporting.