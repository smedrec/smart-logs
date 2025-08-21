/**
 * @fileoverview Alerting Service
 *
 * Provides comprehensive alerting capabilities:
 * - Alert creation and management
 * - Severity-based routing
 * - Integration with external systems
 * - Alert deduplication
 *
 * Requirements: 6.5
 */

export interface Alert {
	id: string
	severity: 'low' | 'medium' | 'high' | 'critical'
	title: string
	description: string
	timestamp: string
	status: 'active' | 'acknowledged' | 'resolved'
	source: string
	metadata?: Record<string, any>
	acknowledgedBy?: string
	acknowledgedAt?: string
	resolvedBy?: string
	resolvedAt?: string
	resolution?: string
}

export interface AlertRule {
	id: string
	name: string
	condition: string
	severity: 'low' | 'medium' | 'high' | 'critical'
	enabled: boolean
	cooldownPeriod: number // seconds
	lastTriggered?: string
}

/**
 * Enhanced alerting service
 */
export class AlertingService {
	private readonly alertPrefix = 'alerts:'
	private readonly rulePrefix = 'alert_rules:'
	private readonly cooldownPrefix = 'alert_cooldown:'

	constructor(
		private redis: any,
		private logger: any
	) {}

	/**
	 * Create a new alert
	 */
	async createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'status'>): Promise<Alert> {
		const alert: Alert = {
			id: this.generateAlertId(),
			timestamp: new Date().toISOString(),
			status: 'active',
			...alertData,
		}

		try {
			// Check for duplicate alerts
			const isDuplicate = await this.checkDuplicateAlert(alert)
			if (isDuplicate) {
				this.logger.debug('Duplicate alert suppressed', { alertId: alert.id, title: alert.title })
				return alert
			}

			// Store alert
			await this.storeAlert(alert)

			// Log alert creation
			this.logger.warn('Alert created', {
				alertId: alert.id,
				severity: alert.severity,
				title: alert.title,
				source: alert.source,
			})

			// Send notifications based on severity
			await this.sendNotifications(alert)

			return alert
		} catch (error) {
			this.logger.error('Failed to create alert', {
				error: error instanceof Error ? error.message : 'Unknown error',
				alertData,
			})
			throw error
		}
	}

	/**
	 * Get alerts with filtering
	 */
	async getAlerts(
		filters: {
			severity?: Alert['severity']
			status?: Alert['status']
			source?: string
			limit?: number
			offset?: number
		} = {}
	): Promise<{ alerts: Alert[]; total: number }> {
		try {
			const { limit = 50, offset = 0 } = filters
			const pattern = `${this.alertPrefix}*`
			const keys = await this.redis.keys(pattern)

			let alerts: Alert[] = []

			// Get all alerts
			for (const key of keys) {
				try {
					const alertData = await this.redis.get(key)
					if (alertData) {
						const alert = JSON.parse(alertData)
						alerts.push(alert)
					}
				} catch (parseError) {
					this.logger.warn('Failed to parse alert', { key, error: parseError })
				}
			}

			// Apply filters
			if (filters.severity) {
				alerts = alerts.filter((alert) => alert.severity === filters.severity)
			}
			if (filters.status) {
				alerts = alerts.filter((alert) => alert.status === filters.status)
			}
			if (filters.source) {
				alerts = alerts.filter((alert) => alert.source === filters.source)
			}

			// Sort by timestamp (newest first)
			alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

			// Apply pagination
			const total = alerts.length
			const paginatedAlerts = alerts.slice(offset, offset + limit)

			return { alerts: paginatedAlerts, total }
		} catch (error) {
			this.logger.error('Failed to get alerts', {
				error: error instanceof Error ? error.message : 'Unknown error',
				filters,
			})
			return { alerts: [], total: 0 }
		}
	}

	/**
	 * Acknowledge an alert
	 */
	async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<Alert | null> {
		try {
			const alert = await this.getAlert(alertId)
			if (!alert) {
				return null
			}

			if (alert.status !== 'active') {
				throw new Error('Only active alerts can be acknowledged')
			}

			const updatedAlert: Alert = {
				...alert,
				status: 'acknowledged',
				acknowledgedBy,
				acknowledgedAt: new Date().toISOString(),
			}

			await this.storeAlert(updatedAlert)

			this.logger.info('Alert acknowledged', {
				alertId,
				acknowledgedBy,
				title: alert.title,
			})

			return updatedAlert
		} catch (error) {
			this.logger.error('Failed to acknowledge alert', {
				alertId,
				acknowledgedBy,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Resolve an alert
	 */
	async resolveAlert(
		alertId: string,
		resolvedBy: string,
		resolution: string
	): Promise<Alert | null> {
		try {
			const alert = await this.getAlert(alertId)
			if (!alert) {
				return null
			}

			const updatedAlert: Alert = {
				...alert,
				status: 'resolved',
				resolvedBy,
				resolvedAt: new Date().toISOString(),
				resolution,
			}

			await this.storeAlert(updatedAlert)

			this.logger.info('Alert resolved', {
				alertId,
				resolvedBy,
				resolution,
				title: alert.title,
			})

			return updatedAlert
		} catch (error) {
			this.logger.error('Failed to resolve alert', {
				alertId,
				resolvedBy,
				resolution,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Get a single alert by ID
	 */
	private async getAlert(alertId: string): Promise<Alert | null> {
		try {
			const key = `${this.alertPrefix}${alertId}`
			const alertData = await this.redis.get(key)
			return alertData ? JSON.parse(alertData) : null
		} catch (error) {
			this.logger.error('Failed to get alert', {
				alertId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return null
		}
	}

	/**
	 * Store alert in Redis
	 */
	private async storeAlert(alert: Alert): Promise<void> {
		const key = `${this.alertPrefix}${alert.id}`
		const ttl = 7 * 24 * 3600 // 7 days
		await this.redis.setex(key, ttl, JSON.stringify(alert))
	}

	/**
	 * Check for duplicate alerts
	 */
	private async checkDuplicateAlert(alert: Alert): Promise<boolean> {
		try {
			// Create a hash of the alert content for deduplication
			const alertHash = this.createAlertHash(alert)
			const cooldownKey = `${this.cooldownPrefix}${alertHash}`

			const exists = await this.redis.exists(cooldownKey)
			if (exists) {
				return true
			}

			// Set cooldown period (5 minutes for similar alerts)
			await this.redis.setex(cooldownKey, 300, '1')
			return false
		} catch (error) {
			this.logger.error('Failed to check duplicate alert', {
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
			this.logger.info('Alert notification', {
				alertId: alert.id,
				severity: alert.severity,
				title: alert.title,
				description: alert.description,
				source: alert.source,
			})

			// For critical alerts, you might want to send immediate notifications
			if (alert.severity === 'critical') {
				await this.sendCriticalAlertNotification(alert)
			}
		} catch (error) {
			this.logger.error('Failed to send alert notifications', {
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
		this.logger.error('CRITICAL ALERT', {
			alertId: alert.id,
			title: alert.title,
			description: alert.description,
			source: alert.source,
			metadata: alert.metadata,
		})
	}

	/**
	 * Generate unique alert ID
	 */
	private generateAlertId(): string {
		return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}
}
