import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComplianceService } from '../../services/compliance'

import type { AuditClientConfig } from '../../core/config'
import type {
	CustomReportParams,
	GdprExportParams,
	PseudonymizationParams,
	ReportCriteria,
} from '../../services/compliance'

// Mock the BaseResource
vi.mock('../../core/base-resource', () => ({
	BaseResource: class MockBaseResource {
		protected config: AuditClientConfig
		protected logger: any

		constructor(config: AuditClientConfig, logger?: any) {
			this.config = config
			this.logger = logger
		}

		protected async request<T>(endpoint: string, options: any = {}): Promise<T> {
			// Mock implementation that returns different responses based on endpoint
			if (endpoint === '/compliance/reports/hipaa') {
				return {
					id: 'hipaa-report-123',
					generatedAt: '2025-01-01T00:00:00Z',
					criteria: options.body.criteria,
					summary: {
						totalEvents: 100,
						complianceScore: 95,
						violations: 2,
						recommendations: ['Implement stronger access controls'],
						riskAssessment: {
							overallRisk: 'low',
							riskFactors: ['Minor access violations'],
						},
					},
					sections: [],
					metadata: {
						generatedBy: 'system',
						generationTime: 1000,
						queryExecutionTime: 500,
						totalRecordsProcessed: 100,
						filterCriteria: options.body.criteria,
						reportVersion: '1.0',
						complianceFramework: 'HIPAA',
					},
				} as T
			}

			if (endpoint === '/compliance/reports/gdpr') {
				return {
					id: 'gdpr-report-123',
					generatedAt: '2025-01-01T00:00:00Z',
					criteria: options.body.criteria,
					summary: {
						totalEvents: 100,
						dataSubjects: 50,
						processingActivities: 25,
						lawfulBases: ['consent', 'legitimate-interest'],
						consentManagement: {
							totalConsents: 50,
							activeConsents: 45,
							withdrawnConsents: 5,
						},
						dataRetention: {
							withinRetentionPeriod: 90,
							exceedsRetentionPeriod: 10,
						},
					},
					sections: [],
					metadata: {
						generatedBy: 'system',
						generationTime: 1000,
						queryExecutionTime: 500,
						totalRecordsProcessed: 100,
						filterCriteria: options.body.criteria,
						reportVersion: '1.0',
						complianceFramework: 'GDPR',
					},
				} as T
			}

			if (endpoint === '/compliance/reports/custom') {
				return {
					id: 'custom-report-123',
					name: options.body.name,
					generatedAt: '2025-01-01T00:00:00Z',
					template: options.body.templateId,
					parameters: options.body.parameters,
					data: [],
					summary: {},
					metadata: {
						generatedBy: 'system',
						generationTime: 1000,
						queryExecutionTime: 500,
						totalRecordsProcessed: 100,
						filterCriteria: options.body.criteria,
						reportVersion: '1.0',
						complianceFramework: 'Custom',
					},
				} as T
			}

			if (endpoint === '/compliance/gdpr/export') {
				return {
					exportId: 'export-123',
					dataSubjectId: options.body.dataSubjectId,
					generatedAt: '2025-01-01T00:00:00Z',
					format: options.body.format,
					data: {
						personalData: [],
						pseudonymizedData: [],
						metadata: {},
					},
					summary: {
						totalRecords: 10,
						categories: ['personal', 'contact'],
						dateRange: {
							startDate: '2024-01-01',
							endDate: '2024-12-31',
						},
					},
					expiresAt: '2025-01-08T00:00:00Z',
				} as T
			}

			if (endpoint === '/compliance/gdpr/pseudonymize') {
				return {
					operationId: 'pseudo-123',
					processedAt: '2025-01-01T00:00:00Z',
					method: options.body.method,
					summary: {
						totalRecords: 100,
						processedRecords: 95,
						failedRecords: 5,
						affectedFields: options.body.fields,
					},
				} as T
			}

			if (endpoint === '/compliance/templates') {
				return [
					{
						id: 'template-1',
						name: 'HIPAA Audit Report',
						description: 'Standard HIPAA compliance audit report',
						category: 'hipaa',
						version: '1.0',
						parameters: [],
						outputFormats: ['pdf', 'csv'],
						createdAt: '2024-01-01T00:00:00Z',
						updatedAt: '2024-01-01T00:00:00Z',
						isActive: true,
					},
				] as T
			}

			if (endpoint.includes('/download')) {
				return new Blob(['mock report data']) as T
			}

			throw new Error(`Unmocked endpoint: ${endpoint}`)
		}
	},
}))

describe('ComplianceService', () => {
	let service: ComplianceService
	let mockConfig: AuditClientConfig

	beforeEach(() => {
		mockConfig = {
			baseUrl: 'https://api.example.com',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-key',
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

		service = new ComplianceService(mockConfig)
	})

	describe('generateHipaaReport', () => {
		it('should generate HIPAA compliance report with valid criteria', async () => {
			const criteria: ReportCriteria = {
				dateRange: {
					startDate: '2024-01-01',
					endDate: '2024-12-31',
				},
				organizationIds: ['org-1'],
				includeDetails: true,
			}

			const result = await service.generateHipaaReport(criteria)

			expect(result).toBeDefined()
			expect(result.id).toBe('hipaa-report-123')
			expect(result.summary.complianceScore).toBe(95)
			expect(result.metadata.complianceFramework).toBe('HIPAA')
		})

		it('should throw error for invalid date range', async () => {
			const criteria: ReportCriteria = {
				dateRange: {
					startDate: '2024-12-31',
					endDate: '2024-01-01', // End date before start date
				},
			}

			await expect(service.generateHipaaReport(criteria)).rejects.toThrow(
				'Start date must be before end date'
			)
		})

		it('should throw error for missing date range', async () => {
			const criteria = {} as ReportCriteria

			await expect(service.generateHipaaReport(criteria)).rejects.toThrow(
				'Report criteria must include a valid date range'
			)
		})
	})

	describe('generateGdprReport', () => {
		it('should generate GDPR compliance report with valid criteria', async () => {
			const criteria: ReportCriteria = {
				dateRange: {
					startDate: '2024-01-01',
					endDate: '2024-12-31',
				},
				organizationIds: ['org-1'],
			}

			const result = await service.generateGdprReport(criteria)

			expect(result).toBeDefined()
			expect(result.id).toBe('gdpr-report-123')
			expect(result.summary.dataSubjects).toBe(50)
			expect(result.metadata.complianceFramework).toBe('GDPR')
		})
	})

	describe('generateCustomReport', () => {
		it('should generate custom report with valid parameters', async () => {
			const params: CustomReportParams = {
				templateId: 'template-1',
				name: 'Custom Security Report',
				criteria: {
					dateRange: {
						startDate: '2024-01-01',
						endDate: '2024-12-31',
					},
				},
				parameters: { includeCharts: true },
				outputFormat: 'pdf',
			}

			const result = await service.generateCustomReport(params)

			expect(result).toBeDefined()
			expect(result.id).toBe('custom-report-123')
			expect(result.name).toBe('Custom Security Report')
			expect(result.template).toBe('template-1')
		})

		it('should throw error for invalid output format', async () => {
			const params: CustomReportParams = {
				templateId: 'template-1',
				name: 'Test Report',
				criteria: {
					dateRange: {
						startDate: '2024-01-01',
						endDate: '2024-12-31',
					},
				},
				parameters: {},
				outputFormat: 'invalid' as any,
			}

			await expect(service.generateCustomReport(params)).rejects.toThrow('Invalid output format')
		})
	})

	describe('exportGdprData', () => {
		it('should export GDPR data with valid parameters', async () => {
			const params: GdprExportParams = {
				dataSubjectId: 'subject-123',
				organizationId: 'org-1',
				includePersonalData: true,
				includePseudonymizedData: false,
				includeMetadata: true,
				format: 'json',
			}

			const result = await service.exportGdprData(params)

			expect(result).toBeDefined()
			expect(result.exportId).toBe('export-123')
			expect(result.dataSubjectId).toBe('subject-123')
			expect(result.format).toBe('json')
		})

		it('should throw error for missing data subject ID', async () => {
			const params = {
				organizationId: 'org-1',
				includePersonalData: true,
				includePseudonymizedData: false,
				includeMetadata: true,
				format: 'json',
			} as GdprExportParams

			await expect(service.exportGdprData(params)).rejects.toThrow('Data subject ID is required')
		})
	})

	describe('pseudonymizeData', () => {
		it('should pseudonymize data with valid parameters', async () => {
			const params: PseudonymizationParams = {
				dataSubjectIds: ['subject-1', 'subject-2'],
				organizationId: 'org-1',
				fields: ['email', 'phone'],
				method: 'hash',
			}

			const result = await service.pseudonymizeData(params)

			expect(result).toBeDefined()
			expect(result.operationId).toBe('pseudo-123')
			expect(result.method).toBe('hash')
			expect(result.summary.affectedFields).toEqual(['email', 'phone'])
		})

		it('should throw error for invalid method', async () => {
			const params: PseudonymizationParams = {
				dataSubjectIds: ['subject-1'],
				organizationId: 'org-1',
				fields: ['email'],
				method: 'invalid' as any,
			}

			await expect(service.pseudonymizeData(params)).rejects.toThrow(
				'Invalid pseudonymization method'
			)
		})
	})

	describe('getReportTemplates', () => {
		it('should retrieve report templates', async () => {
			const result = await service.getReportTemplates()

			expect(result).toBeDefined()
			expect(Array.isArray(result)).toBe(true)
			expect(result.length).toBe(1)
			expect(result[0].name).toBe('HIPAA Audit Report')
		})
	})

	describe('downloadReport', () => {
		it('should download report with valid options', async () => {
			const options = {
				format: 'pdf' as const,
				includeCharts: true,
				includeMetadata: true,
			}

			const result = await service.downloadReport('report-123', options)

			expect(result).toBeInstanceOf(Blob)
		})

		it('should throw error for invalid format', async () => {
			const options = {
				format: 'invalid' as any,
			}

			await expect(service.downloadReport('report-123', options)).rejects.toThrow(
				'Invalid download format'
			)
		})
	})

	describe('validation methods', () => {
		it('should validate date range exceeding 1 year', async () => {
			const criteria: ReportCriteria = {
				dateRange: {
					startDate: '2023-01-01',
					endDate: '2025-01-01', // More than 1 year
				},
			}

			await expect(service.generateHipaaReport(criteria)).rejects.toThrow(
				'Date range cannot exceed 1 year'
			)
		})

		it('should validate invalid date format', async () => {
			const criteria: ReportCriteria = {
				dateRange: {
					startDate: 'invalid-date',
					endDate: '2024-12-31',
				},
			}

			await expect(service.generateHipaaReport(criteria)).rejects.toThrow('Invalid date format')
		})
	})
})
