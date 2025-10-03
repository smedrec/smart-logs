/**
 * Notification system type definitions
 */

import type { AlertSeverity } from './alert-types'

// Notification interface
export interface Notification {
	id: string
	alertId: string
	title: string
	message: string
	severity: AlertSeverity
	timestamp: Date
	read: boolean
	actionUrl?: string
	metadata?: Record<string, any>
}

// Notification preferences
export interface NotificationPreferences {
	enabled: boolean
	severityFilter: AlertSeverity[]
	typeFilter: string[]
	soundEnabled: boolean
	desktopEnabled: boolean
	emailEnabled: boolean
	maxNotifications: number
	autoMarkReadAfter: number // minutes
}

// Notification state for the bell component
export interface NotificationState {
	notifications: Notification[]
	unreadCount: number
	isOpen: boolean
	lastChecked: Date
}

// Notification action types
export type NotificationAction =
	| 'mark_read'
	| 'mark_unread'
	| 'dismiss'
	| 'dismiss_all'
	| 'navigate'

// Notification update payload for real-time updates
export interface NotificationUpdate {
	type: 'created' | 'updated' | 'deleted'
	notification: Notification
	timestamp: Date
}
