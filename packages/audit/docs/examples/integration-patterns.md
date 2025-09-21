# Integration Patterns

This document provides examples of integrating the `@repo/audit` package with various healthcare systems and enterprise platforms. These examples demonstrate audit logging patterns for EMR systems, laboratory information systems, pharmacy management systems, and third-party API integrations.

## 📚 Table of Contents

- [EMR System Integration](#emr-system-integration)
- [Laboratory Information Systems](#laboratory-information-systems)
- [Pharmacy Management Systems](#pharmacy-management-systems)
- [Health Information Exchange](#health-information-exchange)
- [Message Broker Integration](#message-broker-integration)
- [Webhook Integration](#webhook-integration)
- [Microservices Architecture](#microservices-architecture)
- [Testing Strategies](#testing-strategies)

## 🏥 EMR System Integration

### Epic EMR Integration

```typescript
import { Audit, AuditConfig } from '@repo/audit'

class EpicEMRIntegration {
  constructor(private auditService: Audit, private epicClient: EpicClient) {}

  async integratePatientAccess(epicPatientId: string, userId: string, sessionContext: SessionContext) {
    const correlationId = `epic-integration-${Date.now()}`
    const startTime = Date.now()
    
    try {
      // Retrieve patient data from Epic
      const epicPatient = await this.epicClient.getPatient(epicPatientId)
      
      // Audit Epic system access
      await this.auditService.log({
        principalId: userId,
        action: 'integration.epic.patient_access',
        resourceType: 'Patient',
        resourceId: epicPatientId,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          systemIntegration: 'Epic EMR',
          crossSystemAccess: true
        },
        details: {
          epicPatientId,
          epicVersion: epicPatient.version,
          integrationMethod: 'REST API',
          dataMapping: 'Epic to FHIR R4',
          accessLevel: await this.getEpicAccessLevel(userId),
          departmentCode: epicPatient.departmentCode
        },
        processingLatency: Date.now() - startTime
      })

      // Convert and store FHIR data
      const fhirPatient = await this.convertEpicToFHIR(epicPatient)
      
      await this.auditService.logFHIR({
        principalId: userId,
        action: 'fhir.patient.sync_from_epic',
        resourceType: 'Patient',
        resourceId: fhirPatient.id!,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          dataSync: 'Epic to local FHIR'
        },
        details: {
          sourceSystem: 'Epic EMR',
          epicPatientId,
          syncTimestamp: new Date(),
          dataQualityScore: await this.calculateDataQuality(fhirPatient)
        }
      })

      return { epicPatient, fhirPatient, correlationId }
    } catch (error) {
      await this.auditService.log({
        principalId: userId,
        action: 'integration.epic.patient_access_failed',
        resourceType: 'Patient',
        resourceId: epicPatientId,
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message, epicEndpoint: this.epicClient.getEndpoint() },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }
}
```

## 🧪 Laboratory Information Systems

### HL7 LIS Integration

```typescript
class HL7LISIntegration {
  constructor(private auditService: Audit, private hl7Processor: HL7Processor) {}

  async processLabResultMessage(hl7Message: string, sessionContext: SessionContext) {
    const correlationId = `hl7-lab-result-${Date.now()}`
    const startTime = Date.now()
    
    try {
      const parsedMessage = await this.hl7Processor.parse(hl7Message)
      const observations = parsedMessage.OBX || []
      
      await this.auditService.log({
        principalId: parsedMessage.MSH?.sendingApplication || 'lis-system',
        action: 'integration.hl7.lab_result_received',
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'CLIA',
          dataClassification: 'PHI',
          messageStandard: 'HL7 v2.x',
          resultType: 'Laboratory Results'
        },
        details: {
          messageControlId: parsedMessage.MSH?.messageControlId,
          patientId: parsedMessage.PID?.patientId,
          orderNumber: parsedMessage.OBR?.orderNumber,
          observationCount: observations.length,
          resultStatus: parsedMessage.OBR?.resultStatus
        }
      })

      // Process observations and check for critical results
      const processedResults = []
      const criticalResults = []
      
      for (const observation of observations) {
        const fhirObservation = await this.convertOBXToFHIR(observation, parsedMessage)
        const isCritical = await this.isResultCritical(observation)
        
        if (isCritical) {
          criticalResults.push(fhirObservation)
          
          await this.auditService.logCritical({
            principalId: 'lis-system',
            action: 'lab.critical_result.detected',
            resourceType: 'Observation',
            resourceId: fhirObservation.id!,
            status: 'success',
            sessionContext,
            correlationId,
            complianceContext: {
              regulation: 'CLIA',
              dataClassification: 'Critical Value',
              notificationRequired: true
            },
            details: {
              observationCode: observation.observationId,
              criticalValue: observation.observationValue,
              referenceRange: observation.referenceRange,
              orderingPhysician: parsedMessage.OBR?.orderingProvider
            }
          }, { priority: 1, notify: ['ordering-physician'], escalate: true })
        }
        
        processedResults.push(fhirObservation)
      }

      await this.auditService.log({
        principalId: 'lis-system',
        action: 'integration.hl7.lab_result_processed',
        status: 'success',
        sessionContext,
        correlationId,
        details: {
          totalObservations: observations.length,
          processedObservations: processedResults.length,
          criticalResults: criticalResults.length,
          processingTime: Date.now() - startTime
        }
      })

      return { processedResults, criticalResults, correlationId }
    } catch (error) {
      await this.auditService.log({
        principalId: 'lis-system',
        action: 'integration.hl7.lab_result_processing_failed',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }
}
```

## 💊 Pharmacy Management Systems

### Pharmacy Information System Integration

```typescript
class PharmacySystemIntegration {
  constructor(private auditService: Audit, private pharmacyClient: PharmacyClient) {}

  async processPrescriptionFulfillment(prescriptionId: string, pharmacistId: string, sessionContext: SessionContext) {
    const correlationId = `pharmacy-fulfillment-${Date.now()}`
    const startTime = Date.now()
    
    try {
      const prescription = await this.pharmacyClient.getPrescription(prescriptionId)
      
      await this.auditService.log({
        principalId: pharmacistId,
        action: 'integration.pharmacy.prescription_accessed',
        resourceType: 'MedicationRequest',
        resourceId: prescriptionId,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'DEA',
          dataClassification: 'PHI',
          systemIntegration: 'Pharmacy Management System',
          prescriptionType: prescription.isControlledSubstance ? 'Controlled' : 'Standard'
        },
        details: {
          prescriptionId,
          patientId: prescription.patientId,
          medicationName: prescription.medicationName,
          quantity: prescription.quantity,
          isControlledSubstance: prescription.isControlledSubstance,
          deaSchedule: prescription.deaSchedule
        },
        processingLatency: Date.now() - startTime
      })

      // Process fulfillment
      const fulfillment = await this.pharmacyClient.fulfillPrescription(prescriptionId, pharmacistId)
      
      await this.auditService.log({
        principalId: pharmacistId,
        action: 'integration.pharmacy.prescription_fulfilled',
        resourceType: 'MedicationDispense',
        resourceId: fulfillment.dispenseId,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'DEA',
          dataClassification: 'PHI',
          medicationDispensed: true,
          controlledSubstanceTracking: prescription.isControlledSubstance
        },
        details: {
          prescriptionId,
          dispenseId: fulfillment.dispenseId,
          quantityDispensed: fulfillment.quantityDispensed,
          substitutionMade: fulfillment.substitutionMade
        }
      })

      // Handle controlled substance tracking
      if (prescription.isControlledSubstance) {
        await this.auditService.logCritical({
          principalId: pharmacistId,
          action: 'controlled.substance.dispensed',
          targetResourceId: fulfillment.dispenseId,
          status: 'success',
          sessionContext,
          correlationId,
          complianceContext: {
            regulation: 'DEA',
            dataClassification: 'Controlled Substance',
            deaReporting: true,
            scheduleClass: prescription.deaSchedule
          },
          details: {
            prescriptionId,
            medicationName: prescription.medicationName,
            quantityDispensed: fulfillment.quantityDispensed,
            deaSchedule: prescription.deaSchedule,
            pharmacyDEA: fulfillment.pharmacyDEA
          }
        }, { priority: 1, compliance: ['dea'], notify: ['dea-compliance-officer'] })
      }

      return { prescription, fulfillment, correlationId }
    } catch (error) {
      await this.auditService.log({
        principalId: pharmacistId,
        action: 'integration.pharmacy.prescription_fulfillment_failed',
        resourceType: 'MedicationRequest',
        resourceId: prescriptionId,
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }
}
```

## 🔗 Health Information Exchange

### HIE Integration Pattern

```typescript
class HIEIntegration {
  constructor(private auditService: Audit, private hieClient: HIEClient) {}

  async queryPatientData(patientId: string, queryingOrganization: string, sessionContext: SessionContext) {
    const correlationId = `hie-query-${Date.now()}`
    const startTime = Date.now()
    
    try {
      await this.auditService.log({
        principalId: queryingOrganization,
        action: 'integration.hie.patient_query_initiated',
        resourceType: 'Patient',
        resourceId: patientId,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          systemIntegration: 'Health Information Exchange',
          crossOrganizationAccess: true
        },
        details: {
          patientId,
          queryingOrganization,
          hieNetwork: this.hieClient.getNetworkId(),
          consentVerified: await this.verifyPatientConsent(patientId, queryingOrganization)
        }
      })

      const hieResponse = await this.hieClient.queryPatient(patientId, {
        queryingOrganization,
        dataTypes: ['Patient', 'Encounter', 'Observation', 'MedicationRequest'],
        purpose: 'treatment'
      })

      await this.auditService.log({
        principalId: queryingOrganization,
        action: 'integration.hie.patient_query_completed',
        resourceType: 'Patient',
        resourceId: patientId,
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          systemIntegration: 'Health Information Exchange',
          dataAggregation: 'Multi-organization'
        },
        details: {
          patientId,
          participatingOrganizations: hieResponse.participatingOrganizations.length,
          totalRecordsRetrieved: hieResponse.totalRecords,
          queryResponseTime: Date.now() - startTime,
          hieTransactionId: hieResponse.transactionId
        }
      })

      return { data: hieResponse.data, transactionId: hieResponse.transactionId, correlationId }
    } catch (error) {
      await this.auditService.log({
        principalId: queryingOrganization,
        action: 'integration.hie.patient_query_failed',
        resourceType: 'Patient',
        resourceId: patientId,
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }
}
```

## 📨 Message Broker Integration

### RabbitMQ Healthcare Messaging

```typescript
class RabbitMQIntegration {
  constructor(private auditService: Audit, private rabbitClient: RabbitMQClient) {}

  async publishHealthcareEvent(event: HealthcareEvent, exchange: string, routingKey: string, sessionContext: SessionContext) {
    const correlationId = `rabbitmq-publish-${Date.now()}`
    const startTime = Date.now()
    
    try {
      // Publish message
      await this.rabbitClient.publish(exchange, routingKey, event, {
        correlationId,
        timestamp: Date.now(),
        headers: { 'content-type': 'application/json', 'audit-required': 'true' }
      })
      
      await this.auditService.log({
        principalId: event.principalId || 'system',
        action: 'integration.rabbitmq.message_published',
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: event.dataClassification || 'PHI',
          messageType: 'Healthcare Event'
        },
        details: {
          exchange,
          routingKey,
          eventType: event.eventType,
          messageSize: JSON.stringify(event).length,
          durableMessage: true
        },
        processingLatency: Date.now() - startTime
      })

      return { published: true, correlationId }
    } catch (error) {
      await this.auditService.log({
        principalId: event.principalId || 'system',
        action: 'integration.rabbitmq.message_publish_failed',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message, exchange, routingKey },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }

  async consumeHealthcareEvent(message: any, sessionContext: SessionContext) {
    const correlationId = message.properties.correlationId || `rabbitmq-consume-${Date.now()}`
    const startTime = Date.now()
    
    try {
      const event = JSON.parse(message.content.toString())
      
      await this.auditService.log({
        principalId: event.principalId || 'system',
        action: 'integration.rabbitmq.message_consumed',
        status: 'success',
        sessionContext,
        correlationId,
        details: {
          eventType: event.eventType,
          messageSize: message.content.length,
          processingDelay: Date.now() - (message.properties.timestamp || Date.now())
        },
        processingLatency: Date.now() - startTime
      })

      return { event, correlationId }
    } catch (error) {
      await this.auditService.log({
        principalId: 'system',
        action: 'integration.rabbitmq.message_consume_failed',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }
}
```

## 🔗 Webhook Integration

### Healthcare Webhook Processing

```typescript
class WebhookIntegration {
  constructor(private auditService: Audit) {}

  async processIncomingWebhook(webhookData: any, source: string, sessionContext: SessionContext) {
    const correlationId = `webhook-${Date.now()}`
    const startTime = Date.now()
    
    try {
      // Validate webhook signature
      const isValid = await this.validateWebhookSignature(webhookData, source)
      
      if (!isValid) {
        await this.auditService.log({
          principalId: source,
          action: 'integration.webhook.signature_validation_failed',
          status: 'failure',
          sessionContext,
          correlationId,
          complianceContext: {
            regulation: 'HIPAA',
            dataClassification: 'Security',
            securityIncident: 'Invalid webhook signature'
          },
          details: { source, webhookType: webhookData.type },
          processingLatency: Date.now() - startTime
        })
        throw new Error('Invalid webhook signature')
      }

      await this.auditService.log({
        principalId: source,
        action: 'integration.webhook.received',
        status: 'success',
        sessionContext,
        correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'PHI',
          systemIntegration: 'Webhook'
        },
        details: {
          source,
          webhookType: webhookData.type,
          eventId: webhookData.id,
          payloadSize: JSON.stringify(webhookData).length,
          signatureValid: true
        },
        processingLatency: Date.now() - startTime
      })

      return { processed: true, correlationId }
    } catch (error) {
      await this.auditService.log({
        principalId: source,
        action: 'integration.webhook.processing_failed',
        status: 'failure',
        sessionContext,
        correlationId,
        details: { error: error.message, source },
        processingLatency: Date.now() - startTime
      })
      throw error
    }
  }
}
```

## 🏗️ Microservices Architecture

### Service-to-Service Audit Correlation

```typescript
class MicroserviceAuditConnector {
  constructor(private auditService: Audit) {}

  async auditServiceCall(params: {
    sourceService: string
    targetService: string
    operation: string
    correlationId: string
    sessionContext: SessionContext
  }) {
    const startTime = Date.now()
    
    try {
      await this.auditService.log({
        principalId: params.sourceService,
        action: `service.call.${params.operation}`,
        status: 'success',
        sessionContext: params.sessionContext,
        correlationId: params.correlationId,
        complianceContext: {
          regulation: 'HIPAA',
          dataClassification: 'Service Communication',
          microserviceArchitecture: true
        },
        details: {
          sourceService: params.sourceService,
          targetService: params.targetService,
          operation: params.operation,
          serviceCallType: 'inter-service'
        },
        processingLatency: Date.now() - startTime
      })
    } catch (error) {
      // Handle audit logging errors silently to not impact service operations
      console.error('Service audit logging failed:', error)
    }
  }
}
```

## 🧪 Testing Strategies

### Integration Testing Examples

```typescript
describe('Integration Patterns', () => {
  it('should audit Epic EMR patient access', async () => {
    const mockAuditService = createMockAuditService()
    const epicIntegration = new EpicEMRIntegration(mockAuditService, mockEpicClient)
    
    await epicIntegration.integratePatientAccess('epic-patient-123', 'user-456', mockSessionContext)
    
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'integration.epic.patient_access',
        complianceContext: expect.objectContaining({
          systemIntegration: 'Epic EMR'
        })
      })
    )
  })

  it('should audit HL7 lab result processing', async () => {
    const mockAuditService = createMockAuditService()
    const hl7Integration = new HL7LISIntegration(mockAuditService, mockHL7Processor)
    
    const hl7Message = createMockHL7LabResult()
    await hl7Integration.processLabResultMessage(hl7Message, mockSessionContext)
    
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'integration.hl7.lab_result_received',
        complianceContext: expect.objectContaining({
          regulation: 'CLIA'
        })
      })
    )
  })

  it('should audit controlled substance dispensing', async () => {
    const mockAuditService = createMockAuditService()
    const pharmacyIntegration = new PharmacySystemIntegration(mockAuditService, mockPharmacyClient)
    
    await pharmacyIntegration.processPrescriptionFulfillment('rx-123', 'pharmacist-456', mockSessionContext)
    
    expect(mockAuditService.logCritical).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'controlled.substance.dispensed',
        complianceContext: expect.objectContaining({
          regulation: 'DEA'
        })
      }),
      expect.objectContaining({
        priority: 1,
        compliance: ['dea']
      })
    )
  })
})
```

This comprehensive integration patterns documentation provides healthcare developers with practical examples for implementing audit logging across various healthcare system integrations, ensuring compliance and traceability in complex healthcare IT environments.