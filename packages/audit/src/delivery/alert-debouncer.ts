/**
 * Alert debouncing and rate limiting implementation
 * Requirements 7.4, 7.5: Alert debouncing and rate limiting
 */

import { AlertSeverity, AlertType } from '../monitor/monitoring-types'

export type DebounceType =
	| 'failure_rate'
	| 'consecutive_failures'
	| 'queue_backlog'
	| 'response_time'

/**
 * Debounce configuration for different alert types
 */
interface DebounceConfig {
	windowMinutes: number // Time window for debouncing
	cooldownMinutes: number // Cooldown period after alert
	maxAlertsPerWindow: number // Maximum alerts per window
	escalationDelayMinutes: number // Delay before escalation
}

/**
 * Alert escalation configuration
 */
interface EscalationConfig {
	levels: Array<{
		delayMinutes: number
		severity: AlertSeverity
		channels: string[] // notification channels
	}>
}

/**
 * Maintenance window configuration
 */
interface MaintenanceWindow {
	id: string
	organizationId: string
	destinationId?: string // Optional - for destination-specific maintenance
	startTime: string // ISO 8601 datetime
	endTime: string // ISO 8601 datetime
	timezone: string
	reason: string
	suppressDebounceTypes: DebounceType[]
	createdBy: string
}

/**
 * Alert debounce state for tracking
 */
interface AlertDebounceState {
	debounceType: DebounceType
	destinationId: string
	organizationId: string
	windowStart: Date
	alertCount: number
	lastAlertAt: Date
	cooldownUntil: Date
	suppressedUntil?: Date
	escalationLevel: number
	nextEscalationAt?: Date
}

/**
 * Alert rate limiting and debouncing manager
 */
export class AlertDebouncer {
	private readonly debounceStates = new Map<string, AlertDebounceState>()
	private readonly maintenanceWindows = new Map<string, MaintenanceWindow>()
	private readonly defaultConfigs: Record<DebounceType, DebounceConfig> = {
		failure_rate: {
			windowMinutes: 15,
			cooldownMinutes: 60,
			maxAlertsPerWindow: 3,
			escalationDelayMinutes: 60,
		},
		consecutive_failures: {
			windowMinutes: 10,
			cooldownMinutes: 30,
			maxAlertsPerWindow: 2,
			escalationDelayMinutes: 30,
		},
		queue_backlog: {
			windowMinutes: 30,
			cooldownMinutes: 120,
			maxAlertsPerWindow: 2,
			escalationDelayMinutes: 120,
		},
		response_time: {
			windowMinutes: 20,
			cooldownMinutes: 90,
			maxAlertsPerWindow: 3,
			escalationDelayMinutes: 90,
		},
	}

	private readonly defaultEscalation: EscalationConfig = {
		levels: [
			{
				delayMinutes: 0,
				severity: 'LOW',
				channels: ['email'],
			},
			{
				delayMinutes: 60,
				severity: 'MEDIUM',
				channels: ['email', 'slack'],
			},
			{
				delayMinutes: 240,
				severity: 'HIGH',
				channels: ['email', 'slack', 'pagerduty'],
			},
			{
				delayMinutes: 1440, // 24 hours
				severity: 'CRITICAL',
				channels: ['email', 'slack', 'pagerduty', 'phone'],
			},
		],
	}

	/**
	 * Check if an alert should be sent based on debouncing rules
	 * Requirements 7.4, 7.5: Time-based debouncing and cooldown periods
	 */
	shouldSendAlert(
		debounceType: DebounceType,
		destinationId: string,
		organizationId: string,
		customConfig?: Partial<DebounceConfig>
	): boolean {
		const debounceKey = this.getDebounceKey(debounceType, destinationId, organizationId)
		const config = { ...this.defaultConfigs[debounceType], ...customConfig }
		const now = new Date()

		// Check if we're in a maintenance window
		if (this.isInMaintenanceWindow(organizationId, destinationId, debounceType)) {
			return false
		}

		// Get or create debounce state
		let state = this.debounceStates.get(debounceKey)

		if (!state) {
			// First alert for this combination - allow it immediately
			state = {
				debounceType,
				destinationId,
				organizationId,
				windowStart: now,
				alertCount: 1, // Count this alert
				lastAlertAt: now,
				cooldownUntil: new Date(now.getTime() + config.cooldownMinutes * 60 * 1000),
				escalationLevel: 0,
			}
			this.debounceStates.set(debounceKey, state)

			// Schedule escalation if needed
			if (this.defaultEscalation.levels.length > 1) {
				const nextLevel = this.defaultEscalation.levels[1]
				state.nextEscalationAt = new Date(now.getTime() + nextLevel.delayMinutes * 60 * 1000)
			}

			return true // Allow first alert
		}

		// Check if we're in cooldown period
		if (now < state.cooldownUntil) {
			return false
		}

		// Check if we're in suppression period
		if (state.suppressedUntil && now < state.suppressedUntil) {
			return false
		}

		// Check if we need to reset the window
		const windowEnd = new Date(state.windowStart.getTime() + config.windowMinutes * 60 * 1000)
		if (now > windowEnd) {
			// Reset window
			state.windowStart = now
			state.alertCount = 0
		}

		// Check if we've exceeded the rate limit for this window
		if (state.alertCount >= config.maxAlertsPerWindow) {
			// Suppress alerts for the remainder of the window
			state.suppressedUntil = windowEnd
			return false
		}

		// Alert can be sent
		state.alertCount++
		state.lastAlertAt = now
		state.cooldownUntil = new Date(now.getTime() + config.cooldownMinutes * 60 * 1000)

		// Schedule escalation if needed
		if (state.escalationLevel < this.defaultEscalation.levels.length - 1) {
			const nextLevel = this.defaultEscalation.levels[state.escalationLevel + 1]
			const currentLevel = this.defaultEscalation.levels[state.escalationLevel]
			const relativeDelay = nextLevel.delayMinutes - currentLevel.delayMinutes
			state.nextEscalationAt = new Date(now.getTime() + relativeDelay * 60 * 1000)
		}

		return true
	}

	/**
	 * Check if an alert should be escalated
	 * Requirements 7.4, 7.5: Alert escalation with progressive timing
	 */
	shouldEscalateAlert(
		debounceType: DebounceType,
		destinationId: string,
		organizationId: string
	): { shouldEscalate: boolean; newSeverity?: AlertSeverity; channels?: string[] } {
		const debounceKey = this.getDebounceKey(debounceType, destinationId, organizationId)
		const state = this.debounceStates.get(debounceKey)

		if (!state || !state.nextEscalationAt) {
			return { shouldEscalate: false }
		}

		const now = new Date()

		if (
			now >= state.nextEscalationAt &&
			state.escalationLevel < this.defaultEscalation.levels.length - 1
		) {
			state.escalationLevel++
			const newLevel = this.defaultEscalation.levels[state.escalationLevel]

			// Schedule next escalation if available
			if (state.escalationLevel < this.defaultEscalation.levels.length - 1) {
				const nextLevel = this.defaultEscalation.levels[state.escalationLevel + 1]
				const currentLevel = this.defaultEscalation.levels[state.escalationLevel]
				const relativeDelay = nextLevel.delayMinutes - currentLevel.delayMinutes
				state.nextEscalationAt = new Date(now.getTime() + relativeDelay * 60 * 1000)
			} else {
				state.nextEscalationAt = undefined
			}

			return {
				shouldEscalate: true,
				newSeverity: newLevel.severity,
				channels: newLevel.channels,
			}
		}

		return { shouldEscalate: false }
	}

	/**
	 * Reset debounce state when alert is resolved
	 * Requirements 7.4, 7.5: Alert resolution and state cleanup
	 */
	resetDebounceState(
		debounceType: DebounceType,
		destinationId: string,
		organizationId: string
	): void {
		const debounceKey = this.getDebounceKey(debounceType, destinationId, organizationId)
		this.debounceStates.delete(debounceKey)
	}

	/**
	 * Add maintenance window for alert suppression
	 * Requirements 7.4, 7.5: Alert suppression during maintenance windows
	 */
	addMaintenanceWindow(window: MaintenanceWindow): void {
		this.maintenanceWindows.set(window.id, window)
	}

	/**
	 * Remove maintenance window
	 */
	removeMaintenanceWindow(windowId: string): void {
		this.maintenanceWindows.delete(windowId)
	}

	/**
	 * Get active maintenance windows for organization
	 */
	getActiveMaintenanceWindows(organizationId: string): MaintenanceWindow[] {
		const now = new Date()

		return Array.from(this.maintenanceWindows.values()).filter((window) => {
			if (window.organizationId !== organizationId) {
				return false
			}

			const startTime = new Date(window.startTime)
			const endTime = new Date(window.endTime)

			return now >= startTime && now <= endTime
		})
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
		const debounceKey = this.getDebounceKey(debounceType, destinationId, organizationId)
		const state = this.debounceStates.get(debounceKey)

		if (state) {
			const now = new Date()
			state.suppressedUntil = new Date(now.getTime() + suppressionMinutes * 60 * 1000)
		}
	}

	/**
	 * Get debounce statistics for monitoring
	 */
	getDebounceStats(): {
		activeStates: number
		suppressedAlerts: number
		activeMaintenanceWindows: number
	} {
		const now = new Date()
		let suppressedCount = 0

		for (const state of this.debounceStates.values()) {
			if ((state.suppressedUntil && now < state.suppressedUntil) || now < state.cooldownUntil) {
				suppressedCount++
			}
		}

		const activeMaintenanceCount = Array.from(this.maintenanceWindows.values()).filter((window) => {
			const startTime = new Date(window.startTime)
			const endTime = new Date(window.endTime)
			return now >= startTime && now <= endTime
		}).length

		return {
			activeStates: this.debounceStates.size,
			suppressedAlerts: suppressedCount,
			activeMaintenanceWindows: activeMaintenanceCount,
		}
	}

	/**
	 * Cleanup expired debounce states and maintenance windows
	 */
	cleanup(): void {
		const now = new Date()
		const expiredKeys: string[] = []

		// Clean up expired debounce states
		for (const [key, state] of this.debounceStates.entries()) {
			const windowEnd = new Date(state.windowStart.getTime() + 24 * 60 * 60 * 1000) // 24 hours

			if (
				now > windowEnd &&
				now > state.cooldownUntil &&
				(!state.suppressedUntil || now > state.suppressedUntil)
			) {
				expiredKeys.push(key)
			}
		}

		for (const key of expiredKeys) {
			this.debounceStates.delete(key)
		}

		// Clean up expired maintenance windows
		const expiredWindowIds: string[] = []

		for (const [id, window] of this.maintenanceWindows.entries()) {
			const endTime = new Date(window.endTime)
			if (now > endTime) {
				expiredWindowIds.push(id)
			}
		}

		for (const id of expiredWindowIds) {
			this.maintenanceWindows.delete(id)
		}
	}

	/**
	 * Check if currently in maintenance window
	 */
	private isInMaintenanceWindow(
		organizationId: string,
		destinationId: string,
		debounceType: DebounceType
	): boolean {
		const now = new Date()

		for (const window of this.maintenanceWindows.values()) {
			if (window.organizationId !== organizationId) {
				continue
			}

			// Check if destination-specific window applies
			if (window.destinationId && window.destinationId !== destinationId) {
				continue
			}

			// Check if alert type is suppressed
			if (!window.suppressDebounceTypes.includes(debounceType)) {
				continue
			}

			// Check if we're in the time window
			const startTime = new Date(window.startTime)
			const endTime = new Date(window.endTime)

			if (now >= startTime && now <= endTime) {
				return true
			}
		}

		return false
	}

	/**
	 * Generate debounce key for state tracking
	 */
	private getDebounceKey(
		debounceType: DebounceType,
		destinationId: string,
		organizationId: string
	): string {
		return `${debounceType}-${destinationId}-${organizationId}`
	}
}

/**
 * Factory function for creating alert debouncer
 */
export function createAlertDebouncer(): AlertDebouncer {
	return new AlertDebouncer()
}
