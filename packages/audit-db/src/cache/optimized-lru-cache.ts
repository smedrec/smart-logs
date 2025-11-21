/**
 * Optimized LRU Cache implementation with O(1) operations
 * Addresses the O(N) complexity issues identified in the code review
 */

import { LoggingConfig, StructuredLogger } from '@repo/logs'

import type { IQueryCache, QueryCacheStats } from './cache-factory.js'

export interface CacheNode<T = any> {
	key: string
	value: T
	timestamp: number
	ttl: number
	hits: number
	size: number
	prev: CacheNode<T> | null
	next: CacheNode<T> | null
}

export interface OptimizedLRUConfig {
	maxSizeMB: number
	defaultTTL: number
	keyPrefix: string
	enabled: boolean
	maxKeys: number
	cleanupInterval: number
}

export interface CacheMetrics {
	totalOperations: number
	hits: number
	misses: number
	evictions: number
	cleanups: number
	memoryUsageBytes: number
	avgOperationTime: number
}

/**
 * High-performance LRU cache with O(1) operations using HashMap + Doubly Linked List
 */
export class OptimizedLRUCache<T = any> implements IQueryCache {
	private readonly keyMap = new Map<string, CacheNode<T>>()
	private readonly head: CacheNode<T>
	private readonly tail: CacheNode<T>
	private currentSizeBytes = 0
	private metrics: CacheMetrics
	private cleanupTimer: NodeJS.Timeout | null = null
	private readonly logger: StructuredLogger

	constructor(private config: OptimizedLRUConfig, loggerConfig: LoggingConfig) {
		// Initialize Structured Logger
		this.logger = new StructuredLogger({
			...loggerConfig,
			service: '@repo/audit-db - OptimizedLRUCache',
		})

		// Initialize dummy head and tail nodes for easier list manipulation
		this.head = {
			key: '__head__',
			value: null as T,
			timestamp: 0,
			ttl: 0,
			hits: 0,
			size: 0,
			prev: null,
			next: null,
		}

		this.tail = {
			key: '__tail__',
			value: null as T,
			timestamp: 0,
			ttl: 0,
			hits: 0,
			size: 0,
			prev: null,
			next: null,
		}

		// Link head and tail
		this.head.next = this.tail
		this.tail.prev = this.head

		// Initialize metrics
		this.metrics = {
			totalOperations: 0,
			hits: 0,
			misses: 0,
			evictions: 0,
			cleanups: 0,
			memoryUsageBytes: 0,
			avgOperationTime: 0,
		}

		// Start cleanup timer if enabled
		if (this.config.enabled && this.config.cleanupInterval > 0) {
			this.startCleanupTimer()
		}
	}

	/**
	 * Get value from cache - O(1) operation
	 */
	async get<U = T>(key: string): Promise<U | null> {
		const startTime = performance.now()
		this.metrics.totalOperations++

		if (!this.config.enabled) {
			this.recordOperationTime(startTime)
			return null
		}

		const fullKey = `${this.config.keyPrefix}:${key}`
		const node = this.keyMap.get(fullKey)

		if (!node) {
			this.metrics.misses++
			this.recordOperationTime(startTime)
			return null
		}

		// Check TTL
		if (this.isExpired(node)) {
			this.removeNode(node)
			this.keyMap.delete(fullKey)
			this.currentSizeBytes -= node.size
			this.metrics.misses++
			this.recordOperationTime(startTime)
			return null
		}

		// Move to front (most recently used) - O(1)
		this.moveToFront(node)
		node.hits++

		this.metrics.hits++
		this.recordOperationTime(startTime)

		return node.value as unknown as U
	}

	/**
	 * Set value in cache - O(1) operation
	 */
	async set<U = T>(key: string, value: U, ttlSeconds?: number): Promise<void> {
		const startTime = performance.now()
		this.metrics.totalOperations++

		if (!this.config.enabled) {
			this.recordOperationTime(startTime)
			return
		}

		const fullKey = `${this.config.keyPrefix}:${key}`
		const ttl = (ttlSeconds || this.config.defaultTTL) * 1000 // Convert to milliseconds
		const size = this.calculateSize(value)

		// Check if key already exists
		let node = this.keyMap.get(fullKey)

		if (node) {
			// Update existing node - O(1)
			this.currentSizeBytes -= node.size
			node.value = value as unknown as T
			node.timestamp = Date.now()
			node.ttl = ttl
			node.size = size
			this.currentSizeBytes += size

			// Move to front
			this.moveToFront(node)
		} else {
			// Create new node - O(1)
			node = {
				key: fullKey,
				value: value as unknown as T,
				timestamp: Date.now(),
				ttl,
				hits: 0,
				size,
				prev: null,
				next: null,
			}

			// Add to map and list
			this.keyMap.set(fullKey, node)
			this.addToFront(node)
			this.currentSizeBytes += size
		}

		// Evict if necessary - O(1) per eviction
		this.evictIfNeeded()

		this.metrics.memoryUsageBytes = this.currentSizeBytes
		this.recordOperationTime(startTime)
	}

	/**
	 * Invalidate cache entries by pattern - O(N) but optimized
	 */
	async invalidate(pattern: string): Promise<number> {
		const startTime = performance.now()
		let invalidated = 0

		// Use regex for pattern matching
		const regex = new RegExp(pattern.replace(/\*/g, '.*'))

		// Iterate through keys (this is O(N) but unavoidable for pattern matching)
		for (const [fullKey, node] of this.keyMap) {
			if (regex.test(fullKey)) {
				this.removeNode(node)
				this.keyMap.delete(fullKey)
				this.currentSizeBytes -= node.size
				invalidated++
			}
		}

		this.metrics.memoryUsageBytes = this.currentSizeBytes
		this.recordOperationTime(startTime)

		this.logger.debug(`Invalidated ${invalidated} cache entries matching pattern: ${pattern}`)
		return invalidated
	}

	/**
	 * Get cache statistics
	 */
	async stats(): Promise<QueryCacheStats> {
		const hitRatio =
			this.metrics.totalOperations > 0
				? (this.metrics.hits / this.metrics.totalOperations) * 100
				: 0

		return {
			totalQueries: this.metrics.totalOperations,
			cacheHits: this.metrics.hits,
			cacheMisses: this.metrics.misses,
			hitRatio,
			totalSizeMB: this.currentSizeBytes / (1024 * 1024),
			averageQueryTime: this.metrics.avgOperationTime,
			evictions: this.metrics.evictions,
		}
	}

	/**
	 * Delete a key from cache - O(1) operation
	 */
	async delete(key: string): Promise<boolean> {
		if (!this.config.enabled) {
			return false
		}

		const fullKey = `${this.config.keyPrefix}:${key}`
		const node = this.keyMap.get(fullKey)

		if (!node) {
			return false
		}

		this.removeNode(node)
		this.keyMap.delete(fullKey)
		this.currentSizeBytes -= node.size

		return true
	}

	/**
	 * Get cache statistics (IQueryCache interface requirement)
	 */
	getStats(): QueryCacheStats {
		const hitRatio =
			this.metrics.totalOperations > 0
				? (this.metrics.hits / this.metrics.totalOperations) * 100
				: 0

		return {
			totalQueries: this.metrics.totalOperations,
			cacheHits: this.metrics.hits,
			cacheMisses: this.metrics.misses,
			hitRatio,
			totalSizeMB: this.currentSizeBytes / (1024 * 1024),
			averageQueryTime: this.metrics.avgOperationTime,
			evictions: this.metrics.evictions,
		}
	}

	/**
	 * Clear all cache entries - O(1) operation
	 */
	clear(): void {
		this.keyMap.clear()
		this.head.next = this.tail
		this.tail.prev = this.head
		this.currentSizeBytes = 0
		this.metrics.memoryUsageBytes = 0

		this.logger.debug('Cache cleared')
	}

	/**
	 * Cleanup expired entries - O(N) but run periodically
	 */
	cleanup(): number {
		const startTime = performance.now()
		let cleaned = 0
		const now = Date.now()

		// Use iterator to safely delete during iteration
		for (const [fullKey, node] of this.keyMap) {
			if (this.isExpired(node, now)) {
				this.removeNode(node)
				this.keyMap.delete(fullKey)
				this.currentSizeBytes -= node.size
				cleaned++
			}
		}

		this.metrics.cleanups++
		this.metrics.memoryUsageBytes = this.currentSizeBytes
		this.recordOperationTime(startTime)

		if (cleaned > 0) {
			this.logger.debug(`Cleaned up ${cleaned} expired cache entries`)
		}

		return cleaned
	}

	/**
	 * Get detailed metrics for monitoring
	 */
	getDetailedMetrics(): CacheMetrics & {
		keyCount: number
		sizeMB: number
		hitRatio: number
		avgNodeSize: number
	} {
		const hitRatio =
			this.metrics.totalOperations > 0
				? (this.metrics.hits / this.metrics.totalOperations) * 100
				: 0

		const avgNodeSize = this.keyMap.size > 0 ? this.currentSizeBytes / this.keyMap.size : 0

		return {
			...this.metrics,
			keyCount: this.keyMap.size,
			sizeMB: this.currentSizeBytes / (1024 * 1024),
			hitRatio,
			avgNodeSize,
		}
	}

	/**
	 * Stop cleanup timer and cleanup resources
	 */
	destroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer)
			this.cleanupTimer = null
		}
		this.clear()
	}

	/**
	 * Move node to front of list (most recently used) - O(1)
	 */
	private moveToFront(node: CacheNode<T>): void {
		// Remove from current position
		this.removeFromList(node)
		// Add to front
		this.addToFront(node)
	}

	/**
	 * Add node to front of list - O(1)
	 */
	private addToFront(node: CacheNode<T>): void {
		node.prev = this.head
		node.next = this.head.next
		this.head.next!.prev = node
		this.head.next = node
	}

	/**
	 * Remove node from list - O(1)
	 */
	private removeFromList(node: CacheNode<T>): void {
		node.prev!.next = node.next
		node.next!.prev = node.prev
	}

	/**
	 * Remove node completely (from both map and list) - O(1)
	 */
	private removeNode(node: CacheNode<T>): void {
		this.removeFromList(node)
	}

	/**
	 * Evict LRU entries if cache is too large - O(1) per eviction
	 */
	private evictIfNeeded(): void {
		const maxSizeBytes = this.config.maxSizeMB * 1024 * 1024

		// Evict by size constraint
		while (this.currentSizeBytes > maxSizeBytes && this.keyMap.size > 0) {
			this.evictLRU()
		}

		// Evict by key count constraint
		while (this.keyMap.size > this.config.maxKeys) {
			this.evictLRU()
		}
	}

	/**
	 * Evict least recently used entry - O(1)
	 */
	private evictLRU(): void {
		const lru = this.tail.prev!
		if (lru === this.head) {
			return // Cache is empty
		}

		this.removeNode(lru)
		this.keyMap.delete(lru.key)
		this.currentSizeBytes -= lru.size
		this.metrics.evictions++
	}

	/**
	 * Check if node is expired
	 */
	private isExpired(node: CacheNode<T>, now: number = Date.now()): boolean {
		return now - node.timestamp > node.ttl
	}

	/**
	 * Calculate size of value in bytes
	 */
	private calculateSize(value: any): number {
		try {
			// For objects, estimate JSON size
			if (typeof value === 'object' && value !== null) {
				return new Blob([JSON.stringify(value)]).size
			}

			// For primitives, estimate size
			if (typeof value === 'string') {
				return value.length * 2 // UTF-16
			}

			if (typeof value === 'number') {
				return 8 // 64-bit number
			}

			if (typeof value === 'boolean') {
				return 1
			}

			return 0
		} catch (error) {
			// Fallback estimation
			const str = String(value)
			return str.length * 2
		}
	}

	/**
	 * Start periodic cleanup timer
	 */
	private startCleanupTimer(): void {
		this.cleanupTimer = setInterval(() => {
			this.cleanup()
		}, this.config.cleanupInterval)
	}

	/**
	 * Record operation timing for metrics
	 */
	private recordOperationTime(startTime: number): void {
		const duration = performance.now() - startTime

		// Update rolling average
		const alpha = 0.1 // Smoothing factor
		this.metrics.avgOperationTime = this.metrics.avgOperationTime * (1 - alpha) + duration * alpha
	}
}

/**
 * Factory function for creating optimized LRU cache
 */
export function createOptimizedLRUCache<T = any>(
	config: Partial<OptimizedLRUConfig> = {},
	loggerConfig?: LoggingConfig
): OptimizedLRUCache<T> {
	const defaultConfig: OptimizedLRUConfig = {
		maxSizeMB: 100,
		defaultTTL: 300, // 5 minutes
		keyPrefix: 'cache',
		enabled: true,
		maxKeys: 10000,
		cleanupInterval: 60000, // 1 minute
	}

	const defaultLoggerConfig: LoggingConfig = {
		service: '@repo/audit-db - OptimizedLRUCache',
		environment: 'development',
		console: {
			name: 'console',
			enabled: true,
			format: 'pretty',
			colorize: true,
			level: 'info',
		},
		level: 'info',
		version: '0.1.0',
		shutdownTimeoutMs: 0,
		enableCorrelationIds: false,
		enableRequestTracking: false,
		enableDebugMode: false,
		prettyPrint: false,
	}

	return new OptimizedLRUCache<T>(
		{ ...defaultConfig, ...config },
		{ ...defaultLoggerConfig, ...loggerConfig }
	)
}
