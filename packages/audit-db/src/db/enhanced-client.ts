import { EnhancedDatabaseClient } from './connection-pool.js'
import { DatabasePartitionManager, PartitionMaintenanceScheduler } from './partitioning.js'
import { DatabasePerformanceMonitor } from './performance-monitoring.js'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { ConnectionPoolConfig, QueryCacheConfig } from './connection-pool.js'
import type * as schema from './schema.js'

/**
 * Enhanced database client integrating all performance optimizations
 * Requirements 7.1, 7.2, 7.3, 7.4: Complete database performance optimization integration
 */

export interface EnhancedClientConfig {
	/** Connection pool configuration */
	connectionPool: ConnectionPoolConfig
	/** Query cache configuration */
	queryCache: QueryCacheConfig
	/** Partition management configuration */
	partitioning: {
		enabled: boolean
		strategy: 'range' | 'hash' | 'list'
		interval: 'monthly' | 'quarterly' | 'yearly'
		retentionDays: number
		autoMaintenance: boolean
		maintenanceInterval: number
	}
	/** Performance monitoring configuration */
	monitoring: {
		enabled: boolean
		slowQueryThreshold: number
		metricsRetentionDays: number
		autoOptimization: boolean
	}
}

export interface PerformanceReport {
	timestamp: Date
	connectionPool: {
		totalConnections: number
		activeConnections: number
		averageAcquisitionTime: number
		successRate: number
	}
	queryCache: {
		hitRatio: number
		totalSizeMB: number
		evictions: number
	}
	partitions: {
		totalPartitions: number
		totalSizeGB: number
		recommendations: string[]
	}
	performance: {
		slowQueries: number
		unusedIndexes: number
		cacheHitRatio: number
		suggestions: string[]
	}
}

/**
 * Enhanced audit database client with comprehensive performance optimizations
 */
export class EnhancedAuditDatabaseClient {
	private client: EnhancedDatabaseClient
	private partitionManager: DatabasePartitionManager
	private performanceMonitor: DatabasePerformanceMonitor
	private partitionScheduler?: PartitionMaintenanceScheduler
	private performanceReportInterval?: NodeJS.Timeout
	private config: EnhancedClientConfig

	constructor(config: EnhancedClientConfig) {
		this.config = config

		// Initialize enhanced database client with connection pooling and caching
		this.client = new EnhancedDatabaseClient(config.connectionPool, config.queryCache)

		// Initialize partition manager
		this.partitionManager = new DatabasePartitionManager(this.client.getDatabase())

		// Initialize performance monitor
		this.performanceMonitor = new DatabasePerformanceMonitor(this.client.getDatabase())

		this.initialize()
	}

	/**
	 * Initialize all performance optimization components
	 */
	private async initialize(): Promise<void> {
		try {
			// Enable performance monitoring
			if (this.config.monitoring.enabled) {
				await this.performanceMonitor.enableMonitoring()
				console.log('Performance monitoring enabled')
			}

			// Setup partitioning
			if (this.config.partitioning.enabled) {
				await this.setupPartitioning()
			}

			// Setup automatic performance reporting
			if (this.config.monitoring.enabled) {
				this.setupPerformanceReporting()
			}

			console.log('Enhanced audit database client initialized successfully')
		} catch (error) {
			console.error('Failed to initialize enhanced database client:', error)
			throw error
		}
	}

	/**
	 * Setup database partitioning
	 */
	private async setupPartitioning(): Promise<void> {
		// Create partition management functions
		await this.partitionManager.createPartitionManagementFunctions()

		// Create initial partitions
		await this.partitionManager.createAuditLogPartitions({
			strategy: this.config.partitioning.strategy,
			partitionColumn: 'timestamp',
			interval: this.config.partitioning.interval,
			retentionDays: this.config.partitioning.retentionDays,
		})

		// Setup automatic partition maintenance
		if (this.config.partitioning.autoMaintenance) {
			this.partitionScheduler = new PartitionMaintenanceScheduler(this.partitionManager, {
				maintenanceInterval: this.config.partitioning.maintenanceInterval,
				retentionDays: this.config.partitioning.retentionDays,
				autoCreatePartitions: true,
				autoDropPartitions: true,
			})
			this.partitionScheduler.start()
			console.log('Automatic partition maintenance enabled')
		}
	}

	/**
	 * Setup automatic performance reporting
	 */
	private setupPerformanceReporting(): void {
		const reportInterval = 5 * 60 * 1000 // 5 minutes

		this.performanceReportInterval = setInterval(async () => {
			try {
				const report = await this.generatePerformanceReport()
				this.handlePerformanceReport(report)
			} catch (error) {
				console.error('Failed to generate performance report:', error)
			}
		}, reportInterval)
	}

	/**
	 * Get the database instance
	 */
	getDatabase(): PostgresJsDatabase<typeof schema> {
		return this.client.getDatabase()
	}

	/**
	 * Execute query with full optimization stack
	 */
	async executeOptimizedQuery<T>(
		queryFn: (db: PostgresJsDatabase<typeof schema>) => Promise<T>,
		options?: {
			cacheKey?: string
			cacheTTL?: number
			skipCache?: boolean
		}
	): Promise<T> {
		const { cacheKey, cacheTTL, skipCache = false } = options || {}

		if (skipCache || !cacheKey) {
			return this.client.executeQueryUncached(queryFn)
		}

		return this.client.executeQuery(queryFn, cacheKey, cacheTTL)
	}

	/**
	 * Execute query with performance monitoring
	 */
	async executeMonitoredQuery<T>(
		queryFn: (db: PostgresJsDatabase<typeof schema>) => Promise<T>,
		queryName: string,
		options?: {
			cacheKey?: string
			cacheTTL?: number
		}
	): Promise<T> {
		const startTime = Date.now()
		const startMemory = process.memoryUsage().heapUsed

		try {
			const result = await this.executeOptimizedQuery(queryFn, options)

			// Record performance metrics
			const executionTime = Date.now() - startTime
			const memoryUsed = process.memoryUsage().heapUsed - startMemory

			this.performanceMonitor.recordQueryMetrics({
				queryId: `${queryName}_${Date.now()}`,
				query: queryName,
				executionTime,
				planningTime: 0, // Would need to extract from EXPLAIN
				totalTime: executionTime,
				rowsReturned: Array.isArray(result) ? result.length : 1,
				bufferHits: 0, // Would need to extract from pg_stat_statements
				bufferMisses: 0,
				timestamp: new Date(),
			})

			// Log slow queries
			if (executionTime > this.config.monitoring.slowQueryThreshold) {
				console.warn(`Slow query detected: ${queryName} took ${executionTime}ms`)
			}

			return result
		} catch (error) {
			console.error(`Query failed: ${queryName}`, error)
			throw error
		}
	}

	/**
	 * Invalidate cache for specific patterns
	 */
	invalidateCache(pattern: string): number {
		return this.client.invalidateCache(pattern)
	}

	/**
	 * Generate comprehensive performance report
	 */
	async generatePerformanceReport(): Promise<PerformanceReport> {
		const [clientStats, partitionStats, performanceSummary] = await Promise.all([
			this.client.getStats(),
			this.partitionManager.analyzePartitionPerformance(),
			this.performanceMonitor.getPerformanceSummary(),
		])

		return {
			timestamp: new Date(),
			connectionPool: {
				totalConnections: clientStats.connectionPool.totalConnections,
				activeConnections: clientStats.connectionPool.activeConnections,
				averageAcquisitionTime: clientStats.connectionPool.averageAcquisitionTime,
				successRate:
					clientStats.connectionPool.totalRequests > 0
						? (clientStats.connectionPool.successfulConnections /
								clientStats.connectionPool.totalRequests) *
							100
						: 0,
			},
			queryCache: {
				hitRatio: clientStats.queryCache.hitRatio,
				totalSizeMB: clientStats.queryCache.totalSizeMB,
				evictions: clientStats.queryCache.evictions,
			},
			partitions: {
				totalPartitions: partitionStats.totalPartitions,
				totalSizeGB: partitionStats.totalSize / (1024 * 1024 * 1024),
				recommendations: partitionStats.recommendations,
			},
			performance: {
				slowQueries: performanceSummary.slowQueries.length,
				unusedIndexes: performanceSummary.unusedIndexes.length,
				cacheHitRatio: performanceSummary.cacheHitRatio,
				suggestions: performanceSummary.indexSuggestions,
			},
		}
	}

	/**
	 * Handle performance report and take automatic actions
	 */
	private handlePerformanceReport(report: PerformanceReport): void {
		console.log('Performance Report:', {
			timestamp: report.timestamp,
			connectionPoolSuccessRate: `${report.connectionPool.successRate.toFixed(2)}%`,
			cacheHitRatio: `${report.queryCache.hitRatio.toFixed(2)}%`,
			totalPartitions: report.partitions.totalPartitions,
			slowQueries: report.performance.slowQueries,
		})

		// Automatic optimization actions
		if (this.config.monitoring.autoOptimization) {
			this.performAutoOptimizations(report)
		}

		// Alert on performance issues
		this.checkPerformanceAlerts(report)
	}

	/**
	 * Perform automatic optimizations based on performance report
	 */
	private async performAutoOptimizations(report: PerformanceReport): Promise<void> {
		try {
			// Clear cache if hit ratio is very low
			if (report.queryCache.hitRatio < 10 && report.queryCache.totalSizeMB > 50) {
				console.log('Low cache hit ratio detected, clearing cache')
				this.client['queryCache'].clear()
			}

			// Run maintenance if there are many slow queries
			if (report.performance.slowQueries > 10) {
				console.log('High number of slow queries detected, running maintenance')
				await this.performanceMonitor.runMaintenance()
			}

			// Suggest index creation for frequently slow queries
			if (report.performance.suggestions.length > 0) {
				console.log('Performance suggestions available:', report.performance.suggestions)
			}
		} catch (error) {
			console.error('Auto-optimization failed:', error)
		}
	}

	/**
	 * Check for performance alerts
	 */
	private checkPerformanceAlerts(report: PerformanceReport): void {
		const alerts: string[] = []

		// Connection pool alerts
		if (report.connectionPool.successRate < 95) {
			alerts.push(`Low connection success rate: ${report.connectionPool.successRate.toFixed(2)}%`)
		}

		if (report.connectionPool.averageAcquisitionTime > 1000) {
			alerts.push(
				`High connection acquisition time: ${report.connectionPool.averageAcquisitionTime}ms`
			)
		}

		// Cache alerts
		if (report.queryCache.hitRatio < 50 && report.queryCache.totalSizeMB > 10) {
			alerts.push(`Low cache hit ratio: ${report.queryCache.hitRatio.toFixed(2)}%`)
		}

		// Partition alerts
		if (report.partitions.totalPartitions > 100) {
			alerts.push(`High number of partitions: ${report.partitions.totalPartitions}`)
		}

		// Performance alerts
		if (report.performance.slowQueries > 20) {
			alerts.push(`High number of slow queries: ${report.performance.slowQueries}`)
		}

		if (report.performance.unusedIndexes > 10) {
			alerts.push(`Many unused indexes detected: ${report.performance.unusedIndexes}`)
		}

		// Log alerts
		if (alerts.length > 0) {
			console.warn('Performance Alerts:', alerts)
		}
	}

	/**
	 * Run comprehensive database optimization
	 */
	async optimizeDatabase(): Promise<{
		partitionOptimization: string[]
		indexOptimization: string[]
		maintenanceResults: {
			vacuumResults: string[]
			analyzeResults: string[]
			reindexResults: string[]
		}
		configOptimization: Array<{
			setting: string
			currentValue: string
			recommendedValue: string
			reason: string
		}>
	}> {
		console.log('Starting comprehensive database optimization...')

		const [partitionStats, maintenanceResults, configOptimization] = await Promise.all([
			this.partitionManager.analyzePartitionPerformance(),
			this.performanceMonitor.runMaintenance(),
			this.performanceMonitor.optimizeConfiguration(),
		])

		const indexSuggestions = await this.performanceMonitor.suggestMissingIndexes()

		console.log('Database optimization completed')

		return {
			partitionOptimization: partitionStats.recommendations,
			indexOptimization: indexSuggestions,
			maintenanceResults,
			configOptimization: configOptimization.recommendations,
		}
	}

	/**
	 * Get comprehensive health status
	 */
	async getHealthStatus(): Promise<{
		overall: 'healthy' | 'warning' | 'critical'
		components: {
			connectionPool: { status: string; details: any }
			queryCache: { status: string; details: any }
			partitions: { status: string; details: any }
			performance: { status: string; details: any }
		}
		recommendations: string[]
	}> {
		const [clientHealth, partitionStats, performanceSummary] = await Promise.all([
			this.client.healthCheck(),
			this.partitionManager.analyzePartitionPerformance(),
			this.performanceMonitor.getPerformanceSummary(),
		])

		const components = {
			connectionPool: {
				status: clientHealth.connectionPool.healthy ? 'healthy' : 'critical',
				details: clientHealth.connectionPool,
			},
			queryCache: {
				status: clientHealth.queryCache.hitRatio > 50 ? 'healthy' : 'warning',
				details: clientHealth.queryCache,
			},
			partitions: {
				status: partitionStats.recommendations.length === 0 ? 'healthy' : 'warning',
				details: {
					totalPartitions: partitionStats.totalPartitions,
					totalSizeGB: (partitionStats.totalSize / (1024 * 1024 * 1024)).toFixed(2),
				},
			},
			performance: {
				status: performanceSummary.slowQueries.length < 5 ? 'healthy' : 'warning',
				details: {
					slowQueries: performanceSummary.slowQueries.length,
					unusedIndexes: performanceSummary.unusedIndexes.length,
					cacheHitRatio: performanceSummary.cacheHitRatio,
				},
			},
		}

		// Determine overall status
		const statuses = Object.values(components).map((c) => c.status)
		const overall = statuses.includes('critical')
			? 'critical'
			: statuses.includes('warning')
				? 'warning'
				: 'healthy'

		// Collect all recommendations
		const recommendations = [
			...partitionStats.recommendations,
			...performanceSummary.indexSuggestions,
		]

		return {
			overall,
			components,
			recommendations,
		}
	}

	/**
	 * Close all connections and cleanup
	 */
	async close(): Promise<void> {
		console.log('Shutting down enhanced database client...')

		// Stop schedulers
		if (this.partitionScheduler) {
			this.partitionScheduler.stop()
		}

		if (this.performanceReportInterval) {
			clearInterval(this.performanceReportInterval)
		}

		// Disable monitoring
		this.performanceMonitor.disableMonitoring()

		// Close client connections
		await this.client.close()

		console.log('Enhanced database client shutdown complete')
	}
}

/**
 * Factory function to create enhanced client with default configuration
 */
export function createEnhancedAuditClient(
	databaseUrl: string,
	overrides?: Partial<EnhancedClientConfig>
): EnhancedAuditDatabaseClient {
	const defaultConfig: EnhancedClientConfig = {
		connectionPool: {
			url: databaseUrl,
			minConnections: 2,
			maxConnections: 20,
			idleTimeout: 30000,
			acquireTimeout: 10000,
			validateConnections: true,
			retryAttempts: 3,
			retryDelay: 1000,
		},
		queryCache: {
			enabled: true,
			maxSizeMB: 100,
			defaultTTL: 300, // 5 minutes
			maxQueries: 1000,
			keyPrefix: 'audit_cache',
		},
		partitioning: {
			enabled: true,
			strategy: 'range',
			interval: 'monthly',
			retentionDays: 2555, // 7 years
			autoMaintenance: true,
			maintenanceInterval: 24 * 60 * 60 * 1000, // Daily
		},
		monitoring: {
			enabled: true,
			slowQueryThreshold: 1000, // 1 second
			metricsRetentionDays: 30,
			autoOptimization: true,
		},
	}

	const config = {
		...defaultConfig,
		...overrides,
		connectionPool: { ...defaultConfig.connectionPool, ...overrides?.connectionPool },
		queryCache: { ...defaultConfig.queryCache, ...overrides?.queryCache },
		partitioning: { ...defaultConfig.partitioning, ...overrides?.partitioning },
		monitoring: { ...defaultConfig.monitoring, ...overrides?.monitoring },
	}

	return new EnhancedAuditDatabaseClient(config)
}
