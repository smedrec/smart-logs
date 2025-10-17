/**
 * Integration tests for delivery service observability
 * Requirements 8.1, 8.2, 8.3, 8.4, 8.5: Test observability integration and performance impact
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_DELIVERY_OBSERVABILITY_CONFIG } from '../index.js'
import { DeliveryMetricsCollector } from '../metrics.js'
import { DeliveryPerformanceMonitor } from '../performance.js'
import { DeliveryTracer } from '../tracer.js'

import type { DeliveryObservabilityConfig } from '../types.js'

describe('Delivery Observability Integration', () => {
	let tracer: DeliveryTracer
	let metricsCollector: DeliveryMetricsCollector
	let performanceMonitor: DeliveryPerformanceMonitor
	let config: DeliveryObservabilityConfig

	beforeEach(() => {
		config = {
			...DEFAULT_DELIVERY_OBSERVABILITY_CONFIG,
			tracing: {
				...DEFAULT_DELIVERY_OBSERVABILITY_CONFIG.tracing,
				exporterType: 'console',
			},
			metrics: {
				...DEFAULT_DELIVERY_OBSERVABILITY_CONFIG.metrics,
				exporterType: 'console',
				collectionInterval: 1000,
			},
		}

		tracer = new DeliveryTracer(config.tracing)
		metricsCollector = new DeliveryMetricsCollector(config.metrics)
		performanceMonitor = new DeliveryPerformanceMonitor(config.performance, metricsCollector)
	})

	afterEach(async () => {
		performanceMonitor.stop()
		await metricsCollector.shutdown()
		await tracer.shutdown()
	})

	describe('full observability stack initialization', () => {
		it('should initialize all components successfully', async () => {
			await expect(tracer.initialize()).resolves.not.toThrow()
			await expect(metricsCollector.initialize()).resolves.not.toThrow()
			expect(() => performanceMonitor.start()).not.toThrow()
		})

		it('should handle initialization order correctly', async () => {
			// Initialize in different order
			expect(() => performanceMonitor.start()).not.toThrow()
			await expect(metricsCollector.initialize()).resolves.not.toThrow()
			await expect(tracer.initialize()).resolves.not.toThrow()
		})

		it('should shutdown all components gracefully', async () => {
			await tracer.initialize()
			await metricsCollector.initialize()
			performanceMonitor.start()

			// Shutdown in reverse order
			expect(() => performanceMonitor.stop()).not.toThrow()
			await expect(metricsCollector.shutdown()).resolves.not.toThrow()
			await expect(tracer.shutdown()).resolves.not.toThrow()
		})
	})

	describe('end-to-end delivery operation observability', () => {
		beforeEach(async () => {
			await tracer.initialize()
			await metricsCollector.initialize()
			performanceMonitor.start()
		})

		it('should trace and measure complete delivery workflow', async () => {
			const deliveryId = 'test-delivery-123'
			const organizationId = 'org-456'
			const destinationType = 'webhook'

			// Start delivery span
			const deliverySpan = tracer.startSpan('delivery.create', {
				'delivery.id': deliveryId,
				'delivery.organization_id': organizationId,
				'delivery.type': 'report',
			})

			// Start performance timer
			const timer = performanceMonitor.startTimer(deliveryId)

			await tracer.withSpan(deliverySpan, async () => {
				// Simulate delivery processing steps

				// 1. Validation step
				const validationSpan = tracer.startChildSpan(deliverySpan, 'delivery.validate')
				timer.mark('validation_start')

				await new Promise((resolve) => setTimeout(resolve, 10)) // Simulate validation

				timer.mark('validation_end')
				validationSpan.setDeliveryStatus(true, 'Validation completed')
				validationSpan.end()

				// 2. Queue step
				const queueSpan = tracer.startChildSpan(deliverySpan, 'queue.enqueue')
				timer.mark('queue_start')

				performanceMonitor.recordQueueMetrics(5, 50, 100)

				timer.mark('queue_end')
				queueSpan.setDeliveryStatus(true, 'Queued successfully')
				queueSpan.end()

				// 3. Handler step
				const handlerSpan = tracer.startChildSpan(deliverySpan, 'handler.webhook.deliver', {
					'destination.type': destinationType,
					'http.method': 'POST',
					'http.url': 'https://example.com/webhook',
				})
				timer.mark('handler_start')

				await new Promise((resolve) => setTimeout(resolve, 20)) // Simulate HTTP call

				const responseTime = 250
				performanceMonitor.recordDestinationPerformance(
					'dest-123',
					destinationType,
					responseTime,
					true
				)

				timer.mark('handler_end')
				handlerSpan.setDeliveryAttributes({
					'http.status_code': 200,
					'performance.response_time': responseTime,
				})
				handlerSpan.setDeliveryStatus(true, 'Delivered successfully')
				handlerSpan.end()

				// Record overall metrics
				const totalDuration = timer.stop()
				metricsCollector.recordDeliveryAttempt(organizationId, destinationType, true, totalDuration)
				performanceMonitor.recordOperationTime('delivery.complete', totalDuration, {
					deliveryId,
					destinationType,
				})

				// Record payload metrics
				const payloadSize = 1024 * 10 // 10KB
				const processingTime = timer.getDurationBetween('validation_start', 'validation_end')
				performanceMonitor.recordPayloadMetrics(payloadSize, processingTime)
				metricsCollector.recordDeliveryPayloadSize(payloadSize)
			})

			// Verify observability data was recorded
			const queueMetrics = performanceMonitor.getQueuePerformanceMetrics()
			expect(queueMetrics.depth).toBe(5)

			const destinationMetrics = performanceMonitor.getDestinationPerformanceMetrics('dest-123')
			expect(destinationMetrics.successRate).toBe(100)
			expect(destinationMetrics.avgResponseTime).toBe(250)

			const metricsSnapshot = await metricsCollector.getMetricsSnapshot()
			expect(metricsSnapshot.deliveries_total).toBeGreaterThan(0)
			expect(metricsSnapshot.deliveries_successful).toBeGreaterThan(0)
		})

		it('should handle delivery failure with complete observability', async () => {
			const deliveryId = 'failed-delivery-456'
			const organizationId = 'org-789'
			const destinationType = 'webhook'
			const errorType = 'timeout'

			const deliverySpan = tracer.startSpan('delivery.create', {
				'delivery.id': deliveryId,
				'delivery.organization_id': organizationId,
			})

			const timer = performanceMonitor.startTimer(deliveryId)

			try {
				await tracer.withSpan(deliverySpan, async () => {
					// Simulate failure in handler
					const handlerSpan = tracer.startChildSpan(deliverySpan, 'handler.webhook.deliver')

					// Record failure metrics
					const responseTime = 5000 // Slow response
					performanceMonitor.recordDestinationPerformance(
						'dest-456',
						destinationType,
						responseTime,
						false
					)
					metricsCollector.recordDestinationFailure('dest-456', destinationType, errorType)

					handlerSpan.setDeliveryAttributes({
						'error.type': errorType,
						'error.message': 'Request timeout after 5000ms',
						'performance.response_time': responseTime,
					})
					handlerSpan.setDeliveryStatus(false, 'Delivery failed due to timeout')
					handlerSpan.end()

					// Simulate retry attempt
					performanceMonitor.recordRetryMetrics('dest-456', 1, 2000, false)
					metricsCollector.recordRetryAttempt('dest-456', 1, false)

					// Record circuit breaker trip
					performanceMonitor.recordCircuitBreakerMetrics('dest-456', 'open', 1, 30000)
					metricsCollector.recordCircuitBreakerTrip('dest-456', 'failure_threshold_exceeded')

					throw new Error('Delivery failed')
				})
			} catch (error) {
				// Expected failure
			}

			const totalDuration = timer.stop()
			metricsCollector.recordDeliveryAttempt(organizationId, destinationType, false, totalDuration)

			// Verify failure metrics
			const destinationMetrics = performanceMonitor.getDestinationPerformanceMetrics('dest-456')
			expect(destinationMetrics.successRate).toBe(0)

			const retryMetrics = performanceMonitor.getRetryPerformanceMetrics()
			expect(retryMetrics['dest-456']).toBeDefined()
			expect(retryMetrics['dest-456'].successRate).toBe(0)

			const circuitBreakerMetrics = performanceMonitor.getCircuitBreakerMetrics()
			expect(circuitBreakerMetrics['dest-456'].state).toBe('open')
		})
	})

	describe('performance impact assessment', () => {
		beforeEach(async () => {
			await tracer.initialize()
			await metricsCollector.initialize()
			performanceMonitor.start()
		})

		it('should have minimal performance impact on delivery operations', async () => {
			const iterations = 100
			const deliveryTimes: number[] = []

			for (let i = 0; i < iterations; i++) {
				const startTime = performance.now()

				const span = tracer.startSpan('delivery.create', {
					'delivery.id': `perf-test-${i}`,
					'delivery.organization_id': 'perf-org',
				})

				const timer = performanceMonitor.startTimer(`perf-test-${i}`)

				await tracer.withSpan(span, async () => {
					// Simulate minimal delivery work
					await new Promise((resolve) => setTimeout(resolve, 1))

					// Record metrics
					metricsCollector.recordDeliveryAttempt('perf-org', 'webhook', true, 1)
					performanceMonitor.recordDestinationPerformance('perf-dest', 'webhook', 100, true)

					timer.stop()
				})

				const endTime = performance.now()
				deliveryTimes.push(endTime - startTime)
			}

			// Calculate performance statistics
			const avgTime = deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length
			const maxTime = Math.max(...deliveryTimes)

			// Observability overhead should be minimal
			expect(avgTime).toBeLessThan(10) // Less than 10ms average overhead
			expect(maxTime).toBeLessThan(50) // Less than 50ms max overhead

			console.log(
				`Observability performance impact: avg=${avgTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`
			)
		})

		it('should handle high-volume metrics collection efficiently', async () => {
			const startTime = performance.now()
			const iterations = 1000

			// Generate high volume of metrics
			for (let i = 0; i < iterations; i++) {
				metricsCollector.recordDeliveryAttempt(
					`org-${i % 10}`,
					'webhook',
					i % 2 === 0,
					Math.random() * 1000
				)
				performanceMonitor.recordDestinationPerformance(
					`dest-${i % 5}`,
					'webhook',
					Math.random() * 500,
					i % 3 !== 0
				)
				performanceMonitor.recordQueueMetrics(
					Math.floor(Math.random() * 100),
					Math.random() * 200,
					Math.random() * 300
				)
			}

			const endTime = performance.now()
			const totalTime = endTime - startTime

			// Should handle high volume efficiently
			expect(totalTime).toBeLessThan(1000) // Less than 1 second for 1000 operations

			console.log(
				`High-volume metrics collection: ${iterations} operations in ${totalTime.toFixed(2)}ms`
			)
		})
	})

	describe('observability data consistency', () => {
		beforeEach(async () => {
			await tracer.initialize()
			await metricsCollector.initialize()
			performanceMonitor.start()
		})

		it('should maintain consistent data across all observability components', async () => {
			const deliveryId = 'consistency-test-123'
			const organizationId = 'consistency-org'
			const destinationId = 'consistency-dest'
			const destinationType = 'webhook'

			// Record the same delivery across all components
			const span = tracer.startSpan('delivery.create', {
				'delivery.id': deliveryId,
				'delivery.organization_id': organizationId,
				'destination.id': destinationId,
				'destination.type': destinationType,
			})

			const timer = performanceMonitor.startTimer(deliveryId)
			const responseTime = 300
			const success = true

			await tracer.withSpan(span, async () => {
				// Record in metrics collector
				metricsCollector.recordDeliveryAttempt(
					organizationId,
					destinationType,
					success,
					responseTime
				)

				// Record in performance monitor
				performanceMonitor.recordDestinationPerformance(
					destinationId,
					destinationType,
					responseTime,
					success
				)

				const duration = timer.stop()
				performanceMonitor.recordOperationTime('delivery.create', duration)
			})

			// Verify consistency across components
			const metricsSnapshot = await metricsCollector.getMetricsSnapshot()
			const destinationMetrics = performanceMonitor.getDestinationPerformanceMetrics(destinationId)
			const performanceSnapshot = await performanceMonitor.getPerformanceSnapshot()

			// Check that all components recorded the delivery
			expect(metricsSnapshot.deliveries_total).toBeGreaterThan(0)
			expect(metricsSnapshot.deliveries_successful).toBeGreaterThan(0)
			expect(destinationMetrics.successRate).toBe(100)
			expect(destinationMetrics.avgResponseTime).toBe(responseTime)
			expect(performanceSnapshot.destinationSuccessRates[destinationId]).toBe(100)
		})

		it('should handle concurrent operations correctly', async () => {
			const concurrentOperations = 50
			const promises: Promise<void>[] = []

			for (let i = 0; i < concurrentOperations; i++) {
				const promise = (async () => {
					const deliveryId = `concurrent-${i}`
					const span = tracer.startSpan('delivery.create', {
						'delivery.id': deliveryId,
					})

					await tracer.withSpan(span, async () => {
						const success = i % 2 === 0
						const responseTime = Math.random() * 1000

						metricsCollector.recordDeliveryAttempt(
							'concurrent-org',
							'webhook',
							success,
							responseTime
						)
						performanceMonitor.recordDestinationPerformance(
							`dest-${i % 5}`,
							'webhook',
							responseTime,
							success
						)
					})
				})()

				promises.push(promise)
			}

			// Wait for all concurrent operations to complete
			await Promise.all(promises)

			// Verify that all operations were recorded
			const metricsSnapshot = await metricsCollector.getMetricsSnapshot()
			expect(metricsSnapshot.deliveries_total).toBe(concurrentOperations)

			const performanceSnapshot = await performanceMonitor.getPerformanceSnapshot()
			expect(Object.keys(performanceSnapshot.destinationResponseTimes)).toHaveLength(5) // 5 different destinations
		})
	})

	describe('error handling and resilience', () => {
		beforeEach(async () => {
			await tracer.initialize()
			await metricsCollector.initialize()
			performanceMonitor.start()
		})

		it('should continue operating when one component fails', async () => {
			// Simulate metrics collector failure
			const originalRecordDeliveryAttempt = metricsCollector.recordDeliveryAttempt
			metricsCollector.recordDeliveryAttempt = vi.fn().mockImplementation(() => {
				throw new Error('Metrics collector error')
			})

			const span = tracer.startSpan('delivery.create')
			const timer = performanceMonitor.startTimer('resilience-test')

			// Should not throw even if metrics collector fails
			await expect(
				tracer.withSpan(span, async () => {
					// This should fail silently
					try {
						metricsCollector.recordDeliveryAttempt('org', 'webhook', true, 100)
					} catch (error) {
						// Expected to fail
					}

					// These should still work
					performanceMonitor.recordDestinationPerformance('dest', 'webhook', 100, true)
					timer.stop()
				})
			).resolves.not.toThrow()

			// Restore original method
			metricsCollector.recordDeliveryAttempt = originalRecordDeliveryAttempt
		})

		it('should handle invalid data gracefully', async () => {
			// Test with invalid/edge case data
			const invalidData = [
				{ org: '', type: '', success: true, duration: -1 },
				{ org: null as any, type: undefined as any, success: false, duration: Infinity },
				{ org: 'valid', type: 'valid', success: true, duration: NaN },
			]

			for (const data of invalidData) {
				expect(() => {
					metricsCollector.recordDeliveryAttempt(data.org, data.type, data.success, data.duration)
					performanceMonitor.recordDestinationPerformance(
						'dest',
						data.type,
						data.duration,
						data.success
					)
				}).not.toThrow()
			}
		})
	})

	describe('configuration validation', () => {
		it('should validate observability configuration', () => {
			const validConfigs = [
				DEFAULT_DELIVERY_OBSERVABILITY_CONFIG,
				{
					...DEFAULT_DELIVERY_OBSERVABILITY_CONFIG,
					tracing: { ...DEFAULT_DELIVERY_OBSERVABILITY_CONFIG.tracing, enabled: false },
				},
				{
					...DEFAULT_DELIVERY_OBSERVABILITY_CONFIG,
					metrics: { ...DEFAULT_DELIVERY_OBSERVABILITY_CONFIG.metrics, enabled: false },
				},
			]

			for (const config of validConfigs) {
				expect(() => {
					new DeliveryTracer(config.tracing)
					new DeliveryMetricsCollector(config.metrics)
					new DeliveryPerformanceMonitor(config.performance)
				}).not.toThrow()
			}
		})

		it('should handle missing configuration gracefully', () => {
			const minimalConfig = {
				enabled: true,
				serviceName: 'test',
				sampleRate: 1.0,
				exporterType: 'console' as const,
			}

			expect(() => {
				new DeliveryTracer(minimalConfig)
			}).not.toThrow()
		})
	})
})
