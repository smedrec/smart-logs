/**
 * @fileoverview Migration Utilities
 *
 * Provides utilities to help migrate from legacy logging interfaces
 * to the new StructuredLogger implementation.
 */

import { StructuredLogger } from '../core/structured-logger.js'

import type { LoggingConfig } from '../types/config.js'
import type { LegacyLogContext, LegacyLoggerConfig, LegacyLoggingConfig } from './legacy-logger.js'

/**
 * Configuration Migration Utility
 */
export class ConfigMigrator {
	/**
	 * Migrate legacy basic logging config to new format
	 */
	static migrateLegacyConfig(legacyConfig: LegacyLoggingConfig): Partial<LoggingConfig> {
		const migratedConfig: Partial<LoggingConfig> = {
			level: legacyConfig.level,
			service: 'migrated-service', // Default service name
			environment: 'production', // Default environment
		}

		// Map legacy format to new format
		if (legacyConfig.format === 'json') {
			migratedConfig.console = {
				name: 'console',
				enabled: true,
				format: 'json',
				colorize: false,
				level: legacyConfig.level,
			}
		} else {
			migratedConfig.console = {
				name: 'console',
				enabled: true,
				format: 'pretty',
				colorize: true,
				level: legacyConfig.level,
			}
		}

		// Map exporter type to transport configurations
		switch (legacyConfig.exporterType) {
			case 'console':
				// Console already configured above
				break
			case 'otlp':
				if (legacyConfig.exporterEndpoint) {
					migratedConfig.otlp = {
						name: 'otlp',
						enabled: true,
						endpoint: legacyConfig.exporterEndpoint,
						headers: legacyConfig.exporterHeaders || {},
						timeoutMs: 5000,
						batchSize: 100,
						batchTimeoutMs: 5000,
						maxConcurrency: 10,
						circuitBreakerThreshold: 5,
						circuitBreakerResetMs: 60000,
					}
				}
				break
			default:
				// Console already configured above
				break
		}

		return migratedConfig
	}

	/**
	 * Migrate legacy structured logging config to new format
	 */
	static migrateLegacyStructuredConfig(legacyConfig: LegacyLoggerConfig): Partial<LoggingConfig> {
		const migratedConfig: Partial<LoggingConfig> = {
			level: legacyConfig.level,
			service: 'migrated-structured-service',
			environment: 'production',
		}

		// Map transport configurations
		if (legacyConfig.outputs.includes('console')) {
			migratedConfig.console = {
				name: 'console',
				enabled: true,
				format: legacyConfig.format === 'pretty' ? 'pretty' : 'json',
				colorize: legacyConfig.format === 'pretty',
				level: legacyConfig.level,
			}
		}

		if (legacyConfig.outputs.includes('file')) {
			migratedConfig.file = {
				name: 'file',
				enabled: true,
				filename: legacyConfig.fileConfig?.path || './logs/app.log',
				maxSize: legacyConfig.fileConfig?.maxSize || 10 * 1024 * 1024,
				maxFiles: legacyConfig.fileConfig?.maxFiles || 5,
				rotateDaily: false,
				rotationInterval: 'daily',
				compress: false,
				retentionDays: 30,
			}
		}

		if (legacyConfig.outputs.includes('redis')) {
			migratedConfig.redis = {
				name: 'redis',
				enabled: true,
				host: 'localhost',
				port: 6379,
				database: 0,
				keyPrefix: 'logs:',
				listName: legacyConfig.redisConfig?.key || 'application-logs',
				maxRetries: 3,
				connectTimeoutMs: 5000,
				commandTimeoutMs: 3000,
				enableAutoPipelining: true,
				enableOfflineQueue: false,
				dataStructure: 'list',
				enableCluster: false,
				enableTLS: false,
			}
		}

		if (legacyConfig.outputs.includes('otpl')) {
			migratedConfig.otlp = {
				name: 'otlp',
				enabled: true,
				endpoint: legacyConfig.otplConfig?.endpoint || 'http://localhost:4318/v1/logs',
				headers: legacyConfig.otplConfig?.headers || {},
				timeoutMs: 5000,
				batchSize: 100,
				batchTimeoutMs: 5000,
				maxConcurrency: 10,
				circuitBreakerThreshold: 5,
				circuitBreakerResetMs: 60000,
			}
		}

		// Map performance settings
		if (legacyConfig.enablePerformanceLogging) {
			migratedConfig.performance = {
				enabled: true,
				sampleRate: 0.1,
				collectCpuUsage: true,
				collectMemoryUsage: true,
			}
		}

		// Map batch settings (use defaults)
		migratedConfig.batch = {
			maxSize: 100,
			timeoutMs: 5000,
			maxConcurrency: 10,
			maxQueueSize: 10000,
		}

		// Map retry settings (use defaults)
		migratedConfig.retry = {
			maxAttempts: 3,
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			multiplier: 2,
		}

		return migratedConfig
	}

	/**
	 * Generate migration report showing differences
	 */
	static generateMigrationReport(
		legacyConfig: LegacyLoggingConfig | LegacyLoggerConfig,
		migratedConfig: Partial<LoggingConfig>
	): string {
		const report = []
		report.push('=== LOGGING CONFIGURATION MIGRATION REPORT ===\n')

		report.push('CHANGES MADE:')
		report.push('- Converted to new structured configuration format')
		report.push('- Added required service and environment fields')
		report.push('- Migrated output configurations to new transport format')
		report.push('- Added default batch, retry, and shutdown configurations')

		if ('exporterType' in legacyConfig) {
			report.push(`- Converted exporterType "${legacyConfig.exporterType}" to outputs array`)
		}

		if ('outputs' in legacyConfig) {
			report.push(`- Migrated outputs: ${legacyConfig.outputs.join(', ')}`)
		}

		report.push('\nNEW FEATURES AVAILABLE:')
		report.push('- Async logging operations with proper error handling')
		report.push('- Automatic batching and retry mechanisms')
		report.push('- Circuit breaker pattern for transport reliability')
		report.push('- Performance monitoring and sampling')
		report.push('- Graceful shutdown with log flushing')
		report.push('- Enhanced correlation ID management')

		report.push('\nRECOMMENDED NEXT STEPS:')
		report.push('1. Update service and environment names in configuration')
		report.push('2. Review and adjust batch sizes for your use case')
		report.push('3. Configure appropriate retry and timeout settings')
		report.push('4. Enable performance monitoring if needed')
		report.push('5. Update code to use async logging methods')
		report.push('6. Test graceful shutdown behavior')

		report.push('\nBREAKING CHANGES:')
		report.push('- All logging methods are now async and return Promise<void>')
		report.push('- Configuration structure has changed significantly')
		report.push('- Some legacy methods are no longer available')
		report.push('- Error handling is now required for logging operations')

		return report.join('\n')
	}
}

/**
 * Code Migration Helper
 */
export class CodeMigrator {
	/**
	 * Generate migration examples for common patterns
	 */
	static generateMigrationExamples(): string {
		return `
=== CODE MIGRATION EXAMPLES ===

1. BASIC LOGGER USAGE:

   // OLD (Legacy):
   import { Logger } from '@repo/logs'
   const logger = new Logger()
   logger.info('Hello world', { userId: '123' })

   // NEW (Structured):
   import { StructuredLogger } from '@repo/logs'
   const logger = new StructuredLogger({
     service: 'my-service',
     environment: 'production'
   })
   await logger.info('Hello world', { userId: '123' })

2. LOGGER FACTORY PATTERN:

   // OLD (Legacy):
   import { LoggerFactory } from '@repo/logs'
   const logger = LoggerFactory.createLogger({ service: 'api' })
   logger.info('Request processed')

   // NEW (Structured):
   import { StructuredLogger } from '@repo/logs'
   const logger = new StructuredLogger({
     service: 'api',
     environment: 'production'
   })
   await logger.info('Request processed')

3. REQUEST LOGGING:

   // OLD (Legacy):
   import { createRequestLogger } from '@repo/logs'
   const logger = createRequestLogger('req-123', 'GET', '/api/users')
   logger.logRequestStart('GET', '/api/users', { userId: '456' })
   logger.logRequestEnd('GET', '/api/users', 200, { userId: '456' })

   // NEW (Structured):
   import { StructuredLogger } from '@repo/logs'
   const logger = new StructuredLogger({
     service: 'api',
     environment: 'production'
   })
   logger.setRequestId('req-123')
   await logger.info('Request started', {
     method: 'GET',
     path: '/api/users',
     userId: '456'
   })
   await logger.info('Request completed', {
     method: 'GET',
     path: '/api/users',
     statusCode: 200,
     userId: '456'
   })

4. ERROR LOGGING:

   // OLD (Legacy):
   logger.error('Database error', error, { query: 'SELECT * FROM users' })

   // NEW (Structured):
   await logger.error('Database error', {
     error: {
       name: error.name,
       message: error.message,
       stack: error.stack
     },
     query: 'SELECT * FROM users'
   })

5. CHILD LOGGER:

   // OLD (Legacy):
   const childLogger = logger.child({ requestId: 'req-123' })
   childLogger.info('Processing request')

   // NEW (Structured):
   const childLogger = logger.withContext({ requestId: 'req-123' })
   await childLogger.info('Processing request')

6. CONFIGURATION:

   // OLD (Legacy):
   const config = {
     level: 'info',
     format: 'json',
     exporterType: 'otlp',
     exporterEndpoint: 'http://localhost:4318/v1/logs'
   }

   // NEW (Structured):
   const config = {
     level: 'info',
     service: 'my-service',
     environment: 'production',
     outputs: ['console', 'otlp'],
     console: {
       name: 'console',
       enabled: true,
       format: 'json',
       colorize: false,
       timestamp: true,
       level: 'info'
     },
     otlp: {
       name: 'otlp',
       enabled: true,
       endpoint: 'http://localhost:4318/v1/logs',
       headers: {},
       timeoutMs: 5000,
       batchSize: 100,
       batchTimeoutMs: 5000,
       maxConcurrency: 10,
       compression: 'gzip',
       retryAttempts: 3,
       retryBackoffMs: 1000
     }
   }

7. GRACEFUL SHUTDOWN:

   // OLD (Legacy):
   // No built-in shutdown handling

   // NEW (Structured):
   process.on('SIGTERM', async () => {
     await logger.flush()
     await logger.close()
     process.exit(0)
   })

8. ERROR HANDLING:

   // OLD (Legacy):
   logger.info('Message') // Fire and forget

   // NEW (Structured):
   try {
     await logger.info('Message')
   } catch (error) {
     console.error('Failed to log message:', error)
   }

=== MIGRATION CHECKLIST ===

□ Update imports to use new StructuredLogger
□ Add service and environment to configuration
□ Convert synchronous log calls to async/await
□ Add error handling for logging operations
□ Update configuration format
□ Replace LoggerFactory with direct StructuredLogger usage
□ Update child logger creation to use withContext()
□ Add graceful shutdown handling
□ Test all logging scenarios
□ Remove legacy logger dependencies

=== COMMON PITFALLS ===

1. Forgetting to await logging calls
2. Not handling logging errors
3. Using old configuration format
4. Not implementing graceful shutdown
5. Missing service/environment configuration
6. Not updating child logger patterns
7. Forgetting to flush logs on shutdown
`
	}

	/**
	 * Validate migrated code patterns
	 */
	static validateMigration(code: string): { isValid: boolean; issues: string[] } {
		const issues: string[] = []

		// Check for common migration issues
		if (code.includes('new Logger(') && !code.includes('new StructuredLogger(')) {
			issues.push('Found legacy Logger constructor. Use StructuredLogger instead.')
		}

		if (code.includes('LoggerFactory.create') && !code.includes('new StructuredLogger(')) {
			issues.push('Found LoggerFactory usage. Use StructuredLogger constructor instead.')
		}

		if (code.includes('.info(') && !code.includes('await ')) {
			issues.push('Found synchronous logging calls. All logging methods are now async.')
		}

		if (code.includes('createRequestLogger(')) {
			issues.push(
				'Found createRequestLogger function. Use StructuredLogger with setRequestId() instead.'
			)
		}

		if (code.includes('.child(') && !code.includes('.withContext(')) {
			issues.push('Found legacy child() method. Use withContext() instead.')
		}

		if (!code.includes('service:') && code.includes('StructuredLogger')) {
			issues.push('StructuredLogger requires service configuration.')
		}

		if (!code.includes('environment:') && code.includes('StructuredLogger')) {
			issues.push('StructuredLogger requires environment configuration.')
		}

		return {
			isValid: issues.length === 0,
			issues,
		}
	}
}

/**
 * Migration Assistant
 */
export class MigrationAssistant {
	/**
	 * Create a migration plan for a given legacy configuration
	 */
	static createMigrationPlan(legacyConfig: LegacyLoggingConfig | LegacyLoggerConfig): {
		migratedConfig: Partial<LoggingConfig>
		report: string
		examples: string
		checklist: string[]
	} {
		const migratedConfig =
			'exporterType' in legacyConfig
				? ConfigMigrator.migrateLegacyConfig(legacyConfig)
				: ConfigMigrator.migrateLegacyStructuredConfig(legacyConfig)

		const report = ConfigMigrator.generateMigrationReport(legacyConfig, migratedConfig)
		const examples = CodeMigrator.generateMigrationExamples()

		const checklist = [
			'Review migrated configuration',
			'Update service and environment names',
			'Convert synchronous logging calls to async',
			'Add error handling for logging operations',
			'Update logger instantiation',
			'Replace LoggerFactory usage',
			'Update child logger patterns',
			'Add graceful shutdown handling',
			'Test logging functionality',
			'Remove legacy dependencies',
		]

		return {
			migratedConfig,
			report,
			examples,
			checklist,
		}
	}

	/**
	 * Generate a complete migration guide
	 */
	static generateMigrationGuide(): string {
		return `
# Logging System Migration Guide

## Overview

This guide helps you migrate from the legacy logging system to the new StructuredLogger implementation.

## Key Benefits of Migration

- **Async Operations**: Proper async handling prevents blocking and unhandled rejections
- **Type Safety**: Full TypeScript support with strict typing
- **Reliability**: Built-in retry mechanisms and circuit breakers
- **Performance**: Batching, compression, and performance monitoring
- **Observability**: Enhanced correlation tracking and structured metadata
- **Production Ready**: Graceful shutdown, resource management, and error handling

## Migration Steps

### 1. Install Dependencies

Ensure you have the latest version of the logs package:

\`\`\`bash
npm install @repo/logs@latest
\`\`\`

### 2. Update Configuration

Use the ConfigMigrator utility to convert your existing configuration:

\`\`\`typescript
import { ConfigMigrator } from '@repo/logs/compatibility'

const legacyConfig = {
  level: 'info',
  format: 'json',
  exporterType: 'otlp',
  exporterEndpoint: 'http://localhost:4318/v1/logs'
}

const newConfig = ConfigMigrator.migrateLegacyConfig(legacyConfig)
\`\`\`

### 3. Update Code

Replace legacy logger usage with StructuredLogger:

\`\`\`typescript
// Before
import { Logger } from '@repo/logs'
const logger = new Logger()
logger.info('Hello world')

// After
import { StructuredLogger } from '@repo/logs'
const logger = new StructuredLogger({
  service: 'my-service',
  environment: 'production'
})
await logger.info('Hello world')
\`\`\`

### 4. Add Error Handling

All logging operations now return promises:

\`\`\`typescript
try {
  await logger.info('Important message', { userId: '123' })
} catch (error) {
  console.error('Failed to log message:', error)
}
\`\`\`

### 5. Implement Graceful Shutdown

Add proper shutdown handling:

\`\`\`typescript
process.on('SIGTERM', async () => {
  await logger.flush()
  await logger.close()
  process.exit(0)
})
\`\`\`

## Backward Compatibility

If you need to maintain backward compatibility during migration, use the legacy wrappers:

\`\`\`typescript
import { LegacyLoggerWrapper } from '@repo/logs/compatibility'

// Drop-in replacement for legacy Logger
const logger = new LegacyLoggerWrapper()
logger.info('This works like the old API') // Emits deprecation warnings
\`\`\`

## Testing Your Migration

1. Run the migration validator:

\`\`\`typescript
import { CodeMigrator } from '@repo/logs/compatibility'

const validation = CodeMigrator.validateMigration(yourCode)
if (!validation.isValid) {
  console.log('Issues found:', validation.issues)
}
\`\`\`

2. Test logging functionality thoroughly
3. Verify graceful shutdown behavior
4. Check performance under load

## Getting Help

- Review the migration examples in this guide
- Use the migration utilities for automated conversion
- Check the new API documentation
- Test incrementally with the compatibility layer

## Timeline

1. **Week 1**: Update configuration and test with compatibility layer
2. **Week 2**: Convert core logging calls to async
3. **Week 3**: Add error handling and graceful shutdown
4. **Week 4**: Remove compatibility layer and legacy dependencies

Remember: The compatibility layer is temporary and will be removed in a future version.
`
	}
}

/**
 * Utility to help identify legacy usage in codebases
 */
export class LegacyUsageDetector {
	/**
	 * Scan code for legacy logging patterns
	 */
	static scanForLegacyPatterns(code: string): {
		patterns: Array<{ pattern: string; line: number; suggestion: string }>
		summary: { total: number; critical: number; warnings: number }
	} {
		const lines = code.split('\n')
		const patterns: Array<{ pattern: string; line: number; suggestion: string }> = []

		lines.forEach((line, index) => {
			const lineNumber = index + 1

			// Check for legacy imports
			if (line.includes("from '@repo/logs'") && !line.includes('StructuredLogger')) {
				patterns.push({
					pattern: line.trim(),
					line: lineNumber,
					suggestion: "Update import to use StructuredLogger from '@repo/logs'",
				})
			}

			// Check for legacy Logger constructor
			if (line.includes('new Logger(')) {
				patterns.push({
					pattern: line.trim(),
					line: lineNumber,
					suggestion: 'Replace with new StructuredLogger({ service: "...", environment: "..." })',
				})
			}

			// Check for LoggerFactory usage
			if (line.includes('LoggerFactory.')) {
				patterns.push({
					pattern: line.trim(),
					line: lineNumber,
					suggestion: 'Replace LoggerFactory with direct StructuredLogger instantiation',
				})
			}

			// Check for synchronous logging calls
			if (/\.(info|debug|warn|error)\s*\(/.test(line) && !line.includes('await')) {
				patterns.push({
					pattern: line.trim(),
					line: lineNumber,
					suggestion: 'Add await before logging call and handle potential errors',
				})
			}

			// Check for legacy child logger
			if (line.includes('.child(')) {
				patterns.push({
					pattern: line.trim(),
					line: lineNumber,
					suggestion: 'Replace .child() with .withContext()',
				})
			}

			// Check for createRequestLogger
			if (line.includes('createRequestLogger(')) {
				patterns.push({
					pattern: line.trim(),
					line: lineNumber,
					suggestion: 'Use StructuredLogger with setRequestId() instead',
				})
			}
		})

		const critical = patterns.filter(
			(p) => p.suggestion.includes('StructuredLogger') || p.suggestion.includes('await')
		).length

		const warnings = patterns.length - critical

		return {
			patterns,
			summary: {
				total: patterns.length,
				critical,
				warnings,
			},
		}
	}
}
