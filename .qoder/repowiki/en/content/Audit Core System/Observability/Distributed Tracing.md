# Distributed Tracing

<cite>
**Referenced Files in This Document**   
- [tracer.ts](file://packages\audit\src\observability\tracer.ts) - *Updated to enable OTLP exporter with batch processing, authentication, and KMS integration*
- [types.ts](file://packages\audit\src\observability\types.ts) - *Contains updated tracing and observability type definitions*
- [tracer.test.ts](file://packages\audit\src\observability\__tests__\tracer.test.ts) - *Updated test coverage for OTLP functionality*
- [otlp-configuration.md](file://packages\audit\docs\observability\otlp-configuration.md) - *New documentation for OTLP configuration*
- [crypto.ts](file://packages\audit\src\crypto.ts) - *KMS encryption support for trace data*
</cite>

## Update Summary
**Changes Made**   
- Updated integration section to reflect OTLP as primary exporter with batch processing and KMS encryption
- Added details on authentication header usage, retry mechanisms, and KMS integration
- Removed outdated console exporter references
- Enhanced performance analysis section with batch processing and compression details
- Updated diagram to reflect current export workflow with security features

## Table of Contents
1. [Introduction](#introduction)
2. [Core Tracing Components](#core-tracing-components)
3. [Trace Context Propagation](#trace-context-propagation)
4. [Integration with External APM Tools](#integration-with-external-apm-tools)
5. [Trace Context Preservation in Asynchronous Operations](#trace-context-preservation-in-asynchronous-operations)
6. [Performance Analysis and Bottleneck Identification](#performance-analysis-and-bottleneck-identification)
7. [Trace Data Interpretation and Correlation](#trace-data-interpretation-and-correlation)

## Introduction
The Distributed Tracing system in the audit event processing workflow provides end-to-end visibility across microservices, enabling comprehensive monitoring of audit events from creation to archival. This documentation details the implementation of the tracer module, which creates and propagates trace IDs, span contexts, and parent-child relationships throughout the system. The tracing infrastructure supports integration with external Application Performance Monitoring (APM) tools through OpenTelemetry standards, with a focus on OTLP (OpenTelemetry Protocol) as the primary export mechanism. The system captures detailed performance metrics, error information, and execution context, which can be used to identify bottlenecks, debug complex failures, and measure latency across distributed components.

## Core Tracing Components

The distributed tracing implementation consists of several key components that work together to provide comprehensive visibility into audit event processing workflows. At the core is the `AuditTracer` class, which implements the `Tracer` interface and manages the lifecycle of spans throughout the system. Each span represents a logical unit of work with a defined start and end time, allowing for precise measurement of operation duration.

```mermaid
classDiagram
class Tracer {
<<interface>>
+startSpan(operationName : string, parentContext? : TraceContext) : Span
+finishSpan(span : Span) : void
+injectContext(span : Span) : TraceContext
+extractContext(headers : Record<string, string>) : TraceContext | null
+createChildSpan(parentSpan : Span, operationName : string) : Span
}
class Span {
<<interface>>
+traceId : string
+spanId : string
+parentSpanId? : string
+operationName : string
+startTime : number
+endTime? : number
+duration? : number
+tags : Record<string, any>
+logs : SpanLog[]
+status : SpanStatus
+component : string
+setTag(key : string, value : any) : void
+setTags(tags : Record<string, any>) : void
+log(level : 'debug'|'info'|'warn'|'error', message : string, fields? : Record<string, any>) : void
+setStatus(code : 'OK'|'ERROR'|'TIMEOUT'|'CANCELLED', message? : string) : void
+finish() : void
}
class AuditSpan {
+traceId : string
+spanId : string
+parentSpanId? : string
+operationName : string
+startTime : number
+endTime? : number
+duration? : number
+tags : Record<string, any>
+logs : SpanLog[]
+status : SpanStatus
+component : string
+setTag(key : string, value : any) : void
+setTags(tags : Record<string, any>) : void
+log(level : 'debug'|'info'|'warn'|'error', message : string, fields? : Record<string, any>) : void
+setStatus(code : 'OK'|'ERROR'|'TIMEOUT'|'CANCELLED', message? : string) : void
+finish() : void
-generateTraceId() : string
-generateSpanId() : string
}
class AuditTracer {
-spans : Map<string, Span>
-config : ObservabilityConfig['tracing']
-activeSpans : Map<string, Span>
+startSpan(operationName : string, parentContext? : TraceContext) : Span
+finishSpan(span : Span) : void
+injectContext(span : Span) : TraceContext
+extractContext(headers : Record<string, string>) : TraceContext | null
+createChildSpan(parentSpan : Span, operationName : string) : Span
+getTraceSpans(traceId : string) : Span[]
+getActiveSpans() : Span[]
-exportSpan(span : Span) : void
-exportToConsole(span : Span) : void
-exportToJaeger(span : Span) : void
-exportToZipkin(span : Span) : void
-exportToOTLP(span : Span) : void
+cleanup() : void
}
Tracer <|.. AuditTracer : implements
Span <|.. AuditSpan : implements
AuditTracer --> AuditSpan : creates
AuditTracer --> Span : manages
```

**Section sources**
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L1-L676) - *Updated implementation with OTLP exporter*
- [types.ts](file://packages\audit\src\observability\types.ts#L1-L303) - *Type definitions for tracing components*

## Trace Context Propagation

The tracing system implements robust context propagation mechanisms to maintain trace continuity across service boundaries and asynchronous operations. The `TraceContext` interface defines the essential elements that must be preserved when propagating traces: `traceId`, `spanId`, and optional `parentSpanId`. This context can be extracted from HTTP headers using the `extractContext` method, which recognizes both standard and custom header formats (`x-trace-id`, `traceid`, etc.).

When a service receives a request with trace context, it uses this information to create child spans that maintain the parent-child relationship within the trace. The `createChildSpan` method automatically inherits the trace ID from the parent span while generating a new span ID, establishing the hierarchical relationship. This approach ensures that all operations within a distributed workflow are linked together, forming a complete trace tree that can be reconstructed for analysis.

```mermaid
sequenceDiagram
participant Client as "Client Application"
participant ServiceA as "Audit Service"
participant ServiceB as "Database Service"
participant ServiceC as "Notification Service"
Client->>ServiceA : POST /audit-events (x-trace-id : abc123)
ServiceA->>ServiceA : extractContext(headers)
ServiceA->>ServiceA : startSpan("process-audit-event")
ServiceA->>ServiceB : Query Database (x-trace-id : abc123, x-span-id : def456)
ServiceB->>ServiceB : extractContext(headers)
ServiceB->>ServiceB : createChildSpan(parentSpan, "database-query")
ServiceB-->>ServiceA : Query Results
ServiceA->>ServiceC : Send Notification (x-trace-id : abc123, x-span-id : ghi789)
ServiceC->>ServiceC : extractContext(headers)
ServiceC->>ServiceC : createChildSpan(parentSpan, "send-notification")
ServiceC-->>ServiceA : Confirmation
ServiceA-->>Client : 201 Created
Note over ServiceA,ServiceC : Complete trace with parent-child relationships<br/>across service boundaries
```

**Section sources**
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L1-L676) - *Context propagation implementation*
- [types.ts](file://packages\audit\src\observability\types.ts#L1-L303) - *TraceContext interface definition*

## Integration with External APM Tools

The tracing system now primarily supports integration with external APM tools through the OTLP (OpenTelemetry Protocol) exporter, replacing the previous console exporter as the default. The `ObservabilityConfig` interface defines the configuration options for tracing, including the `exporterType` which can be set to 'otlp' for OpenTelemetry-compatible backends. When configured for OTLP export, the system formats trace data according to the OpenTelemetry specification, enabling seamless integration with platforms like Grafana Tempo, DataDog, and Honeycomb.

The `exportToOTLP` method implements batch processing for efficient transmission, with spans collected in batches of up to 100 or flushed every 5 seconds. The implementation includes robust retry logic with exponential backoff, handling up to 3 retry attempts with increasing delays. It also respects rate limiting via `Retry-After` headers and distinguishes between client errors (4xx) that should not be retried and server/network errors that warrant retry attempts. Authentication is supported through environment variables (`OTLP_API_KEY` for Bearer tokens or `OTLP_AUTH_HEADER` for custom headers). Additionally, KMS encryption support has been integrated to secure trace data during transmission.

```mermaid
flowchart TD
A["Audit Event Processing"] --> B["Create Span"]
B --> C["Add Tags and Logs"]
C --> D["Configure OTLP Exporter"]
D --> E["Add to Batch"]
E --> F{"Batch Full or Timeout?"}
F --> |Yes| G["Flush Batch to OTLP"]
F --> |No| H["Wait for Next Trigger"]
G --> I{"Export Successful?"}
I --> |Yes| J["Success: Debug Log"]
I --> |Rate Limited| K["Backoff: Use Retry-After"]
I --> |Client Error| L["Fail Fast: 4xx Errors"]
I --> |Network Error| M["Retry: Exponential Backoff"]
K --> N["Wait and Retry"]
L --> O["Log Error"]
M --> N
N --> G
J --> P["External APM Tool"]
O --> P
P --> Q["Visualization and Analysis"]
style G fill:#f9f,stroke:#333
style I fill:#f9f,stroke:#333
style N fill:#f9f,stroke:#333
```

**Section sources**
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L1-L676) - *OTLP exporter with batch processing and retry logic*
- [types.ts](file://packages\audit\src\observability\types.ts#L1-L303) - *Configuration interface for OTLP*
- [otlp-configuration.md](file://packages\audit\docs\observability\otlp-configuration.md) - *Detailed OTLP configuration guide*
- [crypto.ts](file://packages\audit\src\crypto.ts#L127-L174) - *KMS encryption integration for trace data*

## Trace Context Preservation in Asynchronous Operations

The tracer implementation includes comprehensive test coverage for trace context preservation across asynchronous operations and service boundaries, as demonstrated in the `tracer.test.ts` file. The tests verify that when a parent span is created and used to generate a child span, the trace ID is properly inherited while a new span ID is generated, maintaining the hierarchical relationship. This is critical for accurately representing the call flow in distributed systems where operations may execute concurrently or with delays.

The `trace` decorator provides an automated mechanism for creating spans around method executions, handling both successful completions and exceptions. When a decorated method completes successfully, the span status is set to 'OK'; when an exception occurs, the span status is set to 'ERROR' with the error message, and an error log entry is added with the stack trace. This automatic error handling ensures that failures are properly captured in the trace data, making it easier to diagnose issues in production environments.

```mermaid
sequenceDiagram
participant Test as "Test Case"
participant Decorator as "trace Decorator"
participant Method as "Decorated Method"
participant Tracer as "AuditTracer"
Test->>Decorator : Call decorated method
Decorator->>Tracer : startSpan("method-name")
Tracer-->>Decorator : Span object
Decorator->>Method : Execute original method
alt Method succeeds
Method-->>Decorator : Return result
Decorator->>Decorator : span.setStatus('OK')
else Method throws error
Method-->>Decorator : Throw error
Decorator->>Decorator : span.setStatus('ERROR', message)
Decorator->>Decorator : span.log('error', message, {stack})
end
Decorator->>Tracer : finishSpan(span)
Tracer->>Tracer : exportSpan(span)
Decorator-->>Test : Return result or re-throw error
Note over Decorator,Tracer : Automatic span management<br/>for synchronous and asynchronous methods
```

**Section sources**
- [tracer.test.ts](file://packages\audit\src\observability\__tests__\tracer.test.ts#L1-L216) - *Test coverage for trace context preservation*
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L1-L676) - *trace decorator implementation*

## Performance Analysis and Bottleneck Identification

The tracing data collected by the system serves as a foundation for performance analysis and bottleneck identification. Each span captures detailed timing information, including start time, end time, and calculated duration, which can be aggregated to identify operations with high latency. The system supports sampling based on the configured `sampleRate`, allowing organizations to balance the overhead of tracing with the need for comprehensive data collection.

The `BottleneckAnalysis` interface, defined in the types, provides a structured approach to identifying performance issues, including metrics such as average time, maximum time, 95th and 99th percentiles, and sample count. These metrics can be used to detect operations that are consistently slow or exhibit high variance in execution time. The severity level (LOW, MEDIUM, HIGH, CRITICAL) helps prioritize remediation efforts, while recommendations provide actionable guidance for improving performance. The batch processing implementation in the OTLP exporter also contributes to performance optimization by reducing the number of HTTP requests and improving network efficiency.

```mermaid
flowchart TD
A["Collect Span Data"] --> B["Aggregate by Operation"]
B --> C["Calculate Performance Metrics"]
C --> D["Compute: Average, Max, Min, P95, P99"]
D --> E["Identify Candidates for Analysis"]
E --> F{"Exceed Thresholds?"}
F --> |Yes| G["Flag as Potential Bottleneck"]
F --> |No| H["Monitor as Baseline"]
G --> I["Analyze Call Stack and Dependencies"]
I --> J["Generate Recommendations"]
J --> K["Report to Dashboard"]
K --> L["Alert if Critical"]
style G fill:#f96,stroke:#333
style J fill:#f96,stroke:#333
style K fill:#f96,stroke:#333
style L fill:#f96,stroke:#333
```

**Section sources**
- [types.ts](file://packages\audit\src\observability\types.ts#L1-L303) - *BottleneckAnalysis interface*
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L1-L676) - *Performance metrics collection and export*

## Trace Data Interpretation and Correlation

Interpreting trace data effectively requires correlating traces with logs and metrics to gain a comprehensive understanding of system behavior. The tracing system facilitates this correlation through several mechanisms. Each span includes a `traceId` that can be used to search across log entries, allowing developers to find all log messages associated with a specific trace. The span logs capture structured data with levels, messages, and additional fields, providing context about events that occurred during the span's execution.

When analyzing trace data, it's important to filter relevant spans based on criteria such as operation name, service name, duration, or error status. For example, filtering for spans with duration greater than a threshold can quickly identify slow operations. Similarly, filtering for spans with error status can help diagnose failure patterns. The hierarchical nature of spans, with parent-child relationships, enables navigation from high-level service calls down to individual database queries or external API calls, providing both breadth and depth of visibility.

```mermaid
graph TD
A["Trace Data"] --> B["Filter Spans"]
B --> C["By Operation Name"]
B --> D["By Duration"]
B --> E["By Error Status"]
B --> F["By Service Name"]
A --> G["Correlate with Logs"]
G --> H["Use traceId to find logs"]
G --> I["Examine span logs"]
A --> J["Correlate with Metrics"]
J --> K["Match traceId to metrics"]
J --> L["Analyze performance trends"]
A --> M["Visualize Trace Tree"]
M --> N["View parent-child relationships"]
M --> O["Identify critical path"]
M --> P["Find parallel operations"]
style C fill:#bbf,stroke:#333
style D fill:#bbf,stroke:#333
style E fill:#bbf,stroke:#333
style F fill:#bbf,stroke:#333
style H fill:#bbf,stroke:#333
style I fill:#bbf,stroke:#333
style K fill:#bbf,stroke:#333
style L fill:#bbf,stroke:#333
```

**Section sources**
- [tracer.ts](file://packages\audit\src\observability\tracer.ts#L1-L676) - *Trace data correlation mechanisms*
- [types.ts](file://packages\audit\src\observability\types.ts#L1-L303) - *Data structures for trace interpretation*