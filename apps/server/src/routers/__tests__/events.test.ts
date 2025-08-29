/**
 * TRPC Events Router Unit Tests
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { TRPCError } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createTRPCCaller, testUtils } from '../../__tests__/setup'
import { eventsRouter } from '../events'
import { createTRPCRouter } from '../index'

describe('TRPC Events Router', () => {
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
				targetResourceType: 'patient',
				targetResourceId: 'patient-123',
				principalId: 'user-456',
				organizationId: 'org-789',
				status: 'success' as const,
				dataClassification: 'PHI' as const,
				outcomeDescription: 'Patient data accessed successfully',
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
					...input,
					organizationId: mockContext.session.session.activeOrganizationId,
					timestamp: expect.any(String),
					eventVersion: '1.0',
				})
			)
			expect(mockContext.services.logger.info).toHaveBeenCalledWith(
				'Audit event created successfully',
				expect.objectContaining({
					action: input.action,
					principalId: input.principalId,
					organizationId: mockContext.session.session.activeOrganizationId,
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
			await expect(
				eventsRouter.create({
					ctx: mockContext,
					input,
					type: 'mutation',
					path: 'events.create',
				})
			).rejects.toThrow(TRPCError)

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

		it('should validate required fields', async () => {
			// Arrange
			const invalidInput = {
				action: '', // Invalid: empty string
				principalId: 'user-456',
				organizationId: 'org-789',
				status: 'success' as const,
			}

			// Act & Assert
			await expect(
				eventsRouter.create({
					ctx: mockContext,
					input: invalidInput,
					type: 'mutation',
					path: 'events.create',
				})
			).rejects.toThrow()
		})
	})

	describe('bulkCreate procedure', () => {
		it('should create multiple audit events successfully', async () => {
			// Arrange
			const input = {
				events: [
					{
						action: 'data.read',
						principalId: 'user-456',
						organizationId: 'org-789',
						status: 'success' as const,
					},
					{
						action: 'data.write',
						principalId: 'user-456',
						organizationId: 'org-789',
						status: 'success' as const,
					},
				],
				validateIntegrity: true,
			}

			mockContext.services.audit.log.mockResolvedValue(undefined)

			// Act
			const result = await eventsRouter.bulkCreate({
				ctx: mockContext,
				input,
				type: 'mutation',
				path: 'events.bulkCreate',
			})

			// Assert
			expect(result.summary.total).toBe(2)
			expect(result.summary.successful).toBe(2)
			expect(result.summary.failed).toBe(0)
			expect(mockContext.services.audit.log).toHaveBeenCalledTimes(2)
		})

		it('should handle partial failures in bulk creation', async () => {
			// Arrange
			const input = {
				events: [
					{
						action: 'data.read',
						principalId: 'user-456',
						organizationId: 'org-789',
						status: 'success' as const,
					},
					{
						action: 'data.write',
						principalId: 'user-456',
						organizationId: 'org-789',
						status: 'success' as const,
					},
				],
				validateIntegrity: true,
			}

			// Mock first call to succeed, second to fail
			mockContext.services.audit.log
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new Error('Database error'))

			// Act
			const result = await eventsRouter.bulkCreate({
				ctx: mockContext,
				input,
				type: 'mutation',
				path: 'events.bulkCreate',
			})

			// Assert
			expect(result.summary.total).toBe(2)
			expect(result.summary.successful).toBe(1)
			expect(result.summary.failed).toBe(1)
		})

		it('should enforce bulk creation limits', async () => {
			// Arrange
			const input = {
				events: Array(101).fill({
					action: 'data.read',
					principalId: 'user-456',
					organizationId: 'org-789',
					status: 'success' as const,
				}),
				validateIntegrity: true,
			}

			// Act & Assert
			await expect(
				eventsRouter.bulkCreate({
					ctx: mockContext,
					input,
					type: 'mutation',
					path: 'events.bulkCreate',
				})
			).rejects.toThrow()
		})
	})

	describe('query procedure', () => {
		it('should query audit events with filters', async () => {
			// Arrange
			const input = {
				filter: {
					dateRange: {
						startDate: '2024-01-01T00:00:00.000Z',
						endDate: '2024-01-31T23:59:59.999Z',
					},
					actions: ['data.read', 'data.write'],
					statuses: ['success' as const],
				},
				pagination: {
					limit: 50,
					offset: 0,
				},
				sort: {
					field: 'timestamp' as const,
					direction: 'desc' as const,
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
			const result = await eventsRouter.query({
				ctx: mockContext,
				input,
				type: 'query',
				path: 'events.query',
			})

			// Assert
			expect(result.events).toHaveLength(2)
			expect(result.pagination.total).toBe(2)
			expect(result.pagination.hasNext).toBe(false)
			expect(result.pagination.hasPrevious).toBe(false)
			expect(mockContext.services.client.executeMonitoredQuery).toHaveBeenCalledTimes(2)
		})

		it('should enforce organization isolation', async () => {
			// Arrange
			const input = {
				filter: {
					organizationIds: ['different-org-id'], // Should be ignored
				},
				pagination: {
					limit: 50,
					offset: 0,
				},
			}

			mockContext.services.client.executeMonitoredQuery
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ count: 0 }])

			// Act
			await eventsRouter.query({
				ctx: mockContext,
				input,
				type: 'query',
				path: 'events.query',
			})

			// Assert
			// Verify that the query was called with the session's organization ID
			expect(mockContext.services.client.executeMonitoredQuery).toHaveBeenCalledWith(
				expect.any(Function),
				'audit_events_query',
				expect.objectContaining({
					cacheKey: expect.any(String),
				})
			)
		})

		it('should handle pagination correctly', async () => {
			// Arrange
			const input = {
				pagination: {
					limit: 10,
					offset: 20,
				},
			}

			const mockEvents = Array(10)
				.fill(null)
				.map((_, i) => testUtils.generateAuditEvent({ id: i + 21 }))

			mockContext.services.client.executeMonitoredQuery
				.mockResolvedValueOnce(mockEvents)
				.mockResolvedValueOnce([{ count: 100 }])

			// Act
			const result = await eventsRouter.query({
				ctx: mockContext,
				input,
				type: 'query',
				path: 'events.query',
			})

			// Assert
			expect(result.pagination.total).toBe(100)
			expect(result.pagination.limit).toBe(10)
			expect(result.pagination.offset).toBe(20)
			expect(result.pagination.hasNext).toBe(true)
			expect(result.pagination.hasPrevious).toBe(true)
		})
	})

	describe('getById procedure', () => {
		it('should retrieve audit event by ID', async () => {
			// Arrange
			const input = { id: '123' }
			const mockEvent = testUtils.generateAuditEvent({ id: 123 })

			mockContext.services.client.executeOptimizedQuery.mockResolvedValue([mockEvent])

			// Act
			const result = await eventsRouter.getById({
				ctx: mockContext,
				input,
				type: 'query',
				path: 'events.getById',
			})

			// Assert
			expect(result).toEqual(mockEvent)
			expect(mockContext.services.client.executeOptimizedQuery).toHaveBeenCalledWith(
				expect.any(Function),
				expect.objectContaining({
					cacheKey: `audit_event_${input.id}`,
				})
			)
		})

		it('should throw NOT_FOUND for non-existent event', async () => {
			// Arrange
			const input = { id: '999' }
			mockContext.services.client.executeOptimizedQuery.mockResolvedValue([])

			// Act & Assert
			await expect(
				eventsRouter.getById({
					ctx: mockContext,
					input,
					type: 'query',
					path: 'events.getById',
				})
			).rejects.toThrow(TRPCError)
		})

		it('should enforce organization isolation for getById', async () => {
			// Arrange
			const input = { id: '123' }
			mockContext.services.client.executeOptimizedQuery.mockResolvedValue([])

			// Act & Assert
			await expect(
				eventsRouter.getById({
					ctx: mockContext,
					input,
					type: 'query',
					path: 'events.getById',
				})
			).rejects.toThrow(TRPCError)
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
			const result = await eventsRouter.verify({
				ctx: mockContext,
				input,
				type: 'mutation',
				path: 'events.verify',
			})

			// Assert
			expect(result.isValid).toBe(true)
			expect(result.eventId).toBe(input.id)
			expect(result.expectedHash).toBe('existing-hash')
			expect(result.computedHash).toBe('existing-hash')
			expect(mockContext.services.audit.verifyEventHash).toHaveBeenCalledWith(
				expect.objectContaining(mockEvent),
				'existing-hash'
			)
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
			const result = await eventsRouter.verify({
				ctx: mockContext,
				input,
				type: 'mutation',
				path: 'events.verify',
			})

			// Assert
			expect(result.isValid).toBe(false)
			expect(result.expectedHash).toBe('existing-hash')
			expect(result.computedHash).toBe('different-hash')
		})

		it('should handle events without hash', async () => {
			// Arrange
			const input = { id: '123', includeChain: false }
			const mockEvent = testUtils.generateAuditEvent({
				id: 123,
				hash: null,
			})

			mockContext.services.client.executeOptimizedQuery.mockResolvedValue([mockEvent])

			// Act
			const result = await eventsRouter.verify({
				ctx: mockContext,
				input,
				type: 'mutation',
				path: 'events.verify',
			})

			// Assert
			expect(result.isValid).toBe(false)
			expect(result.expectedHash).toBeNull()
			expect(result.computedHash).toBeNull()
		})
	})

	describe('export procedure', () => {
		it('should export audit events successfully', async () => {
			// Arrange
			const input = {
				filter: {
					dateRange: {
						startDate: '2024-01-01T00:00:00.000Z',
						endDate: '2024-01-31T23:59:59.999Z',
					},
				},
				format: 'json' as const,
				includeMetadata: true,
				includeIntegrityReport: false,
				compression: 'none' as const,
			}

			const mockEvents = [
				testUtils.generateAuditEvent({ id: 1 }),
				testUtils.generateAuditEvent({ id: 2 }),
			]

			mockContext.services.client.executeMonitoredQuery.mockResolvedValue(mockEvents)

			// Act
			const result = await eventsRouter.export({
				ctx: mockContext,
				input,
				type: 'mutation',
				path: 'events.export',
			})

			// Assert
			expect(result.exportId).toBe('test-export-id')
			expect(result.recordCount).toBe(10)
			expect(mockContext.services.compliance.export.exportAuditEvents).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						id: 1,
						integrityStatus: 'verified',
					}),
				]),
				expect.objectContaining({
					format: 'json',
					includeMetadata: true,
					includeIntegrityReport: false,
					compression: 'none',
				})
			)
		})

		it('should handle export service errors', async () => {
			// Arrange
			const input = {
				format: 'json' as const,
			}

			mockContext.services.client.executeMonitoredQuery.mockResolvedValue([])
			mockContext.services.compliance.export.exportAuditEvents.mockRejectedValue(
				new Error('Export service unavailable')
			)

			// Act & Assert
			await expect(
				eventsRouter.export({
					ctx: mockContext,
					input,
					type: 'mutation',
					path: 'events.export',
				})
			).rejects.toThrow(TRPCError)
		})
	})

	describe('gdprExport procedure', () => {
		it('should export GDPR data successfully', async () => {
			// Arrange
			const input = {
				principalId: 'user-123',
				format: 'json' as const,
				includeMetadata: true,
			}

			// Act
			const result = await eventsRouter.gdprExport({
				ctx: mockContext,
				input,
				type: 'mutation',
				path: 'events.gdprExport',
			})

			// Assert
			expect(result.requestId).toBe('test-request-id')
			expect(result.recordCount).toBe(5)
			expect(result.data).toBe(Buffer.from('test-gdpr-data').toString('base64'))
			expect(mockContext.services.compliance.gdpr.exportUserData).toHaveBeenCalledWith(
				expect.objectContaining({
					principalId: input.principalId,
					requestType: 'access',
					format: input.format,
					includeMetadata: input.includeMetadata,
					requestedBy: mockContext.session.session.userId,
				})
			)
		})
	})

	describe('gdprPseudonymize procedure', () => {
		it('should pseudonymize GDPR data successfully', async () => {
			// Arrange
			const input = {
				principalId: 'user-123',
				strategy: 'hash' as const,
			}

			// Act
			const result = await eventsRouter.gdprPseudonymize({
				ctx: mockContext,
				input,
				type: 'mutation',
				path: 'events.gdprPseudonymize',
			})

			// Assert
			expect(result.pseudonymId).toBe('test-pseudonym-id')
			expect(result.recordsAffected).toBe(3)
			expect(mockContext.services.compliance.gdpr.pseudonymizeUserData).toHaveBeenCalledWith(
				input.principalId,
				input.strategy,
				mockContext.session.session.userId
			)
		})

		it('should require authentication for GDPR operations', async () => {
			// Arrange
			const input = {
				principalId: 'user-123',
				strategy: 'hash' as const,
			}

			const contextWithoutUser = {
				...mockContext,
				session: {
					session: {
						...mockContext.session.session,
						userId: null,
					},
				},
			}

			// Act & Assert
			await expect(
				eventsRouter.gdprPseudonymize({
					ctx: contextWithoutUser,
					input,
					type: 'mutation',
					path: 'events.gdprPseudonymize',
				})
			).rejects.toThrow(TRPCError)
		})
	})
})
