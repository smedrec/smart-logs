#!/usr/bin/env node
// Example runner that uses the built package in `dist/`.
// This script assumes you've run `npm run build` in the package root.
import { StructuredLogger } from '../dist/index.js'

const logger = new StructuredLogger({
	service: 'example-service-dist',
	environment: 'production',
	otlp: { enabled: true, endpoint: 'http://localhost:4318/v1/logs' },
	redis: { enabled: true, host: 'localhost', port: 6379, listName: 'example-logs' },
})

async function main() {
	console.log('Starting example (dist) logger...')

	await logger.info('Example (dist) started', { exampleField: 'hello from dist' })
	await logger.debug('Debug message (dist)', { debug: true })

	await logger.info('Processing batch (dist)', { items: 3 })

	await logger.flush()
	await logger.close()

	console.log('Example (dist) completed')
}

main().catch((err) => {
	console.error('Example (dist) failed:', err)
	process.exit(1)
})
