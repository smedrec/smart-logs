import { createHash, randomBytes } from 'crypto'
import { and, eq, gte, isNotNull, lte, sql } from 'drizzle-orm'

import { auditLog, auditRetentionPolicy, pseudonymMapping } from '@repo/audit-db'
import * as auditSchema from '@repo/audit-db/dist/db/schema.js'
import { InfisicalKmsClient } from '@repo/infisical-kms'

import { Audit } from '../audit.js'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { EnhancedAuditDatabaseClient } from '@repo/audit-db'
import type { AuditLogEvent, DataClassification } from '../types.js'

/**
 * GDPR data export format options
 */
export type GDPRExportFormat = 'json' | 'csv' | 'xml'

/**
 * Data subject rights request types
 */
export type DataSubjectRightType =
	| 'access'
	| 'rectification'
	| 'erasure'
	| 'portability'
	| 'restriction'

/**
 * Pseudonymization strategy options
 */
export type PseudonymizationStrategy = 'hash' | 'token' | 'encryption'

/**
 * GDPR data export request
 */
export interface GDPRDataExportRequest {
	principalId: string
	organizationId: string
	requestType: DataSubjectRightType
	format: GDPRExportFormat
	dateRange?: {
		start: string
		end: string
	}
	includeMetadata?: boolean
	requestedBy: string
	requestTimestamp: string
}

/**
 * GDPR data export result
 */
export interface GDPRDataExport {
	requestId: string
	principalId: string
	organizationId: string
	exportTimestamp: string
	format: GDPRExportFormat
	recordCount: number
	dataSize: number
	data: Buffer
	metadata: {
		dateRange: {
			start: string
			end: string
		}
		categories: string[]
		retentionPolicies: string[]
		exportedBy: string
	}
}

/**
 * Pseudonymization mapping for maintaining referential integrity
 */
export interface PseudonymizationMapping {
	originalId: string
	pseudonymId: string
	strategy: PseudonymizationStrategy
	createdAt: string
	context: string
}

/**
 * Data retention policy configuration
 */
export interface RetentionPolicy {
	policyName: string
	dataClassification: DataClassification
	retentionDays: number
	archiveAfterDays?: number
	deleteAfterDays?: number
	isActive: boolean
}

/**
 * Archival result
 */
export interface ArchivalResult {
	recordsArchived: number
	recordsDeleted: number
	archivedAt: string
	policy: string
	summary: {
		byClassification: Record<string, number>
		byAction: Record<string, number>
		dateRange: {
			start: string
			end: string
		}
	}
}

/**
 * GDPR compliance service for audit system
 * Implements data subject rights and privacy-by-design principles
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export class GDPRComplianceService {
	private db: PostgresJsDatabase<typeof auditSchema>

	constructor(
		private client: EnhancedAuditDatabaseClient,
		private audit: Audit,
		private kms: InfisicalKmsClient
	) {
		this.db = this.client.getDatabase()
	}

	/**
	 * Export user audit data in portable format (Requirement 4.1)
	 * Implements GDPR Article 20 - Right to data portability
	 */
	async exportUserData(request: GDPRDataExportRequest): Promise<GDPRDataExport> {
		const requestId = this.generateRequestId()

		// Build query conditions
		const conditions = [eq(auditLog.principalId, request.principalId)]

		conditions.push(eq(auditLog.organizationId, request.organizationId))

		if (request.dateRange) {
			conditions.push(
				gte(auditLog.timestamp, request.dateRange.start),
				lte(auditLog.timestamp, request.dateRange.end)
			)
		}

		const cacheKey = this.client.generateCacheKey('export_user_data', request)
		// Query audit logs for the user
		const auditLogs = await this.client.executeMonitoredQuery(
			(db) =>
				db
					.select()
					.from(auditLog)
					.where(and(...conditions))
					.orderBy(auditLog.timestamp),
			'export_user_data',
			{ cacheKey }
		)

		// Collect metadata
		const categories = new Set<string>()
		const retentionPolicies = new Set<string>()
		let earliestDate = new Date().toISOString()
		let latestDate = new Date(0).toISOString()

		for (const log of auditLogs) {
			if (log.action) categories.add(log.action)
			if (log.retentionPolicy) retentionPolicies.add(log.retentionPolicy)
			if (log.timestamp < earliestDate) earliestDate = log.timestamp
			if (log.timestamp > latestDate) latestDate = log.timestamp
		}

		// Format data according to requested format
		const exportData = await this.formatExportData(
			auditLogs,
			request.format,
			request.includeMetadata
		)

		// Log the export request for audit trail
		await this.logGDPRActivity({
			timestamp: new Date().toISOString(),
			principalId: request.requestedBy,
			organizationId: request.organizationId,
			action: 'gdpr.data.export',
			status: 'success',
			targetResourceType: 'AuditLog',
			targetResourceId: request.principalId,
			outcomeDescription: `GDPR data export completed for user ${request.principalId}`,
			dataClassification: 'PHI',
			retentionPolicy: 'gdpr_compliance',
			details: {
				requestId,
				format: request.format,
				recordCount: auditLogs.length,
				requestType: request.requestType,
			},
		})

		return {
			requestId,
			principalId: request.principalId,
			organizationId: request.organizationId,
			exportTimestamp: new Date().toISOString(),
			format: request.format,
			recordCount: auditLogs.length,
			dataSize: exportData.length,
			data: exportData,
			metadata: {
				dateRange: {
					start: request.dateRange?.start || earliestDate,
					end: request.dateRange?.end || latestDate,
				},
				categories: Array.from(categories),
				retentionPolicies: Array.from(retentionPolicies),
				exportedBy: request.requestedBy,
			},
		}
	}

	/**
	 * Pseudonymize user data while maintaining referential integrity (Requirement 4.2)
	 * Implements GDPR Article 17 - Right to erasure with audit trail preservation
	 */
	async pseudonymizeUserData(
		principalId: string,
		strategy: PseudonymizationStrategy = 'hash',
		requestedBy: string
	): Promise<{ pseudonymId: string; recordsAffected: number }> {
		// Generate pseudonym ID
		const pseudonymId = this.generatePseudonymId(principalId, strategy)

		// Store mapping for referential integrity
		//this.pseudonymMappings.set(principalId, pseudonymId)
		// TODO: process possible errors
		const encryptedOriginalId = await this.kms.encrypt(principalId)
		await this.db.insert(pseudonymMapping).values({
			timestamp: new Date().toISOString(),
			pseudonymId,
			originalId: encryptedOriginalId.ciphertext,
		})

		// Update audit logs with pseudonymized ID
		const updateResult = await this.db
			.update(auditLog)
			.set({
				principalId: pseudonymId,
				// Mark as pseudonymized in details
				details: sql`COALESCE(${auditLog.details}, '{}') || '{"pseudonymized": true, "pseudonymizedAt": "${new Date().toISOString()}"}'::jsonb`,
			})
			.where(eq(auditLog.principalId, principalId))

		// Log the pseudonymization activity
		await this.logGDPRActivity({
			timestamp: new Date().toISOString(),
			principalId: requestedBy,
			action: 'gdpr.data.pseudonymize',
			status: 'success',
			targetResourceType: 'AuditLog',
			targetResourceId: principalId,
			outcomeDescription: `User data pseudonymized for ${principalId}`,
			dataClassification: 'PHI',
			retentionPolicy: 'gdpr_compliance',
			details: {
				originalId: principalId,
				pseudonymId,
				strategy,
				recordsAffected: (updateResult as any).rowCount || 0,
			},
		})

		return {
			pseudonymId,
			recordsAffected: (updateResult as any).rowCount || 0,
		}
	}

	/**
	 * Apply data retention policies with automatic archival (Requirement 4.3)
	 */
	async applyRetentionPolicies(): Promise<ArchivalResult[]> {
		// Get active retention policies
		const policies = await this.client.executeOptimizedQuery(
			(db) =>
				db.select().from(auditRetentionPolicy).where(eq(auditRetentionPolicy.isActive, 'true')),
			{ cacheKey: 'active_retention_policies', cacheTTL: 3600 }
		)

		const results: ArchivalResult[] = []

		const retentionPolicies: RetentionPolicy[] = policies.map((policy) => ({
			policyName: policy.policyName,
			dataClassification: policy.dataClassification,
			retentionDays: policy.retentionDays,
			archiveAfterDays: policy.archiveAfterDays || undefined,
			deleteAfterDays: policy.deleteAfterDays || undefined,
			isActive: policy.isActive === 'true',
		}))

		for (const policy of retentionPolicies) {
			const result = await this.applyRetentionPolicy(policy as RetentionPolicy)
			results.push(result)
		}

		return results
	}

	/**
	 * Apply a specific retention policy
	 */
	private async applyRetentionPolicy(policy: RetentionPolicy): Promise<ArchivalResult> {
		const now = new Date()
		const archiveDate = new Date(
			now.getTime() - (policy.archiveAfterDays || policy.retentionDays) * 24 * 60 * 60 * 1000
		)
		const deleteDate = policy.deleteAfterDays
			? new Date(now.getTime() - policy.deleteAfterDays * 24 * 60 * 60 * 1000)
			: null

		let recordsArchived = 0
		let recordsDeleted = 0
		const byClassification: Record<string, number> = {}
		const byAction: Record<string, number> = {}
		let earliestDate = new Date().toISOString()
		let latestDate = new Date(0).toISOString()

		// Archive records that meet archival criteria
		if (policy.archiveAfterDays) {
			const recordsToArchive = await this.client.executeOptimizedQuery(
				(db) =>
					db
						.select()
						.from(auditLog)
						.where(
							and(
								eq(auditLog.dataClassification, policy.dataClassification),
								lte(auditLog.timestamp, archiveDate.toISOString()),
								sql`${auditLog.archivedAt} IS NULL`
							)
						),
				{ skipCache: true }
			)

			for (const record of recordsToArchive) {
				if (record.dataClassification) {
					byClassification[record.dataClassification] =
						(byClassification[record.dataClassification] || 0) + 1
				}
				if (record.action) {
					byAction[record.action] = (byAction[record.action] || 0) + 1
				}
				if (record.timestamp < earliestDate) earliestDate = record.timestamp
				if (record.timestamp > latestDate) latestDate = record.timestamp
			}

			// Mark records as archived
			const archiveResult = await this.db
				.update(auditLog)
				.set({ archivedAt: now.toISOString() })
				.where(
					and(
						eq(auditLog.dataClassification, policy.dataClassification),
						lte(auditLog.timestamp, archiveDate.toISOString()),
						sql`${auditLog.archivedAt} IS NULL`
					)
				)

			recordsArchived = (archiveResult as any).rowCount || 0
		}

		// Delete records that meet deletion criteria
		if (deleteDate) {
			const deleteResult = await this.db
				.delete(auditLog)
				.where(
					and(
						eq(auditLog.dataClassification, policy.dataClassification),
						lte(auditLog.timestamp, deleteDate.toISOString()),
						isNotNull(auditLog.archivedAt)
					)
				)

			recordsDeleted = (deleteResult as any).rowCount || 0
		}

		// Log retention policy application
		await this.logGDPRActivity({
			timestamp: new Date().toISOString(),
			principalId: 'system',
			action: 'gdpr.retention.apply',
			status: 'success',
			targetResourceType: 'RetentionPolicy',
			targetResourceId: policy.policyName,
			outcomeDescription: `Applied retention policy ${policy.policyName}`,
			dataClassification: 'INTERNAL',
			retentionPolicy: 'system',
			details: {
				policy: policy.policyName,
				recordsArchived,
				recordsDeleted,
				dataClassification: policy.dataClassification,
			},
		})

		return {
			recordsArchived,
			recordsDeleted,
			archivedAt: now.toISOString(),
			policy: policy.policyName,
			summary: {
				byClassification,
				byAction,
				dateRange: {
					start: earliestDate,
					end: latestDate,
				},
			},
		}
	}

	/**
	 * GDPR-compliant deletion with audit trail preservation (Requirement 4.4)
	 * Implements "right to be forgotten" while maintaining compliance audit trails
	 */
	async deleteUserDataWithAuditTrail(
		principalId: string,
		requestedBy: string,
		preserveComplianceAudits: boolean = true
	): Promise<{ recordsDeleted: number; complianceRecordsPreserved: number }> {
		let recordsDeleted = 0
		let complianceRecordsPreserved = 0

		if (preserveComplianceAudits) {
			// First, identify compliance-critical audit records to preserve
			const complianceActions = [
				'auth.login.success',
				'auth.login.failure',
				'data.access.unauthorized',
				'gdpr.data.export',
				'gdpr.data.pseudonymize',
				'gdpr.data.delete',
			]

			const complianceRecords = await this.client.executeMonitoredQuery(
				(db) =>
					db
						.select()
						.from(auditLog)
						.where(
							and(
								eq(auditLog.principalId, principalId),
								sql`${auditLog.action} = ANY(${complianceActions})`
							)
						),
				'compliance_audit_records',
				{ cacheKey: `compliance_audit_records_${principalId}` }
			)

			// Pseudonymize compliance records instead of deleting
			if (complianceRecords.length > 0) {
				const pseudonymResult = await this.pseudonymizeUserData(principalId, 'hash', requestedBy)
				complianceRecordsPreserved = pseudonymResult.recordsAffected
			}

			// Delete non-compliance records
			const deleteResult = await this.db
				.delete(auditLog)
				.where(
					and(
						eq(auditLog.principalId, principalId),
						sql`NOT (${auditLog.action} = ANY(${complianceActions}))`
					)
				)

			recordsDeleted = (deleteResult as any).rowCount || 0
		} else {
			// Delete all records for the user
			const deleteResult = await this.db
				.delete(auditLog)
				.where(eq(auditLog.principalId, principalId))

			recordsDeleted = (deleteResult as any).rowCount || 0
		}

		// Log the deletion activity
		await this.logGDPRActivity({
			timestamp: new Date().toISOString(),
			principalId: requestedBy,
			action: 'gdpr.data.delete',
			status: 'success',
			targetResourceType: 'AuditLog',
			targetResourceId: principalId,
			outcomeDescription: `GDPR deletion completed for user ${principalId}`,
			dataClassification: 'PHI',
			retentionPolicy: 'gdpr_compliance',
			details: {
				recordsDeleted,
				complianceRecordsPreserved,
				preserveComplianceAudits,
			},
		})

		return {
			recordsDeleted,
			complianceRecordsPreserved,
		}
	}

	/**
	 * Reverse pseudonym mapping (for authorized compliance investigations)
	 */
	async getOriginalId(pseudonymId: string): Promise<string | undefined> {
		const mapping = await this.db
			.select()
			.from(pseudonymMapping)
			.where(eq(pseudonymMapping.pseudonymId, pseudonymId))
		if (mapping.length > 0) {
			const encryptedOrigialId = mapping[0].originalId
			try {
				const decryptedOriginalId = await this.kms.decrypt(encryptedOrigialId)
				return decryptedOriginalId.plaintext
			} catch (error) {
				console.error('Error decrypting pseudonym mapping:', error)
				return undefined
			}
		}

		console.error('No pseudonym mapping found for ID:', pseudonymId)
		return undefined
	}

	/**
	 * Generate unique request ID for GDPR operations
	 */
	private generateRequestId(): string {
		return `gdpr-${Date.now()}-${randomBytes(8).toString('hex')}`
	}

	/**
	 * Generate pseudonym ID using specified strategy
	 */
	private generatePseudonymId(originalId: string, strategy: PseudonymizationStrategy): string {
		switch (strategy) {
			case 'hash':
				// TODO: add PSEUDONYM_SALT to config
				return `pseudo-${createHash('sha256')
					.update(originalId + process.env.PSEUDONYM_SALT || 'default-salt')
					.digest('hex')
					.substring(0, 16)}`
			case 'token':
				return `pseudo-${randomBytes(16).toString('hex')}`
			case 'encryption':
				// TODO: For production, implement proper encryption
				return `pseudo-enc-${Buffer.from(originalId)
					.toString('base64')
					.replace(/[^a-zA-Z0-9]/g, '')
					.substring(0, 16)}`
			default:
				throw new Error(`Unsupported pseudonymization strategy: ${strategy}`)
		}
	}

	/**
	 * Format export data according to requested format
	 */
	private async formatExportData(
		auditLogs: any[],
		format: GDPRExportFormat,
		includeMetadata?: boolean
	): Promise<Buffer> {
		const exportData = {
			exportMetadata: includeMetadata
				? {
						exportTimestamp: new Date().toISOString(),
						recordCount: auditLogs.length,
						format,
						gdprCompliant: true,
					}
				: undefined,
			auditLogs,
		}

		switch (format) {
			case 'json':
				return Buffer.from(JSON.stringify(exportData, null, 2))

			case 'csv':
				return this.generateCSVExport(auditLogs)

			case 'xml':
				return this.generateXMLExport(exportData)

			default:
				throw new Error(`Unsupported export format: ${format}`)
		}
	}

	/**
	 * Generate CSV export
	 */
	private generateCSVExport(auditLogs: any[]): Buffer {
		if (auditLogs.length === 0) {
			return Buffer.from('No data to export')
		}

		const headers = Object.keys(auditLogs[0])
		const csvRows = [headers.join(',')]

		for (const log of auditLogs) {
			const row = headers.map((header) => {
				const value = log[header]
				if (value === null || value === undefined) return ''
				if (typeof value === 'string' && value.includes(',')) {
					return `"${value.replace(/"/g, '""')}"`
				}
				return String(value)
			})
			csvRows.push(row.join(','))
		}

		return Buffer.from(csvRows.join('\n'))
	}

	/**
	 * Generate XML export
	 */
	private generateXMLExport(exportData: any): Buffer {
		const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n'
		const xmlContent = this.objectToXML(exportData, 'gdprExport')
		return Buffer.from(xmlHeader + xmlContent)
	}

	/**
	 * Convert object to XML
	 */
	private objectToXML(obj: any, rootName: string): string {
		const escapeXML = (str: string): string => {
			return str.replace(/[<>&'"]/g, (char) => {
				switch (char) {
					case '<':
						return '&lt;'
					case '>':
						return '&gt;'
					case '&':
						return '&amp;'
					case "'":
						return '&apos;'
					case '"':
						return '&quot;'
					default:
						return char
				}
			})
		}

		const convertValue = (value: any, key: string): string => {
			if (value === null || value === undefined) {
				return `<${key}></${key}>`
			}

			if (Array.isArray(value)) {
				return value.map((item) => convertValue(item, key.slice(0, -1))).join('')
			}

			if (typeof value === 'object') {
				const inner = Object.entries(value)
					.map(([k, v]) => convertValue(v, k))
					.join('')
				return `<${key}>${inner}</${key}>`
			}

			return `<${key}>${escapeXML(String(value))}</${key}>`
		}

		return convertValue(obj, rootName)
	}

	/**
	 * Log GDPR compliance activities
	 */
	private async logGDPRActivity(event: AuditLogEvent): Promise<void> {
		await this.audit.log(event, {
			generateHash: true,
			generateSignature: true,
		})

		/**await this.db.insert(auditLog).values({
			...event,
			hash: createHash('sha256').update(JSON.stringify(event)).digest('hex'),
			hashAlgorithm: 'SHA-256',
			eventVersion: '1.0',
		})*/
	}
}
