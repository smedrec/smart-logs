# Compliance API

<cite>
**Referenced Files in This Document**   
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts#L0-L1066)
- [auth.ts](file://apps/server/src/lib/middleware/auth.ts#L0-L764)
- [rate-limit.ts](file://apps/server/src/lib/middleware/rate-limit.ts#L0-L486)
- [api-version.ts](file://apps/server/src/lib/middleware/api-version.ts#L0-L100)
- [compliance.ts](file://apps/server/src/routers/compliance.ts#L0-L291)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction

The Compliance API is a RESTful service designed to support regulatory compliance with GDPR and HIPAA standards. It enables organizations to generate compliance reports, export personal data, manage data subject requests, and verify audit trail integrity. The API is built using Hono and OpenAPI for type-safe route definitions, and integrates with backend services for report generation, data export, and scheduled reporting.

Key features include:
- Generation of HIPAA and GDPR compliance reports
- Export of audit data in multiple formats (JSON, CSV, PDF, XML)
- Management of scheduled compliance reports
- Integrity verification of audit events
- Support for data classification and filtering
- Integration with authentication and rate limiting systems

The API follows a modular design with clear separation of concerns, using middleware for authentication, rate limiting, and error handling. It is designed to be secure, scalable, and compliant with industry standards.

## Project Structure

The Compliance API is part of a larger monorepo with a well-defined structure. The core API routes are located in the `apps/server/src/routes` directory, while shared utilities and services are organized in the `packages` directory.

```mermaid
graph TB
subgraph "Apps"
A[apps/server] --> B[src/routes/compliance-api.ts]
A --> C[src/routers/compliance.ts]
A --> D[src/lib/middleware]
end
subgraph "Packages"
E[packages/audit] --> F[compliance-reporting.ts]
E --> G[data-export.ts]
E --> H[scheduled-reporting.ts]
P[packages/auth] --> Q[auth.ts]
R[packages/redis-client] --> S[connection.ts]
end
B --> E
D --> P
D --> R
```

**Diagram sources**
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts#L0-L1066)
- [compliance.ts](file://apps/server/src/routers/compliance.ts#L0-L291)
- [packages/audit/src/report/compliance-reporting.ts]
- [packages/audit/src/report/data-export.ts]

**Section sources**
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts#L0-L1066)

## Core Components

The Compliance API consists of several key components that work together to provide compliance functionality:

- **compliance-api.ts**: Main route definitions using Hono and OpenAPI
- **compliance.ts**: TRPC router for compliance operations
- **auth.ts**: Authentication middleware with JWT and API key support
- **rate-limit.ts**: Rate limiting middleware with Redis integration
- **api-version.ts**: API versioning middleware

These components are orchestrated through a middleware pipeline that handles authentication, rate limiting, request validation, and error handling before routing to the appropriate handler.

The API uses Zod for request and response validation, ensuring type safety and data integrity. It also integrates with a logging and audit system to track all API interactions for security and compliance purposes.

**Section sources**
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts#L0-L1066)
- [auth.ts](file://apps/server/src/lib/middleware/auth.ts#L0-L764)
- [rate-limit.ts](file://apps/server/src/lib/middleware/rate-limit.ts#L0-L486)

## Architecture Overview

The Compliance API follows a layered architecture with clear separation between routing, business logic, and data access layers. It uses a middleware-based approach to handle cross-cutting concerns like authentication, rate limiting, and error handling.

```mermaid
graph TB
Client[Client Application] --> LB[Load Balancer]
LB --> API[API Gateway]
API --> Auth[Authentication Middleware]
Auth --> RateLimit[Rate Limiting Middleware]
RateLimit --> Version[API Versioning]
Version --> Validation[Request Validation]
Validation --> Handler[Route Handler]
Handler --> Service[Compliance Service]
Service --> DB[(Database)]
Service --> Cache[(Redis)]
Service --> Storage[(Storage)]
subgraph "Monitoring"
Logging[Logging Service]
Metrics[Metrics Collector]
Tracing[Distributed Tracing]
end
Handler --> Logging
Service --> Logging
Service --> Metrics
Service --> Tracing
```

**Diagram sources**
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts#L0-L1066)
- [auth.ts](file://apps/server/src/lib/middleware/auth.ts#L0-L764)
- [rate-limit.ts](file://apps/server/src/lib/middleware/rate-limit.ts#L0-L486)
- [api-version.ts](file://apps/server/src/lib/middleware/api-version.ts#L0-L100)

## Detailed Component Analysis

### Compliance API Routes

The compliance API routes are defined using Hono's OpenAPI integration, providing type-safe endpoint definitions with automatic documentation generation.

#### Route Definitions

```mermaid
classDiagram
class ReportCriteriaSchema {
+startDate : string
+endDate : string
+principalIds : string[]
+organizationIds : string[]
+actions : string[]
+statuses : string[]
+dataClassifications : string[]
+resourceTypes : string[]
}
class ExportConfigSchema {
+format : 'json'|'csv'|'pdf'|'xml'
+includeMetadata : boolean
+compression : 'none'|'gzip'|'zip'
+encryption : object
}
class ScheduledReportConfigSchema {
+name : string
+description : string
+reportType : string
+criteria : ReportCriteriaSchema
+format : string
+schedule : object
+delivery : object
+export : ExportConfigSchema
+enabled : boolean
+createdBy : string
+createdAt : string
}
class ComplianceReportSchema {
+metadata : object
+summary : object
+events : object[]
+integrityReport : object
}
class HIPAAComplianceReportSchema {
+reportType : 'HIPAA_AUDIT_TRAIL'
+hipaaSpecific : object
+riskAssessment : object
}
class GDPRComplianceReportSchema {
+reportType : 'GDPR_PROCESSING_ACTIVITIES'
+gdprSpecific : object
+legalBasisBreakdown : object
+dataSubjectRights : object
}
ReportCriteriaSchema <|-- ComplianceReportSchema
ExportConfigSchema <|-- ScheduledReportConfigSchema
ComplianceReportSchema <|-- HIPAAComplianceReportSchema
ComplianceReportSchema <|-- GDPRComplianceReportSchema
```

**Diagram sources**
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts#L0-L1066)

**Section sources**
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts#L0-L1066)

### Authentication and Authorization

The API uses JWT-based authentication with role-based access control. It supports both session-based and API key authentication.

#### Authentication Flow

```mermaid
sequenceDiagram
participant Client
participant API
participant Auth
participant Audit
Client->>API : Request with JWT or API Key
API->>Auth : Validate session or API key
alt Session exists
Auth-->>API : Return session data
API->>API : Check session expiration
API->>API : Check user ban status
else API Key provided
API->>Auth : Validate API key
Auth-->>API : Return API key session
else No authentication
API-->>Client : 401 Unauthorized
API->>Audit : Log authentication failure
end
API->>API : Apply role/permission checks
alt Authorized
API->>Handler : Process request
Handler-->>Client : Return response
API->>Audit : Log successful access
else Unauthorized
API-->>Client : 403 Forbidden
API->>Audit : Log authorization failure
end
```

**Diagram sources**
- [auth.ts](file://apps/server/src/lib/middleware/auth.ts#L0-L764)

**Section sources**
- [auth.ts](file://apps/server/src/lib/middleware/auth.ts#L0-L764)

### Rate Limiting Implementation

The API implements rate limiting using Redis for distributed storage, supporting different strategies based on IP, user, or session.

#### Rate Limiting Logic

```mermaid
flowchart TD
Start([Request Received]) --> GenerateKey["Generate Rate Limit Key<br/>(IP, User, or Session)"]
GenerateKey --> GetCount["Get Current Count from Redis"]
GetCount --> CheckLimit{"Count >= Limit?"}
CheckLimit --> |Yes| SetHeaders["Set Rate Limit Headers"]
SetHeaders --> LogExceeded["Log Rate Limit Exceeded"]
LogExceeded --> Return429["Return 429 Too Many Requests"]
CheckLimit --> |No| ExecuteRequest["Execute Request"]
ExecuteRequest --> Increment["Increment Counter if Needed"]
Increment --> SetSuccessHeaders["Set Rate Limit Headers"]
SetSuccessHeaders --> ReturnResponse["Return Response"]
Return429 --> End([Request Complete])
ReturnResponse --> End
```

**Diagram sources**
- [rate-limit.ts](file://apps/server/src/lib/middleware/rate-limit.ts#L0-L486)

**Section sources**
- [rate-limit.ts](file://apps/server/src/lib/middleware/rate-limit.ts#L0-L486)

## Dependency Analysis

The Compliance API has several key dependencies that enable its functionality:

```mermaid
graph TD
A[Compliance API] --> B[Hono]
A --> C[Zod]
A --> D[OpenAPI]
A --> E[TRPC]
A --> F[Redis]
A --> G[PostgreSQL]
A --> H[Auth Service]
A --> I[Audit Service]
A --> J[Error Service]
A --> K[Logging Service]
B --> L[TypeScript]
C --> L
D --> L
E --> L
F --> M[Redis Client]
G --> N[Drizzle ORM]
H --> O[JWT]
I --> P[Event Bus]
J --> Q[Error Tracking]
K --> R[Structured Logging]
```

**Diagram sources**
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts#L0-L1066)
- [auth.ts](file://apps/server/src/lib/middleware/auth.ts#L0-L764)
- [rate-limit.ts](file://apps/server/src/lib/middleware/rate-limit.ts#L0-L486)

**Section sources**
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts#L0-L1066)
- [auth.ts](file://apps/server/src/lib/middleware/auth.ts#L0-L764)
- [rate-limit.ts](file://apps/server/src/lib/middleware/rate-limit.ts#L0-L486)

## Performance Considerations

The Compliance API is designed with performance in mind, using several optimization techniques:

- **Caching**: Uses Redis to cache frequently accessed data and rate limiting information
- **Database Optimization**: Leverages PostgreSQL partitioning and indexing for audit data
- **Asynchronous Processing**: Long-running reports are processed asynchronously
- **Connection Pooling**: Uses connection pooling for database and Redis connections
- **Request Batching**: Supports batch operations where applicable
- **Compression**: Supports response compression for large data exports

The API also implements adaptive rate limiting that applies different limits based on endpoint type:
- Authentication endpoints: 5 requests per 15 minutes per IP
- Write operations: 100 requests per minute per user
- Read operations: 1000 requests per minute per user
- Public endpoints: 60 requests per minute per IP

These limits help prevent abuse while maintaining good performance for legitimate users.

## Troubleshooting Guide

Common issues and their solutions:

### Authentication Failures
- **401 Unauthorized**: Ensure valid JWT or API key is provided in Authorization header
- **403 Forbidden**: Check user roles and permissions; ensure user is not banned
- **Session Expired**: Refresh the session or re-authenticate

### Rate Limiting Issues
- **429 Too Many Requests**: Wait for the reset time indicated in Retry-After header
- **Unexpected Rate Limiting**: Verify rate limit key strategy (IP, user, session)
- **Redis Connection Issues**: Check Redis connectivity and configuration

### Report Generation Problems
- **Slow Reports**: Use date ranges to limit scope; consider scheduled reports
- **Missing Data**: Verify organization ID and permissions; check date ranges
- **Validation Errors**: Ensure request body conforms to schema; check required fields

### Data Export Issues
- **Large Exports**: Use asynchronous processing; consider compression
- **Format Errors**: Verify supported formats (JSON, CSV, PDF, XML)
- **Delivery Failures**: Check webhook URLs or storage locations

Logs and audit trails are available for troubleshooting, with detailed information about each request and response.

**Section sources**
- [compliance-api.ts](file://apps/server/src/routes/compliance-api.ts#L0-L1066)
- [auth.ts](file://apps/server/src/lib/middleware/auth.ts#L0-L764)
- [rate-limit.ts](file://apps/server/src/lib/middleware/rate-limit.ts#L0-L486)

## Conclusion

The Compliance API provides a comprehensive solution for GDPR and HIPAA compliance, offering robust features for report generation, data export, and audit trail verification. Its modular design, strong type safety, and comprehensive middleware support make it reliable and maintainable.

Key strengths include:
- Clear separation of concerns with well-defined components
- Strong security with JWT authentication and role-based access control
- Scalable architecture with Redis-based rate limiting
- Comprehensive error handling and logging
- Type-safe API definitions with OpenAPI and Zod

The API is production-ready and follows best practices for RESTful design, security, and performance. It can be extended to support additional compliance standards or integrated with other systems as needed.