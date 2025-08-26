/**
 * Setup script to initialize partitioned audit_log table
 * Run this once to set up partitioning for your audit database
 */

import { AuditDb } from './index.js'

import { DatabasePartitionManager } from './partitioning.js'

export async function setupPartitions(postgresUrl?: string): Promise<void> {
	const auditDb = new AuditDb(postgresUrl)
	const db = auditDb.getDrizzleInstance()
	const partitionManager = new DatabasePartitionManager(db)

	try {
		console.log('🔧 Setting up partitioned audit_log table...')

		// Initialize the partitioned table and functions
		await partitionManager.initializePartitionedTable()

		console.log('✅ Partitioned audit_log table setup complete!')
		console.log('📊 Getting partition info...')

		// Show partition information
		const partitionInfo = await partitionManager.getPartitionInfo()
		console.log(`📈 Created ${partitionInfo.length} partitions:`)
		partitionInfo.forEach((partition) => {
			console.log(`  - ${partition.partitionName}: ${partition.partitionExpression}`)
		})
	} catch (error) {
		console.error('❌ Failed to setup partitions:', error)
		throw error
	} finally {
		await auditDb.end()
	}
}

// Allow running this script directly
if (import.meta.url === `file://${process.argv[1]}`) {
	setupPartitions()
		.then(() => {
			console.log('🎉 Partition setup completed successfully!')
			process.exit(0)
		})
		.catch((error) => {
			console.error('💥 Partition setup failed:', error)
			process.exit(1)
		})
}
