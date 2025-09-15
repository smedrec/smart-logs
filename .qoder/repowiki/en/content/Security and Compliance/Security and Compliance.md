# Security and Compliance

<cite>
**Referenced Files in This Document**   
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts) - *Updated in recent commit*
- [gdpr-utils.ts](file://packages\audit\src\gdpr\gdpr-utils.ts) - *Updated in recent commit*
- [schema.ts](file://packages\audit-db\src\db\schema.ts)
- [pseudonym_mapping.sql](file://packages\audit-db\drizzle\migrations\0006_silly_tyger_tiger.sql) - *Added in recent commit*
- [client.ts](file://packages\infisical-kms\src\client.ts) - *KMS integration for pseudonymization*
</cite>

## Update Summary
**Changes Made**   
- Added comprehensive documentation for GDPR pseudonymization implementation including service architecture, strategies, and audit trails
- Enhanced data minimization section with details on persistent pseudonym mapping storage and KMS encryption
- Updated code examples to reflect current pseudonymization implementation with KMS integration
- Added new section on pseudonymization strategies and their implementation
- Updated sequence diagram to show KMS encryption in pseudonym mapping storage
- Maintained existing structure while incorporating new pseudonymization features

## Table of Contents
1. [Introduction](#introduction)
2. [GDPR Compliance Implementation](#gdpr-compliance-implementation)
3. [HIPAA Compliance Features](#hipaa-compliance-features)
4. [Security Measures](#security-measures)
5. [Compliance Reporting and Data Export](#compliance-reporting-and-data-export)
6. [Relationships Between Compliance Modules](#relationships-between-compliance-modules)
7. [Common Compliance Issues and Solutions](#common-compliance-issues-and-solutions)
8. [Best Practices for Production Compliance](#best-practices-for-production-compliance)

## Introduction
The Smart Logs system provides comprehensive security and compliance features designed to meet regulatory requirements including GDPR and HIPAA. The architecture implements data protection principles such as data minimization, right to erasure, consent tracking, and audit logging through a modular system of compliance services, cryptographic integrity verification, and automated reporting. This document details the implementation of these features across the codebase, focusing on practical examples and integration patterns.

## GDPR Compliance Implementation

The GDPR compliance implementation follows privacy-by-design principles with specific features for data subject rights, data minimization, and consent tracking.

### Right to Erasure Implementation
The system implements the right to erasure through a sophisticated pseudonymization approach that preserves compliance audit trails while removing personally identifiable information.

```mermaid
sequenceDiagram
participant User as "Data Subject"
participant Admin as "Administrator"
participant GDPRService as "GDPRComplianceService"
participant KMS as "InfisicalKMS"
participant DB as "Audit Database"
Admin->>GDPRService : deleteUserDataWithAuditTrail(principalId)
GDPRService->>DB : Query compliance-critical records
DB-->>GDPRService : Return login, access, and GDPR action records
GDPRService->>GDPRService : pseudonymizeUserData(principalId)
GDPRService->>KMS : encrypt(originalId)
KMS-->>GDPRService : Return encrypted originalId
GDPRService->>DB : Store pseudonym mapping with encrypted originalId
GDPRService->>DB : Update records with pseudonymized ID
GDPRService->>DB : Delete non-compliance records
GDPRService->>GDPRService : logGDPRActivity()
GDPRService-->>Admin : Return deletion summary
Note over GDPRService : Compliance records preserved<br/>via pseudonymization with<br/>KMS-encrypted mapping storage
```

**Section sources**
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts#L380-L470)

### Data Minimization and Pseudonymization
The system implements data minimization through pseudonymization strategies that replace personally identifiable information with artificial identifiers while maintaining referential integrity. The implementation includes persistent storage of pseudonym mappings in an encrypted format using KMS integration.

```mermaid
classDiagram
class GDPRComplianceService {
+pseudonymizeUserData(principalId, strategy)
+getOriginalId(pseudonymId)
+deleteUserDataWithAuditTrail()
-generatePseudonymId(originalId, strategy)
}
class PseudonymizationMapping {
+originalId : string
+pseudonymId : string
+strategy : PseudonymizationStrategy
+createdAt : string
}
class InfisicalKmsClient {
+encrypt(plaintext)
+decrypt(ciphertext)
+sign(data)
+verify(signature)
}
class AuditDatabase {
+pseudonym_mapping table
+audit_log table
}
GDPRComplianceService --> InfisicalKmsClient : "uses for encryption"
GDPRComplianceService --> AuditDatabase : "stores mappings"
InfisicalKmsClient --> PseudonymizationMapping : "encrypts originalId"
AuditDatabase --> PseudonymizationMapping : "contains"
```

**Section sources**
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts#L100-L150)
- [schema.ts](file://packages\audit-db\src\db\schema.ts#L643-L658)
- [pseudonym_mapping.sql](file://packages\audit-db\drizzle\migrations\0006_silly_tyger_tiger.sql)
- [client.ts](file://packages\infisical-kms\src\client.ts)

### Pseudonymization Strategies
The system implements multiple pseudonymization strategies to accommodate different security and performance requirements.

**Hash Strategy**: Uses SHA-256 hashing with salt to create deterministic pseudonyms. This strategy ensures the same original ID always produces the same pseudonym, enabling consistent referential integrity.

```typescript
private generatePseudonymId(originalId: string, strategy: PseudonymizationStrategy): string {
  switch (strategy) {
    case 'hash':
      return `pseudo-${createHash('sha256')
        .update(originalId + process.env.PSEUDONYM_SALT || 'default-salt')
        .digest('hex')
        .substring(0, 16)}`
```

**Token Strategy**: Generates random hexadecimal tokens for non-deterministic pseudonymization. This approach provides stronger privacy protection as it prevents reverse engineering through hash comparison.

```typescript
case 'token':
  return `pseudo-${randomBytes(16).toString('hex')}`
```

**Encryption Strategy**: Uses KMS-managed encryption keys to encrypt original IDs. This strategy provides the highest security level and enables authorized reversal of pseudonymization when required for compliance investigations.

```typescript
case 'encryption':
  const encryptedOriginalId = await this.kms.encrypt(principalId)
  await this.db.insert(pseudonymMapping).values({
    timestamp: new Date().toISOString(),
    pseudonymId,
    originalId: encryptedOriginalId.ciphertext,
  })
```

**Section sources**
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts#L524-L572)
- [gdpr-utils.ts](file://packages\audit\src\gdpr\gdpr-utils.ts#L4-L25)

### Consent Tracking Implementation
The system tracks consent through the `gdprContext` field in audit events, which captures legal basis, processing purpose, and data categories.

```mermaid
flowchart TD
Start([Consent Event]) --> ValidateGDPR["validateGDPR(event)"]
ValidateGDPR --> CheckPersonalData{"Personal Data Processing?"}
CheckPersonalData --> |Yes| CheckLegalBasis{"Legal Basis Provided?"}
CheckLegalBasis --> |Yes| StoreConsent["Store legalBasis in gdprContext"]
CheckLegalBasis --> |No| CheckDefault["Default Legal Basis Configured?"]
CheckDefault --> |Yes| ApplyDefault["Apply defaultLegalBasis"]
CheckDefault --> |No| ThrowError["Throw Compliance Error"]
StoreConsent --> End([Event Processed])
ApplyDefault --> End
ThrowError --> End
```

**Section sources**
- [compliance.ts](file://packages\audit-sdk\src\compliance.ts#L100-L130)

## HIPAA Compliance Features

The system implements HIPAA compliance through strict audit logging requirements, PHI data classification, and healthcare-specific audit trails.

### Healthcare Audit Logging
The HIPAA compliance implementation enforces specific requirements for protected health information (PHI) access and modification events.

```mermaid
sequenceDiagram
participant System as "Application"
participant Validator as "ComplianceValidator"
participant DB as "Audit Database"
System->>Validator : validateCompliance(event, 'hipaa')
Validator->>Validator : validateHIPAA(event)
Validator->>Validator : Check required fields
Validator->>Validator : Validate PHI classification
Validator->>Validator : Validate session context
Validator->>Validator : Set retention policy
Validator-->>System : Validation successful
System->>DB : Store audit event
Note over Validator : All PHI events require<br/>principalId, action, targetResource,<br/>timestamp, and sessionContext
```

**Section sources**
- [compliance.ts](file://packages\audit-sdk\src\compliance.ts#L40-L80)

### PHI Data Classification
The system identifies PHI resources through a predefined list of healthcare resource types and enforces appropriate data classification.

```mermaid
classDiagram
class AuditLogEvent {
+dataClassification? : DataClassification
+targetResourceType? : string
+sessionContext? : SessionContext
+retentionPolicy? : string
}
class DataClassification {
<<enumeration>>
PUBLIC
INTERNAL
CONFIDENTIAL
PHI
}
class SessionContext {
+sessionId : string
+ipAddress : string
+userAgent : string
+geolocation? : string
}
AuditLogEvent --> DataClassification : "uses"
AuditLogEvent --> SessionContext : "contains"
```

**Section sources**
- [types.ts](file://packages\audit\src\types.ts#L10-L50)
- [schema.ts](file://packages\audit-db\src\db\schema.ts#L20-L30)

## Security Measures

The system implements multiple security measures to protect data integrity and ensure secure access.

### Data Encryption and Integrity
The system ensures data integrity through cryptographic hashing and provides options for data encryption in exports. The Infisical KMS integration uses RSASSA_PSS_SHA_256 as the default signing algorithm for enhanced security. Pseudonym mappings are encrypted using KMS before storage.

```mermaid
flowchart TD
A([Audit Event]) --> B["generateEventHash(event)"]
B --> C["SHA-256 Hash"]
C --> D["Store hash in audit_log"]
D --> E["verifyEventHash(event, storedHash)"]
E --> F{"Hash Match?"}
F --> |Yes| G["Integrity Verified"]
F --> |No| H["Integrity Failure"]
H --> I["Log to auditIntegrityLog"]
I --> J["Generate Integrity Report"]
```

**Section sources**
- [compliance-reporting.ts](file://packages\audit\src\report\compliance-reporting.ts#L300-L400)
- [schema.ts](file://packages\audit-db\src\db\schema.ts#L50-L70)
- [client.ts](file://packages\infisical-kms\src\client.ts#L100-L120)

### Secure Authentication and Access Controls
The system implements secure authentication through audit logging of all authentication events and role-based access controls.

```mermaid
classDiagram
class AuthAuditAction {
<<enumeration>>
auth.login.attempt
auth.login.success
auth.login.failure
auth.logout
auth.password.change
auth.mfa.enabled
auth.mfa.disabled
auth.session.expired
auth.session.revoked
}
class AuditLogEvent {
+principalId? : string
+action : string
+status : AuditEventStatus
+correlationId? : string
}
class SessionContext {
+sessionId : string
+ipAddress : string
+userAgent : string
}
AuditLogEvent --> AuthAuditAction : "action"
AuditLogEvent --> SessionContext : "sessionContext"
```

**Section sources**
- [types.ts](file://packages\audit\src\types.ts#L150-L180)

## Compliance Reporting and Data Export

The system provides comprehensive compliance reporting and data export capabilities for regulatory requirements.

### Usage Patterns for Compliance Reporting
The reporting system supports various compliance reporting use cases with configurable criteria and delivery options.

```mermaid
sequenceDiagram
participant Admin as "Administrator"
participant ReportService as "ComplianceReportingService"
participant DB as "Database"
participant Scheduler as "Inngest Scheduler"
Admin->>ReportService : configureScheduledReport()
ReportService->>DB : Store in scheduledReports table
Scheduler->>ReportService : triggerScheduledReport()
ReportService->>DB : Query events with criteria
DB-->>ReportService : Return audit events
ReportService->>ReportService : generateHIPAAReport()
ReportService->>ReportService : generateIntegrityVerificationReport()
ReportService->>Admin : Deliver report via email/webhook
Note over ReportService : Reports can be scheduled<br/>daily, weekly, monthly,<br/>or quarterly
```

**Section sources**
- [compliance-reporting.ts](file://packages\audit\src\report\compliance-reporting.ts#L200-L300)
- [schema.ts](file://packages\audit-db\src\db\schema.ts#L500-L550)

### Data Export Implementation
The GDPR data export feature provides data subject access requests in multiple formats with metadata preservation.

```mermaid
flowchart TD
A([Export Request]) --> B["exportUserData(request)"]
B --> C["Query auditLog table"]
C --> D["Format as JSON/CSV/XML"]
D --> E["Include metadata"]
E --> F["Log export activity"]
F --> G["Return GDPRDataExport"]
G --> H["Download or Email"]
Note over D: Supports JSON, CSV, and XML<br/>formats with optional metadata
```

**Section sources**
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts#L180-L250)

## Relationships Between Compliance Modules

The compliance system consists of interconnected modules that work together to provide comprehensive regulatory compliance.

```mermaid
graph TD
A[Application] --> B[Audit SDK]
B --> C[Compliance Validation]
C --> D[GDPR Compliance]
C --> E[HIPAA Compliance]
C --> F[Custom Compliance]
D --> G[GDPRComplianceService]
E --> H[ComplianceReportingService]
G --> I[Audit Database]
H --> I
I --> J[Scheduled Reports]
J --> K[Report Delivery]
K --> L[Email/Webhook/Storage]
H --> M[Integrity Verification]
M --> N[Audit Integrity Log]
G --> O[Data Retention Policies]
O --> P[Archival System]
style A fill:#f9f,stroke:#333
style L fill:#bbf,stroke:#333
style P fill:#bbf,stroke:#333
```

**Section sources**
- [compliance.ts](file://packages\audit-sdk\src\compliance.ts)
- [compliance-reporting.ts](file://packages\audit\src\report\compliance-reporting.ts)
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts)
- [schema.ts](file://packages\audit-db\src\db\schema.ts)

## Common Compliance Issues and Solutions

This section addresses common regulatory compliance challenges and their implementations in the system.

### Issue: Balancing Right to Erasure with Audit Requirements
**Problem**: GDPR's right to erasure conflicts with regulatory requirements to maintain audit trails.

**Solution**: The system implements pseudonymization of compliance-critical records while deleting non-essential personal data. Pseudonym mappings are stored in a dedicated encrypted table with KMS integration.

```typescript
async deleteUserDataWithAuditTrail(
  principalId: string,
  requestedBy: string,
  preserveComplianceAudits: boolean = true
): Promise<{ recordsDeleted: number; complianceRecordsPreserved: number }> {
  // Identify compliance-critical records to preserve
  const complianceActions = [
    'auth.login.success',
    'auth.login.failure',
    'data.access.unauthorized',
    'gdpr.data.export',
    'gdpr.data.pseudonymize',
    'gdpr.data.delete',
  ]

  // Pseudonymize compliance records instead of deleting
  const pseudonymResult = await this.pseudonymizeUserData(principalId, 'hash', requestedBy)
  
  // Delete non-compliance records
  const deleteResult = await this.db
    .delete(auditLog)
    .where(
      and(
        eq(auditLog.principalId, principalId),
        sql`NOT (${auditLog.action} = ANY(${complianceActions}))`
      )
    )
}
```

**Section sources**
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts#L380-L470)
- [schema.ts](file://packages\audit-db\src\db\schema.ts#L643-L658)
- [pseudonym_mapping.sql](file://packages\audit-db\drizzle\migrations\0006_silly_tyger_tiger.sql)

### Issue: Ensuring Data Minimization in Audit Logs
**Problem**: Collecting excessive data in audit logs violates GDPR's data minimization principle.

**Solution**: The system implements field validation and only collects necessary information for compliance purposes.

```typescript
function validateGDPR(event: Partial<AuditLogEvent>, gdprConfig?: ComplianceConfig['gdpr']): void {
  // Set retention policy for all events
  if (!event.retentionPolicy && gdprConfig.retentionDays) {
    event.retentionPolicy = `gdpr-${gdprConfig.retentionDays}-days`
  }

  // Check for personal data processing
  if (isPersonalDataProcessing(event)) {
    // Require legal basis
    if (!event.gdprContext?.legalBasis) {
      if (gdprConfig.defaultLegalBasis) {
        event.gdprContext = {
          ...event.gdprContext,
          legalBasis: gdprConfig.defaultLegalBasis,
        }
      } else {
        throw new Error('GDPR Compliance Error: Legal basis required for personal data processing')
      }
    }
  }
}
```

**Section sources**
- [compliance.ts](file://packages\audit-sdk\src\compliance.ts#L100-L130)

## Best Practices for Production Compliance

This section outlines best practices for maintaining compliance in production deployments.

### Regular Compliance Audits
Conduct regular audits of the system to ensure ongoing compliance with regulatory requirements.

**Recommendations:**
- Schedule automated HIPAA and GDPR reports monthly
- Verify integrity of audit logs quarterly
- Review retention policies annually
- Test right to erasure procedures regularly

### Monitoring and Alerting
Implement monitoring for compliance-related events and potential violations.

```mermaid
flowchart TD
A[Security Event] --> B{Compliance Rule Match?}
B --> |Yes| C[Generate Alert]
C --> D[Send to Security Team]
C --> E[Log to Alerts Table]
B --> |No| F[Store in Audit Log]
D --> G[Investigate and Remediate]
G --> H[Update Compliance Rules]
H --> I[Prevent Future Issues]
```

**Section sources**
- [schema.ts](file://packages\audit-db\src\db\schema.ts#L400-L450)

### Data Retention Management
Implement proper data retention policies to comply with regulatory requirements.

**Implementation:**
- Configure retention policies based on data classification
- Automate archival and deletion processes
- Maintain logs of retention policy applications
- Ensure backup systems follow the same retention rules

```typescript
async applyRetentionPolicies(): Promise<ArchivalResult[]> {
  // Get active retention policies
  const policies = await this.client.executeOptimizedQuery(
    (db) =>
      db.select().from(auditRetentionPolicy).where(eq(auditRetentionPolicy.isActive, 'true')),
    { cacheKey: 'active_retention_policies', cacheTTL: 3600 }
  )

  for (const policy of retentionPolicies) {
    const result = await this.applyRetentionPolicy(policy as RetentionPolicy)
    results.push(result)
  }
}
```

**Section sources**
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts#L280-L320)