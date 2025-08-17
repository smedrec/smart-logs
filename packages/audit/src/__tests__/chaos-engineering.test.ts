/**
 * Chaos Engineering Tests for System Resilience Validation
 * Tests system behavior under various failure scenarios and adverse conditions
 */

import { sql } from 'drizzle-orm'
import { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { AuditDb } from '@repo/audit-db'
import { closeSharedRedisConnection, getSharedRedisConnection } from '@repo/redis-client'

import { AuditService } from '../audit.js'
import { MonitoringService } from '../monitor/monitoring.js'
import { CircuitBreaker } from '../queue/circuit-breaker.js'
import { ReliableEventProcessor } from '../queue/reliable-processor.js'
import { executeWithRetry } from '../retry.js'

import type { AuditLogEvent } from '../types.js'

describe('Chaos Engineering - System Resilience Tests', () => {
	let auditDb: AuditDb
	let redis: Redis
	let auditService: AuditService
	let monitoringService: MonitoringService

	beforeAll(async () => {
		// Setup test database
		const dbUrl = process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test'
		auditDb = new AuditDb(dbUrl)

		// Verify database connection
		const connected = await auditDb.checkAuditDbConnection()
		if (!connected) {
			throw new Error('Cannot connect to test database for chaos testing')
		}

		// Setup Redis connection
		redis = getSharedRedisConnection()

		// Initialize services
		auditService = new AuditService({
			database: auditDb,
			redis,
			enableCryptographicIntegrity: true,
		})

		monitoringService = new MonitoringService()
	})

	afterAll(async () => {
		await auditDb?.end()
		await closeSharedRedisConnection()
	})

	describe('Database Failure Scenarios', () => {
		it('should handle intermittent database connection failures', async () => {
			const testEvents: AuditLogEvent[] = []
			for (let i = 0; i < 20; i++) {
				testEvents.push({
					timestamp: new Date().toISOString(),
					action: 'chaos.db.intermittent',
					status: 'success',
					principalId: `chaos-user-${i}`,
					targetResourceType: 'ChaosResource',
					targetResourceId: `resource-${i}`,
				})
			}

			// Mock intermittent database failures
			const originalLogEvent = auditService.logEvent.bind(auditService)
			let callCount = 0

			vi.spyOn(auditService, 'logEvent').mockImplementation(async (event: AuditLogEvent) => {
				callCount++
				// Fail every 3rd call to simulate intermittent issues
				if (callCount % 3 === 0) {
					const error = new Error('Database connection lost')
					;(error as any).code = 'ECONNRESET'
					throw error
				}
				return originalLogEvent(event)
			})

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'chaos-db-intermittent',
					concurrency: 3,
					retryConfig: {
						maxRetries: 5,
						backoffStrategy: 'exponential',
						baseDelay: 100,
						maxDelay: 2000,
						retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
					},
					circuitBreakerConfig: {
						failureThreshold: 8, // Higher threshold for intermittent failures
						recoveryTimeout: 2000,
						monitoringPeriod: 60000,
						minimumThroughput: 5,
					},
					deadLetterConfig: {
						queueName: 'chaos-db-intermittent-dlq',
						maxRetentionDays: 7,
						alertThreshold: 10,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			// Process all events
			for (const event of testEvents) {
				await processor.addEvent(event)
			}

			// Wait for processing with retries
			await new Promise((resolve) => setTimeout(resolve, 10000))

			// Verify most events were eventually processed despite failures
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'chaos.db.intermittent'`
			)

			const eventCount = Number((processedEvents[0] as any).count)
			const successRate = (eventCount / testEvents.length) * 100

			console.log(`Intermittent DB Failure Test:`)
			console.log(`- Events submitted: ${testEvents.length}`)
			console.log(`- Events processed: ${eventCount}`)
			console.log(`- Success rate: ${successRate.toFixed(2)}%`)
			console.log(`- Total DB calls: ${callCount}`)

			// Should achieve high success rate despite intermittent failures
			expect(successRate).toBeGreaterThan(80)
			expect(eventCount).toBeGreaterThan(testEvents.length * 0.8)

			await processor.cleanup()
			vi.restoreAllMocks()
		})

		it('should handle database deadlocks and lock timeouts', async () => {
			const concurrentEvents: AuditLogEvent[] = []

			// Create events that might cause contention
			for (let i = 0; i < 50; i++) {
				concurrentEvents.push({
					timestamp: new Date().toISOString(),
					action: 'chaos.db.deadlock',
					status: 'success',
					principalId: 'shared-user', // Same user to increase contention
					targetResourceType: 'SharedResource',
					targetResourceId: 'shared-resource-001', // Same resource
					sessionContext: {
						sessionId: `session-${i}`,
						ipAddress: '192.168.1.100',
						userAgent: 'Chaos-Agent/1.0',
					},
				})
			}

			// Mock occasional deadlock errors
			const originalLogEvent = auditService.logEvent.bind(auditService)
			let deadlockCount = 0

			vi.spyOn(auditService, 'logEvent').mockImplementation(async (event: AuditLogEvent) => {
				// Simulate deadlock on some concurrent operations
				if (Math.random() < 0.1) {
					// 10% chance of deadlock
					deadlockCount++
					const error = new Error('deadlock detected')
					;(error as any).code = '40P01' // PostgreSQL deadlock error code
					throw error
				}
				return originalLogEvent(event)
			})

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'chaos-db-deadlock',
					concurrency: 10, // High concurrency to increase deadlock chance
					retryConfig: {
						maxRetries: 3,
						backoffStrategy: 'exponential',
						baseDelay: 200,
						maxDelay: 2000,
						retryableErrors: ['40P01', 'ECONNRESET'], // Include deadlock error
					},
					circuitBreakerConfig: {
						failureThreshold: 15,
						recoveryTimeout: 3000,
						monitoringPeriod: 60000,
						minimumThroughput: 5,
					},
					deadLetterConfig: {
						queueName: 'chaos-db-deadlock-dlq',
						maxRetentionDays: 7,
						alertThreshold: 20,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			// Submit all events concurrently to maximize contention
			await Promise.all(concurrentEvents.map((event) => processor.addEvent(event)))

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 15000))

			// Verify events were processed despite deadlocks
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'chaos.db.deadlock'`
			)

			const eventCount = Number((processedEvents[0] as any).count)
			const successRate = (eventCount / concurrentEvents.length) * 100

			console.log(`Database Deadlock Test:`)
			console.log(`- Events submitted: ${concurrentEvents.length}`)
			console.log(`- Events processed: ${eventCount}`)
			console.log(`- Deadlocks simulated: ${deadlockCount}`)
			console.log(`- Success rate: ${successRate.toFixed(2)}%`)

			// Should handle deadlocks gracefully with retries
			expect(successRate).toBeGreaterThan(85)
			expect(deadlockCount).toBeGreaterThan(0) // Should have encountered some deadlocks

			await processor.cleanup()
			vi.restoreAllMocks()
		})

		it('should handle database connection pool exhaustion', async () => {
			const highConcurrencyEvents: AuditLogEvent[] = []

			// Create many events to exhaust connection pool
			for (let i = 0; i < 100; i++) {
				highConcurrencyEvents.push({
					timestamp: new Date().toISOString(),
					action: 'chaos.db.pool.exhaustion',
					status: 'success',
					principalId: `pool-user-${i}`,
					targetResourceType: 'PoolResource',
					targetResourceId: `resource-${i}`,
				})
			}

			// Mock connection pool exhaustion
			const originalLogEvent = auditService.logEvent.bind(auditService)
			let poolExhaustionCount = 0

			vi.spyOn(auditService, 'logEvent').mockImplementation(async (event: AuditLogEvent) => {
				// Simulate pool exhaustion for some requests
				if (Math.random() < 0.15) {
					// 15% chance of pool exhaustion
					poolExhaustionCount++
					const error = new Error('connection pool exhausted')
					;(error as any).code = 'ECONNREFUSED'
					throw error
				}

				// Add delay to simulate slow queries that hold connections
				await new Promise((resolve) => setTimeout(resolve, Math.random() * 100))
				return originalLogEvent(event)
			})

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'chaos-db-pool',
					concurrency: 20, // Very high concurrency to stress connection pool
					retryConfig: {
						maxRetries: 4,
						backoffStrategy: 'exponential',
						baseDelay: 500,
						maxDelay: 5000,
						retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT'],
					},
					circuitBreakerConfig: {
						failureThreshold: 20,
						recoveryTimeout: 5000,
						monitoringPeriod: 60000,
						minimumThroughput: 5,
					},
					deadLetterConfig: {
						queueName: 'chaos-db-pool-dlq',
						maxRetentionDays: 7,
						alertThreshold: 30,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			// Submit all events
			await Promise.all(highConcurrencyEvents.map((event) => processor.addEvent(event)))

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 20000))

			// Verify system handled pool exhaustion
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'chaos.db.pool.exhaustion'`
			)

			const eventCount = Number((processedEvents[0] as any).count)
			const successRate = (eventCount / highConcurrencyEvents.length) * 100

			console.log(`Connection Pool Exhaustion Test:`)
			console.log(`- Events submitted: ${highConcurrencyEvents.length}`)
			console.log(`- Events processed: ${eventCount}`)
			console.log(`- Pool exhaustions: ${poolExhaustionCount}`)
			console.log(`- Success rate: ${successRate.toFixed(2)}%`)

			// Should handle pool exhaustion with retries and backoff
			expect(successRate).toBeGreaterThan(75)
			expect(poolExhaustionCount).toBeGreaterThan(0)

			await processor.cleanup()
			vi.restoreAllMocks()
		})
	})

	describe('Redis Failure Scenarios', () => {
		it('should handle Redis connection drops and reconnections', async () => {
			const testEvents: AuditLogEvent[] = []
			for (let i = 0; i < 30; i++) {
				testEvents.push({
					timestamp: new Date().toISOString(),
					action: 'chaos.redis.connection',
					status: 'success',
					principalId: `redis-chaos-user-${i}`,
				})
			}

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'chaos-redis-connection',
					concurrency: 3,
					retryConfig: {
						maxRetries: 5,
						backoffStrategy: 'exponential',
						baseDelay: 200,
						maxDelay: 3000,
						retryableErrors: ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'],
					},
					circuitBreakerConfig: {
						failureThreshold: 10,
						recoveryTimeout: 3000,
						monitoringPeriod: 60000,
						minimumThroughput: 3,
					},
					deadLetterConfig: {
						queueName: 'chaos-redis-connection-dlq',
						maxRetentionDays: 7,
						alertThreshold: 15,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			// Simulate Redis connection issues during processing
			let connectionDropped = false
			const originalStatus = redis.status

			setTimeout(() => {
				// Simulate connection drop
				connectionDropped = true
				Object.defineProperty(redis, 'status', {
					value: 'disconnected',
					writable: true,
				})
				console.log('Simulated Redis connection drop')
			}, 2000)

			setTimeout(() => {
				// Simulate reconnection
				connectionDropped = false
				Object.defineProperty(redis, 'status', {
					value: originalStatus,
					writable: true,
				})
				console.log('Simulated Redis reconnection')
			}, 5000)

			// Submit events during connection instability
			for (const event of testEvents) {
				await processor.addEvent(event)
				await new Promise((resolve) => setTimeout(resolve, 200))
			}

			// Wait for processing to complete
			await new Promise((resolve) => setTimeout(resolve, 15000))

			// Verify events were processed despite Redis issues
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'chaos.redis.connection'`
			)

			const eventCount = Number((processedEvents[0] as any).count)
			const successRate = (eventCount / testEvents.length) * 100

			console.log(`Redis Connection Drop Test:`)
			console.log(`- Events submitted: ${testEvents.length}`)
			console.log(`- Events processed: ${eventCount}`)
			console.log(`- Success rate: ${successRate.toFixed(2)}%`)

			// Should handle Redis connection issues gracefully
			expect(successRate).toBeGreaterThan(70)

			await processor.cleanup()
		})

		it('should handle Redis memory pressure and evictions', async () => {
			// Create events with large payloads to stress Redis memory
			const largePayloadEvents: AuditLogEvent[] = []

			for (let i = 0; i < 20; i++) {
				largePayloadEvents.push({
					timestamp: new Date().toISOString(),
					action: 'chaos.redis.memory',
					status: 'success',
					principalId: `memory-user-${i}`,
					sessionContext: {
						sessionId: `session-${i}`,
						ipAddress: '192.168.1.100',
						userAgent: 'X'.repeat(5000), // Large user agent
					},
					outcomeDescription: 'Y'.repeat(10000), // Large description
				})
			}

			// Mock Redis memory pressure by occasionally failing operations
			const originalAdd = redis.zadd.bind(redis)
			let memoryPressureCount = 0

			vi.spyOn(redis, 'zadd').mockImplementation(async (...args: any[]) => {
				if (Math.random() < 0.2) {
					// 20% chance of memory pressure
					memoryPressureCount++
					throw new Error('OOM command not allowed when used memory > maxmemory')
				}
				return originalAdd(...args)
			})

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'chaos-redis-memory',
					concurrency: 2,
					retryConfig: {
						maxRetries: 4,
						backoffStrategy: 'exponential',
						baseDelay: 300,
						maxDelay: 3000,
						retryableErrors: ['OOM', 'ECONNRESET'],
					},
					circuitBreakerConfig: {
						failureThreshold: 8,
						recoveryTimeout: 4000,
						monitoringPeriod: 60000,
						minimumThroughput: 3,
					},
					deadLetterConfig: {
						queueName: 'chaos-redis-memory-dlq',
						maxRetentionDays: 7,
						alertThreshold: 10,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			// Process large payload events
			for (const event of largePayloadEvents) {
				await processor.addEvent(event)
			}

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 15000))

			// Verify events were processed despite memory pressure
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'chaos.redis.memory'`
			)

			const eventCount = Number((processedEvents[0] as any).count)
			const successRate = (eventCount / largePayloadEvents.length) * 100

			console.log(`Redis Memory Pressure Test:`)
			console.log(`- Events submitted: ${largePayloadEvents.length}`)
			console.log(`- Events processed: ${eventCount}`)
			console.log(`- Memory pressure events: ${memoryPressureCount}`)
			console.log(`- Success rate: ${successRate.toFixed(2)}%`)

			// Should handle memory pressure with retries
			expect(successRate).toBeGreaterThan(70)
			expect(memoryPressureCount).toBeGreaterThan(0)

			await processor.cleanup()
			vi.restoreAllMocks()
		})
	})

	describe('Network Partition and Latency Scenarios', () => {
		it('should handle high network latency', async () => {
			const testEvents: AuditLogEvent[] = []
			for (let i = 0; i < 15; i++) {
				testEvents.push({
					timestamp: new Date().toISOString(),
					action: 'chaos.network.latency',
					status: 'success',
					principalId: `latency-user-${i}`,
				})
			}

			// Mock high network latency
			const originalLogEvent = auditService.logEvent.bind(auditService)

			vi.spyOn(auditService, 'logEvent').mockImplementation(async (event: AuditLogEvent) => {
				// Simulate high latency (1-3 seconds)
				const latency = 1000 + Math.random() * 2000
				await new Promise((resolve) => setTimeout(resolve, latency))
				return originalLogEvent(event)
			})

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'chaos-network-latency',
					concurrency: 2,
					retryConfig: {
						maxRetries: 2,
						backoffStrategy: 'fixed',
						baseDelay: 1000,
						maxDelay: 1000,
						retryableErrors: ['ETIMEDOUT'],
					},
					circuitBreakerConfig: {
						failureThreshold: 5,
						recoveryTimeout: 5000,
						monitoringPeriod: 60000,
						minimumThroughput: 2,
					},
					deadLetterConfig: {
						queueName: 'chaos-network-latency-dlq',
						maxRetentionDays: 7,
						alertThreshold: 8,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			const startTime = Date.now()

			// Process events with high latency
			for (const event of testEvents) {
				await processor.addEvent(event)
			}

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 25000))

			const totalTime = Date.now() - startTime

			// Verify events were processed despite high latency
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'chaos.network.latency'`
			)

			const eventCount = Number((processedEvents[0] as any).count)
			const successRate = (eventCount / testEvents.length) * 100

			console.log(`High Network Latency Test:`)
			console.log(`- Events submitted: ${testEvents.length}`)
			console.log(`- Events processed: ${eventCount}`)
			console.log(`- Total time: ${totalTime}ms`)
			console.log(`- Success rate: ${successRate.toFixed(2)}%`)

			// Should handle high latency gracefully
			expect(successRate).toBeGreaterThan(80)

			await processor.cleanup()
			vi.restoreAllMocks()
		})

		it('should handle network timeouts', async () => {
			const testEvents: AuditLogEvent[] = []
			for (let i = 0; i < 25; i++) {
				testEvents.push({
					timestamp: new Date().toISOString(),
					action: 'chaos.network.timeout',
					status: 'success',
					principalId: `timeout-user-${i}`,
				})
			}

			// Mock network timeouts
			const originalLogEvent = auditService.logEvent.bind(auditService)
			let timeoutCount = 0

			vi.spyOn(auditService, 'logEvent').mockImplementation(async (event: AuditLogEvent) => {
				// Simulate timeout on some operations
				if (Math.random() < 0.3) {
					// 30% chance of timeout
					timeoutCount++
					const error = new Error('Network timeout')
					;(error as any).code = 'ETIMEDOUT'
					throw error
				}
				return originalLogEvent(event)
			})

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'chaos-network-timeout',
					concurrency: 3,
					retryConfig: {
						maxRetries: 4,
						backoffStrategy: 'exponential',
						baseDelay: 500,
						maxDelay: 4000,
						retryableErrors: ['ETIMEDOUT', 'ECONNRESET'],
					},
					circuitBreakerConfig: {
						failureThreshold: 12,
						recoveryTimeout: 3000,
						monitoringPeriod: 60000,
						minimumThroughput: 3,
					},
					deadLetterConfig: {
						queueName: 'chaos-network-timeout-dlq',
						maxRetentionDays: 7,
						alertThreshold: 15,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			// Process events with timeouts
			for (const event of testEvents) {
				await processor.addEvent(event)
			}

			// Wait for processing with retries
			await new Promise((resolve) => setTimeout(resolve, 20000))

			// Verify events were processed despite timeouts
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'chaos.network.timeout'`
			)

			const eventCount = Number((processedEvents[0] as any).count)
			const successRate = (eventCount / testEvents.length) * 100

			console.log(`Network Timeout Test:`)
			console.log(`- Events submitted: ${testEvents.length}`)
			console.log(`- Events processed: ${eventCount}`)
			console.log(`- Timeouts simulated: ${timeoutCount}`)
			console.log(`- Success rate: ${successRate.toFixed(2)}%`)

			// Should handle timeouts with retries
			expect(successRate).toBeGreaterThan(75)
			expect(timeoutCount).toBeGreaterThan(0)

			await processor.cleanup()
			vi.restoreAllMocks()
		})
	})

	describe('System Resource Exhaustion', () => {
		it('should handle CPU pressure', async () => {
			const testEvents: AuditLogEvent[] = []
			for (let i = 0; i < 30; i++) {
				testEvents.push({
					timestamp: new Date().toISOString(),
					action: 'chaos.cpu.pressure',
					status: 'success',
					principalId: `cpu-user-${i}`,
				})
			}

			// Simulate CPU pressure by adding computational load
			const originalLogEvent = auditService.logEvent.bind(auditService)

			vi.spyOn(auditService, 'logEvent').mockImplementation(async (event: AuditLogEvent) => {
				// Add CPU-intensive work to simulate pressure
				const iterations = 100000 + Math.random() * 200000
				let sum = 0
				for (let i = 0; i < iterations; i++) {
					sum += Math.sqrt(i)
				}

				return originalLogEvent(event)
			})

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'chaos-cpu-pressure',
					concurrency: 4, // Moderate concurrency under CPU pressure
					retryConfig: {
						maxRetries: 2,
						backoffStrategy: 'fixed',
						baseDelay: 1000,
						maxDelay: 1000,
						retryableErrors: ['ETIMEDOUT'],
					},
					circuitBreakerConfig: {
						failureThreshold: 10,
						recoveryTimeout: 3000,
						monitoringPeriod: 60000,
						minimumThroughput: 3,
					},
					deadLetterConfig: {
						queueName: 'chaos-cpu-pressure-dlq',
						maxRetentionDays: 7,
						alertThreshold: 15,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			const startTime = Date.now()

			// Process events under CPU pressure
			for (const event of testEvents) {
				await processor.addEvent(event)
			}

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 20000))

			const totalTime = Date.now() - startTime

			// Verify events were processed despite CPU pressure
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'chaos.cpu.pressure'`
			)

			const eventCount = Number((processedEvents[0] as any).count)
			const successRate = (eventCount / testEvents.length) * 100

			console.log(`CPU Pressure Test:`)
			console.log(`- Events submitted: ${testEvents.length}`)
			console.log(`- Events processed: ${eventCount}`)
			console.log(`- Total time: ${totalTime}ms`)
			console.log(`- Success rate: ${successRate.toFixed(2)}%`)

			// Should handle CPU pressure gracefully
			expect(successRate).toBeGreaterThan(85)

			await processor.cleanup()
			vi.restoreAllMocks()
		})
	})

	describe('Circuit Breaker Chaos Testing', () => {
		it('should handle cascading failures with circuit breaker protection', async () => {
			const testEvents: AuditLogEvent[] = []
			for (let i = 0; i < 40; i++) {
				testEvents.push({
					timestamp: new Date().toISOString(),
					action: 'chaos.circuit.breaker',
					status: 'success',
					principalId: `cb-chaos-user-${i}`,
				})
			}

			// Create circuit breaker with aggressive settings for testing
			const circuitBreaker = new CircuitBreaker(
				{
					failureThreshold: 5,
					recoveryTimeout: 2000,
					monitoringPeriod: 10000,
					minimumThroughput: 3,
				},
				'chaos-test-cb'
			)

			// Mock cascading failures
			let failureCount = 0
			const mockOperation = async (event: AuditLogEvent) => {
				failureCount++

				// Simulate cascading failure pattern
				if (failureCount <= 8) {
					throw new Error('Service cascade failure')
				} else if (failureCount <= 12) {
					// Partial recovery
					if (Math.random() < 0.5) {
						throw new Error('Intermittent failure during recovery')
					}
				}

				// Full recovery after failure count > 12
				await auditService.logEvent(event)
			}

			let successCount = 0
			let circuitOpenCount = 0
			let failureCountTotal = 0

			// Process events through circuit breaker
			for (const event of testEvents) {
				try {
					await circuitBreaker.execute(() => mockOperation(event))
					successCount++
				} catch (error) {
					if (error.message.includes('Circuit breaker')) {
						circuitOpenCount++
					} else {
						failureCountTotal++
					}
				}

				// Allow time for circuit breaker state changes
				await new Promise((resolve) => setTimeout(resolve, 100))

				// Allow recovery time when circuit opens
				if (circuitBreaker.getState() === 'OPEN') {
					await new Promise((resolve) => setTimeout(resolve, 2100))
				}
			}

			const metrics = circuitBreaker.getMetrics()

			console.log(`Circuit Breaker Chaos Test:`)
			console.log(`- Events submitted: ${testEvents.length}`)
			console.log(`- Successful operations: ${successCount}`)
			console.log(`- Circuit breaker rejections: ${circuitOpenCount}`)
			console.log(`- Direct failures: ${failureCountTotal}`)
			console.log(`- Final circuit state: ${circuitBreaker.getState()}`)
			console.log(`- Total requests: ${metrics.totalRequests}`)
			console.log(`- Failure rate: ${metrics.failureRate.toFixed(2)}%`)
			console.log(`- State changes: ${metrics.stateChanges.length}`)

			// Verify circuit breaker protected the system
			expect(circuitBreaker.getState()).toBe('CLOSED') // Should recover
			expect(successCount).toBeGreaterThan(0)
			expect(circuitOpenCount).toBeGreaterThan(0) // Should have opened
			expect(metrics.stateChanges.length).toBeGreaterThan(0)
			expect(metrics.totalRequests).toBe(testEvents.length)

			// Verify some events were eventually processed
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'chaos.circuit.breaker'`
			)

			const eventCount = Number((processedEvents[0] as any).count)
			expect(eventCount).toBe(successCount) // Should match successful operations
		})
	})

	describe('Recovery and Self-Healing', () => {
		it('should demonstrate system self-healing after multiple failure types', async () => {
			const testEvents: AuditLogEvent[] = []
			for (let i = 0; i < 50; i++) {
				testEvents.push({
					timestamp: new Date().toISOString(),
					action: 'chaos.self.healing',
					status: 'success',
					principalId: `healing-user-${i}`,
				})
			}

			// Simulate multiple failure types that gradually resolve
			const originalLogEvent = auditService.logEvent.bind(auditService)
			let operationCount = 0

			vi.spyOn(auditService, 'logEvent').mockImplementation(async (event: AuditLogEvent) => {
				operationCount++

				// Phase 1: Database failures (operations 1-15)
				if (operationCount <= 15) {
					if (operationCount % 2 === 0) {
						const error = new Error('Database connection failed')
						;(error as any).code = 'ECONNRESET'
						throw error
					}
				}

				// Phase 2: Timeout issues (operations 16-30)
				else if (operationCount <= 30) {
					if (operationCount % 3 === 0) {
						const error = new Error('Operation timeout')
						;(error as any).code = 'ETIMEDOUT'
						throw error
					}
				}

				// Phase 3: Intermittent issues (operations 31-40)
				else if (operationCount <= 40) {
					if (Math.random() < 0.2) {
						throw new Error('Intermittent service error')
					}
				}

				// Phase 4: Full recovery (operations 41+)
				// No failures, system has self-healed

				return originalLogEvent(event)
			})

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'chaos-self-healing',
					concurrency: 3,
					retryConfig: {
						maxRetries: 5,
						backoffStrategy: 'exponential',
						baseDelay: 200,
						maxDelay: 3000,
						retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
					},
					circuitBreakerConfig: {
						failureThreshold: 8,
						recoveryTimeout: 2000,
						monitoringPeriod: 60000,
						minimumThroughput: 3,
					},
					deadLetterConfig: {
						queueName: 'chaos-self-healing-dlq',
						maxRetentionDays: 7,
						alertThreshold: 20,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			// Process events through all failure phases
			for (const event of testEvents) {
				await processor.addEvent(event)
				await new Promise((resolve) => setTimeout(resolve, 200)) // Controlled rate
			}

			// Wait for processing and recovery
			await new Promise((resolve) => setTimeout(resolve, 25000))

			// Verify system self-healed and processed events
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'chaos.self.healing'`
			)

			const eventCount = Number((processedEvents[0] as any).count)
			const successRate = (eventCount / testEvents.length) * 100

			// Check system health after self-healing
			const healthStatus = await processor.getHealthStatus()

			console.log(`Self-Healing Test:`)
			console.log(`- Events submitted: ${testEvents.length}`)
			console.log(`- Events processed: ${eventCount}`)
			console.log(`- Success rate: ${successRate.toFixed(2)}%`)
			console.log(`- Final health score: ${healthStatus.healthScore}`)
			console.log(`- Circuit breaker state: ${healthStatus.circuitBreakerState}`)

			// System should demonstrate self-healing
			expect(successRate).toBeGreaterThan(80) // High success rate after recovery
			expect(healthStatus.healthScore).toBeGreaterThan(70) // Good health after healing
			expect(healthStatus.circuitBreakerState).toBe('CLOSED') // Circuit should be closed

			await processor.cleanup()
			vi.restoreAllMocks()
		})
	})
})
