/**
 * Integration tests for observability features
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
	AuditBottleneckAnalyzer,
	AuditTracer,
	DEFAULT_OBSERVABILITY_CONFIG,
	PerformanceTimer,
} from '../index.js'

describe('Observability Integration', () => {
	describe('AuditTracer Integration', () => {
		let tracer: AuditTracer

		beforeEach(() => {
			tracer = new AuditTracer(DEFAULT_OBSERVABILITY_CONFIG.tracing)
		})

		it('should create and manage spans correctly', () => {
			const span = tracer.startSpan('test-operation')

			expect(span.operationName).toBe('test-operation')
			expect(span.traceId).toBeDefined()
			expect(span.spanId).toBeDefined()
			expect(span.startTime).toBeDefined()

			span.setTag('test.key', 'test.value')
			span.log('info', 'Test log message')

			tracer.finishSpan(span)

			expect(span.endTime).toBeDefined()
			expect(span.duration).toBeDefined()
			expect(span.duration!).toBeGreaterThanOrEqual(0)
		})

		it('should create child spans with proper relationships', () => {
			const parentSpan = tracer.startSpan('parent-operation')
			const childSpan = tracer.createChildSpan(parentSpan, 'child-operation')

			expect(childSpan.traceId).toBe(parentSpan.traceId)
			expect(childSpan.parentSpanId).toBe(parentSpan.spanId)
			expect(childSpan.operationName).toBe('child-operation')

			tracer.finishSpan(childSpan)
			tracer.finishSpan(parentSpan)
		})

		it('should inject and extract trace context', () => {
			const span = tracer.startSpan('context-test')
			const context = tracer.injectContext(span)

			expect(context.traceId).toBe(span.traceId)
			expect(context.spanId).toBe(span.spanId)

			const headers = {
				'x-trace-id': context.traceId,
				'x-span-id': context.spanId,
			}

			const extractedContext = tracer.extractContext(headers)
			expect(extractedContext).toBeDefined()
			expect(extractedContext!.traceId).toBe(context.traceId)
			expect(extractedContext!.spanId).toBe(context.spanId)
		})
	})

	describe('AuditBottleneckAnalyzer Integration', () => {
		let analyzer: AuditBottleneckAnalyzer

		beforeEach(() => {
			analyzer = new AuditBottleneckAnalyzer()
		})

		it('should analyze performance bottlenecks correctly', async () => {
			const operations = [
				{
					operationType: 'CREATE' as const,
					operationName: 'slow_operation',
					duration: 500,
					success: true,
					metadata: {},
					timestamp: '2023-01-01T00:00:00.000Z',
				},
				{
					operationType: 'CREATE' as const,
					operationName: 'slow_operation',
					duration: 600,
					success: true,
					metadata: {},
					timestamp: '2023-01-01T00:01:00.000Z',
				},
				{
					operationType: 'CREATE' as const,
					operationName: 'fast_operation',
					duration: 50,
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
		})

		it('should identify bottlenecks from performance metrics', () => {
			const metrics = {
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

			expect(bottlenecks.length).toBeGreaterThan(0)

			const criticalBottleneck = bottlenecks.find((b) => b.severity === 'CRITICAL')
			expect(criticalBottleneck).toBeDefined()
			expect(criticalBottleneck!.component).toBe('Event Processing')
		})

		it('should generate recommendations for bottlenecks', () => {
			const analyses = [
				{
					component: 'Database',
					operation: 'query',
					averageTime: 300,
					maxTime: 500,
					minTime: 100,
					percentile95: 400,
					percentile99: 450,
					sampleCount: 100,
					isBottleneck: true,
					severity: 'HIGH' as const,
					recommendations: [],
					timestamp: '2023-01-01T00:00:00.000Z',
				},
			]

			const recommendations = analyzer.generateRecommendations(analyses)

			expect(recommendations.length).toBeGreaterThan(0)
			expect(recommendations.some((r) => r.includes('database'))).toBe(true)
		})
	})

	describe('PerformanceTimer Integration', () => {
		it('should measure performance accurately', async () => {
			const timer = new PerformanceTimer()

			// Wait a bit to ensure measurable duration
			await new Promise((resolve) => setTimeout(resolve, 10))

			const duration = timer.stop()

			expect(duration).toBeGreaterThan(0)
			expect(duration).toBeGreaterThan(5) // Should be at least 5ms
		})

		it('should provide current duration without stopping', async () => {
			const timer = new PerformanceTimer()

			await new Promise((resolve) => setTimeout(resolve, 10))

			const duration1 = timer.getCurrentDuration()

			await new Promise((resolve) => setTimeout(resolve, 10))

			const duration2 = timer.getCurrentDuration()

			expect(duration1).toBeGreaterThan(0)
			expect(duration2).toBeGreaterThan(duration1)
		})

		it('should reset correctly', async () => {
			const timer = new PerformanceTimer()

			await new Promise((resolve) => setTimeout(resolve, 10))

			const duration1 = timer.getCurrentDuration()
			timer.reset()

			const duration2 = timer.getCurrentDuration()

			expect(duration1).toBeGreaterThan(0)
			expect(duration2).toBeLessThan(duration1)
		})
	})

	describe('Configuration Integration', () => {
		it('should use default observability configuration', () => {
			const config = DEFAULT_OBSERVABILITY_CONFIG

			expect(config.tracing.enabled).toBe(true)
			expect(config.tracing.serviceName).toBe('audit-system')
			expect(config.tracing.sampleRate).toBe(1.0)
			expect(config.tracing.exporterType).toBe('console')

			expect(config.metrics.enabled).toBe(true)
			expect(config.metrics.collectionInterval).toBe(30000)
			expect(config.metrics.retentionPeriod).toBe(86400)

			expect(config.profiling.enabled).toBe(true)
			expect(config.profiling.sampleRate).toBe(0.1)
			expect(config.profiling.maxProfiles).toBe(100)
		})

		it('should create tracer with custom configuration', () => {
			const customConfig = {
				enabled: true,
				serviceName: 'custom-service',
				sampleRate: 0.5,
				exporterType: 'jaeger' as const,
			}

			const tracer = new AuditTracer(customConfig)
			const span = tracer.startSpan('test-operation')

			expect(span.tags['service.name']).toBe('custom-service')
		})
	})
})
