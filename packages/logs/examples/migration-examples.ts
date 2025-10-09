/**
 * @fileoverview Migration Examples
 *
 * Comprehensive examples showing how to migrate from legacy logging
 * interfaces to the new StructuredLogger implementation.
 */

import {
	LegacyLoggerFactory,
	LegacyLoggerWrapper,
	LegacyStructuredLoggerWrapper,
} from '../src/compatibility/legacy-logger.js'
import {
	CodeMigrator,
	ConfigMigrator,
	LegacyUsageDetector,
	MigrationAssistant,
} from '../src/compatibility/migration-utils.js'
import { StructuredLogger } from '../src/core/structured-logger.js'

// ============================================================================
// EXAMPLE 1: Basic Logger Migration
// ============================================================================

async function basicLoggerMigration() {
	console.log('=== Basic Logger Migration Example ===\n')

	// OLD WAY (Legacy)
	console.log('OLD WAY:')
	console.log(`
import { Logger } from '@repo/logs'

const logger = new Logger()
logger.info('Hello world', { userId: '123' })
logger.error('Something went wrong', { error: 'Database connection failed' })
`)

	// NEW WAY (Structured)
	console.log('NEW WAY:')
	const logger = new StructuredLogger({
		service: 'example-service',
		environment: 'development',
	})

	try {
		await logger.info('Hello world', { userId: '123' })
		await logger.error('Something went wrong', {
			error: 'Database connection failed',
			timestamp: new Date().toISOString(),
		})
		console.log('✅ New logging calls completed successfully')
	} catch (error) {
		console.error('❌ Logging failed:', error)
	}

	await logger.close()
}

// ============================================================================
// EXAMPLE 2: Configuration Migration
// ============================================================================

async function configurationMigration() {
	console.log('\n=== Configuration Migration Example ===\n')

	// Legacy configuration
	const legacyConfig = {
		level: 'info' as const,
		structured: true,
		format: 'json' as const,
		enableCorrelationIds: true,
		retentionDays: 30,
		exporterType: 'otlp' as const,
		exporterEndpoint: 'http://localhost:4318/v1/logs',
		exporterHeaders: { 'api-key': 'secret-key' },
	}

	console.log('Legacy Configuration:')
	console.log(JSON.stringify(legacyConfig, null, 2))

	// Migrate configuration
	const migratedConfig = ConfigMigrator.migrateLegacyConfig(legacyConfig)

	console.log('\nMigrated Configuration:')
	console.log(JSON.stringify(migratedConfig, null, 2))

	// Create logger with migrated config
	const logger = new StructuredLogger({
		...migratedConfig,
		service: 'config-example',
		environment: 'development',
	})

	await logger.info('Configuration migration example', {
		migrated: true,
		originalFormat: legacyConfig.format,
	})

	await logger.close()
}

// ============================================================================
// EXAMPLE 3: Logger Factory Migration
// ============================================================================

async function loggerFactoryMigration() {
	console.log('\n=== Logger Factory Migration Example ===\n')

	console.log('OLD WAY (LoggerFactory):')
	console.log(`
import { LoggerFactory } from '@repo/logs'

LoggerFactory.setDefaultConfig({ level: 'debug' })
const logger = LoggerFactory.createLogger({ service: 'api' })
const requestLogger = LoggerFactory.createRequestLogger('req-123', 'GET', '/users')
`)

	console.log('NEW WAY (Direct StructuredLogger):')

	// Create base logger
	const baseLogger = new StructuredLogger({
		service: 'api',
		environment: 'development',
		level: 'debug',
	})

	// Create request-specific logger
	const requestLogger = baseLogger.withContext({ requestId: 'req-123' })
	requestLogger.setRequestId('req-123')

	try {
		await baseLogger.info('Service started', { service: 'api' })
		await requestLogger.info('Processing request', {
			method: 'GET',
			path: '/users',
		})
		console.log('✅ Factory migration example completed')
	} catch (error) {
		console.error('❌ Factory migration failed:', error)
	}

	await Promise.all([baseLogger.close(), requestLogger.close()])
}

// ============================================================================
// EXAMPLE 4: Request Logging Migration
// ============================================================================

async function requestLoggingMigration() {
	console.log('\n=== Request Logging Migration Example ===\n')

	console.log('OLD WAY (Specialized methods):')
	console.log(`
const logger = createRequestLogger('req-123', 'GET', '/api/users')
logger.logRequestStart('GET', '/api/users', { userId: '456' })
// ... process request ...
logger.logRequestEnd('GET', '/api/users', 200, { userId: '456' })
`)

	console.log('NEW WAY (Structured logging):')

	const logger = new StructuredLogger({
		service: 'api-server',
		environment: 'development',
	})

	logger.setRequestId('req-123')
	logger.setCorrelationId('corr-456')

	try {
		// Request start
		await logger.info('Request started', {
			request: {
				method: 'GET',
				path: '/api/users',
				timestamp: new Date().toISOString(),
				userId: '456',
			},
		})

		// Simulate request processing
		await new Promise((resolve) => setTimeout(resolve, 100))

		// Request end
		await logger.info('Request completed', {
			request: {
				method: 'GET',
				path: '/api/users',
				statusCode: 200,
				duration: 100,
				timestamp: new Date().toISOString(),
				userId: '456',
			},
		})

		console.log('✅ Request logging migration completed')
	} catch (error) {
		console.error('❌ Request logging migration failed:', error)
	}

	await logger.close()
}

// ============================================================================
// EXAMPLE 5: Error Handling Migration
// ============================================================================

async function errorHandlingMigration() {
	console.log('\n=== Error Handling Migration Example ===\n')

	console.log('OLD WAY (Fire and forget):')
	console.log(`
logger.info('Processing data') // No error handling
logger.error('Failed to process', error) // Might cause unhandled rejection
`)

	console.log('NEW WAY (Proper async handling):')

	const logger = new StructuredLogger({
		service: 'data-processor',
		environment: 'development',
	})

	// Simulate an error
	const simulatedError = new Error('Database connection timeout')
	simulatedError.name = 'ConnectionError'
	;(simulatedError as any).code = 'ETIMEDOUT'

	try {
		// Proper error handling for logging operations
		await logger.info('Processing data', {
			operation: 'data-processing',
			timestamp: new Date().toISOString(),
		})

		// Simulate processing error
		throw simulatedError
	} catch (processingError) {
		try {
			// Log the error with proper structure
			await logger.error('Failed to process data', {
				error: {
					name: processingError.name,
					message: processingError.message,
					stack: processingError.stack,
					code: (processingError as any).code,
				},
				operation: 'data-processing',
				timestamp: new Date().toISOString(),
			})
			console.log('✅ Error logged successfully')
		} catch (loggingError) {
			console.error('❌ Failed to log error:', loggingError)
		}
	}

	await logger.close()
}

// ============================================================================
// EXAMPLE 6: Backward Compatibility Usage
// ============================================================================

async function backwardCompatibilityExample() {
	console.log('\n=== Backward Compatibility Example ===\n')

	console.log('Using legacy wrapper for gradual migration:')

	// Use legacy wrapper during transition
	const legacyLogger = new LegacyLoggerWrapper()

	// This works like the old API but emits deprecation warnings
	legacyLogger.info('Legacy API call', { transitioning: true })
	legacyLogger.warn('This emits deprecation warnings')

	// Access new logger for migration
	const newLogger = legacyLogger.getStructuredLogger()

	try {
		await newLogger.info('Using new API through wrapper', {
			migration: 'in-progress',
		})
		console.log('✅ Backward compatibility example completed')
	} catch (error) {
		console.error('❌ Backward compatibility failed:', error)
	}

	// Cleanup
	await legacyLogger.close()
}

// ============================================================================
// EXAMPLE 7: Migration Utilities Usage
// ============================================================================

async function migrationUtilitiesExample() {
	console.log('\n=== Migration Utilities Example ===\n')

	// Example legacy code to analyze
	const legacyCode = `
import { Logger, LoggerFactory } from '@repo/logs'

const logger = new Logger()
const serviceLogger = LoggerFactory.createServiceLogger('api')

function processRequest(req, res) {
  logger.info('Processing request')
  serviceLogger.debug('Debug info')
  const childLogger = logger.child({ requestId: req.id })
  childLogger.info('Child logger message')
}
`

	console.log('Analyzing legacy code patterns:')
	const analysis = LegacyUsageDetector.scanForLegacyPatterns(legacyCode)

	console.log(`\nFound ${analysis.summary.total} legacy patterns:`)
	console.log(`- Critical issues: ${analysis.summary.critical}`)
	console.log(`- Warnings: ${analysis.summary.warnings}`)

	console.log('\nDetailed analysis:')
	analysis.patterns.forEach((pattern, index) => {
		console.log(`${index + 1}. Line ${pattern.line}: ${pattern.pattern}`)
		console.log(`   Suggestion: ${pattern.suggestion}`)
	})

	// Validate migration
	const migratedCode = `
import { StructuredLogger } from '@repo/logs'

const logger = new StructuredLogger({ service: 'api', environment: 'production' })

async function processRequest(req, res) {
  await logger.info('Processing request')
  await logger.debug('Debug info')
  const childLogger = logger.withContext({ requestId: req.id })
  await childLogger.info('Child logger message')
}
`

	console.log('\nValidating migrated code:')
	const validation = CodeMigrator.validateMigration(migratedCode)

	if (validation.isValid) {
		console.log('✅ Migration validation passed!')
	} else {
		console.log('❌ Migration issues found:')
		validation.issues.forEach((issue) => console.log(`- ${issue}`))
	}
}

// ============================================================================
// EXAMPLE 8: Complete Migration Plan
// ============================================================================

async function completeMigrationPlan() {
	console.log('\n=== Complete Migration Plan Example ===\n')

	const legacyConfig = {
		level: 'info' as const,
		enablePerformanceLogging: true,
		enableErrorTracking: true,
		enableMetrics: true,
		format: 'json' as const,
		outputs: ['console', 'file', 'otpl'] as const,
		fileConfig: {
			path: './logs/app.log',
			maxSize: 10 * 1024 * 1024,
			maxFiles: 5,
		},
		otplConfig: {
			endpoint: 'http://localhost:4318/v1/logs',
			headers: { authorization: 'Bearer token123' },
		},
	}

	console.log('Generating complete migration plan...')
	const plan = MigrationAssistant.createMigrationPlan(legacyConfig)

	console.log('\n📋 MIGRATION CHECKLIST:')
	plan.checklist.forEach((item, index) => {
		console.log(`${index + 1}. [ ] ${item}`)
	})

	console.log('\n⚙️ MIGRATED CONFIGURATION:')
	console.log(JSON.stringify(plan.migratedConfig, null, 2))

	console.log('\n📊 MIGRATION REPORT:')
	console.log(plan.report)

	// Test the migrated configuration
	const logger = new StructuredLogger({
		...plan.migratedConfig,
		service: 'migration-example',
		environment: 'development',
	})

	try {
		await logger.info('Migration plan executed', {
			planGenerated: true,
			timestamp: new Date().toISOString(),
		})
		console.log('✅ Migration plan example completed')
	} catch (error) {
		console.error('❌ Migration plan failed:', error)
	}

	await logger.close()
}

// ============================================================================
// EXAMPLE 9: Graceful Shutdown Implementation
// ============================================================================

async function gracefulShutdownExample() {
	console.log('\n=== Graceful Shutdown Example ===\n')

	const logger = new StructuredLogger({
		service: 'shutdown-example',
		environment: 'development',
	})

	console.log('Setting up graceful shutdown handlers...')

	// Graceful shutdown implementation
	const shutdown = async (signal: string) => {
		console.log(`\nReceived ${signal}, shutting down gracefully...`)

		try {
			await logger.info('Shutdown initiated', { signal })

			// Flush all pending logs
			console.log('Flushing pending logs...')
			await logger.flush()

			// Close logger and cleanup resources
			console.log('Closing logger...')
			await logger.close()

			console.log('✅ Graceful shutdown completed')

			// In a real application, you would call process.exit(0) here
			// process.exit(0)
		} catch (error) {
			console.error('❌ Error during shutdown:', error)
			// process.exit(1)
		}
	}

	// Simulate some logging activity
	try {
		await logger.info('Application started', { pid: process.pid })
		await logger.info('Processing some work...', { work: 'example' })

		// Simulate shutdown signal
		console.log('Simulating SIGTERM signal...')
		await shutdown('SIGTERM')
	} catch (error) {
		console.error('❌ Shutdown example failed:', error)
	}
}

// ============================================================================
// EXAMPLE 10: Performance Comparison
// ============================================================================

async function performanceComparison() {
	console.log('\n=== Performance Comparison Example ===\n')

	const iterations = 100

	// Legacy logger (simulated)
	console.log('Testing legacy logger performance (simulated)...')
	const legacyStart = Date.now()

	// Simulate legacy synchronous logging
	for (let i = 0; i < iterations; i++) {
		// Simulated legacy call (would be: logger.info(`Message ${i}`))
		console.log(`Legacy log ${i}`) // This would go to actual logger
	}

	const legacyEnd = Date.now()
	const legacyDuration = legacyEnd - legacyStart

	// New structured logger
	console.log('Testing new structured logger performance...')
	const logger = new StructuredLogger({
		service: 'performance-test',
		environment: 'development',
	})

	const newStart = Date.now()

	const promises = []
	for (let i = 0; i < iterations; i++) {
		promises.push(logger.info(`Message ${i}`, { iteration: i }))
	}

	await Promise.all(promises)
	await logger.flush()

	const newEnd = Date.now()
	const newDuration = newEnd - newStart

	console.log('\n📊 PERFORMANCE RESULTS:')
	console.log(`Legacy (simulated): ${legacyDuration}ms for ${iterations} logs`)
	console.log(`New structured: ${newDuration}ms for ${iterations} logs`)
	console.log(`Difference: ${newDuration - legacyDuration}ms`)

	if (newDuration < legacyDuration * 2) {
		console.log('✅ New logger performance is acceptable')
	} else {
		console.log('⚠️ New logger is slower (expected due to async operations)')
	}

	await logger.close()
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runAllExamples() {
	console.log('🚀 Running Migration Examples\n')
	console.log('='.repeat(80))

	try {
		await basicLoggerMigration()
		await configurationMigration()
		await loggerFactoryMigration()
		await requestLoggingMigration()
		await errorHandlingMigration()
		await backwardCompatibilityExample()
		await migrationUtilitiesExample()
		await completeMigrationPlan()
		await gracefulShutdownExample()
		await performanceComparison()

		console.log('\n' + '='.repeat(80))
		console.log('✅ All migration examples completed successfully!')
		console.log('\n📚 Next steps:')
		console.log('1. Review the MIGRATION.md guide')
		console.log('2. Use migration utilities for your codebase')
		console.log('3. Test thoroughly before removing legacy code')
		console.log('4. Monitor performance after migration')
	} catch (error) {
		console.error('\n❌ Migration examples failed:', error)
		process.exit(1)
	}
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runAllExamples().catch(console.error)
}

export {
	basicLoggerMigration,
	configurationMigration,
	loggerFactoryMigration,
	requestLoggingMigration,
	errorHandlingMigration,
	backwardCompatibilityExample,
	migrationUtilitiesExample,
	completeMigrationPlan,
	gracefulShutdownExample,
	performanceComparison,
	runAllExamples,
}
