/**
 * TRPC Reports Router Unit Tests
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { TRPCError } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { testUtils } from '../../__tests__/setup'
import { reportsRouter } from '../reports'

describe('TRPC Reports Router', () => {
	let mockContext: any

	beforeEach(() => {
		mockContext = {
			...testUtils.mockTRPCContext,
			services: {
				...testUtils.mockServices,
				compliance: {
					report: {
						generateHIPAAReport: vi.fn(),
						generateGDPRReport: vi.fn(),
						generateIntegrityVerificationReport: vi.fn(),
						generateComplianceReport: vi.fn(),
					},
					scheduled: {
						getReportTemplates: vi.fn(),
						getScheduledReports: vi.fn(),
					},
				},
			},
		}
	})

	describe('hipaa procedure', () => {
		it('should generate HIPAA report successfully', async () => {
			// Arrange
			const input = {
				criteria: {
					dateRange: {
						startDate: '2024-01-01T00:00:00.000Z',
						endDate: '2024-01-31T23:59:59.999Z',
					},
					actions: ['data.read', 'data.write'],
					dataClassifications: ['PHI' as const],
					verifiedOnly: true,
				},
			}

			const mockReport = testUtils.generateComplianceReport({
				type: 'HIPAA',
				summary: {
					totalEvents: 150,
					verifiedEvents: 148,
					failedVerifications: 2,
					complianceScore: 0.987,
				},
			})

			mockContext.services.compliance.report.generateHIPAAReport.mockResolvedValue(mockReport)

			// Act
			const result = await reportsRouter.hipaa({
				ctx: mockContext,
				input,
				type: 'query',
				path: 'reports.hipaa',
			})

			// Assert
			expect(result).toEqual(mockReport)
			expect(mockContext.services.compliance.report.generateHIPAAReport).toHaveBeenCalledWith(
				expect.objectContaining({
					...input.criteria,
					organizationIds: [mockContext.session.session.activeOrganizationId],
				})
			)
		})

		it('should enforce organization isolation in HIPAA reports', async () => {
			// Arrange
			const input = {
				criteria: {
					dateRange: {
						startDate: '2024-01-01T00:00:00.000Z',
						endDate: '2024-01-31T23:59:59.999Z',
					},
					organizationIds: ['different-org-id'], // Should be overridden
				},
			}

			const mockReport = testUtils.generateComplianceReport({ type: 'HIPAA' })
			mockContext.services.compliance.report.generateHIPAAReport.mockResolvedValue(mockReport)

			// Act
			await reportsRouter.hipaa({
				ctx: mockContext,
				input,
				type: 'query',
				path: 'reports.hipaa',
			})

			// Assert
			expect(mockContext.services.compliance.report.generateHIPAAReport).toHaveBeenCalledWith(
				expect.objectContaining({
					organizationIds: [mockContext.session.session.activeOrganizationId],
				})
			)
		})

		it('should handle HIPAA report generation errors', async () => {
			// Arrange
			const input = {
				criteria: {
					dateRange: {
						startDate: '2024-01-01T00:00:00.000Z',
						endDate: '2024-01-31T23:59:59.999Z',
					},
				},
			}

			const reportError = new Error('Database connection failed')
			mockContext.services.compliance.report.generateHIPAAReport.mockRejectedValue(reportError)

			// Act & Assert
			await expect(
				reportsRouter.hipaa({
					ctx: mockContext,
					input,
					type: 'query',
					path: 'reports.hipaa',
				})
			).rejects.toThrow(TRPCError)

			expect(mockContext.services.logger.error).toHaveBeenCalledWith(
				'Failed to generate hipaa report: Database connection failed'
			)
			expect(mockContext.services.error.handleError).toHaveBeenCalledWith(
				expect.any(TRPCError),
				expect.objectContaining({
					requestId: mockContext.requestId,
					userId: mockContext.session.session.userId,
					sessionId: mockContext.session.session.id,
				}),
				'trpc-api',
				'reports.hipaa'
			)
		})
	})

	describe('gdpr procedure', () => {
		it('should generate GDPR report successfully', async () => {
			// Arrange
			const input = {
				criteria: {
					dateRange: {
						startDate: '2024-01-01T00:00:00.000Z',
						endDate: '2024-01-31T23:59:59.999Z',
					},
					principalIds: ['user-123', 'user-456'],
					dataClassifications: ['PHI' as const, 'CONFIDENTIAL' as const],
				},
			}

			const mockReport = testUtils.generateComplianceReport({
				type: 'GDPR',
				summary: {
					totalEvents: 75,
					verifiedEvents: 75,
					failedVerifications: 0,
					complianceScore: 1.0,
				},
			})

			mockContext.services.compliance.report.generateGDPRReport.mockResolvedValue(mockReport)

			// Act
			const result = await reportsRouter.gdpr({
				ctx: mockContext,
				input,
				type: 'query',
				path: 'reports.gdpr',
			})

			// Assert
			expect(result).toEqual(mockReport)
			expect(mockContext.services.compliance.report.generateGDPRReport).toHaveBeenCalledWith(
				expect.objectContaining({
					...input.criteria,
					organizationIds: [mockContext.session.session.activeOrganizationId],
				})
			)
		})

		it('should handle GDPR report generation errors', async () => {
			// Arrange
			const input = {
				criteria: {
					dateRange: {
						startDate: '2024-01-01T00:00:00.000Z',
						endDate: '2024-01-31T23:59:59.999Z',
					},
				},
			}

			const reportError = new Error('Insufficient permissions')
			mockContext.services.compliance.report.generateGDPRReport.mockRejectedValue(reportError)

			// Act & Assert
			await expect(
				reportsRouter.gdpr({
					ctx: mockContext,
					input,
					type: 'query',
					path: 'reports.gdpr',
				})
			).rejects.toThrow(TRPCError)

			expect(mockContext.services.logger.error).toHaveBeenCalledWith(
				'Failed to generate gdpr report: Insufficient permissions'
			)
		})
	})

	describe('integrity procedure', () => {
		it('should generate integrity verification report successfully', async () => {
			// Arrange
			const input = {
				criteria: {
					dateRange: {
						startDate: '2024-01-01T00:00:00.000Z',
						endDate: '2024-01-31T23:59:59.999Z',
					},
					verifiedOnly: false,
				},
				performVerification: true,
			}

			const mockReport = {
				id: 'integrity-report-123',
				type: 'INTEGRITY',
				generatedAt: new Date().toISOString(),
				results: {
					totalEvents: 200,
					verifiedEvents: 195,
					failedVerifications: 5,
					verificationRate: 0.975,
				},
				details: {
					integrityFailures: [
						{
							eventId: 'event-1',
							expectedHash: 'hash1',
							computedHash: 'hash2',
							reason: 'Hash mismatch',
						},
					],
				},
			}

			mockContext.services.compliance.report.generateIntegrityVerificationReport.mockResolvedValue(
				mockReport
			)

			// Act
			const result = await reportsRouter.integrity({
				ctx: mockContext,
				input,
				type: 'query',
				path: 'reports.integrity',
			})

			// Assert
			expect(result).toEqual(mockReport)
			expect(
				mockContext.services.compliance.report.generateIntegrityVerificationReport
			).toHaveBeenCalledWith(
				expect.objectContaining({
					...input.criteria,
					organizationIds: [mockContext.session.session.activeOrganizationId],
				}),
				true
			)
			expect(mockContext.services.logger.info).toHaveBeenCalledWith(
				'Integrity verification report generated',
				expect.objectContaining({
					organizationId: mockContext.session.session.activeOrganizationId,
					totalEvents: 200,
					verifiedEvents: 195,
					failedVerifications: 5,
					verificationRate: 0.975,
				})
			)
		})

		it('should handle integrity report generation without verification', async () => {
			// Arrange
			const input = {
				criteria: {
					dateRange: {
						startDate: '2024-01-01T00:00:00.000Z',
						endDate: '2024-01-31T23:59:59.999Z',
					},
				},
				performVerification: false,
			}

			const mockReport = {
				id: 'integrity-report-124',
				type: 'INTEGRITY',
				generatedAt: new Date().toISOString(),
				results: {
					totalEvents: 200,
					verifiedEvents: 0,
					failedVerifications: 0,
					verificationRate: 0,
				},
				note: 'Verification was not performed',
			}

			mockContext.services.compliance.report.generateIntegrityVerificationReport.mockResolvedValue(
				mockReport
			)

			// Act
			const result = await reportsRouter.integrity({
				ctx: mockContext,
				input,
				type: 'query',
				path: 'reports.integrity',
			})

			// Assert
			expect(result).toEqual(mockReport)
			expect(
				mockContext.services.compliance.report.generateIntegrityVerificationReport
			).toHaveBeenCalledWith(expect.any(Object), false)
		})
	})

	describe('custom procedure', () => {
		it('should generate custom compliance report successfully', async () => {
			// Arrange
			const input = {
				reportName: 'Monthly Security Audit',
				criteria: {
					dateRange: {
						startDate: '2024-01-01T00:00:00.000Z',
						endDate: '2024-01-31T23:59:59.999Z',
					},
					actions: ['login', 'logout', 'data.access'],
				},
				includeIntegrityReport: true,
				customFields: [
					{
						name: 'loginCount',
						description: 'Total number of login events',
						calculation: 'count' as const,
						field: 'action',
						groupBy: 'principalId',
					},
				],
			}

			const mockBaseReport = testUtils.generateComplianceReport({
				type: 'CUSTOM_MONTHLY_SECURITY_AUDIT',
			})

			const mockIntegrityReport = {
				id: 'integrity-report-125',
				type: 'INTEGRITY',
				results: {
					totalEvents: 100,
					verifiedEvents: 98,
					failedVerifications: 2,
					verificationRate: 0.98,
				},
			}

			mockContext.services.compliance.report.generateComplianceReport.mockResolvedValue(
				mockBaseReport
			)
			mockContext.services.compliance.report.generateIntegrityVerificationReport.mockResolvedValue(
				mockIntegrityReport
			)

			// Act
			const result = await reportsRouter.custom({
				ctx: mockContext,
				input,
				type: 'query',
				path: 'reports.custom',
			})

			// Assert
			expect(result.reportName).toBe('Monthly Security Audit')
			expect(result.integrityReport).toEqual(mockIntegrityReport)
			expect(result.generatedBy).toBe(mockContext.session.session.userId)
			expect(mockContext.services.compliance.report.generateComplianceReport).toHaveBeenCalledWith(
				[],
				expect.objectContaining({
					organizationIds: [mockContext.session.session.activeOrganizationId],
				}),
				'CUSTOM_MONTHLY_SECURITY_AUDIT'
			)
		})

		it('should generate custom report without integrity report', async () => {
			// Arrange
			const input = {
				reportName: 'Simple Activity Report',
				criteria: {
					dateRange: {
						startDate: '2024-01-01T00:00:00.000Z',
						endDate: '2024-01-31T23:59:59.999Z',
					},
				},
				includeIntegrityReport: false,
			}

			const mockBaseReport = testUtils.generateComplianceReport({
				type: 'CUSTOM_SIMPLE_ACTIVITY_REPORT',
			})

			mockContext.services.compliance.report.generateComplianceReport.mockResolvedValue(
				mockBaseReport
			)

			// Act
			const result = await reportsRouter.custom({
				ctx: mockContext,
				input,
				type: 'query',
				path: 'reports.custom',
			})

			// Assert
			expect(result.reportName).toBe('Simple Activity Report')
			expect(result.integrityReport).toBeNull()
			expect(
				mockContext.services.compliance.report.generateIntegrityVerificationReport
			).not.toHaveBeenCalled()
		})
	})

	describe('templates procedure', () => {
		it('should retrieve report templates successfully', async () => {
			// Arrange
			const mockTemplates = [
				{
					id: 'hipaa-template',
					name: 'HIPAA Compliance Report',
					description: 'Standard HIPAA compliance reporting template',
					type: 'HIPAA',
					fields: ['timestamp', 'action', 'principalId', 'dataClassification'],
				},
				{
					id: 'gdpr-template',
					name: 'GDPR Compliance Report',
					description: 'Standard GDPR compliance reporting template',
					type: 'GDPR',
					fields: ['timestamp', 'action', 'principalId', 'dataClassification'],
				},
			]

			mockContext.services.compliance.scheduled.getReportTemplates.mockResolvedValue(mockTemplates)

			// Act
			const result = await reportsRouter.templates({
				ctx: mockContext,
				type: 'query',
				path: 'reports.templates',
			})

			// Assert
			expect(result).toEqual(mockTemplates)
			expect(mockContext.services.compliance.scheduled.getReportTemplates).toHaveBeenCalledOnce()
			expect(mockContext.services.logger.info).toHaveBeenCalledWith(
				'Report templates retrieved',
				expect.objectContaining({
					organizationId: mockContext.session.session.activeOrganizationId,
					templateCount: 2,
				})
			)
		})

		it('should handle template retrieval errors', async () => {
			// Arrange
			const templateError = new Error('Template service unavailable')
			mockContext.services.compliance.scheduled.getReportTemplates.mockRejectedValue(templateError)

			// Act & Assert
			await expect(
				reportsRouter.templates({
					ctx: mockContext,
					type: 'query',
					path: 'reports.templates',
				})
			).rejects.toThrow(TRPCError)

			expect(mockContext.services.logger.error).toHaveBeenCalledWith(
				'Failed to get report templates: Template service unavailable'
			)
		})
	})

	describe('scheduled procedure', () => {
		it('should retrieve scheduled reports successfully', async () => {
			// Arrange
			const mockScheduledReports = [
				{
					id: 'scheduled-1',
					name: 'Weekly HIPAA Report',
					type: 'HIPAA',
					schedule: {
						frequency: 'WEEKLY',
						dayOfWeek: 1,
						hour: 9,
						minute: 0,
					},
					isActive: true,
					lastExecution: {
						id: 'exec-1',
						startedAt: '2024-01-15T09:00:00.000Z',
						completedAt: '2024-01-15T09:05:00.000Z',
						status: 'COMPLETED',
					},
				},
				{
					id: 'scheduled-2',
					name: 'Monthly Integrity Report',
					type: 'INTEGRITY',
					schedule: {
						frequency: 'MONTHLY',
						dayOfMonth: 1,
						hour: 8,
						minute: 0,
					},
					isActive: true,
					lastExecution: null,
				},
			]

			mockContext.services.compliance.scheduled.getScheduledReports.mockResolvedValue(
				mockScheduledReports
			)

			// Act
			const result = await reportsRouter.scheduled({
				ctx: mockContext,
				type: 'query',
				path: 'reports.scheduled',
			})

			// Assert
			expect(result).toEqual(mockScheduledReports)
			expect(mockContext.services.compliance.scheduled.getScheduledReports).toHaveBeenCalledWith(
				mockContext.session.session.activeOrganizationId
			)
			expect(mockContext.services.logger.info).toHaveBeenCalledWith(
				'Scheduled reports retrieved',
				expect.objectContaining({
					organizationId: mockContext.session.session.activeOrganizationId,
					reportCount: 2,
				})
			)
		})

		it('should handle scheduled reports retrieval errors', async () => {
			// Arrange
			const scheduledError = new Error('Scheduler service down')
			mockContext.services.compliance.scheduled.getScheduledReports.mockRejectedValue(
				scheduledError
			)

			// Act & Assert
			await expect(
				reportsRouter.scheduled({
					ctx: mockContext,
					type: 'query',
					path: 'reports.scheduled',
				})
			).rejects.toThrow(TRPCError)

			expect(mockContext.services.logger.error).toHaveBeenCalledWith(
				'Failed to get scheduled reports: Scheduler service down'
			)
		})

		it('should enforce organization isolation for scheduled reports', async () => {
			// Arrange
			mockContext.services.compliance.scheduled.getScheduledReports.mockResolvedValue([])

			// Act
			await reportsRouter.scheduled({
				ctx: mockContext,
				type: 'query',
				path: 'reports.scheduled',
			})

			// Assert
			expect(mockContext.services.compliance.scheduled.getScheduledReports).toHaveBeenCalledWith(
				mockContext.session.session.activeOrganizationId
			)
		})
	})
})
