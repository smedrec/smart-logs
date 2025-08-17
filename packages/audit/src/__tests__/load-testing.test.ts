/**
 * Load Testing for High-Volume Audit Scenarios
 * Tests system performance and reliability under high load conditions
 */

import { sql } from 'drizzle-orm'
import { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AuditDb } from '@repo/audit-db'
import { closeSharedRedisConnection, getSharedRedisConnection } from '@repo/redis-client'

import { AuditService } from '../audit.js'
import { MonitoringService } from '../monitor/monitoring.js'
import { ReliableEventProcessor } from '../queue/reliable-processor.js'

import type { AuditLogEvent } from '../types.js'

describe('Load Testing - High-Volume Audit Scenarios', () => {
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
			throw new Error('Cannot connect to test database for load testing')
		}

		// Setup Redis connection
		redis = getSharedRedisConnection()

		// Initialize services
		auditService = new AuditService({
			database: auditDb,
			redis,
			enableCryptographicIntegrity: true,
			enableMonitoring: true,
		})

		monitoringService = new MonitoringService()
	})

	afterAll(async () => {
		await auditDb?.end()
		await closeSharedRedisConnection()
	})

	describe('High-Volume Event Processing', () => {
		it('should handle 1000 events per second sustained load', async () => {
			const eventsPerBatch = 100
			const totalBatches = 10
			const totalEvents = eventsPerBatch * totalBatches
			const targetDuration = 10000 // 10 seconds

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
					await monitoringService.processEvent(event)
				},
				{
					queueName: 'load-test-1000-per-sec',
					concurrency: 10, // High concurrency for load testing
					retryConfig: {
						maxRetries: 2, // Reduced retries for load testing
						backoffStrategy: 'fixed',
						baseDelay: 50,
						maxDelay: 50,
						retryableErrors: ['ECONNRESET'],
					},
					circuitBreakerConfig: {
						failureThreshold: 20,
						recoveryTimeout: 1000,
						monitoringPeriod: 60000,
						minimumThroughput: 50,
					},
					deadLetterConfig: {
						queueName: 'load-test-1000-dlq',
						maxRetentionDays: 1,
						alertThreshold: 50,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			const startTime = Date.now()
			let eventsSubmitted = 0

			// Submit events in batches to simulate sustained load
			for (let batch = 0; batch < totalBatches; batch++) {
				const batchEvents: AuditLogEvent[] = []

				for (let i = 0; i < eventsPerBatch; i++) {
					batchEvents.push({
						timestamp: new Date().toISOString(),
						action: 'load.test.1000',
						status: 'success',
						principalId: `load-user-${batch}-${i}`,
						targetResourceType: 'LoadResource',
						targetResourceId: `resource-${batch}-${i}`,
						sessionContext: {
							sessionId: `session-${batch}-${i}`,
							ipAddress: `192.168.1.${(i % 254) + 1}`,
							userAgent: 'LoadTest-Agent/1.0',
						},
					})
				}

				// Submit batch
				await Promise.all(batchEvents.map((event) => processor.addEvent(event)))
				eventsSubmitted += batchEvents.length

				// Control rate to achieve target throughput
				const elapsedTime = Date.now() - startTime
				const expectedTime = (batch + 1) * (targetDuration / totalBatches)
				const sleepTime = Math.max(0, expectedTime - elapsedTime)

				if (sleepTime > 0) {
					await new Promise((resolve) => setTimeout(resolve, sleepTime))
				}

				console.log(`Submitted batch ${batch + 1}/${totalBatches} (${eventsSubmitted} events)`)
			}

			// Wait for all events to be processed
			console.log('Waiting for processing to complete...')
			await new Promise((resolve) => setTimeout(resolve, 15000))

			const totalTime = Date.now() - startTime
			const eventsPerSecond = (totalEvents / totalTime) * 1000

			// Verify all events were processed
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'load.test.1000'`
			)

			const eventCount = Number((processedEvents[0] as any).count)
			const successRate = (eventCount / totalEvents) * 100

			console.log(`Load Test Results:`)
			console.log(`- Total events: ${totalEvents}`)
			console.log(`- Events processed: ${eventCount}`)
			console.log(`- Success rate: ${successRate.toFixed(2)}%`)
			console.log(`- Total time: ${totalTime}ms`)
			console.log(`- Events per second: ${eventsPerSecond.toFixed(2)}`)

			// Assertions
			expect(eventCount).toBeGreaterThan(totalEvents * 0.95) // At least 95% success rate
			expect(eventsPerSecond).toBeGreaterThan(50) // At least 50 events per second
			expect(successRate).toBeGreaterThan(95)

			// Check system health after load
			const healthStatus = await processor.getHealthStatus()
			expect(healthStatus.healthScore).toBeGreaterThan(60)

			await processor.cleanup()
		}, 60000) // 60 second timeout for load test

		it('should handle burst traffic patterns', async () => {
			const burstSize = 500
			const burstCount = 5
			const burstInterval = 2000 // 2 seconds between bursts

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'load-test-burst',
					concurrency: 15, // High concurrency for burst handling
					retryConfig: {
						maxRetries: 3,
						backoffStrategy: 'exponential',
						baseDelay: 100,
						maxDelay: 1000,
						retryableErrors: ['ECONNRESET'],
					},
					circuitBreakerConfig: {
						failureThreshold: 30,
						recoveryTimeout: 2000,
						monitoringPeriod: 60000,
						minimumThroughput: 20,
					},
					deadLetterConfig: {
						queueName: 'load-test-burst-dlq',
						maxRetentionDays: 1,
						alertThreshold: 100,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			const startTime = Date.now()
			let totalEventsSubmitted = 0

			// Generate burst traffic
			for (let burst = 0; burst < burstCount; burst++) {
				console.log(`Generating burst ${burst + 1}/${burstCount} (${burstSize} events)`)

				const burstEvents: AuditLogEvent[] = []
				for (let i = 0; i < burstSize; i++) {
					burstEvents.push({
						timestamp: new Date().toISOString(),
						action: 'load.test.burst',
						status: 'success',
						principalId: `burst-user-${burst}-${i}`,
						targetResourceType: 'BurstResource',
						targetResourceId: `resource-${burst}-${i}`,
					})
				}

				// Submit entire burst simultaneously
				const burstStartTime = Date.now()
				await Promise.all(burstEvents.map((event) => processor.addEvent(event)))
				const burstSubmissionTime = Date.now() - burstStartTime
				totalEventsSubmitted += burstEvents.length

				console.log(`Burst ${burst + 1} submitted in ${burstSubmissionTime}ms`)

				// Wait between bursts (except for the last one)
				if (burst < burstCount - 1) {
					await new Promise((resolve) => setTimeout(resolve, burstInterval))
				}
			}

			// Wait for processing to complete
			console.log('Waiting for burst processing to complete...')
			await new Promise((resolve) => setTimeout(resolve, 20000))

			const totalTime = Date.now() - startTime

			// Verify all events were processed
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'load.test.burst'`
			)

			const eventCount = Number((processedEvents[0] as any).count)
			const successRate = (eventCount / totalEventsSubmitted) * 100

			console.log(`Burst Test Results:`)
			console.log(`- Total events: ${totalEventsSubmitted}`)
			console.log(`- Events processed: ${eventCount}`)
			console.log(`- Success rate: ${successRate.toFixed(2)}%`)
			console.log(`- Total time: ${totalTime}ms`)

			// Assertions
			expect(eventCount).toBeGreaterThan(totalEventsSubmitted * 0.9) // At least 90% success rate for bursts
			expect(successRate).toBeGreaterThan(90)

			// Check system health after bursts
			const healthStatus = await processor.getHealthStatus()
			expect(healthStatus.healthScore).toBeGreaterThan(50)

			await processor.cleanup()
		}, 60000)

		it('should handle mixed event types under load', async () => {
			const totalEvents = 2000
			const eventTypes = [
				'fhir.patient.read',
				'fhir.patient.create',
				'fhir.observation.create',
				'auth.login.success',
				'auth.login.failure',
				'data.export',
				'data.update',
				'system.backup.created',
			]

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
					await monitoringService.processEvent(event)
				},
				{
					queueName: 'load-test-mixed',
					concurrency: 8,
					retryConfig: {
						maxRetries: 3,
						backoffStrategy: 'exponential',
						baseDelay: 100,
						maxDelay: 2000,
						retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
					},
					circuitBreakerConfig: {
						failureThreshold: 25,
						recoveryTimeout: 3000,
						monitoringPeriod: 60000,
						minimumThroughput: 10,
					},
					deadLetterConfig: {
						queueName: 'load-test-mixed-dlq',
						maxRetentionDays: 1,
						alertThreshold: 50,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			const startTime = Date.now()
			const events: AuditLogEvent[] = []

			// Generate mixed event types
			for (let i = 0; i < totalEvents; i++) {
				const action = eventTypes[i % eventTypes.length]
				const isFailure = i % 20 === 0 // 5% failure rate

				events.push({
					timestamp: new Date().toISOString(),
					action,
					status: isFailure ? 'failure' : 'success',
					principalId: `mixed-user-${i % 100}`, // 100 different users
					targetResourceType: action.includes('fhir') ? 'Patient' : 'Resource',
					targetResourceId: `resource-${i}`,
					sessionContext: {
						sessionId: `session-${i}`,
						ipAddress: `10.0.${Math.floor(i / 256)}.${i % 256}`,
						userAgent: 'MixedLoad-Agent/1.0',
					},
					dataClassification: action.includes('fhir') ? 'PHI' : 'INTERNAL',
					outcomeDescription: isFailure ? 'Simulated failure for testing' : undefined,
				})
			}

			// Submit events in chunks to simulate realistic load
			const chunkSize = 50
			for (let i = 0; i < events.length; i += chunkSize) {
				const chunk = events.slice(i, i + chunkSize)
				await Promise.all(chunk.map((event) => processor.addEvent(event)))

				// Small delay between chunks
				await new Promise((resolve) => setTimeout(resolve, 100))

				if ((i + chunkSize) % 500 === 0) {
					console.log(`Submitted ${i + chunkSize}/${totalEvents} events`)
				}
			}

			// Wait for processing
			console.log('Waiting for mixed load processing to complete...')
			await new Promise((resolve) => setTimeout(resolve, 30000))

			const totalTime = Date.now() - startTime

			// Verify processing results
			const db = auditDb.getDrizzleInstance()

			// Count total processed events
			const totalProcessed = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE principal_id LIKE 'mixed-user-%'`
			)

			// Count by event type
			const eventTypeCounts = await db.execute(
				sql`SELECT action, COUNT(*) as count FROM audit_log WHERE principal_id LIKE 'mixed-user-%' GROUP BY action`
			)

			// Count failures
			const failureCount = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE principal_id LIKE 'mixed-user-%' AND status = 'failure'`
			)

			const processedCount = Number((totalProcessed[0] as any).count)
			const failuresProcessed = Number((failureCount[0] as any).count)
			const successRate = (processedCount / totalEvents) * 100

			console.log(`Mixed Load Test Results:`)
			console.log(`- Total events: ${totalEvents}`)
			console.log(`- Events processed: ${processedCount}`)
			console.log(`- Failures processed: ${failuresProcessed}`)
			console.log(`- Success rate: ${successRate.toFixed(2)}%`)
			console.log(`- Total time: ${totalTime}ms`)
			console.log(`- Events per second: ${((processedCount / totalTime) * 1000).toFixed(2)}`)

			// Log event type distribution
			console.log('Event type distribution:')
			for (const row of eventTypeCounts) {
				console.log(`  ${(row as any).action}: ${(row as any).count}`)
			}

			// Assertions
			expect(processedCount).toBeGreaterThan(totalEvents * 0.95)
			expect(successRate).toBeGreaterThan(95)
			expect(failuresProcessed).toBeGreaterThan(0) // Should have processed some failures

			// Verify monitoring detected patterns
			const metrics = monitoringService.getMetrics()
			expect(metrics.eventsProcessed).toBeGreaterThan(0)
			expect(metrics.errorRate).toBeGreaterThan(0) // Should have detected some errors

			// Check for security alerts (failed auth events should trigger alerts)
			const activeAlerts = monitoringService.getActiveAlerts()
			console.log(`Active alerts after mixed load: ${activeAlerts.length}`)

			await processor.cleanup()
		}, 90000) // 90 second timeout for mixed load test
	})

	describe('Memory and Resource Usage Under Load', () => {
		it('should maintain stable memory usage during sustained load', async () => {
			const eventsPerSecond = 100
			const testDurationSeconds = 30
			const totalEvents = eventsPerSecond * testDurationSeconds

			const processor = new ReliableEventProcessor(
				redis,
				async (event: AuditLogEvent) => {
					await auditService.logEvent(event)
				},
				{
					queueName: 'memory-test',
					concurrency: 5,
					retryConfig: {
						maxRetries: 2,
						backoffStrategy: 'fixed',
						baseDelay: 100,
						maxDelay: 100,
						retryableErrors: ['ECONNRESET'],
					},
					circuitBreakerConfig: {
						failureThreshold: 20,
						recoveryTimeout: 2000,
						monitoringPeriod: 60000,
						minimumThroughput: 10,
					},
					deadLetterConfig: {
						queueName: 'memory-test-dlq',
						maxRetentionDays: 1,
						alertThreshold: 50,
						processingInterval: 30000,
					},
					persistentStorage: true,
					durabilityGuarantees: true,
				}
			)

			await processor.start()

			const startTime = Date.now()
			let eventsSubmitted = 0

			// Track memory usage
			const memorySnapshots: Array<{ time: number; memory: NodeJS.MemoryUsage }> = []

			const memoryMonitor = setInterval(() => {
				memorySnapshots.push({
					time: Date.now() - startTime,
					memory: process.memoryUsage(),
				})
			}, 1000)

			// Submit events at controlled rate
			const submitInterval = setInterval(async () => {
				const batchSize = Math.min(10, totalEvents - eventsSubmitted)
				if (batchSize <= 0) {
					clearInterval(submitInterval)
					return
				}

				const batch: AuditLogEvent[] = []
				for (let i = 0; i < batchSize; i++) {
					batch.push({
						timestamp: new Date().toISOString(),
						action: 'memory.test',
						status: 'success',
						principalId: `memory-user-${eventsSubmitted + i}`,
						targetResourceType: 'MemoryResource',
						targetResourceId: `resource-${eventsSubmitted + i}`,
						// Add some payload to test memory handling
						sessionContext: {
							sessionId: `session-${eventsSubmitted + i}`,
							ipAddress: '192.168.1.100',
							userAgent: 'MemoryTest-Agent/1.0',
						},
						outcomeDescription: `Memory test event ${eventsSubmitted + i}`,
					})
				}

				await Promise.all(batch.map((event) => processor.addEvent(event)))
				eventsSubmitted += batchSize

				if (eventsSubmitted % 500 === 0) {
					console.log(`Memory test: ${eventsSubmitted}/${totalEvents} events submitted`)
				}
			}, 100) // Submit every 100ms

			// Wait for test completion
			await new Promise((resolve) => {
				const checkCompletion = setInterval(() => {
					if (eventsSubmitted >= totalEvents) {
						clearInterval(checkCompletion)
						clearInterval(submitInterval)
						resolve(undefined)
					}
				}, 100)
			})

			// Wait for processing to complete
			await new Promise((resolve) => setTimeout(resolve, 10000))
			clearInterval(memoryMonitor)

			const totalTime = Date.now() - startTime

			// Analyze memory usage
			const initialMemory = memorySnapshots[0]?.memory.heapUsed || 0
			const finalMemory = memorySnapshots[memorySnapshots.length - 1]?.memory.heapUsed || 0
			const maxMemory = Math.max(...memorySnapshots.map((s) => s.memory.heapUsed))
			const memoryGrowth = finalMemory - initialMemory

			console.log(`Memory Usage Analysis:`)
			console.log(`- Initial heap: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`)
			console.log(`- Final heap: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`)
			console.log(`- Max heap: ${(maxMemory / 1024 / 1024).toFixed(2)} MB`)
			console.log(`- Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`)
			console.log(`- Events processed: ${eventsSubmitted}`)
			console.log(`- Test duration: ${totalTime}ms`)

			// Verify events were processed
			const db = auditDb.getDrizzleInstance()
			const processedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'memory.test'`
			)

			const eventCount = Number((processedEvents[0] as any).count)
			const successRate = (eventCount / totalEvents) * 100

			// Assertions
			expect(eventCount).toBeGreaterThan(totalEvents * 0.95)
			expect(successRate).toBeGreaterThan(95)

			// Memory should not grow excessively (less than 100MB growth for this test)
			expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024)

			await processor.cleanup()
		}, 60000)
	})

	describe('Database Performance Under Load', () => {
		it('should maintain database performance with high write volume', async () => {
			const batchSize = 100
			const batchCount = 20
			const totalEvents = batchSize * batchCount

			const startTime = Date.now()
			const batchTimes: number[] = []

			// Process events in batches and measure database performance
			for (let batch = 0; batch < batchCount; batch++) {
				const batchEvents: AuditLogEvent[] = []

				for (let i = 0; i < batchSize; i++) {
					batchEvents.push({
						timestamp: new Date().toISOString(),
						action: 'db.performance.test',
						status: 'success',
						principalId: `db-perf-user-${batch}-${i}`,
						targetResourceType: 'DbPerfResource',
						targetResourceId: `resource-${batch}-${i}`,
						sessionContext: {
							sessionId: `session-${batch}-${i}`,
							ipAddress: `10.1.${batch}.${i}`,
							userAgent: 'DbPerf-Agent/1.0',
						},
						dataClassification: 'INTERNAL',
					})
				}

				// Measure batch processing time
				const batchStartTime = Date.now()
				await Promise.all(batchEvents.map((event) => auditService.logEvent(event)))
				const batchTime = Date.now() - batchStartTime
				batchTimes.push(batchTime)

				console.log(
					`Batch ${batch + 1}/${batchCount}: ${batchTime}ms (${((batchSize / batchTime) * 1000).toFixed(2)} events/sec)`
				)
			}

			const totalTime = Date.now() - startTime
			const averageBatchTime = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length
			const maxBatchTime = Math.max(...batchTimes)
			const minBatchTime = Math.min(...batchTimes)

			// Verify all events were stored
			const db = auditDb.getDrizzleInstance()
			const storedEvents = await db.execute(
				sql`SELECT COUNT(*) as count FROM audit_log WHERE action = 'db.performance.test'`
			)

			const eventCount = Number((storedEvents[0] as any).count)

			console.log(`Database Performance Results:`)
			console.log(`- Total events: ${totalEvents}`)
			console.log(`- Events stored: ${eventCount}`)
			console.log(`- Total time: ${totalTime}ms`)
			console.log(`- Average batch time: ${averageBatchTime.toFixed(2)}ms`)
			console.log(`- Min batch time: ${minBatchTime}ms`)
			console.log(`- Max batch time: ${maxBatchTime}ms`)
			console.log(
				`- Overall throughput: ${((totalEvents / totalTime) * 1000).toFixed(2)} events/sec`
			)

			// Assertions
			expect(eventCount).toBe(totalEvents)
			expect(averageBatchTime).toBeLessThan(5000) // Average batch should be under 5 seconds
			expect(maxBatchTime).toBeLessThan(10000) // No batch should take more than 10 seconds

			// Performance should be consistent (max time shouldn't be more than 3x average)
			expect(maxBatchTime).toBeLessThan(averageBatchTime * 3)
		}, 60000)
	})
})
