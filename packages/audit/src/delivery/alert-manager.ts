/**
 * Alert manager for delivery failure monitoring and alerting
 * Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5: Alerting and monitoring
 */
import { AlertingService } from '../monitor/alerting.js'
import { AlertAccessControl } from './alert-access-control.js'
import { AlertDebouncer, DebounceType } from './alert-debouncer.js'

import type { Alert, AlertSeverity, AlertType } from '../monitor/monitoring-types.js'
import type { AlertUserContext } from './alert-access-control.js'
import type { DeliveryDatabaseClient } from './database-client.js'
import type { AlertThresholdConfig, IAlertManager } from './interfaces.js'

/**
 * Sliding window metrics for failure rate analysis
 */
interface SlidingWindowMetrics {
	windowStart: Date
	windowEnd: Date
	totalDeliveries: number
	failedDeliveries: number
	failureRate: number
}

/**
 * Alert configuration with debouncing and escalation settings
 */
interface AlertConfig {
	organizationId: string
	failureRateThreshold: number // percentage (0-100)
	consecutiveFailureThreshold: number
	queueBacklogThreshold: number
	responseTimeThreshold: number // milliseconds
	debounceWindow: number // minutes
	escalationDelay: number // minutes
	suppressionWindows: Array<{
		start: string // HH:MM format
		end: string // HH:MM format
		timezone: string
		reason: string
	}>
}

/**
 * Alert manager implementation with debouncing and organizational isolation
 */
export class AlertManager implements IAlertManager {
	private readonly alertService: AlertingService
	private readonly dbClient: DeliveryDatabaseClient
	private readonly alertConfigs = new Map<string, AlertConfig>()
	private readonly debouncer: AlertDebouncer
	private readonly accessControl: AlertAccessControl
	private readonly slidingWindowSize = 15 * 60 * 1000 // 15 minutes in milliseconds

	constructor(
		alertService: AlertingService,
		dbClient: DeliveryDatabaseClient,
		debouncer?: AlertDebouncer,
		accessControl?: AlertAccessControl
	) {
		this.alertService = alertService
		this.dbClient = dbClient
		this.debouncer = debouncer || new AlertDebouncer()
		this.accessControl = accessControl || new AlertAccessControl()
	}

	/**
	 * Check failure thresholds for a destination and generate alerts if needed
	 * Requirements 7.1, 7.2, 7.3, 7.4: Failure monitoring and alerting
	 */
	async checkFailureThresholds(destinationId: string): Promise<void> {
		const destination = await this.dbClient.getDestination(destinationId)
		if (!destination) {
			throw new Error(`Destination ${destinationId} not found`)
		}

		const config = await this.getAlertConfig(destination.organizationId)

		// Check if we're in a suppression window
		if (this.isInSuppressionWindow(config)) {
			return
		}

		// Check consecutive failures
		await this.checkConsecutiveFailures(destinationId, destination.organizationId, config)

		// Check failure rate in sliding window
		await this.checkFailureRate(destinationId, destination.organizationId, config)

		// Check response time threshold
		await this.checkResponseTime(destinationId, destination.organizationId, config)

		// Check queue backlog (organization-wide)
		await this.checkQueueBacklog(destination.organizationId, config)
	}

	/**
	 * Send an alert with debouncing logic
	 * Requirements 7.4, 7.5: Alert debouncing and rate limiting
	 */
	async sendAlert(debounceType: DebounceType, alert: Alert): Promise<void> {
		// Check if alert should be sent based on debouncing rules
		if (
			!this.debouncer.shouldSendAlert(
				debounceType,
				alert.metadata.destinationId,
				alert.metadata.organizationId
			)
		) {
			return
		}

		// Store alert in database
		await this.alertService.sendExternalAlert(alert)

		// Check if alert should be escalated
		const escalation = this.debouncer.shouldEscalateAlert(
			debounceType,
			alert.metadata.destinationId,
			alert.metadata.organizationId
		)
		if (escalation.shouldEscalate) {
			const escalatedAlert = {
				...alert,
				severity: escalation.newSeverity!,
				title: `[ESCALATED] ${alert.title}`,
				description: `${alert.description} (Escalated due to continued issues)`,
				metadata: {
					...alert.metadata,
					escalated: true,
					originalAlertId: alert.id,
					escalationChannels: escalation.channels,
				},
			}

			await this.alertService.sendExternalAlert(escalatedAlert)
		}
	}

	/**
	 * Get active alerts for an organization
	 * Requirements 6.1, 6.2, 6.3: Organizational isolation
	 */
	async getActiveAlerts(organizationId: string): Promise<Alert[]> {
		return this.alertService.getActiveAlerts(organizationId)
	}

	/**
	 * Configure alert thresholds for an organization
	 * Requirements 6.4, 6.5: Organization-specific configuration
	 */
	async configureAlertThresholds(
		organizationId: string,
		config: AlertThresholdConfig
	): Promise<void> {
		const alertConfig: AlertConfig = {
			organizationId,
			...config,
			suppressionWindows: [], // Default empty, can be configured separately
		}

		this.alertConfigs.set(organizationId, alertConfig)
		await this.dbClient.saveAlertConfig(organizationId, alertConfig)
	}

	/**
	 * Check consecutive failures for a destination
	 * Requirements 7.1, 7.2: Consecutive failure detection
	 */
	private async checkConsecutiveFailures(
		destinationId: string,
		organizationId: string,
		config: AlertConfig
	): Promise<void> {
		const health = await this.dbClient.getDestinationHealth(destinationId)
		if (!health) {
			return
		}

		if (health.consecutiveFailures >= config.consecutiveFailureThreshold) {
			const severity = this.calculateSeverity(
				health.consecutiveFailures,
				config.consecutiveFailureThreshold
			)

			const alert: Alert = {
				id: this.alertService.generateAlertId(),
				source: 'delivery-service',
				type: 'DELIVERY',
				severity,
				status: 'active',
				title: `Consecutive Failures Detected`,
				description: `Destination has ${health.consecutiveFailures} consecutive failures (threshold: ${config.consecutiveFailureThreshold})`,
				acknowledged: false,
				resolved: false,
				metadata: {
					organizationId,
					destinationId,
					consecutiveFailures: health.consecutiveFailures,
					threshold: config.consecutiveFailureThreshold,
					lastFailureAt: health.lastFailureAt,
				},
				tags: ['consecutive-failures'],
				createdAt: new Date().toISOString(),
			}

			await this.sendAlert('consecutive_failures', alert)
		}
	}

	/**
	 * Check failure rate in sliding window
	 * Requirements 7.1, 7.3: Failure rate monitoring with sliding window
	 */
	private async checkFailureRate(
		destinationId: string,
		organizationId: string,
		config: AlertConfig
	): Promise<void> {
		const metrics = await this.getSlidingWindowMetrics(destinationId)

		if (metrics.totalDeliveries >= 10 && metrics.failureRate >= config.failureRateThreshold) {
			const severity = this.calculateSeverity(metrics.failureRate, config.failureRateThreshold)

			const alert: Alert = {
				id: this.alertService.generateAlertId(),
				source: 'delivery-service',
				type: 'DELIVERY',
				severity,
				status: 'active',
				title: `High Failure Rate Detected`,
				description: `Destination has ${metrics.failureRate.toFixed(1)}% failure rate in the last 15 minutes (threshold: ${config.failureRateThreshold}%)`,
				acknowledged: false,
				resolved: false,
				metadata: {
					organizationId,
					destinationId,
					failureRate: metrics.failureRate,
					threshold: config.failureRateThreshold,
					totalDeliveries: metrics.totalDeliveries,
					failedDeliveries: metrics.failedDeliveries,
					windowStart: metrics.windowStart.toISOString(),
					windowEnd: metrics.windowEnd.toISOString(),
				},
				tags: ['failure-rate'],
				createdAt: new Date().toISOString(),
			}

			await this.sendAlert('failure_rate', alert)
		}
	}

	/**
	 * Check response time threshold
	 * Requirements 7.4: Response time monitoring
	 */
	private async checkResponseTime(
		destinationId: string,
		organizationId: string,
		config: AlertConfig
	): Promise<void> {
		const health = await this.dbClient.getDestinationHealth(destinationId)
		if (!health || !health.averageResponseTime) {
			return
		}

		if (health.averageResponseTime >= config.responseTimeThreshold) {
			const severity = this.calculateSeverity(
				health.averageResponseTime,
				config.responseTimeThreshold
			)

			const alert: Alert = {
				id: this.alertService.generateAlertId(),
				source: 'delivery-service',
				type: 'DELIVERY',
				severity,
				status: 'active',
				title: `High Response Time Detected`,
				description: `Destination average response time is ${health.averageResponseTime}ms (threshold: ${config.responseTimeThreshold}ms)`,
				acknowledged: false,
				resolved: false,
				metadata: {
					organizationId,
					destinationId,
					averageResponseTime: health.averageResponseTime,
					threshold: config.responseTimeThreshold,
				},
				tags: ['response-time'],
				createdAt: new Date().toISOString(),
			}

			await this.sendAlert('response_time', alert)
		}
	}

	/**
	 * Check queue backlog for organization
	 * Requirements 7.3: Queue backlog monitoring
	 */
	private async checkQueueBacklog(organizationId: string, config: AlertConfig): Promise<void> {
		const queueStatus = await this.dbClient.getQueueStatus(organizationId)

		if (queueStatus.pendingCount >= config.queueBacklogThreshold) {
			const severity = this.calculateSeverity(
				queueStatus.pendingCount,
				config.queueBacklogThreshold
			)

			const alert: Alert = {
				id: this.alertService.generateAlertId(),
				source: 'delivery-service',
				type: 'DELIVERY',
				severity,
				status: 'active',
				title: `Queue Backlog Alert`,
				description: `Delivery queue has ${queueStatus.pendingCount} pending deliveries (threshold: ${config.queueBacklogThreshold})`,
				acknowledged: false,
				resolved: false,
				metadata: {
					organizationId,
					destinationId: '', // Organization-wide alert
					pendingCount: queueStatus.pendingCount,
					threshold: config.queueBacklogThreshold,
					oldestPendingAge: queueStatus.oldestPendingAge,
				},
				tags: ['queue-backlog'],
				createdAt: new Date().toISOString(),
			}

			await this.sendAlert('queue_backlog', alert)
		}
	}

	/**
	 * Get sliding window metrics for failure rate analysis
	 */
	private async getSlidingWindowMetrics(destinationId: string): Promise<SlidingWindowMetrics> {
		const windowEnd = new Date()
		const windowStart = new Date(windowEnd.getTime() - this.slidingWindowSize)

		const deliveries = await this.dbClient.getDeliveriesInWindow(
			destinationId,
			windowStart,
			windowEnd
		)

		const totalDeliveries = deliveries.length
		const failedDeliveries = deliveries.filter((d) => d.status === 'failed').length
		const failureRate = totalDeliveries > 0 ? (failedDeliveries / totalDeliveries) * 100 : 0

		return {
			windowStart,
			windowEnd,
			totalDeliveries,
			failedDeliveries,
			failureRate,
		}
	}

	/**
	 * Add maintenance window for alert suppression
	 * Requirements 7.4, 7.5: Alert suppression during maintenance windows
	 */
	addMaintenanceWindow(window: {
		id: string
		organizationId: string
		destinationId?: string
		startTime: string
		endTime: string
		timezone: string
		reason: string
		suppressDebounceTypes: DebounceType[]
		createdBy: string
	}): void {
		this.debouncer.addMaintenanceWindow(window)
	}

	/**
	 * Remove maintenance window
	 */
	removeMaintenanceWindow(windowId: string): void {
		this.debouncer.removeMaintenanceWindow(windowId)
	}

	/**
	 * Get active maintenance windows for organization
	 */
	getActiveMaintenanceWindows(organizationId: string): any[] {
		return this.debouncer.getActiveMaintenanceWindows(organizationId)
	}

	/**
	 * Suppress alerts for a specific period
	 */
	suppressAlerts(
		debounceType: DebounceType,
		destinationId: string,
		organizationId: string,
		suppressionMinutes: number
	): void {
		this.debouncer.suppressAlerts(debounceType, destinationId, organizationId, suppressionMinutes)
	}

	/**
	 * Get debounce statistics for monitoring
	 */
	getDebounceStats(): any {
		return this.debouncer.getDebounceStats()
	}

	/**
	 * Cleanup expired debounce states and maintenance windows
	 */
	cleanup(): void {
		this.debouncer.cleanup()
	}

	// Organizational isolation methods

	/**
	 * Get alerts with organizational isolation
	 * Requirements 6.1, 6.2, 6.3: Organizational isolation
	 */
	async getAlertsForUser(userContext: AlertUserContext): Promise<Alert[]> {
		// Verify user has permission to view alerts
		const validation = this.accessControl.validateAlertOperation(userContext, 'view')
		if (!validation.allowed) {
			throw new Error(`Access denied: ${validation.reason}`)
		}

		// Get alerts for user's organization
		const alerts = await this.getActiveAlerts(userContext.organizationId)

		// Filter alerts based on user access
		return this.accessControl.filterAlerts(userContext, alerts)
	}

	/**
	 * Configure alert thresholds with access control
	 * Requirements 6.4, 6.5: Organization-specific configuration
	 */
	async configureAlertThresholdsWithAuth(
		userContext: AlertUserContext,
		config: AlertThresholdConfig
	): Promise<void> {
		// Validate user can configure thresholds
		if (!this.accessControl.canModifyAlertConfig(userContext, userContext.organizationId)) {
			throw new Error('Access denied: Insufficient permissions to configure alert thresholds')
		}

		// Configure thresholds for user's organization
		await this.configureAlertThresholds(userContext.organizationId, config)

		// Create audit log entry
		const auditEntry = this.accessControl.createAuditLogEntry(
			userContext,
			'configure_thresholds',
			'config',
			userContext.organizationId,
			{ config }
		)

		// Log the audit entry
		console.log('Alert audit log:', auditEntry)
	}

	/**
	 * Add maintenance window with access control
	 * Requirements 6.4, 6.5: Maintenance window management
	 */
	async addMaintenanceWindowWithAuth(
		userContext: AlertUserContext,
		window: {
			id: string
			destinationId?: string
			startTime: string
			endTime: string
			timezone: string
			reason: string
			suppressDebounceTypes: DebounceType[]
		}
	): Promise<void> {
		// Validate user can manage maintenance windows
		if (!this.accessControl.canManageMaintenanceWindows(userContext, userContext.organizationId)) {
			throw new Error('Access denied: Insufficient permissions to manage maintenance windows')
		}

		// Add organization context to window
		const organizationalWindow = {
			...window,
			organizationId: userContext.organizationId,
			createdBy: userContext.userId,
		}

		// Add maintenance window
		this.addMaintenanceWindow(organizationalWindow)

		// Create audit log entry
		const auditEntry = this.accessControl.createAuditLogEntry(
			userContext,
			'create_maintenance_window',
			'maintenance_window',
			window.id,
			{ window: organizationalWindow }
		)

		// Log the audit entry
		console.log('Alert audit log:', auditEntry)
	}

	/**
	 * Suppress alerts with access control
	 * Requirements 6.4, 6.5: Alert suppression management
	 */
	async suppressAlertsWithAuth(
		userContext: AlertUserContext,
		debounceType: DebounceType,
		destinationId: string,
		suppressionMinutes: number
	): Promise<void> {
		// Validate user has suppression permissions
		const validation = this.accessControl.validateAlertOperation(userContext, 'suppress')
		if (!validation.allowed) {
			throw new Error(`Access denied: ${validation.reason}`)
		}

		// Verify destination belongs to user's organization
		const destination = await this.dbClient.getDestination(destinationId)
		if (!destination) {
			throw new Error(`Destination ${destinationId} not found`)
		}

		this.accessControl.preventCrossOrganizationAccess(userContext, destination.organizationId)

		// Suppress alerts
		this.suppressAlerts(debounceType, destinationId, userContext.organizationId, suppressionMinutes)

		// Create audit log entry
		const auditEntry = this.accessControl.createAuditLogEntry(
			userContext,
			'suppress_alerts',
			'destination',
			destinationId,
			{ debounceType, suppressionMinutes }
		)

		// Log the audit entry
		console.log('Alert audit log:', auditEntry)
	}

	/**
	 * Get sanitized alert data for user
	 * Requirements 6.1, 6.2, 6.3: Data sanitization
	 */
	sanitizeAlertForUser(userContext: AlertUserContext, alert: Alert): Alert | null {
		return this.accessControl.sanitizeAlertForUser(userContext, alert)
	}

	/**
	 * Create user context for alert operations
	 * Requirements 6.4, 6.5: User context management
	 */
	createUserContext(
		userId: string,
		organizationId: string,
		role: 'viewer' | 'operator' | 'admin' | 'owner',
		additionalContext?: {
			departmentId?: string
			teamId?: string
		}
	): AlertUserContext {
		return this.accessControl.createUserContext(userId, organizationId, role, additionalContext)
	}

	/**
	 * Check if current time is in a suppression window
	 */
	private isInSuppressionWindow(config: AlertConfig): boolean {
		const now = new Date()

		for (const window of config.suppressionWindows) {
			if (this.isTimeInWindow(now, window.start, window.end, window.timezone)) {
				return true
			}
		}

		return false
	}

	/**
	 * Check if time is within a suppression window
	 */
	private isTimeInWindow(time: Date, start: string, end: string, timezone: string): boolean {
		// Implementation would use timezone-aware time comparison
		// For now, simplified implementation
		const timeStr = time.toTimeString().substring(0, 5) // HH:MM format
		return timeStr >= start && timeStr <= end
	}

	/**
	 * Calculate alert severity based on threshold breach
	 */
	private calculateSeverity(value: number, threshold: number): AlertSeverity {
		const ratio = threshold > 0 ? value / threshold : 0

		if (ratio >= 3) return 'CRITICAL'
		if (ratio >= 2) return 'HIGH'
		if (ratio >= 1.5) return 'MEDIUM'
		return 'LOW'
	}

	/**
	 * Get alert configuration for organization
	 */
	private async getAlertConfig(organizationId: string): Promise<AlertConfig> {
		let config = this.alertConfigs.get(organizationId)

		if (!config) {
			// Load from database or use defaults
			config =
				((await this.dbClient.getAlertConfig(organizationId)) as AlertConfig) ||
				({
					organizationId,
					failureRateThreshold: 10, // 10%
					consecutiveFailureThreshold: 5,
					queueBacklogThreshold: 1000,
					responseTimeThreshold: 30000, // 30 seconds
					debounceWindow: 15, // 15 minutes
					escalationDelay: 60, // 1 hour
					suppressionWindows: [],
				} as AlertConfig)

			this.alertConfigs.set(organizationId, config)
		}

		return config
	}

	/**
	 * Verify organizational access for alert operations
	 */
	private async verifyOrganizationalAccess(organizationId: string, userId: string): Promise<void> {
		// Implementation would verify user has access to organization
		// For now, simplified implementation
		const hasAccess = await this.dbClient.verifyUserOrganizationAccess(userId, organizationId)
		if (!hasAccess) {
			throw new Error(`User ${userId} does not have access to organization ${organizationId}`)
		}
	}
}

/**
 * Factory function for creating alert manager
 */
export function createAlertManager(
	AlertingService: AlertingService,
	dbClient: DeliveryDatabaseClient
) {
	return new AlertManager(AlertingService, dbClient)
}
