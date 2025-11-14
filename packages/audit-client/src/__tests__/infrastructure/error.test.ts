import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	AuditClientError,
	AuthenticationError,
	AuthTokenRefreshStrategy,
	BatchError,
	CacheError,
	CacheInvalidationStrategy,
	ConfigurationError,
	ErrorHandler,
	HttpError,
	NetworkError,
	RetryExhaustedError,
	TimeoutError,
	ValidationError,
} from '../../infrastructure/error'

import type { ErrorHandlingConfig, LoggingConfig } from '../../core/config'
import type { ErrorContext, Logger } from '../../infrastructure/error'

describe('Error Classes', () => {
	describe('AuditClientError', () => {
		it('should create error with all properties', () => {
			const error = new HttpError(
				404,
				'Not Found',
				'Resource not found',
				'corr-123',
				{ error: 'Not found' },
				{ url: '/test', method: 'GET', headers: {} }
			)

			expect(error.name).toBe('HttpError')
			expect(error.message).toBe('Resource not found')
			expect(error.code).toBe('HTTP_404')
			expect(error.correlationId).toBe('corr-123')
			expect(error.timestamp).toBeDefined()
			expect(error.recoverable).toBe(false)
			expect(error.status).toBe(404)
		})

		it('should serialize to JSON correctly', () => {
			const error = new NetworkError('Connection failed', 'corr-456')
			const json = error.toJSON()

			expect(json).toMatchObject({
				name: 'NetworkError',
				message: 'Connection failed',
				code: 'NETWORK_ERROR',
				correlationId: 'corr-456',
				recoverable: true,
			})
			expect(json.timestamp).toBeDefined()
			expect(json.stack).toBeDefined()
		})
	})

	describe('HttpError', () => {
		it('should determine recoverability based on status code', () => {
			const serverError = new HttpError(500, 'Internal Server Error', 'Server error')
			expect(serverError.recoverable).toBe(true)

			const clientError = new HttpError(400, 'Bad Request', 'Invalid input')
			expect(clientError.recoverable).toBe(false)

			const rateLimitError = new HttpError(429, 'Too Many Requests', 'Rate limited')
			expect(rateLimitError.recoverable).toBe(true)
		})

		it('should provide user-friendly messages for all status codes', () => {
			const errors = [
				{ status: 400, expected: 'Invalid request. Please check your input and try again.' },
				{
					status: 401,
					expected:
						'Authentication failed. Please verify your API key or token is valid and not expired.',
				},
				{
					status: 403,
					expected:
						'Access denied. You do not have permission to perform this action. Please contact your administrator if you believe this is an error.',
				},
				{ status: 404, expected: 'The requested resource was not found.' },
				{ status: 429, expected: 'Too many requests. Please wait a moment and try again.' },
				{ status: 500, expected: 'Server error occurred. Please try again later.' },
				{ status: 502, expected: 'Service temporarily unavailable. Please try again later.' },
				{ status: 503, expected: 'Service temporarily unavailable. Please try again later.' },
				{ status: 504, expected: 'Service temporarily unavailable. Please try again later.' },
			]

			errors.forEach(({ status, expected }) => {
				const error = new HttpError(status, 'Status Text', 'Technical message')
				expect(error.getUserMessage()).toBe(expected)
			})
		})

		describe('getActionableAdvice', () => {
			it('should provide advice for 400 validation errors', () => {
				const error = new HttpError(400, 'Bad Request', 'Validation failed', undefined, {
					errors: ['Field is required'],
				})
				const advice = error.getActionableAdvice()
				expect(advice).toContain('validation errors')
			})

			it('should provide advice for 400 without validation details', () => {
				const error = new HttpError(400, 'Bad Request', 'Invalid input')
				const advice = error.getActionableAdvice()
				expect(advice).toContain('required fields')
			})

			it('should provide advice for 401 authentication errors', () => {
				const error = new HttpError(401, 'Unauthorized', 'Auth failed')
				const advice = error.getActionableAdvice()
				expect(advice).toContain('API key')
				expect(advice).toContain('token')
			})

			it('should provide advice for 403 permission errors', () => {
				const error = new HttpError(403, 'Forbidden', 'Access denied')
				const advice = error.getActionableAdvice()
				expect(advice).toContain('administrator')
				expect(advice).toContain('permissions')
			})

			it('should provide advice for 404 with resource type', () => {
				const error = new HttpError(404, 'Not Found', 'Not found', undefined, undefined, {
					url: 'https://api.example.com/audit/events/123',
					method: 'GET',
					headers: {},
				})
				const advice = error.getActionableAdvice()
				expect(advice).toContain('event')
			})

			it('should provide advice for 404 without resource type', () => {
				const error = new HttpError(404, 'Not Found', 'Not found')
				const advice = error.getActionableAdvice()
				expect(advice).toContain('resource identifier')
			})

			it('should provide advice for 409 conflicts', () => {
				const error = new HttpError(409, 'Conflict', 'Resource conflict')
				const advice = error.getActionableAdvice()
				expect(advice).toContain('Refresh')
				expect(advice).toContain('latest version')
			})

			it('should provide advice for 429 with retry-after', () => {
				const error = new HttpError(429, 'Too Many Requests', 'Rate limited', undefined, {
					headers: { 'retry-after': '60' },
				})
				const advice = error.getActionableAdvice()
				expect(advice).toContain('Wait')
				expect(advice).toContain('minute')
			})

			it('should provide advice for 429 without retry-after', () => {
				const error = new HttpError(429, 'Too Many Requests', 'Rate limited')
				const advice = error.getActionableAdvice()
				expect(advice).toContain('Reduce the frequency')
			})

			it('should provide advice for 500 server errors', () => {
				const error = new HttpError(500, 'Internal Server Error', 'Server error')
				const advice = error.getActionableAdvice()
				expect(advice).toContain('server-side error')
				expect(advice).toContain('correlation ID')
			})

			it('should provide advice for 502 gateway errors', () => {
				const error = new HttpError(502, 'Bad Gateway', 'Gateway error')
				const advice = error.getActionableAdvice()
				expect(advice).toContain('gateway')
				expect(advice).toContain('invalid response')
			})

			it('should provide advice for 503 service unavailable', () => {
				const error = new HttpError(503, 'Service Unavailable', 'Service down')
				const advice = error.getActionableAdvice()
				expect(advice).toContain('overloaded')
				expect(advice).toContain('maintenance')
			})

			it('should provide advice for 504 gateway timeout', () => {
				const error = new HttpError(504, 'Gateway Timeout', 'Timeout')
				const advice = error.getActionableAdvice()
				expect(advice).toContain('timed out')
				expect(advice).toContain('gateway')
			})
		})

		describe('getRetryAfter', () => {
			it('should parse retry-after header in seconds', () => {
				const error = new HttpError(429, 'Too Many Requests', 'Rate limited', undefined, {
					headers: { 'retry-after': '60' },
				})
				const retryAfter = error.getRetryAfter()
				expect(retryAfter).toBe('1 minute')
			})

			it('should parse retry-after header with multiple seconds', () => {
				const error = new HttpError(429, 'Too Many Requests', 'Rate limited', undefined, {
					headers: { 'retry-after': '90' },
				})
				const retryAfter = error.getRetryAfter()
				expect(retryAfter).toBe('1 minute and 30 seconds')
			})

			it('should parse retry-after header in hours', () => {
				const error = new HttpError(429, 'Too Many Requests', 'Rate limited', undefined, {
					headers: { 'retry-after': '3600' },
				})
				const retryAfter = error.getRetryAfter()
				expect(retryAfter).toBe('1 hour')
			})

			it('should parse retry-after header with hours and minutes', () => {
				const error = new HttpError(429, 'Too Many Requests', 'Rate limited', undefined, {
					headers: { 'retry-after': '3900' },
				})
				const retryAfter = error.getRetryAfter()
				expect(retryAfter).toBe('1 hour and 5 minutes')
			})

			it('should handle case-insensitive header names', () => {
				const error = new HttpError(429, 'Too Many Requests', 'Rate limited', undefined, {
					headers: { 'Retry-After': '30' },
				})
				const retryAfter = error.getRetryAfter()
				expect(retryAfter).toBe('30 seconds')
			})

			it('should parse retry-after as HTTP date', () => {
				const futureDate = new Date(Date.now() + 120000) // 2 minutes from now
				const error = new HttpError(429, 'Too Many Requests', 'Rate limited', undefined, {
					headers: { 'retry-after': futureDate.toUTCString() },
				})
				const retryAfter = error.getRetryAfter()
				expect(retryAfter).toContain('minute')
			})

			it('should return null when retry-after header is missing', () => {
				const error = new HttpError(429, 'Too Many Requests', 'Rate limited')
				const retryAfter = error.getRetryAfter()
				expect(retryAfter).toBeNull()
			})

			it('should return null when response headers are missing', () => {
				const error = new HttpError(429, 'Too Many Requests', 'Rate limited', undefined, {})
				const retryAfter = error.getRetryAfter()
				expect(retryAfter).toBeNull()
			})

			it('should handle Headers object', () => {
				const headers = new Headers()
				headers.set('retry-after', '45')
				const error = new HttpError(429, 'Too Many Requests', 'Rate limited', undefined, {
					headers,
				})
				const retryAfter = error.getRetryAfter()
				expect(retryAfter).toBe('45 seconds')
			})

			it('should format single second correctly', () => {
				const error = new HttpError(429, 'Too Many Requests', 'Rate limited', undefined, {
					headers: { 'retry-after': '1' },
				})
				const retryAfter = error.getRetryAfter()
				expect(retryAfter).toBe('1 second')
			})
		})

		describe('getResourceType', () => {
			it('should extract resource type from URL for 404 errors', () => {
				const error = new HttpError(404, 'Not Found', 'Not found', undefined, undefined, {
					url: 'https://api.example.com/audit/events/123',
					method: 'GET',
					headers: {},
				})
				const resourceType = error.getResourceType()
				expect(resourceType).toBe('event')
			})

			it('should singularize plural resource names ending in "s"', () => {
				const error = new HttpError(404, 'Not Found', 'Not found', undefined, undefined, {
					url: 'https://api.example.com/api/v1/reports/456',
					method: 'GET',
					headers: {},
				})
				const resourceType = error.getResourceType()
				expect(resourceType).toBe('report')
			})

			it('should singularize plural resource names ending in "ies"', () => {
				const error = new HttpError(404, 'Not Found', 'Not found', undefined, undefined, {
					url: 'https://api.example.com/api/categories/789',
					method: 'GET',
					headers: {},
				})
				const resourceType = error.getResourceType()
				expect(resourceType).toBe('category')
			})

			it('should singularize plural resource names ending in "es"', () => {
				const error = new HttpError(404, 'Not Found', 'Not found', undefined, undefined, {
					url: 'https://api.example.com/api/addresses/101',
					method: 'GET',
					headers: {},
				})
				const resourceType = error.getResourceType()
				expect(resourceType).toBe('address')
			})

			it('should return null for non-404 errors', () => {
				const error = new HttpError(500, 'Internal Server Error', 'Error', undefined, undefined, {
					url: 'https://api.example.com/audit/events/123',
					method: 'GET',
					headers: {},
				})
				const resourceType = error.getResourceType()
				expect(resourceType).toBeNull()
			})

			it('should return null when request URL is missing', () => {
				const error = new HttpError(404, 'Not Found', 'Not found')
				const resourceType = error.getResourceType()
				expect(resourceType).toBeNull()
			})

			it('should return null for invalid URLs', () => {
				const error = new HttpError(404, 'Not Found', 'Not found', undefined, undefined, {
					url: 'not-a-valid-url',
					method: 'GET',
					headers: {},
				})
				const resourceType = error.getResourceType()
				expect(resourceType).toBeNull()
			})

			it('should handle URLs with short paths', () => {
				const error = new HttpError(404, 'Not Found', 'Not found', undefined, undefined, {
					url: 'https://api.example.com/users',
					method: 'GET',
					headers: {},
				})
				const resourceType = error.getResourceType()
				expect(resourceType).toBeNull()
			})
		})

		describe('getValidationMessage', () => {
			it('should format validation errors from array', () => {
				const error = new HttpError(400, 'Bad Request', 'Validation failed', undefined, {
					errors: ['Email is required', 'Password is too short'],
				})
				const message = error.getValidationMessage()
				expect(message).toContain('Validation errors:')
				expect(message).toContain('1. Email is required')
				expect(message).toContain('2. Password is too short')
			})

			it('should format single validation error from array', () => {
				const error = new HttpError(400, 'Bad Request', 'Validation failed', undefined, {
					errors: ['Email is required'],
				})
				const message = error.getValidationMessage()
				expect(message).toBe('Validation error: Email is required')
			})

			it('should format validation errors from object with arrays', () => {
				const error = new HttpError(400, 'Bad Request', 'Validation failed', undefined, {
					fieldErrors: {
						email: ['Invalid format', 'Already exists'],
						password: ['Too short'],
					},
				})
				const message = error.getValidationMessage()
				expect(message).toContain('Validation errors:')
				expect(message).toContain('email: Invalid format')
				expect(message).toContain('email: Already exists')
				expect(message).toContain('password: Too short')
			})

			it('should format validation errors from object with strings', () => {
				const error = new HttpError(400, 'Bad Request', 'Validation failed', undefined, {
					validationErrors: {
						email: 'Invalid format',
						password: 'Too short',
					},
				})
				const message = error.getValidationMessage()
				expect(message).toContain('Validation errors:')
				expect(message).toContain('email: Invalid format')
				expect(message).toContain('password: Too short')
			})

			it('should format single field error', () => {
				const error = new HttpError(400, 'Bad Request', 'Validation failed', undefined, {
					errors: {
						email: ['Invalid format'],
					},
				})
				const message = error.getValidationMessage()
				expect(message).toBe('Validation error: email: Invalid format')
			})

			it('should return null for non-400 errors', () => {
				const error = new HttpError(500, 'Internal Server Error', 'Error', undefined, {
					errors: ['Some error'],
				})
				const message = error.getValidationMessage()
				expect(message).toBeNull()
			})

			it('should return null when no validation errors present', () => {
				const error = new HttpError(400, 'Bad Request', 'Validation failed')
				const message = error.getValidationMessage()
				expect(message).toBeNull()
			})

			it('should return null for empty error arrays', () => {
				const error = new HttpError(400, 'Bad Request', 'Validation failed', undefined, {
					errors: [],
				})
				const message = error.getValidationMessage()
				expect(message).toBeNull()
			})

			it('should return null for empty error objects', () => {
				const error = new HttpError(400, 'Bad Request', 'Validation failed', undefined, {
					fieldErrors: {},
				})
				const message = error.getValidationMessage()
				expect(message).toBeNull()
			})

			it('should not mask sensitive data in validation messages', () => {
				const error = new HttpError(400, 'Bad Request', 'Validation failed', undefined, {
					errors: {
						password: ['Password must contain special characters'],
						apiKey: ['API key format is invalid'],
					},
				})
				const message = error.getValidationMessage()
				expect(message).toContain('password')
				expect(message).toContain('apiKey')
				expect(message).not.toContain('[REDACTED]')
			})
		})
	})

	describe('ValidationError', () => {
		it('should handle field errors correctly', () => {
			const fieldErrors = {
				email: ['Invalid email format'],
				password: ['Password too short', 'Password must contain numbers'],
			}
			const error = new ValidationError('Validation failed', fieldErrors)

			expect(error.fieldErrors).toEqual(fieldErrors)
			expect(error.recoverable).toBe(false)
			expect(error.getUserMessage()).toContain('email: Invalid email format')
		})

		it('should provide appropriate user message for multiple errors', () => {
			const fieldErrors = {
				field1: ['Error 1'],
				field2: ['Error 2'],
				field3: ['Error 3'],
			}
			const error = new ValidationError('Validation failed', fieldErrors)
			const message = error.getUserMessage()

			expect(message).toContain('field1: Error 1')
			expect(message).toContain('and 2 more')
		})
	})
})

describe('ErrorHandler', () => {
	let errorHandler: ErrorHandler
	let mockLogger: Logger
	let loggingConfig: LoggingConfig
	let errorConfig: ErrorHandlingConfig

	beforeEach(() => {
		mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}

		loggingConfig = {
			enabled: true,
			level: 'info',
			includeRequestBody: false,
			includeResponseBody: false,
			maskSensitiveData: true,
			customLogger: mockLogger,
		}

		errorConfig = {
			throwOnError: true,
			includeStackTrace: false,
			transformErrors: true,
			sanitizeErrors: true,
			enableRecovery: true,
			customErrorHandler: undefined,
		}

		errorHandler = new ErrorHandler(loggingConfig, errorConfig, mockLogger)
	})

	describe('handleError', () => {
		it('should handle AuditClientError instances', async () => {
			const originalError = new ValidationError('Test validation error')
			const result = await errorHandler.handleError(originalError)

			expect(result).toBeInstanceOf(ValidationError)
			expect(result.message).toBe('Test validation error')
			expect(mockLogger.warn).toHaveBeenCalled()
		})

		it('should transform generic errors to AuditClientError', async () => {
			const genericError = new Error('Generic error message')
			const result = await errorHandler.handleError(genericError)

			expect(result).toBeInstanceOf(AuditClientError)
			expect(result.code).toBe('GENERIC_ERROR')
			expect(result.correlationId).toBeDefined()
		})

		it('should transform network errors correctly', async () => {
			const networkError = new TypeError('fetch failed')
			const result = await errorHandler.handleError(networkError)

			expect(result).toBeInstanceOf(NetworkError)
			expect(result.recoverable).toBe(true)
		})

		it('should transform timeout errors correctly', async () => {
			const timeoutError = new Error('timeout')
			const result = await errorHandler.handleError(timeoutError)

			expect(result).toBeInstanceOf(TimeoutError)
			expect(result.recoverable).toBe(true)
		})

		it('should add context to errors', async () => {
			const context: ErrorContext = {
				endpoint: '/test',
				requestId: 'req-123',
				method: 'POST',
			}

			const error = new Error('Test error')
			const result = await errorHandler.handleError(error, context)

			expect(result.context).toMatchObject(context)
		})

		it('should sanitize sensitive data when configured', async () => {
			const context: ErrorContext = {
				headers: {
					authorization: 'Bearer secret-token',
					'x-api-key': 'secret-key',
					'content-type': 'application/json',
				},
			}

			const error = new Error('Test error')
			const result = await errorHandler.handleError(error, context)

			expect(result.context?.headers?.authorization).toBe('[REDACTED]')
			expect(result.context?.headers?.['x-api-key']).toBe('[REDACTED]')
			expect(result.context?.headers?.['content-type']).toBe('application/json')
		})

		it('should generate correlation ID when not provided', async () => {
			const error = new Error('Test error')
			const result = await errorHandler.handleError(error)

			expect(result.correlationId).toBeDefined()
			expect(result.correlationId).toMatch(/^err_\d+_[a-z0-9]+$/)
		})
	})

	describe('error recovery', () => {
		it('should attempt recovery for recoverable errors', async () => {
			const mockStrategy = {
				canRecover: vi.fn().mockReturnValue(true),
				recover: vi.fn().mockResolvedValue(undefined),
			}

			errorHandler.addRecoveryStrategy(mockStrategy)

			const recoverableError = new NetworkError('Network failed')
			const result = await errorHandler.handleError(recoverableError)

			expect(mockStrategy.canRecover).toHaveBeenCalledWith(recoverableError)
			expect(mockStrategy.recover).toHaveBeenCalled()
			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.stringContaining('Error recovered'),
				expect.any(Object)
			)
		})

		it('should continue with original error if recovery fails', async () => {
			const mockStrategy = {
				canRecover: vi.fn().mockReturnValue(true),
				recover: vi.fn().mockRejectedValue(new Error('Recovery failed')),
			}

			errorHandler.addRecoveryStrategy(mockStrategy)

			const recoverableError = new NetworkError('Network failed')
			const result = await errorHandler.handleError(recoverableError)

			expect(result).toBeInstanceOf(NetworkError)
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining('Recovery failed'),
				expect.any(Object)
			)
		})
	})

	describe('logging', () => {
		it('should log errors at appropriate levels', async () => {
			// Test validation error (warn level)
			const validationError = new ValidationError('Invalid input')
			await errorHandler.handleError(validationError)
			expect(mockLogger.warn).toHaveBeenCalled()

			// Test network error (warn level)
			const networkError = new NetworkError('Connection failed')
			await errorHandler.handleError(networkError)
			expect(mockLogger.warn).toHaveBeenCalled()

			// Test generic error (error level)
			const genericError = new Error('Something went wrong')
			await errorHandler.handleError(genericError)
			expect(mockLogger.error).toHaveBeenCalled()
		})

		it('should not log when logging is disabled', async () => {
			const disabledLoggingConfig = { ...loggingConfig, enabled: false }
			const handler = new ErrorHandler(disabledLoggingConfig, errorConfig, mockLogger)

			const error = new Error('Test error')
			await handler.handleError(error)

			expect(mockLogger.debug).not.toHaveBeenCalled()
			expect(mockLogger.info).not.toHaveBeenCalled()
			expect(mockLogger.warn).not.toHaveBeenCalled()
			expect(mockLogger.error).not.toHaveBeenCalled()
		})
	})

	describe('static methods', () => {
		it('should create HTTP error from response', async () => {
			const mockResponse = {
				status: 404,
				statusText: 'Not Found',
				headers: {
					get: vi.fn().mockReturnValue('application/json'),
				},
				json: vi.fn().mockResolvedValue({ message: 'Resource not found' }),
			} as any

			const error = await ErrorHandler.createHttpError(mockResponse, 'corr-123', {
				url: '/test',
				method: 'GET',
				headers: {},
			})

			expect(error).toBeInstanceOf(HttpError)
			expect(error.status).toBe(404)
			expect(error.message).toBe('Resource not found')
			expect(error.correlationId).toBe('corr-123')
		})

		it('should create validation error from field errors', () => {
			const fieldErrors = {
				email: ['Invalid format'],
				password: ['Too short'],
			}

			const error = ErrorHandler.createValidationError(fieldErrors, 'corr-456')

			expect(error).toBeInstanceOf(ValidationError)
			expect(error.fieldErrors).toEqual(fieldErrors)
			expect(error.correlationId).toBe('corr-456')
			expect(error.message).toBe('Validation failed for 2 fields')
		})

		it('should determine if error is retryable', () => {
			expect(ErrorHandler.isRetryable(new NetworkError('Network failed'))).toBe(true)
			expect(ErrorHandler.isRetryable(new TimeoutError(5000))).toBe(true)
			expect(ErrorHandler.isRetryable(new ValidationError('Invalid input'))).toBe(false)
			expect(ErrorHandler.isRetryable(new Error('fetch failed'))).toBe(true)
			expect(ErrorHandler.isRetryable(new Error('timeout occurred'))).toBe(true)
			expect(ErrorHandler.isRetryable(new Error('generic error'))).toBe(false)
		})
	})
})

describe('Recovery Strategies', () => {
	describe('AuthTokenRefreshStrategy', () => {
		it('should recover from 401 errors', async () => {
			const mockAuthManager = {
				refreshToken: vi.fn().mockResolvedValue('new-token'),
			}

			const strategy = new AuthTokenRefreshStrategy(mockAuthManager)
			const error = new HttpError(401, 'Unauthorized', 'Token expired')

			expect(strategy.canRecover(error)).toBe(true)

			await strategy.recover(error, {})
			expect(mockAuthManager.refreshToken).toHaveBeenCalled()
		})

		it('should not recover from non-401 errors', () => {
			const mockAuthManager = { refreshToken: vi.fn() }
			const strategy = new AuthTokenRefreshStrategy(mockAuthManager)
			const error = new HttpError(404, 'Not Found', 'Resource not found')

			expect(strategy.canRecover(error)).toBe(false)
		})
	})

	describe('CacheInvalidationStrategy', () => {
		it('should recover from 409 conflicts by invalidating cache', async () => {
			const mockCacheManager = {
				invalidatePattern: vi.fn().mockResolvedValue(undefined),
			}

			const strategy = new CacheInvalidationStrategy(mockCacheManager)
			const error = new HttpError(409, 'Conflict', 'Resource conflict')
			const context: ErrorContext = { endpoint: '/api/users' }

			expect(strategy.canRecover(error)).toBe(true)

			await strategy.recover(error, context)
			expect(mockCacheManager.invalidatePattern).toHaveBeenCalledWith('/api/users')
		})

		it('should not recover from non-409 errors', () => {
			const mockCacheManager = { invalidatePattern: vi.fn() }
			const strategy = new CacheInvalidationStrategy(mockCacheManager)
			const error = new HttpError(500, 'Internal Server Error', 'Server error')

			expect(strategy.canRecover(error)).toBe(false)
		})
	})
})
