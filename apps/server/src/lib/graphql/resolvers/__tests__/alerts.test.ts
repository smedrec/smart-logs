/**
 * Tests for alerts GraphQL resolver compatibility
 */

import { GraphQLError } from 'graphql'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { alertResolvers } from '../alerts'

import type { Alert as MonitorAlert } from '@repo/audit'
import type { GraphQLContext } from '../../types'

// Mock monitor alert data
const mockMonitorAlert: MonitorAlert = {
	id: 'alert-123',
	severity: 'HIGH',
	type: 'SECURITY',
	title: 'Test Alert',
	description: 'Test alert description',
	timestamp: '2024-01-01T00:00:00Z',
	source: 'test-source',
	metadata: { organizationId: 'org-123' },
	acknowledged: false,
	resolved: false,
}

// Mock context
const mockContext: GraphQLContext = {
	services: {
		monitor: {
			alert: {
				getAlerts: vi.fn(),
				acknowledgeAlert: vi.fn(),
				resolveAlert: vi.fn(),
				getAlertById: vi.fn(),
			},
		},
		logger: {
			info: vi.fn(),
			error: vi.fn(),
		},
		error: {
			handleError: vi.fn(),
		},
	} as any,
	session: {
		session: {
			activeOrganizationId: 'org-123',
			userId: 'user-123',
			id: 'session-123',
		},
	} as any,
	requestId: 'req-123',
	isAuthenticated: true,
	isApiKeyAuth: false,
}

describe('Alert Resolvers', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Query.alerts', () => {
		it('should fetch and convert alerts correctly', async () => {
			// Mock the monitor service response
			mockContext.services.monitor.alert.getAlerts.mockResolvedValue([mockMonitorAlert])

			const result = await alertResolvers.Query.alerts(
				{},
				{ pagination: { first: 10 } },
				mockContext
			)

			expect(result).toEqual({
				edges: [
					{
						node: {
							id: 'alert-123',
							type: 'SECURITY',
							severity: 'HIGH',
							title: 'Test Alert',
							description: 'Test alert description',
							createdAt: '2024-01-01T00:00:00Z',
							acknowledgedAt: undefined,
							resolvedAt: undefined,
							acknowledgedBy: undefined,
							resolvedBy: undefined,
							resolution: undefined,
							metadata: { organizationId: 'org-123' },
						},
						cursor: expect.any(String),
					},
				],
				pageInfo: {
					hasNextPage: false,
					hasPreviousPage: false,
					startCursor: expect.any(String),
					endCursor: expect.any(String),
				},
				totalCount: 1,
			})
		})

		it('should handle METRICS type mapping to SYSTEM', async () => {
			const metricsAlert: MonitorAlert = {
				...mockMonitorAlert,
				type: 'METRICS',
			}

			mockContext.services.monitor.alert.getAlerts.mockResolvedValue([metricsAlert])

			const result = await alertResolvers.Query.alerts(
				{},
				{ pagination: { first: 10 } },
				mockContext
			)

			expect(result.edges[0].node.type).toBe('SYSTEM')
		})

		it('should throw error when not authenticated', async () => {
			const unauthenticatedContext = { ...mockContext, session: null }

			await expect(alertResolvers.Query.alerts({}, {}, unauthenticatedContext)).rejects.toThrow(
				GraphQLError
			)
		})
	})

	describe('Mutation.acknowledgeAlert', () => {
		it('should acknowledge alert successfully', async () => {
			mockContext.services.monitor.alert.acknowledgeAlert.mockResolvedValue({ success: true })
			mockContext.services.monitor.alert.getAlertById.mockResolvedValue({
				...mockMonitorAlert,
				acknowledged: true,
				acknowledgedAt: '2024-01-01T01:00:00Z',
				acknowledgedBy: 'user-123',
			})

			const result = await alertResolvers.Mutation.acknowledgeAlert(
				{},
				{ id: 'alert-123' },
				mockContext
			)

			expect(result.acknowledged).toBe(true)
			expect(result.acknowledgedBy).toBe('user-123')
		})
	})

	describe('Mutation.resolveAlert', () => {
		it('should resolve alert successfully', async () => {
			mockContext.services.monitor.alert.resolveAlert.mockResolvedValue({ success: true })
			mockContext.services.monitor.alert.getAlertById.mockResolvedValue({
				...mockMonitorAlert,
				resolved: true,
				resolvedAt: '2024-01-01T02:00:00Z',
				resolvedBy: 'user-123',
			})

			const result = await alertResolvers.Mutation.resolveAlert(
				{},
				{ id: 'alert-123', resolution: 'Fixed the issue' },
				mockContext
			)

			expect(result.resolved).toBe(true)
			expect(result.resolvedBy).toBe('user-123')
			expect(result.resolution).toBe('Fixed the issue')
		})
	})
})
