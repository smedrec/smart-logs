/**
 * Query performance monitoring and optimization
 * Requirements 7.2, 7.4: Query performance monitoring and optimization
 */

import { sql } from 'drizzle-orm'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from './schema.js'

export interface SlowQueryInfo {
	query: string
	avgExecutionTime: number
	totalCalls: number
	totalTime: number
	minTime: number
	maxTime: number
	stddevTime: number
	rowsReturned: number
	bufferHits: number
	bufferMisses: number
}

export interface IndexUsageStats {
	schemaName: string
	tableName: string
	indexName: string
	indexSize: number
	indexScans: number
	tuplesRead: number
	tuplesReturned: number
	usageRatio: number
	lastUsed?: Date
}

export interface TableStats {
	schemaName: string
	tableName: string
	rowCount: number
	tableSize: number
	indexSize: number
	totalSize: number
	seqScans: number
	seqTuplesRead: number
	idxScans: number
	idxTuplesReturned: number
	insertCount: number
	updateCount: number
	deleteCount: number
	lastVacuum?: Date
	lastAnalyze?: Date
}

/**
 * Database performance monitoring and optimization manager
 */
export class DatabasePerformanceMonitor {
	private monitoringEnabled = false

	constructor(private db: PostgresJsDatabase<typeof schema>) {}

	/**
	 * Enable query performance monitoring
	 */
	async enableMonitoring(): Promise<void> {
		try {
			// FIXME: privileges issue
			// Enable pg_stat_statements extension for query monitoring
			await this.db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`)

			// Reset statistics
			await this.db.execute(sql`SELECT pg_stat_statements_reset()`)

			this.monitoringEnabled = true
			console.log('Database performance monitoring enabled')
		} catch (error) {
			// Gracefully handle cases where pg_stat_statements cannot be created
			console.warn(
				'Could not enable pg_stat_statements extension:',
				error instanceof Error ? error.message : error
			)
			console.warn('Performance monitoring will work with limited functionality')
			this.monitoringEnabled = true
		}
	}

	/**
	 * Disable query performance monitoring
	 */
	disableMonitoring(): void {
		this.monitoringEnabled = false
		console.log('Database performance monitoring disabled')
	}

	/**
	 * Get slow queries from pg_stat_statements
	 */
	async getSlowQueries(limit = 20, minExecutionTime = 1000): Promise<SlowQueryInfo[]> {
		try {
			const result = await this.db.execute(sql`
				SELECT 
					query,
					mean_exec_time as avg_execution_time,
					calls as total_calls,
					total_exec_time as total_time,
					min_exec_time as min_time,
					max_exec_time as max_time,
					stddev_exec_time as stddev_time,
					rows as rows_returned,
					shared_blks_hit as buffer_hits,
					shared_blks_read as buffer_misses
				FROM pg_stat_statements 
				WHERE mean_exec_time > ${minExecutionTime}
				AND query NOT LIKE '%pg_stat_statements%'
				ORDER BY mean_exec_time DESC 
				LIMIT ${limit}
			`)

			return result.map((row) => ({
				query: row.query as string,
				avgExecutionTime: Number(row.avg_execution_time),
				totalCalls: Number(row.total_calls),
				totalTime: Number(row.total_time),
				minTime: Number(row.min_time),
				maxTime: Number(row.max_time),
				stddevTime: Number(row.stddev_time),
				rowsReturned: Number(row.rows_returned),
				bufferHits: Number(row.buffer_hits),
				bufferMisses: Number(row.buffer_misses),
			}))
		} catch (error) {
			// Return empty array if pg_stat_statements is not available
			console.warn('pg_stat_statements not available, returning empty slow queries list')
			return []
		}
	}

	/**
	 * Get index usage statistics
	 */
	async getIndexUsageStats(): Promise<IndexUsageStats[]> {
		try {
			const result = await this.db.execute(sql`
				SELECT 
					schemaname as schema_name,
					relname as table_name,
					indexrelname as index_name,
					pg_relation_size(indexrelid) as index_size,
					idx_scan as index_scans,
					idx_tup_read as tuples_read,
					idx_tup_fetch as tuples_returned,
					CASE 
						WHEN idx_scan = 0 THEN 0 
						ELSE round((idx_tup_fetch::numeric / NULLIF(idx_tup_read::numeric, 0)) * 100, 2) 
					END as usage_ratio
				FROM pg_stat_user_indexes 
				WHERE schemaname = 'public'
				ORDER BY idx_scan DESC
			`)

			return result.map((row) => ({
				schemaName: row.schema_name as string,
				tableName: row.table_name as string,
				indexName: row.index_name as string,
				indexSize: Number(row.index_size),
				indexScans: Number(row.index_scans),
				tuplesRead: Number(row.tuples_read),
				tuplesReturned: Number(row.tuples_returned),
				usageRatio: Number(row.usage_ratio) || 0,
			}))
		} catch (error) {
			// Return empty array if pg_stat_user_indexes is not available
			console.warn('pg_stat_user_indexes not available, returning empty index stats')
			return []
		}
	}

	/**
	 * Get table statistics
	 */
	async getTableStats(): Promise<TableStats[]> {
		const result = await this.db.execute(sql`
			SELECT 
				schemaname as schema_name,
				relname as table_name,
				n_tup_ins as insert_count,
				n_tup_upd as update_count,
				n_tup_del as delete_count,
				seq_scan as seq_scans,
				seq_tup_read as seq_tuples_read,
				idx_scan as idx_scans,
				idx_tup_fetch as idx_tuples_returned,
				pg_relation_size(relid) as table_size,
				pg_indexes_size(relid) as index_size,
				pg_total_relation_size(relid) as total_size,
				last_vacuum,
				last_analyze,
				(SELECT reltuples FROM pg_class WHERE oid = relid) as row_count
			FROM pg_stat_user_tables 
			WHERE schemaname = 'public'
			ORDER BY pg_total_relation_size(relid) DESC
		`)

		return result.map((row) => ({
			schemaName: row.schema_name as string,
			tableName: row.table_name as string,
			rowCount: Number(row.row_count) || 0,
			tableSize: Number(row.table_size),
			indexSize: Number(row.index_size),
			totalSize: Number(row.total_size),
			seqScans: Number(row.seq_scans),
			seqTuplesRead: Number(row.seq_tuples_read),
			idxScans: Number(row.idx_scans) || 0,
			idxTuplesReturned: Number(row.idx_tuples_returned) || 0,
			insertCount: Number(row.insert_count),
			updateCount: Number(row.update_count),
			deleteCount: Number(row.delete_count),
			lastVacuum: row.last_vacuum ? new Date(row.last_vacuum as string) : undefined,
			lastAnalyze: row.last_analyze ? new Date(row.last_analyze as string) : undefined,
		}))
	}

	/**
	 * Identify unused indexes
	 */
	async getUnusedIndexes(): Promise<IndexUsageStats[]> {
		const allIndexes = await this.getIndexUsageStats()
		return allIndexes.filter((index) => index.indexScans === 0 && index.indexSize > 1024 * 1024) // > 1MB
	}

	/**
	 * Identify missing indexes based on query patterns
	 */
	async suggestMissingIndexes(): Promise<string[]> {
		const suggestions: string[] = []

		// Analyze slow queries for potential index opportunities
		const slowQueries = await this.getSlowQueries(50, 500)

		for (const query of slowQueries) {
			const queryText = query.query.toLowerCase()

			// Look for common patterns that could benefit from indexes
			if (queryText.includes('where') && queryText.includes('order by')) {
				if (queryText.includes('organization_id') && !queryText.includes('idx')) {
					suggestions.push(
						'Consider composite index on (organization_id, timestamp) for time-range queries'
					)
				}
			}

			if (queryText.includes('group by') && queryText.includes('count(')) {
				suggestions.push('Consider covering indexes for aggregation queries')
			}

			if (queryText.includes('like') || queryText.includes('ilike')) {
				suggestions.push('Consider GIN indexes for text search operations')
			}

			if (queryText.includes('jsonb') && queryText.includes('->')) {
				suggestions.push('Consider GIN indexes on JSONB columns for path queries')
			}
		}

		return [...new Set(suggestions)] // Remove duplicates
	}

	/**
	 * Analyze query execution plans
	 */
	async analyzeQueryPlan(query: string): Promise<{
		plan: any
		executionTime: number
		planningTime: number
		recommendations: string[]
	}> {
		const result = await this.db.execute(sql`
			EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql.raw(query)}
		`)

		const plan = result[0] as any
		const executionTime = plan['Execution Time'] || 0
		const planningTime = plan['Planning Time'] || 0
		const recommendations: string[] = []

		// Analyze plan for optimization opportunities
		const planText = JSON.stringify(plan)

		if (planText.includes('Seq Scan')) {
			recommendations.push('Sequential scan detected - consider adding appropriate indexes')
		}

		if (planText.includes('Sort') && planText.includes('external')) {
			recommendations.push(
				'External sort detected - consider increasing work_mem or adding indexes'
			)
		}

		if (planText.includes('Hash Join') && executionTime > 1000) {
			recommendations.push(
				'Expensive hash join - consider optimizing join conditions or adding indexes'
			)
		}

		if (planText.includes('Nested Loop') && executionTime > 1000) {
			recommendations.push('Expensive nested loop - consider adding indexes on join columns')
		}

		return {
			plan,
			executionTime,
			planningTime,
			recommendations,
		}
	}

	/**
	 * Get database performance summary
	 */
	async getPerformanceSummary(): Promise<{
		slowQueries: SlowQueryInfo[]
		unusedIndexes: IndexUsageStats[]
		tableStats: TableStats[]
		indexSuggestions: string[]
		totalDatabaseSize: number
		cacheHitRatio: number
	}> {
		const [slowQueries, unusedIndexes, tableStats, indexSuggestions] = await Promise.all([
			this.getSlowQueries(10),
			this.getUnusedIndexes(),
			this.getTableStats(),
			this.suggestMissingIndexes(),
		])

		// Calculate cache hit ratio
		const cacheStats = await this.db.execute(sql`
			SELECT 
				sum(heap_blks_read) as heap_read,
				sum(heap_blks_hit) as heap_hit,
				CASE 
					WHEN (sum(heap_blks_hit) + sum(heap_blks_read)) = 0 THEN 0
					ELSE sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read))
				END as ratio
			FROM pg_statio_user_tables
		`)

		const cacheHitRatio = Number(cacheStats[0]?.ratio || 0) * 100

		const totalDatabaseSize = tableStats.reduce((sum, table) => sum + table.totalSize, 0)

		return {
			slowQueries,
			unusedIndexes,
			tableStats,
			indexSuggestions,
			totalDatabaseSize,
			cacheHitRatio,
		}
	}

	/**
	 * Optimize database configuration
	 */
	async optimizeConfiguration(): Promise<{
		currentSettings: Record<string, string>
		recommendations: Array<{
			setting: string
			currentValue: string
			recommendedValue: string
			reason: string
		}>
	}> {
		// Get current configuration
		const configResult = await this.db.execute(sql`
			SELECT name, setting, unit, context 
			FROM pg_settings 
			WHERE name IN (
				'shared_buffers',
				'effective_cache_size',
				'maintenance_work_mem',
				'checkpoint_completion_target',
				'wal_buffers',
				'default_statistics_target',
				'random_page_cost',
				'effective_io_concurrency',
				'work_mem',
				'max_connections'
			)
		`)

		const currentSettings: Record<string, string> = {}
		configResult.forEach((row) => {
			currentSettings[row.name as string] = row.setting as string
		})

		// Get system memory info for recommendations
		const memoryResult = await this.db.execute(sql`
			SELECT 
				setting as max_connections,
				pg_size_pretty(pg_database_size(current_database())) as db_size
			FROM pg_settings 
			WHERE name = 'max_connections'
		`)

		const recommendations = [
			{
				setting: 'shared_buffers',
				currentValue: currentSettings.shared_buffers,
				recommendedValue: '256MB',
				reason: 'Should be 25% of system RAM for dedicated database server',
			},
			{
				setting: 'effective_cache_size',
				currentValue: currentSettings.effective_cache_size,
				recommendedValue: '1GB',
				reason: 'Should be 50-75% of system RAM',
			},
			{
				setting: 'work_mem',
				currentValue: currentSettings.work_mem,
				recommendedValue: '16MB',
				reason: 'Increase for better sort and hash operations',
			},
			{
				setting: 'maintenance_work_mem',
				currentValue: currentSettings.maintenance_work_mem,
				recommendedValue: '256MB',
				reason: 'Increase for faster VACUUM and CREATE INDEX operations',
			},
			{
				setting: 'checkpoint_completion_target',
				currentValue: currentSettings.checkpoint_completion_target,
				recommendedValue: '0.9',
				reason: 'Spread checkpoint I/O over longer period',
			},
		]

		return {
			currentSettings,
			recommendations,
		}
	}

	/**
	 * Run maintenance operations
	 */
	async runMaintenance(): Promise<{
		vacuumResults: string[]
		analyzeResults: string[]
		reindexResults: string[]
	}> {
		const vacuumResults: string[] = []
		const analyzeResults: string[] = []
		const reindexResults: string[] = []

		// Get tables that need maintenance
		const tableStats = await this.getTableStats()

		for (const table of tableStats) {
			// VACUUM tables with high update/delete activity
			const modificationRatio =
				(table.updateCount + table.deleteCount) / Math.max(table.rowCount, 1)
			if (modificationRatio > 0.1) {
				try {
					await this.db.execute(sql`VACUUM ANALYZE ${sql.identifier(table.tableName)}`)
					vacuumResults.push(`VACUUM ANALYZE completed for ${table.tableName}`)
				} catch (error) {
					vacuumResults.push(`VACUUM ANALYZE failed for ${table.tableName}: ${error}`)
				}
			}

			// ANALYZE tables with no recent statistics
			const daysSinceAnalyze = table.lastAnalyze
				? (Date.now() - table.lastAnalyze.getTime()) / (1000 * 60 * 60 * 24)
				: Infinity

			if (daysSinceAnalyze > 7) {
				try {
					await this.db.execute(sql`ANALYZE ${sql.identifier(table.tableName)}`)
					analyzeResults.push(`ANALYZE completed for ${table.tableName}`)
				} catch (error) {
					analyzeResults.push(`ANALYZE failed for ${table.tableName}: ${error}`)
				}
			}
		}

		// REINDEX unused indexes (if they're still needed)
		const unusedIndexes = await this.getUnusedIndexes()
		for (const index of unusedIndexes.slice(0, 5)) {
			// Limit to 5 to avoid long maintenance windows
			try {
				await this.db.execute(sql`REINDEX INDEX ${sql.identifier(index.indexName)}`)
				reindexResults.push(`REINDEX completed for ${index.indexName}`)
			} catch (error) {
				reindexResults.push(`REINDEX failed for ${index.indexName}: ${error}`)
			}
		}

		return {
			vacuumResults,
			analyzeResults,
			reindexResults,
		}
	}
}
