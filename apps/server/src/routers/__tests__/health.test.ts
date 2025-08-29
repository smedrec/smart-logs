/**
 * TRPC Health Router Unit Tests
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { TRPCError } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { testUtils } from '../../__tests__/setup'
import { healthRouter } from '../health'

describe('TRPC Health Router', () => {
	let mockContext: any

	beforeEach(() => {
		mockContext = {
			...testUtils.mockTRPCContext,
			services: {
				...testUtils.mockServices,
				health: {
					checkAllComponents: vi.fn(),
				},
			},
		}
	})

	describe('check procedure', () => {
		it('should return healthy status when all components are OK', async () => {
			// Arrange
			const mockHealthStatus = {
				status: 'OK',
				timestamp: new Date().toISOString(),
				components: {
					database: { status: 'OK', responseTime: 10 },
					redis: { status: 'OK', responseTime: 5 },
					audit: { status: 'OK', responseTime: 15 },
				},
			}

			mockContext.services.health.checkAllComponents.mockResolvedValue(mockHealthStatus)

			// Act
			const result = await healthRouter.check({
				ctx: mockContext,
				type: 'query',
				path: 'health.check',
			})

			// Assert
			expect(result).toEqual(mockHealthStatus)
			expect(mockContext.services.health.checkAllComponents).toHaveBeenCalledOnce()
		})

		it('should handle degraded health status', async () => {
			// Arrange
			const mockHealthStatus = {
				status: 'DEGRADED',
				timestamp: new Date().toISOString(),
				components: {
					database: { status: 'OK', responseTime: 10 },
					redis: { status: 'DEGRADED', responseTime: 500 },
					audit: { status: 'OK', responseTime: 15 },
				},
			}

			mockContext.services.health.checkAllComponents.mockResolvedValue(mockHealthStatus)

			// Act & Assert
			await expect(
				healthRouter.check({
					ctx: mockContext,
					type: 'query',
					path: 'health.check',
				})
			).rejects.toThrow(TRPCError)

			expect(mockContext.services.logger.warn).toHaveBeenCalledWith(
				'Health check failed with status: DEGRADED'
			)
			expect(mockContext.services.error.handleError).toHaveBeenCalledWith(
				expect.any(TRPCError),
				expect.objectContaining({
					requestId: mockContext.requestId,
					metadata: expect.objectContaining({
						code: 'SERVICE_UNAVAILABLE',
						details: mockHealthStatus,
					}),
				}),
				'trpc-api',
				'processhealthCheck'
			)
		})

		it('should handle health check service errors', async () => {
			// Arrange
			const healthError = new Error('Health service unavailable')
			mockContext.services.health.checkAllComponents.mockRejectedValue(healthError)

			// Act & Assert
			await expect(
				healthRouter.check({
					ctx: mockContext,
					type: 'query',
					path: 'health.check',
				})
			).rejects.toThrow(TRPCError)

			expect(mockContext.services.logger.error).toHaveBeenCalledWith(
				'Health check failed with error:'
			)
			expect(mockContext.services.error.handleError).toHaveBeenCalledWith(
				expect.any(TRPCError),
				expect.objectContaining({
					requestId: mockContext.requestId,
					metadata: expect.objectContaining({
						code: 'INTERNAL_SERVER_ERROR',
						cause: 'No session',
					}),
				}),
				'trpc-api',
				'processhealthCheck'
			)
		})

		it('should handle critical health status', async () => {
			// Arrange
			const mockHealthStatus = {
				status: 'CRITICAL',
				timestamp: new Date().toISOString(),
				components: {
					database: { status: 'CRITICAL', responseTime: null, error: 'Connection failed' },
					redis: { status: 'OK', responseTime: 5 },
					audit: { status: 'DEGRADED', responseTime: 1000 },
				},
			}

			mockContext.services.health.checkAllComponents.mockResolvedValue(mockHealthStatus)

			// Act & Assert
			await expect(
				healthRouter.check({
					ctx: mockContext,
					type: 'query',
					path: 'health.check',
				})
			).rejects.toThrow(TRPCError)

			expect(mockContext.services.logger.warn).toHaveBeenCalledWith(
				'Health check failed with status: CRITICAL'
			)
		})

		it('should be accessible without authentication (public procedure)', async () => {
			// Arrange
			const mockHealthStatus = {
				status: 'OK',
				timestamp: new Date().toISOString(),
				components: {},
			}

			const contextWithoutSession = {
				...mockContext,
				session: null,
			}

			mockContext.services.health.checkAllComponents.mockResolvedValue(mockHealthStatus)

			// Act
			const result = await healthRouter.check({
				ctx: contextWithoutSession,
				type: 'query',
				path: 'health.check',
			})

			// Assert
			expect(result).toEqual(mockHealthStatus)
		})

		it('should include component details in healthy response', async () => {
			// Arrange
			const mockHealthStatus = {
				status: 'OK',
				timestamp: new Date().toISOString(),
				components: {
					database: {
						status: 'OK',
						responseTime: 12,
						connectionCount: 5,
						activeQueries: 2,
					},
					redis: {
						status: 'OK',
						responseTime: 3,
						memoryUsage: 1024000,
						keyCount: 150,
					},
					audit: {
						status: 'OK',
						responseTime: 8,
						queueDepth: 0,
						processingLatency: 25,
					},
				},
			}

			mockContext.services.health.checkAllComponents.mockResolvedValue(mockHealthStatus)

			// Act
			const result = await healthRouter.check({
				ctx: mockContext,
				type: 'query',
				path: 'health.check',
			})

			// Assert
			expect(result.components.database).toEqual(
				expect.objectContaining({
					status: 'OK',
					responseTime: 12,
					connectionCount: 5,
					activeQueries: 2,
				})
			)
			expect(result.components.redis).toEqual(
				expect.objectContaining({
					status: 'OK',
					responseTime: 3,
					memoryUsage: 1024000,
					keyCount: 150,
				})
			)
			expect(result.components.audit).toEqual(
				expect.objectContaining({
					status: 'OK',
					responseTime: 8,
					queueDepth: 0,
					processingLatency: 25,
				})
			)
		})
	})
})
