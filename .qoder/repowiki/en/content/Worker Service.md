# Worker Service

<cite>
**Referenced Files in This Document**   
- [index.ts](file://apps\worker\src\index.ts) - *Updated in recent commit to integrate LoggerFactory from @repo/logs and implement secret detection*
- [archival-service.ts](file://packages\audit\src\archival\archival-service.ts) - *Refactored to use StructuredLogger and LoggerFactory*
- [postgres-archival-service.ts](file://packages\audit\src\archival\postgres-archival-service.ts) - *Updated to use enhanced structured logging*
- [logging.ts](file://packages\logs\src\logging.ts) - *Contains LoggerFactory implementation for enhanced structured logging*
- [otpl.ts](file://packages\logs\src\otpl.ts) - *OTLP logging implementation with batch processing*
- [interface.ts](file://packages\logs\src\interface.ts) - *Logger interface and LoggingConfig definition*
- [log.ts](file://packages\logs\src\log.ts) - *Log class and schema definitions*
- [Dockerfile](file://apps\worker\Dockerfile) - *Updated for observability changes*
- [package.json](file://apps\worker\package.json) - *Updated with new observability dependencies*
- [tracer.ts](file://packages\audit\src\observability\tracer.ts) - *Updated to use OTLP exporter and fix auth header usage*
- [otlp-configuration.md](file://packages\audit\docs\observability\otlp-configuration.md) - *Documentation for OTLP configuration*
</cite>

## Update Summary
**Changes Made**   
- Updated worker initialization to use LoggerFactory from @repo/logs package for enhanced structured logging across all components
- Integrated new logging system with OTLP export capabilities and batch processing in archival services
- Added detection and handling of internal secret exposure within worker process
- Updated documentation to reflect the new LoggerFactory-based logging architecture
- Added new section on internal secret detection and handling
- Updated architecture overview and component analysis to reflect logging changes in archival services
- Enhanced troubleshooting guide with logging-specific issues and secret detection scenarios
- Removed outdated references to ConsoleLogger in documentation
- Updated diagram sources to reflect actual code changes

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
The **Worker Service** is a Node.js background processing service responsible for handling compliance checks, monitoring tasks, and audit event analysis in real time. It operates as a decoupled component within a larger system, consuming audit events and applying pattern detection logic to identify suspicious behavior, generate alerts, and maintain system health metrics.

Built on a modular architecture, the worker integrates with external systems including Redis for metrics storage, PostgreSQL for persistent alert data, and message queues for event ingestion. It leverages Inngest for function orchestration and is designed for deployment via Docker and Kubernetes, supporting horizontal scaling and fault-tolerant operation.

This document provides comprehensive architectural documentation, detailing component interactions, data flows, observability mechanisms, and integration patterns with the main server and data pipelines.

## Project Structure
The Worker Service resides in the `apps/worker` directory and functions as a lightweight orchestrator that imports core logic from shared packages, particularly the `@repo/audit` module. The service is structured to separate concerns across monitoring, observability, and compliance domains.

Key directories:
- `apps/worker/src`: Entry point and worker initialization
- `packages/audit/src/monitor`: Real-time monitoring, alerting, and health checks
- `packages/audit/src/observability`: Tracing, profiling, and dashboard metrics
- `packages/audit/src/queue`: Reliable message processing and circuit breaker logic
- `packages/audit/src/crypto`: Cryptographic integrity verification for audit events
- `packages/audit/src/archival`: Data archival and retention policy management

The worker uses TypeScript, follows a monorepo structure managed by pnpm, and relies on shared configuration from `packages/typescript-config`.

```mermaid
graph TD
A[Worker Service] --> B[Monitoring System]
A --> C[Observability System]
A --> D[Queue Processor]
A --> E[CryptoService]
A --> F[Archival Service]
B --> E
B --> G[Metrics Collector]
B --> H[Alert Handlers]
C --> I[Distributed Tracing]
C --> J[Performance Dashboard]
D --> K[Circuit Breaker]
D --> L[Dead Letter Queue]
E --> M[Hash Verification]
F --> N[Data Archival]
F --> O[Retention Policies]
G --> P[Redis]
H --> Q[PostgreSQL]
```

**Diagram sources**
- [index.ts](file://apps\worker\src\index.ts)
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts)
- [tracer.ts](file://packages\audit\src\observability\tracer.ts)
- [crypto.ts](file://packages\audit\src\crypto.ts)
- [archival-service.ts](file://packages\audit\src\archival\archival-service.ts)

**Section sources**
- [index.ts](file://apps\worker\src\index.ts)
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts)
- [archival-service.ts](file://packages\audit\src\archival\archival-service.ts)

## Core Components
The Worker Service's functionality is driven by several core components:

- **MonitoringService**: Detects suspicious patterns in audit events and generates alerts.
- **RedisMetricsCollector**: Collects and stores real-time metrics in Redis.
- **AuditTracer**: Provides distributed tracing for observability with OTLP export.
- **DatabaseAlertHandler**: Persists alerts to PostgreSQL and manages alert lifecycle.
- **CryptoService**: Verifies the integrity of audit events through hash verification.
- **StructuredLogger**: Enhanced structured logging implementation with OTLP export capabilities.
- **ArchivalService**: Manages data archival and retention policies with enhanced logging.
- **SecretDetector**: Detects and handles internal secret exposure within the worker process.

These components are orchestrated through dependency injection and support pluggable handlers for extensibility.

**Section sources**
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts)
- [metrics-collector.ts](file://packages\audit\src\monitor\metrics-collector.ts)
- [tracer.ts](file://packages\audit\src\observability\tracer.ts)
- [crypto.ts](file://packages\audit\src\crypto.ts)
- [logging.ts](file://packages\logs\src\logging.ts)
- [archival-service.ts](file://packages\audit\src\archival\archival-service.ts)
- [index.ts](file://apps\worker\src\index.ts)

## Architecture Overview
The Worker Service follows an event-driven, microservices-inspired architecture. It consumes audit log events from a message queue (via Inngest), processes them for compliance and security monitoring, and emits alerts and metrics.

The system is designed with resilience in mind, incorporating circuit breakers, retry mechanisms, and dead-letter queues for fault tolerance. Observability is first-class, with support for distributed tracing via OTLP, performance metrics, and health checks. Security is enhanced through cryptographic integrity verification of audit events and internal secret detection.

```mermaid
graph LR
subgraph "External Systems"
MQ[(Message Queue)]
DB[(PostgreSQL)]
Cache[(Redis)]
SMTP[(Email Service)]
KMS[(Key Management Service)]
OTLP[(OTLP Endpoint)]
S3[(S3 Configuration)]
end
subgraph "Worker Service"
direction TB
Inngest[Inngest Function]
Monitor[MonitoringService]
Metrics[RedisMetricsCollector]
Tracer[AuditTracer]
Alerts[DatabaseAlertHandler]
Crypto[CryptoService]
Logger[StructuredLogger]
Archival[ArchivalService]
SecretDetector[SecretDetector]
end
S3 --> Inngest
MQ --> Inngest
Inngest --> Monitor
Monitor --> Metrics
Monitor --> Tracer
Monitor --> Alerts
Monitor --> Crypto
Monitor --> Logger
Crypto --> KMS
Alerts --> DB
Metrics --> Cache
Monitor --> SMTP
Tracer --> OTLP
Logger --> OTLP
Inngest --> Archival
Archival --> DB
Archival --> Logger
Inngest --> SecretDetector
SecretDetector --> Logger
```

**Diagram sources**
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts)
- [metrics-collector.ts](file://packages\audit\src\monitor\metrics-collector.ts)
- [tracer.ts](file://packages\audit\src\observability\tracer.ts)
- [database-alert-handler.ts](file://packages\audit\src\monitor\database-alert-handler.ts)
- [crypto.ts](file://packages\audit\src\crypto.ts)
- [logging.ts](file://packages\logs\src\logging.ts)
- [archival-service.ts](file://packages\audit\src\archival\archival-service.ts)
- [index.ts](file://apps\worker\src\index.ts)

## Detailed Component Analysis

### Monitoring Service Analysis
The `MonitoringService` is the central component responsible for real-time analysis of audit events. It detects suspicious patterns such as failed authentication bursts, unauthorized access attempts, high-velocity data access, bulk operations, and off-hours activity.

It uses configurable thresholds and time windows to identify anomalies and applies deduplication via Redis-based cooldowns to prevent alert storms. The service now integrates with CryptoService to verify event integrity before processing.

```mermaid
classDiagram
class MonitoringService {
+processEvent(event : AuditLogEvent)
+detectSuspiciousPatterns(events : AuditLogEvent[])
+generateAlert(alert : Alert)
+getHealthStatus()
-detectFailedAuthPattern()
-detectUnauthorizedAccessPattern()
-detectDataVelocityPattern()
-detectBulkOperationPattern()
-detectOffHoursPattern()
}
class AlertHandler {
<<interface>>
+sendAlert(alert : Alert)
+acknowledgeAlert(id : string, by : string)
+resolveAlert(id : string, by : string)
+getActiveAlerts()
}
class MetricsCollector {
<<interface>>
+recordEvent()
+recordProcessingLatency(ms : number)
+recordError()
+getMetrics()
}
class CryptoService {
+verifyHash(event : AuditLogEvent, expectedHash : string) : boolean
+generateHash(event : AuditLogEvent) : string
}
MonitoringService --> AlertHandler : "uses"
MonitoringService --> MetricsCollector : "depends on"
MonitoringService --> CryptoService : "integrates with"
MonitoringService --> "Pattern Detection" : "composes"
```

**Diagram sources**
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts)
- [monitoring-types.ts](file://packages\audit\src\monitor\monitoring-types.ts)
- [crypto.ts](file://packages\audit\src\crypto.ts)

**Section sources**
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts#L1-L799)

### CryptoService Implementation
The `CryptoService` provides cryptographic integrity verification for audit events, ensuring that events have not been tampered with during transmission or storage. It implements SHA-256 hashing of critical event fields and supports both local HMAC-SHA256 signatures and integration with external Key Management Services (KMS).

```mermaid
sequenceDiagram
participant Event as Audit Event
participant Monitor as MonitoringService
participant Crypto as CryptoService
participant KMS as Key Management Service
Event->>Monitor : processEvent()
Monitor->>Crypto : verifyHash()
Crypto->>Crypto : extractCriticalFields()
Crypto->>Crypto : createDeterministicString()
Crypto->>Crypto : generateHash()
alt Hash Verification Success
Crypto-->>Monitor : true
Monitor->>Monitor : continue processing
else Hash Verification Failure
Crypto-->>Monitor : false
Monitor->>Monitor : handle tampering
Monitor->>KMS : verifyEventSignature()
KMS-->>Monitor : signatureValid
end
Monitor->>Monitor : detectPatterns()
```

**Diagram sources**
- [crypto.ts](file://packages\audit\src\crypto.ts#L72-L315)
- [index.ts](file://apps\worker\src\index.ts#L300-L350)

**Section sources**
- [crypto.ts](file://packages\audit\src\crypto.ts#L72-L315)

### Metrics Collection Flow
The metrics collection system uses Redis as a high-performance backend to track key performance indicators such as events processed, error rates, processing latency, and alert counts.

Metrics are updated in real time and exposed via a `getMetrics()` API for health checks and monitoring dashboards.

```mermaid
sequenceDiagram
participant Event as Audit Event
participant Monitor as MonitoringService
participant Collector as RedisMetricsCollector
participant Redis as Redis Cache
Event->>Monitor : processEvent()
Monitor->>Collector : recordEvent()
Monitor->>Collector : recordProcessingLatency()
Collector->>Redis : INCR eventsProcessed
Collector->>Redis : SET processingLatency
Collector->>Redis : SETEX timestamp
Redis-->>Collector : OK
Collector-->>Monitor : Ack
Monitor->>Monitor : detectPatterns()
```

**Diagram sources**
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts#L200-L300)
- [metrics-collector.ts](file://packages\audit\src\monitor\metrics-collector.ts#L100-L200)

### Distributed Tracing Implementation with OTLP
The `AuditTracer` provides distributed tracing capabilities with OTLP export, enabling end-to-end visibility into audit event processing. It supports trace context propagation via HTTP headers and exports spans to OTLP endpoints with configurable authentication.

```mermaid
flowchart TD
Start([Start Span]) --> Inject["injectContext(): TraceContext"]
Inject --> Extract["extractContext(headers): TraceContext"]
Extract --> Create["createChildSpan(parent, op)"]
Create --> Log["log(level, message)"]
Log --> Tag["setTag(key, value)"]
Tag --> Finish["finish()"]
Finish --> Export["exportSpan()"]
Export --> OTLP["OTLP Exporter"]
OTLP --> Batch["Batch Processing"]
Batch --> Auth["Authentication Headers"]
Auth --> HTTP["HTTP POST to OTLP Endpoint"]
HTTP --> Success["Success: 200 OK"]
HTTP --> Retry["Retry on Failure"]
Retry --> Backoff["Exponential Backoff"]
Backoff --> Success
```

**Diagram sources**
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L1-L677)
- [index.ts](file://apps\worker\src\index.ts#L1-L747)

**Section sources**
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L1-L677)
- [index.ts](file://apps\worker\src\index.ts#L1-L747)

### OTLP Configuration and Authentication
The OTLP exporter is configured with multiple authentication methods and endpoint options for different observability platforms.

```typescript
// OTLP Configuration in index.ts
const observabilityConfig: ObservabilityConfig = {
	tracing: {
		enabled: true,
		serviceName: 'audit-system',
		sampleRate: 1.0,
		exporterType: 'otlp' as const,
		exporterEndpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
		headers: {
			'stream-name': 'default',
		},
	},
	// ... other config
}
```

**Supported Authentication Methods:**
- **Bearer Token**: Using `OTLP_API_KEY` environment variable
- **Custom Headers**: Using `OTLP_AUTH_HEADER` environment variable with format "Key: Value"
- **Environment-based**: Configuration via environment variables for secure credential management

**Diagram sources**
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L487-L537)
- [index.ts](file://apps\worker\src\index.ts#L1-L747)

**Section sources**
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L487-L537)
- [index.ts](file://apps\worker\src\index.ts#L1-L747)

### Enhanced Structured Logging Implementation
The `LoggerFactory` from `@repo/logs` provides enhanced structured logging with multiple output options including console, file, Redis, and OTLP. The logging system supports correlation IDs, contextual information, performance metrics, and error tracking.

```mermaid
sequenceDiagram
participant Service as MonitoringService
participant LoggerFactory as LoggerFactory
participant Logger as StructuredLogger
participant Output as OTLP Endpoint
Service->>LoggerFactory : createLogger({service : 'worker'})
LoggerFactory->>Logger : new StructuredLogger(config, context)
Service->>Logger : info("Processing event")
Logger->>Logger : marshal(level, message, fields)
Logger->>Logger : create Log object
Logger->>Output : sendLogToOTLP(formatted message)
Service->>Logger : error("Processing failed", {error : details})
Logger->>Logger : marshal("error", message, fields)
Logger->>Output : sendLogToOTLP(formatted message)
```

**Diagram sources**
- [index.ts](file://apps\worker\src\index.ts#L1-L784)
- [logging.ts](file://packages\logs\src\logging.ts#L1-L620)
- [otpl.ts](file://packages\logs\src\otpl.ts#L1-L166)

**Section sources**
- [index.ts](file://apps\worker\src\index.ts#L1-L784)
- [logging.ts](file://packages\logs\src\logging.ts#L1-L620)
- [otpl.ts](file://packages\logs\src\otpl.ts#L1-L166)
- [package.json](file://apps\worker\package.json)
- [Dockerfile](file://apps\worker\Dockerfile)

### Archival Service Logging Integration
The `ArchivalService` and its PostgreSQL implementation now use the enhanced structured logging system via `LoggerFactory`. This change ensures consistent logging across all archival operations, including data archiving, retrieval, and deletion.

```mermaid
sequenceDiagram
participant Service as ArchivalService
participant LoggerFactory as LoggerFactory
participant Logger as StructuredLogger
participant Output as OTLP Endpoint
Service->>LoggerFactory : createLogger({service : '@repo/audit - ArchivalService'})
LoggerFactory->>Logger : new StructuredLogger(config, context)
Service->>Logger : info("Starting archive creation")
Logger->>Logger : marshal("info", "Starting archive creation", fields)
Logger->>Output : sendLogToOTLP(formatted message)
Service->>Logger : error("Archive creation failed", {error : details})
Logger->>Logger : marshal("error", "Archive creation failed", fields)
Logger->>Output : sendLogToOTLP(formatted message)
```

**Diagram sources**
- [archival-service.ts](file://packages\audit\src\archival\archival-service.ts#L1-L799)
- [postgres-archival-service.ts](file://packages\audit\src\archival\postgres-archival-service.ts#L1-L229)
- [logging.ts](file://packages\logs\src\logging.ts#L1-L620)
- [otpl.ts](file://packages\logs\src\otpl.ts#L1-L166)

**Section sources**
- [archival-service.ts](file://packages\audit\src\archival\archival-service.ts#L1-L799)
- [postgres-archival-service.ts](file://packages\audit\src\archival\postgres-archival-service.ts#L1-L229)
- [logging.ts](file://packages\logs\src\logging.ts#L1-L620)
- [otpl.ts](file://packages\logs\src\otpl.ts#L1-L166)

### Internal Secret Detection and Handling
The worker now includes a secret detection mechanism that identifies and handles internal secret exposure within the worker process. This feature enhances security by preventing accidental leakage of sensitive information.

```mermaid
sequenceDiagram
participant Worker as Worker Service
participant SecretDetector as SecretDetector
participant Logger as StructuredLogger
participant AlertHandler as DatabaseAlertHandler
Worker->>SecretDetector : detectSecrets()
SecretDetector->>SecretDetector : scanEnvironmentVariables()
SecretDetector->>SecretDetector : scanConfiguration()
SecretDetector->>SecretDetector : scanProcessMemory()
alt Secret Detected
SecretDetector-->>Worker : true
Worker->>Logger : warn("Internal secret detected!")
Worker->>AlertHandler : generateAlert()
else No Secret Detected
SecretDetector-->>Worker : false
Worker->>Worker : continue processing
end
```

**Diagram sources**
- [index.ts](file://apps\worker\src\index.ts#L1-L784)
- [logging.ts](file://packages\logs\src\logging.ts#L1-L620)
- [database-alert-handler.ts](file://packages\audit\src\monitor\database-alert-handler.ts#L1-L200)

**Section sources**
- [index.ts](file://apps\worker\src\index.ts#L1-L784)
- [logging.ts](file://packages\logs\src\logging.ts#L1-L620)
- [database-alert-handler.ts](file://packages\audit\src\monitor\database-alert-handler.ts#L1-L200)

## Dependency Analysis
The Worker Service has a layered dependency structure:

```mermaid
graph TD
Worker[Worker Service] --> Audit[@repo/audit]
Audit --> RedisClient[@repo/redis-client]
Audit --> Drizzle[drizzle-orm]
Audit --> IORedis[ioredis]
Audit --> InfisicalKMS[@repo/infisical-kms]
Worker --> Inngest[inngest]
Worker --> Hono[hono]
Audit --> Zod[zod]
Audit --> Bcrypt[bcrypt]
Worker --> Logs[@repo/logs]
Logs --> Pino[pino]
Logs --> PinoElastic[pino-elasticsearch]
Audit --> Archival[@repo/audit/src/archival]
Archival --> Logs[@repo/logs]
```

All shared packages are managed via the monorepo's `pnpm-workspace.yaml`, ensuring version consistency and efficient development.

**Diagram sources**
- [package.json](file://apps\worker\package.json)
- [package.json](file://packages\audit\package.json)
- [package.json](file://packages\logs\package.json)

**Section sources**
- [package.json](file://apps\worker\package.json)
- [package.json](file://packages\audit\package.json)
- [package.json](file://packages\logs\package.json)

## Performance Considerations
The worker is optimized for high-throughput, low-latency processing:

- **Metrics Collection**: Uses Redis atomic operations (INCR, SETEX) for thread-safe updates.
- **Pattern Detection**: Maintains in-memory event buffer with time-based eviction to limit memory usage.
- **Alert Deduplication**: Implements Redis-backed cooldown keys to prevent duplicate alerts.
- **Tracing**: Samples spans based on configurable rate to balance insight and overhead.
- **Health Checks**: Aggregates metrics asynchronously to avoid blocking event processing.
- **Cryptographic Verification**: Implements efficient hashing of critical fields only, with configurable KMS integration for enhanced security.
- **Logging**: Uses LoggerFactory and StructuredLogger for enhanced structured logging with OTLP export, replacing the previous ConsoleLogger implementation.
- **OTLP Export**: Implements batch processing with configurable batch size (default 100 spans) and timeout (5 seconds) to optimize network efficiency.
- **Archival Processing**: Uses batch processing and compression for efficient data archiving with integrity verification.
- **Secret Detection**: Implements efficient scanning of environment variables and configuration without impacting performance.

The system is horizontally scalable via Kubernetes, with each worker instance maintaining independent state while sharing Redis and PostgreSQL backends.

## Troubleshooting Guide
Common issues and their resolutions:

- **High Memory Usage**: Caused by unbounded span retention. Solution: Call `tracer.cleanup()` periodically.
- **Duplicate Alerts**: Cooldown keys not persisting. Verify Redis connection and TTL settings.
- **Slow Processing**: Check Redis latency and network connectivity. Optimize pattern detection thresholds.
- **Missing Metrics**: Ensure `RedisMetricsCollector` is properly initialized with a valid Redis connection.
- **Tracing Not Exporting**: Confirm `ObservabilityConfig.tracing.enabled` is true and exporter type is set to 'otlp'. Verify that `OTLP_ENDPOINT` environment variable is correctly configured.
- **Hash Verification Failures**: Verify that the `AUDIT_CRYPTO_SECRET` is properly configured and consistent across services. Check that critical event fields match between sender and receiver.
- **Logging Issues**: Ensure LoggerFactory is properly initialized with correct configuration. Verify that LOG_LEVEL environment variable is set appropriately. Check that OTLP endpoint is reachable and properly configured.
- **OTLP Authentication Failures**: Check that either `OTLP_API_KEY` or `OTLP_AUTH_HEADER` environment variables are properly configured. Verify that the authentication method matches the target OTLP endpoint requirements.
- **OTLP Export Failures**: Monitor for 429 (rate limited) responses and implement appropriate retry logic. Check network connectivity to the OTLP endpoint and verify that the endpoint URL is correct.
- **LoggerFactory Configuration Issues**: Ensure default configuration is set before creating loggers. Verify that output types (console, otpl) are correctly specified in the configuration.
- **Internal Secret Detection**: If secret detection alerts are triggered, immediately audit configuration and environment variables for sensitive information. Ensure secrets are properly managed through secure storage systems.
- **Archival Service Errors**: Verify that the database connection is stable and that the archive table schema matches the expected structure. Check that compression algorithms are supported and properly configured.

**Section sources**
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts#L500-L600)
- [metrics-collector.ts](file://packages\audit\src\monitor\metrics-collector.ts#L300-L350)
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L400-L426)
- [crypto.ts](file://packages\audit\src\crypto.ts#L150-L200)
- [logging.ts](file://packages\logs\src\logging.ts#L1-L620)
- [otpl.ts](file://packages\logs\src\otpl.ts#L1-L166)
- [archival-service.ts](file://packages\audit\src\archival\archival-service.ts#L1-L799)
- [postgres-archival-service.ts](file://packages\audit\src\archival\postgres-archival-service.ts#L1-L229)
- [index.ts](file://apps\worker\src\index.ts#L1-L784)

## Conclusion
The Worker Service is a robust, scalable background processor designed for real-time compliance and security monitoring. Its modular architecture, deep observability, and resilience patterns make it well-suited for mission-critical audit processing.

By leveraging Redis for metrics, PostgreSQL for persistent alert storage, and Inngest for orchestration, the service achieves high availability and operational transparency. The recent integration of CryptoService enhances security by providing cryptographic integrity verification of audit events, ensuring data authenticity and protection against tampering.

The observability system has been upgraded to use OTLP export instead of console export, providing better integration with modern observability platforms like Grafana Tempo, DataDog, and Honeycomb. This change enables more sophisticated monitoring, analysis, and alerting capabilities while maintaining compatibility with the existing tracing API.

The logging system has been enhanced with the LoggerFactory from `@repo/logs`, providing consistent structured logging across the service while maintaining compatibility with the observability stack. This change simplifies log management, enables OTLP export with batch processing and retry logic, and ensures consistent log formatting across all components.

The archival services have been updated to use the enhanced structured logging system, ensuring consistent logging across all data archiving operations. This change improves traceability and debugging capabilities for archival processes.

A new internal secret detection mechanism has been implemented to prevent accidental leakage of sensitive information, enhancing the overall security posture of the worker service.

Future enhancements could include ML-based anomaly detection, integration with SIEM systems, and enhanced cryptographic features such as digital signatures and certificate-based authentication. The codebase demonstrates strong separation of concerns, extensive testing, and clear extensibility points through pluggable alert handlers and metrics collectors.