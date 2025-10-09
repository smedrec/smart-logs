import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Import compatibility layer for testing
import {
	LegacyLoggerWrapper,
	LegacyStructuredLoggerWrapper,
} from '../compatibility/legacy-logger.js'
import { ConfigMigrator, MigrationAssistant } from '../compatibility/migration-utils.js'
import { DefaultBatchManager } from '../core/batch-manager.js'
import { CircuitBreaker } from '../core/circuit-breaker.js'
import { CorrelationManager } from '../core/correlation-manager.js'
import { LogProcessor } from '../core/log-processor.js'
import { RetryManager } from '../core/retry-manager.js'
import { getShutdownManager, ShutdownManager } from '../core/shutdown-manager.js'
import { StructuredLogger } from '../core/structured-logger.js'
import { ConsoleTransport } from '../transports/console-transport.js'
import { FileTransport } from '../transports/file-transport.js'
import { OTLPTransport } from '../transports/otlp-transport.js'
import { RedisTransport } from '../transports/redis-transport.js'
import { ErrorHandler } from '../utils/error-handler.js'
import { PerformanceMonitor } from '../utils/performance-monitor.js'

import type { LogEntry, LoggingConfig, LogTransport } from '../types/index.js'

describe('Comprehensive Integration Test Suite', () => {
	let tempDir: string
	let mockRedisClient: any
	let mockOTLPExporter: any

	beforeEach(async () => {
		tempDir = join(tmpdir(), `comprehensive-test-${Date.now()}`)
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
		it('should handle all possible transport combinations', async () => {
			const logFile = join(tempDir, 'all-combinations.log')
			const consoleOutput: string[] = []

			// Mock console output
			const originalLog = console.log
			console.log = vi.fn().mockImplementation((message: string) => {
				consoleOutput.push(message)
			})

			// Create all transports
			const transports = {
				console: new ConsoleTransport({
					name: 'console',
					enabled: true,
					format: 'json',
					colorize: false,
					timestamp: true,
					level: 'debug',
				}),
				file: new FileTransport({
					name: 'file',
					enabled: true,
					filename: logFile,
					maxSize: 10 * 1024 * 1024,
					maxFiles: 5,
					rotateDaily: false,
					rotationInterval: 'daily',
					compress: false,
					retentionDays: 30,
				}),
				redis: new RedisTransport({
					name: 'redis',
					enabled: true,
					host: 'localhost',
					port: 6379,
					key: 'test-logs',
					maxRetries: 3,
					retryDelayMs: 100,
					connectionTimeoutMs: 5000,
					commandTimeoutMs: 3000,
				}),
				otlp: new OTLPTransport({
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
				}),
			}

			// Mock clients
			;(transports.redis as any).client = mockRedisClient
			;(transports.otlp as any).exporter = mockOTLPExporter

			// Test all combinations (2^4 = 16 combinations)
			const transportNames = Object.keys(transports) as Array<keyof typeof transports>
			const combinations: Array<Array<keyof typeof transports>> = []

			// Generate all possible combinations
			for (let i = 1; i < Math.pow(2, transportNames.length); i++) {
				const combination: Array<keyof typeof transports> = []
				for (let j = 0; j < transportNames.length; j++) {
					if (i & (1 << j)) {
						combination.push(transportNames[j])
					}
				}
				combinations.push(combination)
			}

			const results: Array<{ combination: string; success: boolean; errors: string[] }> = []

			// Test each combination
			for (const combination of combinations) {
				const combinationName = combination.join('+')
				const errors: string[] = []

				const logEntry: LogEntry = {
					id: `combo-${combinationName}`,
					timestamp: new Date(),
					level: 'info',
					message: `Testing combination: ${combinationName}`,
					correlationId: `combo-test-${Date.now()}`,
					fields: { combination: combinationName, transportCount: combination.length },
					metadata: {
						service: 'comprehensive-test',
						environment: 'test',
						hostname: 'test-host',
						pid: process.pid,
					},
					source: 'test',
					version: '1.0.0',
				}

				// Send to selected transports
				const promises = combination.map(async (transportName) => {
					try {
						await transports[transportName].send([logEntry])
					} catch (error) {
						errors.push(
							`${transportName}: ${error instanceof Error ? error.message : 'Unknown error'}`
						)
						throw error
					}
				})

				try {
					await Promise.all(promises)
					results.push({ combination: combinationName, success: true, errors })
				} catch {
					results.push({ combination: combinationName, success: false, errors })
				}
			}

			// Verify results
			const successfulCombinations = results.filter((r) => r.success)
			const failedCombinations = results.filter((r) => !r.success)

			console.log(`Tested ${results.length} transport combinations`)
			console.log(`Successful: ${successfulCombinations.length}`)
			console.log(`Failed: ${failedCombinations.length}`)

			// At least single transport combinations should work
			const singleTransportCombos = results.filter((r) => !r.combination.includes('+'))
			expect(singleTransportCombos.every((r) => r.success)).toBe(true)

			// Cleanup
			console.log = originalLog
			await Promise.all(Object.values(transports).map((t) => t.close()))

			// Verify outputs
			expect(consoleOutput.length).toBeGreaterThan(0)

			const fileContent = await fs.readFile(logFile, 'utf8')
			expect(fileContent).toContain('Testing combination')

			expect(mockRedisClient.lpush).toHaveBeenCalled()
			expect(mockOTLPExporter.export).toHaveBeenCalled()
		})

		it('should handle transport failures gracefully in combinations', async () => {
			const workingLogFile = join(tempDir, 'working-combo.log')
			const results: Array<{ transport: string; success: boolean }> = []

			// Create mix of working and failing transports
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

			const failingTransports: LogTransport[] = [
				{
					name: 'failing-redis',
					async send() {
						throw new Error('Redis connection failed')
					},
					async flush() {},
					async close() {},
					isHealthy: () => false,
				},
				{
					name: 'failing-otlp',
					async send() {
						throw new Error('OTLP endpoint unavailable')
					},
					async flush() {},
					async close() {},
					isHealthy: () => false,
				},
			]

			const allTransports = [workingTransport, ...failingTransports]

			const logEntry: LogEntry = {
				id: 'failure-combo-test',
				timestamp: new Date(),
				level: 'error',
				message: 'Testing failure handling in transport combinations',
				correlationId: 'failure-combo-123',
				fields: { test: 'failure-handling' },
				metadata: {
					service: 'comprehensive-test',
					environment: 'test',
					hostname: 'test-host',
					pid: process.pid,
				},
				source: 'test',
				version: '1.0.0',
			}

			// Test each transport
			for (const transport of allTransports) {
				try {
					await transport.send([logEntry])
					results.push({ transport: transport.name, success: true })
				} catch {
					results.push({ transport: transport.name, success: false })
				}
			}

			// Verify graceful degradation
			const successfulTransports = results.filter((r) => r.success)
			const failedTransports = results.filter((r) => !r.success)

			expect(successfulTransports.length).toBe(1) // Only working transport
			expect(failedTransports.length).toBe(2) // Both failing transports
			expect(successfulTransports[0].transport).toBe('working-file')

			// Verify working transport still captured logs
			const fileContent = await fs.readFile(workingLogFile, 'utf8')
			expect(fileContent).toContain('Testing failure handling')

			await workingTransport.close()
		})
	})

	describe('Configuration Scenarios', () => {
		it('should handle all valid configuration combinations', async () => {
			const configurations: Array<{ name: string; config: Partial<LoggingConfig> }> = [
				{
					name: 'minimal',
					config: {
						service: 'minimal-service',
						environment: 'test',
					},
				},
				{
					name: 'console-only',
					config: {
						service: 'console-service',
						environment: 'test',
						outputs: ['console'],
						console: {
							name: 'console',
							enabled: true,
							format: 'pretty',
							colorize: true,
							timestamp: true,
							level: 'debug',
						},
					},
				},
				{
					name: 'file-with-rotation',
					config: {
						service: 'file-service',
						environment: 'test',
						outputs: ['file'],
						file: {
							name: 'file',
							enabled: true,
							filename: join(tempDir, 'rotation-test.log'),
							maxSize: 1024, // Small size to trigger rotation
							maxFiles: 3,
							rotateDaily: true,
							rotationInterval: 'daily',
							compress: true,
							retentionDays: 7,
						},
					},
				},
				{
					name: 'performance-enabled',
					config: {
						service: 'perf-service',
						environment: 'test',
						performance: {
							enabled: true,
							sampleRate: 1.0,
							metricsIntervalMs: 100,
						},
					},
				},
				{
					name: 'high-throughput',
					config: {
						service: 'throughput-service',
						environment: 'test',
						batch: {
							maxSize: 50,
							timeoutMs: 100,
							maxConcurrency: 5,
						},
						retry: {
							maxAttempts: 5,
							initialDelayMs: 50,
							maxDelayMs: 1000,
							multiplier: 1.5,
						},
					},
				},
			]

			const results: Array<{ name: string; success: boolean; error?: string }> = []

			for (const { name, config } of configurations) {
				try {
					const logger = new StructuredLogger(config)

					// Test basic logging
					await logger.info(`Testing ${name} configuration`, {
						config: name,
						timestamp: new Date().toISOString(),
					})

					// Test different log levels
					await logger.debug('Debug message', { level: 'debug' })
					await logger.warn('Warning message', { level: 'warn' })
					await logger.error('Error message', { level: 'error' })

					await logger.flush()
					await logger.close()

					results.push({ name, success: true })
				} catch (error) {
					results.push({
						name,
						success: false,
						error: error instanceof Error ? error.message : 'Unknown error',
					})
				}
			}

			// All configurations should work
			const failures = results.filter((r) => !r.success)
			if (failures.length > 0) {
				console.log('Configuration failures:', failures)
			}
			expect(failures.length).toBe(0)

			console.log(`Successfully tested ${results.length} configuration scenarios`)
		})

		it('should validate configuration and provide clear error messages', async () => {
			const invalidConfigurations = [
				{
					name: 'missing-service',
					config: { environment: 'test' },
					expectedError: /service/i,
				},
				{
					name: 'missing-environment',
					config: { service: 'test-service' },
					expectedError: /environment/i,
				},
				{
					name: 'invalid-level',
					config: {
						service: 'test-service',
						environment: 'test',
						level: 'invalid' as any,
					},
					expectedError: /level/i,
				},
			]

			for (const { name, config, expectedError } of invalidConfigurations) {
				expect(() => {
					new StructuredLogger(config as any)
				}).toThrow(expectedError)
			}
		})
	})

	describe('Backward Compatibility and Migration', () => {
		it('should maintain backward compatibility with legacy interfaces', async () => {
			// Test legacy logger wrapper
			const legacyLogger = new LegacyLoggerWrapper()

			// These should work without throwing (but emit warnings)
			legacyLogger.debug('Legacy debug message', { test: true })
			legacyLogger.info('Legacy info message', { test: true })
			legacyLogger.warn('Legacy warn message', { test: true })
			legacyLogger.error('Legacy error message', { test: true })

			// Should be able to access new logger
			const newLogger = legacyLogger.getStructuredLogger()
			await newLogger.info('Accessed through legacy wrapper', { migration: true })

			await legacyLogger.close()
		})

		it('should migrate legacy configurations correctly', async () => {
			const legacyConfig = {
				level: 'info' as const,
				structured: true,
				format: 'json' as const,
				enableCorrelationIds: true,
				retentionDays: 30,
				exporterType: 'console' as const,
			}

			const migratedConfig = ConfigMigrator.migrateLegacyConfig(legacyConfig)

			// Should have required fields
			expect(migratedConfig.service).toBeDefined()
			expect(migratedConfig.environment).toBeDefined()
			expect(migratedConfig.level).toBe('info')
			expect(migratedConfig.outputs).toContain('console')

			// Should be able to create logger with migrated config
			const logger = new StructuredLogger({
				...migratedConfig,
				service: 'migrated-service',
				environment: 'test',
			})

			await logger.info('Migration test successful', { migrated: true })
			await logger.close()
		})

		it('should generate comprehensive migration plans', async () => {
			const legacyStructuredConfig = {
				level: 'debug' as const,
				enablePerformanceLogging: true,
				enableErrorTracking: true,
				enableMetrics: true,
				format: 'pretty' as const,
				outputs: ['console', 'file'] as const,
				fileConfig: {
					path: './logs/test.log',
					maxSize: 5 * 1024 * 1024,
					maxFiles: 3,
				},
			}

			const plan = MigrationAssistant.createMigrationPlan(legacyStructuredConfig)

			// Should have all required components
			expect(plan.migratedConfig).toBeDefined()
			expect(plan.report).toContain('MIGRATION REPORT')
			expect(plan.examples).toContain('CODE MIGRATION EXAMPLES')
			expect(plan.checklist).toBeInstanceOf(Array)
			expect(plan.checklist.length).toBeGreaterThan(5)

			// Migrated config should be usable
			const logger = new StructuredLogger({
				...plan.migratedConfig,
				service: 'migration-plan-test',
				environment: 'test',
			})

			await logger.info('Migration plan test', { planGenerated: true })
			await logger.close()
		})
	})

	describe('Production Deployment Scenarios', () => {
		it('should handle production-like high availability setup', async () => {
			const primaryLogFile = join(tempDir, 'ha-primary.log')
			const backupLogFile = join(tempDir, 'ha-backup.log')
			const auditLogFile = join(tempDir, 'ha-audit.log')

			// Create high-availability transport setup
			const transports = [
				new FileTransport({
					name: 'primary',
					enabled: true,
					filename: primaryLogFile,
					maxSize: 10 * 1024 * 1024,
					maxFiles: 5,
					rotateDaily: false,
					rotationInterval: 'daily',
					compress: false,
					retentionDays: 30,
				}),
				new FileTransport({
					name: 'backup',
					enabled: true,
					filename: backupLogFile,
					maxSize: 10 * 1024 * 1024,
					maxFiles: 5,
					rotateDaily: false,
					rotationInterval: 'daily',
					compress: false,
					retentionDays: 30,
				}),
				new FileTransport({
					name: 'audit',
					enabled: true,
					filename: auditLogFile,
					maxSize: 10 * 1024 * 1024,
					maxFiles: 10,
					rotateDaily: true,
					rotationInterval: 'daily',
					compress: true,
					retentionDays: 90,
				}),
			]

			// Create batch manager for high-throughput processing
			const batchManager = new DefaultBatchManager(
				{
					maxSize: 25,
					timeoutMs: 500,
					maxConcurrency: 3,
				},
				async (entries) => {
					// Send to all transports in parallel with error handling
					const results = await Promise.allSettled(
						transports.map((transport) => transport.send(entries))
					)

					// Log any transport failures
					results.forEach((result, index) => {
						if (result.status === 'rejected') {
							console.warn(`Transport ${transports[index].name} failed:`, result.reason)
						}
					})
				},
				'ha-production'
			)

			// Generate production-like log volume
			const logTypes = ['info', 'warn', 'error'] as const
			const services = ['api', 'auth', 'database', 'cache', 'queue']
			const operations = ['request', 'query', 'update', 'delete', 'create']

			const logPromises = []
			for (let i = 0; i < 50; i++) {
				const logEntry: LogEntry = {
					id: `ha-prod-${i}`,
					timestamp: new Date(),
					level: logTypes[i % logTypes.length],
					message: `Production operation ${operations[i % operations.length]}`,
					correlationId: `ha-correlation-${Math.floor(i / 10)}`,
					fields: {
						service: services[i % services.length],
						operation: operations[i % operations.length],
						requestId: `req-${i}`,
						userId: `user-${i % 20}`,
						duration: Math.random() * 1000,
						statusCode: i % 10 === 0 ? 500 : 200,
					},
					metadata: {
						service: services[i % services.length],
						environment: 'production',
						hostname: 'prod-server-01',
						pid: process.pid,
						version: '2.1.0',
					},
					source: 'production-api',
					version: '1.0.0',
				}

				logPromises.push(batchManager.add(logEntry))
			}

			// Wait for all logs to be processed
			await Promise.all(logPromises)
			await batchManager.flush()

			// Verify logs were written to all transports
			const primaryContent = await fs.readFile(primaryLogFile, 'utf8')
			const backupContent = await fs.readFile(backupLogFile, 'utf8')
			const auditContent = await fs.readFile(auditLogFile, 'utf8')

			expect(primaryContent).toContain('Production operation')
			expect(backupContent).toContain('Production operation')
			expect(auditContent).toContain('Production operation')

			// Verify different log levels are present
			expect(primaryContent).toContain('"level":"info"')
			expect(primaryContent).toContain('"level":"warn"')
			expect(primaryContent).toContain('"level":"error"')

			// Cleanup
			await Promise.all([batchManager.close(), ...transports.map((t) => t.close())])
		})

		it('should handle edge cases and error scenarios', async () => {
			const scenarios = [
				{
					name: 'disk-full-simulation',
					test: async () => {
						// Simulate disk full by creating transport that fails after a few writes
						let writeCount = 0
						const failingTransport: LogTransport = {
							name: 'disk-full',
							async send() {
								writeCount++
								if (writeCount > 3) {
									throw new Error('ENOSPC: no space left on device')
								}
							},
							async flush() {},
							async close() {},
							isHealthy: () => writeCount <= 3,
						}

						const logEntry: LogEntry = {
							id: 'disk-full-test',
							timestamp: new Date(),
							level: 'error',
							message: 'Disk full scenario test',
							correlationId: 'disk-full-123',
							fields: { scenario: 'disk-full' },
							metadata: {
								service: 'edge-case-test',
								environment: 'test',
								hostname: 'test-host',
								pid: process.pid,
							},
							source: 'test',
							version: '1.0.0',
						}

						// Should succeed for first few attempts
						await failingTransport.send([logEntry])
						await failingTransport.send([logEntry])
						await failingTransport.send([logEntry])

						// Should fail after disk full
						await expect(failingTransport.send([logEntry])).rejects.toThrow('ENOSPC')
					},
				},
				{
					name: 'network-partition',
					test: async () => {
						// Simulate network partition with intermittent failures
						let callCount = 0
						const networkTransport: LogTransport = {
							name: 'network-partition',
							async send() {
								callCount++
								if (callCount % 3 === 0) {
									throw new Error('ENETUNREACH: Network is unreachable')
								}
							},
							async flush() {},
							async close() {},
							isHealthy: () => callCount % 3 !== 0,
						}

						const retryManager = new RetryManager({
							maxAttempts: 3,
							initialDelayMs: 10,
							maxDelayMs: 100,
							multiplier: 2,
						})

						const logEntry: LogEntry = {
							id: 'network-partition-test',
							timestamp: new Date(),
							level: 'warn',
							message: 'Network partition scenario test',
							correlationId: 'network-123',
							fields: { scenario: 'network-partition' },
							metadata: {
								service: 'edge-case-test',
								environment: 'test',
								hostname: 'test-host',
								pid: process.pid,
							},
							source: 'test',
							version: '1.0.0',
						}

						// Should eventually succeed with retries
						await retryManager.executeWithRetry(() => networkTransport.send([logEntry]), {
							maxAttempts: 3,
							initialDelayMs: 10,
							maxDelayMs: 100,
							multiplier: 2,
						})
					},
				},
				{
					name: 'memory-pressure',
					test: async () => {
						// Simulate memory pressure with large log entries
						const logger = new StructuredLogger({
							service: 'memory-pressure-test',
							environment: 'test',
						})

						const largeData = 'x'.repeat(50000) // 50KB per log

						// Should handle large logs without crashing
						const promises = []
						for (let i = 0; i < 20; i++) {
							promises.push(
								logger.info(`Large log ${i}`, {
									iteration: i,
									largeData,
									timestamp: new Date().toISOString(),
								})
							)
						}

						await Promise.all(promises)
						await logger.close()
					},
				},
			]

			// Run all edge case scenarios
			for (const scenario of scenarios) {
				try {
					await scenario.test()
					console.log(`✅ Edge case scenario '${scenario.name}' passed`)
				} catch (error) {
					console.error(`❌ Edge case scenario '${scenario.name}' failed:`, error)
					throw error
				}
			}
		})

		it('should handle graceful shutdown under load', async () => {
			const logFile = join(tempDir, 'shutdown-load-test.log')

			const logger = new StructuredLogger({
				service: 'shutdown-load-test',
				environment: 'test',
				outputs: ['file'],
				file: {
					name: 'file',
					enabled: true,
					filename: logFile,
					maxSize: 10 * 1024 * 1024,
					maxFiles: 5,
					rotateDaily: false,
					rotationInterval: 'daily',
					compress: false,
					retentionDays: 30,
				},
			})

			// Generate high load
			const logPromises = []
			for (let i = 0; i < 100; i++) {
				logPromises.push(
					logger.info(`Load test message ${i}`, {
						iteration: i,
						timestamp: Date.now(),
						data: `load-test-data-${i}`,
					})
				)
			}

			// Simulate shutdown signal while under load
			const shutdownPromise = (async () => {
				// Wait a bit to let some logs start processing
				await new Promise((resolve) => setTimeout(resolve, 50))

				// Initiate graceful shutdown
				await logger.flush()
				await logger.close()
			})()

			// Wait for both load and shutdown to complete
			await Promise.all([Promise.all(logPromises), shutdownPromise])

			// Verify all logs were written before shutdown
			const fileContent = await fs.readFile(logFile, 'utf8')
			const logLines = fileContent.trim().split('\n').filter(Boolean)

			// Should have captured most or all logs
			expect(logLines.length).toBeGreaterThan(50) // At least half should be captured

			// Each line should be valid JSON
			logLines.forEach((line) => {
				expect(() => JSON.parse(line)).not.toThrow()
			})
		})
	})

	describe('System Integration and Monitoring', () => {
		it('should integrate with performance monitoring', async () => {
			const performanceMonitor = new PerformanceMonitor({
				enabled: true,
				sampleRate: 1.0, // Sample all for testing
				metricsIntervalMs: 100,
			})

			const logger = new StructuredLogger({
				service: 'monitoring-integration-test',
				environment: 'test',
			})

			// Generate logs while monitoring
			for (let i = 0; i < 20; i++) {
				await logger.info(`Monitored log ${i}`, {
					iteration: i,
					timestamp: Date.now(),
				})
			}

			await logger.flush()

			// Get performance metrics
			const metrics = performanceMonitor.getMetrics()

			expect(metrics.totalLogs).toBeGreaterThan(0)
			expect(metrics.averageLatency).toBeGreaterThan(0)

			// Cleanup
			performanceMonitor.stop()
			await logger.close()
		})

		it('should handle correlation tracking across complex scenarios', async () => {
			const correlationManager = new CorrelationManager()
			const logger = new StructuredLogger({
				service: 'correlation-test',
				environment: 'test',
			})

			// Set up correlation context
			correlationManager.setCorrelationId('main-correlation-123')
			correlationManager.setRequestId('main-request-456')

			// Test nested correlation contexts
			const scenarios = [
				{ correlationId: 'scenario-1', requestId: 'req-1' },
				{ correlationId: 'scenario-2', requestId: 'req-2' },
				{ correlationId: 'scenario-3', requestId: 'req-3' },
			]

			for (const scenario of scenarios) {
				const childLogger = logger.withContext(scenario)
				childLogger.setCorrelationId(scenario.correlationId)
				childLogger.setRequestId(scenario.requestId)

				await childLogger.info('Scenario processing', {
					scenario: scenario.correlationId,
					step: 'start',
				})

				// Simulate nested operations
				for (let i = 0; i < 3; i++) {
					await childLogger.debug(`Nested operation ${i}`, {
						scenario: scenario.correlationId,
						operation: i,
						nested: true,
					})
				}

				await childLogger.info('Scenario completed', {
					scenario: scenario.correlationId,
					step: 'end',
				})
			}

			await logger.flush()
			await logger.close()
		})

		it('should handle error propagation and recovery', async () => {
			const errorHandler = new ErrorHandler({
				maxErrorRate: 0.5,
				errorWindowMs: 1000,
				alertThreshold: 3,
			})

			const logger = new StructuredLogger({
				service: 'error-handling-test',
				environment: 'test',
			})

			// Simulate various error scenarios
			const errorScenarios = [
				new Error('Network timeout'),
				new Error('Database connection failed'),
				new Error('Invalid input data'),
				new Error('Service unavailable'),
			]

			for (const error of errorScenarios) {
				try {
					// Simulate operation that might fail
					if (Math.random() > 0.5) {
						throw error
					}

					await logger.info('Operation succeeded', {
						operation: 'test-operation',
						success: true,
					})
				} catch (operationError) {
					// Handle error and log it
					errorHandler.handleError(operationError as Error, {
						operation: 'test-operation',
					})

					await logger.error('Operation failed', {
						error: {
							name: (operationError as Error).name,
							message: (operationError as Error).message,
							stack: (operationError as Error).stack,
						},
						operation: 'test-operation',
						recovered: true,
					})
				}
			}

			await logger.close()
		})
	})
})
