# HIPAA Compliance

<cite>
**Referenced Files in This Document**   
- [audit.md](file://apps/docs/src/content/docs/audit/audit.md)
- [audit-sdk.md](file://apps/docs/src/content/docs/audit/audit-sdk.md)
- [audit-db.md](file://apps/docs/src/content/docs/audit/audit-db.md)
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts)
- [compliance.ts](file://apps/server/src/routers/compliance.ts)
- [reports.test.ts](file://apps/server/src/routers/__tests__/reports.test.ts)
- [hipaa.tsx](file://apps/web/src/routes/dashboard/compliance/hipaa.tsx)
- [compliance.test.ts](file://packages/audit-sdk/src/__tests__/compliance.test.ts)
- [validation.ts](file://packages/audit/src/validation.ts)
- [types.ts](file://packages/audit/src/types.ts)
- [compliance-reporting.ts](file://packages/audit/src/report/compliance-reporting.ts)
- [preset-types.ts](file://packages/audit/src/preset/preset-types.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Core Audit Architecture](#core-audit-architecture)
3. [PHI Data Handling and Classification](#phi-data-handling-and-classification)
4. [HIPAA Compliance Enforcement](#hipaa-compliance-enforcement)
5. [Audit Event Generation and Validation](#audit-event-generation-and-validation)
6. [Compliance Reporting System](#compliance-reporting-system)
7. [Audit Presets for Healthcare](#audit-presets-for-healthcare)
8. [Frontend-Backend Integration](#frontend-backend-integration)
9. [Configuration and Best Practices](#configuration-and-best-practices)
10. [Troubleshooting and Error Handling](#troubleshooting-and-error-handling)

## Introduction

The SMEDREC platform implements a comprehensive HIPAA compliance system centered around audit logging, access control, and data integrity verification. This documentation details the implementation of audit controls for protected health information (PHI), covering access logging, integrity checks, security incident reporting, and compliance reporting. The system is designed to meet HIPAA Security Rule requirements through robust audit trails, user authentication logs, and unauthorized access detection mechanisms.

The audit system is built on a modular architecture with three core packages: `@repo/audit` for low-level audit functionality, `@repo/audit-sdk` for high-level compliance features, and `@repo/audit-db` for database operations. This layered approach enables both granular control and simplified integration, supporting healthcare-specific requirements like FHIR resource handling and PHI data classification.

**Section sources**
- [audit.md](file://apps/docs/src/content/docs/audit/audit.md)
- [audit-sdk.md](file://apps/docs/src/content/docs/audit/audit-sdk.md)

## Core Audit Architecture

The audit system follows a layered architecture with distinct components handling different aspects of compliance logging. The core components work together to ensure reliable, secure, and compliant audit trail generation.

```mermaid
graph TB
subgraph "Frontend Applications"
WebApp[Web Application]
NativeApp[Native Application]
end
subgraph "Backend Services"
API[API Server]
Worker[Audit Worker]
end
subgraph "Data Storage"
Redis[(Redis Queue)]
PostgreSQL[(PostgreSQL Database)]
end
WebApp --> API
NativeApp --> API
API --> Redis
API --> |Direct Write| PostgreSQL
Redis --> Worker
Worker --> PostgreSQL
PostgreSQL --> |Reporting| API
style WebApp fill:#f9f,stroke:#333
style NativeApp fill:#f9f,stroke:#333
style API fill:#bbf,stroke:#333
style Worker fill:#bbf,stroke:#333
style Redis fill:#f96,stroke:#333
style PostgreSQL fill:#6f9,stroke:#333
click WebApp "apps/web/src/routes/dashboard/compliance/hipaa.tsx" "Web Application"
click NativeApp "apps/native/app/(tabs)/index.tsx" "Native Application"
click API "apps/server/src/index.ts" "API Server"
click Worker "apps/worker/src/index.ts" "Audit Worker"
click Redis "packages/redis-client/src/connection.ts" "Redis Queue"
click PostgreSQL "packages/audit-db/src/db/connection-pool.ts" "PostgreSQL Database"
```

**Diagram sources**
- [audit.md](file://apps/docs/src/content/docs/audit/audit.md)
- [audit-sdk.md](file://apps/docs/src/content/docs/audit/audit-sdk.md)
- [audit-db.md](file://apps/docs/src/content/docs/audit/audit-db.md)

The architecture follows an event-driven pattern where audit events are first queued in Redis using BullMQ for guaranteed delivery, then processed by a dedicated worker service that persists them to PostgreSQL. This separation ensures that audit logging does not block primary application operations while maintaining reliability through circuit breaker patterns and dead letter queues.

The system uses Drizzle ORM for database interactions, providing a type-safe interface for audit log operations. The `AuditDb` class from `@repo/audit-db` package standardizes database connections across services, ensuring consistent access to the audit database schema.

**Section sources**
- [audit.md](file://apps/docs/src/content/docs/audit/audit.md)
- [audit-db.md](file://apps/docs/src/content/docs/audit/audit-db.md)

## PHI Data Handling and Classification

The system implements a comprehensive approach to handling Protected Health Information (PHI) through explicit data classification and resource type identification. The audit system uses a multi-layered strategy to ensure proper handling of PHI across all components.

### PHI Resource Identification

The system identifies PHI resources through a predefined list of FHIR resource types that typically contain protected health information. This identification occurs at multiple levels in the system:

```mermaid
classDiagram
class PHIResourceDetector {
+isPHIResource(resourceType : string) boolean
-phiResources : string[]
}
class AuditLogEvent {
+targetResourceType : string
+dataClassification : DataClassification
+sessionContext : SessionContext
}
class DataClassification {
+PUBLIC : "PUBLIC"
+INTERNAL : "INTERNAL"
+CONFIDENTIAL : "CONFIDENTIAL"
+PHI : "PHI"
}
class SessionContext {
+sessionId : string
+ipAddress : string
+userAgent : string
}
PHIResourceDetector --> AuditLogEvent : "validates"
AuditLogEvent --> DataClassification : "uses"
AuditLogEvent --> SessionContext : "contains"
```

**Diagram sources**
- [validation.ts](file://packages/audit/src/validation.ts#L804-L824)
- [types.ts](file://packages/audit/src/types.ts#L27-L167)

The `isPHIResource` function checks if a given resource type is considered PHI based on a comprehensive list of FHIR resources:

```typescript
function isPHIResource(resourceType: string): boolean {
    const phiResources = [
        'Patient',
        'Observation',
        'Condition',
        'Procedure',
        'MedicationRequest',
        'MedicationStatement',
        'AllergyIntolerance',
        'DiagnosticReport',
        'DocumentReference',
        'Encounter',
        'ImagingStudy',
        'Immunization',
        'CarePlan',
        'CareTeam',
        'Goal',
    ]
    return phiResources.includes(resourceType)
}
```

This function is used in multiple locations throughout the system to determine if an audit event involves PHI, triggering additional compliance requirements.

### Data Classification System

The audit system implements a data classification hierarchy with four levels:

- **PUBLIC**: Information that can be freely shared
- **INTERNAL**: Internal business information
- **CONFIDENTIAL**: Sensitive business information
- **PHI**: Protected Health Information

When an event targets a resource identified as PHI, the system enforces that the `dataClassification` field must be set to "PHI". This is validated during event creation:

```typescript
// Validate PHI data classification
if (event.targetResourceType && isPHIResource(event.targetResourceType)) {
    if (event.dataClassification !== 'PHI') {
        throw new Error(
            'HIPAA Compliance Error: PHI resources must have dataClassification set to "PHI"'
        )
    }
}
```

The system also automatically sets appropriate retention policies for PHI events, defaulting to 6 years as required by HIPAA regulations.

**Section sources**
- [validation.ts](file://packages/audit/src/validation.ts#L702-L742)
- [types.ts](file://packages/audit/src/types.ts#L27-L167)

## HIPAA Compliance Enforcement

The system implements comprehensive HIPAA compliance enforcement through a multi-layered validation system that checks audit events against regulatory requirements before they are logged.

### Compliance Validation Framework

The compliance validation system is implemented in the `validateCompliance` function, which serves as the entry point for all compliance checks:

```mermaid
flowchart TD
Start([Validate Compliance]) --> CheckType["Check Compliance Type"]
CheckType --> |HIPAA| ValidateHIPAA["Validate HIPAA Requirements"]
CheckType --> |GDPR| ValidateGDPR["Validate GDPR Requirements"]
CheckType --> |Custom| ValidateCustom["Validate Custom Rules"]
ValidateHIPAA --> CheckRequired["Check Required Fields"]
ValidateHIPAA --> CheckClassification["Validate PHI Classification"]
ValidateHIPAA --> CheckSession["Validate Session Context"]
ValidateHIPAA --> SetRetention["Set Retention Policy"]
ValidateHIPAA --> End([Validation Complete])
ValidateGDPR --> End
ValidateCustom --> End
style Start fill:#f9f,stroke:#333
style End fill:#f9f,stroke:#333
```

**Diagram sources**
- [validation.ts](file://packages/audit/src/validation.ts#L677-L697)

The validation process for HIPAA compliance includes several critical checks:

1. **Required Fields Validation**: Ensures all necessary information is present
2. **PHI Classification Enforcement**: Verifies proper data classification
3. **Session Context Requirement**: Confirms session details are included
4. **Retention Policy Assignment**: Sets appropriate data retention

```typescript
function validateHIPAA(
    event: Partial<AuditLogEvent>,
    hipaaConfig?: ComplianceConfig['hipaa']
): void {
    if (!hipaaConfig?.enabled) return

    const requiredFields = hipaaConfig.requiredFields || [
        'principalId',
        'action',
        'targetResourceType',
        'targetResourceId',
        'timestamp',
        'sessionContext',
    ]

    // Check required fields
    for (const field of requiredFields) {
        if (!event[field as keyof AuditLogEvent]) {
            throw new Error(`HIPAA Compliance Error: Required field '${field}' is missing`)
        }
    }

    // Validate PHI data classification
    if (event.targetResourceType && isPHIResource(event.targetResourceType)) {
        if (event.dataClassification !== 'PHI') {
            throw new Error(
                'HIPAA Compliance Error: PHI resources must have dataClassification set to "PHI"'
            )
        }
    }

    // Validate session context for PHI access
    if (event.dataClassification === 'PHI' && !event.sessionContext) {
        throw new Error('HIPAA Compliance Error: PHI access events must include sessionContext')
    }

    // Validate retention policy
    if (event.dataClassification === 'PHI' && !event.retentionPolicy) {
        event.retentionPolicy = `hipaa-${hipaaConfig.retentionYears || 6}-years`
    }
}
```

### Security and Integrity Controls

The system implements cryptographic integrity verification using SHA-256 hashing and HMAC signatures. Each audit event includes a hash field that can be used to verify the immutability of the log entry:

```typescript
export interface AuditLogEvent {
    /**
     * Cryptographic hash for immutability verification
     * Generated automatically using SHA-256 algorithm
     */
    hash?: string

    /**
     * Hash algorithm used for integrity verification
     * Standardized to SHA-256 for consistency
     */
    hashAlgorithm?: 'SHA-256'

    /**
     * Cryptographic signature for additional security
     * Generated using HMAC-SHA256 with secret key
     */
    signature?: string
}
```

These security features ensure that audit logs cannot be tampered with after creation, providing a verifiable trail of system activity.

**Section sources**
- [validation.ts](file://packages/audit/src/validation.ts#L702-L742)
- [types.ts](file://packages/audit/src/types.ts#L27-L167)

## Audit Event Generation and Validation

The system provides multiple methods for generating audit events, with the Audit SDK offering the most comprehensive interface for HIPAA-compliant logging.

### Event Creation Process

The audit event creation process follows a standardized workflow that ensures compliance requirements are met:

```mermaid
sequenceDiagram
participant Application as "Application Code"
participant SDK as "AuditSDK"
participant Validator as "Compliance Validator"
participant Queue as "Redis Queue"
participant Worker as "Audit Worker"
participant Database as "PostgreSQL"
Application->>SDK : log(eventDetails, options)
SDK->>Validator : validateCompliance(event, 'hipaa')
alt Validation Success
Validator-->>SDK : Valid
SDK->>Queue : enqueueEvent(event)
Queue-->>Worker : Event available
Worker->>Database : persistEvent(event)
Database-->>Worker : Confirmation
Worker->>Application : Event processed
else Validation Failure
Validator-->>SDK : Error
SDK-->>Application : Validation error
end
```

**Diagram sources**
- [audit-sdk.md](file://apps/docs/src/content/docs/audit/audit-sdk.md)
- [validation.ts](file://packages/audit/src/validation.ts#L677-L697)

### Code Examples

The Audit SDK provides several methods for logging different types of events:

```typescript
// Initialize the SDK with HIPAA compliance enabled
const auditSDK = new AuditSDK({
    queueName: 'my-app-audit',
    redis: {
        url: 'redis://localhost:6379',
    },
    databaseUrl: 'postgresql://user:pass@localhost:5432/audit_db',
    compliance: {
        hipaa: {
            enabled: true,
            retentionYears: 6,
        },
    },
})

// Log a FHIR resource access event
await auditSDK.logFHIR({
    principalId: 'practitioner-456',
    action: 'read',
    resourceType: 'Patient',
    resourceId: 'patient-789',
    status: 'success',
    outcomeDescription: 'Accessed patient record for treatment',
    organizationId: 'hospital-1',
    sessionContext: {
        sessionId: 'sess-123',
        ipAddress: '192.168.1.100',
        userAgent: 'EMR-System/2.1',
    },
})

// Log an authentication event
await auditSDK.logAuth({
    principalId: 'user-123',
    action: 'login',
    status: 'success',
    sessionContext: {
        sessionId: 'sess-abc123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
    },
})
```

The system automatically validates these events against HIPAA requirements, ensuring that all necessary fields are present and properly formatted.

**Section sources**
- [audit-sdk.md](file://apps/docs/src/content/docs/audit/audit-sdk.md)
- [compliance.test.ts](file://packages/audit-sdk/src/__tests__/compliance.test.ts#L40-L83)

## Compliance Reporting System

The system provides comprehensive reporting capabilities for HIPAA compliance, generating detailed audit reports that can be used for regulatory audits and internal reviews.

### Report Generation Process

The HIPAA compliance report generation follows a multi-step process:

```mermaid
flowchart TD
Start([Generate HIPAA Report]) --> ValidateAuth["Validate Authentication"]
ValidateAuth --> CheckOrg["Verify Organization Access"]
CheckOrg --> RetrieveEvents["Retrieve Audit Events"]
RetrieveEvents --> FilterPHI["Filter PHI Events"]
FilterPHI --> CalculateMetrics["Calculate HIPAA Metrics"]
CalculateMetrics --> AssessRisk["Perform Risk Assessment"]
AssessRisk --> GenerateReport["Generate Report Structure"]
GenerateReport --> ReturnReport["Return Compliance Report"]
style Start fill:#f9f,stroke:#333
style ReturnReport fill:#f9f,stroke:#333
```

**Diagram sources**
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts#L596-L647)
- [compliance.ts](file://apps/server/src/routers/compliance.ts#L41-L89)

### Report Structure

The HIPAA compliance report includes several key components:

```typescript
const HIPAAComplianceReportSchema = ComplianceReportSchema.extend({
    reportType: z.literal('HIPAA_AUDIT_TRAIL'),
    hipaaSpecific: z.object({
        phiAccessEvents: z.number(),
        phiModificationEvents: z.number(),
        unauthorizedAttempts: z.number(),
        emergencyAccess: z.number(),
        breakGlassEvents: z.number(),
        minimumNecessaryViolations: z.number(),
    }),
    riskAssessment: z.object({
        highRiskEvents: z.array(
            z.object({
                timestamp: z.string(),
                principalId: z.string().optional(),
                action: z.string(),
                targetResourceType: z.string().optional(),
                targetResourceId: z.string().optional(),
                status: z.string(),
                sessionContext: z.object({
                    ipAddress: z.string().optional(),
                    userAgent: z.string().optional(),
                    sessionId: z.string().optional(),
                }).optional(),
            })
        ),
        suspiciousPatterns: z.array(
            z.object({
                patternType: z.string(),
                description: z.string(),
                events: z.array(z.object({
                    timestamp: z.string(),
                    principalId: z.string().optional(),
                    action: z.string(),
                })),
                riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
                recommendation: z.string(),
            })
        ),
        recommendations: z.array(z.string()),
    }),
})
```

### Report Generation Code

The report generation is implemented in the `generateHIPAAReport` method:

```typescript
async generateHIPAAReport(criteria: ReportCriteria): Promise<HIPAAComplianceReport> {
    const events = await this.getEvents(criteria)
    const baseReport = await this.generateComplianceReport(events, criteria, 'HIPAA_AUDIT_TRAIL')

    // Filter for PHI-related events
    const phiEvents = events.filter(
        (event) => event.dataClassification === 'PHI' || this.isPHIResource(event.targetResourceType)
    )

    // Generate HIPAA-specific metrics
    const hipaaSpecific = this.generateHIPAAMetrics(phiEvents)

    // Perform risk assessment
    const riskAssessment = this.performRiskAssessment(phiEvents)

    return {
        ...baseReport,
        reportType: 'HIPAA_AUDIT_TRAIL',
        hipaaSpecific,
        riskAssessment,
    }
}
```

The system also performs risk assessment on the audit events, identifying high-risk activities and suspicious patterns that may indicate potential security issues.

**Section sources**
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts#L222-L289)
- [compliance-reporting.ts](file://packages/audit/src/report/compliance-reporting.ts#L335-L359)

## Audit Presets for Healthcare

The system provides specialized audit presets for healthcare scenarios, allowing for consistent and compliant event logging across different use cases.

### Preset Configuration

The audit presets are defined with specific configurations for different healthcare scenarios:

```typescript
export interface AuditPreset {
    name: string
    description?: string
    organizationId: string
    action: string
    dataClassification: DataClassification
    requiredFields: string[]
    defaultValues?: Record<string, any>
    validation?: Partial<ValidationConfig>
}
```

Available presets include:
- **authentication**: For login/logout events
- **fhir_access**: For FHIR resource access
- **system**: For system operations
- **data_operation**: For data CRUD operations
- **admin**: For administrative actions
- **security**: For security events
- **compliance**: For compliance-related events
- **practitioner**: For practitioner management

### Preset Usage

Presets can be used when logging events to ensure consistent structure and compliance:

```typescript
// Using the fhir_access preset
await auditSDK.log(
    {
        principalId: 'practitioner-123',
        targetResourceType: 'Patient',
        targetResourceId: 'patient-456',
        status: 'success',
    },
    {
        preset: 'fhir_access',
        compliance: ['hipaa'],
    }
)
```

The presets automatically apply appropriate validation rules and default values, reducing the risk of non-compliant audit events.

**Section sources**
- [preset-types.ts](file://packages/audit/src/preset/preset-types.ts)
- [audit-sdk.md](file://apps/docs/src/content/docs/audit/audit-sdk.md)

## Frontend-Backend Integration

The system provides a seamless integration between frontend applications and backend compliance services, enabling real-time monitoring and reporting of audit events.

### Dashboard Implementation

The HIPAA compliance dashboard in the web application demonstrates the integration between frontend and backend services:

```mermaid
sequenceDiagram
participant Browser as "User Browser"
participant React as "React Component"
participant TRPC as "tRPC Client"
participant API as "API Server"
participant Database as "Audit Database"
Browser->>React : Navigate to /dashboard/compliance/hipaa
React->>TRPC : trpc.reports.hipaa.query()
TRPC->>API : HTTP POST /compliance/reports/hipaa
API->>Database : Query audit events
Database-->>API : Return events
API-->>TRPC : Return HIPAA report
TRPC-->>React : Update state with report
React->>Browser : Render dashboard with charts
```

**Diagram sources**
- [hipaa.tsx](file://apps/web/src/routes/dashboard/compliance/hipaa.tsx)
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts#L596-L647)

### Frontend Code Example

The frontend implementation uses React with tRPC for type-safe API calls:

```typescript
function RouteComponent() {
    const [dateRange, setDateRange] = useState<DateRange>({
        from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14),
        to: today,
    })

    const { data: report, isLoading } = useQuery(
        trpc.reports.hipaa.queryOptions({
            criteria: {
                dateRange: {
                    startDate: formatDate(dateRange.from, 'yyyy-MM-dd'),
                    endDate: formatDate(dateRange.to, 'yyyy-MM-dd'),
                },
                limit: 50,
            },
        })
    )

    const columns = createColumns()

    useEffect(() => {
        if (report) {
            setSummaryData(
                transformData({
                    eventsByStatus: report.summary.eventsByStatus,
                    eventsByAction: report.summary.eventsByAction,
                    eventsByDataClassification: report.summary.eventsByDataClassification,
                })
            )
        }
    }, [report])

    return (
        <div className="flex flex-1 flex-col gap-4 p-4">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbPage>Hipaa Reports</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>
            {/* Dashboard content */}
        </div>
    )
}
```

This integration allows healthcare organizations to monitor their compliance status in real-time, with visualizations of audit events, access patterns, and potential security risks.

**Section sources**
- [hipaa.tsx](file://apps/web/src/routes/dashboard/compliance/hipaa.tsx)

## Configuration and Best Practices

Proper configuration is essential for maintaining HIPAA compliance in the audit system. The following guidelines ensure optimal setup and operation.

### Configuration Options

The Audit SDK provides comprehensive configuration options for HIPAA compliance:

```typescript
const config: AuditSDKConfig = {
    queueName: 'audit-events',
    redis: {
        url: process.env.REDIS_URL,
        options: {
            maxRetriesPerRequest: 3,
            enableAutoPipelining: true,
        },
    },
    databaseUrl: process.env.AUDIT_DB_URL,
    crypto: {
        secretKey: process.env.AUDIT_SECRET_KEY,
        enableSignatures: true,
    },
    validation: {
        maxStringLength: 10000,
        allowedDataClassifications: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'],
        requiredFields: ['timestamp', 'action', 'status'],
        maxCustomFieldDepth: 3,
        allowedEventVersions: ['1.0', '1.1', '2.0'],
    },
    compliance: {
        hipaa: {
            enabled: true,
            requiredFields: ['principalId', 'targetResourceType', 'sessionContext'],
            retentionYears: 6,
        },
        gdpr: {
            enabled: true,
            defaultLegalBasis: 'legitimate_interest',
            retentionDays: 365,
        },
    },
    defaults: {
        dataClassification: 'INTERNAL',
        retentionPolicy: 'standard',
        generateHash: true,
        generateSignature: false,
    },
}
```

### Best Practices

1. **Always include session context** for user actions, especially when accessing PHI
2. **Use appropriate data classifications** (PUBLIC, INTERNAL, CONFIDENTIAL, PHI) based on the sensitivity of the information
3. **Enable cryptographic features** (hashing and signatures) for sensitive data
4. **Implement rate limiting** to prevent audit spam and ensure system performance
5. **Use presets** for consistent event structure across the application
6. **Validate compliance** for regulated data to catch issues early
7. **Monitor system health** regularly to ensure audit services are operational
8. **Batch events** for high-volume scenarios to improve performance
9. **Regularly generate compliance reports** to verify ongoing adherence to HIPAA requirements
10. **Conduct periodic integrity verification** of audit logs to ensure data immutability

**Section sources**
- [audit-sdk.md](file://apps/docs/src/content/docs/audit/audit-sdk.md)

## Troubleshooting and Error Handling

The system implements comprehensive error handling to ensure reliability and provide actionable feedback when issues occur.

### Error Types

The audit system defines several error types for different failure scenarios:

```typescript
try {
    await auditSDK.log(eventDetails)
} catch (error) {
    if (error.name === 'AuditValidationError') {
        console.error('Validation failed:', error.field, error.message)
    } else if (error.name === 'ComplianceError') {
        console.error('Compliance validation failed:', error.message)
    } else {
        console.error('Audit logging failed:', error.message)
    }
}
```

Common error scenarios include:
- **Validation errors**: Missing required fields or invalid data formats
- **Compliance errors**: Failure to meet HIPAA or GDPR requirements
- **Connection errors**: Issues with Redis or database connectivity
- **Rate limiting**: Exceeding configured event limits
- **Serialization errors**: Problems converting events to JSON format

### Business Associate Agreement Considerations

When implementing the audit system in a healthcare environment, organizations should consider the following Business Associate Agreement (BAA) requirements:

1. **Data Encryption**: Ensure audit logs containing PHI are encrypted at rest and in transit
2. **Access Controls**: Implement role-based access controls to limit who can view audit logs
3. **Audit Log Completeness**: Verify that all required events are being logged as specified in the BAA
4. **Retention Periods**: Confirm that audit logs are retained for the required duration (typically 6 years for HIPAA)
5. **Breach Notification**: Establish procedures for detecting and reporting security incidents involving audit logs
6. **Third-Party Vendors**: Ensure any third-party services used for audit storage or processing are covered by appropriate BAAs

The system's cryptographic integrity verification and access controls help meet these BAA requirements by ensuring the confidentiality, integrity, and availability of audit data.

**Section sources**
- [audit-sdk.md](file://apps/docs/src/content/docs/audit/audit-sdk.md)
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts#L596-L647)