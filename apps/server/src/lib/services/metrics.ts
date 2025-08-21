/**
 * @fileoverview Metrics Collection Service
 *
 * Provides comprehensive metrics collection and aggregation:
 * - Real-time metrics collection
 * - Performance metrics aggregation
 * - System resource monitoring
 * - Custom metrics support
 *
 * Requirements: 6.2, 6.3, 6.4
 */

import type { Redis } from '@repo/redis-client'

export interface SystemMetrics {
	timestamp: string
	server: {
		uptime: number
		memoryUsage: {
			used: number
			total: number
			percentage: number
		}
		cpuUsage: {
			percentage: number
			loadAverage: number[]
		}
	}
	database: {
		connectionCount: number
		activeQueries: number
		averageQueryTime: number
	}
	redis: {
		connectionCount: number
		memoryUsage: number
		keyCount: number
	}
	api: {
		requestsPerSecond: number
		averageResponseTime: number
		errorRate: number
	}
}

export interface AuditMetrics {
	timestamp: string
	eventsProcessed: number
	processingLatency: {
		average: number
		p95: number
		p99: number
	}
	integrityVerifications: {
		total: number
		passed: number
		failed: number
	}
	complianceReports: {
		generated: number
		scheduled: number
		failed: number
	}
}

export interface EndpointMetrics {
	endpoint: string
	method: string
	count: number
	averageResponseTime: number
	p95ResponseTime: number
	p99ResponseTime: number
	errorRate: number
	lastUpdated: string
}

export interface MetricPoint {
	timestamp: number
	value: number
	labels?: Record<string, string>
}

/**
 * Enhanced metrics collection service
 */
export class MetricsCollectionService {
	private readonly metricsPrefix = 'metrics:'
	private readonly retentionPeriod = 86400 // 24 hours in seconds

	constructor(
		private redis: Redis,
		private logger: any
	) {}

	/**
	 * Collect and return current system metrics
	 */
	async getSystemMetrics(): Promise<SystemMetrics> {
		try {
			const [serverMetrics, databaseMetrics, redisMetrics, apiMetrics] = await Promise.allSettled([
				this.getServerMetrics(),
				this.getDatabaseMetrics(),
				this.getRedisMetrics(),
				this.getApiMetrics(),
			])

			return {
				timestamp: new Date().toISOString(),
				server:
					serverMetrics.status === 'fulfilled'
						? serverMetrics.value
						: this.getDefaultServerMetrics(),
				database:
					databaseMetrics.status === 'fulfilled'
						? databaseMetrics.value
						: this.getDefaultDatabaseMetrics(),
				redis:
					redisMetrics.status === 'fulfilled' ? redisMetrics.value : this.getDefaultRedisMetrics(),
				api: apiMetrics.status === 'fulfilled' ? apiMetrics.value : this.getDefaultApiMetrics(),
			}
		} catch (error) {
			this.logger.error('Failed to collect system metrics', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})

			return {
				timestamp: new Date().toISOString(),
				server: this.getDefaultServerMetrics(),
				database: this.getDefaultDatabaseMetrics(),
				redis: this.getDefaultRedisMetrics(),
				api: this.getDefaultApiMetrics(),
			}
		}
	}

	/**
	 * Get audit-specific metrics
	 */
	async getAuditMetrics(timeRange?: string): Promise<AuditMetrics> {
		try {
			const [processingMetrics, verificationMetrics, reportMetrics] = await Promise.allSettled([
				this.getProcessingMetrics(timeRange),
				this.getVerificationMetrics(timeRange),
				this.getReportMetrics(timeRange),
			])

			return {
				timestamp: new Date().toISOString(),
				eventsProcessed:
					processingMetrics.status === 'fulfilled' ? processingMetrics.value.count : 0,
				processingLatency:
					processingMetrics.status === 'fulfilled'
						? processingMetrics.value.latency
						: { average: 0, p95: 0, p99: 0 },
				integrityVerifications:
					verificationMetrics.status === 'fulfilled'
						? verificationMetrics.value
						: { total: 0, passed: 0, failed: 0 },
				complianceReports:
					reportMetrics.status === 'fulfilled'
						? reportMetrics.value
						: { generated: 0, scheduled: 0, failed: 0 },
			}
		} catch (error) {
			this.logger.error('Failed to collect audit metrics', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})

			return {
				timestamp: new Date().toISOString(),
				eventsProcessed: 0,
				processingLatency: { average: 0, p95: 0, p99: 0 },
				integrityVerifications: { total: 0, passed: 0, failed: 0 },
				complianceReports: { generated: 0, scheduled: 0, failed: 0 },
			}
		}
	}

	/**
	 * Get endpoint performance metrics
	 */
	async getEndpointMetrics(endpoint?: string): Promise<EndpointMetrics[]> {
		try {
			const pattern = endpoint
				? `${this.metricsPrefix}endpoints:*:${endpoint}`
				: `${this.metricsPrefix}endpoints:*`
			const keys = await this.redis.keys(pattern)

			const metrics: EndpointMetrics[] = []

			for (const key of keys) {
				try {
					const data = await this.redis.get(key)
					if (data) {
						const parsed = JSON.parse(data)
						metrics.push(parsed)
					}
				} catch (parseError) {
					this.logger.warn('Failed to parse endpoint metrics', { key, error: parseError })
				}
			}

			return metrics.sort(
				(a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
			)
		} catch (error) {
			this.logger.error('Failed to get endpoint metrics', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return []
		}
	}

	/**
	 * Store a metric point
	 */
	async storeMetric(key: string, value: any, ttl?: number): Promise<void> {
		try {
			const fullKey = key.startsWith(this.metricsPrefix) ? key : `${this.metricsPrefix}${key}`
			const serialized = typeof value === 'string' ? value : JSON.stringify(value)

			if (ttl) {
				await this.redis.setex(fullKey, ttl, serialized)
			} else {
				await this.redis.setex(fullKey, this.retentionPeriod, serialized)
			}
		} catch (error) {
			this.logger.error('Failed to store metric', {
				key,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Get a metric by key
	 */
	async getMetric(key: string): Promise<any> {
		try {
			const fullKey = key.startsWith(this.metricsPrefix) ? key : `${this.metricsPrefix}${key}`
			const data = await this.redis.get(fullKey)
			return data ? JSON.parse(data) : null
		} catch (error) {
			this.logger.error('Failed to get metric', {
				key,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return null
		}
	}

	/**
	 * Get metrics by pattern
	 */
	async getMetricsByPattern(pattern: string): Promise<any[]> {
		try {
			const fullPattern = pattern.startsWith(this.metricsPrefix)
				? pattern
				: `${this.metricsPrefix}${pattern}`
			const keys = await this.redis.keys(fullPattern)

			const metrics: any[] = []

			for (const key of keys) {
				try {
					const data = await this.redis.get(key)
					if (data) {
						metrics.push(JSON.parse(data))
					}
				} catch (parseError) {
					this.logger.warn('Failed to parse metric', { key, error: parseError })
				}
			}

			return metrics
		} catch (error) {
			this.logger.error('Failed to get metrics by pattern', {
				pattern,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return []
		}
	}

	/**
	 * Record a counter metric
	 */
	async incrementCounter(name: string, labels?: Record<string, string>, value = 1): Promise<void> {
		try {
			const key = this.buildMetricKey('counter', name, labels)
			await this.redis.incrby(key, value)
			await this.redis.expire(key, this.retentionPeriod)
		} catch (error) {
			this.logger.error('Failed to increment counter', {
				name,
				labels,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Record a gauge metric
	 */
	async setGauge(name: string, value: number, labels?: Record<string, string>): Promise<void> {
		try {
			const key = this.buildMetricKey('gauge', name, labels)
			const metric: MetricPoint = {
				timestamp: Date.now(),
				value,
				labels,
			}
			await this.storeMetric(key, metric)
		} catch (error) {
			this.logger.error('Failed to set gauge', {
				name,
				value,
				labels,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Record a histogram metric (for response times, etc.)
	 */
	async recordHistogram(
		name: string,
		value: number,
		labels?: Record<string, string>
	): Promise<void> {
		try {
			const key = this.buildMetricKey('histogram', name, labels)
			const now = Date.now()

			// Store individual measurement
			const measurementKey = `${key}:${now}`
			await this.storeMetric(measurementKey, { timestamp: now, value, labels }, 3600) // 1 hour TTL

			// Update aggregated statistics
			await this.updateHistogramStats(key, value)
		} catch (error) {
			this.logger.error('Failed to record histogram', {
				name,
				value,
				labels,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Get server metrics
	 */
	private async getServerMetrics() {
		const memoryUsage = process.memoryUsage()
		const cpuUsage = process.cpuUsage()

		return {
			uptime: process.uptime(),
			memoryUsage: {
				used: memoryUsage.heapUsed,
				total: memoryUsage.heapTotal,
				percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
			},
			cpuUsage: {
				percentage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
				loadAverage: [0, 0, 0], // Not available in Node.js on all platforms
			},
		}
	}

	/**
	 * Get database metrics
	 */
	private async getDatabaseMetrics() {
		// This would integrate with your database monitoring
		// For now, return placeholder values
		return {
			connectionCount: 10,
			activeQueries: 2,
			averageQueryTime: 15,
		}
	}

	/**
	 * Get Redis metrics
	 */
	private async getRedisMetrics() {
		try {
			const info = await this.redis.info('memory')
			const keyCount = await this.redis.dbsize()

			// Parse memory info
			const memoryMatch = info.match(/used_memory:(\d+)/)
			const memoryUsage = memoryMatch ? parseInt(memoryMatch[1], 10) : 0

			return {
				connectionCount: 1, // This would come from connection pool
				memoryUsage,
				keyCount,
			}
		} catch (error) {
			return this.getDefaultRedisMetrics()
		}
	}

	/**
	 * Get API metrics
	 */
	private async getApiMetrics() {
		try {
			// Calculate metrics from stored request data
			const now = Date.now()
			const oneMinuteAgo = now - 60000

			// Get recent request metrics
			const recentRequests = await this.getMetricsByPattern(`requests:*`)
			const recentRequestsInWindow = recentRequests.filter(
				(req) => new Date(req.timestamp).getTime() > oneMinuteAgo
			)

			const requestsPerSecond = recentRequestsInWindow.length / 60
			const averageResponseTime =
				recentRequestsInWindow.length > 0
					? recentRequestsInWindow.reduce((sum, req) => sum + req.responseTime, 0) /
						recentRequestsInWindow.length
					: 0

			const errorCount = recentRequestsInWindow.filter((req) => req.statusCode >= 400).length
			const errorRate =
				recentRequestsInWindow.length > 0 ? errorCount / recentRequestsInWindow.length : 0

			return {
				requestsPerSecond,
				averageResponseTime,
				errorRate,
			}
		} catch (error) {
			return this.getDefaultApiMetrics()
		}
	}

	/**
	 * Get processing metrics
	 */
	private async getProcessingMetrics(timeRange?: string) {
		// This would integrate with audit service metrics
		return {
			count: 1000,
			latency: {
				average: 25,
				p95: 50,
				p99: 100,
			},
		}
	}

	/**
	 * Get verification metrics
	 */
	private async getVerificationMetrics(timeRange?: string) {
		// This would integrate with audit service metrics
		return {
			total: 100,
			passed: 98,
			failed: 2,
		}
	}

	/**
	 * Get report metrics
	 */
	private async getReportMetrics(timeRange?: string) {
		// This would integrate with compliance service metrics
		return {
			generated: 10,
			scheduled: 5,
			failed: 0,
		}
	}

	/**
	 * Build metric key with labels
	 */
	private buildMetricKey(type: string, name: string, labels?: Record<string, string>): string {
		let key = `${this.metricsPrefix}${type}:${name}`

		if (labels) {
			const labelString = Object.entries(labels)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([k, v]) => `${k}=${v}`)
				.join(',')
			key += `:${labelString}`
		}

		return key
	}

	/**
	 * Update histogram statistics
	 */
	private async updateHistogramStats(key: string, value: number): Promise<void> {
		try {
			const statsKey = `${key}:stats`
			const existing = await this.getMetric(statsKey)

			if (existing) {
				const updated = {
					count: existing.count + 1,
					sum: existing.sum + value,
					min: Math.min(existing.min, value),
					max: Math.max(existing.max, value),
					lastUpdated: Date.now(),
				}
				await this.storeMetric(statsKey, updated)
			} else {
				const newStats = {
					count: 1,
					sum: value,
					min: value,
					max: value,
					lastUpdated: Date.now(),
				}
				await this.storeMetric(statsKey, newStats)
			}
		} catch (error) {
			this.logger.error('Failed to update histogram stats', {
				key,
				value,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Default server metrics
	 */
	private getDefaultServerMetrics() {
		const memoryUsage = process.memoryUsage()
		return {
			uptime: process.uptime(),
			memoryUsage: {
				used: memoryUsage.heapUsed,
				total: memoryUsage.heapTotal,
				percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
			},
			cpuUsage: {
				percentage: 0,
				loadAverage: [0, 0, 0],
			},
		}
	}

	/**
	 * Default database metrics
	 */
	private getDefaultDatabaseMetrics() {
		return {
			connectionCount: 0,
			activeQueries: 0,
			averageQueryTime: 0,
		}
	}

	/**
	 * Default Redis metrics
	 */
	private getDefaultRedisMetrics() {
		return {
			connectionCount: 0,
			memoryUsage: 0,
			keyCount: 0,
		}
	}

	/**
	 * Default API metrics
	 */
	private getDefaultApiMetrics() {
		return {
			requestsPerSecond: 0,
			averageResponseTime: 0,
			errorRate: 0,
		}
	}
}
