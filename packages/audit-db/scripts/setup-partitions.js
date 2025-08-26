#!/usr/bin/env node

/**
 * CLI script to setup audit_log partitioning
 * Usage: node scripts/setup-partitions.js [postgres-url]
 */
import { setupPartitions } from '../src/db/setup-partitions.js'

const postgresUrl = process.argv[2] || process.env.AUDIT_DB_URL

if (!postgresUrl) {
	console.error(
		'❌ PostgreSQL URL required. Provide as argument or set AUDIT_DB_URL environment variable.'
	)
	console.error('Usage: node scripts/setup-partitions.js [postgres-url]')
	process.exit(1)
}

console.log('🚀 Starting audit_log partition setup...')
console.log(`📡 Using database: ${postgresUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`)

setupPartitions(postgresUrl)
	.then(() => {
		console.log('🎉 Setup completed successfully!')
	})
	.catch((error) => {
		console.error('💥 Setup failed:', error)
		process.exit(1)
	})
