# Logging System Migration Guide

## Overview

This guide provides comprehensive instructions for migrating from the legacy logging system to the new StructuredLogger implementation. The new system offers improved reliability, performance, and observability while maintaining backward compatibility during the transition period.

## Why Migrate?

### Key Benefits

- **Async Operations**: Proper async handling prevents blocking and unhandled promise rejections
- **Type Safety**: Full TypeScript support with strict typing and runtime validation
- **Reliability**: Built-in retry mechanisms, circuit breakers, and graceful error handling
- **Performance**: Automatic batching, compression, and performance monitoring
- **Observability**: Enhanced correlation tracking, structured metadata, and OTLP integration
- **Production Ready**: Graceful shutdown, resource management, and comprehensive error handling

### Issues with Legacy System

- Synchronous operations that can block the event loop
- Inconsistent error handling leading to unhandled promise rejections
- Limited type safety with `any` types in public APIs
- Missing production features like batching and retry logic
- Incomplete OTLP implementation with naming inconsistencies

## Migration Timeline

### Phase 1: Preparation (Week 1)

- [ ] Install latest version of logs package
- [ ] Review current logging usage with detection tools
- [ ] Update configuration using migration utilities
- [ ] Test with backward compatibility layer

### Phase 2: Core Migration (Week 2-3)

- [ ] Convert logger instantiation to StructuredLogger
- [ ] Update logging calls to async/await pattern
- [ ] Add proper error handling for logging operations
- [ ] Replace LoggerFactory usage

### Phase 3: Advanced Features (Week 4)

- [ ] Implement graceful shutdown handling
- [ ] Add performance monitoring if needed
- [ ] Configure advanced transport options
- [ ] Remove compatibility layer

### Phase 4: Cleanup (Week 5)

- [ ] Remove legacy dependencies
- [ ] Update documentation and examples
- [ ] Validate migration completeness
- [ ] Performance testing and optimization

## Step-by-Step Migration

### 1. Install Dependencies

Update to the latest version:

```bash
npm install @repo/logs@latest
```

### 2. Detect Legacy Usage

Use the detection utility to identify legacy patterns:

```typescript
import { readFileSync } from 'fs'

import { LegacyUsageDetector } from '@repo/logs/compatibility'

const code = readFileSync('src/services/my-service.ts', 'utf8')
const analysis = LegacyUsageDetector.scanForLegacyPatterns(code)

console.log(`Found ${analysis.summary.total} legacy patterns`)
console.log(`Critical issues: ${analysis.summary.critical}`)
console.log(`Warnings: ${analysis.summary.warnings}`)

analysis.patterns.forEach((pattern) => {
	console.log(`Line ${pattern.line}: ${pattern.pattern}`)
	console.log(`  Suggestion: ${pattern.suggestion}`)
})
```

### 3. Migrate Configuration

#### Legacy Basic Configuration

```typescript
// OLD
const legacyConfig = {
  level: 'info',
  structured: true,
  format: 'json',
  enableCorrelationIds: true,
  retentionDays: 30,
  exporterType: 'otlp',
  exporterEndpoint: 'http://localhost:4318/v1/logs',
  exporterHeaders: { 'api-key': 'secret' }
}

// NEW
import { ConfigMigrator } from '@repo/logs/compatibility'

const newConfig = ConfigMigrator.migrateLegacyConfig(legacyConfig)
// Results in:
{
  level: 'info',
  service: 'migrated-service', // Update this!
  environment: 'production',   // Update this!
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
    headers: { 'api-key': 'secret' },
    timeoutMs: 5000,
    batchSize: 100,
    batchTimeoutMs: 5000,
    maxConcurrency: 10,
    compression: 'gzip',
    retryAttempts: 3,
    retryBackoffMs: 1000
  }
}
```

#### Legacy Structured Configuration

```typescript
// OLD
const legacyStructuredConfig = {
	level: 'info',
	enablePerformanceLogging: true,
	enableErrorTracking: true,
	enableMetrics: true,
	format: 'json',
	outputs: ['console', 'file', 'otpl'],
	fileConfig: {
		path: './logs/app.log',
		maxSize: 10 * 1024 * 1024,
		maxFiles: 5,
	},
	otplConfig: {
		endpoint: 'http://localhost:4318/v1/logs',
		headers: { authorization: 'Bearer token' },
	},
}

// NEW
const newStructuredConfig = ConfigMigrator.migrateLegacyStructuredConfig(legacyStructuredConfig)
```

### 4. Update Logger Instantiation

#### Basic Logger

```typescript
// OLD
import { Logger } from '@repo/logs'

const logger = new Logger()
logger.info('Hello world', { userId: '123' })

// NEW
import { StructuredLogger } from '@repo/logs'

const logger = new StructuredLogger({
	service: 'my-service', // Required: your service name
	environment: 'production', // Required: development, staging, production
})

try {
	await logger.info('Hello world', { userId: '123' })
} catch (error) {
	console.error('Failed to log message:', error)
}
```

#### Logger Factory Pattern

```typescript
// OLD
import { LoggerFactory } from '@repo/logs'

LoggerFactory.setDefaultConfig({ level: 'debug' })
const logger = LoggerFactory.createLogger({ service: 'api' })
const requestLogger = LoggerFactory.createRequestLogger('req-123', 'GET', '/users')

// NEW
import { StructuredLogger } from '@repo/logs'

// Create base logger with configuration
const logger = new StructuredLogger({
	service: 'api',
	environment: 'production',
	level: 'debug',
})

// Create request-specific logger
const requestLogger = logger.withContext({ requestId: 'req-123' })
requestLogger.setRequestId('req-123')
```

#### Structured Logger

```typescript
// OLD
import { StructuredLogger } from '@repo/logs'

const logger = new StructuredLogger(
	{
		level: 'info',
		format: 'json',
		outputs: ['console'],
	},
	{ service: 'api' }
)

const childLogger = logger.child({ requestId: 'req-123' })

// NEW
import { StructuredLogger } from '@repo/logs'

const logger = new StructuredLogger({
	service: 'api',
	environment: 'production',
	level: 'info',
	outputs: ['console'],
	console: {
		name: 'console',
		enabled: true,
		format: 'json',
		colorize: false,
		timestamp: true,
		level: 'info',
	},
})

const childLogger = logger.withContext({ requestId: 'req-123' })
```

### 5. Update Logging Calls

#### Basic Logging

```typescript
// OLD
logger.debug('Debug message', { step: 1 })
logger.info('Info message', { userId: '123' })
logger.warn('Warning message', { code: 'WARN001' })
logger.error('Error message', error, { operation: 'database' })

// NEW
try {
	await logger.debug('Debug message', { step: 1 })
	await logger.info('Info message', { userId: '123' })
	await logger.warn('Warning message', { code: 'WARN001' })
	await logger.error('Error message', {
		error: {
			name: error.name,
			message: error.message,
			stack: error.stack,
		},
		operation: 'database',
	})
} catch (logError) {
	console.error('Logging failed:', logError)
}
```

#### Request Logging

```typescript
// OLD
const requestLogger = createRequestLogger('req-123', 'GET', '/api/users')
requestLogger.logRequestStart('GET', '/api/users', { userId: '456' })
// ... process request ...
requestLogger.logRequestEnd('GET', '/api/users', 200, { userId: '456' })

// NEW
const logger = new StructuredLogger({
	service: 'api',
	environment: 'production',
})

logger.setRequestId('req-123')

try {
	await logger.info('Request started', {
		method: 'GET',
		path: '/api/users',
		userId: '456',
	})

	// ... process request ...

	await logger.info('Request completed', {
		method: 'GET',
		path: '/api/users',
		statusCode: 200,
		userId: '456',
		duration: 150, // ms
	})
} catch (error) {
	console.error('Request logging failed:', error)
}
```

#### Specialized Logging

```typescript
// OLD
logger.logDatabaseOperation('SELECT', 'users', 45, context, { query: 'SELECT * FROM users' })
logger.logAuthEvent('login', 'user-123', context, { method: 'oauth' })
logger.logSecurityEvent('suspicious_activity', 'high', context, { ip: '1.2.3.4' })
logger.logPerformanceMetrics('api_call', { duration: 150, memory: 50 }, context)

// NEW
try {
	await logger.info('Database operation', {
		database: {
			operation: 'SELECT',
			table: 'users',
			duration: 45,
			query: 'SELECT * FROM users',
		},
	})

	await logger.info('Authentication event', {
		auth: {
			event: 'login',
			userId: 'user-123',
			method: 'oauth',
		},
	})

	await logger.warn('Security event', {
		security: {
			event: 'suspicious_activity',
			severity: 'high',
			ip: '1.2.3.4',
		},
	})

	await logger.info('Performance metrics', {
		performance: {
			operation: 'api_call',
			duration: 150,
			memory: 50,
		},
	})
} catch (error) {
	console.error('Specialized logging failed:', error)
}
```

### 6. Add Graceful Shutdown

```typescript
// NEW - Add to your application startup
const logger = new StructuredLogger({
	service: 'my-service',
	environment: 'production',
})

// Graceful shutdown handling
const shutdown = async (signal: string) => {
	console.log(`Received ${signal}, shutting down gracefully...`)

	try {
		// Flush all pending logs
		await logger.flush()

		// Close logger and cleanup resources
		await logger.close()

		console.log('Graceful shutdown completed')
		process.exit(0)
	} catch (error) {
		console.error('Error during shutdown:', error)
		process.exit(1)
	}
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Also handle uncaught exceptions
process.on('uncaughtException', async (error) => {
	console.error('Uncaught exception:', error)
	try {
		await logger.error('Uncaught exception', {
			error: {
				name: error.name,
				message: error.message,
				stack: error.stack,
			},
		})
		await logger.flush()
	} catch (logError) {
		console.error('Failed to log uncaught exception:', logError)
	}
	process.exit(1)
})
```

### 7. Backward Compatibility (Temporary)

If you need to maintain compatibility during migration:

```typescript
// Use legacy wrapper for gradual migration
import { LegacyLoggerWrapper, LegacyStructuredLoggerWrapper } from '@repo/logs/compatibility'

// Drop-in replacement for basic Logger
const logger = new LegacyLoggerWrapper()
logger.info('This works like the old API') // Emits deprecation warnings

// Drop-in replacement for StructuredLogger
const structuredLogger = new LegacyStructuredLoggerWrapper()
structuredLogger.info('Legacy structured logging') // Emits deprecation warnings

// Access new logger for migration
const newLogger = structuredLogger.getStructuredLogger()
await newLogger.info('Using new API')
```

## Migration Utilities

### Generate Migration Plan

```typescript
import { MigrationAssistant } from '@repo/logs/compatibility'

const legacyConfig = {
	level: 'info',
	format: 'json',
	exporterType: 'otlp',
	exporterEndpoint: 'http://localhost:4318/v1/logs',
}

const plan = MigrationAssistant.createMigrationPlan(legacyConfig)

console.log('Migrated Configuration:')
console.log(JSON.stringify(plan.migratedConfig, null, 2))

console.log('\nMigration Report:')
console.log(plan.report)

console.log('\nCode Examples:')
console.log(plan.examples)

console.log('\nChecklist:')
plan.checklist.forEach((item, index) => {
	console.log(`${index + 1}. ${item}`)
})
```

### Validate Migration

```typescript
import { CodeMigrator } from '@repo/logs/compatibility'

const yourCode = `
const logger = new Logger()
logger.info('Hello world')
`

const validation = CodeMigrator.validateMigration(yourCode)

if (!validation.isValid) {
	console.log('Migration issues found:')
	validation.issues.forEach((issue) => {
		console.log(`- ${issue}`)
	})
} else {
	console.log('Migration validation passed!')
}
```

## Testing Your Migration

### 1. Unit Tests

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { StructuredLogger } from '@repo/logs'

describe('Migrated Logging', () => {
	let logger: StructuredLogger

	beforeEach(() => {
		logger = new StructuredLogger({
			service: 'test-service',
			environment: 'test',
		})
	})

	afterEach(async () => {
		await logger.close()
	})

	it('should log messages asynchronously', async () => {
		// Test that logging operations complete successfully
		await expect(logger.info('Test message', { test: true })).resolves.toBeUndefined()
	})

	it('should handle logging errors gracefully', async () => {
		// Test error handling
		const invalidLogger = new StructuredLogger({
			service: 'test',
			environment: 'test',
			outputs: ['invalid-transport' as any],
		})

		await expect(invalidLogger.info('Test')).rejects.toThrow()
		await invalidLogger.close()
	})

	it('should support correlation tracking', async () => {
		logger.setCorrelationId('test-correlation-123')
		logger.setRequestId('test-request-456')

		// Verify correlation IDs are included in logs
		await logger.info('Correlated message', { data: 'test' })
	})
})
```

### 2. Integration Tests

```typescript
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { StructuredLogger } from '@repo/logs'

describe('Logging Integration', () => {
	let logger: StructuredLogger
	let tempDir: string
	let logFile: string

	beforeEach(async () => {
		tempDir = join(tmpdir(), `logs-test-${Date.now()}`)
		await fs.mkdir(tempDir, { recursive: true })
		logFile = join(tempDir, 'test.log')

		logger = new StructuredLogger({
			service: 'integration-test',
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
	})

	afterEach(async () => {
		await logger.close()
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	it('should write logs to file', async () => {
		await logger.info('Integration test message', { test: 'file-output' })
		await logger.flush()

		const content = await fs.readFile(logFile, 'utf8')
		expect(content).toContain('Integration test message')
		expect(content).toContain('file-output')
	})

	it('should handle graceful shutdown', async () => {
		// Generate some logs
		const promises = []
		for (let i = 0; i < 10; i++) {
			promises.push(logger.info(`Message ${i}`, { iteration: i }))
		}

		// Shutdown should wait for all logs to complete
		await Promise.all([...promises, logger.flush(), logger.close()])

		// Verify all logs were written
		const content = await fs.readFile(logFile, 'utf8')
		const lines = content.trim().split('\n').filter(Boolean)
		expect(lines.length).toBe(10)
	})
})
```

### 3. Performance Tests

```typescript
import { describe, expect, it } from 'vitest'

import { StructuredLogger } from '@repo/logs'

describe('Logging Performance', () => {
	it('should handle high throughput', async () => {
		const logger = new StructuredLogger({
			service: 'performance-test',
			environment: 'test',
		})

		const startTime = Date.now()
		const logCount = 1000

		const promises = []
		for (let i = 0; i < logCount; i++) {
			promises.push(logger.info(`Performance test ${i}`, { iteration: i }))
		}

		await Promise.all(promises)
		await logger.flush()

		const endTime = Date.now()
		const duration = endTime - startTime
		const logsPerSecond = logCount / (duration / 1000)

		console.log(`Performance: ${logsPerSecond.toFixed(2)} logs/second`)
		expect(logsPerSecond).toBeGreaterThan(100) // Should handle at least 100 logs/second

		await logger.close()
	}, 10000) // 10 second timeout
})
```

## Common Issues and Solutions

### Issue 1: Unhandled Promise Rejections

**Problem**: Logging calls are not awaited, causing unhandled promise rejections.

**Solution**: Always await logging calls and add error handling:

```typescript
// BAD
logger.info('Message') // Unhandled promise

// GOOD
try {
	await logger.info('Message')
} catch (error) {
	console.error('Logging failed:', error)
}
```

### Issue 2: Missing Service Configuration

**Problem**: StructuredLogger requires service and environment configuration.

**Solution**: Always provide service and environment:

```typescript
// BAD
const logger = new StructuredLogger()

// GOOD
const logger = new StructuredLogger({
	service: 'my-service',
	environment: 'production',
})
```

### Issue 3: Synchronous Logging Patterns

**Problem**: Old synchronous logging patterns don't work with async logger.

**Solution**: Update to async patterns:

```typescript
// BAD
function processRequest(req, res) {
	logger.info('Processing request')
	// ... process ...
	logger.info('Request completed')
}

// GOOD
async function processRequest(req, res) {
	try {
		await logger.info('Processing request')
		// ... process ...
		await logger.info('Request completed')
	} catch (error) {
		console.error('Logging failed:', error)
	}
}
```

### Issue 4: Missing Graceful Shutdown

**Problem**: Application exits without flushing pending logs.

**Solution**: Implement graceful shutdown:

```typescript
process.on('SIGTERM', async () => {
	await logger.flush()
	await logger.close()
	process.exit(0)
})
```

### Issue 5: Configuration Format Mismatch

**Problem**: Using old configuration format with new logger.

**Solution**: Use migration utilities or update manually:

```typescript
// Use migration utility
import { ConfigMigrator } from '@repo/logs/compatibility'

const newConfig = ConfigMigrator.migrateLegacyConfig(oldConfig)

// Or update manually
const config = {
	service: 'my-service',
	environment: 'production',
	level: 'info',
	outputs: ['console', 'otlp'],
	// ... rest of new format
}
```

## Performance Considerations

### Batching

The new logger automatically batches logs for better performance:

```typescript
const logger = new StructuredLogger({
	service: 'high-throughput-service',
	environment: 'production',
	batch: {
		maxSize: 100, // Batch up to 100 logs
		timeoutMs: 1000, // Or flush every 1 second
		maxConcurrency: 5, // Process up to 5 batches concurrently
	},
})
```

### Sampling

Enable performance monitoring with sampling:

```typescript
const logger = new StructuredLogger({
	service: 'monitored-service',
	environment: 'production',
	performance: {
		enabled: true,
		sampleRate: 0.1, // Sample 10% of logs
		metricsIntervalMs: 60000, // Report metrics every minute
	},
})
```

### Memory Management

Configure memory-aware queuing:

```typescript
const logger = new StructuredLogger({
	service: 'memory-conscious-service',
	environment: 'production',
	// Memory management is handled automatically
	// Queues have built-in backpressure handling
})
```

## Rollback Plan

If you need to rollback the migration:

1. **Keep Legacy Dependencies**: Don't remove old logging package until migration is complete
2. **Feature Flags**: Use feature flags to switch between old and new loggers
3. **Gradual Rollout**: Migrate services one at a time
4. **Monitoring**: Monitor error rates and performance during migration

```typescript
// Feature flag approach
const USE_NEW_LOGGER = process.env.USE_NEW_LOGGER === 'true'

const logger = USE_NEW_LOGGER
	? new StructuredLogger({ service: 'my-service', environment: 'production' })
	: new LegacyLoggerWrapper()

// Logging calls work with both
if (USE_NEW_LOGGER) {
	await logger.info('Message')
} else {
	logger.info('Message')
}
```

## Support and Resources

- **Migration Utilities**: Use the provided migration tools in `@repo/logs/compatibility`
- **Documentation**: Refer to the new API documentation
- **Examples**: Check the examples in this guide and the test files
- **Validation**: Use the migration validator to check your code
- **Performance**: Monitor performance during and after migration

## Conclusion

The migration to StructuredLogger provides significant benefits in reliability, performance, and observability. While it requires updating your code to use async patterns and new configuration formats, the migration utilities and backward compatibility layer make the transition manageable.

Take your time with the migration, test thoroughly, and don't hesitate to use the compatibility layer during the transition period. The investment in migration will pay off with a more robust and maintainable logging system.
