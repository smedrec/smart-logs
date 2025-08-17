/**
 * Tests for enhanced metrics collection
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PerformanceTimer, RedisEnhancedMetricsCollector } from '../metrics-collector.js'

// Mock Redis
const mockRedis = {
	hset: vi.fn().mockResolvedValue('OK'),
	hgetall: vi.fn().mockResolvedValue({}),
	expire: vi.fn().mockResolvedValue(1),
	incr: vi.fn().mockResolvedValue(1),
	keys: vi.fn().mockResolvedValue([]),
	del: vi.fn().mockResolvedValue(1),
	zadd: vi.fn().mockResolvedValue(1),
	zrangebyscore: vi.fn().mockResolvedValue([]),
	zremrangebyscore: vi.fn().mockResolvedValue(1),
	set: vi.fn().mockResolvedValue('OK'),
	get: vi.fn().mockResolvedValue('0'),
	incrby: vi.fn().mockResolvedValue(1),
}

describe('RedisEnhancedMetricsCollector', () => {
	let collector: RedisEnhancedMetricsCollector
	const config = {
		enabled: true,
		collectionInterval: 1000,
		retentionPeriod: 3600,
		exporterType: 'console' as const,
	}

	beforeEach(() => {
		vi.clearAllMocks()
		collector = new RedisEnhancedMetricsCollector(config, mockRedis as any)
	})

	afterEach(() => {
		vi.clearAllTimers()
	})

	describe('recordPerformanceMetrics', () => {
		it('should record performance metrics to Redis', async () => {
			const metrics = {
				eventProcessingTime: 100,
				eventValidationTime: 50,
				queueDepth: 10,
			}

			await collector.recordPerformanceMetrics(metrics)

			expect(mockRedis.hset).toHaveBeenCalledWith(
				'audit:observability:performance',
				expect.objectContaining({
					eventProcessingTime: '100',
					eventValidationTime: '50',
					queueDepth: '10',
				})
			)
			expect(mockRedis.expire).toHaveBeenCalled()
		})
	})

	describe('getPerformanceMetrics', () => {
		it('should retrieve performance metrics from Redis', async () => {
			mockRedis.hgetall.mockResolvedValueOnce({
				eventProcessingTime: '100',
				eventValidationTime: '50',
				queueDepth: '10',
				timestamp: '2023-01-01T00:00:00.000Z',
			})

			const metrics = await collector.getPerformanceMetrics()

			expect(metrics.eventProcessingTime).toBe(100)
			expect(metrics.eventValidationTime).toBe(50)
			expect(metrics.queueDepth).toBe(10)
			expect(metrics.timestamp).toBe('2023-01-01T00:00:00.000Z')
		})

		it('should return default values when no data exists', async () => {
			mockRedis.hgetall.mockResolvedValueOnce({})

			const metrics = await collector.getPerformanceMetrics()

			expect(metrics.eventProcessingTime).toBe(0)
			expect(metrics.eventValidationTime).toBe(0)
			expect(metrics.queueDepth).toBe(0)
		})
	})

	describe('collectSystemMetrics', () => {
		it('should collect current system metrics', async () => {
			const metrics = await collector.collectSystemMetrics()

			expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0)
			expect(metrics.memory.total).toBeGreaterThan(0)
			expect(metrics.memory.used).toBeGreaterThanOrEqual(0)
			expect(metrics.timestamp).toBeDefined()
		})
	})

	describe('recordOperation', () => {
		it('should record audit operation metrics', async () => {
			const operation = {
				operationType: 'CREATE' as const,
				operationName: 'create_audit_event',
				duration: 150,
				success: true,
				metadata: { eventType: 'user_action' },
				timestamp: '2023-01-01T00:00:00.000Z',
			}

			await collector.recordOperation(operation)

			expect(mockRedis.hset).toHaveBeenCalledWith(
				expect.stringMatching(/audit:observability:operations:/),
				expect.objectContaining({
					operationType: 'CREATE',
					operationName: 'create_audit_event',
					duration: '150',
					success: 'true',
					metadata: JSON.stringify({ eventType: 'user_action' }),
				})
			)
			expect(mockRedis.incr).toHaveBeenCalled()
		})
	})

	describe('getOperationMetrics', () => {
		it('should retrieve operation metrics', async () => {
			const mockKeys = ['audit:observability:operations:1234567890']
			const mockData = {
				operationType: 'CREATE',
				operationName: 'create_audit_event',
				duration: '150',
				success: 'true',
				metadata: '{"eventType":"user_action"}',
				timestamp: '2023-01-01T00:00:00.000Z',
			}

			mockRedis.keys.mockResolvedValueOnce(mockKeys)
			mockRedis.hgetall.mockResolvedValueOnce(mockData)

			const operations = await collector.getOperationMetrics()

			expect(operations).toHaveLength(1)
			expect(operations[0].operationType).toBe('CREATE')
			expect(operations[0].duration).toBe(150)
			expect(operations[0].success).toBe(true)
			expect(operations[0].metadata).toEqual({ eventType: 'user_action' })
		})
	})

	describe('recordComponentHealth', () => {
		it('should record component health metrics', async () => {
			const health = {
				name: 'database',
				status: 'HEALTHY' as const,
				uptime: 3600,
				responseTime: 50,
				errorRate: 0.01,
				throughput: 100,
				lastCheck: '2023-01-01T00:00:00.000Z',
			}

			await collector.recordComponentHealth('database', health)

			expect(mockRedis.hset).toHaveBeenCalledWith(
				'audit:observability:health:database',
				expect.objectContaining({
					name: 'database',
					status: 'HEALTHY',
					uptime: '3600',
					responseTime: '50',
				})
			)
		})
	})

	describe('recordTimeSeriesData', () => {
		it('should record time series data', async () => {
			const data = {
				timestamp: '2023-01-01T00:00:00.000Z',
				eventsProcessed: 100,
				processingLatency: 50,
				errorRate: 0.01,
				queueDepth: 5,
				cpuUsage: 25,
				memoryUsage: 60,
			}

			await collector.recordTimeSeriesData(data)

			expect(mockRedis.zadd).toHaveBeenCalledWith(
				'audit:observability:timeseries',
				expect.any(Number),
				JSON.stringify(data)
			)
			expect(mockRedis.zremrangebyscore).toHaveBeenCalled()
		})
	})

	describe('exportMetrics', () => {
		it('should export metrics in JSON format', async () => {
			// Mock dashboard metrics data
			mockRedis.hgetall.mockResolvedValue({
				eventProcessingTime: '100',
				timestamp: '2023-01-01T00:00:00.000Z',
			})
			mockRedis.keys.mockResolvedValue([])

			const exported = await collector.exportMetrics('json')
			const parsed = JSON.parse(exported)

			expect(parsed).toHaveProperty('totalEvents')
			expect(parsed).toHaveProperty('timestamp')
		})

		it('should export metrics in Prometheus format', async () => {
			// Mock dashboard metrics data
			mockRedis.hgetall.mockResolvedValue({
				eventProcessingTime: '100',
				timestamp: '2023-01-01T00:00:00.000Z',
			})
			mockRedis.keys.mockResolvedValue([])

			const exported = await collector.exportMetrics('prometheus')

			expect(exported).toContain('# HELP audit_events_total')
			expect(exported).toContain('# TYPE audit_events_total counter')
			expect(exported).toContain('audit_events_total')
		})
	})

	describe('cleanup', () => {
		it('should cleanup old metrics', async () => {
			const mockKeys = [
				'audit:observability:performance',
				'audit:observability:system:123',
				'audit:observability:operations:456',
			]
			mockRedis.keys.mockResolvedValue(mockKeys)

			await collector.cleanup()

			expect(mockRedis.keys).toHaveBeenCalledTimes(5) // One for each pattern
			expect(mockRedis.del).toHaveBeenCalledWith(...mockKeys)
		})
	})
})

describe('PerformanceTimer', () => {
	let timer: PerformanceTimer

	beforeEach(() => {
		timer = new PerformanceTimer()
	})

	describe('stop', () => {
		it('should return duration when stopped', async () => {
			// Wait a bit to ensure duration > 0
			await new Promise((resolve) => setTimeout(resolve, 10))

			const duration = timer.stop()

			expect(duration).toBeGreaterThan(0)
		})
	})

	describe('getCurrentDuration', () => {
		it('should return current duration without stopping', async () => {
			await new Promise((resolve) => setTimeout(resolve, 10))

			const duration1 = timer.getCurrentDuration()

			await new Promise((resolve) => setTimeout(resolve, 10))

			const duration2 = timer.getCurrentDuration()

			expect(duration1).toBeGreaterThan(0)
			expect(duration2).toBeGreaterThan(duration1)
		})
	})

	describe('reset', () => {
		it('should reset the timer', async () => {
			await new Promise((resolve) => setTimeout(resolve, 10))

			const duration1 = timer.getCurrentDuration()
			timer.reset()

			const duration2 = timer.getCurrentDuration()

			expect(duration1).toBeGreaterThan(0)
			expect(duration2).toBeLessThan(duration1)
		})
	})
})
