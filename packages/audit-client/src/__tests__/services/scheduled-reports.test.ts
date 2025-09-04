import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BaseResource } from '../../core/base-resource'
import { ScheduledReportsService } from '../../services/scheduled-reports'

import type { MockedFunction } from 'vitest'
import type { AuditClientConfig } from '../../core/config'
import type {
	CreateScheduledReportInput,
	ExecutionHistoryParams,
	ListScheduledReportsParams,
	PaginatedExecutions,
	PaginatedScheduledReports,
	ReportExecution,
	ScheduledReport,
	UpdateScheduledReportInput,
} from '../../services/scheduled-reports'

// Mock BaseResource
vi.mock('../../core/base-resource')

describe('ScheduledReportsService', () => {
	let service: ScheduledReportsService
	let mockRequest: MockedFunction<any>
	let config: AuditClientConfig

	beforeEach(() => {
		config = {
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
				retryableStatusCodes: [429, 500, 502, 503, 504],
				retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
			},
			cache: {
				enabled: false,
				defaultTtlMs: 300000,
				maxSize: 100,
				storage: 'memory',
				keyPrefix: 'audit-client',
				compressionEnabled: false,
			},
			batching: {
				enabled: false,
				maxBatchSize: 10,
				batchTimeoutMs: 100,
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
				enabled: false,
				level: 'info',
				includeRequestBody: false,
				includeResponseBody: false,
				maskSensitiveData: true,
			},
			errorHandling: {
				throwOnError: true,
				includeStackTrace: false,
				errorTransformation: false,
			},
		}

		mockRequest = vi.fn()

		// Mock the BaseResource constructor and its request method
		vi.mocked(BaseResource).mockImplementation(function (this: any) {
			this.request = mockRequest
			return this
		} as any)

		service = new ScheduledReportsService(config)
	})

	describe('list', () => {
		it('should list scheduled reports with default parameters', async () => {
			const mockResponse: PaginatedScheduledReports = {
				reports: [
					{
						id: 'report-1',
						name: 'Daily HIPAA Report',
						reportType: 'hipaa',
						criteria: {
							dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
							format: 'json',
						},
						schedule: {
							frequency: 'daily',
							hour: 9,
							minute: 0,
							timezone: 'UTC',
						},
						deliveryConfig: {
							method: 'email',
							config: { recipients: ['admin@example.com'] },
						},
						isActive: true,
						createdAt: '2024-01-01T00:00:00Z',
						updatedAt: '2024-01-01T00:00:00Z',
						nextExecution: '2024-01-02T09:00:00Z',
						createdBy: 'user-1',
						organizationId: 'org-1',
					},
				],
				pagination: {
					total: 1,
					limit: 50,
					offset: 0,
					hasNext: false,
					hasPrevious: false,
				},
			}

			mockRequest.mockResolvedValue(mockResponse)

			const result = await service.list()

			expect(mockRequest).toHaveBeenCalledWith('/scheduled-reports', {
				method: 'GET',
				query: {},
			})
			expect(result).toEqual(mockResponse)
		})

		it('should list scheduled reports with filtering parameters', async () => {
			const params: ListScheduledReportsParams = {
				organizationId: 'org-1',
				reportType: 'hipaa',
				isActive: true,
				limit: 10,
				offset: 0,
				sortBy: 'name',
				sortOrder: 'asc',
			}

			const mockResponse: PaginatedScheduledReports = {
				reports: [],
				pagination: {
					total: 0,
					limit: 10,
					offset: 0,
					hasNext: false,
					hasPrevious: false,
				},
			}

			mockRequest.mockResolvedValue(mockResponse)

			const result = await service.list(params)

			expect(mockRequest).toHaveBeenCalledWith('/scheduled-reports', {
				method: 'GET',
				query: params,
			})
			expect(result).toEqual(mockResponse)
		})

		it('should validate list parameters', async () => {
			const invalidParams: ListScheduledReportsParams = {
				limit: 2000, // Invalid: exceeds maximum
			}

			await expect(service.list(invalidParams)).rejects.toThrow('Limit must be between 1 and 1000')
		})
	})

	describe('get', () => {
		it('should get a scheduled report by ID', async () => {
			const mockReport: ScheduledReport = {
				id: 'report-1',
				name: 'Daily HIPAA Report',
				reportType: 'hipaa',
				criteria: {
					dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
					format: 'json',
				},
				schedule: {
					frequency: 'daily',
					hour: 9,
					minute: 0,
					timezone: 'UTC',
				},
				deliveryConfig: {
					method: 'email',
					config: { recipients: ['admin@example.com'] },
				},
				isActive: true,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z',
				nextExecution: '2024-01-02T09:00:00Z',
				createdBy: 'user-1',
				organizationId: 'org-1',
			}

			mockRequest.mockResolvedValue(mockReport)

			const result = await service.get('report-1')

			expect(mockRequest).toHaveBeenCalledWith('/scheduled-reports/report-1')
			expect(result).toEqual(mockReport)
		})

		it('should return null for non-existent report', async () => {
			mockRequest.mockRejectedValue({ status: 404 })

			const result = await service.get('non-existent')

			expect(result).toBeNull()
		})

		it('should validate ID parameter', async () => {
			await expect(service.get('')).rejects.toThrow('Valid ID is required')
		})
	})

	describe('create', () => {
		it('should create a new scheduled report', async () => {
			const input: CreateScheduledReportInput = {
				name: 'Weekly GDPR Report',
				description: 'Weekly GDPR compliance report',
				reportType: 'gdpr',
				criteria: {
					dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
					format: 'csv',
					includeMetadata: true,
				},
				schedule: {
					frequency: 'weekly',
					dayOfWeek: 1, // Monday
					hour: 10,
					minute: 30,
					timezone: 'America/New_York',
				},
				deliveryConfig: {
					method: 'webhook',
					config: { webhookUrl: 'https://example.com/webhook' },
				},
				isActive: true,
			}

			const mockReport: ScheduledReport = {
				id: 'report-2',
				...input,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z',
				nextExecution: '2024-01-08T15:30:00Z', // Next Monday at 10:30 EST
				createdBy: 'user-1',
				organizationId: 'org-1',
			}

			mockRequest.mockResolvedValue(mockReport)

			const result = await service.create(input)

			expect(mockRequest).toHaveBeenCalledWith('/scheduled-reports', {
				method: 'POST',
				body: input,
			})
			expect(result).toEqual(mockReport)
		})

		it('should validate create input', async () => {
			const invalidInput: CreateScheduledReportInput = {
				name: '', // Invalid: empty name
				reportType: 'hipaa',
				criteria: {
					dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
					format: 'json',
				},
				schedule: {
					frequency: 'daily',
					hour: 9,
					minute: 0,
					timezone: 'UTC',
				},
				deliveryConfig: {
					method: 'email',
					config: { recipients: ['admin@example.com'] },
				},
			}

			await expect(service.create(invalidInput)).rejects.toThrow('Report name is required')
		})

		it('should validate schedule configuration', async () => {
			const invalidInput: CreateScheduledReportInput = {
				name: 'Test Report',
				reportType: 'hipaa',
				criteria: {
					dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
					format: 'json',
				},
				schedule: {
					frequency: 'daily',
					hour: 25, // Invalid: hour out of range
					minute: 0,
					timezone: 'UTC',
				},
				deliveryConfig: {
					method: 'email',
					config: { recipients: ['admin@example.com'] },
				},
			}

			await expect(service.create(invalidInput)).rejects.toThrow('Hour must be between 0 and 23')
		})

		it('should validate delivery configuration', async () => {
			const invalidInput: CreateScheduledReportInput = {
				name: 'Test Report',
				reportType: 'hipaa',
				criteria: {
					dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
					format: 'json',
				},
				schedule: {
					frequency: 'daily',
					hour: 9,
					minute: 0,
					timezone: 'UTC',
				},
				deliveryConfig: {
					method: 'email',
					config: { recipients: ['invalid-email'] }, // Invalid email format
				},
			}

			await expect(service.create(invalidInput)).rejects.toThrow(
				'Invalid email address: invalid-email'
			)
		})
	})

	describe('update', () => {
		it('should update a scheduled report', async () => {
			const updates: UpdateScheduledReportInput = {
				name: 'Updated Report Name',
				isActive: false,
			}

			const mockReport: ScheduledReport = {
				id: 'report-1',
				name: 'Updated Report Name',
				reportType: 'hipaa',
				criteria: {
					dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
					format: 'json',
				},
				schedule: {
					frequency: 'daily',
					hour: 9,
					minute: 0,
					timezone: 'UTC',
				},
				deliveryConfig: {
					method: 'email',
					config: { recipients: ['admin@example.com'] },
				},
				isActive: false,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-02T00:00:00Z',
				nextExecution: '2024-01-02T09:00:00Z',
				createdBy: 'user-1',
				organizationId: 'org-1',
			}

			mockRequest.mockResolvedValue(mockReport)

			const result = await service.update('report-1', updates)

			expect(mockRequest).toHaveBeenCalledWith('/scheduled-reports/report-1', {
				method: 'PUT',
				body: updates,
			})
			expect(result).toEqual(mockReport)
		})

		it('should validate update input', async () => {
			const invalidUpdates: UpdateScheduledReportInput = {
				name: '', // Invalid: empty name
			}

			await expect(service.update('report-1', invalidUpdates)).rejects.toThrow(
				'Report name cannot be empty'
			)
		})
	})

	describe('delete', () => {
		it('should delete a scheduled report', async () => {
			mockRequest.mockResolvedValue(undefined)

			await service.delete('report-1')

			expect(mockRequest).toHaveBeenCalledWith('/scheduled-reports/report-1', {
				method: 'DELETE',
			})
		})

		it('should validate ID parameter', async () => {
			await expect(service.delete('')).rejects.toThrow('Valid ID is required')
		})
	})

	describe('execute', () => {
		it('should execute a scheduled report immediately', async () => {
			const mockExecution: ReportExecution = {
				id: 'execution-1',
				reportId: 'report-1',
				startedAt: '2024-01-01T10:00:00Z',
				status: 'pending',
			}

			mockRequest.mockResolvedValue(mockExecution)

			const result = await service.execute('report-1')

			expect(mockRequest).toHaveBeenCalledWith('/scheduled-reports/report-1/execute', {
				method: 'POST',
			})
			expect(result).toEqual(mockExecution)
		})
	})

	describe('getExecutionHistory', () => {
		it('should get execution history for a report', async () => {
			const params: ExecutionHistoryParams = {
				limit: 10,
				status: 'completed',
			}

			const mockHistory: PaginatedExecutions = {
				executions: [
					{
						id: 'execution-1',
						reportId: 'report-1',
						startedAt: '2024-01-01T10:00:00Z',
						completedAt: '2024-01-01T10:05:00Z',
						status: 'completed',
						downloadUrl: 'https://example.com/download/execution-1',
						fileSize: 1024,
						recordCount: 100,
					},
				],
				pagination: {
					total: 1,
					limit: 10,
					offset: 0,
					hasNext: false,
					hasPrevious: false,
				},
			}

			mockRequest.mockResolvedValue(mockHistory)

			const result = await service.getExecutionHistory('report-1', params)

			expect(mockRequest).toHaveBeenCalledWith('/scheduled-reports/report-1/executions', {
				method: 'GET',
				query: params,
			})
			expect(result).toEqual(mockHistory)
		})

		it('should validate execution history parameters', async () => {
			const invalidParams: ExecutionHistoryParams = {
				limit: -1, // Invalid: negative limit
			}

			await expect(service.getExecutionHistory('report-1', invalidParams)).rejects.toThrow(
				'Limit must be between 1 and 1000'
			)
		})
	})

	describe('getExecutionStatus', () => {
		it('should get execution status', async () => {
			const mockExecution: ReportExecution = {
				id: 'execution-1',
				reportId: 'report-1',
				startedAt: '2024-01-01T10:00:00Z',
				status: 'running',
				progress: 50,
			}

			mockRequest.mockResolvedValue(mockExecution)

			const result = await service.getExecutionStatus('report-1', 'execution-1')

			expect(mockRequest).toHaveBeenCalledWith('/scheduled-reports/report-1/executions/execution-1')
			expect(result).toEqual(mockExecution)
		})
	})

	describe('cancelExecution', () => {
		it('should cancel a running execution', async () => {
			mockRequest.mockResolvedValue(undefined)

			await service.cancelExecution('report-1', 'execution-1')

			expect(mockRequest).toHaveBeenCalledWith(
				'/scheduled-reports/report-1/executions/execution-1/cancel',
				{
					method: 'POST',
				}
			)
		})
	})

	describe('downloadExecution', () => {
		it('should download execution result', async () => {
			const mockBlob = new Blob(['test data'], { type: 'application/json' })
			mockRequest.mockResolvedValue(mockBlob)

			const result = await service.downloadExecution('report-1', 'execution-1', 'json')

			expect(mockRequest).toHaveBeenCalledWith(
				'/scheduled-reports/report-1/executions/execution-1/download',
				{
					method: 'GET',
					query: { format: 'json' },
					responseType: 'blob',
				}
			)
			expect(result).toEqual(mockBlob)
		})

		it('should validate format parameter', async () => {
			await expect(
				service.downloadExecution('report-1', 'execution-1', 'invalid' as any)
			).rejects.toThrow('Invalid format. Must be one of: json, csv, pdf, xlsx')
		})
	})

	describe('enable', () => {
		it('should enable a scheduled report', async () => {
			const mockReport: ScheduledReport = {
				id: 'report-1',
				name: 'Test Report',
				reportType: 'hipaa',
				criteria: {
					dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
					format: 'json',
				},
				schedule: {
					frequency: 'daily',
					hour: 9,
					minute: 0,
					timezone: 'UTC',
				},
				deliveryConfig: {
					method: 'email',
					config: { recipients: ['admin@example.com'] },
				},
				isActive: true,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-02T00:00:00Z',
				nextExecution: '2024-01-02T09:00:00Z',
				createdBy: 'user-1',
				organizationId: 'org-1',
			}

			mockRequest.mockResolvedValue(mockReport)

			const result = await service.enable('report-1')

			expect(mockRequest).toHaveBeenCalledWith('/scheduled-reports/report-1/enable', {
				method: 'POST',
			})
			expect(result).toEqual(mockReport)
		})
	})

	describe('disable', () => {
		it('should disable a scheduled report', async () => {
			const mockReport: ScheduledReport = {
				id: 'report-1',
				name: 'Test Report',
				reportType: 'hipaa',
				criteria: {
					dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
					format: 'json',
				},
				schedule: {
					frequency: 'daily',
					hour: 9,
					minute: 0,
					timezone: 'UTC',
				},
				deliveryConfig: {
					method: 'email',
					config: { recipients: ['admin@example.com'] },
				},
				isActive: false,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-02T00:00:00Z',
				nextExecution: '2024-01-02T09:00:00Z',
				createdBy: 'user-1',
				organizationId: 'org-1',
			}

			mockRequest.mockResolvedValue(mockReport)

			const result = await service.disable('report-1')

			expect(mockRequest).toHaveBeenCalledWith('/scheduled-reports/report-1/disable', {
				method: 'POST',
			})
			expect(result).toEqual(mockReport)
		})
	})

	describe('getUpcomingExecutions', () => {
		it('should get upcoming executions', async () => {
			const mockUpcoming = [
				{
					reportId: 'report-1',
					reportName: 'Daily HIPAA Report',
					nextExecution: '2024-01-02T09:00:00Z',
					frequency: 'daily',
				},
				{
					reportId: 'report-2',
					reportName: 'Weekly GDPR Report',
					nextExecution: '2024-01-08T15:30:00Z',
					frequency: 'weekly',
				},
			]

			mockRequest.mockResolvedValue(mockUpcoming)

			const result = await service.getUpcomingExecutions('org-1', 10)

			expect(mockRequest).toHaveBeenCalledWith('/scheduled-reports/upcoming', {
				method: 'GET',
				query: { organizationId: 'org-1', limit: 10 },
			})
			expect(result).toEqual(mockUpcoming)
		})
	})
})
