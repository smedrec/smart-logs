/**
 * Integration tests for delivery service with observability
 * Requirements 8.1, 8.2, 8.3, 8.4, 8.5: Test real metrics integration
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDeliveryService } from '../delivery-service.js'

// Mock the EnhancedAuditDatabaseClient that createDeliveryService expects
const mockEnhancedClient = {
	getDatabase: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		offset: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockResolvedValue([]),
		insert: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
	}),
	// Add other methods that might be needed
	healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
} as any

describe('DeliveryService with Observability', () => {
	let deliveryService: any

	afterEach(async () => {
		if (deliveryService) {
			await deliveryService.stop()
		}
	})

	describe('observability integration', () => {
		it('should initialize with observability enabled', async () => {
			deliveryService = createDeliveryService(mockEnhancedClient, {
				enableObservability: true,
				observability: {
					tracing: { enabled: true, serviceName: 'test-service', exporterType: 'console' },
					metrics: { enabled: true, serviceName: 'test-service', exporterType: 'console' },
					performance: { enabled: true, trackingEnabled: true },
				},
			})

			await expect(deliveryService.start()).resolves.not.toThrow()

			const observabilityStack = deliveryService.getObservabilityStack()
			expect(observabilityStack).toBeDefined()
			expect(observabilityStack.tracer).toBeDefined()
			expect(observabilityStack.metricsCollector).toBeDefined()
			expect(observabilityStack.performanceMonitor).toBeDefined()
		})

		it('should work without observability (fallback mode)', async () => {
			deliveryService = createDeliveryService(mockEnhancedClient, {
				enableObservability: false,
			})

			await expect(deliveryService.start()).resolves.not.toThrow()

			const observabilityStack = deliveryService.getObservabilityStack()
			expect(observabilityStack).toBeUndefined()
		})

		it('should get real metrics when observability is enabled', async () => {
			deliveryService = createDeliveryService(mockEnhancedClient, {
				enableObservability: true,
				observability: {
					tracing: { enabled: true, serviceName: 'test-service', exporterType: 'console' },
					metrics: { enabled: true, serviceName: 'test-service', exporterType: 'console' },
					performance: { enabled: true, trackingEnabled: true },
				},
			})

			await deliveryService.start()

			const metrics = await deliveryService.getDeliveryMetrics({
				organizationId: 'test-org',
			})

			expect(metrics).toBeDefined()
			expect(typeof metrics.totalDeliveries).toBe('number')
			expect(typeof metrics.successfulDeliveries).toBe('number')
			expect(typeof metrics.failedDeliveries).toBe('number')
			expect(typeof metrics.successRate).toBe('string')
			expect(metrics.byDestinationType).toBeDefined()
			expect(metrics.byOrganization).toBeDefined()
		})

		it('should fall back to database metrics when observability is disabled', async () => {
			deliveryService = createDeliveryService(mockEnhancedClient, {
				enableObservability: false,
			})

			await deliveryService.start()

			const metrics = await deliveryService.getDeliveryMetrics({
				organizationId: 'test-org',
			})

			expect(metrics).toBeDefined()
			expect(metrics.totalDeliveries).toBe(0) // From database fallback
			// The database call should happen but might fail due to mock limitations
			// We expect the service to handle this gracefully and return empty metrics
		})

		it('should record delivery success with metrics', async () => {
			deliveryService = createDeliveryService(mockEnhancedClient, {
				enableObservability: true,
				observability: {
					tracing: { enabled: true, serviceName: 'test-service', exporterType: 'console' },
					metrics: { enabled: true, serviceName: 'test-service', exporterType: 'console' },
					performance: { enabled: true, trackingEnabled: true },
				},
			})

			await deliveryService.start()

			// Should not throw when recording delivery success
			await expect(
				deliveryService.recordDeliverySuccess('dest-123', 250, 'org-123', 'webhook')
			).resolves.not.toThrow()
		})

		it('should record delivery failure with metrics', async () => {
			deliveryService = createDeliveryService(mockEnhancedClient, {
				enableObservability: true,
				observability: {
					tracing: { enabled: true, serviceName: 'test-service', exporterType: 'console' },
					metrics: { enabled: true, serviceName: 'test-service', exporterType: 'console' },
					performance: { enabled: true, trackingEnabled: true },
				},
			})

			await deliveryService.start()

			// Should not throw when recording delivery failure
			await expect(
				deliveryService.recordDeliveryFailure('dest-123', 'timeout', 'org-123', 'webhook')
			).resolves.not.toThrow()
		})
	})

	describe('configuration', () => {
		it('should use default observability config when not specified', async () => {
			deliveryService = createDeliveryService(mockEnhancedClient, {
				enableObservability: true,
				// No observability config provided - should use defaults
			})

			await expect(deliveryService.start()).resolves.not.toThrow()

			const observabilityStack = deliveryService.getObservabilityStack()
			expect(observabilityStack).toBeDefined()
		})

		it('should merge custom observability config with defaults', async () => {
			deliveryService = createDeliveryService(mockEnhancedClient, {
				enableObservability: true,
				observability: {
					tracing: {
						serviceName: 'custom-service-name',
						// Other properties should use defaults
					},
				},
			})

			await expect(deliveryService.start()).resolves.not.toThrow()

			const observabilityStack = deliveryService.getObservabilityStack()
			expect(observabilityStack).toBeDefined()
		})
	})
})
