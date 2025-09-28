/**
 * Performance Service Cache Exclusion Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PerformanceService } from '../performance'

import type { PerformanceConfig } from '@repo/audit'

// Mock dependencies
const mockRedis = {
	get: vi.fn(),
	setex: vi.fn(),
	keys: vi.fn(),
	del: vi.fn(),
}

const mockDbClient = {} as any
const mockLogger = {
	warn: vi.fn(),
	info: vi.fn(),
	error: vi.fn(),
} as any

describe('Performance Service Cache Exclusions', () => {
	let performanceService: PerformanceService
	let config: PerformanceConfig

	beforeEach(() => {
		vi.clearAllMocks()

		config = {
			responseCache: {
				enabled: true,
				defaultTTL: 300,
				maxSizeMB: 100,
				keyPrefix: 'test_cache',
				excludeEndpoints: ['/api/v1/auth/session', '/api/v1/auth/logout', '/graphql'],
				disableCachePatterns: ['/api/v1/realtime/*', '/api/v1/streaming/*', '*/live', '*/current'],
				endpointTTLOverrides: {
					'/api/v1/metrics/*': 60,
					'/api/v1/health': 30,
					'/api/v1/audit/events/recent': 120,
				},
			},
			pagination: {
				defaultLimit: 50,
				maxLimit: 1000,
				enableCursor: true,
			},
			streaming: {
				enabled: true,
				chunkSize: 1000,
				maxConcurrentStreams: 10,
			},
			concurrency: {
				maxConcurrentRequests: 100,
				queueTimeout: 30000,
				enableRequestQueue: true,
			},
			monitoring: {
				enableMetrics: true,
				slowRequestThreshold: 1000,
				memoryThreshold: 80,
			},
		}

		performanceService = new PerformanceService(mockRedis as any, mockDbClient, mockLogger, config)
	})

	describe('Cache Exclusion Detection', () => {
		it('should exclude exact endpoint matches', () => {
			expect(performanceService.isCachingEnabledForEndpoint('/api/v1/auth/session')).toBe(false)
			expect(performanceService.isCachingEnabledForEndpoint('/api/v1/auth/logout')).toBe(false)
			expect(performanceService.isCachingEnabledForEndpoint('/graphql')).toBe(false)
		})

		it('should exclude pattern matches', () => {
			expect(performanceService.isCachingEnabledForEndpoint('/api/v1/realtime/events')).toBe(false)
			expect(performanceService.isCachingEnabledForEndpoint('/api/v1/realtime/metrics')).toBe(false)
			expect(performanceService.isCachingEnabledForEndpoint('/api/v1/streaming/data')).toBe(false)
			expect(performanceService.isCachingEnabledForEndpoint('/dashboard/live')).toBe(false)
			expect(performanceService.isCachingEnabledForEndpoint('/api/v1/metrics/current')).toBe(false)
		})

		it('should allow caching for non-excluded endpoints', () => {
			expect(performanceService.isCachingEnabledForEndpoint('/api/v1/audit/events')).toBe(true)
			expect(performanceService.isCachingEnabledForEndpoint('/api/v1/reports/compliance')).toBe(
				true
			)
			expect(performanceService.isCachingEnabledForEndpoint('/api/v1/users')).toBe(true)
		})
	})

	describe('TTL Overrides', () => {
		it('should return custom TTL for exact matches', () => {
			expect(performanceService.getCacheTTLForEndpoint('/api/v1/health')).toBe(30)
			expect(performanceService.getCacheTTLForEndpoint('/api/v1/audit/events/recent')).toBe(120)
		})

		it('should return custom TTL for pattern matches', () => {
			expect(performanceService.getCacheTTLForEndpoint('/api/v1/metrics/dashboard')).toBe(60)
			expect(performanceService.getCacheTTLForEndpoint('/api/v1/metrics/performance')).toBe(60)
		})

		it('should return default TTL for non-matching endpoints', () => {
			expect(performanceService.getCacheTTLForEndpoint('/api/v1/audit/events')).toBe(300)
			expect(performanceService.getCacheTTLForEndpoint('/api/v1/users')).toBe(300)
		})

		it('should respect custom default TTL', () => {
			expect(performanceService.getCacheTTLForEndpoint('/api/v1/audit/events', 600)).toBe(600)
		})
	})

	describe('Cache Operations with Exclusions', () => {
		it('should skip caching for excluded endpoints', async () => {
			const handler = vi.fn().mockResolvedValue({ data: 'test' })

			const result = await performanceService.executeOptimized(handler, {
				cacheKey: 'test-key',
				endpoint: '/api/v1/auth/session',
			})

			expect(result).toEqual({ data: 'test' })
			expect(handler).toHaveBeenCalledTimes(1)
			expect(mockRedis.get).not.toHaveBeenCalled()
			expect(mockRedis.setex).not.toHaveBeenCalled()
		})

		it('should use caching for allowed endpoints', async () => {
			mockRedis.get.mockResolvedValue(null) // Cache miss
			const handler = vi.fn().mockResolvedValue({ data: 'test' })

			const result = await performanceService.executeOptimized(handler, {
				cacheKey: 'test-key',
				endpoint: '/api/v1/audit/events',
			})

			expect(result).toEqual({ data: 'test' })
			expect(handler).toHaveBeenCalledTimes(1)
			expect(mockRedis.get).toHaveBeenCalledWith('test_cache:test-key')
			expect(mockRedis.setex).toHaveBeenCalledWith('test_cache:test-key', 300, '{"data":"test"}')
		})

		it('should use custom TTL for endpoints with overrides', async () => {
			mockRedis.get.mockResolvedValue(null) // Cache miss
			const handler = vi.fn().mockResolvedValue({ data: 'metrics' })

			await performanceService.executeOptimized(handler, {
				cacheKey: 'metrics-key',
				endpoint: '/api/v1/metrics/dashboard',
			})

			expect(mockRedis.setex).toHaveBeenCalledWith(
				'test_cache:metrics-key',
				60,
				'{"data":"metrics"}'
			)
		})
	})

	describe('Cache Configuration Summary', () => {
		it('should return complete cache configuration', () => {
			const summary = performanceService.getCacheConfigSummary()

			expect(summary.enabled).toBe(true)
			expect(summary.excludedEndpoints).toEqual([
				'/api/v1/auth/session',
				'/api/v1/auth/logout',
				'/graphql',
			])
			expect(summary.disabledPatterns).toEqual([
				'/api/v1/realtime/*',
				'/api/v1/streaming/*',
				'*/live',
				'*/current',
			])
			expect(summary.ttlOverrides).toEqual({
				'/api/v1/metrics/*': 60,
				'/api/v1/health': 30,
				'/api/v1/audit/events/recent': 120,
			})
		})
	})

	describe('Optimized Handler Creation', () => {
		it('should create handler that respects cache exclusions', async () => {
			const originalHandler = vi.fn().mockResolvedValue({ data: 'test' })

			const optimizedHandler = performanceService.createOptimizedHandler(
				'/api/v1/auth/session',
				originalHandler
			)

			const result = await optimizedHandler()

			expect(result).toEqual({ data: 'test' })
			expect(originalHandler).toHaveBeenCalledTimes(1)
			expect(mockRedis.get).not.toHaveBeenCalled() // Should skip cache
		})

		it('should create handler that uses caching for allowed endpoints', async () => {
			mockRedis.get.mockResolvedValue(null) // Cache miss
			const originalHandler = vi.fn().mockResolvedValue({ data: 'test' })

			const optimizedHandler = performanceService.createOptimizedHandler(
				'/api/v1/audit/events',
				originalHandler
			)

			await optimizedHandler()

			expect(mockRedis.get).toHaveBeenCalled()
			expect(mockRedis.setex).toHaveBeenCalled()
		})
	})
})
