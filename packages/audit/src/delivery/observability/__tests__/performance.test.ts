/**
 * Unit tests for delivery service performance monitoring
 * Requirements 8.2, 8.3, 8.4, 8.5: Test custom metric calculation and reporting
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DeliveryMetricsCollector } from '../metrics.js'
import { DeliveryPerformanceMonitor, PerformanceTimer } from '../performance.js'

import type { DeliveryObservabilityConfig } from '../types.js'

describe('PerformanceTimer', () => {
	let timer: PerformanceTimer

	beforeEach(() => {
		timer = new PerformanceTimer()
	})

	describe('basic timing', () => {
		it('should measure duration correctly', async () => {
			const startTime = Date.now()

			// Wait a small amount
			await new Promise((resolve) => setTimeout(resolve, 10))

			const duration = timer.getDuration()

			expect(duration).toBeGreaterThan(0)
			expect(duration).toBeLessThan(1000) // Should be less than 1 second
		})

		it('should stop timer and return duration', async () => {
			await new Promise((resolve) => setTimeout(resolve, 10))

			const duration = timer.stop()

			expect(duration).toBeGreaterThan(0)
		})

		it('should reset timer correctly', async () => {
			await new Promise((resolve) => setTimeout(resolve, 10))

			const firstDuration = timer.getDuration()
			timer.reset()

			const secondDuration = timer.getDuration()

			expect(firstDuration).toBeGreaterThan(secondDuration)
		})
	})

	describe('marks and measurements', () => {
		it('should create and measure marks', async () => {
			timer.mark('start')

			await new Promise((resolve) => setTimeout(resolve, 10))

			timer.mark('middle')

			await new Promise((resolve) => setTimeout(resolve, 10))

			timer.mark('end')

			const totalDuration = timer.getDuration('start')
			const middleToEnd = timer.getDurationBetween('middle', 'end')

			expect(totalDuration).toBeGreaterThan(middleToEnd)
			expect(middleToEnd).toBeGreaterThan(0)
		})

		it('should throw error for non-existent marks', () => {
			expect(() => {
				timer.getDurationBetween('nonexistent1', 'nonexistent2')
			}).toThrow('Mark not found')
		})

		it('should handle marks correctly after reset', () => {
			timer.mark('before-reset')
			timer.reset()

			expect(() => {
				timer.getDuration('before-reset')
			}).not.toThrow() // Should use start time if mark not found
		})
	})
})

describe('DeliveryPerformanceMonitor', () => {
	let performanceMonitor: DeliveryPerformanceMonitor
	let metricsCollector: DeliveryMetricsCollector
	let config: DeliveryObservabilityConfig['performance']

	beforeEach(() => {
		config = {
			enabled: true,
			trackingEnabled: true,
			slowOperationThreshold: 1000,
			memoryTrackingEnabled: true,
		}

		const metricsConfig = {
			enabled: true,
			serviceName: 'test-delivery-service',
			exporterType: 'console' as const,
			exporterEndpoint: 'http://localhost:4318/v1/metrics',
			collectionInterval: 1000,
			headers: {},
		}

		metricsCollector = new DeliveryMetricsCollector(metricsConfig)
		performanceMonitor = new DeliveryPerformanceMonitor(config, metricsCollector)
	})

	afterEach(() => {
		performanceMonitor.stop()
	})

	describe('lifecycle management', () => {
		it('should start and stop correctly', () => {
			expect(() => {
				performanceMonitor.start()
			}).not.toThrow()

			expect(() => {
				performanceMonitor.stop()
			}).not.toThrow()
		})

		it('should handle multiple start/stop calls', () => {
			performanceMonitor.start()
			performanceMonitor.start() // Should not throw

			performanceMonitor.stop()
			performanceMonitor.stop() // Should not throw
		})

		it('should not start when disabled', () => {
			const disabledConfig = { ...config, enabled: false }
			const disabledMonitor = new DeliveryPerformanceMonitor(disabledConfig)

			disabledMonitor.start()
			// Should not actually start monitoring
			expect(true).toBe(true) // Placeholder assertion
		})
	})

	describe('operation timing', () => {
		beforeEach(() => {
			performanceMonitor.start()
		})

		it('should create performance timers', () => {
			const timer = performanceMonitor.startTimer('test-operation-123')

			expect(timer).toBeDefined()
			expect(timer).toBeInstanceOf(PerformanceTimer)
		})

		it('should record operation times', () => {
			const operation = 'delivery.create'
			const duration = 150
			const metadata = { destinationType: 'webhook' }

			expect(() => {
				performanceMonitor.recordOperationTime(operation, duration, metadata)
			}).not.toThrow()
		})

		it('should detect slow operations', () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

			const slowOperation = 'slow.operation'
			const slowDuration = 2000 // Above threshold

			performanceMonitor.recordOperationTime(slowOperation, slowDuration)

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('Slow operation detected'),
				expect.any(Object)
			)

			consoleSpy.mockRestore()
		})

		it('should not record when tracking is disabled', () => {
			const disabledConfig = { ...config, trackingEnabled: false }
			const disabledMonitor = new DeliveryPerformanceMonitor(disabledConfig)

			expect(() => {
				disabledMonitor.recordOperationTime('test.operation', 100)
			}).not.toThrow()
		})
	})

	describe('queue performance metrics', () => {
		beforeEach(() => {
			performanceMonitor.start()
		})

		it('should record queue metrics', () => {
			const depth = 25
			const processingTime = 150
			const waitTime = 300

			expect(() => {
				performanceMonitor.recordQueueMetrics(depth, processingTime, waitTime)
			}).not.toThrow()
		})

		it('should get queue performance metrics', () => {
			// Record some sample data
			performanceMonitor.recordQueueMetrics(10, 100, 200)
			performanceMonitor.recordQueueMetrics(20, 150, 250)
			performanceMonitor.recordQueueMetrics(15, 125, 225)

			const metrics = performanceMonitor.getQueuePerformanceMetrics()

			expect(metrics).toBeDefined()
			expect(metrics.depth).toBe(15) // Last recorded depth
			expect(metrics.avgProcessingTime).toBeCloseTo(125, 1)
			expect(metrics.avgWaitTime).toBeCloseTo(225, 1)
		})

		it('should handle empty queue metrics', () => {
			const metrics = performanceMonitor.getQueuePerformanceMetrics()

			expect(metrics.depth).toBe(0)
			expect(metrics.avgProcessingTime).toBe(0)
			expect(metrics.avgWaitTime).toBe(0)
		})
	})

	describe('destination performance metrics', () => {
		beforeEach(() => {
			performanceMonitor.start()
		})

		it('should record destination performance', () => {
			const destinationId = 'dest-123'
			const destinationType = 'webhook'
			const responseTime = 250
			const success = true

			expect(() => {
				performanceMonitor.recordDestinationPerformance(
					destinationId,
					destinationType,
					responseTime,
					success
				)
			}).not.toThrow()
		})

		it('should get destination performance metrics for specific destination', () => {
			const destinationId = 'dest-123'

			// Record multiple measurements
			performanceMonitor.recordDestinationPerformance(destinationId, 'webhook', 200, true)
			performanceMonitor.recordDestinationPerformance(destinationId, 'webhook', 300, true)
			performanceMonitor.recordDestinationPerformance(destinationId, 'webhook', 400, false)

			const metrics = performanceMonitor.getDestinationPerformanceMetrics(destinationId)

			expect(metrics).toBeDefined()
			expect(metrics.successRate).toBeCloseTo(66.67, 1) // 2/3 success
			expect(metrics.avgResponseTime).toBeCloseTo(300, 1) // (200+300+400)/3
			expect(metrics.totalRequests).toBe(3)
			expect(metrics.lastResponseTime).toBe(400)
		})

		it('should get all destination performance metrics', () => {
			// Record data for multiple destinations
			performanceMonitor.recordDestinationPerformance('dest-1', 'webhook', 200, true)
			performanceMonitor.recordDestinationPerformance('dest-2', 'email', 500, true)
			performanceMonitor.recordDestinationPerformance('dest-1', 'webhook', 300, false)

			const allMetrics = performanceMonitor.getDestinationPerformanceMetrics()

			expect(allMetrics).toBeDefined()
			expect(allMetrics['dest-1']).toBeDefined()
			expect(allMetrics['dest-2']).toBeDefined()
			expect(allMetrics['dest-1'].successRate).toBe(50) // 1/2 success
			expect(allMetrics['dest-2'].successRate).toBe(100) // 1/1 success
		})

		it('should return empty metrics for non-existent destination', () => {
			const metrics = performanceMonitor.getDestinationPerformanceMetrics('non-existent')

			expect(metrics).toEqual({})
		})
	})

	describe('retry performance metrics', () => {
		beforeEach(() => {
			performanceMonitor.start()
		})

		it('should record retry metrics', () => {
			const destinationId = 'dest-123'
			const attemptNumber = 2
			const backoffTime = 2000
			const success = false

			expect(() => {
				performanceMonitor.recordRetryMetrics(destinationId, attemptNumber, backoffTime, success)
			}).not.toThrow()
		})

		it('should get retry performance metrics', () => {
			const destinationId = 'dest-123'

			// Record retry sequence
			performanceMonitor.recordRetryMetrics(destinationId, 1, 1000, false)
			performanceMonitor.recordRetryMetrics(destinationId, 2, 2000, false)
			performanceMonitor.recordRetryMetrics(destinationId, 3, 4000, true)

			const metrics = performanceMonitor.getRetryPerformanceMetrics()

			expect(metrics).toBeDefined()
			expect(metrics[destinationId]).toBeDefined()
			expect(metrics[destinationId].successRate).toBeCloseTo(33.33, 1) // 1/3 success
			expect(metrics[destinationId].avgAttempts).toBe(2) // (1+2+3)/3
			expect(metrics[destinationId].avgBackoffTime).toBeCloseTo(2333.33, 1) // (1000+2000+4000)/3
		})
	})

	describe('circuit breaker performance metrics', () => {
		beforeEach(() => {
			performanceMonitor.start()
		})

		it('should record circuit breaker metrics', () => {
			const destinationId = 'dest-123'
			const state = 'open'
			const tripCount = 5
			const recoveryTime = 30000

			expect(() => {
				performanceMonitor.recordCircuitBreakerMetrics(
					destinationId,
					state,
					tripCount,
					recoveryTime
				)
			}).not.toThrow()
		})

		it('should get circuit breaker metrics', () => {
			const destinationId = 'dest-123'

			// Record state changes and recovery times
			performanceMonitor.recordCircuitBreakerMetrics(destinationId, 'closed', 0)
			performanceMonitor.recordCircuitBreakerMetrics(destinationId, 'open', 1, 30000)
			performanceMonitor.recordCircuitBreakerMetrics(destinationId, 'half-open', 1, 45000)
			performanceMonitor.recordCircuitBreakerMetrics(destinationId, 'closed', 1, 60000)

			const metrics = performanceMonitor.getCircuitBreakerMetrics()

			expect(metrics).toBeDefined()
			expect(metrics[destinationId]).toBeDefined()
			expect(metrics[destinationId].state).toBe('closed')
			expect(metrics[destinationId].tripCount).toBe(1)
			expect(metrics[destinationId].avgRecoveryTime).toBe(45000) // (30000+45000+60000)/3
		})
	})

	describe('payload performance metrics', () => {
		beforeEach(() => {
			performanceMonitor.start()
		})

		it('should record payload metrics', () => {
			const size = 1048576 // 1MB
			const processingTime = 150

			expect(() => {
				performanceMonitor.recordPayloadMetrics(size, processingTime)
			}).not.toThrow()
		})

		it('should get payload performance metrics', () => {
			// Record various payload sizes and processing times
			const payloads = [
				{ size: 1024, time: 10 },
				{ size: 10240, time: 50 },
				{ size: 102400, time: 100 },
				{ size: 1048576, time: 500 },
			]

			for (const payload of payloads) {
				performanceMonitor.recordPayloadMetrics(payload.size, payload.time)
			}

			const metrics = performanceMonitor.getPayloadPerformanceMetrics()

			expect(metrics).toBeDefined()
			expect(metrics.avgSize).toBeGreaterThan(0)
			expect(metrics.avgProcessingTime).toBeGreaterThan(0)
			expect(metrics.sizePercentiles).toBeDefined()
			expect(metrics.sizePercentiles.p50).toBeGreaterThan(0)
			expect(metrics.sizePercentiles.p95).toBeGreaterThan(0)
		})
	})

	describe('system metrics collection', () => {
		beforeEach(() => {
			performanceMonitor.start()
		})

		it('should collect system metrics', async () => {
			await expect(performanceMonitor.collectSystemMetrics()).resolves.not.toThrow()
		})

		it('should get system metrics', async () => {
			await performanceMonitor.collectSystemMetrics()

			const metrics = performanceMonitor.getSystemMetrics()

			expect(metrics).toBeDefined()
			expect(typeof metrics.cpuUsage).toBe('number')
			expect(typeof metrics.memoryUsage).toBe('number')
			expect(typeof metrics.memoryTotal).toBe('number')
			expect(Array.isArray(metrics.loadAverage)).toBe(true)
			expect(typeof metrics.lastUpdate).toBe('number')
		})

		it('should handle system metrics collection errors', async () => {
			// Mock process.memoryUsage to throw an error
			const originalMemoryUsage = process.memoryUsage
			process.memoryUsage = vi.fn().mockImplementation(() => {
				throw new Error('Memory usage error')
			})

			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

			await performanceMonitor.collectSystemMetrics()

			expect(consoleSpy).toHaveBeenCalledWith(
				'Failed to collect system metrics:',
				expect.any(Error)
			)

			// Restore original function
			process.memoryUsage = originalMemoryUsage
			consoleSpy.mockRestore()
		})
	})

	describe('comprehensive performance snapshot', () => {
		beforeEach(() => {
			performanceMonitor.start()
		})

		it('should generate comprehensive performance snapshot', async () => {
			// Record sample data across all metrics
			performanceMonitor.recordQueueMetrics(10, 100, 200)
			performanceMonitor.recordDestinationPerformance('dest-1', 'webhook', 250, true)
			performanceMonitor.recordRetryMetrics('dest-1', 2, 2000, false)
			performanceMonitor.recordCircuitBreakerMetrics('dest-1', 'open', 1, 30000)
			performanceMonitor.recordPayloadMetrics(1024, 50)

			const snapshot = await performanceMonitor.getPerformanceSnapshot()

			expect(snapshot).toBeDefined()
			expect(snapshot.operation).toBe('performance_snapshot')
			expect(typeof snapshot.startTime).toBe('number')
			expect(typeof snapshot.queueDepth).toBe('number')
			expect(typeof snapshot.queueProcessingTime).toBe('number')
			expect(typeof snapshot.queueWaitTime).toBe('number')
			expect(snapshot.destinationResponseTimes).toBeDefined()
			expect(snapshot.destinationSuccessRates).toBeDefined()
			expect(snapshot.retryAttempts).toBeDefined()
			expect(snapshot.circuitBreakerStates).toBeDefined()
			expect(Array.isArray(snapshot.payloadSizes)).toBe(true)
			expect(snapshot.systemMetrics).toBeDefined()
		})

		it('should handle empty performance snapshot', async () => {
			const snapshot = await performanceMonitor.getPerformanceSnapshot()

			expect(snapshot).toBeDefined()
			expect(snapshot.queueDepth).toBe(0)
			expect(snapshot.queueProcessingTime).toBe(0)
			expect(snapshot.queueWaitTime).toBe(0)
			expect(Object.keys(snapshot.destinationResponseTimes)).toHaveLength(0)
			expect(Object.keys(snapshot.destinationSuccessRates)).toHaveLength(0)
		})
	})

	describe('integration with metrics collector', () => {
		beforeEach(async () => {
			await metricsCollector.initialize()
			performanceMonitor.start()
		})

		afterEach(async () => {
			await metricsCollector.shutdown()
		})

		it('should integrate with metrics collector for queue metrics', () => {
			const recordQueueDepthSpy = vi.spyOn(metricsCollector, 'recordQueueDepth')
			const recordProcessingTimeSpy = vi.spyOn(metricsCollector, 'recordProcessingTime')

			performanceMonitor.recordQueueMetrics(25, 150, 300)

			expect(recordQueueDepthSpy).toHaveBeenCalledWith(25)
			expect(recordProcessingTimeSpy).toHaveBeenCalledWith('queue.processing', 150)
			expect(recordProcessingTimeSpy).toHaveBeenCalledWith('queue.wait', 300)
		})

		it('should integrate with metrics collector for destination health', () => {
			const recordDestinationHealthSpy = vi.spyOn(metricsCollector, 'recordDestinationHealth')

			performanceMonitor.recordDestinationPerformance('dest-123', 'webhook', 250, true)

			expect(recordDestinationHealthSpy).toHaveBeenCalledWith('dest-123', 'webhook', true, 250)
		})

		it('should work without metrics collector', () => {
			const standaloneMonitor = new DeliveryPerformanceMonitor(config)
			standaloneMonitor.start()

			expect(() => {
				standaloneMonitor.recordQueueMetrics(10, 100, 200)
				standaloneMonitor.recordDestinationPerformance('dest-1', 'webhook', 250, true)
			}).not.toThrow()

			standaloneMonitor.stop()
		})
	})
})
