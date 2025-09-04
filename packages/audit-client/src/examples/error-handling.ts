import {
	AuthTokenRefreshStrategy,
	CacheInvalidationStrategy,
	ErrorHandler,
	HttpError,
	NetworkError,
	ValidationError,
} from '../infrastructure/error'

import type { ErrorHandlingConfig, LoggingConfig } from '../core/config'
import type { ErrorContext, ErrorRecoveryStrategy, Logger } from '../infrastructure/error'

/**
 * Error Handling Examples
 *
 * This file demonstrates how to use the comprehensive error handling system
 * in the audit client library.
 */

// Example 1: Basic Error Handling Setup
export function setupBasicErrorHandler(): ErrorHandler {
	const loggingConfig: LoggingConfig = {
		enabled: true,
		level: 'info',
		includeRequestBody: false,
		includeResponseBody: false,
		maskSensitiveData: true,
	}

	const errorConfig: ErrorHandlingConfig = {
		throwOnError: true,
		includeStackTrace: false,
		transformErrors: true,
		sanitizeErrors: true,
		enableRecovery: true,
	}

	// Custom logger implementation
	const logger: Logger = {
		debug: (message, meta) => console.debug(`[DEBUG] ${message}`, meta),
		info: (message, meta) => console.info(`[INFO] ${message}`, meta),
		warn: (message, meta) => console.warn(`[WARN] ${message}`, meta),
		error: (message, meta) => console.error(`[ERROR] ${message}`, meta),
	}

	return new ErrorHandler(loggingConfig, errorConfig, logger)
}

// Example 2: Handling Different Error Types
export async function demonstrateErrorTypes() {
	const errorHandler = setupBasicErrorHandler()

	try {
		// Simulate different types of errors
		const errors = [
			new HttpError(404, 'Not Found', 'User not found', 'req-123'),
			new NetworkError('Connection timeout', 'req-124'),
			new ValidationError(
				'Invalid input',
				{
					email: ['Invalid email format'],
					password: ['Password too short'],
				},
				'req-125'
			),
		]

		for (const error of errors) {
			const processedError = await errorHandler.handleError(error, {
				endpoint: '/api/users',
				method: 'POST',
				requestId: error.correlationId,
			})

			console.log('Processed Error:', {
				type: processedError.constructor.name,
				code: processedError.code,
				userMessage: processedError.getUserMessage(),
				recoverable: processedError.recoverable,
			})
		}
	} catch (error) {
		console.error('Error handling failed:', error)
	}
}

// Example 3: Custom Error Recovery Strategy
export class CustomRetryStrategy implements ErrorRecoveryStrategy {
	private maxRetries = 3
	private retryCount = new Map<string, number>()

	canRecover(error: any): boolean {
		// Only recover from network errors and 5xx HTTP errors
		if (error instanceof NetworkError) return true
		if (error instanceof HttpError && error.status >= 500) return true
		return false
	}

	async recover(error: any, context: ErrorContext): Promise<any> {
		const key = `${context.endpoint}-${context.method}`
		const currentRetries = this.retryCount.get(key) || 0

		if (currentRetries >= this.maxRetries) {
			throw new Error(`Max retries (${this.maxRetries}) exceeded for ${key}`)
		}

		this.retryCount.set(key, currentRetries + 1)

		// Simulate retry delay
		await new Promise((resolve) => setTimeout(resolve, 1000 * (currentRetries + 1)))

		console.log(`Retrying ${key} (attempt ${currentRetries + 1}/${this.maxRetries})`)
	}
}

// Example 4: Error Handler with Recovery Strategies
export function setupAdvancedErrorHandler(): ErrorHandler {
	const errorHandler = setupBasicErrorHandler()

	// Add built-in recovery strategies
	const mockAuthManager = {
		refreshToken: async () => {
			console.log('Refreshing authentication token...')
			return 'new-token-123'
		},
	}

	const mockCacheManager = {
		invalidatePattern: async (pattern: string) => {
			console.log(`Invalidating cache pattern: ${pattern}`)
		},
	}

	errorHandler.addRecoveryStrategy(new AuthTokenRefreshStrategy(mockAuthManager))
	errorHandler.addRecoveryStrategy(new CacheInvalidationStrategy(mockCacheManager))
	errorHandler.addRecoveryStrategy(new CustomRetryStrategy())

	return errorHandler
}

// Example 5: Error Context and Correlation
export async function demonstrateErrorContext() {
	const errorHandler = setupAdvancedErrorHandler()

	const context: ErrorContext = {
		endpoint: '/api/audit/events',
		requestId: 'req-789',
		method: 'POST',
		url: 'https://api.example.com/api/audit/events',
		headers: {
			authorization: 'Bearer secret-token',
			'content-type': 'application/json',
			'x-api-key': 'secret-key',
		},
		body: {
			action: 'user.login',
			userId: 'user-123',
		},
		duration: 2500,
		timestamp: new Date().toISOString(),
	}

	try {
		// Simulate a server error
		const serverError = new Error('Internal server error')
		const processedError = await errorHandler.handleError(serverError, context)

		console.log('Error with context:', {
			correlationId: processedError.correlationId,
			sanitizedContext: processedError.context,
			userMessage: processedError.getUserMessage(),
		})
	} catch (error) {
		console.error('Context demonstration failed:', error)
	}
}

// Example 6: Creating Errors from HTTP Responses
export async function demonstrateHttpErrorCreation() {
	// Simulate a fetch response
	const mockResponse = {
		status: 422,
		statusText: 'Unprocessable Entity',
		headers: {
			get: (name: string) => {
				if (name === 'content-type') return 'application/json'
				return null
			},
		},
		json: async () => ({
			message: 'Validation failed',
			errors: {
				email: ['Email is required', 'Email format is invalid'],
				password: ['Password must be at least 8 characters'],
			},
		}),
	} as any

	const httpError = await ErrorHandler.createHttpError(mockResponse, 'req-456', {
		url: 'https://api.example.com/api/users',
		method: 'POST',
		headers: { 'content-type': 'application/json' },
	})

	console.log('HTTP Error from Response:', {
		status: httpError.status,
		message: httpError.message,
		userMessage: httpError.getUserMessage(),
		response: httpError.response,
	})
}

// Example 7: Validation Error Creation
export function demonstrateValidationErrorCreation() {
	const fieldErrors = {
		email: ['Email is required', 'Email format is invalid'],
		password: ['Password must be at least 8 characters', 'Password must contain numbers'],
		confirmPassword: ['Passwords do not match'],
	}

	const validationError = ErrorHandler.createValidationError(fieldErrors, 'req-789')

	console.log('Validation Error:', {
		message: validationError.message,
		userMessage: validationError.getUserMessage(),
		fieldErrors: validationError.fieldErrors,
		fieldCount: Object.keys(validationError.fieldErrors).length,
	})
}

// Example 8: Error Retryability Check
export function demonstrateRetryabilityCheck() {
	const errors = [
		new NetworkError('Connection failed'),
		new HttpError(500, 'Internal Server Error', 'Server error'),
		new HttpError(404, 'Not Found', 'Resource not found'),
		new ValidationError('Invalid input'),
		new Error('fetch failed'),
		new Error('timeout occurred'),
		new Error('generic error'),
	]

	console.log('Error Retryability:')
	errors.forEach((error) => {
		console.log(`${error.constructor.name}: ${ErrorHandler.isRetryable(error)}`)
	})
}

// Example usage function
export async function runErrorHandlingExamples() {
	console.log('=== Error Handling Examples ===\n')

	console.log('1. Basic Error Types:')
	await demonstrateErrorTypes()
	console.log()

	console.log('2. Error Context and Correlation:')
	await demonstrateErrorContext()
	console.log()

	console.log('3. HTTP Error from Response:')
	await demonstrateHttpErrorCreation()
	console.log()

	console.log('4. Validation Error Creation:')
	demonstrateValidationErrorCreation()
	console.log()

	console.log('5. Error Retryability:')
	demonstrateRetryabilityCheck()
	console.log()

	console.log('=== Examples Complete ===')
}

// Uncomment to run examples
// runErrorHandlingExamples().catch(console.error)
