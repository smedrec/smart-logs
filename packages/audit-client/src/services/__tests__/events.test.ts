import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EventsService } from '../events'

import type { AuditClientConfig } from '../../core/config'
import type {
	AuditEvent,
	BulkCreateResult,
	CreateAuditEventInput,
	ExportEventsParams,
	ExportResult,
	IntegrityVerificationResult,
	PaginatedAuditEvents,
	QueryAuditEventsParams,
	StreamEventsParams,
	SubscriptionParams,
} from '../events'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Helper function to create mock response
const createMockResponse = (data: any, status = 200, ok = true) => ({
	ok,
	status,
	statusText: ok ? 'OK' : 'Error',
	headers: new Headers([['content-type', 'application/json']]),
	json: async () => data,
	text: async () => JSON.stringify(data),
	blob: async () => new Blob([JSON.stringify(data)], { type: 'application/json' }),
})

// Mock WebSocket and EventSource
global.WebSocket = vi.fn().mockImplementation(() => ({
	readyState: 1,
	send: vi.fn(),
	close: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
}))

global.EventSource = vi.fn().mockImplementation(() => ({
	close: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
}))

describe('EventsService', () => {
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
				enabled: false, // Disable retry for tests
				maxAttempts: 1,
				initialDelayMs: 1000,
				maxDelayMs: 10000,
				backoffMultiplier: 2,
				retryableStatusCodes: [429, 500, 502, 503, 504],
				retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
			},
			cache: {
				enabled: false, // Disable cache for tests
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
				enabled: false, // Disable logging for tests
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

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe('create', () => {
		it('should create a single audit event successfully', async () => {
			const mockEvent: CreateAuditEventInput = {
				action: 'user.login',
				targetResourceType: 'User',
				targetResourceId: 'user-123',
				principalId: 'user-123',
				organizationId: 'org-456',
				status: 'success',
				dataClassification: 'INTERNAL',
				outcomeDescription: 'User logged in successfully',
			}

			const mockResponse: AuditEvent = {
				id: 'event-789',
				timestamp: '2023-10-26T10:30:00.000Z',
				...mockEvent,
				hash: 'abc123def456',
			}

			mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse, 201))

			const result = await eventsService.create(mockEvent)

			expect(result).toEqual(mockResponse)
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/v1/audit/events',
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify(mockEvent),
					headers: expect.any(Headers),
				})
			)
		})

		it('should handle validation errors when creating audit events', async () => {
			const invalidEvent = {
				action: '', // Invalid: empty action
				targetResourceType: 'User',
				principalId: 'user-123',
				organizationId: 'org-456',
				status: 'success',
				dataClassification: 'INTERNAL',
			} as CreateAuditEventInput

			const errorResponse = {
				error: 'Validation failed',
				details: { action: 'Action is required' },
			}

			mockFetch.mockResolvedValueOnce(createMockResponse(errorResponse, 400, false))

			await expect(eventsService.create(invalidEvent)).rejects.toThrow()
		})
	})

	describe('subscribe', () => {
		it('should create a real-time event subscription', () => {
			const subscriptionParams: SubscriptionParams = {
				filter: {
					actions: ['user.login', 'user.logout'],
					principalIds: ['user-123'],
				},
				transport: 'websocket',
				reconnect: true,
				maxReconnectAttempts: 5,
			}

			const subscription = eventsService.subscribe(subscriptionParams)

			expect(subscription).toBeDefined()
			expect(subscription.id).toMatch(/^sub_\d+_[a-z0-9]+$/)
			expect(subscription.isConnected).toBe(false)
			expect(typeof subscription.connect).toBe('function')
			expect(typeof subscription.disconnect).toBe('function')
			expect(typeof subscription.on).toBe('function')
			expect(typeof subscription.off).toBe('function')
		})
	})
})
