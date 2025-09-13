# Observability API

<cite>
**Referenced Files in This Document**   
- [bottleneck-analyzer.ts](file://packages/audit/src/observability/bottleneck-analyzer.ts#L1-L612)
- [observability-api.ts](file://apps/server/src/routes/observability-api.ts#L1-L400)
- [types.ts](file://packages/audit/src/observability/types.ts#L254-L301)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [API Endpoints](#api-endpoints)
3. [Authentication and Security](#authentication-and-security)
4. [Data Retention and Rate Limits](#data-retention-and-rate-limits)
5. [Caching Strategy](#caching-strategy)
6. [Data Collection Mechanism](#data-collection-mechanism)
7. [Error Handling](#error-handling)
8. [Integration Examples](#integration-examples)
9. [Performance Dashboard Structure](#performance-dashboard-structure)
10. [Bottleneck Analysis Implementation](#bottleneck-analysis-implementation)

## Introduction
The Observability API provides comprehensive access to system performance data, tracing information, and bottleneck analysis for the audit system. It enables monitoring of system health, performance metrics, trace spans, and resource utilization through a well-defined REST interface. The API is designed to support operational visibility, performance optimization, and proactive issue detection.

The API is versioned as v1 with no deprecation planned. It serves as the primary interface for retrieving observability data collected through middleware instrumentation and structured logging across the system. The endpoints are protected with JWT authentication and scoped access control.

**Section sources**
- [observability-api.ts](file://apps/server/src/routes/observability-api.ts#L1-L20)

## API Endpoints

### Dashboard Data Endpoint
Retrieves comprehensive system performance metrics and health status.

**URL Pattern**: `GET /api/v1/observability/dashboard`  
**HTTP Method**: GET  
**Authentication**: Required (JWT with `observability:read` scope)  
**Summary**: Get dashboard data  
**Description**: Retrieves current system performance metrics including server, database, and API statistics.

**Response Structure (200 OK)**:
```json
{
  "overview": {
    "totalEvents": 12345,
    "eventsPerSecond": 45.6,
    "averageProcessingTime": 89.2,
    "errorRate": 0.02,
    "uptime": 99.98,
    "systemStatus": "HEALTHY"
  },
  "performance": {
    "throughput": {
      "current": 45.6,
      "peak": 120.0,
      "average": 67.8
    },
    "latency": {
      "p50": 78.5,
      "p95": 189.2,
      "p99": 345.1,
      "max": 1200.0
    },
    "bottlenecks": [
      {
        "component": "Database Query",
        "operation": "db_query",
        "averageTime": 245.6,
        "maxTime": 890.1,
        "minTime": 120.3,
        "percentile95": 456.7,
        "percentile99": 789.2,
        "sampleCount": 150,
        "isBottleneck": true,
        "severity": "HIGH",
        "recommendations": [
          "Add database indexes for frequently queried fields",
          "Consider query optimization and connection pooling"
        ],
        "timestamp": "2023-12-07T10:30:00Z"
      }
    ],
    "resourceUsage": {
      "cpu": 67.8,
      "memory": 45.2,
      "disk": 34.1,
      "network": 12.5
    }
  },
  "health": {
    "components": [
      {
        "name": "Database",
        "status": "HEALTHY",
        "uptime": 99.99,
        "responseTime": 45.6,
        "errorRate": 0.01,
        "throughput": 89.2,
        "lastCheck": "2023-12-07T10:29:55Z"
      }
    ],
    "overallStatus": "HEALTHY",
    "criticalComponents": [],
    "degradedComponents": []
  },
  "alerts": {
    "total": 5,
    "active": 2,
    "acknowledged": 1,
    "resolved": 2,
    "bySeverity": {
      "LOW": 1,
      "MEDIUM": 2,
      "HIGH": 2,
      "CRITICAL": 0
    },
    "byType": {
      "SECURITY": 1,
      "COMPLIANCE": 1,
      "PERFORMANCE": 2,
      "SYSTEM": 1,
      "METRICS": 0
    },
    "recent": [
      {
        "id": "alert-001",
        "severity": "HIGH",
        "title": "High database query latency",
        "timestamp": "2023-12-07T09:15:30Z",
        "component": "Database"
      }
    ]
  },
  "trends": {
    "timeSeries": [
      {
        "timestamp": "2023-12-07T10:25:00Z",
        "eventsProcessed": 2280,
        "processingLatency": 85.2,
        "errorRate": 0.018,
        "queueDepth": 12,
        "cpuUsage": 65.2,
        "memoryUsage": 43.8
      }
    ],
    "trends": {
      "eventsProcessed": {
        "current": 2280,
        "previous": 2150,
        "change": 130,
        "changePercent": 6.05,
        "direction": "up"
      },
      "processingLatency": {
        "current": 89.2,
        "previous": 82.5,
        "change": 6.7,
        "changePercent": 8.12,
        "direction": "up"
      },
      "errorRate": {
        "current": 0.02,
        "previous": 0.018,
        "change": 0.002,
        "changePercent": 11.11,
        "direction": "up"
      },
      "systemLoad": {
        "current": 67.8,
        "previous": 62.3,
        "change": 5.5,
        "changePercent": 8.83,
        "direction": "up"
      }
    }
  },
  "timestamp": "2023-12-07T10:30:00Z"
}
```

**Status Codes**:
- 200: Dashboard data retrieved successfully
- 401: Unauthorized - missing or invalid authentication
- 403: Forbidden - insufficient permissions
- 500: Internal Server Error - failed to retrieve dashboard data

### Enhanced Metrics Endpoint
Retrieves system performance metrics in various formats.

**URL Pattern**: `GET /api/v1/observability/metrics/enhanced`  
**HTTP Method**: GET  
**Authentication**: Required (JWT with `observability:read` scope)  
**Query Parameters**:
- `format`: Response format (`json` or `prometheus`, default: `json`)

**Summary**: Get Enhanced metrics  
**Description**: Retrieves current system performance metrics including server, database, and API statistics.

**Response Structure (200 OK)**:
When `format=json`:
```json
{
  "metrics": {
    "eventProcessingTime": 89.2,
    "eventValidationTime": 45.6,
    "eventHashingTime": 8.9,
    "eventStorageTime": 189.2,
    "queueProcessingTime": 78.5,
    "dbQueryTime": 245.6,
    "redisOperationTime": 12.3
  }
}
```

When `format=prometheus`:
```
# TYPE event_processing_time gauge
event_processing_time 89.2
# TYPE event_validation_time gauge
event_validation_time 45.6
# TYPE event_hashing_time gauge
event_hashing_time 8.9
# TYPE event_storage_time gauge
event_storage_time 189.2
# TYPE queue_processing_time gauge
queue_processing_time 78.5
# TYPE db_query_time gauge
db_query_time 245.6
# TYPE redis_operation_time gauge
redis_operation_time 12.3
```

**Status Codes**:
- 200: Enhanced metrics retrieved successfully
- 401: Unauthorized - missing or invalid authentication
- 403: Forbidden - insufficient permissions
- 500: Internal Server Error - failed to export enhanced metrics

### Bottleneck Analysis Endpoint
Retrieves current system performance bottleneck analysis.

**URL Pattern**: `GET /api/v1/observability/bottlenecks`  
**HTTP Method**: GET  
**Authentication**: Required (JWT with `observability:read` scope)  
**Summary**: Get bottleneck analysis  
**Description**: Retrieves current system performance metrics including server, database, and API statistics.

**Response Structure (200 OK)**:
```json
[
  {
    "component": "Database Query",
    "operation": "db_query",
    "averageTime": 245.6,
    "maxTime": 890.1,
    "minTime": 120.3,
    "percentile95": 456.7,
    "percentile99": 789.2,
    "sampleCount": 150,
    "isBottleneck": true,
    "severity": "HIGH",
    "recommendations": [
      "Add database indexes for frequently queried fields",
      "Consider query optimization and connection pooling"
    ],
    "timestamp": "2023-12-07T10:30:00Z"
  },
  {
    "component": "Event Storage",
    "operation": "store_event",
    "averageTime": 189.2,
    "maxTime": 678.9,
    "minTime": 95.6,
    "percentile95": 345.6,
    "percentile99": 567.8,
    "sampleCount": 200,
    "isBottleneck": true,
    "severity": "MEDIUM",
    "recommendations": [
      "Optimize database writes and consider batch operations"
    ],
    "timestamp": "2023-12-07T10:30:00Z"
  }
]
```

**Status Codes**:
- 200: Bottleneck analysis metrics retrieved successfully
- 401: Unauthorized - missing or invalid authentication
- 403: Forbidden - insufficient permissions
- 500: Internal Server Error - failed to get bottleneck analysis

### Trace Data Endpoint
Retrieves trace spans for a specific trace or active traces.

**URL Pattern**: `GET /api/v1/observability/traces`  
**HTTP Method**: GET  
**Authentication**: Required (JWT with `observability:read` scope)  
**Query Parameters**:
- `traceId`: Optional trace identifier to retrieve specific trace spans

**Summary**: Get trace data  
**Description**: Retrieves current system performance metrics including server, database, and API statistics.

**Response Structure (200 OK)**:
When `traceId` is provided:
```json
[
  {
    "spanId": "span-001",
    "traceId": "trace-001",
    "operationName": "process_event",
    "startTime": 1678901234567,
    "duration": 89.2,
    "tags": {
      "component": "event_processor",
      "event_type": "USER_LOGIN"
    },
    "logs": [
      {
        "timestamp": 1678901234568,
        "fields": {
          "event": "validation_started",
          "user_id": "user-123"
        }
      }
    ],
    "references": []
  }
]
```

When no `traceId` is provided (returns active spans):
```json
[
  {
    "spanId": "span-002",
    "traceId": "trace-002",
    "operationName": "validate_event",
    "startTime": 1678901234570,
    "duration": 45.6,
    "tags": {
      "component": "validator",
      "event_type": "DATA_UPDATE"
    },
    "logs": [],
    "references": []
  }
]
```

**Status Codes**:
- 200: Trace data retrieved successfully
- 401: Unauthorized - missing or invalid authentication
- 403: Forbidden - insufficient permissions
- 500: Internal Server Error - failed to get trace data

### Profiling Results Endpoint
Retrieves detailed profiling results from performance profiling sessions.

**URL Pattern**: `GET /api/v1/observability/profiling`  
**HTTP Method**: GET  
**Authentication**: Required (JWT with `observability:read` scope)  
**Summary**: Get profiling results  
**Description**: Retrieves current system performance metrics including server, database, and API statistics.

**Response Structure (200 OK)**:
```json
[
  {
    "profileId": "profile-123456789",
    "component": "audit-system",
    "operation": "process_audit_event",
    "startTime": 1678901234567,
    "endTime": 1678901234656,
    "duration": 89.2,
    "callStack": [
      {
        "functionName": "processAuditEvent",
        "fileName": "audit-processor.js",
        "lineNumber": 45,
        "columnNumber": 12,
        "duration": 89.2,
        "selfTime": 12.3,
        "children": [
          {
            "functionName": "validateEvent",
            "fileName": "validator.js",
            "lineNumber": 23,
            "columnNumber": 8,
            "duration": 45.6,
            "selfTime": 8.9,
            "children": []
          }
        ]
      }
    ],
    "resourceUsage": {
      "cpu": [12.3, 23.4, 34.5, 45.6, 56.7, 67.8],
      "memory": [1048576, 1179648, 1228800, 1310720, 1392640, 1441792],
      "timestamps": [1678901234567, 1678901234580, 1678901234595, 1678901234610, 1678901234625, 1678901234640]
    },
    "breakdown": {
      "process_audit_event": {
        "count": 1,
        "totalTime": 89.2,
        "averageTime": 89.2,
        "maxTime": 89.2,
        "minTime": 89.2
      },
      "validate_event": {
        "count": 1,
        "totalTime": 45.6,
        "averageTime": 45.6,
        "maxTime": 45.6,
        "minTime": 45.6
      }
    },
    "recommendations": [
      "Operation took over 1 second - consider optimization"
    ],
    "metadata": {
      "sessionId": "profile-123456789",
      "resourceSnapshotCount": 6
    }
  }
]
```

**Status Codes**:
- 200: Profiling results retrieved successfully
- 401: Unauthorized - missing or invalid authentication
- 403: Forbidden - insufficient permissions
- 500: Internal Server Error - failed to get profiling results

**Section sources**
- [observability-api.ts](file://apps/server/src/routes/observability-api.ts#L51-L400)

## Authentication and Security
The Observability API requires authentication via JWT (JSON Web Token) with the `observability:read` scope. This ensures that only authorized users with appropriate permissions can access sensitive performance and tracing data.

Access control is implemented through role-based permissions, with the `/observability/*` endpoints restricted to users with the `admin` role. This security model prevents unauthorized access to system performance data that could potentially reveal implementation details or security vulnerabilities.

The API uses standard HTTP authentication mechanisms with the `Authorization` header containing the Bearer token:
```
Authorization: Bearer <JWT_TOKEN>
```

**Section sources**
- [rest-api.ts](file://apps/server/src/routes/rest-api.ts#L241-L288)

## Data Retention and Rate Limits
The Observability API implements specific data retention policies and rate limiting to ensure system stability and performance.

### Data Retention
- **Trace Data**: Retained for 7 days before archival or deletion
- **Profiling Results**: Limited to the most recent 100 sessions
- **Performance Metrics**: Aggregated and retained according to the configured history retention period
- **Dashboard Data**: Real-time metrics with historical trends maintained according to the dashboard configuration

### Rate Limits
The API enforces rate limiting to prevent abuse and ensure fair usage:
- **Rate Limit**: 100 requests per hour per authenticated user
- **Burst Capacity**: Up to 10 requests can be made in a short burst
- **Rate Limit Headers**: Responses include rate limit information in headers:
  - `X-RateLimit-Limit`: Total number of requests allowed per hour
  - `X-RateLimit-Remaining`: Number of requests remaining in the current window
  - `X-RateLimit-Reset`: Time when the rate limit window resets (Unix timestamp)

When the rate limit is exceeded, the API returns a 429 Too Many Requests status code with details about the rate limiting.

**Section sources**
- [rate-limit.ts](file://apps/server/src/lib/middleware/rate-limit.ts)

## Caching Strategy
The Observability API implements a caching strategy to improve performance and reduce load on backend services. The caching approach varies by endpoint:

- **Dashboard Data**: Cached for 30 seconds to balance freshness with performance
- **Enhanced Metrics**: No caching for real-time metrics, but Prometheus format responses are optimized for scraping
- **Bottleneck Analysis**: Cached for 1 minute as analysis results don't change frequently
- **Trace Data**: No caching to ensure trace retrieval is always up-to-date
- **Profiling Results**: No caching as these represent real-time profiling sessions

The cache uses an in-memory store with LRU (Least Recently Used) eviction policy to manage memory usage. Cache keys are generated based on the request parameters and user context to ensure data isolation between users.

**Section sources**
- [cache-factory.ts](file://packages/audit-db/src/cache/cache-factory.ts)

## Data Collection Mechanism
The observability data is collected through a combination of middleware instrumentation and structured logging throughout the system.

### Middleware Instrumentation
Key components are instrumented with monitoring middleware that automatically captures performance metrics:

- **Request Processing**: Measures end-to-end request duration
- **Database Operations**: Tracks query execution time and resource usage
- **Event Processing**: Monitors event validation, hashing, and storage times
- **Queue Operations**: Records message processing latency

The middleware uses the OpenTelemetry standard for tracing, creating spans that represent discrete units of work. Each span includes metadata about the operation, start time, duration, and relationships to other spans.

### Structured Logging
All system components use structured logging with a consistent format that includes:
- Timestamp
- Component identifier
- Operation name
- Duration metrics
- Status (success/failure)
- Error details (when applicable)
- Correlation IDs for tracing

These logs are processed and aggregated to generate the performance metrics and analytics available through the API.

**Section sources**
- [middleware.ts](file://packages/audit/src/observability/middleware.ts)

## Error Handling
The Observability API implements comprehensive error handling to provide meaningful feedback while maintaining system security.

### Error Response Structure
```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "Failed to get dashboard data"
}
```

### Status Codes
- **200 OK**: Request successful
- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error during request processing
- **503 Service Unavailable**: Dependent service not initialized

Error details are logged on the server with request context (request ID, user ID) for troubleshooting, but only generic error messages are exposed in the API response to prevent information disclosure.

**Section sources**
- [unified-handler.ts](file://apps/server/src/lib/errors/unified-handler.ts)

## Integration Examples

### cURL Examples

**Retrieve Dashboard Data**:
```bash
curl -X GET "https://api.example.com/api/v1/observability/dashboard" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xJ..." \
  -H "Content-Type: application/json"
```

**Retrieve Enhanced Metrics in Prometheus Format**:
```bash
curl -X GET "https://api.example.com/api/v1/observability/metrics/enhanced?format=prometheus" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xJ..."
```

**Retrieve Trace Data by Trace ID**:
```bash
curl -X GET "https://api.example.com/api/v1/observability/traces?traceId=trace-001" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xJ..." \
  -H "Content-Type: application/json"
```

**Generate Dashboard for Audit Pipeline**:
```bash
curl -X GET "https://api.example.com/api/v1/observability/dashboard" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xJ..." \
  | jq '.trends.timeSeries | .[] | select(.timestamp > "2023-12-07T00:00:00Z")' \
  > audit-pipeline-dashboard.json
```

### Frontend Integration
The API can be integrated with frontend visualization tools using standard HTTP clients:

```javascript
// Example using fetch API
async function getDashboardData() {
  const response = await fetch('/api/v1/observability/dashboard', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// Example using the data with a charting library
getDashboardData().then(data => {
  // Update charts with performance metrics
  updateLatencyChart(data.performance.latency);
  updateThroughputChart(data.performance.throughput);
  updateBottlenecksList(data.performance.bottlenecks);
});
```

**Section sources**
- [observability-api.ts](file://apps/server/src/routes/observability-api.ts#L250-L400)

## Performance Dashboard Structure
The performance dashboard data structure is designed to provide a comprehensive view of system health and performance metrics.

```mermaid
classDiagram
class DashboardData {
+overview : OverviewMetrics
+performance : PerformanceMetrics
+health : HealthMetrics
+alerts : AlertMetrics
+trends : TrendMetrics
+timestamp : string
}
class OverviewMetrics {
+totalEvents : number
+eventsPerSecond : number
+averageProcessingTime : number
+errorRate : number
+uptime : number
+systemStatus : string
}
class PerformanceMetrics {
+throughput : ThroughputMetrics
+latency : LatencyMetrics
+bottlenecks : BottleneckAnalysis[]
+resourceUsage : ResourceUsageMetrics
}
class HealthMetrics {
+components : ComponentHealth[]
+overallStatus : string
+criticalComponents : string[]
+degradedComponents : string[]
}
class AlertMetrics {
+total : number
+active : number
+acknowledged : number
+resolved : number
+bySeverity : SeverityCount
+byType : TypeCount
+recent : RecentAlert[]
}
class TrendMetrics {
+timeSeries : TimeSeriesPoint[]
+trends : TrendAnalysis
}
class BottleneckAnalysis {
+component : string
+operation : string
+averageTime : number
+maxTime : number
+minTime : number
+percentile95 : number
+percentile99 : number
+sampleCount : number
+isBottleneck : boolean
+severity : string
+recommendations : string[]
+timestamp : string
}
DashboardData --> OverviewMetrics : "contains"
DashboardData --> PerformanceMetrics : "contains"
DashboardData --> HealthMetrics : "contains"
DashboardData --> AlertMetrics : "contains"
DashboardData --> TrendMetrics : "contains"
PerformanceMetrics --> BottleneckAnalysis : "contains"
```

**Diagram sources**
- [observability-api.ts](file://apps/server/src/routes/observability-api.ts#L10-L145)

## Bottleneck Analysis Implementation
The bottleneck analysis is implemented through the `AuditBottleneckAnalyzer` class, which identifies performance bottlenecks based on operation metrics and predefined thresholds.

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "Observability API"
participant Analyzer as "BottleneckAnalyzer"
participant Metrics as "Performance Metrics"
Client->>API : GET /observability/bottlenecks
API->>Analyzer : getBottleneckAnalysis()
Analyzer->>Metrics : retrievePerformanceMetrics()
Metrics-->>Analyzer : PerformanceMetrics
Analyzer->>Analyzer : identifyBottlenecks(metrics)
Analyzer->>Analyzer : determineSeverity()
Analyzer->>Analyzer : generateRecommendations()
Analyzer-->>API : BottleneckAnalysis[]
API-->>Client : 200 OK + analysis data
Note over Analyzer,API : Analysis based on thresholds<br/>and statistical patterns
```

The analyzer uses predefined performance thresholds for different operation types:

```mermaid
flowchart TD
Start([Start Analysis]) --> RetrieveMetrics["Retrieve Performance Metrics"]
RetrieveMetrics --> CheckEventProcessing{"Event Processing > 500ms?"}
CheckEventProcessing --> |Yes| CriticalEventProcessing["Severity: CRITICAL"]
CheckEventProcessing --> |No| CheckEventValidation{"Event Validation > 200ms?"}
CheckEventValidation --> |Yes| CriticalEventValidation["Severity: CRITICAL"]
CheckEventValidation --> |No| CheckEventHashing{"Event Hashing > 50ms?"}
CheckEventHashing --> |Yes| CriticalEventHashing["Severity: CRITICAL"]
CheckEventHashing --> |No| CheckEventStorage{"Event Storage > 1000ms?"}
CheckEventStorage --> |Yes| CriticalEventStorage["Severity: CRITICAL"]
CheckEventStorage --> |No| CheckQueueProcessing{"Queue Processing > 500ms?"}
CheckQueueProcessing --> |Yes| CriticalQueueProcessing["Severity: CRITICAL"]
CheckQueueProcessing --> |No| CheckDBQuery{"Database Query > 500ms?"}
CheckDBQuery --> |Yes| CriticalDBQuery["Severity: CRITICAL"]
CheckDBQuery --> |No| CheckRedis{"Redis Operation > 50ms?"}
CheckRedis --> |Yes| CriticalRedis["Severity: CRITICAL"]
CheckRedis --> |No| CalculateSeverity["Calculate Severity Based on<br/>Average Time, Error Rate, etc."]
CalculateSeverity --> GenerateRecommendations["Generate Recommendations"]
GenerateRecommendations --> ReturnResults["Return Bottleneck Analysis"]
CriticalEventProcessing --> GenerateRecommendations
CriticalEventValidation --> GenerateRecommendations
CriticalEventHashing --> GenerateRecommendations
CriticalEventStorage --> GenerateRecommendations
CriticalQueueProcessing --> GenerateRecommendations
CriticalDBQuery --> GenerateRecommendations
CriticalRedis --> GenerateRecommendations
```

**Diagram sources**
- [bottleneck-analyzer.ts](file://packages/audit/src/observability/bottleneck-analyzer.ts#L1-L612)

**Section sources**
- [bottleneck-analyzer.ts](file://packages/audit/src/observability/bottleneck-analyzer.ts#L1-L612)