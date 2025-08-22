/**
 * Comprehensive metrics collection for all audit operations
 */
import { cpus, freemem, loadavg, totalmem } from 'os'
import { performance } from 'perf_hooks'
import { Redis as RedisInstance } from 'ioredis'

import { getSharedRedisConnection } from '@repo/redis-client'

import { MonitoringService } from '../monitor/monitoring.js'

import type { RedisOptions, Redis as RedisType } from 'ioredis'
import type {
	AuditOperationMetrics,
	ComponentHealthMetrics,
	DashboardMetrics,
	ObservabilityConfig,
	PerformanceMetrics,
	SystemMetrics,
	TimeSeriesMetrics,
} from './types.js'

/**
 * Enhanced metrics collector interface
 */
export interface EnhancedMetricsCollector {
	// Performance metrics
	recordPerformanceMetrics(metrics: Partial<PerformanceMetrics>): Promise<void>
	getPerformanceMetrics(): Promise<PerformanceMetrics>

	// System metrics
	collectSystemMetrics(): Promise<SystemMetrics>
	recordSystemMetrics(metrics: SystemMetrics): Promise<void>

	// Operation metrics
	recordOperation(metrics: AuditOperationMetrics): Promise<void>
	getOperationMetrics(operationType?: string): Promise<AuditOperationMetrics[]>

	// Dashboard metrics
	getDashboardMetrics(): Promise<DashboardMetrics>

	// Component health
	recordComponentHealth(component: string, health: ComponentHealthMetrics): Promise<void>
	getComponentHealth(component?: string): Promise<ComponentHealthMetrics[]>

	// Time series data
	recordTimeSeriesData(data: TimeSeriesMetrics): Promise<void>
	getTimeSeriesData(startTime: number, endTime: number): Promise<TimeSeriesMetrics[]>

	// Cleanup and maintenance
	cleanup(): Promise<void>
	exportMetrics(format: 'json' | 'prometheus'): Promise<string>
}

/**
 * Redis-based enhanced metrics collector
 */
export class RedisEnhancedMetricsCollector implements EnhancedMetricsCollector {
	private connection: RedisType
	private isSharedConnection: boolean
	private monitor: MonitoringService
	private keyPrefix = 'audit:observability'
	private config: ObservabilityConfig['metrics']

	constructor(
		monitor: MonitoringService,
		config: ObservabilityConfig['metrics'],
		redisOrUrlOrOptions?: string | RedisType | { url?: string; options?: RedisOptions },
		directConnectionOptions?: RedisOptions
	) {
		this.monitor = monitor
		this.config = config
		this.isSharedConnection = false

		const defaultDirectOptions: RedisOptions = {
			maxRetriesPerRequest: null,
			enableAutoPipelining: true,
		}

		if (
			redisOrUrlOrOptions &&
			typeof redisOrUrlOrOptions === 'object' &&
			'status' in redisOrUrlOrOptions
		) {
			// Existing Redis instance provided
			this.connection = redisOrUrlOrOptions
			this.isSharedConnection = true
		} else if (
			typeof redisOrUrlOrOptions === 'string' ||
			(typeof redisOrUrlOrOptions === 'object' &&
				(redisOrUrlOrOptions.url || redisOrUrlOrOptions.options)) ||
			directConnectionOptions
		) {
			// Direct connection configuration
			this.isSharedConnection = false
			let url: string | undefined
			let options: RedisOptions = { ...defaultDirectOptions, ...directConnectionOptions }

			if (typeof redisOrUrlOrOptions === 'string') {
				url = redisOrUrlOrOptions
			} else if (
				typeof redisOrUrlOrOptions === 'object' &&
				(redisOrUrlOrOptions.url || redisOrUrlOrOptions.options)
			) {
				url = redisOrUrlOrOptions.url
				options = { ...options, ...redisOrUrlOrOptions.options }
			}

			const envUrl = process.env['OBSERVABILITY_REDIS_URL']
			const finalUrl = url || envUrl

			if (finalUrl) {
				try {
					this.connection = new RedisInstance(finalUrl, options)
				} catch (err) {
					console.error('[ObservabilityMetrics] Failed to create direct Redis instance:', err)
					throw new Error(
						`Failed to initialize direct Redis connection for observability. Error: ${err instanceof Error ? err.message : String(err)}`
					)
				}
			} else {
				this.connection = getSharedRedisConnection()
				this.isSharedConnection = true
			}
		} else {
			// Use shared connection
			this.connection = getSharedRedisConnection()
			this.isSharedConnection = true
		}

		// Start periodic system metrics collection if enabled
		if (this.config.enabled) {
			this.startPeriodicCollection()
		}
	}

	/**
	 * Record performance metrics
	 */
	async recordPerformanceMetrics(metrics: Partial<PerformanceMetrics>): Promise<void> {
		const key = `${this.keyPrefix}:performance`
		const timestamp = new Date().toISOString()

		const currentMetrics = await this.getPerformanceMetrics()
		const updatedMetrics: PerformanceMetrics = {
			...currentMetrics,
			...metrics,
			timestamp,
		}

		await this.connection.hset(key, {
			eventProcessingTime: updatedMetrics.eventProcessingTime.toString(),
			eventValidationTime: updatedMetrics.eventValidationTime.toString(),
			eventHashingTime: updatedMetrics.eventHashingTime.toString(),
			eventStorageTime: updatedMetrics.eventStorageTime.toString(),
			queueWaitTime: updatedMetrics.queueWaitTime.toString(),
			queueProcessingTime: updatedMetrics.queueProcessingTime.toString(),
			queueDepth: updatedMetrics.queueDepth.toString(),
			dbConnectionTime: updatedMetrics.dbConnectionTime.toString(),
			dbQueryTime: updatedMetrics.dbQueryTime.toString(),
			dbTransactionTime: updatedMetrics.dbTransactionTime.toString(),
			redisConnectionTime: updatedMetrics.redisConnectionTime.toString(),
			redisOperationTime: updatedMetrics.redisOperationTime.toString(),
			memoryUsage: updatedMetrics.memoryUsage.toString(),
			heapUsed: updatedMetrics.heapUsed.toString(),
			heapTotal: updatedMetrics.heapTotal.toString(),
			cpuUsage: updatedMetrics.cpuUsage.toString(),
			timestamp: updatedMetrics.timestamp,
		})

		// Set expiration based on retention period
		await this.connection.expire(key, this.config.retentionPeriod)
	}

	/**
	 * Get performance metrics
	 */
	async getPerformanceMetrics(): Promise<PerformanceMetrics> {
		const key = `${this.keyPrefix}:performance`
		const data = await this.connection.hgetall(key)

		return {
			eventProcessingTime: parseFloat(data.eventProcessingTime || '0'),
			eventValidationTime: parseFloat(data.eventValidationTime || '0'),
			eventHashingTime: parseFloat(data.eventHashingTime || '0'),
			eventStorageTime: parseFloat(data.eventStorageTime || '0'),
			queueWaitTime: parseFloat(data.queueWaitTime || '0'),
			queueProcessingTime: parseFloat(data.queueProcessingTime || '0'),
			queueDepth: parseInt(data.queueDepth || '0', 10),
			dbConnectionTime: parseFloat(data.dbConnectionTime || '0'),
			dbQueryTime: parseFloat(data.dbQueryTime || '0'),
			dbTransactionTime: parseFloat(data.dbTransactionTime || '0'),
			redisConnectionTime: parseFloat(data.redisConnectionTime || '0'),
			redisOperationTime: parseFloat(data.redisOperationTime || '0'),
			memoryUsage: parseFloat(data.memoryUsage || '0'),
			heapUsed: parseFloat(data.heapUsed || '0'),
			heapTotal: parseFloat(data.heapTotal || '0'),
			cpuUsage: parseFloat(data.cpuUsage || '0'),
			timestamp: data.timestamp || new Date().toISOString(),
		}
	}

	/**
	 * Collect current system metrics
	 */
	async collectSystemMetrics(): Promise<SystemMetrics> {
		const memUsage = process.memoryUsage()
		const cpuCount = cpus().length
		const loadAvg = loadavg()

		// Calculate CPU usage (simplified)
		const cpuUsage = (loadAvg[0] / cpuCount) * 100

		return {
			cpu: {
				usage: cpuUsage,
				loadAverage: loadAvg,
			},
			memory: {
				used: totalmem() - freemem(),
				total: totalmem(),
				free: freemem(),
				heapUsed: memUsage.heapUsed,
				heapTotal: memUsage.heapTotal,
			},
			disk: {
				used: 0, // Would need additional library for disk metrics
				total: 0,
				free: 0,
			},
			network: {
				bytesIn: 0, // Would need additional library for network metrics
				bytesOut: 0,
				packetsIn: 0,
				packetsOut: 0,
			},
			timestamp: new Date().toISOString(),
		}
	}

	/**
	 * Record system metrics
	 */
	async recordSystemMetrics(metrics: SystemMetrics): Promise<void> {
		const key = `${this.keyPrefix}:system:${Date.now()}`

		await this.connection.hset(key, {
			'cpu.usage': metrics.cpu.usage.toString(),
			'cpu.loadAverage': JSON.stringify(metrics.cpu.loadAverage),
			'memory.used': metrics.memory.used.toString(),
			'memory.total': metrics.memory.total.toString(),
			'memory.free': metrics.memory.free.toString(),
			'memory.heapUsed': metrics.memory.heapUsed.toString(),
			'memory.heapTotal': metrics.memory.heapTotal.toString(),
			'disk.used': metrics.disk.used.toString(),
			'disk.total': metrics.disk.total.toString(),
			'disk.free': metrics.disk.free.toString(),
			'network.bytesIn': metrics.network.bytesIn.toString(),
			'network.bytesOut': metrics.network.bytesOut.toString(),
			'network.packetsIn': metrics.network.packetsIn.toString(),
			'network.packetsOut': metrics.network.packetsOut.toString(),
			timestamp: metrics.timestamp,
		})

		await this.connection.expire(key, this.config.retentionPeriod)
	}

	/**
	 * Record audit operation metrics
	 */
	async recordOperation(metrics: AuditOperationMetrics): Promise<void> {
		const key = `${this.keyPrefix}:operations:${Date.now()}`

		await this.connection.hset(key, {
			operationType: metrics.operationType,
			operationName: metrics.operationName,
			duration: metrics.duration.toString(),
			success: metrics.success.toString(),
			errorType: metrics.errorType || '',
			errorMessage: metrics.errorMessage || '',
			metadata: JSON.stringify(metrics.metadata),
			timestamp: metrics.timestamp,
			traceId: metrics.traceId || '',
			spanId: metrics.spanId || '',
		})

		await this.connection.expire(key, this.config.retentionPeriod)

		// Update operation counters
		const counterKey = `${this.keyPrefix}:counters:${metrics.operationType}`
		await this.connection.incr(counterKey)
		await this.connection.expire(counterKey, this.config.retentionPeriod)
	}

	/**
	 * Get operation metrics
	 */
	async getOperationMetrics(operationType?: string): Promise<AuditOperationMetrics[]> {
		const pattern = operationType
			? `${this.keyPrefix}:operations:*`
			: `${this.keyPrefix}:operations:*`

		const keys = await this.connection.keys(pattern)
		const operations: AuditOperationMetrics[] = []

		for (const key of keys) {
			const data = await this.connection.hgetall(key)

			if (!operationType || data.operationType === operationType) {
				operations.push({
					operationType: data.operationType as any,
					operationName: data.operationName,
					duration: parseFloat(data.duration),
					success: data.success === 'true',
					errorType: data.errorType || undefined,
					errorMessage: data.errorMessage || undefined,
					metadata: JSON.parse(data.metadata || '{}'),
					timestamp: data.timestamp,
					traceId: data.traceId || undefined,
					spanId: data.spanId || undefined,
				})
			}
		}

		return operations.sort(
			(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
		)
	}

	/**
	 * Get dashboard metrics
	 */
	async getDashboardMetrics(): Promise<DashboardMetrics> {
		const [performanceMetrics, systemMetrics, componentHealth, timeSeriesData, operations] =
			await Promise.all([
				this.getPerformanceMetrics(),
				this.collectSystemMetrics(),
				this.getComponentHealth(),
				this.getTimeSeriesData(Date.now() - 3600000, Date.now()), // Last hour
				this.getOperationMetrics(),
			])

		// Calculate derived metrics
		const totalEvents = operations.length
		const successfulEvents = operations.filter((op) => op.success).length
		const errorRate = totalEvents > 0 ? (totalEvents - successfulEvents) / totalEvents : 0
		const averageProcessingTime =
			operations.length > 0
				? operations.reduce((sum, op) => sum + op.duration, 0) / operations.length
				: 0

		// Calculate events per second (last minute)
		const lastMinuteEvents = operations.filter(
			(op) => new Date(op.timestamp).getTime() > Date.now() - 60000
		)
		const eventsPerSecond = lastMinuteEvents.length / 60

		const activeAlerts = await this.monitor.numberOfActiveAlerts()

		return {
			totalEvents,
			eventsPerSecond,
			averageProcessingTime,
			errorRate,
			throughput: eventsPerSecond,
			latency: performanceMetrics,
			bottlenecks: [], // Would be calculated by bottleneck analyzer
			systemMetrics,
			componentHealth: componentHealth.reduce(
				(acc, health) => {
					acc[health.name] = health
					return acc
				},
				{} as Record<string, ComponentHealthMetrics>
			),
			activeAlerts,
			suspiciousPatterns: 0, // Would come from monitoring system
			timeSeriesData,
			timestamp: new Date().toISOString(),
		}
	}

	/**
	 * Record component health
	 */
	async recordComponentHealth(component: string, health: ComponentHealthMetrics): Promise<void> {
		const key = `${this.keyPrefix}:health:${component}`

		await this.connection.hset(key, {
			name: health.name,
			status: health.status,
			uptime: health.uptime.toString(),
			responseTime: health.responseTime.toString(),
			errorRate: health.errorRate.toString(),
			throughput: health.throughput.toString(),
			lastCheck: health.lastCheck,
		})

		await this.connection.expire(key, this.config.retentionPeriod)
	}

	/**
	 * Get component health
	 */
	async getComponentHealth(component?: string): Promise<ComponentHealthMetrics[]> {
		const pattern = component
			? `${this.keyPrefix}:health:${component}`
			: `${this.keyPrefix}:health:*`

		const keys = await this.connection.keys(pattern)
		const healthMetrics: ComponentHealthMetrics[] = []

		for (const key of keys) {
			const data = await this.connection.hgetall(key)

			healthMetrics.push({
				name: data.name,
				status: data.status as any,
				uptime: parseFloat(data.uptime),
				responseTime: parseFloat(data.responseTime),
				errorRate: parseFloat(data.errorRate),
				throughput: parseFloat(data.throughput),
				lastCheck: data.lastCheck,
			})
		}

		return healthMetrics
	}

	/**
	 * Record time series data
	 */
	async recordTimeSeriesData(data: TimeSeriesMetrics): Promise<void> {
		const key = `${this.keyPrefix}:timeseries`
		const score = new Date(data.timestamp).getTime()

		await this.connection.zadd(key, score, JSON.stringify(data))

		// Keep only recent data based on retention period
		const cutoffTime = Date.now() - this.config.retentionPeriod * 1000
		await this.connection.zremrangebyscore(key, 0, cutoffTime)
	}

	/**
	 * Get time series data
	 */
	async getTimeSeriesData(startTime: number, endTime: number): Promise<TimeSeriesMetrics[]> {
		const key = `${this.keyPrefix}:timeseries`
		const data = await this.connection.zrangebyscore(key, startTime, endTime)

		return data.map((item) => JSON.parse(item))
	}

	/**
	 * Start periodic system metrics collection
	 */
	private startPeriodicCollection(): void {
		setInterval(async () => {
			try {
				const systemMetrics = await this.collectSystemMetrics()
				await this.recordSystemMetrics(systemMetrics)
				const auditMetrics = await this.monitor.getMetrics()

				// Record time series data
				const timeSeriesData: TimeSeriesMetrics = {
					timestamp: systemMetrics.timestamp,
					eventsProcessed: auditMetrics.eventsProcessed,
					processingLatency: auditMetrics.processingLatency,
					errorRate: auditMetrics.errorRate,
					queueDepth: auditMetrics.queueDepth,
					cpuUsage: systemMetrics.cpu.usage,
					memoryUsage: (systemMetrics.memory.used / systemMetrics.memory.total) * 100,
				}

				await this.recordTimeSeriesData(timeSeriesData)
			} catch (error) {
				console.error('Failed to collect periodic metrics:', error)
			}
		}, this.config.collectionInterval)
	}

	/**
	 * Cleanup old metrics
	 */
	async cleanup(): Promise<void> {
		const patterns = [
			`${this.keyPrefix}:performance`,
			`${this.keyPrefix}:system:*`,
			`${this.keyPrefix}:operations:*`,
			`${this.keyPrefix}:health:*`,
			`${this.keyPrefix}:counters:*`,
		]

		for (const pattern of patterns) {
			const keys = await this.connection.keys(pattern)
			if (keys.length > 0) {
				await this.connection.del(...keys)
			}
		}
	}

	/**
	 * Export metrics in specified format
	 */
	async exportMetrics(format: 'json' | 'prometheus'): Promise<string> {
		const dashboardMetrics = await this.getDashboardMetrics()

		if (format === 'prometheus') {
			return this.formatPrometheusMetrics(dashboardMetrics)
		}

		return JSON.stringify(dashboardMetrics, null, 2)
	}

	/**
	 * Format metrics for Prometheus
	 */
	private formatPrometheusMetrics(metrics: DashboardMetrics): string {
		const lines: string[] = []

		// Basic metrics
		lines.push(`# HELP audit_events_total Total number of audit events processed`)
		lines.push(`# TYPE audit_events_total counter`)
		lines.push(`audit_events_total ${metrics.totalEvents}`)

		lines.push(`# HELP audit_events_per_second Current events per second`)
		lines.push(`# TYPE audit_events_per_second gauge`)
		lines.push(`audit_events_per_second ${metrics.eventsPerSecond}`)

		lines.push(`# HELP audit_processing_time_avg Average processing time in milliseconds`)
		lines.push(`# TYPE audit_processing_time_avg gauge`)
		lines.push(`audit_processing_time_avg ${metrics.averageProcessingTime}`)

		lines.push(`# HELP audit_error_rate Error rate as percentage`)
		lines.push(`# TYPE audit_error_rate gauge`)
		lines.push(`audit_error_rate ${metrics.errorRate}`)

		// System metrics
		lines.push(`# HELP system_cpu_usage CPU usage percentage`)
		lines.push(`# TYPE system_cpu_usage gauge`)
		lines.push(`system_cpu_usage ${metrics.systemMetrics.cpu.usage}`)

		lines.push(`# HELP system_memory_usage Memory usage percentage`)
		lines.push(`# TYPE system_memory_usage gauge`)
		const memoryUsagePercent =
			(metrics.systemMetrics.memory.used / metrics.systemMetrics.memory.total) * 100
		lines.push(`system_memory_usage ${memoryUsagePercent}`)

		// Component health
		for (const [component, health] of Object.entries(metrics.componentHealth)) {
			lines.push(
				`# HELP component_health_status Component health status (0=UNHEALTHY, 1=DEGRADED, 2=HEALTHY)`
			)
			lines.push(`# TYPE component_health_status gauge`)
			const statusValue = health.status === 'HEALTHY' ? 2 : health.status === 'DEGRADED' ? 1 : 0
			lines.push(`component_health_status{component="${component}"} ${statusValue}`)

			lines.push(`# HELP component_response_time Component response time in milliseconds`)
			lines.push(`# TYPE component_response_time gauge`)
			lines.push(`component_response_time{component="${component}"} ${health.responseTime}`)
		}

		return lines.join('\n')
	}
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
	private startTime: number
	private endTime?: number

	constructor() {
		this.startTime = performance.now()
	}

	/**
	 * Stop the timer and return duration
	 */
	stop(): number {
		this.endTime = performance.now()
		return this.endTime - this.startTime
	}

	/**
	 * Get current duration without stopping
	 */
	getCurrentDuration(): number {
		return performance.now() - this.startTime
	}

	/**
	 * Reset the timer
	 */
	reset(): void {
		this.startTime = performance.now()
		this.endTime = undefined
	}
}
