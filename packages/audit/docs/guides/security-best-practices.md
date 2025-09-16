# Security Best Practices Guide

This guide provides comprehensive security best practices for implementing the `@repo/audit` package in healthcare environments, focusing on PHI protection, cryptographic security, and compliance requirements.

## 🎯 Security Objectives

### Primary Goals
- **Data Integrity**: Ensure audit logs cannot be tampered with
- **Authenticity**: Verify the source and legitimacy of audit events
- **Confidentiality**: Protect sensitive information in audit logs
- **Non-repudiation**: Prevent denial of actions through cryptographic proof
- **Availability**: Maintain audit system availability under attack

### Healthcare-Specific Goals
- **PHI Protection**: Safeguard Protected Health Information
- **Regulatory Compliance**: Meet HIPAA and GDPR security requirements
- **Breach Detection**: Identify unauthorized access attempts
- **Incident Response**: Enable rapid response to security incidents

## 🔒 Cryptographic Security

### Hash-Based Integrity

Implement SHA-256 hashing for tamper detection:

```typescript
import { CryptoService } from '@repo/audit'

const securityConfig = {
  crypto: {
    algorithm: 'SHA-256',
    signingAlgorithm: 'HMAC-SHA256'
  },
  enableEncryption: true,
  enableTamperDetection: true,
  requireDigitalSignatures: true
}

const cryptoService = new CryptoService(securityConfig)

// Generate event hash
const eventHash = cryptoService.generateHash(auditEvent)

// Verify event integrity
const isIntact = cryptoService.verifyHash(auditEvent, expectedHash)
if (!isIntact) {
  // Handle tamper detection
  await handleTamperDetection(auditEvent)
}
```

### Digital Signatures

Implement HMAC-SHA256 signatures for authenticity:

```typescript
// Generate digital signature
const signatureResponse = await cryptoService.generateEventSignature(auditEvent)

// Store signature with event
const signedEvent = {
  ...auditEvent,
  signature: signatureResponse.signature,
  algorithm: signatureResponse.algorithm
}

// Verify signature authenticity
const isAuthentic = await cryptoService.verifyEventSignature(
  auditEvent, 
  signatureResponse.signature
)
```

### Advanced Cryptographic Options

For high-security environments:

```typescript
const advancedSecurityConfig = {
  crypto: {
    algorithm: 'SHA-256',
    signingAlgorithm: 'RSASSA_PSS_SHA_256', // RSA-PSS for enhanced security
    keyDerivation: 'PBKDF2',
    iterations: 100000
  },
  encryption: {
    algorithm: 'AES-256-GCM',
    keySize: 256,
    ivSize: 96,
    tagSize: 128
  },
  keyManagement: {
    provider: 'infisical',
    rotationInterval: 30, // days
    enableHSM: true, // Hardware Security Module
    enableKeyEscrow: true
  }
}
```

## 🔐 Key Management

### Infisical KMS Integration

Secure key management using Infisical:

```typescript
import { InfisicalKMSService } from '@repo/infisical-kms'

const kmsConfig = {
  infisical: {
    apiUrl: process.env.INFISICAL_API_URL,
    token: process.env.INFISICAL_TOKEN,
    projectId: process.env.INFISICAL_PROJECT_ID,
    environment: 'production',
    keyPath: '/audit/keys'
  }
}

// Initialize KMS service
const kmsService = new InfisicalKMSService(kmsConfig.infisical)

// Retrieve signing key
const signingKey = await kmsService.getSecret('audit-signing-key')

// Rotate keys regularly
await kmsService.rotateKey('audit-signing-key', {
  algorithm: 'HMAC-SHA256',
  keySize: 256
})
```

### Key Rotation Strategy

Implement automatic key rotation:

```typescript
class KeyRotationService {
  private kmsService: InfisicalKMSService
  private rotationInterval: number = 30 * 24 * 60 * 60 * 1000 // 30 days

  async scheduleKeyRotation(): Promise<void> {
    setInterval(async () => {
      try {
        await this.rotateAuditKeys()
        await this.auditKeyRotation()
      } catch (error) {
        await this.handleKeyRotationFailure(error)
      }
    }, this.rotationInterval)
  }

  private async rotateAuditKeys(): Promise<void> {
    // Rotate signing key
    await this.kmsService.rotateKey('audit-signing-key')
    
    // Rotate encryption key
    await this.kmsService.rotateKey('audit-encryption-key')
    
    // Update application configuration
    await this.updateCryptoConfiguration()
  }

  private async auditKeyRotation(): Promise<void> {
    await auditService.log({
      principalId: 'key-rotation-service',
      action: 'security.key.rotation',
      status: 'success',
      dataClassification: 'CONFIDENTIAL',
      securityContext: {
        keyType: 'audit-signing-key',
        rotationReason: 'scheduled',
        previousKeyId: 'old-key-id',
        newKeyId: 'new-key-id'
      },
      outcomeDescription: 'Audit signing key rotated successfully'
    })
  }
}
```

## 🏥 PHI Protection Strategies

### Data Classification and Handling

Implement proper PHI classification:

```typescript
class PHIProtectionService {
  /**
   * Classify and protect PHI in audit events
   */
  static async logPHIAccess(params: {
    principalId: string
    patientId: string
    action: string
    accessContext: string
    clinicalJustification: string
  }): Promise<void> {
    // Pseudonymize patient identifier
    const pseudonymizedPatientId = await this.pseudonymizePatientId(params.patientId)
    
    const phiEvent = {
      principalId: params.principalId,
      action: `phi.${params.action}`,
      status: 'success',
      targetResourceType: 'PatientRecord',
      targetResourceId: pseudonymizedPatientId, // Use pseudonymized ID
      dataClassification: 'PHI',
      
      // HIPAA compliance context
      complianceContext: {
        regulation: 'HIPAA',
        accessReason: params.accessContext,
        minimumNecessaryJustification: params.clinicalJustification,
        consentStatus: 'verified'
      },
      
      // Security measures
      securityContext: {
        dataHandling: 'pseudonymized',
        encryptionApplied: true,
        accessControlVerified: true
      }
    }

    // Log with enhanced security
    await auditService.logCritical(phiEvent, {
      priority: 1,
      compliance: ['hipaa'],
      generateHash: true,
      generateSignature: true
    })
  }

  private static async pseudonymizePatientId(patientId: string): Promise<string> {
    // Use cryptographic hash for pseudonymization
    const crypto = require('crypto')
    const salt = process.env.PHI_PSEUDONYMIZATION_SALT
    return crypto.createHmac('sha256', salt).update(patientId).digest('hex')
  }
}
```

### Data Minimization

Implement data minimization principles:

```typescript
class DataMinimizationService {
  /**
   * Minimize PHI exposure in audit logs
   */
  static sanitizeAuditEvent(event: AuditLogEvent): AuditLogEvent {
    const sanitized = { ...event }
    
    // Remove or hash sensitive fields
    if (sanitized.details) {
      sanitized.details = this.sanitizeSensitiveFields(sanitized.details)
    }
    
    // Limit outcome description length
    if (sanitized.outcomeDescription && sanitized.outcomeDescription.length > 255) {
      sanitized.outcomeDescription = sanitized.outcomeDescription.substring(0, 252) + '...'
    }
    
    return sanitized
  }

  private static sanitizeSensitiveFields(details: Record<string, any>): Record<string, any> {
    const sensitiveFields = ['ssn', 'dateOfBirth', 'phone', 'email', 'address']
    const sanitized = { ...details }
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = this.hashSensitiveValue(sanitized[field])
      }
    }
    
    return sanitized
  }

  private static hashSensitiveValue(value: string): string {
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(value).digest('hex').substring(0, 8) + '...'
  }
}
```

## 🛡️ Access Control and Monitoring

### Role-Based Access Control

Implement proper access control for audit logs:

```typescript
class AuditAccessControl {
  /**
   * Verify access permissions for audit operations
   */
  static async verifyAuditAccess(params: {
    principalId: string
    operation: 'read' | 'write' | 'delete' | 'export'
    dataClassification: DataClassification
    organizationId?: string
  }): Promise<boolean> {
    const userRoles = await this.getUserRoles(params.principalId)
    const requiredPermissions = this.getRequiredPermissions(params.operation, params.dataClassification)
    
    // Check role-based permissions
    const hasPermission = userRoles.some(role => 
      requiredPermissions.every(permission => 
        role.permissions.includes(permission)
      )
    )
    
    // Log access attempt
    await auditService.log({
      principalId: params.principalId,
      action: `audit.access.${params.operation}`,
      status: hasPermission ? 'success' : 'failure',
      dataClassification: 'CONFIDENTIAL',
      securityContext: {
        accessControlCheck: true,
        requiredPermissions,
        userRoles: userRoles.map(r => r.name),
        accessGranted: hasPermission
      }
    })
    
    return hasPermission
  }

  private static getRequiredPermissions(operation: string, classification: DataClassification): string[] {
    const permissionMap = {
      'read': {
        'PUBLIC': ['audit.read'],
        'INTERNAL': ['audit.read'],
        'CONFIDENTIAL': ['audit.read', 'security.elevated'],
        'PHI': ['audit.read', 'phi.access', 'security.elevated']
      },
      'write': {
        'PUBLIC': ['audit.write'],
        'INTERNAL': ['audit.write'],
        'CONFIDENTIAL': ['audit.write', 'security.elevated'],
        'PHI': ['audit.write', 'phi.access', 'security.elevated']
      },
      'export': {
        'PUBLIC': ['audit.export'],
        'INTERNAL': ['audit.export', 'data.export'],
        'CONFIDENTIAL': ['audit.export', 'data.export', 'security.elevated'],
        'PHI': ['audit.export', 'phi.export', 'security.elevated', 'compliance.officer']
      }
    }
    
    return permissionMap[operation]?.[classification] || ['audit.admin']
  }
}
```

### Real-Time Security Monitoring

Implement continuous security monitoring:

```typescript
class SecurityMonitoringService {
  private static readonly THREAT_PATTERNS = [
    {
      name: 'rapid_access_pattern',
      condition: (events: AuditLogEvent[]) => events.length > 50, // 50+ events in window
      severity: 'medium',
      description: 'Unusually high audit event frequency detected'
    },
    {
      name: 'off_hours_phi_access',
      condition: (events: AuditLogEvent[]) => 
        events.some(e => e.dataClassification === 'PHI' && this.isOffHours(e.timestamp)),
      severity: 'high',
      description: 'PHI access during off-hours detected'
    },
    {
      name: 'failed_access_pattern',
      condition: (events: AuditLogEvent[]) => 
        events.filter(e => e.status === 'failure').length > 10,
      severity: 'high',
      description: 'Multiple failed access attempts detected'
    }
  ]

  /**
   * Monitor for security threats in real-time
   */
  static async monitorSecurityThreats(): Promise<void> {
    const timeWindow = 5 * 60 * 1000 // 5 minutes
    
    setInterval(async () => {
      const recentEvents = await this.getRecentAuditEvents(timeWindow)
      
      for (const pattern of this.THREAT_PATTERNS) {
        if (pattern.condition(recentEvents)) {
          await this.handleSecurityThreat({
            pattern: pattern.name,
            severity: pattern.severity,
            description: pattern.description,
            events: recentEvents
          })
        }
      }
    }, 60000) // Check every minute
  }

  private static async handleSecurityThreat(threat: {
    pattern: string
    severity: string
    description: string
    events: AuditLogEvent[]
  }): Promise<void> {
    // Log security incident
    await auditService.logCritical({
      principalId: 'security-monitoring-service',
      action: 'security.threat.detected',
      status: 'failure',
      dataClassification: 'CONFIDENTIAL',
      securityContext: {
        threatPattern: threat.pattern,
        severity: threat.severity,
        affectedEvents: threat.events.length,
        timeWindow: '5m'
      },
      outcomeDescription: threat.description
    }, {
      priority: 1,
      notify: ['security-team', 'soc'],
      escalate: threat.severity === 'high'
    })

    // Take automated response actions
    if (threat.severity === 'high') {
      await this.initiateIncidentResponse(threat)
    }
  }

  private static isOffHours(timestamp: string): boolean {
    const date = new Date(timestamp)
    const hour = date.getHours()
    const day = date.getDay()
    
    // Consider off-hours as: weekends or weekdays before 6 AM or after 10 PM
    return day === 0 || day === 6 || hour < 6 || hour > 22
  }
}
```

## 🚨 Incident Response

### Automated Incident Response

Implement automated response to security incidents:

```typescript
class IncidentResponseService {
  /**
   * Handle security incidents automatically
   */
  static async handleSecurityIncident(incident: {
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    affectedResources: string[]
    indicators: Record<string, any>
  }): Promise<void> {
    const incidentId = this.generateIncidentId()
    
    // Immediate containment actions
    if (incident.severity === 'critical' || incident.severity === 'high') {
      await this.executeContainmentActions(incident)
    }
    
    // Notify stakeholders
    await this.notifyStakeholders(incident, incidentId)
    
    // Create incident record
    await this.createIncidentRecord(incident, incidentId)
    
    // Start investigation
    await this.initiateInvestigation(incident, incidentId)
  }

  private static async executeContainmentActions(incident: any): Promise<string[]> {
    const actions: string[] = []
    
    // Temporary session suspension for brute force attacks
    if (incident.type === 'brute_force_attack') {
      await this.suspendSuspiciousSessions(incident.indicators.sourceIPs)
      actions.push('suspended_suspicious_sessions')
    }
    
    // Revoke access for compromised accounts
    if (incident.type === 'account_compromise') {
      await this.revokeAccountAccess(incident.affectedResources)
      actions.push('revoked_account_access')
    }
    
    // Enable enhanced monitoring
    await this.enableEnhancedMonitoring(incident.affectedResources)
    actions.push('enabled_enhanced_monitoring')
    
    return actions
  }

  private static async createIncidentRecord(incident: any, incidentId: string): Promise<void> {
    await auditService.logCritical({
      principalId: 'incident-response-service',
      action: 'security.incident.created',
      status: 'success',
      dataClassification: 'CONFIDENTIAL',
      securityContext: {
        incidentId,
        incidentType: incident.type,
        severity: incident.severity,
        affectedResources: incident.affectedResources,
        indicators: incident.indicators,
        responseTime: new Date().toISOString()
      },
      outcomeDescription: `Security incident ${incidentId} created and response initiated`
    }, {
      priority: 1,
      compliance: ['hipaa'],
      notify: ['security-team', 'compliance-officer']
    })
  }
}
```

### Breach Notification Compliance

Implement HIPAA and GDPR breach notification:

```typescript
class BreachNotificationService {
  /**
   * Handle data breach notification requirements
   */
  static async handleDataBreach(breach: {
    breachId: string
    affectedRecords: number
    dataTypes: string[]
    rootCause: string
    containmentActions: string[]
    affectedIndividuals?: string[]
  }): Promise<void> {
    const breachAssessment = await this.assessBreachRisk(breach)
    
    // HIPAA notification (within 60 days to HHS, immediately to individuals if required)
    if (breachAssessment.requiresHIPAANotification) {
      await this.scheduleHIPAANotification(breach, breachAssessment)
    }
    
    // GDPR notification (within 72 hours to supervisory authority)
    if (breachAssessment.requiresGDPRNotification) {
      await this.scheduleGDPRNotification(breach, breachAssessment)
    }
    
    // Log breach handling
    await auditService.logCritical({
      principalId: 'breach-notification-service',
      action: 'security.breach.notification',
      status: 'success',
      dataClassification: 'CONFIDENTIAL',
      complianceContext: {
        breachId: breach.breachId,
        hipaaNotificationRequired: breachAssessment.requiresHIPAANotification,
        gdprNotificationRequired: breachAssessment.requiresGDPRNotification,
        notificationDeadlines: breachAssessment.notificationDeadlines
      },
      outcomeDescription: `Breach notification process initiated for ${breach.breachId}`
    })
  }

  private static async assessBreachRisk(breach: any): Promise<{
    riskLevel: 'low' | 'medium' | 'high'
    requiresHIPAANotification: boolean
    requiresGDPRNotification: boolean
    notificationDeadlines: Record<string, string>
  }> {
    // Risk assessment logic
    const riskLevel = breach.affectedRecords > 500 ? 'high' : 
                     breach.affectedRecords > 50 ? 'medium' : 'low'
    
    const containsPHI = breach.dataTypes.includes('PHI')
    const containsPersonalData = breach.dataTypes.some(type => 
      ['PII', 'personal_data', 'sensitive_personal_data'].includes(type)
    )
    
    return {
      riskLevel,
      requiresHIPAANotification: containsPHI && breach.affectedRecords >= 500,
      requiresGDPRNotification: containsPersonalData && riskLevel !== 'low',
      notificationDeadlines: {
        hipaa_hhs: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
        gdpr_authority: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
        individuals: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days
      }
    }
  }
}
```

## 📋 Security Compliance Checklist

### HIPAA Security Rule Compliance

- [ ] **Access Control** (§164.312(a))
  - [ ] Unique user identification
  - [ ] Automatic logoff
  - [ ] Encryption and decryption

- [ ] **Audit Controls** (§164.312(b))
  - [ ] Record and examine access to ePHI
  - [ ] Audit log protection
  - [ ] Regular audit reviews

- [ ] **Integrity** (§164.312(c))
  - [ ] PHI alteration/destruction protection
  - [ ] Cryptographic integrity verification

- [ ] **Person or Entity Authentication** (§164.312(d))
  - [ ] Verify user identity before access
  - [ ] Multi-factor authentication for PHI access

- [ ] **Transmission Security** (§164.312(e))
  - [ ] End-to-end encryption
  - [ ] Guard against unauthorized access

### GDPR Security Requirements

- [ ] **Security of Processing** (Article 32)
  - [ ] Pseudonymisation and encryption
  - [ ] Confidentiality, integrity, availability
  - [ ] Regular testing and evaluation

- [ ] **Data Protection by Design** (Article 25)
  - [ ] Privacy by default
  - [ ] Minimal data processing
  - [ ] Technical and organizational measures

- [ ] **Breach Notification** (Articles 33-34)
  - [ ] 72-hour authority notification
  - [ ] Individual notification procedures
  - [ ] Breach register maintenance

## 🔧 Security Configuration Examples

### Production Security Configuration

```typescript
const productionSecurityConfig: AuditConfig = {
  version: '1.0',
  environment: 'production',
  
  security: {
    enableEncryption: true,
    enableTamperDetection: true,
    requireDigitalSignatures: true,
    
    crypto: {
      algorithm: 'SHA-256',
      signingAlgorithm: 'HMAC-SHA256',
      keyDerivation: 'PBKDF2',
      iterations: 100000
    },
    
    encryption: {
      algorithm: 'AES-256-GCM',
      keySize: 256,
      keyRotationDays: 30
    },
    
    keyManagement: {
      provider: 'infisical',
      enableHSM: true,
      enableKeyEscrow: true,
      rotationInterval: 30
    }
  },
  
  compliance: {
    hipaa: {
      enabled: true,
      enableSecurityIncidentReporting: true,
      requireDigitalSignatures: true
    },
    gdpr: {
      enabled: true,
      enableBreachNotification: true,
      automaticRiskAssessment: true
    }
  },
  
  observability: {
    enableSecurityMonitoring: true,
    enableThreatDetection: true,
    alertThresholds: {
      failedAccess: 10,
      offHoursAccess: 1,
      rapidAccess: 50
    }
  }
}
```

## 💡 Security Best Practices Summary

1. **Implement Defense in Depth**: Use multiple security layers
2. **Enable Cryptographic Integrity**: Always hash and sign critical events
3. **Practice Data Minimization**: Limit PHI exposure in audit logs
4. **Monitor Continuously**: Implement real-time threat detection
5. **Respond Quickly**: Automate incident response procedures
6. **Maintain Compliance**: Regular compliance audits and reviews
7. **Rotate Keys Regularly**: Implement automated key rotation
8. **Train Personnel**: Ensure staff understand security procedures

Your audit system security is now enterprise-ready for healthcare environments!