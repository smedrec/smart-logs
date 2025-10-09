import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	createRequestLogger,
	LegacyLoggerFactory,
	LegacyLoggerWrapper,
	LegacyStructuredLoggerWrapper,
} from '../compatibility/legacy-logger.js'
import {
	CodeMigrator,
	ConfigMigrator,
	LegacyUsageDetector,
	MigrationAssistant,
} from '../compatibility/migration-utils.js'
import { StructuredLogger } from '../core/structured-logger.js'

describe('Backward Compatibility Integration Tests', () => {
	let tempDir: string
	let consoleOutput: string[]
	let consoleWarnOutput: string[]
	let originalLog: typeof console.log
	let originalWarn: typeof console.warn

	beforeEach(async () => {
		tempDir = join(tmpdir(), `compat-test-${Date.now()}`)
		await fs.mkdir(tempDir, { recursive: true })

		// Capture console output
		consoleOutput = []
		consoleWarnOutput = []
		originalLog = console.log
		originalWarn = console.warn

		console.log = vi.fn().mockImplementation((message: string) => {
			consoleOutput.push(message)
		})

		console.warn = vi.fn().mockImplementation((message: string) => {
			consoleWarnOutput.push(message)
		})
	})

	afterEach(async () => {
		// Restore console
		console.log = originalLog
		console.warn = originalWarn

		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('Legacy Logger Wrapper', () => {
		it('should provide drop-in replacement for basic Logger', async () => {
			const logger = new LegacyLoggerWrapper()

			// Should work like old API
			logger.debug('Debug message', { test: true })
			logger.info('Info message', { userId: '123' })
			logger.warn('Warning message', { code: 'WARN001' })
			logger.error('Error message', { error: 'Something failed' })

			// Should emit deprecation warnings
			expect(consoleWarnOutput.length).toBeGreaterThan(0)
			expect(consoleWarnOutput.some((msg) => msg.includes('DEPRECATION WARNING'))).toBe(true)

			// Should be able to access new logger
			const newLogger = logger.getStructuredLogger()
			expect(newLogger).toBeInstanceOf(StructuredLogger)

			await logger.close()
		})

		it('should handle legacy configuration migration', async () => {
			const legacyConfig = {
				level: 'debug' as const,
				structured: true,
				format: 'json' as const,
				enableCorrelationIds: true,
				retentionDays: 30,
				exporterType: 'console' as const,
			}

			const logger = new LegacyLoggerWrapper(legacyConfig)

			// Should work without throwing
			logger.info('Legacy config test', { configured: true })

			// Should emit deprecation warning
			expect(
				consoleWarnOutput.some((msg) => msg.includes('legacy logging interface is deprecated'))
			).toBe(true)

			await logger.close()
		})

		it('should maintain async compatibility through wrapper', async () => {
			const logger = new LegacyLoggerWrapper()

			// Legacy sync calls should work
			logger.info('Sync call 1')
			logger.info('Sync call 2')
			logger.info('Sync call 3')

			// Should be able to flush and close
			await logger.flush()
			await logger.close()

			// Should have logged messages
			expect(consoleOutput.length).toBeGreaterThan(0)
		})
	})

	describe('Legacy Structured Logger Wrapper', () => {
		it('should provide drop-in replacement for StructuredLogger', async () => {
			const baseContext = {
				service: 'legacy-test',
				requestId: 'req-123',
				userId: 'user-456',
			}

			const config = {
				level: 'info' as const,
				enablePerformanceLogging: true,
				enableErrorTracking: true,
				format: 'json' as const,
				outputs: ['console'] as const,
			}

			const logger = new LegacyStructuredLoggerWrapper(config, baseContext)

			// Should work like old structured logger
			logger.debug('Debug with metadata', { step: 1 }, { requestId: 'req-123' })
			logger.info('Info with metadata', { operation: 'test' })
			logger.warn('Warning with metadata', { warning: 'deprecated' })
			logger.error('Error with metadata', new Error('Test error'), { context: 'test' })

			// Should support child logger creation
			const childLogger = logger.child({ childId: 'child-123' })
			childLogger.info('Child logger message')

			// Should support specialized logging methods
			logger.logRequestStart('GET', '/api/test', { requestId: 'req-123' })
			logger.logRequestEnd('GET', '/api/test', 200, { requestId: 'req-123' })
			logger.logDatabaseOperation('SELECT', 'users', 45, { requestId: 'req-123' })
			logger.logAuthEvent('login', 'user-123', { requestId: 'req-123' })
			logger.logSecurityEvent('suspicious_activity', 'medium', { requestId: 'req-123' })
			logger.logPerformanceMetrics('api_call', { duration: 150 }, { requestId: 'req-123' })

			// Should support timing methods (deprecated)
			logger.startTiming()
			const duration = logger.endTiming()
			expect(duration).toBeUndefined() // Should return undefined for deprecated method

			// Should emit deprecation warnings
			expect(consoleWarnOutput.length).toBeGreaterThan(0)
			expect(
				consoleWarnOutput.some((msg) =>
					msg.includes('legacy StructuredLogger interface is deprecated')
				)
			).toBe(true)

			await logger.close()
		})

		it('should handle error scenarios gracefully', async () => {
			const logger = new LegacyStructuredLoggerWrapper()

			// Should handle various error types
			const stringError = 'String error message'
			const errorObject = new Error('Error object')
			const customError = { name: 'CustomError', message: 'Custom error' }

			logger.error('String error test', stringError)
			logger.error('Error object test', errorObject)
			logger.error('Custom error test', customError as any)

			// Should not throw
			await logger.close()
		})
	})

	describe('Legacy Logger Factory', () => {
		it('should provide drop-in replacement for LoggerFactory', async () => {
			// Should support default config setting
			LegacyLoggerFactory.setDefaultConfig({
				level: 'debug',
				format: 'pretty',
				outputs: ['console'],
			})

			// Should create loggers
			const logger = LegacyLoggerFactory.createLogger({ service: 'factory-test' })
			const requestLogger = LegacyLoggerFactory.createRequestLogger('req-123', 'GET', '/api/test', {
				userId: 'user-456',
			})
			const serviceLogger = LegacyLoggerFactory.createServiceLogger('test-service', {
				version: '1.0.0',
			})

			// Should work like old factory
			logger.info('Factory logger test')
			requestLogger.info('Request logger test')
			serviceLogger.info('Service logger test')

			// Should emit deprecation warnings
			expect(consoleWarnOutput.some((msg) => msg.includes('LoggerFactory is deprecated'))).toBe(
				true
			)

			// Cleanup
			await Promise.all([logger.close(), requestLogger.close(), serviceLogger.close()])
		})

		it('should support legacy middleware helper', async () => {
			const requestLogger = createRequestLogger('req-789', 'POST', '/api/users', {
				userId: 'user-789',
			})

			requestLogger.info('Middleware helper test')

			// Should emit deprecation warning
			expect(
				consoleWarnOutput.some((msg) => msg.includes('createRequestLogger function is deprecated'))
			).toBe(true)

			await requestLogger.close()
		})
	})

	describe('Configuration Migration', () => {
		it('should migrate basic legacy configuration', async () => {
			const legacyConfig = {
				level: 'warn' as const,
				structured: true,
				format: 'json' as const,
				enableCorrelationIds: true,
				retentionDays: 60,
				exporterType: 'otlp' as const,
				exporterEndpoint: 'http://localhost:4318/v1/logs',
				exporterHeaders: { 'api-key': 'test-key' },
			}

			const migratedConfig = ConfigMigrator.migrateLegacyConfig(legacyConfig)

			// Should have required fields
			expect(migratedConfig.level).toBe('warn')
			expect(migratedConfig.service).toBeDefined()
			expect(migratedConfig.environment).toBeDefined()
			expect(migratedConfig.outputs).toContain('console')
			expect(migratedConfig.outputs).toContain('otlp')

			// Should have OTLP configuration
			expect(migratedConfig.otlp).toBeDefined()
			expect(migratedConfig.otlp?.endpoint).toBe('http://localhost:4318/v1/logs')
			expect(migratedConfig.otlp?.headers).toEqual({ 'api-key': 'test-key' })

			// Should be able to create logger with migrated config
			const logger = new StructuredLogger({
				...migratedConfig,
				service: 'migration-test',
				environment: 'test',
			})

			await logger.warn('Migration test successful', { migrated: true })
			await logger.close()
		})

		it('should migrate structured logger configuration', async () => {
			const legacyStructuredConfig = {
				level: 'debug' as const,
				enablePerformanceLogging: true,
				enableErrorTracking: true,
				enableMetrics: true,
				format: 'pretty' as const,
				outputs: ['console', 'file', 'redis'] as const,
				fileConfig: {
					path: './logs/migrated.log',
					maxSize: 20 * 1024 * 1024,
					maxFiles: 10,
				},
				redisConfig: {
					key: 'migrated-logs',
					maxEntries: 10000,
					ttl: 86400,
				},
			}

			const migratedConfig = ConfigMigrator.migrateLegacyStructuredConfig(legacyStructuredConfig)

			// Should have all required fields
			expect(migratedConfig.level).toBe('debug')
			expect(migratedConfig.outputs).toEqual(['console', 'file', 'redis'])
			expect(migratedConfig.performance?.enabled).toBe(true)

			// Should have transport configurations
			expect(migratedConfig.console?.format).toBe('pretty')
			expect(migratedConfig.file?.filename).toBe('./logs/migrated.log')
			expect(migratedConfig.file?.maxSize).toBe(20 * 1024 * 1024)
			expect(migratedConfig.redis?.key).toBe('migrated-logs')

			// Should have default batch and retry configurations
			expect(migratedConfig.batch).toBeDefined()
			expect(migratedConfig.retry).toBeDefined()
			expect(migratedConfig.shutdown).toBeDefined()

			// Generate migration report
			const report = ConfigMigrator.generateMigrationReport(legacyStructuredConfig, migratedConfig)
			expect(report).toContain('MIGRATION REPORT')
			expect(report).toContain('CHANGES MADE')
			expect(report).toContain('NEW FEATURES AVAILABLE')
			expect(report).toContain('BREAKING CHANGES')
		})
	})

	describe('Code Migration Utilities', () => {
		it('should detect legacy usage patterns', async () => {
			const legacyCode = `
import { Logger, LoggerFactory, createRequestLogger } from '@repo/logs'

const logger = new Logger()
const serviceLogger = LoggerFactory.createServiceLogger('api')
const requestLogger = createRequestLogger('req-123', 'GET', '/users')

function processRequest(req, res) {
  logger.info('Processing request')
  serviceLogger.debug('Debug info', { step: 1 })
  const childLogger = logger.child({ requestId: req.id })
  childLogger.info('Child logger message')
  
  // Some other operations
  logger.warn('Warning message')
  logger.error('Error occurred')
}
`

			const analysis = LegacyUsageDetector.scanForLegacyPatterns(legacyCode)

			expect(analysis.summary.total).toBeGreaterThan(0)
			expect(analysis.summary.critical).toBeGreaterThan(0)
			expect(analysis.patterns.length).toBeGreaterThan(0)

			// Should detect specific patterns
			const patternTexts = analysis.patterns.map((p) => p.pattern)
			expect(patternTexts.some((p) => p.includes('new Logger('))).toBe(true)
			expect(patternTexts.some((p) => p.includes('LoggerFactory.'))).toBe(true)
			expect(patternTexts.some((p) => p.includes('createRequestLogger('))).toBe(true)
			expect(patternTexts.some((p) => p.includes('.child('))).toBe(true)
		})

		it('should validate migrated code', async () => {
			const migratedCode = `
import { StructuredLogger } from '@repo/logs'

const logger = new StructuredLogger({
  service: 'api-service',
  environment: 'production'
})

async function processRequest(req, res) {
  await logger.info('Processing request')
  await logger.debug('Debug info', { step: 1 })
  const childLogger = logger.withContext({ requestId: req.id })
  await childLogger.info('Child logger message')
  
  try {
    // Some operations
    await logger.warn('Warning message')
    await logger.error('Error occurred')
  } catch (error) {
    console.error('Logging failed:', error)
  }
}
`

			const validation = CodeMigrator.validateMigration(migratedCode)

			expect(validation.isValid).toBe(true)
			expect(validation.issues.length).toBe(0)
		})

		it('should generate migration examples', async () => {
			const examples = CodeMigrator.generateMigrationExamples()

			expect(examples).toContain('CODE MIGRATION EXAMPLES')
			expect(examples).toContain('BASIC LOGGER USAGE')
			expect(examples).toContain('LOGGER FACTORY PATTERN')
			expect(examples).toContain('REQUEST LOGGING')
			expect(examples).toContain('ERROR LOGGING')
			expect(examples).toContain('GRACEFUL SHUTDOWN')
			expect(examples).toContain('MIGRATION CHECKLIST')
			expect(examples).toContain('COMMON PITFALLS')
		})
	})

	describe('Migration Assistant', () => {
		it('should create comprehensive migration plans', async () => {
			const legacyConfig = {
				level: 'info' as const,
				enablePerformanceLogging: true,
				enableErrorTracking: true,
				enableMetrics: false,
				format: 'json' as const,
				outputs: ['console', 'file'] as const,
				fileConfig: {
					path: './logs/app.log',
					maxSize: 50 * 1024 * 1024,
					maxFiles: 7,
				},
			}

			const plan = MigrationAssistant.createMigrationPlan(legacyConfig)

			// Should have all components
			expect(plan.migratedConfig).toBeDefined()
			expect(plan.report).toBeDefined()
			expect(plan.examples).toBeDefined()
			expect(plan.checklist).toBeDefined()

			// Migrated config should be valid
			expect(plan.migratedConfig.service).toBeDefined()
			expect(plan.migratedConfig.environment).toBeDefined()
			expect(plan.migratedConfig.level).toBe('info')
			expect(plan.migratedConfig.outputs).toEqual(['console', 'file'])

			// Report should contain key sections
			expect(plan.report).toContain('MIGRATION REPORT')
			expect(plan.report).toContain('CHANGES MADE')
			expect(plan.report).toContain('NEW FEATURES AVAILABLE')
			expect(plan.report).toContain('RECOMMENDED NEXT STEPS')
			expect(plan.report).toContain('BREAKING CHANGES')

			// Examples should be comprehensive
			expect(plan.examples).toContain('CODE MIGRATION EXAMPLES')
			expect(plan.examples).toContain('OLD (Legacy)')
			expect(plan.examples).toContain('NEW (Structured)')

			// Checklist should have actionable items
			expect(plan.checklist.length).toBeGreaterThan(5)
			expect(plan.checklist.every((item) => typeof item === 'string')).toBe(true)
		})

		it('should generate complete migration guide', async () => {
			const guide = MigrationAssistant.generateMigrationGuide()

			expect(guide).toContain('# Logging System Migration Guide')
			expect(guide).toContain('## Overview')
			expect(guide).toContain('## Key Benefits of Migration')
			expect(guide).toContain('## Migration Steps')
			expect(guide).toContain('### 1. Install Dependencies')
			expect(guide).toContain('### 2. Update Configuration')
			expect(guide).toContain('### 3. Update Code')
			expect(guide).toContain('### 4. Add Error Handling')
			expect(guide).toContain('### 5. Implement Graceful Shutdown')
			expect(guide).toContain('## Backward Compatibility')
			expect(guide).toContain('## Testing Your Migration')
			expect(guide).toContain('## Timeline')
		})
	})

	describe('End-to-End Migration Scenarios', () => {
		it('should support gradual migration with feature flags', async () => {
			// Simulate feature flag approach
			const USE_NEW_LOGGER = true

			let logger: any

			if (USE_NEW_LOGGER) {
				logger = new StructuredLogger({
					service: 'feature-flag-test',
					environment: 'test',
				})
			} else {
				logger = new LegacyLoggerWrapper()
			}

			// Should work with both approaches
			if (USE_NEW_LOGGER) {
				await logger.info('New logger message', { featureFlag: true })
			} else {
				logger.info('Legacy logger message', { featureFlag: false })
			}

			await logger.close()
		})

		it('should handle mixed legacy and new logger usage', async () => {
			// Legacy logger for existing code
			const legacyLogger = new LegacyLoggerWrapper()

			// New logger for new code
			const newLogger = new StructuredLogger({
				service: 'mixed-usage-test',
				environment: 'test',
			})

			// Both should work simultaneously
			legacyLogger.info('Legacy system message')
			await newLogger.info('New system message')

			// Should be able to migrate gradually
			const migratedLogger = legacyLogger.getStructuredLogger()
			await migratedLogger.info('Migrated message')

			// Cleanup
			await Promise.all([legacyLogger.close(), newLogger.close()])
		})

		it('should validate complete migration workflow', async () => {
			// Step 1: Start with legacy configuration
			const legacyConfig = {
				level: 'debug' as const,
				structured: true,
				format: 'json' as const,
				enableCorrelationIds: true,
				retentionDays: 30,
				exporterType: 'console' as const,
			}

			// Step 2: Migrate configuration
			const migratedConfig = ConfigMigrator.migrateLegacyConfig(legacyConfig)

			// Step 3: Create new logger with migrated config
			const logger = new StructuredLogger({
				...migratedConfig,
				service: 'workflow-test',
				environment: 'test',
			})

			// Step 4: Test new functionality
			logger.setCorrelationId('workflow-123')
			logger.setRequestId('req-456')

			await logger.debug('Workflow debug message', { step: 'debug' })
			await logger.info('Workflow info message', { step: 'info' })
			await logger.warn('Workflow warn message', { step: 'warn' })
			await logger.error('Workflow error message', { step: 'error' })

			// Step 5: Test advanced features
			const childLogger = logger.withContext({ childId: 'child-789' })
			await childLogger.info('Child logger message', { advanced: true })

			// Step 6: Graceful shutdown
			await logger.flush()
			await logger.close()

			// Verify logging worked
			expect(consoleOutput.length).toBeGreaterThan(0)
			expect(consoleOutput.some((log) => log.includes('Workflow debug message'))).toBe(true)
			expect(consoleOutput.some((log) => log.includes('workflow-123'))).toBe(true)
		})
	})
})
