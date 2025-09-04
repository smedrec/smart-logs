# Infrastructure Layer

This directory contains the core infrastructure components that provide advanced functionality for the audit client library.

## RetryManager

The `RetryManager` provides robust retry mechanisms with exponential backoff, jitter, and circuit breaker patterns for resilient API interactions.

### Features

- **Exponential Backoff with Jitter**: Prevents thundering herd problems by adding randomization to retry delays
- **Circuit Breaker Pattern**: Automatically stops retrying failing services to prevent cascading failures
- **Configurable Retry Policies**: Customize retry behavior based on error types and status codes
- **Request Context Tracking**: Maintains context information for debugging and monitoring
- **Performance Monitoring**: Tracks retry statistics and circuit breaker states

### Usage

```typescript
import { RetryManager } from './infrastructure/retry'

import type { RetryConfig } from './core/config'

// Configure retry behavior
const retryConfig: RetryConfig = {
	enabled: true,
	maxAttempts: 3,
	initialDelayMs: 1000,
	maxDelayMs: 30000,
	backoffMultiplier: 2,
	retryableStatusCodes: [408, 429, 500, 502, 503, 504],
	retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
}

// Create retry manager
const retryManager = new RetryManager(retryConfig)

// Execute operation with retry logic
const result = await retryManager.execute(
	async () => {
		// Your API call here
		const response = await fetch('/api/data')
		if (!response.ok) {
			throw new HttpError(response.status, response.statusText)
		}
		return response.json()
	},
	{
		endpoint: '/api/data',
		requestId: 'unique-request-id',
		method: 'GET',
	}
)
```

### Circuit Breaker

The circuit breaker automatically opens when a service fails repeatedly, preventing further requests until a recovery timeout expires.

```typescript
// Configure circuit breaker
const circuitBreakerConfig = {
	enabled: true,
	failureThreshold: 5, // Open after 5 failures
	recoveryTimeoutMs: 60000, // Wait 1 minute before trying again
	monitoringWindowMs: 300000, // Monitor failures over 5 minutes
	minimumRequestThreshold: 10, // Need at least 10 requests before opening
}

const retryManager = new RetryManager(retryConfig, circuitBreakerConfig)

// Check circuit breaker status
const stats = retryManager.getCircuitBreakerStats('/api/service:GET')
console.log(`Circuit breaker state: ${stats?.state}`)

// Reset circuit breaker manually
retryManager.resetCircuitBreaker('/api/service:GET')
```

### Error Classification

The retry manager intelligently classifies errors to determine retry behavior:

- **HTTP Errors**: Retries based on configurable status codes (default: 408, 429, 5xx)
- **Network Errors**: Retries connection issues (ECONNRESET, ETIMEDOUT, etc.)
- **Timeout Errors**: Retries timeout-related failures
- **Validation Errors**: Does not retry 4xx client errors (except specific ones)

### Exponential Backoff

Retry delays increase exponentially with jitter to prevent thundering herd problems:

```
Attempt 1: 0ms (immediate)
Attempt 2: ~1000ms ± jitter
Attempt 3: ~2000ms ± jitter
Attempt 4: ~4000ms ± jitter
...up to maxDelayMs
```

### Parallel Execution

Execute multiple operations with retry logic in parallel:

```typescript
const operations = [
	() => fetch('/api/data1').then((r) => r.json()),
	() => fetch('/api/data2').then((r) => r.json()),
	() => fetch('/api/data3').then((r) => r.json()),
]

const contexts = [
	{ endpoint: '/api/data1', requestId: 'req1' },
	{ endpoint: '/api/data2', requestId: 'req2' },
	{ endpoint: '/api/data3', requestId: 'req3' },
]

const results = await retryManager.executeAll(operations, contexts)
results.forEach((result, index) => {
	if (result.success) {
		console.log(`Operation ${index} succeeded:`, result.data)
	} else {
		console.log(`Operation ${index} failed:`, result.error)
	}
})
```

### Configuration Updates

Update retry configuration dynamically:

```typescript
// Update retry settings
retryManager.updateConfig({
	maxAttempts: 5,
	initialDelayMs: 500,
})

// Update circuit breaker settings
retryManager.updateCircuitBreakerConfig({
	failureThreshold: 3,
	recoveryTimeoutMs: 30000,
})
```

### Factory Methods

Create retry managers with predefined configurations:

```typescript
// Create with custom configuration
const customRetryManager = RetryManager.create(customConfig)

// Create with default configuration
const defaultRetryManager = RetryManager.createDefault()
```

### Error Types

The retry manager provides specific error types for different failure scenarios:

- **`RetryExhaustedError`**: Thrown when all retry attempts are exhausted
- **`CircuitBreakerOpenError`**: Thrown when circuit breaker blocks requests
- **`HttpError`**: Represents HTTP response errors with status codes

### Monitoring and Debugging

Track retry performance and circuit breaker states:

```typescript
// Get retry configuration
const config = retryManager.getConfig()

// Get circuit breaker statistics
const allStats = retryManager.getCircuitBreakerStats()
const specificStats = retryManager.getCircuitBreakerStats('/api/service:GET')

// Reset all circuit breakers
retryManager.resetAllCircuitBreakers()
```

## Other Infrastructure Components

- **AuthManager**: Authentication and token management (Task 3)
- **CacheManager**: Response caching with multiple storage backends (Task 4)
- **BatchManager**: Request batching and deduplication (Task 6)
- **ErrorHandler**: Comprehensive error handling and transformation (Task 7)
- **Logger**: Structured logging with sensitive data masking (Task 16)

Each component is designed to work independently or together to provide a robust foundation for the audit client library.
