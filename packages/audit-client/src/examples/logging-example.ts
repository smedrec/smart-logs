import { AuditLogger, DataMasker, LoggerFactory } from '../infrastructure/logger'

import type { CustomLogger, LogEntry } from '../infrastructure/logger'

/**
 * Example demonstrating the comprehensive logging system
 */

// Example 1: Basic logging with different levels
console.log('=== Basic Logging Example ===')

const basicLogger = LoggerFactory.create({
	level: 'debug',
	format: 'text',
	enableConsole: true,
	enableBuffer: false,
})

basicLogger.debug('Debug message with metadata', { userId: 'user123', action: 'login' })
basicLogger.info('User logged in successfully', { userId: 'user123', timestamp: new Date() })
basicLogger.warn('Rate limit approaching', { userId: 'user123', requests: 95, limit: 100 })
basicLogger.error('Authentication failed', { userId: 'user123', reason: 'invalid_password' })

// Example 2: Structured logging with JSON format
console.log('\n=== Structured Logging Example ===')

const structuredLogger = LoggerFactory.create({
	level: 'info',
	format: 'structured',
	enableConsole: true,
	component: 'audit-service',
})

structuredLogger.setRequestId('req-12345')
structuredLogger.setCorrelationId('corr-67890')
structuredLogger.info('Processing audit event', {
	eventType: 'user_action',
	resourceId: 'resource-456',
	action: 'update',
})

// Example 3: Sensitive data masking
console.log('\n=== Sensitive Data Masking Example ===')

const maskingLogger = LoggerFactory.create({
	level: 'info',
	format: 'json',
	maskSensitiveData: true,
	sensitiveFields: ['customSecret', 'internalKey'],
	enableConsole: true,
})

maskingLogger.info('User authentication attempt', {
	username: 'john.doe',
	password: 'secret123', // This will be masked
	apiKey: 'sk_live_abc123def456', // This will be masked
	customSecret: 'my-secret-value', // This will be masked (custom field)
	sessionId: 'sess_789xyz', // This will be masked
	normalData: 'This is normal data', // This will not be masked
})

// Example 4: HTTP request/response logging
console.log('\n=== HTTP Request/Response Logging Example ===')

const httpLogger = new AuditLogger({
	level: 'info',
	format: 'text',
	includeRequestBody: true,
	includeResponseBody: true,
	maskSensitiveData: true,
	enableConsole: true,
})

// Log an HTTP request
httpLogger.logRequest(
	'POST',
	'https://api.example.com/audit/events',
	{
		'Content-Type': 'application/json',
		Authorization: 'Bearer token123',
		'X-Request-ID': 'req-12345',
	},
	{
		action: 'user_login',
		userId: 'user123',
		password: 'secret', // This will be masked
	}
)

// Log an HTTP response
httpLogger.logResponse(
	200,
	'OK',
	{
		'Content-Type': 'application/json',
		'X-Response-Time': '150ms',
	},
	{
		success: true,
		eventId: 'evt-789',
		token: 'new-token-456', // This will be masked
	},
	150
)

// Example 5: Error logging with context
console.log('\n=== Error Logging Example ===')

const errorLogger = LoggerFactory.create({
	level: 'error',
	format: 'structured',
	enableConsole: true,
})

try {
	throw new Error('Database connection failed')
} catch (error) {
	errorLogger.logError(error as Error, {
		operation: 'create_audit_event',
		userId: 'user123',
		eventData: { action: 'login', timestamp: new Date() },
		retryAttempt: 3,
	})
}

// Example 6: Custom logger integration
console.log('\n=== Custom Logger Integration Example ===')

class FileLogger implements CustomLogger {
	private logs: LogEntry[] = []

	async log(entry: LogEntry): Promise<void> {
		this.logs.push(entry)
		console.log(`[FILE LOGGER] ${entry.level.toUpperCase()}: ${entry.message}`)

		// In a real implementation, you would write to a file, database, or external service
		// await fs.writeFile('audit.log', JSON.stringify(entry) + '\n', { flag: 'a' })
	}

	getLogs(): LogEntry[] {
		return [...this.logs]
	}
}

const fileLogger = new FileLogger()
const customLogger = LoggerFactory.create(
	{
		level: 'info',
		enableConsole: false,
		enableBuffer: true,
		bufferSize: 100,
	},
	fileLogger
)

customLogger.info('Message 1', { data: 'test1' })
customLogger.warn('Message 2', { data: 'test2' })
customLogger.error('Message 3', { data: 'test3' })

// Flush buffer to custom logger
await customLogger.flush()

console.log(`Custom logger received ${fileLogger.getLogs().length} log entries`)

// Example 7: Buffer management
console.log('\n=== Buffer Management Example ===')

const bufferLogger = LoggerFactory.create({
	level: 'debug',
	enableConsole: false,
	enableBuffer: true,
	bufferSize: 5,
})

// Add more logs than buffer size
for (let i = 1; i <= 8; i++) {
	bufferLogger.info(`Buffered message ${i}`, { index: i })
}

const buffer = bufferLogger.getBuffer()
console.log(`Buffer contains ${buffer.length} entries (max 5)`)
console.log('First entry:', buffer[0].message)
console.log('Last entry:', buffer[buffer.length - 1].message)

// Clear buffer
bufferLogger.clearBuffer()
console.log(`Buffer after clear: ${bufferLogger.getBuffer().length} entries`)

// Example 8: Data masking utility
console.log('\n=== Data Masking Utility Example ===')

const dataMasker = new DataMasker(['customField'])

const sensitiveData = {
	user: {
		name: 'John Doe',
		email: 'john@example.com', // Will be masked
		password: 'secret123', // Will be masked
		customField: 'sensitive-value', // Will be masked (custom field)
	},
	metadata: {
		version: '1.0.0', // Will not be masked
		timestamp: new Date().toISOString(), // Will not be masked
	},
	creditCard: '4532-1234-5678-9012', // Will be masked by pattern
}

const maskedData = dataMasker.mask(sensitiveData)
console.log('Original data:', JSON.stringify(sensitiveData, null, 2))
console.log('Masked data:', JSON.stringify(maskedData, null, 2))

// Example 9: Different logger configurations for different environments
console.log('\n=== Environment-Specific Logging Example ===')

// Development logger - verbose, includes request/response bodies
const devLogger = LoggerFactory.createDebug()
devLogger.info('Development environment - verbose logging enabled')

// Production logger - minimal, secure
const prodLogger = LoggerFactory.create({
	level: 'warn',
	format: 'json',
	maskSensitiveData: true,
	includeRequestBody: false,
	includeResponseBody: false,
	enableConsole: true,
})
prodLogger.warn('Production environment - minimal logging enabled')

// Silent logger - for testing
const silentLogger = LoggerFactory.createSilent()
silentLogger.error('This will only log errors and above')

console.log('\n=== Logging Examples Complete ===')
