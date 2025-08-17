/**
 * Integration Tests for External Dependencies (Redis, PostgreSQL)
 * Tests the audit system's integration with Redis and PostgreSQL under various conditions
 */

import { sql } from 'drizzle-orm'
import { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { AuditDb } from '@repo/audit-db'
import {
	closeSharedRedisConnection,
	getRedisConnectionStatus,
	getSharedRedisConnection,
} from '@repo/redis-client'

import { AuditService } from '../audit.js'
import { CircuitBreaker } from '../queue/circuit-breaker.js'
import { DeadLetterHandler } from '../queue/dead-letter-queue.js'
import { ReliableEventProcessor } from '../queue/reliable-processor.js'

import type { AuditLogEvent } from '../types.js'

describe('External Dependencies Integration Tests', () => {
	let auditDb: AuditDb
	let redis: Redis
	let auditService: AuditService

	beforeAll(async () => {
		// Setup test database
		const dbUrl = process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test'
		auditDb = new AuditDb(dbUrl)

		// Verify database connection
		const connected = await auditDb.checkAuditDbConnection()
		if (!connected) {
			throw new Error('Cannot connect to test database for integration tests')
		}

		// Setup Redis connection
		redis = getSharedRedisConnection()

		// Initialize audit service
		auditService = new AuditService({
			database: auditDb,
			redis,
			enableCryptographicIntegrity: true,
		})
	})

	afterAll(async () => {
		await auditDb?.end()
		await closeSharedRedisConnection()
	})

	describe('PostgreSQL Integration', () => {
		it('should handle database connection pooling correctly', async () => {
			const testEvents: AuditLogEvent[] = []

			// Create multiple events to test connection pooling
			for (let i = 0; i < 20; i++) {
				testEvents.push({
					timestamp: new Date().toISOString(),
					action: 'db.pool.test',
					status: 'success',
					principalId: `pool-user-${i}`,
					targetResourceType: 'PoolResource',
					targetResourceId: `resource-${i}`,
				})
			}

			// Process events concurrently to test connection pool
			const startTime = Date.now()
			await Promise.all(testEvents.map((event) => auditService.logEvent(event)))
			const processingTime = Date.now() - startTime

			// Verify all events were stored
			const db = auditDb.getDrizzleInstance()
			const storedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'db.pool.test'`
			)

			const eventCount = (storedEvents[0] as any).count
			expect(Number(eventCount)).toBe(20)

			// Verify reasonable processing time (connection pooling should be efficient)
			expect(processingTime).toBeLessThan(5000)

			console.log(`Processed ${eventCount} events in ${processingTime}ms using connection pool`)
		})

		it('should handle database transaction rollbacks correctly', async () => {
			const testEvent: AuditLogEvent = {
				timestamp: new Date().toISOString(),
				action: 'transaction.test',
				status: 'success',
				principalId: 'transaction-user',
				targetResourceType: 'TransactionResource',
				targetResourceId: 'resource-001',
			}

			// Mock a database error during transaction
			const db = auditDb.getDrizzleInstance()
			const originalExecute = db.execute.bind(db)

			let transactionAttempted = false
			vi.spyOn(db, 'execute').mockImplementation(async (query: any) => {
				if (!transactionAttempted && query.toString().includes('INSERT')) {
					transactionAttempted = true
					throw new Error('Simulated transaction failure')
				}
				return originalExecute(query)
			})

			// Attempt to log event (should fail first time)
			await expect(auditService.logEvent(testEvent)).rejects.toThrow(
				'Simulated transaction failure'
			)

			// Restore original method and try again (should succeed)
			vi.restoreAllMocks()
			await auditService.logEvent(testEvent)

			// Verify event was stored on second attempt
			const storedEvents = await db.execute(
				sql`SELECT * FROM audit_log WHERE principal_id = 'transaction-user'`
			)

			expect(storedEvents.length).toBe(1)
		})

		it('should handle database schema migrations gracefully', async () => {
			const db = auditDb.getDrizzleInstance()

			// Test that current schema supports all required fields
			const testEvent: AuditLogEvent = {
				timestamp: new Date().toISOString(),
				action: 'schema.test',
				status: 'success',
				principalId: 'schema-user',
				targetResourceType: 'SchemaResource',
				targetResourceId: 'resource-001',
				sessionContext: {
					sessionId: 'session-001',
					ipAddress: '192.168.1.100',
					userAgent: 'Test-Agent/1.0',
				},
				dataClassification: 'PHI',
				retentionPolicy: 'healthcare-7years',
			}

			await auditService.logEvent(testEvent)

			// Verify all enhanced fields are stored correctly
			const storedEvents = await db.execute(
				sql`SELECT * FROM audit_log WHERE principal_id = 'schema-user'`
			)

			expect(storedEvents.length).toBe(1)
			const storedEvent = storedEvents[0] as any

			expect(storedEvent.hash).toBeDefined()
			expect(storedEvent.hash_algorithm).toBe('SHA-256')
			expect(storedEvent.data_classification).toBe('PHI')
			expect(storedEvent.retention_policy).toBe('healthcare-7years')
			expect(storedEvent.session_context).toBeDefined()

			const sessionContext = JSON.parse(storedEvent.session_context)
			expect(sessionContext.sessionId).toBe('session-001')
			expect(sessionContext.ipAddress).toBe('192.168.1.100')
		})

		it('should handle large audit log queries efficiently', async () => {
			// Create a large number of test events
			const largeDatasetEvents: AuditLogEvent[] = []
			for (let i = 0; i < 100; i++) {
				largeDatasetEvents.push({
					timestamp: new Date(Date.now() - i * 1000).toISOString(),
					action: 'large.dataset.test',
					status: i % 10 === 0 ? 'failure' : 'success',
					principalId: `large-user-${i % 20}`, // 20 different users
					targetResourceType: 'LargeResource',
					targetResourceId: `resource-${i}`,
				})
			}

			// Insert all events
			for (const event of largeDatasetEvents) {
				await auditService.logEvent(event)
			}

			const db = auditDb.getDrizzleInstance()

			// Test efficient querying with pagination
			const startTime = Date.now()
			const paginatedResults = await db.execute(
				sql`SELECT * FROM audit_log WHERE action = 'large.dataset.test' ORDER BY created_at DESC LIMIT 20 OFFSET 0`
			)
			const queryTime = Date.now() - startTime

			expect(paginatedResults.length).toBe(20)
			expect(queryTime).toBeLessThan(1000) // Should be fast with proper indexing

			// Test filtering by user
			const userFilterTime = Date.now()
			const userResults = await db.execute(
				sql`SELECT * FROM audit_log WHERE action = 'large.dataset.test' AND principal_id = 'large-user-5'`
			)
			const userQueryTime = Date.now() - userFilterTime

			expect(userResults.length).toBe(5) // Should find 5 events for this user
			expect(userQueryTime).toBeLessThan(500) // Should be fast with indexing

			console.log(`Paginated query: ${queryTime}ms, User filter query: ${userQueryTime}ms`)
		})
	})

	describe('Redis Integration', () => {
		it('should handle Redis connection states correctly', async () => {
			// Check initial Redis connection status
			const initialStatus = getRedisConnectionStatus()
			expect(['ready', 'connecting', 'reconnecting']).toContain(initialStatus)

			// Test Redis operations
			await redis.set('test:connection', 'test-value', 'EX', 60)
			const retrievedValue = await redis.get('test:connection')
			expect(retrievedValue).toBe('test-value')

			// Clean up
			await redis.del('test:connection')
		})

		it('should handle Redis queue operations with BullMQ', async () => {
			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'redis-integration-test',
					concurrency: 1,
					retryConfig: {
						maxRetries: 3,
						backoffStrategy: 'exponential',
						baseDelay: 100,
						maxDelay: 1000,
						retryableErrors: ['ECONNRESET'],
					},
					circuitBreakerConfig: {
						failureThreshold: 5,
						recoveryTimeout: 2000,
						monitoringPeriod: 60000,
						minimumThroughput: 5,
					},
					deadLetterConfig: {
						queueName: 'redis-integration-dlq',
						maxRetentionDays: 7,
						alertThreshold: 10,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			const testEvent: AuditLogEvent = {
				timestamp: new Date().toISOString(),
				action: 'redis.queue.test',
				status: 'success',
				principalId: 'redis-user',
			}

			// Add event to queue
			await processor.addEvent(testEvent)

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 1000))

			// Verify event was processed and stored
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT * FROM audit_log WHERE principal_id = 'redis-user'`
			)

			expect(processedEvents.length).toBe(1)

			await processor.cleanup()
		})

		it('should handle Redis memory pressure and eviction policies', async () => {
			// Test Redis memory usage with large payloads
			const largePayloadEvents: AuditLogEvent[] = []

			for (let i = 0; i < 10; i++) {
				largePayloadEvents.push({
					timestamp: new Date().toISOString(),
					action: 'redis.memory.test',
					status: 'success',
					principalId: `memory-user-${i}`,
					// Add large context data to test memory handling
					sessionContext: {
						sessionId: `session-${i}`,
						ipAddress: '192.168.1.100',
						userAgent: 'A'.repeat(1000), // Large user agent string
					},
					outcomeDescription: 'B'.repeat(2000), // Large description
				})
			}

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'redis-memory-test',
					concurrency: 2,
					retryConfig: {
						maxRetries: 2,
						backoffStrategy: 'fixed',
						baseDelay: 100,
						maxDelay: 100,
						retryableErrors: [],
					},
					circuitBreakerConfig: {
						failureThreshold: 10,
						recoveryTimeout: 1000,
						monitoringPeriod: 60000,
						minimumThroughput: 5,
					},
					deadLetterConfig: {
						queueName: 'redis-memory-dlq',
						maxRetentionDays: 1,
						alertThreshold: 20,
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
			await new Promise((resolve) => setTimeout(resolve, 2000))

			// Verify all events were processed despite large payloads
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'redis.memory.test'`
			)

			const eventCount = (processedEvents[0] as any).count
			expect(Number(eventCount)).toBe(10)

			await processor.cleanup()
		})

		it('should handle Redis failover and reconnection', async () => {
			const testEvent: AuditLogEvent = {
				timestamp: new Date().toISOString(),
				action: 'redis.failover.test',
				status: 'success',
				principalId: 'failover-user',
			}

			// Simulate Redis connection issues
			const originalStatus = redis.status

			// Mock Redis disconnect
			Object.defineProperty(redis, 'status', {
				value: 'disconnected',
				writable: true,
			})

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'redis-failover-test',
					concurrency: 1,
					retryConfig: {
						maxRetries: 5,
						backoffStrategy: 'exponential',
						baseDelay: 100,
						maxDelay: 2000,
						retryableErrors: ['ECONNRESET', 'ENOTFOUND'],
					},
					circuitBreakerConfig: {
						failureThreshold: 3,
						recoveryTimeout: 1000,
						monitoringPeriod: 60000,
						minimumThroughput: 3,
					},
					deadLetterConfig: {
						queueName: 'redis-failover-dlq',
						maxRetentionDays: 7,
						alertThreshold: 5,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			// Should handle Redis being disconnected gracefully
			expect(() => processor.start()).not.toThrow()

			// Restore Redis connection
			Object.defineProperty(redis, 'status', {
				value: originalStatus,
				writable: true,
			})

			await processor.start()
			await processor.addEvent(testEvent)

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 1000))

			// Verify event was processed after reconnection
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT * FROM audit_log WHERE principal_id = 'failover-user'`
			)

			expect(processedEvents.length).toBe(1)

			await processor.cleanup()
		})
	})

	describe('Circuit Breaker Integration', () => {
		it('should protect database from overload using circuit breaker', async () => {
			let failureCount = 0
			const maxFailures = 5

			// Create a circuit breaker for database operations
			const circuitBreaker = new CircuitBreaker(
				{
					failureThreshold: 3,
					recoveryTimeout: 1000,
					monitoringPeriod: 60000,
					minimumThroughput: 2,
				},
				'db-protection-test'
			)

			// Mock database operation that fails initially
			const mockDbOperation = async (event: AuditLogEvent) => {
				failureCount++
				if (failureCount <= maxFailures) {
					throw new Error('Database overloaded')
				}
				await auditService.logEvent(event)
			}

			const testEvents: AuditLogEvent[] = []
			for (let i = 0; i < 10; i++) {
				testEvents.push({
					timestamp: new Date().toISOString(),
					action: 'circuit.breaker.test',
					status: 'success',
					principalId: `cb-user-${i}`,
				})
			}

			let successCount = 0
			let circuitOpenCount = 0

			// Process events through circuit breaker
			for (const event of testEvents) {
				try {
					await circuitBreaker.execute(() => mockDbOperation(event))
					successCount++
				} catch (error) {
					if (error.message.includes('Circuit breaker')) {
						circuitOpenCount++
					}
				}

				// Allow time for circuit breaker recovery
				if (circuitBreaker.getState() === 'OPEN') {
					await new Promise((resolve) => setTimeout(resolve, 1100))
				}
			}

			expect(circuitBreaker.getState()).toBe('CLOSED') // Should recover
			expect(successCount).toBeGreaterThan(0)
			expect(circuitOpenCount).toBeGreaterThan(0)

			const metrics = circuitBreaker.getMetrics()
			expect(metrics.totalRequests).toBe(testEvents.length)
			expect(metrics.stateChanges.length).toBeGreaterThan(0)

			console.log(
				`Circuit breaker: ${successCount} successes, ${circuitOpenCount} circuit open rejections`
			)
		})
	})

	describe('Dead Letter Queue Integration', () => {
		it('should handle persistent failures with dead letter queue', async () => {
			const deadLetterHandler = new DeadLetterHandler(redis, {
				queueName: 'integration-dlq-test',
				maxRetentionDays: 7,
				alertThreshold: 1,
				processingInterval: 30000,
			})

			const alertCallback = vi.fn()
			deadLetterHandler.onAlert(alertCallback)

			const failingEvent: AuditLogEvent = {
				timestamp: new Date().toISOString(),
				action: 'dlq.test',
				status: 'success',
				principalId: 'dlq-user',
			}

			// Simulate persistent failure
			const persistentError = new Error('Persistent database failure')

			await deadLetterHandler.addFailedEvent(
				failingEvent,
				persistentError,
				'failed-job-123',
				'main-queue',
				[
					{ attempt: 1, timestamp: new Date().toISOString(), error: 'First failure' },
					{ attempt: 2, timestamp: new Date().toISOString(), error: 'Second failure' },
					{ attempt: 3, timestamp: new Date().toISOString(), error: 'Third failure' },
				]
			)

			// Wait for alert processing
			await new Promise((resolve) => setTimeout(resolve, 500))

			// Verify alert was triggered
			expect(alertCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					totalEvents: 1,
				})
			)

			// Verify dead letter queue statistics
			const stats = await deadLetterHandler.getStatistics()
			expect(stats.totalEvents).toBe(1)
			expect(stats.oldestEvent).toBeDefined()
		})
	})

	describe('Performance Under Load', () => {
		it('should maintain performance with concurrent database and Redis operations', async () => {
			const concurrentEvents: AuditLogEvent[] = []

			// Create 100 events for concurrent processing
			for (let i = 0; i < 100; i++) {
				concurrentEvents.push({
					timestamp: new Date().toISOString(),
					action: 'concurrent.performance.test',
					status: 'success',
					principalId: `concurrent-user-${i % 10}`, // 10 different users
					targetResourceType: 'ConcurrentResource',
					targetResourceId: `resource-${i}`,
				})
			}

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'concurrent-performance-test',
					concurrency: 5, // High concurrency
					retryConfig: {
						maxRetries: 3,
						backoffStrategy: 'exponential',
						baseDelay: 50,
						maxDelay: 500,
						retryableErrors: ['ECONNRESET'],
					},
					circuitBreakerConfig: {
						failureThreshold: 10,
						recoveryTimeout: 1000,
						monitoringPeriod: 60000,
						minimumThroughput: 10,
					},
					deadLetterConfig: {
						queueName: 'concurrent-performance-dlq',
						maxRetentionDays: 7,
						alertThreshold: 20,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			// Process all events concurrently
			const startTime = Date.now()
			await Promise.all(concurrentEvents.map((event) => processor.addEvent(event)))

			// Wait for processing to complete
			await new Promise((resolve) => setTimeout(resolve, 5000))
			const totalTime = Date.now() - startTime

			// Verify all events were processed
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'concurrent.performance.test'`
			)

			const eventCount = (processedEvents[0] as any).count
			expect(Number(eventCount)).toBe(100)

			// Verify reasonable performance (should process 100 events in under 10 seconds)
			expect(totalTime).toBeLessThan(10000)

			const eventsPerSecond = 100 / (totalTime / 1000)
			console.log(
				`Processed 100 events in ${totalTime}ms (${eventsPerSecond.toFixed(2)} events/sec)`
			)

			// Verify system health after load
			const healthStatus = await processor.getHealthStatus()
			expect(healthStatus.healthScore).toBeGreaterThan(70)

			await processor.cleanup()
		})
	})
})
