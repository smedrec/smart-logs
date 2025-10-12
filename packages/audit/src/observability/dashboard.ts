/**
 * Monitoring dashboard for audit system health and performance visualization
 */
import { AlertSeverity, AlertStatistics, AlertType } from '../monitor/monitoring-types.js'
import { MonitoringService } from '../monitor/monitoring.js'

import type { BottleneckAnalyzer } from './bottleneck-analyzer.js'
import type { EnhancedMetricsCollector } from './metrics-collector.js'
import type {
	BottleneckAnalysis,
	ComponentHealthMetrics,
	DashboardMetrics,
	TimeSeriesMetrics,
} from './types.js'

/**
 * Dashboard data provider interface
 */
export interface DashboardDataProvider {
	getDashboardData(): Promise<DashboardData>
	getComponentHealth(): Promise<ComponentHealthMetrics[]>
	getTimeSeriesData(timeRange: TimeRange): Promise<TimeSeriesMetrics[]>
	getBottleneckAnalysis(): Promise<BottleneckAnalysis[]>
	getAlerts(): Promise<AlertSummary>
	exportDashboardData(format: 'json' | 'csv'): Promise<string>
}

/**
 * Time range for dashboard queries
 */
export interface TimeRange {
	start: number
	end: number
	interval: 'minute' | 'hour' | 'day'
}

/**
 * Complete dashboard data structure
 */
export interface DashboardData {
	overview: OverviewMetrics
	performance: PerformanceData
	health: HealthData
	alerts: AlertSummary
	trends: TrendData
	timestamp: string
}

/**
 * Overview metrics for dashboard
 */
export interface OverviewMetrics {
	totalEvents: number
	eventsPerSecond: number
	averageProcessingTime: number
	errorRate: number
	uptime: number
	systemStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
}

/**
 * Performance data for dashboard
 */
export interface PerformanceData {
	throughput: {
		current: number
		peak: number
		average: number
	}
	latency: {
		p50: number
		p95: number
		p99: number
		max: number
	}
	bottlenecks: BottleneckAnalysis[]
	resourceUsage: {
		cpu: number
		memory: number
		disk: number
		network: number
	}
}

/**
 * Health data for dashboard
 */
export interface HealthData {
	components: ComponentHealthMetrics[]
	overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
	criticalComponents: string[]
	degradedComponents: string[]
}

/**
 * Alert summary for dashboard
 */
export interface AlertSummary {
	total: number
	active: number
	acknowledged: number
	resolved: number
	bySeverity: Record<AlertSeverity, number>
	byType: Record<AlertType, number>
	recent: AlertInfo[]
}

/**
 * Alert information
 */
export interface AlertInfo {
	id: string
	severity: AlertSeverity
	title: string
	timestamp: string
	component: string
}

/**
 * Trend data for dashboard
 */
export interface TrendData {
	timeSeries: TimeSeriesMetrics[]
	trends: {
		eventsProcessed: TrendInfo
		processingLatency: TrendInfo
		errorRate: TrendInfo
		systemLoad: TrendInfo
	}
}

/**
 * Trend information
 */
export interface TrendInfo {
	current: number
	previous: number
	change: number
	changePercent: number
	direction: 'up' | 'down' | 'stable'
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
	refreshInterval: number
	dataRetention: number
	alertThresholds: {
		errorRate: number
		latency: number
		throughput: number
	}
	components: string[]
}

/**
 * Audit system monitoring dashboard implementation
 */
export class AuditMonitoringDashboard implements DashboardDataProvider {
	private monitor: MonitoringService
	private metricsCollector: EnhancedMetricsCollector
	private bottleneckAnalyzer: BottleneckAnalyzer
	private config: DashboardConfig
	private cache: Map<string, { data: any; timestamp: number }> = new Map()
	private readonly cacheTimeout = 30000 // 30 seconds

	constructor(
		monitor: MonitoringService,
		metricsCollector: EnhancedMetricsCollector,
		bottleneckAnalyzer: BottleneckAnalyzer,
		config: DashboardConfig
	) {
		this.monitor = monitor
		this.metricsCollector = metricsCollector
		this.bottleneckAnalyzer = bottleneckAnalyzer
		this.config = config
	}

	/**
	 * Get complete dashboard data
	 */
	async getDashboardData(): Promise<DashboardData> {
		const cacheKey = 'dashboard-data'
		const cached = this.getFromCache(cacheKey)
		if (cached) return cached

		const [dashboardMetrics, componentHealth, timeSeriesData, bottleneckAnalysis, alerts] =
			await Promise.all([
				this.metricsCollector.getDashboardMetrics(),
				this.getComponentHealth(),
				this.getTimeSeriesData({
					start: Date.now() - 3600000, // Last hour
					end: Date.now(),
					interval: 'minute',
				}),
				this.getBottleneckAnalysis(),
				this.getAlerts(),
			])

		const dashboardData: DashboardData = {
			overview: this.buildOverviewMetrics(dashboardMetrics),
			performance: this.buildPerformanceData(dashboardMetrics, bottleneckAnalysis),
			health: this.buildHealthData(componentHealth),
			alerts,
			trends: this.buildTrendData(timeSeriesData),
			timestamp: new Date().toISOString(),
		}

		this.setCache(cacheKey, dashboardData)
		return dashboardData
	}

	/**
	 * Get component health metrics
	 */
	async getComponentHealth(): Promise<ComponentHealthMetrics[]> {
		const cacheKey = 'component-health'
		const cached = this.getFromCache(cacheKey)
		if (cached) return cached

		const health = await this.metricsCollector.getComponentHealth()
		this.setCache(cacheKey, health)
		return health
	}

	/**
	 * Get time series data for specified range
	 */
	async getTimeSeriesData(timeRange: TimeRange): Promise<TimeSeriesMetrics[]> {
		const cacheKey = `timeseries-${timeRange.start}-${timeRange.end}-${timeRange.interval}`
		const cached = this.getFromCache(cacheKey)
		if (cached) return cached

		const data = await this.metricsCollector.getTimeSeriesData(timeRange.start, timeRange.end)

		// Aggregate data based on interval
		const aggregated = this.aggregateTimeSeriesData(data, timeRange.interval)

		this.setCache(cacheKey, aggregated)
		return aggregated
	}

	/**
	 * Get bottleneck analysis
	 */
	async getBottleneckAnalysis(): Promise<BottleneckAnalysis[]> {
		const cacheKey = 'bottleneck-analysis'
		const cached = this.getFromCache(cacheKey)
		if (cached) return cached

		// Get recent operations for analysis
		const operations = await this.metricsCollector.getOperationMetrics()
		const recentOps = operations.filter(
			(op) => new Date(op.timestamp).getTime() > Date.now() - 3600000 // Last hour
		)

		const analysis = await this.bottleneckAnalyzer.analyzePerformance(recentOps)
		this.setCache(cacheKey, analysis)
		return analysis
	}

	/**
	 * Get alert summary
	 */
	async getAlerts(): Promise<AlertSummary> {
		const cacheKey = 'alerts'
		const cached = this.getFromCache(cacheKey)
		if (cached) return cached

		const alertStatistics: AlertStatistics = await this.monitor.getAlertStatistics()

		const summary: AlertSummary = {
			...alertStatistics,
			recent: [], // Last 10 alerts
		}

		this.setCache(cacheKey, summary)
		return summary
	}

	/**
	 * Export dashboard data in specified format
	 */
	async exportDashboardData(format: 'json' | 'csv'): Promise<string> {
		const dashboardData = await this.getDashboardData()

		if (format === 'json') {
			return JSON.stringify(dashboardData, null, 2)
		}

		// CSV format
		const csvLines: string[] = []

		// Overview metrics
		csvLines.push('Section,Metric,Value,Timestamp')
		csvLines.push(
			`Overview,Total Events,${dashboardData.overview.totalEvents},${dashboardData.timestamp}`
		)
		csvLines.push(
			`Overview,Events Per Second,${dashboardData.overview.eventsPerSecond},${dashboardData.timestamp}`
		)
		csvLines.push(
			`Overview,Average Processing Time,${dashboardData.overview.averageProcessingTime},${dashboardData.timestamp}`
		)
		csvLines.push(
			`Overview,Error Rate,${dashboardData.overview.errorRate},${dashboardData.timestamp}`
		)
		csvLines.push(
			`Overview,System Status,${dashboardData.overview.systemStatus},${dashboardData.timestamp}`
		)

		// Performance metrics
		csvLines.push(
			`Performance,Current Throughput,${dashboardData.performance.throughput.current},${dashboardData.timestamp}`
		)
		csvLines.push(
			`Performance,Peak Throughput,${dashboardData.performance.throughput.peak},${dashboardData.timestamp}`
		)
		csvLines.push(
			`Performance,P95 Latency,${dashboardData.performance.latency.p95},${dashboardData.timestamp}`
		)
		csvLines.push(
			`Performance,P99 Latency,${dashboardData.performance.latency.p99},${dashboardData.timestamp}`
		)
		csvLines.push(
			`Performance,CPU Usage,${dashboardData.performance.resourceUsage.cpu},${dashboardData.timestamp}`
		)
		csvLines.push(
			`Performance,Memory Usage,${dashboardData.performance.resourceUsage.memory},${dashboardData.timestamp}`
		)

		// Component health
		for (const component of dashboardData.health.components) {
			csvLines.push(`Health,${component.name} Status,${component.status},${component.lastCheck}`)
			csvLines.push(
				`Health,${component.name} Response Time,${component.responseTime},${component.lastCheck}`
			)
			csvLines.push(
				`Health,${component.name} Error Rate,${component.errorRate},${component.lastCheck}`
			)
		}

		return csvLines.join('\n')
	}

	/**
	 * Build overview metrics from dashboard metrics
	 */
	private buildOverviewMetrics(metrics: DashboardMetrics): OverviewMetrics {
		// Determine system status based on error rate and component health
		let systemStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY'

		if (metrics.errorRate > 0.1) {
			// 10% error rate
			systemStatus = 'CRITICAL'
		} else if (metrics.errorRate > 0.05 || metrics.averageProcessingTime > 1000) {
			systemStatus = 'DEGRADED'
		}

		// Check component health
		const unhealthyComponents = Object.values(metrics.componentHealth).filter(
			(c) => c.status === 'UNHEALTHY'
		).length
		const degradedComponents = Object.values(metrics.componentHealth).filter(
			(c) => c.status === 'DEGRADED'
		).length

		if (unhealthyComponents > 0) {
			systemStatus = 'CRITICAL'
		} else if (degradedComponents > 0 && systemStatus === 'HEALTHY') {
			systemStatus = 'DEGRADED'
		}

		return {
			totalEvents: metrics.totalEvents,
			eventsPerSecond: metrics.eventsPerSecond,
			averageProcessingTime: metrics.averageProcessingTime,
			errorRate: metrics.errorRate,
			uptime: process.uptime(),
			systemStatus,
		}
	}

	/**
	 * Build performance data from metrics and bottleneck analysis
	 */
	private buildPerformanceData(
		metrics: DashboardMetrics,
		bottlenecks: BottleneckAnalysis[]
	): PerformanceData {
		// Calculate latency percentiles from time series data
		const latencies = metrics.timeSeriesData.map((d) => d.processingLatency).sort((a, b) => a - b)

		return {
			throughput: {
				current: metrics.eventsPerSecond,
				peak: Math.max(...metrics.timeSeriesData.map((d) => d.eventsProcessed / 60)), // Convert to per second
				average:
					metrics.timeSeriesData.reduce((sum, d) => sum + d.eventsProcessed, 0) /
					metrics.timeSeriesData.length /
					60,
			},
			latency: {
				p50: this.calculatePercentile(latencies, 0.5),
				p95: this.calculatePercentile(latencies, 0.95),
				p99: this.calculatePercentile(latencies, 0.99),
				max: Math.max(...latencies),
			},
			bottlenecks,
			resourceUsage: {
				cpu: metrics.systemMetrics.cpu.usage,
				memory: (metrics.systemMetrics.memory.used / metrics.systemMetrics.memory.total) * 100,
				disk:
					metrics.systemMetrics.disk.total > 0
						? (metrics.systemMetrics.disk.used / metrics.systemMetrics.disk.total) * 100
						: 0,
				network: 0, // Would need additional metrics
			},
		}
	}

	/**
	 * Build health data from component health metrics
	 */
	private buildHealthData(componentHealth: ComponentHealthMetrics[]): HealthData {
		const criticalComponents = componentHealth
			.filter((c) => c.status === 'UNHEALTHY')
			.map((c) => c.name)

		const degradedComponents = componentHealth
			.filter((c) => c.status === 'DEGRADED')
			.map((c) => c.name)

		let overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY'

		if (criticalComponents.length > 0) {
			overallStatus = 'CRITICAL'
		} else if (degradedComponents.length > 0) {
			overallStatus = 'DEGRADED'
		}

		return {
			components: componentHealth,
			overallStatus,
			criticalComponents,
			degradedComponents,
		}
	}

	/**
	 * Build trend data from time series metrics
	 */
	private buildTrendData(timeSeriesData: TimeSeriesMetrics[]): TrendData {
		if (timeSeriesData.length < 2) {
			// Not enough data for trends
			return {
				timeSeries: timeSeriesData,
				trends: {
					eventsProcessed: {
						current: 0,
						previous: 0,
						change: 0,
						changePercent: 0,
						direction: 'stable',
					},
					processingLatency: {
						current: 0,
						previous: 0,
						change: 0,
						changePercent: 0,
						direction: 'stable',
					},
					errorRate: { current: 0, previous: 0, change: 0, changePercent: 0, direction: 'stable' },
					systemLoad: { current: 0, previous: 0, change: 0, changePercent: 0, direction: 'stable' },
				},
			}
		}

		const latest = timeSeriesData[timeSeriesData.length - 1]
		const previous = timeSeriesData[timeSeriesData.length - 2]

		return {
			timeSeries: timeSeriesData,
			trends: {
				eventsProcessed: this.calculateTrend(latest.eventsProcessed, previous.eventsProcessed),
				processingLatency: this.calculateTrend(
					latest.processingLatency,
					previous.processingLatency
				),
				errorRate: this.calculateTrend(latest.errorRate, previous.errorRate),
				systemLoad: this.calculateTrend(latest.cpuUsage, previous.cpuUsage),
			},
		}
	}

	/**
	 * Calculate trend information between two values
	 */
	private calculateTrend(current: number, previous: number): TrendInfo {
		const change = current - previous
		const changePercent = previous !== 0 ? (change / previous) * 100 : 0

		let direction: 'up' | 'down' | 'stable' = 'stable'
		if (Math.abs(changePercent) > 5) {
			// 5% threshold for significant change
			direction = change > 0 ? 'up' : 'down'
		}

		return {
			current,
			previous,
			change,
			changePercent,
			direction,
		}
	}

	/**
	 * Aggregate time series data by interval
	 */
	private aggregateTimeSeriesData(
		data: TimeSeriesMetrics[],
		interval: 'minute' | 'hour' | 'day'
	): TimeSeriesMetrics[] {
		if (data.length === 0) return []

		const intervalMs = {
			minute: 60 * 1000,
			hour: 60 * 60 * 1000,
			day: 24 * 60 * 60 * 1000,
		}[interval]

		const buckets = new Map<number, TimeSeriesMetrics[]>()

		// Group data into time buckets
		for (const item of data) {
			const timestamp = new Date(item.timestamp).getTime()
			const bucketKey = Math.floor(timestamp / intervalMs) * intervalMs

			if (!buckets.has(bucketKey)) {
				buckets.set(bucketKey, [])
			}
			buckets.get(bucketKey)!.push(item)
		}

		// Aggregate each bucket
		const aggregated: TimeSeriesMetrics[] = []

		for (const [bucketKey, items] of buckets.entries()) {
			aggregated.push({
				timestamp: new Date(bucketKey).toISOString(),
				eventsProcessed: items.reduce((sum, item) => sum + item.eventsProcessed, 0),
				processingLatency:
					items.reduce((sum, item) => sum + item.processingLatency, 0) / items.length,
				errorRate: items.reduce((sum, item) => sum + item.errorRate, 0) / items.length,
				queueDepth: items.reduce((sum, item) => sum + item.queueDepth, 0) / items.length,
				cpuUsage: items.reduce((sum, item) => sum + item.cpuUsage, 0) / items.length,
				memoryUsage: items.reduce((sum, item) => sum + item.memoryUsage, 0) / items.length,
			})
		}

		return aggregated.sort(
			(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
		)
	}

	/**
	 * Calculate percentile from array
	 */
	private calculatePercentile(sortedArray: number[], percentile: number): number {
		if (sortedArray.length === 0) return 0

		const index = Math.ceil(sortedArray.length * percentile) - 1
		return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))]
	}

	/**
	 * Get data from cache if not expired
	 */
	private getFromCache(key: string): any {
		const cached = this.cache.get(key)
		if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
			return cached.data
		}
		return null
	}

	/**
	 * Set data in cache
	 */
	private setCache(key: string, data: any): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
		})
	}
}
