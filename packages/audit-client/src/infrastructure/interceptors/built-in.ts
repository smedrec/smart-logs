/**
 * Built-in interceptors for common use cases
 *
 * This module provides a collection of pre-built interceptors that handle
 * common request/response transformation and processing scenarios.
 */

import type { RequestOptions } from '../../core/base-resource'
import type { InterceptorContext, RequestInterceptor, ResponseInterceptor } from '../interceptors'

/**
 * Request interceptor that adds correlation IDs to requests
 */
export class CorrelationIdRequestInterceptor implements RequestInterceptor {
	public readonly id = 'correlation-id-request'
	public readonly priority = 100
	public enabled = true

	private headerName: string
	private generateId: () => string

	constructor(
		headerName = 'X-Correlation-ID',
		generateId = () => `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
	) {
		this.headerName = headerName
		this.generateId = generateId
	}

	intercept(options: RequestOptions, context: InterceptorContext): RequestOptions {
		// Add correlation ID if not already present
		if (!options.headers?.[this.headerName]) {
			const correlationId = this.generateId()

			return {
				...options,
				headers: {
					...options.headers,
					[this.headerName]: correlationId,
				},
			}
		}

		return options
	}
}

/**
 * Request interceptor that adds authentication headers
 */
export class AuthenticationRequestInterceptor implements RequestInterceptor {
	public readonly id = 'authentication-request'
	public readonly priority = 90
	public enabled = true

	private getAuthHeaders: () => Promise<Record<string, string>> | Record<string, string>

	constructor(getAuthHeaders: () => Promise<Record<string, string>> | Record<string, string>) {
		this.getAuthHeaders = getAuthHeaders
	}

	async intercept(options: RequestOptions, context: InterceptorContext): Promise<RequestOptions> {
		const authHeaders = await this.getAuthHeaders()

		return {
			...options,
			headers: {
				...options.headers,
				...authHeaders,
			},
		}
	}
}

/**
 * Request interceptor that adds request timing headers
 */
export class TimingRequestInterceptor implements RequestInterceptor {
	public readonly id = 'timing-request'
	public readonly priority = 80
	public enabled = true

	intercept(options: RequestOptions, context: InterceptorContext): RequestOptions {
		return {
			...options,
			headers: {
				...options.headers,
				'X-Request-Start-Time': Date.now().toString(),
				'X-Request-ID': context.requestId,
			},
		}
	}
}

/**
 * Request interceptor that validates request data
 */
export class ValidationRequestInterceptor implements RequestInterceptor {
	public readonly id = 'validation-request'
	public readonly priority = 70
	public enabled = true

	private validators: Map<string, (body: any) => boolean | string> = new Map()

	/**
	 * Add a validator for a specific endpoint pattern
	 */
	addValidator(endpointPattern: string, validator: (body: any) => boolean | string): void {
		this.validators.set(endpointPattern, validator)
	}

	/**
	 * Remove a validator for an endpoint pattern
	 */
	removeValidator(endpointPattern: string): boolean {
		return this.validators.delete(endpointPattern)
	}

	intercept(options: RequestOptions, context: InterceptorContext): RequestOptions {
		// Skip validation for GET requests or requests without body
		if (!options.body || (options.method || 'GET') === 'GET') {
			return options
		}

		// Find matching validator
		for (const [pattern, validator] of Array.from(this.validators.entries())) {
			if (this.matchesPattern(context.endpoint, pattern)) {
				const result = validator(options.body)

				if (result !== true) {
					const errorMessage = typeof result === 'string' ? result : 'Request validation failed'
					throw new Error(`Validation error for ${context.endpoint}: ${errorMessage}`)
				}
				break
			}
		}

		return options
	}

	private matchesPattern(endpoint: string, pattern: string): boolean {
		if (pattern.includes('*')) {
			const regex = new RegExp(pattern.replace(/\*/g, '.*'))
			return regex.test(endpoint)
		}
		return endpoint === pattern
	}
}

/**
 * Request interceptor that adds request compression
 */
export class CompressionRequestInterceptor implements RequestInterceptor {
	public readonly id = 'compression-request'
	public readonly priority = 60
	public enabled = true

	private minSize: number
	private compressionTypes: string[]

	constructor(minSize = 1024, compressionTypes = ['application/json', 'text/plain']) {
		this.minSize = minSize
		this.compressionTypes = compressionTypes
	}

	intercept(options: RequestOptions, context: InterceptorContext): RequestOptions {
		// Only compress if body exists and is large enough
		if (!options.body || typeof options.body !== 'string') {
			return options
		}

		const contentType = options.headers?.['Content-Type'] || 'application/json'
		const shouldCompress =
			this.compressionTypes.some((type) => contentType.includes(type)) &&
			options.body.length >= this.minSize

		if (shouldCompress) {
			return {
				...options,
				headers: {
					...options.headers,
					'Accept-Encoding': 'gzip, deflate, br',
					'Content-Encoding': 'gzip',
				},
			}
		}

		return options
	}
}

/**
 * Response interceptor that logs response details
 */
export class LoggingResponseInterceptor implements ResponseInterceptor {
	public readonly id = 'logging-response'
	public readonly priority = 100
	public enabled = true

	private logger: (message: string, data?: any) => void
	private logLevel: 'debug' | 'info' | 'warn' | 'error'
	private includeBody: boolean

	constructor(
		logger: (message: string, data?: any) => void = console.log,
		logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info',
		includeBody = false
	) {
		this.logger = logger
		this.logLevel = logLevel
		this.includeBody = includeBody
	}

	intercept<T>(response: T, options: RequestOptions, context: InterceptorContext): T {
		const logData: any = {
			requestId: context.requestId,
			endpoint: context.endpoint,
			method: context.method,
			timestamp: new Date().toISOString(),
			duration: Date.now() - context.timestamp,
		}

		if (this.includeBody) {
			logData.response = response
		}

		this.logger(`Response received for ${context.method} ${context.endpoint}`, logData)
		return response
	}

	onError(error: Error, response: any, options: RequestOptions, context: InterceptorContext): void {
		this.logger(`Response error for ${context.method} ${context.endpoint}`, {
			requestId: context.requestId,
			error: error.message,
			duration: Date.now() - context.timestamp,
		})
	}
}

/**
 * Response interceptor that transforms response data
 */
export class TransformResponseInterceptor implements ResponseInterceptor {
	public readonly id = 'transform-response'
	public readonly priority = 90
	public enabled = true

	private transformers: Map<string, (data: any) => any> = new Map()

	/**
	 * Add a transformer for a specific endpoint pattern
	 */
	addTransformer(endpointPattern: string, transformer: (data: any) => any): void {
		this.transformers.set(endpointPattern, transformer)
	}

	/**
	 * Remove a transformer for an endpoint pattern
	 */
	removeTransformer(endpointPattern: string): boolean {
		return this.transformers.delete(endpointPattern)
	}

	intercept<T>(response: T, options: RequestOptions, context: InterceptorContext): T {
		// Find matching transformer
		for (const [pattern, transformer] of Array.from(this.transformers.entries())) {
			if (this.matchesPattern(context.endpoint, pattern)) {
				try {
					return transformer(response) as T
				} catch (error) {
					throw new Error(`Response transformation failed for ${context.endpoint}: ${error}`)
				}
			}
		}

		return response
	}

	private matchesPattern(endpoint: string, pattern: string): boolean {
		if (pattern.includes('*')) {
			const regex = new RegExp(pattern.replace(/\*/g, '.*'))
			return regex.test(endpoint)
		}
		return endpoint === pattern
	}
}

/**
 * Response interceptor that caches responses
 */
export class CachingResponseInterceptor implements ResponseInterceptor {
	public readonly id = 'caching-response'
	public readonly priority = 80
	public enabled = true

	private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map()
	private defaultTtl: number
	private maxSize: number

	constructor(defaultTtl = 300000, maxSize = 1000) {
		// 5 minutes default TTL
		this.defaultTtl = defaultTtl
		this.maxSize = maxSize
	}

	intercept<T>(response: T, options: RequestOptions, context: InterceptorContext): T {
		// Only cache GET requests
		if ((options.method || 'GET') !== 'GET') {
			return response
		}

		const cacheKey = this.generateCacheKey(context.endpoint, options.query)
		const ttl = options.cacheTtl || this.defaultTtl

		// Store in cache
		this.cache.set(cacheKey, {
			data: response,
			timestamp: Date.now(),
			ttl,
		})

		// Cleanup old entries if cache is too large
		if (this.cache.size > this.maxSize) {
			this.cleanup()
		}

		return response
	}

	/**
	 * Get cached response if available and not expired
	 */
	getCached<T>(endpoint: string, query?: Record<string, any>): T | null {
		const cacheKey = this.generateCacheKey(endpoint, query)
		const cached = this.cache.get(cacheKey)

		if (!cached) {
			return null
		}

		// Check if expired
		if (Date.now() - cached.timestamp > cached.ttl) {
			this.cache.delete(cacheKey)
			return null
		}

		return cached.data as T
	}

	/**
	 * Clear cache
	 */
	clearCache(): void {
		this.cache.clear()
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): { size: number; maxSize: number; hitRate: number } {
		return {
			size: this.cache.size,
			maxSize: this.maxSize,
			hitRate: 0, // Would need to track hits/misses for accurate calculation
		}
	}

	private generateCacheKey(endpoint: string, query?: Record<string, any>): string {
		const queryString = query ? JSON.stringify(query) : ''
		return `${endpoint}:${queryString}`
	}

	private cleanup(): void {
		const now = Date.now()
		const entries = Array.from(this.cache.entries())

		// Remove expired entries first
		for (const [key, value] of entries) {
			if (now - value.timestamp > value.ttl) {
				this.cache.delete(key)
			}
		}

		// If still too large, remove oldest entries
		if (this.cache.size > this.maxSize) {
			const sortedEntries = entries
				.filter(([key]) => this.cache.has(key)) // Only include non-expired entries
				.sort(([, a], [, b]) => a.timestamp - b.timestamp)

			const toRemove = this.cache.size - this.maxSize
			for (let i = 0; i < toRemove && i < sortedEntries.length; i++) {
				const entry = sortedEntries[i]
				if (entry) {
					this.cache.delete(entry[0])
				}
			}
		}
	}
}

/**
 * Response interceptor that validates response data
 */
export class ValidationResponseInterceptor implements ResponseInterceptor {
	public readonly id = 'validation-response'
	public readonly priority = 70
	public enabled = true

	private validators: Map<string, (data: any) => boolean | string> = new Map()

	/**
	 * Add a validator for a specific endpoint pattern
	 */
	addValidator(endpointPattern: string, validator: (data: any) => boolean | string): void {
		this.validators.set(endpointPattern, validator)
	}

	/**
	 * Remove a validator for an endpoint pattern
	 */
	removeValidator(endpointPattern: string): boolean {
		return this.validators.delete(endpointPattern)
	}

	intercept<T>(response: T, options: RequestOptions, context: InterceptorContext): T {
		// Find matching validator
		for (const [pattern, validator] of Array.from(this.validators.entries())) {
			if (this.matchesPattern(context.endpoint, pattern)) {
				const result = validator(response)

				if (result !== true) {
					const errorMessage = typeof result === 'string' ? result : 'Response validation failed'
					throw new Error(`Validation error for ${context.endpoint}: ${errorMessage}`)
				}
				break
			}
		}

		return response
	}

	private matchesPattern(endpoint: string, pattern: string): boolean {
		if (pattern.includes('*')) {
			const regex = new RegExp(pattern.replace(/\*/g, '.*'))
			return regex.test(endpoint)
		}
		return endpoint === pattern
	}
}

/**
 * Response interceptor that handles error responses
 */
export class ErrorHandlingResponseInterceptor implements ResponseInterceptor {
	public readonly id = 'error-handling-response'
	public readonly priority = 60
	public enabled = true

	private errorHandlers: Map<number | string, (error: any, context: InterceptorContext) => any> =
		new Map()

	/**
	 * Add an error handler for a specific status code or error type
	 */
	addErrorHandler(
		statusCodeOrType: number | string,
		handler: (error: any, context: InterceptorContext) => any
	): void {
		this.errorHandlers.set(statusCodeOrType, handler)
	}

	/**
	 * Remove an error handler
	 */
	removeErrorHandler(statusCodeOrType: number | string): boolean {
		return this.errorHandlers.delete(statusCodeOrType)
	}

	intercept<T>(response: T, options: RequestOptions, context: InterceptorContext): T {
		// Check if response indicates an error
		if (this.isErrorResponse(response)) {
			const statusCode = this.extractStatusCode(response)
			const errorType = this.extractErrorType(response)

			// Try to find a specific handler
			let handler = this.errorHandlers.get(statusCode)
			if (!handler && errorType) {
				handler = this.errorHandlers.get(errorType)
			}

			if (handler) {
				return handler(response, context) as T
			}
		}

		return response
	}

	private isErrorResponse(response: any): boolean {
		// Check common error indicators
		if (typeof response === 'object' && response !== null) {
			return !!(response.error || response.errors || (response.message && response.status >= 400))
		}
		return false
	}

	private extractStatusCode(response: any): number {
		if (typeof response === 'object' && response !== null) {
			return response.status || response.statusCode || 0
		}
		return 0
	}

	private extractErrorType(response: any): string | null {
		if (typeof response === 'object' && response !== null) {
			return response.type || response.errorType || response.code || null
		}
		return null
	}
}

/**
 * Factory class for creating built-in interceptors
 */
export class BuiltInInterceptorFactory {
	/**
	 * Create a correlation ID request interceptor
	 */
	static createCorrelationIdRequestInterceptor(
		headerName?: string,
		generateId?: () => string
	): CorrelationIdRequestInterceptor {
		return new CorrelationIdRequestInterceptor(headerName, generateId)
	}

	/**
	 * Create an authentication request interceptor
	 */
	static createAuthenticationRequestInterceptor(
		getAuthHeaders: () => Promise<Record<string, string>> | Record<string, string>
	): AuthenticationRequestInterceptor {
		return new AuthenticationRequestInterceptor(getAuthHeaders)
	}

	/**
	 * Create a timing request interceptor
	 */
	static createTimingRequestInterceptor(): TimingRequestInterceptor {
		return new TimingRequestInterceptor()
	}

	/**
	 * Create a validation request interceptor
	 */
	static createValidationRequestInterceptor(): ValidationRequestInterceptor {
		return new ValidationRequestInterceptor()
	}

	/**
	 * Create a compression request interceptor
	 */
	static createCompressionRequestInterceptor(
		minSize?: number,
		compressionTypes?: string[]
	): CompressionRequestInterceptor {
		return new CompressionRequestInterceptor(minSize, compressionTypes)
	}

	/**
	 * Create a logging response interceptor
	 */
	static createLoggingResponseInterceptor(
		logger?: (message: string, data?: any) => void,
		logLevel?: 'debug' | 'info' | 'warn' | 'error',
		includeBody?: boolean
	): LoggingResponseInterceptor {
		return new LoggingResponseInterceptor(logger, logLevel, includeBody)
	}

	/**
	 * Create a transform response interceptor
	 */
	static createTransformResponseInterceptor(): TransformResponseInterceptor {
		return new TransformResponseInterceptor()
	}

	/**
	 * Create a caching response interceptor
	 */
	static createCachingResponseInterceptor(
		defaultTtl?: number,
		maxSize?: number
	): CachingResponseInterceptor {
		return new CachingResponseInterceptor(defaultTtl, maxSize)
	}

	/**
	 * Create a validation response interceptor
	 */
	static createValidationResponseInterceptor(): ValidationResponseInterceptor {
		return new ValidationResponseInterceptor()
	}

	/**
	 * Create an error handling response interceptor
	 */
	static createErrorHandlingResponseInterceptor(): ErrorHandlingResponseInterceptor {
		return new ErrorHandlingResponseInterceptor()
	}
}
