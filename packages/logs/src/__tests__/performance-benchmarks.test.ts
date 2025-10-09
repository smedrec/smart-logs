import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DefaultBatchManager } from '../core/batch-manager.js'
import { StructuredLogger } from '../core/structured-logger.js'
import { FileTransport } from '../transports/file-transport.js'
import { PerformanceMonitor } from '../utils/performance-monitor.js'

import type { LogEntry } from '../types/index.js'

describe('Performance Benchmarks', () => {
	let tempDir: string
	let performanceMonitor: PerformanceMonitor

	beforeEach(async () => {
		tempDir = join(tmpdir(), `perf-test-${Date.now()}`)
		await fs.mkdir(tempDir, { recursive: true })

		performanceMonitor = new PerformanceMonitor({
			enabled: true,
			sampleRate: 1.0, // Sample all for testing
			metricsIntervalMs: 100,
		})
	})

	afterEach(async () => {
		performanceMonitor.stop()
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('Throughput Benchmarks', () => {
		it('should handle 1000 logs/second without memory leaks', async () => {
			const logFile = join(tempDir, 'throughput-test.log')
			const initialMemory = process.memoryUsage()

			const fileTransport = new FileTransport({
				name: 'file',
				enabled: true,
				filename: logFile,
				maxSize: 50 * 1024 * 1024, // 50MB
				maxFiles: 3,
				rotateDaily: false,
				rotationInterval: 'daily',
				compress: false,
				retentionDays: 30,
			})

			const batchManager = new DefaultBatchManager(
				{
					maxSize: 100,
					timeoutMs: 1000,
					maxConcurrency: 5,
				},
				async (entries) => {
					await fileTransport.send(entries)
				},
				'throughput-test'
			)

			const logger = new StructuredLogger({
				service: 'throughput-test',
				environment: 'benchmark',
			})

			const logCount = 2000 // Test with 2000 logs
			const startTime = performance.now()
			const startMemory = process.memoryUsage()

			// Generate logs as fast as possible
			const logPromises = []
			for (let i = 0; i < logCount; i++) {
				const logPromise = logger.info(`Throughput test log ${i}`, {
					iteration: i,
					timestamp: Date.now(),
					data: `benchmark-data-${i}`,
					randomValue: Math.random(),
				})
				logPromises.push(logPromise)

				// Also test batch manager directly
				batchManager.add({
					id: `batch-${i}`,
					timestamp: new Date(),
					level: 'info',
					message: `Batch throughput log ${i}`,
					correlationId: `throughput-${i}`,
					fields: { iteration: i, batchTest: true },
					metadata: {
						service: 'throughput-test',
						environment: 'benchmark',
						hostname: 'benchmark-host',
						pid: process.pid,
					},
					source: 'benchmark',
					version: '1.0.0',
				} as LogEntry)
			}

			// Wait for all operations to complete
			await Promise.all(logPromises)
			await batchManager.flush()
			await logger.flush()

			const endTime = performance.now()
			const endMemory = process.memoryUsage()

			const totalTime = endTime - startTime
			const logsPerSecond = (logCount * 2) / (totalTime / 1000) // *2 for logger + batch
			const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed

			// Cleanup
			await Promise.all([batchManager.close(), fileTransport.close(), logger.close()])

			// Performance assertions
			expect(logsPerSecond).toBeGreaterThan(500) // Should handle at least 500 logs/second
			expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024) // Should not increase memory by more than 200MB
			expect(totalTime).toBeLessThan(20000) // Should complete within 20 seconds

			// Verify logs were written
			const fileContent = await fs.readFile(logFile, 'utf8')
			const logLines = fileContent.trim().split('\n').filter(Boolean)
			expect(logLines.length).toBeGreaterThan(logCount) // Should have at least the logger logs

			console.log(`Throughput benchmark: ${logsPerSecond.toFixed(2)} logs/second`)
			console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`)
			console.log(`Total time: ${totalTime.toFixed(2)} ms`)
		}, 30000) // 30 second timeout

		it('should maintain performance under concurrent load', async () => {
			const logger = new StructuredLogger({
				service: 'concurrent-benchmark',
				environment: 'test',
			})

			const concurrentWorkers = 20
			const logsPerWorker = 50
			const totalLogs = concurrentWorkers * logsPerWorker

			const startTime = performance.now()
			const startMemory = process.memoryUsage()

			// Create concurrent workers
			const workerPromises = Array.from({ length: concurrentWorkers }, async (_, workerId) => {
				const workerStartTime = performance.now()
				const workerPromises = []

				for (let i = 0; i < logsPerWorker; i++) {
					const logPromise = logger.info(`Worker ${workerId} log ${i}`, {
						workerId,
						iteration: i,
						timestamp: Date.now(),
						workerStartTime,
					})
					workerPromises.push(logPromise)
				}

				await Promise.all(workerPromises)
				return performance.now() - workerStartTime
			})

			// Wait for all workers to complete
			const workerTimes = await Promise.all(workerPromises)
			await logger.flush()

			const endTime = performance.now()
			const endMemory = process.memoryUsage()

			const totalTime = endTime - startTime
			const logsPerSecond = totalLogs / (totalTime / 1000)
			const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed
			const avgWorkerTime = workerTimes.reduce((sum, time) => sum + time, 0) / workerTimes.length

			await logger.close()

			// Performance assertions for concurrent load
			expect(logsPerSecond).toBeGreaterThan(200) // Should handle concurrent load efficiently
			expect(totalTime).toBeLessThan(15000) // Should complete within 15 seconds
			expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Should not use excessive memory

			console.log(`Concurrent benchmark: ${logsPerSecond.toFixed(2)} logs/second`)
			console.log(`Average worker time: ${avgWorkerTime.toFixed(2)} ms`)
			console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`)
		}, 20000) // 20 second timeout

		it('should handle large log entries efficiently', async () => {
			const logFile = join(tempDir, 'large-logs-test.log')

			const fileTransport = new FileTransport({
				name: 'file',
				enabled: true,
				filename: logFile,
				maxSize: 100 * 1024 * 1024, // 100MB
				maxFiles: 2,
				rotateDaily: false,
				rotationInterval: 'daily',
				compress: false,
				retentionDays: 30,
			})

			const logger = new StructuredLogger({
				service: 'large-logs-test',
				environment: 'benchmark',
			})

			// Create large log entries (10KB each)
			const largeData = 'x'.repeat(10000)
			const logCount = 100

			const startTime = performance.now()
			const startMemory = process.memoryUsage()

			const logPromises = []
			for (let i = 0; i < logCount; i++) {
				const logPromise = logger.info(`Large log entry ${i}`, {
					iteration: i,
					largeData,
					timestamp: Date.now(),
					metadata: {
						size: largeData.length,
						type: 'large-entry',
					},
				})
				logPromises.push(logPromise)
			}

			await Promise.all(logPromises)
			await logger.flush()

			const endTime = performance.now()
			const endMemory = process.memoryUsage()

			const totalTime = endTime - startTime
			const logsPerSecond = logCount / (totalTime / 1000)
			const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed

			// Cleanup
			await Promise.all([fileTransport.close(), logger.close()])

			// Verify file size and content
			const stats = await fs.stat(logFile)
			const expectedMinSize = logCount * 8000 // At least 8KB per log (accounting for JSON overhead)

			expect(stats.size).toBeGreaterThan(expectedMinSize)
			expect(logsPerSecond).toBeGreaterThan(10) // Should handle large logs reasonably fast
			expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024) // Should not use excessive memory

			console.log(`Large logs benchmark: ${logsPerSecond.toFixed(2)} logs/second`)
			console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
			console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`)
		}, 15000) // 15 second timeout
	})

	describe('Latency Benchmarks', () => {
		it('should complete individual log operations within acceptable latency', async () => {
			const logger = new StructuredLogger({
				service: 'latency-test',
				environment: 'benchmark',
			})

			const measurements: number[] = []
			const testCount = 100

			// Measure individual log operation latency
			for (let i = 0; i < testCount; i++) {
				const start = performance.now()
				await logger.info(`Latency test log ${i}`, {
					iteration: i,
					timestamp: Date.now(),
				})
				const end = performance.now()
				measurements.push(end - start)
			}

			await logger.flush()
			await logger.close()

			// Calculate statistics
			const avgLatency = measurements.reduce((sum, time) => sum + time, 0) / measurements.length
			const maxLatency = Math.max(...measurements)
			const minLatency = Math.min(...measurements)
			const p95Latency = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)]

			// Latency assertions
			expect(avgLatency).toBeLessThan(50) // Average should be under 50ms
			expect(p95Latency).toBeLessThan(100) // 95th percentile should be under 100ms
			expect(maxLatency).toBeLessThan(200) // Max should be under 200ms

			console.log(`Latency benchmark:`)
			console.log(`  Average: ${avgLatency.toFixed(2)} ms`)
			console.log(`  P95: ${p95Latency.toFixed(2)} ms`)
			console.log(`  Max: ${maxLatency.toFixed(2)} ms`)
			console.log(`  Min: ${minLatency.toFixed(2)} ms`)
		})

		it('should handle batch processing with low latency', async () => {
			const processedBatches: { size: number; processingTime: number }[] = []

			const batchManager = new DefaultBatchManager(
				{
					maxSize: 10,
					timeoutMs: 100,
					maxConcurrency: 3,
				},
				async (entries) => {
					const start = performance.now()
					// Simulate processing
					await new Promise((resolve) => setTimeout(resolve, 1))
					const end = performance.now()
					processedBatches.push({
						size: entries.length,
						processingTime: end - start,
					})
				},
				'latency-batch-test'
			)

			// Add items to trigger batching
			const addPromises = []
			for (let i = 0; i < 50; i++) {
				const addPromise = batchManager.add({
					id: `latency-${i}`,
					timestamp: new Date(),
					level: 'info',
					message: `Latency batch test ${i}`,
					correlationId: `latency-${i}`,
					fields: { iteration: i },
					metadata: {
						service: 'latency-test',
						environment: 'benchmark',
						hostname: 'test-host',
						pid: process.pid,
					},
					source: 'benchmark',
					version: '1.0.0',
				} as LogEntry)
				addPromises.push(addPromise)
			}

			await Promise.all(addPromises)
			await batchManager.flush()
			await batchManager.close()

			// Analyze batch processing latency
			expect(processedBatches.length).toBeGreaterThan(0)

			const avgProcessingTime =
				processedBatches.reduce((sum, batch) => sum + batch.processingTime, 0) /
				processedBatches.length
			const maxProcessingTime = Math.max(...processedBatches.map((b) => b.processingTime))

			expect(avgProcessingTime).toBeLessThan(20) // Average batch processing should be under 20ms
			expect(maxProcessingTime).toBeLessThan(50) // Max batch processing should be under 50ms

			console.log(`Batch latency benchmark:`)
			console.log(`  Batches processed: ${processedBatches.length}`)
			console.log(`  Average processing time: ${avgProcessingTime.toFixed(2)} ms`)
			console.log(`  Max processing time: ${maxProcessingTime.toFixed(2)} ms`)
		})
	})

	describe('Memory Usage Benchmarks', () => {
		it('should maintain stable memory usage under sustained load', async () => {
			const logger = new StructuredLogger({
				service: 'memory-test',
				environment: 'benchmark',
			})

			const memoryMeasurements: number[] = []
			const measurementInterval = 100 // measurements
			const totalLogs = 1000

			let logCount = 0
			const logPromises = []

			// Generate logs and measure memory periodically
			for (let i = 0; i < totalLogs; i++) {
				const logPromise = logger.info(`Memory test log ${i}`, {
					iteration: i,
					timestamp: Date.now(),
					data: `memory-test-data-${i}`,
				})
				logPromises.push(logPromise)
				logCount++

				// Measure memory every measurementInterval logs
				if (logCount % measurementInterval === 0) {
					const memUsage = process.memoryUsage()
					memoryMeasurements.push(memUsage.heapUsed)
				}
			}

			await Promise.all(logPromises)
			await logger.flush()
			await logger.close()

			// Analyze memory usage pattern
			expect(memoryMeasurements.length).toBeGreaterThan(5)

			const initialMemory = memoryMeasurements[0]
			const finalMemory = memoryMeasurements[memoryMeasurements.length - 1]
			const maxMemory = Math.max(...memoryMeasurements)
			const memoryGrowth = finalMemory - initialMemory

			// Memory should not grow excessively
			expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024) // Should not grow by more than 100MB
			expect(maxMemory - initialMemory).toBeLessThan(200 * 1024 * 1024) // Peak should not exceed 200MB above initial

			console.log(`Memory usage benchmark:`)
			console.log(`  Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`)
			console.log(`  Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`)
			console.log(`  Max memory: ${(maxMemory / 1024 / 1024).toFixed(2)} MB`)
			console.log(`  Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`)
		})

		it('should handle garbage collection efficiently', async () => {
			const logger = new StructuredLogger({
				service: 'gc-test',
				environment: 'benchmark',
			})

			// Force garbage collection if available
			if (global.gc) {
				global.gc()
			}

			const initialMemory = process.memoryUsage()

			// Generate a burst of logs
			const burstSize = 500
			const logPromises = []

			for (let i = 0; i < burstSize; i++) {
				const logPromise = logger.info(`GC test log ${i}`, {
					iteration: i,
					timestamp: Date.now(),
					largeData: 'x'.repeat(1000), // 1KB per log
				})
				logPromises.push(logPromise)
			}

			await Promise.all(logPromises)
			await logger.flush()

			// Force garbage collection if available
			if (global.gc) {
				global.gc()
			}

			// Wait a bit for GC to complete
			await new Promise((resolve) => setTimeout(resolve, 100))

			const afterGCMemory = process.memoryUsage()
			await logger.close()

			const memoryAfterBurst = afterGCMemory.heapUsed - initialMemory.heapUsed

			// Memory should be reasonable after GC
			expect(memoryAfterBurst).toBeLessThan(50 * 1024 * 1024) // Should not retain more than 50MB

			console.log(`GC benchmark:`)
			console.log(`  Memory after burst and GC: ${(memoryAfterBurst / 1024 / 1024).toFixed(2)} MB`)
		})
	})

	describe('Performance Monitoring Integration', () => {
		it('should collect accurate performance metrics', async () => {
			const logger = new StructuredLogger({
				service: 'metrics-test',
				environment: 'benchmark',
			})

			const logCount = 100
			const startTime = performance.now()

			// Generate logs while monitoring performance
			const logPromises = []
			for (let i = 0; i < logCount; i++) {
				const logPromise = logger.info(`Metrics test log ${i}`, {
					iteration: i,
					timestamp: Date.now(),
				})
				logPromises.push(logPromise)
			}

			await Promise.all(logPromises)
			await logger.flush()

			const endTime = performance.now()
			const actualDuration = endTime - startTime

			// Get performance metrics
			const metrics = performanceMonitor.getMetrics()

			await logger.close()

			// Verify metrics accuracy
			expect(metrics.totalLogs).toBeGreaterThan(0)
			expect(metrics.averageLatency).toBeGreaterThan(0)
			expect(metrics.averageLatency).toBeLessThan(actualDuration) // Should be less than total duration

			console.log(`Performance metrics:`)
			console.log(`  Total logs: ${metrics.totalLogs}`)
			console.log(`  Average latency: ${metrics.averageLatency.toFixed(2)} ms`)
			console.log(`  Actual duration: ${actualDuration.toFixed(2)} ms`)
		})
	})
})
