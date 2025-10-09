/**
 * Unit tests for TransportHealthMonitor
 * Addresses requirement 10.1, 10.3: Test error recovery scenarios and health monitoring
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LogLevel } from '../../types/logger.js'
import { defaultErrorHandlerConfig, ErrorHandler } from '../error-handler.js'
import {
	defaultFallbackConfig,
	defaultHealthCheckConfig,
	TransportHealthMonitor,
} from '../transport-health-monitor.js'

import type { LogEntry } from '../../types/log-entry.js'
import type { LogTransport } from '../../types/transport.js'

// Mock transport implementation
class MockTransport implements LogTransport {
	public sendCalls: LogEntry[][] = []
	public flushCalls = 0
	public closeCalls = 0
	public shouldFail = false
	public isHealthyValue = true
	public sendDelay = 0

	constructor(public readonly name: string) {}

	async send(entries: LogEntry[]): Promise<void> {
		this.sendCalls.push(entries)

		if (this.sendDelay > 0) {
			await new Promise((resolve) => setTimeout(resolve, this.sendDelay))
		}

		if (this.shouldFail) {
			throw new Error(`Mock transport ${this.name} failed`)
		}
	}

	async flush(): Promise<void> {
		this.flushCalls++
	}

	async close(): Promise<void> {
		this.closeCalls++
	}

	isHealthy(): boolean {
		return this.isHealthyValue
	}

	reset(): void {
		this.sendCalls = []
		this.flushCalls = 0
		this.closeCalls = 0
		this.shouldFail = false
		this.isHealthyValue = true
		this.sendDelay = 0
	}
}

describe('TransportHealthMonitor', () => {
	let healthMonitor: TransportHealthMonitor
	let errorHandler: ErrorHandler
	let primaryTransport: MockTransport
	let fallbackTransport: MockTransport
	let mockLogEntry: LogEntry

	beforeEach(() => {
		errorHandler = new ErrorHandler(defaultErrorHandlerConfig)

		const healthConfig = {
			...defaultHealthCheckConfig,
			checkIntervalMs: 100, // Faster for testing
			timeoutMs: 1000,
		}

		const fallbackConfig = {
			...defaultFallbackConfig,
			fallbackChain: ['fallback', 'console'],
		}

		healthMonitor = new TransportHealthMonitor(healthConfig, fallbackConfig, errorHandler)

		primaryTransport = new MockTransport('primary')
		fallbackTransport = new MockTransport('fallback')

		mockLogEntry = {
			id: 'test-id',
			timestamp: new Date(),
			level: LogLevel.INFO,
			message: 'Test message',
			correlationId: 'test-correlation',
			fields: {},
			metadata: {
				service: 'test-service',
				environment: 'test',
				hostname: 'test-host',
				pid: 12345,
			},
			source: 'test',
			version: '1.0.0',
		}
	})

	afterEach(() => {
		healthMonitor.stopMonitoring()
	})

	describe('transport registration', () => {
		it('should register and unregister transports', () => {
			healthMonitor.registerTransport(primaryTransport)

			const status = healthMonitor.getTransportHealth('primary')
			expect(status).toBeDefined()
			expect(status!.transport).toBe(primaryTransport)
			expect(status!.isHealthy).toBe(true)
			expect(status!.consecutiveFailures).toBe(0)

			healthMonitor.unregisterTransport('primary')

			const statusAfterUnregister = healthMonitor.getTransportHealth('primary')
			expect(statusAfterUnregister).toBeUndefined()
		})

		it('should initialize transport with healthy status', () => {
			healthMonitor.registerTransport(primaryTransport)

			const status = healthMonitor.getTransportHealth('primary')
			expect(status!.isHealthy).toBe(true)
			expect(status!.consecutiveFailures).toBe(0)
			expect(status!.errorRate).toBe(0)
			expect(status!.averageResponseTime).toBe(0)
		})
	})

	describe('health monitoring', () => {
		beforeEach(() => {
			healthMonitor.registerTransport(primaryTransport)
			healthMonitor.registerTransport(fallbackTransport)
		})

		it('should start and stop monitoring', () => {
			expect(() => healthMonitor.startMonitoring()).not.toThrow()
			expect(() => healthMonitor.stopMonitoring()).not.toThrow()
		})

		it('should not start monitoring twice', () => {
			healthMonitor.startMonitoring()
			healthMonitor.startMonitoring() // Should not throw or create duplicate intervals

			expect(() => healthMonitor.stopMonitoring()).not.toThrow()
		})

		it('should update health status on transport failures', async () => {
			primaryTransport.isHealthyValue = false

			healthMonitor.startMonitoring()

			// Wait for health check to run
			await new Promise((resolve) => setTimeout(resolve, 150))

			const status = healthMonitor.getTransportHealth('primary')
			expect(status!.consecutiveFailures).toBeGreaterThan(0)
		})
	})

	describe('sendWithFailover', () => {
		beforeEach(() => {
			healthMonitor.registerTransport(primaryTransport)
			healthMonitor.registerTransport(fallbackTransport)
		})

		it('should send to primary transport when healthy', async () => {
			const result = await healthMonitor.sendWithFailover('primary', [mockLogEntry])

			expect(result.success).toBe(true)
			expect(result.transportUsed).toBe('primary')
			expect(primaryTransport.sendCalls).toHaveLength(1)
			expect(fallbackTransport.sendCalls).toHaveLength(0)
		})

		it('should failover to fallback transport when primary fails', async () => {
			primaryTransport.shouldFail = true

			const result = await healthMonitor.sendWithFailover('primary', [mockLogEntry])

			expect(result.success).toBe(true)
			expect(result.transportUsed).toBe('fallback')
			expect(primaryTransport.sendCalls).toHaveLength(1)
			expect(fallbackTransport.sendCalls).toHaveLength(1)
		})

		it('should return error when all transports fail', async () => {
			primaryTransport.shouldFail = true
			fallbackTransport.shouldFail = true

			const result = await healthMonitor.sendWithFailover('primary', [mockLogEntry])

			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
			expect(primaryTransport.sendCalls).toHaveLength(1)
			expect(fallbackTransport.sendCalls).toHaveLength(1)
		})

		it('should skip unhealthy transports in fallback chain', async () => {
			// Mark primary as unhealthy
			healthMonitor.recordFailure('primary', new Error('Primary failed'))
			healthMonitor.recordFailure('primary', new Error('Primary failed'))
			healthMonitor.recordFailure('primary', new Error('Primary failed'))

			const result = await healthMonitor.sendWithFailover('primary', [mockLogEntry])

			expect(result.success).toBe(true)
			expect(result.transportUsed).toBe('fallback')
			expect(primaryTransport.sendCalls).toHaveLength(0) // Skipped due to being unhealthy
			expect(fallbackTransport.sendCalls).toHaveLength(1)
		})

		it('should handle timeout errors', async () => {
			primaryTransport.sendDelay = 2000 // Longer than timeout

			const result = await healthMonitor.sendWithFailover('primary', [mockLogEntry])

			expect(result.success).toBe(true)
			expect(result.transportUsed).toBe('fallback') // Should failover due to timeout
		})
	})

	describe('success and failure recording', () => {
		beforeEach(() => {
			healthMonitor.registerTransport(primaryTransport)
		})

		it('should record successful operations', () => {
			healthMonitor.recordSuccess('primary', 100)

			const status = healthMonitor.getTransportHealth('primary')
			expect(status!.consecutiveFailures).toBe(0)
			expect(status!.lastSuccess).toBeDefined()
			expect(status!.averageResponseTime).toBe(100)
		})

		it('should record failed operations', () => {
			const error = new Error('Test failure')
			healthMonitor.recordFailure('primary', error)

			const status = healthMonitor.getTransportHealth('primary')
			expect(status!.consecutiveFailures).toBe(1)
			expect(status!.lastFailure).toBeDefined()
		})

		it('should mark transport as unhealthy after threshold failures', () => {
			const error = new Error('Test failure')

			// Record failures up to threshold
			for (let i = 0; i < 3; i++) {
				healthMonitor.recordFailure('primary', error)
			}

			const status = healthMonitor.getTransportHealth('primary')
			expect(status!.isHealthy).toBe(false)
			expect(status!.consecutiveFailures).toBe(3)
		})

		it('should reset consecutive failures on success', () => {
			const error = new Error('Test failure')

			// Record some failures
			healthMonitor.recordFailure('primary', error)
			healthMonitor.recordFailure('primary', error)

			let status = healthMonitor.getTransportHealth('primary')
			expect(status!.consecutiveFailures).toBe(2)

			// Record success
			healthMonitor.recordSuccess('primary', 100)

			status = healthMonitor.getTransportHealth('primary')
			expect(status!.consecutiveFailures).toBe(0)
			expect(status!.isHealthy).toBe(true)
		})

		it('should calculate average response time correctly', () => {
			healthMonitor.recordSuccess('primary', 100)
			healthMonitor.recordSuccess('primary', 200)
			healthMonitor.recordSuccess('primary', 300)

			const status = healthMonitor.getTransportHealth('primary')
			expect(status!.averageResponseTime).toBe(200) // (100 + 200 + 300) / 3
		})

		it('should limit response time history', () => {
			// Record more than 100 response times
			for (let i = 1; i <= 150; i++) {
				healthMonitor.recordSuccess('primary', i)
			}

			const status = healthMonitor.getTransportHealth('primary')
			// Should only keep last 100 measurements (51-150)
			expect(status!.averageResponseTime).toBe(100.5) // Average of 51-150
		})
	})

	describe('health status retrieval', () => {
		beforeEach(() => {
			healthMonitor.registerTransport(primaryTransport)
			healthMonitor.registerTransport(fallbackTransport)
		})

		it('should return all health statuses', () => {
			const allStatuses = healthMonitor.getHealthStatus()

			expect(allStatuses.size).toBe(2)
			expect(allStatuses.has('primary')).toBe(true)
			expect(allStatuses.has('fallback')).toBe(true)
		})

		it('should return specific transport health status', () => {
			const status = healthMonitor.getTransportHealth('primary')

			expect(status).toBeDefined()
			expect(status!.transport).toBe(primaryTransport)
		})

		it('should return undefined for non-existent transport', () => {
			const status = healthMonitor.getTransportHealth('non-existent')

			expect(status).toBeUndefined()
		})
	})

	describe('fallback chain building', () => {
		it('should build correct fallback chain', async () => {
			healthMonitor.registerTransport(primaryTransport)
			healthMonitor.registerTransport(fallbackTransport)

			// Make primary fail to test fallback chain
			primaryTransport.shouldFail = true

			const result = await healthMonitor.sendWithFailover('primary', [mockLogEntry])

			expect(result.success).toBe(true)
			expect(result.transportUsed).toBe('fallback')
		})

		it('should not include primary transport in its own fallback chain twice', async () => {
			healthMonitor.registerTransport(primaryTransport)

			// Even if primary is in fallback config, it shouldn't be tried twice
			const result = await healthMonitor.sendWithFailover('primary', [mockLogEntry])

			expect(result.success).toBe(true)
			expect(primaryTransport.sendCalls).toHaveLength(1) // Only called once
		})
	})
})
