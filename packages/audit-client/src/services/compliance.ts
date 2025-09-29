import { BaseResource } from '../core/base-resource'
import { ManagedReadableStream, StreamConfig, StreamingManager } from '../infrastructure/streaming'
import {
	CustomReport,
	CustomReportParams,
	GdprExportParams,
	GdprExportResult,
	GDPRReport,
	HIPAAReport,
	PseudonymizationParams,
	PseudonymizationResult,
	ReportCriteria,
	ReportTemplate,
} from '../types/compliance'
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
	private streamingManager: StreamingManager

	constructor(config: AuditClientConfig, logger?: Logger) {
		super(config, logger)
		this.streamingManager = new StreamingManager(
			{
				enableCompression: config.performance?.enableCompression || true,
				maxConcurrentStreams: config.performance?.maxConcurrentRequests || 10,
				chunkSize: 8192,
				batchSize: 100,
				enableMetrics: true,
			},
			logger
		)
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
		assertDefined(response.requestId, 'Pseudonymization result missing request ID')
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
		if (!validFormats.includes(params.format)) {
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
	 * Stream large compliance report data with backpressure management
	 *
	 * @param reportId - The report ID to stream
	 * @param options - Streaming options including format and compression
	 * @returns Managed readable stream for large report data
	 *
	 * Requirements: 5.4 - WHEN reports are large THEN the client SHALL support streaming and chunked downloads
	 */
	async streamReport(
		reportId: string,
		options: ReportDownloadOptions & { chunkSize?: number }
	): Promise<ManagedReadableStream<Uint8Array>> {
		this.validateDownloadOptions(options)

		// Create streaming source for large report downloads
		const streamSource: UnderlyingDefaultSource<Uint8Array> = {
			start: async (controller) => {
				try {
					// Get the raw stream from the server
					const rawStream = await this.request<ReadableStream<Uint8Array>>(
						`/compliance/reports/${reportId}/stream`,
						{
							method: 'GET',
							query: options,
							responseType: 'stream',
						}
					)

					// Process the stream with proper chunk handling
					const reader = rawStream.getReader()

					const processChunk = async () => {
						try {
							const { done, value } = await reader.read()

							if (done) {
								controller.close()
								return
							}

							controller.enqueue(value)

							// Continue processing
							processChunk()
						} catch (error) {
							controller.error(error)
						}
					}

					// Start processing
					processChunk()
				} catch (error) {
					controller.error(error)
				}
			},
		}

		// Create managed stream with enhanced features
		return this.streamingManager.createExportStream(streamSource, {
			chunkSize: options.chunkSize || 8192,
			enableCompression: options.compression !== 'none',
			enableMetrics: true,
		})
	}

	/**
	 * Stream GDPR data export with enhanced processing
	 *
	 * @param params - GDPR export parameters
	 * @returns Managed readable stream for GDPR data
	 *
	 * Requirements: 5.4 - WHEN reports are large THEN the client SHALL support streaming and chunked downloads
	 */
	async streamGdprExport(params: GdprExportParams): Promise<ManagedReadableStream<any>> {
		// Validate input parameters
		const validationResult = validateGdprExportParams(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid GDPR export parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		// Create streaming source for GDPR data export
		const streamSource: UnderlyingDefaultSource<any> = {
			start: async (controller) => {
				try {
					// Get the raw stream from the server
					const rawStream = await this.request<ReadableStream<Uint8Array>>(
						'/compliance/gdpr/export/stream',
						{
							method: 'POST',
							body: validationResult.data,
							responseType: 'stream',
						}
					)

					// Process the stream with JSON parsing
					const reader = rawStream.getReader()
					const decoder = new TextDecoder()
					let buffer = ''

					const processChunk = async () => {
						try {
							const { done, value } = await reader.read()

							if (done) {
								// Process any remaining data in buffer
								if (buffer.trim()) {
									try {
										const data = JSON.parse(buffer.trim())
										controller.enqueue(data)
									} catch (error) {
										this.logger.warn('Failed to parse final buffer chunk', { buffer, error })
									}
								}
								controller.close()
								return
							}

							// Decode chunk and add to buffer
							buffer += decoder.decode(value, { stream: true })

							// Process complete lines (assuming NDJSON format)
							const lines = buffer.split('\n')
							buffer = lines.pop() || '' // Keep incomplete line in buffer

							for (const line of lines) {
								if (line.trim()) {
									try {
										const data = JSON.parse(line.trim())
										controller.enqueue(data)
									} catch (error) {
										this.logger.warn('Failed to parse stream line', { line, error })
									}
								}
							}

							// Continue processing
							processChunk()
						} catch (error) {
							controller.error(error)
						}
					}

					// Start processing
					processChunk()
				} catch (error) {
					controller.error(error)
				}
			},
		}

		// Create managed stream with enhanced features
		return this.streamingManager.createExportStream(streamSource, {
			enableCompression: true,
			enableMetrics: true,
			batchSize: 50, // Smaller batches for GDPR data
		})
	}

	/**
	 * Get streaming metrics for compliance operations
	 *
	 * @returns Current streaming metrics
	 */
	getStreamingMetrics(): {
		connections: any
		totalConnections: number
		activeConnections: number
	} {
		return this.streamingManager.getMetrics()
	}

	/**
	 * Cleanup streaming resources
	 */
	async destroyStreaming(): Promise<void> {
		await this.streamingManager.destroy()
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
