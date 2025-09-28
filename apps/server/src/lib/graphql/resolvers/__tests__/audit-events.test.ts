/**
 * Audit Events GraphQL Resolver Tests
 */

import { GraphQLError } from 'graphql'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { auditEventResolvers } from '../audit-events'

import type { GraphQLContext } from '../../types'

// Mock services
const mockServices = {
	client: {
		executeMonitoredQuery: vi.fn(),
		executeOptimizedQuery: vi.fn(),
		generateCacheKey: vi.fn(),
	},
	logger: {
		info: vi.fn(),
		error: vi.fn(),
	},
	error: {
		handleError: vi.fn(),
	},
}

// Mock session
const mockSession = {
	session: {
		id: 'session-123',
		userId: 'user-123',
		activeOrganizationId: 'org-123',
		activeOrganizationRole: 'admin',
		ipAddress: '127.0.0.1',
		userAgent: 'test-agent',
		expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
	},
	user: {
		id: 'user-123',
		email: 'test@example.com',
		role: 'user',
		banned: false,
	},
}

// Mock GraphQL context
const mockContext: GraphQLContext = {
	services: mockServices as any,
	session: mockSession as any,
	requestId: 'req-123',
	isAuthenticated: true,
	isApiKeyAuth: false,
}

describe('Audit Events Resolvers', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Query.auditEvents', () => {
		it('should throw error when not authenticated', async () => {
			const unauthenticatedContext = {
				...mockContext,
				session: null,
				isAuthenticated: false,
			}

			await expect(
				auditEventResolvers.Query.auditEvents(
					{},
					{ pagination: { first: 10 } },
					unauthenticatedContext
				)
			).rejects.toThrow(GraphQLError)

			await expect(
				auditEventResolvers.Query.auditEvents(
					{},
					{ pagination: { first: 10 } },
					unauthenticatedContext
				)
			).rejects.toThrow('Authentication required')
		})

		it('should fetch audit events when authenticated', async () => {
			const mockEvents = [
				{
					id: 1,
					timestamp: '2023-01-01T00:00:00Z',
					action: 'test.action',
					principalId: 'user-123',
					organizationId: 'org-123',
					status: 'success',
				},
			]

			mockServices.client.executeMonitoredQuery
				.mockResolvedValueOnce(mockEvents) // For events query
				.mockResolvedValueOnce([{ count: 1 }]) // For count query

			mockServices.client.generateCacheKey.mockReturnValue('cache-key')

			const result = await auditEventResolvers.Query.auditEvents(
				{},
				{ pagination: { first: 10 } },
				mockContext
			)

			expect(result).toBeDefined()
			expect(result.edges).toHaveLength(1)
			expect(result.totalCount).toBe(1)
			expect(result.edges[0].node.id).toBe('1')
			expect(result.edges[0].node.action).toBe('test.action')
		})
	})

	describe('Query.auditEvent', () => {
		it('should throw error when not authenticated', async () => {
			const unauthenticatedContext = {
				...mockContext,
				session: null,
				isAuthenticated: false,
			}

			await expect(
				auditEventResolvers.Query.auditEvent({}, { id: '1' }, unauthenticatedContext)
			).rejects.toThrow(GraphQLError)

			await expect(
				auditEventResolvers.Query.auditEvent({}, { id: '1' }, unauthenticatedContext)
			).rejects.toThrow('Authentication required')
		})

		it('should fetch single audit event when authenticated', async () => {
			const mockEvent = {
				id: 1,
				timestamp: '2023-01-01T00:00:00Z',
				action: 'test.action',
				principalId: 'user-123',
				organizationId: 'org-123',
				status: 'success',
			}

			mockServices.client.executeOptimizedQuery.mockResolvedValue([mockEvent])

			const result = await auditEventResolvers.Query.auditEvent({}, { id: '1' }, mockContext)

			expect(result).toBeDefined()
			expect(result?.id).toBe('1')
			expect(result?.action).toBe('test.action')
		})

		it('should return null when event not found', async () => {
			mockServices.client.executeOptimizedQuery.mockResolvedValue([])

			const result = await auditEventResolvers.Query.auditEvent({}, { id: '999' }, mockContext)

			expect(result).toBeNull()
		})
	})
})
