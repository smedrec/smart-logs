#!/usr/bin/env node
import { StructuredLogger } from '../../src/index.js'

// Example configuration that sends logs to local OTLP collector and Redis
const logger = new StructuredLogger({
	service: 'example-service',
	environment: 'development',
	otlp: { enabled: true, endpoint: 'http://localhost:4318/v1/logs' },
	redis: { enabled: true, host: 'localhost', port: 6379, listName: 'example-logs' },
})

async function main() {
	console.log('Starting example logger...')

	await logger.info('Example started', { exampleField: 'hello' })
	await logger.debug('Debug message', { debug: true })

	// Simulate work and performance metrics
	await logger.info('Processing batch', { items: 3 })

	// Flush and close gracefully
	await logger.flush()
	await logger.close()

	console.log('Example completed')
}

main().catch((err) => {
	console.error('Example failed:', err)
	process.exit(1)
})
