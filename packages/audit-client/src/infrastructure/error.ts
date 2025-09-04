/**
 * Comprehensive error handling system for the audit client library
 * Implements requirements 8.1-8.5 for structured error handling
 */

import type { ErrorHandlingConfig, LoggingConfig } from '../core/config'

/**
 * Base error class for all audit client errors
 */
export abstract class AuditClientError extends Error {
	public readonly code: string
	public readonly correlationId?: string | undefined
	public readonly timestamp: string
	public readonly context?: Record<string, any> | undefined
	public readonly recoverable: boolean

	constructor(
		message: string,
		code: string,
		correlationId?: string,
		context?: Record<string, any>,
		recoverable = false
	) {
		super(message)
		this.name = this.constructor.name
		this.code = code
		if (correlationId !== undefined) {
			this.correlationId = correlationId
		}
		this.timestamp = new Date().toISOString()
		if (context !== undefined) {
			this.context = context
		}
		this.recoverable = recoverable

		// Maintain proper stack trace for V8
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor)
		}
	}

	/**
	 * Convert error to JSON for logging and debugging
	 */
	toJSON(): Record<string, any> {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			correlationId: this.correlationId,
			timestamp: this.timestamp,
			context: this.context,
			recoverable: this.recoverable,
			stack: this.stack,
		}
	}

	/**
	 * Get user-friendly error message
	 */
	getUserMessage(): string {
		return this.message
	}

	/**
	 * Create a new instance with additional context
	 */
	withContext(additionalContext: Record<string, any>): this {
		const mergedContext = { ...this.context, ...additionalContext }
		const constructor = this.constructor as new (...args: any[]) => this
		const newInstance = Object.create(constructor.prototype)

		// Copy all properties
		Object.assign(newInstance, this)

		// Override context with merged version
		Object.defineProperty(newInstance, 'context', {
			value: mergedContext,
			writable: false,
			enumerable: true,
			configurable: false,
		})

		return newInstance
	}
}

/**
 * HTTP-related errors (network, server responses)
 */
export class HttpError extends AuditClientError {
	public readonly status: number
	public readonly statusText: string
	public readonly response?: any
	public readonly request?: {
		url: string
		method: string
		headers: Record<string, string>
	}

	constructor(
		status: number,
		statusText: string,
		message: string,
		correlationId?: string,
		response?: any,
		request?: {
			url: string
			method: string
			headers: Record<string, string>
		}
	) {
		const code = `HTTP_${status}`
		const recoverable = status >= 500 || status === 429 || status === 408

		super(message, code, correlationId, { status, statusText, response, request }, recoverable)
		this.status = status
		this.statusText = statusText
		if (response !== undefined) {
			this.response = response
		}
		if (request !== undefined) {
			this.request = request
		}
	}

	override getUserMessage(): string {
		switch (this.status) {
			case 400:
				return 'Invalid request. Please check your input and try again.'
			case 401:
				return 'Authentication failed. Please check your credentials.'
			case 403:
				return 'Access denied. You do not have permission to perform this action.'
			case 404:
				return 'The requested resource was not found.'
			case 409:
				return 'Conflict detected. The resource may have been modified by another user.'
			case 429:
				return 'Too many requests. Please wait a moment and try again.'
			case 500:
				return 'Server error occurred. Please try again later.'
			case 502:
			case 503:
			case 504:
				return 'Service temporarily unavailable. Please try again later.'
			default:
				return `Request failed with status ${this.status}. Please try again.`
		}
	}
}

/**
 * Network connectivity errors
 */
export class NetworkError extends AuditClientError {
	public readonly cause?: Error

	constructor(message: string, correlationId?: string, cause?: Error) {
		super(message, 'NETWORK_ERROR', correlationId, { cause: cause?.message }, true)
		if (cause !== undefined) {
			this.cause = cause
		}
	}

	override getUserMessage(): string {
		return 'Network connection failed. Please check your internet connection and try again.'
	}
}

/**
 * Request timeout errors
 */
export class TimeoutError extends AuditClientError {
	public readonly timeoutMs: number

	constructor(timeoutMs: number, correlationId?: string) {
		super(
			`Request timed out after ${timeoutMs}ms`,
			'TIMEOUT_ERROR',
			correlationId,
			{ timeoutMs },
			true
		)
		this.timeoutMs = timeoutMs
	}

	override getUserMessage(): string {
		return 'Request timed out. The server may be busy, please try again.'
	}
}

/**
 * Validation errors for input data
 */
export class ValidationError extends AuditClientError {
	public readonly fieldErrors: Record<string, string[]>

	constructor(message: string, fieldErrors: Record<string, string[]> = {}, correlationId?: string) {
		super(message, 'VALIDATION_ERROR', correlationId, { fieldErrors }, false)
		this.fieldErrors = fieldErrors
	}

	override getUserMessage(): string {
		const fieldCount = Object.keys(this.fieldErrors).length
		if (fieldCount === 0) {
			return 'Invalid input data. Please check your request and try again.'
		}

		const fieldNames = Object.keys(this.fieldErrors)
		const firstField = fieldNames[0]!
		const firstError = this.fieldErrors[firstField]![0]!

		if (fieldCount === 1) {
			return `${firstField}: ${firstError}`
		}

		return `Multiple validation errors found. ${firstField}: ${firstError} (and ${fieldCount - 1} more)`
	}
}

/**
 * Authentication and authorization errors
 */
export class AuthenticationError extends AuditClientError {
	public readonly authType: string

	constructor(message: string, authType: string, correlationId?: string) {
		super(message, 'AUTH_ERROR', correlationId, { authType }, false)
		this.authType = authType
	}

	override getUserMessage(): string {
		return 'Authentication failed. Please check your credentials and try again.'
	}
}

/**
 * Configuration errors
 */
export class ConfigurationError extends AuditClientError {
	public readonly configPath?: string

	constructor(message: string, configPath?: string, correlationId?: string) {
		super(message, 'CONFIG_ERROR', correlationId, { configPath }, false)
		if (configPath !== undefined) {
			this.configPath = configPath
		}
	}

	override getUserMessage(): string {
		return 'Configuration error. Please check your client configuration.'
	}
}

/**
 * Retry exhausted errors
 */
export class RetryExhaustedError extends AuditClientError {
	public readonly attempts: number
	public readonly lastError: Error

	constructor(message: string, attempts: number, lastError: Error, correlationId?: string) {
		super(
			message,
			'RETRY_EXHAUSTED',
			correlationId,
			{ attempts, lastError: lastError.message },
			false
		)
		this.attempts = attempts
		this.lastError = lastError
	}

	override getUserMessage(): string {
		return 'Request failed after multiple attempts. Please try again later.'
	}
}

/**
 * Cache-related errors
 */
export class CacheError extends AuditClientError {
	public readonly operation: string

	constructor(message: string, operation: string, correlationId?: string) {
		super(message, 'CACHE_ERROR', correlationId, { operation }, true)
		this.operation = operation
	}

	override getUserMessage(): string {
		return 'Cache operation failed. The request will proceed without caching.'
	}
}

/**
 * Batch processing errors
 */
export class BatchError extends AuditClientError {
	public readonly batchSize: number
	public readonly failedItems: number

	constructor(message: string, batchSize: number, failedItems: number, correlationId?: string) {
		super(message, 'BATCH_ERROR', correlationId, { batchSize, failedItems }, true)
		this.batchSize = batchSize
		this.failedItems = failedItems
	}

	override getUserMessage(): string {
		return `Batch processing failed for ${this.failedItems} out of ${this.batchSize} items.`
	}
}

/**
 * Generic error for unknown or unhandled errors
 */
export class GenericError extends AuditClientError {
	public readonly originalError?: string

	constructor(message: string, correlationId?: string, originalError?: string) {
		super(message, 'GENERIC_ERROR', correlationId, { originalError }, false)
		if (originalError !== undefined) {
			this.originalError = originalError
		}
	}

	override getUserMessage(): string {
		return 'An unexpected error occurred. Please try again.'
	}
}

/**
 * Error context for tracking request information
 */
export interface ErrorContext {
	endpoint?: string | undefined
	requestId?: string | undefined
	duration?: number | undefined
	method?: string | undefined
	url?: string | undefined
	headers?: Record<string, string> | undefined
	body?: any
	response?: any
	userAgent?: string | undefined
	timestamp?: string | undefined
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
	canRecover(error: AuditClientError): boolean
	recover(error: AuditClientError, context: ErrorContext): Promise<any> | any
}

/**
 * Logger interface for error handling
 */
export interface Logger {
	debug(message: string, meta?: any): void
	info(message: string, meta?: any): void
	warn(message: string, meta?: any): void
	error(message: string, meta?: any): void
}

/**
 * Comprehensive error handler with transformation and logging
 */
export class ErrorHandler {
	private loggingConfig: LoggingConfig
	private errorConfig: ErrorHandlingConfig
	private logger?: Logger
	private recoveryStrategies: ErrorRecoveryStrategy[] = []

	constructor(loggingConfig: LoggingConfig, errorConfig: ErrorHandlingConfig, logger?: Logger) {
		this.loggingConfig = loggingConfig
		this.errorConfig = errorConfig
		if (logger !== undefined) {
			this.logger = logger
		}
	}

	/**
	 * Add error recovery strategy
	 */
	addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
		this.recoveryStrategies.push(strategy)
	}

	/**
	 * Handle and transform errors
	 */
	async handleError(error: unknown, context: ErrorContext = {}): Promise<AuditClientError> {
		const correlationId = context.requestId || this.generateCorrelationId()
		let auditError: AuditClientError

		// Transform error to AuditClientError
		if (error instanceof AuditClientError) {
			auditError = error
		} else if (error instanceof TypeError && error.message.includes('fetch')) {
			auditError = new NetworkError('Network request failed', correlationId, error as Error)
		} else if (error instanceof Error) {
			if (error.name === 'AbortError') {
				auditError = new TimeoutError(context.duration || 0, correlationId)
			} else {
				auditError = this.transformGenericError(error, correlationId, context)
			}
		} else {
			auditError = new GenericError('Unknown error occurred', correlationId, String(error))
		}

		// Add context to error
		if (context && Object.keys(context).length > 0) {
			auditError = auditError.withContext(context)
		}

		// Log error
		await this.logError(auditError, context)

		// Attempt recovery if enabled
		if (this.errorConfig.enableRecovery && auditError.recoverable) {
			const recovered = await this.attemptRecovery(auditError, context)
			if (recovered !== null) {
				return recovered
			}
		}

		// Apply error transformation if enabled
		if (this.errorConfig.transformErrors) {
			auditError = this.transformError(auditError)
		}

		return auditError
	}

	/**
	 * Transform generic errors to audit client errors
	 */
	private transformGenericError(
		error: Error,
		correlationId: string,
		context: ErrorContext
	): AuditClientError {
		// Check for specific error patterns
		if (error.message.includes('timeout')) {
			return new TimeoutError(context.duration || 0, correlationId)
		}

		if (error.message.includes('network') || error.message.includes('fetch')) {
			return new NetworkError(error.message, correlationId, error)
		}

		if (error.message.includes('validation') || error.message.includes('invalid')) {
			return new ValidationError(error.message, {}, correlationId)
		}

		if (error.message.includes('auth') || error.message.includes('unauthorized')) {
			return new AuthenticationError(error.message, 'unknown', correlationId)
		}

		// Default to generic audit client error
		return new GenericError(error.message, correlationId, error.name)
	}

	/**
	 * Transform error for user consumption
	 */
	private transformError(error: AuditClientError): AuditClientError {
		let transformedError = error

		// Apply custom transformations based on configuration
		if (this.errorConfig.sanitizeErrors && error.context) {
			// Remove sensitive information from error messages
			const sanitizedContext = this.sanitizeContext(error.context)
			if (sanitizedContext) {
				transformedError = error.withContext(sanitizedContext)
			}
		}

		if (!this.errorConfig.includeStackTrace) {
			// Remove stack trace for production by creating a copy without it
			const errorCopy = Object.create(Object.getPrototypeOf(transformedError))
			Object.assign(errorCopy, transformedError)
			errorCopy.stack = undefined
			transformedError = errorCopy
		}

		return transformedError
	}

	/**
	 * Sanitize error context to remove sensitive data
	 */
	private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
		if (!context) return context

		const sanitized = { ...context }
		const sensitiveKeys = ['password', 'token', 'key', 'secret', 'authorization']

		const sanitizeObject = (obj: any): any => {
			if (typeof obj !== 'object' || obj === null) return obj

			if (Array.isArray(obj)) {
				return obj.map(sanitizeObject)
			}

			const result: any = {}
			for (const [key, value] of Object.entries(obj)) {
				const lowerKey = key.toLowerCase()
				if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
					result[key] = '[REDACTED]'
				} else if (typeof value === 'object') {
					result[key] = sanitizeObject(value)
				} else {
					result[key] = value
				}
			}
			return result
		}

		return sanitizeObject(sanitized)
	}

	/**
	 * Log error with appropriate level
	 */
	private async logError(error: AuditClientError, context: ErrorContext): Promise<void> {
		if (!this.loggingConfig.enabled || !this.logger) return

		const logData = {
			error: error.toJSON(),
			context: this.loggingConfig.maskSensitiveData ? this.sanitizeContext(context) : context,
		}

		// Determine log level based on error type and configuration
		if (error.recoverable && this.loggingConfig.level === 'debug') {
			this.logger.debug(`Recoverable error: ${error.message}`, logData)
		} else if (error instanceof ValidationError) {
			this.logger.warn(`Validation error: ${error.message}`, logData)
		} else if (error instanceof NetworkError || error instanceof TimeoutError) {
			this.logger.warn(`Network error: ${error.message}`, logData)
		} else {
			this.logger.error(`Error: ${error.message}`, logData)
		}
	}

	/**
	 * Attempt error recovery using registered strategies
	 */
	private async attemptRecovery(
		error: AuditClientError,
		context: ErrorContext
	): Promise<AuditClientError | null> {
		for (const strategy of this.recoveryStrategies) {
			if (strategy.canRecover(error)) {
				try {
					await strategy.recover(error, context)

					// Log successful recovery
					if (this.logger && this.loggingConfig.enabled) {
						this.logger.info(`Error recovered: ${error.code}`, {
							correlationId: error.correlationId,
							strategy: strategy.constructor.name,
						})
					}

					return null // Indicate successful recovery
				} catch (recoveryError) {
					// Log recovery failure but continue with other strategies
					if (this.logger && this.loggingConfig.enabled) {
						this.logger.warn(`Recovery failed: ${error.code}`, {
							correlationId: error.correlationId,
							strategy: strategy.constructor.name,
							recoveryError:
								recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
						})
					}
				}
			}
		}

		return error // No recovery possible
	}

	/**
	 * Generate correlation ID for error tracking
	 */
	private generateCorrelationId(): string {
		return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Create HTTP error from fetch response
	 */
	static async createHttpError(
		response: Response,
		correlationId?: string,
		request?: {
			url: string
			method: string
			headers: Record<string, string>
		}
	): Promise<HttpError> {
		let responseBody: any
		let message = `HTTP ${response.status}: ${response.statusText}`

		try {
			const contentType = response.headers.get('content-type')
			if (contentType?.includes('application/json')) {
				responseBody = await response.json()
				if (responseBody.message) {
					message = responseBody.message
				} else if (responseBody.error) {
					message = responseBody.error
				}
			} else {
				responseBody = await response.text()
				if (responseBody && responseBody.length < 200) {
					message = responseBody
				}
			}
		} catch (parseError) {
			// Ignore parse errors, use default message
		}

		return new HttpError(
			response.status,
			response.statusText,
			message,
			correlationId,
			responseBody,
			request
		)
	}

	/**
	 * Create validation error from field errors
	 */
	static createValidationError(
		fieldErrors: Record<string, string[]>,
		correlationId?: string
	): ValidationError {
		const errorCount = Object.keys(fieldErrors).length
		const message = `Validation failed for ${errorCount} field${errorCount === 1 ? '' : 's'}`

		return new ValidationError(message, fieldErrors, correlationId)
	}

	/**
	 * Check if error is retryable
	 */
	static isRetryable(error: unknown): boolean {
		if (error instanceof AuditClientError) {
			return error.recoverable
		}

		if (error instanceof Error) {
			// Network errors are generally retryable
			if (error.message.includes('network') || error.message.includes('fetch')) {
				return true
			}

			// Timeout errors are retryable
			if (error.name === 'AbortError' || error.message.includes('timeout')) {
				return true
			}
		}

		return false
	}
}

/**
 * Default error recovery strategies
 */
export class AuthTokenRefreshStrategy implements ErrorRecoveryStrategy {
	private authManager: any // Will be properly typed when auth manager is available

	constructor(authManager: any) {
		this.authManager = authManager
	}

	canRecover(error: AuditClientError): boolean {
		return error instanceof HttpError && error.status === 401
	}

	async recover(error: AuditClientError, context: ErrorContext): Promise<any> {
		if (this.authManager && typeof this.authManager.refreshToken === 'function') {
			await this.authManager.refreshToken()
			// The original request should be retried by the retry manager
		}
	}
}

export class CacheInvalidationStrategy implements ErrorRecoveryStrategy {
	private cacheManager: any // Will be properly typed when cache manager is available

	constructor(cacheManager: any) {
		this.cacheManager = cacheManager
	}

	canRecover(error: AuditClientError): boolean {
		return error instanceof HttpError && error.status === 409
	}

	async recover(error: AuditClientError, context: ErrorContext): Promise<any> {
		if (this.cacheManager && context.endpoint) {
			// Invalidate cache for the endpoint that returned a conflict
			await this.cacheManager.invalidatePattern(context.endpoint)
		}
	}
}
