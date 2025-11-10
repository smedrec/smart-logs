import { describe, expect, it, vi } from 'vitest'

// Import the class under test (relative path from src/__tests__ to src/db)
import { EnhancedAuditDatabaseClient } from '../db/enhanced-client.js'

describe('EnhancedAuditDatabaseClient.executeMonitoredQuery', () => {
	it('calls the uncached metadata-aware query and stores metrics in Redis', async () => {
		const stored: Array<{ k: string; ttl: number; v: string }> = []

		// Minimal mock Redis with setex capturing stored metrics
		const mockRedis: any = {
			setex: vi.fn(async (k: string, ttl: number, v: string) => {
				stored.push({ k, ttl, v })
				return 'OK'
			}),
		}

		// Minimal config -- keep values that the constructor expects
		const config: any = {
			connectionPool: {
				url: 'postgres://localhost/test',
				minConnections: 1,
				maxConnections: 2,
				idleTimeout: 1000,
				acquireTimeout: 1000,
				validateConnections: true,
				retryAttempts: 0,
				retryDelay: 0,
				ssl: false,
			},
			queryCacheFactory: {
				type: 'local',
				queryCache: {
					enabled: false,
					defaultTTL: 60,
					maxSizeMB: 1,
					maxQueries: 10,
					keyPrefix: 'audit_cache',
				},
			},
			replication: { enabled: false },
			partitioning: {
				enabled: false,
				tables: [],
				strategy: 'range',
				interval: 'monthly',
				retentionDays: 1,
				autoMaintenance: false,
				maintenanceInterval: 0,
			},
			circuitBreaker: { enabled: false, failureThreshold: 0, timeoutMs: 0, resetTimeoutMs: 0 },
			monitoring: {
				enabled: true,
				slowQueryThreshold: 5000,
				metricsRetentionDays: 30,
				autoOptimization: false,
			},
		}

		// Construct client with mocks
		const client = new EnhancedAuditDatabaseClient(mockRedis, config, { level: 'info' } as any)

		// Prepare a fake metadata result
		const meta = { rows: [{ id: 1, name: 'a' }], rowCount: 1, durationMs: 123 }

		// Replace internal client with a mock that returns our metadata
		;(client as any).client = {
			executeQueryUncachedWithMeta: vi.fn(async (_fn: any) => meta),
			executeQueryWithMeta: vi.fn(async (_fn: any, _cacheKey: any, _ttl: any) => meta),
			getDatabase: () => ({}),
			// minimal shapes for other methods used in generatePerformanceReport / health flows
			getStats: async () => ({
				connectionPool: {
					totalConnections: 0,
					activeConnections: 0,
					averageAcquisitionTime: 0,
					totalRequests: 0,
					successfulConnections: 0,
				},
				queryCache: { hitRatio: 100, totalSizeMB: 0, evictions: 0 },
			}),
			healthCheck: async () => ({
				connectionPool: { healthy: true },
				queryCache: { hitRatio: 100 },
			}),
			close: async () => {},
		}

		// Call executeMonitoredQuery (uncached path)
		const result = await client.executeMonitoredQuery(async (_db: any) => meta.rows, 'testQuery')

		// Result should be the rows
		expect(result).toEqual(meta.rows)

		// Redis.setex should have been called to store the metric
		expect(mockRedis.setex).toHaveBeenCalled()
		expect(stored.length).toBeGreaterThan(0)

		// Parse stored metric and assert rowsReturned matches meta.rowCount
		const parsed = JSON.parse(stored[0].v)
		expect(parsed.rowsReturned).toBe(meta.rowCount)
		expect(parsed.totalTime).toBe(meta.durationMs)
	})
})
