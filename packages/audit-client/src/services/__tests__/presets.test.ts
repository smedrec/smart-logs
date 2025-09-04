import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PresetsService } from '../presets'

import type { MockedFunction } from 'vitest'
import type { AuditClientConfig } from '../../core/config'
import type {
	AuditPreset,
	CreateAuditPresetInput,
	ListAuditPresetsParams,
	PaginatedAuditPresets,
	PresetApplicationResult,
	PresetContext,
	PresetUsageStats,
	PresetVersionHistory,
	UpdateAuditPresetInput,
	ValidationResult,
} from '../presets'

// Mock the BaseResource
vi.mock('../../core/base-resource', () => ({
	BaseResource: class {
		protected request: MockedFunction<any>

		constructor() {
			this.request = vi.fn()
		}
	},
}))

describe('PresetsService', () => {
	let service: PresetsService
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
				responseTransformation: true,
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
				errorTransformation: true,
			},
		}

		service = new PresetsService(config)
		mockRequest = service['request'] as MockedFunction<any>
	})

	describe('list', () => {
		it('should list all presets with default parameters', async () => {
			const mockResponse: PaginatedAuditPresets = {
				presets: [
					{
						name: 'user-login-attempt',
						description: 'Template for user login attempts',
						template: {
							action: 'user.login',
							targetResourceType: 'user',
							dataClassification: 'INTERNAL',
							defaultStatus: 'attempt',
						},
						validation: {
							requiredFields: ['principalId', 'organizationId'],
							optionalFields: ['targetResourceId'],
							fieldValidation: {
								principalId: { type: 'string', required: true },
							},
						},
						metadata: {
							createdAt: '2024-01-01T00:00:00Z',
							updatedAt: '2024-01-01T00:00:00Z',
							version: '1.0.0',
							tags: ['authentication', 'login'],
						},
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

			expect(mockRequest).toHaveBeenCalledWith('/audit-presets', {
				method: 'GET',
				query: {},
			})
			expect(result).toEqual(mockResponse)
		})

		it('should list presets with filtering parameters', async () => {
			const params: ListAuditPresetsParams = {
				category: 'authentication',
				tags: ['login', 'security'],
				search: 'user',
				limit: 10,
				offset: 20,
				sortBy: 'name',
				sortOrder: 'asc',
			}

			const mockResponse: PaginatedAuditPresets = {
				presets: [],
				pagination: {
					total: 0,
					limit: 10,
					offset: 20,
					hasNext: false,
					hasPrevious: true,
				},
			}

			mockRequest.mockResolvedValue(mockResponse)

			const result = await service.list(params)

			expect(mockRequest).toHaveBeenCalledWith('/audit-presets', {
				method: 'GET',
				query: params,
			})
			expect(result).toEqual(mockResponse)
		})
	})

	describe('get', () => {
		it('should get a preset by name', async () => {
			const mockPreset: AuditPreset = {
				name: 'user-login-success',
				description: 'Template for successful user logins',
				template: {
					action: 'user.login',
					targetResourceType: 'user',
					dataClassification: 'INTERNAL',
					defaultStatus: 'success',
				},
				validation: {
					requiredFields: ['principalId', 'organizationId'],
					optionalFields: ['targetResourceId', 'sessionContext'],
					fieldValidation: {
						principalId: { type: 'string', required: true, minLength: 1 },
					},
				},
				metadata: {
					createdAt: '2024-01-01T00:00:00Z',
					updatedAt: '2024-01-01T00:00:00Z',
					version: '1.0.0',
					tags: ['authentication', 'login', 'success'],
				},
			}

			mockRequest.mockResolvedValue(mockPreset)

			const result = await service.get('user-login-success')

			expect(mockRequest).toHaveBeenCalledWith('/audit-presets/user-login-success', {
				method: 'GET',
				query: { includeMetadata: true },
			})
			expect(result).toEqual(mockPreset)
		})

		it('should return null when preset is not found', async () => {
			const error = new Error('Not found')
			;(error as any).status = 404
			mockRequest.mockRejectedValue(error)

			const result = await service.get('non-existent-preset')

			expect(result).toBeNull()
		})

		it('should throw error for non-404 errors', async () => {
			const error = new Error('Server error')
			;(error as any).status = 500
			mockRequest.mockRejectedValue(error)

			await expect(service.get('some-preset')).rejects.toThrow('Server error')
		})
	})

	describe('create', () => {
		it('should create a new preset', async () => {
			const input: CreateAuditPresetInput = {
				name: 'user-logout',
				description: 'Template for user logout events',
				template: {
					action: 'user.logout',
					targetResourceType: 'user',
					dataClassification: 'INTERNAL',
					defaultStatus: 'success',
				},
				validation: {
					requiredFields: ['principalId', 'organizationId'],
					optionalFields: ['sessionContext'],
					fieldValidation: {
						principalId: { type: 'string', required: true },
					},
				},
				tags: ['authentication', 'logout'],
				category: 'authentication',
			}

			const mockResponse: AuditPreset = {
				...input,
				metadata: {
					createdAt: '2024-01-01T00:00:00Z',
					updatedAt: '2024-01-01T00:00:00Z',
					version: '1.0.0',
					tags: input.tags!,
					category: input.category,
				},
			}

			mockRequest.mockResolvedValue(mockResponse)

			const result = await service.create(input)

			expect(mockRequest).toHaveBeenCalledWith('/audit-presets', {
				method: 'POST',
				body: input,
			})
			expect(result).toEqual(mockResponse)
		})
	})

	describe('update', () => {
		it('should update an existing preset', async () => {
			const updates: UpdateAuditPresetInput = {
				description: 'Updated template for user logout events',
				template: {
					defaultOutcomeDescription: 'User successfully logged out',
				},
				tags: ['authentication', 'logout', 'success'],
			}

			const mockResponse: AuditPreset = {
				name: 'user-logout',
				description: updates.description!,
				template: {
					action: 'user.logout',
					targetResourceType: 'user',
					dataClassification: 'INTERNAL',
					defaultStatus: 'success',
					defaultOutcomeDescription: 'User successfully logged out',
				},
				validation: {
					requiredFields: ['principalId', 'organizationId'],
					optionalFields: ['sessionContext'],
					fieldValidation: {
						principalId: { type: 'string', required: true },
					},
				},
				metadata: {
					createdAt: '2024-01-01T00:00:00Z',
					updatedAt: '2024-01-02T00:00:00Z',
					version: '1.1.0',
					tags: updates.tags!,
				},
			}

			mockRequest.mockResolvedValue(mockResponse)

			const result = await service.update('user-logout', updates)

			expect(mockRequest).toHaveBeenCalledWith('/audit-presets/user-logout', {
				method: 'PUT',
				body: updates,
			})
			expect(result).toEqual(mockResponse)
		})
	})

	describe('delete', () => {
		it('should delete a preset', async () => {
			mockRequest.mockResolvedValue(undefined)

			await service.delete('old-preset')

			expect(mockRequest).toHaveBeenCalledWith('/audit-presets/old-preset', {
				method: 'DELETE',
				query: {},
			})
		})

		it('should delete a preset with force flag', async () => {
			mockRequest.mockResolvedValue(undefined)

			await service.delete('old-preset', true)

			expect(mockRequest).toHaveBeenCalledWith('/audit-presets/old-preset', {
				method: 'DELETE',
				query: { force: 'true' },
			})
		})
	})

	describe('validate', () => {
		it('should validate preset context', async () => {
			const context: PresetContext = {
				principalId: 'user123',
				organizationId: 'org456',
				targetResourceId: 'resource789',
				customDetails: {
					ipAddress: '192.168.1.1',
				},
			}

			const mockResponse: ValidationResult = {
				isValid: true,
				errors: [],
			}

			mockRequest.mockResolvedValue(mockResponse)

			const result = await service.validate('user-login-attempt', context)

			expect(mockRequest).toHaveBeenCalledWith('/audit-presets/user-login-attempt/validate', {
				method: 'POST',
				body: context,
			})
			expect(result).toEqual(mockResponse)
		})

		it('should return validation errors', async () => {
			const context: PresetContext = {
				principalId: '',
				organizationId: 'org456',
			}

			const mockResponse: ValidationResult = {
				isValid: false,
				errors: [
					{
						field: 'principalId',
						message: 'Principal ID is required and cannot be empty',
						code: 'REQUIRED_FIELD_EMPTY',
					},
				],
			}

			mockRequest.mockResolvedValue(mockResponse)

			const result = await service.validate('user-login-attempt', context)

			expect(result.isValid).toBe(false)
			expect(result.errors).toHaveLength(1)
		})
	})

	describe('apply', () => {
		it('should apply preset to create audit event', async () => {
			const context: PresetContext = {
				principalId: 'user123',
				organizationId: 'org456',
				targetResourceId: 'user123',
				sessionContext: {
					sessionId: 'sess789',
					ipAddress: '192.168.1.1',
					userAgent: 'Mozilla/5.0...',
				},
				customDetails: {
					loginMethod: 'password',
					mfaUsed: true,
				},
			}

			const mockResponse: PresetApplicationResult = {
				success: true,
				auditEvent: {
					id: 'event123',
					timestamp: '2024-01-01T12:00:00Z',
					action: 'user.login',
					targetResourceType: 'user',
					targetResourceId: 'user123',
					principalId: 'user123',
					organizationId: 'org456',
					status: 'success',
					dataClassification: 'INTERNAL',
					details: {
						loginMethod: 'password',
						mfaUsed: true,
					},
					correlationId: 'corr456',
				},
				validationResult: {
					isValid: true,
					errors: [],
				},
			}

			mockRequest.mockResolvedValue(mockResponse)

			const result = await service.apply('user-login-success', context)

			expect(mockRequest).toHaveBeenCalledWith('/audit-presets/user-login-success/apply', {
				method: 'POST',
				body: context,
			})
			expect(result).toEqual(mockResponse)
			expect(result.success).toBe(true)
			expect(result.auditEvent).toBeDefined()
		})

		it('should handle application failure', async () => {
			const context: PresetContext = {
				principalId: '',
				organizationId: 'org456',
			}

			const mockResponse: PresetApplicationResult = {
				success: false,
				validationResult: {
					isValid: false,
					errors: [
						{
							field: 'principalId',
							message: 'Principal ID is required',
							code: 'REQUIRED_FIELD_MISSING',
						},
					],
				},
				errors: [
					{
						message: 'Validation failed',
						code: 'VALIDATION_ERROR',
					},
				],
			}

			mockRequest.mockResolvedValue(mockResponse)

			const result = await service.apply('user-login-success', context)

			expect(result.success).toBe(false)
			expect(result.auditEvent).toBeUndefined()
			expect(result.errors).toHaveLength(1)
		})
	})

	describe('getVersionHistory', () => {
		it('should get version history for a preset', async () => {
			const mockResponse: PresetVersionHistory = {
				presetName: 'user-login-attempt',
				currentVersion: '1.2.0',
				totalVersions: 3,
				versions: [
					{
						version: '1.2.0',
						createdAt: '2024-01-03T00:00:00Z',
						changes: ['Added custom validation', 'Updated description'],
						author: 'admin@example.com',
						preset: {} as AuditPreset,
					},
					{
						version: '1.1.0',
						createdAt: '2024-01-02T00:00:00Z',
						changes: ['Added optional fields'],
						preset: {} as AuditPreset,
					},
					{
						version: '1.0.0',
						createdAt: '2024-01-01T00:00:00Z',
						changes: ['Initial version'],
						preset: {} as AuditPreset,
					},
				],
			}

			mockRequest.mockResolvedValue(mockResponse)

			const result = await service.getVersionHistory('user-login-attempt', 10)

			expect(mockRequest).toHaveBeenCalledWith('/audit-presets/user-login-attempt/versions', {
				method: 'GET',
				query: { limit: 10 },
			})
			expect(result).toEqual(mockResponse)
		})
	})

	describe('getUsageStats', () => {
		it('should get usage statistics for a preset', async () => {
			const mockResponse: PresetUsageStats = {
				presetName: 'user-login-attempt',
				totalUsage: 1250,
				usageByPeriod: [
					{ period: '2024-01-01', count: 45 },
					{ period: '2024-01-02', count: 52 },
					{ period: '2024-01-03', count: 38 },
				],
				topUsers: [
					{ principalId: 'user123', count: 25 },
					{ principalId: 'user456', count: 18 },
				],
				successRate: 95.2,
				averageExecutionTime: 125,
				lastUsed: '2024-01-03T15:30:00Z',
			}

			mockRequest.mockResolvedValue(mockResponse)

			const result = await service.getUsageStats('user-login-attempt', 'month', 10)

			expect(mockRequest).toHaveBeenCalledWith('/audit-presets/user-login-attempt/stats', {
				method: 'GET',
				query: { period: 'month', limit: 10 },
			})
			expect(result).toEqual(mockResponse)
		})
	})

	describe('duplicate', () => {
		it('should duplicate a preset', async () => {
			const updates = {
				description: 'Template for admin login attempts',
				tags: ['authentication', 'admin', 'login'],
			}

			const mockResponse: AuditPreset = {
				name: 'admin-login-attempt',
				description: updates.description,
				template: {
					action: 'user.login',
					targetResourceType: 'user',
					dataClassification: 'INTERNAL',
				},
				validation: {
					requiredFields: ['principalId', 'organizationId'],
					optionalFields: [],
					fieldValidation: {},
				},
				metadata: {
					createdAt: '2024-01-01T00:00:00Z',
					updatedAt: '2024-01-01T00:00:00Z',
					version: '1.0.0',
					tags: updates.tags,
				},
			}

			mockRequest.mockResolvedValue(mockResponse)

			const result = await service.duplicate('user-login-attempt', 'admin-login-attempt', updates)

			expect(mockRequest).toHaveBeenCalledWith('/audit-presets/user-login-attempt/duplicate', {
				method: 'POST',
				body: {
					targetName: 'admin-login-attempt',
					updates,
				},
			})
			expect(result).toEqual(mockResponse)
		})
	})

	describe('export', () => {
		it('should export presets', async () => {
			const mockResponse = JSON.stringify({
				presets: [
					{
						name: 'user-login-attempt',
						template: {},
						validation: {},
						metadata: {},
					},
				],
				exportedAt: '2024-01-01T00:00:00Z',
			})

			mockRequest.mockResolvedValue(mockResponse)

			const result = await service.export(['user-login-attempt'], 'json', false)

			expect(mockRequest).toHaveBeenCalledWith('/audit-presets/export', {
				method: 'POST',
				body: {
					names: ['user-login-attempt'],
					format: 'json',
					includeVersionHistory: false,
				},
			})
			expect(result).toEqual(mockResponse)
		})
	})

	describe('import', () => {
		it('should import presets', async () => {
			const importData = JSON.stringify({
				presets: [
					{
						name: 'imported-preset',
						template: {},
						validation: {},
					},
				],
			})

			const mockResponse = {
				imported: ['imported-preset'],
				skipped: [],
				errors: [],
			}

			mockRequest.mockResolvedValue(mockResponse)

			const result = await service.import(importData, 'json', false)

			expect(mockRequest).toHaveBeenCalledWith('/audit-presets/import', {
				method: 'POST',
				body: {
					data: importData,
					format: 'json',
					overwrite: false,
				},
			})
			expect(result).toEqual(mockResponse)
		})
	})
})
