import { AuthManager } from '../infrastructure/auth'
import { BatchManager } from '../infrastructure/batch'
import { CacheManager } from '../infrastructure/cache'
import { ErrorHandler, TimeoutError } from '../infrastructure/error'
import { InterceptorManager } from '../infrastructure/interceptors'
import { AuditLogger, LoggerFactory } from '../infrastructure/logger'
import { PerformanceManager } from '../infrastructure/performance'
import { PerformanceMonitor } from '../infrastructure/performance-monitor'
import { RetryManager } from '../infrastructure/retry'
import { HttpClient } from './http-client'

import type {
	InterceptorContext,
	RequestInterceptor,
	ResponseInterceptor,
} from '../infrastructure/interceptors'
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
	metadata?: Record<string, any>
	timeout?: number
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
	protected logger: Logger
	protected interceptorManager!: InterceptorManager
	protected performanceManager!: PerformanceManager
	protected performanceMonitor?: PerformanceMonitor
	protected httpClient!: HttpClient
	protected requestInterceptors: (
		| RequestInterceptor
		| ((options: RequestOptions) => Promise<RequestOptions> | RequestOptions)
	)[] = []
	protected responseInterceptors: (
		| ResponseInterceptor
		| (<T>(response: T, options: RequestOptions) => Promise<T> | T)
	)[] = []

	constructor(config: AuditClientConfig, logger?: Logger, performanceMonitor?: PerformanceMonitor) {
		this.config = config
		this.logger = logger || LoggerFactory.create(config.logging)
		if (performanceMonitor !== undefined) {
			this.performanceMonitor = performanceMonitor
		}
		this.initializeManagers()
	}

	/**
	 * Initialize all infrastructure managers
	 */
	private initializeManagers(): void {
		// Initialize authentication manager
		this.authManager = new AuthManager(this.config.authentication)

		// Initialize HTTP client
		this.httpClient = new HttpClient(this.config, this.authManager, this.logger)

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

		// Initialize interceptor manager
		this.interceptorManager = new InterceptorManager(this.logger)

		// Initialize performance manager
		this.performanceManager = new PerformanceManager(this.config.performance, this.logger)

		// Register global interceptors from config
		this.registerGlobalInterceptors()
	}

	/**
	 * Core request method with all enhancements
	 */
	protected async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
		const requestId = this.generateRequestId()
		const startTime = Date.now()
		const method = options.method || 'GET'

		// Start performance tracking
		this.performanceManager.getMetricsCollector().startRequest(requestId, endpoint, method)

		// Track memory usage periodically
		this.trackMemoryUsage()

		// Create interceptor context
		const context: InterceptorContext = {
			requestId,
			endpoint,
			method,
			timestamp: startTime,
			metadata: options.metadata,
		}

		// Setup timeout handling with AbortController
		const timeout = options.timeout ?? this.config.timeout
		const abortController = new AbortController()
		let timeoutId: NodeJS.Timeout | number | undefined

		// If no signal was provided, use our abort controller
		// If a signal was provided, we need to chain them
		const effectiveSignal = options.signal
			? this.createChainedSignal(options.signal, abortController.signal)
			: abortController.signal

		// Set up timeout
		if (timeout > 0) {
			timeoutId = setTimeout(() => {
				abortController.abort()
			}, timeout)
		}

		try {
			// Apply request interceptors
			const processedOptions = await this.applyRequestInterceptors(options, context)

			// Check cache first (unless explicitly skipped)
			if (!processedOptions.skipCache && this.shouldUseCache(endpoint, processedOptions)) {
				const cached = await this.cacheManager.get<T>(
					this.generateCacheKey(endpoint, processedOptions)
				)
				if (cached) {
					// Complete performance tracking for cache hit
					this.performanceManager.getMetricsCollector().completeRequest(requestId, {
						status: 200,
						cached: true,
					})

					// Track cache hit in performance monitor
					if (this.performanceMonitor) {
						this.performanceMonitor.recordCacheHit()
					}

					this.logRequest('Cache hit', { endpoint, requestId, cached: true })
					return cached
				} else {
					// Track cache miss in performance monitor
					if (this.performanceMonitor) {
						this.performanceMonitor.recordCacheMiss()
					}
				}
			}

			// Check if request should be batched (unless explicitly skipped)
			if (!processedOptions.skipBatch && this.shouldBatch(endpoint, processedOptions)) {
				return this.batchManager.addToBatch<T>(endpoint, processedOptions as any)
			}

			// Use request deduplication if enabled
			const deduplicationKey = this.performanceManager
				.getDeduplicationManager()
				.generateKey(endpoint, method, processedOptions.body, processedOptions.query)

			const executeWithPerformance = async (): Promise<T> => {
				// Update options with effective signal for timeout handling
				const optionsWithSignal = {
					...processedOptions,
					signal: effectiveSignal,
				}

				// Execute request with retry logic (unless explicitly skipped)
				if (!processedOptions.skipRetry) {
					return this.retryManager.execute(
						() => this.executeRequest<T>(endpoint, optionsWithSignal, requestId),
						{ endpoint, requestId, method }
					)
				} else {
					return this.executeRequest<T>(endpoint, optionsWithSignal, requestId)
				}
			}

			// Execute with queue management and deduplication
			let response: T
			if (this.config.performance.requestDeduplication) {
				response = await this.performanceManager
					.getDeduplicationManager()
					.execute(deduplicationKey, executeWithPerformance)
			} else {
				response = await this.performanceManager.getQueueManager().enqueue(executeWithPerformance, {
					priority: this.getRequestPriority(endpoint, method),
					metadata: { endpoint, method, requestId },
				})
			}

			// Apply response interceptors
			const processedResponse = await this.applyResponseInterceptors(
				response,
				processedOptions,
				context
			)

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

			// Complete performance tracking for successful request
			const duration = Date.now() - startTime
			this.performanceManager.getMetricsCollector().completeRequest(requestId, {
				status: 200,
				cached: false,
			})

			// Track request time and success in performance monitor
			if (this.performanceMonitor) {
				this.performanceMonitor.recordRequestTime(duration)
				this.performanceMonitor.recordSuccess()
			}

			// Log successful request
			this.logRequest('Request completed', {
				endpoint,
				requestId,
				duration,
				cached: false,
			})

			return processedResponse
		} catch (error) {
			// Complete performance tracking for failed request
			const duration = Date.now() - startTime
			this.performanceManager.getMetricsCollector().completeRequest(requestId, {
				error: error instanceof Error ? error.message : 'Unknown error',
			})

			// Track error in performance monitor
			if (this.performanceMonitor) {
				this.performanceMonitor.recordRequestTime(duration)
				this.performanceMonitor.recordError()
			}

			// Check if this is a timeout error (AbortError from our timeout)
			let errorToHandle = error
			if (error instanceof Error && error.name === 'AbortError' && abortController.signal.aborted) {
				// Create TimeoutError with proper context
				errorToHandle = new TimeoutError(timeout, requestId)
			}

			// Handle and transform errors
			const processedError = await this.errorHandler.handleError(errorToHandle, {
				endpoint,
				requestId,
				duration,
				method: options.method,
				url: this.buildUrl(endpoint),
			})

			this.logRequest('Request failed', {
				endpoint,
				requestId,
				error: processedError.message,
				duration,
			})

			if (this.config.errorHandling.throwOnError) {
				throw processedError
			}

			return processedError as unknown as T
		} finally {
			// Clean up timeout
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId)
			}
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
		let bytesTransferred = 0
		let compressed = false

		// Prepare headers for compression if enabled
		let customHeaders = options.headers || {}
		if (this.config.performance.enableCompression) {
			customHeaders = {
				...customHeaders,
				'Accept-Encoding': 'gzip, deflate, br',
			}
		}

		// Apply request compression if enabled and applicable
		let body = options.body
		if (this.config.performance.enableCompression && body) {
			const contentType = 'application/json'
			const serializedBody = typeof body === 'string' ? body : JSON.stringify(body)
			const compressionResult = await this.performanceManager
				.getCompressionManager()
				.compressRequest(serializedBody, contentType)

			body = compressionResult.body
			compressed = compressionResult.compressed

			// Update headers with compression info
			customHeaders = {
				...customHeaders,
				...compressionResult.headers,
			}
		}

		// Calculate request size for metrics
		if (body) {
			bytesTransferred += this.getBodySize(body)
		}

		// Execute request via HttpClient
		const response = await this.httpClient.request<T>(url, {
			...(options.method && { method: options.method }),
			headers: customHeaders,
			body,
			...(options.signal && { signal: options.signal }),
			requestId,
			...(options.responseType && { responseType: options.responseType }),
		})

		// Handle response decompression if needed
		let decompressedData = response.data
		if (this.config.performance.enableCompression && response.headers['content-encoding']) {
			// Note: Fetch API handles decompression automatically for most cases
			// This is a placeholder for custom decompression logic if needed
		}

		// Calculate response size for metrics
		const contentLength = response.headers['content-length']
		if (contentLength) {
			bytesTransferred += parseInt(contentLength, 10)
		}

		// Update performance metrics for successful request
		this.performanceManager.getMetricsCollector().completeRequest(requestId, {
			status: response.status,
			bytesTransferred,
			compressed,
		})

		return decompressedData
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
	 * Register global interceptors from configuration
	 */
	private async registerGlobalInterceptors(): Promise<void> {
		try {
			// Register global request interceptors from config
			if (this.config.interceptors.request) {
				for (const interceptor of this.config.interceptors.request) {
					await this.interceptorManager.request.register(interceptor)
				}
			}

			// Register global response interceptors from config
			if (this.config.interceptors.response) {
				for (const interceptor of this.config.interceptors.response) {
					await this.interceptorManager.response.register(interceptor)
				}
			}

			// Register legacy instance interceptors (convert to enhanced format if needed)
			for (const interceptor of this.requestInterceptors) {
				// Convert legacy interceptor to enhanced format if needed
				const enhancedInterceptor: RequestInterceptor =
					typeof interceptor === 'function'
						? {
								id: `legacy_request_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
								intercept: interceptor,
							}
						: interceptor
				await this.interceptorManager.request.register(enhancedInterceptor)
			}

			for (const interceptor of this.responseInterceptors) {
				// Convert legacy interceptor to enhanced format if needed
				const enhancedInterceptor: ResponseInterceptor =
					typeof interceptor === 'function'
						? {
								id: `legacy_response_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
								intercept: interceptor,
							}
						: interceptor
				await this.interceptorManager.response.register(enhancedInterceptor)
			}
		} catch (error) {
			this.logger.error('Failed to register global interceptors', { error })
		}
	}

	/**
	 * Apply request interceptors using the enhanced interceptor manager
	 */
	private async applyRequestInterceptors(
		options: RequestOptions,
		context: InterceptorContext
	): Promise<RequestOptions> {
		try {
			return await this.interceptorManager.request.execute(options, context)
		} catch (error) {
			this.logger.error('Request interceptor chain failed', {
				error,
				requestId: context.requestId,
				endpoint: context.endpoint,
			})
			throw error
		}
	}

	/**
	 * Apply response interceptors using the enhanced interceptor manager
	 */
	private async applyResponseInterceptors<T>(
		response: T,
		options: RequestOptions,
		context: InterceptorContext
	): Promise<T> {
		try {
			return await this.interceptorManager.response.execute(response, options, context)
		} catch (error) {
			this.logger.error('Response interceptor chain failed', {
				error,
				requestId: context.requestId,
				endpoint: context.endpoint,
			})
			throw error
		}
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
	 * Create a chained AbortSignal that aborts when either signal aborts
	 */
	private createChainedSignal(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
		const controller = new AbortController()

		// Abort if either signal aborts
		const abortHandler = () => controller.abort()

		signal1.addEventListener('abort', abortHandler, { once: true })
		signal2.addEventListener('abort', abortHandler, { once: true })

		return controller.signal
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
	 * Get request priority based on endpoint and method
	 */
	private getRequestPriority(endpoint: string, method: string): number {
		// Higher priority for critical endpoints
		if (endpoint.includes('/health') || endpoint.includes('/ready')) {
			return 10 // Highest priority for health checks
		}

		if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
			return 5 // Higher priority for write operations
		}

		if (endpoint.includes('/audit/events')) {
			return 3 // Medium priority for audit events
		}

		return 1 // Default priority for read operations
	}

	/**
	 * Get approximate size of body data
	 */
	private getBodySize(body: any): number {
		if (!body) return 0

		if (typeof body === 'string') {
			return new Blob([body]).size
		}

		if (body instanceof ArrayBuffer) {
			return body.byteLength
		}

		if (body instanceof Uint8Array) {
			return body.byteLength
		}

		if (body instanceof Blob) {
			return body.size
		}

		// For objects, estimate JSON size
		try {
			return new Blob([JSON.stringify(body)]).size
		} catch {
			return 0
		}
	}

	/**
	 * Log request information using enhanced logging system
	 */
	private logRequest(message: string, meta: Record<string, any>): void {
		if (!this.config.logging.enabled) {
			return
		}

		// Set request correlation if available
		if (meta.requestId && this.logger.setRequestId) {
			this.logger.setRequestId(meta.requestId)
		}

		if (meta.correlationId && this.logger.setCorrelationId) {
			this.logger.setCorrelationId(meta.correlationId)
		}

		// Determine log level based on context
		if (meta.error) {
			this.logger.error(message, meta)
		} else if (meta.warning || meta.status >= 400) {
			this.logger.warn(message, meta)
		} else {
			this.logger.info(message, meta)
		}
	}

	/**
	 * Add request interceptor using the enhanced interceptor manager
	 */
	public async addRequestInterceptor(
		interceptor:
			| RequestInterceptor
			| ((options: RequestOptions) => Promise<RequestOptions> | RequestOptions),
		options: { enabled: boolean; priority: number }
	): Promise<void> {
		// Convert legacy function interceptor to enhanced format if needed
		const enhancedInterceptor: RequestInterceptor =
			typeof interceptor === 'function'
				? {
						id: `request_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
						intercept: interceptor,
					}
				: interceptor

		await this.interceptorManager.request.register(enhancedInterceptor, options)

		// Also add to legacy array for backward compatibility
		this.requestInterceptors.push(interceptor)
	}

	/**
	 * Add response interceptor using the enhanced interceptor manager
	 */
	public async addResponseInterceptor(
		interceptor:
			| ResponseInterceptor
			| (<T>(response: T, options: RequestOptions) => Promise<T> | T),
		options: { enabled: boolean; priority: number }
	): Promise<void> {
		// Convert legacy function interceptor to enhanced format if needed
		const enhancedInterceptor: ResponseInterceptor =
			typeof interceptor === 'function'
				? {
						id: `response_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
						intercept: interceptor,
					}
				: interceptor

		await this.interceptorManager.response.register(enhancedInterceptor, options)

		// Also add to legacy array for backward compatibility
		this.responseInterceptors.push(interceptor)
	}

	/**
	 * Remove request interceptor by ID
	 */
	public async removeRequestInterceptor(interceptorId: string): Promise<boolean> {
		const result = await this.interceptorManager.request.unregister(interceptorId)

		// Also remove from legacy array
		const interceptor = this.requestInterceptors.find(
			(i) => typeof i === 'object' && i.id === interceptorId
		)
		if (interceptor) {
			const index = this.requestInterceptors.indexOf(interceptor)
			if (index > -1) {
				this.requestInterceptors.splice(index, 1)
			}
		}

		return result
	}

	/**
	 * Remove response interceptor by ID
	 */
	public async removeResponseInterceptor(interceptorId: string): Promise<boolean> {
		const result = await this.interceptorManager.response.unregister(interceptorId)

		// Also remove from legacy array
		const interceptor = this.responseInterceptors.find(
			(i) => typeof i === 'object' && i.id === interceptorId
		)
		if (interceptor) {
			const index = this.responseInterceptors.indexOf(interceptor)
			if (index > -1) {
				this.responseInterceptors.splice(index, 1)
			}
		}

		return result
	}

	/**
	 * Clear all interceptors
	 */
	public async clearInterceptors(): Promise<void> {
		await this.interceptorManager.clearAll()
		this.requestInterceptors = []
		this.responseInterceptors = []
	}

	/**
	 * Get interceptor manager for advanced interceptor management
	 */
	public getInterceptorManager(): InterceptorManager {
		return this.interceptorManager
	}

	/**
	 * Enable or disable an interceptor
	 */
	public setInterceptorEnabled(
		interceptorId: string,
		enabled: boolean,
		type: 'request' | 'response'
	): boolean {
		if (type === 'request') {
			return this.interceptorManager.request.setEnabled(interceptorId, enabled)
		} else {
			return this.interceptorManager.response.setEnabled(interceptorId, enabled)
		}
	}

	/**
	 * Update interceptor priority
	 */
	public setInterceptorPriority(
		interceptorId: string,
		priority: number,
		type: 'request' | 'response'
	): boolean {
		if (type === 'request') {
			return this.interceptorManager.request.setPriority(interceptorId, priority)
		} else {
			return this.interceptorManager.response.setPriority(interceptorId, priority)
		}
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
	 * Track current memory usage in performance monitor
	 */
	protected trackMemoryUsage(): void {
		if (!this.performanceMonitor) {
			return
		}

		// Try to get memory usage from performance API
		if (typeof performance !== 'undefined' && (performance as any).memory) {
			const memoryUsage = (performance as any).memory.usedJSHeapSize || 0
			this.performanceMonitor.recordMemoryUsage(memoryUsage)
			return
		}

		// Try to get memory usage from Node.js process
		if (typeof process !== 'undefined' && process.memoryUsage) {
			const memoryUsage = process.memoryUsage().heapUsed
			this.performanceMonitor.recordMemoryUsage(memoryUsage)
			return
		}
	}

	/**
	 * Get performance manager for advanced performance management
	 */
	public getPerformanceManager(): PerformanceManager {
		return this.performanceManager
	}

	/**
	 * Get current performance statistics
	 */
	public getPerformanceStats(): ReturnType<PerformanceManager['getStats']> {
		return this.performanceManager.getStats()
	}

	/**
	 * Reset performance tracking
	 */
	public resetPerformanceTracking(): void {
		this.performanceManager.reset()
	}

	/**
	 * Create streaming reader for large responses
	 */
	public createStreamReader<T>(response: Response): AsyncIterable<T> {
		return this.performanceManager.getStreamingManager().createStreamReader<T>(response)
	}

	/**
	 * Process streaming response with backpressure handling
	 */
	public async processStream<T>(
		stream: AsyncIterable<T>,
		processor: (chunk: T) => Promise<void> | void,
		options?: {
			maxConcurrency?: number
			bufferSize?: number
			onProgress?: (processed: number, total?: number) => void
		}
	): Promise<void> {
		return this.performanceManager.getStreamingManager().processStream(stream, processor, options)
	}

	/**
	 * Get infrastructure component statistics
	 */
	public getStats(): {
		cache: any
		retry: any
		batch: any
		auth: any
		interceptors: any
		performance: any
	} {
		return {
			cache: this.cacheManager.getStats(),
			retry: this.retryManager.getCircuitBreakerStats(),
			batch: this.batchManager.getStats(),
			auth: this.authManager.getCacheStats(),
			interceptors: this.interceptorManager.getStats(),
			performance: this.performanceManager.getStats(),
		}
	}

	/**
	 * Cleanup resources
	 */
	public async destroy(): Promise<void> {
		this.cacheManager.destroy()
		this.batchManager.clear()
		this.authManager.clearAllTokenCache()
		this.performanceManager.reset()
		await this.clearInterceptors()
	}
}
