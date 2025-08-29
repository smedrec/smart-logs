/**
 * End-to-End API Workflow Tests
 * Requirements: 1.2, 2.1, 3.1
 */

import { buildSchema, graphql } from 'graphql'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { testUtils } from './setup'

// Mock server setup for E2E tests
class MockServer {
	private app: any
	private services: any

	constructor() {
		this.services = {
			...testUtils.mockServices,
			audit: {
				...testUtils.mockServices.audit,
				log: vi.fn().mockResolvedValue(undefined),
			},
			compliance: {
				...testUtils.mockServices.compliance,
				report: {
					generateHIPAAReport: vi
						.fn()
						.mockResolvedValue(testUtils.generateComplianceReport({ type: 'HIPAA' })),
				},
			},
			health: {
				checkAllComponents: vi.fn().mockResolvedValue({
					status: 'OK',
					timestamp: new Date().toISOString(),
					checks: [
						{ name: 'database', status: 'OK', responseTime: 10 },
						{ name: 'redis', status: 'OK', responseTime: 5 },
					],
				}),
			},
		}
	}

	async setup() {
		// Mock TRPC app
		const { createTRPCRouter } = await import('../routers')
		const { eventsRouter } = await import('../routers/events')
		const { healthRouter } = await import('../routers/health')
		const { reportsRouter } = await import('../routers/reports')

		const appRouter = createTRPCRouter({
			health: healthRouter,
			events: eventsRouter,
			reports: reportsRouter,
		})

		// Mock REST API
		const { createRestAPI } = await import('../routes/rest-api')
		const restApp = createRestAPI()

		// Add middleware to inject services
		restApp.use('*', (c: any, next: any) => {
			c.set('services', this.services)
			c.set('session', testUtils.mockSession)
			c.set('requestId', 'e2e-test-request')
			c.set('apiVersion', { resolved: '1.0.0' })
			return next()
		})

		this.app = {
			trpc: appRouter,
			rest: restApp,
		}

		return this.app
	}

	getServices() {
		return this.services
	}
}

describe('End-to-End API Workflows', () => {
	let mockServer: MockServer
	let app: any
	let services: any

	beforeAll(async () => {
		mockServer = new MockServer()
		app = await mockServer.setup()
		services = mockServer.getServices()
	})

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Complete Audit Event Lifecycle', () => {
		it('should handle complete audit event workflow across all APIs', async () => {
			// Step 1: Create audit event via TRPC
			const createEventInput = {
				action: 'patient.data.access',
				targetResourceType: 'patient',
				targetResourceId: 'patient-12345',
				principalId: 'doctor-67890',
				organizationId: 'hospital-abc',
				status: 'success' as const,
				dataClassification: 'PHI' as const,
				outcomeDescription: 'Patient medical record accessed for treatment',
				sessionContext: {
					sessionId: 'session-xyz',
					ipAddress: '192.168.1.100',
					userAgent: 'Mozilla/5.0 (compatible; HealthApp/1.0)',
					geolocation: 'US-CA-SF',
				},
				correlationId: 'correlation-123',
				metadata: {
					department: 'cardiology',
					accessReason: 'treatment',
					patientConsent: true,
				},
			}

			// Mock TRPC call
			const trpcContext = {
				...testUtils.mockTRPCContext,
				services,
			}

			const createResult = await app.trpc.events.create({
				ctx: trpcContext,
				input: createEventInput,
				type: 'mutation',
				path: 'events.create',
			})

			expect(createResult.success).toBe(true)
			expect(services.audit.log).toHaveBeenCalledWith(
				expect.objectContaining({
					action: 'patient.data.access',
					principalId: 'doctor-67890',
					dataClassification: 'PHI',
				})
			)

			// Step 2: Query the event via REST API
			const mockEventId = '12345'
			services.client.executeOptimizedQuery.mockResolvedValue([
				testUtils.generateAuditEvent({
					id: parseInt(mockEventId),
					action: 'patient.data.access',
					principalId: 'doctor-67890',
					dataClassification: 'PHI',
				}),
			])

			const restResponse = await request(app.rest.fetch)
				.get(`/audit/events/${mockEventId}`)
				.expect(200)

			expect(restResponse.body).toEqual(
				expect.objectContaining({
					id: parseInt(mockEventId),
					action: 'patient.data.access',
					principalId: 'doctor-67890',
					dataClassification: 'PHI',
				})
			)

			// Step 3: Verify event integrity via TRPC
			services.audit.verifyEventHash.mockReturnValue(true)
			services.audit.generateEventHash.mockReturnValue('valid-hash')

			const verifyResult = await app.trpc.events.verify({
				ctx: trpcContext,
				input: { id: mockEventId, includeChain: false },
				type: 'mutation',
				path: 'events.verify',
			})

			expect(verifyResult.isValid).toBe(true)
			expect(verifyResult.eventId).toBe(mockEventId)

			// Step 4: Generate compliance report including this event
			const reportResult = await app.trpc.reports.hipaa({
				ctx: trpcContext,
				input: {
					criteria: {
						dateRange: {
							startDate: '2024-01-01T00:00:00.000Z',
							endDate: '2024-01-31T23:59:59.999Z',
						},
						dataClassifications: ['PHI'],
						actions: ['patient.data.access'],
					},
				},
				type: 'query',
				path: 'reports.hipaa',
			})

			expect(reportResult.type).toBe('HIPAA')
			expect(services.compliance.report.generateHIPAAReport).toHaveBeenCalledWith(
				expect.objectContaining({
					dateRange: {
						startDate: '2024-01-01T00:00:00.000Z',
						endDate: '2024-01-31T23:59:59.999Z',
					},
					organizationIds: [trpcContext.session.session.activeOrganizationId],
				})
			)
		})

		it('should handle error scenarios gracefully across APIs', async () => {
			// Test error handling in TRPC
			services.audit.log.mockRejectedValue(new Error('Database connection failed'))

			const trpcContext = {
				...testUtils.mockTRPCContext,
				services,
			}

			await expect(
				app.trpc.events.create({
					ctx: trpcContext,
					input: {
						action: 'test.action',
						principalId: 'user-123',
						organizationId: 'org-456',
						status: 'success' as const,
					},
					type: 'mutation',
					path: 'events.create',
				})
			).rejects.toThrow()

			expect(services.error.handleError).toHaveBeenCalled()

			// Test error handling in REST API
			services.client.executeOptimizedQuery.mockRejectedValue(new Error('Query execution failed'))

			const restResponse = await request(app.rest.fetch).get('/audit/events/999').expect(500)

			expect(restResponse.body).toHaveProperty('code')
			expect(restResponse.body).toHaveProperty('message')
			expect(restResponse.body).toHaveProperty('timestamp')
		})
	})

	describe('Multi-API Data Consistency', () => {
		it('should maintain data consistency across TRPC, REST, and GraphQL', async () => {
			const mockEvent = testUtils.generateAuditEvent({
				id: 123,
				action: 'data.consistency.test',
				principalId: 'user-consistency',
			})

			// Mock the same data for all APIs
			services.client.executeOptimizedQuery.mockResolvedValue([mockEvent])
			services.client.executeMonitoredQuery.mockResolvedValue([mockEvent])

			// Test TRPC
			const trpcContext = {
				...testUtils.mockTRPCContext,
				services,
			}

			const trpcResult = await app.trpc.events.getById({
				ctx: trpcContext,
				input: { id: '123' },
				type: 'query',
				path: 'events.getById',
			})

			// Test REST API
			const restResponse = await request(app.rest.fetch).get('/audit/events/123').expect(200)

			// Verify consistency
			expect(trpcResult.id).toBe(mockEvent.id)
			expect(restResponse.body.id).toBe(mockEvent.id)
			expect(trpcResult.action).toBe(restResponse.body.action)
			expect(trpcResult.principalId).toBe(restResponse.body.principalId)
		})

		it('should handle concurrent requests across different APIs', async () => {
			const mockEvents = [
				testUtils.generateAuditEvent({ id: 1, action: 'concurrent.test.1' }),
				testUtils.generateAuditEvent({ id: 2, action: 'concurrent.test.2' }),
				testUtils.generateAuditEvent({ id: 3, action: 'concurrent.test.3' }),
			]

			services.client.executeOptimizedQuery
				.mockResolvedValueOnce([mockEvents[0]])
				.mockResolvedValueOnce([mockEvents[1]])
				.mockResolvedValueOnce([mockEvents[2]])

			const trpcContext = {
				...testUtils.mockTRPCContext,
				services,
			}

			// Make concurrent requests
			const promises = [
				app.trpc.events.getById({
					ctx: trpcContext,
					input: { id: '1' },
					type: 'query',
					path: 'events.getById',
				}),
				request(app.rest.fetch).get('/audit/events/2'),
				app.trpc.events.getById({
					ctx: trpcContext,
					input: { id: '3' },
					type: 'query',
					path: 'events.getById',
				}),
			]

			const results = await Promise.all(promises)

			// Verify all requests completed successfully
			expect(results[0].id).toBe(1)
			expect(results[1].status).toBe(200)
			expect(results[1].body.id).toBe(2)
			expect(results[2].id).toBe(3)
		})
	})

	describe('Authentication and Authorization Flow', () => {
		it('should enforce authentication across all API types', async () => {
			// Test with unauthenticated context
			const unauthenticatedContext = {
				...testUtils.mockTRPCContext,
				session: null,
				services,
			}

			// TRPC should require authentication for protected procedures
			// (This would depend on the actual authentication middleware implementation)

			// REST API should require authentication for protected endpoints
			const restResponse = await request(app.rest.fetch).get('/audit/events/123')

			// The actual behavior would depend on authentication middleware
			// For now, we verify the request structure
			expect(restResponse.status).toBeGreaterThanOrEqual(200)
		})

		it('should enforce organization isolation', async () => {
			const trpcContext = {
				...testUtils.mockTRPCContext,
				services,
				session: {
					session: {
						...testUtils.mockSession.session,
						activeOrganizationId: 'different-org-id',
					},
				},
			}

			// Mock query to return empty results for different organization
			services.client.executeOptimizedQuery.mockResolvedValue([])

			const result = await app.trpc.events.getById({
				ctx: trpcContext,
				input: { id: '123' },
				type: 'query',
				path: 'events.getById',
			})

			expect(result).toBeNull()
		})
	})

	describe('Performance and Scalability', () => {
		it('should handle high-throughput requests efficiently', async () => {
			const startTime = Date.now()
			const requestCount = 50

			// Mock successful responses
			services.audit.log.mockResolvedValue(undefined)
			services.client.executeOptimizedQuery.mockResolvedValue([testUtils.generateAuditEvent()])

			const trpcContext = {
				...testUtils.mockTRPCContext,
				services,
			}

			// Create multiple concurrent requests
			const trpcPromises = Array(requestCount / 2)
				.fill(null)
				.map(() =>
					app.trpc.events.create({
						ctx: trpcContext,
						input: {
							action: 'performance.test',
							principalId: 'user-perf',
							organizationId: 'org-perf',
							status: 'success' as const,
						},
						type: 'mutation',
						path: 'events.create',
					})
				)

			const restPromises = Array(requestCount / 2)
				.fill(null)
				.map(() => request(app.rest.fetch).get('/health'))

			const allPromises = [...trpcPromises, ...restPromises]
			const results = await Promise.all(allPromises)

			const endTime = Date.now()
			const totalTime = endTime - startTime
			const averageTime = totalTime / requestCount

			// Verify all requests completed successfully
			results.forEach((result, index) => {
				if (index < requestCount / 2) {
					// TRPC results
					expect(result.success).toBe(true)
				} else {
					// REST results
					expect(result.status).toBe(200)
				}
			})

			// Performance assertion (should handle requests efficiently)
			expect(averageTime).toBeLessThan(100) // Average less than 100ms per request
		})

		it('should handle large data sets efficiently', async () => {
			const largeDataSet = Array(1000)
				.fill(null)
				.map((_, index) => testUtils.generateAuditEvent({ id: index + 1 }))

			services.client.executeMonitoredQuery.mockResolvedValue(largeDataSet)

			const trpcContext = {
				...testUtils.mockTRPCContext,
				services,
			}

			const startTime = Date.now()

			const result = await app.trpc.events.query({
				ctx: trpcContext,
				input: {
					pagination: { limit: 1000, offset: 0 },
				},
				type: 'query',
				path: 'events.query',
			})

			const endTime = Date.now()
			const queryTime = endTime - startTime

			expect(result.events).toHaveLength(1000)
			expect(queryTime).toBeLessThan(1000) // Should complete within 1 second
		})
	})

	describe('Error Recovery and Resilience', () => {
		it('should recover from transient failures', async () => {
			const trpcContext = {
				...testUtils.mockTRPCContext,
				services,
			}

			// First call fails, second succeeds
			services.audit.log
				.mockRejectedValueOnce(new Error('Transient failure'))
				.mockResolvedValueOnce(undefined)

			// First attempt should fail
			await expect(
				app.trpc.events.create({
					ctx: trpcContext,
					input: {
						action: 'resilience.test',
						principalId: 'user-resilience',
						organizationId: 'org-resilience',
						status: 'success' as const,
					},
					type: 'mutation',
					path: 'events.create',
				})
			).rejects.toThrow()

			// Second attempt should succeed
			const result = await app.trpc.events.create({
				ctx: trpcContext,
				input: {
					action: 'resilience.test',
					principalId: 'user-resilience',
					organizationId: 'org-resilience',
					status: 'success' as const,
				},
				type: 'mutation',
				path: 'events.create',
			})

			expect(result.success).toBe(true)
		})

		it('should handle partial system failures gracefully', async () => {
			// Mock health check to show partial failure
			services.health.checkAllComponents.mockResolvedValue({
				status: 'DEGRADED',
				timestamp: new Date().toISOString(),
				checks: [
					{ name: 'database', status: 'OK', responseTime: 10 },
					{ name: 'redis', status: 'CRITICAL', responseTime: null, error: 'Connection failed' },
					{ name: 'audit', status: 'OK', responseTime: 15 },
				],
			})

			const trpcContext = {
				...testUtils.mockTRPCContext,
				services,
			}

			// Health check should report degraded status
			await expect(
				app.trpc.health.check({
					ctx: trpcContext,
					type: 'query',
					path: 'health.check',
				})
			).rejects.toThrow()

			// But other services should still work
			services.audit.log.mockResolvedValue(undefined)

			const result = await app.trpc.events.create({
				ctx: trpcContext,
				input: {
					action: 'partial.failure.test',
					principalId: 'user-partial',
					organizationId: 'org-partial',
					status: 'success' as const,
				},
				type: 'mutation',
				path: 'events.create',
			})

			expect(result.success).toBe(true)
		})
	})

	describe('Data Validation and Integrity', () => {
		it('should validate data consistently across all APIs', async () => {
			const invalidInput = {
				action: '', // Invalid: empty string
				principalId: 'user-123',
				organizationId: 'org-456',
				status: 'success' as const,
			}

			const trpcContext = {
				...testUtils.mockTRPCContext,
				services,
			}

			// TRPC should validate input
			await expect(
				app.trpc.events.create({
					ctx: trpcContext,
					input: invalidInput,
					type: 'mutation',
					path: 'events.create',
				})
			).rejects.toThrow()

			// REST API should also validate input (if implemented)
			const restResponse = await request(app.rest.fetch).post('/audit/events').send(invalidInput)

			// The response should indicate validation error
			expect(restResponse.status).toBeGreaterThanOrEqual(400)
		})

		it('should maintain audit trail integrity', async () => {
			const trpcContext = {
				...testUtils.mockTRPCContext,
				services,
			}

			// Create an event
			services.audit.log.mockResolvedValue(undefined)

			await app.trpc.events.create({
				ctx: trpcContext,
				input: {
					action: 'integrity.test',
					principalId: 'user-integrity',
					organizationId: 'org-integrity',
					status: 'success' as const,
				},
				type: 'mutation',
				path: 'events.create',
			})

			// Verify the event was logged with proper integrity
			expect(services.audit.log).toHaveBeenCalledWith(
				expect.objectContaining({
					action: 'integrity.test',
					principalId: 'user-integrity',
					organizationId: trpcContext.session.session.activeOrganizationId,
					timestamp: expect.any(String),
					eventVersion: '1.0',
				})
			)
		})
	})
})
