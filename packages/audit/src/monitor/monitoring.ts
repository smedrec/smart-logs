/**
 * Real-time monitoring and alerting system for audit events
 * Implements suspicious pattern detection, alert generation, and metrics collection
 */

import { MonitoringConfig, PatternDetectionConfig } from '../config/types.js'
import { AlertResolution } from './database-alert-handler.js'
import { MetricsCollector, RedisMetricsCollector } from './metrics-collector.js'

import type { AuditLogEvent } from '../types.js'
import type {
	Alert,
	AlertSeverity,
	AlertStatistics,
	AlertType,
	AuditMetrics,
	EndpointMetrics,
	HealthStatus,
	MetricPoint,
	MetricQuery,
	Metrics,
	PerformanceMetrics,
	RequestMetrics,
	SystemMetrics,
} from './monitoring-types.js'

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
	dismissAlert(alertId: string, dismissedBy: string): Promise<{ success: boolean }>
	getActiveAlerts(organizationId?: string): Promise<Alert[]>
	numberOfActiveAlerts(organizationId?: string): Promise<number>
	getAlertStatistics(organizationId?: string): Promise<AlertStatistics>
}

/**
 * Real-time monitoring service
 */
export class MonitoringService {
	private readonly alertPrefix = 'alerts:'
	private readonly cooldownPrefix = 'alert_cooldown:'
	private events: AuditLogEvent[] = []
	private alerts: Alert[] = []
	private config: MonitoringConfig
	private alertHandlers: AlertHandler[] = []
	private metricsCollector: MetricsCollector
	private logger: any

	constructor(config: MonitoringConfig, metricsCollector?: MetricsCollector, logger?: any) {
		this.config = config
		this.metricsCollector = metricsCollector || new RedisMetricsCollector()
		this.logger = logger || console
	}

	/**
	 * Initialize metrics with default values
	 */
	private initializeMetrics(): AuditMetrics {
		return {
			eventsProcessed: 0,
			queueDepth: 0,
			errorsGenerated: 0,
			errorRate: 0,
			integrityViolations: 0,
			timestamp: new Date().toISOString(),
			alertsGenerated: 0,
			suspiciousPatterns: 0,
			processingLatency: { average: 0, p95: 0, p99: 0 },
			integrityVerifications: { total: 0, passed: 0, failed: 0 },
			complianceReports: { generated: 0, scheduled: 0, failed: 0 },
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
				this.config.patternDetection.failedAuthTimeWindow,
				this.config.patternDetection.unauthorizedAccessTimeWindow,
				this.config.patternDetection.dataAccessTimeWindow,
				this.config.patternDetection.bulkOperationTimeWindow
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
		const cutoffTime = now - this.config.patternDetection.failedAuthTimeWindow

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
			if (groupEvents.length >= this.config.patternDetection.failedAuthThreshold) {
				return {
					type: 'FAILED_AUTH',
					severity: 'HIGH',
					description: `${groupEvents.length} failed authentication attempts detected from ${key} within ${this.config.patternDetection.failedAuthTimeWindow / 1000} seconds`,
					events: groupEvents,
					metadata: {
						source: key,
						attemptCount: groupEvents.length,
						timeWindow: this.config.patternDetection.failedAuthTimeWindow,
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
		const cutoffTime = now - this.config.patternDetection.unauthorizedAccessTimeWindow

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
			if (groupEvents.length >= this.config.patternDetection.unauthorizedAccessThreshold) {
				return {
					type: 'UNAUTHORIZED_ACCESS',
					severity: 'CRITICAL',
					description: `${groupEvents.length} unauthorized access attempts detected from principal ${key} within ${this.config.patternDetection.unauthorizedAccessTimeWindow / 1000} seconds`,
					events: groupEvents,
					metadata: {
						principalId: key,
						attemptCount: groupEvents.length,
						timeWindow: this.config.patternDetection.unauthorizedAccessTimeWindow,
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
		const cutoffTime = now - this.config.patternDetection.dataAccessTimeWindow

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
			if (groupEvents.length >= this.config.patternDetection.dataAccessVelocityThreshold) {
				return {
					type: 'DATA_VELOCITY',
					severity: 'MEDIUM',
					description: `${groupEvents.length} data access operations detected from principal ${key} within ${this.config.patternDetection.dataAccessTimeWindow / 1000} seconds`,
					events: groupEvents,
					metadata: {
						principalId: key,
						accessCount: groupEvents.length,
						timeWindow: this.config.patternDetection.dataAccessTimeWindow,
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
		const cutoffTime = now - this.config.patternDetection.bulkOperationTimeWindow

		const bulkEvents = events.filter(
			(event) =>
				(event.action.includes('data.export') ||
					event.action.includes('data.import') ||
					event.action.includes('bulk') ||
					(event as any).recordCount > 10) &&
				new Date(event.timestamp).getTime() > cutoffTime
		)

		if (bulkEvents.length >= this.config.patternDetection.bulkOperationThreshold) {
			return {
				type: 'BULK_OPERATION',
				severity: 'MEDIUM',
				description: `${bulkEvents.length} bulk operations detected within ${this.config.patternDetection.bulkOperationTimeWindow / 1000} seconds`,
				events: bulkEvents,
				metadata: {
					operationCount: bulkEvents.length,
					timeWindow: this.config.patternDetection.bulkOperationTimeWindow,
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
				this.config.patternDetection.offHoursStart > this.config.patternDetection.offHoursEnd
					? hour >= this.config.patternDetection.offHoursStart ||
						hour < this.config.patternDetection.offHoursEnd
					: hour >= this.config.patternDetection.offHoursStart &&
						hour < this.config.patternDetection.offHoursEnd

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
				description: `${offHoursEvents.length} data access operations detected during off-hours (${this.config.patternDetection.offHoursStart}:00 - ${this.config.patternDetection.offHoursEnd}:00)`,
				events: offHoursEvents,
				metadata: {
					accessCount: offHoursEvents.length,
					offHoursStart: this.config.patternDetection.offHoursStart,
					offHoursEnd: this.config.patternDetection.offHoursEnd,
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
			status: 'active',
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
		if (!this.config.notification.enabled) {
			return
		}

		try {
			// Log notification (in a real implementation, this would integrate with external systems)
			console.info('Alert notification', {
				alertId: alert.id,
				severity: alert.severity,
				title: alert.title,
				description: alert.description,
				source: alert.source,
				status: alert.status,
			})

			// For critical alerts, you might want to send immediate notifications
			if (alert.severity === 'CRITICAL') {
				await this.sendCriticalAlertNotification(alert)
			} else {
				fetch(`${this.config.notification.url}/${alert.metadata.organizationId}`, {
					method: 'POST', // PUT works too
					body: alert.description,
					headers: {
						Authorization: `Bearer ${this.config.notification.credentials.secret}`,
						Title: alert.title,
						Tags: `warning,${alert.type},${alert.severity},${alert.source},${alert.status}`,
					},
				})
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
			status: alert.status,
			metadata: alert.metadata,
		})
		fetch(`${this.config.notification.url}/${alert.metadata.organizationId}`, {
			method: 'POST', // PUT works too
			body: alert.description,
			headers: {
				Authorization: `Bearer ${this.config.notification.credentials.secret}`,
				Title: alert.title,
				Priority: '5',
				Tags: `warning,${alert.type},${alert.severity},${alert.source},${alert.status}`,
			},
		})
	}

	/**
	 * Get current metrics
	 */
	async getMetrics(): Promise<Metrics> {
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
			dismissed: 0,
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
			bySource: {},
			trends: [],
		}
	}

	/**
	 * Resolve an alert
	 */
	async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
		const alert = this.alerts.find((a) => a.id === alertId)
		if (alert) {
			alert.resolved = true
			alert.status = 'resolved'
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
			alert.status = 'acknowledged'
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

	/**
	 * Store request metrics for aggregation
	 */
	async storeRequestMetrics(metrics: RequestMetrics): Promise<void> {
		try {
			// Store in Redis for real-time metrics using enhanced metrics service
			const key = `requests:${Date.now()}`
			await this.metricsCollector.storeMetric(key, metrics, 3600) // 1 hour TTL

			// Update endpoint performance metrics
			await this.updateEndpointMetrics(metrics)
		} catch (error) {
			console.error('Failed to store request metrics:', error)
		}
	}

	/**
	 * Update endpoint performance metrics
	 */
	async updateEndpointMetrics(metrics: RequestMetrics): Promise<void> {
		const endpointKey = `${metrics.method}:${metrics.path}`
		const metricsKey = `metrics:endpoints:${endpointKey}`

		try {
			// Get existing metrics using enhanced metrics service
			const existing = await this.metricsCollector.getMetric(metricsKey)
			const now = new Date().toISOString()

			if (existing) {
				// Update existing metrics
				const updated: PerformanceMetrics = {
					endpoint: metrics.path,
					method: metrics.method,
					count: existing.count + 1,
					averageResponseTime:
						(existing.averageResponseTime * existing.count + metrics.responseTime) /
						(existing.count + 1),
					p95ResponseTime: existing.p95ResponseTime, // Will be calculated separately
					p99ResponseTime: existing.p99ResponseTime, // Will be calculated separately
					errorRate:
						metrics.statusCode >= 400
							? (existing.errorRate * existing.count + 1) / (existing.count + 1)
							: (existing.errorRate * existing.count) / (existing.count + 1),
					lastUpdated: now,
				}

				await this.metricsCollector.storeMetric(metricsKey, updated, 86400) // 24 hours TTL
			} else {
				// Create new metrics
				const newMetrics: PerformanceMetrics = {
					endpoint: metrics.path,
					method: metrics.method,
					count: 1,
					averageResponseTime: metrics.responseTime,
					p95ResponseTime: metrics.responseTime,
					p99ResponseTime: metrics.responseTime,
					errorRate: metrics.statusCode >= 400 ? 1 : 0,
					lastUpdated: now,
				}

				await this.metricsCollector.storeMetric(metricsKey, newMetrics, 86400) // 24 hours TTL
			}
		} catch (error) {
			console.error('Failed to update endpoint metrics:', error)
		}
	}

	/**
	 * Track request outcome for error rate calculation
	 */
	async trackRequestOutcome(
		path: string,
		method: string,
		outcome: 'success' | 'error'
	): Promise<void> {
		const key = `outcomes:${method}:${path}:${Date.now()}`
		await this.metricsCollector.storeMetric(key, { outcome, timestamp: Date.now() }, 3600) // 1 hour TTL
	}

	/**
	 * Calculate error rate for an endpoint
	 */
	async calculateErrorRate(path: string, method: string, windowSize: number): Promise<number> {
		const now = Date.now()
		const windowStart = now - windowSize

		try {
			// Get all outcomes in the time window
			const pattern = `outcomes:${method}:${path}:*`
			const outcomes = await this.metricsCollector.getMetricsByPattern(pattern)

			if (!outcomes || outcomes.length === 0) {
				return 0
			}

			// Filter outcomes within the time window
			const recentOutcomes = outcomes.filter((outcome: any) => {
				const timestamp = outcome.timestamp || 0
				return timestamp >= windowStart
			})

			if (recentOutcomes.length === 0) {
				return 0
			}

			// Calculate error rate
			const errorCount = recentOutcomes.filter((outcome: any) => outcome.outcome === 'error').length
			return errorCount / recentOutcomes.length
		} catch (error) {
			console.error('Failed to calculate error rate:', error)
			return 0
		}
	}

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
	async getAuditMetrics(query?: MetricQuery): Promise<AuditMetrics> {
		try {
			// TODO: review and improve metrics
			const metrics = await this.getMetrics()
			const [processingMetrics, verificationMetrics, reportMetrics] = await Promise.allSettled([
				this.getProcessingMetrics(query?.timeRange),
				this.getVerificationMetrics(query?.timeRange),
				this.getReportMetrics(query?.timeRange),
			])

			return {
				timestamp: new Date().toISOString(),
				eventsProcessed: metrics.eventsProcessed,
				queueDepth: metrics.queueDepth,
				errorsGenerated: metrics.errorsGenerated,
				errorRate: metrics.errorRate,
				integrityViolations: metrics.integrityViolations,
				alertsGenerated: metrics.alertsGenerated,
				suspiciousPatterns: metrics.suspiciousPatterns,
				//eventsProcessed:
				//	processingMetrics.status === 'fulfilled' ? processingMetrics.value.count : 0,
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
			/**const metrics = await this.getMetrics()
			return {
				timestamp: new Date().toISOString(),
				eventsProcessed: metrics.eventsProcessed,
				processingLatency: metrics.processingLatency,
				queueDepth: metrics.queueDepth,
				errorsGenerated: metrics.errorsGenerated,
				errorRate: metrics.errorRate,
				integrityViolations: metrics.integrityViolations,
				alertsGenerated: metrics.alertsGenerated,
				suspiciousPatterns: metrics.suspiciousPatterns,
			}*/
		} catch (error) {
			this.logger.error('Failed to collect audit metrics', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})

			return {
				timestamp: new Date().toISOString(),
				eventsProcessed: 0,
				queueDepth: 0,
				errorsGenerated: 0,
				errorRate: 0,
				integrityViolations: 0,
				alertsGenerated: 0,
				suspiciousPatterns: 0,
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
			const pattern = endpoint ? `endpoints:*:${endpoint}` : `endpoints:*`
			const metrics: EndpointMetrics[] = await this.metricsCollector.getMetricsByPattern(pattern)

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
			const info = await this.metricsCollector.info('memory')
			const keyCount = await this.metricsCollector.dbsize()

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
			const recentRequests = await this.metricsCollector.getMetricsByPattern(`requests:*`)
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
		let key = `{type}:${name}`

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
	 * Record a counter metric
	 */
	async incrementCounter(name: string, labels?: Record<string, string>, value = 1): Promise<void> {
		try {
			const key = this.buildMetricKey('counter', name, labels)
			await this.metricsCollector.incrementCounter(key, value)
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
			await this.metricsCollector.storeMetric(key, metric)
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
			await this.metricsCollector.storeMetric(
				measurementKey,
				{ timestamp: now, value, labels },
				3600
			) // 1 hour TTL

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
	 * Update histogram statistics
	 */
	private async updateHistogramStats(key: string, value: number): Promise<void> {
		try {
			const statsKey = `${key}:stats`
			const existing = await this.metricsCollector.getMetric(statsKey)

			if (existing) {
				const updated = {
					count: existing.count + 1,
					sum: existing.sum + value,
					min: Math.min(existing.min, value),
					max: Math.max(existing.max, value),
					lastUpdated: Date.now(),
				}
				await this.metricsCollector.storeMetric(statsKey, updated)
			} else {
				const newStats = {
					count: 1,
					sum: value,
					min: value,
					max: value,
					lastUpdated: Date.now(),
				}
				await this.metricsCollector.storeMetric(statsKey, newStats)
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

	async dismissAlert(alertId: string, dismissedBy: string): Promise<{ success: boolean }> {
		console.log(`✅ Alert ${alertId} dismissed by ${dismissedBy}`)
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
			dismissed: 0,
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
			bySource: {},
			trends: [],
		}
	}
}
