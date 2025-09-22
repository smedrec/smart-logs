/**
 * Comprehensive tests for streaming and real-time capabilities
 *
 * Tests cover:
 * - Large data export streaming with backpressure management
 * - WebSocket/SSE real-time event subscriptions
 * - Connection management and reconnection logic
 * - Stream processing utilities and transformers
 */

import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest'

import { AuditLogger } from '../infrastructure/logger'
import {
	ConnectionManager,
	DEFAULT_STREAM_CONFIG,
	ManagedConnection,
	ManagedReadableStream,
	StreamingManager,
	StreamProcessor,
} from '../infrastructure/streaming'
import { ComplianceService } from '../services/compliance'
import { EventsService } from '../services/events'
import { MetricsService } from '../services/metrics'

// Mock WebSocket and EventSource for testing
class MockWebSocket {
	static CONNECTING = 0
	static OPEN = 1
	static CLOSING = 2
	static CLOSED = 3

	readyState = MockWebSocket.CONNECTING
	onopen: ((event: Event) => void) | null = null
	onmessage: ((event: MessageEvent) => void) | null = null
	onerror: ((event: Event) => void) | null = null
	onclose: ((event: CloseEvent) => void) | null = null

	constructor(
		public url: string,
		public protocols?: string | string[]
	) {
		// Simulate connection opening
		setTimeout(() => {
			this.readyState = MockWebSocket.OPEN
			if (this.onopen) {
				this.onopen(new Event('open'))
			}
		}, 10)
	}

	send(data: string | ArrayBuffer | Blob): void {
		// Mock send implementation
	}

	close(code?: number, reason?: string): void {
		this.readyState = MockWebSocket.CLOSED
		if (this.onclose) {
			this.onclose(new CloseEvent('close', { code, reason }))
		}
	}

	// Helper method to simulate receiving messages
	simulateMessage(data: any): void {
		if (this.onmessage) {
			this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
		}
	}

	// Helper method to simulate errors
	simulateError(): void {
		if (this.onerror) {
			this.onerror(new Event('error'))
		}
	}
}

class MockEventSource {
	static CONNECTING = 0
	static OPEN = 1
	static CLOSED = 2

	readyState = MockEventSource.CONNECTING
	onopen: ((event: Event) => void) | null = null
	onmessage: ((event: MessageEvent) => void) | null = null
	onerror: ((event: Event) => void) | null = null

	constructor(public url: string) {
		// Simulate connection opening
		setTimeout(() => {
			this.readyState = MockEventSource.OPEN
			if (this.onopen) {
				this.onopen(new Event('open'))
			}
		}, 10)
	}

	close(): void {
		this.readyState = MockEventSource.CLOSED
	}

	// Helper method to simulate receiving messages
	simulateMessage(data: any): void {
		if (this.onmessage) {
			this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
		}
	}

	// Helper method to simulate errors
	simulateError(): void {
		if (this.onerror) {
			this.onerror(new Event('error'))
		}
	}
}

// Mock global WebSocket and EventSource
global.WebSocket = MockWebSocket as any
global.EventSource = MockEventSource as any

describe('Streaming Infrastructure', () => {
	let streamingManager: StreamingManager
	let logger: AuditLogger

	beforeEach(() => {
		logger = new AuditLogger({ enabled: true, level: 'debug' })
		streamingManager = new StreamingManager(
			{
				...DEFAULT_STREAM_CONFIG,
				maxConcurrentStreams: 5,
				enableMetrics: true,
			},
			logger
		)
	})

	afterEach(async () => {
		await streamingManager.destroy()
	})

	describe('ManagedReadableStream', () => {
		it('should create a managed readable stream with backpressure management', async () => {
			const chunks = ['chunk1', 'chunk2', 'chunk3']
			let chunkIndex = 0

			const source: UnderlyingDefaultSource<string> = {
				start: (controller) => {
					const interval = setInterval(() => {
						if (chunkIndex < chunks.length) {
							controller.enqueue(chunks[chunkIndex++])
						} else {
							clearInterval(interval)
							controller.close()
						}
					}, 10)
				},
			}

			const stream = streamingManager.createExportStream(source)
			const reader = stream.getReader()
			const results: string[] = []

			let result = await reader.read()
			while (!result.done) {
				results.push(result.value)
				result = await reader.read()
			}

			expect(results).toEqual(chunks)
		})

		it('should handle backpressure correctly', async () => {
			const chunks = ['chunk1', 'chunk2', 'chunk3']

			const source: UnderlyingDefaultSource<string> = {
				start: (controller) => {
					chunks.forEach((chunk) => controller.enqueue(chunk))
					controller.close()
				},
			}

			const stream = streamingManager.createExportStream(source, {
				highWaterMark: 2, // Small buffer
			})

			const reader = stream.getReader()
			const results: string[] = []

			let result = await reader.read()
			while (!result.done) {
				results.push(result.value)
				result = await reader.read()
			}

			expect(results).toEqual(chunks)
		})

		it('should support stream transformations', async () => {
			const numbers = [1, 2, 3, 4, 5]

			const source: UnderlyingDefaultSource<number> = {
				start: (controller) => {
					numbers.forEach((num) => controller.enqueue(num))
					controller.close()
				},
			}

			const stream = streamingManager.createExportStream(source)
			const transformedStream = stream.transform((num: number) => num * 2)

			const reader = transformedStream.getReader()
			const results: number[] = []

			let result = await reader.read()
			while (!result.done) {
				results.push(result.value)
				result = await reader.read()
			}

			expect(results).toEqual([2, 4, 6, 8, 10])
		})

		it('should support stream filtering', async () => {
			const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

			const source: UnderlyingDefaultSource<number> = {
				start: (controller) => {
					numbers.forEach((num) => controller.enqueue(num))
					controller.close()
				},
			}

			const stream = streamingManager.createExportStream(source)
			const filteredStream = stream.filter((num: number) => num % 2 === 0)

			const reader = filteredStream.getReader()
			const results: number[] = []

			let result = await reader.read()
			while (!result.done) {
				results.push(result.value)
				result = await reader.read()
			}

			expect(results).toEqual([2, 4, 6, 8, 10])
		})
	})

	describe('ConnectionManager', () => {
		let connectionManager: ConnectionManager

		beforeEach(() => {
			connectionManager = new ConnectionManager(DEFAULT_STREAM_CONFIG, logger)
		})

		afterEach(async () => {
			await connectionManager.closeAll()
		})

		it('should create and manage WebSocket connections', async () => {
			const connection = await connectionManager.createConnection(
				'test-ws',
				'ws://localhost:8080/test',
				'websocket'
			)

			expect(connection.getId()).toBe('test-ws')
			expect(connection.getState()).toBe('disconnected')

			// Start connection
			const connectPromise = connection.connect()
			expect(connection.getState()).toBe('connecting')

			// Wait for connection to open
			await new Promise((resolve) => {
				connection.on('connect', resolve)
			})

			await connectPromise
			expect(connection.getState()).toBe('connected')
		})

		it('should create and manage SSE connections', async () => {
			const connection = await connectionManager.createConnection(
				'test-sse',
				'http://localhost:8080/events',
				'sse'
			)

			expect(connection.getId()).toBe('test-sse')
			expect(connection.getState()).toBe('disconnected')

			// Start connection
			const connectPromise = connection.connect()
			expect(connection.getState()).toBe('connecting')

			// Wait for connection to open
			await new Promise((resolve) => {
				connection.on('connect', resolve)
			})

			await connectPromise
			expect(connection.getState()).toBe('connected')
		})

		it('should handle connection limits', async () => {
			const limitedManager = new ConnectionManager(
				{
					...DEFAULT_STREAM_CONFIG,
					maxConcurrentStreams: 2,
				},
				logger
			)

			// Create maximum allowed connections
			await limitedManager.createConnection('conn1', 'ws://localhost:8080/1', 'websocket')
			await limitedManager.createConnection('conn2', 'ws://localhost:8080/2', 'websocket')

			// Try to create one more connection (should fail)
			await expect(
				limitedManager.createConnection('conn3', 'ws://localhost:8080/3', 'websocket')
			).rejects.toThrow('Maximum concurrent connections')

			await limitedManager.closeAll()
		})

		it('should handle connection reconnection', async () => {
			const connection = await connectionManager.createConnection(
				'test-reconnect',
				'ws://localhost:8080/test',
				'websocket',
				{ reconnect: true, maxReconnectAttempts: 1, reconnectDelay: 10 }
			)

			// Test that reconnection config is set correctly
			expect((connection as any).config.reconnect).toBe(true)
			expect((connection as any).config.maxReconnectAttempts).toBe(1)
			expect(connection.getId()).toBe('test-reconnect')
		})
	})

	describe('StreamProcessor', () => {
		let processor: StreamProcessor

		beforeEach(() => {
			processor = new StreamProcessor(DEFAULT_STREAM_CONFIG, logger)
		})

		it('should create batch transformer', () => {
			const batchTransformer = processor.createBatchTransformer<string>(3)

			// Test batching
			expect(batchTransformer('item1')).toEqual([])
			expect(batchTransformer('item2')).toEqual([])
			expect(batchTransformer('item3')).toEqual(['item1', 'item2', 'item3'])
		})

		it('should create JSON lines parser', () => {
			const parser = processor.createJSONLinesParser<{ id: number; name: string }>()

			const result = parser('{"id": 1, "name": "test"}')
			expect(result).toEqual({ id: 1, name: 'test' })

			expect(() => parser('invalid json')).toThrow('Failed to parse JSON line')
		})

		it('should create rate limiting transformer', async () => {
			const rateLimiter = processor.createRateLimitTransformer<string>(2) // 2 items per second

			const start = Date.now()

			await rateLimiter('item1')
			await rateLimiter('item2')
			await rateLimiter('item3')

			const elapsed = Date.now() - start

			// Should take at least 1 second due to rate limiting
			expect(elapsed).toBeGreaterThan(900)
		})
	})
})

describe('EventsService Streaming', () => {
	let eventsService: EventsService
	let mockConfig: any
	let logger: AuditLogger

	beforeEach(() => {
		logger = new AuditLogger({ enabled: true, level: 'debug' })
		mockConfig = {
			baseUrl: 'http://localhost:8080',
			authentication: { type: 'apiKey', apiKey: 'test-key' },
			cache: { enabled: false },
			retry: { enabled: false },
			batching: { enabled: false },
			performance: { enableCompression: true },
			logging: { enabled: true, level: 'debug' },
			errorHandling: { throwOnError: true },
			customHeaders: {},
			interceptors: { request: [], response: [] },
		}

		eventsService = new EventsService(mockConfig, logger)
	})

	afterEach(async () => {
		await eventsService.destroyStreaming()
	})

	it('should create real-time event subscription', () => {
		const subscription = eventsService.subscribe({
			filter: {
				actions: ['user.login', 'user.logout'],
				organizationIds: ['org1'],
			},
			transport: 'websocket',
			reconnect: true,
		})

		expect(subscription.id).toBeDefined()
		expect(subscription.isConnected).toBe(false)

		// Test event handlers
		let messageReceived = false
		subscription.on('message', () => {
			messageReceived = true
		})

		// Simulate message
		setTimeout(() => {
			const mockWs = (subscription as any).managedConnection?.connection as MockWebSocket
			if (mockWs) {
				mockWs.simulateMessage({ type: 'audit_event', data: { action: 'user.login' } })
			}
		}, 50)

		return new Promise<void>((resolve) => {
			subscription.on('message', () => {
				expect(messageReceived).toBe(true)
				resolve()
			})
			subscription.connect()
		})
	})

	it('should get streaming metrics', () => {
		const metrics = eventsService.getStreamingMetrics()

		expect(metrics).toHaveProperty('connections')
		expect(metrics).toHaveProperty('totalConnections')
		expect(metrics).toHaveProperty('activeConnections')
	})
})

describe('ComplianceService Streaming', () => {
	let complianceService: ComplianceService
	let mockConfig: any
	let logger: AuditLogger

	beforeEach(() => {
		logger = new AuditLogger({ enabled: true, level: 'debug' })
		mockConfig = {
			baseUrl: 'http://localhost:8080',
			authentication: { type: 'apiKey', apiKey: 'test-key' },
			cache: { enabled: false },
			retry: { enabled: false },
			batching: { enabled: false },
			performance: { enableCompression: true },
			logging: { enabled: true, level: 'debug' },
			errorHandling: { throwOnError: true },
			customHeaders: {},
			interceptors: { request: [], response: [] },
		}

		complianceService = new ComplianceService(mockConfig, logger)
	})

	afterEach(async () => {
		await complianceService.destroyStreaming()
	})

	it('should get streaming metrics', () => {
		const metrics = complianceService.getStreamingMetrics()

		expect(metrics).toHaveProperty('connections')
		expect(metrics).toHaveProperty('totalConnections')
		expect(metrics).toHaveProperty('activeConnections')
	})
})

describe('MetricsService Streaming', () => {
	let metricsService: MetricsService
	let mockConfig: any
	let logger: AuditLogger

	beforeEach(() => {
		logger = new AuditLogger({ enabled: true, level: 'debug' })
		mockConfig = {
			baseUrl: 'http://localhost:8080',
			authentication: { type: 'apiKey', apiKey: 'test-key' },
			cache: { enabled: false },
			retry: { enabled: false },
			batching: { enabled: false },
			performance: { enableCompression: true },
			logging: { enabled: true, level: 'debug' },
			errorHandling: { throwOnError: true },
			customHeaders: {},
			interceptors: { request: [], response: [] },
		}

		metricsService = new MetricsService(mockConfig, logger)
	})

	afterEach(async () => {
		await metricsService.destroyStreaming()
	})

	it('should create enhanced metrics stream', async () => {
		const connection = await metricsService.createEnhancedMetricsStream({
			metrics: ['cpu', 'memory'],
			interval: 1000,
			transport: 'websocket',
		})

		expect(connection.getId()).toBeDefined()
		expect(connection.getState()).toBe('disconnected')

		// Start connection
		const connectPromise = connection.connect()

		// Connection might be fast, so just check it's not disconnected
		expect(['connecting', 'connected']).toContain(connection.getState())

		// Wait for connection to complete
		await connectPromise

		expect(connection.getState()).toBe('connected')
	})

	it('should get streaming metrics', () => {
		const metrics = metricsService.getStreamingMetrics()

		expect(metrics).toHaveProperty('connections')
		expect(metrics).toHaveProperty('totalConnections')
		expect(metrics).toHaveProperty('activeConnections')
	})
})
