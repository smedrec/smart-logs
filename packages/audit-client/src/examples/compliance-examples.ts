/**
 * ComplianceService Usage Examples
 *
 * This file demonstrates how to use the ComplianceService for various
 * compliance reporting and data management tasks.
 */

import { ComplianceService } from '../services/compliance'

import type { AuditClientConfig } from '../core/config'
import type {
	CustomReportParams,
	GdprExportParams,
	PseudonymizationParams,
	ReportCriteria,
	ReportDownloadOptions,
} from '../services/compliance'

// Example configuration
const config: AuditClientConfig = {
	baseUrl: 'https://api.audit-system.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key-here',
	},
	retry: {
		enabled: true,
		maxAttempts: 3,
		initialDelayMs: 1000,
		maxDelayMs: 5000,
		backoffMultiplier: 2,
		retryableStatusCodes: [500, 502, 503, 504],
		retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
	},
	cache: {
		enabled: true,
		defaultTtlMs: 300000,
		maxSize: 100,
		storage: 'memory',
		keyPrefix: 'audit-client',
		compressionEnabled: false,
	},
	batching: {
		enabled: false,
		maxBatchSize: 10,
		batchTimeoutMs: 1000,
		batchableEndpoints: [],
	},
	performance: {
		enableCompression: false,
		enableStreaming: false,
		maxConcurrentRequests: 10,
		requestDeduplication: false,
		responseTransformation: false,
	},
	logging: {
		enabled: true,
		level: 'info',
		includeRequestBody: false,
		includeResponseBody: false,
		maskSensitiveData: true,
	},
	errorHandling: {
		throwOnError: true,
		includeStackTrace: false,
		errorTransformation: true,
	},
}

// Initialize the service
const complianceService = new ComplianceService(config)

/**
 * Example 1: Generate HIPAA Compliance Report
 */
export async function generateHipaaComplianceReport() {
	try {
		const criteria: ReportCriteria = {
			dateRange: {
				startDate: '2024-01-01',
				endDate: '2024-12-31',
			},
			organizationIds: ['healthcare-org-1', 'healthcare-org-2'],
			principalIds: ['doctor-123', 'nurse-456'],
			resourceTypes: ['patient-record', 'medical-image'],
			dataClassifications: ['PHI'],
			includeDetails: true,
			includeMetadata: true,
		}

		const report = await complianceService.generateHipaaReport(criteria)

		console.log('HIPAA Report Generated:', {
			id: report.id,
			complianceScore: report.summary.complianceScore,
			violations: report.summary.violations,
			totalEvents: report.summary.totalEvents,
			riskLevel: report.summary.riskAssessment.overallRisk,
		})

		// Download the report as PDF
		const downloadOptions: ReportDownloadOptions = {
			format: 'pdf',
			includeCharts: true,
			includeMetadata: true,
			compression: 'zip',
		}

		const reportBlob = await complianceService.downloadReport(report.id, downloadOptions)
		console.log('Report downloaded, size:', reportBlob.size, 'bytes')

		return report
	} catch (error) {
		console.error('Failed to generate HIPAA report:', error)
		throw error
	}
}

/**
 * Example 2: Generate GDPR Compliance Report
 */
export async function generateGdprComplianceReport() {
	try {
		const criteria: ReportCriteria = {
			dateRange: {
				startDate: '2024-01-01',
				endDate: '2024-12-31',
			},
			organizationIds: ['eu-company-1'],
			actions: ['data-access', 'data-processing', 'data-deletion'],
			dataClassifications: ['CONFIDENTIAL'],
			includeDetails: true,
		}

		const report = await complianceService.generateGdprReport(criteria)

		console.log('GDPR Report Generated:', {
			id: report.id,
			dataSubjects: report.summary.dataSubjects,
			processingActivities: report.summary.processingActivities,
			activeConsents: report.summary.consentManagement.activeConsents,
			withdrawnConsents: report.summary.consentManagement.withdrawnConsents,
		})

		return report
	} catch (error) {
		console.error('Failed to generate GDPR report:', error)
		throw error
	}
}

/**
 * Example 3: Generate Custom Report
 */
export async function generateCustomSecurityReport() {
	try {
		const params: CustomReportParams = {
			templateId: 'security-audit-template-v2',
			name: 'Q4 2024 Security Audit Report',
			description: 'Comprehensive security audit for Q4 2024',
			criteria: {
				dateRange: {
					startDate: '2024-10-01',
					endDate: '2024-12-31',
				},
				organizationIds: ['company-main'],
				actions: ['login', 'logout', 'data-access', 'admin-action'],
				resourceTypes: ['user-account', 'sensitive-data', 'admin-panel'],
			},
			parameters: {
				includeFailedAttempts: true,
				groupByUser: true,
				includeGeolocation: true,
				riskThreshold: 'medium',
			},
			outputFormat: 'xlsx',
			includeCharts: true,
			customFields: ['ip_address', 'user_agent', 'session_duration'],
		}

		const report = await complianceService.generateCustomReport(params)

		console.log('Custom Report Generated:', {
			id: report.id,
			name: report.name,
			recordCount: report.data.length,
			template: report.template,
		})

		return report
	} catch (error) {
		console.error('Failed to generate custom report:', error)
		throw error
	}
}

/**
 * Example 4: GDPR Data Export (Right to Data Portability)
 */
export async function exportUserDataForGdpr() {
	try {
		const params: GdprExportParams = {
			dataSubjectId: 'user-12345',
			organizationId: 'eu-company-1',
			includePersonalData: true,
			includePseudonymizedData: false,
			includeMetadata: true,
			format: 'json',
			dateRange: {
				startDate: '2023-01-01',
				endDate: '2024-12-31',
			},
			categories: ['personal-info', 'contact-details', 'preferences', 'activity-logs'],
		}

		const exportResult = await complianceService.exportGdprData(params)

		console.log('GDPR Data Export Completed:', {
			exportId: exportResult.exportId,
			totalRecords: exportResult.summary.totalRecords,
			categories: exportResult.summary.categories,
			downloadUrl: exportResult.downloadUrl,
			expiresAt: exportResult.expiresAt,
		})

		return exportResult
	} catch (error) {
		console.error('Failed to export GDPR data:', error)
		throw error
	}
}

/**
 * Example 5: Data Pseudonymization for Privacy Protection
 */
export async function pseudonymizeUserData() {
	try {
		const params: PseudonymizationParams = {
			dataSubjectIds: ['user-123', 'user-456', 'user-789'],
			organizationId: 'company-main',
			fields: ['email', 'phone', 'address', 'ssn'],
			method: 'hash',
			preserveFormat: true,
			saltValue: 'secure-salt-value-2024',
			dateRange: {
				startDate: '2024-01-01',
				endDate: '2024-12-31',
			},
		}

		const result = await complianceService.pseudonymizeData(params)

		console.log('Data Pseudonymization Completed:', {
			operationId: result.operationId,
			processedRecords: result.summary.processedRecords,
			failedRecords: result.summary.failedRecords,
			affectedFields: result.summary.affectedFields,
		})

		if (result.errors && result.errors.length > 0) {
			console.warn('Pseudonymization errors:', result.errors)
		}

		return result
	} catch (error) {
		console.error('Failed to pseudonymize data:', error)
		throw error
	}
}

/**
 * Example 6: Report Template Management
 */
export async function manageReportTemplates() {
	try {
		// Get all available templates
		const templates = await complianceService.getReportTemplates()
		console.log(
			'Available Templates:',
			templates.map((t) => ({
				id: t.id,
				name: t.name,
				category: t.category,
				outputFormats: t.outputFormats,
			}))
		)

		// Get specific template
		const hipaaTemplate = await complianceService.getReportTemplate('hipaa-standard-v1')
		if (hipaaTemplate) {
			console.log('HIPAA Template Details:', {
				name: hipaaTemplate.name,
				parameters: hipaaTemplate.parameters.length,
				outputFormats: hipaaTemplate.outputFormats,
			})
		}

		// Create new custom template
		const newTemplate = {
			name: 'Custom Security Audit Template',
			description: 'Template for comprehensive security audits',
			category: 'security' as const,
			version: '1.0',
			parameters: [
				{
					name: 'riskThreshold',
					type: 'string' as const,
					required: false,
					description: 'Minimum risk level to include in report',
					defaultValue: 'medium',
					options: ['low', 'medium', 'high', 'critical'],
				},
				{
					name: 'includeGeolocation',
					type: 'boolean' as const,
					required: false,
					description: 'Include geolocation data in the report',
					defaultValue: false,
				},
			],
			outputFormats: ['pdf', 'xlsx', 'csv'] as const,
			isActive: true,
		}

		const createdTemplate = await complianceService.createReportTemplate(newTemplate)
		console.log('Created Template:', createdTemplate.id)

		return { templates, createdTemplate }
	} catch (error) {
		console.error('Failed to manage report templates:', error)
		throw error
	}
}

/**
 * Example 7: Report Status Monitoring and Streaming
 */
export async function monitorReportGeneration() {
	try {
		// Start a large report generation
		const criteria: ReportCriteria = {
			dateRange: {
				startDate: '2024-01-01',
				endDate: '2024-12-31',
			},
			organizationIds: ['large-org-1', 'large-org-2', 'large-org-3'],
		}

		const report = await complianceService.generateHipaaReport(criteria)
		const reportId = report.id

		// Monitor report status
		let status = await complianceService.getReportStatus(reportId)
		console.log('Initial Status:', status)

		// Poll for completion (in real app, you might use intervals or websockets)
		while (status.status === 'processing') {
			await new Promise((resolve) => setTimeout(resolve, 5000)) // Wait 5 seconds
			status = await complianceService.getReportStatus(reportId)
			console.log('Status Update:', {
				status: status.status,
				progress: status.progress,
				estimatedCompletion: status.estimatedCompletion,
			})
		}

		if (status.status === 'completed') {
			// Stream the large report data
			const stream = await complianceService.streamReport(reportId, 'json')
			console.log('Report streaming started')

			// In a real application, you would process the stream
			// const reader = stream.getReader()
			// while (true) {
			//   const { done, value } = await reader.read()
			//   if (done) break
			//   // Process chunk
			// }
		} else if (status.status === 'failed') {
			console.error('Report generation failed:', status.error)
		}

		return status
	} catch (error) {
		console.error('Failed to monitor report generation:', error)
		throw error
	}
}

/**
 * Example 8: Report History and Management
 */
export async function manageReportHistory() {
	try {
		const organizationId = 'company-main'

		// Get report history
		const history = await complianceService.getReportHistory(organizationId, {
			limit: 20,
			offset: 0,
			reportType: 'hipaa',
			dateRange: {
				startDate: '2024-01-01',
				endDate: '2024-12-31',
			},
		})

		console.log('Report History:', {
			totalReports: history.pagination.total,
			recentReports: history.reports.slice(0, 5).map((r) => ({
				id: r.id,
				type: r.type,
				name: r.name,
				generatedAt: r.generatedAt,
				status: r.status,
				size: `${(r.size / 1024 / 1024).toFixed(2)} MB`,
			})),
		})

		return history
	} catch (error) {
		console.error('Failed to manage report history:', error)
		throw error
	}
}

// Export all examples for easy usage
export const complianceExamples = {
	generateHipaaComplianceReport,
	generateGdprComplianceReport,
	generateCustomSecurityReport,
	exportUserDataForGdpr,
	pseudonymizeUserData,
	manageReportTemplates,
	monitorReportGeneration,
	manageReportHistory,
}
