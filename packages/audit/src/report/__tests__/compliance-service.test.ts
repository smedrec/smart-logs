/**
 * @fileoverview Tests for Enhanced Compliance Service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EnhancedComplianceService } from '../compliance-service.js'

import type { ReportCriteria } from '@repo/audit-client/types/compliance'
import type { AuditLogEvent } from '../../types.js'

// Mock dependencies
const mockDbClient = {
	executeMonitoredQuery: vi.fn(),
	generateCacheKey: vi.fn(),
}

const mockAudit = {
	generateEventHash: vi.fn(),
	verifyEventHash: vi.fn(),
}

describe('EnhancedComplianceService', () => {
	let service: EnhancedComplianceService
	let mockEvents: AuditLogEvent[]

	beforeEach(() => {
		service = new EnhancedComplianceService(mockDbClient as any, mockAudit as any)

		// Mock sample events
		mockEvents = [
			{
				id: 1,
				timestamp: '2024-01-15T10:00:00Z',
				principalId: 'user-123',
				organizationId: 'org-123',
				action: 'fhir.patient.read',
				targetResourceType: 'Patient',
				targetResourceId: 'pat-456',
				status: 'success',
				dataClassification: 'PHI',
				hash: 'abc123',
				hashAlgorithm: 'SHA-256',
			},
			{
				id: 2,
				timestamp: '2024-01-15T11:00:00Z',
				principalId: 'user-456',
				organizationId: 'org-123',
				action: 'auth.login.success',
				status: 'success',
				dataClassification: 'INTERNAL',
			},
			{
				id: 3,
				timestamp: '2024-01-15T12:00:00Z',
				principalId: 'user-789',
				organizationId: 'org-123',
				action: 'data.export',
				targetResourceType: 'User',
				targetResourceId: 'user-789',
				status: 'success',
				dataClassification: 'CONFIDENTIAL',
			},
		]

		// Setup mock database response
		mockDbClient.executeMonitoredQuery.mockResolvedValue(
			mockEvents.map((event) => ({
				id: event.id,
				timestamp: event.timestamp,
				principal_id: event.principalId,
				organization_id: event.organizationId,
				action: event.action,
				target_resource_type: event.targetResourceType,
				target_resource_id: event.targetResourceId,
				status: event.status,
				data_classification: event.dataClassification,
				hash: event.hash,
				hash_algorithm: event.hashAlgorithm,
			}))
		)
	})

	describe('generateHIPAAReport', () => {
		it('should generate a valid HIPAA compliance report', async () => {
			const criteria: ReportCriteria = {
				dateRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-31T23:59:59Z',
				},
				organizationIds: ['org-123'],
				dataClassifications: ['PHI'],
			}

			const report = await service.generateHIPAAReport(criteria)

			expect(report).toBeDefined()
			expect(report.type).toBe('hipaa')
			expect(report.id).toMatch(/^[0-9a-f-]{36}$/) // UUID format
			expect(report.generatedAt).toBeDefined()
			expect(report.criteria).toEqual(criteria)
			expect(report.summary).toBeDefined()
			expect(report.summary.totalEvents).toBeGreaterThanOrEqual(0)
			expect(report.summary.complianceScore).toBeGreaterThanOrEqual(0)
			expect(report.summary.complianceScore).toBeLessThanOrEqual(100)
			expect(report.sections).toBeInstanceOf(Array)
			expect(report.sections.length).toBeGreaterThan(0)
			expect(report.metadata).toBeDefined()
		})

		it('should include administrative, physical, and technical safeguards', async () => {
			const criteria: ReportCriteria = {
				dateRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-31T23:59:59Z',
				},
				organizationIds: ['org-123'],
			}

			const report = await service.generateHIPAAReport(criteria)

			const safeguards = report.sections.map((s) => s.safeguard)
			expect(safeguards).toContain('administrative')
			expect(safeguards).toContain('physical')
			expect(safeguards).toContain('technical')
		})

		it('should calculate compliance scores for each section', async () => {
			const criteria: ReportCriteria = {
				dateRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-31T23:59:59Z',
				},
				organizationIds: ['org-123'],
			}

			const report = await service.generateHIPAAReport(criteria)

			report.sections.forEach((section) => {
				expect(section.score).toBeGreaterThanOrEqual(0)
				expect(section.score).toBeLessThanOrEqual(100)
				expect(section.status).toMatch(/^(compliant|partial|non_compliant|unknown)$/)
			})
		})
	})

	describe('generateGDPRReport', () => {
		it('should generate a valid GDPR compliance report', async () => {
			const criteria: ReportCriteria = {
				dateRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-31T23:59:59Z',
				},
				organizationIds: ['org-123'],
			}

			const report = await service.generateGDPRReport(criteria)

			expect(report).toBeDefined()
			expect(report.type).toBe('gdpr')
			expect(report.id).toMatch(/^[0-9a-f-]{36}$/)
			expect(report.generatedAt).toBeDefined()
			expect(report.criteria).toEqual(criteria)
			expect(report.summary).toBeDefined()
			expect(report.summary.totalEvents).toBeGreaterThanOrEqual(0)
			expect(report.summary.complianceScore).toBeGreaterThanOrEqual(0)
			expect(report.summary.complianceScore).toBeLessThanOrEqual(100)
			expect(report.sections).toBeInstanceOf(Array)
			expect(report.metadata).toBeDefined()
		})

		it('should include GDPR articles in sections', async () => {
			const criteria: ReportCriteria = {
				dateRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-31T23:59:59Z',
				},
				organizationIds: ['org-123'],
			}

			const report = await service.generateGDPRReport(criteria)

			const articles = report.sections.map((s) => s.article)
			expect(articles).toContain('Article 6') // Lawfulness
			expect(articles).toContain('Article 7') // Consent
			expect(articles).toContain('Articles 12-22') // Data subject rights
		})
	})

	describe('generateCustomReport', () => {
		it('should generate a custom report with basic parameters', async () => {
			const params = {
				criteria: {
					dateRange: {
						startDate: '2024-01-01T00:00:00Z',
						endDate: '2024-01-31T23:59:59Z',
					},
					organizationIds: ['org-123'],
				},
				format: 'json' as const,
				includeRawData: true,
			}

			const report = await service.generateCustomReport(params)

			expect(report).toBeDefined()
			expect(report.type).toBe('custom')
			expect(report.id).toMatch(/^[0-9a-f-]{36}$/)
			expect(report.data).toBeInstanceOf(Array)
			expect(report.summary).toBeDefined()
			expect(report.metadata).toBeDefined()
		})
	})

	describe('exportGDPRData', () => {
		it('should export GDPR data for a data subject', async () => {
			const params = {
				dataSubjectId: 'user-123',
				dataSubjectType: 'user' as const,
				includePersonalData: true,
				format: 'json' as const,
				deliveryMethod: 'download' as const,
			}

			const result = await service.exportGDPRData(params)

			expect(result).toBeDefined()
			expect(result.exportId).toMatch(/^[0-9a-f-]{36}$/)
			expect(result.dataSubjectId).toBe('user-123')
			expect(result.status).toBe('completed')
			expect(result.format).toBe('json')
			expect(result.recordCount).toBeGreaterThanOrEqual(0)
			expect(result.dataSize).toBeGreaterThanOrEqual(0)
		})
	})

	describe('pseudonymizeData', () => {
		it('should return pseudonymization result for dry run', async () => {
			const params = {
				dataSubjectIds: ['user-123', 'user-456'],
				method: 'hash' as const,
				dryRun: true,
				reversible: false,
			}

			const result = await service.pseudonymizeData(params)

			expect(result).toBeDefined()
			expect(result.requestId).toMatch(/^[0-9a-f-]{36}$/)
			expect(result.status).toBe('completed')
			expect(result.method).toBe('hash')
			expect(result.processedRecords).toBeGreaterThan(0)
			expect(result.reversible).toBe(false)
		})

		it('should return pending status for actual pseudonymization', async () => {
			const params = {
				dataSubjectIds: ['user-123'],
				method: 'encryption' as const,
				dryRun: false,
				reversible: true,
				keyId: 'key-123',
			}

			const result = await service.pseudonymizeData(params)

			expect(result).toBeDefined()
			expect(result.status).toBe('pending')
			expect(result.method).toBe('encryption')
			expect(result.reversible).toBe(true)
			expect(result.keyId).toBe('key-123')
		})
	})

	describe('error handling', () => {
		it('should handle database errors gracefully', async () => {
			mockDbClient.executeMonitoredQuery.mockRejectedValue(new Error('Database connection failed'))

			const criteria: ReportCriteria = {
				dateRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-31T23:59:59Z',
				},
				organizationIds: ['org-123'],
			}

			await expect(service.generateHIPAAReport(criteria)).rejects.toThrow(
				'Failed to retrieve filtered events'
			)
		})
	})
})
