# Architecture Documentation

This document provides a comprehensive overview of the `@smedrec/audit-client` architecture, including system design, request flows, error handling, plugin system, and caching strategies.

## Table of Contents

- [System Architecture](#system-architecture)
- [Request Flow](#request-flow)
- [Error Handling Flow](#error-handling-flow)
- [Plugin System](#plugin-system)
- [Cache Strategy](#cache-strategy)

## System Architecture

The audit client follows a layered architecture with clear separation of concerns:

```mermaid
graph TB
    subgraph "Client Layer"
        AC[AuditClient]
        AC --> PM[PerformanceMonitor]
        AC --> PL[PluginLoader]
    end

    subgraph "Service Layer"
        ES[EventsService]
        CS[ComplianceService]
        MS[MetricsService]
        SRS[ScheduledReportsService]
        DS[DeliveryService]
        PS[PresetsService]
    end

    subgraph "Core Layer"
        BR[BaseResource]
        HC[HttpClient]
        BR --> HC
    end

    subgraph "Infrastructure Layer"
        AM[AuthManager]
        CM[CacheManager]
        RM[RetryManager]
        CB[CircuitBreaker]
        IM[InterceptorManager]
        RM --> CB
    end

    subgraph "Utilities"
        IS[InputSanitizer]
        LH[LoggingHelper]
        SM[SensitiveDataMasker]
    end

    AC --> ES
    AC --> CS
    AC --> MS
    AC --> SRS
    AC --> DS
    AC --> PS

    ES --> BR
    CS --> BR
    MS --> BR
    SRS --> BR
    DS --> BR
    PS --> BR

    HC --> AM
    HC --> CM
    HC --> RM
    HC --> IM

    BR --> IS
    BR --> LH
    IM --> SM

    style AC fill:#e1f5ff
    style BR fill:#fff4e1
    style HC fill:#fff4e1
    style AM fill:#f0f0f0
    style CM fill:#f0f0f0
    style RM fill:#f0f0f0
```

### Component Responsibilities

#### Client Layer

- **AuditClient**: Main entry point, orchestrates services, manages lifecycle
- **PerformanceMonitor**: Tracks metrics and enforces performance budgets
- **PluginLoader**: Lazy loads plugins on-demand

#### Service Layer

- **EventsService**: Manages audit events (CRUD, streaming, subscriptions)
- **ComplianceService**: Handles compliance reports and validation
- **MetricsService**: Provides analytics and metrics
- **ScheduledReportsService**: Manages scheduled report generation
- **DeliveryService**: Handles report delivery mechanisms
- **PresetsService**: Manages configuration presets

#### Core Layer

- **BaseResource**: Base class for all services, provides common functionality
- **HttpClient**: Handles all HTTP operations (requests, responses, headers)

#### Infrastructure Layer

- **AuthManager**: Manages authentication (API keys, tokens, cookies)
- **CacheManager**: Implements caching with LRU eviction
- **RetryManager**: Handles retry logic with exponential backoff
- **CircuitBreaker**: Prevents cascading failures
- **InterceptorManager**: Manages request/response interceptors

#### Utilities

- **InputSanitizer**: Sanitizes user input to prevent injection attacks
- **LoggingHelper**: Centralizes logging patterns
- **SensitiveDataMasker**: Masks sensitive data in logs

## Request Flow

This diagram shows the complete lifecycle of an API request:

```mermaid
sequenceDiagram
    participant Client
    participant Service
    participant BaseResource
    participant HttpClient
    participant Interceptors
    participant AuthManager
    participant CacheManager
    participant RetryManager
    participant API

    Client->>Service: create(input)
    Service->>Service: InputSanitizer.sanitize(input)
    Service->>Service: validate(input)
    Service->>BaseResource: request(endpoint, options)

    BaseResource->>CacheManager: get(cacheKey)
    alt Cache Hit
        CacheManager-->>BaseResource: cached response
        BaseResource-->>Service: response
        Service-->>Client: result
    else Cache Miss
        BaseResource->>Interceptors: beforeRequest(options)
        Interceptors-->>BaseResource: modified options

        BaseResource->>HttpClient: request(url, options)
        HttpClient->>AuthManager: getAuthHeaders()
        AuthManager-->>HttpClient: headers

        HttpClient->>HttpClient: buildHeaders()
        HttpClient->>HttpClient: buildBody()

        HttpClient->>RetryManager: executeWithRetry()

        loop Retry Attempts
            RetryManager->>API: fetch(url, options)
            alt Success
                API-->>RetryManager: response
                RetryManager-->>HttpClient: response
            else Transient Error
                API-->>RetryManager: error
                RetryManager->>RetryManager: wait(backoff)
            else Circuit Open
                RetryManager-->>HttpClient: CircuitBreakerError
            end
        end

        HttpClient->>HttpClient: parseResponse()
        HttpClient-->>BaseResource: parsed response

        BaseResource->>Interceptors: afterResponse(response)
        Interceptors-->>BaseResource: modified response

        BaseResource->>CacheManager: set(cacheKey, response)
        BaseResource-->>Service: response
        Service-->>Client: result
    end
```

### Request Flow Steps

1. **Input Sanitization**: Remove potentially malicious content
2. **Validation**: Ensure input meets schema requirements
3. **Cache Check**: Look for cached response
4. **Request Interceptors**: Modify request before sending
5. **Authentication**: Add auth headers
6. **Retry Logic**: Handle transient failures with backoff
7. **Response Parsing**: Parse response based on content type
8. **Response Interceptors**: Modify response after receiving
9. **Cache Storage**: Store successful responses
10. **Return Result**: Return to caller

## Error Handling Flow

This diagram illustrates how errors are handled and recovered:

```mermaid
graph TD
    Start[Request Initiated] --> Sanitize[Input Sanitization]
    Sanitize --> Validate[Input Validation]
    Validate -->|Invalid| VE[ValidationError]
    Validate -->|Valid| Execute[Execute Request]

    Execute --> Network{Network Call}
    Network -->|Timeout| TE[TimeoutError]
    Network -->|Network Failure| NE[NetworkError]
    Network -->|Success| Status{HTTP Status}

    Status -->|200-299| Success[Success Response]
    Status -->|400| BadRequest[ValidationError]
    Status -->|401| Auth[AuthenticationError]
    Status -->|403| Forbidden[HttpError + Guidance]
    Status -->|404| NotFound[HttpError + Resource Type]
    Status -->|429| RateLimit[HttpError + Retry-After]
    Status -->|500-599| ServerError[HttpError + Server Guidance]

    TE --> Retry{Retry?}
    NE --> Retry
    RateLimit --> Retry
    ServerError --> Retry

    Retry -->|Yes| Backoff[Exponential Backoff]
    Backoff --> CircuitCheck{Circuit Open?}
    CircuitCheck -->|No| Execute
    CircuitCheck -->|Yes| CBE[CircuitBreakerError]

    Retry -->|No| Error[Throw Error]

    Auth --> TokenRefresh{Token Refresh?}
    TokenRefresh -->|Yes| RefreshToken[Refresh Token]
    RefreshToken --> Execute
    TokenRefresh -->|No| Error

    BadRequest --> Error
    Forbidden --> Error
    NotFound --> Error
    CBE --> Error
    VE --> Error

    Success --> Cache[Cache Response]
    Cache --> Return[Return to Caller]
    Error --> ErrorHandler[Error Handler]
    ErrorHandler --> UserMessage[User-Friendly Message]
    UserMessage --> ActionableAdvice[Actionable Advice]
    ActionableAdvice --> ReturnError[Return Error]

    style Success fill:#90EE90
    style Error fill:#FFB6C1
    style Retry fill:#FFE4B5
    style Cache fill:#E0E0E0
```

### Error Recovery Strategies

1. **Token Refresh**: Automatically refresh expired authentication tokens
2. **Cache Invalidation**: Clear cache on 401/403 errors
3. **Exponential Backoff**: Wait progressively longer between retries
4. **Circuit Breaker**: Stop requests when failure rate is high
5. **User Guidance**: Provide actionable error messages

### Error Types

- **ValidationError**: Input validation failed
- **AuthenticationError**: Authentication failed (401)
- **HttpError**: HTTP error with status code and guidance
- **TimeoutError**: Request exceeded timeout
- **NetworkError**: Network connectivity issue
- **CircuitBreakerError**: Circuit breaker is open

## Plugin System

The plugin system enables extensibility through lazy-loaded modules:

```mermaid
graph TB
    subgraph "Plugin Lifecycle"
        Request[Plugin Request] --> Loader{PluginLoader}
        Loader -->|Loaded| Cache[Plugin Cache]
        Loader -->|Not Loaded| Import[Dynamic Import]
        Import --> Initialize[Initialize Plugin]
        Initialize --> Register[Register with Manager]
        Register --> Cache
        Cache --> Execute[Execute Plugin]
    end

    subgraph "Plugin Types"
        RP[Request Plugins]
        RSP[Response Plugins]
        EP[Error Plugins]
        LP[Logging Plugins]
        MP[Monitoring Plugins]
    end

    subgraph "Built-in Plugins"
        RLP[Request Logging]
        RSLP[Response Logging]
        PM[Performance Monitor]
        SDM[Sensitive Data Masker]
        CI[Correlation ID]
    end

    Execute --> RP
    Execute --> RSP
    Execute --> EP
    Execute --> LP
    Execute --> MP

    RP --> RLP
    RSP --> RSLP
    MP --> PM
    LP --> SDM
    RP --> CI

    style Request fill:#e1f5ff
    style Execute fill:#90EE90
    style Cache fill:#FFE4B5
```

### Plugin Loading Strategy

```mermaid
sequenceDiagram
    participant Client
    participant PluginLoader
    participant Cache
    participant Module
    participant PluginManager

    Client->>PluginLoader: loadPlugin('request-logging')
    PluginLoader->>Cache: isLoaded('request-logging')?

    alt Already Loaded
        Cache-->>PluginLoader: plugin instance
        PluginLoader-->>Client: plugin
    else Not Loaded
        PluginLoader->>PluginLoader: check loading promises
        alt Currently Loading
            PluginLoader-->>Client: await existing promise
        else Not Loading
            PluginLoader->>Module: import('./plugins/request-logging')
            Module-->>PluginLoader: PluginClass
            PluginLoader->>PluginLoader: new PluginClass()
            PluginLoader->>Cache: store(plugin)
            PluginLoader->>PluginManager: register(plugin)
            PluginLoader-->>Client: plugin
        end
    end
```

### Plugin Benefits

1. **Lazy Loading**: Plugins loaded only when needed
2. **Code Splitting**: Reduces initial bundle size
3. **Extensibility**: Easy to add custom plugins
4. **Isolation**: Plugins don't affect each other
5. **Performance**: Faster initialization

## Cache Strategy

The caching system uses LRU (Least Recently Used) eviction with size limits:

```mermaid
graph TD
    Start[Request] --> CacheCheck{Cache Enabled?}
    CacheCheck -->|No| Execute[Execute Request]
    CacheCheck -->|Yes| Lookup[Cache Lookup]

    Lookup --> Hit{Cache Hit?}
    Hit -->|Yes| Fresh{Fresh?}
    Fresh -->|Yes| UpdateAccess[Update Access Time]
    UpdateAccess --> Return[Return Cached]
    Fresh -->|No| Invalidate[Invalidate Entry]
    Invalidate --> Execute

    Hit -->|No| Execute
    Execute --> Response[Get Response]
    Response --> Cacheable{Cacheable?}

    Cacheable -->|Yes| SizeCheck{Size OK?}
    SizeCheck -->|Yes| Store[Store in Cache]
    SizeCheck -->|No| Evict[LRU Eviction]
    Evict --> Store
    Store --> Return

    Cacheable -->|No| Return

    subgraph "Cache Entry"
        Entry[Cache Entry]
        Entry --> Key[Key]
        Entry --> Value[Value]
        Entry --> Created[Created At]
        Entry --> Expires[Expires At]
        Entry --> LastAccess[Last Accessed]
        Entry --> AccessCount[Access Count]
        Entry --> Tags[Tags]
    end

    style Return fill:#90EE90
    style Execute fill:#FFE4B5
    style Store fill:#E0E0E0
```

### Cache Eviction Strategy

```mermaid
sequenceDiagram
    participant Request
    participant CacheManager
    participant Storage
    participant LRU

    Request->>CacheManager: set(key, value)
    CacheManager->>Storage: getCurrentSize()
    Storage-->>CacheManager: size

    alt Size Within Limit
        CacheManager->>Storage: store(entry)
        Storage-->>CacheManager: success
    else Size At Limit
        CacheManager->>LRU: evictLRU(10%)
        LRU->>Storage: getLRUEntries()
        Storage-->>LRU: entries
        LRU->>Storage: delete(entries)
        Storage-->>LRU: success
        LRU-->>CacheManager: evicted
        CacheManager->>Storage: store(entry)
    else Size Over Limit (Emergency)
        CacheManager->>LRU: evictLRU(toLimit)
        LRU->>Storage: getLRUEntries()
        Storage-->>LRU: entries
        LRU->>Storage: delete(entries)
        Storage-->>LRU: success
        LRU-->>CacheManager: evicted
        CacheManager->>CacheManager: log warning
        CacheManager->>Storage: store(entry)
    end

    CacheManager-->>Request: success
```

### Cache Features

1. **LRU Eviction**: Removes least recently used entries
2. **Size Limits**: Enforces maximum cache size
3. **TTL Support**: Entries expire after configured time
4. **Tag-based Invalidation**: Invalidate related entries
5. **Compression**: Compress large entries
6. **Access Tracking**: Track access patterns for optimization

### Cache Configuration

```typescript
{
  enabled: true,
  ttl: 300000,              // 5 minutes
  maxSize: 100,             // 100 entries
  compression: true,        // Compress large entries
  compressionThreshold: 1024 // 1KB
}
```

### Cache Metrics

- **Hit Rate**: Percentage of requests served from cache
- **Miss Rate**: Percentage of requests requiring API calls
- **Eviction Rate**: Frequency of cache evictions
- **Average Entry Size**: Memory usage per entry
- **Access Patterns**: Most/least accessed entries

## Performance Considerations

### Bundle Size Optimization

- **Lazy Loading**: Plugins loaded on-demand
- **Tree Shaking**: Unused code eliminated
- **Code Splitting**: Features split into chunks
- **Compression**: Gzip/Brotli compression

### Memory Management

- **Cache Size Limits**: Prevent unbounded growth
- **Event Handler Cleanup**: Remove listeners on disconnect
- **Weak References**: Use WeakMap for temporary data
- **Garbage Collection**: Explicit cleanup in destroy()

### Request Optimization

- **Request Deduplication**: Prevent duplicate concurrent requests
- **Connection Pooling**: Reuse HTTP connections
- **Compression**: Compress request/response bodies
- **Batching**: Combine multiple requests

## Security Considerations

### Input Sanitization

- Remove HTML tags and scripts
- Validate URL protocols
- Remove event handlers
- Escape special characters

### Sensitive Data Protection

- Mask sensitive fields in logs
- Secure token storage
- HTTPS enforcement
- CORS configuration

### Timeout Protection

- Request timeouts prevent DoS
- Circuit breaker prevents cascading failures
- Rate limiting on client side
- Resource cleanup on timeout

## Monitoring and Observability

### Performance Metrics

- Request duration (p50, p95, p99)
- Error rates by type
- Cache hit/miss rates
- Memory usage
- Bundle size

### Logging

- Structured logging with correlation IDs
- Log levels (debug, info, warn, error)
- Sensitive data masking
- Request/response logging

### Tracing

- Request ID propagation
- Correlation ID tracking
- Distributed tracing support
- Performance profiling

## Future Enhancements

### Planned Features

1. **Request Batching**: Combine multiple requests
2. **GraphQL Support**: Native GraphQL client
3. **WebSocket Support**: Real-time bidirectional communication
4. **Offline Support**: Queue requests when offline
5. **Service Worker Integration**: Background sync

### Experimental Features

1. **HTTP/3 Support**: QUIC protocol
2. **Edge Caching**: CDN integration
3. **Predictive Prefetching**: ML-based prefetching
4. **Adaptive Retry**: ML-based retry strategies

## References

- [API Reference](./API_REFERENCE.md)
- [Getting Started Guide](./GETTING_STARTED.md)
- [Performance Optimization](./PERFORMANCE_OPTIMIZATION.md)
- [Plugin Architecture](./PLUGIN_ARCHITECTURE.md)
- [Troubleshooting](./TROUBLESHOOTING_AND_FAQ.md)
