import type { AlertSeverity, AlertStatus } from '@/components/alerts/types'
import type { Alert } from '@/lib/collections'

/**
 * Utility functions for screen reader accessibility in alert components
 */

/**
 * Generate descriptive text for alert elements
 */
export const generateAlertAriaLabel = {
	/**
	 * Generate ARIA label for alert status
	 */
	alertStatus: (alert: Alert) => {
		const severityText =
			alert.severity === 'CRITICAL' ? 'critical priority' : `${alert.severity} priority`
		const statusText = alert.status === 'active' ? 'requires attention' : alert.status
		const timeText = formatDateForScreenReader(new Date(alert.created_at), { relative: true })

		return `${severityText} alert: ${alert.title}, status: ${statusText}, created ${timeText}`
	},

	/**
	 * Generate ARIA label for alert actions
	 */
	alertAction: (action: string, alert: Alert) => {
		const actionDescriptions = {
			acknowledge: 'acknowledge and mark as seen',
			resolve: 'resolve and close',
			dismiss: 'dismiss and hide',
			view: 'view details',
		}

		const description = actionDescriptions[action as keyof typeof actionDescriptions] || action
		return `${description} ${alert.severity} alert: ${alert.title}`
	},

	/**
	 * Generate ARIA label for alert filters
	 */
	alertFilter: (filterType: string, value: string | string[], count?: number) => {
		const countText = count !== undefined ? ` (${count} alerts)` : ''

		if (Array.isArray(value)) {
			return `Filter by ${filterType}: ${value.join(', ')}${countText}`
		}

		return `Filter by ${filterType}: ${value}${countText}`
	},

	/**
	 * Generate ARIA label for alert statistics
	 */
	alertStatistic: (
		label: string,
		value: number,
		trend?: { direction: 'up' | 'down'; percentage: number }
	) => {
		const trendText = trend
			? `, ${trend.direction === 'up' ? 'increased' : 'decreased'} by ${trend.percentage}% from previous period`
			: ''

		return `${label}: ${value}${trendText}`
	},

	/**
	 * Generate ARIA label for alert severity badge
	 */
	severityBadge: (severity: AlertSeverity) => {
		const descriptions = {
			CRITICAL: 'Critical severity - immediate attention required',
			HIGH: 'High severity - urgent attention needed',
			MEDIUM: 'Medium severity - attention needed',
			LOW: 'Low severity - informational',
			INFO: 'Informational - no action required',
		}

		return descriptions[severity] || `${severity} severity`
	},

	/**
	 * Generate ARIA label for alert status badge
	 */
	statusBadge: (status: AlertStatus) => {
		const descriptions = {
			active: 'Active - requires attention',
			acknowledged: 'Acknowledged - being handled',
			resolved: 'Resolved - issue fixed',
			dismissed: 'Dismissed - no action needed',
		}

		return descriptions[status] || `Status: ${status}`
	},
}

/**
 * Common ARIA descriptions for alert interface elements
 */
export const ALERT_ARIA_DESCRIPTIONS = {
	ALERT_DASHBOARD: 'Alert management dashboard showing system alerts and their status',
	ALERT_LIST: 'List of system alerts with filtering and sorting options',
	ALERT_BOARD: 'Kanban-style board showing alerts organized by status',
	ALERT_STATISTICS: 'Statistical overview of alert metrics and trends',
	ALERT_FILTERS: 'Controls for filtering alerts by severity, status, and other criteria',
	ALERT_ACTIONS: 'Actions available for managing selected alerts',
	ALERT_SEARCH: 'Search alerts by title, description, or source',
	ALERT_NOTIFICATIONS: 'Real-time notifications for new and updated alerts',
	BULK_ACTIONS: 'Actions that can be performed on multiple selected alerts',
	ALERT_DETAILS: 'Detailed information about the selected alert including history and metadata',
} as const

/**
 * Generate ARIA describedby IDs for alert form fields
 */
export function generateAlertDescribedByIds(
	fieldName: string,
	options: {
		hasError?: boolean
		hasHelp?: boolean
		hasHint?: boolean
		hasValidation?: boolean
	} = {}
) {
	const ids = []

	if (options.hasError) {
		ids.push(`alert-${fieldName}-error`)
	}

	if (options.hasHelp) {
		ids.push(`alert-${fieldName}-help`)
	}

	if (options.hasHint) {
		ids.push(`alert-${fieldName}-hint`)
	}

	if (options.hasValidation) {
		ids.push(`alert-${fieldName}-validation`)
	}

	return ids.length > 0 ? ids.join(' ') : undefined
}

/**
 * Create ARIA attributes for alert expandable content
 */
export function createAlertExpandableAttributes(
	isExpanded: boolean,
	alertId: string,
	contentType: 'details' | 'actions' | 'metadata' = 'details'
) {
	const contentId = `alert-${alertId}-${contentType}`
	const triggerId = `alert-${alertId}-${contentType}-trigger`

	return {
		trigger: {
			id: triggerId,
			'aria-expanded': isExpanded,
			'aria-controls': contentId,
		},
		content: {
			id: contentId,
			'aria-labelledby': triggerId,
			role: 'region',
		},
	}
}

/**
 * Create ARIA attributes for alert modal dialogs
 */
export function createAlertModalAttributes(
	alertId: string,
	modalType: 'details' | 'actions' | 'confirmation' = 'details'
) {
	const titleId = `alert-${alertId}-${modalType}-title`
	const descriptionId = `alert-${alertId}-${modalType}-description`

	return {
		modal: {
			role: 'dialog',
			'aria-modal': true,
			'aria-labelledby': titleId,
			'aria-describedby': descriptionId,
		},
		title: {
			id: titleId,
		},
		description: {
			id: descriptionId,
		},
	}
}

/**
 * Create ARIA attributes for alert data tables
 */
export function createAlertTableAttributes(
	sortColumn?: string,
	sortDirection?: 'asc' | 'desc',
	totalAlerts?: number
) {
	const caption = totalAlerts ? `Alert table with ${totalAlerts} alerts` : 'Alert table'

	return {
		table: {
			role: 'table',
			'aria-label': caption,
			...(sortColumn && {
				'aria-sort': sortDirection || 'none',
			}),
		},
		caption: {
			children: caption,
		},
	}
}

/**
 * Format alert timestamps for screen readers
 */
export function formatAlertTimeForScreenReader(
	timestamp: Date | string,
	options: {
		includeTime?: boolean
		relative?: boolean
		context?: 'created' | 'updated' | 'resolved' | 'acknowledged'
	} = {}
) {
	const { includeTime = true, relative = true, context = 'created' } = options
	const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp

	if (relative) {
		const now = new Date()
		const diffMs = now.getTime() - date.getTime()
		const diffMinutes = Math.floor(diffMs / (1000 * 60))
		const diffHours = Math.floor(diffMinutes / 60)
		const diffDays = Math.floor(diffHours / 24)

		let relativeText = ''
		if (diffMinutes < 1) {
			relativeText = 'just now'
		} else if (diffMinutes < 60) {
			relativeText = `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
		} else if (diffHours < 24) {
			relativeText = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
		} else if (diffDays < 7) {
			relativeText = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
		} else {
			relativeText = date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			})
		}

		return `${context} ${relativeText}`
	}

	const dateOptions: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	}

	if (includeTime) {
		dateOptions.hour = 'numeric'
		dateOptions.minute = '2-digit'
	}

	const formattedDate = date.toLocaleDateString('en-US', dateOptions)
	return `${context} on ${formattedDate}`
}

/**
 * Format alert counts for screen readers
 */
export function formatAlertCountForScreenReader(
	count: number,
	type?: 'total' | 'critical' | 'high' | 'medium' | 'low' | 'active' | 'resolved'
) {
	const typeText = type ? ` ${type}` : ''
	const pluralText = count === 1 ? 'alert' : 'alerts'

	if (count === 0) {
		return `No${typeText} ${pluralText}`
	}

	return `${count}${typeText} ${pluralText}`
}

/**
 * Generate announcement text for alert state changes
 */
export function generateAlertStateChangeAnnouncement(
	alert: Alert,
	action: 'acknowledged' | 'resolved' | 'dismissed' | 'created' | 'updated',
	user?: string
) {
	const userText = user ? ` by ${user}` : ''
	const alertText = `${alert.severity} alert "${alert.title}"`

	const actionTexts = {
		acknowledged: `${alertText} has been acknowledged${userText}`,
		resolved: `${alertText} has been resolved${userText}`,
		dismissed: `${alertText} has been dismissed${userText}`,
		created: `New ${alertText} has been created`,
		updated: `${alertText} has been updated`,
	}

	return actionTexts[action]
}

/**
 * Format dates for screen readers (reused from compliance utils)
 */
function formatDateForScreenReader(
	date: Date | string,
	options: {
		includeTime?: boolean
		relative?: boolean
	} = {}
) {
	const { includeTime = false, relative = false } = options
	const dateObj = typeof date === 'string' ? new Date(date) : date

	if (relative) {
		const now = new Date()
		const diffMs = now.getTime() - dateObj.getTime()
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

		if (diffDays === 0) {
			return includeTime
				? `today at ${dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
				: 'today'
		} else if (diffDays === 1) {
			return includeTime
				? `yesterday at ${dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
				: 'yesterday'
		} else if (diffDays < 7) {
			return `${diffDays} days ago`
		}
	}

	const dateOptions: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	}

	if (includeTime) {
		dateOptions.hour = 'numeric'
		dateOptions.minute = '2-digit'
	}

	return dateObj.toLocaleDateString('en-US', dateOptions)
}
