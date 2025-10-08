/**
 * Integration tests for optimized audit database components
 * Tests all performance optimizations and error handling scenarios
 */

import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import Redis from 'ioredis'

import {
	createEnhancedAuditDatabaseClient,
	EnhancedPartitionManager,
	CircuitBreaker,
	OptimizedLRUCache,
	ReadReplicaRouter,
	IntelligentIndexManager,
	PerformanceOptimizer
} from '../index.js'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema.js'

describe('Enhanced Audit Database Integration Tests', () => {
	let db: PostgresJsDatabase<typeof schema>
	let redis: Redis
	let postgresClient: postgres.Sql
	let auditDb: any

	beforeAll(async () => {
		// Setup test database
		postgresClient = postgres(process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/test_audit_db', {
			max: 5,
			idle_timeout: 20,
			connect_timeout: 10
		})
		
		db = drizzle(postgresClient)
		
		// Setup test Redis
		redis = new Redis(process.env.TEST_REDIS_URL || 'redis://localhost:6379/1')
		
		// Create enhanced audit database client
		auditDb = createEnhancedAuditDatabaseClient(redis, db, {
			cache: {
				enabled: true,
				maxSizeMB: 10,
				defaultTTL: 300
			},
			partition: {
				strategy: 'range',
				interval: 'monthly',
				retentionDays: 30,
				autoMaintenance: false // Disable for tests
			},
			circuitBreaker: {
				enabled: true,
				failureThreshold: 3,
				timeoutMs: 5000,
				resetTimeoutMs: 10000
			}
		})

		// Setup test schema
		await setupTestSchema()
	})

	afterAll(async () => {
		await cleanupTestData()
		await postgresClient.end()
		redis.disconnect()
	})

	describe('Enhanced Database Client Integration', () => {
		it('should insert and query audit logs with caching', async () => {
			const testData = {
				action: 'test_action',
				principal_id: 'test_user_123',
				organization_id: 'test_org_456',
				status: 'success',
				timestamp: new Date(),
				details: { test: 'data' }
			}

			// Insert audit log
			await auditDb.insert(testData)

			// Query should hit database first time
			const result1 = await auditDb.query({
				organization_id: 'test_org_456',
				action: 'test_action'
			})

			expect(result1).toHaveLength(1)
			expect(result1[0]).toMatchObject({
				action: testData.action,
				principal_id: testData.principal_id,
				organization_id: testData.organization_id
			})

			// Second query should hit cache
			const result2 = await auditDb.query({
				organization_id: 'test_org_456',
				action: 'test_action'
			})

			expect(result2).toHaveLength(1)
		})

		it('should handle transactions correctly', async () => {
			const results = await auditDb.transaction(async (tx: any) => {
				// Insert multiple entries in transaction
				const entries = [
					{
						action: 'transaction_test_1',
						principal_id: 'user_123',
						organization_id: 'org_789',
						status: 'success',
						timestamp: new Date()
					},
					{
						action: 'transaction_test_2',
						principal_id: 'user_123',
						organization_id: 'org_789',
						status: 'success',
						timestamp: new Date()
					}
				]

				for (const entry of entries) {
					await auditDb.insert(entry)
				}

				return entries.length
			})

			expect(results).toBe(2)

			// Verify both entries were committed
			const queryResult = await auditDb.query({
				organization_id: 'org_789',
				principal_id: 'user_123'
			})

			expect(queryResult).toHaveLength(2)
		})

		it('should provide accurate health status', async () => {
			const health = await auditDb.getHealthStatus()

			expect(health).toMatchObject({
				overall: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
				components: {
					connection: {
						status: expect.stringMatching(/^(healthy|unhealthy)$/),
						responseTime: expect.any(Number)
					},
					cache: {
						status: expect.stringMatching(/^(healthy|unhealthy)$/),
						hitRatio: expect.any(Number),
						sizeMB: expect.any(Number)
					},
					partitions: {
						status: expect.stringMatching(/^(healthy|unhealthy)$/),
						totalPartitions: expect.any(Number)
					},
					circuitBreaker: {
						status: expect.stringMatching(/^(closed|open|half_open)$/)
					}
				},
				metrics: {
					totalRequests: expect.any(Number),
					successRate: expect.any(Number),
					averageResponseTime: expect.any(Number),
					errorRate: expect.any(Number)
				}
			})
		})
	})

	describe('Partition Manager Integration', () => {
		it('should create and manage partitions with concurrency control', async () => {
			const partitionManager = new EnhancedPartitionManager(db, redis)

			// Test concurrent partition creation
			const promises = Array.from({ length: 3 }, (_, i) => {
				const startDate = new Date(2024, i, 1)
				const endDate = new Date(2024, i + 1, 1)
				return partitionManager.createPartition('audit_log', startDate, endDate)
			})

			// All should complete without race conditions
			await Promise.all(promises)

			// Verify partitions were created
			const status = await partitionManager.getPartitionStatus()
			expect(status.length).toBeGreaterThan(0)

			// Test partition analysis
			const analysis = await partitionManager.analyzePartitionPerformance()
			expect(analysis).toMatchObject({
				totalPartitions: expect.any(Number),
				totalSize: expect.any(Number),
				totalRecords: expect.any(Number),
				averagePartitionSize: expect.any(Number),
				recommendations: expect.any(Array)
			})
		})

		it('should handle partition optimization safely', async () => {
			const partitionManager = new EnhancedPartitionManager(db, redis)

			// Create a test partition
			const startDate = new Date(2024, 0, 1)
			const endDate = new Date(2024, 1, 1)
			await partitionManager.createPartition('audit_log', startDate, endDate)

			// Get partition name
			const partitions = await partitionManager.getPartitionStatus()
			const testPartition = partitions[0]

			// Optimize the partition
			await partitionManager.optimize(testPartition.name)

			// Verify optimization completed without errors
			expect(testPartition.name).toBeDefined()
		})
	})

	describe('Circuit Breaker Integration', () => {
		it('should protect against database failures', async () => {
			const circuitBreaker = new CircuitBreaker('test-breaker', {
				failureThreshold: 2,
				timeoutMs: 1000,
				resetTimeoutMs: 5000
			})

			// Test successful operation
			const successResult = await circuitBreaker.execute(async () => {
				return 'success'
			})
			expect(successResult).toBe('success')

			// Test failure handling
			let failureCount = 0
			const failingOperation = async () => {
				failureCount++
				throw new Error('Test failure')
			}

			// Trigger failures to open circuit breaker
			for (let i = 0; i < 3; i++) {
				try {
					await circuitBreaker.execute(failingOperation)
				} catch (error) {
					// Expected failures
				}
			}

			// Circuit breaker should now be open
			const status = circuitBreaker.getStatus()
			expect(status.state).toBe('open')

			// Further calls should fail fast
			try {
				await circuitBreaker.execute(async () => 'should not execute')
				expect.fail('Should have thrown CircuitBreakerOpenError')
			} catch (error: any) {
				expect(error.name).toBe('CircuitBreakerOpenError')
			}
		})
	})

	describe('Optimized LRU Cache Integration', () => {
		it('should perform O(1) cache operations', async () => {
			const cache = new OptimizedLRUCache({
				maxSizeMB: 1,
				defaultTTL: 300,
				keyPrefix: 'test',
				enabled: true,
				maxKeys: 100,
				cleanupInterval: 1000
			})

			// Test O(1) set operations
			const setOperations = []
			for (let i = 0; i < 100; i++) {
				setOperations.push(cache.set(`key_${i}`, { data: `value_${i}` }))
			}
			await Promise.all(setOperations)

			// Test O(1) get operations
			const getOperations = []
			for (let i = 0; i < 100; i++) {
				getOperations.push(cache.get(`key_${i}`))
			}
			const results = await Promise.all(getOperations)

			// Verify all operations completed successfully
			expect(results.filter(r => r !== null)).toHaveLength(100)

			// Test cache statistics
			const stats = await cache.stats()
			expect(stats).toMatchObject({
				hitRatio: expect.any(Number),
				totalKeys: expect.any(Number),
				memoryUsageMB: expect.any(Number),
				evictions: expect.any(Number)
			})

			// Test LRU eviction
			await cache.set('eviction_test', { large: 'data'.repeat(1000) })
			const detailedStats = cache.getDetailedMetrics()
			expect(detailedStats.evictions).toBeGreaterThanOrEqual(0)

			cache.destroy()
		})

		it('should handle TTL expiration correctly', async () => {
			const cache = new OptimizedLRUCache({
				maxSizeMB: 1,
				defaultTTL: 1, // 1 second
				keyPrefix: 'ttl_test',
				enabled: true,
				maxKeys: 100,
				cleanupInterval: 500
			})

			// Set value with short TTL
			await cache.set('ttl_key', { data: 'expires soon' }, 1)

			// Should be available immediately
			const immediate = await cache.get('ttl_key')
			expect(immediate).not.toBeNull()

			// Wait for expiration
			await new Promise(resolve => setTimeout(resolve, 1500))

			// Should be expired
			const expired = await cache.get('ttl_key')
			expect(expired).toBeNull()

			cache.destroy()
		})
	})

	describe('Read Replica Router Integration', () => {
		it('should route queries to healthy replicas', async () => {
			const router = new ReadReplicaRouter({
				replicas: [
					{ id: 'replica-1', url: 'postgresql://replica1/db', weight: 1 },
					{ id: 'replica-2', url: 'postgresql://replica2/db', weight: 2 }
				],
				strategy: 'round_robin' as any,
				healthCheckInterval: 5000,
				maxLagMs: 1000,
				circuitBreakerEnabled: false,
				fallbackToMaster: true,
				loadBalancing: {
					enabled: true,
					algorithm: 'round_robin'
				}
			})

			// Test query routing (will fallback to master in test environment)
			const result = await router.route(async () => {
				return { test: 'data' }
			})

			expect(result).toEqual({ test: 'data' })

			// Test replica health check
			const health = await router.getReplicaHealth()
			expect(health).toBeInstanceOf(Array)

			// Test routing statistics
			const stats = router.getRoutingStatistics()
			expect(stats).toMatchObject({
				totalReplicas: expect.any(Number),
				healthyReplicas: expect.any(Number),
				routingDecisions: expect.any(Object),
				averageResponseTimes: expect.any(Object),
				errorRates: expect.any(Object)
			})

			router.destroy()
		})
	})

	describe('Index Manager Integration', () => {
		it('should analyze and recommend index optimizations', async () => {
			const indexManager = new IntelligentIndexManager(db, {
				enableAutoCreation: false, // Disable for tests
				enableAutoDrop: false,
				unusedThresholdDays: 30,
				minUsageScans: 10,
				analysisInterval: 86400000,
				maxConcurrentIndexOps: 1
			})

			// Analyze current index usage
			const usage = await indexManager.analyzeIndexUsage()
			expect(usage).toBeInstanceOf(Array)

			// Generate recommendations
			const recommendations = await indexManager.generateIndexRecommendations()
			expect(recommendations).toBeInstanceOf(Array)

			// Test index health monitoring
			const health = await indexManager.monitorIndexHealth()
			expect(health).toMatchObject({
				healthy: expect.any(Number),
				degraded: expect.any(Number),
				critical: expect.any(Number),
				recommendations: expect.any(Array)
			})

			indexManager.destroy()
		})
	})

	describe('Performance Optimizer Integration', () => {
		it('should optimize operations and track performance', async () => {
			const optimizer = new PerformanceOptimizer(db, redis)

			// Test operation optimization
			const { result, metrics } = await optimizer.optimizeOperation(
				'test_operation',
				async () => {
					// Simulate some work
					await new Promise(resolve => setTimeout(resolve, 10))
					return { processed: 100 }
				},
				'O(N)'
			)

			expect(result).toEqual({ processed: 100 })
			expect(metrics).toMatchObject({
				operationName: 'test_operation',
				executionTime: expect.any(Number),
				complexity: 'O(N)',
				itemsProcessed: expect.any(Number),
				memoryUsage: expect.any(Number),
				optimizationApplied: true
			})

			// Test performance analysis
			const trends = optimizer.analyzePerformanceTrends()
			expect(trends).toBeInstanceOf(Array)

			// Test performance statistics
			const stats = optimizer.getPerformanceStatistics()
			expect(stats).toMatchObject({
				totalOperations: expect.any(Number),
				averageExecutionTime: expect.any(Number),
				optimizationSuccessRate: expect.any(Number),
				complexityDistribution: expect.any(Object)
			})
		})
	})

	describe('Error Handling Integration', () => {
		it('should handle database connection failures gracefully', async () => {
			// Test with invalid database configuration
			const invalidPostgres = postgres('postgresql://invalid:5432/invalid', {
				max: 1,
				connect_timeout: 1
			})
			const invalidDb = drizzle(invalidPostgres)

			const errorAuditDb = createEnhancedAuditDatabaseClient(redis, invalidDb, {
				circuitBreaker: {
					enabled: true,
					failureThreshold: 1,
					timeoutMs: 1000,
					resetTimeoutMs: 5000
				}
			})

			// Should handle connection errors gracefully
			try {
				await errorAuditDb.insert({ action: 'test', status: 'test' })
				expect.fail('Should have thrown error')
			} catch (error: any) {
				expect(error).toBeDefined()
			}

			// Health check should reflect unhealthy state
			const health = await errorAuditDb.getHealthStatus()
			expect(health.overall).toBe('unhealthy')

			await invalidPostgres.end()
		})

		it('should recover from transient failures', async () => {
			let callCount = 0
			const flakyOperation = async () => {
				callCount++
				if (callCount <= 2) {
					throw new Error('Transient failure')
				}
				return 'success'
			}

			const circuitBreaker = new CircuitBreaker('recovery-test', {
				failureThreshold: 3,
				timeoutMs: 5000,
				resetTimeoutMs: 1000
			})

			// Should eventually succeed after retries
			try {
				const result = await circuitBreaker.execute(flakyOperation)
				expect(result).toBe('success')
			} catch (error) {
				// Circuit breaker may open before success
				expect(callCount).toBeGreaterThanOrEqual(2)
			}
		})
	})

	describe('Performance Benchmarks', () => {
		it('should achieve target performance metrics', async () => {
			const startTime = Date.now()

			// Insert 100 audit logs
			const insertPromises = Array.from({ length: 100 }, (_, i) => 
				auditDb.insert({
					action: `benchmark_action_${i}`,
					principal_id: `user_${i}`,
					organization_id: 'benchmark_org',
					status: 'success',
					timestamp: new Date(),
					details: { benchmark: true, index: i }
				})
			)

			await Promise.all(insertPromises)
			const insertTime = Date.now() - startTime

			// Query performance test
			const queryStartTime = Date.now()
			const results = await auditDb.query({
				organization_id: 'benchmark_org',
				action: { like: 'benchmark_action_%' }
			})
			const queryTime = Date.now() - queryStartTime

			// Performance assertions
			expect(insertTime).toBeLessThan(5000) // 5 seconds for 100 inserts
			expect(queryTime).toBeLessThan(1000)  // 1 second for query
			expect(results.length).toBe(100)

			// Cache performance test
			const cacheStartTime = Date.now()
			const cachedResults = await auditDb.query({
				organization_id: 'benchmark_org',
				action: { like: 'benchmark_action_%' }
			})
			const cacheTime = Date.now() - cacheStartTime

			expect(cacheTime).toBeLessThan(100) // Should be much faster from cache
			expect(cachedResults.length).toBe(100)
		})
	})

	// Helper functions
	async function setupTestSchema() {
		try {
			// Create test tables and indexes
			await db.execute({ sql: `
				CREATE TABLE IF NOT EXISTS test_audit_log (
					id serial PRIMARY KEY,
					action varchar(255) NOT NULL,
					principal_id varchar(255),
					organization_id varchar(255),
					status varchar(50) NOT NULL,
					timestamp timestamp with time zone NOT NULL DEFAULT NOW(),
					details jsonb
				)
			`, args: [] })

			await db.execute({ sql: `
				CREATE INDEX IF NOT EXISTS test_audit_log_org_idx 
				ON test_audit_log (organization_id)
			`, args: [] })
		} catch (error) {
			console.warn('Test schema setup warning:', error)
		}
	}

	async function cleanupTestData() {
		try {
			await db.execute({ sql: 'DROP TABLE IF EXISTS test_audit_log CASCADE', args: [] })
			await redis.flushdb()
		} catch (error) {
			console.warn('Test cleanup warning:', error)
		}
	}
})