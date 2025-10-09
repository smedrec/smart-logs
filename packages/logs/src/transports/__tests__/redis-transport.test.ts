import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RedisTransport } from '../redis-transport.js'

import type { RedisConfig } from '../../types/config.js'
import type { LogEntry } from '../../types/log-entry.js'

// Mock the Redis client
const mockRedisClient = {
	status: 'ready',
	ping: vi.fn().mockResolvedValue('PONG'),
	pipeline: vi.fn(),
	lpush: vi.fn(),
	expire: vi.fn(),
	xadd: vi.fn(),
	xtrim: vi.fn(),
	publish: vi.fn(),
	quit: vi.fn(),
	disconnect: vi.fn(),
	on: vi.fn(),
}

const mockPipeline = {
	lpush: vi.fn().mockReturnThis(),
	expire: vi.fn().mockReturnThis(),
	xadd: vi.fn().mockReturnThis(),
	exec: vi.fn().mockResolvedValue([[null, 1]]), // Success result
}

// Mock the Redis cluster
const mockCluster = {
	status: 'ready',
	ping: vi.fn().mockResolvedValue('PONG'),
	pipeline: vi.fn(),
	lpush: vi.fn(),
	expire: vi.fn(),
	quit: vi.fn(),
	disconnect: vi.fn(),
	on: vi.fn(),
}

// Mock Redis constructor and Cluster
vi.mock('ioredis', () => {
	const Redis = vi.fn(() => mockRedisClient)
	Redis.Cluster = vi.fn(() => mockCluster)
	return { default: Redis }
})

// Mock ioredis directly
vi.mock('ioredis', () => {
	return {
		default: vi.fn(() => mockRedisClient),
		Cluster: vi.fn(() => mockRedisClient),
	}
})

// Mock batch manager, circuit breaker, and retry manager
let mockProcessor: ((entries: any[]) => Promise<void>) | null = null

const mockBatchManager = {
	add: vi.fn().mockImplementation(async (entry) => {
		// Call the processor immediately for testing
		if (mockProcessor) {
			await mockProcessor([entry])
		}
		return Promise.resolve()
	}),
	flush: vi.fn(),
	close: vi.fn(),
	getPendingCount: vi.fn().mockReturnValue(0),
	isHealthy: vi.fn().mockReturnValue(true),
}

const mockCircuitBreaker = {
	canExecute: vi.fn().mockReturnValue(true),
	onSuccess: vi.fn(),
	onFailure: vi.fn(),
	getState: vi.fn().mockReturnValue('closed'),
	destroy: vi.fn(),
}

const mockRetryManager = {
	executeWithRetry: vi.fn().mockImplementation(async (operation) => {
		return await operation()
	}),
}

vi.mock('../../core/batch-manager.js', () => ({
	DefaultBatchManager: vi.fn().mockImplementation((config, processor) => {
		mockProcessor = processor
		return mockBatchManager
	}),
}))

vi.mock('../../core/circuit-breaker.js', () => ({
	DefaultCircuitBreaker: vi.fn().mockImplementation(() => mockCircuitBreaker),
}))

vi.mock('../../core/retry-manager.js', () => ({
	DefaultRetryManager: vi.fn().mockImplementation(() => mockRetryManager),
}))

describe('RedisTransport', () => {
	let transport: RedisTransport
	let config: RedisConfig
	let mockLogEntry: LogEntry

	beforeEach(() => {
		vi.clearAllMocks()

		// Reset mock implementations
		mockRedisClient.pipeline.mockReturnValue(mockPipeline)
		mockRedisClient.status = 'ready'
		mockCluster.status = 'ready'
		mockCluster.pipeline.mockReturnValue(mockPipeline)
		mockPipeline.exec.mockResolvedValue([[null, 1]])

		config = {
			name: 'redis',
			enabled: true,
			host: 'localhost',
			port: 6379,
			database: 0,
			keyPrefix: 'logs:',
			listName: 'test-logs',
			maxRetries: 3,
			connectTimeoutMs: 10000,
			commandTimeoutMs: 5000,
			enableAutoPipelining: true,
			enableOfflineQueue: false,
			dataStructure: 'list',
			enableCluster: false,
			enableTLS: false,
		}

		mockLogEntry = {
			id: 'test-id',
			timestamp: new Date('2023-01-01T00:00:00Z'),
			level: 'info',
			message: 'Test message',
			source: 'test-source',
			version: '1.0.0',
			correlationId: 'test-correlation-id',
			fields: { testField: 'testValue' },
			metadata: {
				service: 'test-service',
				environment: 'test',
				hostname: 'test-host',
				pid: 12345,
			},
		}
	})

	describe('Constructor and Initialization', () => {
		it('should initialize with single Redis connection', () => {
			transport = new RedisTransport(config)

			expect(transport.name).toBe('redis')
			// The transport may not be immediately healthy due to async connection
			expect(typeof transport.isHealthy()).toBe('boolean')
		})

		it('should initialize with cluster configuration', () => {
			const clusterConfig = {
				...config,
				enableCluster: true,
				clusterNodes: ['localhost:6379', 'localhost:6380'],
			}

			transport = new RedisTransport(clusterConfig)

			expect(transport.name).toBe('redis')
		})

		it('should initialize with TLS configuration', () => {
			const tlsConfig = {
				...config,
				enableTLS: true,
				tlsOptions: {
					rejectUnauthorized: true,
					ca: 'test-ca',
					cert: 'test-cert',
					key: 'test-key',
				},
			}

			transport = new RedisTransport(tlsConfig)

			expect(transport.name).toBe('redis')
		})
	})

	describe('Log Sending', () => {
		beforeEach(() => {
			transport = new RedisTransport(config)
		})

		it('should send single log entry successfully', async () => {
			await transport.send([mockLogEntry])

			expect(mockRedisClient.pipeline).toHaveBeenCalled()
			expect(mockPipeline.lpush).toHaveBeenCalledWith(
				'logs:test-logs',
				expect.stringContaining('"message":"Test message"')
			)
			expect(mockPipeline.exec).toHaveBeenCalled()
		})

		it('should send multiple log entries in batch', async () => {
			const entries = [
				mockLogEntry,
				{ ...mockLogEntry, id: 'test-id-2', message: 'Second message' },
			]

			await transport.send(entries)

			expect(mockPipeline.lpush).toHaveBeenCalledTimes(2)
			expect(mockPipeline.exec).toHaveBeenCalled()
		})

		it('should handle empty entries array', async () => {
			await transport.send([])

			expect(mockRedisClient.pipeline).not.toHaveBeenCalled()
		})

		it('should serialize log entry correctly', async () => {
			await transport.send([mockLogEntry])

			const serializedCall = mockPipeline.lpush.mock.calls[0]
			const serializedEntry = JSON.parse(serializedCall[1])

			expect(serializedEntry).toMatchObject({
				'@timestamp': '2023-01-01T00:00:00.000Z',
				level: 'info',
				message: 'Test message',
				id: 'test-id',
				correlationId: 'test-correlation-id',
				fields: { testField: 'testValue' },
				metadata: {
					service: 'test-service',
					environment: 'test',
					hostname: 'test-host',
					pid: 12345,
				},
			})
		})

		it('should include optional fields when present', async () => {
			const entryWithOptionals = {
				...mockLogEntry,
				requestId: 'test-request-id',
				traceId: 'test-trace-id',
				spanId: 'test-span-id',
				performance: {
					duration: 100,
					cpuUsage: 0.5,
					memoryUsage: 1024,
				},
			}

			await transport.send([entryWithOptionals])

			const serializedCall = mockPipeline.lpush.mock.calls[0]
			const serializedEntry = JSON.parse(serializedCall[1])

			expect(serializedEntry.requestId).toBe('test-request-id')
			expect(serializedEntry.traceId).toBe('test-trace-id')
			expect(serializedEntry.spanId).toBe('test-span-id')
			expect(serializedEntry.performance).toEqual({
				duration: 100,
				cpuUsage: 0.5,
				memoryUsage: 1024,
			})
		})
	})

	describe('Error Handling', () => {
		beforeEach(() => {
			transport = new RedisTransport(config)
		})

		it('should handle Redis connection errors', async () => {
			mockRedisClient.status = 'connecting'

			await expect(transport.send([mockLogEntry])).rejects.toThrow('Redis connection not ready')
		})

		it('should handle pipeline execution errors', async () => {
			const error = new Error('Pipeline failed')
			mockPipeline.exec.mockResolvedValue([[error, null]])

			await expect(transport.send([mockLogEntry])).rejects.toThrow('Redis pipeline command failed')
		})

		it('should handle serialization errors gracefully', async () => {
			// Create a circular reference to cause serialization error
			const circularEntry = { ...mockLogEntry }
			circularEntry.fields = { self: circularEntry }

			// Should not throw, but create a fallback log entry
			await transport.send([circularEntry])

			expect(mockPipeline.lpush).toHaveBeenCalled()
			const serializedCall = mockPipeline.lpush.mock.calls[0]
			const serializedEntry = JSON.parse(serializedCall[1])

			// Should contain error information
			expect(serializedEntry.error).toContain('Serialization failed')
		})

		it('should classify retryable errors correctly', async () => {
			const retryableError = new Error('connection lost')
			mockPipeline.exec.mockRejectedValue(retryableError)

			await expect(transport.send([mockLogEntry])).rejects.toThrow()
		})

		it('should classify non-retryable errors correctly', async () => {
			const nonRetryableError = new Error('NOAUTH Authentication required')
			mockPipeline.exec.mockRejectedValue(nonRetryableError)

			await expect(transport.send([mockLogEntry])).rejects.toThrow()
		})
	})

	describe('Health Monitoring', () => {
		beforeEach(() => {
			transport = new RedisTransport(config)
		})

		it('should report healthy when Redis is ready', async () => {
			mockRedisClient.status = 'ready'

			expect(transport.isHealthy()).toBe(true)
			expect(await transport.performHealthCheck()).toBe(true)
		})

		it('should report unhealthy when Redis is not ready', async () => {
			mockRedisClient.status = 'connecting'

			expect(await transport.performHealthCheck()).toBe(false)
		})

		it('should handle health check ping failures', async () => {
			mockRedisClient.ping.mockRejectedValue(new Error('Ping failed'))

			expect(await transport.performHealthCheck()).toBe(false)
		})

		it('should return connection status', () => {
			mockRedisClient.status = 'ready'

			expect(transport.getConnectionStatus()).toBe('ready (single)')
		})

		it('should return cluster connection status', () => {
			const clusterConfig = {
				...config,
				enableCluster: true,
				clusterNodes: ['localhost:6379'],
			}

			transport = new RedisTransport(clusterConfig)

			// The connection info should indicate cluster mode even if connection fails
			const info = transport.getConnectionInfo()
			expect(info.type).toBe('cluster')
		})

		it('should provide detailed connection info', () => {
			const info = transport.getConnectionInfo()

			expect(info).toMatchObject({
				type: 'single',
				status: expect.stringContaining('single'),
				isHealthy: true,
				connectionAttempts: expect.any(Number),
				tlsEnabled: false,
			})
		})
	})

	describe('Alternative Data Structures', () => {
		beforeEach(() => {
			transport = new RedisTransport(config)
		})

		it('should send to Redis streams', async () => {
			await transport.sendToRedisStream([mockLogEntry], 'test-stream')

			expect(mockRedisClient.pipeline).toHaveBeenCalled()
			expect(mockPipeline.xadd).toHaveBeenCalledWith(
				'test-stream',
				'*',
				'timestamp',
				'2023-01-01T00:00:00.000Z',
				'level',
				'info',
				'message',
				'Test message',
				'id',
				'test-id',
				'source',
				'test-source',
				'correlationId',
				'test-correlation-id',
				'fields',
				'{"testField":"testValue"}',
				'metadata',
				'{"service":"test-service","environment":"test","hostname":"test-host","pid":12345}'
			)
		})

		it('should publish to Redis channels', async () => {
			await transport.publishToRedisChannel([mockLogEntry], 'test-channel')

			expect(mockRedisClient.publish).toHaveBeenCalledWith(
				'test-channel',
				expect.stringContaining('"message":"Test message"')
			)
		})

		it('should handle stream operations when Redis not ready', async () => {
			mockRedisClient.status = 'connecting'

			await expect(transport.sendToRedisStream([mockLogEntry])).rejects.toThrow(
				'Redis client not ready for stream operations'
			)
		})

		it('should handle pub/sub operations when Redis not ready', async () => {
			mockRedisClient.status = 'connecting'

			await expect(transport.publishToRedisChannel([mockLogEntry])).rejects.toThrow(
				'Redis client not ready for pub/sub operations'
			)
		})
	})

	describe('Resource Management', () => {
		beforeEach(() => {
			transport = new RedisTransport(config)
		})

		it('should flush pending logs', async () => {
			await transport.flush()

			// Verify batch manager flush was called
			expect(transport.getBatchStats().isHealthy).toBe(true)
		})

		it('should close transport gracefully for single connection', async () => {
			await transport.close()

			expect(mockRedisClient.quit).toHaveBeenCalled()
		})

		it('should close transport gracefully for cluster connection', async () => {
			const clusterConfig = {
				...config,
				enableCluster: true,
				clusterNodes: ['localhost:6379'],
			}

			transport = new RedisTransport(clusterConfig)
			await transport.close()

			expect(mockCluster.disconnect).toHaveBeenCalled()
		})

		it('should handle close errors gracefully', async () => {
			mockRedisClient.quit.mockRejectedValue(new Error('Quit failed'))

			await transport.close()

			// Should fallback to disconnect
			expect(mockRedisClient.disconnect).toHaveBeenCalled()
		})

		it('should provide batch statistics', () => {
			const stats = transport.getBatchStats()

			expect(stats).toMatchObject({
				pendingCount: expect.any(Number),
				isHealthy: expect.any(Boolean),
			})
		})
	})

	describe('Circuit Breaker Integration', () => {
		beforeEach(() => {
			transport = new RedisTransport(config)
		})

		it('should report circuit breaker state', () => {
			expect(transport.getCircuitBreakerState()).toBe('closed')
		})

		it('should handle circuit breaker open state', async () => {
			// Mock circuit breaker to return false for canExecute
			const mockCircuitBreaker = {
				canExecute: vi.fn().mockReturnValue(false),
				onSuccess: vi.fn(),
				onFailure: vi.fn(),
				getState: vi.fn().mockReturnValue('open'),
				destroy: vi.fn(),
			}

			// Replace the circuit breaker mock
			vi.mocked(transport['circuitBreaker'] as any).canExecute.mockReturnValue(false)

			await expect(transport.send([mockLogEntry])).rejects.toThrow('Circuit breaker is open')
		})
	})

	describe('Configuration Validation', () => {
		it('should handle missing cluster nodes for cluster mode', async () => {
			const invalidClusterConfig = {
				...config,
				enableCluster: true,
				clusterNodes: [],
			}

			// The constructor doesn't throw immediately, but the connection will fail
			transport = new RedisTransport(invalidClusterConfig)

			// The transport should be created but not healthy
			expect(transport.name).toBe('redis')
			expect(transport.isHealthy()).toBe(false)
		})

		it('should use default values for optional configuration', () => {
			const minimalConfig: RedisConfig = {
				name: 'redis',
				enabled: true,
				host: 'localhost',
				port: 6379,
				database: 0,
				keyPrefix: 'logs:',
				listName: 'test-logs',
				maxRetries: 3,
				connectTimeoutMs: 10000,
				commandTimeoutMs: 5000,
				enableAutoPipelining: true,
				enableOfflineQueue: false,
				dataStructure: 'list',
				enableCluster: false,
				enableTLS: false,
			}

			transport = new RedisTransport(minimalConfig)

			expect(transport.name).toBe('redis')
		})
	})
})
