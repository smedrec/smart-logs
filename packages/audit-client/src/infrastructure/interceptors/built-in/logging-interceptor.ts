/**
 * Detailed Logging Interceptor
 *
 * Provides comprehensive request/response logging with:
 * - Method, endpoint, and timing tracking
 * - Optional header logging with sensitive data masking
 * - Optional body logging with sensitive data masking
 * - Configurable log levels
 * - Duration tracking
 */

import type { RequestOptions } from '../../../core/base-resource'
import type {
	InterceptorContext,
	RequestInterceptor,
	ResponseInterceptor,
} from '../../interceptors'
import type { Logger } from '../../logger'

/**
 * Configuration options for the detailed logging interceptor
 */
export interface DetailedLoggingConfig {
	/**
	 * Whether to log request headers
	 */
	logHeaders?: boolean

	/**
	 * Whether to log request/response bodies
	 */
	logBody?: boolean

	/**
	 * Whether to mask sensitive data in logs
	 */
	maskSensitiveData?: boolean

	/**
	 * Additional sensitive field names to mask
	 */
	customSensitiveFields?: string[]

	/**
	 * Log level for successful requests
	 */
	successLogLevel?: 'debug' | 'info'

	/**
	 * Log level for failed requests
	 */
	errorLogLevel?: 'warn' | 'error'
}

/**
 * Default sensitive headers that should be masked
 */
const DEFAULT_SENSITIVE_HEADERS = [
	'authorization',
	'x-api-key',
	'cookie',
	'set-cookie',
	'x-auth-token',
	'x-session-token',
	'api-key',
	'apikey',
]

/**
 * Default sensitive fields that should be masked in bodies
 */
const DEFAULT_SENSITIVE_FIELDS = [
	'password',
	'token',
	'apiKey',
	'secret',
	'authorization',
	'cookie',
	'session',
	'key',
	'ssn',
	'creditCard',
	'cvv',
	'pin',
]

/**
 * Utility class for masking sensitive data
 */
class SensitiveDataMasker {
	private sensitiveHeaders: Set<string>
	private sensitiveFields: Set<string>

	constructor(customSensitiveFields: string[] = []) {
		this.sensitiveHeaders = new Set(DEFAULT_SENSITIVE_HEADERS.map((h) => h.toLowerCase()))
		this.sensitiveFields = new Set([
			...DEFAULT_SENSITIVE_FIELDS.map((f) => f.toLowerCase()),
			...customSensitiveFields.map((f) => f.toLowerCase()),
		])
	}

	/**
	 * Mask sensitive headers
	 */
	maskHeaders(headers: Record<string, string>): Record<string, string> {
		const masked: Record<string, string> = {}

		for (const [key, value] of Object.entries(headers)) {
			if (this.sensitiveHeaders.has(key.toLowerCase())) {
				masked[key] = '***REDACTED***'
			} else {
				masked[key] = value
			}
		}

		return masked
	}

	/**
	 * Mask sensitive fields in an object
	 */
	maskObject(obj: any): any {
		if (obj === null || obj === undefined) {
			return obj
		}

		if (typeof obj !== 'object') {
			return obj
		}

		if (Array.isArray(obj)) {
			return obj.map((item) => this.maskObject(item))
		}

		const masked: Record<string, any> = {}

		for (const [key, value] of Object.entries(obj)) {
			if (this.isSensitiveField(key)) {
				masked[key] = '***REDACTED***'
			} else if (typeof value === 'object' && value !== null) {
				masked[key] = this.maskObject(value)
			} else {
				masked[key] = value
			}
		}

		return masked
	}

	private isSensitiveField(fieldName: string): boolean {
		const lowerFieldName = fieldName.toLowerCase()
		return Array.from(this.sensitiveFields).some((field) => lowerFieldName.includes(field))
	}
}

/**
 * Request interceptor for detailed logging
 */
export class DetailedLoggingRequestInterceptor implements RequestInterceptor {
	public readonly id = 'detailed-logging-request'
	public readonly priority = 50
	public enabled = true

	private logger: Logger
	private config: DetailedLoggingConfig
	private masker: SensitiveDataMasker
	private requestTimings: Map<string, number> = new Map()

	constructor(logger: Logger, config: DetailedLoggingConfig = {}) {
		this.logger = logger
		this.config = {
			logHeaders: false,
			logBody: false,
			maskSensitiveData: true,
			customSensitiveFields: [],
			successLogLevel: 'debug',
			errorLogLevel: 'error',
			...config,
		}
		this.masker = new SensitiveDataMasker(this.config.customSensitiveFields)
	}

	intercept(options: RequestOptions, context: InterceptorContext): RequestOptions {
		// Store request start time for duration calculation
		this.requestTimings.set(context.requestId, Date.now())

		// Build log metadata
		const metadata: Record<string, any> = {
			requestId: context.requestId,
			method: context.method,
			endpoint: context.endpoint,
			timestamp: new Date(context.timestamp).toISOString(),
		}

		// Add headers if configured
		if (this.config.logHeaders && options.headers) {
			metadata.headers = this.config.maskSensitiveData
				? this.masker.maskHeaders(options.headers)
				: options.headers
		}

		// Add body if configured
		if (this.config.logBody && options.body) {
			metadata.body = this.config.maskSensitiveData
				? this.masker.maskObject(options.body)
				: options.body
		}

		// Add query parameters if present
		if (options.query) {
			metadata.query = options.query
		}

		// Log the request
		const logLevel = this.config.successLogLevel || 'debug'
		this.logger[logLevel](`Request: ${context.method} ${context.endpoint}`, metadata)

		return options
	}

	onError(error: Error, options: RequestOptions, context: InterceptorContext): void {
		const startTime = this.requestTimings.get(context.requestId)
		const duration = startTime ? Date.now() - startTime : undefined

		const metadata: Record<string, any> = {
			requestId: context.requestId,
			method: context.method,
			endpoint: context.endpoint,
			error: error.message,
			errorName: error.name,
		}

		if (duration !== undefined) {
			metadata.duration = `${duration}ms`
		}

		const logLevel = this.config.errorLogLevel || 'error'
		this.logger[logLevel](`Request failed: ${context.method} ${context.endpoint}`, metadata)

		// Clean up timing data
		this.requestTimings.delete(context.requestId)
	}

	/**
	 * Get the request start time for a given request ID
	 */
	getRequestStartTime(requestId: string): number | undefined {
		return this.requestTimings.get(requestId)
	}

	/**
	 * Clear timing data (useful for cleanup)
	 */
	clearTimings(): void {
		this.requestTimings.clear()
	}
}

/**
 * Response interceptor for detailed logging
 */
export class DetailedLoggingResponseInterceptor implements ResponseInterceptor {
	public readonly id = 'detailed-logging-response'
	public readonly priority = 50
	public enabled = true

	private logger: Logger
	private config: DetailedLoggingConfig
	private masker: SensitiveDataMasker
	private requestInterceptor?: DetailedLoggingRequestInterceptor

	constructor(
		logger: Logger,
		config: DetailedLoggingConfig = {},
		requestInterceptor?: DetailedLoggingRequestInterceptor
	) {
		this.logger = logger
		this.config = {
			logHeaders: false,
			logBody: false,
			maskSensitiveData: true,
			customSensitiveFields: [],
			successLogLevel: 'debug',
			errorLogLevel: 'error',
			...config,
		}
		this.masker = new SensitiveDataMasker(this.config.customSensitiveFields)
		if (requestInterceptor) {
			this.requestInterceptor = requestInterceptor
		}
	}

	intercept<T>(response: T, options: RequestOptions, context: InterceptorContext): T {
		// Calculate duration if request interceptor is available
		let duration: number | undefined
		if (this.requestInterceptor) {
			const startTime = this.requestInterceptor.getRequestStartTime(context.requestId)
			if (startTime) {
				duration = Date.now() - startTime
			}
		}

		// Build log metadata
		const metadata: Record<string, any> = {
			requestId: context.requestId,
			method: context.method,
			endpoint: context.endpoint,
		}

		// Add duration if available
		if (duration !== undefined) {
			metadata.duration = `${duration}ms`
		}

		// Extract status from response if available
		if (response && typeof response === 'object') {
			const responseObj = response as any
			if (responseObj.status !== undefined) {
				metadata.status = responseObj.status
			}
			if (responseObj.statusText !== undefined) {
				metadata.statusText = responseObj.statusText
			}

			// Add headers if configured and available
			if (this.config.logHeaders && responseObj.headers) {
				metadata.headers = this.config.maskSensitiveData
					? this.masker.maskHeaders(responseObj.headers)
					: responseObj.headers
			}
		}

		// Add body if configured
		if (this.config.logBody) {
			metadata.response = this.config.maskSensitiveData
				? this.masker.maskObject(response)
				: response
		}

		// Determine log level based on status
		const status = metadata.status || 200
		const logLevel =
			status >= 400 ? this.config.errorLogLevel || 'error' : this.config.successLogLevel || 'debug'

		// Log the response
		this.logger[logLevel](`Response: ${context.method} ${context.endpoint} - ${status}`, metadata)

		return response
	}

	onError(error: Error, response: any, options: RequestOptions, context: InterceptorContext): void {
		// Calculate duration if request interceptor is available
		let duration: number | undefined
		if (this.requestInterceptor) {
			const startTime = this.requestInterceptor.getRequestStartTime(context.requestId)
			if (startTime) {
				duration = Date.now() - startTime
			}
		}

		const metadata: Record<string, any> = {
			requestId: context.requestId,
			method: context.method,
			endpoint: context.endpoint,
			error: error.message,
			errorName: error.name,
		}

		if (duration !== undefined) {
			metadata.duration = `${duration}ms`
		}

		// Add response details if available
		if (response && typeof response === 'object') {
			const responseObj = response as any
			if (responseObj.status !== undefined) {
				metadata.status = responseObj.status
			}
			if (responseObj.statusText !== undefined) {
				metadata.statusText = responseObj.statusText
			}
		}

		const logLevel = this.config.errorLogLevel || 'error'
		this.logger[logLevel](`Response error: ${context.method} ${context.endpoint}`, metadata)
	}
}

/**
 * Factory for creating paired request/response logging interceptors
 */
export class DetailedLoggingInterceptorFactory {
	/**
	 * Create a pair of request and response interceptors that share timing data
	 */
	static createPair(
		logger: Logger,
		config: DetailedLoggingConfig = {}
	): {
		request: DetailedLoggingRequestInterceptor
		response: DetailedLoggingResponseInterceptor
	} {
		const requestInterceptor = new DetailedLoggingRequestInterceptor(logger, config)
		const responseInterceptor = new DetailedLoggingResponseInterceptor(
			logger,
			config,
			requestInterceptor
		)

		return {
			request: requestInterceptor,
			response: responseInterceptor,
		}
	}

	/**
	 * Create a standalone request interceptor
	 */
	static createRequestInterceptor(
		logger: Logger,
		config: DetailedLoggingConfig = {}
	): DetailedLoggingRequestInterceptor {
		return new DetailedLoggingRequestInterceptor(logger, config)
	}

	/**
	 * Create a standalone response interceptor
	 */
	static createResponseInterceptor(
		logger: Logger,
		config: DetailedLoggingConfig = {}
	): DetailedLoggingResponseInterceptor {
		return new DetailedLoggingResponseInterceptor(logger, config)
	}
}
