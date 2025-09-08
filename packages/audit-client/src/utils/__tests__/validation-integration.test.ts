/**
 * Integration tests for validation utilities in audit-client services
 *
 * These tests demonstrate how validation is integrated throughout the services
 * and verify that both valid and invalid inputs are handled correctly.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComplianceService } from '../../services/compliance'
import { EventsService } from '../../services/events'
import { PresetsService } from '../../services/presets'
import { ValidationError } from '../validation'

import type { AuditClientConfig } from '../../core/config'

// Mock configuration for testing
const mockConfig: AuditClientConfig = {
	baseUrl: 'https://api.test.com',
	authentication: {
		type: 'bearer',
		token: 'test-token',
	},
	cache: { enabled: false },
	retry: { enabled: false },
	batching: { enabled: false },
	logging: { enabled: false },
	errorHandling: { throwOnError: true },
	customHeaders: {},
	interceptors: {},
	performance: { enableCompression: false },
} as any

describe('Validation Integration Tests', () => {
	let eventsService: EventsService
	let complianceService: ComplianceService
	let presetsService: PresetsService

	beforeEach(() => {
		// Mock the request method to avoid actual HTTP calls
		const mockRequest = vi.fn()

		eventsService = new EventsService(mockConfig)
		complianceService = new ComplianceService(mockConfig)
		presetsService = new PresetsService(mockConfig)

		// Mock the protected request method
		;(eventsService as any).request = mockRequest
		;(complianceService as any).request = mockRequest
		;(presetsService as any).request = mockRequest
	})

	describe('EventsService Validation', () => {
		it('should validate create audit event input successfully', async () => {
			const mockResponse = {
				id: 'event-123',
				timestamp: '2024-01-01T00:00:00Z',
				action: 'user.login',
				targetResourceType: 'user',
				principalId: 'user-123',
				organizationId: 'org-456',
				status: 'success',
				dataClassification: 'INTERNAL',
			}

			;(eventsService as any).request.mockResolvedValue(mockResponse)

			const validInput = {
				action: 'user.login',
				targetResourceType: 'user',
				principalId: 'user-123',
				organizationId: 'org-456',
				status: 'success' as const,
				dataClassification: 'INTERNAL' as const,
			}

			const result = await eventsService.create(validInput)
			expect(result).toEqual(mockResponse)
			expect((eventsService as any).request).toHaveBeenCalledWith('/audit/events', {
				method: 'POST',
				body: validInput,
			})
		})

		it('should throw ValidationError for invalid create audit event input', async () => {
			const invalidInput = {
				action: '', // Invalid: empty action
				targetResourceType: 'user',
				principalId: 'user-123',
				organizationId: '', // Invalid: empty organization ID
				status: 'invalid-status' as any, // Invalid: not a valid status
				dataClassification: 'INTERNAL' as const,
			}

			await expect(eventsService.create(invalidInput)).rejects.toThrow(ValidationError)
		})

		it('should validate query parameters successfully', async () => {
			const mockResponse = {
				events: [],
				pagination: {
					total: 0,
					limit: 50,
					offset: 0,
					hasNext: false,
					hasPrevious: false,
					totalPages: 0,
					currentPage: 1,
				},
			}

			;(eventsService as any).request.mockResolvedValue(mockResponse)

			const validParams = {
				filter: {
					dateRange: {
						startDate: '2024-01-01T00:00:00Z',
						endDate: '2024-01-31T23:59:59Z',
					},
					principalIds: ['user-123'],
					statuses: ['success' as const],
				},
				pagination: {
					limit: 50,
					offset: 0,
				},
			}

			const result = await eventsService.query(validParams)
			expect(result).toEqual(mockResponse)
		})

		it('should throw ValidationError for invalid query parameters', async () => {
			const invalidParams = {
				filter: {
					dateRange: {
						startDate: '2024-01-31T00:00:00Z', // Invalid: start date after end date
						endDate: '2024-01-01T23:59:59Z',
					},
				},
				pagination: {
					limit: -1, // Invalid: negative limit
					offset: 0,
				},
			}

			await expect(eventsService.query(invalidParams)).rejects.toThrow(ValidationError)
		})

		it('should validate bulk create input successfully', async () => {
			const mockResponse = {
				requestId: 'req-123',
				total: 2,
				successful: 2,
				failed: 0,
				results: [],
				processingTime: 100,
			}

			;(eventsService as any).request.mockResolvedValue(mockResponse)

			const validEvents = [
				{
					action: 'user.login',
					targetResourceType: 'user',
					principalId: 'user-123',
					organizationId: 'org-456',
					status: 'success' as const,
					dataClassification: 'INTERNAL' as const,
				},
				{
					action: 'user.logout',
					targetResourceType: 'user',
					principalId: 'user-123',
					organizationId: 'org-456',
					status: 'success' as const,
					dataClassification: 'INTERNAL' as const,
				},
			]

			const result = await eventsService.bulkCreate(validEvents)
			expect(result).toEqual(mockResponse)
		})

		it('should throw ValidationError for invalid bulk create input', async () => {
			const invalidEvents = [] // Invalid: empty array

			await expect(eventsService.bulkCreate(invalidEvents)).rejects.toThrow(ValidationError)
		})
	})

	describe('ComplianceService Validation', () => {
		it('should validate HIPAA report criteria successfully', async () => {
			const mockResponse = {
				id: 'report-123',
				generatedAt: '2024-01-01T00:00:00Z',
				summary: {
					totalEvents: 100,
					complianceScore: 95,
					violations: 2,
					recommendations: [],
					riskAssessment: {
						overallRisk: 'low' as const,
						riskFactors: [],
					},
				},
				sections: [],
				metadata: {} as any,
				criteria: {} as any,
			}

			;(complianceService as any).request.mockResolvedValue(mockResponse)

			const validCriteria = {
				dateRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-31T23:59:59Z',
				},
				organizationIds: ['org-456'],
				includeDetails: true,
			}

			const result = await complianceService.generateHipaaReport(validCriteria)
			expect(result).toEqual(mockResponse)
		})

		it('should throw ValidationError for invalid HIPAA report criteria', async () => {
			const invalidCriteria = {
				dateRange: {
					startDate: 'invalid-date', // Invalid: not a valid ISO date
					endDate: '2024-01-31T23:59:59Z',
				},
			}

			await expect(complianceService.generateHipaaReport(invalidCriteria)).rejects.toThrow(
				ValidationError
			)
		})

		it('should validate GDPR export parameters successfully', async () => {
			const mockResponse = {
				exportId: 'export-123',
				dataSubjectId: 'user-123',
				generatedAt: '2024-01-01T00:00:00Z',
				format: 'json',
				data: {
					personalData: [],
				},
				summary: {
					totalRecords: 10,
					categories: ['profile', 'activity'],
					dateRange: {
						startDate: '2024-01-01T00:00:00Z',
						endDate: '2024-01-31T23:59:59Z',
					},
				},
				expiresAt: '2024-02-01T00:00:00Z',
			}

			;(complianceService as any).request.mockResolvedValue(mockResponse)

			const validParams = {
				dataSubjectId: 'user-123',
				organizationId: 'org-456',
				includePersonalData: true,
				includePseudonymizedData: false,
				includeMetadata: true,
				format: 'json' as const,
			}

			const result = await complianceService.exportGdprData(validParams)
			expect(result).toEqual(mockResponse)
		})

		it('should throw ValidationError for invalid GDPR export parameters', async () => {
			const invalidParams = {
				dataSubjectId: '', // Invalid: empty data subject ID
				organizationId: 'org-456',
				includePersonalData: true,
				includePseudonymizedData: false,
				includeMetadata: true,
				format: 'invalid-format' as any, // Invalid: not a valid format
			}

			await expect(complianceService.exportGdprData(invalidParams)).rejects.toThrow(ValidationError)
		})
	})

	describe('PresetsService Validation', () => {
		it('should validate create preset input successfully', async () => {
			const mockResponse = {
				name: 'test-preset',
				description: 'Test preset',
				template: {
					action: 'user.login',
					targetResourceType: 'user',
					dataClassification: 'INTERNAL' as const,
				},
				validation: {
					requiredFields: ['principalId'],
					optionalFields: [],
					fieldValidation: {},
				},
				metadata: {
					createdAt: '2024-01-01T00:00:00Z',
					updatedAt: '2024-01-01T00:00:00Z',
					version: '1.0.0',
					tags: [],
				},
			}

			;(presetsService as any).request.mockResolvedValue(mockResponse)

			const validInput = {
				name: 'test-preset',
				description: 'Test preset',
				template: {
					action: 'user.login',
					targetResourceType: 'user',
					dataClassification: 'INTERNAL' as const,
				},
				validation: {
					requiredFields: ['principalId'],
					optionalFields: [],
					fieldValidation: {},
				},
			}

			const result = await presetsService.create(validInput)
			expect(result).toEqual(mockResponse)
		})

		it('should throw ValidationError for invalid create preset input', async () => {
			const invalidInput = {
				name: '', // Invalid: empty name
				template: {
					action: 'user.login',
					targetResourceType: 'user',
					dataClassification: 'INVALID' as any, // Invalid: not a valid classification
				},
				validation: {
					requiredFields: ['principalId'],
					optionalFields: [],
					fieldValidation: {},
				},
			}

			await expect(presetsService.create(invalidInput)).rejects.toThrow(ValidationError)
		})

		it('should validate preset context successfully', async () => {
			const mockResponse = {
				isValid: true,
				errors: [],
			}

			;(presetsService as any).request.mockResolvedValue(mockResponse)

			const validContext = {
				principalId: 'user-123',
				organizationId: 'org-456',
				targetResourceId: 'resource-789',
			}

			const result = await presetsService.validate('test-preset', validContext)
			expect(result).toEqual(mockResponse)
		})

		it('should throw ValidationError for invalid preset context', async () => {
			const invalidContext = {
				principalId: '', // Invalid: empty principal ID
				organizationId: 'org-456',
			}

			await expect(presetsService.validate('test-preset', invalidContext)).rejects.toThrow(
				ValidationError
			)
		})
	})

	describe('ValidationError Functionality', () => {
		it('should provide formatted error messages', () => {
			const error = new ValidationError('Test validation failed', {
				path: ['field', 'subfield'],
				code: 'INVALID_VALUE',
			})

			expect(error.getFormattedMessage()).toBe('Test validation failed at path: field.subfield')
			expect(error.getAllErrors()).toEqual([
				{
					path: 'field.subfield',
					message: 'Test validation failed',
					code: 'INVALID_VALUE',
				},
			])
		})

		it('should handle Zod validation errors', () => {
			// This would be created by the validation utilities when Zod validation fails
			const mockZodError = {
				errors: [
					{
						path: ['name'],
						message: 'String must contain at least 1 character(s)',
						code: 'too_small',
					},
					{
						path: ['email'],
						message: 'Invalid email',
						code: 'invalid_string',
					},
				],
			} as any

			const error = new ValidationError('Multiple validation errors', {
				originalError: mockZodError,
			})

			const allErrors = error.getAllErrors()
			expect(allErrors).toHaveLength(2)
			expect(allErrors[0]).toEqual({
				path: 'name',
				message: 'String must contain at least 1 character(s)',
				code: 'too_small',
			})
			expect(allErrors[1]).toEqual({
				path: 'email',
				message: 'Invalid email',
				code: 'invalid_string',
			})
		})
	})
})

/**
 * Key Testing Patterns Demonstrated:
 *
 * 1. **Input Validation Testing**: Verify that invalid inputs throw ValidationError
 * 2. **Valid Input Processing**: Ensure valid inputs are processed correctly
 * 3. **Response Validation**: Mock responses are validated against expected types
 * 4. **Error Message Testing**: ValidationError provides useful error information
 * 5. **Service Integration**: All services use consistent validation patterns
 * 6. **Type Safety**: TypeScript ensures compile-time type checking
 * 7. **Runtime Safety**: Validation catches issues at runtime
 */
