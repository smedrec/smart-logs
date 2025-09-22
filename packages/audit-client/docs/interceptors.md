# Enhanced Request/Response Interceptor System

The audit client library provides a comprehensive interceptor system that allows you to transform requests and responses, add authentication headers, validate data, log operations, and implement custom business logic.

## Table of Contents

- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Basic Usage](#basic-usage)
- [Built-in Interceptors](#built-in-interceptors)
- [Custom Interceptors](#custom-interceptors)
- [Interceptor Management](#interceptor-management)
- [Error Handling](#error-handling)
- [Performance Considerations](#performance-considerations)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

## Overview

The interceptor system provides a powerful way to:

- **Transform requests** before they are sent to the server
- **Process responses** after they are received from the server
- **Add authentication** headers and other metadata
- **Validate data** before sending or after receiving
- **Log operations** for debugging and monitoring
- **Handle errors** in a centralized way
- **Implement cross-cutting concerns** like caching, compression, and rate limiting

## Core Concepts

### Interceptor Types

There are two types of interceptors:

1. **Request Interceptors**: Transform outgoing requests
2. **Response Interceptors**: Process incoming responses

### Execution Order

Interceptors are executed based on their **priority** (higher numbers execute first):

```typescript
// High priority (executes first)
priority: 300

// Medium priority
priority: 100

// Low priority (executes last)
priority: 50
```

### Interceptor Context

Each interceptor receives a context object with information about the current request:

```typescript
interface InterceptorContext {
	requestId: string // Unique request identifier
	endpoint: string // API endpoint being called
	method: string // HTTP method (GET, POST, etc.)
	timestamp: number // Request start time
	metadata?: Record<string, any> // Additional metadata
}
```

## Basic Usage

### Adding Request Interceptors

```typescript
import { AuditClient } from '@smedrec/audit-client'

const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: { type: 'apiKey', apiKey: 'your-key' },
})

// Add a simple request interceptor
await client.events.addRequestInterceptor({
	id: 'timestamp-interceptor',
	priority: 100,
	intercept: (options, context) => ({
		...options,
		headers: {
			...options.headers,
			'X-Request-Timestamp': new Date().toISOString(),
		},
	}),
})
```

### Adding Response Interceptors

```typescript
// Add a response interceptor
await client.events.addResponseInterceptor({
	id: 'logging-interceptor',
	priority: 100,
	intercept: (response, options, context) => {
		console.log(`Response from ${context.endpoint}:`, response)
		return response
	},
})
```

## Built-in Interceptors

The library provides several built-in interceptors for common use cases:

### Correlation ID Interceptor

Adds correlation IDs to track requests across systems:

```typescript
import { BuiltInInterceptorFactory } from '@smedrec/audit-client'

const correlationInterceptor = BuiltInInterceptorFactory.createCorrelationIdRequestInterceptor()
await client.events.addRequestInterceptor(correlationInterceptor, { priority: 200 })
```

### Authentication Interceptor

Adds authentication headers dynamically:

```typescript
const authInterceptor = BuiltInInterceptorFactory.createAuthenticationRequestInterceptor(
	async () => ({
		Authorization: `Bearer ${await getToken()}`,
		'X-API-Version': '2.0',
	})
)
await client.events.addRequestInterceptor(authInterceptor, { priority: 300 })
```

### Logging Interceptor

Logs request and response details:

```typescript
const loggingInterceptor = BuiltInInterceptorFactory.createLoggingResponseInterceptor(
	console.log, // Logger function
	'info', // Log level
	false // Include response body
)
await client.events.addResponseInterceptor(loggingInterceptor)
```

### Validation Interceptor

Validates request data before sending:

```typescript
const validationInterceptor = BuiltInInterceptorFactory.createValidationRequestInterceptor()

// Add validation rules
validationInterceptor.addValidator('/audit/events', (body) => {
	if (!body.action) return 'Action is required'
	if (!body.principalId) return 'Principal ID is required'
	return true
})

await client.events.addRequestInterceptor(validationInterceptor, { priority: 250 })
```

### Transform Interceptor

Transforms response data:

```typescript
const transformInterceptor = BuiltInInterceptorFactory.createTransformResponseInterceptor()

// Add transformation rules
transformInterceptor.addTransformer('/audit/events*', (response) => ({
	...response,
	// Add computed fields
	isSuccess: response.status === 'success',
	formattedTimestamp: new Date(response.timestamp).toLocaleString(),
}))

await client.events.addResponseInterceptor(transformInterceptor)
```

## Custom Interceptors

### Request Interceptor Example

```typescript
import type { InterceptorContext, RequestInterceptor } from '@smedrec/audit-client'

const customRequestInterceptor: RequestInterceptor = {
	id: 'custom-request-interceptor',
	priority: 150,
	enabled: true,

	async intercept(options, context) {
		// Add custom logic here
		const customHeader = await getCustomHeaderValue()

		return {
			...options,
			headers: {
				...options.headers,
				'X-Custom-Header': customHeader,
				'X-Request-Source': 'audit-client',
			},
		}
	},

	async onError(error, options, context) {
		console.error('Request interceptor error:', error.message)
		// Implement error recovery logic
	},

	async onRegister() {
		console.log('Custom request interceptor registered')
	},

	async onUnregister() {
		console.log('Custom request interceptor unregistered')
	},
}

await client.events.addRequestInterceptor(customRequestInterceptor)
```

### Response Interceptor Example

```typescript
import type { ResponseInterceptor } from '@smedrec/audit-client'

const customResponseInterceptor: ResponseInterceptor = {
	id: 'custom-response-interceptor',
	priority: 100,
	enabled: true,

	async intercept(response, options, context) {
		// Transform response data
		if (context.endpoint.includes('/audit/events')) {
			return {
				...response,
				// Add metadata
				_metadata: {
					processedAt: new Date().toISOString(),
					requestId: context.requestId,
					processingTime: Date.now() - context.timestamp,
				},
			}
		}

		return response
	},

	async onError(error, response, options, context) {
		console.error('Response interceptor error:', error.message)
		// Send error to monitoring service
		await sendErrorToMonitoring(error, context)
	},
}

await client.events.addResponseInterceptor(customResponseInterceptor)
```

## Interceptor Management

### Getting the Interceptor Manager

```typescript
const interceptorManager = client.events.getInterceptorManager()
```

### Managing Interceptors

```typescript
// Enable/disable interceptors
client.events.setInterceptorEnabled('correlation-id-request', false, 'request')

// Change priority
client.events.setInterceptorPriority('logging-response', 200, 'response')

// Remove interceptors
await client.events.removeRequestInterceptor('custom-request-interceptor')
await client.events.removeResponseInterceptor('custom-response-interceptor')

// Clear all interceptors
await client.events.clearInterceptors()
```

### Getting Statistics

```typescript
const stats = interceptorManager.getStats()

console.log('Request interceptor stats:', {
	totalExecutions: stats.request.totalExecutions,
	successfulExecutions: stats.request.successfulExecutions,
	failedExecutions: stats.request.failedExecutions,
	averageExecutionTime: stats.request.averageExecutionTime,
})

console.log('Response interceptor stats:', {
	totalExecutions: stats.response.totalExecutions,
	successfulExecutions: stats.response.successfulExecutions,
	failedExecutions: stats.response.failedExecutions,
	averageExecutionTime: stats.response.averageExecutionTime,
})
```

## Error Handling

### Interceptor Error Recovery

```typescript
const resilientInterceptor: RequestInterceptor = {
	id: 'resilient-interceptor',
	priority: 100,

	async intercept(options, context) {
		try {
			// Attempt risky operation
			const dynamicValue = await getRiskyValue()
			return {
				...options,
				headers: {
					...options.headers,
					'X-Dynamic-Value': dynamicValue,
				},
			}
		} catch (error) {
			// Graceful fallback
			console.warn('Failed to get dynamic value, using fallback')
			return {
				...options,
				headers: {
					...options.headers,
					'X-Dynamic-Value': 'fallback-value',
				},
			}
		}
	},

	async onError(error, options, context) {
		// Log error for monitoring
		console.error('Interceptor error:', {
			error: error.message,
			endpoint: context.endpoint,
			requestId: context.requestId,
		})

		// Send to error tracking service
		await errorTracker.captureException(error, {
			tags: {
				component: 'interceptor',
				interceptorId: this.id,
				endpoint: context.endpoint,
			},
		})
	},
}
```

### Chain Error Handling

When an interceptor throws an error, the chain stops and the error is propagated. Use the `onError` hook to handle errors gracefully:

```typescript
const errorHandlingInterceptor: ResponseInterceptor = {
	id: 'error-handling',
	priority: 300, // High priority to catch errors early

	intercept(response, options, context) {
		// Check for API errors
		if (response && typeof response === 'object' && 'error' in response) {
			const errorResponse = response as any

			switch (errorResponse.error.code) {
				case 'RATE_LIMIT_EXCEEDED':
					throw new Error(`Rate limit exceeded. Retry after ${errorResponse.error.retryAfter}s`)

				case 'INVALID_API_KEY':
					throw new Error('Invalid API key. Please check your credentials.')

				default:
					throw new Error(errorResponse.error.message || 'Unknown API error')
			}
		}

		return response
	},
}
```

## Performance Considerations

### Interceptor Overhead

- Interceptors add minimal overhead when properly implemented
- Avoid heavy computations in interceptor functions
- Use async operations sparingly
- Consider caching expensive operations

### Optimization Tips

```typescript
// ✅ Good: Lightweight interceptor
const lightweightInterceptor: RequestInterceptor = {
	id: 'lightweight',
	intercept: (options) => ({
		...options,
		headers: {
			...options.headers,
			'X-Timestamp': Date.now().toString(),
		},
	}),
}

// ❌ Avoid: Heavy computation in interceptor
const heavyInterceptor: RequestInterceptor = {
	id: 'heavy',
	async intercept(options) {
		// Avoid expensive operations
		const expensiveResult = await performExpensiveComputation()

		return {
			...options,
			headers: {
				...options.headers,
				'X-Expensive': expensiveResult,
			},
		}
	},
}

// ✅ Better: Cache expensive operations
const cachedInterceptor: RequestInterceptor = {
	id: 'cached',
	cache: new Map(),

	async intercept(options) {
		const cacheKey = 'expensive-value'
		let value = this.cache.get(cacheKey)

		if (!value) {
			value = await performExpensiveComputation()
			this.cache.set(cacheKey, value)

			// Clear cache after 5 minutes
			setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000)
		}

		return {
			...options,
			headers: {
				...options.headers,
				'X-Cached-Value': value,
			},
		}
	},
}
```

## Best Practices

### 1. Use Descriptive IDs

```typescript
// ✅ Good
id: 'correlation-id-request'
id: 'jwt-authentication'
id: 'audit-event-validation'

// ❌ Avoid
id: 'interceptor1'
id: 'my-interceptor'
```

### 2. Set Appropriate Priorities

```typescript
// Authentication (highest priority)
priority: 300

// Validation
priority: 250

// Logging and monitoring
priority: 100

// Transformation (lowest priority)
priority: 50
```

### 3. Handle Errors Gracefully

```typescript
const robustInterceptor: RequestInterceptor = {
	id: 'robust-interceptor',

	async intercept(options, context) {
		try {
			// Main logic
			return await processRequest(options)
		} catch (error) {
			// Log error but don't break the chain
			console.warn('Interceptor warning:', error.message)
			return options // Return original options as fallback
		}
	},

	async onError(error, options, context) {
		// Always implement error handlers
		console.error('Interceptor error:', error.message)
	},
}
```

### 4. Use Conditional Logic

```typescript
const conditionalInterceptor: RequestInterceptor = {
	id: 'conditional-interceptor',

	intercept(options, context) {
		// Only apply to specific endpoints
		if (!context.endpoint.includes('/audit/')) {
			return options
		}

		// Only in development
		if (process.env.NODE_ENV !== 'development') {
			return options
		}

		return {
			...options,
			headers: {
				...options.headers,
				'X-Debug-Mode': 'true',
			},
		}
	},
}
```

### 5. Implement Proper Cleanup

```typescript
const resourceInterceptor: RequestInterceptor = {
	id: 'resource-interceptor',
	connections: new Set(),

	async onRegister() {
		// Initialize resources
		this.connections.add(await createConnection())
	},

	async onUnregister() {
		// Clean up resources
		for (const connection of this.connections) {
			await connection.close()
		}
		this.connections.clear()
	},
}
```

## API Reference

### RequestInterceptor Interface

```typescript
interface RequestInterceptor {
	id?: string
	priority?: number
	enabled?: boolean

	intercept(
		options: RequestOptions,
		context: InterceptorContext
	): Promise<RequestOptions> | RequestOptions

	onError?(error: Error, options: RequestOptions, context: InterceptorContext): Promise<void> | void

	onRegister?(): Promise<void> | void
	onUnregister?(): Promise<void> | void
}
```

### ResponseInterceptor Interface

```typescript
interface ResponseInterceptor {
	id?: string
	priority?: number
	enabled?: boolean

	intercept<T>(response: T, options: RequestOptions, context: InterceptorContext): Promise<T> | T

	onError?(
		error: Error,
		response: any,
		options: RequestOptions,
		context: InterceptorContext
	): Promise<void> | void

	onRegister?(): Promise<void> | void
	onUnregister?(): Promise<void> | void
}
```

### InterceptorManager Methods

```typescript
class InterceptorManager {
	// Request interceptor management
	request: RequestInterceptorManager

	// Response interceptor management
	response: ResponseInterceptorManager

	// Clear all interceptors
	clearAll(): Promise<void>

	// Get combined statistics
	getStats(): {
		request: InterceptorChainStats
		response: InterceptorChainStats
	}
}
```

### BaseResource Methods

```typescript
// Add interceptors
addRequestInterceptor(interceptor, options?): Promise<void>
addResponseInterceptor(interceptor, options?): Promise<void>

// Remove interceptors
removeRequestInterceptor(interceptorId): Promise<boolean>
removeResponseInterceptor(interceptorId): Promise<boolean>

// Manage interceptors
setInterceptorEnabled(id, enabled, type): boolean
setInterceptorPriority(id, priority, type): boolean

// Get interceptor manager
getInterceptorManager(): InterceptorManager

// Clear all interceptors
clearInterceptors(): Promise<void>
```

## Examples

For complete examples, see the [interceptors example file](../src/examples/interceptors-example.ts) which demonstrates:

- Basic interceptor usage
- Built-in interceptor configuration
- Custom authentication interceptors
- Request validation
- Response transformation
- Error handling
- Dynamic interceptor management
- Performance optimization techniques

## Troubleshooting

### Common Issues

1. **Interceptor not executing**: Check that it's enabled and has the correct priority
2. **Order issues**: Verify priority values (higher numbers execute first)
3. **Performance problems**: Profile interceptor execution time and optimize heavy operations
4. **Memory leaks**: Ensure proper cleanup in `onUnregister` hooks
5. **Error propagation**: Use `onError` hooks to handle errors gracefully

### Debug Mode

Enable debug logging to troubleshoot interceptor issues:

```typescript
const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: { type: 'apiKey', apiKey: 'your-key' },
	logging: {
		enabled: true,
		level: 'debug',
		includeRequestBody: true,
		includeResponseBody: true,
	},
})
```

This will log detailed information about interceptor execution, including timing and error details.
