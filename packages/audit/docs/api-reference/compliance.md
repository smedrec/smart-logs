# Compliance API Reference

Complete API documentation for the compliance engine in the `@repo/audit` package. This reference provides detailed information about HIPAA and GDPR compliance systems, automated validation, reporting, and data lifecycle management.

## 📋 Overview

The compliance engine supports comprehensive HIPAA and GDPR requirements with automated validation, reporting, data lifecycle management, and regulatory compliance tracking for healthcare audit environments.

## 🏥 HIPAA Compliance System

### Core Interfaces

```typescript
interface HIPAAValidationConfig {
  enabled: boolean
  requiredFields: string[]
  retentionPeriod: number
  autoDetectPHI: boolean
  enforceMinimumNecessary: boolean
  validateBAA: boolean
}

interface PHIAccessEvent extends AuditLogEvent {
  patientId?: string
  accessReason?: string
  minimumNecessaryJustification?: string
  emergencyAccess?: boolean
  professionalRole?: string
  treatmentRelationship?: boolean
}

interface HIPAAComplianceReport extends ComplianceReport {
  reportType: 'HIPAA_AUDIT_TRAIL'
  hipaaSpecific: {
    phiAccessEvents: number
    phiModificationEvents: number
    unauthorizedAttempts: number
    emergencyAccess: number
    breakGlassEvents: number
    minimumNecessaryViolations: number
  }
  riskAssessment: {
    highRiskEvents: ComplianceReportEvent[]
    suspiciousPatterns: SuspiciousPattern[]
    recommendations: string[]
  }
}
```

### HIPAAComplianceService

```typescript
class HIPAAComplianceService {
  constructor(config: HIPAAValidationConfig)
  
  /** Validate audit event for HIPAA compliance */
  validateEvent(event: AuditLogEvent): HIPAAValidationResult
  
  /** Log PHI access with compliance validation */
  logPHIAccess(event: PHIAccessEvent): Promise<void>
  
  /** Generate HIPAA compliance report */
  generateComplianceReport(criteria: ReportCriteria): Promise<HIPAAComplianceReport>
  
  /** Check minimum necessary access compliance */
  validateMinimumNecessary(event: AuditLogEvent): boolean
  
  /** Get HIPAA retention policy for event */
  getRetentionPolicy(event: AuditLogEvent): RetentionPolicy
}
```

## 🌍 GDPR Compliance System

### Core Interfaces

```typescript
type DataSubjectRightType = 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction'
type GDPRExportFormat = 'json' | 'csv' | 'xml'
type LegalBasisType = 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests'

interface GDPRDataExportRequest {
  principalId: string
  organizationId: string
  requestType: DataSubjectRightType
  format: GDPRExportFormat
  dateRange?: { start: string; end: string }
  includeMetadata?: boolean
  requestedBy: string
  requestTimestamp: string
}

interface GDPRDataExport {
  requestId: string
  principalId: string
  organizationId: string
  exportTimestamp: string
  format: GDPRExportFormat
  recordCount: number
  dataSize: number
  data: Buffer
  metadata: {
    dateRange: { start: string; end: string }
    categories: string[]
    retentionPolicies: string[]
    exportedBy: string
  }
}

interface GDPRComplianceReport extends ComplianceReport {
  reportType: 'GDPR_PROCESSING_ACTIVITIES'
  gdprSpecific: {
    personalDataEvents: number
    dataSubjectRights: number
    consentEvents: number
    dataBreaches: number
    crossBorderTransfers: number
    retentionViolations: number
  }
  legalBasisBreakdown: Record<LegalBasisType, number>
  dataSubjectRights: {
    accessRequests: number
    rectificationRequests: number
    erasureRequests: number
    portabilityRequests: number
    objectionRequests: number
  }
}
```

### GDPRComplianceService

```typescript
class GDPRComplianceService {
  constructor(client: EnhancedAuditDatabaseClient, audit: Audit, kms: InfisicalKmsClient)
  
  /** Export user data for GDPR compliance */
  exportUserData(request: GDPRDataExportRequest): Promise<GDPRDataExport>
  
  /** Process data rectification request */
  rectifyUserData(request: DataRectificationRequest): Promise<RectificationResult>
  
  /** Process data erasure request */
  eraseUserData(request: DataErasureRequest): Promise<ErasureResult>
  
  /** Validate GDPR compliance for event */
  validateGDPRCompliance(event: AuditLogEvent): GDPRValidationResult
  
  /** Generate GDPR compliance report */
  generateGDPRReport(criteria: ReportCriteria): Promise<GDPRComplianceReport>
  
  /** Pseudonymize personal data */
  pseudonymizeData(data: any, strategy: PseudonymizationStrategy): Promise<PseudonymizationResult>
  
  /** Apply retention policy */
  applyRetentionPolicy(policy: RetentionPolicy): Promise<ArchivalResult>
  
  /** Track legal basis for processing */
  trackLegalBasis(event: AuditLogEvent, legalBasis: LegalBasisType): Promise<void>
}
```

## 📊 Compliance Reporting System

### Core Reporting Interfaces

```typescript
interface ReportCriteria {
  dateRange: { startDate: string; endDate: string }
  principalIds?: string[]
  organizationIds?: string[]
  actions?: string[]
  dataClassifications?: DataClassification[]
  statuses?: Array<'attempt' | 'success' | 'failure'>
  resourceTypes?: string[]
  verifiedOnly?: boolean
  includeIntegrityFailures?: boolean
  limit?: number
  offset?: number
  sortBy?: 'timestamp' | 'status'
  sortOrder?: 'asc' | 'desc'
}

interface ComplianceReport {
  metadata: {
    reportId: string
    reportType: string
    generatedAt: string
    generatedBy?: string
    criteria: ReportCriteria
    totalEvents: number
  }
  summary: {
    eventsByStatus: Record<string, number>
    eventsByAction: Record<string, number>
    eventsByDataClassification: Record<string, number>
    uniquePrincipals: number
    uniqueResources: number
    integrityViolations: number
    timeRange: { earliest: string; latest: string }
  }
  events: ComplianceReportEvent[]
  integrityReport?: IntegrityVerificationReport
}
```

### ComplianceReportingService

```typescript
class ComplianceReportingService {
  /** Generate HIPAA compliance report */
  generateHIPAAReport(criteria: ReportCriteria): Promise<HIPAAComplianceReport>
  
  /** Generate GDPR compliance report */
  generateGDPRReport(criteria: ReportCriteria): Promise<GDPRComplianceReport>
  
  /** Generate integrity verification report */
  generateIntegrityReport(criteria: ReportCriteria): Promise<IntegrityVerificationReport>
  
  /** Schedule automated report generation */
  scheduleReport(template: ReportTemplate): Promise<string>
  
  /** Get scheduled reports */
  getScheduledReports(): Promise<ScheduledReport[]>
  
  /** Cancel scheduled report */
  cancelScheduledReport(reportId: string): Promise<boolean>
}
```

## 🔄 Data Lifecycle Management

### Retention Policy Management

```typescript
interface RetentionPolicy {
  policyName: string
  dataClassification: DataClassification
  retentionDays: number
  archiveAfterDays?: number
  deleteAfterDays?: number
  isActive: boolean
  metadata: {
    createdBy: string
    createdAt: string
    lastApplied?: string
  }
}

interface ArchivalResult {
  recordsArchived: number
  recordsDeleted: number
  archivedAt: string
  policy: string
  summary: {
    byClassification: Record<string, number>
    byAction: Record<string, number>
    dateRange: { start: string; end: string }
  }
}

class DataLifecycleService {
  /** Apply retention policy */
  applyRetentionPolicy(policy: RetentionPolicy): Promise<ArchivalResult>
  
  /** Get retention policies */
  getRetentionPolicies(): Promise<RetentionPolicy[]>
  
  /** Create retention policy */
  createRetentionPolicy(policy: RetentionPolicy): Promise<string>
  
  /** Update retention policy */
  updateRetentionPolicy(policyId: string, policy: RetentionPolicy): Promise<boolean>
  
  /** Preview policy impact */
  previewPolicyImpact(policy: RetentionPolicy): Promise<PolicyImpactPreview>
}
```

## 💡 Usage Examples

### HIPAA Compliance Example

```typescript
import { HIPAAComplianceService, PHIAccessEvent } from '@repo/audit'

const hipaaService = new HIPAAComplianceService({
  enabled: true,
  requiredFields: ['principalId', 'action', 'targetResourceType'],
  retentionPeriod: 2190, // 6 years
  autoDetectPHI: true,
  enforceMinimumNecessary: true,
  validateBAA: true
})

// Log PHI access
const phiEvent: PHIAccessEvent = {
  timestamp: new Date().toISOString(),
  principalId: 'dr.smith@hospital.com',
  action: 'fhir.patient.read',
  targetResourceType: 'Patient',
  targetResourceId: 'patient-123',
  status: 'success',
  patientId: 'patient-123',
  accessReason: 'routine_checkup',
  minimumNecessaryJustification: 'Reviewing vitals',
  dataClassification: 'PHI'
}

await hipaaService.logPHIAccess(phiEvent)

// Generate report
const report = await hipaaService.generateComplianceReport({
  dateRange: {
    startDate: '2023-10-01T00:00:00.000Z',
    endDate: '2023-10-31T23:59:59.999Z'
  },
  dataClassifications: ['PHI']
})
```

### GDPR Compliance Example

```typescript
import { GDPRComplianceService, GDPRDataExportRequest } from '@repo/audit'

const gdprService = new GDPRComplianceService(dbClient, audit, kms)

// Export user data
const exportRequest: GDPRDataExportRequest = {
  principalId: 'user-456',
  organizationId: 'org-789',
  requestType: 'portability',
  format: 'json',
  includeMetadata: true,
  requestedBy: 'user-456',
  requestTimestamp: new Date().toISOString()
}

const exportResult = await gdprService.exportUserData(exportRequest)
console.log(`Exported ${exportResult.recordCount} records`)

// Generate GDPR report
const gdprReport = await gdprService.generateGDPRReport({
  dateRange: {
    startDate: '2023-01-01T00:00:00.000Z',
    endDate: '2023-12-31T23:59:59.999Z'
  },
  organizationIds: ['org-789']
})
```

### Data Lifecycle Example

```typescript
import { DataLifecycleService, RetentionPolicy } from '@repo/audit'

const lifecycleService = new DataLifecycleService(dbClient)

const phiPolicy: RetentionPolicy = {
  policyName: 'PHI_HIPAA_Retention',
  dataClassification: 'PHI',
  retentionDays: 2190, // 6 years
  archiveAfterDays: 1095, // 3 years
  isActive: true,
  metadata: {
    createdBy: 'compliance-officer',
    createdAt: new Date().toISOString()
  }
}

// Create and apply policy
const policyId = await lifecycleService.createRetentionPolicy(phiPolicy)
const result = await lifecycleService.applyRetentionPolicy(phiPolicy)
console.log(`Archived ${result.recordsArchived} records`)
```

## 🔗 Related APIs

- **[Configuration](./configuration.md)** - Compliance configuration setup
- **[Monitoring](./monitoring.md)** - Compliance monitoring and alerting
- **[Cryptography](./cryptography.md)** - Data integrity for compliance
- **[Utilities](./utilities.md)** - Compliance utility functions

## 📚 Compliance Standards

### HIPAA Requirements
- **45 CFR § 164.312(b)** - Audit controls and access management
- **45 CFR § 164.308(a)(1)(ii)(D)** - Information access management  
- **45 CFR § 164.312(c)(1)** - Integrity controls for PHI

### GDPR Requirements
- **Article 17** - Right to erasure ("right to be forgotten")
- **Article 20** - Right to data portability
- **Article 25** - Data protection by design and by default
- **Article 30** - Records of processing activities

For detailed compliance setup guides, see the [Compliance Configuration Guide](../guides/compliance-configuration.md).
