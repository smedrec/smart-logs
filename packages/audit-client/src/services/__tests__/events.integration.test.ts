import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EventsService } from '../events'

import type { AuditClientConfig } from '../../core/config'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('EventsService Integration', () => {
	let eventsService: EventsService
	let mockConfig: AuditClientConfig

	beforeEach(() => {
		mockConfig = {
			baseUrl: 'https://api.example.com',
			apiVersion: 'v1',
			timeout: 30000,
			authentication: {
				type: 'apiKey',
				apiKey: 'test-api-key',
			},
			retry: {
				enabled: false,
				maxAttempts: 1,
				initialDelayMs: 1000,
				maxDelayMs: 10000,
				backoffMultiplier: 2,
				retryableStatusCodes: [429, 500, 502, 503, 504],
				retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
			},
			cache: {
				enabled: false,
				defaultTtlMs: 300000,
				maxSize: 100,
				storage: 'memory',
				keyPrefix: 'audit-client',
				compressionEnabled: false,
			},
			batching: {
				enabled: false,
				maxBatchSize: 10,
				batchTimeoutMs: 1000,
				batchableEndpoints: [],
			},
			performance: {
				enableCompression: true,
				enableStreaming: true,
				maxConcurrentRequests: 10,
				requestDeduplication: true,
				responseTransformation: true,
			},
			logging: {
				enabled: false,
				level: 'info',
				includeRequestBody: false,
				includeResponseBody: false,
				maskSensitiveData: true,
			},
			errorHandling: {
				throwOnError: true,
				includeStackTrace: false,
				errorTransformation: true,
			},
			environment: 'development',
			customHeaders: {},
			interceptors: {
				request: [],
				response: [],
			},
		}

		eventsService = new EventsService(mockConfig)
		vi.clearAllMocks()
	})

	it('should instantiate EventsService correctly', () => {
		expect(eventsService).toBeInstanceOf(EventsService)
		expect(typeof eventsService.create).toBe('function')
		expect(typeof eventsService.bulkCreate).toBe('function')
		expect(typeof eventsService.query).toBe('function')
		expect(typeof eventsService.getById).toBe('function')
		expect(typeof eventsService.verify).toBe('function')
		expect(typeof eventsService.export).toBe('function')
		expect(typeof eventsService.stream).toBe('function')
		expect(typeof eventsService.subscribe).toBe('function')
	})

	it('should create a subscription with correct interface', () => {
		const subscription = eventsService.subscribe({
			filter: {
				actions: ['user.login'],
			},
			transport: 'websocket',
		})

		expect(subscription).toBeDefined()
		expect(subscription.id).toMatch(/^sub_\d+_[a-z0-9]+$/)
		expect(subscription.isConnected).toBe(false)
		expect(typeof subscription.connect).toBe('function')
		expect(typeof subscription.disconnect).toBe('function')
		expect(typeof subscription.on).toBe('function')
		expect(typeof subscription.off).toBe('function')
		expect(typeof subscription.updateFilter).toBe('function')
	})

	it('should have all required methods for comprehensive audit event management', () => {
		// Verify all methods from requirements 4.1-4.5 are implemented
		const requiredMethods = [
			'create', // 4.1 - creating audit events
			'bulkCreate', // 4.1 - creating audit events (bulk)
			'query', // 4.2 - querying with filtering, pagination, sorting
			'getById', // 4.3 - retrieving specific events by ID
			'verify', // 4.4 - cryptographic verification
			'export', // 4.5 - handling large result sets
			'stream', // 4.5 - streaming responses
			'subscribe', // 4.5 - real-time capabilities
		]

		requiredMethods.forEach((method) => {
			expect(typeof (eventsService as any)[method]).toBe('function')
		})
	})
})
