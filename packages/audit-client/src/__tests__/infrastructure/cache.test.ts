import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	CacheCompression,
	CacheInvalidator,
	CacheKeyGenerator,
	CacheManager,
	LocalStorageCache,
	MemoryCache,
	SessionStorageCache,
} from '../../infrastructure/cache'

import type { CacheConfig } from '../../core/config'
import type { CacheStorage } from '../../infrastructure/cache'

// Mock localStorage and sessionStorage for testing
const mockStorage = () => {
	const storage: Record<string, string> = {}
	return {
		getItem: vi.fn((key: string) => storage[key] || null),
		setItem: vi.fn((key: string, value: string) => {
			storage[key] = value
		}),
		removeItem: vi.fn((key: string) => {
			delete storage[key]
		}),
		clear: vi.fn(() => {
			Object.keys(storage).forEach((key) => delete storage[key])
		}),
		key: vi.fn((index: number) => Object.keys(storage)[index] || null),
		get length() {
			return Object.keys(storage).length
		},
	}
}

// Mock window object for browser storage tests
Object.defineProperty(globalThis, 'window', {
	value: {
		localStorage: mockStorage(),
		sessionStorage: mockStorage(),
	},
	writable: true,
})

// Also set them directly on globalThis for Node.js environment
Object.defineProperty(globalThis, 'localStorage', {
	value: globalThis.window.localStorage,
	writable: true,
})

Object.defineProperty(globalThis, 'sessionStorage', {
	value: globalThis.window.sessionStorage,
	writable: true,
})

describe('MemoryCache', () => {
	let cache: MemoryCache

	beforeEach(() => {
		cache = new MemoryCache(5) // Small size for testing LRU
	})

	it('should store and retrieve values', async () => {
		await cache.set('key1', 'value1')
		const result = await cache.get('key1')
		expect(result).toBe('value1')
	})

	it('should return null for non-existent keys', async () => {
		const result = await cache.get('nonexistent')
		expect(result).toBeNull()
	})

	it('should delete values', async () => {
		await cache.set('key1', 'value1')
		await cache.delete('key1')
		const result = await cache.get('key1')
		expect(result).toBeNull()
	})

	it('should clear all values', async () => {
		await cache.set('key1', 'value1')
		await cache.set('key2', 'value2')
		await cache.clear()

		expect(await cache.get('key1')).toBeNull()
		expect(await cache.get('key2')).toBeNull()
		expect(await cache.size()).toBe(0)
	})

	it('should implement LRU eviction', async () => {
		// Fill cache to capacity
		for (let i = 0; i < 5; i++) {
			await cache.set(`key${i}`, `value${i}`)
		}

		// Add one more item, should evict the first
		await cache.set('key5', 'value5')

		expect(await cache.get('key0')).toBeNull() // Should be evicted
		expect(await cache.get('key5')).toBe('value5') // Should exist
		expect(await cache.size()).toBe(5)
	})

	it('should return correct size', async () => {
		expect(await cache.size()).toBe(0)

		await cache.set('key1', 'value1')
		expect(await cache.size()).toBe(1)

		await cache.set('key2', 'value2')
		expect(await cache.size()).toBe(2)
	})

	it('should return all keys', async () => {
		await cache.set('key1', 'value1')
		await cache.set('key2', 'value2')

		const keys = await cache.keys()
		expect(keys).toContain('key1')
		expect(keys).toContain('key2')
		expect(keys).toHaveLength(2)
	})
})

describe('LocalStorageCache', () => {
	let cache: LocalStorageCache

	beforeEach(() => {
		cache = new LocalStorageCache('test-cache')
		localStorage.clear()
	})

	it('should store and retrieve values with prefix', async () => {
		await cache.set('key1', 'value1')
		expect(localStorage.setItem).toHaveBeenCalledWith('test-cache:key1', 'value1')

		const result = await cache.get('key1')
		expect(localStorage.getItem).toHaveBeenCalledWith('test-cache:key1')
	})

	it('should handle localStorage errors gracefully', async () => {
		// Mock localStorage to throw error
		localStorage.setItem = vi.fn(() => {
			const error = new Error('QuotaExceededError')
			error.name = 'QuotaExceededError'
			;(error as any).code = 22
			throw error
		})

		// Should not throw error
		await expect(cache.set('key1', 'value1')).resolves.toBeUndefined()
	})

	it('should clear only prefixed keys', async () => {
		// Reset localStorage mock
		localStorage.setItem = vi.fn()
		localStorage.removeItem = vi.fn()

		// Mock keys method to return our test keys
		localStorage.key = vi.fn((index: number) => {
			const keys = ['test-cache:key1', 'test-cache:key2', 'other:key3']
			return keys[index] || null
		})

		Object.defineProperty(localStorage, 'length', {
			get: () => 3,
			configurable: true,
		})

		await cache.clear()

		expect(localStorage.removeItem).toHaveBeenCalledWith('test-cache:key1')
		expect(localStorage.removeItem).toHaveBeenCalledWith('test-cache:key2')
		expect(localStorage.removeItem).not.toHaveBeenCalledWith('other:key3')
	})
})

describe('SessionStorageCache', () => {
	let cache: SessionStorageCache

	beforeEach(() => {
		cache = new SessionStorageCache('test-session')
		sessionStorage.clear()
	})

	it('should store and retrieve values with prefix', async () => {
		await cache.set('key1', 'value1')
		expect(sessionStorage.setItem).toHaveBeenCalledWith('test-session:key1', 'value1')

		const result = await cache.get('key1')
		expect(sessionStorage.getItem).toHaveBeenCalledWith('test-session:key1')
	})

	it('should handle sessionStorage errors gracefully', async () => {
		// Mock sessionStorage to throw error
		sessionStorage.setItem = vi.fn(() => {
			throw new Error('Storage error')
		})

		// Should not throw error
		await expect(cache.set('key1', 'value1')).resolves.toBeUndefined()
	})
})

describe('CacheKeyGenerator', () => {
	it('should generate consistent keys for same inputs', () => {
		const key1 = CacheKeyGenerator.forRequest('/api/events', 'GET', { limit: 10 })
		const key2 = CacheKeyGenerator.forRequest('/api/events', 'GET', { limit: 10 })
		expect(key1).toBe(key2)
	})

	it('should generate different keys for different inputs', () => {
		const key1 = CacheKeyGenerator.forRequest('/api/events', 'GET', { limit: 10 })
		const key2 = CacheKeyGenerator.forRequest('/api/events', 'GET', { limit: 20 })
		expect(key1).not.toBe(key2)
	})

	it('should handle parameter order consistently', () => {
		const key1 = CacheKeyGenerator.forRequest('/api/events', 'GET', { a: 1, b: 2 })
		const key2 = CacheKeyGenerator.forRequest('/api/events', 'GET', { b: 2, a: 1 })
		expect(key1).toBe(key2)
	})

	it('should generate resource keys', () => {
		const key = CacheKeyGenerator.forResource('event', '123', 'v1')
		expect(key).toBeTruthy()
		expect(typeof key).toBe('string')
	})

	it('should generate prefixed keys', () => {
		const key = CacheKeyGenerator.withPrefix('custom', 'part1', 'part2')
		expect(key).toMatch(/^custom:/)
	})
})

describe('CacheInvalidator', () => {
	let storage: CacheStorage
	let invalidator: CacheInvalidator

	beforeEach(() => {
		storage = new MemoryCache()
		invalidator = new CacheInvalidator(storage)
	})

	it('should invalidate by pattern', async () => {
		await storage.set('user:123', JSON.stringify({ data: 'test1', expiresAt: Date.now() + 10000 }))
		await storage.set('user:456', JSON.stringify({ data: 'test2', expiresAt: Date.now() + 10000 }))
		await storage.set('event:789', JSON.stringify({ data: 'test3', expiresAt: Date.now() + 10000 }))

		const count = await invalidator.invalidateByPattern(/^user:/)
		expect(count).toBe(2)

		expect(await storage.get('user:123')).toBeNull()
		expect(await storage.get('user:456')).toBeNull()
		expect(await storage.get('event:789')).toBeTruthy()
	})

	it('should invalidate by prefix', async () => {
		await storage.set(
			'api:events:123',
			JSON.stringify({ data: 'test1', expiresAt: Date.now() + 10000 })
		)
		await storage.set(
			'api:events:456',
			JSON.stringify({ data: 'test2', expiresAt: Date.now() + 10000 })
		)
		await storage.set(
			'api:users:789',
			JSON.stringify({ data: 'test3', expiresAt: Date.now() + 10000 })
		)

		const count = await invalidator.invalidateByPrefix('api:events:')
		expect(count).toBe(2)

		expect(await storage.get('api:events:123')).toBeNull()
		expect(await storage.get('api:events:456')).toBeNull()
		expect(await storage.get('api:users:789')).toBeTruthy()
	})

	it('should invalidate by tags', async () => {
		await storage.set(
			'key1',
			JSON.stringify({
				data: 'test1',
				expiresAt: Date.now() + 10000,
				tags: ['user', 'profile'],
			})
		)
		await storage.set(
			'key2',
			JSON.stringify({
				data: 'test2',
				expiresAt: Date.now() + 10000,
				tags: ['user', 'settings'],
			})
		)
		await storage.set(
			'key3',
			JSON.stringify({
				data: 'test3',
				expiresAt: Date.now() + 10000,
				tags: ['event'],
			})
		)

		const count = await invalidator.invalidateByTags(['user'])
		expect(count).toBe(2)

		expect(await storage.get('key1')).toBeNull()
		expect(await storage.get('key2')).toBeNull()
		expect(await storage.get('key3')).toBeTruthy()
	})

	it('should invalidate expired entries', async () => {
		const now = Date.now()
		await storage.set('expired1', JSON.stringify({ data: 'test1', expiresAt: now - 1000 }))
		await storage.set('expired2', JSON.stringify({ data: 'test2', expiresAt: now - 2000 }))
		await storage.set('valid', JSON.stringify({ data: 'test3', expiresAt: now + 10000 }))

		const count = await invalidator.invalidateExpired()
		expect(count).toBe(2)

		expect(await storage.get('expired1')).toBeNull()
		expect(await storage.get('expired2')).toBeNull()
		expect(await storage.get('valid')).toBeTruthy()
	})
})

describe('CacheCompression', () => {
	it('should compress and decompress data', () => {
		const data = { message: 'Hello World!', count: 42, items: [1, 2, 3] }
		const compressed = CacheCompression.compress(data)
		const decompressed = CacheCompression.decompress(compressed)

		expect(decompressed).toEqual(data)
	})

	it('should determine when compression is beneficial', () => {
		const smallData = { a: 1 }
		const largeData = { message: 'x'.repeat(2000) }

		expect(CacheCompression.shouldCompress(smallData, 1000)).toBe(false)
		expect(CacheCompression.shouldCompress(largeData, 1000)).toBe(true)
	})

	it('should calculate compression ratio', () => {
		const original = 'Hello World!'
		const compressed = 'Hello*5'
		const ratio = CacheCompression.getCompressionRatio(original, compressed)

		expect(ratio).toBeLessThan(1)
		expect(ratio).toBeGreaterThan(0)
	})
})

describe('CacheManager', () => {
	let cacheManager: CacheManager
	let config: CacheConfig

	beforeEach(() => {
		config = {
			enabled: true,
			defaultTtlMs: 5000,
			maxSize: 100,
			storage: 'memory',
			keyPrefix: 'test',
			compressionEnabled: false,
		}
		cacheManager = new CacheManager(config)
	})

	afterEach(() => {
		cacheManager.destroy()
	})

	it('should store and retrieve values', async () => {
		const testData = { message: 'Hello World!', timestamp: Date.now() }
		await cacheManager.set('test-key', testData)

		const result = await cacheManager.get('test-key')
		expect(result).toEqual(testData)
	})

	it('should respect TTL expiration', async () => {
		const testData = { message: 'Hello World!' }
		await cacheManager.set('test-key', testData, 100) // 100ms TTL

		// Should exist immediately
		expect(await cacheManager.get('test-key')).toEqual(testData)

		// Wait for expiration
		await new Promise((resolve) => setTimeout(resolve, 150))

		// Should be expired
		expect(await cacheManager.get('test-key')).toBeNull()
	})

	it('should handle compression when enabled', async () => {
		const compressedConfig = { ...config, compressionEnabled: true }
		const compressedManager = new CacheManager(compressedConfig)

		const largeData = { message: 'x'.repeat(2000), items: Array(100).fill('data') }
		await compressedManager.set('large-key', largeData)

		const result = await compressedManager.get('large-key')
		expect(result).toEqual(largeData)

		compressedManager.destroy()
	})

	it('should track statistics', async () => {
		await cacheManager.set('key1', 'value1')
		await cacheManager.get('key1') // hit
		await cacheManager.get('key2') // miss

		const stats = cacheManager.getStats()
		expect(stats.hits).toBe(1)
		expect(stats.misses).toBe(1)
		expect(stats.sets).toBe(1)
		expect(stats.hitRate).toBe(0.5)
	})

	it('should support cache invalidation by pattern', async () => {
		await cacheManager.set('user:123', 'data1')
		await cacheManager.set('user:456', 'data2')
		await cacheManager.set('event:789', 'data3')

		const count = await cacheManager.invalidateByPattern(/user:/)
		expect(count).toBe(2)

		expect(await cacheManager.get('user:123')).toBeNull()
		expect(await cacheManager.get('user:456')).toBeNull()
		expect(await cacheManager.get('event:789')).toBe('data3')
	})

	it('should support cache invalidation by prefix', async () => {
		await cacheManager.set('api:events:123', 'data1')
		await cacheManager.set('api:events:456', 'data2')
		await cacheManager.set('api:users:789', 'data3')

		const count = await cacheManager.invalidateByPrefix('api:events:')
		expect(count).toBe(2)

		expect(await cacheManager.get('api:events:123')).toBeNull()
		expect(await cacheManager.get('api:events:456')).toBeNull()
		expect(await cacheManager.get('api:users:789')).toBe('data3')
	})

	it('should support cache invalidation by tags', async () => {
		await cacheManager.set('key1', 'data1', undefined, ['user', 'profile'])
		await cacheManager.set('key2', 'data2', undefined, ['user', 'settings'])
		await cacheManager.set('key3', 'data3', undefined, ['event'])

		const count = await cacheManager.invalidateByTags(['user'])
		expect(count).toBe(2)

		expect(await cacheManager.get('key1')).toBeNull()
		expect(await cacheManager.get('key2')).toBeNull()
		expect(await cacheManager.get('key3')).toBe('data3')
	})

	it('should cleanup expired entries', async () => {
		await cacheManager.set('key1', 'data1', 50) // 50ms TTL
		await cacheManager.set('key2', 'data2', 10000) // 10s TTL

		// Wait for first key to expire
		await new Promise((resolve) => setTimeout(resolve, 100))

		const cleanedCount = await cacheManager.cleanup()
		expect(cleanedCount).toBe(1)

		expect(await cacheManager.get('key1')).toBeNull()
		expect(await cacheManager.get('key2')).toBe('data2')
	})

	it('should handle disabled cache', async () => {
		const disabledConfig = { ...config, enabled: false }
		const disabledManager = new CacheManager(disabledConfig)

		await disabledManager.set('key1', 'value1')
		const result = await disabledManager.get('key1')

		expect(result).toBeNull()

		disabledManager.destroy()
	})

	it('should check if key exists', async () => {
		await cacheManager.set('existing-key', 'value')

		expect(await cacheManager.has('existing-key')).toBe(true)
		expect(await cacheManager.has('non-existing-key')).toBe(false)
	})

	it('should clear all cache entries', async () => {
		await cacheManager.set('key1', 'value1')
		await cacheManager.set('key2', 'value2')

		await cacheManager.clear()

		expect(await cacheManager.get('key1')).toBeNull()
		expect(await cacheManager.get('key2')).toBeNull()

		const stats = cacheManager.getStats()
		expect(stats.size).toBe(0)
	})

	it('should update access metadata on cache hits', async () => {
		await cacheManager.set('key1', 'value1')

		// First access
		await cacheManager.get('key1')

		// Second access
		await cacheManager.get('key1')

		const stats = cacheManager.getStats()
		expect(stats.hits).toBe(2)
	})

	it('should handle custom storage backend', async () => {
		const customStorage: CacheStorage = new MemoryCache()
		const customConfig = {
			...config,
			storage: 'custom' as const,
			customStorage,
		}
		const customManager = new CacheManager(customConfig)

		await customManager.set('key1', 'value1')
		const result = await customManager.get('key1')

		expect(result).toBe('value1')

		customManager.destroy()
	})

	it('should throw error for custom storage without implementation', () => {
		const invalidConfig = {
			...config,
			storage: 'custom' as const,
			// customStorage is missing
		}

		expect(() => new CacheManager(invalidConfig)).toThrow(
			'Custom storage implementation required when storage type is "custom"'
		)
	})
})
