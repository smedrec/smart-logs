/**
 * Performance benchmark tests for audit database optimizations
 * Validates that optimization targets are met per design document
 */

import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import Redis from 'ioredis'

import {
	createEnhancedAuditDatabaseClient,
	OptimizedLRUCache,
	CircuitBreaker,
	PerformanceOptimizer
} from '../index.js'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema.js'

describe('Performance Benchmark Tests', () => {
	let db: PostgresJsDatabase<typeof schema>
	let redis: Redis
	let postgresClient: postgres.Sql
	let auditDb: any

	beforeAll(async () => {
		postgresClient = postgres(process.env.BENCHMARK_DATABASE_URL || 'postgresql://localhost:5432/benchmark_audit_db', {
			max: 20,
			idle_timeout: 20,
			connect_timeout: 10
		})
		
		db = drizzle(postgresClient)
		redis = new Redis(process.env.BENCHMARK_REDIS_URL || 'redis://localhost:6379/2')
		
		auditDb = createEnhancedAuditDatabaseClient(redis, db, {
			cache: {
				enabled: true,
				maxSizeMB: 200,
				defaultTTL: 300
			},
			partition: {
				strategy: 'range',
				interval: 'monthly',
				retentionDays: 2555,
				autoMaintenance: true
			}
		})

		await setupBenchmarkData()
	})

	afterAll(async () => {
		await cleanupBenchmarkData()
		await postgresClient.end()
		redis.disconnect()
	})

	describe('Query Response Time Benchmarks', () => {
		it('should achieve < 100ms for cached queries (Design Target)', async () => {
			// Prime the cache
			await auditDb.query({
				organization_id: 'benchmark_org_1',
				action: 'data_access'
			})

			// Benchmark cached query performance
			const iterations = 10
			const times: number[] = []

			for (let i = 0; i < iterations; i++) {
				const start = performance.now()
				await auditDb.query({
					organization_id: 'benchmark_org_1',
					action: 'data_access'
				})
				const end = performance.now()
				times.push(end - start)
			}

			const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length
			const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)]

			console.log(`Cached Query Performance:`)
			console.log(`  Average: ${avgTime.toFixed(2)}ms`)
			console.log(`  95th percentile: ${p95Time.toFixed(2)}ms`)
			console.log(`  Target: < 100ms`)

			expect(avgTime).toBeLessThan(100)
			expect(p95Time).toBeLessThan(100)
		})

		it('should achieve cache hit ratio > 90% (Design Target)', async () => {
			// Generate diverse queries to build cache
			const queries = [
				{ organization_id: 'benchmark_org_1', action: 'login' },
				{ organization_id: 'benchmark_org_1', action: 'logout' },
				{ organization_id: 'benchmark_org_2', action: 'data_access' },
				{ organization_id: 'benchmark_org_2', action: 'file_download' }
			]

			// Execute each query twice to build cache
			for (const query of queries) {
				await auditDb.query(query)
				await auditDb.query(query)
			}

			// Execute many more queries that should hit cache
			for (let i = 0; i < 100; i++) {
				const query = queries[i % queries.length]
				await auditDb.query(query)
			}

			const health = await auditDb.getHealthStatus()
			const hitRatio = health.components.cache.hitRatio

			console.log(`Cache Hit Ratio: ${hitRatio.toFixed(2)}%`)
			console.log(`Target: > 90%`)

			expect(hitRatio).toBeGreaterThan(90)
		})
	})

	describe('Partition Performance Benchmarks', () => {
		it('should achieve < 5 seconds for partition creation (Design Target)', async () => {
			const partitionManager = new (await import('../db/enhanced-partition-manager.js')).EnhancedPartitionManager(db, redis)

			const iterations = 3
			const times: number[] = []

			for (let i = 0; i < iterations; i++) {
				const startDate = new Date(2025, i, 1)
				const endDate = new Date(2025, i + 1, 1)

				const start = performance.now()
				await partitionManager.createPartition('audit_log', startDate, endDate)
				const end = performance.now()
				
				times.push(end - start)
			}

			const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length

			console.log(`Partition Creation Performance:`)
			console.log(`  Average: ${avgTime.toFixed(2)}ms`)
			console.log(`  Target: < 5000ms`)

			expect(avgTime).toBeLessThan(5000)
		})
	})

	describe('LRU Cache O(1) Performance', () => {
		it('should maintain O(1) performance for cache operations', async () => {
			const cache = new OptimizedLRUCache({
				maxSizeMB: 50,
				defaultTTL: 300,
				keyPrefix: 'benchmark',
				enabled: true,
				maxKeys: 10000,
				cleanupInterval: 60000
			})

			// Test with increasing data sizes to verify O(1) complexity
			const sizes = [100, 1000, 5000, 10000]
			const setResults: number[] = []
			const getResults: number[] = []

			for (const size of sizes) {
				// Benchmark SET operations
				const setStart = performance.now()
				const setPromises = Array.from({ length: size }, (_, i) =>
					cache.set(`bench_key_${i}`, { data: `value_${i}`, size })
				)
				await Promise.all(setPromises)
				const setEnd = performance.now()
				const setTimePerOp = (setEnd - setStart) / size
				setResults.push(setTimePerOp)

				// Benchmark GET operations
				const getStart = performance.now()
				const getPromises = Array.from({ length: size }, (_, i) =>
					cache.get(`bench_key_${i}`)
				)
				await Promise.all(getPromises)
				const getEnd = performance.now()
				const getTimePerOp = (getEnd - getStart) / size
				getResults.push(getTimePerOp)
			}

			console.log(`LRU Cache Performance (time per operation):`)
			sizes.forEach((size, i) => {
				console.log(`  Size ${size}: SET ${setResults[i].toFixed(4)}ms, GET ${getResults[i].toFixed(4)}ms`)
			})

			// Verify O(1) - times should not increase significantly with size
			const setGrowthFactor = setResults[setResults.length - 1] / setResults[0]
			const getGrowthFactor = getResults[getResults.length - 1] / getResults[0]

			console.log(`Performance Growth Factors:`)
			console.log(`  SET: ${setGrowthFactor.toFixed(2)}x`)
			console.log(`  GET: ${getGrowthFactor.toFixed(2)}x`)
			console.log(`  Target: < 2x (indicating O(1) complexity)`)

			expect(setGrowthFactor).toBeLessThan(2)
			expect(getGrowthFactor).toBeLessThan(2)

			cache.destroy()
		})
	})

	describe('Circuit Breaker Performance', () => {
		it('should achieve < 30 seconds recovery time (Design Target)', async () => {
			const circuitBreaker = new CircuitBreaker('performance-test', {
				failureThreshold: 3,
				timeoutMs: 5000,
				resetTimeoutMs: 10000 // 10 seconds for test
			})

			// Trigger circuit breaker to open
			for (let i = 0; i < 4; i++) {
				try {
					await circuitBreaker.execute(async () => {
						throw new Error('Test failure')
					})
				} catch (error) {
					// Expected failures
				}
			}

			// Verify circuit is open
			expect(circuitBreaker.getState()).toBe('open')

			// Measure recovery time
			const recoveryStart = Date.now()
			
			// Wait for circuit to transition to half-open
			while (circuitBreaker.getState() === 'open') {
				await new Promise(resolve => setTimeout(resolve, 100))
			}

			const recoveryTime = Date.now() - recoveryStart

			console.log(`Circuit Breaker Recovery Time: ${recoveryTime}ms`)
			console.log(`Target: < 30000ms`)

			expect(recoveryTime).toBeLessThan(30000)
		})
	})

	describe('Concurrent Connection Handling', () => {
		it('should handle 1000+ concurrent connections (Design Target)', async () => {
			const concurrentOperations = 1000
			const operations: Promise<any>[] = []

			const startTime = performance.now()

			// Create 1000 concurrent operations
			for (let i = 0; i < concurrentOperations; i++) {
				operations.push(
					auditDb.insert({
						action: `concurrent_test_${i}`,
						principal_id: `user_${i % 100}`,
						organization_id: `org_${i % 10}`,
						status: 'success',
						timestamp: new Date(),
						details: { concurrency_test: true, index: i }
					})
				)
			}

			// Wait for all operations to complete
			const results = await Promise.allSettled(operations)
			const endTime = performance.now()

			const successCount = results.filter(r => r.status === 'fulfilled').length
			const failureCount = results.filter(r => r.status === 'rejected').length
			const totalTime = endTime - startTime
			const operationsPerSecond = (concurrentOperations / totalTime) * 1000

			console.log(`Concurrent Operations Performance:`)
			console.log(`  Total operations: ${concurrentOperations}`)
			console.log(`  Successful: ${successCount}`)
			console.log(`  Failed: ${failureCount}`)
			console.log(`  Total time: ${totalTime.toFixed(2)}ms`)
			console.log(`  Operations/second: ${operationsPerSecond.toFixed(2)}`)
			console.log(`  Success rate: ${((successCount / concurrentOperations) * 100).toFixed(2)}%`)

			// Should handle most operations successfully
			expect(successCount).toBeGreaterThan(concurrentOperations * 0.95) // 95% success rate
			expect(operationsPerSecond).toBeGreaterThan(100) // At least 100 ops/sec
		})
	})

	describe('Algorithm Complexity Optimization', () => {
		it('should demonstrate O(log N) partition lookup performance', async () => {
			const optimizer = new PerformanceOptimizer(db, redis)
			
			// Test partition lookup with different data sizes
			const sizes = [100, 1000, 10000]
			const lookupTimes: number[] = []

			for (const size of sizes) {
				// Generate test partition metadata
				const partitions = Array.from({ length: size }, (_, i) => ({
					name: `partition_${i}`,
					startDate: new Date(2024, 0, i + 1),
					endDate: new Date(2024, 0, i + 2),
					retentionPolicy: 'standard',
					sizeBytes: 1000000
				}))

				// Benchmark partition lookup
				const { metrics } = await optimizer.optimizeOperation(
					'partition_lookup',
					async () => {
						// Simulate binary search lookup
						let left = 0
						let right = partitions.length - 1
						const target = new Date(2024, 0, Math.floor(size / 2))

						while (left <= right) {
							const mid = Math.floor((left + right) / 2)
							if (partitions[mid].startDate.getTime() === target.getTime()) {
								return partitions[mid]
							} else if (partitions[mid].startDate < target) {
								left = mid + 1
							} else {
								right = mid - 1
							}
						}
						return null
					},
					'O(log N)'
				)

				lookupTimes.push(metrics.executionTime)
			}

			console.log(`Partition Lookup Performance:`)
			sizes.forEach((size, i) => {
				console.log(`  Size ${size}: ${lookupTimes[i].toFixed(4)}ms`)
			})

			// Verify logarithmic complexity - time should grow slowly
			const growthFactor = lookupTimes[lookupTimes.length - 1] / lookupTimes[0]
			console.log(`Performance Growth Factor: ${growthFactor.toFixed(2)}x`)
			console.log(`Target: < 3x (indicating O(log N) complexity)`)

			expect(growthFactor).toBeLessThan(3)
		})
	})

	describe('Memory Usage Optimization', () => {
		it('should maintain efficient memory usage under load', async () => {
			const initialMemory = process.memoryUsage()
			
			// Generate significant load
			const operations = 1000
			const promises: Promise<any>[] = []

			for (let i = 0; i < operations; i++) {
				promises.push(
					auditDb.insert({
						action: 'memory_test',
						principal_id: `user_${i}`,
						organization_id: 'memory_test_org',
						status: 'success',
						timestamp: new Date(),
						details: {
							large_field: 'x'.repeat(1000), // 1KB per record
							index: i
						}
					})
				)
			}

			await Promise.all(promises)

			// Execute queries to test cache memory usage
			for (let i = 0; i < 100; i++) {
				await auditDb.query({
					organization_id: 'memory_test_org',
					principal_id: `user_${i % 50}`
				})
			}

			const finalMemory = process.memoryUsage()
			const heapGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024)

			console.log(`Memory Usage:`)
			console.log(`  Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`)
			console.log(`  Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`)
			console.log(`  Heap growth: ${heapGrowth.toFixed(2)} MB`)
			console.log(`  Target: < 200 MB growth`)

			expect(heapGrowth).toBeLessThan(200) // Should not grow more than 200MB
		})
	})

	describe('End-to-End Performance', () => {
		it('should achieve overall performance targets', async () => {
			const testDuration = 30000 // 30 seconds
			const startTime = Date.now()
			let operationCount = 0
			let errorCount = 0

			// Run continuous operations for test duration
			const operations: Promise<void>[] = []

			while (Date.now() - startTime < testDuration) {
				const operation = async () => {
					try {
						operationCount++
						
						if (operationCount % 3 === 0) {
							// Insert operation
							await auditDb.insert({
								action: 'e2e_test',
								principal_id: `user_${operationCount % 100}`,
								organization_id: `org_${operationCount % 10}`,
								status: 'success',
								timestamp: new Date(),
								details: { e2e_test: true }
							})
						} else {
							// Query operation
							await auditDb.query({
								organization_id: `org_${operationCount % 10}`,
								action: 'e2e_test'
							})
						}
					} catch (error) {
						errorCount++
					}
				}

				operations.push(operation())

				// Control concurrency
				if (operations.length >= 50) {
					await Promise.allSettled(operations.splice(0, 25))
				}

				// Small delay to prevent overwhelming
				await new Promise(resolve => setTimeout(resolve, 10))
			}

			// Wait for remaining operations
			await Promise.allSettled(operations)

			const actualDuration = Date.now() - startTime
			const operationsPerSecond = (operationCount / actualDuration) * 1000
			const errorRate = (errorCount / operationCount) * 100

			console.log(`End-to-End Performance:`)
			console.log(`  Duration: ${actualDuration}ms`)
			console.log(`  Total operations: ${operationCount}`)
			console.log(`  Operations/second: ${operationsPerSecond.toFixed(2)}`)
			console.log(`  Error rate: ${errorRate.toFixed(2)}%`)
			console.log(`  Targets: >50 ops/sec, <5% error rate`)

			expect(operationsPerSecond).toBeGreaterThan(50)
			expect(errorRate).toBeLessThan(5)
		})
	})

	// Helper functions
	async function setupBenchmarkData() {
		try {
			// Create benchmark data for queries
			const benchmarkData = Array.from({ length: 1000 }, (_, i) => ({
				action: ['login', 'logout', 'data_access', 'file_download'][i % 4],
				principal_id: `benchmark_user_${i % 100}`,
				organization_id: `benchmark_org_${i % 5}`,
				status: ['success', 'failure'][i % 2],
				timestamp: new Date(Date.now() - (i * 60000)), // Spread over time
				details: { benchmark: true, index: i }
			}))

			// Insert benchmark data in batches
			const batchSize = 100
			for (let i = 0; i < benchmarkData.length; i += batchSize) {
				const batch = benchmarkData.slice(i, i + batchSize)
				const promises = batch.map(data => auditDb.insert(data))
				await Promise.all(promises)
			}

			console.log(`Setup complete: ${benchmarkData.length} benchmark records created`)
		} catch (error) {
			console.warn('Benchmark setup warning:', error)
		}
	}

	async function cleanupBenchmarkData() {
		try {
			await redis.flushdb()
			console.log('Benchmark cleanup complete')
		} catch (error) {
			console.warn('Benchmark cleanup warning:', error)
		}
	}
})