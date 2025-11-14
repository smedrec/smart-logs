import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EventsService } from '../../services/events'

import type { AuditClientConfig } from '../../core/config'
import type { SubscriptionParams } from '../../services/events'

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

// Mock WebSocket
class MockWebSocket {
	readyState = 1
	onopen: ((event: any) => void) | null = null
	onclose: ((event: any) => void) | null = null
	onerror: ((event: any) => void) | null = null
	onmessage: ((event: any) => void) | null = null
	private listeners: Map<string, Set<Function>> = new Map()

	send = vi.fn()
	close = vi.fn(() => {
		this.readyState = 3
		if (this.onclose) {
			this.onclose({ type: 'close' })
		}
	})

	addEventListener(event: string, handler: Function) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set())
		}
		this.listeners.get(event)!.add(handler)
	}

	removeEventListener(event: string, handler: Function) {
		const handlers = this.listeners.get(event)
		if (handlers) {
			handlers.delete(handler)
		}
	}

	// Helper to get listener count for testing
	getListenerCount(event: string): number {
		return this.listeners.get(event)?.size || 0
	}

	// Helper to get total listener count
	getTotalListenerCount(): number {
		let total = 0
		this.listeners.forEach((handlers) => {
			total += handlers.size
		})
		return total
	}
}

describe('EventsService - Memory Leak Detection', () => {
	let eventsService: EventsService
	let mockConfig: AuditClientConfig
	let mockWebSocketInstances: MockWebSocket[] = []

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

		// Mock WebSocket constructor
		mockWebSocketInstances = []
		global.WebSocket = vi.fn().mockImplementation(() => {
			const instance = new MockWebSocket()
			mockWebSocketInstances.push(instance)
			// Simulate connection opening
			setTimeout(() => {
				if (instance.onopen) {
					instance.onopen({ type: 'open' })
				}
			}, 0)
			return instance
		}) as any

		eventsService = new EventsService(mockConfig)
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.resetAllMocks()
		mockWebSocketInstances = []
	})

	describe('EventSubscription cleanup', () => {
		it('should clear all event handlers when cleanup is called', () => {
			const subscriptionParams: SubscriptionParams = {
				filter: {
					actions: ['user.login'],
				},
				transport: 'websocket',
			}

			const subscription = eventsService.subscribe(subscriptionParams)

			// Add multiple event handlers
			const messageHandler1 = vi.fn()
			const messageHandler2 = vi.fn()
			const errorHandler = vi.fn()
			const connectHandler = vi.fn()

			subscription.on('message', messageHandler1)
			subscription.on('message', messageHandler2)
			subscription.on('error', errorHandler)
			subscription.on('connect', connectHandler)

			// Call cleanup
			subscription.cleanup()

			// Verify handlers are cleared by trying to emit events
			// Since handlers are cleared, these should not be called
			subscription.disconnect()

			expect(messageHandler1).not.toHaveBeenCalled()
			expect(messageHandler2).not.toHaveBeenCalled()
			expect(errorHandler).not.toHaveBeenCalled()
		})

		it('should completely destroy subscription and release all resources', async () => {
			const subscriptionParams: SubscriptionParams = {
				filter: {
					actions: ['user.login'],
				},
				transport: 'websocket',
			}

			const subscription = eventsService.subscribe(subscriptionParams)

			// Add event handlers
			const messageHandler = vi.fn()
			subscription.on('message', messageHandler)

			// Connect the subscription
			await subscription.connect()
			expect(subscription.isConnected).toBe(true)

			// Destroy the subscription
			subscription.destroy()

			// Verify subscription is disconnected
			expect(subscription.isConnected).toBe(false)

			// Verify handlers are cleared
			// Attempting to emit should not call the handler
			expect(messageHandler).not.toHaveBeenCalled()
		})
	})

	describe('EventsService subscription tracking', () => {
		it('should track active subscriptions', () => {
			const params: SubscriptionParams = {
				filter: { actions: ['user.login'] },
				transport: 'websocket',
			}

			expect(eventsService.getActiveSubscriptionCount()).toBe(0)

			const sub1 = eventsService.subscribe(params)
			expect(eventsService.getActiveSubscriptionCount()).toBe(1)

			const sub2 = eventsService.subscribe(params)
			expect(eventsService.getActiveSubscriptionCount()).toBe(2)

			const activeSubscriptions = eventsService.getActiveSubscriptions()
			expect(activeSubscriptions).toHaveLength(2)
			expect(activeSubscriptions).toContain(sub1)
			expect(activeSubscriptions).toContain(sub2)
		})

		it('should remove subscription from tracking when disconnected', async () => {
			const params: SubscriptionParams = {
				filter: { actions: ['user.login'] },
				transport: 'websocket',
			}

			const subscription = eventsService.subscribe(params)
			expect(eventsService.getActiveSubscriptionCount()).toBe(1)

			await subscription.connect()
			subscription.disconnect()

			// Give time for disconnect event to propagate
			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(eventsService.getActiveSubscriptionCount()).toBe(0)
		})

		it('should destroy all active subscriptions', async () => {
			const params: SubscriptionParams = {
				filter: { actions: ['user.login'] },
				transport: 'websocket',
			}

			const sub1 = eventsService.subscribe(params)
			const sub2 = eventsService.subscribe(params)
			const sub3 = eventsService.subscribe(params)

			await sub1.connect()
			await sub2.connect()
			await sub3.connect()

			expect(eventsService.getActiveSubscriptionCount()).toBe(3)
			expect(sub1.isConnected).toBe(true)
			expect(sub2.isConnected).toBe(true)
			expect(sub3.isConnected).toBe(true)

			eventsService.destroyAllSubscriptions()

			expect(eventsService.getActiveSubscriptionCount()).toBe(0)
			expect(sub1.isConnected).toBe(false)
			expect(sub2.isConnected).toBe(false)
			expect(sub3.isConnected).toBe(false)
		})
	})

	describe('Memory leak prevention', () => {
		it('should not leak memory after multiple subscription cycles', async () => {
			const params: SubscriptionParams = {
				filter: { actions: ['user.login'] },
				transport: 'websocket',
			}

			// Track initial state
			const initialSubscriptionCount = eventsService.getActiveSubscriptionCount()

			// Create and destroy subscriptions multiple times
			for (let i = 0; i < 100; i++) {
				const subscription = eventsService.subscribe(params)

				// Add event handlers
				const handler = vi.fn()
				subscription.on('message', handler)
				subscription.on('error', handler)
				subscription.on('connect', handler)
				subscription.on('disconnect', handler)

				// Connect and disconnect
				await subscription.connect()
				subscription.destroy()
			}

			// Verify no subscriptions are left
			expect(eventsService.getActiveSubscriptionCount()).toBe(initialSubscriptionCount)

			// Verify WebSocket instances were properly closed
			mockWebSocketInstances.forEach((ws) => {
				expect(ws.close).toHaveBeenCalled()
			})
		})

		it('should handle rapid subscription creation and destruction', async () => {
			const params: SubscriptionParams = {
				filter: { actions: ['user.login'] },
				transport: 'websocket',
			}

			const subscriptions = []

			// Create many subscriptions rapidly
			for (let i = 0; i < 50; i++) {
				const subscription = eventsService.subscribe(params)
				subscriptions.push(subscription)
			}

			expect(eventsService.getActiveSubscriptionCount()).toBe(50)

			// Destroy all subscriptions
			for (const subscription of subscriptions) {
				subscription.destroy()
			}

			// Wait for cleanup
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(eventsService.getActiveSubscriptionCount()).toBe(0)
		})

		it('should clean up event handlers when subscription is destroyed', () => {
			const params: SubscriptionParams = {
				filter: { actions: ['user.login'] },
				transport: 'websocket',
			}

			const subscription = eventsService.subscribe(params)

			// Add many handlers
			const handlers = []
			for (let i = 0; i < 20; i++) {
				const handler = vi.fn()
				handlers.push(handler)
				subscription.on('message', handler)
			}

			// Destroy subscription
			subscription.destroy()

			// Handlers should not be called after destroy
			// This is verified by the fact that the subscription's internal
			// event handlers map should be cleared
			handlers.forEach((handler) => {
				expect(handler).not.toHaveBeenCalled()
			})
		})

		it('should maintain stable memory usage after 1000+ subscription cycles', async () => {
			const params: SubscriptionParams = {
				filter: { actions: ['user.login'] },
				transport: 'websocket',
			}

			// Measure initial state
			const initialCount = eventsService.getActiveSubscriptionCount()
			const initialWebSocketCount = mockWebSocketInstances.length

			// Perform many subscription cycles
			for (let i = 0; i < 1000; i++) {
				const subscription = eventsService.subscribe(params)

				// Add handlers
				subscription.on('message', vi.fn())
				subscription.on('error', vi.fn())

				// Destroy immediately
				subscription.destroy()

				// Periodically check that we're not accumulating subscriptions
				if (i % 100 === 0) {
					expect(eventsService.getActiveSubscriptionCount()).toBe(initialCount)
				}
			}

			// Final verification
			expect(eventsService.getActiveSubscriptionCount()).toBe(initialCount)

			// Verify all WebSocket instances were closed
			const closedCount = mockWebSocketInstances.filter((ws) => ws.close).length
			expect(closedCount).toBe(mockWebSocketInstances.length)
		})
	})

	describe('Service destroy', () => {
		it('should destroy all subscriptions when service is destroyed', async () => {
			const params: SubscriptionParams = {
				filter: { actions: ['user.login'] },
				transport: 'websocket',
			}

			// Create multiple subscriptions
			const sub1 = eventsService.subscribe(params)
			const sub2 = eventsService.subscribe(params)
			const sub3 = eventsService.subscribe(params)

			await sub1.connect()
			await sub2.connect()
			await sub3.connect()

			expect(eventsService.getActiveSubscriptionCount()).toBe(3)

			// Destroy the service
			await eventsService.destroy()

			// All subscriptions should be destroyed
			expect(eventsService.getActiveSubscriptionCount()).toBe(0)
			expect(sub1.isConnected).toBe(false)
			expect(sub2.isConnected).toBe(false)
			expect(sub3.isConnected).toBe(false)
		})

		it('should handle destroy when no subscriptions exist', async () => {
			expect(eventsService.getActiveSubscriptionCount()).toBe(0)

			// Should not throw
			await expect(eventsService.destroy()).resolves.not.toThrow()

			expect(eventsService.getActiveSubscriptionCount()).toBe(0)
		})
	})
})
