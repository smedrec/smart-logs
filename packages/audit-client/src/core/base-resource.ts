import { AuthManager } from '../infrastructure/auth'
import { BatchManager } from '../infrastructure/batch'
import { CacheManager } from '../infrastructure/cache'
import { ErrorHandler } from '../infrastructure/error'
import { RetryManager } from '../infrastructure/retry'

import type { Logger } from '../infrastructure/logger'
import type { AuditClientConfig } from './config'

/**
 * Request options interface for HTTP requests
 */
export interface RequestOptions {
	method?: string
	headers?: Record<string, string>
	body?: any
	query?: Record<string, any>
	signal?: AbortSignal
	responseType?: 'json' | 'blob' | 'stream' | 'text'
	skipCache?: boolean
	skipBatch?: boolean
	skipRetry?: boolean
	cacheTtl?: number
	cacheTags?: string[]
}

/**
 * Request interceptor interface
 */
export interface RequestInterceptor {
	(options: RequestOptions): Promise<RequestOptions> | RequestOptions
}

/**
 * Response interceptor interface
 */
export interface ResponseInterceptor {
	<T>(response: T, options: RequestOptions): Promise<T> | T
}

/**
 * Enhanced BaseResource class with comprehensive HTTP request handling
 *
 * Features:
 * - Integration with all infrastructure components (auth, cache, retry, batch, error handling)
 * - Request/response interceptor support
 * - Comprehensive URL building and header management
 * - Multiple response type parsing (JSON, blob, stream, text)
 * - Request correlation and logging
 * - Performance optimization features
 */
export abstract class BaseResource {
	protected config: AuditClientConfig
	protected authManager!: AuthManager
	protected cacheManager!: CacheManager
	protected retryManager!: RetryManager
	protected batchManager!: BatchManager
	protected errorHandler!: ErrorHandler
	protected logger: Logger | undefined
	protected requestInterceptors: RequestInterceptor[] = []
	protected responseInterceptors: ResponseInterceptor[] = []

	constructor(config: AuditClientConfig, logger?: Logger) {
		this.config = config
		this.logger = logger
		this.initializeManagers()
	}

	/**
	 * Initialize all infrastructure managers
	 */
	private initializeManagers(): void {
		// Initialize authentication manager
		this.authManager = new AuthManager(this.config.authentication)

		// Initialize cache manager
		this.cacheManager = new CacheManager(this.config.cache)

		// Initialize retry manager
		this.retryManager = new RetryManager(this.config.retry)

		// Initialize batch manager with request executor
		this.batchManager = new BatchManager(this.config.batching, (endpoint: string, options: any) =>
			this.executeRequest(endpoint, options, this.generateRequestId())
		)

		// Initialize error handler
		this.errorHandler = new ErrorHandler(
			this.config.logging,
			this.config.errorHandling,
			this.logger
		)
	}

	/**
	 * Core request method with all enhancements
	 */
	protected async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
		const requestId = this.generateRequestId()
		const startTime = Date.now()

		try {
			// Apply request interceptors
			const processedOptions = await this.applyRequestInterceptors(options)

			// Check cache first (unless explicitly skipped)
			if (!processedOptions.skipCache && this.shouldUseCache(endpoint, processedOptions)) {
				const cached = await this.cacheManager.get<T>(
					this.generateCacheKey(endpoint, processedOptions)
				)
				if (cached) {
					this.logRequest('Cache hit', { endpoint, requestId, cached: true })
					return cached
				}
			}

			// Check if request should be batched (unless explicitly skipped)
			if (!processedOptions.skipBatch && this.shouldBatch(endpoint, processedOptions)) {
				return this.batchManager.addToBatch<T>(endpoint, processedOptions as any)
			}

			// Execute request with retry logic (unless explicitly skipped)
			let response: T
			if (!processedOptions.skipRetry) {
				response = await this.retryManager.execute(
					() => this.executeRequest<T>(endpoint, processedOptions, requestId),
					{ endpoint, requestId, method: processedOptions.method || 'GET' }
				)
			} else {
				response = await this.executeRequest<T>(endpoint, processedOptions, requestId)
			}

			// Apply response interceptors
			const processedResponse = await this.applyResponseInterceptors(response, processedOptions)

			// Cache successful responses (unless explicitly skipped)
			if (
				!processedOptions.skipCache &&
				this.shouldCache(endpoint, processedOptions, processedResponse)
			) {
				await this.cacheManager.set(
					this.generateCacheKey(endpoint, processedOptions),
					processedResponse,
					processedOptions.cacheTtl || this.getCacheTtl(endpoint),
					processedOptions.cacheTags
				)
			}

			// Log successful request
			this.logRequest('Request completed', {
				endpoint,
				requestId,
				duration: Date.now() - startTime,
				cached: false,
			})

			return processedResponse
		} catch (error) {
			// Handle and transform errors
			const processedError = await this.errorHandler.handleError(error, {
				endpoint,
				requestId,
				duration: Date.now() - startTime,
				method: options.method,
				url: this.buildUrl(endpoint),
			})

			this.logRequest('Request failed', {
				endpoint,
				requestId,
				error: processedError.message,
				duration: Date.now() - startTime,
			})

			if (this.config.errorHandling.throwOnError) {
				throw processedError
			}

			return processedError as unknown as T
		}
	}

	/**
	 * Execute HTTP request with comprehensive handling
	 */
	private async executeRequest<T>(
		endpoint: string,
		options: RequestOptions,
		requestId: string
	): Promise<T> {
		const url = this.buildUrl(endpoint, options.query)
		const headers = await this.buildHeaders(options.headers, requestId)
		const body = this.buildBody(options.body)

		const fetchOptions: RequestInit = {
			method: options.method || 'GET',
			headers,
			body,
			...(options.signal && { signal: options.signal }),
			credentials: 'include',
		}

		// Add compression if enabled
		if (this.config.performance.enableCompression && body) {
			headers.set('Accept-Encoding', 'gzip, deflate, br')
		}

		const response = await fetch(url, fetchOptions)

		if (!response.ok) {
			const headersObj: Record<string, string> = {}
			headers.forEach((value, key) => {
				headersObj[key] = value
			})

			const httpError = await ErrorHandler.createHttpError(response, requestId, {
				url,
				method: options.method || 'GET',
				headers: headersObj,
			})
			throw httpError
		}

		return this.parseResponse<T>(response, options.responseType)
	}

	/**
	 * Build complete URL with query parameters
	 */
	private buildUrl(endpoint: string, query?: Record<string, any>): string {
		// Ensure endpoint starts with /
		const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`

		// Build base URL
		const baseUrl = this.config.baseUrl.endsWith('/')
			? this.config.baseUrl.slice(0, -1)
			: this.config.baseUrl

		// Add API version if specified
		const versionPath = this.config.apiVersion ? `/api/${this.config.apiVersion}` : '/api/v1'

		let url = `${baseUrl}${versionPath}${normalizedEndpoint}`

		// Add query parameters
		if (query && Object.keys(query).length > 0) {
			const searchParams = new URLSearchParams()

			Object.entries(query).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					if (Array.isArray(value)) {
						value.forEach((item) => searchParams.append(key, String(item)))
					} else {
						searchParams.append(key, String(value))
					}
				}
			})

			const queryString = searchParams.toString()
			if (queryString) {
				url += `?${queryString}`
			}
		}

		return url
	}

	/**
	 * Build request headers with authentication and metadata
	 */
	private async buildHeaders(
		customHeaders: Record<string, string> = {},
		requestId: string
	): Promise<Headers> {
		const headers = new Headers()

		// Set default headers
		headers.set('Accept', 'application/json')
		headers.set('Content-Type', 'application/json')
		headers.set('User-Agent', this.getUserAgent())
		headers.set('X-Request-ID', requestId)

		// Add API version header
		if (this.config.apiVersion) {
			headers.set('Accept-Version', this.config.apiVersion)
		}

		// Add custom headers from config
		Object.entries(this.config.customHeaders).forEach(([key, value]) => {
			headers.set(key, value)
		})

		// Add authentication headers
		const authHeaders = await this.authManager.getAuthHeaders()
		Object.entries(authHeaders).forEach(([key, value]) => {
			headers.set(key, value)
		})

		// Add request-specific custom headers (these take precedence)
		Object.entries(customHeaders).forEach(([key, value]) => {
			headers.set(key, value)
		})

		return headers
	}

	/**
	 * Build request body with proper serialization
	 */
	private buildBody(body?: any): string | FormData | Blob | null {
		if (!body) {
			return null
		}

		// Handle different body types
		if (body instanceof FormData || body instanceof Blob) {
			return body
		}

		if (typeof body === 'string') {
			return body
		}

		// Default to JSON serialization
		try {
			return JSON.stringify(body)
		} catch (error) {
			throw new Error(
				`Failed to serialize request body: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
		}
	}

	/**
	 * Parse response based on response type
	 */
	private async parseResponse<T>(response: Response, responseType?: string): Promise<T> {
		switch (responseType) {
			case 'blob':
				return response.blob() as Promise<T>

			case 'text':
				return response.text() as Promise<T>

			case 'stream':
				if (!response.body) {
					throw new Error('Response body is not available for streaming')
				}
				return response.body as unknown as T

			case 'json':
			default:
				// Handle empty responses
				const contentLength = response.headers.get('content-length')
				if (contentLength === '0' || response.status === 204) {
					return {} as T
				}

				const text = await response.text()
				if (!text) {
					return {} as T
				}

				try {
					return JSON.parse(text) as T
				} catch (error) {
					throw new Error(
						`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`
					)
				}
		}
	}

	/**
	 * Apply request interceptors
	 */
	private async applyRequestInterceptors(options: RequestOptions): Promise<RequestOptions> {
		let processedOptions = { ...options }

		// Apply global interceptors from config
		if (this.config.interceptors.request) {
			for (const interceptor of this.config.interceptors.request) {
				processedOptions = await interceptor(processedOptions)
			}
		}

		// Apply instance interceptors
		for (const interceptor of this.requestInterceptors) {
			processedOptions = await interceptor(processedOptions)
		}

		return processedOptions
	}

	/**
	 * Apply response interceptors
	 */
	private async applyResponseInterceptors<T>(response: T, options: RequestOptions): Promise<T> {
		let processedResponse = response

		// Apply instance interceptors
		for (const interceptor of this.responseInterceptors) {
			processedResponse = await interceptor(processedResponse, options)
		}

		// Apply global interceptors from config
		if (this.config.interceptors.response) {
			for (const interceptor of this.config.interceptors.response) {
				processedResponse = await interceptor(processedResponse, options)
			}
		}

		return processedResponse
	}

	/**
	 * Check if request should use cache
	 */
	private shouldUseCache(endpoint: string, options: RequestOptions): boolean {
		if (!this.config.cache.enabled) {
			return false
		}

		// Only cache GET requests by default
		const method = options.method || 'GET'
		if (method !== 'GET') {
			return false
		}

		// Don't cache if explicitly disabled
		if (options.skipCache) {
			return false
		}

		return true
	}

	/**
	 * Check if request should be cached
	 */
	private shouldCache<T>(endpoint: string, options: RequestOptions, response: T): boolean {
		if (!this.config.cache.enabled) {
			return false
		}

		// Only cache GET requests by default
		const method = options.method || 'GET'
		if (method !== 'GET') {
			return false
		}

		// Don't cache if explicitly disabled
		if (options.skipCache) {
			return false
		}

		// Don't cache error responses
		if (response instanceof Error) {
			return false
		}

		return true
	}

	/**
	 * Check if request should be batched
	 */
	private shouldBatch(endpoint: string, options: RequestOptions): boolean {
		if (!this.config.batching.enabled) {
			return false
		}

		// Don't batch if explicitly disabled
		if (options.skipBatch) {
			return false
		}

		// Check if endpoint supports batching
		return this.config.batching.batchableEndpoints.some((pattern) => {
			if (pattern.includes('*')) {
				const regex = new RegExp(pattern.replace(/\*/g, '.*'))
				return regex.test(endpoint)
			}
			return endpoint === pattern
		})
	}

	/**
	 * Generate cache key for request
	 */
	private generateCacheKey(endpoint: string, options: RequestOptions): string {
		const method = options.method || 'GET'
		const query = options.query ? JSON.stringify(options.query) : ''
		const body = options.body ? JSON.stringify(options.body) : ''

		// Create a simple hash of the request parameters
		const keyData = `${endpoint}:${method}:${query}:${body}`
		return this.hashString(keyData)
	}

	/**
	 * Get cache TTL for endpoint
	 */
	private getCacheTtl(endpoint: string): number {
		// Default TTL from config
		let ttl = this.config.cache.defaultTtlMs

		// Customize TTL based on endpoint patterns
		if (endpoint.includes('/health')) {
			ttl = 30000 // 30 seconds for health checks
		} else if (endpoint.includes('/metrics')) {
			ttl = 60000 // 1 minute for metrics
		} else if (endpoint.includes('/audit/events')) {
			ttl = 300000 // 5 minutes for audit events
		}

		return ttl
	}

	/**
	 * Generate unique request ID
	 */
	private generateRequestId(): string {
		return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
	}

	/**
	 * Get user agent string
	 */
	private getUserAgent(): string {
		const version = '1.0.0' // This would come from package.json in real implementation
		const platform = typeof window !== 'undefined' ? 'browser' : 'node'
		return `audit-client/${version} (${platform})`
	}

	/**
	 * Simple string hashing function
	 */
	private hashString(str: string): string {
		let hash = 0
		if (str.length === 0) return hash.toString()

		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i)
			hash = (hash << 5) - hash + char
			hash = hash & hash // Convert to 32-bit integer
		}

		return Math.abs(hash).toString(36)
	}

	/**
	 * Log request information
	 */
	private logRequest(message: string, meta: Record<string, any>): void {
		if (!this.config.logging.enabled || !this.logger) {
			return
		}

		switch (this.config.logging.level) {
			case 'debug':
				this.logger.debug(message, meta)
				break
			case 'info':
				this.logger.info(message, meta)
				break
			case 'warn':
				if (meta.error) {
					this.logger.warn(message, meta)
				}
				break
			case 'error':
				if (meta.error) {
					this.logger.error(message, meta)
				}
				break
		}
	}

	/**
	 * Add request interceptor
	 */
	public addRequestInterceptor(interceptor: RequestInterceptor): void {
		this.requestInterceptors.push(interceptor)
	}

	/**
	 * Add response interceptor
	 */
	public addResponseInterceptor(interceptor: ResponseInterceptor): void {
		this.responseInterceptors.push(interceptor)
	}

	/**
	 * Remove request interceptor
	 */
	public removeRequestInterceptor(interceptor: RequestInterceptor): boolean {
		const index = this.requestInterceptors.indexOf(interceptor)
		if (index > -1) {
			this.requestInterceptors.splice(index, 1)
			return true
		}
		return false
	}

	/**
	 * Remove response interceptor
	 */
	public removeResponseInterceptor(interceptor: ResponseInterceptor): boolean {
		const index = this.responseInterceptors.indexOf(interceptor)
		if (index > -1) {
			this.responseInterceptors.splice(index, 1)
			return true
		}
		return false
	}

	/**
	 * Clear all interceptors
	 */
	public clearInterceptors(): void {
		this.requestInterceptors = []
		this.responseInterceptors = []
	}

	/**
	 * Get current configuration
	 */
	public getConfig(): AuditClientConfig {
		return { ...this.config }
	}

	/**
	 * Update configuration
	 */
	public updateConfig(updates: Partial<AuditClientConfig>): void {
		this.config = { ...this.config, ...updates }

		// Reinitialize managers with new config
		this.initializeManagers()
	}

	/**
	 * Get infrastructure component statistics
	 */
	public getStats(): {
		cache: any
		retry: any
		batch: any
		auth: any
	} {
		return {
			cache: this.cacheManager.getStats(),
			retry: this.retryManager.getCircuitBreakerStats(),
			batch: this.batchManager.getStats(),
			auth: this.authManager.getCacheStats(),
		}
	}

	/**
	 * Cleanup resources
	 */
	public destroy(): void {
		this.cacheManager.destroy()
		this.batchManager.clear()
		this.authManager.clearAllTokenCache()
		this.clearInterceptors()
	}
}
