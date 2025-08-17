#!/usr/bin/env node

/**
 * CLI tool for database performance management and optimization
 * Requirements 7.1, 7.2, 7.3, 7.4: Performance management CLI
 */
import { Command } from 'commander'

import { createEnhancedAuditClient } from './db/enhanced-client.js'
import { AuditDb } from './db/index.js'
import { DatabasePartitionManager } from './db/partitioning.js'
import { DatabasePerformanceMonitor } from './db/performance-monitoring.js'

const program = new Command()

program
	.name('audit-db-performance')
	.description('Database performance management and optimization tool')
	.version('1.0.0')

// Partition management commands
const partitionCmd = program.command('partition').description('Manage database partitions')

partitionCmd
	.command('create')
	.description('Create audit log partitions')
	.option('-i, --interval <interval>', 'Partition interval (monthly, quarterly, yearly)', 'monthly')
	.option('-r, --retention <days>', 'Retention period in days', '2555')
	.action(async (options) => {
		const auditDb = new AuditDb()
		const partitionManager = new DatabasePartitionManager(auditDb.getDrizzleInstance())

		try {
			await partitionManager.createAuditLogPartitions({
				strategy: 'range',
				partitionColumn: 'timestamp',
				interval: options.interval as 'monthly' | 'quarterly' | 'yearly',
				retentionDays: parseInt(options.retention),
			})
			console.log('✅ Partitions created successfully')
		} catch (error) {
			console.error('❌ Failed to create partitions:', error)
			process.exit(1)
		} finally {
			await auditDb.end()
		}
	})

partitionCmd
	.command('list')
	.description('List existing partitions')
	.action(async () => {
		const auditDb = new AuditDb()
		const partitionManager = new DatabasePartitionManager(auditDb.getDrizzleInstance())

		try {
			const partitions = await partitionManager.getPartitionInfo()
			console.log('\n📊 Partition Information:')
			console.table(
				partitions.map((p) => ({
					Name: p.partitionName,
					Type: p.partitionType,
					Records: p.recordCount?.toLocaleString() || 'N/A',
					'Size (MB)': p.sizeBytes ? (p.sizeBytes / 1024 / 1024).toFixed(2) : 'N/A',
					Expression: p.partitionExpression,
				}))
			)
		} catch (error) {
			console.error('❌ Failed to list partitions:', error)
			process.exit(1)
		} finally {
			await auditDb.end()
		}
	})

partitionCmd
	.command('analyze')
	.description('Analyze partition performance')
	.action(async () => {
		const auditDb = new AuditDb()
		const partitionManager = new DatabasePartitionManager(auditDb.getDrizzleInstance())

		try {
			const analysis = await partitionManager.analyzePartitionPerformance()
			console.log('\n📈 Partition Performance Analysis:')
			console.log(`Total Partitions: ${analysis.totalPartitions}`)
			console.log(`Total Size: ${(analysis.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`)
			console.log(`Total Records: ${analysis.totalRecords.toLocaleString()}`)
			console.log(
				`Average Partition Size: ${(analysis.averagePartitionSize / 1024 / 1024).toFixed(2)} MB`
			)

			if (analysis.recommendations.length > 0) {
				console.log('\n💡 Recommendations:')
				analysis.recommendations.forEach((rec) => console.log(`  • ${rec}`))
			}
		} catch (error) {
			console.error('❌ Failed to analyze partitions:', error)
			process.exit(1)
		} finally {
			await auditDb.end()
		}
	})

partitionCmd
	.command('cleanup')
	.description('Clean up expired partitions')
	.option('-r, --retention <days>', 'Retention period in days', '2555')
	.action(async (options) => {
		const auditDb = new AuditDb()
		const partitionManager = new DatabasePartitionManager(auditDb.getDrizzleInstance())

		try {
			const dropped = await partitionManager.dropExpiredPartitions(parseInt(options.retention))
			if (dropped.length > 0) {
				console.log('🗑️  Dropped expired partitions:')
				dropped.forEach((partition) => console.log(`  • ${partition}`))
			} else {
				console.log('✅ No expired partitions found')
			}
		} catch (error) {
			console.error('❌ Failed to cleanup partitions:', error)
			process.exit(1)
		} finally {
			await auditDb.end()
		}
	})

// Performance monitoring commands
const monitorCmd = program.command('monitor').description('Database performance monitoring')

monitorCmd
	.command('slow-queries')
	.description('Show slow queries')
	.option('-l, --limit <number>', 'Number of queries to show', '20')
	.option('-t, --threshold <ms>', 'Minimum execution time in ms', '1000')
	.action(async (options) => {
		const auditDb = new AuditDb()
		const monitor = new DatabasePerformanceMonitor(auditDb.getDrizzleInstance())

		try {
			await monitor.enableMonitoring()
			const slowQueries = await monitor.getSlowQueries(
				parseInt(options.limit),
				parseInt(options.threshold)
			)

			if (slowQueries.length === 0) {
				console.log('✅ No slow queries found')
			} else {
				console.log('\n🐌 Slow Queries:')
				console.table(
					slowQueries.map((q) => ({
						'Avg Time (ms)': q.avgExecutionTime.toFixed(2),
						'Total Calls': q.totalCalls.toLocaleString(),
						'Total Time (ms)': q.totalTime.toFixed(2),
						'Min Time (ms)': q.minTime.toFixed(2),
						'Max Time (ms)': q.maxTime.toFixed(2),
						Query: q.query.substring(0, 100) + (q.query.length > 100 ? '...' : ''),
					}))
				)
			}
		} catch (error) {
			console.error('❌ Failed to get slow queries:', error)
			process.exit(1)
		} finally {
			await auditDb.end()
		}
	})

monitorCmd
	.command('indexes')
	.description('Show index usage statistics')
	.action(async () => {
		const auditDb = new AuditDb()
		const monitor = new DatabasePerformanceMonitor(auditDb.getDrizzleInstance())

		try {
			const indexStats = await monitor.getIndexUsageStats()
			console.log('\n📊 Index Usage Statistics:')
			console.table(
				indexStats.map((idx) => ({
					Table: idx.tableName,
					Index: idx.indexName,
					Scans: idx.indexScans.toLocaleString(),
					'Size (MB)': (idx.indexSize / 1024 / 1024).toFixed(2),
					'Usage Ratio': `${idx.usageRatio}%`,
				}))
			)

			const unusedIndexes = await monitor.getUnusedIndexes()
			if (unusedIndexes.length > 0) {
				console.log('\n⚠️  Unused Indexes (> 1MB):')
				unusedIndexes.forEach((idx) => {
					console.log(`  • ${idx.indexName} (${(idx.indexSize / 1024 / 1024).toFixed(2)} MB)`)
				})
			}
		} catch (error) {
			console.error('❌ Failed to get index statistics:', error)
			process.exit(1)
		} finally {
			await auditDb.end()
		}
	})

monitorCmd
	.command('tables')
	.description('Show table statistics')
	.action(async () => {
		const auditDb = new AuditDb()
		const monitor = new DatabasePerformanceMonitor(auditDb.getDrizzleInstance())

		try {
			const tableStats = await monitor.getTableStats()
			console.log('\n📊 Table Statistics:')
			console.table(
				tableStats.map((table) => ({
					Table: table.tableName,
					Rows: table.rowCount.toLocaleString(),
					'Size (MB)': (table.totalSize / 1024 / 1024).toFixed(2),
					'Seq Scans': table.seqScans.toLocaleString(),
					'Index Scans': table.idxScans.toLocaleString(),
					'Last Vacuum': table.lastVacuum?.toLocaleDateString() || 'Never',
					'Last Analyze': table.lastAnalyze?.toLocaleDateString() || 'Never',
				}))
			)
		} catch (error) {
			console.error('❌ Failed to get table statistics:', error)
			process.exit(1)
		} finally {
			await auditDb.end()
		}
	})

monitorCmd
	.command('summary')
	.description('Show performance summary')
	.action(async () => {
		const auditDb = new AuditDb()
		const monitor = new DatabasePerformanceMonitor(auditDb.getDrizzleInstance())

		try {
			await monitor.enableMonitoring()
			const summary = await monitor.getPerformanceSummary()

			console.log('\n📈 Performance Summary:')
			console.log(
				`Database Size: ${(summary.totalDatabaseSize / 1024 / 1024 / 1024).toFixed(2)} GB`
			)
			console.log(`Cache Hit Ratio: ${summary.cacheHitRatio.toFixed(2)}%`)
			console.log(`Slow Queries: ${summary.slowQueries.length}`)
			console.log(`Unused Indexes: ${summary.unusedIndexes.length}`)

			if (summary.indexSuggestions.length > 0) {
				console.log('\n💡 Index Suggestions:')
				summary.indexSuggestions.forEach((suggestion) => console.log(`  • ${suggestion}`))
			}
		} catch (error) {
			console.error('❌ Failed to get performance summary:', error)
			process.exit(1)
		} finally {
			await auditDb.end()
		}
	})

// Optimization commands
const optimizeCmd = program.command('optimize').description('Database optimization operations')

optimizeCmd
	.command('maintenance')
	.description('Run database maintenance (VACUUM, ANALYZE, REINDEX)')
	.action(async () => {
		const auditDb = new AuditDb()
		const monitor = new DatabasePerformanceMonitor(auditDb.getDrizzleInstance())

		try {
			console.log('🔧 Running database maintenance...')
			const results = await monitor.runMaintenance()

			console.log('\n✅ Maintenance Results:')
			if (results.vacuumResults.length > 0) {
				console.log('\nVACUUM Results:')
				results.vacuumResults.forEach((result) => console.log(`  • ${result}`))
			}
			if (results.analyzeResults.length > 0) {
				console.log('\nANALYZE Results:')
				results.analyzeResults.forEach((result) => console.log(`  • ${result}`))
			}
			if (results.reindexResults.length > 0) {
				console.log('\nREINDEX Results:')
				results.reindexResults.forEach((result) => console.log(`  • ${result}`))
			}
		} catch (error) {
			console.error('❌ Failed to run maintenance:', error)
			process.exit(1)
		} finally {
			await auditDb.end()
		}
	})

optimizeCmd
	.command('config')
	.description('Show database configuration recommendations')
	.action(async () => {
		const auditDb = new AuditDb()
		const monitor = new DatabasePerformanceMonitor(auditDb.getDrizzleInstance())

		try {
			const config = await monitor.optimizeConfiguration()

			console.log('\n⚙️  Current Configuration:')
			Object.entries(config.currentSettings).forEach(([key, value]) => {
				console.log(`  ${key}: ${value}`)
			})

			console.log('\n💡 Configuration Recommendations:')
			config.recommendations.forEach((rec) => {
				console.log(`\n  ${rec.setting}:`)
				console.log(`    Current: ${rec.currentValue}`)
				console.log(`    Recommended: ${rec.recommendedValue}`)
				console.log(`    Reason: ${rec.reason}`)
			})
		} catch (error) {
			console.error('❌ Failed to get configuration recommendations:', error)
			process.exit(1)
		} finally {
			await auditDb.end()
		}
	})

// Enhanced client commands
const clientCmd = program.command('client').description('Enhanced database client operations')

clientCmd
	.command('health')
	.description('Check enhanced client health')
	.action(async () => {
		const client = createEnhancedAuditClient(
			process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit'
		)

		try {
			const health = await client.getHealthStatus()

			console.log('\n🏥 Health Status:')
			console.log(`Overall: ${health.overall.toUpperCase()}`)

			console.log('\n📊 Component Status:')
			Object.entries(health.components).forEach(([component, status]) => {
				console.log(`  ${component}: ${status.status.toUpperCase()}`)
				if (typeof status.details === 'object') {
					Object.entries(status.details).forEach(([key, value]) => {
						console.log(`    ${key}: ${value}`)
					})
				}
			})

			if (health.recommendations.length > 0) {
				console.log('\n💡 Recommendations:')
				health.recommendations.forEach((rec) => console.log(`  • ${rec}`))
			}
		} catch (error) {
			console.error('❌ Failed to check health:', error)
			process.exit(1)
		} finally {
			await client.close()
		}
	})

clientCmd
	.command('report')
	.description('Generate performance report')
	.action(async () => {
		const client = createEnhancedAuditClient(
			process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit'
		)

		try {
			const report = await client.generatePerformanceReport()

			console.log('\n📊 Performance Report:')
			console.log(`Timestamp: ${report.timestamp.toISOString()}`)

			console.log('\n🔗 Connection Pool:')
			console.log(`  Success Rate: ${report.connectionPool.successRate.toFixed(2)}%`)
			console.log(
				`  Avg Acquisition Time: ${report.connectionPool.averageAcquisitionTime.toFixed(2)}ms`
			)
			console.log(`  Active Connections: ${report.connectionPool.activeConnections}`)

			console.log('\n💾 Query Cache:')
			console.log(`  Hit Ratio: ${report.queryCache.hitRatio.toFixed(2)}%`)
			console.log(`  Size: ${report.queryCache.totalSizeMB.toFixed(2)} MB`)
			console.log(`  Evictions: ${report.queryCache.evictions}`)

			console.log('\n🗂️  Partitions:')
			console.log(`  Total Partitions: ${report.partitions.totalPartitions}`)
			console.log(`  Total Size: ${report.partitions.totalSizeGB.toFixed(2)} GB`)

			console.log('\n⚡ Performance:')
			console.log(`  Slow Queries: ${report.performance.slowQueries}`)
			console.log(`  Unused Indexes: ${report.performance.unusedIndexes}`)
			console.log(`  Cache Hit Ratio: ${report.performance.cacheHitRatio.toFixed(2)}%`)

			if (
				report.partitions.recommendations.length > 0 ||
				report.performance.suggestions.length > 0
			) {
				console.log('\n💡 Recommendations:')
				;[...report.partitions.recommendations, ...report.performance.suggestions].forEach(
					(rec) => {
						console.log(`  • ${rec}`)
					}
				)
			}
		} catch (error) {
			console.error('❌ Failed to generate report:', error)
			process.exit(1)
		} finally {
			await client.close()
		}
	})

clientCmd
	.command('optimize')
	.description('Run comprehensive database optimization')
	.action(async () => {
		const client = createEnhancedAuditClient(
			process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit'
		)

		try {
			console.log('🚀 Running comprehensive database optimization...')
			const results = await client.optimizeDatabase()

			console.log('\n✅ Optimization Results:')

			if (results.partitionOptimization.length > 0) {
				console.log('\n🗂️  Partition Optimization:')
				results.partitionOptimization.forEach((opt) => console.log(`  • ${opt}`))
			}

			if (results.indexOptimization.length > 0) {
				console.log('\n📊 Index Optimization:')
				results.indexOptimization.forEach((opt) => console.log(`  • ${opt}`))
			}

			console.log('\n🔧 Maintenance Results:')
			if (results.maintenanceResults.vacuumResults.length > 0) {
				console.log('  VACUUM:')
				results.maintenanceResults.vacuumResults.forEach((result) => console.log(`    • ${result}`))
			}
			if (results.maintenanceResults.analyzeResults.length > 0) {
				console.log('  ANALYZE:')
				results.maintenanceResults.analyzeResults.forEach((result) =>
					console.log(`    • ${result}`)
				)
			}

			if (results.configOptimization.length > 0) {
				console.log('\n⚙️  Configuration Recommendations:')
				results.configOptimization.forEach((rec) => {
					console.log(`  ${rec.setting}: ${rec.currentValue} → ${rec.recommendedValue}`)
					console.log(`    ${rec.reason}`)
				})
			}
		} catch (error) {
			console.error('❌ Failed to optimize database:', error)
			process.exit(1)
		} finally {
			await client.close()
		}
	})

// Benchmark command
program
	.command('benchmark')
	.description('Run performance benchmarks')
	.option('-s, --small <number>', 'Small dataset size', '1000')
	.option('-m, --medium <number>', 'Medium dataset size', '10000')
	.option('-l, --large <number>', 'Large dataset size', '100000')
	.action(async (options) => {
		console.log('🏃 Running performance benchmarks...')
		console.log('This will run the performance test suite')
		console.log('Use: npm test -- --run packages/audit-db/src/test/performance.test.ts')
	})

// Error handling
program.configureOutput({
	writeErr: (str: string) => process.stderr.write(`❌ ${str}`),
})

program.exitOverride((err: any) => {
	if (err.code === 'commander.help') {
		process.exit(0)
	}
	process.exit(1)
})

// Parse command line arguments
program.parse(process.argv)

export default program
