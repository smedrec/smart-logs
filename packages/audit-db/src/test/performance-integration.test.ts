/**
 * Integration tests for performance optimization components
 * Tests basic functionality without requiring superuser privileges
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'

import { EnhancedDatabaseClient } from '../db/connection-pool.js'
import { createEnhancedAuditClient } from '../db/enhanced-client.js'
import { AuditDb } from '../db/index.js'
import { DatabasePartitionManager } from '../db/partitioning.js'
import { DatabasePerformanceMonitor } from '../db/performance-monitoring.js'
import { DatabasePartitionManager } from '../db/partitioning.js'
import { DatabasePerformanceMonitor } from '../db/performance-monitoring.js'

describe('Performance Integration Tests', () => {
	let auditDb: AuditDb

	beforeAll(async () => {
		auditDb = new AuditDb(process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test')

		// Verify database connection
		const connected = await auditDb.checkAuditDbConnection()
		expect(connected).toBe(true)
	})

	afterAll(async () => {
		await auditDb.end()
	})

	describe('Database Partition Manager', () => {
		it('should initialize partition manager', () => {
			const db = auditDb.getDrizzleInstance()
			const partitionManager = new DatabasePartitionManager(db)
			expect(partitionManager).toBeDefined()
		})

		it('should calculate partitions needed', async () => {
			const db = auditDb.getDrizzleInstance()
			const partitionManager = new DatabasePartitionManager(db)

			// This tests the internal logic without requiring database changes
			const analysis = await partitionManager.analyzePartitionPerformance()
			expect(analysis).toBeDefined()
			expect(typeof analysis.totalPartitions).toBe('number')
			expect(typeof analysis.totalSize).toBe('number')
			expect(Array.isArray(analysis.recommendations)).toBe(true)
		})
	})

	describe('Database Performance Monitor', () => {
		it('should initialize performance monitor', () => {
			const db = auditDb.getDrizzleInstance()
			const monitor = new DatabasePerformanceMonitor(db)
			expect(monitor).toBeDefined()
		})

		it('should enable monitoring gracefully', async () => {
			const db = auditDb.getDrizzleInstance()
			const monitor = new DatabasePerformanceMonitor(db)

			// Should not throw even if pg_stat_statements is not available
			await expect(monitor.enableMonitoring()).resolves.not.toThrow()
		})

		it('should get table statistics', async () => {
			const db = auditDb.getDrizzleInstance()
			const monitor = new DatabasePerformanceMonitor(db)

			const tableStats = await monitor.getTableStats()
			expect(Array.isArray(tableStats)).toBe(true)
		})

		it('should get index usage statistics', async () => {
			const db = auditDb.getDrizzleInstance()
			const monitor = new DatabasePerformanceMonitor(db)

			const indexStats = await monitor.getIndexUsageStats()
			expect(Array.isArray(indexStats)).toBe(true)
		})

		it('should handle slow queries gracefully', async () => {
			const db = auditDb.getDrizzleInstance()
			const monitor = new DatabasePerformanceMonitor(db)

			await monitor.enableMonitoring()
			const slowQueries = await monitor.getSlowQueries(10, 0)
			expect(Array.isArray(slowQueries)).toBe(true)
		})
	})

	describe('Enhanced Connection Pool', () => {
		it('should create enhanced database client', () => {
			const client = new EnhancedDatabaseClient(
				{
					url: process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test',
					minConnections: 1,
					maxConnections: 5,
					idleTimeout: 30000,
					acquireTimeout: 10000,
					validateConnections: true,
					retryAttempts: 3,
					retryDelay: 1000,
				},
				{
					enabled: true,
					maxSizeMB: 10,
					defaultTTL: 60,
					maxQueries: 100,
					keyPrefix: 'test',
				}
			)

			expect(client).toBeDefined()
			expect(client.getDatabase()).toBeDefined()
		})

		it('should execute queries through connection pool', async () => {
			const client = new EnhancedDatabaseClient(
				{
					url: process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test',
					minConnections: 1,
					maxConnections: 5,
					idleTimeout: 30000,
					acquireTimeout: 10000,
					validateConnections: true,
					retryAttempts: 3,
					retryDelay: 1000,
				},
				{
					enabled: true,
					maxSizeMB: 10,
					defaultTTL: 60,
					maxQueries: 100,
					keyPrefix: 'test',
				}
			)

			const result = await client.executeQuery(async (db) => {
				return db.execute(sql`SELECT 1 as test`)
			})

			expect(result).toBeDefined()
			expect(Array.isArray(result)).toBe(true)

			await client.close()
		})

		it('should perform health checks', async () => {
			const client = new EnhancedDatabaseClient(
				{
					url: process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test',
					minConnections: 1,
					maxConnections: 5,
					idleTimeout: 30000,
					acquireTimeout: 10000,
					validateConnections: true,
					retryAttempts: 3,
					retryDelay: 1000,
				},
				{
					enabled: true,
					maxSizeMB: 10,
					defaultTTL: 60,
					maxQueries: 100,
					keyPrefix: 'test',
				}
			)

			const health = await client.healthCheck()
			expect(health).toBeDefined()
			expect(typeof health.connectionPool.healthy).toBe('boolean')
			expect(typeof health.connectionPool.connectionTime).toBe('number')

			await client.close()
		})
	})

	describe('Enhanced Audit Client', () => {
		it('should create enhanced audit client', () => {
			const client = createEnhancedAuditClient(
				process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test',
				{
					monitoring: { enabled: false }, // Disable monitoring to avoid extension issues
					partitioning: { enabled: false }, // Disable partitioning for simple test
				}
			)

			expect(client).toBeDefined()
			expect(client.getDatabase()).toBeDefined()
		})

		it('should execute optimized queries', async () => {
			const client = createEnhancedAuditClient(
				process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test',
				{
					monitoring: { enabled: false },
					partitioning: { enabled: false },
				}
			)

			const result = await client.executeOptimizedQuery(async (db) => {
				return db.execute(sql`SELECT 1 as test`)
			})

			expect(result).toBeDefined()
			expect(Array.isArray(result)).toBe(true)

			await client.close()
		})

		it('should generate performance reports', async () => {
			const client = createEnhancedAuditClient(
				process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test',
				{
					monitoring: { enabled: false },
					partitioning: { enabled: false },
				}
			)

			const report = await client.generatePerformanceReport()
			expect(report).toBeDefined()
			expect(report.timestamp).toBeInstanceOf(Date)
			expect(typeof report.connectionPool.successRate).toBe('number')
			expect(typeof report.queryCache.hitRatio).toBe('number')

			await client.close()
		})

		it('should check health status', async () => {
			const client = createEnhancedAuditClient(
				process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test',
				{
					monitoring: { enabled: false },
					partitioning: { enabled: false },
				}
			)

			const health = await client.getHealthStatus()
			expect(health).toBeDefined()
			expect(['healthy', 'warning', 'critical']).toContain(health.overall)
			expect(health.components).toBeDefined()
			expect(Array.isArray(health.recommendations)).toBe(true)

			await client.close()
		})
	})

	describe('Query Caching', () => {
		it('should cache and retrieve query results', async () => {
			const client = new EnhancedDatabaseClient(
				{
					url: process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_test',
					minConnections: 1,
					maxConnections: 5,
					idleTimeout: 30000,
					acquireTimeout: 10000,
					validateConnections: true,
					retryAttempts: 3,
					retryDelay: 1000,
				},
				{
					enabled: true,
					maxSizeMB: 10,
					defaultTTL: 60,
					maxQueries: 100,
					keyPrefix: 'test',
				}
			)

			const cacheKey = 'test_query'

			// First query (cache miss)
			const result1 = await client.executeQuery(
				async (db) => db.execute(sql`SELECT 1 as test`),
				cacheKey
			)

			// Second query (cache hit)
			const result2 = await client.executeQuery(
				async (db) => db.execute(sql`SELECT 1 as test`),
				cacheKey
			)

			expect(result1).toEqual(result2)

			const stats = client.getStats()
			expect(stats.queryCache.cacheHits).toBeGreaterThan(0)

			await client.close()
		})
	})
})
