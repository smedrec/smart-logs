# Security

<cite>
**Referenced Files in This Document**   
- [crypto.ts](file://packages/audit/src/crypto.ts) - *Updated with KMS support in commit ce262627*
- [types.ts](file://packages/audit/src/types.ts) - *Updated with new signing algorithms in commit ce262627*
- [audit.ts](file://packages/audit/src/audit.ts) - *Updated with async signature methods in commit ce262627*
- [database-alert-handler.ts](file://packages/audit/src/monitor/database-alert-handler.ts) - *Enhanced alert persistence in commit 6be5dd6c*
- [error-handling.ts](file://packages/audit/src/error/error-handling.ts)
- [dead-letter-queue.ts](file://packages/audit/src/queue/dead-letter-queue.ts)
- [error-handling.test.ts](file://packages/audit/src/__tests__/error-handling.test.ts)
- [crypto.test.ts](file://packages/audit/src/__tests__/crypto.test.ts)
- [permissions.ts](file://packages/auth/src/permissions.ts) - *Added Redis caching for authorization and role management in commit a386f63b*
- [redis.ts](file://packages/auth/src/redis.ts) - *Redis connection management for caching in commit a386f63b*
- [alerting.ts](file://packages/audit/src/monitor/alerting.ts) - *Refactored alert handling in commit 8d12d47b*
- [context.ts](file://apps/server/src/lib/hono/context.ts) - *Updated service context in commit 8646eddf*
- [init.ts](file://apps/server/src/lib/hono/init.ts) - *Updated service initialization in commit 8646eddf*
</cite>

## Update Summary
- Added documentation for the new AlertingService that now handles security alerts
- Updated Security Alerting System section to reflect the refactored architecture with AlertingService and DatabaseAlertHandler
- Added details about the service initialization and context setup in the server application
- Updated section sources to include new files alerting.ts, context.ts, and init.ts
- Maintained all existing security documentation while adding new content for the refactored alert handling system
- Removed outdated references to direct MonitoringService alert handling

## Table of Contents
1. [Introduction](#introduction)
2. [Cryptographic Functions for Data Protection](#cryptographic-functions-for-data-protection)
3. [Error Handling and Secure Logging](#error-handling-and-secure-logging)
4. [Security Alerting System](#security-alerting-system)
5. [Dead-Letter Queue for Message Integrity](#dead-letter-queue-for-message-integrity)
6. [Security Testing and Attack Scenarios](#security-testing-and-attack-scenarios)
7. [Common Vulnerabilities and Mitigations](#common-vulnerabilities-and-mitigations)
8. [Configuration and Incident Response](#configuration-and-incident-response)
9. [Redis-based Authorization and Role Caching](#redis-based-authorization-and-role-caching)

## Introduction
The Security subsystem ensures data integrity, confidentiality, and availability across the audit logging system. It implements cryptographic verification, secure error handling, alerting mechanisms, and message durability to protect against tampering, data leakage, and service disruption. This document details the implementation of key security components, including cryptographic functions, error sanitization, database monitoring, secure message queuing, and authorization caching.

## Cryptographic Functions for Data Protection

The cryptographic system ensures the integrity and authenticity of audit log events through SHA-256 hashing and HMAC-SHA256 signatures. It prevents tampering by allowing verification of event data consistency and origin.

### Hashing and Signature Generation
The `CryptoService` class implements two primary functions:
- **Hash Generation**: Uses SHA-256 on critical event fields to detect data modification
- **Signature Generation**: Applies HMAC-SHA256 using a secret key to authenticate event origin

Critical fields used for hashing include:
- **timestamp**
- **action**
- **status**
- **principalId**
- **organizationId**
- **targetResourceType**
- **targetResourceId**
- **outcomeDescription**

```mermaid
classDiagram
class CryptoService {
+generateHash(event) string
+verifyHash(event, hash) boolean
+generateEventSignature(event, algorithm?) Promise~EventSignatureResponse~
+verifyEventSignature(event, signature, algorithm?) Promise~boolean~
+sha256(source) Promise~string~
-extractCriticalFields(event) Record
-createDeterministicString(fields) string
}
class EventSignatureResponse {
+signature : string
+algorithm : SigningAlgorithm
}
class CryptoUtils {
+generateHash(event) string
+verifyHash(event, hash) boolean
+generateSignature(event) string
+verifySignature(event, signature) boolean
}
CryptoUtils --> CryptoService : "delegates to"
```

**Diagram sources**
- [crypto.ts](file://packages/audit/src/crypto.ts#L100-L200)

**Section sources**
- [crypto.ts](file://packages/audit/src/crypto.ts#L0-L218)

### Deterministic Hashing
To ensure consistent hashing regardless of object property order, the system:
1. Extracts critical fields into a dedicated object
2. Sorts field names alphabetically
3. Creates a deterministic string using `key:value` pairs joined by `|`
4. Applies SHA-256 to this normalized string

This approach guarantees that identical events produce identical hashes even when serialized with different property ordering. The system also includes a base64 encoding utility that converts binary hash data into RFC4648 compliant base64 strings for easier transmission and storage.

### HMAC Signature Verification with KMS Support
The HMAC-SHA256 signature provides an additional layer of security by incorporating a secret key. The process:
1. Generates a hash of the event using `generateHash`
2. Applies HMAC-SHA256 using the secret key and the hash as input
3. Produces a 64-character hexadecimal signature

This prevents attackers from modifying both the data and hash without access to the secret key.

#### Asynchronous Signature Generation
The `CryptoService` now includes an asynchronous `generateEventSignature` method that supports both local HMAC-SHA256 and external KMS-based signing algorithms. When KMS is enabled in the configuration, the system delegates signing to the Infisical KMS service.

```typescript
async generateEventSignature(
    event: AuditLogEvent,
    signingAlgorithm?: SigningAlgorithm
): Promise<EventSignatureResponse> {
    const eventHash = this.generateHash(event)

    try {
        if (this.config.kms.enabled && this.kms) {
            const signature = await this.kms.sign(eventHash, signingAlgorithm)
            return {
                signature: signature.signature,
                algorithm: signature.signingAlgorithm,
            }
        } else {
            const signature = createHmac('sha256', this.config.encryptionKey!)
                .update(eventHash, 'utf8')
                .digest('hex')
            return {
                signature,
                algorithm: 'HMAC-SHA256',
            }
        }
    } catch (error) {
        console.error('[CryptoService] Signature creation failed:', error)
        throw error
    }
}
```

The method returns an `EventSignatureResponse` object containing both the signature value and the algorithm used, enabling clients to verify which cryptographic method was applied.

#### Supported Signing Algorithms
The system supports multiple signing algorithms through the KMS integration, as defined in the `types.ts` file:

```typescript
export type SigningAlgorithm = 
    | 'HMAC-SHA256'
    | 'RSASSA_PSS_SHA_256'
    | 'RSASSA_PSS_SHA_384'
    | 'RSASSA_PSS_SHA_512'
    | 'RSASSA_PKCS1_V1_5_SHA_256'
    | 'RSASSA_PKCS1_V1_5_SHA_384'
    | 'RSASSA_PKCS1_V1_5_SHA_512'
```

This allows for cryptographic flexibility and compliance with various security standards.

**Section sources**
- [crypto.ts](file://packages/audit/src/crypto.ts#L127-L174)
- [types.ts](file://packages/audit/src/types.ts#L150-L160)
- [audit.ts](file://packages/audit/src/audit.ts#L300-L330)

### Asynchronous SHA-256 Hashing with Base64 Encoding
The `CryptoService` includes an asynchronous `sha256` method that leverages the Web Crypto API for secure hashing operations. This method:
- Accepts string or Uint8Array input
- Returns a Promise that resolves to a base64-encoded string
- Uses the browser's or Node.js's built-in Web Crypto API for cryptographic operations
- Implements RFC4648 compliant base64 encoding

```typescript
async sha256(source: string | Uint8Array): Promise<string> {
    const buf = typeof source === 'string' ? new TextEncoder().encode(source) : source
    const hash = await crypto.subtle.digest('sha-256', buf)
    return this.b64(hash)
}
```

The base64 encoding is implemented using a custom algorithm that handles various input types (string, ArrayBuffer, or Uint8Array) and produces properly padded base64 strings with '=' padding characters as needed.

**Section sources**
- [crypto.ts](file://packages/audit/src/crypto.ts#L80-L90)
- [crypto.ts](file://packages/audit/src/crypto.ts#L188-L218)

## Error Handling and Secure Logging

The error handling system implements structured logging, classification, and aggregation while preventing sensitive data exposure.

### Error Classification and Sanitization
The `ErrorHandler` class classifies errors into categories such as:
- **DATABASE_ERROR**
- **NETWORK_ERROR**
- **VALIDATION_ERROR**
- **AUTHENTICATION_ERROR**
- **INTEGRITY_ERROR**

Each error is processed to:
- Remove sensitive stack traces when disabled
- Sanitize error messages of PII
- Generate non-identifiable error codes
- Create aggregation keys that normalize dynamic values

```mermaid
sequenceDiagram
participant Application as "Application"
participant ErrorHandler as "ErrorHandler"
participant Logger as "ErrorLogger"
Application->>ErrorHandler : handleError(error, context)
ErrorHandler->>ErrorHandler : classifyError(error)
ErrorHandler->>ErrorHandler : generateAggregationKey()
ErrorHandler->>ErrorHandler : buildStructuredError()
ErrorHandler->>Logger : logError(structuredError)
ErrorHandler->>ErrorHandler : updateAggregation()
ErrorHandler-->>Application : return StructuredError
```

**Diagram sources**
- [error-handling.ts](file://packages/audit/src/error/error-handling.ts#L400-L600)

**Section sources**
- [error-handling.ts](file://packages/audit/src/error/error-handling.ts#L0-L758)

### Secure Context Management
Error context includes:
- **correlationId**: For tracing related operations
- **component** and **operation**: For troubleshooting
- **userId** and **sessionId**: For impact analysis
- **metadata**: Custom diagnostic data
- **environment**: Node version, platform, hostname

Sensitive information is protected by:
- Optional stack trace inclusion
- Environment information toggling
- Metadata scrubbing in production
- Correlation ID generation that avoids sensitive data

### Aggregation and Trend Analysis
Errors are aggregated by:
- Category
- Component
- Normalized message (with UUIDs, timestamps, numbers replaced)

The system tracks:
- **Count**: Total occurrences
- **Affected users and components**
- **Trend analysis**: Increasing, decreasing, or stable
- **Error rate**: Per-minute frequency

Aggregations trigger alerts when thresholds are exceeded, enabling proactive monitoring of systemic issues.

## Security Alerting System

The security alerting system has been refactored to use a dedicated `AlertingService` that coordinates with the `DatabaseAlertHandler` for persistent storage and multi-organizational access control.

### Alerting Service Architecture
The new architecture separates concerns between alert generation and persistence:
- **AlertingService**: Central coordinator for alert management and distribution
- **DatabaseAlertHandler**: Specialized handler for database persistence with organization-based isolation

```mermaid
classDiagram
class AlertingService {
+addAlertHandler(handler) void
+sendExternalAlert(alert) Promise~void~
+generateAlert(alert) Promise~void~
+getAlerts(filters) Promise~Alert[]~
+getActiveAlerts(organizationId) Promise~Alert[]~
+numberOfActiveAlerts(organizationId) Promise~number~
+getAlertStatistics(organizationId) Promise~AlertStatistics~
+resolveAlert(alertId, resolvedBy, resolutionData) Promise~{success : boolean}~
+acknowledgeAlert(alertId, acknowledgedBy) Promise~{success : boolean}~
+dismissAlert(alertId, dismissedBy) Promise~{success : boolean}~
+checkDuplicateAlert(alert) Promise~boolean~
+createAlertHash(alert) string
+sendNotifications(alert) Promise~void~
+sendCriticalAlertNotification(alert) Promise~void~
}
class DatabaseAlertHandler {
+handlerName() string
+sendAlert(alert) Promise~void~
+acknowledgeAlert(alertId, acknowledgedBy) Promise~{success : boolean}~
+resolveAlert(alertId, resolvedBy, resolutionData) Promise~{success : boolean}~
+dismissAlert(alertId, dismissedBy) Promise~{success : boolean}~
+getAlerts(filters) Promise~Alert[]~
+getActiveAlerts(organizationId) Promise~Alert[]~
+numberOfActiveAlerts(organizationId) Promise~number~
+getAlertStatistics(organizationId) Promise~AlertStatistics~
+cleanupResolvedAlerts(organizationId, retentionDays) Promise~number~
+mapDatabaseAlertToAlert(dbAlert) Alert
}
class AlertHandler {
+handlerName() string
+sendAlert(alert) Promise~void~
+acknowledgeAlert(alertId, acknowledgedBy) Promise~{success : boolean}~
+resolveAlert(alertId, resolvedBy, resolutionData) Promise~{success : boolean}~
+dismissAlert(alertId, dismissedBy) Promise~{success : boolean}~
+getAlerts(filters) Promise~Alert[]~
+getActiveAlerts(organizationId) Promise~Alert[]~
+numberOfActiveAlerts(organizationId) Promise~number~
+getAlertStatistics(organizationId) Promise~AlertStatistics~
}
AlertHandler <|.. DatabaseAlertHandler
AlertingService --> AlertHandler : "uses multiple"
```

**Diagram sources**
- [alerting.ts](file://packages/audit/src/monitor/alerting.ts#L6-L297)
- [database-alert-handler.ts](file://packages/audit/src/monitor/database-alert-handler.ts#L76-L539)
- [monitoring-types.ts](file://packages/audit/src/monitor/monitoring-types.ts#L217-L231)

**Section sources**
- [alerting.ts](file://packages/audit/src/monitor/alerting.ts#L6-L297)
- [database-alert-handler.ts](file://packages/audit/src/monitor/database-alert-handler.ts#L76-L539)

### Alert Lifecycle Management
The `AlertingService` manages the complete alert lifecycle:
- **Creation**: New alerts are generated through `generateAlert`
- **Deduplication**: Checks for duplicate alerts using content hashing
- **Distribution**: Sends alerts to all registered handlers
- **Notification**: Sends appropriate notifications based on severity
- **Querying**: Provides methods to retrieve alerts with various filters
- **Statistics**: Offers comprehensive alert statistics and trends

The service uses a cooldown mechanism to prevent alert flooding, with similar alerts being suppressed for 5 minutes based on a hash of the alert content.

### Service Initialization and Context Setup
The alerting system is initialized in the server application through the service context setup:

```typescript
// In init.ts - Service initialization
if (!alertingService) {
    alertingService = new AlertingService(config.monitoring, metricsCollector)
    // Set alerting service config for database alert handler
    alertingService.addAlertHandler(databaseAlertHandler)
}

// In context.ts - Service context definition
export type ServiceContext = {
    // ... other services
    monitor: {
        alerts: AlertingService
        metrics: MonitoringService
    }
    // ... other services
}
```

This initialization pattern ensures that the `AlertingService` is properly configured with the `DatabaseAlertHandler` during application startup, creating a complete alerting pipeline.

**Section sources**
- [init.ts](file://apps/server/src/lib/hono/init.ts#L280-L285)
- [context.ts](file://apps/server/src/lib/hono/context.ts#L100-L105)

### Multi-Tenant Security
Organization-based access control ensures:
- Users can only access alerts for their organization
- Queries include `organization_id` filtering
- Cross-tenant data leakage is prevented
- Administrative views can aggregate across organizations

The `DatabaseAlertHandler` enforces multi-tenancy by requiring an `organizationId` in the alert metadata and including it in all database queries.

### Automatic Alert Cleanup
The system includes a `cleanupResolvedAlerts` method that automatically removes resolved alerts older than a specified retention period:

```typescript
async cleanupResolvedAlerts(organizationId: string, retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    try {
        const result = await this.db.execute(sql`
            DELETE FROM alerts 
            WHERE organization_id = ${organizationId}
            AND resolved = 'true'
            AND resolved_at < ${cutoffDate.toISOString()}
            RETURNING id
        `)

        return result.length || 0
    } catch (error) {
        throw new Error(`Failed to cleanup resolved alerts: ${error}`)
    }
}
```

This ensures that the alert storage remains efficient while maintaining compliance with data retention policies.

**Section sources**
- [database-alert-handler.ts](file://packages/audit/src/monitor/database-alert-handler.ts#L480-L510)

## Dead-Letter Queue for Message Integrity

The dead-letter queue (DLQ) securely handles undeliverable messages without data loss, ensuring audit event durability.

### DLQ Architecture
The `DeadLetterHandler` uses Redis and BullMQ to:
- Store failed audit events
- Preserve original event data and failure context
- Track retry history and error stacks
- Enable post-mortem analysis

```mermaid
classDiagram
class DeadLetterHandler {
+addFailedEvent() Promise~void~
+startWorker() void
+stopWorker() Promise~void~
+getMetrics() Promise~DeadLetterMetrics~
+onAlert() void
+processPendingEvents() Promise~void~
+cleanup() Promise~void~
}
class DeadLetterEvent {
+originalEvent : AuditLogEvent
+failureReason : string
+failureCount : number
+firstFailureTime : string
+lastFailureTime : string
+metadata : DeadLetterEventMetadata
}
class DeadLetterEventMetadata {
+errorStack? : string
+retryHistory : RetryRecord[]
}
DeadLetterHandler --> DeadLetterEvent : "contains"
DeadLetterEvent --> DeadLetterEventMetadata : "has"
```

**Diagram sources**
- [dead-letter-queue.ts](file://packages/audit/src/queue/dead-letter-queue.ts#L0-L366)

**Section sources**
- [dead-letter-queue.ts](file://packages/audit/src/queue/dead-letter-queue.ts#L0-L366)

### Failure Preservation
When an audit event fails processing after retries:
1. The original event is preserved intact
2. Failure reason and count are recorded
3. Full error stack trace is captured
4. Retry history is maintained
5. Event is added to the DLQ with metadata

### Automated Processing and Alerts
The system:
- Processes DLQ events every 5 minutes
- Archives events older than configured threshold
- Deletes events exceeding retention period
- Triggers alerts when DLQ size exceeds threshold
- Provides metrics on failure patterns

This ensures failed audit events are not lost while enabling investigation and remediation.

## Security Testing and Attack Scenarios

Comprehensive tests validate the security system's resilience against various attack scenarios.

### Cryptographic Integrity Testing
Tests verify:
- Hash consistency for identical events
- Hash changes when critical fields are modified
- Signature verification failure with tampered data
- Resistance to timing attacks through constant-time comparison

```mermaid
flowchart TD
Start["Test: Tampering Detection"] --> Generate["Generate hash/signature"]
Generate --> Tamper["Modify event action field"]
Tamper --> VerifyHash["Verify original hash"]
VerifyHash --> ExpectFail1["Expect: Hash verification fails"]
ExpectFail1 --> VerifySig["Verify original signature"]
VerifySig --> ExpectFail2["Expect: Signature verification fails"]
ExpectFail2 --> End["Test passed"]
```

**Diagram sources**
- [crypto.test.ts](file://packages/audit/src/__tests__/crypto.test.ts#L0-L460)

**Section sources**
- [crypto.test.ts](file://packages/audit/src/__tests__/crypto.test.ts#L0-L460)

### Error Handling Validation
Tests confirm:
- Correct classification of database, network, and validation errors
- Proper aggregation of similar errors
- Accurate error statistics reporting
- Secure context handling without data leakage
- External logger integration

The test suite includes scenarios for:
- Database connection failures
- Network timeouts
- Authentication errors
- Configuration issues
- Data integrity violations

## Common Vulnerabilities and Mitigations

### Injection Attacks
Prevented by:
- Using parameterized queries with Drizzle ORM
- Input validation through Zod schemas
- Context-aware escaping in SQL templates
- Stored procedures for complex operations

### Data Leakage Prevention
Mitigated through:
- Error message sanitization
- Stack trace suppression in production
- Environment variable protection
- Correlation IDs without sensitive data
- Metadata scrubbing in logs

### Secure Key Management
Implemented via:
- Environment variables for secret keys
- Default key generation with warnings
- HMAC-SHA256 for signature authentication
- Key rotation support
- Secure storage in configuration management
- KMS integration for advanced cryptographic operations

## Configuration and Incident Response

### Security Configuration
Key settings include:
- **AUDIT_CRYPTO_SECRET**: Cryptographic secret key
- **enableStructuredLogging**: Structured JSON output
- **enableAggregation**: Error grouping and trending
- **aggregationWindowMinutes**: Time window for aggregation
- **maxRetentionDays**: DLQ retention period
- **alertThreshold**: DLQ size alert threshold
- **kms.enabled**: Enable KMS-based cryptographic operations
- **kms.baseUrl**: KMS service endpoint
- **kms.accessToken**: Authentication token for KMS service

### Incident Response Procedures
When security incidents occur:
1. **Identify**: Use correlation IDs to trace related events
2. **Contain**: Isolate affected components
3. **Analyze**: Examine DLQ entries and error aggregations
4. **Remediate**: Fix root cause and verify resolution
5. **Report**: Document findings and update prevention measures

For cryptographic integrity failures:
- Investigate the source of tampering
- Review access logs for unauthorized access
- Rotate cryptographic keys if compromised
- Validate all audit events during the affected period

For high error volumes:
- Check system resources and performance
- Review recent deployments for regressions
- Examine network connectivity and dependencies
- Scale resources if necessary

## Redis-based Authorization and Role Caching

The authorization system implements Redis-based caching for permissions and roles to enhance security and performance.

### Permission Caching Architecture
The `AuthorizationService` uses Redis to cache permission checks with a 5-minute retention period:
- Cache keys follow the pattern `authz:permissions:{userId}:{resource}:{action}:{context}`
- Results are stored as 'true' or 'false' strings
- Cache is automatically invalidated after the retention period
- Cache misses trigger database queries and subsequent caching

```mermaid
classDiagram
class AuthorizationService {
-private roleCachePrefix : string
-private permissionCachePrefix : string
-private retentionPeriod : number
+hasPermission(session, resource, action, context) Promise~boolean~
+getUserPermissions(session) Promise~Permission[]~
+getRole(roleName) Promise~Role | undefined~
+addRole(role) Promise~void~
+removeRole(roleName) Promise~void~
+clearUserCache(userId) Promise~void~
+clearCache() Promise~void~
}
class Permission {
+resource : string
+action : string
+conditions? : Record<string, any>
}
class Role {
+name : string
+description? : string
+permissions : Permission[]
+inherits? : string[]
}
AuthorizationService --> Permission : "manages"
AuthorizationService --> Role : "manages"
```

**Diagram sources**
- [permissions.ts](file://packages/auth/src/permissions.ts#L100-L600)

**Section sources**
- [permissions.ts](file://packages/auth/src/permissions.ts#L0-L691)
- [redis.ts](file://packages/auth/src/redis.ts#L0-L130)

### Role Management and Caching
Roles are cached in Redis with the prefix `authz:roles:`:
- System roles (user, admin) and organization roles (org:member, org:admin, org:owner) are pre-cached
- Custom roles are added to both Redis cache and PostgreSQL database
- Role retrieval first checks Redis, falling back to database if not found
- Retrieved roles are automatically cached for subsequent requests

### Cache Invalidation Strategies
The system implements multiple cache invalidation methods:
- **User-specific invalidation**: `clearUserCache(userId)` removes all permission caches for a user
- **Global invalidation**: `clearCache()` removes all permission caches
- **Role-specific invalidation**: `removeRole(roleName)` removes role cache and database entry
- **Automatic expiration**: All caches expire after 5 minutes

### Secure Cache Implementation
The Redis connection is secured through:
- Connection timeout of 10 seconds to prevent hanging connections
- Environment variable-based Redis URL configuration
- Comprehensive error handling for connection failures
- Automatic reconnection handling
- Separate connection instance management through singleton pattern

```typescript
export function getRedisConnection(redisUrl?: string, options?: RedisOptions): RedisInstanceType {
	if (redisConnection) {
		return redisConnection
	}

	if (!redisUrl) {
		throw new Error(
			'[RedisClient] Initialization Error: BETTER_AUTH_REDIS_URL is not defined in environment variables and no default was provided.'
		)
	}

	const connectionOptions: RedisOptions = {
		...DEFAULT_REDIS_OPTIONS,
		...options,
	}

	try {
		console.log(`[RedisClient] Attempting to connect to Redis at ${redisUrl.split('@').pop()}...`)
		redisConnection = new Redis(redisUrl, connectionOptions)

		redisConnection.on('connect', () => {
			console.log('[RedisClient] Successfully connected to Redis.')
		})

		redisConnection.on('error', (err: Error) => {
			console.error(`[RedisClient] Redis Connection Error: ${err.message}`, err)
		})
	} catch (error) {
		console.error('[RedisClient] Failed to create Redis instance:', error)
		redisConnection = null
		throw new Error(`[RedisClient] Failed to initialize Redis connection. Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
	}

	return redisConnection
}
```

This caching system significantly reduces database load while maintaining security through proper cache invalidation and secure connection management.

**Section sources**
- [redis.ts](file://packages/auth/src/redis.ts#L0-L130)
- [permissions.ts](file://packages/auth/src/permissions.ts#L400-L600)