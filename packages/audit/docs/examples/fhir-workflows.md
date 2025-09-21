# FHIR Workflows

This document provides comprehensive examples of implementing audit logging for FHIR (Fast Healthcare Interoperability Resources) workflows using the `@repo/audit` package. These examples demonstrate healthcare-specific audit patterns for patient data management, clinical workflows, and regulatory compliance.

## 📚 Table of Contents

- [Patient Record Access Workflows](#patient-record-access-workflows)
- [Clinical Document Management](#clinical-document-management)
- [Medication Order Management](#medication-order-management)
- [Diagnostic Report Processing](#diagnostic-report-processing)
- [Appointment Scheduling](#appointment-scheduling)
- [Bundle Operations](#bundle-operations)
- [Patient Compartment Security](#patient-compartment-security)
- [Compliance Patterns](#compliance-patterns)
- [Performance Optimization](#performance-optimization)
- [Testing Strategies](#testing-strategies)

## 🏥 Patient Record Access Workflows

### Basic Patient Chart Access

```typescript
import { Audit, AuditConfig } from '@repo/audit'
import { FHIRService } from './fhir-service'

class PatientChartService {
  constructor(
    private auditService: Audit,
    private fhirService: FHIRService
  ) {}

  async getPatientChart(patientId: string, practitionerId: string, sessionContext: SessionContext) {
    const startTime = Date.now()
    
    try {
      // Check practitioner permissions first
      const hasAccess = await this.checkPatientAccess(practitionerId, patientId)
      
      if (!hasAccess) {
        await this.auditService.logFHIR({
          principalId: practitionerId,
          action: 'fhir.patient.read',
          resourceType: 'Patient',
          resourceId: patientId,
          status: 'failure',
          sessionContext,
          complianceContext: {
            regulation: 'HIPAA',
            dataClassification: 'PHI',
            accessDeniedReason: 'Insufficient privileges'
          },
          processingLatency: Date.now() - startTime
        })
        
        throw new Error('Access denied to patient record')
      }

      // Retrieve patient data
      const patient = await this.fhirService.getPatient(patientId)
      
      // Log successful access
      await this.auditService.logFHIR({
        principalId: practitionerId,
        action: 'fhir.patient.read',
        resourceType: 'Patient',
        resourceId: patientId,
        status: 'success',
        sessionContext,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          accessReason: 'Clinical care',
          minimumNecessaryJustification: 'Patient treatment'
        },
        processingLatency: Date.now() - startTime
      })

      return patient
      
    } catch (error) {
      // Log error access attempt
      await this.auditService.logFHIR({
        principalId: practitionerId,
        action: 'fhir.patient.read',
        resourceType: 'Patient',
        resourceId: patientId,
        status: 'failure',
        sessionContext,
        details: {
          error: error.message,
          errorCode: error.code
        },
        processingLatency: Date.now() - startTime
      })
      
      throw error
    }
  }

  async updatePatientData(
    patientId: string, 
    updates: Partial<Patient>, 
    practitionerId: string,
    sessionContext: SessionContext
  ) {
    const startTime = Date.now()
    
    try {
      // Get current patient data for change tracking
      const currentPatient = await this.fhirService.getPatient(patientId)
      
      // Update patient data
      const updatedPatient = await this.fhirService.updatePatient(patientId, updates)
      
      // Calculate changed fields
      const changedFields = this.calculateChangedFields(currentPatient, updatedPatient)
      
      // Log the update with detailed change information
      await this.auditService.logFHIR({
        principalId: practitionerId,
        action: 'fhir.patient.update',
        resourceType: 'Patient',
        resourceId: patientId,
        status: 'success',
        sessionContext,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          changeReason: 'Clinical update',
          approvalRequired: false
        },
        details: {
          changedFields,
          previousVersion: currentPatient.meta?.versionId,
          newVersion: updatedPatient.meta?.versionId,
          changeCount: changedFields.length
        },
        processingLatency: Date.now() - startTime
      })

      return updatedPatient
      
    } catch (error) {
      await this.auditService.logFHIR({
        principalId: practitionerId,
        action: 'fhir.patient.update',
        resourceType: 'Patient',
        resourceId: patientId,
        status: 'failure',
        sessionContext,
        details: {
          error: error.message,
          attemptedChanges: Object.keys(updates)
        },
        processingLatency: Date.now() - startTime
      })
      
      throw error
    }
  }

  private calculateChangedFields(current: Patient, updated: Patient): string[] {
    const changes: string[] = []
    
    // Compare key fields
    if (current.name !== updated.name) changes.push('name')
    if (current.birthDate !== updated.birthDate) changes.push('birthDate')
    if (current.gender !== updated.gender) changes.push('gender')
    if (JSON.stringify(current.address) !== JSON.stringify(updated.address)) {
      changes.push('address')
    }
    if (JSON.stringify(current.telecom) !== JSON.stringify(updated.telecom)) {
      changes.push('telecom')
    }
    
    return changes
  }
}
```

### Multi-Resource Patient View

```typescript
class ComprehensivePatientView {
  constructor(private auditService: Audit, private fhirService: FHIRService) {}

  async getPatientSummary(patientId: string, practitionerId: string, sessionContext: SessionContext) {
    const correlationId = `patient-summary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()
    
    try {
      // Audit the start of comprehensive access
      await this.auditService.logFHIR({
        principalId: practitionerId,
        action: 'fhir.patient.comprehensive_view.start',
        resourceType: 'Patient',
        resourceId: patientId,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          accessReason: 'Comprehensive clinical review'
        }
      })

      // Gather all patient-related resources
      const [patient, conditions, medications, observations, encounters] = await Promise.all([
        this.getPatientWithAudit(patientId, practitionerId, correlationId, sessionContext),
        this.getConditionsWithAudit(patientId, practitionerId, correlationId, sessionContext),
        this.getMedicationsWithAudit(patientId, practitionerId, correlationId, sessionContext),
        this.getObservationsWithAudit(patientId, practitionerId, correlationId, sessionContext),
        this.getEncountersWithAudit(patientId, practitionerId, correlationId, sessionContext)
      ])

      // Audit completion of comprehensive access
      await this.auditService.logFHIR({
        principalId: practitionerId,
        action: 'fhir.patient.comprehensive_view.complete',
        resourceType: 'Patient',
        resourceId: patientId,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          accessSummary: 'Full patient record accessed'
        },
        details: {
          resourcesAccessed: {
            conditions: conditions.length,
            medications: medications.length,
            observations: observations.length,
            encounters: encounters.length
          },
          totalResources: conditions.length + medications.length + observations.length + encounters.length + 1
        },
        processingLatency: Date.now() - startTime
      })

      return {
        patient,
        conditions,
        medications,
        observations,
        encounters
      }
      
    } catch (error) {
      await this.auditService.logFHIR({
        principalId: practitionerId,
        action: 'fhir.patient.comprehensive_view.error',
        resourceType: 'Patient',
        resourceId: patientId,
        status: 'failure',
        sessionContext,
        correlationId,
        details: {
          error: error.message,
          stage: 'data_gathering'
        },
        processingLatency: Date.now() - startTime
      })
      
      throw error
    }
  }

  private async getPatientWithAudit(
    patientId: string, 
    practitionerId: string, 
    correlationId: string,
    sessionContext: SessionContext
  ) {
    const patient = await this.fhirService.getPatient(patientId)
    
    await this.auditService.logFHIR({
      principalId: practitionerId,
      action: 'fhir.patient.read',
      resourceType: 'Patient',
      resourceId: patientId,
      status: 'success',
      sessionContext,
      correlationId,
      complianceContext: {
        regulation: 'HIPAA',
        dataClassification: 'PHI',
        accessContext: 'Part of comprehensive view'
      }
    })
    
    return patient
  }

  private async getConditionsWithAudit(
    patientId: string, 
    practitionerId: string, 
    correlationId: string,
    sessionContext: SessionContext
  ) {
    const conditions = await this.fhirService.getConditions(patientId)
    
    await this.auditService.logFHIR({
      principalId: practitionerId,
      action: 'fhir.condition.search',
      resourceType: 'Condition',
      resourceId: patientId,
      status: 'success',
      sessionContext,
      correlationId,
      complianceContext: {
        regulation: 'HIPAA',
        dataClassification: 'PHI',
        accessContext: 'Medical history review'
      },
      details: {
        conditionCount: conditions.length,
        activeConditions: conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active').length
      }
    })
    
    return conditions
  }

  // Similar methods for medications, observations, encounters...
}
```

## 🏥 Clinical Document Management

### Clinical Note Creation and Updates

```typescript
class ClinicalDocumentService {
  constructor(private auditService: Audit, private fhirService: FHIRService) {}

  async createClinicalNote(
    note: DocumentReference,
    authorId: string,
    patientId: string,
    sessionContext: SessionContext
  ) {
    const startTime = Date.now()
    const correlationId = `clinical-note-${Date.now()}`
    
    try {
      // Validate note content and structure
      await this.validateClinicalNote(note)
      
      // Create the document
      const createdNote = await this.fhirService.createDocumentReference(note)
      
      // Audit the creation
      await this.auditService.logFHIR({
        principalId: authorId,
        action: 'fhir.documentreference.create',
        resourceType: 'DocumentReference',
        resourceId: createdNote.id!,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          documentType: note.type?.coding?.[0]?.display || 'Clinical Note',
          retentionPeriod: '6-years'
        },
        details: {
          patientId,
          documentSize: JSON.stringify(note).length,
          hasAttachments: (note.content?.length || 0) > 0,
          documentStatus: note.status,
          securityLabels: note.securityLabel?.map(label => label.code) || []
        },
        processingLatency: Date.now() - startTime
      })

      return createdNote
      
    } catch (error) {
      await this.auditService.logFHIR({
        principalId: authorId,
        action: 'fhir.documentreference.create',
        resourceType: 'DocumentReference',
        resourceId: 'unknown',
        status: 'failure',
        sessionContext,
        correlationId,
        details: {
          error: error.message,
          patientId,
          validationErrors: error.validationErrors || []
        },
        processingLatency: Date.now() - startTime
      })
      
      throw error
    }
  }

  async updateClinicalNote(
    noteId: string,
    updates: Partial<DocumentReference>,
    editorId: string,
    sessionContext: SessionContext
  ) {
    const startTime = Date.now()
    const correlationId = `note-update-${Date.now()}`
    
    try {
      // Get current version for change tracking
      const currentNote = await this.fhirService.getDocumentReference(noteId)
      
      // Check if user has edit permissions
      await this.validateEditPermissions(editorId, currentNote)
      
      // Apply updates
      const updatedNote = await this.fhirService.updateDocumentReference(noteId, updates)
      
      // Calculate changes
      const changes = this.calculateDocumentChanges(currentNote, updatedNote)
      
      // Audit the update
      await this.auditService.logFHIR({
        principalId: editorId,
        action: 'fhir.documentreference.update',
        resourceType: 'DocumentReference',
        resourceId: noteId,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          changeReason: 'Clinical documentation update',
          originalAuthor: currentNote.author?.[0]?.reference,
          editingAuthor: editorId
        },
        details: {
          previousVersion: currentNote.meta?.versionId,
          newVersion: updatedNote.meta?.versionId,
          changedSections: changes.sections,
          addedContent: changes.added,
          removedContent: changes.removed,
          contentLengthChange: changes.lengthDelta
        },
        processingLatency: Date.now() - startTime
      })

      return updatedNote
      
    } catch (error) {
      await this.auditService.logFHIR({
        principalId: editorId,
        action: 'fhir.documentreference.update',
        resourceType: 'DocumentReference',
        resourceId: noteId,
        status: 'failure',
        sessionContext,
        correlationId,
        details: {
          error: error.message,
          failureReason: error.code || 'unknown'
        },
        processingLatency: Date.now() - startTime
      })
      
      throw error
    }
  }

  private calculateDocumentChanges(current: DocumentReference, updated: DocumentReference) {
    const changes = {
      sections: [] as string[],
      added: 0,
      removed: 0,
      lengthDelta: 0
    }

    // Compare content sections
    if (current.content !== updated.content) {
      changes.sections.push('content')
    }
    
    if (current.description !== updated.description) {
      changes.sections.push('description')
    }
    
    if (current.status !== updated.status) {
      changes.sections.push('status')
    }

    // Calculate content changes
    const currentContent = JSON.stringify(current.content || [])
    const updatedContent = JSON.stringify(updated.content || [])
    
    changes.lengthDelta = updatedContent.length - currentContent.length
    
    if (changes.lengthDelta > 0) {
      changes.added = changes.lengthDelta
    } else {
      changes.removed = Math.abs(changes.lengthDelta)
    }

    return changes
  }
}
```

## 💊 Medication Order Management

### Prescription Creation and Management

```typescript
class MedicationOrderService {
  constructor(private auditService: Audit, private fhirService: FHIRService) {}

  async createMedicationOrder(
    order: MedicationRequest,
    prescriberId: string,
    patientId: string,
    sessionContext: SessionContext
  ) {
    const startTime = Date.now()
    const correlationId = `medication-order-${Date.now()}`
    
    try {
      // Validate prescription against drug interactions and allergies
      const validationResult = await this.validatePrescription(order, patientId)
      
      if (!validationResult.isValid) {
        await this.auditService.logFHIR({
          principalId: prescriberId,
          action: 'fhir.medicationrequest.create',
          resourceType: 'MedicationRequest',
          resourceId: 'validation-failed',
          status: 'failure',
          sessionContext,
          correlationId,
          complianceContext: {
            regulation: 'FDA',
            dataClassification: 'PHI',
            prescriptionSafety: 'Failed validation'
          },
          details: {
            patientId,
            medicationCode: order.medicationCodeableConcept?.coding?.[0]?.code,
            validationErrors: validationResult.errors,
            interactionWarnings: validationResult.interactions
          },
          processingLatency: Date.now() - startTime
        })
        
        throw new Error(`Prescription validation failed: ${validationResult.errors.join(', ')}`)
      }

      // Create the medication order
      const createdOrder = await this.fhirService.createMedicationRequest(order)
      
      // Log successful prescription creation
      await this.auditService.logFHIR({
        principalId: prescriberId,
        action: 'fhir.medicationrequest.create',
        resourceType: 'MedicationRequest',
        resourceId: createdOrder.id!,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'FDA',
          dataClassification: 'PHI',
          prescriptionType: 'Electronic',
          controlledSubstance: await this.isControlledSubstance(order)
        },
        details: {
          patientId,
          medicationCode: order.medicationCodeableConcept?.coding?.[0]?.code,
          medicationName: order.medicationCodeableConcept?.coding?.[0]?.display,
          dosageForm: order.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit,
          quantity: order.dispenseRequest?.quantity?.value,
          refills: order.dispenseRequest?.numberOfRepeatsAllowed || 0,
          daysSupply: order.dispenseRequest?.expectedSupplyDuration?.value,
          priority: order.priority,
          validationWarnings: validationResult.warnings
        },
        processingLatency: Date.now() - startTime
      })

      // If controlled substance, create additional audit entry
      if (await this.isControlledSubstance(order)) {
        await this.auditService.logCritical({
          principalId: prescriberId,
          action: 'controlled.substance.prescribed',
          targetResourceId: createdOrder.id!,
          status: 'success',
          sessionContext,
          correlationId,
          complianceContext: {
            regulation: 'DEA',
            dataClassification: 'Controlled Substance',
            scheduleClass: await this.getControlledSubstanceSchedule(order)
          },
          details: {
            patientId,
            deaNumber: await this.getPrescriberDEANumber(prescriberId),
            medicationName: order.medicationCodeableConcept?.coding?.[0]?.display,
            quantity: order.dispenseRequest?.quantity?.value,
            prescriptionNumber: createdOrder.identifier?.[0]?.value
          }
        }, {
          priority: 1,
          compliance: ['dea', 'controlled-substances']
        })
      }

      return createdOrder
      
    } catch (error) {
      await this.auditService.logFHIR({
        principalId: prescriberId,
        action: 'fhir.medicationrequest.create',
        resourceType: 'MedicationRequest',
        resourceId: 'error',
        status: 'failure',
        sessionContext,
        correlationId,
        details: {
          error: error.message,
          patientId,
          medicationAttempted: order.medicationCodeableConcept?.coding?.[0]?.display
        },
        processingLatency: Date.now() - startTime
      })
      
      throw error
    }
  }

  async dispenseMediation(
    medicationRequestId: string,
    dispensationDetails: MedicationDispense,
    pharmacistId: string,
    sessionContext: SessionContext
  ) {
    const startTime = Date.now()
    const correlationId = `medication-dispense-${Date.now()}`
    
    try {
      // Get original prescription
      const originalRequest = await this.fhirService.getMedicationRequest(medicationRequestId)
      
      // Validate dispensation against original prescription
      await this.validateDispensation(originalRequest, dispensationDetails)
      
      // Record the dispensation
      const dispenseRecord = await this.fhirService.createMedicationDispense(dispensationDetails)
      
      // Audit the dispensation
      await this.auditService.logFHIR({
        principalId: pharmacistId,
        action: 'fhir.medicationdispense.create',
        resourceType: 'MedicationDispense',
        resourceId: dispenseRecord.id!,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'FDA',
          dataClassification: 'PHI',
          dispensationType: 'Retail Pharmacy',
          originalPrescriptionId: medicationRequestId
        },
        details: {
          patientId: dispensationDetails.subject?.reference,
          medicationCode: dispensationDetails.medicationCodeableConcept?.coding?.[0]?.code,
          quantityDispensed: dispensationDetails.quantity?.value,
          daysSupplied: dispensationDetails.daysSupply?.value,
          substitutionMade: dispensationDetails.substitution?.wasSubstituted || false,
          substitutionReason: dispensationDetails.substitution?.reason?.[0]?.coding?.[0]?.display,
          pharmacyLocation: sessionContext.location
        },
        processingLatency: Date.now() - startTime
      })

      return dispenseRecord
      
    } catch (error) {
      await this.auditService.logFHIR({
        principalId: pharmacistId,
        action: 'fhir.medicationdispense.create',
        resourceType: 'MedicationDispense',
        resourceId: 'error',
        status: 'failure',
        sessionContext,
        correlationId,
        details: {
          error: error.message,
          originalPrescriptionId: medicationRequestId,
          dispensationAttempted: true
        },
        processingLatency: Date.now() - startTime
      })
      
      throw error
    }
  }

  private async isControlledSubstance(order: MedicationRequest): Promise<boolean> {
    // Implementation to check if medication is controlled substance
    const medicationCode = order.medicationCodeableConcept?.coding?.[0]?.code
    return await this.controlledSubstanceRegistry.isControlled(medicationCode)
  }

  private async getControlledSubstanceSchedule(order: MedicationRequest): Promise<string> {
    // Implementation to get DEA schedule class
    const medicationCode = order.medicationCodeableConcept?.coding?.[0]?.code
    return await this.controlledSubstanceRegistry.getSchedule(medicationCode)
  }
}
```

## 🧪 Diagnostic Report Processing

### Laboratory Results Management

```typescript
class DiagnosticReportService {
  constructor(private auditService: Audit, private fhirService: FHIRService) {}

  async createDiagnosticReport(
    report: DiagnosticReport,
    authoringTechnician: string,
    reviewingPhysician: string,
    sessionContext: SessionContext
  ) {
    const startTime = Date.now()
    const correlationId = `diagnostic-report-${Date.now()}`
    
    try {
      // Validate report data and critical values
      const validationResult = await this.validateDiagnosticReport(report)
      
      // Create the diagnostic report
      const createdReport = await this.fhirService.createDiagnosticReport(report)
      
      // Check for critical results that require immediate notification
      const criticalResults = await this.identifyCriticalResults(report)
      
      // Audit the report creation
      await this.auditService.logFHIR({
        principalId: authoringTechnician,
        action: 'fhir.diagnosticreport.create',
        resourceType: 'DiagnosticReport',
        resourceId: createdReport.id!,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          reportType: report.category?.[0]?.coding?.[0]?.display || 'Laboratory',
          clinicalSignificance: criticalResults.length > 0 ? 'Critical' : 'Routine'
        },
        details: {
          patientId: report.subject?.reference,
          orderingPhysician: report.requester?.reference,
          testCodes: report.code?.coding?.map(c => c.code) || [],
          testNames: report.code?.coding?.map(c => c.display) || [],
          resultCount: report.result?.length || 0,
          criticalResultCount: criticalResults.length,
          reportStatus: report.status,
          specimenCollectionDate: report.effectiveDateTime,
          labLocation: sessionContext.location
        },
        processingLatency: Date.now() - startTime
      })

      // If there are critical results, create high-priority audit entries
      if (criticalResults.length > 0) {
        await this.auditService.logCritical({
          principalId: authoringTechnician,
          action: 'critical.result.detected',
          targetResourceId: createdReport.id!,
          status: 'success',
          sessionContext,
          correlationId,
          complianceContext: {
            regulation: 'Clinical Laboratory Improvement Amendments',
            dataClassification: 'Critical Value',
            notificationRequired: true
          },
          details: {
            patientId: report.subject?.reference,
            criticalResults,
            reviewingPhysician,
            automaticNotificationSent: true
          }
        }, {
          priority: 1,
          notify: ['ordering-physician', 'patient-care-team'],
          escalate: true
        })
      }

      return createdReport
      
    } catch (error) {
      await this.auditService.logFHIR({
        principalId: authoringTechnician,
        action: 'fhir.diagnosticreport.create',
        resourceType: 'DiagnosticReport',
        resourceId: 'error',
        status: 'failure',
        sessionContext,
        correlationId,
        details: {
          error: error.message,
          patientId: report.subject?.reference,
          testCodes: report.code?.coding?.map(c => c.code) || []
        },
        processingLatency: Date.now() - startTime
      })
      
      throw error
    }
  }

  async reviewAndSignReport(
    reportId: string,
    reviewingPhysician: string,
    reviewNotes: string,
    sessionContext: SessionContext
  ) {
    const startTime = Date.now()
    const correlationId = `report-review-${Date.now()}`
    
    try {
      // Get current report
      const report = await this.fhirService.getDiagnosticReport(reportId)
      
      if (report.status !== 'preliminary') {
        throw new Error('Only preliminary reports can be reviewed and signed')
      }

      // Update report to final status
      const updatedReport = await this.fhirService.updateDiagnosticReport(reportId, {
        status: 'final',
        conclusion: reviewNotes,
        conclusionCode: [
          {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '182836005',
                display: 'Review of diagnostic study'
              }
            ]
          }
        ]
      })

      // Audit the physician review and signature
      await this.auditService.logFHIR({
        principalId: reviewingPhysician,
        action: 'fhir.diagnosticreport.sign',
        resourceType: 'DiagnosticReport',
        resourceId: reportId,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          digitalSignature: true,
          legallyBinding: true
        },
        details: {
          patientId: report.subject?.reference,
          previousStatus: report.status,
          newStatus: 'final',
          reviewNotes: reviewNotes.length > 0,
          reviewDuration: Date.now() - new Date(report.meta?.lastUpdated || 0).getTime(),
          originalTechnician: report.performer?.[0]?.reference
        },
        processingLatency: Date.now() - startTime
      })

      return updatedReport
      
      await this.auditService.logFHIR({
        principalId: reviewingPhysician,
        action: 'fhir.diagnosticreport.sign',
        resourceType: 'DiagnosticReport',
        resourceId: reportId,
        status: 'failure',
        sessionContext,
        correlationId,
        details: {
          error: error.message,
          reportStatus: report.status
        },
        processingLatency: Date.now() - startTime
      })
      
      throw error
    }
  }

  private async identifyCriticalResults(report: DiagnosticReport): Promise<any[]> {
    // Implementation to identify critical lab values
    const criticalResults = []
    
    for (const result of report.result || []) {
      const observation = await this.fhirService.getObservation(result.reference!)
      
      if (this.isCriticalValue(observation)) {
        criticalResults.push({
          code: observation.code?.coding?.[0]?.code,
          value: observation.valueQuantity?.value,
          unit: observation.valueQuantity?.unit,
          referenceRange: observation.referenceRange?.[0]
        })
      }
    }
    
    return criticalResults
  }
}
```

## 📅 Appointment Scheduling

### Appointment Management with Audit Trails

```typescript
class AppointmentService {
  constructor(private auditService: Audit, private fhirService: FHIRService) {}

  async scheduleAppointment(
    appointment: Appointment,
    schedulerId: string,
    sessionContext: SessionContext
  ) {
    const startTime = Date.now()
    const correlationId = `appointment-${Date.now()}`
    
    try {
      // Validate appointment slot availability
      await this.validateAppointmentSlot(appointment)
      
      // Create appointment
      const createdAppointment = await this.fhirService.createAppointment(appointment)
      
      // Audit appointment creation
      await this.auditService.logFHIR({
        principalId: schedulerId,
        action: 'fhir.appointment.create',
        resourceType: 'Appointment',
        resourceId: createdAppointment.id!,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          schedulingRules: 'Validated'
        },
        details: {
          patientId: appointment.participant?.find(p => p.actor?.reference?.includes('Patient'))?.actor?.reference,
          practitionerId: appointment.participant?.find(p => p.actor?.reference?.includes('Practitioner'))?.actor?.reference,
          appointmentType: appointment.appointmentType?.coding?.[0]?.display,
          scheduledStart: appointment.start,
          scheduledEnd: appointment.end,
          duration: appointment.minutesDuration,
          location: appointment.participant?.find(p => p.actor?.reference?.includes('Location'))?.actor?.reference
        },
        processingLatency: Date.now() - startTime
      })

      return createdAppointment
    } catch (error) {
      await this.auditService.logFHIR({
        principalId: schedulerId,
        action: 'fhir.appointment.create',
        resourceType: 'Appointment',
        resourceId: 'error',
        status: 'failure',
        sessionContext,
        correlationId,
        details: {
          error: error.message,
          appointmentTime: appointment.start
        },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }
}
```

## 📦 Bundle Operations

### Transaction Bundle Processing

```typescript
class BundleService {
  async processTransactionBundle(
    bundle: Bundle,
    userId: string,
    sessionContext: SessionContext
  ) {
    const correlationId = `bundle-${Date.now()}`
    const startTime = Date.now()
    
    try {
      // Audit bundle start
      await this.auditService.logFHIR({
        principalId: userId,
        action: 'fhir.bundle.transaction.start',
        resourceType: 'Bundle',
        resourceId: bundle.id || correlationId,
        status: 'success',
        sessionContext,
        correlationId,
        details: {
          resourceCount: bundle.entry?.length || 0,
          transactionType: bundle.type
        }
      })

      // Process bundle
      const result = await this.fhirService.processBundle(bundle)
      
      // Audit successful completion
      await this.auditService.logFHIR({
        principalId: userId,
        action: 'fhir.bundle.transaction.complete',
        resourceType: 'Bundle',
        resourceId: result.id!,
        status: 'success',
        sessionContext,
        correlationId,
        details: {
          processedResources: result.entry?.length || 0,
          successfulOperations: result.entry?.filter(e => e.response?.status?.startsWith('2')).length || 0
        },
        processingLatency: Date.now() - startTime
      })

      return result
    } catch (error) {
      await this.auditService.logFHIR({
        principalId: userId,
        action: 'fhir.bundle.transaction.error',
        resourceType: 'Bundle',
        resourceId: bundle.id || correlationId,
        status: 'failure',
        sessionContext,
        correlationId,
        details: {
          error: error.message,
          failedAtResource: error.resourceIndex
        },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }
}
```

## 🔒 Patient Compartment Security

### Compartment-Based Access Control

```typescript
class PatientCompartmentSecurity {
  async enforceCompartmentAccess(
    patientId: string,
    requestedResource: string,
    userId: string,
    sessionContext: SessionContext
  ) {
    const startTime = Date.now()
    
    try {
      // Check compartment permissions
      const hasAccess = await this.checkCompartmentAccess(userId, patientId, requestedResource)
      
      if (!hasAccess) {
        await this.auditService.logFHIR({
          principalId: userId,
          action: 'fhir.compartment.access_denied',
          resourceType: requestedResource,
          resourceId: patientId,
          status: 'failure',
          sessionContext,
          complianceContext: {
            regulation: 'HIPAA',
            dataClassification: 'PHI',
            accessControl: 'Patient Compartment'
          },
          details: {
            compartmentType: 'Patient',
            requestedResource,
            denialReason: 'Insufficient compartment access'
          },
          processingLatency: Date.now() - startTime
        })
        
        throw new Error('Access denied to patient compartment')
      }
      
      // Log successful compartment access
      await this.auditService.logFHIR({
        principalId: userId,
        action: 'fhir.compartment.access_granted',
        resourceType: requestedResource,
        resourceId: patientId,
        status: 'success',
        sessionContext,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          accessControl: 'Patient Compartment'
        },
        details: {
          compartmentType: 'Patient',
          requestedResource,
          accessLevel: await this.getAccessLevel(userId, patientId)
        },
        processingLatency: Date.now() - startTime
      })
      
    } catch (error) {
      throw error
    }
  }
}
```

## 📋 Compliance Patterns

### HIPAA Minimum Necessary Implementation

```typescript
class HIPAAComplianceService {
  async logMinimumNecessaryAccess(
    userId: string,
    patientId: string,
    accessedFields: string[],
    purposeOfUse: string,
    sessionContext: SessionContext
  ) {
    await this.auditService.logFHIR({
      principalId: userId,
      action: 'hipaa.minimum_necessary.access',
      resourceType: 'Patient',
      resourceId: patientId,
      status: 'success',
      sessionContext,
      complianceContext: {
        regulation: 'HIPAA',
        dataClassification: 'PHI',
        minimumNecessary: true,
        purposeOfUse
      },
      details: {
        accessedFields,
        justification: `Access limited to fields necessary for ${purposeOfUse}`,
        fieldsAccessedCount: accessedFields.length,
        totalAvailableFields: await this.getTotalPatientFields(patientId)
      }
    })
  }
}
```

## ⚡ Performance Optimization

### Batch Audit Logging for High-Volume FHIR Operations

```typescript
class HighPerformanceFHIRAudit {
  private auditQueue: AuditEvent[] = []
  private readonly BATCH_SIZE = 100
  private readonly FLUSH_INTERVAL = 5000 // 5 seconds

  constructor(private auditService: Audit) {
    // Auto-flush batch periodically
    setInterval(() => this.flushBatch(), this.FLUSH_INTERVAL)
  }

  async queueFHIRAudit(event: AuditEvent) {
    this.auditQueue.push(event)
    
    if (this.auditQueue.length >= this.BATCH_SIZE) {
      await this.flushBatch()
    }
  }

  private async flushBatch() {
    if (this.auditQueue.length === 0) return
    
    const batch = this.auditQueue.splice(0, this.BATCH_SIZE)
    
    try {
      await this.auditService.logBatch(batch)
    } catch (error) {
      // Re-queue failed events
      this.auditQueue.unshift(...batch)
      throw error
    }
  }
}
```

## 🧪 Testing Strategies

### FHIR Audit Testing Examples

```typescript
describe('FHIR Workflow Auditing', () => {
  it('should audit patient record access', async () => {
    const mockAuditService = createMockAuditService()
    const patientService = new PatientChartService(mockAuditService, mockFHIRService)
    
    await patientService.getPatientChart('patient-123', 'practitioner-456', mockSessionContext)
    
    expect(mockAuditService.logFHIR).toHaveBeenCalledWith(
      expect.objectContaining({
        principalId: 'practitioner-456',
        action: 'fhir.patient.read',
        resourceType: 'Patient',
        resourceId: 'patient-123',
        status: 'success'
      })
    )
  })

  it('should audit medication prescription with controlled substance tracking', async () => {
    const mockAuditService = createMockAuditService()
    const medicationService = new MedicationOrderService(mockAuditService, mockFHIRService)
    
    const controlledSubstanceOrder = createMockControlledSubstanceOrder()
    
    await medicationService.createMedicationOrder(
      controlledSubstanceOrder,
      'prescriber-789',
      'patient-123',
      mockSessionContext
    )
    
    expect(mockAuditService.logFHIR).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'fhir.medicationrequest.create'
      })
    )
    
    expect(mockAuditService.logCritical).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'controlled.substance.prescribed'
      }),
      expect.objectContaining({
        priority: 1,
        compliance: ['dea', 'controlled-substances']
      })
    )
  })
})
```

This comprehensive FHIR workflows documentation provides healthcare developers with practical, compliance-focused examples for implementing audit logging across the full spectrum of FHIR operations, from basic patient access to complex clinical workflows and regulatory compliance patterns.