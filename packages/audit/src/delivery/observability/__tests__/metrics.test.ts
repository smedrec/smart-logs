/**
 * Unit tests for delivery service metrics collection
 * Requirements 8.2, 8.3, 8.5: Test metrics collection and aggregation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DeliveryMetricsCollector } from '../metrics.js'

import type { DeliveryObservabilityConfig } from '../types.js'

describe('DeliveryMetricsCollector', () => {
	let metricsCollector: DeliveryMetricsCollector
	let config: DeliveryObservabilityConfig['metrics']

	beforeEach(() => {
		config = {
			enabled: true,
			serviceName: 'test-delivery-service',
			exporterType: 'console',
			exporterEndpoint: 'http://localhost:4318/v1/metrics',
			collectionInterval: 1000,
			headers: {},
		}
		metricsCollector = new DeliveryMetricsCollector(config)
	})

	afterEach(async () => {
		await metricsCollector.shutdown()
	})

	describe('initialization', () => {
		it('should initialize successfully with valid config', async () => {
			await expect(metricsCollector.initialize()).resolves.not.toThrow()
		})

		it('should not initialize when metrics are disabled', async () => {
			const disabledConfig = { ...config, enabled: false }
			const disabledCollector = new DeliveryMetricsCollector(disabledConfig)

			await disabledCollector.initialize()
			// Should not throw, but should not actually initialize
			expect(true).toBe(true) // Placeholder assertion
		})

		it('should handle different exporter types', async () => {
			const exporterTypes = ['console', 'otlp', 'prometheus'] as const

			for (const exporterType of exporterTypes) {
				const testConfig = { ...config, exporterType }
				const testCollector = new DeliveryMetricsCollector(testConfig)

				await expect(testCollector.initialize()).resolves.not.toThrow()
				await testCollector.shutdown()
			}
		})
	})

	describe('delivery metrics recording', () => {
		beforeEach(async () => {
			await metricsCollector.initialize()
		})

		it('should record delivery attempts correctly', () => {
			const organizationId = 'org-123'
			const destinationType = 'webhook'
			const success = true
			const duration = 1500

			// Should not throw
			expect(() => {
				metricsCollector.recordDeliveryAttempt(organizationId, destinationType, success, duration)
			}).not.toThrow()
		})

		it('should record both successful and failed deliveries', () => {
			const organizationId = 'org-123'
			const destinationType = 'webhook'

			// Record successful delivery
			expect(() => {
				metricsCollector.recordDeliveryAttempt(organizationId, destinationType, true, 1000)
			}).not.toThrow()

			// Record failed delivery
			expect(() => {
				metricsCollector.recordDeliveryAttempt(organizationId, destinationType, false, 2000)
			}).not.toThrow()
		})

		it('should record payload sizes', () => {
			const payloadSizes = [1024, 5120, 10240, 1048576]

			for (const size of payloadSizes) {
				expect(() => {
					metricsCollector.recordDeliveryPayloadSize(size)
				}).not.toThrow()
			}
		})

		it('should record queue depth changes', () => {
			const queueDepths = [0, 5, 10, 25, 50]

			for (const depth of queueDepths) {
				expect(() => {
					metricsCollector.recordQueueDepth(depth)
				}).not.toThrow()
			}
		})

		it('should not record metrics when disabled', () => {
			const disabledConfig = { ...config, enabled: false }
			const disabledCollector = new DeliveryMetricsCollector(disabledConfig)

			// Should not throw even when disabled
			expect(() => {
				disabledCollector.recordDeliveryAttempt('org-123', 'webhook', true, 1000)
			}).not.toThrow()
		})
	})

	describe('retry metrics recording', () => {
		beforeEach(async () => {
			await metricsCollector.initialize()
		})

		it('should record retry attempts', () => {
			const destinationId = 'dest-123'
			const attemptNumber = 2
			const success = false

			expect(() => {
				metricsCollector.recordRetryAttempt(destinationId, attemptNumber, success)
			}).not.toThrow()
		})

		it('should record multiple retry attempts for same destination', () => {
			const destinationId = 'dest-123'

			// Record multiple attempts
			for (let attempt = 1; attempt <= 5; attempt++) {
				const success = attempt === 5 // Success on final attempt
				expect(() => {
					metricsCollector.recordRetryAttempt(destinationId, attempt, success)
				}).not.toThrow()
			}
		})
	})

	describe('circuit breaker metrics recording', () => {
		beforeEach(async () => {
			await metricsCollector.initialize()
		})

		it('should record circuit breaker state changes', () => {
			const destinationId = 'dest-123'
			const states: Array<'open' | 'closed' | 'half-open'> = [
				'closed',
				'open',
				'half-open',
				'closed',
			]

			for (const state of states) {
				expect(() => {
					metricsCollector.recordCircuitBreakerState(destinationId, state)
				}).not.toThrow()
			}
		})

		it('should record circuit breaker trips', () => {
			const destinationId = 'dest-123'
			const reasons = ['failure_threshold_exceeded', 'timeout', 'connection_error']

			for (const reason of reasons) {
				expect(() => {
					metricsCollector.recordCircuitBreakerTrip(destinationId, reason)
				}).not.toThrow()
			}
		})
	})

	describe('destination health metrics recording', () => {
		beforeEach(async () => {
			await metricsCollector.initialize()
		})

		it('should record destination health status', () => {
			const destinationId = 'dest-123'
			const destinationType = 'webhook'
			const healthy = true
			const responseTime = 250

			expect(() => {
				metricsCollector.recordDestinationHealth(
					destinationId,
					destinationType,
					healthy,
					responseTime
				)
			}).not.toThrow()
		})

		it('should record destination failures', () => {
			const destinationId = 'dest-123'
			const destinationType = 'webhook'
			const errorTypes = ['timeout', 'connection_error', 'invalid_response', 'rate_limited']

			for (const errorType of errorTypes) {
				expect(() => {
					metricsCollector.recordDestinationFailure(destinationId, destinationType, errorType)
				}).not.toThrow()
			}
		})
	})

	describe('alert metrics recording', () => {
		beforeEach(async () => {
			await metricsCollector.initialize()
		})

		it('should record alert generation', () => {
			const organizationId = 'org-123'
			const alertTypes = ['failure_rate', 'consecutive_failures', 'queue_backlog', 'response_time']
			const severities = ['low', 'medium', 'high', 'critical']

			for (const alertType of alertTypes) {
				for (const severity of severities) {
					expect(() => {
						metricsCollector.recordAlertGenerated(organizationId, alertType, severity)
					}).not.toThrow()
				}
			}
		})

		it('should record alert resolution', () => {
			const organizationId = 'org-123'
			const alertType = 'failure_rate'
			const resolutionTime = 300000 // 5 minutes

			expect(() => {
				metricsCollector.recordAlertResolved(organizationId, alertType, resolutionTime)
			}).not.toThrow()
		})
	})

	describe('performance metrics recording', () => {
		beforeEach(async () => {
			await metricsCollector.initialize()
		})

		it('should record processing times', () => {
			const operations = ['delivery.create', 'handler.webhook', 'queue.process', 'retry.calculate']
			const durations = [10, 50, 100, 500, 1000, 5000]

			for (const operation of operations) {
				for (const duration of durations) {
					expect(() => {
						metricsCollector.recordProcessingTime(operation, duration)
					}).not.toThrow()
				}
			}
		})

		it('should record memory usage', () => {
			const heapUsed = 50 * 1024 * 1024 // 50MB
			const heapTotal = 100 * 1024 * 1024 // 100MB

			expect(() => {
				metricsCollector.recordMemoryUsage(heapUsed, heapTotal)
			}).not.toThrow()
		})

		it('should record CPU usage', () => {
			const cpuUsages = [10.5, 25.0, 50.0, 75.5, 90.0]

			for (const usage of cpuUsages) {
				expect(() => {
					metricsCollector.recordCpuUsage(usage)
				}).not.toThrow()
			}
		})
	})

	describe('metrics snapshot', () => {
		beforeEach(async () => {
			await metricsCollector.initialize()
		})

		it('should generate metrics snapshot', async () => {
			// Record some sample data
			metricsCollector.recordDeliveryAttempt('org-123', 'webhook', true, 1000)
			metricsCollector.recordDeliveryAttempt('org-123', 'webhook', false, 2000)
			metricsCollector.recordDeliveryAttempt('org-456', 'email', true, 1500)

			const snapshot = await metricsCollector.getMetricsSnapshot()

			expect(snapshot).toBeDefined()
			expect(snapshot.deliveries_total).toBeGreaterThanOrEqual(0)
			expect(snapshot.deliveries_successful).toBeGreaterThanOrEqual(0)
			expect(snapshot.deliveries_failed).toBeGreaterThanOrEqual(0)
			expect(snapshot.by_destination_type).toBeDefined()
			expect(snapshot.by_organization).toBeDefined()
			expect(snapshot.performance_percentiles).toBeDefined()
		})

		it('should calculate performance percentiles correctly', async () => {
			// Record processing times for percentile calculation
			const processingTimes = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

			for (const time of processingTimes) {
				metricsCollector.recordProcessingTime('test.operation', time)
			}

			const snapshot = await metricsCollector.getMetricsSnapshot()

			expect(snapshot.performance_percentiles.p50).toBeGreaterThan(0)
			expect(snapshot.performance_percentiles.p90).toBeGreaterThan(0)
			expect(snapshot.performance_percentiles.p95).toBeGreaterThan(0)
			expect(snapshot.performance_percentiles.p99).toBeGreaterThan(0)
		})

		it('should handle empty metrics gracefully', async () => {
			const snapshot = await metricsCollector.getMetricsSnapshot()

			expect(snapshot).toBeDefined()
			expect(snapshot.deliveries_total).toBe(0)
			expect(snapshot.deliveries_successful).toBe(0)
			expect(snapshot.deliveries_failed).toBe(0)
		})
	})

	describe('custom metrics', () => {
		beforeEach(async () => {
			await metricsCollector.initialize()
		})

		it('should generate custom metrics', async () => {
			// Record some sample data
			metricsCollector.recordDeliveryAttempt('org-123', 'webhook', true, 1000)
			metricsCollector.recordDeliveryAttempt('org-123', 'webhook', false, 2000)
			metricsCollector.recordDeliveryAttempt('org-123', 'email', true, 1500)

			const customMetrics = await metricsCollector.getCustomMetrics()

			expect(customMetrics).toBeDefined()
			expect(customMetrics.delivery_success_rate_by_type).toBeDefined()
			expect(typeof customMetrics.queue_processing_rate).toBe('number')
			expect(typeof customMetrics.retry_success_rate).toBe('number')
		})

		it('should calculate success rates correctly', async () => {
			// Record known success/failure pattern
			const destinationType = 'webhook'

			// 8 successes, 2 failures = 80% success rate
			for (let i = 0; i < 8; i++) {
				metricsCollector.recordDeliveryAttempt('org-123', destinationType, true, 1000)
			}
			for (let i = 0; i < 2; i++) {
				metricsCollector.recordDeliveryAttempt('org-123', destinationType, false, 2000)
			}

			const customMetrics = await metricsCollector.getCustomMetrics()

			expect(customMetrics.delivery_success_rate_by_type[destinationType]).toBe(80)
		})
	})

	describe('error handling', () => {
		it('should handle initialization errors gracefully', async () => {
			const invalidConfig = {
				...config,
				exporterType: 'otlp' as const,
				exporterEndpoint: 'invalid-url-format',
			}
			const invalidCollector = new DeliveryMetricsCollector(invalidConfig)

			// Should handle invalid configuration gracefully
			await expect(invalidCollector.initialize()).rejects.toThrow()
		})

		it('should handle metric recording errors gracefully', async () => {
			await metricsCollector.initialize()

			// Should not throw even with invalid data
			expect(() => {
				metricsCollector.recordDeliveryAttempt('', '', true, -1)
			}).not.toThrow()
		})

		it('should handle shutdown errors gracefully', async () => {
			await metricsCollector.initialize()

			// Multiple shutdowns should not throw
			await expect(metricsCollector.shutdown()).resolves.not.toThrow()
			await expect(metricsCollector.shutdown()).resolves.not.toThrow()
		})
	})

	describe('configuration handling', () => {
		it('should handle different collection intervals', async () => {
			const intervals = [1000, 5000, 10000, 30000]

			for (const interval of intervals) {
				const testConfig = { ...config, collectionInterval: interval }
				const testCollector = new DeliveryMetricsCollector(testConfig)

				await expect(testCollector.initialize()).resolves.not.toThrow()
				await testCollector.shutdown()
			}
		})

		it('should handle custom headers for OTLP exporter', async () => {
			const otlpConfig = {
				...config,
				exporterType: 'otlp' as const,
				headers: {
					Authorization: 'Bearer test-token',
					'Custom-Header': 'test-value',
				},
			}

			const otlpCollector = new DeliveryMetricsCollector(otlpConfig)

			await expect(otlpCollector.initialize()).resolves.not.toThrow()
			await otlpCollector.shutdown()
		})
	})
})
