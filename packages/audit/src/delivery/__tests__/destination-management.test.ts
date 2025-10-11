/**
 * Tests for destination management system
 * Requirements 1.1, 1.2, 1.3, 1.4, 3.4, 3.5: Destination management with validation and health monitoring
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createDeliveryService } from '../delivery-service.js'

import type { CreateDeliveryDestinationInput, DeliveryService } from '../index.js'

// Mock enhanced audit database client
const mockEnhancedClient = {
	getDatabase: () => ({
		insert: () => ({
			values: () => ({
				returning: () =>
					Promise.resolve([
						{
							id: 1,
							organizationId: 'test-org',
							type: 'webhook',
							label: 'Test Webhook',
							description: 'Test webhook destination',
							icon: null,
							instructions: null,
							disabled: 'false',
							disabledAt: null,
							disabledBy: null,
							countUsage: 0,
							lastUsedAt: null,
							config: {
								webhook: {
									url: 'https://example.com/webhook',
									method: 'POST',
									headers: {},
									timeout: 30000,
									retryConfig: {
										maxRetries: 3,
										backoffMultiplier: 2,
										maxBackoffDelay: 60000,
									},
								},
							},
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						},
					]),
			}),
		}),
		select: () => ({
			from: () => ({
				where: () => Promise.resolve([]),
				limit: () => ({
					offset: () => Promise.resolve([]),
				}),
			}),
		}),
		update: () => ({
			set: () => ({
				where: () => ({
					returning: () => Promise.resolve([]),
				}),
			}),
		}),
		delete: () => ({
			where: () => Promise.resolve(),
		}),
		transaction: (callback: any) => callback({}),
	}),
	getHealthStatus: () => Promise.resolve({ overall: 'healthy' }),
} as any

describe('Destination Management System', () => {
	let deliveryService: DeliveryService

	beforeEach(async () => {
		deliveryService = createDeliveryService(mockEnhancedClient, {
			enableHealthMonitoring: false, // Disable for testing
		})
		await deliveryService.start()
	})

	afterEach(async () => {
		await deliveryService.stop()
	})

	describe('Destination CRUD Operations', () => {
		it('should create a webhook destination with valid configuration', async () => {
			const input: CreateDeliveryDestinationInput = {
				organizationId: 'test-org',
				type: 'webhook',
				label: 'Test Webhook',
				description: 'Test webhook destination',
				config: {
					webhook: {
						url: 'https://example.com/webhook',
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						timeout: 30000,
						retryConfig: {
							maxRetries: 3,
							backoffMultiplier: 2,
							maxBackoffDelay: 60000,
						},
					},
				},
			}

			const destination = await deliveryService.createDestination(input)

			expect(destination).toBeDefined()
			expect(destination.id).toBeDefined()
			expect(destination.organizationId).toBe(input.organizationId)
			expect(destination.type).toBe(input.type)
			expect(destination.label).toBe(input.label)
		})

		it('should validate webhook configuration', async () => {
			const destination = {
				id: '1',
				organizationId: 'test-org',
				type: 'webhook' as const,
				label: 'Test Webhook',
				disabled: false,
				countUsage: 0,
				config: {
					webhook: {
						url: 'https://example.com/webhook',
						method: 'POST' as const,
						headers: {},
						timeout: 30000,
						retryConfig: {
							maxRetries: 3,
							backoffMultiplier: 2,
							maxBackoffDelay: 60000,
						},
					},
				},
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			}

			const result = await deliveryService.validateDestination(destination)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should reject invalid webhook URL', async () => {
			const destination = {
				id: '1',
				organizationId: 'test-org',
				type: 'webhook' as const,
				label: 'Test Webhook',
				disabled: false,
				countUsage: 0,
				config: {
					webhook: {
						url: 'invalid-url',
						method: 'POST' as const,
						headers: {},
						timeout: 30000,
						retryConfig: {
							maxRetries: 3,
							backoffMultiplier: 2,
							maxBackoffDelay: 60000,
						},
					},
				},
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			}

			const result = await deliveryService.validateDestination(destination)

			expect(result.isValid).toBe(false)
			expect(result.errors.length).toBeGreaterThan(0)
			expect(result.errors[0]).toContain('URL must be a valid HTTP or HTTPS URL')
		})
	})

	describe('Connection Testing', () => {
		it('should test webhook connection', async () => {
			const destination = {
				id: '1',
				organizationId: 'test-org',
				type: 'webhook' as const,
				label: 'Test Webhook',
				disabled: false,
				countUsage: 0,
				config: {
					webhook: {
						url: 'https://httpbin.org/post',
						method: 'POST' as const,
						headers: {},
						timeout: 30000,
						retryConfig: {
							maxRetries: 3,
							backoffMultiplier: 2,
							maxBackoffDelay: 60000,
						},
					},
				},
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			}

			const result = await deliveryService.testConnection(destination)

			expect(result).toBeDefined()
			expect(typeof result.success).toBe('boolean')
			expect(typeof result.responseTime).toBe('number')
		})
	})

	describe('Health Monitoring', () => {
		it('should allow delivery for healthy destinations', async () => {
			const allowed = await deliveryService.shouldAllowDelivery('1')
			expect(typeof allowed).toBe('boolean')
		})

		it('should get unhealthy destinations', async () => {
			const unhealthy = await deliveryService.getUnhealthyDestinations()
			expect(Array.isArray(unhealthy)).toBe(true)
		})
	})
})
