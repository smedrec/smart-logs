# Healthcare Scenarios Examples

This section provides comprehensive examples for common healthcare workflows and scenarios, demonstrating proper audit logging implementation with HIPAA and GDPR compliance.

## 🏥 Patient Care Scenarios

### Electronic Medical Record (EMR) Access

#### Patient Chart Viewing

```typescript
import { auditService, HIPAAAuditService } from '@repo/audit'

class PatientChartService {
  /**
   * Log patient chart access with HIPAA compliance
   */
  async viewPatientChart(params: {
    physicianId: string
    patientId: string
    chartSections: string[]
    department: string
    sessionId: string
    ipAddress: string
    accessReason: string
  }): Promise<PatientChart> {
    try {
      // Retrieve patient chart
      const chart = await this.getPatientChart(params.patientId)
      
      // Log HIPAA-compliant PHI access
      await HIPAAAuditService.logPHIAccess({
        principalId: params.physicianId,
        principalRole: 'physician',
        patientId: params.patientId,
        action: 'chart_view',
        accessReason: params.accessReason,
        minimumNecessaryJustification: `Viewing ${params.chartSections.join(', ')} sections for patient care`,
        sessionId: params.sessionId,
        ipAddress: params.ipAddress,
        userAgent: 'EMR-System/3.2',
        department: params.department
      })
      
      // Log detailed chart section access
      for (const section of params.chartSections) {
        await auditService.logFHIR({
          principalId: params.physicianId,
          action: 'fhir.patient.read',
          status: 'success',
          resourceType: 'Patient',
          resourceId: params.patientId,
          dataClassification: 'PHI',
          
          fhirContext: {
            version: 'R4',
            interaction: 'read',
            compartment: `Patient/${params.patientId}`,
            endpoint: `/fhir/Patient/${params.patientId}/${section}`
          },
          
          sessionContext: {
            sessionId: params.sessionId,
            ipAddress: params.ipAddress,
            userAgent: 'EMR-System/3.2',
            department: params.department
          },
          
          details: {
            chartSection: section,
            accessMethod: 'web_interface',
            viewDuration: null // Will be updated on section close
          },
          
          outcomeDescription: `Physician accessed patient ${section} section for clinical review`
        })
      }
      
      return chart
    } catch (error) {
      // Log failed access attempt
      await auditService.logFHIR({
        principalId: params.physicianId,
        action: 'fhir.patient.read',
        status: 'failure',
        resourceType: 'Patient',
        resourceId: params.patientId,
        dataClassification: 'PHI',
        
        details: {
          errorType: error.name,
          errorMessage: error.message
        },
        
        outcomeDescription: `Failed to access patient chart: ${error.message}`
      })
      
      throw error
    }
  }

  /**
   * Log patient chart modification
   */
  async updatePatientChart(params: {
    physicianId: string
    patientId: string
    section: string
    changes: Array<{
      field: string
      oldValue: any
      newValue: any
    }>
    reason: string
    sessionId: string
  }): Promise<void> {
    try {
      // Apply changes to chart
      await this.applyChartChanges(params.patientId, params.changes)
      
      // Log each change for audit trail
      for (const change of params.changes) {
        await auditService.logData({
          principalId: params.physicianId,
          action: 'data.update',
          status: 'success',
          targetResourceType: 'PatientChart',
          targetResourceId: params.patientId,
          dataClassification: 'PHI',
          
          changes: {
            field: `${params.section}.${change.field}`,
            oldValue: change.oldValue,
            newValue: change.newValue
          },
          
          sessionContext: {
            sessionId: params.sessionId
          },
          
          complianceContext: {
            regulation: 'HIPAA',
            accessReason: params.reason,
            minimumNecessaryJustification: 'Clinical documentation update',
            legalBasis: 'healthcare_treatment'
          },
          
          outcomeDescription: `Updated patient chart ${params.section}.${change.field}: ${params.reason}`
        })
      }
      
      // Log overall chart update
      await auditService.logFHIR({
        principalId: params.physicianId,
        action: 'fhir.patient.update',
        status: 'success',
        resourceType: 'Patient',
        resourceId: params.patientId,
        dataClassification: 'PHI',
        
        fhirContext: {
          version: 'R4',
          interaction: 'update',
          compartment: `Patient/${params.patientId}`
        },
        
        details: {
          modifiedSection: params.section,
          changesCount: params.changes.length,
          clinicalReason: params.reason
        },
        
        outcomeDescription: `Successfully updated patient chart section: ${params.section}`
      })
      
    } catch (error) {
      await auditService.logFHIR({
        principalId: params.physicianId,
        action: 'fhir.patient.update',
        status: 'failure',
        resourceType: 'Patient',
        resourceId: params.patientId,
        dataClassification: 'PHI',
        
        details: {
          errorType: error.name,
          attemptedChanges: params.changes.length
        },
        
        outcomeDescription: `Failed to update patient chart: ${error.message}`
      })
      
      throw error
    }
  }
}
```

### Medication Management Workflow

#### Prescription Management

```typescript
class MedicationService {
  /**
   * Prescribe medication with comprehensive audit logging
   */
  async prescribeMedication(params: {
    prescriberId: string
    patientId: string
    medication: {
      name: string
      dosage: string
      frequency: string
      duration: string
      indication: string
    }
    sessionId: string
    department: string
  }): Promise<string> {
    const prescriptionId = generatePrescriptionId()
    
    try {
      // Create prescription record
      await this.createPrescription(prescriptionId, params)
      
      // Log medication prescription
      await auditService.logFHIR({
        principalId: params.prescriberId,
        action: 'fhir.medicationrequest.create',
        status: 'success',
        resourceType: 'MedicationRequest',
        resourceId: prescriptionId,
        dataClassification: 'PHI',
        
        fhirContext: {
          version: 'R4',
          interaction: 'create',
          compartment: `Patient/${params.patientId}`,
          medication: params.medication.name,
          patient: params.patientId
        },
        
        sessionContext: {
          sessionId: params.sessionId,
          department: params.department
        },
        
        details: {
          medication: params.medication.name,
          dosage: params.medication.dosage,
          frequency: params.medication.frequency,
          duration: params.medication.duration,
          indication: params.medication.indication,
          prescriptionType: 'new'
        },
        
        complianceContext: {
          regulation: 'HIPAA',
          accessReason: 'medication_prescription',
          minimumNecessaryJustification: `Prescribed ${params.medication.name} for ${params.medication.indication}`,
          legalBasis: 'healthcare_treatment'
        },
        
        outcomeDescription: `Prescribed ${params.medication.name} ${params.medication.dosage} for ${params.medication.indication}`
      })
      
      // Check for drug interactions
      const interactions = await this.checkDrugInteractions(params.patientId, params.medication.name)
      
      if (interactions.length > 0) {
        await auditService.log({
          principalId: params.prescriberId,
          action: 'medication.interaction.checked',
          status: 'success',
          targetResourceType: 'MedicationRequest',
          targetResourceId: prescriptionId,
          dataClassification: 'PHI',
          
          details: {
            newMedication: params.medication.name,
            interactions: interactions.map(i => ({
              medication: i.medication,
              severity: i.severity,
              description: i.description
            }))
          },
          
          outcomeDescription: `Drug interaction check completed: ${interactions.length} interactions found`
        })
      }
      
      return prescriptionId
      
    } catch (error) {
      await auditService.logFHIR({
        principalId: params.prescriberId,
        action: 'fhir.medicationrequest.create',
        status: 'failure',
        resourceType: 'MedicationRequest',
        resourceId: prescriptionId,
        dataClassification: 'PHI',
        
        details: {
          errorType: error.name,
          errorMessage: error.message,
          attemptedMedication: params.medication.name
        },
        
        outcomeDescription: `Failed to prescribe medication: ${error.message}`
      })
      
      throw error
    }
  }

  /**
   * Medication administration by nursing staff
   */
  async administerMedication(params: {
    nurseId: string
    patientId: string
    prescriptionId: string
    administeredDose: string
    administrationTime: Date
    administrationRoute: string
    notes?: string
    sessionId: string
  }): Promise<void> {
    const administrationId = generateAdministrationId()
    
    try {
      // Record medication administration
      await this.recordAdministration(administrationId, params)
      
      // Log medication administration
      await auditService.logFHIR({
        principalId: params.nurseId,
        action: 'fhir.medicationadministration.create',
        status: 'success',
        resourceType: 'MedicationAdministration',
        resourceId: administrationId,
        dataClassification: 'PHI',
        
        fhirContext: {
          version: 'R4',
          interaction: 'create',
          compartment: `Patient/${params.patientId}`,
          relatedPrescription: params.prescriptionId
        },
        
        sessionContext: {
          sessionId: params.sessionId
        },
        
        details: {
          prescriptionId: params.prescriptionId,
          administeredDose: params.administeredDose,
          administrationTime: params.administrationTime.toISOString(),
          route: params.administrationRoute,
          notes: params.notes,
          administrationType: 'scheduled'
        },
        
        complianceContext: {
          regulation: 'HIPAA',
          accessReason: 'medication_administration',
          minimumNecessaryJustification: 'Administering prescribed medication to patient',
          legalBasis: 'healthcare_treatment'
        },
        
        outcomeDescription: `Medication administered: ${params.administeredDose} via ${params.administrationRoute} at ${params.administrationTime.toISOString()}`
      })
      
      // Check for late administration
      const prescription = await this.getPrescription(params.prescriptionId)
      const scheduledTime = this.calculateScheduledTime(prescription)
      const delay = params.administrationTime.getTime() - scheduledTime.getTime()
      
      if (delay > 30 * 60 * 1000) { // More than 30 minutes late
        await auditService.log({
          principalId: params.nurseId,
          action: 'medication.administration.delayed',
          status: 'success',
          targetResourceType: 'MedicationAdministration',
          targetResourceId: administrationId,
          dataClassification: 'PHI',
          
          details: {
            delayMinutes: Math.floor(delay / (60 * 1000)),
            scheduledTime: scheduledTime.toISOString(),
            actualTime: params.administrationTime.toISOString(),
            delayReason: params.notes || 'Not specified'
          },
          
          outcomeDescription: `Medication administered ${Math.floor(delay / (60 * 1000))} minutes late`
        })
      }
      
    } catch (error) {
      await auditService.logFHIR({
        principalId: params.nurseId,
        action: 'fhir.medicationadministration.create',
        status: 'failure',
        resourceType: 'MedicationAdministration',
        resourceId: administrationId,
        dataClassification: 'PHI',
        
        details: {
          errorType: error.name,
          prescriptionId: params.prescriptionId
        },
        
        outcomeDescription: `Failed to record medication administration: ${error.message}`
      })
      
      throw error
    }
  }
}
```

### Laboratory Results Workflow

#### Lab Order and Results Processing

```typescript
class LaboratoryService {
  /**
   * Order laboratory tests
   */
  async orderLabTests(params: {
    orderingPhysicianId: string
    patientId: string
    tests: Array<{
      testCode: string
      testName: string
      urgency: 'routine' | 'urgent' | 'stat'
    }>
    clinicalIndication: string
    sessionId: string
  }): Promise<string> {
    const orderId = generateLabOrderId()
    
    try {
      // Create lab order
      await this.createLabOrder(orderId, params)
      
      // Log lab order creation
      await auditService.logFHIR({
        principalId: params.orderingPhysicianId,
        action: 'fhir.servicerequest.create',
        status: 'success',
        resourceType: 'ServiceRequest',
        resourceId: orderId,
        dataClassification: 'PHI',
        
        fhirContext: {
          version: 'R4',
          interaction: 'create',
          compartment: `Patient/${params.patientId}`,
          serviceCategory: 'laboratory'
        },
        
        sessionContext: {
          sessionId: params.sessionId
        },
        
        details: {
          testsOrdered: params.tests.map(t => ({
            code: t.testCode,
            name: t.testName,
            urgency: t.urgency
          })),
          clinicalIndication: params.clinicalIndication,
          orderType: 'laboratory'
        },
        
        complianceContext: {
          regulation: 'HIPAA',
          accessReason: 'laboratory_order',
          minimumNecessaryJustification: `Ordered lab tests for clinical indication: ${params.clinicalIndication}`,
          legalBasis: 'healthcare_treatment'
        },
        
        outcomeDescription: `Ordered ${params.tests.length} laboratory tests: ${params.tests.map(t => t.testName).join(', ')}`
      })
      
      // Log each individual test order
      for (const test of params.tests) {
        await auditService.log({
          principalId: params.orderingPhysicianId,
          action: 'laboratory.test.ordered',
          status: 'success',
          targetResourceType: 'LabTest',
          targetResourceId: `${orderId}-${test.testCode}`,
          dataClassification: 'PHI',
          
          details: {
            testCode: test.testCode,
            testName: test.testName,
            urgency: test.urgency,
            orderId: orderId,
            indication: params.clinicalIndication
          },
          
          outcomeDescription: `Ordered ${test.testName} (${test.testCode}) with ${test.urgency} priority`
        })
      }
      
      return orderId
      
    } catch (error) {
      await auditService.logFHIR({
        principalId: params.orderingPhysicianId,
        action: 'fhir.servicerequest.create',
        status: 'failure',
        resourceType: 'ServiceRequest',
        resourceId: orderId,
        dataClassification: 'PHI',
        
        details: {
          errorType: error.name,
          attemptedTests: params.tests.length
        },
        
        outcomeDescription: `Failed to order laboratory tests: ${error.message}`
      })
      
      throw error
    }
  }

  /**
   * Process and release laboratory results
   */
  async releaseLabResults(params: {
    labTechnicianId: string
    orderId: string
    results: Array<{
      testCode: string
      value: string
      unit: string
      referenceRange: string
      status: 'normal' | 'abnormal' | 'critical'
    }>
    reviewingPathologistId?: string
    releaseTime: Date
  }): Promise<void> {
    try {
      // Store results in system
      await this.storeLabResults(params.orderId, params.results)
      
      // Log lab results release
      await auditService.logFHIR({
        principalId: params.labTechnicianId,
        action: 'fhir.observation.create',
        status: 'success',
        resourceType: 'Observation',
        resourceId: params.orderId,
        dataClassification: 'PHI',
        
        fhirContext: {
          version: 'R4',
          interaction: 'create',
          category: 'laboratory'
        },
        
        details: {
          resultsCount: params.results.length,
          criticalResults: params.results.filter(r => r.status === 'critical').length,
          abnormalResults: params.results.filter(r => r.status === 'abnormal').length,
          reviewingPathologist: params.reviewingPathologistId,
          releaseTime: params.releaseTime.toISOString()
        },
        
        complianceContext: {
          regulation: 'HIPAA',
          accessReason: 'laboratory_results_release',
          minimumNecessaryJustification: 'Releasing completed laboratory test results to ordering physician',
          legalBasis: 'healthcare_treatment'
        },
        
        outcomeDescription: `Released ${params.results.length} laboratory test results`
      })
      
      // Log critical results separately for immediate attention
      const criticalResults = params.results.filter(r => r.status === 'critical')
      for (const result of criticalResults) {
        await auditService.logCritical({
          principalId: params.labTechnicianId,
          action: 'laboratory.critical.result',
          status: 'success',
          targetResourceType: 'LabResult',
          targetResourceId: `${params.orderId}-${result.testCode}`,
          dataClassification: 'PHI',
          
          details: {
            testCode: result.testCode,
            value: result.value,
            unit: result.unit,
            referenceRange: result.referenceRange,
            criticalityLevel: 'high'
          },
          
          outcomeDescription: `Critical laboratory result released: ${result.testCode} = ${result.value} ${result.unit}`
        }, {
          priority: 1,
          notify: ['ordering-physician', 'lab-supervisor'],
          compliance: ['hipaa']
        })
      }
      
    } catch (error) {
      await auditService.logFHIR({
        principalId: params.labTechnicianId,
        action: 'fhir.observation.create',
        status: 'failure',
        resourceType: 'Observation',
        resourceId: params.orderId,
        dataClassification: 'PHI',
        
        details: {
          errorType: error.name,
          resultsCount: params.results.length
        },
        
        outcomeDescription: `Failed to release laboratory results: ${error.message}`
      })
      
      throw error
    }
  }
}
```

## 🔒 Security and Compliance Scenarios

### Break-Glass Emergency Access

```typescript
class EmergencyAccessService {
  /**
   * Handle emergency break-glass access to patient records
   */
  async grantEmergencyAccess(params: {
    emergencyUserId: string
    patientId: string
    emergencyReason: string
    approvedBy?: string
    sessionId: string
    ipAddress: string
  }): Promise<{ accessToken: string; expiresAt: Date }> {
    const accessToken = generateEmergencyAccessToken()
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
    
    try {
      // Grant temporary access
      await this.grantTemporaryAccess(params.emergencyUserId, params.patientId, expiresAt)
      
      // Log break-glass access
      await auditService.logCritical({
        principalId: params.emergencyUserId,
        action: 'security.break_glass_access',
        status: 'success',
        targetResourceType: 'PatientRecord',
        targetResourceId: params.patientId,
        dataClassification: 'PHI',
        
        sessionContext: {
          sessionId: params.sessionId,
          ipAddress: params.ipAddress
        },
        
        securityContext: {
          accessType: 'emergency',
          threatLevel: 'high',
          emergencyReason: params.emergencyReason,
          approvedBy: params.approvedBy,
          requiresReview: true,
          accessDuration: '2 hours'
        },
        
        complianceContext: {
          regulation: 'HIPAA',
          accessReason: 'emergency_medical_care',
          minimumNecessaryJustification: params.emergencyReason,
          isBreakGlass: true,
          requiresPostAccessReview: true
        },
        
        outcomeDescription: `Emergency break-glass access granted to patient ${params.patientId}: ${params.emergencyReason}`
      }, {
        priority: 1,
        compliance: ['hipaa'],
        notify: ['security-team', 'compliance-officer', 'chief-medical-officer'],
        escalate: true
      })
      
      // Schedule automatic review
      await this.scheduleEmergencyAccessReview({
        accessToken,
        emergencyUserId: params.emergencyUserId,
        patientId: params.patientId,
        reviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      })
      
      return { accessToken, expiresAt }
      
    } catch (error) {
      await auditService.logCritical({
        principalId: params.emergencyUserId,
        action: 'security.break_glass_access',
        status: 'failure',
        targetResourceType: 'PatientRecord',
        targetResourceId: params.patientId,
        dataClassification: 'PHI',
        
        securityContext: {
          accessType: 'emergency',
          emergencyReason: params.emergencyReason,
          failureReason: error.message
        },
        
        outcomeDescription: `Failed to grant emergency access: ${error.message}`
      }, {
        priority: 1,
        notify: ['security-team'],
        escalate: true
      })
      
      throw error
    }
  }
}
```

### Data Breach Response

```typescript
class DataBreachResponseService {
  /**
   * Handle potential data breach incident
   */
  async handlePotentialBreach(params: {
    detectedBy: string
    breachType: string
    affectedPatients: string[]
    rootCause: string
    detectionMethod: string
    containmentActions: string[]
  }): Promise<string> {
    const incidentId = generateIncidentId()
    
    try {
      // Immediate containment
      await this.executeContainmentActions(params.containmentActions)
      
      // Log breach incident
      await auditService.logCritical({
        principalId: params.detectedBy,
        action: 'security.data_breach.detected',
        status: 'failure',
        dataClassification: 'CONFIDENTIAL',
        
        securityContext: {
          incidentId,
          breachType: params.breachType,
          affectedRecords: params.affectedPatients.length,
          rootCause: params.rootCause,
          detectionMethod: params.detectionMethod,
          containmentActions: params.containmentActions,
          riskLevel: this.assessBreachRisk(params.affectedPatients.length)
        },
        
        complianceContext: {
          regulation: 'HIPAA',
          breachNotificationRequired: params.affectedPatients.length >= 500,
          notificationDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
          affectedIndividuals: params.affectedPatients.length
        },
        
        outcomeDescription: `Data breach detected affecting ${params.affectedPatients.length} patients: ${params.breachType}`
      }, {
        priority: 1,
        compliance: ['hipaa'],
        notify: ['security-team', 'compliance-officer', 'legal-team', 'management'],
        escalate: true
      })
      
      // Schedule breach notification if required
      if (params.affectedPatients.length >= 500) {
        await this.scheduleBreachNotification(incidentId, params.affectedPatients)
      }
      
      return incidentId
      
    } catch (error) {
      console.error('Failed to handle data breach:', error)
      throw error
    }
  }

  private assessBreachRisk(affectedCount: number): 'low' | 'medium' | 'high' | 'critical' {
    if (affectedCount >= 10000) return 'critical'
    if (affectedCount >= 1000) return 'high'
    if (affectedCount >= 100) return 'medium'
    return 'low'
  }
}
```

## 📊 Performance and Monitoring Examples

### High-Volume Event Processing

```typescript
class HighVolumeAuditProcessor {
  private batchProcessor: BatchAuditProcessor
  
  constructor() {
    this.batchProcessor = new BatchAuditProcessor(auditService)
  }

  /**
   * Process high-volume clinical events during peak hours
   */
  async processClinicalEvents(events: ClinicalEvent[]): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Process events in batches for optimal performance
      const batches = this.chunkEvents(events, 100)
      
      await Promise.all(
        batches.map(batch => this.processBatch(batch))
      )
      
      const processingTime = Date.now() - startTime
      const throughput = events.length / (processingTime / 1000)
      
      // Log performance metrics
      await auditService.log({
        principalId: 'audit-processor',
        action: 'system.batch.processed',
        status: 'success',
        details: {
          eventsProcessed: events.length,
          processingTimeMs: processingTime,
          throughputEventsPerSecond: throughput,
          batchCount: batches.length
        },
        outcomeDescription: `Processed ${events.length} clinical events in ${processingTime}ms (${throughput.toFixed(2)} events/sec)`
      })
      
    } catch (error) {
      await auditService.log({
        principalId: 'audit-processor',
        action: 'system.batch.processed',
        status: 'failure',
        details: {
          eventsAttempted: events.length,
          errorType: error.name,
          errorMessage: error.message
        },
        outcomeDescription: `Failed to process clinical events batch: ${error.message}`
      })
      
      throw error
    }
  }
}
```

## 💡 Best Practices Demonstrated

### Error Handling Patterns
- Always log both successful and failed operations
- Include sufficient context for troubleshooting
- Use appropriate data classifications
- Implement graceful degradation

### Compliance Patterns
- Include required HIPAA fields for PHI access
- Document minimum necessary justification
- Track break-glass emergency access
- Implement proper breach notification procedures

### Performance Patterns
- Use batch processing for high-volume scenarios
- Implement proper error recovery
- Monitor and log performance metrics
- Scale processing based on load

### Security Patterns
- Pseudonymize sensitive identifiers where appropriate
- Use critical event logging for security incidents
- Implement proper access control validation
- Enable real-time threat detection

These examples provide a solid foundation for implementing audit logging in healthcare applications while maintaining compliance with HIPAA and GDPR requirements.