import { registerForShutdown } from './shutdown-manager.js'

import type { BatchConfig, BatchManager } from '../types/batch.js'
import type { LogEntry } from '../types/log-entry.js'

/**
 * BatchManager implementation with proper queuing and backpressure handling
 * Addresses requirements 2.1, 2.2, 2.5, 3.4, 8.1
 */
export class DefaultBatchManager implements BatchManager {
	private readonly queue: LogEntry[] = []
	private readonly processingPromises = new Set<Promise<void>>()
	private flushTimer: NodeJS.Timeout | null = null
	private isClosing = false
	private readonly config: BatchConfig

	constructor(
		config: Partial<BatchConfig>,
		private readonly processor: (entries: LogEntry[]) => Promise<void>,
		name = 'BatchManager'
	) {
		this.config = {
			maxSize: config.maxSize || 100,
			timeoutMs: config.timeoutMs || 5000,
			maxConcurrency: config.maxConcurrency || 10,
			maxQueueSize: config.maxQueueSize || 10000,
		}

		// Start the flush timer
		this.scheduleFlush()

		// Register for graceful shutdown
		registerForShutdown({
			name: `BatchManager-${name}`,
			cleanup: () => this.close(),
			priority: 10, // High priority - flush batches early
		})
	}

	/**
	 * Add a log entry to the batch queue with backpressure handling
	 */
	async add(entry: LogEntry): Promise<void> {
		if (this.isClosing) {
			throw new Error('BatchManager is closing, cannot add new entries')
		}

		// Implement backpressure - reject if queue is too full
		if (this.queue.length >= this.config.maxQueueSize) {
			throw new Error(
				`Queue is full (${this.queue.length}/${this.config.maxQueueSize}). ` +
					'Consider increasing maxQueueSize or reducing log volume.'
			)
		}

		// Add entry to queue
		this.queue.push(entry)

		// Check if we should flush immediately due to batch size
		if (this.queue.length >= this.config.maxSize) {
			await this.flushBatch()
		}
	}

	/**
	 * Flush all pending entries and wait for completion
	 */
	async flush(): Promise<void> {
		// Cancel the scheduled flush since we're doing it now
		if (this.flushTimer) {
			clearTimeout(this.flushTimer)
			this.flushTimer = null
		}

		// Flush any remaining entries
		if (this.queue.length > 0) {
			await this.flushBatch()
		}

		// Wait for all processing operations to complete
		await Promise.all(Array.from(this.processingPromises))
	}

	/**
	 * Close the batch manager and cleanup resources
	 */
	async close(): Promise<void> {
		this.isClosing = true

		// Cancel the flush timer
		if (this.flushTimer) {
			clearTimeout(this.flushTimer)
			this.flushTimer = null
		}

		// Flush all remaining entries
		await this.flush()
	}

	/**
	 * Get the number of pending entries in the queue
	 */
	getPendingCount(): number {
		return this.queue.length + this.processingPromises.size
	}

	/**
	 * Check if the batch manager is healthy
	 */
	isHealthy(): boolean {
		return (
			!this.isClosing &&
			this.queue.length < this.config.maxQueueSize * 0.9 && // Not near queue limit
			this.processingPromises.size < this.config.maxConcurrency * 2 // Not overwhelmed with processing
		)
	}

	/**
	 * Flush the current batch of entries
	 */
	private async flushBatch(): Promise<void> {
		if (this.queue.length === 0) {
			return
		}

		// Check concurrency limits - wait if we're at the limit
		while (this.processingPromises.size >= this.config.maxConcurrency) {
			// Wait for at least one operation to complete before starting a new one
			await Promise.race(Array.from(this.processingPromises))
		}

		// Extract entries to process
		const entriesToProcess = this.queue.splice(0, this.config.maxSize)

		// Create processing promise
		const processingPromise = this.processEntries(entriesToProcess)

		// Track the promise
		this.processingPromises.add(processingPromise)

		// Clean up when done
		processingPromise
			.catch((error) => {
				// Log processing errors but don't let them crash the application
				console.error('Batch processing failed:', error)
			})
			.finally(() => {
				this.processingPromises.delete(processingPromise)
			})

		// Don't await here to allow concurrent processing
	}

	/**
	 * Process a batch of entries with proper error handling
	 */
	private async processEntries(entries: LogEntry[]): Promise<void> {
		if (entries.length === 0) {
			return
		}

		try {
			await this.processor(entries)
		} catch (error) {
			// Create a more detailed error for batch processing failures
			const batchError = new Error(
				`Failed to process batch of ${entries.length} entries: ${
					error instanceof Error ? error.message : String(error)
				}`
			)

			// Attach original error for debugging
			if (error instanceof Error) {
				batchError.cause = error
			}

			throw batchError
		}
	}

	/**
	 * Schedule the next flush operation
	 */
	private scheduleFlush(): void {
		if (this.isClosing || this.flushTimer) {
			return
		}

		this.flushTimer = setTimeout(() => {
			this.flushTimer = null
			this.flushBatch()
				.catch((error) => {
					console.error('Scheduled flush failed:', error)
				})
				.finally(() => {
					// Schedule the next flush if not closing
					if (!this.isClosing) {
						this.scheduleFlush()
					}
				})
		}, this.config.timeoutMs)
	}
}
