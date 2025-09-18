# Configuration Schema and Types

<cite>
**Referenced Files in This Document**   
- [types.ts](file://packages\audit\src\config\types.ts) - *Updated in recent commit*
- [factory.ts](file://packages\audit\src\config\factory.ts) - *Modified in recent commit*
- [manager.ts](file://packages\audit\src\config\manager.ts) - *Modified in recent commit*
- [integration.ts](file://packages\audit\src\config\integration.ts) - *Modified in recent commit*
- [archival-service.ts](file://packages\audit\src\archival\archival-service.ts) - *Unchanged*
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts) - *Unchanged*
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts) - *Updated in recent commit*
- [audit-preset.ts](file://packages\audit\src\preset\audit-preset.ts) - *Unchanged*
- [preset-types.ts](file://packages\audit\src\preset\preset-types.ts) - *Unchanged*
- [infisical-kms/README.md](file://packages\infisical-kms\README.md) - *KMS integration documentation*
- [infisical-kms/src/client.ts](file://packages\infisical-kms\src\client.ts) - *KMS client implementation*
- [infisical-kms/src/types.ts](file://packages\infisical-kms\src\types.ts) - *KMS type definitions*
- [tracer.ts](file://packages\audit\src\observability\tracer.ts) - *OTLP exporter implementation*
- [types.ts](file://packages\audit\src\observability\types.ts) - *Observability type definitions*
- [otpl.ts](file://packages\logs\src\otpl.ts) - *OTLP logging implementation*
- [logging.ts](file://packages\logs\src\logging.ts) - *Structured logging implementation*
- [types.ts](file://packages\logs\src\interface.ts) - *Logging interface definitions*
</cite>

## Update Summary
**Changes Made**   
- Added comprehensive documentation for the new StructuredLogger system and LoggerFactory
- Updated Logging Configuration section with detailed information about structured logging, context propagation, and output configuration
- Enhanced OTLP Exporter section with updated configuration details and error handling mechanisms
- Added new section for LoggerFactory and its role in consistent logger creation
- Updated source tracking annotations to reflect new logging implementation files
- Added documentation for logging configuration defaults and factory patterns
- Integrated new logging implementation into the core documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Configuration Schema Overview](#configuration-schema-overview)
3. [Core Configuration Types](#core-configuration-types)
4. [Compliance Configuration](#compliance-configuration)
5. [Archival Configuration](#archival-configuration)
6. [Monitoring Configuration](#monitoring-configuration)
7. [Security and Validation](#security-and-validation)
8. [Configuration Management](#configuration-management)
9. [Integration and Extensibility](#integration-and-extensibility)
10. [Plugin Architecture](#plugin-architecture)
11. [Configuration Change Tracking](#configuration-change-tracking)
12. [KMS Integration](#kms-integration)
13. [OTLP Exporter](#otlp-exporter)
14. [Structured Logging System](#structured-logging-system)
15. [LoggerFactory](#loggerfactory)

## Introduction
The Configuration Schema and Types system provides a comprehensive, type-safe framework for managing audit system configuration across environments. Built with TypeScript, the system enforces compile-time validation, supports IDE autocompletion, and enables runtime safety through comprehensive validation. The configuration schema is structured hierarchically, covering database connections, retention policies, compliance requirements (GDPR/HIPAA), integration endpoints, monitoring thresholds, and plugin extensions. This documentation details every configuration option, type hierarchy, and integration point, providing guidance for both standard and custom deployments.

## Configuration Schema Overview

The configuration system is centered around the `AuditConfig` interface, which serves as the root type for all configuration options. The schema is organized into logical modules, each with its own configuration interface that is composed into the main configuration object. This modular approach enables focused configuration management while maintaining a unified configuration structure.

```mermaid
classDiagram
class AuditConfig {
+environment : Environment
+version : string
+lastUpdated : string
+redis : RedisConfig
+database : DatabaseConfig
+server : ServerConfig
+worker : WorkerConfig
+monitoring : MonitoringConfig
+security : SecurityConfig
+compliance : ComplianceConfig
+archive : ArchiveConfig
+logging : LoggingConfig
+plugins : PluginConfig[]
}
class RedisConfig {
+url : string
+connectTimeout : number
+commandTimeout : number
+maxRetriesPerRequest : number | null
+retryDelayOnFailover : number
+enableOfflineQueue : boolean
+enableAutoPipelining : boolean
}
class DatabaseConfig {
+url : string
+poolSize : number
+connectionTimeout : number
+queryTimeout : number
+ssl : boolean
+maxConnectionAttempts : number
}
class ServerConfig {
+port : number
+host : string
+timeout : number
+cors : CorsConfig
+rateLimit : RateLimitConfig
+auth : AuthConfig
+monitoring : ServerMonitoringConfig
}
class WorkerConfig {
+concurrency : number
+queueName : string
+port : number
+gracefulShutdown : boolean
+shutdownTimeout : number
}
class PluginConfig {
+name : string
+enabled : boolean
+config : Record<string, any>
+dependencies : string[]
}
AuditConfig --> RedisConfig : "contains"
AuditConfig --> DatabaseConfig : "contains"
AuditConfig --> ServerConfig : "contains"
AuditConfig --> WorkerConfig : "contains"
AuditConfig --> MonitoringConfig : "contains"
AuditConfig --> SecurityConfig : "contains"
AuditConfig --> ComplianceConfig : "contains"
AuditConfig --> ArchiveConfig : "contains"
AuditConfig --> LoggingConfig : "contains"
AuditConfig --> PluginConfig : "contains"
```

**Section sources**
- [types.ts](file://packages\audit\src\config\types.ts#L45-L110)

## Core Configuration Types

The configuration schema defines several core types that represent fundamental system components. These types include connection settings, server configurations, worker parameters, and plugin configurations that control the basic operation of the audit system.

### Database and Redis Configuration
The database and Redis configurations provide connection parameters for the primary data stores used by the audit system. These configurations include connection URLs, timeout settings, and pool management options.

```mermaid
classDiagram
class DatabaseConfig {
+url : string
+poolSize : number
+connectionTimeout : number
+queryTimeout : number
+ssl : boolean
+maxConnectionAttempts : number
}
class RedisConfig {
+url : string
+connectTimeout : number
+commandTimeout : number
+maxRetriesPerRequest : number | null
+retryDelayOnFailover : number
+enableOfflineQueue : boolean
+enableAutoPipelining : boolean
}
class ConnectionPoolConfig {
+minConnections : number
+maxConnections : number
+idleTimeout : number
+acquireTimeout : number
+validateConnections : boolean
+retryAttempts : number
+retryDelay : number
+ssl : boolean
}
class EnhancedClientConfig {
+connectionPool : ConnectionPoolConfig
+queryCacheFactory : CacheFactoryConfig
+partitioning : PartitioningConfig
+monitoring : PerformanceMonitoringConfig
}
DatabaseConfig --> ConnectionPoolConfig : "includes"
EnhancedClientConfig --> ConnectionPoolConfig : "references"
EnhancedClientConfig --> CacheFactoryConfig : "references"
```

**Section sources**
- [types.ts](file://packages\audit\src\config\types.ts#L112-L188)

## Compliance Configuration

The compliance configuration module provides settings for regulatory requirements including GDPR and HIPAA. These configurations enable or disable compliance features, set retention policies, and define reporting schedules.

### GDPR and HIPAA Settings
The compliance configuration includes specific settings for GDPR and HIPAA regulations, allowing organizations to configure their audit system according to applicable legal requirements.

```mermaid
classDiagram
class ComplianceConfig {
+hipaa : HIPAAConfig
+gdpr : GDPRConfig
+defaultRetentionDays : number
+defaultDataClassification : DataClassification
+generateHash : boolean
+generateSignature : boolean
+enableAutoArchival : boolean
+enablePseudonymization : boolean
+reportingSchedule : ReportingScheduleConfig
+custom : ComplianceRule[]
}
class HIPAAConfig {
+enabled : boolean
+requiredFields? : string[]
+retentionYears? : number
}
class GDPRConfig {
+enabled : boolean
+defaultLegalBasis? : string
+retentionDays? : number
}
class ReportingScheduleConfig {
+enabled : boolean
+frequency : 'daily' | 'weekly' | 'monthly'
+recipients : string[]
+includeHIPAA : boolean
+includeGDPR : boolean
}
class ComplianceRule {
+field : string
+required? : boolean
+validator? : (value : any) => boolean
+message? : string
}
ComplianceConfig --> HIPAAConfig : "contains"
ComplianceConfig --> GDPRConfig : "contains"
ComplianceConfig --> ReportingScheduleConfig : "contains"
ComplianceConfig --> ComplianceRule : "contains"
```

**Section sources**
- [types.ts](file://packages\audit\src\config\types.ts#L386-L428)

### GDPR Compliance Implementation
The GDPR compliance service implements data subject rights and privacy-by-design principles, enabling data export, pseudonymization, and retention policy enforcement.

```mermaid
sequenceDiagram
participant Request as "GDPR Data Export Request"
participant Service as "GDPRComplianceService"
participant DB as "Database"
participant Audit as "Audit System"
participant Response as "GDPR Data Export"
Request->>Service : exportUserData(request)
Service->>DB : Query audit logs by principalId
DB-->>Service : Return audit logs
Service->>Service : Collect metadata (categories, policies)
Service->>Service : Format data according to request.format
Service->>Audit : Log GDPR activity
Audit-->>Service : Confirmation
Service-->>Response : Return formatted export data
```

**Diagram sources**
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts#L100-L150)

## Archival Configuration

The archival configuration defines settings for data archiving, including compression algorithms, batch sizes, and integrity verification. This configuration controls how audit data is archived and stored for long-term retention.

### Archival Settings
The archival configuration includes options for compression, encryption, and format selection, allowing organizations to optimize storage and retrieval of archived data.

```mermaid
classDiagram
class ArchiveConfig {
+compressionAlgorithm : 'gzip' | 'deflate' | 'none'
+compressionLevel : number
+format : 'json' | 'jsonl' | 'parquet'
+batchSize : number
+verifyIntegrity : boolean
+encryptArchive : boolean
}
class ArchiveResult {
+archiveId : string
+recordCount : number
+originalSize : number
+compressedSize : number
+compressionRatio : number
+checksumOriginal : string
+checksumCompressed : string
+verificationStatus : 'verified' | 'failed' | 'skipped'
+timestamp : string
+processingTime : number
}
class ArchiveRetrievalRequest {
+archiveId? : string
+principalId? : string
+organizationId? : string
+dateRange? : string
+actions? : string[]
+dataClassifications? : string[]
+retentionPolicies? : string[]
+limit? : number
+offset? : number
}
ArchiveConfig --> ArchiveResult : "produces"
ArchiveRetrievalRequest --> ArchiveResult : "retrieves"
```

**Section sources**
- [archival-service.ts](file://packages\audit\src\archival\archival-service.ts#L15-L100)

## Monitoring Configuration

The monitoring configuration defines settings for real-time monitoring, alerting, and metrics collection. These settings control how the system detects suspicious patterns, generates alerts, and collects performance metrics.

### Monitoring and Alerting Settings
The monitoring configuration includes thresholds for error rates, processing latency, queue depth, and memory usage, enabling proactive system monitoring and alerting.

```mermaid
classDiagram
class MonitoringConfig {
+enabled : boolean
+metricsInterval : number
+alertThresholds : AlertThresholds
+healthCheckInterval : number
}
class AlertThresholds {
+errorRate : number
+processingLatency : number
+queueDepth : number
+memoryUsage : number
}
class PatternDetectionConfig {
+failedAuthThreshold : number
+failedAuthTimeWindow : number
+unauthorizedAccessThreshold : number
+unauthorizedAccessTimeWindow : number
+dataAccessVelocityThreshold : number
+dataAccessTimeWindow : number
+bulkOperationThreshold : number
+bulkOperationTimeWindow : number
+offHoursStart : number
+offHoursEnd : number
}
class MetricsCollector {
+recordEvent()
+recordError()
+recordSuspiciousPattern(count : number)
+recordProcessingLatency(latency : number)
+getMetrics() : AuditMetrics
}
MonitoringConfig --> AlertThresholds : "contains"
MonitoringConfig --> PatternDetectionConfig : "references"
MonitoringConfig --> MetricsCollector : "uses"
```

**Section sources**
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts#L25-L75)

## Security and Validation

The security and validation configuration defines settings for data integrity, encryption, and input validation. These settings ensure that audit data remains secure and tamper-proof throughout its lifecycle.

### Security Configuration
The security configuration includes options for integrity verification, event signing, and log encryption, providing multiple layers of protection for audit data.

```mermaid
classDiagram
class SecurityConfig {
+enableIntegrityVerification : boolean
+hashAlgorithm : 'SHA-256'
+enableEventSigning : boolean
+encryptionKey : string
+enableLogEncryption : boolean
+kms : KMSConfig
}
class KMSConfig {
+enabled : boolean
+encryptionKey : string
+signingKey : string
+accessToken : string
+baseUrl : string
+algorithm? : 'AES-256-GCM' | 'AES-256-CBC'
+kdf? : 'PBKDF2' | 'scrypt'
+salt? : string
+iterations? : number
}
class ValidationConfig {
+requiredFields : string[]
+fieldValidators : FieldValidator[]
+maxEventSize : number
+allowedActions : string[]
+requiredContextFields : string[]
}
class FieldValidator {
+fieldName : string
+validationRules : ValidationRule[]
+errorMessage : string
}
class ValidationRule {
+type : 'required' | 'format' | 'range' | 'enum'
+value : any
+pattern? : string
}
SecurityConfig --> ValidationConfig : "works with"
ValidationConfig --> FieldValidator : "contains"
FieldValidator --> ValidationRule : "contains"
```

**Section sources**
- [types.ts](file://packages\audit\src\config\types.ts#L320-L360)
- [types.ts](file://packages\audit\src\config\types.ts#L291-L296)

## Configuration Management

The configuration management system provides a robust framework for loading, validating, updating, and persisting configuration. The system supports multiple storage types, hot reloading, and secure storage with encryption.

### Configuration Manager
The ConfigurationManager class serves as the central component for configuration management, handling initialization, validation, updates, and change tracking.

```mermaid
sequenceDiagram
participant App as "Application"
participant Manager as "ConfigurationManager"
participant Storage as "Storage (File/S3)"
participant Validator as "ConfigValidator"
participant DB as "Database"
App->>Manager : initialize()
Manager->>Storage : loadConfiguration()
Storage-->>Manager : Return config data
Manager->>Validator : validateConfiguration()
Validator-->>Manager : Validation result
Manager->>Manager : Initialize database connection
Manager->>Manager : Start hot reloading (if enabled)
Manager-->>App : Configuration ready
App->>Manager : updateConfig(path, value)
Manager->>Validator : validateConfiguration(testConfig)
Validator-->>Manager : Validation result
Manager->>Manager : Apply configuration change
Manager->>DB : Record change event
Manager->>Storage : saveConfiguration()
Manager->>Manager : Emit configChanged event
Manager->>Manager : Emit hotReload event (if applicable)
Manager-->>App : Update complete
```

**Section sources**
- [manager.ts](file://packages\audit\src\config\manager.ts#L50-L150)

## Integration and Extensibility

The configuration system provides integration points for extending the base configuration and adapting it to specific deployment requirements. The integration module offers utilities for initializing configuration with environment-specific defaults and handling configuration changes.

### Configuration Integration
The configuration integration module provides functions for initializing audit configuration with environment-specific defaults and setting up event handlers for configuration changes.

```mermaid
classDiagram
class ConfigIntegrationOptions {
+configPath? : string
+storageType? : string
+environment? : string
+enableHotReload? : boolean
+hotReloadConfig? : Partial<HotReloadConfig>
+enableSecureStorage? : boolean
+secureStorageConfig? : Partial<SecureStorageConfig>
+createDefaultIfMissing? : boolean
}
class AuditConfigChangeHandler {
+callbacks : Map<string, Function[]>
+onConfigChange(fieldPath, callback)
+handleChange(fieldPath, newValue, oldValue)
+removeCallbacks(fieldPath)
+removeAllCallbacks()
}
class PresetHandler {
+getPresets(organizationId?)
+getPreset(name, organizationId?)
+createPreset(preset)
+updatePreset(preset)
+deletePreset(name, organizationId)
+}
class AuditPreset {
+name : string
+description? : string
+organizationId : string
+action : string
+dataClassification : DataClassification
+requiredFields : string[]
+defaultValues? : Record<string, any>
+validation? : Partial<ValidationConfig>
}
ConfigIntegrationOptions --> AuditConfigChangeHandler : "uses"
PresetHandler --> AuditPreset : "manages"
```

**Section sources**
- [integration.ts](file://packages\audit\src\config\integration.ts#L50-L100)
- [preset-types.ts](file://packages\audit\src\preset\preset-types.ts#L10-L25)

## Plugin Architecture

The plugin architecture provides a flexible system for extending the audit functionality through modular components. Plugins can be enabled or disabled through configuration and support dependency management.

### Plugin Configuration
Plugins are configured through the main configuration object and can be dynamically loaded at runtime. Each plugin has its own configuration schema and lifecycle hooks.

```mermaid
classDiagram
class PluginConfig {
+name : string
+enabled : boolean
+config : Record<string, any>
+dependencies : string[]
}
class Plugin {
+name : string
+version : string
+dependencies : string[]
+initialize(config : any) : Promise<void>
+shutdown() : Promise<void>
+validateConfig(config : any) : ValidationResult
}
class PluginRegistry {
+plugins : Map<string, Plugin>
+register(plugin : Plugin, config : any) : Promise<void>
+unregister(pluginName : string) : Promise<void>
+hasPlugin(pluginName : string) : boolean
+getPlugin(pluginName : string) : Plugin | undefined
}
class ValidationResult {
+valid : boolean
+errors? : string[]
}
PluginConfig --> Plugin : "instantiates"
PluginRegistry --> Plugin : "manages"
Plugin --> ValidationResult : "returns"
```

**Section sources**
- [types.ts](file://packages\audit\src\config\types.ts#L45-L110)
- [integration.ts](file://packages\audit\src\config\integration.ts#L200-L250)

## Configuration Change Tracking

The configuration system includes comprehensive change tracking that records all configuration modifications, providing an audit trail of configuration changes. Each change is stored with metadata including timestamps, previous and new values, and the user or system that made the change.

### Configuration Change Events
The system records configuration changes in a dedicated database table, capturing detailed information about each modification for audit and troubleshooting purposes.

```mermaid
erDiagram
CONFIG_CHANGE_EVENT {
int id PK
string timestamp
string field
json previous_value
json new_value
string changed_by
string reason
string environment
string previous_version
string new_version
}
CONFIG_CHANGE_EVENT ||--|| AuditConfig : "tracks changes to"
```

**Section sources**
- [manager.ts](file://packages\audit\src\config\manager.ts#L200-L240)
- [types.ts](file://packages\audit\src\config\types.ts#L377-L400)

## KMS Integration

The Key Management Service (KMS) integration provides enterprise-grade encryption for configuration storage and sensitive data protection. The system integrates with Infisical KMS to manage encryption keys, perform cryptographic operations, and ensure secure configuration storage.

### KMS Configuration
The KMS configuration enables secure storage of configuration files using external key management services. This feature is particularly important for production environments where configuration files may contain sensitive information.

```mermaid
classDiagram
class SecureStorageConfig {
+enabled : boolean
+algorithm : 'AES-256-GCM' | 'AES-256-CBC'
+kdf : 'PBKDF2' | 'scrypt'
+salt : string
+iterations : number
+kms : KMSConfig
}
class KMSConfig {
+enabled : boolean
+encryptionKey : string
+signingKey : string
+accessToken : string
+baseUrl : string
+algorithm? : 'AES-256-GCM' | 'AES-256-CBC'
+kdf? : 'PBKDF2' | 'scrypt'
+salt? : string
+iterations? : number
}
class InfisicalKmsClient {
+encrypt(plaintext : string) : Promise<EncryptResponse>
+decrypt(ciphertext : string) : Promise<DecryptResponse>
+sign(data : string) : Promise<SignResponse>
+verify(data : string, signature : string) : Promise<VerifyResponse>
}
SecureStorageConfig --> KMSConfig : "contains"
ConfigurationManager --> InfisicalKmsClient : "uses"
InfisicalKmsClient --> KMSConfig : "configured with"
```

**Section sources**
- [types.ts](file://packages\audit\src\config\types.ts#L400-L450)
- [manager.ts](file://packages\audit\src\config\manager.ts#L150-L200)
- [integration.ts](file://packages\audit\src\config\integration.ts#L100-L150)

### KMS Integration Workflow
The KMS integration follows a secure workflow for encrypting and decrypting configuration files, ensuring that sensitive data is protected both at rest and in transit.

```mermaid
sequenceDiagram
participant App as "Application"
participant Manager as "ConfigurationManager"
participant KMS as "InfisicalKmsClient"
participant Storage as "S3/File Storage"
App->>Manager : initialize()
Manager->>Manager : Initialize KMS client
Manager->>KMS : Initialize with config
KMS->>KMS : Validate KMS credentials
Manager->>Storage : Load encrypted config
Storage-->>Manager : Return encrypted data
Manager->>KMS : decrypt(ciphertext)
KMS->>KMS : Call KMS API /decrypt
KMS-->>Manager : Return plaintext
Manager->>Manager : Parse configuration
Manager->>Manager : Validate configuration
Manager-->>App : Configuration ready
App->>Manager : updateConfig(path, value)
Manager->>Manager : Validate new config
Manager->>Manager : Apply changes
Manager->>Manager : Serialize config
Manager->>KMS : encrypt(plaintext)
KMS->>KMS : Call KMS API /encrypt
KMS-->>Manager : Return ciphertext
Manager->>Storage : Save encrypted config
Storage-->>Manager : Confirmation
Manager-->>App : Update complete
```

**Diagram sources**
- [manager.ts](file://packages\audit\src\config\manager.ts#L250-L300)
- [infisical-kms/src/client.ts](file://packages\infisical-kms\src\client.ts#L15-L145)
- [infisical-kms/src/types.ts](file://packages\infisical-kms\src\types.ts#L1-L56)

## OTLP Exporter

The OpenTelemetry Protocol (OTLP) exporter provides standardized observability data export for distributed tracing and metrics collection. This integration enables seamless connection with various observability platforms while maintaining data consistency and reliability.

### OTLP Configuration
The OTLP exporter is configured through the logging configuration interface, allowing flexible setup for different observability backends. The configuration supports multiple authentication methods and export formats.

```mermaid
classDiagram
class LoggingConfig {
+level : 'debug' | 'info' | 'warn' | 'error'
+structured : boolean
+format : 'json' | 'text'
+enableCorrelationIds : boolean
+retentionDays : number
+exporterType : 'console' | 'jaeger' | 'zipkin' | 'otlp'
+exporterEndpoint? : string
+exporterHeaders? : Record<string, string>
}
class ObservabilityConfig {
+tracing : TracingConfig
+metrics : MetricsConfig
+profiling : ProfilingConfig
+dashboard : DashboardConfig
}
class TracingConfig {
+enabled : boolean
+serviceName : string
+sampleRate : number
+exporterType : 'console' | 'jaeger' | 'zipkin' | 'otlp'
+exporterEndpoint? : string
+headers? : Record<string, string>
}
class OTPLLogger {
+config : LoggingConfig
+logBatch : Log[]
+batchTimeout : Timeout
+BATCH_SIZE : 100
+BATCH_TIMEOUT_MS : 5000
+sendLogToOTLP(log : Log) : Promise<void>
+compressPayload(data : string) : Promise<CompressionResult>
}
class AuditTracer {
+config : TracingConfig
+spanBatch : Span[]
+batchTimeout : Timeout
+BATCH_SIZE : 100
+BATCH_TIMEOUT_MS : 5000
+exportToOTLP(span : Span) : void
+sendSpansToOTLP(spans : Span[]) : Promise<void>
+createOTLPPayload(spans : Span[]) : OTLPPayload
+getAuthHeaders() : Record<string, string>
}
LoggingConfig --> OTPLLogger : "configures"
ObservabilityConfig --> AuditTracer : "configures"
TracingConfig --> AuditTracer : "contains"
```

**Section sources**
- [types.ts](file://packages\audit\src\config\types.ts#L488-L555)
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L207-L676)
- [otpl.ts](file://packages\logs\src\otpl.ts#L0-L165)
- [types.ts](file://packages\audit\src\observability\types.ts#L254-L302)
- [logging.ts](file://packages\logs\src\logging.ts#L0-L619)

### OTLP Export Workflow
The OTLP export workflow implements batch processing, error handling, and authentication to ensure reliable data transmission to observability platforms. The system automatically handles network issues and rate limiting.

```mermaid
sequenceDiagram
participant App as "Application"
participant Logger as "OTPLLogger"
participant Tracer as "AuditTracer"
participant OTLP as "OTLP Endpoint"
App->>Logger : debug/info/warn/error(message)
Logger->>Logger : marshal log entry
Logger->>Logger : addToBatch(log)
Logger->>Logger : flushBatch() if batch full or timeout
Logger->>Logger : sendLogToOTLP(batch)
Logger->>OTLP : POST /v1/logs with authentication
alt Success
OTLP-->>Logger : 200 OK
Logger-->>App : Export successful
else Rate Limited
OTLP-->>Logger : 429 Too Many Requests
Logger->>Logger : exponential backoff
Logger->>Logger : retry with delay
else Client Error
OTLP-->>Logger : 4xx Error
Logger-->>App : Log client error, no retry
else Network Error
Logger->>Logger : exponential backoff
Logger->>Logger : retry with delay
end
App->>Tracer : startSpan(operation)
Tracer->>Tracer : create span
Tracer->>Tracer : addToBatch(span)
Tracer->>Tracer : flushBatch() if batch full or timeout
Tracer->>Tracer : sendSpansToOTLP(batch)
Tracer->>OTLP : POST /v1/traces with authentication
alt Success
OTLP-->>Tracer : 200 OK
Tracer-->>App : Export successful
else Rate Limited
OTLP-->>Tracer : 429 Too Many Requests
Tracer->>Tracer : exponential backoff
Tracer->>Tracer : retry with delay
else Client Error
OTLP-->>Tracer : 4xx Error
Tracer-->Tracer : Log client error, no retry
else Network Error
Tracer->>Tracer : exponential backoff
Tracer->>Tracer : retry with delay
end
```

**Diagram sources**
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L304-L452)
- [otpl.ts](file://packages\logs\src\otpl.ts#L129-L165)
- [types.ts](file://packages\audit\src\config\types.ts#L488-L555)

## Structured Logging System

The structured logging system provides comprehensive logging capabilities with contextual information, performance metrics, and error tracking. The system replaces the previous ConsoleLogger with a more robust StructuredLogger implementation that supports multiple output types and advanced features.

### StructuredLogger Class
The StructuredLogger class provides a comprehensive interface for logging with context, performance tracking, and error handling. It supports multiple output types including console, file, Redis, and OTLP.

```mermaid
classDiagram
class StructuredLogger {
+config : LoggerConfig
+baseContext : LogContext
+performanceStart? : [number, number]
+child(context : LogContext) : StructuredLogger
+startTiming() : void
+endTiming() : number | undefined
+debug(message : string, metadata? : Record<string, any>, context? : LogContext) : void
+info(message : string, metadata? : Record<string, any>, context? : LogContext) : void
+warn(message : string, metadata? : Record<string, any>, context? : LogContext) : void
+error(message : string, error? : Error | string, metadata? : Record<string, any>, context? : LogContext) : void
+logRequestStart(method : string, path : string, context : LogContext, metadata? : Record<string, any>) : void
+logRequestEnd(method : string, path : string, statusCode : number, context : LogContext, metadata? : Record<string, any>) : void
+logDatabaseOperation(operation : string, table : string, duration : number, context : LogContext, metadata? : Record<string, any>) : void
+logAuthEvent(event : 'login' | 'logout' | 'token_refresh' | 'auth_failure', userId? : string, context? : LogContext, metadata? : Record<string, any>) : void
+logSecurityEvent(event : string, severity : 'low' | 'medium' | 'high' | 'critical', context : LogContext, metadata? : Record<string, any>) : void
+logPerformanceMetrics(operation : string, metrics : Record<string, number>, context : LogContext, metadata? : Record<string, any>) : void
+log(level : 'debug' | 'info' | 'warn' | 'error', message : string, metadata? : Record<string, any>, context? : LogContext) : void
+shouldLog(level : 'debug' | 'info' | 'warn' | 'error') : boolean
+extractErrorInfo(error? : Error | string) : any
+generateCorrelationId() : string
+output(logEntry : LogEntry) : void
+outputToConsole(logEntry : LogEntry) : void
+outputToOtpl(logEntry : LogEntry) : Promise<void>
+outputToFile(logEntry : LogEntry) : void
+outputToRedis(logEntry : LogEntry) : void
+compressPayload(data : string) : Promise<{ data : string, encoding : string } | null>
}
class LoggerConfig {
+level : 'debug' | 'info' | 'warn' | 'error'
+enablePerformanceLogging : boolean
+enableErrorTracking : boolean
+enableMetrics : boolean
+format : 'json' | 'pretty'
+outputs : ('console' | 'file' | 'redis' | 'otpl')[]
+redisConfig? : RedisConfig
+fileConfig? : FileConfig
+otplConfig? : OTPLConfig
}
class LogContext {
+requestId? : string
+userId? : string
+sessionId? : string
+organizationId? : string
+endpoint? : string
+method? : string
+userAgent? : string
+ip? : string
+correlationId? : string
+traceId? : string
+spanId? : string
+service? : string
}
class LogEntry {
+timestamp : string
+level : 'debug' | 'info' | 'warn' | 'error'
+message : string
+context : LogContext
+metadata? : Record<string, any>
+duration? : number
+error? : ErrorInfo
+performance? : PerformanceInfo
}
class ErrorInfo {
+name : string
+message : string
+stack? : string
+code? : string
}
class PerformanceInfo {
+memoryUsage : NodeJS.MemoryUsage
+cpuUsage : NodeJS.CpuUsage
}
class RedisConfig {
+key : string
+maxEntries : number
+ttl : number
}
class FileConfig {
+path : string
+maxSize : number
+maxFiles : number
}
class OTPLConfig {
+endpoint : string
+headers? : Record<string, string>
}
StructuredLogger --> LoggerConfig : "uses"
StructuredLogger --> LogContext : "uses"
StructuredLogger --> LogEntry : "creates"
StructuredLogger --> ErrorInfo : "creates"
StructuredLogger --> PerformanceInfo : "creates"
```

**Section sources**
- [logging.ts](file://packages\logs\src\logging.ts#L73-L548)

### Logging Configuration
The logging configuration has been enhanced to support structured logging with multiple output types and advanced features. The configuration includes options for log level, format, retention, and export settings.

```typescript
interface LoggerConfig {
	/** Log level */
	level: 'debug' | 'info' | 'warn' | 'error'
	
	/** Enable performance logging */
	enablePerformanceLogging: boolean
	
	/** Enable error tracking */
	enableErrorTracking: boolean
	
	/** Enable metrics collection */
	enableMetrics: boolean
	
	/** Log format */
	format: 'json' | 'pretty'
	
	/** Output destinations */
	outputs: ('console' | 'file' | 'redis' | 'otpl')[]
	
	/** OTLP exporter configuration */
	otplConfig?: {
		/** OTLP endpoint URL */
		endpoint: string
		
		/** Additional headers for OTLP requests */
		headers?: Record<string, string>
	}
}
```

**Section sources**
- [types.ts](file://packages\audit\src\config\types.ts#L430-L475)
- [logging.ts](file://packages\logs\src\logging.ts#L0-L619)

## LoggerFactory

The LoggerFactory provides a centralized way to create and manage logger instances with consistent configuration and context. It simplifies logger creation and ensures consistent logging practices across the application.

### LoggerFactory Implementation
The LoggerFactory class provides static methods for creating logger instances with predefined configurations and contexts. It supports creating general loggers, request loggers, and service loggers with appropriate context.

```mermaid
classDiagram
class LoggerFactory {
+defaultConfig : LoggerConfig
+setDefaultConfig(config : Partial<LoggerConfig>) : void
+createLogger(context : LogContext = {}, config? : Partial<LoggerConfig>) : StructuredLogger
+createRequestLogger(requestId : string, method : string, path : string, additionalContext : LogContext = {}) : StructuredLogger
+createServiceLogger(service : string, additionalContext : LogContext = {}) : StructuredLogger
}
class StructuredLogger {
+config : LoggerConfig
+baseContext : LogContext
}
class LogContext {
+requestId? : string
+userId? : string
+sessionId? : string
+organizationId? : string
+endpoint? : string
+method? : string
+userAgent? : string
+ip? : string
+correlationId? : string
+traceId? : string
+spanId? : string
+service? : string
}
LoggerFactory --> StructuredLogger : "creates"
LoggerFactory --> LogContext : "uses"
```

**Section sources**
- [logging.ts](file://packages\logs\src\logging.ts#L550-L619)

### Factory Usage Patterns
The LoggerFactory provides several convenience methods for creating specialized loggers:

```typescript
// Create a general logger with context
const logger = LoggerFactory.createLogger({
	organizationId: 'org-123',
	userId: 'user-456'
})

// Create a request-specific logger
const requestLogger = LoggerFactory.createRequestLogger(
	'req-789',
	'GET',
	'/api/v1/users',
	{ organizationId: 'org-123' }
)

// Create a service-specific logger
const serviceLogger = LoggerFactory.createServiceLogger(
	'audit-service',
	{ organizationId: 'org-123' }
)

// Set default configuration for all loggers
LoggerFactory.setDefaultConfig({
	level: 'info',
	format: 'json',
	outputs: ['console', 'otpl'],
	otplConfig: {
		endpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'
	}
})
```

**Section sources**
- [logging.ts](file://packages\logs\src\logging.ts#L550-L619)