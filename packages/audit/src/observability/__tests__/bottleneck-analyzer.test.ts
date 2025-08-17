/**
 * Tests for bottleneck analysis and performance profiling
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuditBottleneckAnalyzer } from '../bottleneck-analyzer.js'

import type { AuditOperationMetrics, PerformanceMetrics } from '../types.js'

describe('AuditBottleneckAnalyzer', () => {
	let analyzer: AuditBottleneckAnalyzer

	beforeEach(() => {
		analyzer = new AuditBottleneckAnalyzer()
	})

	describe('analyzePerformance', () => {
		it('should identify bottlenecks from operation metrics', async () => {
			const operations: AuditOperationMetrics[] = [
				{
					operationType: 'CREATE',
					operationName: 'slow_operation',
					duration: 500, // Slow operation
					success: true,
					metadata: {},
					timestamp: '2023-01-01T00:00:00.000Z',
				},
				{
					operationType: 'CREATE',
					operationName: 'slow_operation',
					duration: 600,
					success: true,
					metadata: {},
					timestamp: '2023-01-01T00:01:00.000Z',
				},
				{
					operationType: 'CREATE',
					operationName: 'fast_operation',
					duration: 50, // Fast operation
					success: true,
					metadata: {},
					timestamp: '2023-01-01T00:02:00.000Z',
				},
			]

			const analyses = await analyzer.analyzePerformance(operations)

			expect(analyses).toHaveLength(1)
			expect(analyses[0].component).toBe('CREATE')
			expect(analyses[0].operation).toBe('slow_operation')
			expect(analyses[0].isBottleneck).toBe(true)
			expect(analyses[0].averageTime).toBe(550)
			expect(analyses[0].severity).toBe('CRITICAL')
		})

		it('should not identify bottlenecks for fast operations', async () => {
			const operations: AuditOperationMetrics[] = [
				{
					operationType: 'CREATE',
					operationName: 'fast_operation',
					duration: 50,
					success: true,
					metadata: {},
					timestamp: '2023-01-01T00:00:00.000Z',
				},
				{
					operationType: 'CREATE',
					operationName: 'fast_operation',
					duration: 60,
					success: true,
					metadata: {},
					timestamp: '2023-01-01T00:01:00.000Z',
				},
			]

			const analyses = await analyzer.analyzePerformance(operations)

			expect(analyses).toHaveLength(0)
		})

		it('should identify bottlenecks based on error rate', async () => {
			const operations: AuditOperationMetrics[] = Array.from({ length: 20 }, (_, i) => ({
				operationType: 'CREATE' as const,
				operationName: 'error_prone_operation',
				duration: 100,
				success: i < 15, // 25% error rate
				metadata: {},
				timestamp: new Date(Date.now() + i * 1000).toISOString(),
			}))

			const analyses = await analyzer.analyzePerformance(operations)

			expect(analyses).toHaveLength(1)
			expect(analyses[0].isBottleneck).toBe(true)
			expect(analyses[0].severity).toBe('CRITICAL') // High error rate
		})
	})

	describe('profileOperation', () => {
		it('should profile operation execution', async () => {
			const operation = async () => {
				await new Promise((resolve) => setTimeout(resolve, 100))
				return 'result'
			}

			const result = await analyzer.profileOperation('test_operation', operation)
			const profiles = analyzer.getProfilingResults()

			expect(result).toBe('result')
			expect(profiles).toHaveLength(1)
			expect(profiles[0].operation).toBe('test_operation')
			expect(profiles[0].duration).toBeGreaterThan(90)
			expect(profiles[0].duration).toBeLessThan(200)
		})

		it('should profile operation with error', async () => {
			const operation = async () => {
				await new Promise((resolve) => setTimeout(resolve, 50))
				throw new Error('Test error')
			}

			await expect(analyzer.profileOperation('error_operation', operation)).rejects.toThrow(
				'Test error'
			)

			const profiles = analyzer.getProfilingResults()
			expect(profiles).toHaveLength(1)
			expect(profiles[0].breakdown.error).toBeDefined()
		})
	})

	describe('identifyBottlenecks', () => {
		it('should identify bottlenecks from performance metrics', () => {
			const metrics: PerformanceMetrics = {
				eventProcessingTime: 600, // Critical threshold
				eventValidationTime: 150, // High threshold
				eventHashingTime: 25, // Medium threshold
				eventStorageTime: 50, // Normal
				queueWaitTime: 0,
				queueProcessingTime: 0,
				queueDepth: 0,
				dbConnectionTime: 0,
				dbQueryTime: 0,
				dbTransactionTime: 0,
				redisConnectionTime: 0,
				redisOperationTime: 0,
				memoryUsage: 0,
				heapUsed: 0,
				heapTotal: 0,
				cpuUsage: 0,
				timestamp: '2023-01-01T00:00:00.000Z',
			}

			const bottlenecks = analyzer.identifyBottlenecks(metrics)

			expect(bottlenecks).toHaveLength(3)

			const criticalBottleneck = bottlenecks.find((b) => b.severity === 'CRITICAL')
			expect(criticalBottleneck).toBeDefined()
			expect(criticalBottleneck!.component).toBe('Event Processing')

			const highBottleneck = bottlenecks.find((b) => b.severity === 'HIGH')
			expect(highBottleneck).toBeDefined()
			expect(highBottleneck!.component).toBe('Event Validation')

			const mediumBottleneck = bottlenecks.find((b) => b.severity === 'MEDIUM')
			expect(mediumBottleneck).toBeDefined()
			expect(mediumBottleneck!.component).toBe('Event Hashing')
		})

		it('should not identify bottlenecks for good performance', () => {
			const metrics: PerformanceMetrics = {
				eventProcessingTime: 50,
				eventValidationTime: 25,
				eventHashingTime: 5,
				eventStorageTime: 100,
				queueWaitTime: 0,
				queueProcessingTime: 50,
				queueDepth: 0,
				dbConnectionTime: 0,
				dbQueryTime: 50,
				dbTransactionTime: 0,
				redisConnectionTime: 0,
				redisOperationTime: 5,
				memoryUsage: 0,
				heapUsed: 0,
				heapTotal: 0,
				cpuUsage: 0,
				timestamp: '2023-01-01T00:00:00.000Z',
			}

			const bottlenecks = analyzer.identifyBottlenecks(metrics)

			expect(bottlenecks).toHaveLength(0)
		})
	})

	describe('generateRecommendations', () => {
		it('should generate system-wide recommendations for multiple bottlenecks', () => {
			const analyses = Array.from({ length: 6 }, (_, i) => ({
				component: `Component${i}`,
				operation: `operation${i}`,
				averageTime: 200,
				maxTime: 300,
				minTime: 100,
				percentile95: 250,
				percentile99: 280,
				sampleCount: 100,
				isBottleneck: true,
				severity: 'HIGH' as const,
				recommendations: [],
				timestamp: '2023-01-01T00:00:00.000Z',
			}))

			const recommendations = analyzer.generateRecommendations(analyses)

			expect(recommendations).toContain(
				'Consider implementing horizontal scaling due to multiple performance bottlenecks'
			)
		})

		it('should generate critical issue recommendations', () => {
			const analyses = [
				{
					component: 'Database',
					operation: 'query',
					averageTime: 1000,
					maxTime: 2000,
					minTime: 500,
					percentile95: 1500,
					percentile99: 1800,
					sampleCount: 100,
					isBottleneck: true,
					severity: 'CRITICAL' as const,
					recommendations: [],
					timestamp: '2023-01-01T00:00:00.000Z',
				},
			]

			const recommendations = analyzer.generateRecommendations(analyses)

			expect(recommendations).toContain(
				'Address critical performance issues immediately to prevent system degradation'
			)
			expect(recommendations).toContain(
				'Consider database query optimization, indexing, or connection pooling'
			)
		})

		it('should generate component-specific recommendations', () => {
			const analyses = [
				{
					component: 'Queue Processing',
					operation: 'process',
					averageTime: 150,
					maxTime: 200,
					minTime: 100,
					percentile95: 180,
					percentile99: 190,
					sampleCount: 100,
					isBottleneck: true,
					severity: 'MEDIUM' as const,
					recommendations: [],
					timestamp: '2023-01-01T00:00:00.000Z',
				},
			]

			const recommendations = analyzer.generateRecommendations(analyses)

			expect(recommendations).toContain(
				'Consider increasing queue worker concurrency or optimizing queue processing'
			)
		})
	})

	describe('getProfilingResults', () => {
		it('should return all profiling results', async () => {
			const operation1 = async () => 'result1'
			const operation2 = async () => 'result2'

			await analyzer.profileOperation('op1', operation1)
			await analyzer.profileOperation('op2', operation2)

			const results = analyzer.getProfilingResults()

			expect(results).toHaveLength(2)
			expect(results[0].operation).toBe('op1')
			expect(results[1].operation).toBe('op2')
		})

		it('should limit profiling results to 100', async () => {
			// Create 105 profiling results
			for (let i = 0; i < 105; i++) {
				await analyzer.profileOperation(`op${i}`, async () => `result${i}`)
			}

			const results = analyzer.getProfilingResults()

			expect(results).toHaveLength(100)
			// Should keep the most recent 100
			expect(results[0].operation).toBe('op5')
			expect(results[99].operation).toBe('op104')
		})
	})
})
