/**
 * Database partitioning strategy for large audit datasets
 * Requirements 7.1, 7.3: Optimized database schema and data partitioning strategies
 */

import { sql } from 'drizzle-orm'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from './schema.js'

export interface PartitionConfig {
	/** Partition strategy type */
	strategy: 'range' | 'hash' | 'list'
	/** Column to partition on */
	partitionColumn: string
	/** Partition interval (for range partitioning) */
	interval?: 'monthly' | 'quarterly' | 'yearly'
	/** Number of partitions (for hash partitioning) */
	partitionCount?: number
	/** Retention period for old partitions in days */
	retentionDays: number
}

export interface PartitionInfo {
	tableName: string
	partitionName: string
	partitionType: string
	partitionExpression: string
	createdAt: Date
	recordCount?: number
	sizeBytes?: number
}

/**
 * Database partitioning manager for audit tables
 */
export class DatabasePartitionManager {
	constructor(private db: PostgresJsDatabase<typeof schema>) {}

	/**
	 * Create time-based partitions for audit_log table
	 * Partitions by month for optimal query performance and maintenance
	 */
	async createAuditLogPartitions(config: PartitionConfig): Promise<void> {
		const { strategy, interval = 'monthly', retentionDays } = config

		if (strategy !== 'range') {
			throw new Error('Only range partitioning is supported for audit_log table')
		}

		// Create parent table if not exists (should already exist from schema)
		await this.db.execute(sql`
			-- Ensure audit_log is partitioned by timestamp
			SELECT create_audit_log_partitions();
		`)

		// Create partitions for current and future periods
		const partitionsToCreate = this.calculatePartitionsNeeded(interval, retentionDays)

		for (const partition of partitionsToCreate) {
			await this.createPartition('audit_log', partition)
		}
	}

	/**
	 * Create a specific partition for a table
	 */
	private async createPartition(
		tableName: string,
		partition: { name: string; startDate: Date; endDate: Date }
	): Promise<void> {
		const { name, startDate, endDate } = partition

		const startDateStr = startDate.toISOString().split('T')[0]
		const endDateStr = endDate.toISOString().split('T')[0]

		await this.db.execute(sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(name)} 
			PARTITION OF ${sql.identifier(tableName)}
			FOR VALUES FROM (${startDateStr}) TO (${endDateStr});
		`)

		// Create indexes on the partition
		await this.createPartitionIndexes(name)
	}

	/**
	 * Create optimized indexes on partition tables
	 */
	private async createPartitionIndexes(partitionName: string): Promise<void> {
		const indexes = [
			// Primary performance indexes
			`CREATE INDEX IF NOT EXISTS ${partitionName}_id_idx ON ${partitionName} (id)`,
			`CREATE INDEX IF NOT EXISTS ${partitionName}_timestamp_idx ON ${partitionName} (timestamp)`,
			`CREATE INDEX IF NOT EXISTS ${partitionName}_principal_id_idx ON ${partitionName} (principal_id)`,
			`CREATE INDEX IF NOT EXISTS ${partitionName}_organization_id_idx ON ${partitionName} (organization_id)`,
			`CREATE INDEX IF NOT EXISTS ${partitionName}_action_idx ON ${partitionName} (action)`,
			`CREATE INDEX IF NOT EXISTS ${partitionName}_status_idx ON ${partitionName} (status)`,

			// Compliance query indexes
			`CREATE INDEX IF NOT EXISTS ${partitionName}_data_classification_idx ON ${partitionName} (data_classification)`,
			`CREATE INDEX IF NOT EXISTS ${partitionName}_retention_policy_idx ON ${partitionName} (retention_policy)`,
			`CREATE INDEX IF NOT EXISTS ${partitionName}_correlation_id_idx ON ${partitionName} (correlation_id)`,

			// Composite indexes for common query patterns
			`CREATE INDEX IF NOT EXISTS ${partitionName}_org_timestamp_idx ON ${partitionName} (organization_id, timestamp)`,
			`CREATE INDEX IF NOT EXISTS ${partitionName}_principal_action_idx ON ${partitionName} (principal_id, action)`,
			`CREATE INDEX IF NOT EXISTS ${partitionName}_classification_retention_idx ON ${partitionName} (data_classification, retention_policy)`,
			`CREATE INDEX IF NOT EXISTS ${partitionName}_resource_type_id_idx ON ${partitionName} (target_resource_type, target_resource_id)`,

			// Hash index for integrity verification
			`CREATE INDEX IF NOT EXISTS ${partitionName}_hash_idx ON ${partitionName} USING hash (hash)`,

			// JSONB indexes for details column
			`CREATE INDEX IF NOT EXISTS ${partitionName}_details_gin_idx ON ${partitionName} USING gin (details)`,
		]

		for (const indexSql of indexes) {
			try {
				await this.db.execute(sql.raw(indexSql))
			} catch (error) {
				console.warn(`Failed to create index: ${indexSql}`, error)
			}
		}
	}

	/**
	 * Calculate partitions needed based on interval and retention
	 */
	private calculatePartitionsNeeded(
		interval: 'monthly' | 'quarterly' | 'yearly',
		retentionDays: number
	): Array<{ name: string; startDate: Date; endDate: Date }> {
		const partitions: Array<{ name: string; startDate: Date; endDate: Date }> = []
		const now = new Date()
		const startDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)

		// Create partitions from retention start to 6 months in the future
		const endDate = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000)

		let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

		while (currentDate < endDate) {
			let nextDate: Date
			let partitionName: string

			switch (interval) {
				case 'monthly':
					nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
					partitionName = `audit_log_${currentDate.getFullYear()}_${String(currentDate.getMonth() + 1).padStart(2, '0')}`
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
					await this.db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(tableName)}`)
					droppedPartitions.push(tableName)
				}
			}
		}

		return droppedPartitions
	}

	/**
	 * Get partition information and statistics
	 */
	async getPartitionInfo(): Promise<PartitionInfo[]> {
		const result = await this.db.execute(sql`
			SELECT 
				t.schemaname,
				t.tablename,
				'RANGE' as partition_type,
				pg_get_expr(c.relpartbound, c.oid) as partition_expression,
				obj_description(c.oid) as description,
				pg_total_relation_size(c.oid) as size_bytes,
				(SELECT reltuples::bigint FROM pg_class WHERE relname = t.tablename) as record_count
			FROM pg_tables t
			JOIN pg_class c ON c.relname = t.tablename
			WHERE t.tablename LIKE 'audit_log_%'
			AND t.schemaname = 'public'
			AND c.relispartition = true
			ORDER BY t.tablename
		`)

		return result.map((row) => ({
			tableName: 'audit_log',
			partitionName: row.tablename as string,
			partitionType: row.partition_type as string,
			partitionExpression: row.partition_expression as string,
			createdAt: new Date(), // Would need to query pg_stat_user_tables for actual creation time
			recordCount: Number(row.record_count) || 0,
			sizeBytes: Number(row.size_bytes) || 0,
		}))
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
		const partitions = await this.getPartitionInfo()
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
	 * Initialize partitioned audit_log table
	 * This should be called once during database setup
	 */
	async initializePartitionedTable(): Promise<void> {
		// First, create the partitioned table if it doesn't exist
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
			) PARTITION BY RANGE (timestamp);
		`)

		// Create the partition management functions
		await this.createPartitionManagementFunctions()

		// Create initial partitions
		await this.db.execute(sql`SELECT create_audit_log_partitions();`)
	}

	/**
	 * Create database functions for partition management
	 */
	async createPartitionManagementFunctions(): Promise<void> {
		// Function to automatically create monthly partitions
		await this.db.execute(sql`
			CREATE OR REPLACE FUNCTION create_audit_log_partitions()
			RETURNS void AS $$$
			DECLARE
				start_date date;
				end_date date;
				partition_name text;
			BEGIN
				-- Create partitions for current month and next 6 months
				FOR i IN 0..6 LOOP
					start_date := date_trunc('month', CURRENT_DATE + (i || ' months')::interval);
					end_date := start_date + interval '1 month';
					partition_name := 'audit_log_' || to_char(start_date, 'YYYY_MM');
					
					-- Create partition if it doesn't exist
					EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
						partition_name, start_date, end_date);
				END LOOP;
			END;
			$$ LANGUAGE plpgsql;
		`)

		// Function to drop old partitions
		await this.db.execute(sql`
			CREATE OR REPLACE FUNCTION drop_old_audit_partitions(retention_days integer DEFAULT 2555)
			RETURNS text[] AS $$$
			DECLARE
				cutoff_date date;
				partition_record record;
				dropped_partitions text[] := '{}';
			BEGIN
				cutoff_date := CURRENT_DATE - retention_days;
				
				FOR partition_record IN
					SELECT tablename 
					FROM pg_tables 
					WHERE tablename LIKE 'audit_log_%' 
					AND schemaname = 'public'
				LOOP
					-- Extract date from partition name and check if it's older than cutoff
					IF partition_record.tablename ~ 'audit_log_[0-9]{4}_[0-9]{2}' THEN
						DECLARE
							partition_date date;
						BEGIN
							partition_date := to_date(substring(partition_record.tablename from 11), 'YYYY_MM');
							IF partition_date < cutoff_date THEN
								EXECUTE format('DROP TABLE IF EXISTS %I', partition_record.tablename);
								dropped_partitions := array_append(dropped_partitions, partition_record.tablename);
							END IF;
						END;
					END IF;
				END LOOP;
				
				RETURN dropped_partitions;
			END;
			$$ LANGUAGE plpgsql;
		`)

		// Function to get partition statistics
		await this.db.execute(sql`
			CREATE OR REPLACE FUNCTION get_audit_partition_stats()
			RETURNS TABLE(
				partition_name text,
				record_count bigint,
				size_bytes bigint,
				size_pretty text
			) AS $$$
			BEGIN
				RETURN QUERY
				SELECT 
					t.tablename::text,
					COALESCE(c.reltuples::bigint, 0),
					COALESCE(pg_total_relation_size(c.oid), 0),
					pg_size_pretty(COALESCE(pg_total_relation_size(c.oid), 0))
				FROM pg_tables t
				LEFT JOIN pg_class c ON c.relname = t.tablename
				WHERE t.tablename LIKE 'audit_log_%'
				AND t.schemaname = 'public'
				AND c.relispartition = true
				ORDER BY t.tablename;
			END;
			$$ LANGUAGE plpgsql;
		`)
	}
}

/**
 * Partition maintenance scheduler
 */
export class PartitionMaintenanceScheduler {
	private intervalId: NodeJS.Timeout | null = null

	constructor(
		private partitionManager: DatabasePartitionManager,
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
				strategy: 'range',
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
