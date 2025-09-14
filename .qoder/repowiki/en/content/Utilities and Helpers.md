# Utilities and Helpers

<cite>
**Referenced Files in This Document**   
- [utils.ts](file://packages/audit-sdk/src/utils.ts)
- [utils.test.ts](file://packages/audit-sdk/src/__tests__/utils.test.ts)
- [middleware.ts](file://packages/audit-sdk/src/middleware.ts)
- [sdk.ts](file://packages/audit-sdk/src/sdk.ts)
- [compliance.ts](file://packages/audit-sdk/src/compliance.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Data Sanitization and Context Normalization](#data-sanitization-and-context-normalization)
3. [Error Serialization and Validation](#error-serialization-and-validation)
4. [Asynchronous Operations and Promise Wrapping](#asynchronous-operations-and-promise-wrapping)
5. [Environment Detection and Diagnostic Logging](#environment-detection-and-diagnostic-logging)
6. [Type Guards and Validation Helpers](#type-guards-and-validation-helpers)
7. [Performance Characteristics and Memory Safety](#performance-characteristics-and-memory-safety)
8. [Integration with Middleware](#integration-with-middleware)
9. [Test Coverage and Examples](#test-coverage-and-examples)

## Introduction
The Audit SDK provides a comprehensive suite of utility functions designed to support secure, compliant, and efficient audit logging in healthcare applications. These utilities handle critical tasks such as data sanitization, context extraction, event batching, rate limiting, and validation. The functions are designed to be modular and reusable across different parts of the application, ensuring consistent behavior and reducing code duplication. This document provides a detailed analysis of these utility functions, their implementation, and their role in supporting the core functionality of the Audit SDK.

## Data Sanitization and Context Normalization

### Data Masking
The `maskSensitiveData` function implements a recursive algorithm to identify and mask sensitive fields in audit events. It uses a configurable list of sensitive field names (defaulting to 'password', 'token', 'secret', and 'key') and applies case-insensitive matching to both direct field names and nested path expressions.

```mermaid
flowchart TD
Start([Start maskSensitiveData]) --> CheckType["Check if value is object"]
CheckType --> |No| ReturnValue["Return value as-is"]
CheckType --> |Yes| CheckArray["Check if value is array"]
CheckArray --> |Yes| ProcessArray["Map over array items<br/>recursively"]
CheckArray --> |No| ProcessObject["Process object properties"]
ProcessObject --> Loop["For each key-value pair"]
Loop --> CheckSensitive["Check if key or path<br/>contains sensitive pattern"]
CheckSensitive --> |Yes| MaskValue["Set value to '***MASKED***'"]
CheckSensitive --> |No| Recurse["Recursively process value"]
MaskValue --> NextKey
Recurse --> NextKey
NextKey --> MoreKeys{"More keys?"}
MoreKeys --> |Yes| Loop
MoreKeys --> |No| ReturnMasked["Return masked object"]
ProcessArray --> ReturnMasked
ReturnMasked --> End([Return result])
ReturnValue --> End
```

**Diagram sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L20-L78)

**Section sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L20-L78)
- [utils.test.ts](file://packages/audit-sdk/src/__tests__/utils.test.ts#L45-L76)

### Context Extraction
The `extractUserContext` function normalizes user context from various authentication schemes, including JWT tokens, API keys, and session-based authentication. It provides a unified interface for accessing principal information regardless of the authentication method used.

```mermaid
flowchart TD
Start([Start extractUserContext]) --> CheckJWT["Check for req.user"]
CheckJWT --> |Exists| ExtractJWT["Extract id, org, roles,<br/>permissions from user"]
CheckJWT --> |Not exists| CheckAPIKey["Check for req.apiKey"]
CheckAPIKey --> |Exists| ExtractAPIKey["Extract id, name, org<br/>from apiKey"]
CheckAPIKey --> |Not exists| CheckSession["Check for req.session.user"]
CheckSession --> |Exists| ExtractSession["Extract id, org, roles<br/>from session user"]
CheckSession --> |Not exists| ReturnEmpty["Return empty object"]
ExtractJWT --> End([Return context])
ExtractAPIKey --> End
ExtractSession --> End
ReturnEmpty --> End
```

**Diagram sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L80-L118)

**Section sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L80-L118)
- [utils.test.ts](file://packages/audit-sdk/src/__tests__/utils.test.ts#L78-L117)

## Error Serialization and Validation

### Event Structure Validation
The `validateEventStructure` function performs schema validation on audit events, ensuring they meet minimum requirements for compliance and consistency. It checks for required fields and validates enumerated values against allowed options.

```mermaid
flowchart TD
Start([Start validateEventStructure]) --> CheckAction["Check if action exists"]
CheckAction --> |Missing| AddActionError["Add 'Action is required' error"]
CheckAction --> |Exists| CheckStatus["Check if status exists"]
CheckStatus --> |Missing| AddStatusError["Add 'Status is required' error"]
CheckStatus --> |Exists| ValidateStatus["Validate status value"]
ValidateStatus --> |Invalid| AddStatusValueError["Add 'Status must be one of:<br/>attempt, success, failure' error"]
ValidateStatus --> |Valid| CheckClassification["Check dataClassification"]
CheckClassification --> |Exists| ValidateClassification["Validate classification value"]
ValidateClassification --> |Invalid| AddClassificationError["Add 'Data classification must be<br/>one of: PUBLIC, INTERNAL,<br/>CONFIDENTIAL, PHI' error"]
AddActionError --> CollectErrors
AddStatusError --> CollectErrors
AddStatusValueError --> CollectErrors
AddClassificationError --> CollectErrors
CollectErrors --> ReturnErrors["Return error array"]
ValidateClassification --> |Valid| ReturnErrors
ReturnErrors --> End([End])
```

**Diagram sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L300-L334)

**Section sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L300-L334)
- [utils.test.ts](file://packages/audit-sdk/src/__tests__/utils.test.ts#L308-L357)

### CSV Serialization
The utility functions provide robust CSV serialization capabilities for audit events, including proper escaping of special characters and consistent field ordering. The `eventToCSV` and `getCSVHeader` functions work together to produce standardized CSV output.

```mermaid
flowchart TD
Start([Start eventToCSV]) --> DefineFields["Define ordered field list"]
DefineFields --> MapFields["Map each field to value"]
MapFields --> EscapeQuotes["Escape quotes with double quotes"]
EscapeQuotes --> WrapQuotes["Wrap field in quotes"]
WrapQuotes --> JoinFields["Join fields with commas"]
JoinFields --> ReturnCSV["Return CSV string"]
ReturnCSV --> End([End])
```

**Diagram sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L336-L378)

**Section sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L336-L378)
- [utils.test.ts](file://packages/audit-sdk/src/__tests__/utils.test.ts#L359-L397)

## Asynchronous Operations and Promise Wrapping

### Event Batching
The `AuditEventBatcher` class implements a batching mechanism for efficient processing of audit events. It combines size-based and time-based flushing strategies to balance performance and latency requirements.

```mermaid
classDiagram
class AuditEventBatcher {
-events : AuditLogEvent[]
-batchSize : number
-flushInterval : number
-onFlush : (events : AuditLogEvent[]) => Promise<void>
-timer : ReturnType<typeof setInterval>
+add(event : AuditLogEvent) : void
+flush() : Promise<void>
+stop() : void
-startTimer() : void
}
AuditEventBatcher --> "uses" (onFlush) : "callback"
```

**Diagram sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L120-L188)

**Section sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L120-L188)
- [utils.test.ts](file://packages/audit-sdk/src/__tests__/utils.test.ts#L159-L198)

### Rate Limiting
The `AuditRateLimiter` class implements a sliding window rate limiting algorithm to prevent audit event spam. It tracks event counts per key and automatically cleans up expired records.

```mermaid
classDiagram
class AuditRateLimiter {
-eventCounts : Map<string, { count : number; resetTime : number }>
-maxEvents : number
-windowMs : number
+isAllowed(key : string) : boolean
+cleanup() : void
}
AuditRateLimiter --> "uses" Map : "eventCounts"
```

**Diagram sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L190-L234)

**Section sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L190-L234)
- [utils.test.ts](file://packages/audit-sdk/src/__tests__/utils.test.ts#L200-L239)

### Event Enrichment
The `AuditEventEnricher` class provides a pipeline for adding contextual information to audit events. It supports both synchronous and asynchronous enrichers, allowing for flexible integration with external services.

```mermaid
classDiagram
class AuditEventEnricher {
-enrichers : Array<(event : AuditLogEvent) => AuditLogEvent | Promise<AuditLogEvent>>
+addEnricher(enricher : (event : AuditLogEvent) => AuditLogEvent | Promise<AuditLogEvent>) : void
+enrich(event : AuditLogEvent) : Promise<AuditLogEvent>
}
class commonEnrichers {
+geolocation(geoService : (ip : string) => Promise<string>) : (event : AuditLogEvent) => Promise<AuditLogEvent>
+organizationContext(orgService : (userId : string) => Promise<{ id : string; name : string }>) : (event : AuditLogEvent) => Promise<AuditLogEvent>
+performanceMetrics() : (event : AuditLogEvent) => AuditLogEvent
}
AuditEventEnricher --> commonEnrichers : "uses"
```

**Diagram sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L236-L298)

**Section sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L236-L298)
- [utils.test.ts](file://packages/audit-sdk/src/__tests__/utils.test.ts#L241-L278)

## Environment Detection and Diagnostic Logging

### Version Reporting
The Audit SDK provides version reporting capabilities through the configuration system. When initializing the SDK, version information can be included in the logger configuration, making it available in all audit logs.

```mermaid
sequenceDiagram
participant App as Application
participant SDK as AuditSDK
participant Logger as ConsoleLogger
App->>SDK : initialize(config)
SDK->>SDK : Create configuration manager
SDK->>Logger : new ConsoleLogger(opts)
Logger->>Logger : Store version in instance
SDK->>App : Return initialization function
App->>SDK : log(event)
SDK->>Logger : Log event with version context
Logger->>Output : Write log with version information
```

**Diagram sources**
- [sdk.ts](file://packages/audit-sdk/src/sdk.ts#L90-L108)

**Section sources**
- [sdk.ts](file://packages/audit-sdk/src/sdk.ts#L90-L108)

### Diagnostic Logging
The SDK includes comprehensive diagnostic logging capabilities, including health monitoring and system metrics collection. The `getHealth` method provides real-time status information about the audit system components.

```mermaid
flowchart TD
Start([Start getHealth]) --> CheckRedis["Check Redis connection"]
CheckRedis --> SetRedisStatus["Set redis status"]
SetRedisStatus --> CheckDB["Check database connection"]
CheckDB --> |Success| SetDBConnected["Set database status to 'connected'"]
CheckDB --> |Error| SetDBError["Set database status to 'error'"]
CheckDB --> |Not configured| SetDBNotConfigured["Set database status to 'not_configured'"]
SetRedisStatus --> SetDBConnected
SetRedisStatus --> SetDBError
SetRedisStatus --> SetDBNotConfigured
SetDBConnected --> SetTimestamp["Set timestamp"]
SetDBError --> SetTimestamp
SetDBNotConfigured --> SetTimestamp
SetTimestamp --> ReturnStatus["Return health status object"]
ReturnStatus --> End([End])
```

**Diagram sources**
- [sdk.ts](file://packages/audit-sdk/src/sdk.ts#L400-L429)

**Section sources**
- [sdk.ts](file://packages/audit-sdk/src/sdk.ts#L400-L429)

## Type Guards and Validation Helpers

### Compliance Validation
The `validateCompliance` function serves as a type guard and validation helper for compliance requirements. It dispatches to specific validators based on the compliance type (HIPAA, GDPR, or custom rules).

```mermaid
flowchart TD
Start([Start validateCompliance]) --> CheckType["Switch on complianceType"]
CheckType --> |hipaa| ValidateHIPAA["Call validateHIPAA"]
CheckType --> |gdpr| ValidateGDPR["Call validateGDPR"]
CheckType --> |custom| FindCustomRule["Find custom rule by name"]
FindCustomRule --> |Found| ValidateCustom["Call validateCustom"]
FindCustomRule --> |Not found| NoValidation["No validation performed"]
ValidateHIPAA --> End([End])
ValidateGDPR --> End
ValidateCustom --> End
NoValidation --> End
```

**Diagram sources**
- [compliance.ts](file://packages/audit-sdk/src/compliance.ts#L5-L38)

**Section sources**
- [compliance.ts](file://packages/audit-sdk/src/compliance.ts#L5-L38)
- [sdk.ts](file://packages/audit-sdk/src/sdk.ts#L164-L175)

### HIPAA Validation
The HIPAA validation ensures that audit events involving Protected Health Information (PHI) meet regulatory requirements, including mandatory fields and proper data classification.

```mermaid
flowchart TD
Start([Start validateHIPAA]) --> CheckEnabled["Check if HIPAA enabled"]
CheckEnabled --> |Disabled| Return["Return immediately"]
CheckEnabled --> |Enabled| CheckRequiredFields["Check required fields"]
CheckRequiredFields --> |Missing| ThrowError["Throw error for missing field"]
CheckRequiredFields --> |All present| CheckPHIResources["Check if resource is PHI"]
CheckPHIResources --> |Is PHI| CheckDataClassification["Check dataClassification is 'PHI'"]
CheckPHIResources --> |Not PHI| CheckSessionContext["Check sessionContext for PHI access"]
CheckDataClassification --> |Not PHI| ThrowPHIError["Throw error for incorrect classification"]
CheckSessionContext --> |Missing| ThrowSessionError["Throw error for missing sessionContext"]
ThrowError --> End([End])
ThrowPHIError --> End
ThrowSessionError --> End
CheckDataClassification --> |Is PHI| SetRetention["Set retention policy if needed"]
CheckSessionContext --> |Present| SetRetention
SetRetention --> Return
```

**Diagram sources**
- [compliance.ts](file://packages/audit-sdk/src/compliance.ts#L40-L104)

**Section sources**
- [compliance.ts](file://packages/audit-sdk/src/compliance.ts#L40-L104)

### GDPR Validation
The GDPR validation ensures that personal data processing events include necessary legal basis and data subject identification when required by the regulation.

```mermaid
flowchart TD
Start([Start validateGDPR]) --> CheckEnabled["Check if GDPR enabled"]
CheckEnabled --> |Disabled| Return["Return immediately"]
CheckEnabled --> |Enabled| SetRetention["Set retention policy if needed"]
SetRetention --> CheckPersonalData["Check if event involves<br/>personal data processing"]
CheckPersonalData --> |No| Return
CheckPersonalData --> |Yes| CheckLegalBasis["Check for legalBasis"]
CheckLegalBasis --> |Missing| CheckDefaultBasis["Check for defaultLegalBasis"]
CheckLegalBasis --> |Present| CheckRightsAction["Check if action relates to<br/>data subject rights"]
CheckDefaultBasis --> |Present| SetDefaultBasis["Set default legalBasis"]
CheckDefaultBasis --> |Not present| ThrowLegalBasisError["Throw error for missing legalBasis"]
CheckRightsAction --> |Yes| CheckDataSubjectId["Check for dataSubjectId"]
CheckRightsAction --> |No| Return
CheckDataSubjectId --> |Missing| ThrowDataSubjectError["Throw error for missing dataSubjectId"]
CheckDataSubjectId --> |Present| Return
SetDefaultBasis --> Return
ThrowLegalBasisError --> End([End])
ThrowDataSubjectError --> End
Return --> End
```

**Diagram sources**
- [compliance.ts](file://packages/audit-sdk/src/compliance.ts#L106-L157)

**Section sources**
- [compliance.ts](file://packages/audit-sdk/src/compliance.ts#L106-L157)

## Performance Characteristics and Memory Safety

### Memory Safety Considerations
The utility functions are designed with memory safety in mind, avoiding common pitfalls such as memory leaks and excessive memory allocation. The `maskSensitiveData` function uses a recursive approach with proper base cases to prevent stack overflow, while the `AuditEventBatcher` manages memory by flushing events to persistent storage.

```mermaid
flowchart TD
Start([Memory Management]) --> DataMasking["Data Masking"]
DataMasking --> CopyStrategy["Create shallow copy of event"]
CopyStrategy --> RecursiveProcessing["Process nested objects recursively"]
RecursiveProcessing --> BaseCases["Handle null, primitives, arrays"]
BaseCases --> ReturnResult["Return masked copy"]
Start --> Batching["Event Batching"]
Batching --> SizeLimit["Limit batch size (default: 100)"]
SizeLimit --> TimeLimit["Flush periodically (default: 5s)"]
TimeLimit --> ErrorHandling["Re-add failed events to queue"]
ErrorHandling --> MemoryPreservation["Preserve memory by clearing processed events"]
Start --> RateLimiting["Rate Limiting"]
RateLimiting --> MapStorage["Store counts in Map"]
MapStorage --> Cleanup["Periodic cleanup of expired entries"]
Cleanup --> MemoryEfficiency["Prevent unbounded memory growth"]
Start --> Enrichment["Event Enrichment"]
Enrichment --> Pipeline["Process enrichers in sequence"]
Pipeline --> AsyncSupport["Support asynchronous enrichers"]
AsyncSupport --> MemoryIsolation["Isolate memory usage per event"]
```

**Section sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L20-L298)

### Performance Characteristics
The utility functions are optimized for performance in high-throughput environments. The `generateEventHash` function uses SHA-256 hashing with JSON stringification of normalized event data, while the `AuditRateLimiter` uses a Map for O(1) lookups and updates.

```mermaid
flowchart LR
subgraph Performance Metrics
Hashing["Event Hashing: O(n) where n = event size"]
Batching["Event Batching: O(1) add, O(m) flush where m = batch size"]
RateLimiting["Rate Limiting: O(1) per check"]
Validation["Event Validation: O(k) where k = number of validation rules"]
Enrichment["Event Enrichment: O(p) where p = number of enrichers"]
end
subgraph Optimization Strategies
Hashing --> Normalization["Normalize event structure before hashing"]
Batching --> "Size and time-based flushing"
RateLimiting --> "Map-based storage with cleanup"
Validation --> "Early termination on first error"
Enrichment --> "Sequential processing with async support"
end
```

**Section sources**
- [utils.ts](file://packages/audit-sdk/src/utils.ts#L120-L298)

## Integration with Middleware

### Express Middleware
The Audit SDK provides middleware integration for Express.js applications, automatically logging HTTP requests and responses. The middleware uses the utility functions for context extraction, event enrichment, and rate limiting.

```mermaid
sequenceDiagram
participant Client as HTTP Client
participant Express as Express App
participant Middleware as Audit Middleware
participant SDK as Audit SDK
participant Storage as Persistent Storage
Client->>Express : HTTP Request
Express->>Middleware : Request processing
Middleware->>Middleware : Check skip condition
Middleware->>Middleware : Check sampling rate
Middleware->>Middleware : Override response methods
Middleware->>Express : Continue request
Express->>Client : Response
Middleware->>Middleware : Capture response data
Middleware->>Middleware : Calculate processing time
Middleware->>Middleware : Extract user context
Middleware->>Middleware : Enrich event with custom data
Middleware->>Middleware : Determine data classification
Middleware->>SDK : Log audit event
SDK->>SDK : Validate event structure
SDK->>SDK : Apply compliance validation
SDK->>Storage : Store event
Storage->>SDK : Confirmation
SDK->>Middleware : Success
Middleware->>Client : Response sent
```

**Diagram sources**
- [middleware.ts](file://packages/audit-sdk/src/middleware.ts#L5-L250)

**Section sources**
- [middleware.ts](file://packages/audit-sdk/src/middleware.ts#L5-L250)
- [audit-sdk.md](file://apps/docs/src/content/docs/audit/audit-sdk.md#L147-L220)

### WebSocket and GraphQL Middleware
The SDK also provides middleware for WebSocket and GraphQL applications, using similar patterns to the Express middleware but adapted to the specific protocols.

```mermaid
graph TD
subgraph WebSocket Middleware
WSClient[WebSocket Client]
WSServer[WebSocket Server]
WSMiddleware[Audit Middleware]
WSSDK[Audit SDK]
WSClient--"Connection" --> WSServer
WSServer--"Socket" --> WSMiddleware
WSMiddleware--"Override emit" --> WSMiddleware
WSClient--"Event" --> WSServer
WSServer--"Emit" --> WSMiddleware
WSMiddleware--"Log event" --> WSSDK
WSSDK--"Store" --> Storage[(Persistent Storage)]
end
subgraph GraphQL Middleware
GQLClient[GraphQL Client]
GQLServer[GraphQL Server]
GQLMiddleware[Audit Middleware]
GQLSDK[Audit SDK]
GQLClient--"Query/Mutation" --> GQLServer
GQLServer--"Request start" --> GQLMiddleware
GQLMiddleware--"Log attempt" --> GQLSDK
GQLServer--"Resolve" --> GQLServer
GQLServer--"Error" --> GQLMiddleware
GQLMiddleware--"Log failure" --> GQLSDK
GQLServer--"Success" --> GQLMiddleware
GQLMiddleware--"Log success" --> GQLSDK
GQLSDK--"Store" --> Storage
GQLServer--"Response" --> GQLClient
end
```

**Diagram sources**
- [middleware.ts](file://packages/audit-sdk/src/middleware.ts#L252-L304)

**Section sources**
- [middleware.ts](file://packages/audit-sdk/src/middleware.ts#L252-L304)
- [audit-sdk.md](file://apps/docs/src/content/docs/audit/audit-sdk.md#L147-L220)

## Test Coverage and Examples

### Test Coverage
The utility functions have comprehensive test coverage, with tests verifying both normal operation and edge cases. The test suite includes unit tests for each utility function, ensuring reliability and correctness.

```mermaid
flowchart TD
Start([Test Suite]) --> CorrelationId["createCorrelationId tests"]
CorrelationId --> |No prefix| TestNoPrefix["Verify format without prefix"]
CorrelationId --> |With prefix| TestWithPrefix["Verify format with prefix"]
Start --> Masking["maskSensitiveData tests"]
Masking --> DefaultFields["Test default sensitive fields"]
Masking --> CustomFields["Test custom sensitive fields"]
Masking --> NestedObjects["Test nested object handling"]
Start --> Context["extractUserContext tests"]
Context --> JWT["Test JWT extraction"]
Context --> APIKey["Test API key extraction"]
Context --> Session["Test session extraction"]
Context --> NoAuth["Test no authentication"]
Start --> Hashing["generateEventHash tests"]
Hashing --> Consistency["Test consistent hashing"]
Hashing --> Differentiation["Test different events have different hashes"]
Start --> Batching["AuditEventBatcher tests"]
Batching --> SizeFlush["Test flush on size limit"]
Batching --> StopFlush["Test flush on stop"]
Start --> RateLimiting["AuditRateLimiter tests"]
RateLimiting --> WithinLimit["Test within rate limit"]
RateLimiting --> OverLimit["Test over rate limit"]
RateLimiting --> Reset["Test reset after window"]
Start --> Enrichment["AuditEventEnricher tests"]
Enrichment --> SingleEnricher["Test single enricher"]
Enrichment --> MultipleEnrichers["Test multiple enrichers"]
Start --> Validation["validateEventStructure tests"]
Validation --> ValidEvent["Test valid event"]
Validation --> MissingFields["Test missing required fields"]
Validation --> InvalidValues["Test invalid enumerated values"]
Start --> CSV["CSV functions tests"]
CSV --> EventToCSV["Test event to CSV conversion"]
CSV --> Header["Test CSV header generation"]
CSV --> Quotes["Test quote escaping"]
```

**Section sources**
- [utils.test.ts](file://packages/audit-sdk/src/__tests__/utils.test.ts#L1-L407)

### Usage Examples
The test file provides clear examples of how to use each utility function, serving as both test cases and usage documentation.

```typescript
// Example: Creating a correlation ID
const correlationId = createCorrelationId('api-request')

// Example: Masking sensitive data
const maskedEvent = maskSensitiveData(event, ['ssn', 'creditCard'])

// Example: Extracting user context
const context = extractUserContext(request)

// Example: Generating event hash
const hash = generateEventHash(event)

// Example: Using event batcher
const batcher = new AuditEventBatcher(50, 3000, async (events) => {
  await auditService.storeEvents(events)
})

// Example: Using rate limiter
const rateLimiter = new AuditRateLimiter(10, 60000) // 10 events per minute
if (rateLimiter.isAllowed(`user-${userId}`)) {
  // Process event
}

// Example: Using event enricher
const enricher = new AuditEventEnricher()
enricher.addEnricher(commonEnrichers.geolocation(geoService))
enricher.addEnricher(commonEnrichers.organizationContext(orgService))
const enrichedEvent = await enricher.enrich(event)
```

**Section sources**
- [utils.test.ts](file://packages/audit-sdk/src/__tests__/utils.test.ts#L1-L407)