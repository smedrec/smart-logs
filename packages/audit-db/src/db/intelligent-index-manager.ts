/**
 * Intelligent index management and optimization system
 * Implements automatic index analysis, creation, and maintenance
 */

import { sql } from 'drizzle-orm'

import { StructuredLogger } from '@repo/logs'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from './schema.js'

export interface IndexUsageStats {
	schemaName: string
	tableName: string
	indexName: string
	scans: number
	tuplesRead: number
	tuplesReturned: number
	efficiency: number
	lastUsed?: Date
	sizeBytes: number
	recommendation: 'keep' | 'drop' | 'recreate' | 'optimize'
}

export interface IndexRecommendation {
	type: 'create' | 'drop' | 'modify' | 'optimize'
	tableName: string
	indexName?: string
	columns: string[]
	indexType: 'btree' | 'gin' | 'gist' | 'hash' | 'brin'
	reason: string
	estimatedImpact: 'high' | 'medium' | 'low'
	priority: number
	sqlCommand: string
}

export interface QueryPattern {
	query: string
	frequency: number
	averageExecutionTime: number
	missingIndexes: string[]
	suggestedIndexes: IndexRecommendation[]
}

export interface IndexOptimizationConfig {
	enableAutoCreation: boolean
	enableAutoDrop: boolean
	unusedThresholdDays: number
	minUsageScans: number
	analysisInterval: number
	maxConcurrentIndexOps: number
}

/**
 * Advanced index management system with intelligent optimization
 */
export class IntelligentIndexManager {
	private readonly logger: StructuredLogger
	private analysisTimer: NodeJS.Timeout | null = null
	private indexOperationsQueue: IndexRecommendation[] = []
	private runningOperations = 0

	constructor(
		private db: PostgresJsDatabase<typeof schema>,
		private config: IndexOptimizationConfig
	) {
		// Initialize Structured Logger
		this.logger = new StructuredLogger({
			service: '@repo/audit-db - IntelligentIndexManager',
			environment: 'development',
			console: {
				name: 'console',
				enabled: true,
				format: 'pretty',
				colorize: true,
				level: 'info',
			},
			otlp: {
				name: 'otpl',
				enabled: true,
				level: 'info',
				endpoint: 'http://localhost:5080/api/default/default/_json',
				headers: {
					Authorization: process.env.OTLP_AUTH_HEADER || '',
				},
			},
		})

		this.startPeriodicAnalysis()
	}

	/**
	 * Analyze current index usage and generate recommendations
	 */
	async analyzeIndexUsage(): Promise<IndexUsageStats[]> {
		try {
			const result = await this.db.execute(sql`
				SELECT 
					schemaname,
					tablename,
					indexname,
					idx_scan as scans,
					idx_tup_read as tuples_read,
					idx_tup_fetch as tuples_returned,
					pg_relation_size(indexrelid) as size_bytes,
					CASE 
						WHEN idx_scan = 0 THEN 0
						ELSE (idx_tup_fetch::float / NULLIF(idx_tup_read, 0))::numeric(5,2)
					END as efficiency
				FROM pg_stat_user_indexes 
				WHERE schemaname = 'public'
				AND tablename LIKE 'audit_log%'
				ORDER BY schemaname, tablename, indexname
			`)

			return result.map((row) => {
				const scans = Number(row.scans) || 0
				const efficiency = Number(row.efficiency) || 0
				const sizeBytes = Number(row.size_bytes) || 0

				let recommendation: 'keep' | 'drop' | 'recreate' | 'optimize' = 'keep'

				// Determine recommendation based on usage patterns
				if (scans === 0 && this.isOlderThanThreshold(new Date())) {
					recommendation = 'drop'
				} else if (scans < this.config.minUsageScans && efficiency < 0.1) {
					recommendation = 'recreate'
				} else if (efficiency < 0.5 && scans > 1000) {
					recommendation = 'optimize'
				}

				return {
					schemaName: row.schemaname as string,
					tableName: row.tablename as string,
					indexName: row.indexname as string,
					scans,
					tuplesRead: Number(row.tuples_read) || 0,
					tuplesReturned: Number(row.tuples_returned) || 0,
					efficiency,
					sizeBytes,
					recommendation,
				}
			})
		} catch (error) {
			this.logger.error('Failed to analyze index usage:', {
				error: {
					name: (error as Error).name,
					message: (error as Error).message,
					stack: (error as Error).stack,
				},
			})
			throw error
		}
	}

	/**
	 * Generate index recommendations based on query patterns
	 */
	async generateIndexRecommendations(): Promise<IndexRecommendation[]> {
		const recommendations: IndexRecommendation[] = []

		try {
			// Analyze slow queries to identify missing indexes
			const slowQueries = await this.analyzeSlowQueries()

			// Analyze existing indexes for optimization opportunities
			const indexStats = await this.analyzeIndexUsage()

			// Generate recommendations for missing indexes
			for (const query of slowQueries) {
				recommendations.push(...query.suggestedIndexes)
			}

			// Generate recommendations for unused indexes
			for (const index of indexStats) {
				if (index.recommendation === 'drop') {
					recommendations.push({
						type: 'drop',
						tableName: index.tableName,
						indexName: index.indexName,
						columns: [],
						indexType: 'btree',
						reason: `Unused index (${index.scans} scans)`,
						estimatedImpact: 'medium',
						priority: 3,
						sqlCommand: `DROP INDEX CONCURRENTLY IF EXISTS ${index.indexName}`,
					})
				} else if (index.recommendation === 'optimize') {
					recommendations.push({
						type: 'optimize',
						tableName: index.tableName,
						indexName: index.indexName,
						columns: [],
						indexType: 'btree',
						reason: `Low efficiency index (${index.efficiency}% efficiency)`,
						estimatedImpact: 'high',
						priority: 1,
						sqlCommand: `REINDEX INDEX CONCURRENTLY ${index.indexName}`,
					})
				}
			}

			// Generate proactive recommendations for audit_log patterns
			recommendations.push(...this.generateAuditLogRecommendations())

			// Sort by priority and estimated impact
			recommendations.sort((a, b) => {
				if (a.priority !== b.priority) {
					return a.priority - b.priority
				}

				const impactWeight = { high: 3, medium: 2, low: 1 }
				return impactWeight[b.estimatedImpact] - impactWeight[a.estimatedImpact]
			})

			this.logger.info(`Generated ${recommendations.length} index recommendations`)
			return recommendations
		} catch (error) {
			this.logger.error('Failed to generate index recommendations:', {
				error: {
					name: (error as Error).name,
					message: (error as Error).message,
					stack: (error as Error).stack,
				},
			})
			throw error
		}
	}

	/**
	 * Execute index recommendations automatically
	 */
	async executeRecommendations(recommendations: IndexRecommendation[]): Promise<{
		executed: number
		failed: number
		errors: string[]
	}> {
		let executed = 0
		let failed = 0
		const errors: string[] = []

		for (const recommendation of recommendations) {
			// Check if we've reached the maximum concurrent operations
			if (this.runningOperations >= this.config.maxConcurrentIndexOps) {
				this.indexOperationsQueue.push(recommendation)
				continue
			}

			try {
				await this.executeRecommendation(recommendation)
				executed++
				this.logger.info(
					`Executed index recommendation: ${recommendation.type} on ${recommendation.tableName}`
				)
			} catch (error) {
				failed++
				const errorMsg = `Failed to execute ${recommendation.type} on ${recommendation.tableName}: ${(error as Error).message}`
				errors.push(errorMsg)
				this.logger.error(errorMsg, {
					error: {
						name: (error as Error).name,
						message: (error as Error).message,
						stack: (error as Error).stack,
					},
				})
			}
		}

		this.logger.info(`Index optimization completed: ${executed} executed, ${failed} failed`)
		return { executed, failed, errors }
	}

	/**
	 * Create optimized indexes for common audit log query patterns
	 */
	async createAuditLogIndexes(): Promise<void> {
		const indexes = [
			// Time-based queries (most common)
			{
				name: 'audit_log_timestamp_btree_idx',
				sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_log_timestamp_btree_idx ON audit_log USING btree (timestamp)',
				reason: 'Time-range queries optimization',
			},

			// Organization-based queries
			{
				name: 'audit_log_org_timestamp_idx',
				sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_log_org_timestamp_idx ON audit_log (organization_id, timestamp)',
				reason: 'Organization audit queries optimization',
			},

			// User activity queries
			{
				name: 'audit_log_principal_action_idx',
				sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_log_principal_action_idx ON audit_log (principal_id, action)',
				reason: 'User activity analysis optimization',
			},

			// Resource access queries
			{
				name: 'audit_log_resource_idx',
				sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_log_resource_idx ON audit_log (target_resource_type, target_resource_id)',
				reason: 'Resource access tracking optimization',
			},

			// Status and outcome queries
			{
				name: 'audit_log_status_timestamp_idx',
				sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_log_status_timestamp_idx ON audit_log (status, timestamp)',
				reason: 'Failure analysis and monitoring optimization',
			},

			// Compliance queries
			{
				name: 'audit_log_classification_retention_idx',
				sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_log_classification_retention_idx ON audit_log (data_classification, retention_policy)',
				reason: 'Compliance and data governance optimization',
			},

			// Correlation tracking
			{
				name: 'audit_log_correlation_idx',
				sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_log_correlation_idx ON audit_log (correlation_id) WHERE correlation_id IS NOT NULL',
				reason: 'Request correlation tracking optimization',
			},

			// JSONB details search
			{
				name: 'audit_log_details_gin_idx',
				sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_log_details_gin_idx ON audit_log USING gin (details)',
				reason: 'JSON details search optimization',
			},

			// Hash verification
			{
				name: 'audit_log_hash_idx',
				sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_log_hash_idx ON audit_log USING hash (hash)',
				reason: 'Integrity verification optimization',
			},
		]

		for (const index of indexes) {
			try {
				await this.db.execute(sql.raw(index.sql))
				this.logger.info(`Created index: ${index.name} - ${index.reason}`)
			} catch (error) {
				this.logger.error(`Failed to create index ${index.name}:`, {
					error: {
						name: (error as Error).name,
						message: (error as Error).message,
						stack: (error as Error).stack,
					},
				})
			}
		}
	}

	/**
	 * Monitor index performance and health
	 */
	async monitorIndexHealth(): Promise<{
		healthy: number
		degraded: number
		critical: number
		recommendations: string[]
	}> {
		const stats = await this.analyzeIndexUsage()
		let healthy = 0
		let degraded = 0
		let critical = 0
		const recommendations: string[] = []

		for (const index of stats) {
			if (index.efficiency > 0.8 && index.scans > 100) {
				healthy++
			} else if (index.efficiency > 0.3 || index.scans > 10) {
				degraded++
				recommendations.push(
					`Consider optimizing ${index.indexName} (efficiency: ${index.efficiency}%)`
				)
			} else {
				critical++
				recommendations.push(
					`${index.indexName} is unused or highly inefficient - consider dropping`
				)
			}
		}

		return { healthy, degraded, critical, recommendations }
	}

	/**
	 * Stop periodic analysis and cleanup
	 */
	destroy(): void {
		if (this.analysisTimer) {
			clearInterval(this.analysisTimer)
			this.analysisTimer = null
		}
		this.logger.info('Index manager destroyed')
	}

	/**
	 * Analyze slow queries to identify missing indexes
	 */
	private async analyzeSlowQueries(): Promise<QueryPattern[]> {
		try {
			// This would typically query pg_stat_statements
			// For now, we'll return common patterns we know about
			return [
				{
					query: 'SELECT * FROM audit_log WHERE organization_id = ? AND timestamp BETWEEN ? AND ?',
					frequency: 1000,
					averageExecutionTime: 250,
					missingIndexes: ['organization_id_timestamp'],
					suggestedIndexes: [
						{
							type: 'create',
							tableName: 'audit_log',
							columns: ['organization_id', 'timestamp'],
							indexType: 'btree',
							reason: 'Frequent organization time-range queries',
							estimatedImpact: 'high',
							priority: 1,
							sqlCommand:
								'CREATE INDEX CONCURRENTLY audit_log_org_time_idx ON audit_log (organization_id, timestamp)',
						},
					],
				},
			]
		} catch (error) {
			this.logger.error('Failed to analyze slow queries:', {
				error: {
					name: (error as Error).name,
					message: (error as Error).message,
					stack: (error as Error).stack,
				},
			})
			return []
		}
	}

	/**
	 * Generate proactive recommendations for audit log patterns
	 */
	private generateAuditLogRecommendations(): IndexRecommendation[] {
		return [
			{
				type: 'create',
				tableName: 'audit_log',
				columns: ['timestamp'],
				indexType: 'brin',
				reason: 'BRIN index for time-series data compression',
				estimatedImpact: 'medium',
				priority: 2,
				sqlCommand:
					'CREATE INDEX CONCURRENTLY audit_log_timestamp_brin_idx ON audit_log USING brin (timestamp)',
			},
			{
				type: 'create',
				tableName: 'audit_log',
				columns: ['event_version', 'timestamp'],
				indexType: 'btree',
				reason: 'Version-specific audit queries',
				estimatedImpact: 'low',
				priority: 4,
				sqlCommand:
					'CREATE INDEX CONCURRENTLY audit_log_version_time_idx ON audit_log (event_version, timestamp)',
			},
		]
	}

	/**
	 * Execute a single index recommendation
	 */
	private async executeRecommendation(recommendation: IndexRecommendation): Promise<void> {
		this.runningOperations++

		try {
			// Validate recommendation before execution
			if (!this.validateRecommendation(recommendation)) {
				throw new Error(`Invalid recommendation: ${recommendation.reason}`)
			}

			// Execute based on auto-configuration
			if (recommendation.type === 'create' && this.config.enableAutoCreation) {
				await this.db.execute(sql.raw(recommendation.sqlCommand))
			} else if (recommendation.type === 'drop' && this.config.enableAutoDrop) {
				await this.db.execute(sql.raw(recommendation.sqlCommand))
			} else if (recommendation.type === 'optimize') {
				await this.db.execute(sql.raw(recommendation.sqlCommand))
			} else {
				this.logger.info(
					`Skipping recommendation (auto-execution disabled): ${recommendation.type}`
				)
			}
		} finally {
			this.runningOperations--

			// Process queued operations
			if (
				this.indexOperationsQueue.length > 0 &&
				this.runningOperations < this.config.maxConcurrentIndexOps
			) {
				const nextOperation = this.indexOperationsQueue.shift()
				if (nextOperation) {
					this.executeRecommendation(nextOperation).catch((error) => {
						this.logger.error('Failed to execute queued index operation:', {
							error: {
								name: (error as Error).name,
								message: (error as Error).message,
								stack: (error as Error).stack,
							},
						})
					})
				}
			}
		}
	}

	/**
	 * Validate recommendation before execution
	 */
	private validateRecommendation(recommendation: IndexRecommendation): boolean {
		// Basic validation
		if (!recommendation.tableName || !recommendation.sqlCommand) {
			return false
		}

		// Check if table exists
		// Additional validation logic would go here

		return true
	}

	/**
	 * Check if timestamp is older than configured threshold
	 */
	private isOlderThanThreshold(timestamp: Date): boolean {
		const thresholdMs = this.config.unusedThresholdDays * 24 * 60 * 60 * 1000
		return Date.now() - timestamp.getTime() > thresholdMs
	}

	/**
	 * Start periodic index analysis
	 */
	private startPeriodicAnalysis(): void {
		this.analysisTimer = setInterval(async () => {
			try {
				const recommendations = await this.generateIndexRecommendations()
				await this.executeRecommendations(recommendations)
			} catch (error) {
				this.logger.error('Periodic index analysis failed:', {
					error: {
						name: (error as Error).name,
						message: (error as Error).message,
						stack: (error as Error).stack,
					},
				})
			}
		}, this.config.analysisInterval)

		this.logger.info('Started periodic index analysis', {
			interval: this.config.analysisInterval,
		})
	}
}

/**
 * Factory function for creating intelligent index manager
 */
export function createIntelligentIndexManager(
	db: PostgresJsDatabase<typeof schema>,
	config: Partial<IndexOptimizationConfig> = {}
): IntelligentIndexManager {
	const defaultConfig: IndexOptimizationConfig = {
		enableAutoCreation: false, // Conservative default
		enableAutoDrop: false, // Conservative default
		unusedThresholdDays: 30,
		minUsageScans: 10,
		analysisInterval: 86400000, // 24 hours
		maxConcurrentIndexOps: 2,
	}

	return new IntelligentIndexManager(db, { ...defaultConfig, ...config })
}
