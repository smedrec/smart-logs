import { readFileSync } from 'fs'
import { join } from 'path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import 'dotenv/config'

import { desc, or } from 'drizzle-orm'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

/**
 * Migration utility class for managing database schema changes
 * Provides methods for applying migrations, rollbacks, and verification
 */
export class MigrationUtils {
	private client: postgres.Sql
	private db: PostgresJsDatabase

	constructor(connectionUrl: string) {
		this.client = postgres(connectionUrl, { max: 10 })
		this.db = drizzle(this.client)
	}

	/**
	 * Apply all pending migrations
	 */
	async applyMigrations(): Promise<void> {
		try {
			await migrate(this.db, { migrationsFolder: './drizzle/migrations' })
			console.log('✅ Migrations applied successfully')
		} catch (error) {
			console.error('❌ Migration failed:', error)
			throw error
		}
	}

	/**
	 * Execute a specific rollback script
	 */
	async executeRollback(migrationName: string): Promise<void> {
		try {
			const rollbackPath = join(
				process.cwd(),
				'drizzle/migrations',
				`${migrationName}_rollback.sql`
			)
			const rollbackScript = readFileSync(rollbackPath, 'utf-8')

			await this.client.unsafe(rollbackScript)
			console.log(`✅ Rollback executed successfully for ${migrationName}`)
		} catch (error) {
			console.error(`❌ Rollback failed for ${migrationName}:`, error)
			throw error
		}
	}

	/**
	 * Verify database schema integrity
	 */
	async verifySchema(): Promise<{
		tables: string[]
		auditLogColumns: string[]
		indexes: string[]
		constraints: string[]
	}> {
		try {
			// Get all tables
			const tablesResult = await this.client`
				SELECT table_name 
				FROM information_schema.tables 
				WHERE table_schema = 'public'
				ORDER BY table_name
			`
			const tables = tablesResult.map((row) => row.table_name)

			// Get audit_log columns
			const columnsResult = await this.client`
				SELECT column_name
				FROM information_schema.columns 
				WHERE table_name = 'audit_log'
				ORDER BY column_name
			`
			const auditLogColumns = columnsResult.map((row) => row.column_name)

			// Get indexes
			const indexesResult = await this.client`
				SELECT indexname, tablename
				FROM pg_indexes 
				WHERE schemaname = 'public'
				ORDER BY tablename, indexname
			`
			const indexes = indexesResult.map((row) => `${row.tablename}.${row.indexname}`)

			// Get constraints
			const constraintsResult = await this.client`
				SELECT constraint_name, table_name, constraint_type
				FROM information_schema.table_constraints
				WHERE table_schema = 'public'
				ORDER BY table_name, constraint_name
			`
			const constraints = constraintsResult.map(
				(row) => `${row.table_name}.${row.constraint_name} (${row.constraint_type})`
			)

			return {
				tables,
				auditLogColumns,
				indexes,
				constraints,
			}
		} catch (error) {
			console.error('❌ Schema verification failed:', error)
			throw error
		}
	}

	/**
	 * Check if specific compliance features are present
	 */
	async verifyComplianceFeatures(): Promise<{
		hasComplianceColumns: boolean
		hasIntegrityTable: boolean
		hasRetentionTable: boolean
		hasComplianceIndexes: boolean
	}> {
		const schema = await this.verifySchema()

		const complianceColumns = [
			'hash_algorithm',
			'event_version',
			'correlation_id',
			'data_classification',
			'retention_policy',
			'processing_latency',
			'archived_at',
		]

		const complianceIndexes = [
			'audit_log.audit_log_correlation_id_idx',
			'audit_log.audit_log_data_classification_idx',
			'audit_log.audit_log_retention_policy_idx',
			'audit_log.audit_log_archived_at_idx',
		]

		return {
			hasComplianceColumns: complianceColumns.every((col) => schema.auditLogColumns.includes(col)),
			hasIntegrityTable: schema.tables.includes('audit_integrity_log'),
			hasRetentionTable: schema.tables.includes('audit_retention_policy'),
			hasComplianceIndexes: complianceIndexes.every((idx) => schema.indexes.includes(idx)),
		}
	}

	/**
	 * Insert default retention policies
	 */
	async insertDefaultRetentionPolicies(): Promise<void> {
		try {
			const defaultPolicies = [
				{
					policy_name: 'standard',
					retention_days: 2555, // 7 years
					archive_after_days: 365, // 1 year
					data_classification: 'INTERNAL',
					description: 'Standard retention policy for internal audit data',
					created_by: 'system',
				},
				{
					policy_name: 'phi_extended',
					retention_days: 2555, // 7 years (HIPAA requirement)
					archive_after_days: 365, // 1 year
					data_classification: 'PHI',
					description: 'Extended retention policy for PHI data to meet HIPAA requirements',
					created_by: 'system',
				},
				{
					policy_name: 'minimal',
					retention_days: 90, // 3 months
					archive_after_days: 30, // 1 month
					data_classification: 'PUBLIC',
					description: 'Minimal retention policy for public data',
					created_by: 'system',
				},
				{
					policy_name: 'confidential',
					retention_days: 1825, // 5 years
					archive_after_days: 365, // 1 year
					data_classification: 'CONFIDENTIAL',
					description: 'Extended retention policy for confidential business data',
					created_by: 'system',
				},
			]

			for (const policy of defaultPolicies) {
				await this.client`
					INSERT INTO audit_retention_policy (
						policy_name, retention_days, archive_after_days, 
						data_classification, description, created_by
					) VALUES (
						${policy.policy_name}, ${policy.retention_days}, ${policy.archive_after_days},
						${policy.data_classification}, ${policy.description}, ${policy.created_by}
					)
					ON CONFLICT (policy_name) DO NOTHING
				`
			}

			console.log('✅ Default retention policies inserted successfully')
		} catch (error) {
			console.error('❌ Failed to insert default retention policies:', error)
			throw error
		}
	}

	/**
	 * Insert default retention policies
	 */
	async insertDefaultAuditPresets(): Promise<void> {
		try {
			const defaultPresets = [
				{
					name: 'authentication',
					description: 'Authentication Events',
					organizationId: '*',
					action: 'auth.generic',
					dataClassification: 'INTERNAL',
					requiredFields: ['principalId', 'sessionContext'],
					defaultValues: {
						retentionPolicy: 'auth-logs-1-year',
					},
					created_by: 'system',
				},
				{
					name: 'fhir_access',
					description: 'FHIR Resource Access',
					organizationId: '*',
					action: 'fhir.resource.access',
					dataClassification: 'PHI',
					requiredFields: ['principalId', 'targetResourceType', 'targetResourceId'],
					defaultValues: {
						retentionPolicy: 'hipaa-6-years',
					},
					validation: {
						maxStringLength: 5000,
						requiredFields: ['timestamp', 'action', 'status', 'principalId', 'targetResourceType'],
					},
					created_by: 'system',
				},
				{
					name: 'system',
					description: 'System Operations',
					organizationId: '*',
					action: 'system.operation',
					dataClassification: 'INTERNAL',
					requiredFields: ['action', 'status'],
					defaultValues: {
						retentionPolicy: 'system-logs-2-years',
					},
					created_by: 'system',
				},
				{
					name: 'data_operation',
					description: 'Data Operations',
					organizationId: '*',
					action: 'data.operation',
					dataClassification: 'CONFIDENTIAL',
					requiredFields: ['principalId', 'targetResourceType', 'targetResourceId'],
					defaultValues: {
						retentionPolicy: 'data-ops-3-years',
					},
					created_by: 'system',
				},
				{
					name: 'admin',
					description: 'Administrative Actions',
					organizationId: '*',
					action: 'admin.action',
					dataClassification: 'CONFIDENTIAL',
					requiredFields: ['principalId', 'organizationId'],
					defaultValues: {
						retentionPolicy: 'admin-logs-7-years',
					},
					created_by: 'system',
				},
				{
					name: 'security',
					description: 'Security Events',
					organizationId: '*',
					action: 'security.event',
					dataClassification: 'CONFIDENTIAL',
					requiredFields: ['principalId', 'sessionContext'],
					defaultValues: {
						retentionPolicy: 'security-logs-7-years',
					},
					created_by: 'system',
				},
				{
					name: 'compliance',
					description: 'Compliance Events',
					organizationId: '*',
					action: 'compliance.event',
					dataClassification: 'CONFIDENTIAL',
					requiredFields: ['principalId', 'action', 'outcomeDescription'],
					defaultValues: {
						retentionPolicy: 'compliance-logs-10-years',
					},
					created_by: 'system',
				},
				{
					name: 'practitioner',
					description: 'Practitioner Management',
					action: 'practitioner.management',
					dataClassification: 'CONFIDENTIAL',
					requiredFields: ['principalId', 'targetResourceId'],
					defaultValues: {
						retentionPolicy: 'practitioner-logs-permanent',
					},
					created_by: 'system',
				},
			]

			for (const preset of defaultPresets) {
				await this.client`
					INSERT INTO audit_preset (
						name, description, organization_id, action, data_classification, required_fields, default_values, validation, created_by
					) VALUES (
						${preset.name},
						${preset.description},
						${preset.organizationId ?? null},
						${preset.action},
						${preset.dataClassification},
						${JSON.stringify(preset.requiredFields)},
						${JSON.stringify(preset.defaultValues)},
						${preset.validation ? JSON.stringify(preset.validation) : null},
						${preset.created_by}
					)
					ON CONFLICT (name) DO NOTHING
				`
			}

			console.log('✅ Default audit presets inserted successfully')
		} catch (error) {
			console.error('❌ Failed to insert default audit presets:', error)
			throw error
		}
	}

	/**
	 * Close database connection
	 */
	async close(): Promise<void> {
		await this.client.end()
	}
}

/**
 * CLI utility for running migration operations
 */
export async function runMigrationCommand(command: string, migrationName?: string): Promise<void> {
	const dbUrl = process.env.AUDIT_DB_URL || process.env.DATABASE_URL

	if (!dbUrl) {
		throw new Error('Database URL not found in environment variables')
	}

	const migrationUtils = new MigrationUtils(dbUrl)

	try {
		switch (command) {
			case 'migrate':
				await migrationUtils.applyMigrations()
				break

			case 'rollback':
				if (!migrationName) {
					throw new Error('Migration name required for rollback')
				}
				await migrationUtils.executeRollback(migrationName)
				break

			case 'verify': {
				const schema = await migrationUtils.verifySchema()
				console.log('📊 Database Schema:')
				console.log('Tables:', schema.tables)
				console.log('Audit Log Columns:', schema.auditLogColumns)
				console.log('Indexes:', schema.indexes.length)
				console.log('Constraints:', schema.constraints.length)
				break
			}

			case 'verify-compliance': {
				const compliance = await migrationUtils.verifyComplianceFeatures()
				console.log('🔍 Compliance Features:')
				console.log('Compliance Columns:', compliance.hasComplianceColumns ? '✅' : '❌')
				console.log('Integrity Table:', compliance.hasIntegrityTable ? '✅' : '❌')
				console.log('Retention Table:', compliance.hasRetentionTable ? '✅' : '❌')
				console.log('Compliance Indexes:', compliance.hasComplianceIndexes ? '✅' : '❌')
				break
			}

			case 'seed-policies':
				await migrationUtils.insertDefaultRetentionPolicies()
				break

			default:
				console.error('Unknown command:', command)
				console.log(
					'Available commands: migrate, rollback, verify, verify-compliance, seed-policies'
				)
		}
	} finally {
		await migrationUtils.close()
	}
}
