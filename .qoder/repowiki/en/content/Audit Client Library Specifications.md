# Audit Client Library Specifications

<cite>
**Referenced Files in This Document**   
- [README.md](file://packages/audit-client/README.md)
- [client.ts](file://packages/audit-client/src/core/client.ts)
- [config.ts](file://packages/audit-client/src/core/config.ts)
- [events.ts](file://packages/audit-client/src/services/events.ts)
- [compliance.ts](file://packages/audit-client/src/services/compliance.ts)
- [metrics.ts](file://packages/audit-client/src/services/metrics.ts)
- [auth.ts](file://packages/audit-client/src/infrastructure/auth.ts)
- [cache.ts](file://packages/audit-client/src/infrastructure/cache.ts)
- [retry.ts](file://packages/audit-client/src/infrastructure/retry.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Core Components](#core-components)
4. [API Interfaces](#api-interfaces)
5. [Configuration Management](#configuration-management)
6. [Integration Patterns](#integration-patterns)
7. [Practical Examples](#practical-examples)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Performance Considerations](#performance-considerations)

## Introduction

The Audit Client Library is a comprehensive TypeScript SDK designed for seamless integration with the Smart Logs Audit API. It provides a robust, type-safe interface for managing audit events, compliance reporting, and system monitoring with built-in features for reliability, performance, and security.

The library follows a modular architecture with clear separation of concerns, making it easy to use while providing advanced capabilities for complex use cases. It supports modern development practices including TypeScript type safety, promise-based async operations, and configurable retry mechanisms.

Key features of the Audit Client Library include:
- **Type Safety**: Full TypeScript support with strict type checking
- **Reliability**: Exponential backoff retry logic with circuit breaker pattern
- **Performance**: Intelligent caching with multiple storage backends
- **Security**: Flexible authentication support including API keys and session tokens
- **Observability**: Structured logging and request/response inspection
- **Extensibility**: Plugin architecture for custom middleware, storage, and auth

The library is designed to work in both browser and Node.js environments, making it suitable for frontend applications, backend services, and serverless functions.

**Section sources**
- [README.md](file://packages/audit-client/README.md#L1-L50)

## Architecture Overview

The Audit Client Library follows a layered architectural pattern with four main layers that provide separation of concerns and maintainability.

```mermaid
graph TB
subgraph "Client Layer"
Client[AuditClient]
end
subgraph "Service Layer"
Events[EventsService]
Compliance[ComplianceService]
Metrics[MetricsService]
Health[HealthService]
Presets[PresetsService]
Reports[ScheduledReportsService]
end
subgraph "Infrastructure Layer"
Auth[AuthManager]
Cache[CacheManager]
Retry[RetryManager]
Batch[BatchManager]
Logger[Logger]
Plugins[PluginManager]
end
subgraph "Core Layer"
Config[ConfigManager]
Base[BaseResource]
end
Client --> Events
Client --> Compliance
Client --> Metrics
Client --> Health
Client --> Presets
Client --> Reports
Events --> Auth
Events --> Cache
Events --> Retry
Events --> Batch
Events --> Logger
Events --> Plugins
Compliance --> Auth
Compliance --> Cache
Compliance --> Retry
Compliance --> Batch
Compliance --> Logger
Compliance --> Plugins
Metrics --> Auth
Metrics --> Cache
Metrics --> Retry
Metrics --> Batch
Metrics --> Logger
Metrics --> Plugins
Client --> Config
Client --> Base
Events --> Config
Events --> Base
Compliance --> Config
Compliance --> Base
Metrics --> Config
Metrics --> Base
```

**Diagram sources **
- [client.ts](file://packages/audit-client/src/core/client.ts#L1-L100)
- [config.ts](file://packages/audit-client/src/core/config.ts#L1-L50)

**Section sources**
- [README.md](file://packages/audit-client/README.md#L51-L100)

## Core Components

The Audit Client Library is composed of several core components that work together to provide a comprehensive audit management solution.

### AuditClient Class

The `AuditClient` class serves as the main entry point for the library. It orchestrates all services and manages the client lifecycle, configuration, and infrastructure components.

Key responsibilities of the AuditClient include:
- Service initialization and dependency injection
- Unified configuration management
- Client lifecycle management and cleanup
- Centralized error handling
- Performance monitoring and statistics
- Request/response interceptor management

The client follows a factory pattern, creating service instances during initialization and providing them through getter properties that validate the client state before returning the service.

```mermaid
classDiagram
class AuditClient {
-configManager : ConfigManager
-config : AuditClientConfig
-state : ClientState
-startTime : number
+events : EventsService
+compliance : ComplianceService
+metrics : MetricsService
+health : HealthService
+presets : PresetsService
+scheduledReports : ScheduledReportsService
+plugins : PluginManager
+getConfig() : AuditClientConfig
+updateConfig(updates : PartialAuditClientConfig) : void
+getStats() : ClientStats
+isReady() : boolean
+destroy() : Promise~void~
}
class ClientState {
<<enumeration>>
initializing
ready
error
destroyed
}
class ClientStats {
+state : ClientState
+uptime : number
+requestCount : number
+errorCount : number
+cacheStats : any
+retryStats : any
+batchStats : any
+authStats : any
}
AuditClient --> ConfigManager : "uses"
AuditClient --> EventsService : "creates"
AuditClient --> ComplianceService : "creates"
AuditClient --> MetricsService : "creates"
AuditClient --> HealthService : "creates"
AuditClient --> PresetsService : "creates"
AuditClient --> ScheduledReportsService : "creates"
AuditClient --> PluginManager : "uses"
```

**Diagram sources **
- [client.ts](file://packages/audit-client/src/core/client.ts#L101-L200)

**Section sources**
- [client.ts](file://packages/audit-client/src/core/client.ts#L1-L825)

### Configuration Management

The configuration system provides comprehensive options for customizing the client behavior. The `ConfigManager` class validates and normalizes configuration using Zod schemas, ensuring type safety and correctness.

Configuration options are organized into logical groups:
- **Connection settings**: Base URL, API version, timeout
- **Authentication**: API keys, session tokens, bearer tokens
- **Retry configuration**: Maximum attempts, delay settings, retryable status codes
- **Caching**: TTL, storage backend, compression
- **Performance**: Request batching, compression, streaming
- **Logging**: Log level, format, sensitive data masking
- **Error handling**: Error transformation, recovery options
- **Plugins**: Middleware, storage, and authentication plugins

```mermaid
classDiagram
class AuditClientConfig {
+baseUrl : string
+apiVersion : string
+timeout : number
+authentication : AuthenticationConfig
+retry : RetryConfig
+cache : CacheConfig
+batching : BatchingConfig
+performance : PerformanceConfig
+logging : LoggingConfig
+errorHandling : ErrorHandlingConfig
+plugins : PluginConfig
+environment : string
+customHeaders : Record~string, string~
+interceptors : InterceptorConfig
}
class AuthenticationConfig {
+type : 'apiKey' | 'session' | 'bearer' | 'custom'
+apiKey : string
+sessionToken : string
+bearerToken : string
+customHeaders : Record~string, string~
+autoRefresh : boolean
+refreshEndpoint : string
}
class RetryConfig {
+enabled : boolean
+maxAttempts : number
+initialDelayMs : number
+maxDelayMs : number
+backoffMultiplier : number
+retryableStatusCodes : number[]
+retryableErrors : string[]
}
class CacheConfig {
+enabled : boolean
+defaultTtlMs : number
+maxSize : number
+storage : 'memory' | 'localStorage' | 'sessionStorage' | 'custom'
+customStorage : any
+keyPrefix : string
+compressionEnabled : boolean
}
AuditClientConfig --> AuthenticationConfig
AuditClientConfig --> RetryConfig
AuditClientConfig --> CacheConfig
AuditClientConfig --> BatchingConfig
AuditClientConfig --> PerformanceConfig
AuditClientConfig --> LoggingConfig
AuditClientConfig --> ErrorHandlingConfig
AuditClientConfig --> PluginConfig
```

**Diagram sources **
- [config.ts](file://packages/audit-client/src/core/config.ts#L1-L100)

**Section sources**
- [config.ts](file://packages/audit-client/src/core/config.ts#L1-L530)

## API Interfaces

The Audit Client Library provides several specialized services for different aspects of audit management.

### Events Service

The `EventsService` provides comprehensive functionality for managing audit events, including creation, querying, verification, and export.

```mermaid
classDiagram
class EventsService {
+create(event : CreateAuditEventInput, options : CreateAuditEventOptions) : Promise~AuditEvent~
+bulkCreate(events : CreateAuditEventInput[]) : Promise~BulkCreateResult~
+query(params : QueryAuditEventsParams) : Promise~PaginatedAuditEvents~
+getById(id : string) : Promise~AuditEvent | null~
+verify(id : string) : Promise~IntegrityVerificationResult~
+export(params : ExportEventsParams) : Promise~ExportResult~
+stream(params : StreamEventsParams) : Promise~ReadableStream~
+subscribe(params : SubscriptionParams) : EventSubscription
}
class CreateAuditEventInput {
+action : string
+targetResourceType : string
+targetResourceId : string
+principalId : string
+organizationId : string
+status : AuditEventStatus
+outcomeDescription : string
+dataClassification : DataClassification
+sessionContext : SessionContext
+details : Record~string, any~
}
class AuditEvent {
+id : string
+timestamp : string
+action : string
+targetResourceType : string
+targetResourceId : string
+principalId : string
+organizationId : string
+status : AuditEventStatus
+outcomeDescription : string
+dataClassification : DataClassification
+details : Record~string, any~
+hash : string
+correlationId : string
+sessionContext : SessionContext
}
class QueryAuditEventsParams {
+filter : Filter
+pagination : Pagination
+sort : Sort
}
class Filter {
+dateRange : DateRange
+principalIds : string[]
+organizationIds : string[]
+actions : string[]
+statuses : AuditEventStatus[]
+dataClassifications : DataClassification[]
+resourceTypes : string[]
+verifiedOnly : boolean
+correlationId : string
}
class DateRange {
+startDate : string
+endDate : string
}
class Pagination {
+limit : number
+offset : number
}
class Sort {
+field : 'timestamp' | 'status' | 'action'
+direction : 'asc' | 'desc'
}
EventsService --> CreateAuditEventInput
EventsService --> AuditEvent
EventsService --> QueryAuditEventsParams
QueryAuditEventsParams --> Filter
Filter --> DateRange
QueryAuditEventsParams --> Pagination
QueryAuditEventsParams --> Sort
```

**Diagram sources **
- [events.ts](file://packages/audit-client/src/services/events.ts#L1-L100)

**Section sources**
- [events.ts](file://packages/audit-client/src/services/events.ts#L1-L952)

### Compliance Service

The `ComplianceService` provides functionality for generating compliance reports and handling GDPR data export requests.

```mermaid
classDiagram
class ComplianceService {
+generateHipaaReport(criteria : ReportCriteria) : Promise~HIPAAReport~
+generateGdprReport(criteria : ReportCriteria) : Promise~GDPRReport~
+generateCustomReport(params : CustomReportParams) : Promise~CustomReport~
+exportGdprData(params : GdprExportParams) : Promise~GdprExportResult~
+pseudonymizeData(params : PseudonymizationParams) : Promise~PseudonymizationResult~
+getReportTemplates() : Promise~ReportTemplate[]~
+getReportTemplate(templateId : string) : Promise~ReportTemplate | null~
+createReportTemplate(template : Omit~ReportTemplate, 'id' | 'createdAt' | 'updatedAt~) : Promise~ReportTemplate~
+updateReportTemplate(templateId : string, updates : Partial~ReportTemplate~) : Promise~ReportTemplate~
+deleteReportTemplate(templateId : string) : Promise~void~
+downloadReport(reportId : string, options : ReportDownloadOptions) : Promise~Blob~
+getReportStatus(reportId : string) : Promise~ReportStatus~
+cancelReport(reportId : string) : Promise~void~
+streamReport(reportId : string, format : 'json' | 'csv') : Promise~ReadableStream~
+getReportHistory(organizationId : string, params : ReportHistoryParams) : Promise~ReportHistory~
}
class ReportCriteria {
+dateRange : DateRange
+organizationIds : string[]
+principalIds : string[]
+resourceTypes : string[]
+actions : string[]
+dataClassifications : DataClassification[]
+includeDetails : boolean
+includeMetadata : boolean
}
class HIPAAReport {
+id : string
+generatedAt : string
+criteria : ReportCriteria
+summary : HIPAASummary
+sections : HIPAASection[]
+metadata : ReportMetadata
}
class GDPRReport {
+id : string
+generatedAt : string
+criteria : ReportCriteria
+summary : GDPRSummary
+sections : GDPRSection[]
+metadata : ReportMetadata
}
class CustomReport {
+id : string
+name : string
+description : string
+generatedAt : string
+template : string
+parameters : Record~string, any~
+data : any[]
+summary : Record~string, any~
+charts : Chart[]
+metadata : ReportMetadata
}
ReportCriteria --> DateRange
HIPAAReport --> HIPAASummary
HIPAAReport --> HIPAASection
HIPAAReport --> ReportMetadata
GDPRReport --> GDPRSummary
GDPRReport --> GDPRSection
GDPRReport --> ReportMetadata
CustomReport --> Chart
CustomReport --> ReportMetadata
```

**Diagram sources **
- [compliance.ts](file://packages/audit-client/src/services/compliance.ts#L1-L100)

**Section sources**
- [compliance.ts](file://packages/audit-client/src/services/compliance.ts#L1-L718)

### Metrics Service

The `MetricsService` provides comprehensive system monitoring capabilities including system metrics, audit metrics, performance metrics, and alert management.

```mermaid
classDiagram
class MetricsService {
+getSystemMetrics() : Promise~SystemMetrics~
+getAuditMetrics(params : AuditMetricsParams) : Promise~AuditMetrics~
+getPerformanceMetrics() : Promise~PerformanceMetrics~
+getUsageMetrics(params : UsageMetricsParams) : Promise~UsageMetrics~
+getAlerts(params : AlertsParams) : Promise~PaginatedAlerts~
+getAlert(id : string) : Promise~Alert | null~
+acknowledgeAlert(id : string, request : AcknowledgeAlertRequest) : Promise~Alert~
+resolveAlert(id : string, request : ResolveAlertRequest) : Promise~Alert~
+suppressAlert(id : string, duration : number, reason : string) : Promise~Alert~
+getHistoricalMetrics(type : MetricsType, timeRange : DateRange, granularity : Granularity) : Promise~any[]~
+exportMetrics(type : MetricsType, timeRange : DateRange, format : ExportFormat) : Promise~Blob~
+subscribeToMetrics(params : MetricsSubscriptionParams) : MetricsSubscription
+getDashboardSummary() : Promise~DashboardSummary~
+customQuery(query : CustomQuery) : Promise~any~
+getMetricsConfig() : Promise~MetricsConfig~
+updateMetricsConfig(config : Partial~MetricsConfig~) : Promise~any~
}
class SystemMetrics {
+timestamp : string
+server : ServerMetrics
+database : DatabaseMetrics
+cache : CacheMetrics
+api : ApiMetrics
}
class AuditMetrics {
+timestamp : string
+timeRange : DateRange
+eventsProcessed : number
+processingLatency : LatencyMetrics
+integrityVerifications : VerificationMetrics
+complianceReports : ReportMetrics
+errorRates : ErrorMetrics
+dataClassificationStats : ClassificationStats
}
class PerformanceMetrics {
+timestamp : string
+responseTime : ResponseTimeMetrics
+throughput : ThroughputMetrics
+resourceUtilization : ResourceUtilizationMetrics
+concurrency : ConcurrencyMetrics
}
class UsageMetrics {
+timestamp : string
+timeRange : DateRange
+apiUsage : ApiUsageMetrics
+auditEvents : EventMetrics
+reports : ReportMetrics
+storage : StorageMetrics
}
MetricsService --> SystemMetrics
MetricsService --> AuditMetrics
MetricsService --> PerformanceMetrics
MetricsService --> UsageMetrics
MetricsService --> Alert
MetricsService --> MetricsSubscription
```

**Diagram sources **
- [metrics.ts](file://packages/audit-client/src/services/metrics.ts#L1-L100)

**Section sources**
- [metrics.ts](file://packages/audit-client/src/services/metrics.ts#L1-L903)

## Configuration Management

The Audit Client Library provides flexible configuration options through the `ConfigManager` class, which validates and normalizes configuration using Zod schemas.

### Configuration Validation

Configuration validation ensures that all settings are correct and within acceptable ranges. The library uses Zod schemas to define the structure and constraints for each configuration option.

```mermaid
flowchart TD
Start([Configuration Input]) --> Validate["Validate with Zod Schemas"]
Validate --> Valid{"Valid?"}
Valid --> |Yes| Normalize["Normalize Configuration"]
Valid --> |No| HandleError["Throw ConfigurationError"]
Normalize --> Apply["Apply Configuration"]
Apply --> Initialize["Initialize Components"]
Initialize --> Complete([Configuration Complete])
HandleError --> Complete
```

**Diagram sources **
- [config.ts](file://packages/audit-client/src/core/config.ts#L101-L200)

**Section sources**
- [config.ts](file://packages/audit-client/src/core/config.ts#L1-L530)

### Environment-Specific Configuration

The library supports environment-specific configuration through the `createDefaultConfig` method, which provides sensible defaults for different environments.

```typescript
// Create client for specific environment
const client = AuditClient.createForEnvironment(
  'production',
  'https://api.smartlogs.com',
  {
    type: 'apiKey',
    apiKey: 'your-api-key'
  }
);
```

Environment-specific defaults:
- **Development**: Debug logging, lower retry limits, detailed error messages
- **Staging**: Info logging, standard retry configuration, performance monitoring
- **Production**: Warning logging, aggressive caching, high concurrency limits

**Section sources**
- [config.ts](file://packages/audit-client/src/core/config.ts#L400-L500)

## Integration Patterns

The Audit Client Library supports several integration patterns for different use cases and environments.

### Authentication Integration

The library supports multiple authentication methods through the `AuthManager` class.

```mermaid
sequenceDiagram
participant App as "Application"
participant Client as "AuditClient"
participant Auth as "AuthManager"
participant API as "Audit API"
App->>Client : Create client with config
Client->>Auth : Initialize with auth config
App->>Client : Make API request
Client->>Auth : Get auth headers
Auth->>Auth : Check token cache
Auth->>Auth : Refresh token if needed
Auth-->>Client : Return auth headers
Client->>API : Make request with auth headers
API-->>Client : Return response
Client-->>App : Return result
```

**Diagram sources **
- [auth.ts](file://packages/audit-client/src/infrastructure/auth.ts#L1-L100)

**Section sources**
- [auth.ts](file://packages/audit-client/src/infrastructure/auth.ts#L1-L439)

### Caching Strategy

The `CacheManager` provides intelligent caching with multiple storage backends and automatic cleanup.

```mermaid
flowchart TD
Request["API Request"] --> CheckCache["Check Cache"]
CheckCache --> CacheHit{"Cache Hit?"}
CacheHit --> |Yes| ReturnCache["Return Cached Data"]
CacheHit --> |No| CallAPI["Call API"]
CallAPI --> StoreCache["Store in Cache"]
StoreCache --> ReturnResult["Return Result"]
ReturnCache --> End([End])
ReturnResult --> End
```

Supported cache storage backends:
- **Memory**: In-memory cache for Node.js environments
- **localStorage**: Persistent browser storage
- **sessionStorage**: Session-scoped browser storage
- **Custom**: Custom storage implementation

**Diagram sources **
- [cache.ts](file://packages/audit-client/src/infrastructure/cache.ts#L1-L100)

**Section sources**
- [cache.ts](file://packages/audit-client/src/infrastructure/cache.ts#L1-L781)

### Retry and Circuit Breaker

The `RetryManager` implements exponential backoff retry logic with circuit breaker pattern.

```mermaid
flowchart TD
Start([Request]) --> CheckCircuit["Check Circuit Breaker"]
CheckCircuit --> Open{"Circuit Open?"}
Open --> |Yes| Wait["Wait for Recovery"]
Open --> |No| Attempt["Make Request Attempt"]
Attempt --> Success{"Success?"}
Success --> |Yes| Complete([Request Complete])
Success --> |No| ShouldRetry{"Should Retry?"}
ShouldRetry --> |Yes| CalculateDelay["Calculate Delay"]
CalculateDelay --> WaitDelay["Wait"]
WaitDelay --> Attempt
ShouldRetry --> |No| Fail([Request Failed])
Wait --> CheckCircuit
```

**Diagram sources **
- [retry.ts](file://packages/audit-client/src/infrastructure/retry.ts#L1-L100)

**Section sources**
- [retry.ts](file://packages/audit-client/src/infrastructure/retry.ts#L1-L522)

## Practical Examples

### Basic Usage

```typescript
import { AuditClient } from '@smedrec/audit-client'

// Create client instance
const client = new AuditClient({
  baseUrl: 'https://api.smartlogs.com',
  authentication: {
    type: 'apiKey',
    apiKey: 'your-api-key',
  },
})

// Create an audit event
const event = await client.events.create({
  action: 'user.login',
  principalId: 'user-123',
  organizationId: 'org-456',
  status: 'success',
  targetResourceType: 'user',
  dataClassification: 'PUBLIC',
})
```

**Section sources**
- [README.md](file://packages/audit-client/README.md#L101-L150)

### Advanced Configuration

```typescript
import { AuditClient } from '@smedrec/audit-client'

const config = {
  baseUrl: 'https://api.smartlogs.com',
  authentication: {
    type: 'apiKey',
    apiKey: 'your-api-key',
    autoRefresh: true,
  },
  retry: {
    enabled: true,
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  cache: {
    enabled: true,
    defaultTtlMs: 300000, // 5 minutes
    storage: 'memory',
  },
  logging: {
    enabled: true,
    level: 'info',
    maskSensitiveData: true,
  },
}

const client = new AuditClient(config)
```

**Section sources**
- [README.md](file://packages/audit-client/README.md#L151-L200)

### Event Querying

```typescript
// Query events with filtering and pagination
const events = await client.events.query({
  filter: {
    dateRange: {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    },
    principalIds: ['user-123'],
    actions: ['user.login', 'user.logout'],
  },
  pagination: {
    limit: 50,
    offset: 0,
  },
  sort: {
    field: 'timestamp',
    direction: 'desc',
  },
})
```

**Section sources**
- [events.ts](file://packages/audit-client/src/services/events.ts#L300-L400)

### Compliance Reporting

```typescript
// Generate HIPAA compliance report
const hipaaReport = await client.compliance.generateHipaaReport({
  dateRange: {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  },
  organizationIds: ['org-456'],
})

// Export GDPR data
const exportResult = await client.compliance.exportGdprData({
  dataSubjectId: 'user-123',
  organizationId: 'org-456',
  includePersonalData: true,
  format: 'json',
})
```

**Section sources**
- [compliance.ts](file://packages/audit-client/src/services/compliance.ts#L100-L200)

## Troubleshooting Guide

### Common Issues and Solutions

| Issue | Possible Cause | Solution |
|------|---------------|----------|
| Authentication errors | Invalid API key or token | Verify credentials and check expiration |
| Rate limiting | Too many requests | Implement retry logic with exponential backoff |
| Network timeouts | Poor connectivity | Increase timeout settings |
| Cache issues | Storage quota exceeded | Clear cache or switch to different storage backend |
| Type errors | Version mismatch | Ensure compatible TypeScript and library versions |

**Section sources**
- [README.md](file://packages/audit-client/README.md#L201-L250)

### Error Handling

The library provides comprehensive error handling with specific error types for different scenarios.

```typescript
try {
  const event = await client.events.create(eventData)
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error('Configuration error:', error.getFormattedErrors())
  } else if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message)
  } else if (error instanceof RetryExhaustedError) {
    console.error('Request failed after retries:', error.attempts)
  } else {
    console.error('Unexpected error:', error)
  }
}
```

**Section sources**
- [client.ts](file://packages/audit-client/src/core/client.ts#L500-L600)

### Debugging Tips

1. Enable debug logging to see detailed request/response information
2. Use the `getStats()` method to monitor client performance
3. Check the health status with `healthCheck()` method
4. Validate configuration with `ConfigManager.validateConfig()`
5. Monitor cache statistics with `cacheManager.getStats()`

**Section sources**
- [client.ts](file://packages/audit-client/src/core/client.ts#L600-L700)

## Performance Considerations

### Request Optimization

The library provides several features to optimize performance:

- **Request batching**: Group multiple requests into a single HTTP call
- **Caching**: Store responses locally to avoid redundant API calls
- **Compression**: Compress request/response payloads
- **Streaming**: Handle large datasets efficiently
- **Connection pooling**: Reuse HTTP connections

### Memory Management

The client implements proper cleanup to prevent memory leaks:

- Automatic cleanup of event listeners
- Proper disposal of WebSocket connections
- Cache cleanup with LRU eviction
- Interval cleanup for periodic tasks

### Best Practices

1. Reuse client instances when possible
2. Configure appropriate cache TTL values
3. Use bulk operations for multiple events
4. Implement proper error handling and retry logic
5. Monitor client statistics for performance issues

**Section sources**
- [client.ts](file://packages/audit-client/src/core/client.ts#L700-L800)