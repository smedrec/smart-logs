# OTLP HTTP Exporter Configuration Guide

This guide explains how to configure and use the OTLP HTTP exporter for sending distributed traces to observability platforms.

## Overview

The OTLP (OpenTelemetry Protocol) HTTP exporter allows you to send trace data to any OTLP-compatible observability backend such as:

- **Jaeger** (with OTLP endpoint)
- **Grafana Tempo**
- **DataDog** (with OTLP support)
- **New Relic**
- **AWS X-Ray** (via OTEL Collector)
- **Honeycomb**
- **Lightstep**
- **OpenObserve**

## Configuration

### Basic Configuration

```typescript
import { AuditTracer } from '@repo/audit'

const tracer = new AuditTracer({
  enabled: true,
  serviceName: 'audit-system',
  sampleRate: 1.0, // Sample 100% of traces (reduce for production)
  exporterType: 'otlp',
  exporterEndpoint: 'https://your-observability-platform.com/v1/traces'
})
```

### Environment Variables

Set these environment variables for authentication:

```bash
# Bearer token authentication
OTLP_API_KEY=your-api-key-here

# Or custom header authentication
OTLP_AUTH_HEADER="X-API-Key: your-api-key"
OTLP_AUTH_HEADER="Authorization: Basic base64credentials"
```

### Platform-Specific Examples

#### Jaeger with OTLP
```typescript
const config = {
  enabled: true,
  serviceName: 'audit-system',
  sampleRate: 0.1, // 10% sampling for production
  exporterType: 'otlp' as const,
  exporterEndpoint: 'http://jaeger-collector:14268/api/traces'
}
```

#### Grafana Tempo
```typescript
const config = {
  enabled: true,
  serviceName: 'audit-system',
  sampleRate: 0.1,
  exporterType: 'otlp' as const,
  exporterEndpoint: 'https://tempo-us-central1.grafana.net/tempo/v1/traces'
}

// Set environment variable:
// OTLP_AUTH_HEADER="Authorization: Basic base64(username:password)"
```

#### DataDog
```typescript
const config = {
  enabled: true,
  serviceName: 'audit-system',
  sampleRate: 0.1,
  exporterType: 'otlp' as const,
  exporterEndpoint: 'https://trace.agent.datadoghq.com/v1/traces'
}

// Set environment variable:
// OTLP_API_KEY=your-datadog-api-key
```

#### OpenObserve
```typescript
const config = {
  enabled: true,
  serviceName: 'audit-system',
  sampleRate: 0.1,
  exporterType: 'otlp' as const,
  exporterEndpoint: 'https://your-org.observe.com/api/default/traces'
}

// Set environment variable:
// OTLP_AUTH_HEADER="Authorization: Basic base64(username:password)"
```

#### Honeycomb
```typescript
const config = {
  enabled: true,
  serviceName: 'audit-system',
  sampleRate: 0.1,
  exporterType: 'otlp' as const,
  exporterEndpoint: 'https://api.honeycomb.io/v1/traces/your-dataset'
}

// Set environment variable:
// OTLP_API_KEY=your-honeycomb-api-key
```

## Usage Example

```typescript
import { AuditTracer } from '@repo/audit'

// Initialize tracer with OTLP configuration
const tracer = new AuditTracer({
  enabled: true,
  serviceName: 'audit-system',
  sampleRate: 0.1, // 10% sampling
  exporterType: 'otlp',
  exporterEndpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'
})

// Create and finish spans
async function processAuditEvent(eventData: any) {
  const span = tracer.startSpan('process-audit-event')
  
  try {
    span.setTags({
      'event.type': eventData.type,
      'event.size': eventData.size,
      'user.id': eventData.userId
    })

    // Simulate processing
    await processEvent(eventData)
    
    span.setStatus('OK')
  } catch (error) {
    span.setStatus('ERROR', error.message)
    span.log('error', 'Processing failed', { error: error.message })
    throw error
  } finally {
    tracer.finishSpan(span)
  }
}

// Cleanup on shutdown
process.on('SIGTERM', () => {
  tracer.cleanup() // Flushes pending batches
})
```

## Features

### Batch Processing
- **Automatic batching**: Spans are automatically batched for efficient transmission
- **Configurable batch size**: Default 100 spans per batch
- **Timeout-based flushing**: Batches are flushed every 5 seconds
- **Immediate flushing**: Large batches are sent immediately

### Error Handling & Reliability
- **Exponential backoff**: Automatic retry with increasing delays
- **Rate limiting handling**: Respects `Retry-After` headers
- **Circuit breaking**: Fails fast for client errors (4xx)
- **Network resilience**: Retries network failures up to 3 times

### Performance Optimizations
- **Compression support**: Automatic compression for large payloads (future feature)
- **Efficient encoding**: Proper OTLP format with base64 encoding
- **Memory management**: Automatic cleanup of old spans

### Security
- **Multiple auth methods**: Bearer tokens, custom headers
- **TLS support**: HTTPS endpoints supported by default
- **Credential management**: Environment variable-based configuration

## Monitoring and Debugging

### Debug Logging
Enable debug logging to troubleshoot issues:

```typescript
// Successful exports log at debug level
console.debug(`Successfully exported 45 spans to OTLP`)

// Errors are logged at error level
console.error('Failed to export spans to OTLP:', error)
```

### Health Checks
Monitor the health of your OTLP exports:

```typescript
// Check if spans are being generated
const activeSpans = tracer.getActiveSpans()
console.log(`Active spans: ${activeSpans.length}`)

// Monitor span batching
const tracesForEvent = tracer.getTraceSpans(traceId)
console.log(`Spans in trace: ${tracesForEvent.length}`)
```

## Best Practices

### Production Configuration
1. **Use appropriate sampling rates** (0.01-0.1 for high traffic)
2. **Set resource limits** to prevent memory issues
3. **Monitor export success rates** 
4. **Use HTTPS endpoints** for security
5. **Implement proper authentication**

### Performance Tuning
1. **Batch size**: Adjust based on your traffic patterns
2. **Sampling**: Higher rates for debugging, lower for production
3. **Flush intervals**: Balance between latency and efficiency
4. **Cleanup intervals**: Prevent memory leaks

### Security Considerations
1. **Use environment variables** for sensitive configuration
2. **Rotate API keys** regularly
3. **Use HTTPS** for all endpoints
4. **Limit trace data** sensitivity

## Troubleshooting

### Common Issues

#### 1. Endpoint Not Reachable
```
Error: Failed after 3 attempts: 503 Service Unavailable
```
**Solution**: Check network connectivity and endpoint URL

#### 2. Authentication Failures
```
Error: Client error: 401 Unauthorized
```
**Solution**: Verify API key and authentication method

#### 3. Rate Limiting
```
Error: Client error: 429 Too Many Requests
```
**Solution**: Reduce sampling rate or increase batch intervals

#### 4. Large Payload Issues
```
Error: Client error: 413 Payload Too Large
```
**Solution**: Reduce batch size or enable compression

### Debugging Steps
1. Enable debug logging
2. Check environment variables
3. Verify endpoint accessibility
4. Test with minimal configuration
5. Monitor network traffic

## Migration from Console/Jaeger

If you're currently using console or Jaeger exporters:

```typescript
// From this:
const oldConfig = {
  exporterType: 'console' // or 'jaeger'
}

// To this:
const newConfig = {
  exporterType: 'otlp',
  exporterEndpoint: 'https://your-platform.com/v1/traces'
}
```

The span format and API remain the same - only the export destination changes.