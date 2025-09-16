# Examples

This section provides practical, real-world examples of implementing the `@repo/audit` package in healthcare applications. Each example includes complete code implementations, best practices, and compliance considerations.

## 📚 Example Categories

### 🏥 Healthcare Scenarios
- **[Basic Usage](./basic-usage.md)** - Simple audit logging implementations
- **[Healthcare Scenarios](./healthcare-scenarios.md)** - Medical workflow audit patterns
- **[FHIR Workflows](./fhir-workflows.md)** - FHIR resource interaction examples

### 🔧 Integration Patterns
- **[Authentication Flows](./authentication-flows.md)** - Auth system integration examples
- **[Batch Processing](./batch-processing.md)** - High-volume event processing
- **[Integration Patterns](./integration-patterns.md)** - System integration examples

## 🎯 Quick Navigation

### For Healthcare Developers
Start with these examples if you're building healthcare applications:

1. **[Healthcare Scenarios](./healthcare-scenarios.md)** - Patient care workflows
2. **[FHIR Workflows](./fhir-workflows.md)** - FHIR standard implementations
3. **[Authentication Flows](./authentication-flows.md)** - Healthcare-specific auth

### For Enterprise Developers
Use these examples for large-scale implementations:

1. **[Batch Processing](./batch-processing.md)** - High-volume scenarios
2. **[Integration Patterns](./integration-patterns.md)** - System integrations
3. **[Basic Usage](./basic-usage.md)** - Foundation patterns

### For Compliance Officers
Review these for regulatory compliance understanding:

1. **[Healthcare Scenarios](./healthcare-scenarios.md)** - HIPAA compliance examples
2. **[FHIR Workflows](./fhir-workflows.md)** - Healthcare data standards
3. **[Authentication Flows](./authentication-flows.md)** - Access control examples

## 🏥 Healthcare Use Cases

### Patient Care Workflows
- **Electronic Medical Records (EMR)**: Patient chart access, updates, sharing
- **Clinical Decision Support**: Treatment recommendations, drug interactions
- **Telemedicine**: Remote consultations, prescription management
- **Laboratory Systems**: Test orders, results reporting, quality control
- **Pharmacy Systems**: Prescription management, dispensing, inventory

### Administrative Workflows
- **Patient Registration**: Enrollment, insurance verification, demographics
- **Billing and Claims**: Insurance claims, payment processing, adjustments
- **Quality Reporting**: Performance metrics, compliance reporting
- **User Management**: Role assignments, access provisioning, training records
- **System Maintenance**: Backups, updates, configuration changes

### Compliance and Security
- **HIPAA Audit Controls**: Access logging, breach detection, risk assessment
- **GDPR Data Protection**: Consent management, data export, deletion requests
- **Security Monitoring**: Threat detection, incident response, forensics
- **Regulatory Reporting**: Compliance reports, audit trail generation
- **Data Governance**: Data quality, lineage tracking, retention policies

## 🔧 Technical Implementation Patterns

### Event-Driven Architecture
```typescript
// Event-driven audit logging
class HealthcareEventBus {
  async publishPatientEvent(event: PatientEvent) {
    // Publish to event bus
    await eventBus.publish('patient.updated', event)
    
    // Automatically audit the event
    await auditService.logFHIR({
      principalId: event.updatedBy,
      action: 'fhir.patient.update',
      resourceId: event.patientId,
      status: 'success'
    })
  }
}
```

### Microservices Integration
```typescript
// Cross-service audit correlation
class ServiceAuditConnector {
  async auditCrossServiceCall(params: {
    sourceService: string
    targetService: string
    operation: string
    correlationId: string
  }) {
    await auditService.log({
      principalId: params.sourceService,
      action: `service.call.${params.operation}`,
      status: 'success',
      correlationId: params.correlationId,
      details: {
        sourceService: params.sourceService,
        targetService: params.targetService
      }
    })
  }
}
```

### API Gateway Integration
```typescript
// API gateway audit middleware
app.use(async (req, res, next) => {
  const startTime = Date.now()
  
  res.on('finish', async () => {
    await auditService.log({
      principalId: req.user?.id || 'anonymous',
      action: `api.${req.method.toLowerCase()}.${req.path}`,
      status: res.statusCode < 400 ? 'success' : 'failure',
      sessionContext: {
        sessionId: req.sessionID,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      },
      processingLatency: Date.now() - startTime
    })
  })
  
  next()
})
```

## 📊 Performance Examples

### High-Volume Healthcare Environments
- **Emergency Departments**: 1000+ events/minute during peak hours
- **Large Hospitals**: 10,000+ daily users, millions of audit events
- **Health Information Exchanges**: Cross-organization data sharing
- **Clinical Laboratories**: Automated testing equipment integration
- **Telemedicine Platforms**: Real-time consultations, prescriptions

### Scalability Patterns
```typescript
// Auto-scaling audit processing
class AutoScalingAuditProcessor {
  async scaleBasedOnLoad() {
    const queueDepth = await auditService.getQueueStats()
    
    if (queueDepth.waiting > 1000) {
      // Scale up processing
      await this.increaseWorkers()
    } else if (queueDepth.waiting < 100) {
      // Scale down to save resources
      await this.decreaseWorkers()
    }
  }
}
```

## 🔒 Security Examples

### PHI Protection Patterns
```typescript
// Secure PHI audit logging
class SecurePHIAuditor {
  async auditPHIAccess(params: {
    userId: string
    patientId: string
    action: string
    reason: string
  }) {
    // Pseudonymize patient ID
    const pseudonymizedId = await this.pseudonymize(params.patientId)
    
    await auditService.logCritical({
      principalId: params.userId,
      action: `phi.${params.action}`,
      targetResourceId: pseudonymizedId,
      dataClassification: 'PHI',
      complianceContext: {
        regulation: 'HIPAA',
        accessReason: params.reason,
        minimumNecessaryJustification: 'Clinical care'
      }
    }, {
      priority: 1,
      compliance: ['hipaa']
    })
  }
}
```

### Breach Detection Examples
```typescript
// Real-time breach detection
class BreachDetectionSystem {
  async monitorForBreaches() {
    // Monitor for unusual access patterns
    const suspiciousPatterns = await this.detectSuspiciousActivity()
    
    for (const pattern of suspiciousPatterns) {
      await auditService.logCritical({
        principalId: 'breach-detection-system',
        action: 'security.breach.suspected',
        status: 'failure',
        securityContext: {
          pattern: pattern.type,
          confidence: pattern.confidence,
          affectedRecords: pattern.recordCount
        }
      }, {
        priority: 1,
        notify: ['security-team'],
        escalate: true
      })
    }
  }
}
```

## 🧪 Testing Examples

### Unit Testing Patterns
```typescript
// Unit testing audit logging
describe('PatientAuditService', () => {
  it('should log patient chart access', async () => {
    const mockAuditService = createMockAuditService()
    const patientService = new PatientService(mockAuditService)
    
    await patientService.viewPatientChart('patient-123', 'doctor-456')
    
    expect(mockAuditService.logFHIR).toHaveBeenCalledWith({
      principalId: 'doctor-456',
      action: 'fhir.patient.read',
      resourceId: 'patient-123',
      status: 'success'
    })
  })
})
```

### Integration Testing
```typescript
// End-to-end audit testing
describe('Audit Integration', () => {
  it('should process events end-to-end', async () => {
    // Create test event
    const event = createTestPatientEvent()
    
    // Log event
    await auditService.log(event)
    
    // Wait for processing
    await waitForProcessing(2000)
    
    // Verify in database
    const storedEvent = await getEventFromDatabase(event.correlationId)
    expect(storedEvent).toBeDefined()
    expect(storedEvent.hash).toBeTruthy()
  })
})
```

## 📋 Example Selection Guide

### Choose Examples Based On Your Needs

**Building a New Healthcare App?**
→ Start with [Basic Usage](./basic-usage.md) and [Healthcare Scenarios](./healthcare-scenarios.md)

**Implementing FHIR?**
→ Focus on [FHIR Workflows](./fhir-workflows.md) and [Healthcare Scenarios](./healthcare-scenarios.md)

**High-Volume Environment?**
→ Review [Batch Processing](./batch-processing.md) and [Integration Patterns](./integration-patterns.md)

**Security-Focused Implementation?**
→ Study [Authentication Flows](./authentication-flows.md) and [Healthcare Scenarios](./healthcare-scenarios.md)

**Enterprise Integration?**
→ Examine [Integration Patterns](./integration-patterns.md) and [Batch Processing](./batch-processing.md)

### Implementation Complexity

**Beginner** (Basic implementations)
- [Basic Usage](./basic-usage.md)
- Simple examples from [Healthcare Scenarios](./healthcare-scenarios.md)

**Intermediate** (Production-ready implementations)
- [Authentication Flows](./authentication-flows.md)
- [FHIR Workflows](./fhir-workflows.md)
- Advanced [Healthcare Scenarios](./healthcare-scenarios.md)

**Advanced** (Enterprise and high-scale implementations)
- [Batch Processing](./batch-processing.md)
- [Integration Patterns](./integration-patterns.md)
- Performance-optimized examples

## 🔗 Related Documentation

### Essential Reading Before Examples
- **[Getting Started](../getting-started/)** - Basic setup and configuration
- **[Tutorials](../tutorials/)** - Step-by-step learning guides
- **[API Reference](../api-reference/)** - Detailed API documentation

### After Working Through Examples
- **[Guides](../guides/)** - Implementation best practices
- **[Troubleshooting](../troubleshooting/)** - Common issues and solutions
- **[FAQ](../faq/)** - Frequently asked questions

## 💡 Using These Examples

### Code Adaptation Guidelines
1. **Replace Placeholder Values**: Update IDs, URLs, and configuration values
2. **Add Error Handling**: Implement robust error handling for production
3. **Security Review**: Ensure PHI protection and access controls
4. **Performance Testing**: Load test before production deployment
5. **Compliance Validation**: Verify regulatory requirements are met

### Example Structure
Each example includes:
- **Scenario Description**: Real-world use case context
- **Complete Code**: Full implementation with explanations
- **Configuration**: Required setup and dependencies
- **Best Practices**: Recommended patterns and optimizations
- **Testing**: Unit and integration test examples
- **Compliance Notes**: Regulatory considerations

### Getting Help
If you need assistance with any example:
1. Check the related [tutorials](../tutorials/) for foundational knowledge
2. Review the [API reference](../api-reference/) for detailed documentation
3. Look at [troubleshooting](../troubleshooting/) for common issues
4. Ask questions following the project contribution guidelines

Start with the examples most relevant to your healthcare application needs!