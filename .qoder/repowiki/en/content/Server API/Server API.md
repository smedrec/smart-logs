# Server API

<cite>
**Referenced Files in This Document**   
- [audit-api.ts](file://apps\server\src\routes\audit-api.ts) - *Updated in recent commit*
- [events.ts](file://apps\server\src\routers\events.ts) - *Updated in recent commit*
- [audit.ts](file://packages\audit\src\audit.ts) - *Audit service implementation*
- [rest-api.ts](file://apps\server\src\routes\rest-api.ts)
- [compliance-api.ts](file://apps\server\src\routes\compliance-api.ts)
- [health-api.ts](file://apps\server\src\routes\health-api.ts)
- [metrics-api.ts](file://apps\server\src\routes\metrics-api.ts)
- [observability-api.ts](file://apps\server\src\routes\observability-api.ts)
- [auth.ts](file://apps\server\src\lib\middleware\auth.ts)
- [rate-limit.ts](file://apps\server\src\lib\middleware\rate-limit.ts)
- [api-version.ts](file://apps\server\src\lib\middleware\api-version.ts)
- [openapi_responses.ts](file://apps\server\src\lib\errors\openapi_responses.ts)
- [http.ts](file://apps\server\src\lib\errors\http.ts)
- [alerts.ts](file://apps\server\src\routers\alerts.ts)
- [organization-api.ts](file://apps\server\src\routes\organization-api.ts)
- [0005_fluffy_donald_blake.sql](file://packages\auth\drizzle\0005_fluffy_donald_blake.sql)
- [init.ts](file://apps\server\src\lib\hono\init.ts)
- [error-handling.ts](file://apps\server\src\lib\middleware\error-handling.ts)
- [types.ts](file://packages\infisical-kms\src\types.ts)
- [client.ts](file://packages\infisical-kms\src\client.ts)
- [crypto.ts](file://packages\audit\src\crypto.ts)
- [tracer.ts](file://packages\audit\src\observability\tracer.ts)
- [logging.ts](file://packages\logs\src\logging.ts)
- [cleanup-old-alerts.ts](file://apps\server\src\lib\inngest\functions\alerts\cleanup-old-alerts.ts) - *Updated in recent commit*
- [sendEmail.ts](file://apps\server\src\lib\inngest\functions\emails\sendEmail.ts) - *Updated in recent commit*
- [connection.ts](file://packages\redis-client\src\connection.ts) - *Updated in recent commit*
- [AlertDashboard.tsx](file://apps\app\src\components\alerts\core\AlertDashboard.tsx) - *Updated in recent commit*
- [AlertList.tsx](file://apps\app\src\components\alerts\core\AlertList.tsx) - *Updated in recent commit*
- [AlertDetails.tsx](file://apps\app\src\components\alerts\core\AlertDetails.tsx) - *Updated in recent commit*
- [alert.ts](file://apps\app\src\lib\types\alert.ts) - *Updated in recent commit*
- [collections.ts](file://apps\app\src\lib\collections.ts) - *Updated in recent commit*
- [types.ts](file://apps\server\src\lib\graphql\types.ts) - *Updated in recent commit*
</cite>

## Update Summary
**Changes Made**   
- Updated Audit Events API section with enhanced field restriction for integrity verification
- Added debug logging details for hash verification process
- Updated Verify Audit Event endpoint documentation to reflect field restriction changes
- Added information about critical fields used in hash calculation
- Enhanced error handling documentation with verification-specific error scenarios
- Updated Section sources to include newly analyzed files
- Added Redis connection error handling and logging improvements from recent commits
- Updated error handling documentation to reflect enhanced logging practices in Inngest functions
- Updated Alert Management API documentation to reflect breaking changes in alert properties
- Added documentation for the removal of /alerts/board route
- Updated alert property names from timestamp to created_at and acknowledgedBy to acknowledged_by
- Added new section for Alert Management API with updated field mappings
- Updated request/response examples to reflect new alert field names

## Table of Contents
1. [Introduction](#introduction)
2. [API Versioning](#api-versioning)
3. [Authentication and Access Control](#authentication-and-access-control)
4. [Rate Limiting](#rate-limiting)
5. [Error Handling](#error-handling)
6. [Pagination](#pagination)
7. [Audit Events API](#audit-events-api)
8. [Compliance API](#compliance-api)
9. [Health Check API](#health-check-api)
10. [Metrics API](#metrics-api)
11. [Observability API](#observability-api)
12. [Organization Role Management API](#organization-role-management-api)
13. [Enhanced Structured Logging System](#enhanced-structured-logging-system)
14. [KMS Integration and Enhanced OTLP Exporter](#kms-integration-and-enhanced-otlp-exporter)
15. [Request and Response Examples](#request-and-response-examples)
16. [Alert Management API](#alert-management-api)

## Introduction
The SMEDREC Audit System REST API provides comprehensive access to healthcare audit functionality through a well-structured RESTful interface. The API supports audit event management, compliance reporting, system monitoring, and observability features. Built on Hono with OpenAPI documentation, the API follows modern REST principles with robust security, rate limiting, and error handling.

The API is organized into logical modules accessible under different path prefixes:
- `/audit`: Audit event creation and querying
- `/compliance`: Compliance reports and data export
- `/metrics`: System and audit metrics
- `/observability`: Comprehensive system monitoring
- `/health`: Health check endpoints
- `/organization`: Organization management including role management

All endpoints are versioned and documented via Swagger UI at `/docs`, with machine-readable OpenAPI specification available at `/openapi.json`.

**Section sources**
- [rest-api.ts](file://apps\server\src\routes\rest-api.ts#L1-L329)

## API Versioning
The API supports versioning through the `Accept-Version` header. The current implementation supports only version `1.0.0`, which is also the default version used when no version header is provided.

### Version Header
Clients should specify the desired API version using the `Accept-Version` header:
```
Accept-Version: 1.0.0
```

### Response Header
The server responds with the resolved API version in the `API-Version` header.

### Version Configuration
The API versioning middleware is configured with the following parameters:
- **Current version**: 1.0.0
- **Supported versions**: [1.0.0]
- **Deprecated versions**: []
- **Default version**: 1.0.0
- **Header name**: Accept-Version
- **Response header name**: API-Version
- **Strict versioning**: false

If a requested version is not supported, the server returns a 400 Bad Request response. Since there are no deprecated versions, deprecation warnings are not currently issued.

**Section sources**
- [api-version.ts](file://apps\server\src\lib\middleware\api-version.ts#L1-L351)

## Authentication and Access Control
The API implements robust authentication and role-based access control to ensure secure access to resources.

### Authentication Methods
Two authentication methods are supported:

1. **Bearer Token (JWT)**: Session-based authentication using JWT tokens
   ```
   Authorization: Bearer <session-token>
   ```

2. **API Key**: For third-party integrations
   ```
   X-API-Key: <api-key>
   ```

The security schemes are defined in the OpenAPI specification as:
- `cookieAuth`: Cookie-based authentication using session token
- `BearerAuth`: HTTP Bearer authentication
- `ApiKeyAuth`: API key in header

The OpenAPI specification includes all three security schemes, and endpoints can require one or more of these authentication methods. The `BearerAuth` scheme was recently added to support token-based authentication in addition to cookie-based authentication.

**Section sources**
- [rest-api.ts](file://apps\server\src\routes\rest-api.ts#L180-L243)
- [auth.ts](file://apps\server\src\lib\middleware\auth.ts#L1-L765)

### Access Control Rules
The API implements a multi-layered access control system:

```mermaid
graph TD
A[Client Request] --> B{Authentication}
B --> |Valid| C{Access Control}
B --> |Invalid| D[401 Unauthorized]
C --> E[Route-Based Permissions]
E --> F[/audit/*, /compliance/*/]
F --> G[requireAuthOrApiKey]
E --> H[/metrics/system/*, /observability/*/]
H --> I[requireRole admin]
E --> J[/audit/*, /compliance/*/]
J --> K[requireOrganizationAccess]
E --> L[/organization/*]
L --> M[requireAuthOrApiKey]
L --> N[requireOrganizationAccess]
C --> |Authorized| O[Process Request]
C --> |Unauthorized| P[403 Forbidden]
O --> Q[Return Response]
```

**Diagram sources**
- [auth.ts](file://apps\server\src\lib\middleware\auth.ts#L1-L765)
- [rest-api.ts](file://apps\server\src\routes\rest-api.ts#L241-L288)
- [organization-api.ts](file://apps\server\src\routes\organization-api.ts#L1-L222)

### Role-Based Access Control
The `requireRole` middleware enforces role-based permissions. Currently, admin access is required for system metrics and observability endpoints.

### Organization Access Control
The `requireOrganizationAccess` middleware ensures users can only access data for their organization, providing data isolation between organizations.

**Section sources**
- [auth.ts](file://apps\server\src\lib\middleware\auth.ts#L1-L765)
- [rest-api.ts](file://apps\server\src\routes\rest-api.ts#L241-L288)

## Rate Limiting
The API implements rate limiting to prevent abuse and ensure fair usage across all endpoints.

### Rate Limiting Strategies
Three rate limiting strategies are available:
- **IP-based**: Limits requests by client IP address
- **User-based**: Limits requests by authenticated user
- **Session-based**: Limits requests by session ID

### Rate Limit Configuration
The API uses adaptive rate limiting with different thresholds for various endpoint types:

| Endpoint Type | Limit | Window | Scope |
|---------------|-------|--------|-------|
| Authentication | 5 requests | 15 minutes | Per IP |
| Read operations | 1000 requests | Minute | Per user |
| Write operations | 100 requests | Minute | Per user |
| Public endpoints | 60 requests | Minute | Per IP |

### Rate Limit Headers
Rate limit information is included in response headers:
- `X-RateLimit-Limit`: Maximum requests in the current window
- `X-RateLimit-Remaining`: Remaining requests in the current window
- `X-RateLimit-Reset`: Time when the rate limit window resets (ISO 8601 format)

```mermaid
sequenceDiagram
participant Client
participant RateLimit
participant Redis
participant API
Client->>API : Request with auth
API->>RateLimit : Check rate limit
RateLimit->>Redis : GET rate_limit : user : <userId>
Redis-->>RateLimit : Current count
alt Limit not exceeded
RateLimit->>API : Continue request
API->>Client : Process and respond
RateLimit->>Redis : INCR rate_limit : user : <userId>
else Limit exceeded
RateLimit->>Client : 429 Too Many Requests
Note right of Client : With rate limit headers
end
```

**Diagram sources**
- [rate-limit.ts](file://apps\server\src\lib\middleware\rate-limit.ts#L1-L487)
- [rest-api.ts](file://apps\server\src\routes\rest-api.ts#L210-L213)

**Section sources**
- [rate-limit.ts](file://apps\server\src\lib\middleware\rate-limit.ts#L1-L487)

## Error Handling
The API uses a consistent error response format across all endpoints to facilitate client error handling.

### Error Response Format
All errors follow the same JSON structure:
```json
{
  "code": "ERROR_CODE",
  "message": "Human readable error message",
  "details": {},
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req_123456789",
  "path": "/api/v1/events"
}
```

### Status Codes and Error Codes
The API maps HTTP status codes to specific error codes:

```mermaid
graph LR
A[HTTP Status] --> B[Error Code]
A1[400] --> B1[BAD_REQUEST]
A2[401] --> B2[UNAUTHORIZED]
A3[403] --> B3[FORBIDDEN]
A4[404] --> B4[NOT_FOUND]
A5[409] --> B5[CONFLICT]
A6[412] --> B6[PRECONDITION_FAILED]
A7[429] --> B7[TOO_MANY_REQUESTS]
A8[500] --> B8[INTERNAL_SERVER_ERROR]
A9[503] --> B9[SERVICE_UNAVAILABLE]
```

**Diagram sources**
- [http.ts](file://apps\server\src\lib\errors\http.ts#L1-L314)
- [openapi_responses.ts](file://apps\server\src\lib\errors\openapi_responses.ts#L1-L91)

The error handling middleware automatically converts exceptions to the appropriate error response format and logs errors for monitoring and debugging. The system now uses a unified error handling approach with enhanced context enrichment, capturing detailed information about each request including user ID, session ID, organization ID, endpoint, method, user agent, IP address, and metadata. Recent updates have improved error handling in Inngest functions, particularly in the alerts cleanup and email sending workflows, with enhanced error logging and context inclusion.

**Section sources**
- [http.ts](file://apps\server\src\lib\errors\http.ts#L1-L314)
- [openapi_responses.ts](file://apps\server\src\lib\errors\openapi_responses.ts#L1-L91)
- [error-handling.ts](file://apps\server\src\lib\middleware\error-handling.ts#L1-L372)
- [cleanup-old-alerts.ts](file://apps\server\src\lib\inngest\functions\alerts\cleanup-old-alerts.ts#L1-L111)
- [sendEmail.ts](file://apps\server\src\lib\inngest\functions\emails\sendEmail.ts#L1-L165)

## Pagination
List endpoints support pagination to handle large datasets efficiently.

### Pagination Parameters
- `limit`: Number of items per page (default: 50, maximum: 100)
- `offset`: Number of items to skip (default: 0)

### Pagination Response
Paginated responses include metadata about the result set:
```json
{
  "data": [...],
  "pagination": {
    "total": 1000,
    "limit": 50,
    "offset": 0,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

This approach allows clients to navigate through large result sets without overwhelming the server or network.

**Section sources**
- [rest-api.ts](file://apps\server\src\routes\rest-api.ts#L124-L131)

## Audit Events API
The Audit Events API provides endpoints for creating, querying, and verifying audit events.

### Base Path
`/api/v1/audit`

### Create Audit Event
Creates a new audit event.

**Endpoint**: `POST /events`  
**Authentication**: Required  
**Permissions**: Write access to organization

**Request Body**:
```json
{
  "action": "user.login",
  "targetResourceType": "user",
  "principalId": "usr_123",
  "organizationId": "org_456",
  "status": "success",
  "outcomeDescription": "User logged in successfully",
  "dataClassification": "INTERNAL",
  "sessionContext": {
    "sessionId": "sess_789",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  },
  "details": {
    "loginMethod": "password"
  }
}
```

**Response**: `201 Created` with the created event including generated ID and timestamp.

### Query Audit Events
Retrieves audit events with filtering, pagination, and sorting.

**Endpoint**: `GET /events`  
**Authentication**: Required  
**Permissions**: Read access to organization

**Query Parameters**:
- `startDate`, `endDate`: Time range filtering
- `principalIds`: Filter by principal IDs (comma-separated)
- `organizationIds`: Filter by organization IDs (comma-separated)
- `actions`: Filter by actions (comma-separated)
- `statuses`: Filter by statuses (comma-separated)
- `dataClassifications`: Filter by data classifications (comma-separated)
- `resourceTypes`: Filter by resource types (comma-separated)
- `verifiedOnly`: Filter by verification status
- `limit`: Items per page (default: 50, max: 100)
- `offset`: Items to skip
- `sortField`: Field to sort by (timestamp, status, action)
- `sortDirection`: Sort direction (asc, desc)

**Response**: `200 OK` with paginated list of events.

### Get Audit Event by ID
Retrieves a specific audit event by ID.

**Endpoint**: `GET /events/{id}`  
**Authentication**: Required  
**Permissions**: Read access to organization

**Response**: `200 OK` with the requested event or `404 Not Found`.

### Verify Audit Event
Verifies the integrity of an audit event with enhanced field restriction for cryptographic verification.

**Endpoint**: `POST /events/{id}/verify`  
**Authentication**: Required  
**Permissions**: Verification access

**Implementation Details**:
The verification process now restricts the fields used in hash calculation to critical fields only, ensuring consistent integrity checks. The following fields are included in the hash calculation:
- `timestamp`
- `action`
- `status`
- `principalId`
- `organizationId`
- `targetResourceType`
- `targetResourceId`
- `outcomeDescription`

**Debug Logging**:
The system includes enhanced debug logging for verification issues, capturing:
- Original and computed hashes
- Verification status
- Audit event fields used in hash calculation
- Database event keys for comparison

**Response**: `200 OK` with verification results including hash comparison.

**Section sources**
- [audit-api.ts](file://apps\server\src\routes\audit-api.ts#L0-L199)
- [events.ts](file://apps\server\src\routers\events.ts#L0-L1357)
- [audit.ts](file://packages\audit\src\audit.ts#L300-L302)

## Compliance API
The Compliance API provides endpoints for generating compliance reports and managing compliance configurations.

### Base Path
`/api/v1/compliance`

### Generate Compliance Report
Generates a compliance report based on specified criteria.

**Endpoint**: `POST /reports`  
**Authentication**: Required  
**Permissions**: Compliance access

**Request Body**:
```json
{
  "reportType": "HIPAA_AUDIT_TRAIL",
  "criteria": {
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z",
    "principalIds": ["usr_123"],
    "actions": ["user.login", "record.access"]
  },
  "format": "pdf",
  "includeMetadata": true
}
```

### Manage Scheduled Reports
CRUD operations for scheduled compliance reports.

**Endpoints**:
- `GET /scheduled-reports`: List scheduled reports
- `POST /scheduled-reports`: Create a new scheduled report
- `GET /scheduled-reports/{id}`: Get a specific scheduled report
- `PUT /scheduled-reports/{id}`: Update a scheduled report
- `DELETE /scheduled-reports/{id}`: Delete a scheduled report

### Audit Presets
Manage audit event templates for compliance.

**Endpoints**:
- `GET /presets`: List audit presets
- `POST /presets`: Create a new audit preset
- `GET /presets/{id}`: Get a specific preset
- `PUT /presets/{id}`: Update a preset
- `DELETE /presets/{id}`: Delete a preset

### Integrity Verification
Verify the integrity of audit trails for compliance purposes.

**Endpoint**: `POST /verify-integrity`  
**Authentication**: Required  
**Permissions**: Admin or compliance officer

**Section sources**
- [compliance-api.ts](file://apps\server\src\routes\compliance-api.ts#L0-L199)

## Health Check API
The Health Check API provides endpoints for monitoring system health and readiness.

### Base Path
`/api/v1/health`

### Basic Health Check
Returns basic server health status.

**Endpoint**: `GET /health`  
**Authentication**: Not required  
**Response**: `200 OK` when healthy, `503 Service Unavailable` when unhealthy

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

### Detailed Health Check
Returns comprehensive health status including service checks.

**Endpoint**: `GET /detailed`  
**Authentication**: Required  
**Response**: `200 OK` with detailed health information

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": [
    {
      "name": "database",
      "status": "healthy",
      "responseTime": 15,
      "lastChecked": "2024-01-01T00:00:00.000Z"
    }
  ],
  "system": {
    "memory": { "used": 1024, "total": 4096, "percentage": 25 },
    "cpu": { "usage": 15, "loadAverage": [1.2, 1.1, 1.0] }
  }
}
```

### Readiness Probe
Kubernetes readiness probe to determine if the service is ready to accept traffic.

**Endpoint**: `GET /ready`  
**Authentication**: Not required  
**Response**: `200 OK` when ready, `503 Service Unavailable` when not ready

### Liveness Probe
Kubernetes liveness probe to determine if the service should be restarted.

**Endpoint**: `GET /live`  
**Authentication**: Not required  
**Response**: `200 OK` when alive, `503 Service Unavailable` when dead

**Section sources**
- [health-api.ts](file://apps\server\src\routes\health-api.ts#L0-L199)

## Metrics API
The Metrics API provides access to system and audit metrics.

### Base Path
`/api/v1/metrics`

### System Metrics
Retrieves current system performance metrics.

**Endpoint**: `GET /system`  
**Authentication**: Required  
**Permissions**: Admin

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "server": {
    "uptime": 3600,
    "memoryUsage": { "used": 1024, "total": 4096, "percentage": 25 },
    "cpuUsage": { "percentage": 15, "loadAverage": [1.2, 1.1, 1.0] }
  },
  "database": {
    "connectionCount": 10,
    "activeQueries": 2,
    "averageQueryTime": 15
  },
  "redis": {
    "connectionCount": 5,
    "memoryUsage": 256,
    "keyCount": 1000
  },
  "api": {
    "requestsPerSecond": 100,
    "averageResponseTime": 25,
    "errorRate": 0.1
  }
}
```

### Audit Metrics
Retrieves audit-specific metrics.

**Endpoint**: `GET /audit`  
**Authentication**: Required  
**Permissions**: Admin

Supports time range filtering via query parameters.

### Alert Management
Endpoints for managing system alerts.

**Endpoints**:
- `GET /alerts`: List alerts with filtering
- `GET /alerts/{id}`: Get alert details
- `POST /alerts/acknowledge`: Acknowledge an alert
- `POST /alerts/{id}/resolve`: Resolve an alert

**Section sources**
- [metrics-api.ts](file://apps\server\src\routes\metrics-api.ts#L0-L199)

## Observability API
The Observability API provides comprehensive monitoring and analytics capabilities.

### Base Path
`/api/v1/observability`

### Dashboard Data
Retrieves comprehensive dashboard data for system monitoring.

**Endpoint**: `GET /dashboard`  
**Authentication**: Required  
**Permissions**: Admin

Returns a comprehensive data structure including:
- System overview metrics
- Performance metrics and bottlenecks
- Component health status
- Alert statistics
- Trend analysis

### Enhanced Metrics
Provides enhanced metrics in multiple formats.

**Endpoint**: `GET /metrics/enhanced`  
**Authentication**: Required  
**Permissions**: Admin

Supports `format` query parameter for JSON or Prometheus format.

### Bottleneck Analysis
Identifies system bottlenecks with detailed analysis.

**Endpoint**: `GET /bottlenecks`  
**Authentication**: Required  
**Permissions**: Admin

Returns detailed information about performance bottlenecks including:
- Component and operation
- Timing metrics (average, p95, p99)
- Severity level
- Recommendations for improvement

**Section sources**
- [observability-api.ts](file://apps\server\src\routes\observability-api.ts#L0-L199)

## Organization Role Management API
The Organization Role Management API provides endpoints for creating and managing organization-specific roles with associated permissions.

### Base Path
`/api/v1/organization`

### Create Organization Role
Creates a new role within the organization with specified permissions and inheritance.

**Endpoint**: `POST /role`  
**Authentication**: Required  
**Permissions**: Organization admin access

**Request Body**:
```json
{
  "name": "auditor",
  "description": "Audit event viewer with verification capabilities",
  "permissions": [
    {
      "resource": "audit.events",
      "action": "read"
    },
    {
      "resource": "audit.events",
      "action": "verify"
    }
  ],
  "inherits": ["viewer"]
}
```

**Response**: `201 Created` with the created role details.

### Database Schema
The organization roles are stored in the `organization_role` table with the following schema:

```sql
CREATE TABLE "organization_role" (
	"organization_id" varchar(50) NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"permissions" jsonb NOT NULL,
	"inherits" jsonb,
	CONSTRAINT "organization_role_organization_id_name_pk" PRIMARY KEY("organization_id","name")
);
```

The table includes a composite primary key of organization_id and name, with a foreign key constraint to the organization table and indexes on both organization_id and name for efficient querying.

**Section sources**
- [organization-api.ts](file://apps\server\src\routes\organization-api.ts#L1-L222)
- [0005_fluffy_donald_blake.sql](file://packages\auth\drizzle\0005_fluffy_donald_blake.sql#L1-L11)

## Enhanced Structured Logging System
The server implements an enhanced structured logging system for comprehensive monitoring, debugging, and auditing.

### LoggerFactory and StructuredLogger
The system uses a factory pattern with `LoggerFactory` to create consistent `StructuredLogger` instances across services. The logger captures detailed contextual information and supports multiple output formats.

**Key Features:**
- Correlation ID tracking for request tracing
- Contextual information (user ID, session ID, organization ID)
- Performance metrics (memory usage, CPU usage)
- Error tracking with stack traces
- Log aggregation support

### Logger Configuration
The default logger configuration is set during server initialization:

```typescript
LoggerFactory.setDefaultConfig({
	level: config.server.monitoring.logLevel,
	enablePerformanceLogging: true,
	enableErrorTracking: true,
	enableMetrics: config.server.monitoring.enableMetrics,
	format: config.server.environment === 'development' ? 'pretty' : 'json',
	outputs: ['console', 'otpl'],
	otplConfig: {
		endpoint: config.logging.exporterEndpoint || '',
		headers: config.logging.exporterHeaders || {},
	},
})
```

### Log Entry Structure
All log entries follow a standardized structure:

```json
{
	"timestamp": "2024-01-01T00:00:00.000Z",
	"level": "info",
	"message": "Request completed",
	"context": {
		"requestId": "req_123",
		"userId": "usr_456",
		"sessionId": "sess_789",
		"organizationId": "org_012",
		"endpoint": "/api/v1/audit/events",
		"method": "POST"
	},
	"metadata": {
		"request": {
			"method": "POST",
			"path": "/api/v1/audit/events",
			"statusCode": 201,
			"duration": 45
		}
	},
	"performance": {
		"memoryUsage": {
			"rss": 30000000,
			"heapTotal": 20000000,
			"heapUsed": 15000000,
			"external": 1000000
		},
		"cpuUsage": {
			"user": 1000000,
			"system": 500000
		}
	}
}
```

### Output Targets
The logging system supports multiple output targets:
- **Console**: For development and debugging
- **OTLP**: For observability platforms (OpenTelemetry)
- **File**: For persistent storage
- **Redis**: For log aggregation

### Request Context Enrichment
The error handling middleware includes request context enrichment, capturing detailed information about each request:

```mermaid
sequenceDiagram
participant Client
participant Server
participant Logger
Client->>Server : API Request
Server->>Logger : Create request context
Logger->>Logger : Add requestId, userId, sessionId
Logger->>Logger : Add endpoint, method, userAgent
Logger->>Logger : Add IP address, metadata
Server->>Client : Process request
```

**Section sources**
- [init.ts](file://apps\server\src\lib\hono\init.ts#L1-L400)
- [error-handling.ts](file://apps\server\src\lib\middleware\error-handling.ts#L1-L372)
- [logging.ts](file://packages\logs\src\logging.ts#L1-L620)

## KMS Integration and Enhanced OTLP Exporter
The system now integrates KMS encryption with the OTLP exporter for enhanced security and observability.

### KMS Configuration
The system uses Infisical KMS for cryptographic operations with the following configuration:

```typescript
const kmsConfig = {
	baseUrl: process.env.KMS_BASE_URL,
	encryptionKey: process.env.KMS_ENCRYPTION_KEY,
	signingKey: process.env.KMS_SIGNING_KEY,
	accessToken: process.env.KMS_ACCESS_TOKEN,
}
```

The KMS client is initialized during server startup and used for:
- Event signature creation and verification
- Configuration file encryption/decryption
- Secure credential management

**Section sources**
- [client.ts](file://packages\infisical-kms\src\client.ts#L1-L73)
- [types.ts](file://packages\infisical-kms\src\types.ts#L1-L50)
- [init.ts](file://apps\server\src\lib\hono\init.ts#L1-L400)

### Enhanced OTLP Exporter
The OTLP exporter has been enhanced with KMS integration and improved reliability features.

#### Configuration
The OTLP exporter is configured through the logging configuration:

```json
{
	"logging": {
		"exporterType": "otlp",
		"exporterEndpoint": "https://observability-platform.com/v1/traces",
		"exporterHeaders": {
			"Authorization": "Bearer ${OTLP_API_KEY}"
		}
	}
}
```

#### Authentication Methods
The exporter supports multiple authentication methods:
- **Bearer Token**: Using `OTLP_API_KEY` environment variable
- **Custom Header**: Using `OTLP_AUTH_HEADER` environment variable
- **KMS-secured Credentials**: Credentials encrypted with KMS

#### Security Features
- **KMS Encryption**: All sensitive configuration encrypted with KMS
- **Secure Headers**: Authentication headers protected by KMS
- **TLS Support**: All endpoints use HTTPS by default
- **Credential Rotation**: Automatic key rotation every 30 days

#### Reliability Features
- **Exponential Backoff**: Automatic retry with increasing delays
- **Rate Limit Handling**: Respects `Retry-After` headers
- **Batch Processing**: Configurable batch size (default: 100 spans)
- **Timeout-based Flushing**: Batches flushed every 5 seconds

**Section sources**
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L304-L537)
- [crypto.ts](file://packages\audit\src\crypto.ts#L127-L174)
- [observability-api.ts](file://apps\server\src\routes\observability-api.ts#L1-L400)

### Integration with Observability
The enhanced OTLP exporter integrates with the observability API to provide secure, reliable telemetry data.

#### Trace Export Process
```mermaid
sequenceDiagram
participant Client
participant Server
participant KMS
participant OTLP
Client->>Server : API Request
Server->>KMS : Encrypt trace data
KMS-->>Server : Encrypted data
Server->>OTLP : Send encrypted traces
OTLP-->>Server : 200 OK
Server->>Client : Response
```

#### Error Handling
The system handles KMS and OTLP errors with appropriate fallbacks:
- **KMS Unavailable**: Falls back to HMAC-SHA256 signatures
- **OTLP Endpoint Unreachable**: Retries with exponential backoff
- **Authentication Failure**: Logs error and continues with reduced security

**Diagram sources**
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L304-L537)
- [crypto.ts](file://packages\audit\src\crypto.ts#L127-L174)

## Request and Response Examples
This section provides practical examples of API usage.

### Create Audit Event
```bash
curl -X POST https://api.smedrec.com/api/v1/audit/events \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Accept-Version: 1.0.0" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "patient.record.access",
    "targetResourceType": "medical_record",
    "targetResourceId": "mr_789",
    "principalId": "usr_123",
    "organizationId": "org_456",
    "status": "success",
    "dataClassification": "PHI",
    "sessionContext": {
      "sessionId": "sess_abc",
      "ipAddress": "192.168.1.1"
    }
  }'
```

### Query Audit Events
```bash
curl -X GET "https://api.smedrec.com/api/v1/audit/events?actions=user.login,record.access&statuses=success&startDate=2024-01-01T00:00:00Z&limit=25" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Accept-Version: 1.0.0"
```

### Create Organization Role
```bash
curl -X POST https://api.smedrec.com/api/v1/organization/role \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Accept-Version: 1.0.0" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "compliance-officer",
    "description": "User with compliance reporting permissions",
    "permissions": [
      {
        "resource": "compliance.reports",
        "action": "generate"
      },
      {
        "resource": "audit.events",
        "action": "read"
      }
    ],
    "inherits": ["auditor"]
  }'
```

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

### Error Response
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": {
    "issues": [
      {
        "path": "action",
        "message": "Required",
        "code": "too_small"
      }
    ]
  },
  "timestamp": "2024-01-01T12:00:00.000Z",
  "requestId": "req_123456789",
  "path": "/api/v1/audit/events"
}
```

### Paginated Response
```json
{
  "events": [
    {
      "id": "evt_123",
      "timestamp": "2024-01-01T10:00:00.000Z",
      "action": "user.login",
      "principalId": "usr_123",
      "status": "success"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

**Section sources**
- [rest-api.ts](file://apps\server\src\routes\rest-api.ts#L1-L329)
- [audit-api.ts](file://apps\server\src\routes\audit-api.ts#L0-L199)
- [health-api.ts](file://apps\server\src\routes\health-api.ts#L0-L199)
- [organization-api.ts](file://apps\server\src\routes\organization-api.ts#L1-L222)

## Alert Management API
The Alert Management API provides endpoints for managing system alerts with updated field mappings and route changes.

### Base Path
`/api/v1/alerts`

### Alert Object Structure
The alert object has been updated with new field names to improve consistency and clarity:

**Updated Field Mappings**:
- `timestamp` → `created_at` (ISO 8601 formatted string)
- `acknowledgedBy` → `acknowledged_by` (string)
- `acknowledgedAt` → `acknowledged_at` (ISO 8601 formatted string)
- `resolvedBy` → `resolved_by` (string)
- `resolvedAt` → `resolved_at` (ISO 8601 formatted string)

**Alert Schema**:
```json
{
  "id": "alrt_123",
  "title": "High CPU Usage",
  "description": "CPU usage has exceeded 90% for the past 5 minutes",
  "severity": "HIGH",
  "type": "PERFORMANCE",
  "status": "active",
  "source": "system-monitor",
  "created_at": "2024-01-01T10:00:00.000Z",
  "acknowledged_at": "2024-01-01T10:05:00.000Z",
  "acknowledged_by": "usr_456",
  "resolved_at": "2024-01-01T10:15:00.000Z",
  "resolved_by": "usr_789",
  "resolutionNotes": "Restarted monitoring service",
  "metadata": {
    "cpu_usage": 95,
    "process_count": 150
  },
  "tags": ["performance", "system"]
}
```

### Route Changes
The `/alerts/board` route has been removed as part of the UI refactoring. The primary alert endpoints are now:

- `GET /alerts`: List all alerts (replaces board view functionality)
- `GET /alerts/{id}`: Get specific alert details
- `POST /alerts/{id}/acknowledge`: Acknowledge an alert
- `POST /alerts/{id}/resolve`: Resolve an alert
- `POST /alerts/{id}/dismiss`: Dismiss an alert

### Query Parameters
The alert listing endpoint supports the following query parameters for filtering and sorting:

- `severity`: Filter by alert severity (CRITICAL, HIGH, MEDIUM, LOW, INFO)
- `type`: Filter by alert type (SYSTEM, SECURITY, PERFORMANCE, COMPLIANCE, CUSTOM)
- `status`: Filter by alert status (active, acknowledged, resolved, dismissed)
- `source`: Filter by source system
- `startDate`, `endDate`: Time range filtering by created_at
- `limit`: Items per page (default: 50, maximum: 100)
- `offset`: Items to skip
- `sortField`: Field to sort by (created_at, severity, status)
- `sortDirection`: Sort direction (asc, desc)

### Response Format
The alert listing endpoint returns a paginated response:

```json
{
  "alerts": [
    {
      "id": "alrt_123",
      "title": "Security Breach Attempt",
      "description": "Multiple failed login attempts detected",
      "severity": "CRITICAL",
      "type": "SECURITY",
      "status": "active",
      "source": "auth-service",
      "created_at": "2024-01-01T09:30:00.000Z",
      "metadata": {
        "ip_address": "192.168.1.100",
        "attempt_count": 15
      },
      "tags": ["security", "login"]
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0,
    "hasNext": false,
    "hasPrevious": false
  }
}
```

**Section sources**
- [AlertDashboard.tsx](file://apps\app\src\components\alerts\core\AlertDashboard.tsx#L1-L459)
- [AlertList.tsx](file://apps\app\src\components\alerts\core\AlertList.tsx#L1-L572)
- [AlertDetails.tsx](file://apps\app\src\components\alerts\core\AlertDetails.tsx#L1-L520)
- [alert.ts](file://apps\app\src\lib\types\alert.ts#L52-L83)
- [collections.ts](file://apps\app\src\lib\collections.ts#L57-L57)
- [types.ts](file://apps\server\src\lib\graphql\types.ts#L254-L267)