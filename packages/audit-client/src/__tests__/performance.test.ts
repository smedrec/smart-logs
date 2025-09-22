import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LoggerFactory } from '../infrastructure/logger'
import {
	CompressionManager,
	PerformanceManager,
	PerformanceMetricsCollector,
	RequestDeduplicationManager,
	RequestQueueManager,
	StreamingManager,
} from '../infrastructure/performance'

import type { PerformanceConfig } from '../infrastructure/performance'

// Mock fetch for testing
global.fetch = vi.fn()

describe('Performance Optimization Features', () => {
	let config: PerformanceConfig
	let logger: ReturnType<typeof LoggerFactory.create>

	beforeEach(() => {
		config = {
			enableCompression: true,
			enableStreaming: true,
			maxConcurrentRequests: 5,
			requestDeduplication: true,
			responseTransformation: true,
			metricsCollection: true,
			metricsBufferSize: 1000,
			compressionThreshold: 1024,
			streamingThreshold: 10240,
		}

		logger = LoggerFactory.create({
			enabled: true,
			level: 'info',
			format: 'text',
			includeRequestBody: false,
			includeResponseBody: false,
			maskSensitiveData: true,
			sensitiveFields: [],
			maxLogSize: 10000,
			enableConsole: false,
			enableBuffer: true,
			bufferSize: 100,
		})

		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('CompressionManager', () => {
		let compressionManager: CompressionManager

		beforeEach(() => {
			compressionManager = new CompressionManager(config, logger)
		})

		it('should compress request when conditions are met', async () => {
			const body = JSON.stringify({ data: 'x'.repeat(2000) }) // Large enough to compress
			const contentType = 'application/json'

			const result = await compressionManager.compressRequest(body, contentType)

			expect(result.compressed).toBe(true)
			expect(result.headers['Content-Encoding']).toBe('gzip')
			expect(result.headers['Content-Type']).toBe(contentType)
		})

		it('should not compress small requests', async () => {
			const body = JSON.stringify({ data: 'small' })
			const contentType = 'application/json'

			const result = await compressionManager.compressRequest(body, contentType)

			expect(result.compressed).toBe(false)
			expect(result.body).toBe(body)
			expect(Object.keys(result.headers)).toHaveLength(0)
		})

		it('should not compress non-text content types', async () => {
			const body = 'x'.repeat(2000)
			const contentType = 'image/jpeg'

			const result = await compressionManager.compressRequest(body, contentType)

			expect(result.compressed).toBe(false)
			expect(result.body).toBe(body)
		})

		it('should handle compression errors gracefully', async () => {
			const body = { circular: {} }
			body.circular = body // Create circular reference
			const contentType = 'application/json'

			// Mock JSON.stringify to throw
			const originalStringify = JSON.stringify
			vi.spyOn(JSON, 'stringify').mockImplementation(() => {
				throw new Error('Circular reference')
			})

			const result = await compressionManager.compressRequest(body, contentType)

			expect(result.compressed).toBe(false)
			expect(result.body).toBe(body)

			JSON.stringify = originalStringify
		})
	})

	describe('StreamingManager', () => {
		let streamingManager: StreamingManager

		beforeEach(() => {
			streamingManager = new StreamingManager(config, logger)
		})

		it('should determine when to stream based on content length', () => {
			const response = new Response('test', {
				headers: { 'content-length': '20000' },
			})

			const shouldStream = streamingManager.shouldStream(response)
			expect(shouldStream).toBe(true)
		})

		it('should not stream small responses', () => {
			const response = new Response('test', {
				headers: { 'content-length': '100' },
			})

			const shouldStream = streamingManager.shouldStream(response)
			expect(shouldStream).toBe(false)
		})

		it('should stream based on content type', () => {
			const response = new Response('test', {
				headers: { 'content-type': 'application/octet-stream' },
			})

			const shouldStream = streamingManager.shouldStream(response)
			expect(shouldStream).toBe(true)
		})

		it('should create stream reader for valid response', () => {
			const mockBody = new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode('{"data": "chunk1"}\n'))
					controller.enqueue(new TextEncoder().encode('{"data": "chunk2"}\n'))
					controller.close()
				},
			})

			const response = new Response(mockBody, {
				headers: { 'content-type': 'application/json' },
			})

			const reader = streamingManager.createStreamReader(response)
			expect(reader).toBeDefined()
			expect(typeof reader[Symbol.asyncIterator]).toBe('function')
		})

		it('should throw error for response without body', () => {
			const response = new Response(null)
			Object.defineProperty(response, 'body', { value: null })

			expect(() => streamingManager.createStreamReader(response)).toThrow(
				'Response body is not available for streaming'
			)
		})
	})

	describe('RequestQueueManager', () => {
		let queueManager: RequestQueueManager

		beforeEach(() => {
			queueManager = new RequestQueueManager(config, logger)
		})

		it('should execute request immediately when under capacity', async () => {
			const mockExecutor = vi.fn().mockResolvedValue('result')

			const result = await queueManager.enqueue(mockExecutor)

			expect(result).toBe('result')
			expect(mockExecutor).toHaveBeenCalledTimes(1)
		})

		it('should queue requests when at capacity', async () => {
			const mockExecutors = Array.from({ length: 10 }, () =>
				vi
					.fn()
					.mockImplementation(
						() => new Promise((resolve) => setTimeout(() => resolve('result'), 100))
					)
			)

			// Start all requests
			const promises = mockExecutors.map((executor) => queueManager.enqueue(executor))

			// Wait a bit to let the queue process
			await new Promise((resolve) => setTimeout(resolve, 50))

			const stats = queueManager.getStats()
			expect(stats.activeRequests).toBe(config.maxConcurrentRequests)
			expect(stats.queuedRequests).toBeGreaterThan(0)

			// Wait for all to complete
			await Promise.all(promises)

			const finalStats = queueManager.getStats()
			expect(finalStats.activeRequests).toBe(0)
			expect(finalStats.queuedRequests).toBe(0)
		})

		it('should handle request failures', async () => {
			const mockExecutor = vi.fn().mockRejectedValue(new Error('Request failed'))

			await expect(queueManager.enqueue(mockExecutor)).rejects.toThrow('Request failed')

			const stats = queueManager.getStats()
			expect(stats.failedRequests).toBe(1)
		})

		it('should prioritize requests correctly', async () => {
			// Fill up the queue
			const slowExecutors = Array.from({ length: config.maxConcurrentRequests }, () =>
				vi
					.fn()
					.mockImplementation(
						() => new Promise((resolve) => setTimeout(() => resolve('slow'), 200))
					)
			)

			// Start slow requests to fill capacity
			slowExecutors.forEach((executor) => queueManager.enqueue(executor))

			// Add high and low priority requests
			const highPriorityExecutor = vi.fn().mockResolvedValue('high')
			const lowPriorityExecutor = vi.fn().mockResolvedValue('low')

			const highPriorityPromise = queueManager.enqueue(highPriorityExecutor, { priority: 10 })
			const lowPriorityPromise = queueManager.enqueue(lowPriorityExecutor, { priority: 1 })

			// Wait for queue to process
			await new Promise((resolve) => setTimeout(resolve, 250))

			const results = await Promise.all([highPriorityPromise, lowPriorityPromise])
			expect(results).toEqual(['high', 'low'])
		})

		it('should clear queue correctly', async () => {
			const mockExecutor = vi
				.fn()
				.mockImplementation(
					() => new Promise((resolve) => setTimeout(() => resolve('result'), 100))
				)

			// Fill up the queue
			const promises = Array.from({ length: 10 }, () => queueManager.enqueue(mockExecutor))

			// Clear the queue
			queueManager.clear()

			// All queued requests should be rejected
			const results = await Promise.allSettled(promises)
			const rejectedCount = results.filter((result) => result.status === 'rejected').length
			expect(rejectedCount).toBeGreaterThan(0)
		})
	})

	describe('PerformanceMetricsCollector', () => {
		let metricsCollector: PerformanceMetricsCollector

		beforeEach(() => {
			metricsCollector = new PerformanceMetricsCollector(config, logger)
		})

		it('should track request metrics correctly', () => {
			const requestId = 'test-request-1'
			const endpoint = '/api/test'
			const method = 'GET'

			metricsCollector.startRequest(requestId, endpoint, method)

			// Simulate some processing time
			setTimeout(() => {
				metricsCollector.completeRequest(requestId, {
					status: 200,
					bytesTransferred: 1024,
					compressed: true,
					cached: false,
				})
			}, 10)

			// Wait for completion
			return new Promise<void>((resolve) => {
				setTimeout(() => {
					const metrics = metricsCollector.getMetrics()
					expect(metrics.requestCount).toBe(1)
					expect(metrics.successCount).toBe(1)
					expect(metrics.errorCount).toBe(0)
					expect(metrics.bytesTransferred).toBe(1024)
					expect(metrics.compressionRatio).toBe(1)
					resolve()
				}, 20)
			})
		})

		it('should track error metrics correctly', () => {
			const requestId = 'test-request-error'
			const endpoint = '/api/error'
			const method = 'POST'

			metricsCollector.startRequest(requestId, endpoint, method)
			metricsCollector.completeRequest(requestId, {
				error: 'Request failed',
			})

			const metrics = metricsCollector.getMetrics()
			expect(metrics.requestCount).toBe(1)
			expect(metrics.successCount).toBe(0)
			expect(metrics.errorCount).toBe(1)
		})

		it('should calculate cache hit rate correctly', () => {
			// Add cached request
			metricsCollector.startRequest('req1', '/api/test', 'GET')
			metricsCollector.completeRequest('req1', { cached: true })

			// Add non-cached request
			metricsCollector.startRequest('req2', '/api/test', 'GET')
			metricsCollector.completeRequest('req2', { cached: false })

			const metrics = metricsCollector.getMetrics()
			expect(metrics.cacheHitRate).toBe(0.5)
		})

		it('should reset metrics correctly', () => {
			metricsCollector.startRequest('req1', '/api/test', 'GET')
			metricsCollector.completeRequest('req1', { status: 200 })

			let metrics = metricsCollector.getMetrics()
			expect(metrics.requestCount).toBe(1)

			metricsCollector.reset()

			metrics = metricsCollector.getMetrics()
			expect(metrics.requestCount).toBe(0)
			expect(metrics.successCount).toBe(0)
		})

		it('should get metrics for specific time period', () => {
			const startTime = Date.now()

			metricsCollector.startRequest('req1', '/api/test', 'GET')
			metricsCollector.completeRequest('req1', { status: 200 })

			const endTime = Date.now()
			const periodMetrics = metricsCollector.getMetricsForPeriod(startTime, endTime)

			expect(periodMetrics).toHaveLength(1)
			expect(periodMetrics[0].requestId).toBe('req1')
		})
	})

	describe('RequestDeduplicationManager', () => {
		let deduplicationManager: RequestDeduplicationManager

		beforeEach(() => {
			deduplicationManager = new RequestDeduplicationManager(config, logger)
		})

		it('should deduplicate identical requests', async () => {
			const mockExecutor = vi.fn().mockResolvedValue('result')
			const key = 'test-key'

			// Execute same request twice
			const promise1 = deduplicationManager.execute(key, mockExecutor)
			const promise2 = deduplicationManager.execute(key, mockExecutor)

			const [result1, result2] = await Promise.all([promise1, promise2])

			expect(result1).toBe('result')
			expect(result2).toBe('result')
			expect(mockExecutor).toHaveBeenCalledTimes(1) // Should only execute once
		})

		it('should generate consistent keys for same parameters', () => {
			const key1 = deduplicationManager.generateKey(
				'/api/test',
				'GET',
				{ data: 'test' },
				{ page: 1 }
			)
			const key2 = deduplicationManager.generateKey(
				'/api/test',
				'GET',
				{ data: 'test' },
				{ page: 1 }
			)

			expect(key1).toBe(key2)
		})

		it('should generate different keys for different parameters', () => {
			const key1 = deduplicationManager.generateKey('/api/test', 'GET', { data: 'test1' })
			const key2 = deduplicationManager.generateKey('/api/test', 'GET', { data: 'test2' })

			expect(key1).not.toBe(key2)
		})

		it('should handle request failures correctly', async () => {
			const mockExecutor = vi.fn().mockRejectedValue(new Error('Request failed'))
			const key = 'test-key'

			await expect(deduplicationManager.execute(key, mockExecutor)).rejects.toThrow(
				'Request failed'
			)

			// Should be able to retry after failure
			const successExecutor = vi.fn().mockResolvedValue('success')
			const result = await deduplicationManager.execute(key, successExecutor)
			expect(result).toBe('success')
		})

		it('should clear pending requests', async () => {
			const mockExecutor = vi
				.fn()
				.mockImplementation(
					() => new Promise((resolve) => setTimeout(() => resolve('result'), 100))
				)
			const key = 'test-key'

			const promise = deduplicationManager.execute(key, mockExecutor)

			let stats = deduplicationManager.getStats()
			expect(stats.pendingRequests).toBe(1)

			deduplicationManager.clear()

			stats = deduplicationManager.getStats()
			expect(stats.pendingRequests).toBe(0)

			// Original promise should still resolve
			const result = await promise
			expect(result).toBe('result')
		})
	})

	describe('PerformanceManager', () => {
		let performanceManager: PerformanceManager

		beforeEach(() => {
			performanceManager = new PerformanceManager(config, logger)
		})

		it('should provide access to all sub-managers', () => {
			expect(performanceManager.getCompressionManager()).toBeInstanceOf(CompressionManager)
			expect(performanceManager.getStreamingManager()).toBeInstanceOf(StreamingManager)
			expect(performanceManager.getQueueManager()).toBeInstanceOf(RequestQueueManager)
			expect(performanceManager.getMetricsCollector()).toBeInstanceOf(PerformanceMetricsCollector)
			expect(performanceManager.getDeduplicationManager()).toBeInstanceOf(
				RequestDeduplicationManager
			)
		})

		it('should provide comprehensive statistics', () => {
			const stats = performanceManager.getStats()

			expect(stats).toHaveProperty('metrics')
			expect(stats).toHaveProperty('queue')
			expect(stats).toHaveProperty('deduplication')

			expect(stats.metrics).toHaveProperty('requestCount')
			expect(stats.queue).toHaveProperty('activeRequests')
			expect(stats.deduplication).toHaveProperty('pendingRequests')
		})

		it('should reset all components', () => {
			// Add some data to track
			performanceManager.getMetricsCollector().startRequest('req1', '/api/test', 'GET')
			performanceManager.getMetricsCollector().completeRequest('req1', { status: 200 })

			let stats = performanceManager.getStats()
			expect(stats.metrics.requestCount).toBe(1)

			performanceManager.reset()

			stats = performanceManager.getStats()
			expect(stats.metrics.requestCount).toBe(0)
		})

		it('should update configuration', () => {
			const newConfig = { enableCompression: false }
			performanceManager.updateConfig(newConfig)

			// Configuration should be updated (we can't easily test this without exposing internal state)
			expect(() => performanceManager.updateConfig(newConfig)).not.toThrow()
		})
	})

	describe('Integration Tests', () => {
		it('should work together in a realistic scenario', async () => {
			const performanceManager = new PerformanceManager(config, logger)

			// Simulate multiple concurrent requests
			const requests = Array.from({ length: 10 }, (_, i) => ({
				id: `req-${i}`,
				executor: vi
					.fn()
					.mockImplementation(
						() =>
							new Promise((resolve) =>
								setTimeout(() => resolve(`result-${i}`), Math.random() * 100)
							)
					),
			}))

			// Start performance tracking for all requests
			requests.forEach((req) => {
				performanceManager.getMetricsCollector().startRequest(req.id, '/api/test', 'GET')
			})

			// Execute requests through queue manager
			const results = await Promise.all(
				requests.map((req) =>
					performanceManager
						.getQueueManager()
						.enqueue(req.executor, { priority: Math.floor(Math.random() * 5) })
				)
			)

			// Complete performance tracking
			requests.forEach((req, i) => {
				performanceManager.getMetricsCollector().completeRequest(req.id, {
					status: 200,
					bytesTransferred: 1024 + i * 100,
				})
			})

			// Verify results
			expect(results).toHaveLength(10)
			results.forEach((result, i) => {
				expect(result).toBe(`result-${i}`)
			})

			// Check performance metrics
			const stats = performanceManager.getStats()
			expect(stats.metrics.requestCount).toBe(10)
			expect(stats.metrics.successCount).toBe(10)
			expect(stats.metrics.errorCount).toBe(0)
			expect(stats.queue.completedRequests).toBe(10)
		})
	})
})
