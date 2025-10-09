import { EventEmitter } from 'node:events'

import { getResourceManager, shouldApplyBackpressure } from './resource-manager.js'

/**
 * Memory-aware queue with backpressure handling
 * Addresses requirements 8.3, 8.5: Memory leak prevention and backpressure handling
 */

export interface QueueConfig {
	/** Maximum number of items in the queue */
	maxSize: number
	/** Maximum memory usage in bytes before applying backpressure */
	maxMemoryBytes: number
	/** Interval for memory monitoring in milliseconds */
	monitoringIntervalMs: number
	/** Enable automatic queue size adjustment based on memory pressure */
	enableAdaptiveSize: boolean
}

export interface QueueItem<T> {
	/** The queued item */
	data: T
	/** Timestamp when item was added */
	timestamp: Date
	/** Estimated memory size in bytes */
	estimatedSize: number
}

/**
 * A queue that monitors memory usage and applies backpressure when needed
 */
export class MemoryAwareQueue<T> extends EventEmitter {
	private readonly items: QueueItem<T>[] = []
	private readonly config: QueueConfig
	private totalEstimatedSize = 0
	private monitoringTimer: NodeJS.Timeout | null = null
	private isClosing = false

	constructor(config: Partial<QueueConfig> = {}) {
		super()

		this.config = {
			maxSize: config.maxSize || 10000,
			maxMemoryBytes: config.maxMemoryBytes || 100 * 1024 * 1024, // 100MB
			monitoringIntervalMs: config.monitoringIntervalMs || 5000, // 5 seconds
			enableAdaptiveSize: config.enableAdaptiveSize !== false,
		}

		this.startMonitoring()
	}

	/**
	 * Add an item to the queue with backpressure checking
	 */
	enqueue(data: T): boolean {
		if (this.isClosing) {
			return false
		}

		// Check if we should apply backpressure
		if (this.shouldRejectItem()) {
			this.emit('backpressure', {
				queueSize: this.items.length,
				memoryUsage: this.totalEstimatedSize,
				reason: 'queue_full_or_memory_pressure',
			})
			return false
		}

		const estimatedSize = this.estimateItemSize(data)
		const item: QueueItem<T> = {
			data,
			timestamp: new Date(),
			estimatedSize,
		}

		this.items.push(item)
		this.totalEstimatedSize += estimatedSize

		this.emit('itemAdded', {
			queueSize: this.items.length,
			memoryUsage: this.totalEstimatedSize,
		})

		return true
	}

	/**
	 * Remove and return the oldest item from the queue
	 */
	dequeue(): T | undefined {
		const item = this.items.shift()
		if (item) {
			this.totalEstimatedSize -= item.estimatedSize
			this.emit('itemRemoved', {
				queueSize: this.items.length,
				memoryUsage: this.totalEstimatedSize,
			})
			return item.data
		}
		return undefined
	}

	/**
	 * Remove and return multiple items from the queue
	 */
	dequeueBatch(maxItems: number): T[] {
		const batch: T[] = []
		let removedSize = 0

		for (let i = 0; i < maxItems && this.items.length > 0; i++) {
			const item = this.items.shift()!
			batch.push(item.data)
			removedSize += item.estimatedSize
		}

		this.totalEstimatedSize -= removedSize

		if (batch.length > 0) {
			this.emit('batchRemoved', {
				batchSize: batch.length,
				queueSize: this.items.length,
				memoryUsage: this.totalEstimatedSize,
			})
		}

		return batch
	}

	/**
	 * Peek at the oldest item without removing it
	 */
	peek(): T | undefined {
		return this.items[0]?.data
	}

	/**
	 * Get the current queue size
	 */
	size(): number {
		return this.items.length
	}

	/**
	 * Check if the queue is empty
	 */
	isEmpty(): boolean {
		return this.items.length === 0
	}

	/**
	 * Get queue statistics
	 */
	getStats(): {
		size: number
		estimatedMemoryBytes: number
		oldestItemAge: number | null
		averageItemSize: number
	} {
		const oldestItem = this.items[0]
		const oldestItemAge = oldestItem ? Date.now() - oldestItem.timestamp.getTime() : null
		const averageItemSize = this.items.length > 0 ? this.totalEstimatedSize / this.items.length : 0

		return {
			size: this.items.length,
			estimatedMemoryBytes: this.totalEstimatedSize,
			oldestItemAge,
			averageItemSize,
		}
	}

	/**
	 * Clear all items from the queue
	 */
	clear(): void {
		const clearedCount = this.items.length
		this.items.length = 0
		this.totalEstimatedSize = 0

		if (clearedCount > 0) {
			this.emit('queueCleared', { clearedCount })
		}
	}

	/**
	 * Remove old items based on age
	 */
	removeOldItems(maxAgeMs: number): number {
		const cutoffTime = Date.now() - maxAgeMs
		let removedCount = 0
		let removedSize = 0

		while (this.items.length > 0 && this.items[0].timestamp.getTime() < cutoffTime) {
			const item = this.items.shift()!
			removedCount++
			removedSize += item.estimatedSize
		}

		this.totalEstimatedSize -= removedSize

		if (removedCount > 0) {
			this.emit('oldItemsRemoved', {
				removedCount,
				queueSize: this.items.length,
				memoryUsage: this.totalEstimatedSize,
			})
		}

		return removedCount
	}

	/**
	 * Close the queue and cleanup resources
	 */
	async close(): Promise<void> {
		this.isClosing = true
		this.stopMonitoring()
		this.clear()
		this.removeAllListeners()
	}

	/**
	 * Check if an item should be rejected due to backpressure
	 */
	private shouldRejectItem(): boolean {
		// Check queue size limit
		if (this.items.length >= this.config.maxSize) {
			return true
		}

		// Check memory limit
		if (this.totalEstimatedSize >= this.config.maxMemoryBytes) {
			return true
		}

		// Check global resource manager backpressure
		if (shouldApplyBackpressure()) {
			return true
		}

		return false
	}

	/**
	 * Estimate the memory size of an item
	 */
	private estimateItemSize(data: T): number {
		try {
			// Simple estimation based on JSON serialization
			const serialized = JSON.stringify(data)
			return Buffer.byteLength(serialized, 'utf8')
		} catch {
			// If serialization fails, use a default estimate
			return 1024 // 1KB default
		}
	}

	/**
	 * Start memory monitoring
	 */
	private startMonitoring(): void {
		this.monitoringTimer = setInterval(() => {
			if (!this.isClosing) {
				this.checkMemoryPressure()
			}
		}, this.config.monitoringIntervalMs)
	}

	/**
	 * Stop memory monitoring
	 */
	private stopMonitoring(): void {
		if (this.monitoringTimer) {
			clearInterval(this.monitoringTimer)
			this.monitoringTimer = null
		}
	}

	/**
	 * Check memory pressure and adjust queue size if needed
	 */
	private checkMemoryPressure(): void {
		const resourceManager = getResourceManager()
		const memStats = resourceManager.getMemoryStats()

		// Check if we're using too much memory: compute used/total ratio if available
		const heapTotal = memStats.heapTotal || 0
		const memoryPressureRatio = heapTotal > 0 ? memStats.heapUsed / heapTotal : 0

		if (memoryPressureRatio > 0.8 && this.config.enableAdaptiveSize) {
			// Remove old items to reduce memory pressure
			const removedCount = this.removeOldItems(30000) // Remove items older than 30 seconds
			if (removedCount > 0) {
				this.emit('memoryPressureCleanup', {
					removedCount,
					memoryPressureRatio,
					queueSize: this.items.length,
				})
			}
		}

		// Emit memory pressure warning
		if (this.totalEstimatedSize > this.config.maxMemoryBytes * 0.8) {
			this.emit('memoryPressureWarning', {
				currentUsage: this.totalEstimatedSize,
				maxUsage: this.config.maxMemoryBytes,
				queueSize: this.items.length,
			})
		}
	}
}

/**
 * Factory function to create a memory-aware queue with default configuration
 */
export function createMemoryAwareQueue<T>(config?: Partial<QueueConfig>): MemoryAwareQueue<T> {
	return new MemoryAwareQueue<T>(config)
}
