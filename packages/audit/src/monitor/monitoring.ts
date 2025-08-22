/**
 * Real-time monitoring and alerting system for audit events
 * Implements suspicious pattern detection, alert generation, and metrics collection
 */
import { Redis as RedisInstance } from 'ioredis'

import { getSharedRedisConnection } from '@repo/redis-client'

import { AlertResolution } from './database-alert-handler.js'

import type { RedisOptions, Redis as RedisType } from 'ioredis'
import type { AuditLogEvent } from '../types.js'
import type {
	Alert,
	AlertSeverity,
	AlertStatistics,
	AlertType,
	AuditMetrics,
	HealthStatus,
} from './monitoring-types.js'

/**
 * Pattern detection configuration
 */
export interface PatternDetectionConfig {
	// Failed authentication thresholds
	failedAuthThreshold: number
	failedAuthTimeWindow: number // in milliseconds

	// Unauthorized access detection
	unauthorizedAccessThreshold: number
	unauthorizedAccessTimeWindow: number

	// Suspicious data access patterns
	dataAccessVelocityThreshold: number
	dataAccessTimeWindow: number

	// Bulk operations detection
	bulkOperationThreshold: number
	bulkOperationTimeWindow: number

	// Off-hours access detection
	offHoursStart: number // hour (0-23)
	offHoursEnd: number // hour (0-23)
}

/**
 * Default pattern detection configuration
 */
export const DEFAULT_PATTERN_CONFIG: PatternDetectionConfig = {
	failedAuthThreshold: 5,
	failedAuthTimeWindow: 5 * 60 * 1000, // 5 minutes
	unauthorizedAccessThreshold: 3,
	unauthorizedAccessTimeWindow: 10 * 60 * 1000, // 10 minutes
	dataAccessVelocityThreshold: 50,
	dataAccessTimeWindow: 60 * 1000, // 1 minute
	bulkOperationThreshold: 100,
	bulkOperationTimeWindow: 5 * 60 * 1000, // 5 minutes
	offHoursStart: 22, // 10 PM
	offHoursEnd: 6, // 6 AM
}

/**
 * Suspicious pattern detection results
 */
export interface PatternDetectionResult {
	patterns: SuspiciousPattern[]
	alerts: Alert[]
}

/**
 * Suspicious pattern interface
 */
export interface SuspiciousPattern {
	type: 'FAILED_AUTH' | 'UNAUTHORIZED_ACCESS' | 'DATA_VELOCITY' | 'BULK_OPERATION' | 'OFF_HOURS'
	severity: AlertSeverity
	description: string
	events: AuditLogEvent[]
	metadata: Record<string, any>
	timestamp: string
}

/**
 * Alert handler interface
 */
export interface AlertHandler {
	handlerName(): string
	sendAlert(alert: Alert): Promise<void>
	acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<{ success: boolean }>
	resolveAlert(
		alertId: string,
		resolvedBy: string,
		resolutionData?: AlertResolution
	): Promise<{ success: boolean }>
	getActiveAlerts(organizationId?: string): Promise<Alert[]>
	numberOfActiveAlerts(organizationId?: string): Promise<number>
	getAlertStatistics(organizationId?: string): Promise<AlertStatistics>
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
}

/**
 * Real-time monitoring service
 */
export class MonitoringService {
	private readonly alertPrefix = 'alerts:'
	private readonly cooldownPrefix = 'alert_cooldown:'
	private events: AuditLogEvent[] = []
	private alerts: Alert[] = []
	private config: PatternDetectionConfig
	private alertHandlers: AlertHandler[] = []
	private metricsCollector: MetricsCollector

	constructor(
		config: PatternDetectionConfig = DEFAULT_PATTERN_CONFIG,
		metricsCollector?: MetricsCollector
	) {
		this.config = config
		this.metricsCollector = metricsCollector || new RedisMetricsCollector()
	}

	/**
	 * Initialize metrics with default values
	 */
	private initializeMetrics(): AuditMetrics {
		return {
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
	}

	/**
	 * Add an alert handler
	 */
	addAlertHandler(handler: AlertHandler): void {
		this.alertHandlers.push(handler)
	}

	/**
	 * Send external alert
	 */
	async sendExternalAlert(alert: Alert): Promise<void> {
		await this.generateAlert(alert)
	}

	/**
	 * Process audit event for monitoring
	 */
	async processEvent(event: AuditLogEvent): Promise<void> {
		// Store event for pattern analysis
		this.events.push(event)

		// Keep only recent events for pattern detection
		const cutoffTime =
			Date.now() -
			Math.max(
				this.config.failedAuthTimeWindow,
				this.config.unauthorizedAccessTimeWindow,
				this.config.dataAccessTimeWindow,
				this.config.bulkOperationTimeWindow
			)

		this.events = this.events.filter((e) => new Date(e.timestamp).getTime() > cutoffTime)

		// Detect suspicious patterns
		const detectionResult = await this.detectSuspiciousPatterns([event])

		// Generate alerts for detected patterns
		for (const alert of detectionResult.alerts) {
			await this.generateAlert(alert)
		}

		// Update metrics
		this.metricsCollector.recordEvent()
		if (detectionResult.patterns.length > 0) {
			this.metricsCollector.recordSuspiciousPattern(detectionResult.patterns.length)
		}
		this.metricsCollector.recordProcessingLatency(Date.now() - new Date(event.timestamp).getTime())
	}

	/**
	 * Detect suspicious patterns in audit events
	 */
	async detectSuspiciousPatterns(newEvents: AuditLogEvent[]): Promise<PatternDetectionResult> {
		const patterns: SuspiciousPattern[] = []
		const alerts: Alert[] = []

		// Combine new events with existing events for analysis
		const allEvents = [...this.events, ...newEvents]

		// 1. Failed authentication attempts
		const failedAuthPattern = this.detectFailedAuthPattern(allEvents)
		if (failedAuthPattern) {
			patterns.push(failedAuthPattern)
			alerts.push(this.createAlertFromPattern(failedAuthPattern))
		}

		// 2. Unauthorized access attempts
		const unauthorizedAccessPattern = this.detectUnauthorizedAccessPattern(allEvents)
		if (unauthorizedAccessPattern) {
			patterns.push(unauthorizedAccessPattern)
			alerts.push(this.createAlertFromPattern(unauthorizedAccessPattern))
		}

		// 3. High-velocity data access
		const dataVelocityPattern = this.detectDataVelocityPattern(allEvents)
		if (dataVelocityPattern) {
			patterns.push(dataVelocityPattern)
			alerts.push(this.createAlertFromPattern(dataVelocityPattern))
		}

		// 4. Bulk operations
		const bulkOperationPattern = this.detectBulkOperationPattern(allEvents)
		if (bulkOperationPattern) {
			patterns.push(bulkOperationPattern)
			alerts.push(this.createAlertFromPattern(bulkOperationPattern))
		}

		// 5. Off-hours access
		const offHoursPattern = this.detectOffHoursPattern(allEvents)
		if (offHoursPattern) {
			patterns.push(offHoursPattern)
			alerts.push(this.createAlertFromPattern(offHoursPattern))
		}

		return { patterns, alerts }
	}

	/**
	 * Detect failed authentication patterns
	 */
	private detectFailedAuthPattern(events: AuditLogEvent[]): SuspiciousPattern | null {
		const now = Date.now()
		const cutoffTime = now - this.config.failedAuthTimeWindow

		const failedAuthEvents = events.filter(
			(event) =>
				event.action.includes('auth.login.failure') &&
				event.status === 'failure' &&
				new Date(event.timestamp).getTime() > cutoffTime
		)

		// Group by principal ID or IP address
		const groupedEvents = new Map<string, AuditLogEvent[]>()

		for (const event of failedAuthEvents) {
			const key = event.principalId || event.sessionContext?.ipAddress || 'unknown'
			if (!groupedEvents.has(key)) {
				groupedEvents.set(key, [])
			}
			groupedEvents.get(key)!.push(event)
		}

		// Check if any group exceeds threshold
		for (const [key, groupEvents] of groupedEvents) {
			if (groupEvents.length >= this.config.failedAuthThreshold) {
				return {
					type: 'FAILED_AUTH',
					severity: 'HIGH',
					description: `${groupEvents.length} failed authentication attempts detected from ${key} within ${this.config.failedAuthTimeWindow / 1000} seconds`,
					events: groupEvents,
					metadata: {
						source: key,
						attemptCount: groupEvents.length,
						timeWindow: this.config.failedAuthTimeWindow,
					},
					timestamp: new Date().toISOString(),
				}
			}
		}

		return null
	}

	/**
	 * Detect unauthorized access patterns
	 */
	private detectUnauthorizedAccessPattern(events: AuditLogEvent[]): SuspiciousPattern | null {
		const now = Date.now()
		const cutoffTime = now - this.config.unauthorizedAccessTimeWindow

		const unauthorizedEvents = events.filter(
			(event) =>
				event.status === 'failure' &&
				(event.outcomeDescription?.toLowerCase().includes('unauthorized') ||
					event.outcomeDescription?.toLowerCase().includes('access denied') ||
					event.outcomeDescription?.toLowerCase().includes('forbidden')) &&
				new Date(event.timestamp).getTime() > cutoffTime
		)

		// Group by principal ID
		const groupedEvents = new Map<string, AuditLogEvent[]>()

		for (const event of unauthorizedEvents) {
			const key = event.principalId || 'unknown'
			if (!groupedEvents.has(key)) {
				groupedEvents.set(key, [])
			}
			groupedEvents.get(key)!.push(event)
		}

		// Check if any group exceeds threshold
		for (const [key, groupEvents] of groupedEvents) {
			if (groupEvents.length >= this.config.unauthorizedAccessThreshold) {
				return {
					type: 'UNAUTHORIZED_ACCESS',
					severity: 'CRITICAL',
					description: `${groupEvents.length} unauthorized access attempts detected from principal ${key} within ${this.config.unauthorizedAccessTimeWindow / 1000} seconds`,
					events: groupEvents,
					metadata: {
						principalId: key,
						attemptCount: groupEvents.length,
						timeWindow: this.config.unauthorizedAccessTimeWindow,
					},
					timestamp: new Date().toISOString(),
				}
			}
		}

		return null
	}

	/**
	 * Detect high-velocity data access patterns
	 */
	private detectDataVelocityPattern(events: AuditLogEvent[]): SuspiciousPattern | null {
		const now = Date.now()
		const cutoffTime = now - this.config.dataAccessTimeWindow

		const dataAccessEvents = events.filter(
			(event) =>
				(event.action.includes('data.read') ||
					event.action.includes('fhir.') ||
					event.targetResourceType) &&
				event.status === 'success' &&
				new Date(event.timestamp).getTime() > cutoffTime
		)

		// Group by principal ID
		const groupedEvents = new Map<string, AuditLogEvent[]>()

		for (const event of dataAccessEvents) {
			const key = event.principalId || 'unknown'
			if (!groupedEvents.has(key)) {
				groupedEvents.set(key, [])
			}
			groupedEvents.get(key)!.push(event)
		}

		// Check if any group exceeds threshold
		for (const [key, groupEvents] of groupedEvents) {
			if (groupEvents.length >= this.config.dataAccessVelocityThreshold) {
				return {
					type: 'DATA_VELOCITY',
					severity: 'MEDIUM',
					description: `${groupEvents.length} data access operations detected from principal ${key} within ${this.config.dataAccessTimeWindow / 1000} seconds`,
					events: groupEvents,
					metadata: {
						principalId: key,
						accessCount: groupEvents.length,
						timeWindow: this.config.dataAccessTimeWindow,
						resourceTypes: [
							...new Set(groupEvents.map((e) => e.targetResourceType).filter(Boolean)),
						],
					},
					timestamp: new Date().toISOString(),
				}
			}
		}

		return null
	}

	/**
	 * Detect bulk operation patterns
	 */
	private detectBulkOperationPattern(events: AuditLogEvent[]): SuspiciousPattern | null {
		const now = Date.now()
		const cutoffTime = now - this.config.bulkOperationTimeWindow

		const bulkEvents = events.filter(
			(event) =>
				(event.action.includes('data.export') ||
					event.action.includes('data.import') ||
					event.action.includes('bulk') ||
					(event as any).recordCount > 10) &&
				new Date(event.timestamp).getTime() > cutoffTime
		)

		if (bulkEvents.length >= this.config.bulkOperationThreshold) {
			return {
				type: 'BULK_OPERATION',
				severity: 'MEDIUM',
				description: `${bulkEvents.length} bulk operations detected within ${this.config.bulkOperationTimeWindow / 1000} seconds`,
				events: bulkEvents,
				metadata: {
					operationCount: bulkEvents.length,
					timeWindow: this.config.bulkOperationTimeWindow,
					totalRecords: bulkEvents.reduce((sum, e) => sum + ((e as any).recordCount || 1), 0),
				},
				timestamp: new Date().toISOString(),
			}
		}

		return null
	}

	/**
	 * Detect off-hours access patterns
	 */
	private detectOffHoursPattern(events: AuditLogEvent[]): SuspiciousPattern | null {
		const offHoursEvents = events.filter((event) => {
			const eventTime = new Date(event.timestamp)
			const hour = eventTime.getHours()

			// Check if event occurred during off-hours
			const isOffHours =
				this.config.offHoursStart > this.config.offHoursEnd
					? hour >= this.config.offHoursStart || hour < this.config.offHoursEnd
					: hour >= this.config.offHoursStart && hour < this.config.offHoursEnd

			return (
				isOffHours &&
				(event.action.includes('data.') || event.action.includes('fhir.')) &&
				event.status === 'success'
			)
		})

		if (offHoursEvents.length > 0) {
			return {
				type: 'OFF_HOURS',
				severity: 'LOW',
				description: `${offHoursEvents.length} data access operations detected during off-hours (${this.config.offHoursStart}:00 - ${this.config.offHoursEnd}:00)`,
				events: offHoursEvents,
				metadata: {
					accessCount: offHoursEvents.length,
					offHoursStart: this.config.offHoursStart,
					offHoursEnd: this.config.offHoursEnd,
					principals: [...new Set(offHoursEvents.map((e) => e.principalId).filter(Boolean))],
				},
				timestamp: new Date().toISOString(),
			}
		}

		return null
	}

	/**
	 * Create alert from suspicious pattern
	 */
	private createAlertFromPattern(pattern: SuspiciousPattern): Alert {
		// Extract organizationId from the first event in the pattern
		const organizationId = pattern.events[0]?.organizationId

		return {
			id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			severity: pattern.severity,
			type: 'SECURITY',
			title: `Suspicious Pattern Detected: ${pattern.type}`,
			description: pattern.description,
			timestamp: pattern.timestamp,
			source: 'audit-monitoring',
			metadata: {
				patternType: pattern.type,
				eventCount: pattern.events.length,
				organizationId: organizationId,
				...pattern.metadata,
			},
			acknowledged: false,
			resolved: false,
		}
	}

	/**
	 * Generate and send alert
	 */
	private async generateAlert(alert: Alert): Promise<void> {
		// Check for duplicate alerts
		const isDuplicate = await this.checkDuplicateAlert(alert)
		if (isDuplicate) {
			console.debug('Duplicate alert suppressed', { alertId: alert.id, title: alert.title })
			return
		}

		this.alerts.push(alert)
		this.metricsCollector.recordAlertGenerated()

		// Send alert through all registered handlers
		for (const handler of this.alertHandlers) {
			try {
				await handler.sendAlert(alert)
			} catch (error) {
				console.error('Failed to send alert through handler:', error)
			}
		}

		// Send notifications
		await this.sendNotifications(alert)
	}

	/**
	 * Check for duplicate alerts
	 */
	private async checkDuplicateAlert(alert: Alert): Promise<boolean> {
		try {
			// Create a hash of the alert content for deduplication
			const alertHash = this.createAlertHash(alert)
			const cooldownKey = `${this.alertPrefix}${this.cooldownPrefix}${alertHash}`

			const exists = await this.metricsCollector.isOnCooldown(cooldownKey)
			if (exists) {
				return true
			}

			// Set cooldown period (5 minutes for similar alerts)
			await this.metricsCollector.setCooldown(cooldownKey, 300)
			return false
		} catch (error) {
			console.error('Failed to check duplicate alert', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return false
		}
	}

	/**
	 * Create alert hash for deduplication
	 */
	private createAlertHash(alert: Alert): string {
		const content = `${alert.source}:${alert.title}:${alert.severity}`
		return Buffer.from(content).toString('base64')
	}

	/**
	 * Send notifications based on alert severity
	 */
	private async sendNotifications(alert: Alert): Promise<void> {
		try {
			// Log notification (in a real implementation, this would integrate with external systems)
			console.info('Alert notification', {
				alertId: alert.id,
				severity: alert.severity,
				title: alert.title,
				description: alert.description,
				source: alert.source,
			})

			// For critical alerts, you might want to send immediate notifications
			if (alert.severity === 'CRITICAL') {
				await this.sendCriticalAlertNotification(alert)
			}
		} catch (error) {
			console.error('Failed to send alert notifications', {
				alertId: alert.id,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Send critical alert notification
	 */
	private async sendCriticalAlertNotification(alert: Alert): Promise<void> {
		// This would integrate with external notification systems
		// For now, just log at error level
		console.error('CRITICAL ALERT', {
			alertId: alert.id,
			title: alert.title,
			description: alert.description,
			source: alert.source,
			metadata: alert.metadata,
		})
	}

	/**
	 * Get current metrics
	 */
	async getMetrics(): Promise<AuditMetrics> {
		const metrics = await this.metricsCollector.getMetrics()
		return metrics
	}

	/**
	 * Get active alerts
	 */
	async getActiveAlerts(): Promise<Alert[]> {
		return this.alerts.filter((alert) => !alert.resolved)
	}

	/**
	 * Get number of active alerts
	 */
	async numberOfActiveAlerts(organizationId?: string): Promise<number> {
		for (const handler of this.alertHandlers) {
			try {
				if (handler.handlerName() === 'DatabaseAlertHandler') {
					return await handler.numberOfActiveAlerts(organizationId)
				}
			} catch (error) {
				console.error('Failed to count the active alerts:', error)
			}
		}
		return 0
	}

	/**
	 * Get alert statistics
	 */
	async getAlertStatistics(organizationId?: string): Promise<AlertStatistics> {
		for (const handler of this.alertHandlers) {
			try {
				if (handler.handlerName() === 'DatabaseAlertHandler') {
					return await handler.getAlertStatistics(organizationId)
				}
			} catch (error) {
				console.error('Failed to count the active alerts:', error)
			}
		}
		return {
			total: 0,
			active: 0,
			acknowledged: 0,
			resolved: 0,
			bySeverity: {
				LOW: 0,
				MEDIUM: 0,
				HIGH: 0,
				CRITICAL: 0,
			},
			byType: {
				SECURITY: 0,
				COMPLIANCE: 0,
				PERFORMANCE: 0,
				SYSTEM: 0,
				METRICS: 0,
			},
		}
	}

	/**
	 * Resolve an alert
	 */
	async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
		const alert = this.alerts.find((a) => a.id === alertId)
		if (alert) {
			alert.resolved = true
			alert.resolvedAt = new Date().toISOString()
			alert.resolvedBy = resolvedBy

			// Notify handlers
			for (const handler of this.alertHandlers) {
				try {
					await handler.resolveAlert(alertId, resolvedBy)
				} catch (error) {
					console.error('Failed to resolve alert through handler:', error)
				}
			}
		}
	}

	/**
	 * Acknowledge an alert
	 */
	async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
		const alert = this.alerts.find((a) => a.id === alertId)
		if (alert) {
			alert.acknowledged = true
			alert.acknowledgedAt = new Date().toISOString()
			alert.acknowledgedBy = acknowledgedBy

			// Notify handlers
			for (const handler of this.alertHandlers) {
				try {
					await handler.acknowledgeAlert(alertId, acknowledgedBy)
				} catch (error) {
					console.error('Failed to acknowledge alert through handler:', error)
				}
			}
		}
	}

	/**
	 * Get system health status
	 */
	async getHealthStatus(): Promise<HealthStatus> {
		const now = new Date().toISOString()
		const metrics = await this.getMetrics()

		// Determine overall health based on metrics
		let overallStatus: 'OK' | 'WARNING' | 'CRITICAL' = 'OK'

		if (metrics.errorRate > 0.1) {
			// 10% error rate
			overallStatus = 'CRITICAL'
		} else if (metrics.errorRate > 0.05 || metrics.processingLatency > 5000) {
			// 5% error rate or 5s latency
			overallStatus = 'WARNING'
		}

		const activeAlerts = await this.getActiveAlerts()

		return {
			status: overallStatus,
			components: {
				monitoring: {
					status: 'OK',
					message: `Processing ${metrics.eventsProcessed} events`,
					lastCheck: metrics.timestamp,
				},
				alerting: {
					status: activeAlerts.length > 10 ? 'WARNING' : 'OK',
					message: `${activeAlerts.length} active alerts`,
					lastCheck: now,
				},
				patternDetection: {
					status: metrics.suspiciousPatterns > 5 ? 'WARNING' : 'OK',
					message: `${metrics.suspiciousPatterns} suspicious patterns detected`,
					lastCheck: metrics.timestamp,
				},
			},
			timestamp: now,
		}
	}
}

/**
 * Redis metrics collector
 */
export class RedisMetricsCollector implements MetricsCollector {
	private key = 'metrics'
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

	async getMetrics(): Promise<AuditMetrics> {
		const metrics: AuditMetrics = {
			eventsProcessed: parseInt(
				(await this.connection.get(`${this.key}:eventsProcessed`)) || '0',
				10
			),
			processingLatency: parseFloat(
				(await this.connection.get(`${this.key}:processingLatency`)) || '0'
			),
			queueDepth: parseInt((await this.connection.get(`${this.key}:queueDepth`)) || '0', 10),
			errorsGenerated: parseInt(
				(await this.connection.get(`${this.key}:errorsGenerated`)) || '0',
				10
			),
			errorRate: parseFloat((await this.connection.get(`${this.key}:errorRate`)) || '0'),
			integrityViolations: parseInt(
				(await this.connection.get(`${this.key}:integrityViolations`)) || '0',
				10
			),
			timestamp: (await this.connection.get(`${this.key}:timestamp`)) || new Date().toISOString(),
			alertsGenerated: parseInt(
				(await this.connection.get(`${this.key}:alertsGenerated`)) || '0',
				10
			),
			suspiciousPatterns: parseInt(
				(await this.connection.get(`${this.key}:suspiciousPatterns`)) || '0',
				10
			),
		}

		return metrics
	}

	async resetMetrics(): Promise<void> {
		await this.connection.del(`${this.key}`)

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
		await this.connection.set(`${this.key}`, JSON.stringify(metrics))
	}

	async recordQueueDepth(depth: number): Promise<void> {
		await this.connection.set(`${this.key}:queueDepth`, depth.toString())
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async recordEvent(): Promise<void> {
		await this.connection.incr(`${this.key}:eventsProcessed`)
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async recordProcessingLatency(latency: number): Promise<void> {
		const currentLatency = parseFloat(
			(await this.connection.get(`${this.key}:processingLatency`)) || '0'
		)
		const newLatency = (currentLatency + latency) / 2 // Calculate new average latency
		await this.connection.set(`${this.key}:processingLatency`, newLatency.toString())
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async recordError(): Promise<void> {
		await this.connection.incr(`${this.key}:errorsGenerated`)

		const currentErrorsGenerated = parseInt(
			(await this.connection.get(`${this.key}:errorsGenerated`)) || '0',
			10
		)
		const currentEventsProcessed = parseInt(
			(await this.connection.get(`${this.key}:eventsProcessed`)) || '0',
			10
		)

		let newErrorRate: number
		if (currentEventsProcessed === 0) {
			newErrorRate = 0.0
		} else {
			newErrorRate = currentErrorsGenerated / currentEventsProcessed
		}

		await this.connection.set(`${this.key}:errorRate`, newErrorRate.toString())
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async recordIntegrityViolation(): Promise<void> {
		await this.connection.incr(`${this.key}:integrityViolations`)
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async recordAlertGenerated(): Promise<void> {
		await this.connection.incr(`${this.key}:alertsGenerated`)
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async recordSuspiciousPattern(suspiciousPatterns: number): Promise<void> {
		await this.connection.incrby(`${this.key}:suspiciousPatterns`, suspiciousPatterns)
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	// Set cooldown period (5 minutes for similar alerts)
	async setCooldown(cooldownKey: string, cooldownPeriod = 300): Promise<void> {
		await this.connection.setex(cooldownKey, cooldownPeriod, '1')
	}

	// Check if an alert is on cooldown
	async isOnCooldown(cooldownKey: string): Promise<boolean> {
		return (await this.connection.exists(cooldownKey)) === 1
	}
}

/**
 * Default metrics collector implementation
 
export class DefaultMetricsCollector implements MetricsCollector {
	private metrics: AuditMetrics

	constructor() {
		this.metrics = {
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
	}

	recordEvent(): void {
		this.metrics.eventsProcessed++
		this.metrics.timestamp = new Date().toISOString()
	}

	recordProcessingLatency(latency: number): void {
		// Simple moving average
		this.metrics.processingLatency = (this.metrics.processingLatency + latency) / 2
	}

	recordError(): void {
		// Simple error rate calculation
		this.metrics.errorRate = Math.min(this.metrics.errorRate + 0.01, 1.0)
	}

	recordIntegrityViolation(): void {
		this.metrics.integrityViolations++
	}

	getMetrics(): AuditMetrics {
		return { ...this.metrics }
	}

	resetMetrics(): void {
		this.metrics = {
			eventsProcessed: 0,
			processingLatency: 0,
			queueDepth: 0,
			errorRate: 0,
			integrityViolations: 0,
			timestamp: new Date().toISOString(),
			alertsGenerated: 0,
			suspiciousPatterns: 0,
		}
	}
} */

/**
 * Console alert handler for development/testing
 */
export class ConsoleAlertHandler implements AlertHandler {
	handlerName(): string {
		return 'ConsoleAlertHandler'
	}

	async sendAlert(alert: Alert): Promise<void> {
		console.log(`🚨 ALERT [${alert.severity}]: ${alert.title}`)
		console.log(`   Description: ${alert.description}`)
		console.log(`   Source: ${alert.source}`)
		console.log(`   Timestamp: ${alert.timestamp}`)
		console.log(`   Metadata:`, alert.metadata)
	}

	async resolveAlert(alertId: string, resolvedBy: string): Promise<{ success: boolean }> {
		console.log(`✅ Alert ${alertId} resolved by ${resolvedBy}`)
		return { success: true }
	}

	async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<{ success: boolean }> {
		console.log(`✅ Alert ${alertId} acknowledged by ${acknowledgedBy}`)
		return { success: true }
	}

	async getActiveAlerts(organizationId?: string): Promise<Alert[]> {
		// Console handler doesn't store alerts
		console.log(
			`📋 Getting active alerts${organizationId ? ` for organization ${organizationId}` : ''}`
		)
		return []
	}

	async numberOfActiveAlerts(organizationId?: string): Promise<number> {
		// Console handler doesn't store alerts
		console.log(
			`📋 Getting number of active alerts${
				organizationId ? ` for organization ${organizationId}` : ''
			}`
		)
		return 0
	}

	async getAlertStatistics(organizationId?: string): Promise<AlertStatistics> {
		// Console handler doesn't store alerts
		console.log(
			`📊 Getting alert statistics${organizationId ? ` for organization ${organizationId}` : ''}`
		)
		return {
			total: 0,
			active: 0,
			acknowledged: 0,
			resolved: 0,
			bySeverity: {
				LOW: 0,
				MEDIUM: 0,
				HIGH: 0,
				CRITICAL: 0,
			},
			byType: {
				SECURITY: 0,
				COMPLIANCE: 0,
				PERFORMANCE: 0,
				SYSTEM: 0,
				METRICS: 0,
			},
		}
	}
}
