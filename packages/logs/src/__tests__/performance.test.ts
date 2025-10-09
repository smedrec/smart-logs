import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CorrelationManager } from '../core/correlation-manager.js'
import { IdGenerator } from '../utils/id-generator.js'
import { PerformanceMonitor } from '../utils/performance-monitor.js'

/**
 * Performance benchmarks and tests
 * Implements requirement 10.4: Performance testing and validation
 */
describe('Performance Benchmarks', () => {
	let performanceMonitor: PerformanceMonitor
	let idGenerator: IdGenerator
	let correlationManager: CorrelationManager

	beforeEach(() => {
		performanceMonitor = new PerformanceMonitor({ enabled: true, sampleRate: 1.0 })
		idGenerator = new IdGenerator()
		correlationManager = CorrelationManager.getInstance()
	})

	afterEach(() => {
		performanceMonitor?.stop()
	})

	describe('ID Generation Performance', () => {
		it('should generate correlation IDs efficiently', () => {
			const iterations = 10000
			const startTime = performance.now()

			for (let i = 0; i < iterations; i++) {
				idGenerator.generateCorrelationId()
			}

			const endTime = performance.now()
			const duration = endTime - startTime
			const idsPerSecond = (iterations / duration) * 1000

			// Should generate at least 10,000 IDs per second
			expect(idsPerSecond).toBeGreaterThan(10000)
			expect(duration).toBeLessThan(1000) // Should complete in less than 1 second
		})

		it('should generate trace contexts efficiently', () => {
			const iterations = 5000
			const startTime = performance.now()

			for (let i = 0; i < iterations; i++) {
				idGenerator.generateTraceContext()
			}

			const endTime = performance.now()
			const duration = endTime - startTime
			const contextsPerSecond = (iterations / duration) * 1000

			// Should generate at least 5,000 trace contexts per second
			expect(contextsPerSecond).toBeGreaterThan(5000)
			expect(duration).toBeLessThan(1000)
		})

		it('should validate IDs efficiently', () => {
			const iterations = 50000
			const validUuid = '550e8400-e29b-41d4-a716-446655440000'
			const validTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
			const validSpanId = '00f067aa0ba902b7'

			const startTime = performance.now()

			for (let i = 0; i < iterations; i++) {
				idGenerator.isValidUuid(validUuid)
				idGenerator.isValidTraceId(validTraceId)
				idGenerator.isValidSpanId(validSpanId)
			}

			const endTime = performance.now()
			const duration = endTime - startTime
			const validationsPerSecond = ((iterations * 3) / duration) * 1000

			// Should validate at least 100,000 IDs per second
			expect(validationsPerSecond).toBeGreaterThan(100000)
			expect(duration).toBeLessThan(1500)
		})

		it('should parse W3C trace context efficiently', () => {
			const iterations = 10000
			const traceParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'

			const startTime = performance.now()

			for (let i = 0; i < iterations; i++) {
				idGenerator.parseTraceContext(traceParent)
			}

			const endTime = performance.now()
			const duration = endTime - startTime
			const parsesPerSecond = (iterations / duration) * 1000

			// Should parse at least 20,000 trace contexts per second
			expect(parsesPerSecond).toBeGreaterThan(20000)
			expect(duration).toBeLessThan(500)
		})
	})

	describe('Performance Monitor Benchmarks', () => {
		it('should handle high-frequency sampling efficiently', () => {
			const monitor = new PerformanceMonitor({
				enabled: true,
				sampleRate: 1.0, // Sample everything
				maxSamples: 10000,
			})

			const iterations = 5000
			const startTime = performance.now()

			for (let i = 0; i < iterations; i++) {
				const endTiming = monitor.startTiming()
				// Simulate some work
				Math.random()
				endTiming()
			}

			const endTime = performance.now()
			const duration = endTime - startTime
			const operationsPerSecond = (iterations / duration) * 1000

			// Should handle at least 10,000 timing operations per second
			expect(operationsPerSecond).toBeGreaterThan(10000)

			const metrics = monitor.getAggregatedMetrics()
			expect(metrics).not.toBeNull()
			expect(metrics!.operationDuration.samples).toBe(iterations)

			monitor.stop()
		})

		it('should efficiently calculate aggregated metrics', () => {
			const monitor = new PerformanceMonitor({
				enabled: true,
				sampleRate: 1.0,
				maxSamples: 1000,
			})

			// Generate samples
			for (let i = 0; i < 1000; i++) {
				const endTiming = monitor.startTiming()
				endTiming()
			}

			const iterations = 1000
			const startTime = performance.now()

			for (let i = 0; i < iterations; i++) {
				monitor.getAggregatedMetrics()
			}

			const endTime = performance.now()
			const duration = endTime - startTime
			const calculationsPerSecond = (iterations / duration) * 1000

			// Should calculate metrics at least 1,000 times per second
			expect(calculationsPerSecond).toBeGreaterThan(1000)

			monitor.stop()
		})

		it('should have minimal overhead when sampling is disabled', () => {
			const monitor = new PerformanceMonitor({
				enabled: false,
			})

			const iterations = 100000
			const startTime = performance.now()

			for (let i = 0; i < iterations; i++) {
				const endTiming = monitor.startTiming()
				endTiming()
			}

			const endTime = performance.now()
			const duration = endTime - startTime

			// Should complete very quickly when disabled
			expect(duration).toBeLessThan(100) // Less than 100ms for 100k operations

			monitor.stop()
		})

		it('should have acceptable overhead with low sampling rate', () => {
			const monitor = new PerformanceMonitor({
				enabled: true,
				sampleRate: 0.01, // 1% sampling
				maxSamples: 1000,
			})

			const iterations = 50000
			const startTime = performance.now()

			for (let i = 0; i < iterations; i++) {
				const endTiming = monitor.startTiming()
				// Simulate minimal work
				Math.random()
				endTiming()
			}

			const endTime = performance.now()
			const duration = endTime - startTime
			const operationsPerSecond = (iterations / duration) * 1000

			// Should still handle at least 50,000 operations per second with 1% sampling
			expect(operationsPerSecond).toBeGreaterThan(50000)

			monitor.stop()
		})
	})

	describe('Correlation Manager Performance', () => {
		it('should handle context switching efficiently', () => {
			const iterations = 10000
			const startTime = performance.now()

			for (let i = 0; i < iterations; i++) {
				const context = correlationManager.generateRequestContext()
				correlationManager.runWithContext(context, () => {
					correlationManager.getCorrelationId()
					correlationManager.getRequestId()
					correlationManager.getTraceId()
				})
			}

			const endTime = performance.now()
			const duration = endTime - startTime
			const contextsPerSecond = (iterations / duration) * 1000

			// Should handle at least 5,000 context switches per second
			expect(contextsPerSecond).toBeGreaterThan(5000)
			expect(duration).toBeLessThan(2000)
		})

		it('should generate request contexts efficiently', () => {
			const iterations = 20000
			const startTime = performance.now()

			for (let i = 0; i < iterations; i++) {
				correlationManager.generateRequestContext()
			}

			const endTime = performance.now()
			const duration = endTime - startTime
			const contextsPerSecond = (iterations / duration) * 1000

			// Should generate at least 10,000 request contexts per second
			expect(contextsPerSecond).toBeGreaterThan(10000)
			expect(duration).toBeLessThan(2000)
		})

		it('should handle nested context operations efficiently', () => {
			const iterations = 5000
			const startTime = performance.now()

			for (let i = 0; i < iterations; i++) {
				const parentContext = correlationManager.generateRequestContext()
				correlationManager.runWithContext(parentContext, () => {
					const childContext = correlationManager.generateRequestContext()
					correlationManager.runWithContext(childContext, () => {
						correlationManager.getCorrelationId()
						correlationManager.getTraceId()
					})
				})
			}

			const endTime = performance.now()
			const duration = endTime - startTime
			const operationsPerSecond = (iterations / duration) * 1000

			// Should handle at least 2,000 nested operations per second
			expect(operationsPerSecond).toBeGreaterThan(2000)
			expect(duration).toBeLessThan(2500)
		})
	})

	describe('Memory Usage Tests', () => {
		it('should not leak memory during ID generation', () => {
			const initialMemory = process.memoryUsage().heapUsed
			const iterations = 50000

			for (let i = 0; i < iterations; i++) {
				idGenerator.generateCorrelationId()
				idGenerator.generateRequestId()
				idGenerator.generateTraceContext()
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc()
			}

			const finalMemory = process.memoryUsage().heapUsed
			const memoryIncrease = finalMemory - initialMemory

			// Memory increase should be minimal (less than 10MB)
			expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
		})

		it('should respect sample limits in performance monitor', () => {
			const maxSamples = 1000
			const monitor = new PerformanceMonitor({
				enabled: true,
				sampleRate: 1.0,
				maxSamples,
			})

			// Generate more samples than the limit
			for (let i = 0; i < maxSamples * 2; i++) {
				const endTiming = monitor.startTiming()
				endTiming()
			}

			const metrics = monitor.getAggregatedMetrics()
			expect(metrics).not.toBeNull()
			// Should not exceed the maximum sample limit
			expect(metrics!.operationDuration.samples).toBeLessThanOrEqual(maxSamples)

			monitor.stop()
		})

		it('should handle performance monitor reset efficiently', () => {
			const monitor = new PerformanceMonitor({
				enabled: true,
				sampleRate: 1.0,
				maxSamples: 5000,
			})

			// Generate samples
			for (let i = 0; i < 5000; i++) {
				const endTiming = monitor.startTiming()
				endTiming()
			}

			const beforeReset = process.memoryUsage().heapUsed

			monitor.reset()

			const afterReset = process.memoryUsage().heapUsed
			const memoryFreed = beforeReset - afterReset

			// Should free some memory (or at least not increase significantly)
			expect(memoryFreed).toBeGreaterThanOrEqual(-1024 * 1024) // Allow 1MB variance

			monitor.stop()
		})
	})

	describe('Concurrent Operations', () => {
		it('should handle concurrent ID generation safely', async () => {
			const concurrency = 10
			const iterationsPerWorker = 1000
			const promises: Promise<string[]>[] = []

			const startTime = performance.now()

			for (let i = 0; i < concurrency; i++) {
				promises.push(
					Promise.resolve().then(() => {
						const ids: string[] = []
						for (let j = 0; j < iterationsPerWorker; j++) {
							ids.push(idGenerator.generateCorrelationId())
						}
						return ids
					})
				)
			}

			const results = await Promise.all(promises)
			const endTime = performance.now()
			const duration = endTime - startTime

			// Flatten all IDs and check for uniqueness
			const allIds = results.flat()
			const uniqueIds = new Set(allIds)

			expect(allIds.length).toBe(concurrency * iterationsPerWorker)
			expect(uniqueIds.size).toBe(allIds.length) // All IDs should be unique
			expect(duration).toBeLessThan(2000) // Should complete in reasonable time
		})

		it('should handle concurrent context operations safely', async () => {
			const concurrency = 20
			const iterationsPerWorker = 500
			const promises: Promise<void>[] = []

			for (let i = 0; i < concurrency; i++) {
				promises.push(
					Promise.resolve().then(() => {
						for (let j = 0; j < iterationsPerWorker; j++) {
							const context = correlationManager.generateRequestContext()
							correlationManager.runWithContext(context, () => {
								const correlationId = correlationManager.getCorrelationId()
								const requestId = correlationManager.getRequestId()
								expect(correlationId).toBeDefined()
								expect(requestId).toBeDefined()
							})
						}
					})
				)
			}

			const startTime = performance.now()
			await Promise.all(promises)
			const endTime = performance.now()
			const duration = endTime - startTime

			// Should complete concurrent operations efficiently
			expect(duration).toBeLessThan(3000)
		})
	})

	describe('Sampling Accuracy', () => {
		it('should maintain accurate sampling rates', () => {
			const sampleRate = 0.1 // 10%
			const monitor = new PerformanceMonitor({
				enabled: true,
				sampleRate,
				maxSamples: 10000,
			})

			const iterations = 10000
			let sampledCount = 0

			for (let i = 0; i < iterations; i++) {
				const endTiming = monitor.startTiming()
				const result = endTiming()
				if (result !== null) {
					sampledCount++
				}
			}

			const actualSampleRate = sampledCount / iterations
			const tolerance = 0.02 // 2% tolerance

			// Sample rate should be within tolerance
			expect(actualSampleRate).toBeGreaterThan(sampleRate - tolerance)
			expect(actualSampleRate).toBeLessThan(sampleRate + tolerance)

			monitor.stop()
		})

		it('should provide consistent performance metrics', () => {
			const monitor = new PerformanceMonitor({
				enabled: true,
				sampleRate: 1.0,
				maxSamples: 1000,
			})

			// Generate samples with known characteristics
			for (let i = 0; i < 1000; i++) {
				const endTiming = monitor.startTiming()
				// Simulate consistent work
				const start = performance.now()
				while (performance.now() - start < 1) {
					// Busy wait for 1ms
				}
				endTiming()
			}

			const metrics = monitor.getAggregatedMetrics()
			expect(metrics).not.toBeNull()

			// All samples should have similar duration (around 1ms)
			expect(metrics!.operationDuration.min).toBeGreaterThan(0.5)
			expect(metrics!.operationDuration.max).toBeLessThan(10)
			expect(metrics!.operationDuration.avg).toBeGreaterThan(0.8)
			expect(metrics!.operationDuration.avg).toBeLessThan(5)

			// P95 and P99 should be reasonable
			expect(metrics!.operationDuration.p95).toBeGreaterThan(metrics!.operationDuration.avg)
			expect(metrics!.operationDuration.p99).toBeGreaterThan(metrics!.operationDuration.p95)

			monitor.stop()
		})
	})
})
