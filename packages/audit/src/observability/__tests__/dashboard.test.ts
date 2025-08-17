/**
 * Tests for monitoring dashboard
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuditMonitoringDashboard } from '../dashboard.js'

import type {
	BottleneckAnalysis,
	BottleneckAnalyzer,
	ComponentHealthMetrics,
	DashboardMetrics,
	EnhancedMetricsCollector,
	TimeSeriesMetrics,
} from '../index.js'

// Mock metrics collector
const mockMetricsCollector: EnhancedMetricsCollector = {
	recordPerformanceMetrics: vi.fn(),
	getPerformanceMetrics: vi.fn(),
	collectSystemMetrics: vi.fn(),
	recordSystemMetrics: vi.fn(),
	recordOperation: vi.fn(),
	getOperationMetrics: vi.fn(),
	getDashboardMetrics: vi.fn(),
	recordComponentHealth: vi.fn(),
	getComponentHealth: vi.fn(),
	recordTimeSeriesData: vi.fn(),
	getTimeSeriesData: vi.fn(),
	cleanup: vi.fn(),
	exportMetrics: vi.fn(),
}

// Mock bottleneck analyzer
const mockBottleneckAnalyzer: BottleneckAnalyzer = {
	analyzePerformance: vi.fn(),
	profileOperation: vi.fn(),
	getProfilingResults: vi.fn(),
	identifyBottlenecks: vi.fn(),
	generateRecommendations: vi.fn(),
}

describe('AuditMonitoringDashboard', () => {
	let dashboard: AuditMonitoringDashboard
	const config = {
		refreshInterval: 30000,
		dataRetention: 86400,
		alertThresholds: {
			errorRate: 0.05,
			latency: 1000,
			throughput: 100,
		},
		components: ['database', 'redis', 'queue'],
	}

	beforeEach(() => {
		vi.clearAllMocks()
		dashboard = new AuditMonitoringDashboard(mockMetricsCollector, mockBottleneckAnalyzer, config)
	})

	describe('getDashboardData', () => {
		it('should return complete dashboard data', async () => {
			const mockDashboardMetrics: DashboardMetrics = {
				totalEvents: 1000,
				eventsPerSecond: 10,
				averageProcessingTime: 100,
				errorRate: 0.02,
				throughput: 10,
				latency: {
					eventProcessingTime: 100,
					eventValidationTime: 50,
					eventHashingTime: 10,
					eventStorageTime: 200,
					queueWaitTime: 50,
					queueProcessingTime: 100,
					queueDepth: 5,
					dbConnectionTime: 20,
					dbQueryTime: 80,
					dbTransactionTime: 150,
					redisConnectionTime: 5,
					redisOperationTime: 10,
					memoryUsage: 512,
					heapUsed: 256,
					heapTotal: 512,
					cpuUsage: 25,
					timestamp: '2023-01-01T00:00:00.000Z',
				},
				bottlenecks: [],
				systemMetrics: {
					cpu: { usage: 25, loadAverage: [1.0, 1.2, 1.1] },
					memory: { used: 512, total: 1024, free: 512, heapUsed: 256, heapTotal: 512 },
					disk: { used: 100, total: 1000, free: 900 },
					network: { bytesIn: 1000, bytesOut: 2000, packetsIn: 100, packetsOut: 200 },
					timestamp: '2023-01-01T00:00:00.000Z',
				},
				componentHealth: {
					database: {
						name: 'database',
						status: 'HEALTHY',
						uptime: 3600,
						responseTime: 50,
						errorRate: 0.01,
						throughput: 100,
						lastCheck: '2023-01-01T00:00:00.000Z',
					},
				},
				activeAlerts: 0,
				suspiciousPatterns: 0,
				timeSeriesData: [
					{
						timestamp: '2023-01-01T00:00:00.000Z',
						eventsProcessed: 100,
						processingLatency: 100,
						errorRate: 0.02,
						queueDepth: 5,
						cpuUsage: 25,
						memoryUsage: 50,
					},
				],
				timestamp: '2023-01-01T00:00:00.000Z',
			}

			const mockComponentHealth: ComponentHealthMetrics[] = [
				{
					name: 'database',
					status: 'HEALTHY',
					uptime: 3600,
					responseTime: 50,
					errorRate: 0.01,
					throughput: 100,
					lastCheck: '2023-01-01T00:00:00.000Z',
				},
			]

			const mockTimeSeriesData: TimeSeriesMetrics[] = [
				{
					timestamp: '2023-01-01T00:00:00.000Z',
					eventsProcessed: 100,
					processingLatency: 100,
					errorRate: 0.02,
					queueDepth: 5,
					cpuUsage: 25,
					memoryUsage: 50,
				},
			]

			const mockBottlenecks: BottleneckAnalysis[] = []

			mockMetricsCollector.getDashboardMetrics = vi.fn().mockResolvedValue(mockDashboardMetrics)
			mockMetricsCollector.getComponentHealth = vi.fn().mockResolvedValue(mockComponentHealth)
			mockMetricsCollector.getTimeSeriesData = vi.fn().mockResolvedValue(mockTimeSeriesData)
			mockMetricsCollector.getOperationMetrics = vi.fn().mockResolvedValue([])
			mockBottleneckAnalyzer.analyzePerformance = vi.fn().mockResolvedValue(mockBottlenecks)

			const dashboardData = await dashboard.getDashboardData()

			expect(dashboardData).toBeDefined()
			expect(dashboardData.overview.totalEvents).toBe(1000)
			expect(dashboardData.overview.systemStatus).toBe('HEALTHY')
			expect(dashboardData.performance.throughput.current).toBe(10)
			expect(dashboardData.health.overallStatus).toBe('HEALTHY')
			expect(dashboardData.alerts.total).toBe(0)
		})

		it('should determine CRITICAL system status for high error rate', async () => {
			const mockDashboardMetrics: DashboardMetrics = {
				totalEvents: 1000,
				eventsPerSecond: 10,
				averageProcessingTime: 100,
				errorRate: 0.15, // High error rate
				throughput: 10,
				latency: {} as any,
				bottlenecks: [],
				systemMetrics: {} as any,
				componentHealth: {},
				activeAlerts: 0,
				suspiciousPatterns: 0,
				timeSeriesData: [],
				timestamp: '2023-01-01T00:00:00.000Z',
			}

			mockMetricsCollector.getDashboardMetrics = vi.fn().mockResolvedValue(mockDashboardMetrics)
			mockMetricsCollector.getComponentHealth = vi.fn().mockResolvedValue([])
			mockMetricsCollector.getTimeSeriesData = vi.fn().mockResolvedValue([])
			mockMetricsCollector.getOperationMetrics = vi.fn().mockResolvedValue([])
			mockBottleneckAnalyzer.analyzePerformance = vi.fn().mockResolvedValue([])

			const dashboardData = await dashboard.getDashboardData()

			expect(dashboardData.overview.systemStatus).toBe('CRITICAL')
		})

		it('should determine DEGRADED system status for moderate issues', async () => {
			const mockDashboardMetrics: DashboardMetrics = {
				totalEvents: 1000,
				eventsPerSecond: 10,
				averageProcessingTime: 1500, // High processing time
				errorRate: 0.03,
				throughput: 10,
				latency: {} as any,
				bottlenecks: [],
				systemMetrics: {} as any,
				componentHealth: {},
				activeAlerts: 0,
				suspiciousPatterns: 0,
				timeSeriesData: [],
				timestamp: '2023-01-01T00:00:00.000Z',
			}

			mockMetricsCollector.getDashboardMetrics = vi.fn().mockResolvedValue(mockDashboardMetrics)
			mockMetricsCollector.getComponentHealth = vi.fn().mockResolvedValue([])
			mockMetricsCollector.getTimeSeriesData = vi.fn().mockResolvedValue([])
			mockMetricsCollector.getOperationMetrics = vi.fn().mockResolvedValue([])
			mockBottleneckAnalyzer.analyzePerformance = vi.fn().mockResolvedValue([])

			const dashboardData = await dashboard.getDashboardData()

			expect(dashboardData.overview.systemStatus).toBe('DEGRADED')
		})
	})

	describe('getComponentHealth', () => {
		it('should return component health metrics', async () => {
			const mockHealth: ComponentHealthMetrics[] = [
				{
					name: 'database',
					status: 'HEALTHY',
					uptime: 3600,
					responseTime: 50,
					errorRate: 0.01,
					throughput: 100,
					lastCheck: '2023-01-01T00:00:00.000Z',
				},
				{
					name: 'redis',
					status: 'DEGRADED',
					uptime: 3600,
					responseTime: 100,
					errorRate: 0.05,
					throughput: 80,
					lastCheck: '2023-01-01T00:00:00.000Z',
				},
			]

			mockMetricsCollector.getComponentHealth = vi.fn().mockResolvedValue(mockHealth)

			const health = await dashboard.getComponentHealth()

			expect(health).toHaveLength(2)
			expect(health[0].name).toBe('database')
			expect(health[0].status).toBe('HEALTHY')
			expect(health[1].name).toBe('redis')
			expect(health[1].status).toBe('DEGRADED')
		})
	})

	describe('getTimeSeriesData', () => {
		it('should return aggregated time series data', async () => {
			const mockData: TimeSeriesMetrics[] = [
				{
					timestamp: '2023-01-01T00:00:00.000Z',
					eventsProcessed: 100,
					processingLatency: 100,
					errorRate: 0.02,
					queueDepth: 5,
					cpuUsage: 25,
					memoryUsage: 50,
				},
				{
					timestamp: '2023-01-01T00:01:00.000Z',
					eventsProcessed: 120,
					processingLatency: 110,
					errorRate: 0.03,
					queueDepth: 6,
					cpuUsage: 30,
					memoryUsage: 55,
				},
			]

			mockMetricsCollector.getTimeSeriesData = vi.fn().mockResolvedValue(mockData)

			const timeRange = {
				start: Date.now() - 3600000,
				end: Date.now(),
				interval: 'minute' as const,
			}

			const data = await dashboard.getTimeSeriesData(timeRange)

			expect(data).toHaveLength(2)
			expect(mockMetricsCollector.getTimeSeriesData).toHaveBeenCalledWith(
				timeRange.start,
				timeRange.end
			)
		})
	})

	describe('getBottleneckAnalysis', () => {
		it('should return bottleneck analysis', async () => {
			const mockBottlenecks: BottleneckAnalysis[] = [
				{
					component: 'Database',
					operation: 'query',
					averageTime: 200,
					maxTime: 500,
					minTime: 100,
					percentile95: 300,
					percentile99: 400,
					sampleCount: 100,
					isBottleneck: true,
					severity: 'HIGH',
					recommendations: ['Optimize queries'],
					timestamp: '2023-01-01T00:00:00.000Z',
				},
			]

			mockMetricsCollector.getOperationMetrics = vi.fn().mockResolvedValue([])
			mockBottleneckAnalyzer.analyzePerformance = vi.fn().mockResolvedValue(mockBottlenecks)

			const bottlenecks = await dashboard.getBottleneckAnalysis()

			expect(bottlenecks).toHaveLength(1)
			expect(bottlenecks[0].component).toBe('Database')
			expect(bottlenecks[0].severity).toBe('HIGH')
		})
	})

	describe('getAlerts', () => {
		it('should generate alerts from component health', async () => {
			const mockHealth: ComponentHealthMetrics[] = [
				{
					name: 'database',
					status: 'UNHEALTHY',
					uptime: 3600,
					responseTime: 1000,
					errorRate: 0.2,
					throughput: 10,
					lastCheck: '2023-01-01T00:00:00.000Z',
				},
				{
					name: 'redis',
					status: 'DEGRADED',
					uptime: 3600,
					responseTime: 200,
					errorRate: 0.1,
					throughput: 50,
					lastCheck: '2023-01-01T00:00:00.000Z',
				},
			]

			mockMetricsCollector.getComponentHealth = vi.fn().mockResolvedValue(mockHealth)
			mockMetricsCollector.getOperationMetrics = vi.fn().mockResolvedValue([])
			mockBottleneckAnalyzer.analyzePerformance = vi.fn().mockResolvedValue([])

			const alerts = await dashboard.getAlerts()

			expect(alerts.total).toBe(2)
			expect(alerts.critical).toBe(1)
			expect(alerts.high).toBe(1)
			expect(alerts.recent).toHaveLength(2)
		})

		it('should generate alerts from bottlenecks', async () => {
			const mockBottlenecks: BottleneckAnalysis[] = [
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
					severity: 'CRITICAL',
					recommendations: [],
					timestamp: '2023-01-01T00:00:00.000Z',
				},
			]

			mockMetricsCollector.getComponentHealth = vi.fn().mockResolvedValue([])
			mockMetricsCollector.getOperationMetrics = vi.fn().mockResolvedValue([])
			mockBottleneckAnalyzer.analyzePerformance = vi.fn().mockResolvedValue(mockBottlenecks)

			const alerts = await dashboard.getAlerts()

			expect(alerts.total).toBe(1)
			expect(alerts.critical).toBe(1)
		})
	})

	describe('exportDashboardData', () => {
		it('should export dashboard data in JSON format', async () => {
			// Mock minimal dashboard data
			mockMetricsCollector.getDashboardMetrics = vi.fn().mockResolvedValue({
				totalEvents: 1000,
				eventsPerSecond: 10,
				averageProcessingTime: 100,
				errorRate: 0.02,
				throughput: 10,
				latency: {} as any,
				bottlenecks: [],
				systemMetrics: {} as any,
				componentHealth: {},
				activeAlerts: 0,
				suspiciousPatterns: 0,
				timeSeriesData: [],
				timestamp: '2023-01-01T00:00:00.000Z',
			})
			mockMetricsCollector.getComponentHealth = vi.fn().mockResolvedValue([])
			mockMetricsCollector.getTimeSeriesData = vi.fn().mockResolvedValue([])
			mockMetricsCollector.getOperationMetrics = vi.fn().mockResolvedValue([])
			mockBottleneckAnalyzer.analyzePerformance = vi.fn().mockResolvedValue([])

			const exported = await dashboard.exportDashboardData('json')
			const parsed = JSON.parse(exported)

			expect(parsed).toHaveProperty('overview')
			expect(parsed).toHaveProperty('performance')
			expect(parsed).toHaveProperty('health')
			expect(parsed).toHaveProperty('alerts')
		})

		it('should export dashboard data in CSV format', async () => {
			// Mock minimal dashboard data
			mockMetricsCollector.getDashboardMetrics = vi.fn().mockResolvedValue({
				totalEvents: 1000,
				eventsPerSecond: 10,
				averageProcessingTime: 100,
				errorRate: 0.02,
				throughput: 10,
				latency: {} as any,
				bottlenecks: [],
				systemMetrics: {} as any,
				componentHealth: {},
				activeAlerts: 0,
				suspiciousPatterns: 0,
				timeSeriesData: [],
				timestamp: '2023-01-01T00:00:00.000Z',
			})
			mockMetricsCollector.getComponentHealth = vi.fn().mockResolvedValue([])
			mockMetricsCollector.getTimeSeriesData = vi.fn().mockResolvedValue([])
			mockMetricsCollector.getOperationMetrics = vi.fn().mockResolvedValue([])
			mockBottleneckAnalyzer.analyzePerformance = vi.fn().mockResolvedValue([])

			const exported = await dashboard.exportDashboardData('csv')

			expect(exported).toContain('Section,Metric,Value,Timestamp')
			expect(exported).toContain('Overview,Total Events,1000')
			expect(exported).toContain('Overview,Events Per Second,10')
		})
	})
})
