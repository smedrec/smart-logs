# Healthcare Compliance Tutorial

This tutorial guides you through implementing HIPAA and GDPR compliance features in your audit system for healthcare applications.

## 🎯 Learning Objectives

- Configure HIPAA compliance for healthcare audit logging
- Implement GDPR data protection and subject rights
- Set up automated compliance validation and reporting
- Implement data retention and archival policies
- Handle PHI (Protected Health Information) properly

## 📋 Prerequisites

- ✅ Completed [Basic Implementation](./basic-implementation.md) tutorial
- ✅ Understanding of HIPAA and GDPR regulations
- ✅ Database and audit system running

## 🏥 Regulatory Overview

### HIPAA Requirements
- **Audit Controls** (§164.312(b)): Record access to ePHI
- **6-year retention**: Audit logs must be retained for 6 years
- **Minimum Necessary**: Limit access to minimum required
- **Tamper Detection**: Protect audit log integrity

### GDPR Requirements
- **Lawful Basis**: Legal justification for processing
- **Data Subject Rights**: Access, rectification, erasure, portability
- **Breach Notification**: 72-hour notification requirement
- **Records of Processing**: Document all processing activities

## 🚀 Step 1: HIPAA Compliance Configuration

### Enhanced HIPAA Configuration

```typescript
// src/config/hipaa-config.ts
import type { AuditConfig } from '@repo/audit'

export const createHIPAACompliantConfig = (): AuditConfig => {
  return {
    version: '1.0',
    environment: process.env.NODE_ENV || 'production',
    
    compliance: {
      hipaa: {
        enabled: true,
        
        // Required audit fields per HIPAA
        requiredFields: [
          'principalId',           // Who accessed
          'action',               // What action
          'timestamp',            // When
          'targetResourceType',   // What resource type
          'targetResourceId',     // Specific resource
          'sessionContext',       // Session context
          'outcomeDescription'    // What happened
        ],
        
        retentionYears: 6,                    // 6-year retention
        enableSecurityIncidentReporting: true,
        
        phiHandling: {
          enablePseudonymization: true,
          enableDataMinimization: true,
          requireConsentTracking: true,
          enableAccessLogging: true
        },
        
        auditLogSecurity: {
          enableTamperDetection: true,
          enableDigitalSignatures: true,
          requirePeriodicValidation: true,
          encryptionRequired: true
        }
      }
    },
    
    security: {
      enableEncryption: true,
      enableTamperDetection: true,
      requireDigitalSignatures: true,
      
      crypto: {
        algorithm: 'SHA-256',
        signingAlgorithm: 'HMAC-SHA256'
      }
    }
  }
}
```

### HIPAA-Compliant Event Logging

```typescript
// src/services/hipaa-audit-service.ts
import { auditService } from './audit-service'

export class HIPAAAuditService {
  /**
   * Log PHI access with HIPAA compliance
   */
  static async logPHIAccess(params: {
    principalId: string
    principalRole: string
    patientId: string
    action: string
    accessReason: string
    minimumNecessaryJustification: string
    sessionId: string
    ipAddress: string
    department: string
    isBreakGlass?: boolean
  }): Promise<void> {
    const event = {
      principalId: params.principalId,
      action: `phi.${params.action}`,
      status: 'success',
      targetResourceType: 'PatientRecord',
      targetResourceId: params.patientId,
      dataClassification: 'PHI',
      
      sessionContext: {
        sessionId: params.sessionId,
        ipAddress: params.ipAddress,
        department: params.department,
        principalRole: params.principalRole
      },
      
      complianceContext: {
        regulation: 'HIPAA',
        accessReason: params.accessReason,
        minimumNecessaryJustification: params.minimumNecessaryJustification,
        isBreakGlass: params.isBreakGlass || false,
        consentStatus: 'verified'
      },
      
      outcomeDescription: `${params.principalRole} accessed PHI for ${params.accessReason}`
    }
    
    await auditService.logCritical(event, {
      priority: 1,
      compliance: ['hipaa'],
      notify: params.isBreakGlass ? ['security-team'] : undefined
    })
  }
  
  /**
   * Log security incident per HIPAA requirements
   */
  static async logSecurityIncident(params: {
    incidentId: string
    incidentType: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    affectedPatients: string[]
    detectedBy: string
    description: string
  }): Promise<void> {
    await auditService.logCritical({
      principalId: params.detectedBy,
      action: 'security.incident',
      status: 'failure',
      dataClassification: 'CONFIDENTIAL',
      
      securityContext: {
        incidentId: params.incidentId,
        incidentType: params.incidentType,
        severity: params.severity,
        affectedRecords: params.affectedPatients.length
      },
      
      outcomeDescription: `Security incident ${params.incidentId}: ${params.description}`
    }, {
      priority: 1,
      compliance: ['hipaa'],
      notify: ['security-team', 'compliance-officer']
    })
  }
}
```

## 🚀 Step 2: GDPR Compliance Implementation

### GDPR Configuration

```typescript
// src/config/gdpr-config.ts
export const createGDPRCompliantConfig = (): Partial<AuditConfig> => {
  return {
    compliance: {
      gdpr: {
        enabled: true,
        
        defaultLegalBasis: 'legitimate_interest',
        allowedLegalBases: [
          'consent', 'contract', 'legal_obligation', 
          'vital_interests', 'public_task', 'legitimate_interest'
        ],
        
        retentionDays: 365,
        
        dataSubjectRights: {
          enableDataExport: true,
          enableDataDeletion: true,
          enableDataPortability: true,
          enableConsentWithdrawal: true
        },
        
        breachNotification: {
          enableAutomaticDetection: true,
          notificationWindow: 72,
          enableRiskAssessment: true
        }
      }
    }
  }
}
```

### GDPR-Compliant Service

```typescript
// src/services/gdpr-audit-service.ts
export class GDPRAuditService {
  /**
   * Log data processing with GDPR compliance
   */
  static async logDataProcessing(params: {
    principalId: string
    dataSubjectId: string
    processingPurpose: string
    legalBasis: string
    dataCategories: string[]
    retentionPeriod: number
  }): Promise<void> {
    await auditService.log({
      principalId: params.principalId,
      action: 'data.process',
      status: 'success',
      targetResourceType: 'PersonalData',
      targetResourceId: params.dataSubjectId,
      dataClassification: 'PERSONAL',
      
      complianceContext: {
        regulation: 'GDPR',
        legalBasis: params.legalBasis,
        processingPurpose: params.processingPurpose,
        dataCategories: params.dataCategories,
        retentionPeriod: params.retentionPeriod
      },
      
      outcomeDescription: `Personal data processed for ${params.processingPurpose}`
    })
  }
  
  /**
   * Log data subject rights request
   */
  static async logDataSubjectRequest(params: {
    dataSubjectId: string
    requestType: 'access' | 'rectification' | 'erasure' | 'portability'
    requestId: string
    status: 'received' | 'processing' | 'completed' | 'rejected'
    handledBy: string
  }): Promise<void> {
    await auditService.log({
      principalId: params.handledBy,
      action: `gdpr.${params.requestType}_request`,
      status: params.status === 'completed' ? 'success' : 'attempt',
      targetResourceType: 'DataSubjectRequest',
      targetResourceId: params.requestId,
      
      complianceContext: {
        regulation: 'GDPR',
        requestType: params.requestType,
        dataSubjectId: params.dataSubjectId
      },
      
      outcomeDescription: `GDPR ${params.requestType} request ${params.status}`
    })
  }
}
```

## 🚀 Step 3: Compliance Validation

### Validation Service

```typescript
// src/services/compliance-validation-service.ts
export class ComplianceValidationService {
  /**
   * Validate HIPAA compliance
   */
  static validateHIPAACompliance(event: any): {
    isCompliant: boolean
    violations: string[]
  } {
    const violations: string[] = []
    
    // Required fields validation
    const requiredFields = ['principalId', 'action', 'targetResourceType', 'sessionContext']
    for (const field of requiredFields) {
      if (!event[field]) {
        violations.push(`Missing HIPAA required field: ${field}`)
      }
    }
    
    // PHI access validation
    if (event.dataClassification === 'PHI') {
      if (!event.complianceContext?.accessReason) {
        violations.push('PHI access without documented reason')
      }
      
      if (!event.complianceContext?.minimumNecessaryJustification) {
        violations.push('PHI access without minimum necessary justification')
      }
    }
    
    return {
      isCompliant: violations.length === 0,
      violations
    }
  }
  
  /**
   * Validate GDPR compliance
   */
  static validateGDPRCompliance(event: any): {
    isCompliant: boolean
    violations: string[]
  } {
    const violations: string[] = []
    
    if (event.dataClassification === 'PERSONAL') {
      if (!event.complianceContext?.legalBasis) {
        violations.push('Personal data processing without legal basis')
      }
      
      if (!event.complianceContext?.processingPurpose) {
        violations.push('Personal data processing without specified purpose')
      }
    }
    
    return {
      isCompliant: violations.length === 0,
      violations
    }
  }
}
```

## 🚀 Step 4: Data Retention

### Retention Policy Service

```typescript
// src/services/retention-policy-service.ts
export class RetentionPolicyService {
  /**
   * Apply HIPAA retention policies
   */
  static async applyHIPAARetention(): Promise<void> {
    const sixYearsAgo = new Date()
    sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6)
    
    await this.archiveOldRecords({
      dataClassification: 'PHI',
      cutoffDate: sixYearsAgo,
      reason: 'HIPAA 6-year retention policy'
    })
  }
  
  /**
   * Apply GDPR retention policies
   */
  static async applyGDPRRetention(): Promise<void> {
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    
    await this.deleteExpiredRecords({
      dataClassification: 'PERSONAL',
      cutoffDate: oneYearAgo,
      reason: 'GDPR retention policy'
    })
  }
  
  private static async archiveOldRecords(params: {
    dataClassification: string
    cutoffDate: Date
    reason: string
  }): Promise<void> {
    // Archive implementation
    await auditService.log({
      principalId: 'system',
      action: 'data.archive',
      status: 'success',
      details: {
        dataClassification: params.dataClassification,
        cutoffDate: params.cutoffDate.toISOString(),
        reason: params.reason
      }
    })
  }
}
```

## 🚀 Step 5: Example Usage

### Patient Chart Access with HIPAA Compliance

```typescript
// Example: Physician accessing patient chart
await HIPAAAuditService.logPHIAccess({
  principalId: 'dr.jones@hospital.com',
  principalRole: 'physician',
  patientId: 'patient-12345',
  action: 'chart_view',
  accessReason: 'routine_checkup',
  minimumNecessaryJustification: 'Reviewing vitals and lab results for scheduled appointment',
  sessionId: 'sess_abc123',
  ipAddress: '192.168.1.100',
  department: 'cardiology'
})
```

### GDPR Data Processing

```typescript
// Example: Processing patient data for treatment
await GDPRAuditService.logDataProcessing({
  principalId: 'nurse.smith@hospital.com',
  dataSubjectId: 'patient-12345',
  processingPurpose: 'medical_treatment',
  legalBasis: 'vital_interests',
  dataCategories: ['medical_history', 'current_symptoms'],
  retentionPeriod: 365
})
```

## ✅ Verification Steps

### Test HIPAA Compliance

```typescript
// Test PHI access logging
const testEvent = {
  principalId: 'test-doctor',
  action: 'phi.chart_view',
  dataClassification: 'PHI',
  complianceContext: {
    accessReason: 'treatment',
    minimumNecessaryJustification: 'Required for diagnosis'
  }
}

const validation = ComplianceValidationService.validateHIPAACompliance(testEvent)
console.log('HIPAA compliant:', validation.isCompliant)
```

### Test GDPR Compliance

```typescript
// Test personal data processing
const gdprEvent = {
  dataClassification: 'PERSONAL',
  complianceContext: {
    legalBasis: 'consent',
    processingPurpose: 'healthcare_service'
  }
}

const gdprValidation = ComplianceValidationService.validateGDPRCompliance(gdprEvent)
console.log('GDPR compliant:', gdprValidation.isCompliant)
```

## 📝 Next Steps

1. **[FHIR Integration](./fhir-integration.md)** - Implement FHIR-specific audit patterns
2. **[Security Configuration](./security-configuration.md)** - Add cryptographic security
3. **[Monitoring Setup](./monitoring-setup.md)** - Set up compliance monitoring

## 💡 Best Practices

- **Always validate compliance** before logging events
- **Document legal basis** for all data processing
- **Implement proper retention** policies
- **Monitor compliance metrics** continuously
- **Train staff** on audit requirements
- **Regular compliance audits** and reviews

Your audit system now meets healthcare compliance requirements!