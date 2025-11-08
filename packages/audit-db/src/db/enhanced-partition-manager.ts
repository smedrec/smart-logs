/**
 * Enhanced partition manager with race condition prevention and robust error handling
 * Implements IPartitionManager interface following dependency injection principles
 */

import { sql } from 'drizzle-orm'

import { LoggingConfig, StructuredLogger } from '@repo/logs'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Redis as RedisType } from 'ioredis'
import type { IPartitionManager, PartitionConfig, PartitionStatus } from './interfaces.js'
import type * as schema from './schema.js'

export interface PartitionInfo {
	tableName: string
	partitionName: string
	partitionType: string
	partitionExpression: string
	createdAt: Date
	recordCount?: number
	sizeBytes?: number
}

export interface PartitionLock {
	key: string
	acquired: boolean
	expiresAt: Date
}

/**
 * Enhanced database partition manager with concurrency control and robust error handling
 */
export class EnhancedPartitionManager implements IPartitionManager {
	private readonly lockPrefix = 'partition_lock:'
	private readonly lockTimeout = 30000 // 30 seconds
	private readonly logger: StructuredLogger

	constructor(
		private db: PostgresJsDatabase<typeof schema>,
		private redis: RedisType,
		loggerConfig: LoggingConfig
	) {
		// Initialize Structured Logger
		this.logger = new StructuredLogger({
			...loggerConfig,
			service: '@repo/audit-db - EnhancedPartitionManager',
		})
	}

	/**
	 * Create partition with distributed locking to prevent race conditions
	 */
	async createPartition(tableName: string, startDate: Date, endDate: Date): Promise<void> {
		const partitionName = this.generatePartitionName(tableName, startDate)
		const lockKey = `${this.lockPrefix}${partitionName}`

		const lock = await this.acquireLock(lockKey)
		if (!lock.acquired) {
			this.logger.warn(`Failed to acquire lock for partition creation: ${partitionName}`)
			return
		}

		try {
			// Check if partition already exists (idempotent operation)
			const exists = await this.partitionExists(partitionName)
			if (exists) {
				this.logger.info(`Partition ${partitionName} already exists, skipping creation`)
				return
			}

			// Create partition with error handling
			await this.createPartitionTable(tableName, partitionName, startDate, endDate)

			// Create optimized indexes
			await this.createPartitionIndexes(partitionName)

			// Update partition metadata
			await this.updatePartitionMetadata(partitionName, startDate, endDate)

			this.logger.info(`Successfully created partition: ${partitionName}`)
		} catch (error) {
			this.logger.error(`Failed to create partition ${partitionName}:`, {
				error:
					error instanceof Error
						? { name: error.name, message: error.message, stack: error.stack }
						: `Failed to create partition ${partitionName}:`,
			})
			throw error
		} finally {
			await this.releaseLock(lockKey)
		}
	}

	/**
	 * Drop old partitions based on retention policy
	 */
	async dropExpiredPartitions(retentionDays: number): Promise<string[]> {
		const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
		const droppedPartitions: string[] = []

		// Get list of partitions older than retention period
		const result = await this.db.execute(sql`
			SELECT 
				schemaname,
				tablename,
				pg_get_expr(c.relpartbound, c.oid) as partition_expression
			FROM pg_tables t
			JOIN pg_class c ON c.relname = t.tablename
			WHERE t.tablename LIKE 'audit_log_%'
			AND t.schemaname = 'public'
			AND c.relispartition = true
		`)

		for (const row of result) {
			const tableName = row.tablename as string
			const partitionExpr = row.partition_expression as string

			// Parse partition expression to get date range
			const dateMatch = partitionExpr.match(/FROM \('([^']+)'\) TO \('([^']+)'\)/)
			if (dateMatch) {
				const partitionEndDate = new Date(dateMatch[2])
				if (partitionEndDate < cutoffDate) {
					//await this.db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(tableName)}`)
					await this.dropPartition(tableName)
					droppedPartitions.push(tableName)
				}
			}
		}

		return droppedPartitions
	}

	/**
	 * Drop partition with safety checks
	 */
	async dropPartition(partitionName: string): Promise<void> {
		const lockKey = `${this.lockPrefix}${partitionName}_drop`

		const lock = await this.acquireLock(lockKey)
		if (!lock.acquired) {
			this.logger.warn(`Failed to acquire lock for partition drop: ${partitionName}`)
			return
		}

		try {
			// Verify partition is safe to drop (no recent activity)
			const safeToDrops = await this.isPartitionSafeToDrop(partitionName)
			if (!safeToDrops) {
				this.logger.warn(`Partition ${partitionName} has recent activity, skipping drop`)
				return
			}

			// Create backup of partition data if needed
			await this.backupPartitionData(partitionName)

			// Drop the partition
			await this.db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(partitionName)}`)

			// Clean up metadata
			await this.cleanupPartitionMetadata(partitionName)

			this.logger.info(`Successfully dropped partition: ${partitionName}`)
		} catch (error) {
			this.logger.error(`Failed to drop partition ${partitionName}:`, {
				error:
					error instanceof Error
						? { name: error.name, message: error.message, stack: error.stack }
						: `Failed to drop partition ${partitionName}`,
			})
			throw error
		} finally {
			await this.releaseLock(lockKey)
		}
	}

	/**
	 * Optimize partition with index maintenance and statistics update
	 */
	async optimize(partitionName: string): Promise<void> {
		const lockKey = `${this.lockPrefix}${partitionName}_optimize`

		const lock = await this.acquireLock(lockKey)
		if (!lock.acquired) {
			this.logger.warn(`Failed to acquire lock for partition optimization: ${partitionName}`)
			return
		}

		try {
			// Update table statistics
			await this.db.execute(sql`ANALYZE ${sql.identifier(partitionName)}`)

			// Reindex if needed
			await this.optimizePartitionIndexes(partitionName)

			// Update optimization timestamp
			await this.updateOptimizationTimestamp(partitionName)

			this.logger.info(`Successfully optimized partition: ${partitionName}`)
		} catch (error) {
			this.logger.error(`Failed to optimize partition ${partitionName}:`, {
				error:
					error instanceof Error
						? { name: error.name, message: error.message, stack: error.stack }
						: `Failed to optimize partition ${partitionName}`,
			})
			throw error
		} finally {
			await this.releaseLock(lockKey)
		}
	}

	/**
	 * Get comprehensive partition status
	 */
	async getPartitionStatus(): Promise<PartitionStatus[]> {
		try {
			const result = await this.db.execute(sql`
				SELECT 
					t.tablename as partition_name,
					'audit_log' as table_name,
					CASE WHEN c.relispartition THEN true ELSE false END as healthy,
					COALESCE(s.n_tup_ins + s.n_tup_upd + s.n_tup_del, 0) as record_count,
					COALESCE(pg_total_relation_size(c.oid), 0) as size_bytes,
					COALESCE(s.last_analyze, s.last_autoanalyze, NOW() - INTERVAL '1 year') as last_optimized
				FROM pg_tables t
				JOIN pg_class c ON c.relname = t.tablename
				LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename
				WHERE t.tablename LIKE 'audit_log_%'
				AND t.schemaname = 'public'
				AND c.relispartition = true
				ORDER BY t.tablename
			`)

			return result.map((row) => ({
				name: row.partition_name as string,
				tableName: row.table_name as string,
				healthy: row.healthy as boolean,
				recordCount: Number(row.record_count) || 0,
				sizeBytes: Number(row.size_bytes) || 0,
				lastOptimized: new Date(row.last_optimized as string),
			}))
		} catch (error) {
			this.logger.error('Failed to get partition status:', {
				error:
					error instanceof Error
						? { name: error.name, message: error.message, stack: error.stack }
						: 'Failed to get partition status',
			})
			throw error
		}
	}

	/**
	 * Create time-based partitions with enhanced error handling
	 */
	async createAuditLogPartitions(config: Partial<PartitionConfig>): Promise<void> {
		const { strategy, interval = 'monthly', retentionDays = 2555 } = config

		if (strategy !== 'range') {
			throw new Error('Only range partitioning is supported for audit_log table')
		}

		try {
			// Initialize partitioned table if needed
			await this.initializePartitionedTable()

			// Calculate partitions needed
			const partitionsToCreate = this.calculatePartitionsNeeded(interval, retentionDays)

			// Create partitions with proper error handling
			for (const partition of partitionsToCreate) {
				try {
					await this.createPartition('audit_log', partition.startDate, partition.endDate)
				} catch (error) {
					this.logger.error(`Failed to create partition ${partition.name}:`, {
						error:
							error instanceof Error
								? { name: error.name, message: error.message, stack: error.stack }
								: `Failed to create partition ${partition.name}`,
					})
					// Continue with other partitions
				}
			}

			this.logger.info(`Successfully processed ${partitionsToCreate.length} partitions`)
		} catch (error) {
			this.logger.error('Failed to create audit log partitions:', {
				error:
					error instanceof Error
						? { name: error.name, message: error.message, stack: error.stack }
						: 'Failed to create audit log partitions',
			})
			throw error
		}
	}

	/**
	 * Analyze partition performance and suggest optimizations
	 */
	async analyzePartitionPerformance(): Promise<{
		totalPartitions: number
		totalSize: number
		totalRecords: number
		averagePartitionSize: number
		recommendations: string[]
	}> {
		const partitions = await this.getPartitionStatus()
		const recommendations: string[] = []

		const totalPartitions = partitions.length
		const totalSize = partitions.reduce((sum, p) => sum + (p.sizeBytes || 0), 0)
		const totalRecords = partitions.reduce((sum, p) => sum + (p.recordCount || 0), 0)
		const averagePartitionSize = totalSize / totalPartitions

		// Generate recommendations
		if (totalPartitions > 50) {
			recommendations.push(
				'Consider increasing partition interval or implementing partition pruning'
			)
		}

		if (averagePartitionSize > 1024 * 1024 * 1024) {
			// > 1GB average
			recommendations.push('Large partition sizes detected - consider smaller partition intervals')
		}

		const emptyPartitions = partitions.filter((p) => (p.recordCount || 0) === 0).length
		if (emptyPartitions > 5) {
			recommendations.push(`${emptyPartitions} empty partitions found - consider cleanup`)
		}

		return {
			totalPartitions,
			totalSize,
			totalRecords,
			averagePartitionSize,
			recommendations,
		}
	}

	/**
	 * Acquire distributed lock with timeout
	 */
	private async acquireLock(key: string): Promise<PartitionLock> {
		try {
			const lockValue = `${Date.now()}-${Math.random()}`
			const result = await this.redis.set(
				key,
				lockValue,
				'EX',
				Math.floor(this.lockTimeout / 1000),
				'NX'
			)

			return {
				key,
				acquired: result === 'OK',
				expiresAt: new Date(Date.now() + this.lockTimeout),
			}
		} catch (error) {
			this.logger.error(`Failed to acquire lock ${key}:`, {
				error:
					error instanceof Error
						? { name: error.name, message: error.message, stack: error.stack }
						: `Failed to acquire lock ${key}`,
			})
			return { key, acquired: false, expiresAt: new Date() }
		}
	}

	/**
	 * Release distributed lock
	 */
	private async releaseLock(key: string): Promise<void> {
		try {
			await this.redis.del(key)
		} catch (error) {
			this.logger.error(`Failed to release lock ${key}:`, {
				error:
					error instanceof Error
						? { name: error.name, message: error.message, stack: error.stack }
						: `Failed to release lock ${key}`,
			})
		}
	}

	/**
	 * Check if partition exists
	 */
	private async partitionExists(partitionName: string): Promise<boolean> {
		try {
			const result = await this.db.execute(sql`
				SELECT EXISTS (
					SELECT 1 FROM pg_tables 
					WHERE tablename = ${partitionName} 
					AND schemaname = 'public'
				) as exists
			`)
			return (result[0]?.exists as boolean) || false
		} catch (error) {
			this.logger.error(`Failed to check partition existence ${partitionName}:`, {
				error:
					error instanceof Error
						? { name: error.name, message: error.message, stack: error.stack }
						: `Failed to check partition existence ${partitionName}`,
			})
			return false
		}
	}

	/**
	 * Create partition table with optimized structure
	 */
	private async createPartitionTable(
		tableName: string,
		partitionName: string,
		startDate: Date,
		endDate: Date
	): Promise<void> {
		const startDateStr = startDate.toISOString().split('T')[0]
		const endDateStr = endDate.toISOString().split('T')[0]

		await this.db.execute(sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(partitionName)} 
			PARTITION OF ${sql.identifier(tableName)}
			FOR VALUES FROM (${startDateStr}) TO (${endDateStr})
		`)
	}

	/**
	 * Create optimized indexes with error handling
	 */
	private async createPartitionIndexes(partitionName: string): Promise<void> {
		const indexes = [
			// Primary performance indexes
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${partitionName}_id_idx ON ${partitionName} (id)`,
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${partitionName}_timestamp_idx ON ${partitionName} (timestamp)`,
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${partitionName}_principal_id_idx ON ${partitionName} (principal_id)`,
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${partitionName}_organization_id_idx ON ${partitionName} (organization_id)`,
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${partitionName}_action_idx ON ${partitionName} (action)`,
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${partitionName}_status_idx ON ${partitionName} (status)`,

			// Composite indexes for common query patterns
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${partitionName}_org_timestamp_idx ON ${partitionName} (organization_id, timestamp)`,
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${partitionName}_principal_action_idx ON ${partitionName} (principal_id, action)`,
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${partitionName}_resource_type_id_idx ON ${partitionName} (target_resource_type, target_resource_id)`,

			// JSONB index for details column
			`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${partitionName}_details_gin_idx ON ${partitionName} USING gin (details)`,
		]

		for (const indexSql of indexes) {
			try {
				await this.db.execute(sql.raw(indexSql))
			} catch (error) {
				this.logger.warn(`Failed to create index: ${indexSql}`, {
					error:
						error instanceof Error
							? { name: error.name, message: error.message, stack: error.stack }
							: `Failed to create index: ${indexSql}`,
				})
				// Continue with other indexes
			}
		}
	}

	/**
	 * Generate standardized partition name
	 */
	private generatePartitionName(tableName: string, startDate: Date): string {
		const year = startDate.getFullYear()
		const month = String(startDate.getMonth() + 1).padStart(2, '0')
		return `${tableName}_${year}_${month}`
	}

	/**
	 * Calculate partitions needed based on configuration
	 */
	private calculatePartitionsNeeded(
		interval: 'monthly' | 'quarterly' | 'yearly',
		retentionDays: number
	): Array<{ name: string; startDate: Date; endDate: Date }> {
		const partitions: Array<{ name: string; startDate: Date; endDate: Date }> = []
		const now = new Date()
		const startDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)
		const endDate = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000) // 6 months ahead

		let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

		while (currentDate < endDate) {
			let nextDate: Date
			let partitionName: string

			switch (interval) {
				case 'monthly':
					nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
					partitionName = this.generatePartitionName('audit_log', currentDate)
					break
				case 'quarterly':
					const quarter = Math.floor(currentDate.getMonth() / 3) + 1
					nextDate = new Date(currentDate.getFullYear(), quarter * 3, 1)
					partitionName = `audit_log_${currentDate.getFullYear()}_q${quarter}`
					break
				case 'yearly':
					nextDate = new Date(currentDate.getFullYear() + 1, 0, 1)
					partitionName = `audit_log_${currentDate.getFullYear()}`
					break
				default:
					throw new Error(`Unsupported interval: ${interval}`)
			}

			partitions.push({
				name: partitionName,
				startDate: new Date(currentDate),
				endDate: nextDate,
			})

			currentDate = nextDate
		}

		return partitions
	}

	/**
	 * Initialize partitioned audit_log table with enhanced configuration
	 */
	private async initializePartitionedTable(): Promise<void> {
		try {
			// Create the partitioned table if it doesn't exist
			await this.db.execute(sql`
				CREATE TABLE IF NOT EXISTS audit_log (
					id serial,
					timestamp timestamp with time zone NOT NULL,
					ttl varchar(255),
					principal_id varchar(255),
					organization_id varchar(255),
					action varchar(255) NOT NULL,
					target_resource_type varchar(255),
					target_resource_id varchar(255),
					status varchar(50) NOT NULL,
					outcome_description text,
					hash varchar(64),
					hash_algorithm varchar(50) DEFAULT 'SHA-256',
					event_version varchar(20) DEFAULT '1.0',
					correlation_id varchar(255),
					data_classification varchar(20) DEFAULT 'INTERNAL',
					retention_policy varchar(50) DEFAULT 'standard',
					processing_latency integer,
					archived_at timestamp with time zone,
					details jsonb
				) PARTITION BY RANGE (timestamp)
			`)

			// Create partition management functions
			await this.createPartitionManagementFunctions()

			this.logger.info('Partitioned audit_log table initialized successfully')
		} catch (error) {
			this.logger.error('Failed to initialize partitioned table:', {
				error:
					error instanceof Error
						? { name: error.name, message: error.message, stack: error.stack }
						: 'Failed to initialize partitioned table',
			})
			throw error
		}
	}

	/**
	 * Create enhanced partition management functions
	 */
	private async createPartitionManagementFunctions(): Promise<void> {
		// Enhanced function with better error handling
		await this.db.execute(sql`
			CREATE OR REPLACE FUNCTION create_audit_log_partitions()
			RETURNS json AS $$
			DECLARE
				start_date date;
				end_date date;
				partition_name text;
				created_partitions text[] := '{}';
				error_partitions text[] := '{}';
			BEGIN
				-- Create partitions for current month and next 6 months
				FOR i IN 0..6 LOOP
					BEGIN
						start_date := date_trunc('month', CURRENT_DATE + (i || ' months')::interval);
						end_date := start_date + interval '1 month';
						partition_name := 'audit_log_' || to_char(start_date, 'YYYY_MM');
						
						-- Create partition if it doesn't exist
						EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
							partition_name, start_date, end_date);
						
						created_partitions := array_append(created_partitions, partition_name);
					EXCEPTION
						WHEN OTHERS THEN
							error_partitions := array_append(error_partitions, partition_name || ':' || SQLERRM);
					END;
				END LOOP;
				
				RETURN json_build_object(
					'created', created_partitions,
					'errors', error_partitions,
					'timestamp', NOW()
				);
			END;
			$$ LANGUAGE plpgsql;
		`)
	}

	/**
	 * Safety checks for partition operations
	 */
	private async isPartitionSafeToDrop(partitionName: string): Promise<boolean> {
		try {
			// Check for recent activity (last 24 hours)
			const result = await this.db.execute(sql`
				SELECT COUNT(*) as recent_activity
				FROM pg_stat_user_tables 
				WHERE relname = ${partitionName}
				AND (n_tup_ins + n_tup_upd + n_tup_del) > 0
				AND last_analyze > NOW() - INTERVAL '24 hours'
			`)

			return Number(result[0]?.recent_activity || 0) === 0
		} catch (error) {
			this.logger.error(`Failed to check partition safety ${partitionName}:`, {
				error:
					error instanceof Error
						? { name: error.name, message: error.message, stack: error.stack }
						: `Failed to check partition safety ${partitionName}`,
			})
			return false
		}
	}

	/**
	 * Backup partition data before dropping
	 */
	private async backupPartitionData(partitionName: string): Promise<void> {
		// Implementation for backup strategy
		// This could involve exporting to S3, another database, etc.
		this.logger.info(`Backup strategy for partition ${partitionName} - implement as needed`)
	}

	/**
	 * Update partition metadata
	 */
	private async updatePartitionMetadata(
		partitionName: string,
		startDate: Date,
		endDate: Date
	): Promise<void> {
		const metadata = {
			partition_name: partitionName,
			start_date: startDate.toISOString(),
			end_date: endDate.toISOString(),
			created_at: new Date().toISOString(),
		}

		await this.redis.hset(`partition:metadata:${partitionName}`, metadata)
	}

	/**
	 * Clean up partition metadata
	 */
	private async cleanupPartitionMetadata(partitionName: string): Promise<void> {
		await this.redis.del(`partition:metadata:${partitionName}`)
	}

	/**
	 * Optimize partition indexes
	 */
	private async optimizePartitionIndexes(partitionName: string): Promise<void> {
		try {
			await this.db.execute(sql`REINDEX TABLE ${sql.identifier(partitionName)}`)
		} catch (error) {
			this.logger.warn(`Failed to reindex partition ${partitionName}:`, {
				error:
					error instanceof Error
						? { name: error.name, message: error.message, stack: error.stack }
						: `Failed to reindex partition ${partitionName}`,
			})
		}
	}

	/**
	 * Update optimization timestamp
	 */
	private async updateOptimizationTimestamp(partitionName: string): Promise<void> {
		await this.redis.hset(
			`partition:metadata:${partitionName}`,
			'last_optimized',
			new Date().toISOString()
		)
	}
}

/**
 * Partition maintenance scheduler
 */
export class PartitionMaintenanceScheduler {
	private intervalId: NodeJS.Timeout | null = null

	constructor(
		private partitionManager: EnhancedPartitionManager,
		private config: {
			maintenanceInterval: number // in milliseconds
			retentionDays: number
			autoCreatePartitions: boolean
			autoDropPartitions: boolean
		}
	) {}

	/**
	 * Start automatic partition maintenance
	 */
	start(): void {
		if (this.intervalId) {
			return // Already running
		}

		this.intervalId = setInterval(async () => {
			try {
				await this.performMaintenance()
			} catch (error) {
				console.error('Partition maintenance failed:', error)
			}
		}, this.config.maintenanceInterval)

		console.log('Partition maintenance scheduler started')
	}

	/**
	 * Stop automatic partition maintenance
	 */
	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = null
			console.log('Partition maintenance scheduler stopped')
		}
	}

	/**
	 * Perform maintenance tasks
	 */
	private async performMaintenance(): Promise<void> {
		if (this.config.autoCreatePartitions) {
			await this.partitionManager.createAuditLogPartitions({
				strategy: 'range' as const,
				partitionColumn: 'timestamp',
				interval: 'monthly',
				retentionDays: this.config.retentionDays,
			})
		}

		if (this.config.autoDropPartitions) {
			const droppedPartitions = await this.partitionManager.dropExpiredPartitions(
				this.config.retentionDays
			)
			if (droppedPartitions.length > 0) {
				console.log(`Dropped expired partitions: ${droppedPartitions.join(', ')}`)
			}
		}

		// Log partition statistics
		const stats = await this.partitionManager.analyzePartitionPerformance()
		console.log('Partition statistics:', {
			totalPartitions: stats.totalPartitions,
			totalSizeGB: (stats.totalSize / (1024 * 1024 * 1024)).toFixed(2),
			totalRecords: stats.totalRecords,
			recommendations: stats.recommendations,
		})
	}
}
