import { BaseResource } from '../core/base-resource'
import { assertDefined, assertType, isNonEmptyString, isObject } from '../utils/type-guards'
import {
	validateCustomReportParams,
	validateGdprExportParams,
	validatePseudonymizationParams,
	validateReportCriteria,
	ValidationError,
} from '../utils/validation'

import type { RequestOptions } from '../core/base-resource'
import type { AuditClientConfig } from '../core/config'
import type { Logger } from '../infrastructure/logger'

/**
 * Report criteria interface for filtering compliance reports
 */
export interface ReportCriteria {
	dateRange: {
		startDate: string
		endDate: string
	}
	organizationIds?: string[]
	principalIds?: string[]
	resourceTypes?: string[]
	actions?: string[]
	dataClassifications?: ('PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI')[]
	includeDetails?: boolean
	includeMetadata?: boolean
}

/**
 * Report metadata interface
 */
export interface ReportMetadata {
	generatedBy: string
	generationTime: number
	queryExecutionTime: number
	totalRecordsProcessed: number
	filterCriteria: ReportCriteria
	reportVersion: string
	complianceFramework: string
}

/**
 * HIPAA report section interface
 */
export interface HIPAASection {
	sectionId: string
	title: string
	description: string
	requirements: string[]
	findings: {
		compliant: number
		nonCompliant: number
		details: Array<{
			eventId: string
			status: 'compliant' | 'non-compliant' | 'warning'
			description: string
			recommendation?: string
		}>
	}
	riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * HIPAA compliance report interface
 */
export interface HIPAAReport {
	id: string
	generatedAt: string
	criteria: ReportCriteria
	summary: {
		totalEvents: number
		complianceScore: number
		violations: number
		recommendations: string[]
		riskAssessment: {
			overallRisk: 'low' | 'medium' | 'high' | 'critical'
			riskFactors: string[]
		}
	}
	sections: HIPAASection[]
	metadata: ReportMetadata
}

/**
 * GDPR report section interface
 */
export interface GDPRSection {
	sectionId: string
	title: string
	description: string
	lawfulBasis: string[]
	findings: {
		dataSubjects: number
		processingActivities: number
		consentRecords: number
		details: Array<{
			eventId: string
			dataSubject: string
			processingPurpose: string
			lawfulBasis: string
			consentStatus: 'given' | 'withdrawn' | 'not-required'
			retentionPeriod?: string
		}>
	}
	complianceStatus: 'compliant' | 'non-compliant' | 'requires-attention'
}

/**
 * GDPR compliance report interface
 */
export interface GDPRReport {
	id: string
	generatedAt: string
	criteria: ReportCriteria
	summary: {
		totalEvents: number
		dataSubjects: number
		processingActivities: number
		lawfulBases: string[]
		consentManagement: {
			totalConsents: number
			activeConsents: number
			withdrawnConsents: number
		}
		dataRetention: {
			withinRetentionPeriod: number
			exceedsRetentionPeriod: number
		}
	}
	sections: GDPRSection[]
	metadata: ReportMetadata
}

/**
 * Custom report parameters interface
 */
export interface CustomReportParams {
	templateId: string
	name: string
	description?: string
	criteria: ReportCriteria
	parameters: Record<string, any>
	outputFormat: 'json' | 'csv' | 'pdf' | 'xlsx'
	includeCharts?: boolean
	customFields?: string[]
}

/**
 * Custom report interface
 */
export interface CustomReport {
	id: string
	name: string
	description?: string
	generatedAt: string
	template: string
	parameters: Record<string, any>
	data: any[]
	summary: Record<string, any>
	charts?: Array<{
		type: 'bar' | 'line' | 'pie' | 'scatter'
		title: string
		data: any[]
		config: Record<string, any>
	}>
	metadata: ReportMetadata
}

/**
 * GDPR data export parameters
 */
export interface GdprExportParams {
	dataSubjectId: string
	organizationId: string
	includePersonalData: boolean
	includePseudonymizedData: boolean
	includeMetadata: boolean
	format: 'json' | 'csv' | 'xml'
	dateRange?: {
		startDate: string
		endDate: string
	}
	categories?: string[]
}

/**
 * GDPR data export result
 */
export interface GdprExportResult {
	exportId: string
	dataSubjectId: string
	generatedAt: string
	format: string
	data: {
		personalData: Record<string, any>[]
		pseudonymizedData?: Record<string, any>[]
		metadata?: Record<string, any>
	}
	summary: {
		totalRecords: number
		categories: string[]
		dateRange: {
			startDate: string
			endDate: string
		}
	}
	downloadUrl?: string
	expiresAt: string
}

/**
 * Pseudonymization parameters
 */
export interface PseudonymizationParams {
	dataSubjectIds: string[]
	organizationId: string
	fields: string[]
	method: 'hash' | 'encrypt' | 'tokenize' | 'mask'
	preserveFormat?: boolean
	saltValue?: string
	dateRange?: {
		startDate: string
		endDate: string
	}
}

/**
 * Pseudonymization result
 */
export interface PseudonymizationResult {
	operationId: string
	processedAt: string
	method: string
	summary: {
		totalRecords: number
		processedRecords: number
		failedRecords: number
		affectedFields: string[]
	}
	mapping?: Record<string, string>
	errors?: Array<{
		recordId: string
		field: string
		error: string
	}>
}

/**
 * Report template interface
 */
export interface ReportTemplate {
	id: string
	name: string
	description: string
	category: 'hipaa' | 'gdpr' | 'custom' | 'security' | 'audit'
	version: string
	parameters: Array<{
		name: string
		type: 'string' | 'number' | 'boolean' | 'date' | 'array'
		required: boolean
		description: string
		defaultValue?: any
		options?: any[]
	}>
	outputFormats: ('json' | 'csv' | 'pdf' | 'xlsx')[]
	createdAt: string
	updatedAt: string
	isActive: boolean
}

/**
 * Report download options
 */
export interface ReportDownloadOptions {
	format: 'pdf' | 'csv' | 'json' | 'xlsx'
	includeCharts?: boolean
	includeMetadata?: boolean
	compression?: 'none' | 'gzip' | 'zip'
}

/**
 * ComplianceService - Comprehensive compliance reporting capabilities
 *
 * This service provides:
 * - HIPAA compliance report generation
 * - GDPR compliance report generation and data export
 * - Custom report generation with flexible parameters
 * - Report template management
 * - Data pseudonymization for privacy compliance
 * - Report download functionality with multiple formats
 */
export class ComplianceService extends BaseResource {
	constructor(config: AuditClientConfig, logger?: Logger) {
		super(config, logger)
	}

	/**
	 * Generate HIPAA compliance report
	 * Requirement 5.1: WHEN generating HIPAA reports THEN the client SHALL provide methods with proper criteria validation
	 */
	async generateHipaaReport(criteria: ReportCriteria): Promise<HIPAAReport> {
		// Validate input using centralized validation
		const validationResult = validateReportCriteria(criteria)
		if (!validationResult.success) {
			throw new ValidationError('Invalid report criteria for HIPAA report', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const response = await this.request<HIPAAReport>('/compliance/reports/hipaa', {
			method: 'POST',
			body: { criteria: validationResult.data },
		})

		// Validate response structure
		assertType(response, isObject, 'Invalid HIPAA report response from server')
		assertDefined(response.id, 'HIPAA report response missing ID')
		assertDefined(response.summary, 'HIPAA report response missing summary')

		return response
	}

	/**
	 * Generate GDPR compliance report
	 * Requirement 5.2: WHEN generating GDPR reports THEN the client SHALL support data export and pseudonymization requests
	 */
	async generateGdprReport(criteria: ReportCriteria): Promise<GDPRReport> {
		// Validate input using centralized validation
		const validationResult = validateReportCriteria(criteria)
		if (!validationResult.success) {
			throw new ValidationError('Invalid report criteria for GDPR report', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const response = await this.request<GDPRReport>('/compliance/reports/gdpr', {
			method: 'POST',
			body: { criteria: validationResult.data },
		})

		// Validate response structure
		assertType(response, isObject, 'Invalid GDPR report response from server')
		assertDefined(response.id, 'GDPR report response missing ID')
		assertDefined(response.summary, 'GDPR report response missing summary')

		return response
	}

	/**
	 * Generate custom compliance report
	 * Requirement 5.3: WHEN creating custom reports THEN the client SHALL allow flexible report criteria and formatting
	 */
	async generateCustomReport(params: CustomReportParams): Promise<CustomReport> {
		// Validate input using centralized validation
		const validationResult = validateCustomReportParams(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid custom report parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const response = await this.request<CustomReport>('/compliance/reports/custom', {
			method: 'POST',
			body: validationResult.data,
		})

		// Validate response structure
		assertType(response, isObject, 'Invalid custom report response from server')
		assertDefined(response.id, 'Custom report response missing ID')
		assertDefined(response.name, 'Custom report response missing name')

		return response
	}

	/**
	 * Export data for GDPR requests
	 * Requirement 5.2: WHEN generating GDPR reports THEN the client SHALL support data export and pseudonymization requests
	 */
	async exportGdprData(params: GdprExportParams): Promise<GdprExportResult> {
		// Validate input using centralized validation
		const validationResult = validateGdprExportParams(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid GDPR export parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const response = await this.request<GdprExportResult>('/compliance/gdpr/export', {
			method: 'POST',
			body: validationResult.data,
		})

		// Validate response structure
		assertType(response, isObject, 'Invalid GDPR export result from server')
		assertDefined(response.exportId, 'GDPR export result missing export ID')
		assertDefined(response.dataSubjectId, 'GDPR export result missing data subject ID')

		return response
	}

	/**
	 * Pseudonymize data for GDPR compliance
	 * Requirement 5.2: WHEN generating GDPR reports THEN the client SHALL support data export and pseudonymization requests
	 */
	async pseudonymizeData(params: PseudonymizationParams): Promise<PseudonymizationResult> {
		// Validate input using centralized validation
		const validationResult = validatePseudonymizationParams(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid pseudonymization parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const response = await this.request<PseudonymizationResult>('/compliance/gdpr/pseudonymize', {
			method: 'POST',
			body: validationResult.data,
		})

		// Validate response structure
		assertType(response, isObject, 'Invalid pseudonymization result from server')
		assertDefined(response.operationId, 'Pseudonymization result missing operation ID')
		assertDefined(response.summary, 'Pseudonymization result missing summary')

		return response
	}

	/**
	 * Get compliance report templates
	 * Requirement 5.4: WHEN report generation fails THEN the client SHALL provide detailed error information and retry options
	 */
	async getReportTemplates(): Promise<ReportTemplate[]> {
		return this.request<ReportTemplate[]>('/compliance/templates')
	}

	/**
	 * Get specific report template by ID
	 */
	async getReportTemplate(templateId: string): Promise<ReportTemplate | null> {
		try {
			return await this.request<ReportTemplate>(`/compliance/templates/${templateId}`)
		} catch (error: any) {
			if (error.status === 404) {
				return null
			}
			throw error
		}
	}

	/**
	 * Create new report template
	 */
	async createReportTemplate(
		template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>
	): Promise<ReportTemplate> {
		this.validateReportTemplate(template)

		return this.request<ReportTemplate>('/compliance/templates', {
			method: 'POST',
			body: template,
		})
	}

	/**
	 * Update existing report template
	 */
	async updateReportTemplate(
		templateId: string,
		updates: Partial<ReportTemplate>
	): Promise<ReportTemplate> {
		return this.request<ReportTemplate>(`/compliance/templates/${templateId}`, {
			method: 'PUT',
			body: updates,
		})
	}

	/**
	 * Delete report template
	 */
	async deleteReportTemplate(templateId: string): Promise<void> {
		await this.request<void>(`/compliance/templates/${templateId}`, {
			method: 'DELETE',
		})
	}

	/**
	 * Download report as file
	 * Requirement 5.4: WHEN reports are large THEN the client SHALL support streaming and chunked downloads
	 */
	async downloadReport(reportId: string, options: ReportDownloadOptions): Promise<Blob> {
		this.validateDownloadOptions(options)

		return this.request<Blob>(`/compliance/reports/${reportId}/download`, {
			method: 'GET',
			query: options,
			responseType: 'blob',
		})
	}

	/**
	 * Get report generation status
	 */
	async getReportStatus(reportId: string): Promise<{
		id: string
		status: 'pending' | 'processing' | 'completed' | 'failed'
		progress: number
		estimatedCompletion?: string
		error?: string
	}> {
		return this.request(`/compliance/reports/${reportId}/status`)
	}

	/**
	 * Cancel report generation
	 */
	async cancelReport(reportId: string): Promise<void> {
		await this.request<void>(`/compliance/reports/${reportId}/cancel`, {
			method: 'POST',
		})
	}

	/**
	 * Stream large report data
	 * Requirement 5.4: WHEN reports are large THEN the client SHALL support streaming and chunked downloads
	 */
	async streamReport(reportId: string, format: 'json' | 'csv' = 'json'): Promise<ReadableStream> {
		return this.request<ReadableStream>(`/compliance/reports/${reportId}/stream`, {
			method: 'GET',
			query: { format },
			responseType: 'stream',
		})
	}

	/**
	 * Get report history for an organization
	 */
	async getReportHistory(
		organizationId: string,
		params: {
			limit?: number
			offset?: number
			reportType?: 'hipaa' | 'gdpr' | 'custom'
			dateRange?: { startDate: string; endDate: string }
		} = {}
	): Promise<{
		reports: Array<{
			id: string
			type: string
			name: string
			generatedAt: string
			status: string
			size: number
		}>
		pagination: {
			total: number
			limit: number
			offset: number
			hasNext: boolean
		}
	}> {
		return this.request(`/compliance/reports/history/${organizationId}`, {
			method: 'GET',
			query: params,
		})
	}

	/**
	 * Validate report criteria
	 */
	private validateReportCriteria(criteria: ReportCriteria): void {
		if (!criteria.dateRange || !criteria.dateRange.startDate || !criteria.dateRange.endDate) {
			throw new Error('Report criteria must include a valid date range')
		}

		const startDate = new Date(criteria.dateRange.startDate)
		const endDate = new Date(criteria.dateRange.endDate)

		if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
			throw new Error('Invalid date format in report criteria')
		}

		if (startDate >= endDate) {
			throw new Error('Start date must be before end date')
		}

		// Validate date range is not too large (max 1 year)
		const maxRange = 365 * 24 * 60 * 60 * 1000 // 1 year in milliseconds
		if (endDate.getTime() - startDate.getTime() > maxRange) {
			throw new Error('Date range cannot exceed 1 year')
		}
	}

	/**
	 * Validate custom report parameters
	 */
	private validateCustomReportParams(params: CustomReportParams): void {
		if (!params.templateId) {
			throw new Error('Template ID is required for custom reports')
		}

		if (!params.name || params.name.trim().length === 0) {
			throw new Error('Report name is required')
		}

		this.validateReportCriteria(params.criteria)

		const validFormats = ['json', 'csv', 'pdf', 'xlsx']
		if (!validFormats.includes(params.outputFormat)) {
			throw new Error(`Invalid output format. Must be one of: ${validFormats.join(', ')}`)
		}
	}

	/**
	 * Validate GDPR export parameters
	 */
	private validateGdprExportParams(params: GdprExportParams): void {
		if (!params.dataSubjectId) {
			throw new Error('Data subject ID is required for GDPR export')
		}

		if (!params.organizationId) {
			throw new Error('Organization ID is required for GDPR export')
		}

		const validFormats = ['json', 'csv', 'xml']
		if (!validFormats.includes(params.format)) {
			throw new Error(`Invalid export format. Must be one of: ${validFormats.join(', ')}`)
		}

		if (params.dateRange) {
			const startDate = new Date(params.dateRange.startDate)
			const endDate = new Date(params.dateRange.endDate)

			if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
				throw new Error('Invalid date format in GDPR export parameters')
			}

			if (startDate >= endDate) {
				throw new Error('Start date must be before end date')
			}
		}
	}

	/**
	 * Validate pseudonymization parameters
	 */
	private validatePseudonymizationParams(params: PseudonymizationParams): void {
		if (!params.dataSubjectIds || params.dataSubjectIds.length === 0) {
			throw new Error('At least one data subject ID is required for pseudonymization')
		}

		if (!params.organizationId) {
			throw new Error('Organization ID is required for pseudonymization')
		}

		if (!params.fields || params.fields.length === 0) {
			throw new Error('At least one field is required for pseudonymization')
		}

		const validMethods = ['hash', 'encrypt', 'tokenize', 'mask']
		if (!validMethods.includes(params.method)) {
			throw new Error(`Invalid pseudonymization method. Must be one of: ${validMethods.join(', ')}`)
		}
	}

	/**
	 * Validate report template
	 */
	private validateReportTemplate(
		template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>
	): void {
		if (!template.name || template.name.trim().length === 0) {
			throw new Error('Template name is required')
		}

		if (!template.category) {
			throw new Error('Template category is required')
		}

		const validCategories = ['hipaa', 'gdpr', 'custom', 'security', 'audit']
		if (!validCategories.includes(template.category)) {
			throw new Error(`Invalid template category. Must be one of: ${validCategories.join(', ')}`)
		}

		if (!template.outputFormats || template.outputFormats.length === 0) {
			throw new Error('At least one output format is required')
		}

		const validFormats = ['json', 'csv', 'pdf', 'xlsx']
		for (const format of template.outputFormats) {
			if (!validFormats.includes(format)) {
				throw new Error(
					`Invalid output format: ${format}. Must be one of: ${validFormats.join(', ')}`
				)
			}
		}
	}

	/**
	 * Validate download options
	 */
	private validateDownloadOptions(options: ReportDownloadOptions): void {
		const validFormats = ['pdf', 'csv', 'json', 'xlsx']
		if (!validFormats.includes(options.format)) {
			throw new Error(`Invalid download format. Must be one of: ${validFormats.join(', ')}`)
		}

		if (options.compression) {
			const validCompressions = ['none', 'gzip', 'zip']
			if (!validCompressions.includes(options.compression)) {
				throw new Error(`Invalid compression type. Must be one of: ${validCompressions.join(', ')}`)
			}
		}
	}
}
