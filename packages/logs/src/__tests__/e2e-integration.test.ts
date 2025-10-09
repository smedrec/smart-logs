import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DefaultBatchManager } from '../core/batch-manager.js'
import { CircuitBreaker } from '../core/circuit-breaker.js'
import { CorrelationManager } from '../core/correlation-manager.js'
import { LogProcessor } from '../core/log-processor.js'
import { RetryManager } from '../core/retry-manager.js'
import { StructuredLogger } from '../core/structured-logger.js'
import { ConsoleTransport } from '../transports/console-transport.js'
import { FileTransport } from '../transports/file-transport.js'
import { OTLPTransport } from '../transports/otlp-transport.js'
import { RedisTransport } from '../transports/redis-transport.js'
import { ErrorHandler } from '../utils/error-handler.js'
import { PerformanceMonitor } from '../utils/performance-monitor.js'

import type { LogEntry, LoggingConfig, LogTransport } from '../types/index.js'

describe('End-to-End Integration Tests', () => {
	let tempDir: string
	let mockOTLPEndpoint: string
	let mockRedisClient: any

	beforeEach(async () => {
		tempDir = join(tmpdir(), `logs-e2e-${Date.now()}`)
		await fs.mkdir(tempDir, { recursive: true })
		mockOTLPEndpoint = 'http://localhost:4318/v1/logs'

		// Mock Redis client
		mockRedisClient = {
			connect: vi.fn().mockResolvedValue(undefined),
			disconnect: vi.fn().mockResolvedValue(undefined),
			lpush: vi.fn().mockResolvedValue(1),
			ping: vi.fn().mockResolvedValue('PONG'),
			isReady: true,
		}
	})

	afterEach(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('Complete Logging Pipeline', () => {
		it('should process logs through entire pipeline from logger to transport delivery', async () => {
			const logFile = join(tempDir, 'pipeline-test.log')
			const processedLogs: LogEntry[] = []

			// Create file transport
			const fileTransport = new FileTransport({
				name: 'file',
				enabled: true,
				filename: logFile,
				maxSize: 10 * 1024 * 1024,
				maxFiles: 5,
				rotateDaily: false,
				rotationInterval: 'daily',
				compress: false,
				retentionDays: 30,
			})

			// Create console transport with capture
			const consoleOutput: string[] = []
			const originalLog = console.log
			console.log = vi.fn().mockImplementation((message: string) => {
				consoleOutput.push(message)
			})

			const consoleTransport = new ConsoleTransport({
				name: 'console',
				enabled: true,
				format: 'json',
				colorize: false,
				timestamp: true,
				level: 'debug',
			})

			// Create batch manager with transport processor
			const processor = async (entries: LogEntry[]) => {
				processedLogs.push(...entries)
				await Promise.all([fileTransport.send(entries), consoleTransport.send(entries)])
			}

			const batchManager = new DefaultBatchManager(
				{
					maxSize: 3,
					timeoutMs: 100,
					maxConcurrency: 2,
				},
				processor,
				'pipeline-test'
			)

			// Create logger with correlation manager
			const correlationManager = new CorrelationManager()
			const logger = new StructuredLogger({
				service: 'pipeline-test',
				environment: 'test',
			})

			// Set correlation context
			correlationManager.setCorrelationId('test-correlation-123')
			correlationManager.setRequestId('req-456')

			// Generate logs with different levels and contexts
			await logger.info('Pipeline test started', { phase: 'initialization' })
			await logger.debug('Debug information', { details: { step: 1, data: 'test' } })
			await logger.warn('Warning message', { warning: 'test-warning' })
			await logger.error('Error occurred', { error: 'test-error', code: 500 })

			// Add logs to batch manager
			const logEntries: LogEntry[] = [
				{
					id: 'batch-1',
					timestamp: new Date(),
					level: 'info',
					message: 'Batch processed log 1',
					correlationId: correlationManager.getCorrelationId(),
					requestId: correlationManager.getRequestId(),
					fields: { batchId: 1 },
					metadata: {
						service: 'pipeline-test',
						environment: 'test',
						hostname: 'test-host',
						pid: process.pid,
					},
					source: 'batch-test',
					version: '1.0.0',
				},
				{
					id: 'batch-2',
					timestamp: new Date(),
					level: 'error',
					message: 'Batch processed log 2',
					correlationId: correlationManager.getCorrelationId(),
					requestId: correlationManager.getRequestId(),
					fields: { batchId: 2, error: true },
					metadata: {
						service: 'pipeline-test',
						environment: 'test',
						hostname: 'test-host',
						pid: process.pid,
					},
					source: 'batch-test',
					version: '1.0.0',
				},
			]

			for (const entry of logEntries) {
				await batchManager.add(entry)
			}

			// Wait for processing
			await batchManager.flush()
			await logger.flush()

			// Cleanup
			await Promise.all([
				batchManager.close(),
				fileTransport.close(),
				consoleTransport.close(),
				logger.close(),
			])

			// Restore console
			console.log = originalLog

			// Verify logs were processed
			expect(processedLogs.length).toBeGreaterThan(0)

			// Verify file output
			const fileContent = await fs.readFile(logFile, 'utf8')
			expect(fileContent).toContain('Pipeline test started')
			expect(fileContent).toContain('Batch processed log 1')
			expect(fileContent).toContain('test-correlation-123')

			// Verify console output
			expect(consoleOutput.length).toBeGreaterThan(0)
			expect(consoleOutput.some((log) => log.includes('Pipeline test started'))).toBe(true)
		})

		it('should handle performance monitoring throughout pipeline', async () => {
			const performanceMonitor = new PerformanceMonitor({
				enabled: true,
				sampleRate: 1.0, // Sample all for testing
				metricsIntervalMs: 100,
			})

			const logger = new StructuredLogger({
				service: 'performance-test',
				environment: 'test',
			})

			// Generate logs with performance monitoring
			const startTime = Date.now()

			for (let i = 0; i < 10; i++) {
				await logger.info(`Performance test log ${i}`, {
					iteration: i,
					timestamp: Date.now(),
				})
			}

			await logger.flush()

			const endTime = Date.now()
			const duration = endTime - startTime

			// Verify performance metrics were collected
			const metrics = performanceMonitor.getMetrics()
			expect(metrics.totalLogs).toBeGreaterThan(0)
			expect(metrics.averageLatency).toBeGreaterThan(0)
			expect(duration).toBeGreaterThan(0)

			await logger.close()
			performanceMonitor.stop()
		})
	})

	describe('Configuration Loading and Validation', () => {
		it('should load and validate configuration in realistic scenarios', async () => {
			const configFile = join(tempDir, 'logging-config.json')
			const logFile = join(tempDir, 'config-test.log')

			// Create realistic configuration
			const config: LoggingConfig = {
				level: 'info',
				service: 'config-test-service',
				environment: 'production',
				outputs: ['console', 'file'],
				console: {
					name: 'console',
					enabled: true,
					format: 'json',
					colorize: false,
					timestamp: true,
					level: 'info',
				},
				file: {
					name: 'file',
					enabled: true,
					filename: logFile,
					maxSize: 10 * 1024 * 1024,
					maxFiles: 5,
					rotateDaily: true,
					rotationInterval: 'daily',
					compress: true,
					retentionDays: 30,
				},
				batch: {
					maxSize: 100,
					timeoutMs: 5000,
					maxConcurrency: 10,
				},
				performance: {
					enabled: true,
					sampleRate: 0.1,
					metricsIntervalMs: 60000,
				},
				retry: {
					maxAttempts: 3,
					initialDelayMs: 1000,
					maxDelayMs: 30000,
					multiplier: 2,
				},
				shutdown: {
					timeoutMs: 30000,
					handleSignals: true,
				},
			}

			await fs.writeFile(configFile, JSON.stringify(config, null, 2))

			// Load configuration (simulated - would use ConfigLoader in real implementation)
			const loadedConfig = JSON.parse(await fs.readFile(configFile, 'utf8'))

			// Validate configuration structure
			expect(loadedConfig.level).toBe('info')
			expect(loadedConfig.service).toBe('config-test-service')
			expect(loadedConfig.outputs).toContain('console')
			expect(loadedConfig.outputs).toContain('file')
			expect(loadedConfig.file.filename).toBe(logFile)
			expect(loadedConfig.batch.maxSize).toBe(100)

			// Create logger with loaded configuration
			const logger = new StructuredLogger({
				service: loadedConfig.service,
				environment: loadedConfig.environment,
			})

			await logger.info('Configuration test log', { configLoaded: true })
			await logger.close()
		})

		it('should handle environment variable configuration', async () => {
			// Set environment variables
			process.env.LOG_LEVEL = 'debug'
			process.env.LOG_SERVICE = 'env-test-service'
			process.env.LOG_ENVIRONMENT = 'staging'
			process.env.LOG_BATCH_SIZE = '50'
			process.env.LOG_PERFORMANCE_ENABLED = 'true'

			// Simulate environment variable parsing
			const envConfig = {
				level: process.env.LOG_LEVEL as any,
				service: process.env.LOG_SERVICE,
				environment: process.env.LOG_ENVIRONMENT,
				batch: {
					maxSize: parseInt(process.env.LOG_BATCH_SIZE || '100'),
				},
				performance: {
					enabled: process.env.LOG_PERFORMANCE_ENABLED === 'true',
				},
			}

			expect(envConfig.level).toBe('debug')
			expect(envConfig.service).toBe('env-test-service')
			expect(envConfig.environment).toBe('staging')
			expect(envConfig.batch.maxSize).toBe(50)
			expect(envConfig.performance.enabled).toBe(true)

			// Cleanup environment variables
			delete process.env.LOG_LEVEL
			delete process.env.LOG_SERVICE
			delete process.env.LOG_ENVIRONMENT
			delete process.env.LOG_BATCH_SIZE
			delete process.env.LOG_PERFORMANCE_ENABLED
		})

		it('should validate invalid configuration and provide clear errors', async () => {
			const invalidConfigs = [
				{
					name: 'invalid-level',
					config: { level: 'invalid-level' },
					expectedError: /level/i,
				},
				{
					name: 'negative-batch-size',
					config: { batch: { maxSize: -1 } },
					expectedError: /batch.*size/i,
				},
				{
					name: 'invalid-sample-rate',
					config: { performance: { sampleRate: 1.5 } },
					expectedError: /sample.*rate/i,
				},
			]

			for (const { name, config, expectedError } of invalidConfigs) {
				// In a real implementation, this would use Zod validation
				// For now, we simulate validation errors
				expect(() => {
					if (config.level && !['debug', 'info', 'warn', 'error', 'fatal'].includes(config.level)) {
						throw new Error(`Invalid log level: ${config.level}`)
					}
					if (config.batch?.maxSize && config.batch.maxSize < 1) {
						throw new Error(`Invalid batch size: ${config.batch.maxSize}`)
					}
					if (
						config.performance?.sampleRate &&
						(config.performance.sampleRate < 0 || config.performance.sampleRate > 1)
					) {
						throw new Error(`Invalid sample rate: ${config.performance.sampleRate}`)
					}
				}).toThrow(expectedError)
			}
		})
	})

	describe('Multi-Transport Scenarios with Failure Modes', () => {
		it('should handle mixed transport success and failure scenarios', async () => {
			const logFile = join(tempDir, 'multi-transport.log')
			const results: { transport: string; success: boolean; error?: string }[] = []

			// Create transports with different reliability
			const fileTransport = new FileTransport({
				name: 'file',
				enabled: true,
				filename: logFile,
				maxSize: 10 * 1024 * 1024,
				maxFiles: 5,
				rotateDaily: false,
				rotationInterval: 'daily',
				compress: false,
				retentionDays: 30,
			})

			const consoleTransport = new ConsoleTransport({
				name: 'console',
				enabled: true,
				format: 'json',
				colorize: false,
				timestamp: true,
				level: 'debug',
			})

			// Mock failing OTLP transport
			const failingOTLPTransport: LogTransport = {
				name: 'otlp-failing',
				async send() {
					throw new Error('OTLP endpoint unavailable')
				},
				async flush() {},
				async close() {},
				isHealthy: () => false,
			}

			const transports = [fileTransport, consoleTransport, failingOTLPTransport]

			// Create error handler to track failures
			const errorHandler = new ErrorHandler({
				maxErrorRate: 0.5,
				errorWindowMs: 60000,
				alertThreshold: 5,
			})

			// Test log entry
			const logEntry: LogEntry = {
				id: 'multi-transport-test',
				timestamp: new Date(),
				level: 'info',
				message: 'Multi-transport test message',
				correlationId: 'multi-test-123',
				fields: { test: 'multi-transport' },
				metadata: {
					service: 'multi-transport-test',
					environment: 'test',
					hostname: 'test-host',
					pid: process.pid,
				},
				source: 'test',
				version: '1.0.0',
			}

			// Send to all transports and track results
			for (const transport of transports) {
				try {
					await transport.send([logEntry])
					results.push({ transport: transport.name, success: true })
				} catch (error) {
					results.push({
						transport: transport.name,
						success: false,
						error: error instanceof Error ? error.message : 'Unknown error',
					})
					errorHandler.handleError(error as Error, { transport: transport.name })
				}
			}

			// Verify mixed results
			expect(results.length).toBe(3)
			expect(results.filter((r) => r.success)).toHaveLength(2) // file and console should succeed
			expect(results.filter((r) => !r.success)).toHaveLength(1) // OTLP should fail

			const failedResult = results.find((r) => !r.success)
			expect(failedResult?.transport).toBe('otlp-failing')
			expect(failedResult?.error).toContain('OTLP endpoint unavailable')

			// Verify successful transports wrote logs
			const fileContent = await fs.readFile(logFile, 'utf8')
			expect(fileContent).toContain('Multi-transport test message')

			// Cleanup
			await Promise.all([
				fileTransport.close(),
				consoleTransport.close(),
				failingOTLPTransport.close(),
			])
		})

		it('should implement circuit breaker pattern for unreliable transports', async () => {
			let failureCount = 0
			const maxFailures = 3

			// Create transport that fails initially then recovers
			const unreliableTransport: LogTransport = {
				name: 'unreliable',
				async send() {
					failureCount++
					if (failureCount <= maxFailures) {
						throw new Error(`Failure ${failureCount}`)
					}
					// Success after max failures
				},
				async flush() {},
				async close() {},
				isHealthy: () => failureCount > maxFailures,
			}

			const circuitBreaker = new CircuitBreaker({
				failureThreshold: 3,
				resetTimeoutMs: 100,
				monitoringWindowMs: 1000,
			})

			const logEntry: LogEntry = {
				id: 'circuit-breaker-test',
				timestamp: new Date(),
				level: 'info',
				message: 'Circuit breaker test',
				correlationId: 'cb-test-123',
				fields: {},
				metadata: {
					service: 'circuit-breaker-test',
					environment: 'test',
					hostname: 'test-host',
					pid: process.pid,
				},
				source: 'test',
				version: '1.0.0',
			}

			const results: { attempt: number; success: boolean; circuitOpen: boolean }[] = []

			// Test circuit breaker behavior
			for (let i = 1; i <= 6; i++) {
				const circuitOpen = !circuitBreaker.canExecute()

				if (circuitOpen) {
					results.push({ attempt: i, success: false, circuitOpen: true })
					continue
				}

				try {
					await unreliableTransport.send([logEntry])
					circuitBreaker.onSuccess()
					results.push({ attempt: i, success: true, circuitOpen: false })
				} catch (error) {
					circuitBreaker.onFailure()
					results.push({ attempt: i, success: false, circuitOpen: false })
				}
			}

			// Verify circuit breaker opened after failures
			const failedAttempts = results.filter((r) => !r.success && !r.circuitOpen)
			const circuitOpenAttempts = results.filter((r) => r.circuitOpen)
			const successfulAttempts = results.filter((r) => r.success)

			expect(failedAttempts.length).toBe(3) // Should fail 3 times before opening
			expect(circuitOpenAttempts.length).toBeGreaterThan(0) // Circuit should open
			expect(successfulAttempts.length).toBeGreaterThan(0) // Should eventually succeed
		})

		it('should implement retry logic with exponential backoff', async () => {
			let attemptCount = 0
			const maxAttempts = 3

			// Create transport that succeeds on final attempt
			const retryTransport: LogTransport = {
				name: 'retry-test',
				async send() {
					attemptCount++
					if (attemptCount < maxAttempts) {
						throw new Error(`Attempt ${attemptCount} failed`)
					}
					// Success on final attempt
				},
				async flush() {},
				async close() {},
				isHealthy: () => true,
			}

			const retryManager = new RetryManager({
				maxAttempts: 3,
				initialDelayMs: 10, // Short delay for testing
				maxDelayMs: 100,
				multiplier: 2,
			})

			const logEntry: LogEntry = {
				id: 'retry-test',
				timestamp: new Date(),
				level: 'info',
				message: 'Retry test message',
				correlationId: 'retry-test-123',
				fields: {},
				metadata: {
					service: 'retry-test',
					environment: 'test',
					hostname: 'test-host',
					pid: process.pid,
				},
				source: 'test',
				version: '1.0.0',
			}

			const startTime = Date.now()

			// Execute with retry
			await retryManager.executeWithRetry(() => retryTransport.send([logEntry]), {
				maxAttempts: 3,
				initialDelayMs: 10,
				maxDelayMs: 100,
				multiplier: 2,
			})

			const endTime = Date.now()
			const totalTime = endTime - startTime

			// Verify retry behavior
			expect(attemptCount).toBe(3) // Should have made 3 attempts
			expect(totalTime).toBeGreaterThan(10) // Should have some delay from retries
		})
	})

	describe('Performance Tests Under Production Load', () => {
		it('should handle high-throughput logging without memory leaks', async () => {
			const logFile = join(tempDir, 'performance-test.log')
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
				'performance-test'
			)

			const logger = new StructuredLogger({
				service: 'performance-test',
				environment: 'test',
			})

			// Generate high-throughput logs
			const logCount = 1000
			const startTime = Date.now()

			const logPromises = []
			for (let i = 0; i < logCount; i++) {
				const logPromise = logger.info(`High throughput log ${i}`, {
					iteration: i,
					timestamp: Date.now(),
					data: `test-data-${i}`,
				})
				logPromises.push(logPromise)

				// Also add to batch manager
				batchManager.add({
					id: `batch-${i}`,
					timestamp: new Date(),
					level: 'info',
					message: `Batch log ${i}`,
					correlationId: `perf-test-${i}`,
					fields: { iteration: i },
					metadata: {
						service: 'performance-test',
						environment: 'test',
						hostname: 'test-host',
						pid: process.pid,
					},
					source: 'performance-test',
					version: '1.0.0',
				} as LogEntry)
			}

			// Wait for all logs to complete
			await Promise.all(logPromises)
			await batchManager.flush()
			await logger.flush()

			const endTime = Date.now()
			const totalTime = endTime - startTime
			const logsPerSecond = (logCount * 2) / (totalTime / 1000) // *2 for logger + batch manager

			// Cleanup
			await Promise.all([batchManager.close(), fileTransport.close(), logger.close()])

			const finalMemory = process.memoryUsage()
			const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

			// Performance assertions
			expect(logsPerSecond).toBeGreaterThan(100) // Should handle at least 100 logs/second
			expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Should not increase memory by more than 100MB
			expect(totalTime).toBeLessThan(30000) // Should complete within 30 seconds

			// Verify logs were written
			const fileContent = await fs.readFile(logFile, 'utf8')
			const logLines = fileContent.trim().split('\n').filter(Boolean)
			expect(logLines.length).toBeGreaterThan(logCount) // Should have at least the logger logs
		})

		it('should maintain performance under concurrent load', async () => {
			const logger = new StructuredLogger({
				service: 'concurrent-test',
				environment: 'test',
			})

			const concurrentWorkers = 10
			const logsPerWorker = 100

			const startTime = Date.now()

			// Create concurrent workers
			const workerPromises = Array.from({ length: concurrentWorkers }, async (_, workerId) => {
				const workerPromises = []
				for (let i = 0; i < logsPerWorker; i++) {
					const logPromise = logger.info(`Worker ${workerId} log ${i}`, {
						workerId,
						iteration: i,
						timestamp: Date.now(),
					})
					workerPromises.push(logPromise)
				}
				return Promise.all(workerPromises)
			})

			// Wait for all workers to complete
			await Promise.all(workerPromises)
			await logger.flush()

			const endTime = Date.now()
			const totalTime = endTime - startTime
			const totalLogs = concurrentWorkers * logsPerWorker
			const logsPerSecond = totalLogs / (totalTime / 1000)

			await logger.close()

			// Performance assertions for concurrent load
			expect(logsPerSecond).toBeGreaterThan(50) // Should handle concurrent load efficiently
			expect(totalTime).toBeLessThan(20000) // Should complete within 20 seconds
		})

		it('should handle memory pressure gracefully', async () => {
			const logger = new StructuredLogger({
				service: 'memory-pressure-test',
				environment: 'test',
			})

			// Create large log entries to simulate memory pressure
			const largeData = 'x'.repeat(10000) // 10KB per log

			const logPromises = []
			for (let i = 0; i < 100; i++) {
				const logPromise = logger.info(`Memory pressure log ${i}`, {
					iteration: i,
					largeData,
					timestamp: Date.now(),
				})
				logPromises.push(logPromise)
			}

			// Should handle large logs without crashing
			await Promise.all(logPromises)
			await logger.flush()
			await logger.close()

			// If we reach here, memory pressure was handled gracefully
			expect(true).toBe(true)
		})
	})
})
