/**
 * Example usage of the StructuredLogger with multiple transports
 * This demonstrates how to create loggers with console and OTLP transports
 */

import {
	createConsoleAndOTLPLogger,
	createDevelopmentLogger,
	LoggerFactory,
	StructuredLogger,
} from '../src/index.js'

// Example 1: Create a development logger with console output
const devLogger = createDevelopmentLogger('my-service')

// Example 2: Create a logger with console and OTLP transports
const prodLogger = createConsoleAndOTLPLogger('my-service', 'https://otlp-endpoint.com/v1/logs')

// Example 3: Create a custom logger with specific configuration
const customLogger = new StructuredLogger({
	service: 'my-service',
	environment: 'production',
	minLevel: 'info',
	console: {
		enabled: true,
		format: 'json',
		colorize: false,
	},
	otlp: {
		enabled: true,
		endpoint: 'https://otlp-endpoint.com/v1/logs',
		batchSize: 50,
		timeoutMs: 30000,
	},
	file: {
		enabled: true,
		filename: 'app.log',
		maxSize: 10 * 1024 * 1024, // 10MB
		maxFiles: 5,
	},
})

// Example 4: Using the LoggerFactory for production setup
const factoryLogger = LoggerFactory.createProductionLogger('my-service', {
	otlpEndpoint: 'https://otlp-endpoint.com/v1/logs',
	fileConfig: {
		filename: 'production.log',
		maxSize: 50 * 1024 * 1024, // 50MB
	},
})

// Usage examples
async function demonstrateLogging() {
	// Log with different levels
	await devLogger.info('Application started', { version: '1.0.0' })
	await devLogger.warn('This is a warning', { component: 'auth' })
	await devLogger.error('An error occurred', { error: 'Connection failed' })

	// Log with correlation tracking
	devLogger.setRequestId('req-123')
	devLogger.setCorrelationId('corr-456')
	await devLogger.info('Processing request', { userId: 'user-789' })

	// Create child logger with additional context
	const childLogger = devLogger.withContext({ module: 'payment' })
	await childLogger.info('Payment processed', { amount: 100, currency: 'USD' })

	// Check transport health
	const health = customLogger.getTransportHealth()
	console.log('Transport health:', health)

	// Graceful shutdown
	await customLogger.flush()
	await customLogger.close()
}

// Run the demonstration
demonstrateLogging().catch(console.error)

export { devLogger, prodLogger, customLogger, factoryLogger }
