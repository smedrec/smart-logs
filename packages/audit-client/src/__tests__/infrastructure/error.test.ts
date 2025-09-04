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

		it('should provide user-friendly messages', () => {
			const errors = [
				{ status: 400, expected: 'Invalid request. Please check your input and try again.' },
				{ status: 401, expected: 'Authentication failed. Please check your credentials.' },
				{
					status: 403,
					expected: 'Access denied. You do not have permission to perform this action.',
				},
				{ status: 404, expected: 'The requested resource was not found.' },
				{ status: 429, expected: 'Too many requests. Please wait a moment and try again.' },
				{ status: 500, expected: 'Server error occurred. Please try again later.' },
				{ status: 503, expected: 'Service temporarily unavailable. Please try again later.' },
			]

			errors.forEach(({ status, expected }) => {
				const error = new HttpError(status, 'Status Text', 'Technical message')
				expect(error.getUserMessage()).toBe(expected)
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
