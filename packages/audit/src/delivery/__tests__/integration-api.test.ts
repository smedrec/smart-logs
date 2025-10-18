/**
 * Integration API Unit Tests
 * Requirements 1.1, 2.1, 2.4, 6.1, 6.2, 6.3, 6.4: API integration testing
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAPIRequestContext, createDeliveryAPI, DeliveryAPIError } from '../api.js'
import { createConfigurationManager } from '../config.js'
import { createDeliveryServiceFactory } from '../factory.js'

import type { DeliveryAPI } from '../api.js'
import type { DeliveryService } from '../delivery-service.js'
import type { DeliveryServiceContainer } from '../factory.js'
import type {
	CreateDeliveryDestinationInput,
	DeliveryDestination,
	DeliveryRequest,
	DeliveryResponse,
} from '../types.js'

// Mock the enhanced audit database client
const mockEnhancedClient = {
	healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
	// Add other required methods as needed
} as any

describe('DeliveryAPI', () => {
	let deliveryService: DeliveryService
	let deliveryAPI: DeliveryAPI
	let container: DeliveryServiceContainer

	const testOrgId = 'test-org-123'
	const testContext = createAPIRequestContext(testOrgId, {
		requestId: 'test-req-123',
		userId: 'test-user-123',
	})

	beforeEach(async () => {
		// Create delivery service container
		const factory = createDeliveryServiceFactory({
			enableHealthMonitoring: false,
			enableObservability: false,
			enableAlerting: false,
			enableScheduler: false,
		})

		container = await factory.createContainer(mockEnhancedClient)
		deliveryService = container.deliveryService
		deliveryAPI = createDeliveryAPI(deliveryService)

		// Mock delivery service methods
		vi.spyOn(deliveryService, 'createDestination').mockImplementation(async (input) => ({
			id: 'dest-123',
			organizationId: input.organizationId,
			type: input.type,
			label: input.label,
			config: input.config,
			disabled: false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			lastUsedAt: null,
			usageCount: 0,
		}))

		vi.spyOn(deliveryService, 'getDestination').mockImplementation(async (id) => {
			if (id === 'dest-123') {
				return {
					id: 'dest-123',
					organizationId: testOrgId,
					type: 'webhook',
					label: 'Test Webhook',
					config: { url: 'https://example.com/webhook' },
					disabled: false,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					lastUsedAt: null,
					usageCount: 0,
				}
			}
			return null
		})

		vi.spyOn(deliveryService, 'listDestinations').mockResolvedValue({
			deliveryDestinations: [],
			totalCount: 0,
			hasMore: false,
		})

		vi.spyOn(deliveryService, 'deliver').mockImplementation(async (request) => ({
			deliveryId: 'del-123',
			status: 'queued',
			destinations:
				request.destinations === 'default'
					? []
					: (request.destinations as string[]).map((id) => ({
							destinationId: id,
							status: 'pending' as const,
						})),
			queuedAt: new Date().toISOString(),
		}))

		vi.spyOn(deliveryService, 'healthCheck').mockResolvedValue({
			healthy: true,
			details: { status: 'ok' },
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe('Destination Management', () => {
		describe('createDestination', () => {
			it('should create a destination successfully', async () => {
				const input: CreateDeliveryDestinationInput = {
					organizationId: testOrgId,
					type: 'webhook',
					label: 'Test Webhook',
					config: { url: 'https://example.com/webhook' },
				}

				const response = await deliveryAPI.createDestination(input, testContext)

				expect(response.success).toBe(true)
				expect(response.data).toBeDefined()
				expect(response.data?.id).toBe('dest-123')
				expect(response.data?.organizationId).toBe(testOrgId)
				expect(response.metadata?.requestId).toBe(testContext.requestId)
				expect(deliveryService.createDestination).toHaveBeenCalledWith(input)
			})

			it('should validate required fields', async () => {
				const input = {
					organizationId: '',
					type: 'webhook',
					label: 'Test Webhook',
					config: { url: 'https://example.com/webhook' },
				} as CreateDeliveryDestinationInput

				const response = await deliveryAPI.createDestination(input, testContext)

				expect(response.success).toBe(false)
				expect(response.error?.code).toBe('MISSING_ORGANIZATION_ID')
				expect(deliveryService.createDestination).not.toHaveBeenCalled()
			})

			it('should validate organization access', async () => {
				const input: CreateDeliveryDestinationInput = {
					organizationId: 'different-org',
					type: 'webhook',
					label: 'Test Webhook',
					config: { url: 'https://example.com/webhook' },
				}

				const response = await deliveryAPI.createDestination(input, testContext)

				expect(response.success).toBe(false)
				expect(response.error?.code).toBe('ORGANIZATION_ACCESS_DENIED')
				expect(deliveryService.createDestination).not.toHaveBeenCalled()
			})

			it('should handle service errors', async () => {
				const input: CreateDeliveryDestinationInput = {
					organizationId: testOrgId,
					type: 'webhook',
					label: 'Test Webhook',
					config: { url: 'https://example.com/webhook' },
				}

				vi.spyOn(deliveryService, 'createDestination').mockRejectedValue(
					new Error('Database connection failed')
				)

				const response = await deliveryAPI.createDestination(input, testContext)

				expect(response.success).toBe(false)
				expect(response.error?.message).toBe('Database connection failed')
			})
		})

		describe('getDestination', () => {
			it('should get a destination successfully', async () => {
				const response = await deliveryAPI.getDestination('dest-123', testContext)

				expect(response.success).toBe(true)
				expect(response.data?.id).toBe('dest-123')
				expect(response.data?.organizationId).toBe(testOrgId)
				expect(deliveryService.getDestination).toHaveBeenCalledWith('dest-123')
			})

			it('should return 404 for non-existent destination', async () => {
				const response = await deliveryAPI.getDestination('non-existent', testContext)

				expect(response.success).toBe(false)
				expect(response.error?.code).toBe('DESTINATION_NOT_FOUND')
			})

			it('should validate destination ID', async () => {
				const response = await deliveryAPI.getDestination('', testContext)

				expect(response.success).toBe(false)
				expect(response.error?.code).toBe('INVALID_DESTINATION_ID')
			})

			it('should validate organization access', async () => {
				vi.spyOn(deliveryService, 'getDestination').mockResolvedValue({
					id: 'dest-123',
					organizationId: 'different-org',
					type: 'webhook',
					label: 'Test Webhook',
					config: { url: 'https://example.com/webhook' },
					disabled: false,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					lastUsedAt: null,
					usageCount: 0,
				})

				const response = await deliveryAPI.getDestination('dest-123', testContext)

				expect(response.success).toBe(false)
				expect(response.error?.code).toBe('ORGANIZATION_ACCESS_DENIED')
			})
		})

		describe('listDestinations', () => {
			it('should list destinations with organization filtering', async () => {
				const options = {
					limit: 10,
					offset: 0,
				}

				const response = await deliveryAPI.listDestinations(options, testContext)

				expect(response.success).toBe(true)
				expect(response.data).toBeDefined()
				expect(deliveryService.listDestinations).toHaveBeenCalledWith({
					...options,
					filters: {
						organizationId: testOrgId,
					},
				})
			})

			it('should preserve existing filters while adding organization filter', async () => {
				const options = {
					filters: {
						type: 'webhook',
						disabled: false,
					},
					limit: 10,
				}

				const response = await deliveryAPI.listDestinations(options, testContext)

				expect(response.success).toBe(true)
				expect(deliveryService.listDestinations).toHaveBeenCalledWith({
					...options,
					filters: {
						type: 'webhook',
						disabled: false,
						organizationId: testOrgId,
					},
				})
			})
		})
	})

	describe('Delivery Operations', () => {
		describe('deliver', () => {
			it('should submit a delivery request successfully', async () => {
				const request: DeliveryRequest = {
					organizationId: testOrgId,
					destinations: ['dest-123'],
					payload: {
						type: 'report',
						data: { message: 'test' },
						metadata: {},
					},
				}

				const response = await deliveryAPI.deliver(request, testContext)

				expect(response.success).toBe(true)
				expect(response.data?.deliveryId).toBe('del-123')
				expect(response.data?.status).toBe('queued')
				expect(deliveryService.deliver).toHaveBeenCalledWith(request)
			})

			it('should validate delivery request', async () => {
				const request = {
					organizationId: '',
					destinations: ['dest-123'],
					payload: {
						type: 'report',
						data: { message: 'test' },
						metadata: {},
					},
				} as DeliveryRequest

				const response = await deliveryAPI.deliver(request, testContext)

				expect(response.success).toBe(false)
				expect(response.error?.code).toBe('MISSING_ORGANIZATION_ID')
				expect(deliveryService.deliver).not.toHaveBeenCalled()
			})

			it('should validate organization access', async () => {
				const request: DeliveryRequest = {
					organizationId: 'different-org',
					destinations: ['dest-123'],
					payload: {
						type: 'report',
						data: { message: 'test' },
						metadata: {},
					},
				}

				const response = await deliveryAPI.deliver(request, testContext)

				expect(response.success).toBe(false)
				expect(response.error?.code).toBe('ORGANIZATION_ACCESS_DENIED')
				expect(deliveryService.deliver).not.toHaveBeenCalled()
			})

			it('should validate payload size', async () => {
				const largeData = 'x'.repeat(11 * 1024 * 1024) // 11MB
				const request: DeliveryRequest = {
					organizationId: testOrgId,
					destinations: ['dest-123'],
					payload: {
						type: 'report',
						data: { message: largeData },
						metadata: {},
					},
				}

				const response = await deliveryAPI.deliver(request, testContext)

				expect(response.success).toBe(false)
				expect(response.error?.code).toBe('PAYLOAD_TOO_LARGE')
				expect(deliveryService.deliver).not.toHaveBeenCalled()
			})

			it('should validate priority range', async () => {
				const request: DeliveryRequest = {
					organizationId: testOrgId,
					destinations: ['dest-123'],
					payload: {
						type: 'report',
						data: { message: 'test' },
						metadata: {},
					},
					options: {
						priority: 15, // Invalid priority
					},
				}

				const response = await deliveryAPI.deliver(request, testContext)

				expect(response.success).toBe(false)
				expect(response.error?.code).toBe('INVALID_PRIORITY')
				expect(deliveryService.deliver).not.toHaveBeenCalled()
			})
		})

		describe('getDeliveryStatus', () => {
			it('should get delivery status successfully', async () => {
				vi.spyOn(deliveryService, 'getDeliveryStatus').mockResolvedValue({
					deliveryId: 'del-123',
					status: 'completed',
					destinations: [
						{
							destinationId: 'dest-123',
							status: 'delivered',
							attempts: 1,
							deliveredAt: new Date().toISOString(),
						},
					],
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					metadata: {},
				})

				const response = await deliveryAPI.getDeliveryStatus('del-123', testContext)

				expect(response.success).toBe(true)
				expect(response.data?.deliveryId).toBe('del-123')
				expect(response.data?.status).toBe('completed')
				expect(deliveryService.getDeliveryStatus).toHaveBeenCalledWith('del-123')
			})

			it('should validate delivery ID', async () => {
				const response = await deliveryAPI.getDeliveryStatus('', testContext)

				expect(response.success).toBe(false)
				expect(response.error?.code).toBe('INVALID_DELIVERY_ID')
			})
		})
	})

	describe('Health and Monitoring', () => {
		describe('getHealthStatus', () => {
			it('should return health status', async () => {
				const response = await deliveryAPI.getHealthStatus(testContext)

				expect(response.success).toBe(true)
				expect(response.data?.status).toBe('ok')
				expect(response.data?.api?.version).toBeDefined()
				expect(deliveryService.healthCheck).toHaveBeenCalled()
			})
		})

		describe('getDeliveryMetrics', () => {
			it('should get metrics with organization filtering', async () => {
				vi.spyOn(deliveryService, 'getDeliveryMetrics').mockResolvedValue({
					totalDeliveries: 100,
					successfulDeliveries: 95,
					failedDeliveries: 5,
					successRate: '95.00',
					averageDeliveryTime: 2500,
					byDestinationType: {},
					byOrganization: {},
					timeRange: {
						start: new Date().toISOString(),
						end: new Date().toISOString(),
					},
				})

				const options = {
					startDate: '2023-01-01T00:00:00Z',
					endDate: '2023-01-31T23:59:59Z',
				}

				const response = await deliveryAPI.getDeliveryMetrics(options, testContext)

				expect(response.success).toBe(true)
				expect(response.data?.totalDeliveries).toBe(100)
				expect(deliveryService.getDeliveryMetrics).toHaveBeenCalledWith({
					...options,
					organizationId: testOrgId,
				})
			})
		})
	})

	describe('Error Handling', () => {
		it('should handle DeliveryAPIError correctly', async () => {
			const apiError = new DeliveryAPIError('Custom API error', 422, 'CUSTOM_ERROR')
			vi.spyOn(deliveryService, 'createDestination').mockRejectedValue(apiError)

			const input: CreateDeliveryDestinationInput = {
				organizationId: testOrgId,
				type: 'webhook',
				label: 'Test Webhook',
				config: { url: 'https://example.com/webhook' },
			}

			const response = await deliveryAPI.createDestination(input, testContext)

			expect(response.success).toBe(false)
			expect(response.error?.code).toBe('CUSTOM_ERROR')
			expect(response.error?.message).toBe('Custom API error')
		})

		it('should handle generic errors', async () => {
			vi.spyOn(deliveryService, 'createDestination').mockRejectedValue(new Error('Generic error'))

			const input: CreateDeliveryDestinationInput = {
				organizationId: testOrgId,
				type: 'webhook',
				label: 'Test Webhook',
				config: { url: 'https://example.com/webhook' },
			}

			const response = await deliveryAPI.createDestination(input, testContext)

			expect(response.success).toBe(false)
			expect(response.error?.message).toBe('Generic error')
		})

		it('should map common error patterns to appropriate status codes', async () => {
			vi.spyOn(deliveryService, 'getDestination').mockRejectedValue(
				new Error('Destination not found')
			)

			const response = await deliveryAPI.getDestination('dest-123', testContext)

			expect(response.success).toBe(false)
			expect(response.error?.code).toBe('NOT_FOUND')
		})
	})

	describe('Request Context', () => {
		it('should include request metadata in responses', async () => {
			const response = await deliveryAPI.getHealthStatus(testContext)

			expect(response.metadata?.requestId).toBe(testContext.requestId)
			expect(response.metadata?.timestamp).toBe(testContext.timestamp)
			expect(response.metadata?.version).toBeDefined()
		})

		it('should generate request context with defaults', () => {
			const context = createAPIRequestContext('org-123')

			expect(context.organizationId).toBe('org-123')
			expect(context.requestId).toMatch(/^req_/)
			expect(context.timestamp).toBeDefined()
		})

		it('should accept custom request context options', () => {
			const context = createAPIRequestContext('org-123', {
				requestId: 'custom-req-id',
				userId: 'user-123',
				userAgent: 'Test Agent',
				ipAddress: '127.0.0.1',
			})

			expect(context.requestId).toBe('custom-req-id')
			expect(context.userId).toBe('user-123')
			expect(context.userAgent).toBe('Test Agent')
			expect(context.ipAddress).toBe('127.0.0.1')
		})
	})
})

describe('Service Factory Integration', () => {
	let factory: any
	let container: DeliveryServiceContainer

	beforeEach(() => {
		factory = createDeliveryServiceFactory({
			enableHealthMonitoring: true,
			enableObservability: false,
			enableAlerting: false,
			enableScheduler: false,
		})
	})

	afterEach(async () => {
		if (container) {
			await container.stop()
		}
	})

	describe('Container Creation', () => {
		it('should create container with all components', async () => {
			container = await factory.createContainer(mockEnhancedClient)

			expect(container.deliveryService).toBeDefined()
			expect(container.destinationManager).toBeDefined()
			expect(container.deliveryScheduler).toBeDefined()
			expect(container.retryManager).toBeDefined()
			expect(container.circuitBreaker).toBeDefined()
			expect(container.api).toBeDefined()
		})

		it('should validate factory configuration', () => {
			const invalidFactory = createDeliveryServiceFactory({
				environment: 'invalid' as any,
			})

			const validation = invalidFactory.validateConfig()
			expect(validation.valid).toBe(false)
			expect(validation.errors).toContain(
				'Invalid environment. Must be development, staging, or production'
			)
		})
	})

	describe('Container Lifecycle', () => {
		it('should start and stop container successfully', async () => {
			container = await factory.createContainer(mockEnhancedClient)

			await container.start()
			expect(container.getStatus().status).toBe('running')

			await container.stop()
			expect(container.getStatus().status).toBe('stopped')
		})

		it('should perform health checks', async () => {
			container = await factory.createContainer(mockEnhancedClient)
			await container.start()

			const health = await container.healthCheck()
			expect(health.healthy).toBe(true)
			expect(health.details).toBeDefined()
		})

		it('should provide service status', async () => {
			container = await factory.createContainer(mockEnhancedClient)
			await container.start()

			const status = container.getStatus()
			expect(status.status).toBe('running')
			expect(status.startedAt).toBeDefined()
			expect(status.components).toBeDefined()
			expect(status.version).toBeDefined()
		})
	})
})

describe('Configuration Management Integration', () => {
	describe('Configuration Loading', () => {
		it('should load default configuration', () => {
			const configManager = createConfigurationManager('development')
			const config = configManager.getConfig()

			expect(config.environment).toBe('development')
			expect(config.logLevel).toBe('debug') // Development override
			expect(config.service.name).toBe('delivery-service')
		})

		it('should apply environment-specific overrides', () => {
			const prodConfigManager = createConfigurationManager('production')
			const prodConfig = prodConfigManager.getConfig()

			expect(prodConfig.environment).toBe('production')
			expect(prodConfig.logLevel).toBe('warn')
			expect(prodConfig.database.ssl).toBe(true)
		})

		it('should validate configuration', () => {
			const configManager = createConfigurationManager('development')
			const config = configManager.getConfig()

			const validation = configManager.validateConfig(config)
			expect(validation.valid).toBe(true)
		})

		it('should convert to factory configuration', () => {
			const configManager = createConfigurationManager('development')
			const factoryConfig = configManager.toFactoryConfig()

			expect(factoryConfig.environment).toBe('development')
			expect(factoryConfig.enableHealthMonitoring).toBe(true)
			expect(factoryConfig.enableObservability).toBe(true)
		})
	})

	describe('Configuration Updates', () => {
		it('should update configuration at runtime', () => {
			const configManager = createConfigurationManager('development')

			configManager.updateConfig({
				logLevel: 'error',
				queue: {
					maxConcurrentDeliveries: 20,
					processingInterval: 10000,
					cleanupInterval: 600000,
					maxCompletedAge: 172800000,
					enableMetrics: false,
				},
			})

			const config = configManager.getConfig()
			expect(config.logLevel).toBe('error')
			expect(config.queue.maxConcurrentDeliveries).toBe(20)
		})

		it('should validate configuration updates', () => {
			const configManager = createConfigurationManager('development')

			expect(() => {
				configManager.updateConfig({
					delivery: {
						defaultPriority: 15, // Invalid priority
						maxPayloadSize: 10485760,
						maxDestinations: 50,
						enableFanout: true,
						enableIdempotency: true,
					},
				})
			}).toThrow('Configuration validation failed')
		})

		it('should watch for configuration changes', () => {
			const configManager = createConfigurationManager('development')
			let watcherCalled = false
			let receivedConfig: any

			const unwatch = configManager.watch((config) => {
				watcherCalled = true
				receivedConfig = config
			})

			configManager.updateConfig({ logLevel: 'error' })

			expect(watcherCalled).toBe(true)
			expect(receivedConfig.logLevel).toBe('error')

			unwatch()
		})
	})
})
