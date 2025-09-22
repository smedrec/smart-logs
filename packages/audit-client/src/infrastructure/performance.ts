import type { Logger } from './logger'

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
	requestCount: number
	totalDuration: number
	averageDuration: number
	minDuration: number
	maxDuration: number
	successCount: number
	errorCount: number
	bytesTransferred: number
	compressionRatio: number
	concurrentRequests: number
	queuedRequests: number
	cacheHitRate: number
	timestamp: number
}

/**
 * Request performance data
 */
export interface RequestPerformance {
	requestId: string
	endpoint: string
	method: string
	startTime: number
	endTime?: number | undefined
	duration?: number | undefined
	bytesTransferred?: number | undefined
	compressed?: boolean | undefined
	cached?: boolean | undefined
	status?: number | undefined
	error?: string | undefined
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
	enableCompression: boolean
	enableStreaming: boolean
	maxConcurrentRequests: number
	requestDeduplication: boolean
	responseTransformation: boolean
	metricsCollection: boolean
	metricsBufferSize: number
	compressionThreshold: number
	streamingThreshold: number
}

/**
 * Request queue item
 */
interface QueuedRequest {
	id: string
	executor: () => Promise<any>
	resolve: (value: any) => void
	reject: (error: any) => void
	priority: number
	timestamp: number
	metadata: Record<string, any> | undefined
}

/**
 * Compression utilities
 */
export class CompressionManager {
	private config: PerformanceConfig
	private logger: Logger

	constructor(config: PerformanceConfig, logger: Logger) {
		this.config = config
		this.logger = logger
	}

	/**
	 * Compress request body if applicable
	 */
	async compressRequest(
		body: any,
		contentType: string
	): Promise<{
		body: any
		headers: Record<string, string>
		compressed: boolean
	}> {
		if (!this.config.enableCompression || !this.shouldCompress(body, contentType)) {
			return { body, headers: {}, compressed: false }
		}

		try {
			const compressed = await this.compress(body)
			return {
				body: compressed,
				headers: {
					'Content-Encoding': 'gzip',
					'Content-Type': contentType,
				},
				compressed: true,
			}
		} catch (error) {
			this.logger.warn('Request compression failed, sending uncompressed', { error })
			return { body, headers: {}, compressed: false }
		}
	}

	/**
	 * Decompress response if needed
	 */
	async decompressResponse(response: Response): Promise<Response> {
		const contentEncoding = response.headers.get('content-encoding')

		if (!contentEncoding || !contentEncoding.includes('gzip')) {
			return response
		}

		try {
			// For browsers, the fetch API automatically handles decompression
			// For Node.js, we would need to implement manual decompression
			if (typeof window !== 'undefined') {
				return response
			}

			// Node.js decompression would go here
			return response
		} catch (error) {
			this.logger.warn('Response decompression failed', { error })
			return response
		}
	}

	/**
	 * Check if content should be compressed
	 */
	private shouldCompress(body: any, contentType: string): boolean {
		// Don't compress if body is too small
		const bodySize = this.getBodySize(body)
		if (bodySize < this.config.compressionThreshold) {
			return false
		}

		// Only compress text-based content types
		const compressibleTypes = [
			'application/json',
			'application/xml',
			'text/',
			'application/javascript',
			'application/x-www-form-urlencoded',
		]

		return compressibleTypes.some((type) => contentType.includes(type))
	}

	/**
	 * Compress data using available compression method
	 */
	private async compress(data: any): Promise<any> {
		// In a real implementation, this would use compression libraries
		// For now, we'll simulate compression
		const stringData = typeof data === 'string' ? data : JSON.stringify(data)

		// Browser compression using CompressionStream (if available)
		if (typeof CompressionStream !== 'undefined') {
			const stream = new CompressionStream('gzip')
			const writer = stream.writable.getWriter()
			const reader = stream.readable.getReader()

			writer.write(new TextEncoder().encode(stringData))
			writer.close()

			const chunks: Uint8Array[] = []
			let done = false

			while (!done) {
				const { value, done: readerDone } = await reader.read()
				done = readerDone
				if (value) {
					chunks.push(value)
				}
			}

			// Combine chunks
			const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
			const result = new Uint8Array(totalLength)
			let offset = 0

			for (const chunk of chunks) {
				result.set(chunk, offset)
				offset += chunk.length
			}

			return result
		}

		// Fallback: return original data
		return data
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
}

/**
 * Streaming response manager
 */
export class StreamingManager {
	private config: PerformanceConfig
	private logger: Logger

	constructor(config: PerformanceConfig, logger: Logger) {
		this.config = config
		this.logger = logger
	}

	/**
	 * Check if response should be streamed
	 */
	shouldStream(response: Response, expectedSize?: number): boolean {
		if (!this.config.enableStreaming) {
			return false
		}

		// Check content length
		const contentLength = response.headers.get('content-length')
		if (contentLength) {
			const size = parseInt(contentLength, 10)
			return size > this.config.streamingThreshold
		}

		// Check expected size
		if (expectedSize && expectedSize > this.config.streamingThreshold) {
			return true
		}

		// Check content type for streamable types
		const contentType = response.headers.get('content-type') || ''
		const streamableTypes = [
			'application/octet-stream',
			'application/pdf',
			'text/csv',
			'application/zip',
		]

		return streamableTypes.some((type) => contentType.includes(type))
	}

	/**
	 * Create streaming reader for large responses
	 */
	createStreamReader<T>(response: Response): AsyncIterable<T> {
		if (!response.body) {
			throw new Error('Response body is not available for streaming')
		}

		const reader = response.body.getReader()

		return {
			async *[Symbol.asyncIterator]() {
				try {
					while (true) {
						const { done, value } = await reader.read()
						if (done) break

						// Parse chunk based on content type
						const contentType = response.headers.get('content-type') || ''

						if (contentType.includes('application/json')) {
							// For JSON streams, we'd need to parse line-delimited JSON
							const text = new TextDecoder().decode(value)
							const lines = text.split('\n').filter((line) => line.trim())

							for (const line of lines) {
								try {
									yield JSON.parse(line) as T
								} catch (error) {
									// Log parsing error (logger not available in generator context)
									console.warn('Failed to parse JSON chunk', { error, line })
								}
							}
						} else {
							// For other types, yield raw chunks
							yield value as unknown as T
						}
					}
				} finally {
					reader.releaseLock()
				}
			},
		}
	}

	/**
	 * Process streaming response with backpressure handling
	 */
	async processStream<T>(
		stream: AsyncIterable<T>,
		processor: (chunk: T) => Promise<void> | void,
		options: {
			maxConcurrency?: number
			bufferSize?: number
			onProgress?: (processed: number, total?: number) => void
		} = {}
	): Promise<void> {
		const { maxConcurrency = 5, bufferSize = 100, onProgress } = options

		let processed = 0
		let buffer: T[] = []
		let processing = 0

		const processChunk = async (chunk: T): Promise<void> => {
			processing++
			try {
				await processor(chunk)
				processed++
				onProgress?.(processed)
			} finally {
				processing--
			}
		}

		for await (const chunk of stream) {
			buffer.push(chunk)

			// Process chunks when buffer is full or concurrency allows
			while (buffer.length > 0 && processing < maxConcurrency) {
				const chunkToProcess = buffer.shift()!
				processChunk(chunkToProcess) // Don't await to allow concurrent processing
			}

			// Apply backpressure if buffer is too large
			while (buffer.length >= bufferSize) {
				await new Promise((resolve) => setTimeout(resolve, 10))
			}
		}

		// Wait for remaining chunks to process
		while (processing > 0) {
			await new Promise((resolve) => setTimeout(resolve, 10))
		}
	}
}

/**
 * Request queue manager for concurrent request limiting
 */
export class RequestQueueManager {
	private config: PerformanceConfig
	private logger: Logger
	private activeRequests = new Set<string>()
	private requestQueue: QueuedRequest[] = []
	private isProcessing = false
	private stats = {
		totalRequests: 0,
		completedRequests: 0,
		failedRequests: 0,
		averageWaitTime: 0,
		maxWaitTime: 0,
	}

	constructor(config: PerformanceConfig, logger: Logger) {
		this.config = config
		this.logger = logger
	}

	/**
	 * Add request to queue or execute immediately if capacity allows
	 */
	async enqueue<T>(
		executor: () => Promise<T>,
		options: {
			priority?: number
			metadata?: Record<string, any>
		} = {}
	): Promise<T> {
		const { priority = 0, metadata } = options
		const requestId = this.generateRequestId()

		// If we have capacity, execute immediately
		if (this.activeRequests.size < this.config.maxConcurrentRequests) {
			return this.executeRequest(requestId, executor)
		}

		// Otherwise, add to queue
		return new Promise<T>((resolve, reject) => {
			const queuedRequest: QueuedRequest = {
				id: requestId,
				executor: executor as () => Promise<any>,
				resolve,
				reject,
				priority,
				timestamp: Date.now(),
				metadata,
			}

			this.requestQueue.push(queuedRequest)
			this.sortQueue()
			this.stats.totalRequests++

			this.logger.debug('Request queued', {
				requestId,
				queueLength: this.requestQueue.length,
				activeRequests: this.activeRequests.size,
				priority,
			})

			// Start processing if not already running
			if (!this.isProcessing) {
				this.processQueue()
			}
		})
	}

	/**
	 * Execute a request and manage active request tracking
	 */
	private async executeRequest<T>(requestId: string, executor: () => Promise<T>): Promise<T> {
		this.activeRequests.add(requestId)

		try {
			const result = await executor()
			this.stats.completedRequests++
			return result
		} catch (error) {
			this.stats.failedRequests++
			throw error
		} finally {
			this.activeRequests.delete(requestId)

			// Process next item in queue if available
			if (this.requestQueue.length > 0 && !this.isProcessing) {
				this.processQueue()
			}
		}
	}

	/**
	 * Process queued requests
	 */
	private async processQueue(): Promise<void> {
		if (this.isProcessing || this.requestQueue.length === 0) {
			return
		}

		this.isProcessing = true

		while (
			this.requestQueue.length > 0 &&
			this.activeRequests.size < this.config.maxConcurrentRequests
		) {
			const request = this.requestQueue.shift()!
			const waitTime = Date.now() - request.timestamp

			// Update wait time statistics
			this.stats.averageWaitTime =
				(this.stats.averageWaitTime * this.stats.completedRequests + waitTime) /
				(this.stats.completedRequests + 1)
			this.stats.maxWaitTime = Math.max(this.stats.maxWaitTime, waitTime)

			this.logger.debug('Processing queued request', {
				requestId: request.id,
				waitTime,
				queueLength: this.requestQueue.length,
			})

			// Execute request without awaiting to allow concurrent processing
			this.executeRequest(request.id, request.executor).then(request.resolve).catch(request.reject)
		}

		this.isProcessing = false
	}

	/**
	 * Sort queue by priority (higher priority first)
	 */
	private sortQueue(): void {
		this.requestQueue.sort((a, b) => b.priority - a.priority)
	}

	/**
	 * Get current queue statistics
	 */
	getStats(): {
		activeRequests: number
		queuedRequests: number
		totalRequests: number
		completedRequests: number
		failedRequests: number
		averageWaitTime: number
		maxWaitTime: number
	} {
		return {
			activeRequests: this.activeRequests.size,
			queuedRequests: this.requestQueue.length,
			...this.stats,
		}
	}

	/**
	 * Clear all queued requests
	 */
	clear(): void {
		// Reject all queued requests
		for (const request of this.requestQueue) {
			request.reject(new Error('Request queue cleared'))
		}

		this.requestQueue = []
		this.isProcessing = false
	}

	/**
	 * Generate unique request ID
	 */
	private generateRequestId(): string {
		return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
	}
}

/**
 * Performance metrics collector
 */
export class PerformanceMetricsCollector {
	private config: PerformanceConfig
	private logger: Logger
	private metrics: RequestPerformance[] = []
	private aggregatedMetrics: PerformanceMetrics
	private lastReset = Date.now()

	constructor(config: PerformanceConfig, logger: Logger) {
		this.config = config
		this.logger = logger
		this.aggregatedMetrics = this.createEmptyMetrics()
	}

	/**
	 * Start tracking a request
	 */
	startRequest(requestId: string, endpoint: string, method: string): void {
		if (!this.config.metricsCollection) return

		const performance: RequestPerformance = {
			requestId,
			endpoint,
			method,
			startTime: Date.now(),
		}

		this.metrics.push(performance)
		this.trimMetricsBuffer()
	}

	/**
	 * Complete tracking a request
	 */
	completeRequest(
		requestId: string,
		options: {
			status?: number
			bytesTransferred?: number
			compressed?: boolean
			cached?: boolean
			error?: string
		} = {}
	): void {
		if (!this.config.metricsCollection) return

		let performance = this.metrics.find((m) => m.requestId === requestId)

		// If performance tracking wasn't started, create a minimal entry
		if (!performance) {
			performance = {
				requestId,
				endpoint: 'unknown',
				method: 'unknown',
				startTime: Date.now(),
			}
			this.metrics.push(performance)
		}

		const endTime = Date.now()
		performance.endTime = endTime
		performance.duration = endTime - performance.startTime
		performance.status = options.status ?? undefined
		performance.bytesTransferred = options.bytesTransferred ?? undefined
		performance.compressed = options.compressed ?? undefined
		performance.cached = options.cached ?? undefined
		performance.error = options.error ?? undefined

		this.updateAggregatedMetrics(performance)
	}

	/**
	 * Get current performance metrics
	 */
	getMetrics(): PerformanceMetrics {
		return { ...this.aggregatedMetrics }
	}

	/**
	 * Get detailed request metrics
	 */
	getDetailedMetrics(): RequestPerformance[] {
		return [...this.metrics]
	}

	/**
	 * Reset metrics collection
	 */
	reset(): void {
		this.metrics = []
		this.aggregatedMetrics = this.createEmptyMetrics()
		this.lastReset = Date.now()
	}

	/**
	 * Get metrics for a specific time period
	 */
	getMetricsForPeriod(startTime: number, endTime: number): RequestPerformance[] {
		return this.metrics.filter(
			(m) => m.startTime >= startTime && (m.endTime || m.startTime) <= endTime
		)
	}

	/**
	 * Update aggregated metrics with new request data
	 */
	private updateAggregatedMetrics(performance: RequestPerformance): void {
		const metrics = this.aggregatedMetrics
		const duration = performance.duration || 0

		metrics.requestCount++
		metrics.totalDuration += duration
		metrics.averageDuration =
			metrics.requestCount > 0 ? metrics.totalDuration / metrics.requestCount : 0

		if (duration > 0) {
			if (metrics.minDuration === 0 || duration < metrics.minDuration) {
				metrics.minDuration = duration
			}

			if (duration > metrics.maxDuration) {
				metrics.maxDuration = duration
			}
		}

		if (performance.error) {
			metrics.errorCount++
		} else {
			metrics.successCount++
		}

		if (performance.bytesTransferred) {
			metrics.bytesTransferred += performance.bytesTransferred
		}

		// Update cache hit rate
		const cachedRequests = this.metrics.filter((m) => m.cached).length
		metrics.cacheHitRate = metrics.requestCount > 0 ? cachedRequests / metrics.requestCount : 0

		// Update compression ratio
		const compressedRequests = this.metrics.filter((m) => m.compressed).length
		metrics.compressionRatio =
			metrics.requestCount > 0 ? compressedRequests / metrics.requestCount : 0

		metrics.timestamp = Date.now()
	}

	/**
	 * Create empty metrics object
	 */
	private createEmptyMetrics(): PerformanceMetrics {
		return {
			requestCount: 0,
			totalDuration: 0,
			averageDuration: 0,
			minDuration: 0,
			maxDuration: 0,
			successCount: 0,
			errorCount: 0,
			bytesTransferred: 0,
			compressionRatio: 0,
			concurrentRequests: 0,
			queuedRequests: 0,
			cacheHitRate: 0,
			timestamp: Date.now(),
		}
	}

	/**
	 * Trim metrics buffer to prevent memory issues
	 */
	private trimMetricsBuffer(): void {
		if (this.metrics.length > this.config.metricsBufferSize) {
			const removeCount = this.metrics.length - this.config.metricsBufferSize
			this.metrics.splice(0, removeCount)
		}
	}
}

/**
 * Request deduplication manager
 */
export class RequestDeduplicationManager {
	private config: PerformanceConfig
	private logger: Logger
	private pendingRequests = new Map<string, Promise<any>>()
	private requestHashes = new Map<string, string>()

	constructor(config: PerformanceConfig, logger: Logger) {
		this.config = config
		this.logger = logger
	}

	/**
	 * Execute request with deduplication
	 */
	async execute<T>(
		key: string,
		executor: () => Promise<T>,
		options: {
			ttl?: number
		} = {}
	): Promise<T> {
		if (!this.config.requestDeduplication) {
			return executor()
		}

		const { ttl = 5000 } = options // 5 second default TTL

		// Check if identical request is already pending
		if (this.pendingRequests.has(key)) {
			this.logger.debug('Request deduplicated', { key })
			return this.pendingRequests.get(key)!
		}

		// Execute request and cache promise
		const promise = executor()
		this.pendingRequests.set(key, promise)

		// Set TTL for cleanup
		setTimeout(() => {
			this.pendingRequests.delete(key)
			this.requestHashes.delete(key)
		}, ttl)

		try {
			const result = await promise
			return result
		} catch (error) {
			// Remove from cache on error
			this.pendingRequests.delete(key)
			this.requestHashes.delete(key)
			throw error
		}
	}

	/**
	 * Generate deduplication key for request
	 */
	generateKey(endpoint: string, method: string, body?: any, query?: any): string {
		const data = {
			endpoint,
			method,
			body: body ? JSON.stringify(body) : null,
			query: query ? JSON.stringify(query) : null,
		}

		return this.hashObject(data)
	}

	/**
	 * Clear all pending requests
	 */
	clear(): void {
		this.pendingRequests.clear()
		this.requestHashes.clear()
	}

	/**
	 * Get deduplication statistics
	 */
	getStats(): {
		pendingRequests: number
		cachedHashes: number
	} {
		return {
			pendingRequests: this.pendingRequests.size,
			cachedHashes: this.requestHashes.size,
		}
	}

	/**
	 * Simple object hashing
	 */
	private hashObject(obj: any): string {
		const str = JSON.stringify(obj)
		let hash = 0

		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i)
			hash = (hash << 5) - hash + char
			hash = hash & hash // Convert to 32-bit integer
		}

		return Math.abs(hash).toString(36)
	}
}

/**
 * Main performance manager that orchestrates all performance features
 */
export class PerformanceManager {
	private config: PerformanceConfig
	private logger: Logger
	private compressionManager: CompressionManager
	private streamingManager: StreamingManager
	private queueManager: RequestQueueManager
	private metricsCollector: PerformanceMetricsCollector
	private deduplicationManager: RequestDeduplicationManager

	constructor(config: PerformanceConfig, logger: Logger) {
		this.config = config
		this.logger = logger

		this.compressionManager = new CompressionManager(config, logger)
		this.streamingManager = new StreamingManager(config, logger)
		this.queueManager = new RequestQueueManager(config, logger)
		this.metricsCollector = new PerformanceMetricsCollector(config, logger)
		this.deduplicationManager = new RequestDeduplicationManager(config, logger)
	}

	/**
	 * Get compression manager
	 */
	getCompressionManager(): CompressionManager {
		return this.compressionManager
	}

	/**
	 * Get streaming manager
	 */
	getStreamingManager(): StreamingManager {
		return this.streamingManager
	}

	/**
	 * Get queue manager
	 */
	getQueueManager(): RequestQueueManager {
		return this.queueManager
	}

	/**
	 * Get metrics collector
	 */
	getMetricsCollector(): PerformanceMetricsCollector {
		return this.metricsCollector
	}

	/**
	 * Get deduplication manager
	 */
	getDeduplicationManager(): RequestDeduplicationManager {
		return this.deduplicationManager
	}

	/**
	 * Get comprehensive performance statistics
	 */
	getStats(): {
		metrics: PerformanceMetrics
		queue: ReturnType<RequestQueueManager['getStats']>
		deduplication: ReturnType<RequestDeduplicationManager['getStats']>
	} {
		return {
			metrics: this.metricsCollector.getMetrics(),
			queue: this.queueManager.getStats(),
			deduplication: this.deduplicationManager.getStats(),
		}
	}

	/**
	 * Reset all performance tracking
	 */
	reset(): void {
		this.metricsCollector.reset()
		this.queueManager.clear()
		this.deduplicationManager.clear()
	}

	/**
	 * Update configuration
	 */
	updateConfig(newConfig: Partial<PerformanceConfig>): void {
		this.config = { ...this.config, ...newConfig }

		// Recreate managers with new config if needed
		// In a real implementation, we might want to update existing managers
		// rather than recreating them
	}
}
