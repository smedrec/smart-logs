/**
 * Simplified TRPC Events Router Tests
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { TRPCError } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createTRPCCaller, testUtils } from '../../__tests__/setup'
import { eventsRouter } from '../events'
import { createTRPCRouter } from '../index'

describe('TRPC Events Router - Simplified Tests', () => {
	let mockContext: any
	let router: any
	let caller: any

	beforeEach(() => {
		mockContext = {
			...testUtils.mockTRPCContext,
			services: {
				...testUtils.mockServices,
			},
		}

		// Create a test router with just the events router
		router = createTRPCRouter({
			events: eventsRouter,
		})

		// Create a caller for testing
		caller = createTRPCCaller(router, mockContext)
	})

	describe('create procedure', () => {
		it('should create audit event successfully', async () => {
			// Arrange
			const input = {
				action: 'data.read',
				principalId: 'user-456',
				organizationId: 'org-789',
				status: 'success' as const,
			}

			mockContext.services.audit.log.mockResolvedValue(undefined)

			// Act
			const result = await caller.events.create(input)

			// Assert
			expect(result).toEqual({
				success: true,
				message: 'Audit event created successfully',
			})
			expect(mockContext.services.audit.log).toHaveBeenCalledWith(
				expect.objectContaining({
					action: input.action,
					principalId: input.principalId,
					organizationId: mockContext.session.session.activeOrganizationId,
					timestamp: expect.any(String),
					eventVersion: '1.0',
				})
			)
		})

		it('should handle audit service errors', async () => {
			// Arrange
			const input = {
				action: 'data.read',
				principalId: 'user-456',
				organizationId: 'org-789',
				status: 'success' as const,
			}

			const auditError = new Error('Audit service unavailable')
			mockContext.services.audit.log.mockRejectedValue(auditError)

			// Act & Assert
			await expect(caller.events.create(input)).rejects.toThrow(TRPCError)

			expect(mockContext.services.error.handleError).toHaveBeenCalledWith(
				expect.any(TRPCError),
				expect.objectContaining({
					requestId: mockContext.requestId,
					userId: mockContext.session.session.userId,
				}),
				'trpc-api',
				'events.create'
			)
		})
	})

	describe('query procedure', () => {
		it('should query audit events with basic filters', async () => {
			// Arrange
			const input = {
				pagination: {
					limit: 50,
					offset: 0,
				},
			}

			const mockEvents = [
				testUtils.generateAuditEvent({ id: 1, action: 'data.read' }),
				testUtils.generateAuditEvent({ id: 2, action: 'data.write' }),
			]

			mockContext.services.client.executeMonitoredQuery
				.mockResolvedValueOnce(mockEvents) // Events query
				.mockResolvedValueOnce([{ count: 2 }]) // Count query

			// Act
			const result = await caller.events.query(input)

			// Assert
			expect(result.events).toHaveLength(2)
			expect(result.pagination.total).toBe(2)
			expect(result.pagination.hasNext).toBe(false)
			expect(result.pagination.hasPrevious).toBe(false)
		})
	})

	describe('getById procedure', () => {
		it('should retrieve audit event by ID', async () => {
			// Arrange
			const input = { id: '123' }
			const mockEvent = testUtils.generateAuditEvent({ id: 123 })

			mockContext.services.client.executeOptimizedQuery.mockResolvedValue([mockEvent])

			// Act
			const result = await caller.events.getById(input)

			// Assert
			expect(result).toEqual(mockEvent)
		})

		it('should throw NOT_FOUND for non-existent event', async () => {
			// Arrange
			const input = { id: '999' }
			mockContext.services.client.executeOptimizedQuery.mockResolvedValue([])

			// Act & Assert
			await expect(caller.events.getById(input)).rejects.toThrow(TRPCError)
		})
	})

	describe('verify procedure', () => {
		it('should verify audit event integrity successfully', async () => {
			// Arrange
			const input = { id: '123', includeChain: false }
			const mockEvent = testUtils.generateAuditEvent({
				id: 123,
				hash: 'existing-hash',
			})

			mockContext.services.client.executeOptimizedQuery.mockResolvedValue([mockEvent])
			mockContext.services.audit.verifyEventHash.mockReturnValue(true)
			mockContext.services.audit.generateEventHash.mockReturnValue('existing-hash')

			// Act
			const result = await caller.events.verify(input)

			// Assert
			expect(result.isValid).toBe(true)
			expect(result.eventId).toBe(input.id)
			expect(result.expectedHash).toBe('existing-hash')
			expect(result.computedHash).toBe('existing-hash')
		})

		it('should detect integrity violations', async () => {
			// Arrange
			const input = { id: '123', includeChain: false }
			const mockEvent = testUtils.generateAuditEvent({
				id: 123,
				hash: 'existing-hash',
			})

			mockContext.services.client.executeOptimizedQuery.mockResolvedValue([mockEvent])
			mockContext.services.audit.verifyEventHash.mockReturnValue(false)
			mockContext.services.audit.generateEventHash.mockReturnValue('different-hash')

			// Act
			const result = await caller.events.verify(input)

			// Assert
			expect(result.isValid).toBe(false)
			expect(result.expectedHash).toBe('existing-hash')
			expect(result.computedHash).toBe('different-hash')
		})
	})
})
