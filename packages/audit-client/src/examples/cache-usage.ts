/**
 * Example demonstrating comprehensive caching system usage
 */

import {
	CacheCompression,
	CacheKeyGenerator,
	CacheManager,
	LocalStorageCache,
	MemoryCache,
} from '../infrastructure/cache'

import type { CacheConfig } from '../core/config'

// Example 1: Basic cache usage with memory storage
async function basicCacheExample() {
	console.log('=== Basic Cache Example ===')

	const config: CacheConfig = {
		enabled: true,
		defaultTtlMs: 60000, // 1 minute
		maxSize: 1000,
		storage: 'memory',
		keyPrefix: 'audit-client',
		compressionEnabled: false,
	}

	const cache = new CacheManager(config)

	// Store some data
	await cache.set('user:123', { name: 'John Doe', role: 'admin' })
	await cache.set('events:recent', [
		{ id: '1', action: 'login', timestamp: Date.now() },
		{ id: '2', action: 'logout', timestamp: Date.now() + 1000 },
	])

	// Retrieve data
	const user = await cache.get('user:123')
	const events = await cache.get('events:recent')

	console.log('User:', user)
	console.log('Events:', events)

	// Check cache statistics
	const stats = cache.getStats()
	console.log('Cache stats:', stats)

	cache.destroy()
}

// Example 2: Cache with TTL and expiration
async function ttlCacheExample() {
	console.log('\n=== TTL Cache Example ===')

	const config: CacheConfig = {
		enabled: true,
		defaultTtlMs: 1000, // 1 second default
		maxSize: 100,
		storage: 'memory',
		keyPrefix: 'ttl-test',
		compressionEnabled: false,
	}

	const cache = new CacheManager(config)

	// Store with custom TTL
	await cache.set('short-lived', 'This will expire soon', 500) // 500ms
	await cache.set('long-lived', 'This will last longer', 5000) // 5 seconds

	console.log('Immediately after setting:')
	console.log('Short-lived:', await cache.get('short-lived'))
	console.log('Long-lived:', await cache.get('long-lived'))

	// Wait for short-lived to expire
	await new Promise((resolve) => setTimeout(resolve, 600))

	console.log('\nAfter 600ms:')
	console.log('Short-lived:', await cache.get('short-lived')) // Should be null
	console.log('Long-lived:', await cache.get('long-lived')) // Should still exist

	cache.destroy()
}

// Example 3: Cache with compression
async function compressionCacheExample() {
	console.log('\n=== Compression Cache Example ===')

	const config: CacheConfig = {
		enabled: true,
		defaultTtlMs: 300000, // 5 minutes
		maxSize: 100,
		storage: 'memory',
		keyPrefix: 'compressed',
		compressionEnabled: true,
	}

	const cache = new CacheManager(config)

	// Large data that benefits from compression
	const largeData = {
		message: 'x'.repeat(2000),
		items: Array(100).fill({ name: 'Item', description: 'A'.repeat(100) }),
		metadata: {
			created: Date.now(),
			version: '1.0.0',
			tags: Array(50).fill('tag'),
		},
	}

	console.log('Original data size:', JSON.stringify(largeData).length, 'characters')

	// Check if compression would be beneficial
	const shouldCompress = CacheCompression.shouldCompress(largeData)
	console.log('Should compress:', shouldCompress)

	// Store and retrieve compressed data
	await cache.set('large-data', largeData)
	const retrieved = await cache.get('large-data')

	console.log('Data retrieved successfully:', retrieved !== null)
	console.log('Data integrity check:', JSON.stringify(retrieved) === JSON.stringify(largeData))

	cache.destroy()
}

// Example 4: Cache invalidation strategies
async function invalidationExample() {
	console.log('\n=== Cache Invalidation Example ===')

	const config: CacheConfig = {
		enabled: true,
		defaultTtlMs: 300000,
		maxSize: 100,
		storage: 'memory',
		keyPrefix: 'invalidation',
		compressionEnabled: false,
	}

	const cache = new CacheManager(config)

	// Store data with different patterns
	await cache.set('user:123', { name: 'User 123' })
	await cache.set('user:456', { name: 'User 456' })
	await cache.set('event:789', { name: 'Event 789' })
	await cache.set('api:events:recent', ['event1', 'event2'])
	await cache.set('api:events:archived', ['old1', 'old2'])

	// Store data with tags
	await cache.set('tagged:1', 'data1', undefined, ['user', 'profile'])
	await cache.set('tagged:2', 'data2', undefined, ['user', 'settings'])
	await cache.set('tagged:3', 'data3', undefined, ['event'])

	console.log('Initial cache size:', (await cache.getStats()).size)

	// Invalidate by pattern
	const patternCount = await cache.invalidateByPattern(/^invalidation:user:/)
	console.log('Invalidated by pattern (user:*):', patternCount)

	// Invalidate by prefix
	const prefixCount = await cache.invalidateByPrefix('api:events:')
	console.log('Invalidated by prefix (api:events:*):', prefixCount)

	// Invalidate by tags
	const tagCount = await cache.invalidateByTags(['user'])
	console.log('Invalidated by tags (user):', tagCount)

	console.log('Final cache size:', (await cache.getStats()).size)

	cache.destroy()
}

// Example 5: Cache key generation
function keyGenerationExample() {
	console.log('\n=== Cache Key Generation Example ===')

	// Generate keys for API requests
	const apiKey1 = CacheKeyGenerator.forRequest('/api/events', 'GET', { limit: 10, offset: 0 })
	const apiKey2 = CacheKeyGenerator.forRequest('/api/events', 'GET', { offset: 0, limit: 10 }) // Same params, different order
	const apiKey3 = CacheKeyGenerator.forRequest('/api/events', 'GET', { limit: 20, offset: 0 })

	console.log('API key 1:', apiKey1)
	console.log('API key 2:', apiKey2)
	console.log('Keys 1 and 2 are equal:', apiKey1 === apiKey2) // Should be true
	console.log('API key 3:', apiKey3)
	console.log('Keys 1 and 3 are equal:', apiKey1 === apiKey3) // Should be false

	// Generate keys for resources
	const resourceKey = CacheKeyGenerator.forResource('event', '123', 'v1')
	console.log('Resource key:', resourceKey)

	// Generate custom prefixed keys
	const customKey = CacheKeyGenerator.withPrefix('custom', 'part1', 'part2', 'part3')
	console.log('Custom key:', customKey)
}

// Example 6: Different storage backends
async function storageBackendsExample() {
	console.log('\n=== Storage Backends Example ===')

	// Memory cache
	const memoryConfig: CacheConfig = {
		enabled: true,
		defaultTtlMs: 60000,
		maxSize: 100,
		storage: 'memory',
		keyPrefix: 'memory-test',
		compressionEnabled: false,
	}

	const memoryCache = new CacheManager(memoryConfig)
	await memoryCache.set('test', 'memory-value')
	console.log('Memory cache value:', await memoryCache.get('test'))
	memoryCache.destroy()

	// Custom storage backend
	const customStorage = new MemoryCache(50) // Smaller size
	const customConfig: CacheConfig = {
		enabled: true,
		defaultTtlMs: 60000,
		maxSize: 50,
		storage: 'custom',
		customStorage,
		keyPrefix: 'custom-test',
		compressionEnabled: false,
	}

	const customCache = new CacheManager(customConfig)
	await customCache.set('test', 'custom-value')
	console.log('Custom cache value:', await customCache.get('test'))
	customCache.destroy()
}

// Run all examples
async function runAllExamples() {
	try {
		await basicCacheExample()
		await ttlCacheExample()
		await compressionCacheExample()
		await invalidationExample()
		keyGenerationExample()
		await storageBackendsExample()

		console.log('\n=== All cache examples completed successfully! ===')
	} catch (error) {
		console.error('Error running cache examples:', error)
	}
}

// Export for use in other files
export {
	basicCacheExample,
	ttlCacheExample,
	compressionCacheExample,
	invalidationExample,
	keyGenerationExample,
	storageBackendsExample,
	runAllExamples,
}

// Run examples if this file is executed directly
if (require.main === module) {
	runAllExamples()
}
