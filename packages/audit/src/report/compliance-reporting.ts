/**
 * @fileoverview Compliance Reporting Service
 *
 * Provides comprehensive compliance reporting functionality including:
 * - HIPAA audit trail reports
 * - GDPR data processing reports
 * - Audit trail verification reports
 * - Configurable report criteria and filtering
 *
 * Requirements: 4.1, 4.4, 8.1
 */
import { sql } from 'drizzle-orm'

import { EnhancedAuditDatabaseClient } from '@repo/audit-db'

import { Audit } from '../audit.js'
import { CryptoConfig, CryptoService } from '../crypto.js'
import { ReportTemplate } from './scheduled-reporting.js'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { AuditEventStatus, AuditLogEvent, DataClassification } from '../types.js'

/**
 * Report criteria for filtering and configuring compliance reports
 */
export interface ReportCriteria {
	/** Date range for the report */
	dateRange: {
		startDate: string
		endDate: string
	}

	/** Filter by specific principals/users */
	principalIds?: string[]

	/** Filter by organization */
	organizationIds?: string[]

	/** Filter by specific actions */
	actions?: string[]

	/** Filter by data classification levels */
	dataClassifications?: DataClassification[]

	/** Filter by event status */
	statuses?: Array<'attempt' | 'success' | 'failure'>

	/** Filter by resource types */
	resourceTypes?: string[]

	/** Include only events with integrity verification */
	verifiedOnly?: boolean

	/** Include failed integrity checks */
	includeIntegrityFailures?: boolean

	/** Maximum number of events to include */
	limit?: number

	/** Offset for pagination */
	offset?: number

	/** Sorting criteria */
	sortBy?: 'timestamp' | 'status'

	/** Sorting direction */
	sortOrder?: 'asc' | 'desc'
}

/**
 * Base compliance report structure
 */
export interface ComplianceReport {
	/** Report metadata */
	metadata: {
		reportId: string
		reportType: string
		generatedAt: string
		generatedBy?: string
		criteria: ReportCriteria
		totalEvents: number
		//filteredEvents: number
	}

	/** Report summary statistics */
	summary: {
		eventsByStatus: Record<string, number>
		eventsByAction: Record<string, number>
		eventsByDataClassification: Record<string, number>
		uniquePrincipals: number
		uniqueResources: number
		integrityViolations: number
		timeRange: {
			earliest: string
			latest: string
		}
	}

	/** Detailed event data */
	events: ComplianceReportEvent[]

	/** Integrity verification results */
	integrityReport?: IntegrityVerificationReport
}

/**
 * Simplified event structure for compliance reports
 */
export interface ComplianceReportEvent {
	id?: number
	timestamp: string
	principalId?: string
	organizationId?: string
	action: string
	targetResourceType?: string
	targetResourceId?: string
	status: string
	outcomeDescription?: string
	dataClassification?: DataClassification
	sessionContext?: {
		ipAddress?: string
		userAgent?: string
		sessionId?: string
	}
	integrityStatus?: 'verified' | 'failed' | 'not_checked'
	correlationId?: string
}

/**
 * HIPAA-specific compliance report
 */
export interface HIPAAComplianceReport extends ComplianceReport {
	reportType: 'HIPAA_AUDIT_TRAIL'

	/** HIPAA-specific summary */
	hipaaSpecific: {
		phiAccessEvents: number
		phiModificationEvents: number
		unauthorizedAttempts: number
		emergencyAccess: number
		breakGlassEvents: number
		minimumNecessaryViolations: number
	}

	/** Risk assessment */
	riskAssessment: {
		highRiskEvents: ComplianceReportEvent[]
		suspiciousPatterns: SuspiciousPattern[]
		recommendations: string[]
	}
}

/**
 * GDPR-specific compliance report
 */
export interface GDPRComplianceReport extends ComplianceReport {
	reportType: 'GDPR_PROCESSING_ACTIVITIES'

	/** GDPR-specific summary */
	gdprSpecific: {
		personalDataEvents: number
		dataSubjectRights: number
		consentEvents: number
		dataBreaches: number
		crossBorderTransfers: number
		retentionViolations: number
	}

	/** Legal basis breakdown */
	legalBasisBreakdown: Record<string, number>

	/** Data subject rights activities */
	dataSubjectRights: {
		accessRequests: number
		rectificationRequests: number
		erasureRequests: number
		portabilityRequests: number
		objectionRequests: number
	}
}

/**
 * Audit trail verification report
 */
export interface IntegrityVerificationReport {
	/** Verification metadata */
	verificationId: string
	verifiedAt: string
	verifiedBy?: string

	/** Verification results */
	results: {
		totalEvents: number
		verifiedEvents: number
		failedVerifications: number
		unverifiedEvents: number
		verificationRate: number
	}

	/** Failed verifications */
	failures: IntegrityFailure[]

	/** Verification statistics */
	statistics: {
		hashAlgorithms: Record<string, number>
		verificationLatency: {
			average: number
			median: number
			p95: number
		}
	}
}

/**
 * Integrity verification failure details
 */
export interface IntegrityFailure {
	eventId: number
	timestamp: string
	expectedHash: string
	actualHash: string
	hashAlgorithm: string
	failureReason: string
	severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

/**
 * Suspicious pattern detection result
 */
export interface SuspiciousPattern {
	patternType: string
	description: string
	events: ComplianceReportEvent[]
	riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
	recommendation: string
}

/**
 * Report export format options
 */
export type ReportFormat = 'json' | 'csv' | 'xml' | 'pdf' | 'parquet' | 'avro'

/**
 * Export configuration
 */
export interface ExportConfig {
	format: ReportFormat
	includeMetadata?: boolean
	includeIntegrityReport?: boolean
	compression?: 'none' | 'gzip' | 'zip' | 'bzip2'
	encryption?: {
		enabled: boolean
		algorithm?: string
		keyId?: string
	}
}

export interface NotificationConfig {
	recipients: string[]
	onSuccess: boolean
	onFailure: boolean
	onSkip: boolean
	includeReport: boolean
	customMessage?: string
}

/**
 * Scheduled report configuration
 */
export interface ScheduledReportConfig {
	id: string
	name: string
	description?: string
	templateId?: string
	reportType: ReportTemplate['reportType']
	criteria: ReportCriteria
	format: ReportFormat
	schedule: {
		frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
		dayOfWeek?: number // 0-6 for weekly
		dayOfMonth?: number // 1-31 for monthly
		time: string // HH:MM format
		timezone?: string
	}
	delivery: {
		method: 'email' | 'webhook' | 'storage' | 'sftp' | 'download'
		recipients?: string[]
		webhookUrl?: string
		storageLocation?: string
	}
	export: ExportConfig
	notification: NotificationConfig
	enabled: boolean
	createdAt: string
	createdBy: string
	lastRun?: string
	nextRun?: string
	runId?: string
	tags?: string[]
	metadata?: Record<string, any>
	version?: number
}

/**
 * Compliance Reporting Service
 */
export class ComplianceReportingService {
	constructor(
		private client: EnhancedAuditDatabaseClient,
		private audit: Audit
	) {}

	/**
	 * Generate a general compliance report
	 */
	async generateComplianceReport(
		events: AuditLogEvent[],
		criteria: ReportCriteria,
		reportType: string = 'GENERAL_COMPLIANCE'
	): Promise<ComplianceReport> {
		const reportId = this.generateReportId()
		const generatedAt = new Date().toISOString()

		// Filter events based on criteria
		//const filteredEvents = this.filterEvents(events, criteria)

		// Generate summary statistics
		const summary = this.generateSummary(events)

		// Convert to report format
		const reportEvents = this.convertToReportEvents(events)

		return {
			metadata: {
				reportId,
				reportType,
				generatedAt,
				criteria,
				totalEvents: events.length,
				//filteredEvents: filteredEvents.length,
			},
			summary,
			events: reportEvents,
		}
	}

	/**
	 * Generate HIPAA-specific compliance report
	 */
	async generateHIPAAReport(
		//events: AuditLogEvent[],
		criteria: ReportCriteria
	): Promise<HIPAAComplianceReport> {
		const events = await this.getEvents(criteria)
		const baseReport = await this.generateComplianceReport(events, criteria, 'HIPAA_AUDIT_TRAIL')

		// Filter for PHI-related events
		const phiEvents = events.filter(
			(event) => event.dataClassification === 'PHI' || this.isPHIResource(event.targetResourceType)
		)

		// Generate HIPAA-specific metrics
		const hipaaSpecific = this.generateHIPAAMetrics(phiEvents)

		// Perform risk assessment
		const riskAssessment = this.performRiskAssessment(phiEvents)

		return {
			...baseReport,
			reportType: 'HIPAA_AUDIT_TRAIL',
			hipaaSpecific,
			riskAssessment,
		}
	}

	/**
	 * Generate GDPR-specific compliance report
	 */
	async generateGDPRReport(
		//events: AuditLogEvent[],
		criteria: ReportCriteria
	): Promise<GDPRComplianceReport> {
		const events = await this.getEvents(criteria)
		const baseReport = await this.generateComplianceReport(
			events,
			criteria,
			'GDPR_PROCESSING_ACTIVITIES'
		)

		// Filter for personal data processing events
		const personalDataEvents = events.filter((event) => this.isPersonalDataProcessing(event))

		// Generate GDPR-specific metrics
		const gdprSpecific = this.generateGDPRMetrics(personalDataEvents)

		// Generate legal basis breakdown
		const legalBasisBreakdown = this.generateLegalBasisBreakdown(personalDataEvents)

		// Generate data subject rights summary
		const dataSubjectRights = this.generateDataSubjectRightsSummary(personalDataEvents)

		return {
			...baseReport,
			reportType: 'GDPR_PROCESSING_ACTIVITIES',
			gdprSpecific,
			legalBasisBreakdown,
			dataSubjectRights,
		}
	}

	/**
	 * Generate audit trail verification report
	 */
	async generateIntegrityVerificationReport(
		criteria: ReportCriteria,
		performVerification: boolean = true
	): Promise<IntegrityVerificationReport> {
		const events = await this.getEvents(criteria)
		const verificationId = this.generateReportId()
		const verifiedAt = new Date().toISOString()

		let verificationResults = {
			totalEvents: events.length,
			verifiedEvents: 0,
			failedVerifications: 0,
			unverifiedEvents: 0,
			verificationRate: 0,
		}

		const failures: IntegrityFailure[] = []
		const hashAlgorithms: Record<string, number> = {}

		let latency: number[] = []

		if (performVerification) {
			// Perform integrity verification on each event
			for (const event of events) {
				if (event.hash && event.hashAlgorithm) {
					const startTime = Date.now()
					// Track hash algorithms
					hashAlgorithms[event.hashAlgorithm] = (hashAlgorithms[event.hashAlgorithm] || 0) + 1

					const computedHash = this.audit.generateEventHash(event)

					if (computedHash === event.hash) {
						verificationResults.verifiedEvents++
					} else {
						verificationResults.failedVerifications++
						failures.push({
							eventId: event.id || 0,
							timestamp: event.timestamp,
							expectedHash: event.hash,
							actualHash: computedHash,
							hashAlgorithm: event.hashAlgorithm,
							failureReason: 'Hash mismatch detected',
							severity: 'HIGH',
						})
					}
					latency.push(Date.now() - startTime)
				} else {
					verificationResults.unverifiedEvents++
				}
			}

			verificationResults.verificationRate =
				verificationResults.totalEvents > 0
					? (verificationResults.verifiedEvents / verificationResults.totalEvents) * 100
					: 0
		}

		const verificationLatency = {
			average:
				latency.length > 0
					? latency.reduce((total, current) => total + current, 0) / latency.length
					: 0,
			median: 0,
			p95: 0,
		}
		if (latency.length > 0) {
			// Calculate median
			const sortedLatency = latency.sort((a, b) => a - b)
			verificationLatency.median =
				sortedLatency[Math.floor(sortedLatency.length / 2)] || verificationLatency.average

			// Calculate 95th percentile
			verificationLatency.p95 =
				sortedLatency[Math.floor((sortedLatency.length - 1) * 0.95)] || verificationLatency.average
		}

		return {
			verificationId,
			verifiedAt,
			results: verificationResults,
			failures,
			statistics: {
				hashAlgorithms,
				verificationLatency,
			},
		}
	}

	/**
	 * Get events for a specific report
	 */
	private async getEvents(criteria: ReportCriteria): Promise<AuditLogEvent[]> {
		try {
			// Build the base query using template literals for simplicity
			let query = `SELECT * FROM audit_log WHERE organization_id = '${criteria.organizationIds?.[0]}'`

			if (criteria.principalIds && criteria.principalIds.length > 0) {
				query += ` AND principal_id IN (${criteria.principalIds.map((id) => `'${id}'`).join(',')})`
			}
			// Data classification filter
			if (criteria.dataClassifications && criteria.dataClassifications.length > 0) {
				query += ` AND data_classification IN (${criteria.dataClassifications
					.map((dc) => `'${dc}'`)
					.join(',')})`
			}
			// Actions filter
			if (criteria.actions && criteria.actions.length > 0) {
				query += ` AND action IN (${criteria.actions.map((a) => `'${a}'`).join(',')})`
			}
			// Status filter
			if (criteria.statuses && criteria.statuses.length > 0) {
				query += ` AND status IN (${criteria.statuses.map((s) => `'${s}'`).join(',')})`
			}
			// Resource types filter
			if (criteria.resourceTypes && criteria.resourceTypes.length > 0) {
				query += ` AND target_resource_type IN (${criteria.resourceTypes
					.map((rt) => `'${rt}'`)
					.join(',')})`
			}
			// Include only events with integrity verification
			if (criteria.verifiedOnly && !criteria.includeIntegrityFailures) {
				query += ` AND hash IS NOT NULL AND hash_algorithm IS NOT NULL`
			}
			// Apply date range filter
			if (criteria.dateRange) {
				query += ` AND timestamp >= '${criteria.dateRange.startDate}' AND timestamp <= '${criteria.dateRange.endDate}'`
			}

			// Add sorting
			const sortColumn = criteria.sortBy || 'createdAt'
			const sortDirection = criteria.sortOrder || 'desc'

			switch (sortColumn) {
				case 'timestamp':
					query += ` ORDER BY timestamp ${sortDirection.toUpperCase()}`
					break
				case 'status':
					query += ` ORDER BY CASE status 
								WHEN 'attempt' THEN 1 
								WHEN 'success' THEN 2 
								WHEN 'failure' THEN 3 
							END ${sortDirection.toUpperCase()}`
					break
				default:
					query += ` ORDER BY timestamp DESC`
			}

			// Add pagination
			if (criteria.limit) {
				query += ` LIMIT ${criteria.limit}`
			}
			if (criteria.offset) {
				query += ` OFFSET ${criteria.offset}`
			}

			const cacheKey = this.client.generateCacheKey('get_audit_log_events', criteria)
			const result = await this.client.executeMonitoredQuery(
				(db) => db.execute(sql.raw(query)),
				'get_audit_log_events',
				{ cacheKey }
			)

			const rows = result || []
			return rows.map(this.mapDatabaseAuditLogToAuditLog)
		} catch (error) {
			throw new Error(`Failed to retrieve audit log events: ${error}`)
		}
	}

	/**
	 * Filter events based on report criteria
	 * @deprecated Use getEvents instead
	 */
	private filterEvents(events: AuditLogEvent[], criteria: ReportCriteria): AuditLogEvent[] {
		let filtered = events

		// Date range filter
		if (criteria.dateRange) {
			const startDate = new Date(criteria.dateRange.startDate)
			const endDate = new Date(criteria.dateRange.endDate)

			filtered = filtered.filter((event) => {
				const eventDate = new Date(event.timestamp)
				return eventDate >= startDate && eventDate <= endDate
			})
		}

		// Principal ID filter
		if (criteria.principalIds && criteria.principalIds.length > 0) {
			filtered = filtered.filter(
				(event) => event.principalId && criteria.principalIds!.includes(event.principalId)
			)
		}

		// Organization ID filter
		if (criteria.organizationIds && criteria.organizationIds.length > 0) {
			filtered = filtered.filter(
				(event) => event.organizationId && criteria.organizationIds!.includes(event.organizationId)
			)
		}

		// Actions filter
		if (criteria.actions && criteria.actions.length > 0) {
			filtered = filtered.filter((event) => criteria.actions!.includes(event.action))
		}

		// Data classification filter
		if (criteria.dataClassifications && criteria.dataClassifications.length > 0) {
			filtered = filtered.filter(
				(event) =>
					event.dataClassification &&
					criteria.dataClassifications!.includes(event.dataClassification)
			)
		}

		// Status filter
		if (criteria.statuses && criteria.statuses.length > 0) {
			filtered = filtered.filter((event) => criteria.statuses!.includes(event.status))
		}

		// Resource types filter
		if (criteria.resourceTypes && criteria.resourceTypes.length > 0) {
			filtered = filtered.filter(
				(event) =>
					event.targetResourceType && criteria.resourceTypes!.includes(event.targetResourceType)
			)
		}

		// Verified only filter
		if (criteria.verifiedOnly) {
			filtered = filtered.filter((event) => event.hash && event.hashAlgorithm)
		}

		// Apply limit and offset
		if (criteria.offset) {
			filtered = filtered.slice(criteria.offset)
		}

		if (criteria.limit) {
			filtered = filtered.slice(0, criteria.limit)
		}

		return filtered
	}

	/**
	 * Generate summary statistics for events
	 */
	private generateSummary(events: AuditLogEvent[]) {
		const eventsByStatus: Record<string, number> = {}
		const eventsByAction: Record<string, number> = {}
		const eventsByDataClassification: Record<string, number> = {}
		const uniquePrincipals = new Set<string>()
		const uniqueResources = new Set<string>()
		let integrityViolations = 0

		let earliest = events[0]?.timestamp
		let latest = events[0]?.timestamp

		for (const event of events) {
			// Status breakdown
			eventsByStatus[event.status] = (eventsByStatus[event.status] || 0) + 1

			// Action breakdown
			eventsByAction[event.action] = (eventsByAction[event.action] || 0) + 1

			// Data classification breakdown
			if (event.dataClassification) {
				eventsByDataClassification[event.dataClassification] =
					(eventsByDataClassification[event.dataClassification] || 0) + 1
			}

			// Unique principals
			if (event.principalId) {
				uniquePrincipals.add(event.principalId)
			}

			// Unique resources
			if (event.targetResourceType && event.targetResourceId) {
				uniqueResources.add(`${event.targetResourceType}/${event.targetResourceId}`)
			}

			// TODO Integrity violations (placeholder logic)
			if (event.status === 'failure' && event.action.includes('integrity')) {
				integrityViolations++
			}

			// Time range
			if (event.timestamp < earliest) earliest = event.timestamp
			if (event.timestamp > latest) latest = event.timestamp
		}

		return {
			eventsByStatus,
			eventsByAction,
			eventsByDataClassification,
			uniquePrincipals: uniquePrincipals.size,
			uniqueResources: uniqueResources.size,
			integrityViolations,
			timeRange: {
				earliest: earliest || new Date().toISOString(),
				latest: latest || new Date().toISOString(),
			},
		}
	}

	/**
	 * Convert audit events to report event format
	 */
	private convertToReportEvents(events: AuditLogEvent[]): ComplianceReportEvent[] {
		return events.map((event) => ({
			id: event.id,
			timestamp: event.timestamp,
			principalId: event.principalId,
			organizationId: event.organizationId,
			action: event.action,
			targetResourceType: event.targetResourceType,
			targetResourceId: event.targetResourceId,
			status: event.status,
			outcomeDescription: event.outcomeDescription,
			dataClassification: event.dataClassification,
			sessionContext: event.sessionContext
				? {
						ipAddress: event.sessionContext.ipAddress,
						userAgent: event.sessionContext.userAgent,
						sessionId: event.sessionContext.sessionId,
					}
				: undefined,
			integrityStatus: event.hash ? 'verified' : 'not_checked',
			correlationId: event.correlationId,
		}))
	}

	/**
	 * Generate HIPAA-specific metrics
	 */
	private generateHIPAAMetrics(events: AuditLogEvent[]) {
		// TODO: Replace with real HIPAA metrics logic
		return {
			phiAccessEvents: events.filter((e) => e.action.includes('read')).length,
			phiModificationEvents: events.filter(
				(e) =>
					e.action.includes('create') || e.action.includes('update') || e.action.includes('delete')
			).length,
			unauthorizedAttempts: events.filter((e) => e.status === 'failure').length,
			emergencyAccess: events.filter((e) => e.action.includes('emergency')).length,
			breakGlassEvents: events.filter((e) => e.action.includes('break_glass')).length,
			minimumNecessaryViolations: 0, // Placeholder - would require business logic
		}
	}

	/**
	 * Generate GDPR-specific metrics
	 */
	private generateGDPRMetrics(events: AuditLogEvent[]) {
		// TODO: Replace with real GDPR metrics logic
		return {
			personalDataEvents: events.length,
			dataSubjectRights: events.filter((e) => this.isDataSubjectRightsAction(e.action)).length,
			consentEvents: events.filter((e) => e.action.includes('consent')).length,
			dataBreaches: events.filter((e) => e.action.includes('breach')).length,
			crossBorderTransfers: events.filter((e) => e.action.includes('transfer')).length,
			retentionViolations: 0, // Placeholder - would require retention policy checking
		}
	}

	/**
	 * Perform risk assessment for HIPAA compliance
	 */
	private performRiskAssessment(events: AuditLogEvent[]) {
		// TODO: Replace with real risk assessment logic
		const highRiskEvents = events.filter(
			(event) =>
				event.status === 'failure' ||
				event.action.includes('emergency') ||
				event.action.includes('break_glass')
		)

		const suspiciousPatterns: SuspiciousPattern[] = []

		// Detect unusual access patterns
		const accessByPrincipal: Record<string, number> = {}
		events.forEach((event) => {
			if (event.principalId) {
				accessByPrincipal[event.principalId] = (accessByPrincipal[event.principalId] || 0) + 1
			}
		})

		// Flag principals with unusually high access
		Object.entries(accessByPrincipal).forEach(([principalId, count]) => {
			if (count > 100) {
				// Threshold for suspicious activity
				suspiciousPatterns.push({
					patternType: 'HIGH_VOLUME_ACCESS',
					description: `Principal ${principalId} accessed ${count} resources`,
					events: events.filter((e) => e.principalId === principalId).slice(0, 10),
					riskLevel: 'MEDIUM',
					recommendation: 'Review access patterns and verify legitimate business need',
				})
			}
		})

		return {
			// TODO: Replace with real high risk events
			highRiskEvents: this.convertToReportEvents(highRiskEvents),
			suspiciousPatterns,
			recommendations: [
				'Implement additional access controls for high-risk resources',
				'Review and update minimum necessary access policies',
				'Enhance monitoring for emergency access procedures',
			],
		}
	}

	/**
	 * Generate legal basis breakdown for GDPR
	 */
	private generateLegalBasisBreakdown(events: AuditLogEvent[]): Record<string, number> {
		const breakdown: Record<string, number> = {}

		// TODO: Replace with real legal basis breakdown logic
		events.forEach((event) => {
			const basis = (event as any).gdprContext?.legalBasis || 'unspecified'
			breakdown[basis] = (breakdown[basis] || 0) + 1
		})

		return breakdown
	}

	/**
	 * Generate data subject rights summary
	 */
	private generateDataSubjectRightsSummary(events: AuditLogEvent[]) {
		// TODO: Replace with real data subject rights summary logic
		return {
			accessRequests: events.filter((e) => e.action.includes('access')).length,
			rectificationRequests: events.filter((e) => e.action.includes('rectify')).length,
			erasureRequests: events.filter(
				(e) => e.action.includes('delete') || e.action.includes('erase')
			).length,
			portabilityRequests: events.filter(
				(e) => e.action.includes('export') || e.action.includes('portability')
			).length,
			objectionRequests: events.filter((e) => e.action.includes('objection')).length,
		}
	}

	/**
	 * Helper methods
	 */
	private generateReportId(): string {
		return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
	}

	private isPHIResource(resourceType?: string): boolean {
		if (!resourceType) return false

		// TODO: Replace with real list of phi resources
		const phiResources = [
			'Patient',
			'Observation',
			'Condition',
			'Procedure',
			'MedicationRequest',
			'MedicationStatement',
			'AllergyIntolerance',
			'DiagnosticReport',
			'DocumentReference',
			'Encounter',
			'ImagingStudy',
			'Immunization',
			'CarePlan',
			'CareTeam',
			'Goal',
		]

		return phiResources.includes(resourceType)
	}

	private isPersonalDataProcessing(event: AuditLogEvent): boolean {
		// TODO: Replace with real list of personal data actions
		const personalDataActions = [
			'data.create',
			'data.read',
			'data.update',
			'data.delete',
			'data.export',
			'data.share',
			'fhir.patient',
			'user.profile',
		]

		return personalDataActions.some((action) =>
			event.action.toLowerCase().includes(action.toLowerCase())
		)
	}

	private isDataSubjectRightsAction(action: string): boolean {
		// TODO: Replace with real list of data subject rights actions
		const rightsActions = [
			'data.export',
			'data.delete',
			'data.rectify',
			'data.access',
			'consent.withdraw',
		]

		return rightsActions.some((rightsAction) =>
			action.toLowerCase().includes(rightsAction.toLowerCase())
		)
	}

	private async verifyEventIntegrity(event: AuditLogEvent): Promise<boolean> {
		const hash = event.hash
		if (!hash) return false
		return this.audit.verifyEventHash(event, hash)
	}

	/**
	 * Map database audit log record to AuditLog interface
	 */
	private mapDatabaseAuditLogToAuditLog(dbAuditLog: any): AuditLogEvent {
		return {
			id: dbAuditLog.id,
			timestamp: dbAuditLog.timestamp as string,
			principalId: dbAuditLog.principal_id as string,
			organizationId: dbAuditLog.organization_id as string,
			action: dbAuditLog.action as string,
			targetResourceType: dbAuditLog.target_resource_type as string,
			targetResourceId: dbAuditLog.target_resource_id as string,
			status: dbAuditLog.status as AuditEventStatus,
			outcomeDescription: dbAuditLog.outcome_description as string,
			hash: dbAuditLog.hash as string,
			hashAlgorithm: dbAuditLog.hash_algorithm,
			signature: dbAuditLog.signature as string,
			eventVersion: dbAuditLog.event_version,
			correlationId: dbAuditLog.correlation_id,
			dataClassification: dbAuditLog.data_classification as DataClassification,
			retentionPolicy: dbAuditLog.retention_policy as string,
			processingLatency: dbAuditLog.processing_latency as number,
			queueDepth: dbAuditLog.queue_depth as number,
			archivedAt: dbAuditLog.archived_at,
			details: {
				...(typeof dbAuditLog.details === 'string'
					? JSON.parse(dbAuditLog.details)
					: dbAuditLog.details),
				organizationId: dbAuditLog.organization_id,
			},
		}
	}
}
