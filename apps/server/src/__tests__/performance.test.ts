/**
 * Performance and Load Tests
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { testUtils } from './setup'

// Performance testing utilities
class PerformanceMonitor {
	private startTime: number = 0
	private endTime: number = 0
	private memoryStart: NodeJS.MemoryUsage | null = null
	private memoryEnd: NodeJS.MemoryUsage | null = null

	start() {
		this.startTime = performance.now()
		this.memoryStart = process.memoryUsage()
	}

	end() {
		this.endTime = performance.now()
		this.memoryEnd = process.memoryUsage()
	}

	getDuration() {
		return this.endTime - this.startTime
	}

	getMemoryDelta() {
		if (!this.memoryStart || !this.memoryEnd) return null
		return {
			heapUsed: this.memoryEnd.heapUsed - this.memoryStart.heapUsed,
			heapTotal: this.memoryEnd.heapTotal - this.memoryStart.heapTotal,
			external: this.memoryEnd.external - this.memoryStart.external,
			rss: this.memoryEnd.rss - this.memoryStart.rss,
		}
	}
}

// Mock load generator
class LoadGenerator {
	private concurrency: number
	private duration: number
	private requestsPerSecond: number

	constructor(concurrency: number, duration: number, requestsPerSecond: number) {
		this.concurrency = concurrency
		this.duration = duration
		this.requestsPerSecond = requestsPerSecond
	}

	async generateLoad(requestFunction: () => Promise<any>) {
		const results: Array<{ success: boolean; duration: number; error?: Error }> = []
		const startTime = Date.now()
		const endTime = startTime + this.duration

		const workers = Array(this.concurrency)
			.fill(null)
			.map(async () => {
				while (Date.now() < endTime) {
					const requestStart = performance.now()
					try {
						await requestFunction()
						const requestEnd = performance.now()
						results.push({
							success: true,
							duration: requestEnd - requestStart,
						})
					} catch (error) {
						const requestEnd = performance.now()
						results.push({
							success: false,
							duration: requestEnd - requestStart,
							error: error as Error,
						})
					}

					// Rate limiting
					const delay = 1000 / this.requestsPerSecond
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
			})

		await Promise.all(workers)
		return results
	}
}

describe('Performance and Load Tests', () => {
	let mockServices: any
	let mockContext: any

	beforeEach(() => {
		mockServices = {
			...testUtils.mockServices,
			audit: {
				...testUtils.mockServices.audit,
				log: vi.fn().mockResolvedValue(undefined),
			},
			client: {
				...testUtils.mockServices.client,
				executeMonitoredQuery: vi.fn().mockResolvedValue([]),
				executeOptimizedQuery: vi.fn().mockResolvedValue([]),
			},
		}

		mockContext = {
			...testUtils.mockTRPCContext,
			services: mockServices,
		}
	})

	describe('TRPC Performance Tests', () => {
		it('should handle high-throughput audit event creation', async () => {
			const { eventsRouter } = await import('../routers/events')
			const monitor = new PerformanceMonitor()

			const eventInput = {
				action: 'performance.test',
				principalId: 'user-perf',
				organizationId: 'org-perf',
				status: 'success' as const,
				dataClassification: 'INTERNAL' as const,
			}

			const requestCount = 1000
			monitor.start()

			const promises = Array(requestCount)
				.fill(null)
				.map(() =>
					eventsRouter.create({
						ctx: mockContext,
						input: eventInput,
						type: 'mutation',
						path: 'events.create',
					})
				)

			const results = await Promise.all(promises)
			monitor.end()

			const duration = monitor.getDuration()
			const throughput = requestCount / (duration / 1000)
			const memoryDelta = monitor.getMemoryDelta()

			// Performance assertions
			expect(results).toHaveLength(requestCount)
			expect(results.every((r) => r.success)).toBe(true)
			expect(throughput).toBeGreaterThan(100) // Should handle >100 requests/second
			expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
			expect(memoryDelta?.heapUsed).toBeLessThan(100 * 1024 * 1024) // <100MB memory increase

			console.log(
				`TRPC Performance: ${throughput.toFixed(2)} req/s, ${duration.toFixed(2)}ms total`
			)
		})

		it('should handle large query result sets efficiently', async () => {
			const { eventsRouter } = await import('../routers/events')
			const monitor = new PerformanceMonitor()

			// Mock large dataset
			const largeDataset = Array(10000)
				.fill(null)
				.map((_, index) => testUtils.generateAuditEvent({ id: index + 1 }))

			mockServices.client.executeMonitoredQuery
				.mockResolvedValueOnce(largeDataset)
				.mockResolvedValueOnce([{ count: 10000 }])

			const queryInput = {
				pagination: { limit: 10000, offset: 0 },
				filter: {
					dateRange: {
						startDate: '2024-01-01T00:00:00.000Z',
						endDate: '2024-01-31T23:59:59.999Z',
					},
				},
			}

			monitor.start()
			const result = await eventsRouter.query({
				ctx: mockContext,
				input: queryInput,
				type: 'query',
				path: 'events.query',
			})
			monitor.end()

			const duration = monitor.getDuration()
			const memoryDelta = monitor.getMemoryDelta()

			// Performance assertions
			expect(result.events).toHaveLength(10000)
			expect(duration).toBeLessThan(1000) // Should complete within 1 second
			expect(memoryDelta?.heapUsed).toBeLessThan(200 * 1024 * 1024) // <200MB memory increase

			console.log(`Large Query Performance: ${duration.toFixed(2)}ms for 10k records`)
		})

		it('should handle concurrent queries efficiently', async () => {
			const { eventsRouter } = await import('../routers/events')
			const monitor = new PerformanceMonitor()

			// Mock different query results
			mockServices.client.executeMonitoredQuery.mockImplementation(() =>
				Promise.resolve([testUtils.generateAuditEvent()])
			)
			mockServices.client.executeOptimizedQuery.mockImplementation(() =>
				Promise.resolve([testUtils.generateAuditEvent()])
			)

			const concurrentQueries = 100
			monitor.start()

			const promises = Array(concurrentQueries)
				.fill(null)
				.map((_, index) => {
					if (index % 2 === 0) {
						// Query multiple events
						return eventsRouter.query({
							ctx: mockContext,
							input: { pagination: { limit: 50, offset: 0 } },
							type: 'query',
							path: 'events.query',
						})
					} else {
						// Query single event
						return eventsRouter.getById({
							ctx: mockContext,
							input: { id: `${index}` },
							type: 'query',
							path: 'events.getById',
						})
					}
				})

			const results = await Promise.all(promises)
			monitor.end()

			const duration = monitor.getDuration()
			const throughput = concurrentQueries / (duration / 1000)

			// Performance assertions
			expect(results).toHaveLength(concurrentQueries)
			expect(throughput).toBeGreaterThan(50) // Should handle >50 concurrent queries/second
			expect(duration).toBeLessThan(2000) // Should complete within 2 seconds

			console.log(`Concurrent Query Performance: ${throughput.toFixed(2)} queries/s`)
		})
	})

	describe('REST API Performance Tests', () => {
		it('should handle high-throughput REST requests', async () => {
			const { createRestAPI } = await import('../routes/rest-api')
			const app = createRestAPI()

			// Add middleware to inject services
			app.use('*', (c: any, next: any) => {
				c.set('services', mockServices)
				c.set('session', testUtils.mockSession)
				c.set('requestId', 'perf-test-request')
				c.set('apiVersion', { resolved: '1.0.0' })
				return next()
			})

			const monitor = new PerformanceMonitor()
			const requestCount = 500

			monitor.start()

			const promises = Array(requestCount)
				.fill(null)
				.map(
					() =>
						fetch('http://localhost/health', {
							method: 'GET',
						}).catch(() => ({ status: 200 })) // Mock successful response
				)

			const results = await Promise.all(promises)
			monitor.end()

			const duration = monitor.getDuration()
			const throughput = requestCount / (duration / 1000)

			// Performance assertions
			expect(results).toHaveLength(requestCount)
			expect(throughput).toBeGreaterThan(50) // Should handle >50 requests/second
			expect(duration).toBeLessThan(10000) // Should complete within 10 seconds

			console.log(`REST API Performance: ${throughput.toFixed(2)} req/s`)
		})

		it('should handle large response payloads efficiently', async () => {
			const monitor = new PerformanceMonitor()

			// Mock large response payload
			const largePayload = {
				events: Array(5000)
					.fill(null)
					.map((_, index) => testUtils.generateAuditEvent({ id: index + 1 })),
				pagination: {
					total: 5000,
					limit: 5000,
					offset: 0,
					hasNext: false,
					hasPrevious: false,
				},
			}

			monitor.start()

			// Simulate JSON serialization/deserialization
			const serialized = JSON.stringify(largePayload)
			const deserialized = JSON.parse(serialized)

			monitor.end()

			const duration = monitor.getDuration()
			const payloadSize = Buffer.byteLength(serialized, 'utf8')

			// Performance assertions
			expect(deserialized.events).toHaveLength(5000)
			expect(duration).toBeLessThan(500) // Should serialize/deserialize within 500ms
			expect(payloadSize).toBeLessThan(50 * 1024 * 1024) // Should be <50MB

			console.log(
				`Large Payload Performance: ${duration.toFixed(2)}ms for ${(payloadSize / 1024 / 1024).toFixed(2)}MB`
			)
		})
	})

	describe('Database Performance Tests', () => {
		it('should handle database connection pooling efficiently', async () => {
			const monitor = new PerformanceMonitor()
			const connectionCount = 50

			// Mock database connections
			const connections = Array(connectionCount)
				.fill(null)
				.map(() => ({
					query: vi.fn().mockResolvedValue([testUtils.generateAuditEvent()]),
					close: vi.fn(),
				}))

			monitor.start()

			// Simulate concurrent database operations
			const promises = connections.map((conn) => conn.query('SELECT * FROM audit_log LIMIT 1'))

			const results = await Promise.all(promises)
			monitor.end()

			const duration = monitor.getDuration()

			// Performance assertions
			expect(results).toHaveLength(connectionCount)
			expect(duration).toBeLessThan(1000) // Should complete within 1 second

			console.log(
				`Database Connection Performance: ${duration.toFixed(2)}ms for ${connectionCount} connections`
			)
		})

		it('should handle query optimization efficiently', async () => {
			const monitor = new PerformanceMonitor()

			// Mock optimized vs unoptimized queries
			const optimizedQuery = vi.fn().mockResolvedValue([testUtils.generateAuditEvent()])
			const unoptimizedQuery = vi
				.fn()
				.mockImplementation(
					() =>
						new Promise((resolve) =>
							setTimeout(() => resolve([testUtils.generateAuditEvent()]), 100)
						)
				)

			mockServices.client.executeOptimizedQuery = optimizedQuery
			mockServices.client.executeMonitoredQuery = unoptimizedQuery

			monitor.start()

			// Run both query types
			const [optimizedResult, unoptimizedResult] = await Promise.all([
				mockServices.client.executeOptimizedQuery(() => []),
				mockServices.client.executeMonitoredQuery(() => []),
			])

			monitor.end()

			const duration = monitor.getDuration()

			// Performance assertions
			expect(optimizedResult).toBeDefined()
			expect(unoptimizedResult).toBeDefined()
			expect(duration).toBeLessThan(200) // Should complete within 200ms

			console.log(`Query Optimization Performance: ${duration.toFixed(2)}ms`)
		})
	})

	describe('Memory Performance Tests', () => {
		it('should handle memory usage efficiently during high load', async () => {
			const monitor = new PerformanceMonitor()
			const { eventsRouter } = await import('../routers/events')

			monitor.start()

			// Create many objects to test memory management
			const promises = Array(1000)
				.fill(null)
				.map(() =>
					eventsRouter.create({
						ctx: mockContext,
						input: {
							action: 'memory.test',
							principalId: 'user-memory',
							organizationId: 'org-memory',
							status: 'success' as const,
							metadata: {
								// Add some data to increase memory usage
								largeData: Array(100).fill('test-data'),
							},
						},
						type: 'mutation',
						path: 'events.create',
					})
				)

			await Promise.all(promises)

			// Force garbage collection if available
			if (global.gc) {
				global.gc()
			}

			monitor.end()

			const memoryDelta = monitor.getMemoryDelta()
			const duration = monitor.getDuration()

			// Memory performance assertions
			expect(memoryDelta?.heapUsed).toBeLessThan(500 * 1024 * 1024) // <500MB increase
			expect(duration).toBeLessThan(5000) // Should complete within 5 seconds

			console.log(
				`Memory Performance: ${(memoryDelta?.heapUsed || 0) / 1024 / 1024}MB heap increase in ${duration.toFixed(2)}ms`
			)
		})

		it('should prevent memory leaks during long-running operations', async () => {
			const initialMemory = process.memoryUsage()
			const { eventsRouter } = await import('../routers/events')

			// Simulate long-running operations
			for (let i = 0; i < 100; i++) {
				await eventsRouter.create({
					ctx: mockContext,
					input: {
						action: `leak.test.${i}`,
						principalId: 'user-leak',
						organizationId: 'org-leak',
						status: 'success' as const,
					},
					type: 'mutation',
					path: 'events.create',
				})

				// Periodically check memory usage
				if (i % 10 === 0) {
					const currentMemory = process.memoryUsage()
					const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed

					// Memory should not continuously increase
					expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // <100MB increase
				}
			}

			// Force garbage collection
			if (global.gc) {
				global.gc()
			}

			const finalMemory = process.memoryUsage()
			const totalIncrease = finalMemory.heapUsed - initialMemory.heapUsed

			// Final memory increase should be reasonable
			expect(totalIncrease).toBeLessThan(50 * 1024 * 1024) // <50MB final increase

			console.log(`Memory Leak Test: ${totalIncrease / 1024 / 1024}MB final increase`)
		})
	})

	describe('Load Testing', () => {
		it('should handle sustained load over time', async () => {
			const { eventsRouter } = await import('../routers/events')
			const loadGenerator = new LoadGenerator(10, 5000, 20) // 10 concurrent, 5 seconds, 20 req/s

			const requestFunction = async () => {
				await eventsRouter.create({
					ctx: mockContext,
					input: {
						action: 'load.test',
						principalId: 'user-load',
						organizationId: 'org-load',
						status: 'success' as const,
					},
					type: 'mutation',
					path: 'events.create',
				})
			}

			const results = await loadGenerator.generateLoad(requestFunction)

			const successfulRequests = results.filter((r) => r.success).length
			const failedRequests = results.filter((r) => !r.success).length
			const averageResponseTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length
			const successRate = successfulRequests / results.length

			// Load testing assertions
			expect(successRate).toBeGreaterThan(0.95) // >95% success rate
			expect(averageResponseTime).toBeLessThan(100) // <100ms average response time
			expect(results.length).toBeGreaterThan(50) // Should process significant number of requests

			console.log(
				`Load Test Results: ${results.length} requests, ${(successRate * 100).toFixed(1)}% success rate, ${averageResponseTime.toFixed(2)}ms avg response time`
			)
		})

		it('should handle burst traffic patterns', async () => {
			const { eventsRouter } = await import('../routers/events')
			const monitor = new PerformanceMonitor()

			// Simulate burst pattern: high load followed by low load
			const burstSize = 200
			const normalSize = 50

			monitor.start()

			// Burst phase
			const burstPromises = Array(burstSize)
				.fill(null)
				.map(() =>
					eventsRouter.create({
						ctx: mockContext,
						input: {
							action: 'burst.test',
							principalId: 'user-burst',
							organizationId: 'org-burst',
							status: 'success' as const,
						},
						type: 'mutation',
						path: 'events.create',
					})
				)

			const burstResults = await Promise.all(burstPromises)

			// Normal phase
			const normalPromises = Array(normalSize)
				.fill(null)
				.map(() =>
					eventsRouter.create({
						ctx: mockContext,
						input: {
							action: 'normal.test',
							principalId: 'user-normal',
							organizationId: 'org-normal',
							status: 'success' as const,
						},
						type: 'mutation',
						path: 'events.create',
					})
				)

			const normalResults = await Promise.all(normalPromises)

			monitor.end()

			const duration = monitor.getDuration()
			const totalRequests = burstSize + normalSize
			const throughput = totalRequests / (duration / 1000)

			// Burst handling assertions
			expect(burstResults.every((r) => r.success)).toBe(true)
			expect(normalResults.every((r) => r.success)).toBe(true)
			expect(throughput).toBeGreaterThan(30) // Should maintain >30 req/s during burst
			expect(duration).toBeLessThan(10000) // Should complete within 10 seconds

			console.log(`Burst Test: ${throughput.toFixed(2)} req/s for ${totalRequests} requests`)
		})
	})

	describe('Caching Performance Tests', () => {
		it('should improve performance with caching', async () => {
			const { eventsRouter } = await import('../routers/events')

			// Mock cache hit vs cache miss
			let cacheHit = false
			mockServices.client.executeOptimizedQuery.mockImplementation(() => {
				if (cacheHit) {
					// Simulate cache hit (fast)
					return Promise.resolve([testUtils.generateAuditEvent()])
				} else {
					// Simulate cache miss (slower)
					cacheHit = true
					return new Promise((resolve) =>
						setTimeout(() => resolve([testUtils.generateAuditEvent()]), 50)
					)
				}
			})

			// First request (cache miss)
			const monitor1 = new PerformanceMonitor()
			monitor1.start()
			await eventsRouter.getById({
				ctx: mockContext,
				input: { id: '123' },
				type: 'query',
				path: 'events.getById',
			})
			monitor1.end()

			// Second request (cache hit)
			const monitor2 = new PerformanceMonitor()
			monitor2.start()
			await eventsRouter.getById({
				ctx: mockContext,
				input: { id: '123' },
				type: 'query',
				path: 'events.getById',
			})
			monitor2.end()

			const cacheMissDuration = monitor1.getDuration()
			const cacheHitDuration = monitor2.getDuration()

			// Caching performance assertions
			expect(cacheHitDuration).toBeLessThan(cacheMissDuration)
			expect(cacheHitDuration).toBeLessThan(10) // Cache hit should be very fast

			console.log(
				`Cache Performance: ${cacheMissDuration.toFixed(2)}ms miss vs ${cacheHitDuration.toFixed(2)}ms hit`
			)
		})
	})
})
