# Metrics Collection

<cite>
**Referenced Files in This Document**   
- [metrics-collector.ts](file://packages\audit\src\observability\metrics-collector.ts) - *Updated with enhanced OTLP exporter and KMS encryption*
- [tracer.ts](file://packages\audit\src\observability\tracer.ts) - *Enhanced OTLP exporter with batch processing and authentication*
- [types.ts](file://packages\audit\src\observability\types.ts) - *Updated ObservabilityConfig interface*
- [otpl-configuration.md](file://packages\audit\docs\observability\otpl-configuration.md) - *OTLP configuration guide*
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts) - *Monitoring service implementation with AlertingService integration*
- [otpl.ts](file://packages\logs\src\otpl.ts) - *OTLP logging implementation*
- [metrics-collector.ts](file://packages\audit\src\monitor\metrics-collector.ts) - *Updated with structured logging integration*
- [preset-types.ts](file://packages\audit\src\preset\preset-types.ts) - *Database preset handler integration*
- [alerting.ts](file://packages\audit\src\monitor\alerting.ts) - *AlertingService implementation extracted from MonitoringService*
</cite>

## Update Summary
**Changes Made**   
- Updated documentation to reflect integration of enhanced OTLP exporter with KMS encryption
- Added details on batch processing, error handling, and authentication mechanisms
- Enhanced section on integration with monitoring systems to include OTLP capabilities
- Updated configuration options to include OTLP-specific settings
- Added new diagram for OTLP export workflow
- Updated test validation section to reflect new export capabilities
- Integrated structured logging system into metrics collection framework
- Updated metrics collector implementations to support enhanced logging capabilities
- Added documentation for database preset handler integration and detailed phase timing metrics
- Documented the refactoring of alert handling functionality to the AlertingService class
- Updated references to alert statistics and active alerts methods to reflect their delegation to AlertingService

## Table of Contents
1. [Metrics Collection System Overview](#metrics-collection-system-overview)
2. [Core Metrics Collector Implementation](#core-metrics-collector-implementation)
3. [Metric Types and Structure](#metric-types-and-structure)
4. [Tagging and Dimensional Analysis](#tagging-and-dimensional-analysis)
5. [Integration with Monitoring Systems](#integration-with-monitoring-systems)
6. [Configuration Options](#configuration-options)
7. [Testing and Validation](#testing-and-validation)
8. [Best Practices for Monitoring and Alerting](#best-practices-for-monitoring-and-alerting)

## Metrics Collection System Overview

The Metrics Collection system is a comprehensive observability framework designed to capture key performance indicators across the audit pipeline. It provides real-time monitoring of event throughput, processing latency, error rates, and system resource utilization. The system is built around two primary implementations: the basic `RedisMetricsCollector` for core monitoring needs and the enhanced `RedisEnhancedMetricsCollector` for comprehensive observability.

The metrics collection system serves as the foundation for monitoring service health, enabling teams to establish baselines, detect anomalies, and set up proactive alerting. It integrates seamlessly with the broader monitoring ecosystem, providing data for dashboards, alerting systems, and compliance reporting. Recent updates have enhanced the system with KMS encryption and an improved OTLP exporter with robust batch processing and error handling capabilities. The system now records detailed timing for validation, hashing, pseudonymization, and storage phases, providing granular insights into audit pipeline performance.

A significant architectural change has been implemented with the refactoring of alert handling functionality. The `MonitoringService` class now delegates alert-related operations to a dedicated `AlertingService` class, improving separation of concerns and maintainability. This refactoring allows for more focused development and testing of alerting functionality while keeping the core monitoring service streamlined.

**Section sources**
- [metrics-collector.ts](file://packages\audit\src\observability\metrics-collector.ts#L1-L50) - *Updated in recent commit*
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts#L1-L50)
- [alerting.ts](file://packages\audit\src\monitor\alerting.ts#L1-L20) - *Extracted alert handling functionality*

## Core Metrics Collector Implementation

The core metrics collection functionality is implemented through the `RedisEnhancedMetricsCollector` class, which provides a robust interface for capturing and storing performance data. This implementation uses Redis as the primary storage backend, leveraging its high-performance characteristics for real-time metrics collection.

```mermaid
classDiagram
class EnhancedMetricsCollector {
<<interface>>
+recordPerformanceMetrics() : Promise~void~
+getPerformanceMetrics() : Promise~PerformanceMetrics~
+collectSystemMetrics() : Promise~SystemMetrics~
+recordSystemMetrics() : Promise~void~
+recordOperation() : Promise~void~
+getOperationMetrics() : Promise~AuditOperationMetrics[]~
+getDashboardMetrics() : Promise~DashboardMetrics~
+recordComponentHealth() : Promise~void~
+getComponentHealth() : Promise~ComponentHealthMetrics[]~
+recordTimeSeriesData() : Promise~void~
+getTimeSeriesData() : Promise~TimeSeriesMetrics[]~
+cleanup() : Promise~void~
+exportMetrics() : Promise~string~
}
class RedisEnhancedMetricsCollector {
-keyPrefix : string
-connection : RedisType
-isSharedConnection : boolean
-monitor : MonitoringService
-config : ObservabilityConfig['metrics']
+constructor(monitor, config, redisOrUrlOrOptions?, directConnectionOptions?)
+recordPerformanceMetrics() : Promise~void~
+getPerformanceMetrics() : Promise~PerformanceMetrics~
+collectSystemMetrics() : Promise~SystemMetrics~
+recordSystemMetrics() : Promise~void~
+recordOperation() : Promise~void~
+getOperationMetrics() : Promise~AuditOperationMetrics[]~
+getDashboardMetrics() : Promise~DashboardMetrics~
+recordComponentHealth() : Promise~void~
+getComponentHealth() : Promise~ComponentHealthMetrics[]~
+recordTimeSeriesData() : Promise~void~
+getTimeSeriesData() : Promise~TimeSeriesMetrics[]~
+cleanup() : Promise~void~
+exportMetrics() : Promise~string~
+formatPrometheusMetrics() : string
+startPeriodicCollection() : void
}
EnhancedMetricsCollector <|.. RedisEnhancedMetricsCollector : implements
```

**Diagram sources**
- [metrics-collector.ts](file://packages\audit\src\observability\metrics-collector.ts#L25-L200) - *Updated in recent commit*

**Section sources**
- [metrics-collector.ts](file://packages\audit\src\observability\metrics-collector.ts#L1-L200) - *Updated in recent commit*

## Metric Types and Structure

The metrics collection system supports multiple metric types to capture different aspects of system performance and behavior. These include counters, gauges, and histograms, each serving specific monitoring purposes.

### Counter Metrics
Counters are used to track the number of occurrences of specific events. They are monotonically increasing and reset only when the system restarts or metrics are explicitly reset.

```mermaid
flowchart TD
Start([Increment Counter]) --> ValidateInput["Validate Input Parameters"]
ValidateInput --> InputValid{"Input Valid?"}
InputValid --> |No| ReturnError["Log Error and Return"]
InputValid --> |Yes| BuildKey["Build Metric Key with Labels"]
BuildKey --> Increment["Increment Counter in Redis"]
Increment --> UpdateStats["Update Aggregated Statistics"]
UpdateStats --> End([Counter Incremented])
```

### Gauge Metrics
Gauges represent a single numerical value that can go up and down, such as current queue depth or memory usage.

### Histogram Metrics
Histograms capture the distribution of values, particularly useful for measuring response times and processing latencies.

```mermaid
sequenceDiagram
participant Application as "Application"
participant Monitoring as "MonitoringService"
participant Collector as "MetricsCollector"
participant Redis as "Redis Storage"
Application->>Monitoring : recordHistogram(name, value, labels)
Monitoring->>Monitoring : buildMetricKey(type, name, labels)
Monitoring->>Collector : storeMetric(measurementKey, {timestamp, value, labels}, TTL)
Collector->>Redis : HSET or SET operation
Redis-->>Collector : Operation result
Collector-->>Monitoring : Success or error
Monitoring->>Monitoring : updateHistogramStats(key, value)
Monitoring-->>Application : Promise resolved
```

**Diagram sources**
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts#L1100-L1200)
- [monitoring-types.ts](file://packages\audit\src\monitor\monitoring-types.ts#L1-L50)

**Section sources**
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts#L1100-L1200)
- [monitoring-types.ts](file://packages\audit\src\monitor\monitoring-types.ts#L1-L100)

## Tagging and Dimensional Analysis

The metrics collection system implements a comprehensive tagging mechanism that enables dimensional analysis of performance data. Metrics are tagged by service, component, and status, allowing for detailed filtering and aggregation.

### Tagging Implementation
The `buildMetricKey` method in the `MonitoringService` class is responsible for constructing metric keys with labels. This method sorts labels alphabetically to ensure consistent key generation and prevent duplication.

```typescript
private buildMetricKey(type: string, name: string, labels?: Record<string, string>): string {
    let key = `{type}:${name}`
    
    if (labels) {
        const labelString = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(',')
        key += `:${labelString}`
    }
    
    return key
}
```

### Dimensional Analysis Capabilities
The tagging system supports the following dimensions:

- **Service**: Identifies the specific service generating the metric
- **Component**: Specifies the component within the service
- **Status**: Indicates the operational status (e.g., success, error)
- **Severity**: For alert-related metrics, indicates the severity level
- **Type**: Categorizes the metric type (e.g., security, compliance)

This dimensional approach enables powerful analytical capabilities, such as:
- Comparing performance across different services
- Identifying components with high error rates
- Tracking metrics by severity level for prioritized response
- Analyzing trends for specific metric types

**Section sources**
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts#L1105-L1158)

## Integration with Monitoring Systems

The metrics collection system integrates with various monitoring systems through multiple export mechanisms and API endpoints. This integration enables comprehensive observability across the entire audit pipeline.

### Enhanced OTLP Exporter
The system now features an enhanced OTLP (OpenTelemetry Protocol) exporter with advanced capabilities for sending metrics and traces to observability platforms. The enhanced exporter includes:

- **Batch processing**: Automatic batching of spans for efficient transmission with configurable batch size (default: 100 spans) and timeout-based flushing (default: 5 seconds)
- **Error handling and reliability**: Exponential backoff for retries, rate limiting handling via `Retry-After` headers, circuit breaking for client errors (4xx), and network resilience with up to 3 retry attempts
- **Security features**: KMS encryption integration, multiple authentication methods (Bearer tokens, custom headers), and TLS support for HTTPS endpoints
- **Performance optimizations**: Payload compression for large data, efficient OTLP format with base64 encoding, and automatic cleanup of old spans to prevent memory leaks

```mermaid
sequenceDiagram
participant Application as "Application"
participant Tracer as "AuditTracer"
participant Batch as "Span Batch"
participant OTLP as "OTLP Exporter"
participant Endpoint as "Observability Endpoint"
Application->>Tracer : startSpan(operationName)
Tracer->>Tracer : Create AuditSpan with traceId/spanId
Application->>Tracer : Add tags/logs to span
Tracer->>Batch : addToBatch(span)
Batch->>Batch : Check batch size >= 100?
Batch-->>Batch : Yes : flushBatch()
Batch-->>Batch : No : Set timeout 5s
Batch->>OTLP : flushBatch()
OTLP->>OTLP : createOTLPPayload(spans)
OTLP->>OTLP : Add auth headers (Bearer token/custom header)
OTLP->>OTLP : Compress payload if >1KB
OTLP->>Endpoint : sendSpansToOTLP() with exponential backoff
Endpoint-->>OTLP : Response (200 OK or error)
alt Success
OTLP-->>Batch : Success logged at debug level
else Rate Limited (429)
OTLP->>OTLP : Respect Retry-After header
OTLP->>OTLP : Wait and retry with exponential backoff
else Client Error (4xx)
OTLP->>OTLP : Fail fast (circuit breaking)
else Network Error
OTLP->>OTLP : Retry up to 3 times with exponential backoff
end
```

**Diagram sources**
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L304-L406) - *Enhanced OTLP exporter with batch processing*
- [otpl.ts](file://packages\logs\src\otpl.ts#L84-L129) - *OTLP logging with error handling*

### Export Formats
The system supports multiple export formats to accommodate different monitoring backends:

- **Prometheus**: Exposes metrics in Prometheus text format for scraping
- **Console**: Outputs metrics to console for debugging and development
- **OTLP**: Sends metrics and traces to any OTLP-compatible observability platform (Jaeger, Grafana Tempo, DataDog, etc.)
- **Custom**: Allows integration with proprietary monitoring systems

```mermaid
graph TB
subgraph "Metrics Collection"
MC[Metrics Collector]
end
subgraph "Export Mechanisms"
P[Prometheus Exporter]
C[Console Exporter]
O[OTLP Exporter]
X[Custom Exporter]
end
subgraph "Monitoring Systems"
PM[Prometheus]
GF[Grafana]
EL[Elasticsearch]
KI[Kibana]
JT[Jaeger]
GT[Grafana Tempo]
DD[DataDog]
NR[New Relic]
end
MC --> P
MC --> C
MC --> O
MC --> X
P --> PM
P --> GF
C --> EL
C --> KI
O --> JT
O --> GT
O --> DD
O --> NR
X --> External[External Monitoring System]
```

**Diagram sources**
- [types.ts](file://packages\audit\src\observability\types.ts#L268-L302)
- [metrics-api.ts](file://apps\server\src\routes\metrics-api.ts#L308-L360)

### API Integration
The system exposes metrics through REST API endpoints, enabling integration with external monitoring tools and dashboards.

```mermaid
sequenceDiagram
participant Client as "Monitoring Client"
participant API as "Metrics API"
participant Router as "Metrics Router"
participant Service as "Monitoring Service"
participant Collector as "Metrics Collector"
Client->>API : GET /api/metrics/system
API->>Router : Route request
Router->>Service : getSystemMetrics()
Service->>Collector : getMetrics()
Collector-->>Service : Metrics data
Service-->>Router : System metrics
Router-->>API : Response
API-->>Client : JSON response with metrics
```

**Diagram sources**
- [metrics-api.ts](file://apps\server\src\routes\metrics-api.ts#L308-L360)
- [metrics.ts](file://apps\server\src\routers\metrics.ts#L1-L38)

**Section sources**
- [types.ts](file://packages\audit\src\observability\types.ts#L268-L302)
- [metrics-api.ts](file://apps\server\src\routes\metrics-api.ts#L308-L360)
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L264-L358) - *OTLP export implementation*
- [otpl-configuration.md](file://packages\audit\docs\observability\otlp-configuration.md) - *OTLP configuration guide*

## Configuration Options

The metrics collection system provides extensive configuration options to customize behavior based on deployment requirements and performance considerations.

### Configuration Structure
The `ObservabilityConfig` interface defines all configurable parameters for the metrics collector:

```typescript
export interface ObservabilityConfig {
    // Tracing configuration
    tracing: {
        enabled: boolean
        serviceName: string
        sampleRate: number
        exporterType: 'console' | 'jaeger' | 'zipkin' | 'otlp'
        exporterEndpoint?: string
        headers?: Record<string, string>
    }
    
    // Metrics configuration
    metrics: {
        enabled: boolean
        collectionInterval: number
        retentionPeriod: number
        exporterType: 'prometheus' | 'console' | 'custom'
        exporterEndpoint?: string
    }
    
    // Profiling configuration
    profiling: {
        enabled: boolean
        sampleRate: number
        maxProfiles: number
        profileDuration: number
    }
    
    // Dashboard configuration
    dashboard: {
        enabled: boolean
        refreshInterval: number
        historyRetention: number
    }
}
```

### Key Configuration Parameters

**Sampling Configuration**
- **sampleRate**: Controls the percentage of events to sample (e.g., 0.1 for 10% sampling)
- Reduces overhead in high-throughput environments while maintaining statistical accuracy

**Aggregation Intervals**
- **collectionInterval**: Specifies how frequently metrics are aggregated (in milliseconds)
- Default: 1000ms (1 second)
- Adjustable based on monitoring requirements and system load

**Retention Period**
- **retentionPeriod**: Determines how long metrics are retained in storage (in seconds)
- Default: 3600 seconds (1 hour)
- Configurable to balance storage requirements with historical analysis needs

**Export Formats and Endpoints**
- **exporterType**: Specifies the output format for metrics
  - 'prometheus': Exposes metrics in Prometheus format
  - 'console': Outputs to console for debugging
  - 'custom': Enables integration with custom monitoring systems
  - 'otlp': Sends metrics to OTLP-compatible observability platforms
- **exporterEndpoint**: Specifies the destination endpoint for exported metrics (required for 'otlp' exporter)

**OTLP-Specific Configuration**
- **Authentication**: Configured via environment variables:
  - `OTLP_API_KEY`: Bearer token authentication
  - `OTLP_AUTH_HEADER`: Custom header authentication (e.g., "X-API-Key: your-key")
- **Batch Processing**: Configurable parameters:
  - `BATCH_SIZE`: Default 100 spans per batch
  - `BATCH_TIMEOUT_MS`: Default 5000ms (5 seconds) for timeout-based flushing
- **Error Handling**: Automatic exponential backoff with up to 3 retry attempts and respect for `Retry-After` headers

**Section sources**
- [types.ts](file://packages\audit\src\observability\types.ts#L268-L302)
- [index.ts](file://packages\audit\src\observability\index.ts#L48-L69)
- [otpl-configuration.md](file://packages\audit\docs\observability\otlp-configuration.md#L1-L282) - *OTLP configuration details*

## Testing and Validation

The metrics collection system includes comprehensive test coverage to ensure reliability and correctness of metric emission and validation.

### Test Scenarios
The `metrics-collector.test.ts` file contains test cases that validate various aspects of the metrics collection functionality:

```mermaid
flowchart TD
Start([Test Suite]) --> RecordPerformance["recordPerformanceMetrics"]
Start --> GetPerformance["getPerformanceMetrics"]
Start --> CollectSystem["collectSystemMetrics"]
Start --> RecordOperation["recordOperation"]
Start --> GetOperation["getOperationMetrics"]
Start --> RecordHealth["recordComponentHealth"]
Start --> RecordTimeSeries["recordTimeSeriesData"]
RecordPerformance --> ValidateRedis["Validate Redis hset calls"]
GetPerformance --> ValidateDefaults["Validate default values"]
CollectSystem --> ValidateRange["Validate CPU/Memory ranges"]
RecordOperation --> ValidateStructure["Validate operation structure"]
GetOperation --> ValidateParsing["Validate JSON parsing"]
RecordHealth --> ValidateHealth["Validate health metrics"]
RecordTimeSeries --> ValidateTTL["Validate time-based retention"]
```

### Example Test Case
```typescript
describe('recordPerformanceMetrics', () => {
    it('should record performance metrics to Redis', async () => {
        const metrics = {
            eventProcessingTime: 100,
            eventValidationTime: 50,
            queueDepth: 10,
        }
        
        await collector.recordPerformanceMetrics(metrics)
        
        expect(mockRedis.hset).toHaveBeenCalledWith(
            'audit:observability:performance',
            expect.objectContaining({
                eventProcessingTime: '100',
                eventValidationTime: '50',
                queueDepth: '10',
            })
        )
        expect(mockRedis.expire).toHaveBeenCalled()
    })
})
```

The tests validate that:
- Metrics are correctly stored in Redis with appropriate keys
- Data types are properly serialized and deserialized
- Default values are returned when no data exists
- Time-to-live (TTL) settings are applied correctly
- Aggregated statistics are updated appropriately
- OTLP export functionality handles authentication, batching, and error scenarios correctly

**Section sources**
- [metrics-collector.test.ts](file://packages\audit\src\observability\__tests__\metrics-collector.test.ts#L1-L200)
- [tracer.test.ts](file://packages\audit\src\observability\__tests__\tracer.test.ts#L1-L150) - *OTLP exporter tests*

## Best Practices for Monitoring and Alerting

The metrics collection system supports best practices for monitoring service health and establishing effective alerting thresholds based on observed baselines.

### Alert Threshold Configuration
The system includes default alert thresholds based on industry best practices:

```typescript
export const DEFAULT_DASHBOARD_CONFIG = {
    alertThresholds: {
        errorRate: 0.05, // 5% error rate threshold
        latency: 1000, // 1 second maximum latency
        throughput: 100, // 100 events per second minimum
    },
    components: ['audit-processor', 'database', 'redis', 'queue', 'monitoring', 'health-check'],
}
```

### Monitoring Best Practices

**Establish Baselines**
- Monitor system behavior during normal operations to establish performance baselines
- Use historical data to set realistic thresholds
- Account for expected variations (e.g., daily, weekly patterns)

**Set Appropriate Thresholds**
- **Error Rate**: Alert when error rate exceeds 5% of total requests
- **Latency**: Trigger alerts when average processing latency exceeds 1 second
- **Throughput**: Alert on significant deviations from expected event processing rates
- **Resource Utilization**: Monitor CPU, memory, and storage usage with tiered alerts

**Implement Tiered Alerting**
- **Warning**: For issues that require attention but don't impact service
- **High**: For problems affecting performance or user experience
- **Critical**: For outages or severe degradation requiring immediate response

**Use Dimensional Analysis**
- Analyze metrics across different dimensions (service, component, status)
- Compare current performance against historical baselines
- Identify patterns and correlations between different metrics

**Regular Review and Tuning**
- Periodically review alert thresholds and adjust based on system evolution
- Eliminate false positives and refine alerting rules
- Document alerting logic and response procedures

```mermaid
graph TD
A[Monitor System] --> B{Establish Baseline}
B --> C[Collect Historical Data]
C --> D[Analyze Patterns]
D --> E[Set Initial Thresholds]
E --> F[Deploy Monitoring]
F --> G{Alert Triggered?}
G --> |No| H[Continue Monitoring]
G --> |Yes| I[Evaluate Alert Severity]
I --> J{Within Tolerance?}
J --> |Yes| K[Log for Review]
J --> |No| L[Trigger Response]
L --> M[Notify Team]
M --> N[Investigate Issue]
N --> O[Resolve Problem]
O --> P[Update Thresholds if Needed]
P --> F
```

**Section sources**
- [index.ts](file://packages\audit\src\observability\index.ts#L59-L68)
- [monitoring.ts](file://packages\audit\src\monitor\monitoring.ts#L535-L582)
- [otpl-configuration.md](file://packages\audit\docs\observability\otpl-configuration.md#L245-L282) - *Best practices for OTLP configuration*