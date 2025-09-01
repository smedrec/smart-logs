/**
 * Database alert handler for persistent alert storage with multi-organizational support
 * Implements AlertHandler interface to store alerts in PostgreSQL with organization-based access control
 */

import { sql } from 'drizzle-orm'

import { EnhancedAuditDatabaseClient } from '@repo/audit-db'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Alert, AlertSeverity, AlertStatistics, AlertType } from './monitoring-types.js'
import type { AlertHandler } from './monitoring.js'

/**
 * Database alert record interface
 */
interface DatabaseAlert {
	id: string
	organization_id: string
	severity: string
	type: string
	title: string
	description: string
	source: string
	correlation_id: string | null
	metadata: any
	acknowledged: string
	acknowledged_at: string | null
	acknowledged_by: string | null
	resolved: string
	resolved_at: string | null
	resolved_by: string | null
	resolution_notes: string | null
	created_at: string
	updated_at: string
}

/**
 * Alert query filters for multi-organizational access
 */
export interface AlertQueryFilters {
	organizationId: string
	acknowledged?: boolean
	resolved?: boolean
	severity?: AlertSeverity
	type?: AlertType
	source?: string
	limit?: number
	offset?: number
	sortBy?: 'createdAt' | 'updatedAt' | 'severity'
	sortOrder?: 'asc' | 'desc'
}

/**
 * Alert resolution data
 */
export interface AlertResolution {
	resolvedBy: string
	resolutionNotes?: string
}

/**
 * Database alert handler implementation
 */
export class DatabaseAlertHandler implements AlertHandler {
	private readonly name = 'DatabaseAlertHandler'
	private db: PostgresJsDatabase<any>
	constructor(private client: EnhancedAuditDatabaseClient) {
		this.db = this.client.getDatabase()
	}

	/**
	 * Get handler name
	 *
	 * @returns name of the handler
	 */
	public handlerName(): string {
		return this.name
	}
	/**
	 * Send (persist) alert to database
	 */
	async sendAlert(alert: Alert): Promise<void> {
		if (!alert.metadata.organizationId) {
			throw new Error('Alert must have organizationId in metadata for multi-tenant support')
		}

		try {
			await this.db.execute(sql`
				INSERT INTO alerts (
					id, organization_id, severity, type, title, description, source,
					correlation_id, metadata, resolved, resolved_at, resolved_by,
					acknowledged, acknowledged_at, acknowledged_by,
					resolution_notes, created_at, updated_at
				) VALUES (
					${alert.id},
					${alert.metadata.organizationId as string},
					${alert.severity},
					${alert.type},
					${alert.title},
					${alert.description},
					${alert.source},
					${alert.correlationId || null},
					${JSON.stringify(alert.metadata)},
					${alert.acknowledged ? 'true' : 'false'},
					${alert.acknowledgedAt || null},
					${alert.acknowledgedBy || null},
					${alert.resolved ? 'true' : 'false'},
					${alert.resolvedAt || null},
					${alert.resolvedBy || null},
					${null},
					${alert.timestamp},
					${alert.timestamp}
				)
			`)
		} catch (error) {
			throw new Error(`Failed to persist alert to database: ${error}`)
		}
	}

	/**
	 * Acknowledge alert in database
	 */
	async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<{ success: boolean }> {
		const now = new Date().toISOString()

		try {
			const result = await this.db.execute(sql`
				UPDATE alerts 
				SET 
					acknowledged = 'true',
					acknowledged_at = ${now},
					acknowledged_by = ${acknowledgedBy},
					updated_at = ${now}
				WHERE id = ${alertId}
				RETURNING id
			`)

			// Check if any rows were affected by the UPDATE
			if (result.length === 0) {
				throw new Error(`Alert with ID ${alertId} not found`)
			}
			return { success: true }
		} catch (error) {
			throw new Error(`Failed to acknowledge alert in database: ${error}`)
		}
	}

	/**
	 * Resolve alert in database
	 */
	async resolveAlert(
		alertId: string,
		resolvedBy: string,
		resolutionData?: AlertResolution
	): Promise<{ success: boolean }> {
		const now = new Date().toISOString()

		try {
			const result = await this.db.execute(sql`
				UPDATE alerts 
				SET 
					resolved = 'true',
					resolved_at = ${now},
					resolved_by = ${resolutionData?.resolvedBy || resolvedBy},
					resolution_notes = ${resolutionData?.resolutionNotes || null},
					updated_at = ${now}
				WHERE id = ${alertId}
				RETURNING id
			`)

			// Check if any rows were affected by the UPDATE
			if (result.length === 0) {
				throw new Error(`Alert with ID ${alertId} not found`)
			}
			return { success: true }
		} catch (error) {
			throw new Error(`Failed to resolve alert in database: ${error}`)
		}
	}

	/**
	 * Get active alerts for organization
	 */
	async getActiveAlerts(organizationId?: string): Promise<Alert[]> {
		if (!organizationId) {
			throw new Error('organizationId is required for multi-tenant alert access')
		}

		try {
			const result = await this.client.executeMonitoredQuery(
				(db) =>
					db.execute(sql`
				SELECT * FROM alerts 
				WHERE organization_id = ${organizationId} 
				AND resolved = 'false'
				ORDER BY created_at DESC
			`),
				'get_active_alerts',
				{ cacheKey: `get_active_alerts_${organizationId}` }
			)

			// Handle different database result formats
			const rows = result || []
			return rows.map(this.mapDatabaseAlertToAlert)
		} catch (error) {
			throw new Error(`Failed to retrieve active alerts: ${error}`)
		}
	}

	/**
	 * Get the number of active alerts for organization
	 */
	async numberOfActiveAlerts(organizationId?: string): Promise<number> {
		let query = `SELECT COUNT(*) FROM alerts WHERE resolved = 'false'`
		if (organizationId !== undefined) {
			query += ` AND organization_id = ${organizationId}`
		}
		try {
			const result = await this.client.executeMonitoredQuery(
				(db) => db.execute(sql.raw(query)),
				'get_active_alerts_count',
				{ cacheKey: `get_active_alerts_count_${organizationId || 'all'}` }
			)
			return Number(result[0].count)
		} catch (error) {
			throw new Error(`Failed to retrieve number of active alerts: ${error}`)
		}
	}

	/**
	 * Get alerts with filters for organization
	 */
	async getAlerts(filters: AlertQueryFilters): Promise<Alert[]> {
		try {
			// Build the base query using template literals for simplicity
			let query = `SELECT * FROM alerts WHERE organization_id = '${filters.organizationId}'`

			// Add optional filters
			if (filters.acknowledged !== undefined) {
				query += ` AND acknowledged = '${filters.acknowledged ? 'true' : 'false'}'`
			}

			if (filters.resolved !== undefined) {
				query += ` AND resolved = '${filters.resolved ? 'true' : 'false'}'`
			}

			if (filters.severity) {
				query += ` AND severity = '${filters.severity}'`
			}

			if (filters.type) {
				query += ` AND type = '${filters.type}'`
			}

			if (filters.source) {
				query += ` AND source = '${filters.source}'`
			}

			// Add sorting
			const sortColumn = filters.sortBy || 'createdAt'
			const sortDirection = filters.sortOrder || 'desc'

			switch (sortColumn) {
				case 'createdAt':
					query += ` ORDER BY created_at ${sortDirection.toUpperCase()}`
					break
				case 'updatedAt':
					query += ` ORDER BY updated_at ${sortDirection.toUpperCase()}`
					break
				case 'severity':
					query += ` ORDER BY CASE severity 
						WHEN 'CRITICAL' THEN 1 
						WHEN 'HIGH' THEN 2 
						WHEN 'MEDIUM' THEN 3 
						WHEN 'LOW' THEN 4 
					END ${sortDirection.toUpperCase()}`
					break
				default:
					query += ` ORDER BY created_at DESC`
			}

			// Add pagination
			if (filters.limit) {
				query += ` LIMIT ${filters.limit}`
			}
			if (filters.offset) {
				query += ` OFFSET ${filters.offset}`
			}

			const cacheKey = this.client.generateCacheKey('get_alerts', filters)
			const result = await this.client.executeMonitoredQuery(
				(db) => db.execute(sql.raw(query)),
				'get_alerts',
				{ cacheKey }
			)

			const rows = result || []
			return rows.map(this.mapDatabaseAlertToAlert)
		} catch (error) {
			throw new Error(`Failed to retrieve alerts: ${error}`)
		}
	}

	/**
	 * Get alert by ID for organization
	 */
	async getAlertById(alertId: string, organizationId: string): Promise<Alert | null> {
		try {
			const result = await this.client.executeOptimizedQuery(
				(db) =>
					db.execute(sql`
				SELECT * FROM alerts
				WHERE id = ${alertId}
				AND organization_id = ${organizationId}
				LIMIT 1
			`),
				{ cacheKey: `get_alert_${alertId.slice(6)}` }
			)

			const rows = result || []
			if (rows.length === 0) {
				return null
			}

			return this.mapDatabaseAlertToAlert(rows[0])
		} catch (error) {
			throw new Error(`Failed to retrieve alert by ID: ${error}`)
		}
	}

	/**
	 * Get alert statistics for organization
	 */
	async getAlertStatistics(organizationId?: string): Promise<AlertStatistics> {
		let query = `
				SELECT 
					COUNT(*) as total,
					COUNT(CASE WHEN acknowledged = 'true' THEN 1 END) as acknowledged,
					COUNT(CASE WHEN resolved = 'false' THEN 1 END) as active,
					COUNT(CASE WHEN resolved = 'true' THEN 1 END) as resolved,
					COUNT(CASE WHEN severity = 'LOW' THEN 1 END) as low_severity,
					COUNT(CASE WHEN severity = 'MEDIUM' THEN 1 END) as medium_severity,
					COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) as high_severity,
					COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_severity,
					COUNT(CASE WHEN type = 'SECURITY' THEN 1 END) as security_type,
					COUNT(CASE WHEN type = 'COMPLIANCE' THEN 1 END) as compliance_type,
					COUNT(CASE WHEN type = 'PERFORMANCE' THEN 1 END) as performance_type,
					COUNT(CASE WHEN type = 'SYSTEM' THEN 1 END) as system_type,
					COUNT(CASE WHEN type = 'METRICS' THEN 1 END) as metrics_type
				FROM alerts
			`
		if (organizationId !== undefined) {
			query += ` WHERE organization_id = ${organizationId}`
		}
		try {
			const result = await this.client.executeMonitoredQuery(
				(db) => db.execute(sql.raw(query)),
				'get_alert_statistics',
				{ cacheKey: `get_alert_statistics_${organizationId || 'all'}` }
			)

			const rows = result || []
			const row = rows[0]

			return {
				total: parseInt(row.total as string),
				active: parseInt(row.active as string),
				acknowledged: parseInt(row.acknowledged as string),
				resolved: parseInt(row.resolved as string),
				bySeverity: {
					LOW: parseInt(row.low_severity as string),
					MEDIUM: parseInt(row.medium_severity as string),
					HIGH: parseInt(row.high_severity as string),
					CRITICAL: parseInt(row.critical_severity as string),
				},
				byType: {
					SECURITY: parseInt(row.security_type as string),
					COMPLIANCE: parseInt(row.compliance_type as string),
					PERFORMANCE: parseInt(row.performance_type as string),
					SYSTEM: parseInt(row.system_type as string),
					METRICS: parseInt(row.metrics_type as string),
				},
			}
		} catch (error) {
			throw new Error(`Failed to retrieve alert statistics: ${error}`)
		}
	}

	/**
	 * Delete old resolved alerts based on retention policy
	 */
	async cleanupResolvedAlerts(organizationId: string, retentionDays: number = 90): Promise<number> {
		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

		try {
			const result = await this.db.execute(sql`
				DELETE FROM alerts 
				WHERE organization_id = ${organizationId}
				AND resolved = 'true'
				AND resolved_at < ${cutoffDate.toISOString()}
				RETURNING id
			`)

			return result.length || 0
		} catch (error) {
			throw new Error(`Failed to cleanup resolved alerts: ${error}`)
		}
	}

	/**
	 * Map database alert record to Alert interface
	 */
	private mapDatabaseAlertToAlert(dbAlert: any): Alert {
		return {
			id: dbAlert.id,
			severity: dbAlert.severity as AlertSeverity,
			type: dbAlert.type as AlertType,
			title: dbAlert.title,
			description: dbAlert.description,
			timestamp: dbAlert.created_at,
			source: dbAlert.source,
			metadata: {
				...(typeof dbAlert.metadata === 'string' ? JSON.parse(dbAlert.metadata) : dbAlert.metadata),
				organizationId: dbAlert.organization_id,
			},
			acknowledged: dbAlert.acknowledged === 'true',
			acknowledgedAt: dbAlert.acknowledged_at || undefined,
			acknowledgedBy: dbAlert.acknowledged_by || undefined,
			resolved: dbAlert.resolved === 'true',
			resolvedAt: dbAlert.resolved_at || undefined,
			resolvedBy: dbAlert.resolved_by || undefined,
			correlationId: dbAlert.correlation_id || undefined,
		}
	}
}

/**
 * Factory function to create DatabaseAlertHandler
 */
export function createDatabaseAlertHandler(
	client: EnhancedAuditDatabaseClient
): DatabaseAlertHandler {
	return new DatabaseAlertHandler(client)
}
