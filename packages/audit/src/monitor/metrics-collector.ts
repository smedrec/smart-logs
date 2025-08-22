import { Redis as RedisInstance } from 'ioredis'

import { getSharedRedisConnection } from '@repo/redis-client'

import { AuditMetrics } from './monitoring-types.js'

import type { RedisOptions, Redis as RedisType } from 'ioredis'

export interface MetricPoint {
	timestamp: number
	value: number
	labels?: Record<string, string>
}

/**
 * Metrics collector interface
 */
export interface MetricsCollector {
	recordEvent(): Promise<void>
	recordProcessingLatency(latency: number): Promise<void>
	recordError(): Promise<void>
	recordIntegrityViolation(): Promise<void>
	recordQueueDepth(depth: number): Promise<void>
	getMetrics(): Promise<AuditMetrics>
	resetMetrics(): Promise<void>
	recordSuspiciousPattern(suspiciousPatterns: number): Promise<void>
	recordAlertGenerated(): Promise<void>
	setCooldown(cooldownKey: string, cooldownPeriod: number): Promise<void>
	isOnCooldown(cooldownKey: string): Promise<boolean>
	storeMetric(key: string, value: any, ttl?: number): Promise<void>
	getMetric(key: string): Promise<any>
	getMetricsByPattern(pattern: string): Promise<any[]>
	incrementCounter(name: string, labels?: Record<string, string>, value?: number): Promise<void>
	setGauge(name: string, value: number, labels?: Record<string, string>): Promise<void>
	recordHistogram(name: string, value: number, labels?: Record<string, string>): Promise<void>
}

/**
 * Redis metrics collector
 */
export class RedisMetricsCollector implements MetricsCollector {
	private readonly metricsPrefix = 'metrics:'
	private readonly retentionPeriod = 86400 // 24 hours in seconds
	private connection: RedisType
	private isSharedConnection: boolean

	constructor(
		redisOrUrlOrOptions?: string | RedisType | { url?: string; options?: RedisOptions },
		directConnectionOptions?: RedisOptions
	) {
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
			// Scenario 1: An existing ioredis instance is provided
			this.connection = redisOrUrlOrOptions
			this.isSharedConnection = true // Assume externally managed, could be shared or not
			console.log(`[MonitorService] Using provided Redis instance for monitor.`)
		} else if (
			typeof redisOrUrlOrOptions === 'string' ||
			(typeof redisOrUrlOrOptions === 'object' &&
				(redisOrUrlOrOptions.url || redisOrUrlOrOptions.options)) ||
			directConnectionOptions
		) {
			// Scenario 2: URL string, options object, or directConnectionOptions are provided for a direct connection
			this.isSharedConnection = false
			let url: string | undefined
			let options: RedisOptions = { ...defaultDirectOptions, ...directConnectionOptions }

			if (typeof redisOrUrlOrOptions === 'string') {
				url = redisOrUrlOrOptions
			} else if (
				typeof redisOrUrlOrOptions === 'object' &&
				(redisOrUrlOrOptions.url || redisOrUrlOrOptions.options)
			) {
				// Check this condition specifically for object with url/options
				url = redisOrUrlOrOptions.url
				options = { ...options, ...redisOrUrlOrOptions.options }
			}
			// Note: directConnectionOptions are already merged into options

			const envUrl = process.env['MONITOR_REDIS_URL']
			const finalUrl = url || envUrl // Prioritize explicitly passed URL/options object over env var

			if (finalUrl) {
				// If any URL (explicit, from object, or env) is found, attempt direct connection
				try {
					console.log(
						`[MonitorService] Creating new direct Redis connection to ${finalUrl.split('@').pop()} for monitor.`
					)
					this.connection = new RedisInstance(finalUrl, options)
				} catch (err) {
					console.error(`[MonitorService] Failed to create direct Redis instance for monitor:`, err)
					throw new Error(
						`[MonitorService] Failed to initialize direct Redis connection for monitor. Error: ${err instanceof Error ? err.message : String(err)}`
					)
				}
			} else if (url || redisOrUrlOrOptions || directConnectionOptions) {
				// This case means an attempt for direct connection was made (e.g. empty string URL, or empty options object)
				// but resulted in no usable URL, and MONITOR_REDIS_URL was also not set.
				console.warn(
					`[MonitorService] Attempted direct Redis connection for monitor but no valid URL could be determined (explicitly or via MONITOR_REDIS_URL). Falling back to shared connection.`
				)
				this.connection = getSharedRedisConnection()
				this.isSharedConnection = true
			} else {
				// Scenario 3: No explicit direct connection info at all, and no env var, use the shared connection
				console.log(`[MonitorService] Using shared Redis connection for monitor.`)
				this.connection = getSharedRedisConnection()
				this.isSharedConnection = true
			}
		} else if (process.env['MONITOR_REDIS_URL']) {
			// Scenario 2b: Only MONITOR_REDIS_URL is provided (no redisOrUrlOrOptions or directConnectionOptions)
			this.isSharedConnection = false
			const envUrl = process.env['MONITOR_REDIS_URL']
			const options: RedisOptions = { ...defaultDirectOptions } // directConnectionOptions is undefined here
			try {
				console.log(
					`[MonitorService] Creating new direct Redis connection using MONITOR_REDIS_URL to ${envUrl.split('@').pop()} for monitor.`
				)
				this.connection = new RedisInstance(envUrl, options)
			} catch (err) {
				console.error(
					`[MonitorService] Failed to create direct Redis instance using MONITOR_REDIS_URL for monitor:`,
					err
				)
				throw new Error(
					`[MonitorService] Failed to initialize direct Redis connection using MONITOR_REDIS_URL for monitor. Error: ${err instanceof Error ? err.message : String(err)}`
				)
			}
		} else {
			// Scenario 3: No specific connection info at all, use the shared connection
			console.log(`[AuditService] Using shared Redis connection for monitor.`)
			this.connection = getSharedRedisConnection()
			this.isSharedConnection = true
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

	async getMetrics(): Promise<AuditMetrics> {
		const metrics: AuditMetrics = {
			eventsProcessed: parseInt(
				(await this.connection.get(`${this.metricsPrefix}eventsProcessed`)) || '0',
				10
			),
			processingLatency: parseFloat(
				(await this.connection.get(`${this.metricsPrefix}processingLatency`)) || '0'
			),
			queueDepth: parseInt(
				(await this.connection.get(`${this.metricsPrefix}queueDepth`)) || '0',
				10
			),
			errorsGenerated: parseInt(
				(await this.connection.get(`${this.metricsPrefix}errorsGenerated`)) || '0',
				10
			),
			errorRate: parseFloat((await this.connection.get(`${this.metricsPrefix}errorRate`)) || '0'),
			integrityViolations: parseInt(
				(await this.connection.get(`${this.metricsPrefix}integrityViolations`)) || '0',
				10
			),
			timestamp:
				(await this.connection.get(`${this.metricsPrefix}timestamp`)) || new Date().toISOString(),
			alertsGenerated: parseInt(
				(await this.connection.get(`${this.metricsPrefix}alertsGenerated`)) || '0',
				10
			),
			suspiciousPatterns: parseInt(
				(await this.connection.get(`${this.metricsPrefix}suspiciousPatterns`)) || '0',
				10
			),
		}

		return metrics
	}

	async resetMetrics(): Promise<void> {
		await this.connection.del(`${this.metricsPrefix}`)

		const metrics: AuditMetrics = {
			eventsProcessed: 0,
			processingLatency: 0,
			queueDepth: 0,
			errorsGenerated: 0,
			errorRate: 0,
			integrityViolations: 0,
			timestamp: new Date().toISOString(),
			alertsGenerated: 0,
			suspiciousPatterns: 0,
		}
		await this.connection.set(`${this.metricsPrefix}`, JSON.stringify(metrics))
	}

	async recordQueueDepth(depth: number): Promise<void> {
		await this.connection.set(`${this.metricsPrefix}queueDepth`, depth.toString())
		await this.connection.set(`${this.metricsPrefix}timestamp`, new Date().toISOString())
	}

	async recordEvent(): Promise<void> {
		await this.connection.incr(`${this.metricsPrefix}eventsProcessed`)
		await this.connection.set(`${this.metricsPrefix}timestamp`, new Date().toISOString())
	}

	async recordProcessingLatency(latency: number): Promise<void> {
		const currentLatency = parseFloat(
			(await this.connection.get(`${this.metricsPrefix}processingLatency`)) || '0'
		)
		const newLatency = (currentLatency + latency) / 2 // Calculate new average latency
		await this.connection.set(`${this.metricsPrefix}processingLatency`, newLatency.toString())
		await this.connection.set(`${this.metricsPrefix}timestamp`, new Date().toISOString())
	}

	async recordError(): Promise<void> {
		await this.connection.incr(`${this.metricsPrefix}errorsGenerated`)

		const currentErrorsGenerated = parseInt(
			(await this.connection.get(`${this.metricsPrefix}errorsGenerated`)) || '0',
			10
		)
		const currentEventsProcessed = parseInt(
			(await this.connection.get(`${this.metricsPrefix}eventsProcessed`)) || '0',
			10
		)

		let newErrorRate: number
		if (currentEventsProcessed === 0) {
			newErrorRate = 0.0
		} else {
			newErrorRate = currentErrorsGenerated / currentEventsProcessed
		}

		await this.connection.set(`${this.metricsPrefix}errorRate`, newErrorRate.toString())
		await this.connection.set(`${this.metricsPrefix}timestamp`, new Date().toISOString())
	}

	async recordIntegrityViolation(): Promise<void> {
		await this.connection.incr(`${this.metricsPrefix}integrityViolations`)
		await this.connection.set(`${this.metricsPrefix}timestamp`, new Date().toISOString())
	}

	async recordAlertGenerated(): Promise<void> {
		await this.connection.incr(`${this.metricsPrefix}alertsGenerated`)
		await this.connection.set(`${this.metricsPrefix}timestamp`, new Date().toISOString())
	}

	async recordSuspiciousPattern(suspiciousPatterns: number): Promise<void> {
		await this.connection.incrby(`${this.metricsPrefix}suspiciousPatterns`, suspiciousPatterns)
		await this.connection.set(`${this.metricsPrefix}timestamp`, new Date().toISOString())
	}

	// Set cooldown period (5 minutes for similar alerts)
	async setCooldown(cooldownKey: string, cooldownPeriod = 300): Promise<void> {
		await this.connection.setex(cooldownKey, cooldownPeriod, '1')
	}

	// Check if an alert is on cooldown
	async isOnCooldown(cooldownKey: string): Promise<boolean> {
		return (await this.connection.exists(cooldownKey)) === 1
	}

	/**
	 * Store a metric point
	 */
	async storeMetric(key: string, value: any, ttl?: number): Promise<void> {
		try {
			const fullKey = key.startsWith(this.metricsPrefix) ? key : `${this.metricsPrefix}${key}`
			const serialized = typeof value === 'string' ? value : JSON.stringify(value)

			if (ttl) {
				await this.connection.setex(fullKey, ttl, serialized)
			} else {
				await this.connection.setex(fullKey, this.retentionPeriod, serialized)
			}
		} catch (error) {
			console.error('Failed to store metric', {
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
			const data = await this.connection.get(fullKey)
			return data ? JSON.parse(data) : null
		} catch (error) {
			console.error('Failed to get metric', {
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
			const keys = await this.connection.keys(fullPattern)

			const metrics: any[] = []

			for (const key of keys) {
				try {
					const data = await this.connection.get(key)
					if (data) {
						metrics.push(JSON.parse(data))
					}
				} catch (parseError) {
					console.warn('Failed to parse metric', { key, error: parseError })
				}
			}

			return metrics
		} catch (error) {
			console.error('Failed to get metrics by pattern', {
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
			await this.connection.incrby(key, value)
			await this.connection.expire(key, this.retentionPeriod)
		} catch (error) {
			console.error('Failed to increment counter', {
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
			console.error('Failed to set gauge', {
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
			console.error('Failed to record histogram', {
				name,
				value,
				labels,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
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
			console.error('Failed to update histogram stats', {
				key,
				value,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}
}
