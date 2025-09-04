import { CacheConfig } from '../core/config'

/**
 * Interface for cache storage backends
 */
export interface CacheStorage {
	get(key: string): Promise<string | null>
	set(key: string, value: string): Promise<void>
	delete(key: string): Promise<void>
	clear(): Promise<void>
	keys(): Promise<string[]>
	size(): Promise<number>
}

/**
 * Cache entry with metadata
 */
interface CacheEntry<T = any> {
	data: T | string // Can be compressed string or original data
	expiresAt: number
	createdAt: number
	accessCount: number
	lastAccessed: number
	compressed: boolean
	tags?: string[]
}

/**
 * Cache statistics
 */
export interface CacheStats {
	hits: number
	misses: number
	sets: number
	deletes: number
	evictions: number
	hitRate: number
	size: number
	memoryUsage: number
}

/**
 * Memory-based cache storage implementation
 */
export class MemoryCache implements CacheStorage {
	private cache = new Map<string, string>()
	private maxSize: number

	constructor(maxSize = 1000) {
		this.maxSize = maxSize
	}

	async get(key: string): Promise<string | null> {
		return this.cache.get(key) || null
	}

	async set(key: string, value: string): Promise<void> {
		// Implement LRU eviction if at capacity
		if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
			const firstKey = this.cache.keys().next().value
			if (firstKey) {
				this.cache.delete(firstKey)
			}
		}
		this.cache.set(key, value)
	}

	async delete(key: string): Promise<void> {
		this.cache.delete(key)
	}

	async clear(): Promise<void> {
		this.cache.clear()
	}

	async keys(): Promise<string[]> {
		return Array.from(this.cache.keys())
	}

	async size(): Promise<number> {
		return this.cache.size
	}
}

/**
 * localStorage-based cache storage implementation
 */
export class LocalStorageCache implements CacheStorage {
	private prefix: string

	constructor(prefix = 'audit-client-cache') {
		this.prefix = prefix
		// Check if localStorage is available
		if (typeof window === 'undefined' || !window.localStorage) {
			throw new Error('localStorage is not available in this environment')
		}
	}

	async get(key: string): Promise<string | null> {
		try {
			return localStorage.getItem(this.prefixKey(key))
		} catch (error) {
			console.warn('localStorage get error:', error)
			return null
		}
	}

	async set(key: string, value: string): Promise<void> {
		try {
			localStorage.setItem(this.prefixKey(key), value)
		} catch (error) {
			// Handle quota exceeded error
			if ((error as any)?.code === 22 || (error as any)?.name === 'QuotaExceededError') {
				await this.clearOldest()
				try {
					localStorage.setItem(this.prefixKey(key), value)
				} catch (retryError) {
					console.warn('localStorage set error after cleanup:', retryError)
				}
			} else {
				console.warn('localStorage set error:', error)
			}
		}
	}

	async delete(key: string): Promise<void> {
		try {
			localStorage.removeItem(this.prefixKey(key))
		} catch (error) {
			console.warn('localStorage delete error:', error)
		}
	}

	async clear(): Promise<void> {
		try {
			const keys = await this.keys()
			keys.forEach((key) => localStorage.removeItem(key))
		} catch (error) {
			console.warn('localStorage clear error:', error)
		}
	}

	async keys(): Promise<string[]> {
		try {
			const keys: string[] = []
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i)
				if (key && key.startsWith(this.prefix)) {
					keys.push(key)
				}
			}
			return keys
		} catch (error) {
			console.warn('localStorage keys error:', error)
			return []
		}
	}

	async size(): Promise<number> {
		return (await this.keys()).length
	}

	private prefixKey(key: string): string {
		return `${this.prefix}:${key}`
	}

	private async clearOldest(): Promise<void> {
		const keys = await this.keys()
		if (keys.length === 0) return

		// Find oldest entry by parsing timestamps
		let oldestKey: string = keys[0]!
		let oldestTime = Infinity

		for (const key of keys) {
			try {
				const value = localStorage.getItem(key)
				if (value) {
					const entry = JSON.parse(value)
					if (entry.createdAt && entry.createdAt < oldestTime) {
						oldestTime = entry.createdAt
						oldestKey = key
					}
				}
			} catch (error) {
				// If we can't parse, consider it for deletion
				oldestKey = key
				break
			}
		}

		localStorage.removeItem(oldestKey)
	}
}

/**
 * sessionStorage-based cache storage implementation
 */
export class SessionStorageCache implements CacheStorage {
	private prefix: string

	constructor(prefix = 'audit-client-cache') {
		this.prefix = prefix
		// Check if sessionStorage is available
		if (typeof window === 'undefined' || !window.sessionStorage) {
			throw new Error('sessionStorage is not available in this environment')
		}
	}

	async get(key: string): Promise<string | null> {
		try {
			return sessionStorage.getItem(this.prefixKey(key))
		} catch (error) {
			console.warn('sessionStorage get error:', error)
			return null
		}
	}

	async set(key: string, value: string): Promise<void> {
		try {
			sessionStorage.setItem(this.prefixKey(key), value)
		} catch (error) {
			console.warn('sessionStorage set error:', error)
		}
	}

	async delete(key: string): Promise<void> {
		try {
			sessionStorage.removeItem(this.prefixKey(key))
		} catch (error) {
			console.warn('sessionStorage delete error:', error)
		}
	}

	async clear(): Promise<void> {
		try {
			const keys = await this.keys()
			keys.forEach((key) => sessionStorage.removeItem(key))
		} catch (error) {
			console.warn('sessionStorage clear error:', error)
		}
	}

	async keys(): Promise<string[]> {
		try {
			const keys: string[] = []
			for (let i = 0; i < sessionStorage.length; i++) {
				const key = sessionStorage.key(i)
				if (key && key.startsWith(this.prefix)) {
					keys.push(key)
				}
			}
			return keys
		} catch (error) {
			console.warn('sessionStorage keys error:', error)
			return []
		}
	}

	async size(): Promise<number> {
		return (await this.keys()).length
	}

	private prefixKey(key: string): string {
		return `${this.prefix}:${key}`
	}
}

/**
 * Cache key generation strategies
 */
export class CacheKeyGenerator {
	/**
	 * Generate cache key for API requests
	 */
	static forRequest(endpoint: string, method: string, params?: any, body?: any): string {
		const parts = [endpoint, method.toUpperCase()]

		if (params) {
			const sortedParams = Object.keys(params)
				.sort()
				.map((key) => `${key}=${JSON.stringify(params[key])}`)
				.join('&')
			parts.push(sortedParams)
		}

		if (body) {
			parts.push(JSON.stringify(body))
		}

		return this.hash(parts.join('|'))
	}

	/**
	 * Generate cache key for specific resource
	 */
	static forResource(resourceType: string, resourceId: string, version?: string): string {
		const parts = [resourceType, resourceId]
		if (version) {
			parts.push(version)
		}
		return this.hash(parts.join(':'))
	}

	/**
	 * Generate cache key with custom prefix
	 */
	static withPrefix(prefix: string, ...parts: string[]): string {
		return `${prefix}:${this.hash(parts.join(':'))}`
	}

	/**
	 * Simple hash function for cache keys
	 */
	private static hash(str: string): string {
		let hash = 0
		if (str.length === 0) return hash.toString()

		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i)
			hash = (hash << 5) - hash + char
			hash = hash & hash // Convert to 32-bit integer
		}

		return Math.abs(hash).toString(36)
	}
}

/**
 * Cache invalidation strategies
 */
export class CacheInvalidator {
	private storage: CacheStorage

	constructor(storage: CacheStorage) {
		this.storage = storage
	}

	/**
	 * Invalidate cache entries by pattern
	 */
	async invalidateByPattern(pattern: RegExp): Promise<number> {
		const keys = await this.storage.keys()
		const matchingKeys = keys.filter((key) => pattern.test(key))

		await Promise.all(matchingKeys.map((key) => this.storage.delete(key)))
		return matchingKeys.length
	}

	/**
	 * Invalidate cache entries by prefix
	 */
	async invalidateByPrefix(prefix: string): Promise<number> {
		const keys = await this.storage.keys()
		const matchingKeys = keys.filter((key) => key.startsWith(prefix))

		await Promise.all(matchingKeys.map((key) => this.storage.delete(key)))
		return matchingKeys.length
	}

	/**
	 * Invalidate cache entries by tags
	 */
	async invalidateByTags(tags: string[]): Promise<number> {
		const keys = await this.storage.keys()
		let invalidatedCount = 0

		for (const key of keys) {
			try {
				const value = await this.storage.get(key)
				if (value) {
					const entry = JSON.parse(value)
					if (entry.tags && Array.isArray(entry.tags)) {
						const hasMatchingTag = tags.some((tag) => entry.tags.includes(tag))
						if (hasMatchingTag) {
							await this.storage.delete(key)
							invalidatedCount++
						}
					}
				}
			} catch (error) {
				// Skip invalid entries
				continue
			}
		}

		return invalidatedCount
	}

	/**
	 * Invalidate expired entries
	 */
	async invalidateExpired(): Promise<number> {
		const keys = await this.storage.keys()
		const now = Date.now()
		let expiredCount = 0

		for (const key of keys) {
			try {
				const value = await this.storage.get(key)
				if (value) {
					const entry = JSON.parse(value)
					if (entry.expiresAt && now >= entry.expiresAt) {
						await this.storage.delete(key)
						expiredCount++
					}
				}
			} catch (error) {
				// Delete invalid entries
				await this.storage.delete(key)
				expiredCount++
			}
		}

		return expiredCount
	}
}

/**
 * Data compression utilities
 */
export class CacheCompression {
	/**
	 * Compress data using simple string compression
	 */
	static compress(data: any): string {
		const jsonString = JSON.stringify(data)

		// Simple run-length encoding for repeated characters
		return jsonString.replace(/(.)\1+/g, (match, char) => {
			return match.length > 3 ? `${char}*${match.length}` : match
		})
	}

	/**
	 * Decompress data
	 */
	static decompress(compressedData: string): any {
		// Reverse run-length encoding
		const decompressed = compressedData.replace(/(.)\*(\d+)/g, (match, char, count) => {
			return char.repeat(parseInt(count, 10))
		})

		return JSON.parse(decompressed)
	}

	/**
	 * Check if compression would be beneficial
	 */
	static shouldCompress(data: any, threshold = 1000): boolean {
		const jsonString = JSON.stringify(data)
		return jsonString.length > threshold
	}

	/**
	 * Calculate compression ratio
	 */
	static getCompressionRatio(original: string, compressed: string): number {
		return compressed.length / original.length
	}
}

/**
 * Main cache manager with comprehensive caching capabilities
 */
export class CacheManager {
	private storage: CacheStorage
	private config: CacheConfig
	private stats: CacheStats
	private invalidator: CacheInvalidator
	private cleanupInterval?: NodeJS.Timeout | undefined

	constructor(config: CacheConfig) {
		this.config = config
		this.storage = this.initializeStorage()
		this.invalidator = new CacheInvalidator(this.storage)
		this.stats = {
			hits: 0,
			misses: 0,
			sets: 0,
			deletes: 0,
			evictions: 0,
			hitRate: 0,
			size: 0,
			memoryUsage: 0,
		}

		// Start cleanup interval for expired entries
		if (config.enabled) {
			this.startCleanupInterval()
		}
	}

	/**
	 * Get value from cache
	 */
	async get<T>(key: string): Promise<T | null> {
		if (!this.config.enabled) {
			return null
		}

		try {
			const prefixedKey = this.prefixKey(key)
			const cached = await this.storage.get(prefixedKey)

			if (!cached) {
				this.stats.misses++
				this.updateHitRate()
				return null
			}

			const entry: CacheEntry<T> = JSON.parse(cached)

			// Check expiration
			if (Date.now() >= entry.expiresAt) {
				await this.storage.delete(prefixedKey)
				this.stats.misses++
				this.stats.evictions++
				this.updateHitRate()
				return null
			}

			// Update access metadata
			entry.accessCount++
			entry.lastAccessed = Date.now()
			await this.storage.set(prefixedKey, JSON.stringify(entry))

			this.stats.hits++
			this.updateHitRate()

			// Decompress if needed
			const data = entry.compressed ? CacheCompression.decompress(entry.data as string) : entry.data

			return data as T
		} catch (error) {
			console.warn('Cache get error:', error)
			this.stats.misses++
			this.updateHitRate()
			return null
		}
	}

	/**
	 * Set value in cache
	 */
	async set<T>(key: string, value: T, ttlMs?: number, tags?: string[]): Promise<void> {
		if (!this.config.enabled) {
			return
		}

		try {
			const now = Date.now()
			const expiresAt = now + (ttlMs || this.config.defaultTtlMs)

			// Determine if compression should be used
			const shouldCompress =
				this.config.compressionEnabled && CacheCompression.shouldCompress(value)

			const data = shouldCompress ? CacheCompression.compress(value) : value

			const entry: CacheEntry<T> = {
				data: data as T,
				expiresAt,
				createdAt: now,
				accessCount: 0,
				lastAccessed: now,
				compressed: shouldCompress,
				...(tags && { tags }),
			}

			const prefixedKey = this.prefixKey(key)
			await this.storage.set(prefixedKey, JSON.stringify(entry))

			this.stats.sets++
			await this.updateStats()
		} catch (error) {
			console.warn('Cache set error:', error)
		}
	}

	/**
	 * Delete value from cache
	 */
	async delete(key: string): Promise<void> {
		if (!this.config.enabled) {
			return
		}

		try {
			const prefixedKey = this.prefixKey(key)
			await this.storage.delete(prefixedKey)
			this.stats.deletes++
			await this.updateStats()
		} catch (error) {
			console.warn('Cache delete error:', error)
		}
	}

	/**
	 * Clear all cache entries
	 */
	async clear(): Promise<void> {
		if (!this.config.enabled) {
			return
		}

		try {
			await this.storage.clear()
			this.resetStats()
		} catch (error) {
			console.warn('Cache clear error:', error)
		}
	}

	/**
	 * Check if key exists in cache
	 */
	async has(key: string): Promise<boolean> {
		if (!this.config.enabled) {
			return false
		}

		const value = await this.get(key)
		return value !== null
	}

	/**
	 * Get cache statistics
	 */
	getStats(): CacheStats {
		return { ...this.stats }
	}

	/**
	 * Invalidate cache entries by pattern
	 */
	async invalidateByPattern(pattern: RegExp): Promise<number> {
		if (!this.config.enabled) {
			return 0
		}

		const count = await this.invalidator.invalidateByPattern(pattern)
		this.stats.evictions += count
		await this.updateStats()
		return count
	}

	/**
	 * Invalidate cache entries by prefix
	 */
	async invalidateByPrefix(prefix: string): Promise<number> {
		if (!this.config.enabled) {
			return 0
		}

		const count = await this.invalidator.invalidateByPrefix(this.prefixKey(prefix))
		this.stats.evictions += count
		await this.updateStats()
		return count
	}

	/**
	 * Invalidate cache entries by tags
	 */
	async invalidateByTags(tags: string[]): Promise<number> {
		if (!this.config.enabled) {
			return 0
		}

		const count = await this.invalidator.invalidateByTags(tags)
		this.stats.evictions += count
		await this.updateStats()
		return count
	}

	/**
	 * Clean up expired entries
	 */
	async cleanup(): Promise<number> {
		if (!this.config.enabled) {
			return 0
		}

		const count = await this.invalidator.invalidateExpired()
		this.stats.evictions += count
		await this.updateStats()
		return count
	}

	/**
	 * Destroy cache manager and cleanup resources
	 */
	destroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
			this.cleanupInterval = undefined
		}
	}

	/**
	 * Initialize storage backend based on configuration
	 */
	private initializeStorage(): CacheStorage {
		switch (this.config.storage) {
			case 'localStorage':
				return new LocalStorageCache(this.config.keyPrefix)
			case 'sessionStorage':
				return new SessionStorageCache(this.config.keyPrefix)
			case 'custom':
				if (!this.config.customStorage) {
					throw new Error('Custom storage implementation required when storage type is "custom"')
				}
				return this.config.customStorage
			case 'memory':
			default:
				return new MemoryCache(this.config.maxSize)
		}
	}

	/**
	 * Add prefix to cache key
	 */
	private prefixKey(key: string): string {
		return `${this.config.keyPrefix}:${key}`
	}

	/**
	 * Update hit rate calculation
	 */
	private updateHitRate(): void {
		const total = this.stats.hits + this.stats.misses
		this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
	}

	/**
	 * Update cache statistics
	 */
	private async updateStats(): Promise<void> {
		try {
			this.stats.size = await this.storage.size()
			// Estimate memory usage (rough calculation)
			this.stats.memoryUsage = this.stats.size * 1024 // Assume 1KB per entry on average
		} catch (error) {
			console.warn('Error updating cache stats:', error)
		}
	}

	/**
	 * Reset statistics
	 */
	private resetStats(): void {
		this.stats = {
			hits: 0,
			misses: 0,
			sets: 0,
			deletes: 0,
			evictions: 0,
			hitRate: 0,
			size: 0,
			memoryUsage: 0,
		}
	}

	/**
	 * Start cleanup interval for expired entries
	 */
	private startCleanupInterval(): void {
		// Run cleanup every 5 minutes
		this.cleanupInterval = setInterval(
			async () => {
				try {
					await this.cleanup()
				} catch (error) {
					console.warn('Cache cleanup error:', error)
				}
			},
			5 * 60 * 1000
		)
	}
}
