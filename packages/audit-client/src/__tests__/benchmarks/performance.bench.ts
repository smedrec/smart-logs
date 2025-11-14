import { bench, describe } from 'vitest'

import { AuditClient } from '../../core/client'
import { CacheManager } from '../../infrastructure/cache'
import { PerformanceMonitor } from '../../infrastructure/performance-monitor'

/**
 * Performance benchmarks for the audit client
 *
 * These benchmarks measure:
 * - Client initialization time
 * - Cache operation performance
 * - Request performance
 */

describe('Performance Benchmarks', () => {
	describe('Client Initialization', () => {
		bench('initialize client with minimal config', () => {
			const client = new AuditClient({
				baseUrl: 'https://api.test.com',
				authentication: {
					type: 'apiKey',
					apiKey: 'test-key',
				},
			})
			client.destroy()
		})

		bench('initialize client with full config', () => {
			const client = new AuditClient({
				baseUrl: 'https://api.test.com',
				authentication: {
					type: 'apiKey',
					apiKey: 'test-key',
				},
				cache: {
					enabled: true,
					defaultTtlMs: 300000,
					maxSize: 1000,
				},
				retry: {
					enabled: true,
					maxAttempts: 3,
					initialDelayMs: 1000,
				},
				batching: {
					enabled: true,
					maxBatchSize: 100,
					batchTimeoutMs: 100,
				},
			})
			client.destroy()
		})

		bench('initialize and destroy client', () => {
			const client = new AuditClient({
				baseUrl: 'https://api.test.com',
				authentication: {
					type: 'apiKey',
					apiKey: 'test-key',
				},
			})
			client.destroy()
		})
	})

	describe('Cache Operations', () => {
		const cache = new CacheManager({
			enabled: true,
			defaultTtlMs: 300000,
			maxSize: 1000,
			storage: 'memory',
			keyPrefix: 'bench',
			compressionEnabled: false,
		})

		bench('cache set operation', async () => {
			await cache.set('test-key', { data: 'test-value' }, 300000)
		})

		bench('cache get operation (hit)', async () => {
			await cache.set('bench-key', { data: 'bench-value' }, 300000)
			await cache.get('bench-key')
		})

		bench('cache get operation (miss)', async () => {
			await cache.get('non-existent-key')
		})

		bench('cache delete operation', async () => {
			await cache.set('delete-key', { data: 'delete-value' }, 300000)
			await cache.delete('delete-key')
		})

		bench('cache clear operation', async () => {
			await cache.set('clear-key-1', { data: 'value-1' }, 300000)
			await cache.set('clear-key-2', { data: 'value-2' }, 300000)
			await cache.clear()
		})

		bench('cache set with tags', async () => {
			await cache.set('tagged-key', { data: 'tagged-value' }, 300000, ['tag1', 'tag2'])
		})

		bench('cache invalidate by tag', async () => {
			await cache.set('tag-key-1', { data: 'value-1' }, 300000, ['bench-tag'])
			await cache.set('tag-key-2', { data: 'value-2' }, 300000, ['bench-tag'])
			await cache.invalidateByTags(['bench-tag'])
		})
	})

	describe('Performance Monitor', () => {
		const monitor = new PerformanceMonitor({
			maxBundleSize: 200 * 1024,
			maxInitTime: 100,
			maxRequestTime: 1000,
			maxMemoryUsage: 50 * 1024 * 1024,
			maxCacheSize: 1000,
		})

		bench('record metric', () => {
			monitor.recordMetric('test_metric', Math.random() * 1000)
		})

		bench('record request time', () => {
			monitor.recordRequestTime(Math.random() * 1000)
		})

		bench('record cache hit', () => {
			monitor.recordCacheHit()
		})

		bench('record cache miss', () => {
			monitor.recordCacheMiss()
		})

		bench('get metrics', () => {
			monitor.getMetrics()
		})

		bench('check budget', () => {
			monitor.checkBudget()
		})

		bench('get report', () => {
			monitor.getReport()
		})
	})

	describe('Request Performance', () => {
		let client: AuditClient

		bench('request with cache miss', async () => {
			// Create client inline for each benchmark
			const client = new AuditClient({
				baseUrl: 'https://api.test.com',
				authentication: {
					type: 'apiKey',
					apiKey: 'test-key',
				},
				cache: {
					enabled: true,
					defaultTtlMs: 300000,
					maxSize: 1000,
				},
			})

			// Mock fetch for benchmarks
			global.fetch = async () => {
				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				})
			}

			try {
				await client.events.query({
					filter: { actions: [`bench-${Math.random()}`] },
					pagination: { limit: 10, offset: 0 },
				})
			} catch (error) {
				// Ignore errors in benchmark
			}

			client.destroy()
		})

		bench('get performance report', () => {
			const client = new AuditClient({
				baseUrl: 'https://api.test.com',
				authentication: {
					type: 'apiKey',
					apiKey: 'test-key',
				},
			})
			client.getPerformanceReport()
			client.destroy()
		})

		bench('check performance budget', () => {
			const client = new AuditClient({
				baseUrl: 'https://api.test.com',
				authentication: {
					type: 'apiKey',
					apiKey: 'test-key',
				},
			})
			client.checkPerformanceBudget()
			client.destroy()
		})

		bench('get client stats', () => {
			const client = new AuditClient({
				baseUrl: 'https://api.test.com',
				authentication: {
					type: 'apiKey',
					apiKey: 'test-key',
				},
			})
			client.getStats()
			client.destroy()
		})
	})

	describe('Percentile Calculations', () => {
		const monitor = new PerformanceMonitor({
			maxBundleSize: 200 * 1024,
			maxInitTime: 100,
			maxRequestTime: 1000,
			maxMemoryUsage: 50 * 1024 * 1024,
			maxCacheSize: 1000,
		})

		// Populate with sample data inline
		for (let i = 0; i < 1000; i++) {
			monitor.recordRequestTime(Math.random() * 2000)
		}

		bench('calculate p95 percentile', () => {
			monitor.getMetrics()
		})

		bench('calculate p99 percentile', () => {
			monitor.getMetrics()
		})

		bench('calculate average', () => {
			monitor.getMetrics()
		})
	})

	describe('Memory Tracking', () => {
		const monitor = new PerformanceMonitor({
			maxBundleSize: 200 * 1024,
			maxInitTime: 100,
			maxRequestTime: 1000,
			maxMemoryUsage: 50 * 1024 * 1024,
			maxCacheSize: 1000,
		})

		bench('record memory usage', () => {
			monitor.recordMemoryUsage(Math.random() * 50 * 1024 * 1024)
		})

		bench('get current memory usage', () => {
			monitor.getMetrics()
		})
	})

	describe('Error Rate Tracking', () => {
		const monitor = new PerformanceMonitor({
			maxBundleSize: 200 * 1024,
			maxInitTime: 100,
			maxRequestTime: 1000,
			maxMemoryUsage: 50 * 1024 * 1024,
			maxCacheSize: 1000,
		})

		bench('record success', () => {
			monitor.recordSuccess()
		})

		bench('record error', () => {
			monitor.recordError()
		})

		bench('calculate error rate', () => {
			monitor.getMetrics()
		})
	})

	describe('Cache Hit Rate Tracking', () => {
		const monitor = new PerformanceMonitor({
			maxBundleSize: 200 * 1024,
			maxInitTime: 100,
			maxRequestTime: 1000,
			maxMemoryUsage: 50 * 1024 * 1024,
			maxCacheSize: 1000,
		})

		bench('track cache operations', () => {
			if (Math.random() > 0.3) {
				monitor.recordCacheHit()
			} else {
				monitor.recordCacheMiss()
			}
		})

		bench('calculate cache hit rate', () => {
			monitor.getMetrics()
		})
	})
})
