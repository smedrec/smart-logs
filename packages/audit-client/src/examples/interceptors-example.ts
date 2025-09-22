/**
 * Example usage of the enhanced interceptor system
 *
 * This file demonstrates how to use the interceptor system for various
 * common scenarios like authentication, logging, validation, and transformation.
 */

import { AuditClient } from '../core/client'
import { BuiltInInterceptorFactory } from '../infrastructure/interceptors/built-in'

import type { RequestOptions } from '../core/base-resource'
import type {
	InterceptorContext,
	RequestInterceptor,
	ResponseInterceptor,
} from '../infrastructure/interceptors'

// Example 1: Basic interceptor usage
async function basicInterceptorExample() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
	})

	// Add a simple request interceptor that adds a timestamp
	await client.events.addRequestInterceptor({
		id: 'timestamp-interceptor',
		priority: 100,
		intercept: (options: RequestOptions) => ({
			...options,
			headers: {
				...options.headers,
				'X-Request-Timestamp': new Date().toISOString(),
			},
		}),
	})

	// Add a simple response interceptor that logs response time
	await client.events.addResponseInterceptor({
		id: 'timing-interceptor',
		priority: 100,
		intercept: (response: any, options: RequestOptions, context: InterceptorContext) => {
			const responseTime = Date.now() - context.timestamp
			console.log(`Request to ${context.endpoint} took ${responseTime}ms`)
			return response
		},
	})

	// Use the client normally - interceptors will be applied automatically
	const events = await client.events.query({
		filter: { dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' } },
	})

	console.log('Retrieved events:', events.events.length)
}

// Example 2: Using built-in interceptors
async function builtInInterceptorsExample() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
	})

	// Add correlation ID interceptor
	const correlationInterceptor = BuiltInInterceptorFactory.createCorrelationIdRequestInterceptor()
	await client.events.addRequestInterceptor(correlationInterceptor, { priority: 200 })

	// Add timing interceptor
	const timingInterceptor = BuiltInInterceptorFactory.createTimingRequestInterceptor()
	await client.events.addRequestInterceptor(timingInterceptor, { priority: 150 })

	// Add logging interceptor
	const loggingInterceptor = BuiltInInterceptorFactory.createLoggingResponseInterceptor(
		console.log,
		'info',
		false // Don't include response body in logs
	)
	await client.events.addResponseInterceptor(loggingInterceptor, { priority: 100 })

	// Create an audit event - all interceptors will be applied
	const event = await client.events.create({
		action: 'user.login',
		targetResourceType: 'user',
		targetResourceId: 'user-123',
		principalId: 'user-456',
		organizationId: 'org-789',
		status: 'success',
		dataClassification: 'INTERNAL',
	})

	console.log('Created event:', event.id)
}

// Example 3: Custom authentication interceptor
async function customAuthInterceptorExample() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'custom',
		},
	})

	// Custom JWT authentication interceptor
	const jwtAuthInterceptor: RequestInterceptor = {
		id: 'jwt-auth-interceptor',
		priority: 300, // High priority to run early
		enabled: true,

		async intercept(options: RequestOptions, context: InterceptorContext): Promise<RequestOptions> {
			// Get JWT token (could be from storage, API call, etc.)
			const token = await getJWTToken()

			return {
				...options,
				headers: {
					...options.headers,
					Authorization: `Bearer ${token}`,
					'X-Auth-Method': 'JWT',
				},
			}
		},

		async onError(
			error: Error,
			options: RequestOptions,
			context: InterceptorContext
		): Promise<void> {
			console.error('JWT auth interceptor error:', error.message)
			// Could implement token refresh logic here
		},
	}

	await client.events.addRequestInterceptor(jwtAuthInterceptor)

	// Helper function to get JWT token
	async function getJWTToken(): Promise<string> {
		// In a real application, this might:
		// - Check local storage for cached token
		// - Validate token expiration
		// - Refresh token if needed
		// - Make API call to get new token
		return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
	}
}

// Example 4: Request validation interceptor
async function validationInterceptorExample() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
	})

	// Custom validation interceptor for audit events
	const auditEventValidationInterceptor: RequestInterceptor = {
		id: 'audit-event-validation',
		priority: 250,
		enabled: true,

		intercept(options: RequestOptions, context: InterceptorContext): RequestOptions {
			// Only validate POST requests to audit events endpoint
			if (options.method === 'POST' && context.endpoint.includes('/audit/events')) {
				const body = options.body

				// Validate required fields
				if (!body.action) {
					throw new Error('Validation error: action is required')
				}
				if (!body.principalId) {
					throw new Error('Validation error: principalId is required')
				}
				if (!body.organizationId) {
					throw new Error('Validation error: organizationId is required')
				}

				// Validate data classification
				const validClassifications = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']
				if (!validClassifications.includes(body.dataClassification)) {
					throw new Error(
						`Validation error: dataClassification must be one of ${validClassifications.join(', ')}`
					)
				}

				// Validate action format
				if (!/^[a-z]+\.[a-z]+$/.test(body.action)) {
					throw new Error('Validation error: action must be in format "resource.action"')
				}
			}

			return options
		},
	}

	await client.events.addRequestInterceptor(auditEventValidationInterceptor)

	try {
		// This will pass validation
		await client.events.create({
			action: 'user.login',
			targetResourceType: 'user',
			principalId: 'user-123',
			organizationId: 'org-456',
			status: 'success',
			dataClassification: 'INTERNAL',
		})

		// This will fail validation
		await client.events.create({
			action: 'invalid-action', // Invalid format
			targetResourceType: 'user',
			principalId: 'user-123',
			organizationId: 'org-456',
			status: 'success',
			dataClassification: 'INVALID' as any, // Invalid classification
		})
	} catch (error) {
		console.error('Validation failed:', error.message)
	}
}

// Example 5: Response transformation interceptor
async function responseTransformationExample() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
	})

	// Transform audit events to include computed fields
	const auditEventTransformInterceptor: ResponseInterceptor = {
		id: 'audit-event-transform',
		priority: 100,
		enabled: true,

		intercept<T>(response: T, options: RequestOptions, context: InterceptorContext): T {
			// Only transform responses from audit events endpoints
			if (context.endpoint.includes('/audit/events')) {
				if (Array.isArray(response)) {
					// Transform array of events
					return response.map(transformEvent) as T
				} else if (response && typeof response === 'object' && 'events' in response) {
					// Transform paginated response
					return {
						...response,
						events: (response as any).events.map(transformEvent),
					} as T
				} else if (response && typeof response === 'object' && 'id' in response) {
					// Transform single event
					return transformEvent(response) as T
				}
			}

			return response
		},
	}

	function transformEvent(event: any) {
		return {
			...event,
			// Add computed fields
			isSuccess: event.status === 'success',
			isPHI: event.dataClassification === 'PHI',
			actionCategory: event.action.split('.')[0],
			actionType: event.action.split('.')[1],
			// Add formatted timestamp
			formattedTimestamp: new Date(event.timestamp).toLocaleString(),
			// Add age in minutes
			ageMinutes: Math.floor((Date.now() - new Date(event.timestamp).getTime()) / 60000),
		}
	}

	await client.events.addResponseInterceptor(auditEventTransformInterceptor)

	// Query events - response will be automatically transformed
	const events = await client.events.query({
		filter: { dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' } },
	})

	// Events now have additional computed fields
	events.events.forEach((event) => {
		console.log(
			`Event ${event.id}: ${event.actionCategory}.${event.actionType} (${event.ageMinutes}m ago)`
		)
	})
}

// Example 6: Error handling interceptor
async function errorHandlingInterceptorExample() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
	})

	// Custom error handling interceptor
	const errorHandlingInterceptor: ResponseInterceptor = {
		id: 'error-handling',
		priority: 300, // High priority to handle errors early
		enabled: true,

		intercept<T>(response: T, options: RequestOptions, context: InterceptorContext): T {
			// Check if response indicates an error
			if (response && typeof response === 'object' && 'error' in response) {
				const errorResponse = response as any

				// Transform different types of errors
				switch (errorResponse.error.code) {
					case 'RATE_LIMIT_EXCEEDED':
						throw new Error(
							`Rate limit exceeded. Please wait ${errorResponse.error.retryAfter} seconds before retrying.`
						)

					case 'INVALID_API_KEY':
						throw new Error('Invalid API key. Please check your authentication credentials.')

					case 'INSUFFICIENT_PERMISSIONS':
						throw new Error(
							`Insufficient permissions to access ${context.endpoint}. Required permissions: ${errorResponse.error.requiredPermissions?.join(', ')}`
						)

					case 'VALIDATION_ERROR':
						const validationErrors = errorResponse.error.details?.map(
							(detail: any) => `${detail.field}: ${detail.message}`
						)
						throw new Error(`Validation failed: ${validationErrors?.join(', ')}`)

					default:
						throw new Error(errorResponse.error.message || 'An unknown error occurred')
				}
			}

			return response
		},

		async onError(
			error: Error,
			response: any,
			options: RequestOptions,
			context: InterceptorContext
		): Promise<void> {
			// Log error details for debugging
			console.error('Response error interceptor:', {
				error: error.message,
				endpoint: context.endpoint,
				method: context.method,
				requestId: context.requestId,
				response,
			})

			// Could implement error reporting, metrics collection, etc.
		},
	}

	await client.events.addResponseInterceptor(errorHandlingInterceptor)
}

// Example 7: Conditional interceptors
async function conditionalInterceptorsExample() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
	})

	// Interceptor that only runs in development environment
	const debugInterceptor: RequestInterceptor = {
		id: 'debug-interceptor',
		priority: 50,
		enabled: process.env.NODE_ENV === 'development',

		intercept(options: RequestOptions, context: InterceptorContext): RequestOptions {
			console.log('DEBUG: Request details', {
				endpoint: context.endpoint,
				method: context.method,
				headers: options.headers,
				body: options.body,
			})

			return {
				...options,
				headers: {
					...options.headers,
					'X-Debug-Mode': 'true',
				},
			}
		},
	}

	// Interceptor that only runs for specific endpoints
	const auditSpecificInterceptor: RequestInterceptor = {
		id: 'audit-specific-interceptor',
		priority: 75,
		enabled: true,

		intercept(options: RequestOptions, context: InterceptorContext): RequestOptions {
			// Only apply to audit-related endpoints
			if (!context.endpoint.includes('/audit/')) {
				return options
			}

			return {
				...options,
				headers: {
					...options.headers,
					'X-Audit-Client': 'enhanced-audit-client',
					'X-Audit-Version': '1.0.0',
				},
			}
		},
	}

	await client.events.addRequestInterceptor(debugInterceptor)
	await client.events.addRequestInterceptor(auditSpecificInterceptor)
}

// Example 8: Managing interceptors dynamically
async function dynamicInterceptorManagementExample() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
	})

	// Add some interceptors
	const correlationInterceptor = BuiltInInterceptorFactory.createCorrelationIdRequestInterceptor()
	const loggingInterceptor = BuiltInInterceptorFactory.createLoggingResponseInterceptor()

	await client.events.addRequestInterceptor(correlationInterceptor, { priority: 100 })
	await client.events.addResponseInterceptor(loggingInterceptor, { priority: 100 })

	// Get interceptor manager for advanced operations
	const interceptorManager = client.events.getInterceptorManager()

	// List all registered interceptors
	console.log('Request interceptors:', interceptorManager.request.getInterceptors().length)
	console.log('Response interceptors:', interceptorManager.response.getInterceptors().length)

	// Disable an interceptor temporarily
	client.events.setInterceptorEnabled('correlation-id-request', false, 'request')

	// Change interceptor priority
	client.events.setInterceptorPriority('logging-response', 200, 'response')

	// Get execution statistics
	const stats = interceptorManager.getStats()
	console.log('Interceptor stats:', {
		requestExecutions: stats.request.totalExecutions,
		responseExecutions: stats.response.totalExecutions,
	})

	// Remove specific interceptor
	await client.events.removeRequestInterceptor('correlation-id-request')

	// Clear all interceptors
	await client.events.clearInterceptors()
}

// Example 9: Interceptor error recovery
async function errorRecoveryExample() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
	})

	// Interceptor with error recovery
	const resilientInterceptor: RequestInterceptor = {
		id: 'resilient-interceptor',
		priority: 100,
		enabled: true,

		async intercept(options: RequestOptions, context: InterceptorContext): Promise<RequestOptions> {
			try {
				// Attempt to add some dynamic header
				const dynamicValue = await getDynamicValue()
				return {
					...options,
					headers: {
						...options.headers,
						'X-Dynamic-Value': dynamicValue,
					},
				}
			} catch (error) {
				// If dynamic value fails, continue without it
				console.warn('Failed to get dynamic value, continuing without it:', error.message)
				return options
			}
		},

		async onError(
			error: Error,
			options: RequestOptions,
			context: InterceptorContext
		): Promise<void> {
			// Log error and potentially trigger recovery actions
			console.error('Interceptor error occurred:', {
				error: error.message,
				endpoint: context.endpoint,
				requestId: context.requestId,
			})

			// Could implement:
			// - Error reporting to monitoring service
			// - Fallback behavior
			// - Circuit breaker logic
			// - Retry with different configuration
		},
	}

	await client.events.addRequestInterceptor(resilientInterceptor)

	async function getDynamicValue(): Promise<string> {
		// Simulate an operation that might fail
		if (Math.random() < 0.3) {
			throw new Error('Dynamic value service unavailable')
		}
		return `dynamic-${Date.now()}`
	}
}

// Export all examples
export {
	basicInterceptorExample,
	builtInInterceptorsExample,
	customAuthInterceptorExample,
	validationInterceptorExample,
	responseTransformationExample,
	errorHandlingInterceptorExample,
	conditionalInterceptorsExample,
	dynamicInterceptorManagementExample,
	errorRecoveryExample,
}

// Example usage in a real application
export async function runInterceptorExamples() {
	console.log('Running interceptor examples...')

	try {
		await basicInterceptorExample()
		console.log('✓ Basic interceptor example completed')

		await builtInInterceptorsExample()
		console.log('✓ Built-in interceptors example completed')

		await customAuthInterceptorExample()
		console.log('✓ Custom auth interceptor example completed')

		await validationInterceptorExample()
		console.log('✓ Validation interceptor example completed')

		await responseTransformationExample()
		console.log('✓ Response transformation example completed')

		await errorHandlingInterceptorExample()
		console.log('✓ Error handling interceptor example completed')

		await conditionalInterceptorsExample()
		console.log('✓ Conditional interceptors example completed')

		await dynamicInterceptorManagementExample()
		console.log('✓ Dynamic interceptor management example completed')

		await errorRecoveryExample()
		console.log('✓ Error recovery example completed')

		console.log('All interceptor examples completed successfully!')
	} catch (error) {
		console.error('Error running interceptor examples:', error)
	}
}
