/**
 * Tests for DatabaseAlertHandler
 * Comprehensive testing of alert persistence with multi-organizational support
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DatabaseAlertHandler } from '../monitor/database-alert-handler.js'

import type { AlertQueryFilters, AlertResolution } from '../monitor/database-alert-handler.js'
import type { Alert, AlertSeverity, AlertType } from '../monitor/monitoring-types.js'

// Mock database and Drizzle ORM
const mockDb = {
	insert: vi.fn(),
	update: vi.fn(),
	select: vi.fn(),
	delete: vi.fn(),
	execute: vi.fn(),
}

const mockInsertResult = {
	values: vi.fn().mockReturnThis(),
}

const mockUpdateResult = {
	set: vi.fn().mockReturnThis(),
	where: vi.fn().mockResolvedValue({ rowCount: 1 }),
	rowCount: 1,
}

const mockSelectResult = {
	from: vi.fn().mockReturnThis(),
	where: vi.fn().mockReturnThis(),
	orderBy: vi.fn().mockReturnThis(),
	limit: vi.fn().mockReturnThis(),
	offset: vi.fn().mockReturnThis(),
}

const mockDeleteResult = {
	where: vi.fn().mockReturnThis(),
	rowCount: 5,
}

// Mock alerts table
vi.mock('@repo/audit-db', () => ({
	alerts: {
		id: 'id',
		organizationId: 'organization_id',
		severity: 'severity',
		type: 'type',
		title: 'title',
		description: 'description',
		source: 'source',
		correlationId: 'correlation_id',
		metadata: 'metadata',
		resolved: 'resolved',
		resolvedAt: 'resolved_at',
		resolvedBy: 'resolved_by',
		resolutionNotes: 'resolution_notes',
		createdAt: 'created_at',
		updatedAt: 'updated_at',
	},
}))

// Mock Drizzle ORM functions
vi.mock('drizzle-orm', () => ({
	eq: vi.fn((field, value) => ({ field, value, type: 'eq' })),
	and: vi.fn((...conditions) => ({ conditions, type: 'and' })),
	desc: vi.fn((field) => ({ field, direction: 'desc' })),
	asc: vi.fn((field) => ({ field, direction: 'asc' })),
	sql: Object.assign(
		vi.fn((strings, ...values) => ({ query: strings.join('?'), values, type: 'sql' })),
		{
			raw: vi.fn((query) => ({ query, type: 'raw' })),
		}
	),
}))

describe('DatabaseAlertHandler', () => {
	let handler: DatabaseAlertHandler
	let mockAlert: Alert

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Setup mock database responses for raw SQL queries
		mockDb.execute.mockResolvedValue({ rows: [], rowCount: 1 })

		// Create handler instance
		handler = new DatabaseAlertHandler(mockDb as any)

		// Create mock alert
		mockAlert = {
			id: 'alert-123',
			severity: 'HIGH' as AlertSeverity,
			type: 'SECURITY' as AlertType,
			title: 'Test Alert',
			description: 'This is a test alert',
			timestamp: '2024-01-01T00:00:00.000Z',
			source: 'test-source',
			metadata: {
				organizationId: 'org-123',
				patternType: 'FAILED_AUTH',
				eventCount: 5,
			},
			resolved: false,
		}
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('sendAlert', () => {
		it('should persist alert to database with correct data', async () => {
			await handler.sendAlert(mockAlert)

			expect(mockDb.execute).toHaveBeenCalledTimes(1)
			expect(mockDb.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.stringContaining('INSERT INTO alerts'),
					type: 'sql',
					values: expect.arrayContaining([
						'alert-123',
						'org-123',
						'HIGH',
						'SECURITY',
						'Test Alert',
						'This is a test alert',
						'test-source',
					]),
				})
			)
		})

		it('should throw error if organizationId is missing', async () => {
			const alertWithoutOrg = { ...mockAlert }
			delete alertWithoutOrg.metadata.organizationId

			await expect(handler.sendAlert(alertWithoutOrg)).rejects.toThrow(
				'Alert must have organizationId in metadata for multi-tenant support'
			)
		})

		it('should handle database insertion errors', async () => {
			const dbError = new Error('Database connection failed')
			mockDb.execute.mockRejectedValue(dbError)

			await expect(handler.sendAlert(mockAlert)).rejects.toThrow(
				'Failed to persist alert to database: Error: Database connection failed'
			)
		})

		it('should handle alert with correlationId', async () => {
			const alertWithCorrelation = {
				...mockAlert,
				correlationId: 'corr-123',
			}

			await handler.sendAlert(alertWithCorrelation)

			expect(mockDb.execute).toHaveBeenCalledTimes(1)
			expect(mockDb.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.stringContaining('INSERT INTO alerts'),
					type: 'sql',
					values: expect.arrayContaining(['corr-123']),
				})
			)
		})
	})

	describe('resolveAlert', () => {
		it('should resolve alert with basic information', async () => {
			const mockDate = '2024-01-01T12:00:00.000Z'
			vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate)

			await handler.resolveAlert('alert-123', 'user-456')

			expect(mockDb.execute).toHaveBeenCalledTimes(1)
			expect(mockDb.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.stringContaining('UPDATE alerts'),
					type: 'sql',
					values: expect.arrayContaining([mockDate, 'user-456', 'alert-123']),
				})
			)
		})

		it('should resolve alert with resolution data', async () => {
			const mockDate = '2024-01-01T12:00:00.000Z'
			vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate)

			const resolutionData: AlertResolution = {
				resolvedBy: 'admin-789',
				resolutionNotes: 'False positive - system maintenance',
			}

			await handler.resolveAlert('alert-123', 'user-456', resolutionData)

			expect(mockDb.execute).toHaveBeenCalledTimes(1)
			expect(mockDb.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.stringContaining('UPDATE alerts'),
					type: 'sql',
					values: expect.arrayContaining([
						mockDate,
						'admin-789',
						'False positive - system maintenance',
						'alert-123',
					]),
				})
			)
		})

		it('should throw error if alert not found', async () => {
			mockDb.execute.mockResolvedValue({ rowCount: 0 })

			await expect(handler.resolveAlert('nonexistent-alert', 'user-456')).rejects.toThrow(
				'Alert with ID nonexistent-alert not found'
			)
		})

		it('should handle database update errors', async () => {
			const dbError = new Error('Database update failed')
			mockDb.execute.mockRejectedValue(dbError)

			await expect(handler.resolveAlert('alert-123', 'user-456')).rejects.toThrow(
				'Failed to resolve alert in database: Error: Database update failed'
			)
		})
	})

	describe('getActiveAlerts', () => {
		const mockDbAlerts = [
			{
				id: 'alert-1',
				organization_id: 'org-123',
				severity: 'HIGH',
				type: 'SECURITY',
				title: 'Alert 1',
				description: 'Description 1',
				source: 'source-1',
				correlation_id: null,
				metadata: '{"test": "data"}',
				resolved: 'false',
				resolved_at: null,
				resolved_by: null,
				created_at: '2024-01-01T00:00:00.000Z',
			},
			{
				id: 'alert-2',
				organization_id: 'org-123',
				severity: 'MEDIUM',
				type: 'PERFORMANCE',
				title: 'Alert 2',
				description: 'Description 2',
				source: 'source-2',
				correlation_id: 'corr-123',
				metadata: '{"test": "data2"}',
				resolved: 'false',
				resolved_at: null,
				resolved_by: null,
				created_at: '2024-01-01T01:00:00.000Z',
			},
		]

		beforeEach(() => {
			// Mock the execute method to return alerts
			mockDb.execute.mockResolvedValue({ rows: mockDbAlerts, rowCount: mockDbAlerts.length })
		})

		it('should retrieve active alerts for organization', async () => {
			const alerts = await handler.getActiveAlerts('org-123')

			expect(mockDb.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.stringContaining('SELECT * FROM alerts'),
					type: 'sql',
					values: expect.arrayContaining(['org-123']),
				})
			)
			expect(alerts).toHaveLength(2)
			expect(alerts[0]).toEqual({
				id: 'alert-1',
				severity: 'HIGH',
				type: 'SECURITY',
				title: 'Alert 1',
				description: 'Description 1',
				timestamp: '2024-01-01T00:00:00.000Z',
				source: 'source-1',
				metadata: {
					test: 'data',
					organizationId: 'org-123',
				},
				resolved: false,
				resolvedAt: undefined,
				resolvedBy: undefined,
				correlationId: undefined,
			})
		})

		it('should throw error if organizationId is not provided', async () => {
			await expect(handler.getActiveAlerts()).rejects.toThrow(
				'organizationId is required for multi-tenant alert access'
			)
		})

		it('should handle database query errors', async () => {
			const dbError = new Error('Database query failed')
			mockDb.execute.mockRejectedValue(dbError)

			await expect(handler.getActiveAlerts('org-123')).rejects.toThrow(
				'Failed to retrieve active alerts: Error: Database query failed'
			)
		})
	})

	describe('getAlerts', () => {
		const mockDbAlerts = [
			{
				id: 'alert-1',
				organization_id: 'org-123',
				severity: 'HIGH',
				type: 'SECURITY',
				title: 'Alert 1',
				description: 'Description 1',
				source: 'source-1',
				correlation_id: null,
				metadata: '{"test": "data"}',
				resolved: 'false',
				resolved_at: null,
				resolved_by: null,
				created_at: '2024-01-01T00:00:00.000Z',
			},
		]

		beforeEach(() => {
			mockDb.execute.mockResolvedValue({ rows: mockDbAlerts, rowCount: mockDbAlerts.length })
		})

		it('should retrieve alerts with basic filters', async () => {
			const filters: AlertQueryFilters = {
				organizationId: 'org-123',
			}

			const alerts = await handler.getAlerts(filters)

			expect(mockDb.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.stringContaining('SELECT * FROM alerts'),
					type: 'raw',
				})
			)
			expect(alerts).toHaveLength(1)
		})

		it('should apply all filters correctly', async () => {
			const filters: AlertQueryFilters = {
				organizationId: 'org-123',
				resolved: false,
				severity: 'HIGH',
				type: 'SECURITY',
				source: 'test-source',
				limit: 10,
				offset: 5,
				sortBy: 'severity',
				sortOrder: 'asc',
			}

			await handler.getAlerts(filters)

			expect(mockDb.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.stringContaining('SELECT * FROM alerts'),
					type: 'raw',
				})
			)
		})

		it('should handle database query errors', async () => {
			const dbError = new Error('Database query failed')
			mockDb.execute.mockRejectedValue(dbError)

			const filters: AlertQueryFilters = { organizationId: 'org-123' }

			await expect(handler.getAlerts(filters)).rejects.toThrow(
				'Failed to retrieve alerts: Error: Database query failed'
			)
		})
	})

	describe('getAlertById', () => {
		const mockDbAlert = {
			id: 'alert-123',
			organization_id: 'org-123',
			severity: 'HIGH',
			type: 'SECURITY',
			title: 'Test Alert',
			description: 'Test Description',
			source: 'test-source',
			correlation_id: null,
			metadata: '{"test": "data"}',
			resolved: 'false',
			resolved_at: null,
			resolved_by: null,
			created_at: '2024-01-01T00:00:00.000Z',
		}

		beforeEach(() => {
			mockDb.execute.mockResolvedValue({ rows: [mockDbAlert], rowCount: 1 })
		})

		it('should retrieve alert by ID for organization', async () => {
			const alert = await handler.getAlertById('alert-123', 'org-123')

			expect(mockDb.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.stringContaining('SELECT * FROM alerts'),
					type: 'sql',
					values: expect.arrayContaining(['alert-123', 'org-123']),
				})
			)
			expect(alert).not.toBeNull()
			expect(alert?.id).toBe('alert-123')
			expect(alert?.metadata.organizationId).toBe('org-123')
		})

		it('should return null if alert not found', async () => {
			mockDb.execute.mockResolvedValue({ rows: [], rowCount: 0 })

			const alert = await handler.getAlertById('nonexistent', 'org-123')

			expect(alert).toBeNull()
		})

		it('should handle database query errors', async () => {
			const dbError = new Error('Database query failed')
			mockDb.execute.mockRejectedValue(dbError)

			await expect(handler.getAlertById('alert-123', 'org-123')).rejects.toThrow(
				'Failed to retrieve alert by ID: Error: Database query failed'
			)
		})
	})

	describe('getAlertStatistics', () => {
		const mockStatsResult = {
			total: '4',
			active: '2',
			resolved: '2',
			low_severity: '1',
			medium_severity: '1',
			high_severity: '2',
			critical_severity: '0',
			security_type: '2',
			compliance_type: '0',
			performance_type: '1',
			system_type: '1',
		}

		beforeEach(() => {
			mockDb.execute.mockResolvedValue({ rows: [mockStatsResult], rowCount: 1 })
		})

		it('should calculate alert statistics correctly', async () => {
			const stats = await handler.getAlertStatistics('org-123')

			expect(mockDb.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.stringContaining('SELECT'),
					type: 'sql',
					values: expect.arrayContaining(['org-123']),
				})
			)
			expect(stats).toEqual({
				total: 4,
				active: 2,
				resolved: 2,
				bySeverity: {
					LOW: 1,
					MEDIUM: 1,
					HIGH: 2,
					CRITICAL: 0,
				},
				byType: {
					SECURITY: 2,
					COMPLIANCE: 0,
					PERFORMANCE: 1,
					SYSTEM: 1,
				},
			})
		})

		it('should handle database query errors', async () => {
			const dbError = new Error('Database query failed')
			mockDb.execute.mockRejectedValue(dbError)

			await expect(handler.getAlertStatistics('org-123')).rejects.toThrow(
				'Failed to retrieve alert statistics: Error: Database query failed'
			)
		})
	})

	describe('cleanupResolvedAlerts', () => {
		beforeEach(() => {
			mockDb.execute.mockResolvedValue({ rowCount: 5 })
		})

		it('should cleanup old resolved alerts', async () => {
			const deletedCount = await handler.cleanupResolvedAlerts('org-123', 30)

			expect(mockDb.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.stringContaining('DELETE FROM alerts'),
					type: 'sql',
					values: expect.arrayContaining(['org-123']),
				})
			)
			expect(deletedCount).toBe(5)
		})

		it('should use default retention period', async () => {
			await handler.cleanupResolvedAlerts('org-123')

			expect(mockDb.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.stringContaining('DELETE FROM alerts'),
					type: 'sql',
					values: expect.arrayContaining(['org-123']),
				})
			)
		})

		it('should handle database deletion errors', async () => {
			const dbError = new Error('Database deletion failed')
			mockDb.execute.mockRejectedValue(dbError)

			await expect(handler.cleanupResolvedAlerts('org-123')).rejects.toThrow(
				'Failed to cleanup resolved alerts: Error: Database deletion failed'
			)
		})
	})

	describe('createDatabaseAlertHandler', () => {
		it('should create DatabaseAlertHandler instance', async () => {
			const { createDatabaseAlertHandler } = await import('../monitor/database-alert-handler.js')
			const handler = createDatabaseAlertHandler(mockDb)

			expect(handler).toBeInstanceOf(DatabaseAlertHandler)
		})
	})
})
