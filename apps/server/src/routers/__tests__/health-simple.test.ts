/**
 * Simplified TRPC Health Router Tests
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { TRPCError } from '@trpc/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createTRPCCaller, testUtils } from '../../__tests__/setup'
import { healthRouter } from '../health'
import { createTRPCRouter } from '../index'

describe('TRPC Health Router - Simplified Tests', () => {
	let mockContext: any
	let router: any
	let caller: any

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

		// Create a test router with just the health router
		router = createTRPCRouter({
			health: healthRouter,
		})

		// Create a caller for testing
		caller = createTRPCCaller(router, mockContext)
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
			const result = await caller.health.check()

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
			await expect(caller.health.check()).rejects.toThrow(TRPCError)

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
			await expect(caller.health.check()).rejects.toThrow(TRPCError)

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

			// Create caller with unauthenticated context
			const unauthenticatedCaller = createTRPCCaller(router, contextWithoutSession)

			mockContext.services.health.checkAllComponents.mockResolvedValue(mockHealthStatus)

			// Act
			const result = await unauthenticatedCaller.health.check()

			// Assert
			expect(result).toEqual(mockHealthStatus)
		})
	})
})
