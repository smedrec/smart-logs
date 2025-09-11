# Infrastructure Layer

The infrastructure layer provides core functionality that supports all other components of the audit client library. This includes authentication, caching, retry mechanisms, request batching, error handling, and logging.

## Error Handling System

The error handling system provides comprehensive error management with structured error types, automatic error transformation, logging, and recovery strategies.

### Key Features

- **Structured Error Types**: Custom error classes for different error scenarios
- **Error Transformation**: Automatic conversion of generic errors to structured audit client errors
- **Correlation IDs**: Unique identifiers for tracking errors across requests
- **Sensitive Data Sanitization**: Automatic removal of sensitive information from error logs
- **Recovery Strategies**: Pluggable error recovery mechanisms
- **User-Friendly Messages**: Human-readable error messages for end users

### Error Classes

#### Base Error Class

```typescript
import { AuditClientError } from '@smedrec/audit-client'

// All audit client errors extend this base class
class AuditClientError extends Error {
  code: string
  correlationId?: string
  timestamp: string
  context?: Record<string, any>
  recoverable: boolean
}
```

#### HTTP Errors

```typescript
import { HttpError } from '@smedrec/audit-client'

// HTTP response errors (4xx, 5xx status codes)
const error = new HttpError(404, 'Not Found', 'User not found', 'req-123')
console.log(error.status) // 404
console.log(error.recoverable) // false (4xx errors are not recoverable)
console.log(error.getUserMessage()) // "The requested resource was not found."
```

#### Network Errors

```typescript
import { NetworkError } from '@smedrec/audit-client'

// Network connectivity issues
const error = new NetworkError('Connection timeout', 'req-124')
console.log(error.recoverable) // true (network errors are recoverable)
console.log(error.getUserMessage()) // "Network connection failed. Please check your internet connection and try again."
```

#### Validation Errors

```typescript
import { ValidationError } from '@smedrec/audit-client'

// Input validation failures
const fieldErrors = {
	email: ['Invalid email format'],
	password: ['Password too short', 'Password must contain numbers'],
}
const error = new ValidationError('Validation failed', fieldErrors, 'req-125')
console.log(error.fieldErrors) // Field-specific error details
console.log(error.getUserMessage()) // "email: Invalid email format (and 1 more)"
```

### Error Handler

The `ErrorHandler` class provides centralized error processing with logging, transformation, and recovery.

#### Basic Setup

```typescript
import { ErrorHandler } from '@smedrec/audit-client'

const loggingConfig = {
	enabled: true,
	level: 'info' as const,
	includeRequestBody: false,
	includeResponseBody: false,
	maskSensitiveData: true,
}

const errorConfig = {
	throwOnError: true,
	includeStackTrace: false,
	transformErrors: true,
	sanitizeErrors: true,
	enableRecovery: true,
}

const logger = {
	debug: (msg, meta) => console.debug(msg, meta),
	info: (msg, meta) => console.info(msg, meta),
	warn: (msg, meta) => console.warn(msg, meta),
	error: (msg, meta) => console.error(msg, meta),
}

const errorHandler = new ErrorHandler(loggingConfig, errorConfig, logger)
```

#### Error Processing

```typescript
try {
	// Some operation that might fail
	throw new Error('Something went wrong')
} catch (error) {
	const processedError = await errorHandler.handleError(error, {
		endpoint: '/api/users',
		requestId: 'req-123',
		method: 'POST',
	})

	console.log(processedError.code) // 'GENERIC_ERROR'
	console.log(processedError.correlationId) // 'err_1234567890_abc123def'
	console.log(processedError.getUserMessage()) // User-friendly message
}
```

### Recovery Strategies

Recovery strategies allow automatic error recovery for certain types of errors.

#### Built-in Strategies

##### Auth Token Refresh

```typescript
import { AuthTokenRefreshStrategy } from '@smedrec/audit-client'

const authManager = {
	refreshToken: async () => {
		// Refresh authentication token
		return 'new-token-123'
	},
}

const strategy = new AuthTokenRefreshStrategy(authManager)
errorHandler.addRecoveryStrategy(strategy)
```

##### Cache Invalidation

```typescript
import { CacheInvalidationStrategy } from '@smedrec/audit-client'

const cacheManager = {
	invalidatePattern: async (pattern: string) => {
		// Invalidate cache entries matching pattern
		console.log(`Invalidating cache: ${pattern}`)
	},
}

const strategy = new CacheInvalidationStrategy(cacheManager)
errorHandler.addRecoveryStrategy(strategy)
```

#### Custom Recovery Strategy

```typescript
import { ErrorRecoveryStrategy } from '@smedrec/audit-client'

class CustomRetryStrategy implements ErrorRecoveryStrategy {
	canRecover(error: AuditClientError): boolean {
		// Only recover from network errors and 5xx HTTP errors
		return error instanceof NetworkError || (error instanceof HttpError && error.status >= 500)
	}

	async recover(error: AuditClientError, context: ErrorContext): Promise<any> {
		// Implement custom recovery logic
		console.log(`Attempting recovery for ${error.code}`)
		await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1 second
	}
}

errorHandler.addRecoveryStrategy(new CustomRetryStrategy())
```

### Static Helper Methods

#### Creating HTTP Errors from Responses

```typescript
import { ErrorHandler } from '@smedrec/audit-client'

const response = await fetch('/api/users')
if (!response.ok) {
	const httpError = await ErrorHandler.createHttpError(response, 'req-123', {
		url: '/api/users',
		method: 'GET',
		headers: {},
	})
	throw httpError
}
```

#### Creating Validation Errors

```typescript
import { ErrorHandler } from '@smedrec/audit-client'

const fieldErrors = {
	email: ['Email is required', 'Invalid email format'],
	password: ['Password must be at least 8 characters'],
}

const validationError = ErrorHandler.createValidationError(fieldErrors, 'req-456')
throw validationError
```

#### Checking Error Retryability

```typescript
import { ErrorHandler } from '@smedrec/audit-client'

const error = new NetworkError('Connection failed')
const isRetryable = ErrorHandler.isRetryable(error) // true

const validationError = new ValidationError('Invalid input')
const isRetryable2 = ErrorHandler.isRetryable(validationError) // false
```

### Configuration Options

#### Logging Configuration

```typescript
interface LoggingConfig {
	enabled: boolean // Enable/disable logging
	level: 'debug' | 'info' | 'warn' | 'error' // Minimum log level
	includeRequestBody: boolean // Include request body in logs
	includeResponseBody: boolean // Include response body in logs
	maskSensitiveData: boolean // Mask sensitive data in logs
	customLogger?: Logger // Custom logger implementation
}
```

#### Error Handling Configuration

```typescript
interface ErrorHandlingConfig {
	throwOnError: boolean // Whether to throw processed errors
	includeStackTrace: boolean // Include stack traces in errors
	transformErrors: boolean // Enable error transformation
	sanitizeErrors: boolean // Remove sensitive data from errors
	enableRecovery: boolean // Enable automatic error recovery
	customErrorHandler?: ErrorHandler // Custom error handler
}
```

### Best Practices

1. **Always use correlation IDs** for tracking errors across distributed systems
2. **Sanitize sensitive data** in production environments
3. **Implement appropriate recovery strategies** for your use case
4. **Use structured error types** instead of generic Error objects
5. **Provide user-friendly error messages** for client-facing applications
6. **Log errors at appropriate levels** (debug for recoverable, error for critical)
7. **Test error scenarios** thoroughly in your applications

### Integration Example

```typescript
import {
	AuthTokenRefreshStrategy,
	CacheInvalidationStrategy,
	ErrorHandler,
} from '@smedrec/audit-client'

// Setup error handler with recovery strategies
const errorHandler = new ErrorHandler(loggingConfig, errorConfig, logger)
errorHandler.addRecoveryStrategy(new AuthTokenRefreshStrategy(authManager))
errorHandler.addRecoveryStrategy(new CacheInvalidationStrategy(cacheManager))

// Use in HTTP client
async function makeRequest(url: string, options: RequestInit) {
	try {
		const response = await fetch(url, options)

		if (!response.ok) {
			const httpError = await ErrorHandler.createHttpError(response, generateRequestId())
			throw httpError
		}

		return await response.json()
	} catch (error) {
		const processedError = await errorHandler.handleError(error, {
			endpoint: url,
			method: options.method || 'GET',
			requestId: generateRequestId(),
		})

		// Error has been logged and recovery attempted
		throw processedError
	}
}
```

This error handling system provides a robust foundation for managing errors throughout the audit client library, ensuring consistent error handling, logging, and recovery across all components.
