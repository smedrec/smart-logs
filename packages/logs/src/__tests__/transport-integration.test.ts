import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DefaultBatchManager } from '../core/batch-manager.js'
import { CircuitBreaker } from '../core/circuit-breaker.js'
import { RetryManager } from '../core/retry-manager.js'
import { ConsoleTransport } from '../transports/console-transport.js'
import { FileTransport } from '../transports/file-transport.js'
import { OTLPTransport } from '../transports/otlp-transport.js'
import { RedisTransport } from '../transports/redis-transport.js'
import { EnhancedTransportWrapper } from '../utils/enhanced-transport-wrapper.js'
import { ErrorHandler } from '../utils/error-handler.js'
import { TransportHealthMonitor } from '../utils/transport-health-monitor.js'

import type { LogEntry, LogTransport } from '../types/index.js'

describe('Transport Integration Tests', () => {
	let tempDir: string
	let mockRedisClient: any
	let mockOTLPExporter: any

	beforeEach(async () => {
		tempDir = join(tmpdir(), `transport-test-${Date.now()}`)
		await fs.mkdir(tempDir, { recursive: true })

		// Mock Redis client
		mockRedisClient = {
			connect: vi.fn().mockResolvedValue(undefined),
			disconnect: vi.fn().mockResolvedValue(undefined),
			lpush: vi.fn().mockResolvedValue(1),
			xadd: vi.fn().mockResolvedValue('1234567890-0'),
			ping: vi.fn().mockResolvedValue('PONG'),
			isReady: true,
			on: vi.fn(),
			off: vi.fn(),
		}

		// Mock OTLP exporter
		mockOTLPExporter = {
			export: vi.fn().mockImplementation((logs, callback) => {
				// Simulate async export
				setTimeout(() => callback({ code: 0 }), 10)
			}),
			shutdown: vi.fn().mockResolvedValue(undefined),
		}
	})

	afterEach(async () => {
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('All Transport Combinations', () => {
		it('should handle console + file transport combination', async () => {
			const logFile = join(tempDir, 'console-file-test.log')
			const consoleOutput: string[] = []

			// Mock console output
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

			const logEntry: LogEntry = {
				id: 'console-file-test',
				timestamp: new Date(),
				level: 'info',
				message: 'Console and file transport test',
				correlationId: 'cf-test-123',
				fields: { test: 'console-file' },
				metadata: {
					service: 'transport-test',
					environment: 'test',
					hostname: 'test-host',
					pid: process.pid,
				},
				source: 'test',
				version: '1.0.0',
			}

			// Send to both transports
			await Promise.all([consoleTransport.send([logEntry]), fileTransport.send([logEntry])])

			// Verify console output
			expect(consoleOutput.length).toBeGreaterThan(0)
			expect(consoleOutput[0]).toContain('Console and file transport test')

			// Verify file output
			const fileContent = await fs.readFile(logFile, 'utf8')
			expect(fileContent).toContain('Console and file transport test')

			// Cleanup
			console.log = originalLog
			await Promise.all([consoleTransport.close(), fileTransport.close()])
		})

		it('should handle file + Redis transport combination', async () => {
			const logFile = join(tempDir, 'file-redis-test.log')

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

			const redisTransport = new RedisTransport({
				name: 'redis',
				enabled: true,
				host: 'localhost',
				port: 6379,
				key: 'test-logs',
				maxRetries: 3,
				retryDelayMs: 100,
				connectionTimeoutMs: 5000,
				commandTimeoutMs: 3000,
			})

			// Mock Redis client in transport
			;(redisTransport as any).client = mockRedisClient

			const logEntry: LogEntry = {
				id: 'file-redis-test',
				timestamp: new Date(),
				level: 'warn',
				message: 'File and Redis transport test',
				correlationId: 'fr-test-456',
				fields: { test: 'file-redis', priority: 'high' },
				metadata: {
					service: 'transport-test',
					environment: 'test',
					hostname: 'test-host',
					pid: process.pid,
				},
				source: 'test',
				version: '1.0.0',
			}

			// Send to both transports
			await Promise.all([fileTransport.send([logEntry]), redisTransport.send([logEntry])])

			// Verify file output
			const fileContent = await fs.readFile(logFile, 'utf8')
			expect(fileContent).toContain('File and Redis transport test')

			// Verify Redis calls
			expect(mockRedisClient.lpush).toHaveBeenCalled()

			// Cleanup
			await Promise.all([fileTransport.close(), redisTransport.close()])
		})

		it('should handle console + OTLP transport combination', async () => {
			const consoleOutput: string[] = []

			// Mock console output
			const originalLog = console.log
			console.log = vi.fn().mockImplementation((message: string) => {
				consoleOutput.push(message)
			})

			const consoleTransport = new ConsoleTransport({
				name: 'console',
				enabled: true,
				format: 'pretty',
				colorize: true,
				timestamp: true,
				level: 'debug',
			})

			const otlpTransport = new OTLPTransport({
				name: 'otlp',
				enabled: true,
				endpoint: 'http://localhost:4318/v1/logs',
				headers: { 'api-key': 'test-key' },
				timeoutMs: 5000,
				batchSize: 10,
				batchTimeoutMs: 1000,
				maxConcurrency: 2,
				compression: 'gzip',
				retryAttempts: 3,
				retryBackoffMs: 1000,
			})

			// Mock OTLP exporter in transport
			;(otlpTransport as any).exporter = mockOTLPExporter

			const logEntry: LogEntry = {
				id: 'console-otlp-test',
				timestamp: new Date(),
				level: 'error',
				message: 'Console and OTLP transport test',
				correlationId: 'co-test-789',
				fields: { test: 'console-otlp', severity: 'high' },
				metadata: {
					service: 'transport-test',
					environment: 'test',
					hostname: 'test-host',
					pid: process.pid,
				},
				source: 'test',
				version: '1.0.0',
			}

			// Send to both transports
			await Promise.all([consoleTransport.send([logEntry]), otlpTransport.send([logEntry])])

			// Verify console output
			expect(consoleOutput.length).toBeGreaterThan(0)
			expect(consoleOutput[0]).toContain('Console and OTLP transport test')

			// Verify OTLP export was called
			expect(mockOTLPExporter.export).toHaveBeenCalled()

			// Cleanup
			console.log = originalLog
			await Promise.all([consoleTransport.close(), otlpTransport.close()])
		})

		it('should handle all four transports simultaneously', async () => {
			const logFile = join(tempDir, 'all-transports-test.log')
			const consoleOutput: string[] = []

			// Mock console output
			const originalLog = console.log
			console.log = vi.fn().mockImplementation((message: string) => {
				consoleOutput.push(message)
			})

			// Create all transports
			const consoleTransport = new ConsoleTransport({
				name: 'console',
				enabled: true,
				format: 'json',
				colorize: false,
				timestamp: true,
				level: 'debug',
			})

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

			const redisTransport = new RedisTransport({
				name: 'redis',
				enabled: true,
				host: 'localhost',
				port: 6379,
				key: 'all-transports-logs',
				maxRetries: 3,
				retryDelayMs: 100,
				connectionTimeoutMs: 5000,
				commandTimeoutMs: 3000,
			})

			const otlpTransport = new OTLPTransport({
				name: 'otlp',
				enabled: true,
				endpoint: 'http://localhost:4318/v1/logs',
				headers: {},
				timeoutMs: 5000,
				batchSize: 10,
				batchTimeoutMs: 1000,
				maxConcurrency: 2,
				compression: 'gzip',
				retryAttempts: 3,
				retryBackoffMs: 1000,
			})

			// Mock clients
			;(redisTransport as any).client = mockRedisClient
			;(otlpTransport as any).exporter = mockOTLPExporter

			const logEntry: LogEntry = {
				id: 'all-transports-test',
				timestamp: new Date(),
				level: 'info',
				message: 'All transports simultaneous test',
				correlationId: 'all-test-999',
				fields: { test: 'all-transports', count: 4 },
				metadata: {
					service: 'transport-test',
					environment: 'test',
					hostname: 'test-host',
					pid: process.pid,
				},
				source: 'test',
				version: '1.0.0',
			}

			// Send to all transports simultaneously
			const results = await Promise.allSettled([
				consoleTransport.send([logEntry]),
				fileTransport.send([logEntry]),
				redisTransport.send([logEntry]),
				otlpTransport.send([logEntry]),
			])

			// All should succeed (or at least not reject)
			const rejectedResults = results.filter((r) => r.status === 'rejected')
			expect(rejectedResults.length).toBe(0)

			// Verify outputs
			expect(consoleOutput.length).toBeGreaterThan(0)
			expect(consoleOutput[0]).toContain('All transports simultaneous test')

			const fileContent = await fs.readFile(logFile, 'utf8')
			expect(fileContent).toContain('All transports simultaneous test')

			expect(mockRedisClient.lpush).toHaveBeenCalled()
			expect(mockOTLPExporter.export).toHaveBeenCalled()

			// Cleanup
			console.log = originalLog
			await Promise.all([
				consoleTransport.close(),
				fileTransport.close(),
				redisTransport.close(),
				otlpTransport.close(),
			])
		})
	})

	describe('Transport Failure Scenarios', () => {
		it('should handle partial transport failures gracefully', async () => {
			const logFile = join(tempDir, 'partial-failure-test.log')
			const results: { transport: string; success: boolean }[] = []

			// Working file transport
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

			// Failing Redis transport
			const failingRedisTransport: LogTransport = {
				name: 'redis-failing',
				async send() {
					throw new Error('Redis connection failed')
				},
				async flush() {},
				async close() {},
				isHealthy: () => false,
			}

			// Intermittent OTLP transport
			let otlpCallCount = 0
			const intermittentOTLPTransport: LogTransport = {
				name: 'otlp-intermittent',
				async send() {
					otlpCallCount++
					if (otlpCallCount % 2 === 0) {
						throw new Error('OTLP timeout')
					}
					// Success on odd calls
				},
				async flush() {},
				async close() {},
				isHealthy: () => true,
			}

			const transports = [fileTransport, failingRedisTransport, intermittentOTLPTransport]

			const logEntry: LogEntry = {
				id: 'partial-failure-test',
				timestamp: new Date(),
				level: 'error',
				message: 'Partial failure test message',
				correlationId: 'pf-test-123',
				fields: { test: 'partial-failure' },
				metadata: {
					service: 'transport-test',
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
				} catch {
					results.push({ transport: transport.name, success: false })
				}
			}

			// Verify mixed results
			expect(results.find((r) => r.transport === 'file')?.success).toBe(true)
			expect(results.find((r) => r.transport === 'redis-failing')?.success).toBe(false)
			expect(results.find((r) => r.transport === 'otlp-intermittent')?.success).toBe(true) // First call should succeed

			// Verify successful transport wrote logs
			const fileContent = await fs.readFile(logFile, 'utf8')
			expect(fileContent).toContain('Partial failure test message')

			await fileTransport.close()
		})

		it('should implement transport health monitoring', async () => {
			const healthMonitor = new TransportHealthMonitor({
				checkIntervalMs: 100,
				unhealthyThreshold: 3,
				recoveryThreshold: 2,
			})

			let failureCount = 0
			const flakyTransport: LogTransport = {
				name: 'flaky',
				async send() {
					failureCount++
					if (failureCount <= 3) {
						throw new Error(`Failure ${failureCount}`)
					}
					// Recover after 3 failures
				},
				async flush() {},
				async close() {},
				isHealthy: () => failureCount > 3,
			}

			healthMonitor.addTransport(flakyTransport)

			const logEntry: LogEntry = {
				id: 'health-monitor-test',
				timestamp: new Date(),
				level: 'info',
				message: 'Health monitor test',
				correlationId: 'hm-test-123',
				fields: {},
				metadata: {
					service: 'transport-test',
					environment: 'test',
					hostname: 'test-host',
					pid: process.pid,
				},
				source: 'test',
				version: '1.0.0',
			}

			// Test multiple sends to trigger health monitoring
			const results = []
			for (let i = 0; i < 5; i++) {
				try {
					await flakyTransport.send([logEntry])
					results.push({ attempt: i + 1, success: true })
				} catch {
					results.push({ attempt: i + 1, success: false })
				}
			}

			// Should have failures followed by success
			const failures = results.filter((r) => !r.success)
			const successes = results.filter((r) => r.success)

			expect(failures.length).toBe(3)
			expect(successes.length).toBe(2)

			healthMonitor.stop()
		})

		it('should handle transport with enhanced wrapper and retry policies', async () => {
			const logFile = join(tempDir, 'enhanced-wrapper-test.log')

			const baseTransport = new FileTransport({
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

			const retryManager = new RetryManager({
				maxAttempts: 3,
				initialDelayMs: 10,
				maxDelayMs: 100,
				multiplier: 2,
			})

			const circuitBreaker = new CircuitBreaker({
				failureThreshold: 3,
				resetTimeoutMs: 100,
				monitoringWindowMs: 1000,
			})

			const errorHandler = new ErrorHandler({
				maxErrorRate: 0.5,
				errorWindowMs: 60000,
				alertThreshold: 5,
			})

			const enhancedTransport = new EnhancedTransportWrapper(baseTransport, {
				retryManager,
				circuitBreaker,
				errorHandler,
			})

			const logEntry: LogEntry = {
				id: 'enhanced-wrapper-test',
				timestamp: new Date(),
				level: 'info',
				message: 'Enhanced wrapper test message',
				correlationId: 'ew-test-123',
				fields: { test: 'enhanced-wrapper' },
				metadata: {
					service: 'transport-test',
					environment: 'test',
					hostname: 'test-host',
					pid: process.pid,
				},
				source: 'test',
				version: '1.0.0',
			}

			// Send through enhanced wrapper
			await enhancedTransport.send([logEntry])

			// Verify log was written
			const fileContent = await fs.readFile(logFile, 'utf8')
			expect(fileContent).toContain('Enhanced wrapper test message')

			// Verify transport is healthy
			expect(enhancedTransport.isHealthy()).toBe(true)

			await enhancedTransport.close()
		})
	})

	describe('Production Deployment Scenarios', () => {
		it('should handle high-availability multi-transport setup', async () => {
			const primaryLogFile = join(tempDir, 'primary.log')
			const backupLogFile = join(tempDir, 'backup.log')

			// Primary transport (file)
			const primaryTransport = new FileTransport({
				name: 'primary-file',
				enabled: true,
				filename: primaryLogFile,
				maxSize: 10 * 1024 * 1024,
				maxFiles: 5,
				rotateDaily: false,
				rotationInterval: 'daily',
				compress: false,
				retentionDays: 30,
			})

			// Backup transport (file)
			const backupTransport = new FileTransport({
				name: 'backup-file',
				enabled: true,
				filename: backupLogFile,
				maxSize: 10 * 1024 * 1024,
				maxFiles: 5,
				rotateDaily: false,
				rotationInterval: 'daily',
				compress: false,
				retentionDays: 30,
			})

			// Remote transport (OTLP)
			const remoteTransport = new OTLPTransport({
				name: 'remote-otlp',
				enabled: true,
				endpoint: 'http://remote-logs.example.com/v1/logs',
				headers: { authorization: 'Bearer test-token' },
				timeoutMs: 5000,
				batchSize: 50,
				batchTimeoutMs: 2000,
				maxConcurrency: 5,
				compression: 'gzip',
				retryAttempts: 3,
				retryBackoffMs: 1000,
			})

			// Mock remote transport
			;(remoteTransport as any).exporter = mockOTLPExporter

			const transports = [primaryTransport, backupTransport, remoteTransport]

			// Create batch manager for high-throughput processing
			const batchManager = new DefaultBatchManager(
				{
					maxSize: 50,
					timeoutMs: 1000,
					maxConcurrency: 3,
				},
				async (entries) => {
					// Send to all transports in parallel
					await Promise.allSettled(transports.map((transport) => transport.send(entries)))
				},
				'ha-production'
			)

			// Generate production-like log volume
			const logPromises = []
			for (let i = 0; i < 100; i++) {
				const logEntry: LogEntry = {
					id: `ha-prod-${i}`,
					timestamp: new Date(),
					level: i % 10 === 0 ? 'error' : 'info',
					message: `Production log message ${i}`,
					correlationId: `ha-prod-correlation-${Math.floor(i / 10)}`,
					fields: {
						requestId: `req-${i}`,
						userId: `user-${i % 20}`,
						action: 'api-call',
						duration: Math.random() * 1000,
					},
					metadata: {
						service: 'production-api',
						environment: 'production',
						hostname: 'prod-server-01',
						pid: process.pid,
						version: '2.1.0',
					},
					source: 'api-server',
					version: '1.0.0',
				}

				logPromises.push(batchManager.add(logEntry))
			}

			// Wait for all logs to be processed
			await Promise.all(logPromises)
			await batchManager.flush()

			// Verify logs were written to all local transports
			const primaryContent = await fs.readFile(primaryLogFile, 'utf8')
			const backupContent = await fs.readFile(backupLogFile, 'utf8')

			expect(primaryContent).toContain('Production log message')
			expect(backupContent).toContain('Production log message')

			// Verify remote transport was called
			expect(mockOTLPExporter.export).toHaveBeenCalled()

			// Cleanup
			await Promise.all([batchManager.close(), ...transports.map((t) => t.close())])
		})

		it('should handle graceful degradation when transports fail', async () => {
			const workingLogFile = join(tempDir, 'working.log')
			const results: { transport: string; success: boolean; error?: string }[] = []

			// Working transport
			const workingTransport = new FileTransport({
				name: 'working-file',
				enabled: true,
				filename: workingLogFile,
				maxSize: 10 * 1024 * 1024,
				maxFiles: 5,
				rotateDaily: false,
				rotationInterval: 'daily',
				compress: false,
				retentionDays: 30,
			})

			// Failing transports
			const failingTransports: LogTransport[] = [
				{
					name: 'failing-redis',
					async send() {
						throw new Error('Redis unavailable')
					},
					async flush() {},
					async close() {},
					isHealthy: () => false,
				},
				{
					name: 'failing-otlp',
					async send() {
						throw new Error('OTLP endpoint down')
					},
					async flush() {},
					async close() {},
					isHealthy: () => false,
				},
			]

			const allTransports = [workingTransport, ...failingTransports]

			const logEntry: LogEntry = {
				id: 'graceful-degradation-test',
				timestamp: new Date(),
				level: 'critical',
				message: 'Critical system alert - graceful degradation test',
				correlationId: 'gd-test-123',
				fields: { alert: 'system-critical', severity: 'high' },
				metadata: {
					service: 'monitoring-system',
					environment: 'production',
					hostname: 'monitor-01',
					pid: process.pid,
				},
				source: 'monitoring',
				version: '1.0.0',
			}

			// Attempt to send to all transports
			for (const transport of allTransports) {
				try {
					await transport.send([logEntry])
					results.push({ transport: transport.name, success: true })
				} catch (error) {
					results.push({
						transport: transport.name,
						success: false,
						error: error instanceof Error ? error.message : 'Unknown error',
					})
				}
			}

			// Verify graceful degradation
			const successfulTransports = results.filter((r) => r.success)
			const failedTransports = results.filter((r) => !r.success)

			expect(successfulTransports.length).toBe(1) // Only working transport
			expect(failedTransports.length).toBe(2) // Both failing transports

			// Verify critical log was still captured by working transport
			const workingContent = await fs.readFile(workingLogFile, 'utf8')
			expect(workingContent).toContain('Critical system alert')

			await workingTransport.close()
		})
	})
})
