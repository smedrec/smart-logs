/**
 * Tests for form data transformation utilities
 */

import { describe, expect, it } from 'vitest'

import {
	isCompleteFormData,
	transformFormDataToCreateInput,
	transformFormDataToUpdateInput,
	validateFormData,
} from '../form-transformers'

import type { ReportFormData } from '../form-transformers'

describe('Form Transformers', () => {
	const mockUserId = 'user-123'
	const mockRunId = 'run-456'

	const validFormData: ReportFormData = {
		name: 'Test HIPAA Report',
		description: 'A test report for HIPAA compliance',
		reportType: 'HIPAA_AUDIT_TRAIL',
		format: 'PDF',
		schedule: {
			frequency: 'monthly',
			time: '09:30',
			dayOfMonth: 1,
			timezone: 'America/New_York',
			skipWeekends: false,
			skipHolidays: false,
			maxMissedRuns: 3,
			catchUpMissedRuns: false,
		},
		notifications: {
			onSuccess: true,
			onFailure: true,
			recipients: ['admin@example.com', 'compliance@example.com'],
		},
		parameters: {
			dateRange: {
				startDate: '2024-01-01T00:00:00Z',
				endDate: '2024-12-31T23:59:59Z',
			},
			organizationIds: ['org-1', 'org-2'],
			verifiedOnly: true,
		},
		tags: ['hipaa', 'monthly'],
	}

	describe('transformFormDataToCreateInput', () => {
		it('should transform complete form data to CreateScheduledReportInput', () => {
			const result = transformFormDataToCreateInput(validFormData, mockUserId, mockRunId)

			expect(result).toMatchObject({
				name: 'Test HIPAA Report',
				description: 'A test report for HIPAA compliance',
				reportType: 'HIPAA_AUDIT_TRAIL',
				format: 'pdf',
				createdBy: mockUserId,
				updatedBy: mockUserId,
				runId: mockRunId,
				tags: ['hipaa', 'monthly'],
			})

			// Check schedule transformation
			expect(result.schedule).toMatchObject({
				frequency: 'monthly',
				hour: 9,
				minute: 30,
				dayOfMonth: 1,
				timezone: 'America/New_York',
				skipWeekends: false,
				skipHolidays: false,
				maxMissedRuns: 3,
				catchUpMissedRuns: false,
			})

			// Check criteria transformation
			expect(result.criteria).toMatchObject({
				dateRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-12-31T23:59:59Z',
				},
				organizationIds: ['org-1', 'org-2'],
				verifiedOnly: true,
			})

			// Check notifications
			expect(result.notifications).toMatchObject({
				recipients: ['admin@example.com', 'compliance@example.com'],
				onSuccess: true,
				onFailure: true,
			})
		})

		it('should handle weekly schedule with day of week', () => {
			const weeklyFormData: ReportFormData = {
				...validFormData,
				schedule: {
					frequency: 'weekly',
					time: '14:00',
					dayOfWeek: 1, // Monday
					timezone: 'UTC',
					skipWeekends: false,
					skipHolidays: false,
					maxMissedRuns: 3,
					catchUpMissedRuns: false,
				},
			}

			const result = transformFormDataToCreateInput(weeklyFormData, mockUserId)

			expect(result.schedule).toMatchObject({
				frequency: 'weekly',
				hour: 14,
				minute: 0,
				dayOfWeek: 'monday',
				timezone: 'UTC',
			})
		})

		it('should handle custom schedule with cron expression', () => {
			const customFormData: ReportFormData = {
				...validFormData,
				schedule: {
					frequency: 'custom',
					time: '00:00',
					cronExpression: '0 0 * * 0',
					timezone: 'UTC',
					skipWeekends: false,
					skipHolidays: false,
					maxMissedRuns: 3,
					catchUpMissedRuns: false,
				},
			}

			const result = transformFormDataToCreateInput(customFormData, mockUserId)

			expect(result.schedule).toMatchObject({
				frequency: 'custom',
				cronExpression: '0 0 * * 0',
			})
		})

		it('should transform format strings correctly', () => {
			const formats = ['PDF', 'CSV', 'JSON', 'XLSX', 'HTML', 'XML']
			const expected = ['pdf', 'csv', 'json', 'xlsx', 'html', 'xml']

			formats.forEach((format, index) => {
				const formData = { ...validFormData, format }
				const result = transformFormDataToCreateInput(formData, mockUserId)
				expect(result.format).toBe(expected[index])
			})
		})

		it('should handle delivery configuration', () => {
			const formDataWithDelivery: ReportFormData = {
				...validFormData,
				delivery: {
					destinations: ['dest-1', 'dest-2'],
				},
			}

			const result = transformFormDataToCreateInput(formDataWithDelivery, mockUserId)

			expect(result.delivery).toEqual({
				destinations: ['dest-1', 'dest-2'],
			})
		})

		it('should default to "default" destinations when not specified', () => {
			const result = transformFormDataToCreateInput(validFormData, mockUserId)

			expect(result.delivery).toEqual({
				destinations: 'default',
			})
		})

		it('should handle export configuration', () => {
			const formDataWithExport: ReportFormData = {
				...validFormData,
				export: {
					includeMetadata: true,
					includeIntegrityReport: true,
					compression: 'gzip',
					encryption: {
						enabled: true,
						algorithm: 'AES-256',
						keyId: 'key-123',
					},
				},
			}

			const result = transformFormDataToCreateInput(formDataWithExport, mockUserId)

			expect(result.export).toMatchObject({
				format: 'pdf',
				includeMetadata: true,
				includeIntegrityReport: true,
				compression: 'gzip',
				encryption: {
					enabled: true,
					algorithm: 'AES-256',
					keyId: 'key-123',
				},
			})
		})

		it('should omit notifications when no recipients', () => {
			const formDataNoRecipients: ReportFormData = {
				...validFormData,
				notifications: {
					onSuccess: true,
					onFailure: true,
					recipients: [],
				},
			}

			const result = transformFormDataToCreateInput(formDataNoRecipients, mockUserId)

			expect(result.notifications).toBeUndefined()
		})
	})

	describe('transformFormDataToUpdateInput', () => {
		it('should transform partial form data to UpdateScheduledReportInput', () => {
			const partialData: Partial<ReportFormData> = {
				name: 'Updated Report Name',
				description: 'Updated description',
			}

			const result = transformFormDataToUpdateInput(partialData, mockUserId, mockRunId)

			expect(result).toMatchObject({
				name: 'Updated Report Name',
				description: 'Updated description',
				updatedBy: mockUserId,
				runId: mockRunId,
			})

			// Should not include fields that weren't provided
			expect(result.reportType).toBeUndefined()
			expect(result.schedule).toBeUndefined()
		})

		it('should only include provided fields', () => {
			const partialData: Partial<ReportFormData> = {
				schedule: {
					frequency: 'daily',
					time: '08:00',
					timezone: 'UTC',
					skipWeekends: true,
					skipHolidays: false,
					maxMissedRuns: 5,
					catchUpMissedRuns: true,
				},
			}

			const result = transformFormDataToUpdateInput(partialData, mockUserId)

			expect(result.schedule).toBeDefined()
			expect(result.name).toBeUndefined()
			expect(result.reportType).toBeUndefined()
		})
	})

	describe('validateFormData', () => {
		it('should validate correct form data', () => {
			const result = validateFormData(validFormData)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should require report name', () => {
			const invalidData: ReportFormData = {
				...validFormData,
				name: '',
			}

			const result = validateFormData(invalidData)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Report name is required')
		})

		it('should enforce name length limit', () => {
			const invalidData: ReportFormData = {
				...validFormData,
				name: 'a'.repeat(256),
			}

			const result = validateFormData(invalidData)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Report name must be 255 characters or less')
		})

		it('should enforce description length limit', () => {
			const invalidData: ReportFormData = {
				...validFormData,
				description: 'a'.repeat(1001),
			}

			const result = validateFormData(invalidData)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Description must be 1000 characters or less')
		})

		it('should require timezone', () => {
			const invalidData: ReportFormData = {
				...validFormData,
				schedule: {
					...validFormData.schedule,
					timezone: '',
				},
			}

			const result = validateFormData(invalidData)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Timezone is required')
		})

		it('should require cron expression for custom frequency', () => {
			const invalidData: ReportFormData = {
				...validFormData,
				schedule: {
					frequency: 'custom',
					time: '09:00',
					timezone: 'UTC',
					skipWeekends: false,
					skipHolidays: false,
					maxMissedRuns: 3,
					catchUpMissedRuns: false,
				},
			}

			const result = validateFormData(invalidData)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Cron expression is required for custom frequency')
		})

		it('should require day of week for weekly frequency', () => {
			const invalidData: ReportFormData = {
				...validFormData,
				schedule: {
					frequency: 'weekly',
					time: '09:00',
					timezone: 'UTC',
					skipWeekends: false,
					skipHolidays: false,
					maxMissedRuns: 3,
					catchUpMissedRuns: false,
				},
			}

			const result = validateFormData(invalidData)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Day of week is required for weekly frequency')
		})

		it('should require day of month for monthly frequency', () => {
			const invalidData: ReportFormData = {
				...validFormData,
				schedule: {
					frequency: 'monthly',
					time: '09:00',
					timezone: 'UTC',
					skipWeekends: false,
					skipHolidays: false,
					maxMissedRuns: 3,
					catchUpMissedRuns: false,
				},
			}

			const result = validateFormData(invalidData)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Day of month is required for monthly frequency')
		})

		it('should validate date range order', () => {
			const invalidData: ReportFormData = {
				...validFormData,
				parameters: {
					dateRange: {
						startDate: '2024-12-31T23:59:59Z',
						endDate: '2024-01-01T00:00:00Z',
					},
				},
			}

			const result = validateFormData(invalidData)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Start date must be before or equal to end date')
		})

		it('should require recipients when notifications are enabled', () => {
			const invalidData: ReportFormData = {
				...validFormData,
				notifications: {
					onSuccess: true,
					onFailure: true,
					recipients: [],
				},
			}

			const result = validateFormData(invalidData)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain(
				'At least one recipient email is required when notifications are enabled'
			)
		})

		it('should validate email format', () => {
			const invalidData: ReportFormData = {
				...validFormData,
				notifications: {
					onSuccess: true,
					onFailure: true,
					recipients: ['valid@example.com', 'invalid-email', 'another@valid.com'],
				},
			}

			const result = validateFormData(invalidData)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Invalid email address: invalid-email')
		})
	})

	describe('isCompleteFormData', () => {
		it('should return true for complete form data', () => {
			expect(isCompleteFormData(validFormData)).toBe(true)
		})

		it('should return false for incomplete form data', () => {
			const incompleteData: Partial<ReportFormData> = {
				name: 'Test Report',
				reportType: 'HIPAA_AUDIT_TRAIL',
				// Missing required fields
			}

			expect(isCompleteFormData(incompleteData)).toBe(false)
		})

		it('should return false when missing schedule', () => {
			const { schedule, ...dataWithoutSchedule } = validFormData

			expect(isCompleteFormData(dataWithoutSchedule)).toBe(false)
		})

		it('should return false when missing notifications', () => {
			const { notifications, ...dataWithoutNotifications } = validFormData

			expect(isCompleteFormData(dataWithoutNotifications)).toBe(false)
		})
	})
})
