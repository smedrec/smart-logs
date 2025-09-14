---
title: Security
description: Security Best Practices.
---

# Security Best Practices

The SMEDREC Audit System is designed with security as a primary concern. This guide outlines best practices for secure audit logging in healthcare environments.

## Cryptographic Security

### Hash Verification

All audit events can be protected with SHA-256 cryptographic hashes to ensure integrity:

```typescript
// Enable hash generation (enabled by default)
await auditService.log(eventDetails, {
	generateHash: true, // Default: true
})

// Verify event integrity
const isValid = auditService.verifyEventHash(event, event.hash)
if (!isValid) {
	console.error('Audit event integrity compromised!')
	// Handle tampered event
}
```

### HMAC Signatures

For additional security, use HMAC signatures with a secret key:

```typescript
// Generate signature for critical events
await auditService.log(eventDetails, {
	generateSignature: true,
})

// Verify signature
const isAuthentic = auditService.verifyEventSignature(event, event.signature)
if (!isAuthentic) {
	console.error('Audit event authentication failed!')
	// Handle unauthorized modification
}
```

### Configuration

Set up cryptographic configuration:

```typescript
const auditService = new Audit(
	'secure-queue',
	redisUrl,
	{},
	{
		secretKey: process.env.AUDIT_CRYPTO_SECRET, // Required for signatures
		algorithm: 'SHA-256', // Hash algorithm
	}
)
```

## Data Classification and Handling

### Classification Levels

Properly classify audit data based on sensitivity:

```typescript
// Public data
await auditService.log({
	action: 'system.startup',
	status: 'success',
	dataClassification: 'PUBLIC',
})

// Internal business data
await auditService.log({
	action: 'user.login',
	status: 'success',
	dataClassification: 'INTERNAL',
})

// Confidential business data
await auditService.log({
	action: 'admin.config.change',
	status: 'success',
	dataClassification: 'CONFIDENTIAL',
})

// Protected Health Information
await auditService.log({
	action: 'fhir.patient.read',
	targetResourceType: 'Patient',
	targetResourceId: 'patient-123',
	status: 'success',
	dataClassification: 'PHI', // Highest protection level
})
```

### Retention Policies

Implement appropriate data retention based on classification:

```typescript
await auditService.log({
	action: 'fhir.patient.access',
	dataClassification: 'PHI',
	retentionPolicy: 'hipaa-7-years', // Custom retention policy
	status: 'success',
})
```

## Input Validation and Sanitization

### Automatic Sanitization

The audit system automatically sanitizes input to prevent injection attacks:

```typescript
// Potentially dangerous input is automatically sanitized
await auditService.log({
	action: 'user.comment',
	status: 'success',
	userInput: '<script>alert("xss")</script>', // Automatically sanitized
	outcomeDescription: 'User submitted comment with "quotes"', // Quotes escaped
})
```

### Custom Validation

Configure validation rules for your environment:

```typescript
const customValidationConfig = {
	maxStringLength: 5000, // Shorter max length
	allowedDataClassifications: ['INTERNAL', 'PHI'], // Restrict classifications
	requiredFields: ['timestamp', 'action', 'status', 'principalId'], // Require user ID
	maxCustomFieldDepth: 2, // Limit nesting
	allowedEventVersions: ['2.0'], // Only allow specific versions
}

await auditService.log(eventDetails, {
	validationConfig: customValidationConfig,
})
```

### Manual Validation

For critical events, perform additional validation:

```typescript
function validateCriticalEvent(event: AuditLogEvent): boolean {
	// Custom business logic validation
	if (event.dataClassification === 'PHI' && !event.principalId) {
		throw new Error('PHI access must have principalId')
	}

	if (event.action.startsWith('admin.') && !event.organizationId) {
		throw new Error('Admin actions must have organizationId')
	}

	return true
}

// Use before logging
if (validateCriticalEvent(eventDetails)) {
	await auditService.log(eventDetails)
}
```

## Access Control and Authentication

### Principal Identification

Always identify the actor performing the action:

```typescript
// User actions
await auditService.log({
	principalId: 'user-123', // Always include user ID
	action: 'fhir.patient.read',
	status: 'success',
})

// System actions
await auditService.log({
	principalId: 'system-backup-service', // System identifier
	action: 'system.backup.created',
	status: 'success',
})

// Service-to-service
await auditService.log({
	principalId: 'service-fhir-api', // Service identifier
	organizationId: 'org-hospital-1', // Organization context
	action: 'fhir.bundle.process',
	status: 'success',
})
```

### Session Context

Include comprehensive session information:

```typescript
await auditService.log({
	principalId: 'user-123',
	action: 'fhir.patient.read',
	status: 'success',
	sessionContext: {
		sessionId: 'sess-abc123', // Session identifier
		ipAddress: '192.168.1.100', // Client IP
		userAgent: 'Mozilla/5.0...', // Client info
		geolocation: 'US-CA-SF', // Optional location
	},
})
```

## Network Security

### Redis Security

Secure your Redis connections:

```typescript
// Use TLS for Redis connections
const auditService = new Audit('secure-queue', {
	url: 'rediss://audit-redis:6380', // TLS connection
	options: {
		tls: {
			rejectUnauthorized: true,
			ca: fs.readFileSync('redis-ca.crt'),
			cert: fs.readFileSync('redis-client.crt'),
			key: fs.readFileSync('redis-client.key'),
		},
		password: process.env.REDIS_PASSWORD,
	},
})
```

### Database Security

Secure your PostgreSQL connections:

```env
# Use SSL for database connections
AUDIT_DB_URL="postgresql://user:pass@audit-db:5432/audit?sslmode=require&sslcert=client.crt&sslkey=client.key&sslrootcert=ca.crt"
```

## Environment Configuration

### Secure Environment Variables

```env
# Cryptographic keys (use strong, random values)
AUDIT_CRYPTO_SECRET="your-256-bit-secret-key-here"

# Database credentials (use strong passwords)
AUDIT_DB_URL="postgresql://audit_user:strong_password@audit-db:5432/audit_db"

# Redis credentials
AUDIT_REDIS_URL="rediss://audit_user:redis_password@audit-redis:6380"

# Additional security settings
AUDIT_ENABLE_SIGNATURES=true
AUDIT_REQUIRE_TLS=true
AUDIT_MAX_EVENT_SIZE=10000
```

### Key Management

Use proper key management practices:

```typescript
// Use environment-specific keys
const cryptoConfig = {
	secretKey:
		process.env.NODE_ENV === 'production'
			? process.env.AUDIT_CRYPTO_SECRET_PROD
			: process.env.AUDIT_CRYPTO_SECRET_DEV,
	rotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
}

const auditService = new Audit('secure-queue', redisUrl, {}, cryptoConfig)
```

## Monitoring and Alerting

### Security Event Detection

Monitor for suspicious audit patterns:

```typescript
// Monitor for failed authentication attempts
const failedLogins = await db
	.select()
	.from(auditLog)
	.where(
		and(
			eq(auditLog.action, 'auth.login.failure'),
			gte(auditLog.timestamp, new Date(Date.now() - 60000).toISOString()) // Last minute
		)
	)

if (failedLogins.length > 5) {
	// Alert security team
	await alertSecurityTeam('Multiple failed login attempts detected')
}

// Monitor for PHI access anomalies
const phiAccess = await db
	.select()
	.from(auditLog)
	.where(
		and(
			eq(auditLog.dataClassification, 'PHI'),
			eq(auditLog.principalId, userId),
			gte(auditLog.timestamp, new Date(Date.now() - 3600000).toISOString()) // Last hour
		)
	)

if (phiAccess.length > 50) {
	// Unusual PHI access pattern
	await alertComplianceTeam('Unusual PHI access pattern detected', {
		userId,
		count: phiAccess.length,
	})
}
```

### Integrity Monitoring

Regularly verify audit log integrity:

```typescript
async function verifyAuditIntegrity() {
	const events = await db.select().from(auditLog).where(isNotNull(auditLog.hash)).limit(1000)

	let corruptedCount = 0

	for (const event of events) {
		if (event.hash && !auditService.verifyEventHash(event, event.hash)) {
			corruptedCount++
			console.error('Corrupted audit event detected:', event.id)
		}
	}

	if (corruptedCount > 0) {
		await alertSecurityTeam(`${corruptedCount} corrupted audit events detected`)
	}

	return { total: events.length, corrupted: corruptedCount }
}

// Run integrity check daily
setInterval(verifyAuditIntegrity, 24 * 60 * 60 * 1000)
```

## Compliance Considerations

### HIPAA Compliance

For HIPAA compliance, ensure:

```typescript
// Minimum required fields for HIPAA audit
await auditService.log({
	principalId: 'required-for-hipaa', // Who
	action: 'fhir.patient.read', // What
	targetResourceType: 'Patient', // What resource
	targetResourceId: 'patient-123', // Which resource
	timestamp: new Date().toISOString(), // When (auto-generated)
	status: 'success', // Outcome
	sessionContext: {
		sessionId: 'sess-123',
		ipAddress: '192.168.1.100', // Where from
	},
	dataClassification: 'PHI',
	retentionPolicy: 'hipaa-6-years',
})
```

### GDPR Compliance

For GDPR compliance:

```typescript
// Include data subject information
await auditService.log({
	principalId: 'processor-123',
	action: 'data.process',
	targetResourceType: 'PersonalData',
	targetResourceId: 'subject-456',
	status: 'success',
	dataClassification: 'CONFIDENTIAL',
	gdprContext: {
		dataSubjectId: 'subject-456',
		legalBasis: 'consent',
		processingPurpose: 'healthcare-treatment',
		dataCategories: ['health-data', 'contact-info'],
	},
	retentionPolicy: 'gdpr-standard',
})
```

## Incident Response

### Security Incident Logging

Log security incidents with high priority:

```typescript
await auditService.logWithGuaranteedDelivery(
	{
		principalId: 'security-system',
		action: 'security.incident.detected',
		status: 'failure',
		outcomeDescription: 'Potential data breach detected',
		dataClassification: 'CONFIDENTIAL',
		incidentDetails: {
			type: 'unauthorized-access',
			severity: 'high',
			affectedResources: ['patient-123', 'patient-456'],
			detectionMethod: 'anomaly-detection',
		},
	},
	{
		priority: 1, // Highest priority
		durabilityGuarantees: true,
		generateSignature: true,
	}
)
```

### Forensic Preservation

Preserve audit logs for forensic analysis:

```typescript
// Create immutable audit trail
await auditService.log(
	{
		action: 'forensic.preservation.start',
		status: 'success',
		preservationDetails: {
			incidentId: 'inc-2024-001',
			timeRange: { start: '2024-01-01T00:00:00Z', end: '2024-01-02T00:00:00Z' },
			preservedBy: 'security-officer-123',
		},
	},
	{
		generateHash: true,
		generateSignature: true,
		skipValidation: false, // Ensure full validation
	}
)
```

## Enterprise Security Patterns

### Zero Trust Architecture

Implement zero trust principles for audit access:

```typescript
// Verify every access with comprehensive context
const auditContext = {
  verifiedIdentity: await verifyUserIdentity(principalId),
  deviceTrust: await assessDeviceTrust(sessionContext.deviceId),
  locationRisk: await assessLocationRisk(sessionContext.ipAddress),
  behaviorProfile: await getBehaviorProfile(principalId)
}

// Only proceed if all trust factors are satisfied
if (auditContext.verifiedIdentity && auditContext.deviceTrust.level === 'high') {
  await auditService.log({
    principalId,
    action: 'fhir.patient.access',
    status: 'success',
    securityContext: auditContext,
    trustScore: calculateTrustScore(auditContext)
  })
}
```

### Multi-Factor Authentication Integration

Log MFA events and require MFA for sensitive operations:

```typescript
// Log MFA verification
await auditService.log({
  principalId: 'user-123',
  action: 'auth.mfa.verify',
  status: 'success',
  mfaContext: {
    method: 'totp',
    deviceId: 'device-456',
    previousVerification: '2024-01-15T10:30:00Z'
  }
})

// Require MFA for PHI access
const requiresMFA = (action: string, dataClassification: string) => {
  return action.includes('patient') || dataClassification === 'PHI'
}

if (requiresMFA(action, dataClassification) && !session.mfaVerified) {
  throw new SecurityError('MFA required for PHI access')
}
```

### Role-Based Access Control (RBAC)

Implement comprehensive RBAC logging:

```typescript
interface Role {
  id: string
  name: string
  permissions: string[]
  dataAccess: string[]
  timeRestrictions?: {
    allowedHours: string
    timezone: string
  }
}

// Verify role permissions before logging
const userRoles = await getUserRoles(principalId)
const hasPermission = await verifyPermission(userRoles, action, targetResourceType)

if (!hasPermission) {
  await auditService.log({
    principalId,
    action: action,
    status: 'failure',
    outcomeDescription: 'Access denied - insufficient permissions',
    rbacContext: {
      userRoles: userRoles.map(r => r.name),
      requiredPermission: action,
      resourceType: targetResourceType
    }
  })
  throw new AccessDeniedError('Insufficient permissions')
}
```

## Advanced Threat Detection

### Anomaly Detection

Implement AI-powered anomaly detection:

```typescript
class AuditAnomalyDetector {
  async detectAnomalies(userId: string, timeWindow: number = 3600000) {
    const recentActivity = await this.getRecentActivity(userId, timeWindow)
    const userProfile = await this.getUserProfile(userId)
    
    const anomalies = {
      volumeAnomaly: this.detectVolumeAnomaly(recentActivity, userProfile),
      timeAnomaly: this.detectTimeAnomaly(recentActivity, userProfile),
      locationAnomaly: this.detectLocationAnomaly(recentActivity, userProfile),
      dataAccessAnomaly: this.detectDataAccessAnomaly(recentActivity, userProfile)
    }
    
    const riskScore = this.calculateRiskScore(anomalies)
    
    if (riskScore > 0.7) {
      await auditService.log({
        principalId: 'anomaly-detector',
        action: 'security.anomaly.detected',
        status: 'warning',
        targetUserId: userId,
        anomalyDetails: {
          riskScore,
          detectedAnomalies: Object.keys(anomalies).filter(k => anomalies[k]),
          activitySummary: this.summarizeActivity(recentActivity)
        }
      })
    }
    
    return { riskScore, anomalies }
  }
  
  private detectVolumeAnomaly(activity: AuditEvent[], profile: UserProfile): boolean {
    const currentVolume = activity.length
    const avgVolume = profile.averageHourlyActivity
    return currentVolume > (avgVolume * 3) // 3x normal activity
  }
  
  private detectTimeAnomaly(activity: AuditEvent[], profile: UserProfile): boolean {
    const currentHour = new Date().getHours()
    const typicalHours = profile.typicalWorkingHours
    return !typicalHours.includes(currentHour)
  }
}

// Usage
const detector = new AuditAnomalyDetector()
const anomalyResult = await detector.detectAnomalies('user-123')
```

### Behavioral Analytics

Track and analyze user behavior patterns:

```typescript
class BehaviorAnalytics {
  async trackBehavior(event: AuditEvent) {
    const behaviorMetrics = {
      actionFrequency: await this.getActionFrequency(event.principalId, event.action),
      accessPatterns: await this.getAccessPatterns(event.principalId),
      deviceConsistency: await this.checkDeviceConsistency(event.sessionContext),
      geolocationConsistency: await this.checkLocationConsistency(event.sessionContext)
    }
    
    // Update user behavior profile
    await this.updateBehaviorProfile(event.principalId, behaviorMetrics)
    
    // Log behavior analysis
    await auditService.log({
      principalId: 'behavior-analytics',
      action: 'analytics.behavior.tracked',
      status: 'success',
      targetUserId: event.principalId,
      behaviorMetrics
    })
  }
}
```

## Advanced Compliance Frameworks

### SOC 2 Type II Compliance

Implement SOC 2 audit requirements:

```typescript
// SOC 2 requires detailed system access logging
const soc2AuditEvent = {
  principalId: 'admin-user-456',
  action: 'system.configuration.change',
  status: 'success',
  soc2Context: {
    controlObjective: 'CC6.1', // Logical access controls
    changeType: 'configuration',
    approvalWorkflow: {
      requestId: 'req-789',
      approver: 'security-manager-123',
      approvalTimestamp: '2024-01-15T09:00:00Z'
    },
    changeDetails: {
      component: 'firewall-rules',
      previousValue: 'deny-all',
      newValue: 'allow-port-443',
      businessJustification: 'Enable HTTPS traffic'
    }
  }
}

await auditService.log(soc2AuditEvent)
```

### ISO 27001 Compliance

Implement ISO 27001 information security controls:

```typescript
// A.12.4.1 - Event logging
const iso27001Event = {
  principalId: 'user-789',
  action: 'data.access',
  status: 'success',
  iso27001Context: {
    controlReference: 'A.12.4.1',
    securityEvent: true,
    informationClassification: 'CONFIDENTIAL',
    accessJustification: 'Business need - customer support case #12345',
    dataMinimization: {
      fieldsRequested: ['name', 'email', 'phone'],
      fieldsAccessed: ['name', 'email'],
      justification: 'Phone number not needed for resolution'
    }
  }
}

await auditService.log(iso27001Event)
```

### FedRAMP Compliance

Implement FedRAMP audit requirements for government systems:

```typescript
// FedRAMP requires detailed system boundary logging
const fedRampEvent = {
  principalId: 'fed-user-123',
  action: 'system.boundary.cross',
  status: 'success',
  fedRampContext: {
    systemBoundary: {
      source: 'system-a-moderate',
      destination: 'system-b-high',
      authorizationBoundary: 'Package-A-ATO-2024'
    },
    dataFlow: {
      classification: 'CUI', // Controlled Unclassified Information
      markings: ['CUI//SP-HLTH'], // Health information
      dataTypes: ['patient-demographics']
    },
    continuousMonitoring: {
      riskAssessment: 'low',
      complianceStatus: 'compliant',
      lastAssessment: '2024-01-01T00:00:00Z'
    }
  }
}

await auditService.log(fedRampEvent)
```

## Data Loss Prevention (DLP)

### Sensitive Data Detection

Detect and log sensitive data access attempts:

```typescript
class DataLossPreventionLogger {
  private sensitiveDataPatterns = {
    ssn: /\b\d{3}-\d{2}-\d{4}\b/,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
    medicalRecordNumber: /\bMRN[:\s]*\d{6,}\b/i,
    patientId: /\bPID[:\s]*\d+\b/i
  }
  
  async scanAndLog(data: string, context: any) {
    const detectedPatterns = []
    
    for (const [type, pattern] of Object.entries(this.sensitiveDataPatterns)) {
      if (pattern.test(data)) {
        detectedPatterns.push(type)
      }
    }
    
    if (detectedPatterns.length > 0) {
      await auditService.log({
        principalId: context.principalId,
        action: 'dlp.sensitive_data.detected',
        status: 'warning',
        dlpContext: {
          detectedTypes: detectedPatterns,
          dataLength: data.length,
          hash: this.generateDataHash(data), // For tracking without storing content
          source: context.source,
          destination: context.destination
        }
      })
    }
  }
  
  private generateDataHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex')
  }
}
```

### Data Exfiltration Detection

Monitor for unusual data export patterns:

```typescript
class ExfiltrationDetector {
  async monitorDataExport(userId: string, exportDetails: any) {
    const recentExports = await this.getRecentExports(userId, 24 * 60 * 60 * 1000) // 24 hours
    
    const signals = {
      highVolume: recentExports.totalRecords > 10000,
      afterHours: this.isAfterHours(new Date()),
      unusualDestination: !this.isApprovedDestination(exportDetails.destination),
      rapidSuccession: recentExports.count > 5,
      sensitiveData: exportDetails.containsPHI
    }
    
    const riskLevel = this.calculateExfiltrationRisk(signals)
    
    await auditService.log({
      principalId: userId,
      action: 'data.export',
      status: riskLevel > 0.7 ? 'warning' : 'success',
      exportContext: {
        recordCount: exportDetails.recordCount,
        dataTypes: exportDetails.dataTypes,
        destination: exportDetails.destination,
        riskSignals: Object.keys(signals).filter(k => signals[k]),
        riskLevel
      }
    })
    
    if (riskLevel > 0.8) {
      await this.alertSecurityTeam('High risk data export detected', {
        userId,
        exportDetails,
        riskLevel
      })
    }
  }
}
```

## Regulatory Audit Preparation

### Audit Trail Completeness

Ensure comprehensive audit trails for regulatory review:

```typescript
class RegulatoryAuditPreparation {
  async generateComplianceReport(regulation: 'HIPAA' | 'GDPR' | 'SOX', dateRange: DateRange) {
    const requiredFields = this.getRequiredFields(regulation)
    const auditEvents = await this.getAuditEvents(dateRange)
    
    const complianceGaps = []
    
    for (const event of auditEvents) {
      const missingFields = requiredFields.filter(field => !event[field])
      if (missingFields.length > 0) {
        complianceGaps.push({
          eventId: event.id,
          missingFields,
          severity: this.assessGapSeverity(missingFields, regulation)
        })
      }
    }
    
    // Log compliance assessment
    await auditService.log({
      principalId: 'compliance-system',
      action: 'compliance.assessment.generated',
      status: complianceGaps.length === 0 ? 'success' : 'warning',
      complianceReport: {
        regulation,
        dateRange,
        totalEvents: auditEvents.length,
        compliantEvents: auditEvents.length - complianceGaps.length,
        gapCount: complianceGaps.length,
        criticalGaps: complianceGaps.filter(g => g.severity === 'critical').length
      }
    })
    
    return {
      regulation,
      summary: {
        totalEvents: auditEvents.length,
        compliantEvents: auditEvents.length - complianceGaps.length,
        complianceRate: ((auditEvents.length - complianceGaps.length) / auditEvents.length) * 100
      },
      gaps: complianceGaps
    }
  }
  
  private getRequiredFields(regulation: string): string[] {
    const requirements = {
      HIPAA: ['principalId', 'action', 'targetResourceType', 'targetResourceId', 'timestamp', 'status'],
      GDPR: ['principalId', 'action', 'dataSubjectId', 'legalBasis', 'timestamp', 'status'],
      SOX: ['principalId', 'action', 'financialImpact', 'approvalChain', 'timestamp', 'status']
    }
    return requirements[regulation] || []
  }
}
```

### Immutable Audit Store

Implement blockchain-like immutability for critical audits:

```typescript
class ImmutableAuditStore {
  private chainHash: string = '0'
  
  async appendToChain(event: AuditEvent): Promise<string> {
    // Create event hash including previous chain hash
    const eventData = JSON.stringify({
      ...event,
      previousHash: this.chainHash,
      nonce: this.generateNonce()
    })
    
    const eventHash = crypto.createHash('sha256').update(eventData).digest('hex')
    
    // Store in immutable format
    await this.storeImmutableEvent({
      ...event,
      chainHash: eventHash,
      previousHash: this.chainHash,
      blockIndex: await this.getNextBlockIndex()
    })
    
    this.chainHash = eventHash
    
    // Log the immutable storage
    await auditService.log({
      principalId: 'immutable-store',
      action: 'audit.immutable.stored',
      status: 'success',
      immutableContext: {
        eventHash,
        previousHash: this.chainHash,
        verified: await this.verifyChainIntegrity()
      }
    })
    
    return eventHash
  }
  
  async verifyChainIntegrity(): Promise<boolean> {
    const events = await this.getAllChainEvents()
    let previousHash = '0'
    
    for (const event of events) {
      const expectedHash = this.calculateEventHash(event, previousHash)
      if (event.chainHash !== expectedHash) {
        await auditService.log({
          principalId: 'immutable-store',
          action: 'audit.chain.integrity.violation',
          status: 'failure',
          violationDetails: {
            eventId: event.id,
            expectedHash,
            actualHash: event.chainHash
          }
        })
        return false
      }
      previousHash = event.chainHash
    }
    
    return true
  }
}
```

By implementing these advanced security patterns and compliance frameworks, your audit system will provide enterprise-grade protection for sensitive healthcare data while maintaining strict regulatory compliance. These practices ensure comprehensive security monitoring, threat detection, and audit trail integrity required for modern healthcare environments.
