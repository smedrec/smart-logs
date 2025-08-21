/**
 * Performance tests and benchmarks for database operations
 * Requirements 7.1, 7.2, 7.3, 7.4: Performance testing and benchmarking
 */

import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { EnhancedDatabaseClient } from '../db/connection-pool.js'
import { AuditDb } from '../db/index.js'
import { DatabasePartitionManager } from '../db/partitioning.js'
import { DatabasePerformanceMonitor } from '../db/performance-monitoring.js'
import { auditLog } from '../db/schema.js'

import type { AuditLogEvent } from '@repo/audit'

interface BenchmarkResult {
	operation: string
	recordCount: number
	totalTime: number
	averageTime: number
	throughput: number
	memoryUsage: number
}

interface PerformanceTestConfig {
	smallDataset: number
	mediumDataset: number
	largeDataset: number
	concurrentConnections: number
	testDuration: number
}

const TEST_CONFIG: PerformanceTestConfig = {
	smallDataset: 1000,
	mediumDataset: 10000,
	largeDataset: 100000,
	concurrentConnections: 10,
	testDuration: 30000, // 30 seconds
}

describe('Database Performance Tests', () => {
	let auditDb: AuditDb
	let partitionManager: DatabasePartitionManager
	let performanceMonitor: DatabasePerformanceMonitor
	let enhancedClient: EnhancedDatabaseClient
	let testResults: BenchmarkResult[] = []

	beforeAll(async () => {
		// Setup test database connection
		auditDb = new AuditDb(process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test')

		const db = auditDb.getDrizzleInstance()
		partitionManager = new DatabasePartitionManager(db)
		performanceMonitor = new DatabasePerformanceMonitor(db)

		enhancedClient = new EnhancedDatabaseClient(
			{
				url: process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test',
				minConnections: 2,
				maxConnections: 20,
				idleTimeout: 30000,
				acquireTimeout: 10000,
				validateConnections: true,
				retryAttempts: 3,
				retryDelay: 1000,
			},
			{
				enabled: true,
				maxSizeMB: 100,
				defaultTTL: 300,
				maxQueries: 1000,
				keyPrefix: 'audit_test',
			}
		)

		// Enable performance monitoring
		await performanceMonitor.enableMonitoring()

		// Ensure clean test environment
		await cleanupTestData()
	})

	afterAll(async () => {
		// Cleanup and close connections
		await cleanupTestData()
		await enhancedClient.close()
		await auditDb.end()

		// Print performance summary
		console.log('\n=== Performance Test Results ===')
		testResults.forEach((result) => {
			console.log(`${result.operation}:`)
			console.log(`  Records: ${result.recordCount}`)
			console.log(`  Total Time: ${result.totalTime}ms`)
			console.log(`  Average Time: ${result.averageTime.toFixed(2)}ms`)
			console.log(`  Throughput: ${result.throughput.toFixed(2)} ops/sec`)
			console.log(`  Memory Usage: ${(result.memoryUsage / 1024 / 1024).toFixed(2)}MB`)
			console.log('')
		})
	})

	beforeEach(async () => {
		// Clean up before each test
		await cleanupTestData()
	})

	describe('Insert Performance', () => {
		it('should benchmark single insert operations', async () => {
			const result = await benchmarkOperation(
				'Single Insert',
				TEST_CONFIG.smallDataset,
				async () => {
					const event = createTestAuditEvent()
					await auditDb.getDrizzleInstance().insert(auditLog).values(event)
				}
			)

			testResults.push(result)

			// Performance assertions
			expect(result.averageTime).toBeLessThan(50) // < 50ms per insert
			expect(result.throughput).toBeGreaterThan(20) // > 20 ops/sec
		})

		it('should benchmark batch insert operations', async () => {
			const batchSize = 100
			const batches = TEST_CONFIG.mediumDataset / batchSize

			const result = await benchmarkOperation('Batch Insert', batches, async () => {
				const events = Array.from({ length: batchSize }, () => createTestAuditEvent())
				await auditDb.getDrizzleInstance().insert(auditLog).values(events)
			})

			testResults.push(result)

			// Performance assertions
			expect(result.averageTime).toBeLessThan(1000) // < 1s per batch
			expect(result.throughput).toBeGreaterThan(1) // > 1 batch/sec
		})

		it('should benchmark concurrent insert operations', async () => {
			const concurrentOps = TEST_CONFIG.concurrentConnections
			const opsPerConnection = TEST_CONFIG.smallDataset / concurrentOps

			const startTime = Date.now()
			const promises = Array.from({ length: concurrentOps }, async () => {
				for (let i = 0; i < opsPerConnection; i++) {
					const event = createTestAuditEvent()
					await enhancedClient.executeQueryUncached(async (db) => {
						return db.insert(auditLog).values(event)
					})
				}
			})

			await Promise.all(promises)
			const totalTime = Date.now() - startTime

			const result: BenchmarkResult = {
				operation: 'Concurrent Insert',
				recordCount: TEST_CONFIG.smallDataset,
				totalTime,
				averageTime: totalTime / TEST_CONFIG.smallDataset,
				throughput: (TEST_CONFIG.smallDataset / totalTime) * 1000,
				memoryUsage: process.memoryUsage().heapUsed,
			}

			testResults.push(result)

			// Performance assertions
			expect(result.throughput).toBeGreaterThan(50) // > 50 ops/sec with concurrency
		})
	})

	describe('Query Performance', () => {
		beforeEach(async () => {
			// Insert test data for query tests
			const events = Array.from({ length: TEST_CONFIG.mediumDataset }, (_, i) =>
				createTestAuditEvent(`org_${i % 10}`, `user_${i % 100}`)
			)

			// Insert in batches to avoid memory issues
			const batchSize = 1000
			for (let i = 0; i < events.length; i += batchSize) {
				const batch = events.slice(i, i + batchSize)
				await auditDb.getDrizzleInstance().insert(auditLog).values(batch)
			}
		})

		it('should benchmark simple select queries', async () => {
			const result = await benchmarkOperation('Simple Select', 100, async () => {
				await auditDb.getDrizzleInstance().select().from(auditLog).limit(100)
			})

			testResults.push(result)

			// Performance assertions
			expect(result.averageTime).toBeLessThan(100) // < 100ms per query
		})

		it('should benchmark filtered queries with indexes', async () => {
			const result = await benchmarkOperation('Filtered Query (Indexed)', 100, async () => {
				await auditDb
					.getDrizzleInstance()
					.select()
					.from(auditLog)
					.where(sql`organization_id = 'org_1'`)
					.limit(100)
			})

			testResults.push(result)

			// Performance assertions
			expect(result.averageTime).toBeLessThan(50) // < 50ms per indexed query
		})

		it('should benchmark complex queries with joins and aggregations', async () => {
			const result = await benchmarkOperation('Complex Aggregation Query', 50, async () => {
				await auditDb
					.getDrizzleInstance()
					.select({
						organizationId: auditLog.organizationId,
						count: sql<number>`count(*)`,
						avgLatency: sql<number>`avg(processing_latency)`,
					})
					.from(auditLog)
					.groupBy(auditLog.organizationId)
					.having(sql`count(*) > 10`)
			})

			testResults.push(result)

			// Performance assertions
			expect(result.averageTime).toBeLessThan(500) // < 500ms per complex query
		})

		it('should benchmark query caching performance', async () => {
			const cacheKey = 'test_query_cache'

			// First query (cache miss)
			const missResult = await benchmarkOperation('Query Cache Miss', 10, async () => {
				await enhancedClient.executeQuery(
					async (db) => db.select().from(auditLog).limit(100),
					`${cacheKey}_${Math.random()}`
				)
			})

			// Second query (cache hit)
			const hitResult = await benchmarkOperation('Query Cache Hit', 100, async () => {
				await enhancedClient.executeQuery(
					async (db) => db.select().from(auditLog).limit(100),
					cacheKey
				)
			})

			testResults.push(missResult)
			testResults.push(hitResult)

			// Cache should be significantly faster
			expect(hitResult.averageTime).toBeLessThan(missResult.averageTime * 0.1)
		})
	})

	describe('Partition Performance', () => {
		it('should benchmark partition creation', async () => {
			const result = await benchmarkOperation('Partition Creation', 1, async () => {
				await partitionManager.createAuditLogPartitions({
					strategy: 'range',
					partitionColumn: 'timestamp',
					interval: 'monthly',
					retentionDays: 365,
				})
			})

			testResults.push(result)

			// Partition creation should be reasonably fast
			expect(result.totalTime).toBeLessThan(30000) // < 30 seconds
		})

		it('should benchmark partitioned table queries', async () => {
			// Create partitions first
			await partitionManager.createAuditLogPartitions({
				strategy: 'range',
				partitionColumn: 'timestamp',
				interval: 'monthly',
				retentionDays: 365,
			})

			// Insert data across multiple partitions
			const events = Array.from({ length: TEST_CONFIG.mediumDataset }, (_, i) => {
				const event = createTestAuditEvent()
				// Spread events across different months
				const monthOffset = i % 12
				const date = new Date()
				date.setMonth(date.getMonth() - monthOffset)
				event.timestamp = date.toISOString()
				return event
			})

			await auditDb.getDrizzleInstance().insert(auditLog).values(events)

			// Benchmark queries on partitioned table
			const result = await benchmarkOperation('Partitioned Query', 50, async () => {
				const oneMonthAgo = new Date()
				oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

				await auditDb
					.getDrizzleInstance()
					.select()
					.from(auditLog)
					.where(sql`timestamp >= ${oneMonthAgo.toISOString()}`)
					.limit(1000)
			})

			testResults.push(result)

			// Partitioned queries should be efficient
			expect(result.averageTime).toBeLessThan(200) // < 200ms per partitioned query
		})
	})

	describe('Connection Pool Performance', () => {
		it('should benchmark connection pool efficiency', async () => {
			const concurrentQueries = 20
			const queriesPerConnection = 50

			const result = await benchmarkOperation('Connection Pool Stress Test', 1, async () => {
				const promises = Array.from({ length: concurrentQueries }, async () => {
					for (let i = 0; i < queriesPerConnection; i++) {
						await enhancedClient.executeQueryUncached(async (db) => {
							return db.select().from(auditLog).limit(10)
						})
					}
				})

				await Promise.all(promises)
			})

			testResults.push(result)

			// Connection pool should handle concurrent load efficiently
			expect(result.totalTime).toBeLessThan(60000) // < 60 seconds for stress test

			// Check pool statistics
			const stats = enhancedClient.getStats()
			expect(stats.connectionPool.successfulConnections).toBeGreaterThan(0)
			expect(stats.connectionPool.failedConnections).toBe(0)
		})

		it('should benchmark connection acquisition time', async () => {
			const acquisitionTimes: number[] = []

			for (let i = 0; i < 100; i++) {
				const startTime = Date.now()
				await enhancedClient.executeQueryUncached(async (db) => {
					return db.select().from(auditLog).limit(1)
				})
				acquisitionTimes.push(Date.now() - startTime)
			}

			const avgAcquisitionTime =
				acquisitionTimes.reduce((a, b) => a + b, 0) / acquisitionTimes.length
			const maxAcquisitionTime = Math.max(...acquisitionTimes)

			// Connection acquisition should be fast
			expect(avgAcquisitionTime).toBeLessThan(100) // < 100ms average
			expect(maxAcquisitionTime).toBeLessThan(1000) // < 1s maximum
		})
	})

	describe('Index Performance', () => {
		beforeEach(async () => {
			// Insert large dataset for index testing
			const events = Array.from({ length: TEST_CONFIG.largeDataset }, (_, i) =>
				createTestAuditEvent(`org_${i % 100}`, `user_${i % 1000}`)
			)

			// Insert in batches
			const batchSize = 1000
			for (let i = 0; i < events.length; i += batchSize) {
				const batch = events.slice(i, i + batchSize)
				await auditDb.getDrizzleInstance().insert(auditLog).values(batch)
			}
		})

		it('should benchmark index scan vs sequential scan', async () => {
			// Query using index
			const indexResult = await benchmarkOperation('Index Scan Query', 50, async () => {
				await auditDb
					.getDrizzleInstance()
					.select()
					.from(auditLog)
					.where(sql`organization_id = 'org_1'`)
			})

			// Force sequential scan for comparison
			const seqResult = await benchmarkOperation('Sequential Scan Query', 10, async () => {
				await auditDb
					.getDrizzleInstance()
					.execute(sql`SET enable_indexscan = off; SET enable_bitmapscan = off;`)
				await auditDb
					.getDrizzleInstance()
					.select()
					.from(auditLog)
					.where(sql`organization_id = 'org_1'`)
				await auditDb
					.getDrizzleInstance()
					.execute(sql`SET enable_indexscan = on; SET enable_bitmapscan = on;`)
			})

			testResults.push(indexResult)
			testResults.push(seqResult)

			// Index scan should be significantly faster
			expect(indexResult.averageTime).toBeLessThan(seqResult.averageTime * 0.5)
		})

		it('should benchmark composite index performance', async () => {
			const result = await benchmarkOperation('Composite Index Query', 100, async () => {
				await auditDb
					.getDrizzleInstance()
					.select()
					.from(auditLog)
					.where(sql`organization_id = 'org_1' AND action = 'user.login'`)
					.orderBy(auditLog.timestamp)
			})

			testResults.push(result)

			// Composite index queries should be efficient
			expect(result.averageTime).toBeLessThan(100) // < 100ms per composite query
		})
	})

	// Helper functions
	async function benchmarkOperation(
		operationName: string,
		iterations: number,
		operation: () => Promise<void>
	): Promise<BenchmarkResult> {
		const startMemory = process.memoryUsage().heapUsed
		const startTime = Date.now()

		for (let i = 0; i < iterations; i++) {
			await operation()
		}

		const totalTime = Date.now() - startTime
		const endMemory = process.memoryUsage().heapUsed

		return {
			operation: operationName,
			recordCount: iterations,
			totalTime,
			averageTime: totalTime / iterations,
			throughput: (iterations / totalTime) * 1000,
			memoryUsage: endMemory - startMemory,
		}
	}

	function createTestAuditEvent(
		organizationId = 'test_org',
		principalId = 'test_user'
	): Omit<typeof auditLog.$inferInsert, 'id'> {
		return {
			timestamp: new Date().toISOString(),
			principalId,
			organizationId,
			action: 'user.login',
			status: 'success',
			targetResourceType: 'User',
			targetResourceId: principalId,
			outcomeDescription: 'User logged in successfully',
			hash: 'test_hash_' + Math.random().toString(36).substring(7),
			hashAlgorithm: 'SHA-256',
			eventVersion: '1.0',
			correlationId: 'test_correlation_' + Math.random().toString(36).substring(7),
			dataClassification: 'INTERNAL',
			retentionPolicy: 'standard',
			processingLatency: Math.floor(Math.random() * 100),
			details: {
				userAgent: 'test-agent',
				ipAddress: '127.0.0.1',
				sessionId: 'test_session_' + Math.random().toString(36).substring(7),
			},
		}
	}

	async function cleanupTestData(): Promise<void> {
		try {
			// Clean up test data
			await auditDb.getDrizzleInstance().delete(auditLog)

			// Drop test partitions
			const partitions = await partitionManager.getPartitionInfo()
			for (const partition of partitions) {
				try {
					await auditDb
						.getDrizzleInstance()
						.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(partition.partitionName)}`)
				} catch (error) {
					// Ignore errors for non-existent partitions
				}
			}
		} catch (error) {
			console.warn('Cleanup failed:', error)
		}
	}
})

describe('Performance Monitoring Integration', () => {
	let auditDb: AuditDb
	let performanceMonitor: DatabasePerformanceMonitor

	beforeAll(async () => {
		auditDb = new AuditDb(process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test')
		performanceMonitor = new DatabasePerformanceMonitor(auditDb.getDrizzleInstance())
		await performanceMonitor.enableMonitoring()
	})

	afterAll(async () => {
		await auditDb.end()
	})

	it('should collect and analyze performance metrics', async () => {
		// Generate some query load
		for (let i = 0; i < 10; i++) {
			await auditDb.getDrizzleInstance().select().from(auditLog).limit(10)
		}

		// Get performance summary
		const summary = await performanceMonitor.getPerformanceSummary()

		expect(summary).toBeDefined()
		expect(summary.tableStats).toBeInstanceOf(Array)
		expect(summary.indexSuggestions).toBeInstanceOf(Array)
		expect(typeof summary.cacheHitRatio).toBe('number')
		expect(typeof summary.totalDatabaseSize).toBe('number')
	})

	it('should identify slow queries', async () => {
		// Execute a potentially slow query
		await auditDb
			.getDrizzleInstance()
			.execute(sql`SELECT * FROM audit_log WHERE details::text LIKE '%test%'`)

		const slowQueries = await performanceMonitor.getSlowQueries(10, 0)
		expect(slowQueries).toBeInstanceOf(Array)
	})

	it('should provide index usage statistics', async () => {
		const indexStats = await performanceMonitor.getIndexUsageStats()
		expect(indexStats).toBeInstanceOf(Array)

		if (indexStats.length > 0) {
			const stat = indexStats[0]
			expect(stat).toHaveProperty('schemaName')
			expect(stat).toHaveProperty('tableName')
			expect(stat).toHaveProperty('indexName')
			expect(typeof stat.indexScans).toBe('number')
		}
	})

	it('should suggest performance optimizations', async () => {
		const suggestions = await performanceMonitor.suggestMissingIndexes()
		expect(suggestions).toBeInstanceOf(Array)
	})
})
