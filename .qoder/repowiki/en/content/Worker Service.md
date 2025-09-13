# Worker Service

<cite>
**Referenced Files in This Document**   
- [index.ts](file://apps/worker/src/index.ts) - *Updated in recent commit*
- [monitoring.ts](file://packages/audit/src/monitor/monitoring.ts)
- [monitoring-types.ts](file://packages/audit/src/monitor/monitoring-types.ts)
- [metrics-collector.ts](file://packages/audit/src/monitor/metrics-collector.ts)
- [tracer.ts](file://packages/audit/src/observability/tracer.ts)
- [types.ts](file://packages/audit/src/observability/types.ts)
- [database-alert-handler.ts](file://packages/audit/src/monitor/database-alert-handler.ts)
</cite>

## Update Summary
**Changes Made**   
- Updated initialization sequence for monitoring service and alert handlers in the Worker Service
- Corrected service instantiation order to ensure proper dependency injection
- Added explicit configuration manager initialization before other services
- Updated health check service registration to include processor-dependent checks
- Enhanced error handling during service initialization
- Updated diagram sources to reflect corrected initialization flow

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

The worker uses TypeScript, follows a monorepo structure managed by pnpm, and relies on shared configuration from `packages/typescript-config`.

```mermaid
graph TD
A[Worker Service] --> B[Monitoring System]
A --> C[Observability System]
A --> D[Queue Processor]
B --> E[Metrics Collector]
B --> F[Alert Handlers]
C --> G[Distributed Tracing]
C --> H[Performance Dashboard]
D --> I[Circuit Breaker]
D --> J[Dead Letter Queue]
E --> K[Redis]
F --> L[Database Alert Handler]
L --> M[PostgreSQL]
```

**Diagram sources**
- [index.ts](file://apps/worker/src/index.ts)
- [monitoring.ts](file://packages/audit/src/monitor/monitoring.ts)
- [tracer.ts](file://packages/audit/src/observability/tracer.ts)

**Section sources**
- [index.ts](file://apps/worker/src/index.ts)
- [monitoring.ts](file://packages/audit/src/monitor/monitoring.ts)

## Core Components
The Worker Service's functionality is driven by several core components:

- **MonitoringService**: Detects suspicious patterns in audit events and generates alerts.
- **RedisMetricsCollector**: Collects and stores real-time metrics in Redis.
- **AuditTracer**: Provides distributed tracing for observability.
- **DatabaseAlertHandler**: Persists alerts to PostgreSQL and manages alert lifecycle.

These components are orchestrated through dependency injection and support pluggable handlers for extensibility.

**Section sources**
- [monitoring.ts](file://packages/audit/src/monitor/monitoring.ts)
- [metrics-collector.ts](file://packages/audit/src/monitor/metrics-collector.ts)
- [tracer.ts](file://packages/audit/src/observability/tracer.ts)

## Architecture Overview
The Worker Service follows an event-driven, microservices-inspired architecture. It consumes audit log events from a message queue (via Inngest), processes them for compliance and security monitoring, and emits alerts and metrics.

The system is designed with resilience in mind, incorporating circuit breakers, retry mechanisms, and dead-letter queues for fault tolerance. Observability is first-class, with support for distributed tracing, performance metrics, and health checks.

```mermaid
graph LR
subgraph "External Systems"
MQ[(Message Queue)]
DB[(PostgreSQL)]
Cache[(Redis)]
SMTP[(Email Service)]
end
subgraph "Worker Service"
direction TB
Inngest[Inngest Function]
Monitor[MonitoringService]
Metrics[RedisMetricsCollector]
Tracer[AuditTracer]
Alerts[DatabaseAlertHandler]
end
MQ --> Inngest
Inngest --> Monitor
Monitor --> Metrics
Monitor --> Tracer
Monitor --> Alerts
Alerts --> DB
Metrics --> Cache
Monitor --> SMTP
```

**Diagram sources**
- [monitoring.ts](file://packages/audit/src/monitor/monitoring.ts)
- [metrics-collector.ts](file://packages/audit/src/monitor/metrics-collector.ts)
- [tracer.ts](file://packages/audit/src/observability/tracer.ts)
- [database-alert-handler.ts](file://packages/audit/src/monitor/database-alert-handler.ts)

## Detailed Component Analysis

### Monitoring Service Analysis
The `MonitoringService` is the central component responsible for real-time analysis of audit events. It detects suspicious patterns such as failed authentication bursts, unauthorized access attempts, high-velocity data access, bulk operations, and off-hours activity.

It uses configurable thresholds and time windows to identify anomalies and applies deduplication via Redis-based cooldowns to prevent alert storms.

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
MonitoringService --> AlertHandler : "uses"
MonitoringService --> MetricsCollector : "depends on"
MonitoringService --> "Pattern Detection" : "composes"
```

**Diagram sources**
- [monitoring.ts](file://packages/audit/src/monitor/monitoring.ts)
- [monitoring-types.ts](file://packages/audit/src/monitor/monitoring-types.ts)

**Section sources**
- [monitoring.ts](file://packages/audit/src/monitor/monitoring.ts#L1-L799)

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
- [monitoring.ts](file://packages/audit/src/monitor/monitoring.ts#L200-L300)
- [metrics-collector.ts](file://packages/audit/src/monitor/metrics-collector.ts#L100-L200)

### Distributed Tracing Implementation
The `AuditTracer` provides distributed tracing capabilities, enabling end-to-end visibility into audit event processing. It supports trace context propagation via HTTP headers and integrates with exporters like Jaeger, Zipkin, and OTLP.

```mermaid
flowchart TD
Start([Start Span]) --> Inject["injectContext(): TraceContext"]
Inject --> Extract["extractContext(headers): TraceContext"]
Extract --> Create["createChildSpan(parent, op)"]
Create --> Log["log(level, message)"]
Log --> Tag["setTag(key, value)"]
Tag --> Finish["finish()"]
Finish --> Export["exportSpan()"]
Export --> Console["Console Exporter"]
Export --> Jaeger["Jaeger Exporter"]
Export --> Zipkin["Zipkin Exporter"]
Export --> OTLP["OTLP Exporter"]
```

**Diagram sources**
- [tracer.ts](file://packages/audit/src/observability/tracer.ts#L1-L426)
- [types.ts](file://packages/audit/src/observability/types.ts#L1-L303)

**Section sources**
- [tracer.ts](file://packages/audit/src/observability/tracer.ts#L1-L426)

## Dependency Analysis
The Worker Service has a layered dependency structure:

```mermaid
graph TD
Worker[Worker Service] --> Audit[@repo/audit]
Audit --> RedisClient[@repo/redis-client]
Audit --> Drizzle[drizzle-orm]
Audit --> IORedis[ioredis]
Worker --> Inngest[inngest]
Worker --> Hono[hono]
Audit --> Zod[zod]
Audit --> Bcrypt[bcrypt]
```

All shared packages are managed via the monorepo's `pnpm-workspace.yaml`, ensuring version consistency and efficient development.

**Diagram sources**
- [package.json](file://apps/worker/package.json)
- [package.json](file://packages/audit/package.json)

**Section sources**
- [package.json](file://apps/worker/package.json)
- [package.json](file://packages/audit/package.json)

## Performance Considerations
The worker is optimized for high-throughput, low-latency processing:

- **Metrics Collection**: Uses Redis atomic operations (INCR, SETEX) for thread-safe updates.
- **Pattern Detection**: Maintains in-memory event buffer with time-based eviction to limit memory usage.
- **Alert Deduplication**: Implements Redis-backed cooldown keys to prevent duplicate alerts.
- **Tracing**: Samples spans based on configurable rate to balance insight and overhead.
- **Health Checks**: Aggregates metrics asynchronously to avoid blocking event processing.

The system is horizontally scalable via Kubernetes, with each worker instance maintaining independent state while sharing Redis and PostgreSQL backends.

## Troubleshooting Guide
Common issues and their resolutions:

- **High Memory Usage**: Caused by unbounded span retention. Solution: Call `tracer.cleanup()` periodically.
- **Duplicate Alerts**: Cooldown keys not persisting. Verify Redis connection and TTL settings.
- **Slow Processing**: Check Redis latency and network connectivity. Optimize pattern detection thresholds.
- **Missing Metrics**: Ensure `RedisMetricsCollector` is properly initialized with a valid Redis connection.
- **Tracing Not Exporting**: Confirm `ObservabilityConfig.tracing.enabled` is true and exporter type is valid.

**Section sources**
- [monitoring.ts](file://packages/audit/src/monitor/monitoring.ts#L500-L600)
- [metrics-collector.ts](file://packages/audit/src/monitor/metrics-collector.ts#L300-L350)
- [tracer.ts](file://packages/audit/src/observability/tracer.ts#L400-L426)

## Conclusion
The Worker Service is a robust, scalable background processor designed for real-time compliance and security monitoring. Its modular architecture, deep observability, and resilience patterns make it well-suited for mission-critical audit processing.

By leveraging Redis for metrics, PostgreSQL for persistent alert storage, and Inngest for orchestration, the service achieves high availability and operational transparency. Future enhancements could include ML-based anomaly detection and integration with SIEM systems.

The codebase demonstrates strong separation of concerns, extensive testing, and clear extensibility points through pluggable alert handlers and metrics collectors.