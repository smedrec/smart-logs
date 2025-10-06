import { MonitoringConfig } from '../config/types'
import { MetricsCollector, RedisMetricsCollector } from './metrics-collector'

import type { AlertResolution } from './database-alert-handler'
import type { Alert, AlertStatistics } from './monitoring-types'

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

export class AlertingService {
	private readonly alertPrefix = 'alerts:'
	private readonly cooldownPrefix = 'alert_cooldown:'
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
	 * Generate and send alert
	 */
	async generateAlert(alert: Alert): Promise<void> {
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
				INFO: 0,
			},
			byType: {
				SECURITY: 0,
				COMPLIANCE: 0,
				PERFORMANCE: 0,
				SYSTEM: 0,
				METRICS: 0,
				CUSTOM: 0,
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
}

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
		console.log(`   Timestamp: ${alert.createdAt}`)
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
				INFO: 0,
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
				CUSTOM: 0,
			},
			bySource: {},
			trends: [],
		}
	}
}
