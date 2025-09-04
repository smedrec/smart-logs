import { BatchingConfig } from '../core/config'

/**
 * Interface for a request that can be batched
 */
export interface BatchableRequest {
	endpoint: string
	options: BatchRequestOptions
	resolve: (value: any) => void
	reject: (error: Error) => void
	timestamp: number
	requestId: string
}

/**
 * Interface for batch request options
 */
export interface BatchRequestOptions {
	method?: string
	headers?: Record<string, string>
	body?: any
	query?: Record<string, any>
	signal?: AbortSignal
	responseType?: 'json' | 'blob' | 'stream'
}

/**
 * Interface for batch execution result
 */
export interface BatchExecutionResult {
	results: any[]
	errors: (Error | null)[]
	executionTime: number
	batchSize: number
}

/**
 * Interface for request deduplication key
 */
export interface DeduplicationKey {
	endpoint: string
	method: string
	body: string
	query: string
}

/**
 * BatchManager handles request batching and deduplication to optimize API calls
 *
 * Features:
 * - Groups similar requests into batches
 * - Prevents duplicate API calls through deduplication
 * - Executes batches with configurable timeout and size limits
 * - Distributes results to individual promises
 */
export class BatchManager {
	private config: BatchingConfig
	private batches: Map<string, BatchableRequest[]> = new Map()
	private timers: Map<string, NodeJS.Timeout> = new Map()
	private pendingRequests: Map<string, Promise<any>> = new Map()
	private requestExecutor: (endpoint: string, options: BatchRequestOptions) => Promise<any>

	constructor(
		config: BatchingConfig,
		requestExecutor: (endpoint: string, options: BatchRequestOptions) => Promise<any>
	) {
		this.config = config
		this.requestExecutor = requestExecutor
	}

	/**
	 * Adds a request to a batch or returns existing promise for duplicate requests
	 */
	async addToBatch<T>(endpoint: string, options: BatchRequestOptions): Promise<T> {
		if (!this.config.enabled) {
			throw new Error('Batching is disabled')
		}

		// Check for request deduplication
		const deduplicationKey = this.generateDeduplicationKey(endpoint, options)
		const existingRequest = this.pendingRequests.get(deduplicationKey)
		if (existingRequest) {
			return existingRequest as Promise<T>
		}

		// Check if endpoint is batchable
		if (!this.isBatchableEndpoint(endpoint)) {
			// Execute immediately for non-batchable endpoints
			const promise = this.requestExecutor(endpoint, options)
			this.pendingRequests.set(deduplicationKey, promise)

			// Clean up after completion
			promise.finally(() => {
				this.pendingRequests.delete(deduplicationKey)
			})

			return promise as Promise<T>
		}

		const batchKey = this.generateBatchKey(endpoint, options)
		const batch = this.batches.get(batchKey) || []

		const promise = new Promise<T>((resolve, reject) => {
			const request: BatchableRequest = {
				endpoint,
				options,
				resolve,
				reject,
				timestamp: Date.now(),
				requestId: this.generateRequestId(),
			}

			batch.push(request)
			this.batches.set(batchKey, batch)

			// Set timer for batch execution if not already set
			if (!this.timers.has(batchKey)) {
				const timer = setTimeout(() => {
					this.executeBatch(batchKey)
				}, this.config.batchTimeoutMs)
				this.timers.set(batchKey, timer)
			}

			// Execute immediately if batch is full
			if (batch.length >= this.config.maxBatchSize) {
				// Clear timer since we're executing immediately
				const timer = this.timers.get(batchKey)
				if (timer) {
					clearTimeout(timer)
					this.timers.delete(batchKey)
				}
				// Execute batch asynchronously to avoid blocking
				setImmediate(() => this.executeBatch(batchKey))
			}
		})

		// Store the promise for deduplication
		this.pendingRequests.set(deduplicationKey, promise)

		return promise
	}

	/**
	 * Executes a batch of requests
	 */
	private async executeBatch(batchKey: string): Promise<void> {
		const batch = this.batches.get(batchKey)
		if (!batch || batch.length === 0) return

		// Clear timer and batch
		const timer = this.timers.get(batchKey)
		if (timer) {
			clearTimeout(timer)
			this.timers.delete(batchKey)
		}
		this.batches.delete(batchKey)

		const startTime = Date.now()

		try {
			// Check if we can execute as a true batch request
			if (this.canExecuteAsBatch(batch)) {
				await this.executeBatchRequest(batch)
			} else {
				// Execute individual requests concurrently
				await this.executeConcurrentRequests(batch)
			}
		} catch (error) {
			// If batch execution fails, reject all promises
			batch.forEach((request) => {
				const deduplicationKey = this.generateDeduplicationKey(request.endpoint, request.options)
				this.pendingRequests.delete(deduplicationKey)
				request.reject(error as Error)
			})
		}

		const executionTime = Date.now() - startTime
		console.debug(`Batch executed: ${batch.length} requests in ${executionTime}ms`)
	}

	/**
	 * Executes requests as a true batch API call
	 */
	private async executeBatchRequest(batch: BatchableRequest[]): Promise<void> {
		// For audit events, we can use bulk create endpoint if all requests are identical
		if (this.isBulkCreateBatch(batch) && this.canUseBulkCreate(batch)) {
			await this.executeBulkCreateBatch(batch)
			return
		}

		// For other endpoints, fall back to concurrent execution
		await this.executeConcurrentRequests(batch)
	}

	/**
	 * Executes requests concurrently
	 */
	private async executeConcurrentRequests(batch: BatchableRequest[]): Promise<void> {
		const promises = batch.map(async (request) => {
			try {
				const result = await this.requestExecutor(request.endpoint, request.options)
				const deduplicationKey = this.generateDeduplicationKey(request.endpoint, request.options)
				this.pendingRequests.delete(deduplicationKey)
				request.resolve(result)
			} catch (error) {
				const deduplicationKey = this.generateDeduplicationKey(request.endpoint, request.options)
				this.pendingRequests.delete(deduplicationKey)
				request.reject(error as Error)
			}
		})

		await Promise.allSettled(promises)
	}

	/**
	 * Executes a bulk create batch for audit events
	 */
	private async executeBulkCreateBatch(batch: BatchableRequest[]): Promise<void> {
		try {
			// Extract event data from batch requests
			const events = batch.map((request) => request.options.body)

			// Execute bulk create request
			const bulkResult = await this.requestExecutor('/audit/events/bulk', {
				method: 'POST',
				body: { events },
			})

			// Distribute results to individual promises
			batch.forEach((request, index) => {
				const deduplicationKey = this.generateDeduplicationKey(request.endpoint, request.options)
				this.pendingRequests.delete(deduplicationKey)

				if (bulkResult && bulkResult.results && bulkResult.results[index]) {
					request.resolve(bulkResult.results[index])
				} else if (bulkResult && bulkResult.errors && bulkResult.errors[index]) {
					request.reject(new Error(bulkResult.errors[index]))
				} else {
					request.reject(new Error('Unknown error in bulk operation'))
				}
			})
		} catch (error) {
			// If bulk request fails, reject all promises
			batch.forEach((request) => {
				const deduplicationKey = this.generateDeduplicationKey(request.endpoint, request.options)
				this.pendingRequests.delete(deduplicationKey)
				request.reject(error as Error)
			})
		}
	}

	/**
	 * Checks if a batch can be executed as a true batch request
	 */
	private canExecuteAsBatch(batch: BatchableRequest[]): boolean {
		// Check if all requests are for the same endpoint and method
		if (batch.length === 0) return false

		const firstRequest = batch[0]!
		return batch.every(
			(request) =>
				request.endpoint === firstRequest.endpoint &&
				request.options.method === firstRequest.options.method
		)
	}

	/**
	 * Checks if a batch is for bulk create operations
	 */
	private isBulkCreateBatch(batch: BatchableRequest[]): boolean {
		return batch.every(
			(request) => request.endpoint === '/audit/events' && request.options.method === 'POST'
		)
	}

	/**
	 * Checks if we can use bulk create for this batch
	 * Only use bulk create when we have a proper bulk result structure
	 */
	private canUseBulkCreate(batch: BatchableRequest[]): boolean {
		// For now, only use bulk create when explicitly testing it
		// In real scenarios, this would check if the server supports bulk operations
		return false
	}

	/**
	 * Checks if an endpoint supports batching
	 */
	private isBatchableEndpoint(endpoint: string): boolean {
		return this.config.batchableEndpoints.some((pattern) => {
			// Support glob patterns
			if (pattern.includes('*')) {
				const regex = new RegExp(pattern.replace(/\*/g, '.*'))
				return regex.test(endpoint)
			}
			return endpoint === pattern
		})
	}

	/**
	 * Generates a batch key for grouping similar requests
	 */
	private generateBatchKey(endpoint: string, options: BatchRequestOptions): string {
		const method = options.method || 'GET'
		const query = options.query ? JSON.stringify(options.query) : ''
		return `${endpoint}:${method}:${query}`
	}

	/**
	 * Generates a deduplication key for identifying duplicate requests
	 */
	private generateDeduplicationKey(endpoint: string, options: BatchRequestOptions): string {
		const method = options.method || 'GET'
		const body = options.body ? JSON.stringify(options.body) : ''
		const query = options.query ? JSON.stringify(options.query) : ''
		return `${endpoint}:${method}:${body}:${query}`
	}

	/**
	 * Generates a unique request ID
	 */
	private generateRequestId(): string {
		return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Flushes all pending batches immediately
	 */
	async flushAll(): Promise<void> {
		const batchKeys = Array.from(this.batches.keys())
		const flushPromises = batchKeys.map((batchKey) => this.executeBatch(batchKey))
		await Promise.allSettled(flushPromises)
	}

	/**
	 * Flushes a specific batch immediately
	 */
	async flushBatch(batchKey: string): Promise<void> {
		if (this.batches.has(batchKey)) {
			await this.executeBatch(batchKey)
		}
	}

	/**
	 * Gets statistics about current batching state
	 */
	getStats(): BatchingStats {
		const totalPendingRequests = Array.from(this.batches.values()).reduce(
			(sum, batch) => sum + batch.length,
			0
		)

		const batchSizes = Array.from(this.batches.values()).map((batch) => batch.length)
		const averageBatchSize =
			batchSizes.length > 0
				? batchSizes.reduce((sum, size) => sum + size, 0) / batchSizes.length
				: 0

		return {
			activeBatches: this.batches.size,
			totalPendingRequests,
			averageBatchSize,
			pendingDeduplicatedRequests: this.pendingRequests.size,
			oldestPendingRequestAge: this.getOldestPendingRequestAge(),
		}
	}

	/**
	 * Gets the age of the oldest pending request in milliseconds
	 */
	private getOldestPendingRequestAge(): number {
		let oldestTimestamp = Date.now()
		let hasRequests = false

		Array.from(this.batches.values()).forEach((batch) => {
			for (const request of batch) {
				hasRequests = true
				if (request.timestamp < oldestTimestamp) {
					oldestTimestamp = request.timestamp
				}
			}
		})

		return hasRequests ? Date.now() - oldestTimestamp : 0
	}

	/**
	 * Clears all pending batches and rejects their promises
	 */
	clear(): void {
		// Clear all timers
		Array.from(this.timers.values()).forEach((timer) => {
			clearTimeout(timer)
		})
		this.timers.clear()

		// Reject all pending requests
		Array.from(this.batches.values()).forEach((batch) => {
			for (const request of batch) {
				const deduplicationKey = this.generateDeduplicationKey(request.endpoint, request.options)
				this.pendingRequests.delete(deduplicationKey)
				request.reject(new Error('Batch manager cleared'))
			}
		})

		// Clear all batches
		this.batches.clear()
		this.pendingRequests.clear()
	}

	/**
	 * Updates the batching configuration
	 */
	updateConfig(newConfig: Partial<BatchingConfig>): void {
		this.config = { ...this.config, ...newConfig }
	}
}

/**
 * Interface for batching statistics
 */
export interface BatchingStats {
	activeBatches: number
	totalPendingRequests: number
	averageBatchSize: number
	pendingDeduplicatedRequests: number
	oldestPendingRequestAge: number
}
