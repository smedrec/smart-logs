# Performance Optimization Features

The Audit Client Library includes comprehensive performance optimization features designed to maximize throughput, minimize latency, and efficiently handle large-scale audit operations. This document covers all performance-related features and how to configure them.

## Overview

The performance optimization system consists of several interconnected components:

- **Request Compression**: Automatically compresses large request payloads
- **Response Streaming**: Handles large responses efficiently with streaming
- **Request Queue Management**: Controls concurrent requests and prevents overload
- **Request Deduplication**: Eliminates duplicate requests automatically
- **Performance Metrics**: Comprehensive monitoring and analytics
- **Bandwidth Optimization**: Various strategies to reduce network usage

## Configuration

### Basic Performance Configuration

```typescript
import { AuditClient } from '@smedrec/audit-client'

const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key',
	},
	performance: {
		enableCompression: true, // Enable request/response compression
		enableStreaming: true, // Enable streaming for large responses
		maxConcurrentRequests: 10, // Maximum concurrent requests
		requestDeduplication: true, // Enable request deduplication
		responseTransformation: true, // Enable response optimization
		metricsCollection: true, // Enable performance metrics
		metricsBufferSize: 1000, // Metrics buffer size
		compressionThreshold: 1024, // Compress requests > 1KB
		streamingThreshold: 10240, // Stream responses > 10KB
	},
})
```

### Advanced Configuration

```typescript
const client = new AuditClient({
	// ... other config
	performance: {
		enableCompression: true,
		enableStreaming: true,
		maxConcurrentRequests: 20,
		requestDeduplication: true,
		responseTransformation: true,
		metricsCollection: true,
		metricsBufferSize: 2000,
		compressionThreshold: 512, // Lower threshold for more compression
		streamingThreshold: 5120, // Lower threshold for more streaming
	},
	cache: {
		enabled: true,
		defaultTtlMs: 300000, // 5 minutes cache
		compressionEnabled: true, // Compress cached data
	},
	retry: {
		enabled: true,
		maxAttempts: 3,
		backoffMultiplier: 2,
	},
})
```

## Features

### 1. Request Compression

Automatically compresses request payloads when they exceed the configured threshold.

#### How it Works

- Monitors request payload size
- Applies gzip compression for text-based content types
- Adds appropriate headers (`Content-Encoding: gzip`)
- Falls back gracefully if compression fails

#### Supported Content Types

- `application/json`
- `application/xml`
- `text/*`
- `application/javascript`
- `application/x-www-form-urlencoded`

#### Example

```typescript
// Large audit event that will be compressed
const largeEvent = {
	action: 'data.export',
	targetResourceType: 'dataset',
	principalId: 'user-123',
	organizationId: 'org-456',
	status: 'success',
	details: {
		// Large data payload
		exportData: 'x'.repeat(5000), // > compressionThreshold
		metadata: {
			/* ... */
		},
	},
}

// This request will be automatically compressed
await client.events.create(largeEvent)
```

### 2. Response Streaming

Efficiently handles large responses by streaming data instead of loading everything into memory.

#### When Streaming is Used

- Response size > `streamingThreshold`
- Content-Type indicates streamable data
- Explicit streaming requested via `responseType: 'stream'`

#### Streamable Content Types

- `application/octet-stream`
- `application/pdf`
- `text/csv`
- `application/zip`
- Large JSON responses

#### Example

```typescript
// Query large dataset - will be streamed automatically
const largeQuery = await client.events.query({
	filter: {
		dateRange: {
			startDate: '2024-01-01T00:00:00Z',
			endDate: '2024-12-31T23:59:59Z',
		},
	},
	pagination: { limit: 10000 }, // Large limit triggers streaming
})

// Manual streaming for custom processing
const response = await fetch('/api/large-export')
const streamReader = client.createStreamReader(response)

await client.processStream(
	streamReader,
	async (chunk) => {
		// Process each chunk
		console.log('Processing chunk:', chunk)
	},
	{
		maxConcurrency: 5,
		bufferSize: 100,
		onProgress: (processed) => console.log(`Processed: ${processed}`),
	}
)
```

### 3. Request Queue Management

Controls the number of concurrent requests to prevent server overload and manage client-side resources.

#### Features

- Configurable concurrency limits
- Priority-based request queuing
- Automatic queue processing
- Request timeout handling
- Queue statistics and monitoring

#### Priority Levels

The system automatically assigns priorities based on request type:

- **Priority 10**: Health checks (`/health`, `/ready`)
- **Priority 5**: Write operations (POST, PUT, DELETE)
- **Priority 3**: Audit events (`/audit/events`)
- **Priority 1**: Read operations (GET)

#### Example

```typescript
// Get queue manager for advanced control
const performanceManager = client.getPerformanceManager()
const queueManager = performanceManager.getQueueManager()

// Add high-priority request
await queueManager.enqueue(() => client.events.create(criticalEvent), { priority: 10 })

// Monitor queue status
const stats = queueManager.getStats()
console.log({
	activeRequests: stats.activeRequests,
	queuedRequests: stats.queuedRequests,
	averageWaitTime: stats.averageWaitTime,
})
```

### 4. Request Deduplication

Automatically eliminates duplicate requests to reduce server load and improve response times.

#### How it Works

- Generates unique keys based on endpoint, method, body, and query parameters
- Caches pending requests
- Returns cached promise for identical requests
- Configurable TTL for deduplication cache

#### Example

```typescript
// These identical requests will be deduplicated
const promises = Array.from({ length: 5 }, () =>
	client.events.query({
		filter: { actions: ['user.login'] },
		pagination: { limit: 10 },
	})
)

// Only one actual HTTP request is made
const results = await Promise.all(promises)
// All results are identical
```

### 5. Performance Metrics

Comprehensive monitoring and analytics for all performance-related operations.

#### Collected Metrics

- **Request Metrics**: Count, duration, success/error rates
- **Bandwidth Metrics**: Bytes transferred, compression ratios
- **Queue Metrics**: Active requests, wait times, throughput
- **Cache Metrics**: Hit rates, efficiency
- **Deduplication Metrics**: Duplicate request elimination

#### Example

```typescript
// Get comprehensive performance statistics
const stats = client.getPerformanceStats()

console.log('Performance Report:', {
	// Request metrics
	totalRequests: stats.metrics.requestCount,
	averageResponseTime: stats.metrics.averageDuration,
	successRate: stats.metrics.successCount / stats.metrics.requestCount,

	// Efficiency metrics
	compressionRatio: stats.metrics.compressionRatio,
	cacheHitRate: stats.metrics.cacheHitRate,

	// Queue performance
	queueEfficiency: stats.queue.completedRequests / stats.queue.totalRequests,
	averageWaitTime: stats.queue.averageWaitTime,
})

// Reset metrics for next measurement period
client.resetPerformanceTracking()
```

### 6. Bandwidth Optimization

Various strategies to minimize network usage and improve transfer efficiency.

#### Optimization Strategies

- **Compression**: Reduces payload sizes
- **Caching**: Eliminates redundant requests
- **Deduplication**: Prevents duplicate network calls
- **Streaming**: Reduces memory usage for large transfers
- **Request Batching**: Combines multiple operations (where supported)

## Best Practices

### 1. Configuration Tuning

```typescript
// For high-throughput scenarios
const highThroughputConfig = {
	performance: {
		maxConcurrentRequests: 20, // Higher concurrency
		compressionThreshold: 256, // Aggressive compression
		requestDeduplication: true, // Eliminate duplicates
		metricsCollection: true, // Monitor performance
	},
	cache: {
		enabled: true,
		defaultTtlMs: 600000, // 10-minute cache
		compressionEnabled: true,
	},
}

// For memory-constrained environments
const lowMemoryConfig = {
	performance: {
		maxConcurrentRequests: 5, // Lower concurrency
		streamingThreshold: 1024, // Stream smaller responses
		metricsBufferSize: 100, // Smaller metrics buffer
	},
}
```

### 2. Monitoring and Alerting

```typescript
// Set up performance monitoring
setInterval(() => {
	const stats = client.getPerformanceStats()

	// Alert on high error rates
	const errorRate = stats.metrics.errorCount / stats.metrics.requestCount
	if (errorRate > 0.05) {
		// 5% error rate
		console.warn('High error rate detected:', errorRate)
	}

	// Alert on high queue wait times
	if (stats.queue.averageWaitTime > 5000) {
		// 5 seconds
		console.warn('High queue wait times:', stats.queue.averageWaitTime)
	}

	// Alert on low cache hit rates
	if (stats.metrics.cacheHitRate < 0.3) {
		// 30% hit rate
		console.warn('Low cache hit rate:', stats.metrics.cacheHitRate)
	}
}, 60000) // Check every minute
```

### 3. Error Handling

```typescript
try {
	await client.events.bulkCreate(largeEventBatch)
} catch (error) {
	if (error.message.includes('queue')) {
		// Handle queue-related errors
		console.log('Request queued, retrying...')
		await new Promise((resolve) => setTimeout(resolve, 1000))
		// Retry logic
	} else if (error.message.includes('compression')) {
		// Handle compression errors
		console.log('Compression failed, sending uncompressed...')
		// Fallback to uncompressed request
	}
}
```

### 4. Performance Testing

```typescript
// Performance test function
async function performanceTest() {
	const client = new AuditClient(config)
	const startTime = Date.now()

	// Generate test load
	const requests = Array.from({ length: 100 }, (_, i) =>
		client.events.create({
			action: 'test.action',
			principalId: `user-${i}`,
			organizationId: 'test-org',
			status: 'success',
		})
	)

	await Promise.all(requests)

	const duration = Date.now() - startTime
	const stats = client.getPerformanceStats()

	console.log('Performance Test Results:', {
		duration: `${duration}ms`,
		throughput: `${((requests.length / duration) * 1000).toFixed(2)} req/sec`,
		averageResponseTime: `${stats.metrics.averageDuration}ms`,
		compressionRatio: `${(stats.metrics.compressionRatio * 100).toFixed(1)}%`,
	})
}
```

## Troubleshooting

### Common Issues

#### High Memory Usage

```typescript
// Reduce memory usage
const config = {
	performance: {
		streamingThreshold: 1024, // Stream smaller responses
		metricsBufferSize: 100, // Smaller metrics buffer
		maxConcurrentRequests: 3, // Lower concurrency
	},
}
```

#### Slow Response Times

```typescript
// Optimize for speed
const config = {
	performance: {
		enableCompression: true, // Reduce transfer time
		requestDeduplication: true, // Eliminate duplicates
		maxConcurrentRequests: 15, // Higher concurrency
	},
	cache: {
		enabled: true,
		defaultTtlMs: 300000, // Cache responses
	},
}
```

#### Network Errors

```typescript
// Robust network handling
const config = {
	retry: {
		enabled: true,
		maxAttempts: 5, // More retry attempts
		backoffMultiplier: 1.5, // Gentler backoff
	},
	performance: {
		maxConcurrentRequests: 5, // Lower load on server
	},
}
```

## API Reference

### PerformanceManager

```typescript
interface PerformanceManager {
	getCompressionManager(): CompressionManager
	getStreamingManager(): StreamingManager
	getQueueManager(): RequestQueueManager
	getMetricsCollector(): PerformanceMetricsCollector
	getDeduplicationManager(): RequestDeduplicationManager
	getStats(): PerformanceStats
	reset(): void
	updateConfig(config: Partial<PerformanceConfig>): void
}
```

### Performance Metrics

```typescript
interface PerformanceMetrics {
	requestCount: number
	totalDuration: number
	averageDuration: number
	minDuration: number
	maxDuration: number
	successCount: number
	errorCount: number
	bytesTransferred: number
	compressionRatio: number
	concurrentRequests: number
	queuedRequests: number
	cacheHitRate: number
	timestamp: number
}
```

### Configuration Options

```typescript
interface PerformanceConfig {
	enableCompression: boolean
	enableStreaming: boolean
	maxConcurrentRequests: number
	requestDeduplication: boolean
	responseTransformation: boolean
	metricsCollection: boolean
	metricsBufferSize: number
	compressionThreshold: number
	streamingThreshold: number
}
```

For more examples and advanced usage, see the [Performance Examples](../examples/performance-optimization.ts) file.
