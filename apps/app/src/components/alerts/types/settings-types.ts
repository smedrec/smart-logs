/**
 * Settings and preferences type definitions
 */

import type { AlertSeverity, AlertType } from './alert-types'

// User alert preferences
export interface AlertPreferences {
	id: string
	userId: string
	organizationId: string

	// Notification settings
	notifications: {
		enabled: boolean
		frequency: NotificationFrequency
		severityThreshold: AlertSeverity
		types: AlertType[]
		channels: NotificationChannel[]
		quietHours?: {
			enabled: boolean
			start: string // HH:mm format
			end: string // HH:mm format
			timezone: string
		}
	}

	// Display settings
	display: {
		theme: 'light' | 'dark' | 'system'
		density: 'compact' | 'comfortable' | 'spacious'
		defaultView: 'list' | 'board' | 'statistics'
		itemsPerPage: number
		showMetadata: boolean
		showTags: boolean
		autoRefresh: boolean
		refreshInterval: number // seconds
	}

	// Filter settings
	filters: {
		defaultFilters: Record<string, any>
		savedFilters: string[] // IDs of saved filters
		rememberLastFilters: boolean
	}

	// Advanced settings
	advanced: {
		enableKeyboardShortcuts: boolean
		enableSounds: boolean
		enableDesktopNotifications: boolean
		maxNotifications: number
		autoAcknowledgeResolved: boolean
	}

	createdAt: Date
	updatedAt: Date
}

// Notification frequency options
export enum NotificationFrequency {
	IMMEDIATE = 'immediate',
	EVERY_5_MINUTES = 'every_5_minutes',
	EVERY_15_MINUTES = 'every_15_minutes',
	EVERY_30_MINUTES = 'every_30_minutes',
	HOURLY = 'hourly',
	DAILY = 'daily',
	DISABLED = 'disabled',
}

// Notification channels
export enum NotificationChannel {
	IN_APP = 'in_app',
	EMAIL = 'email',
	SMS = 'sms',
	WEBHOOK = 'webhook',
	DESKTOP = 'desktop',
}

// Settings validation schema
export interface SettingsValidation {
	field: keyof AlertPreferences
	message: string
	type: 'error' | 'warning' | 'info'
}

// Settings form state
export interface SettingsFormState {
	preferences: AlertPreferences
	isDirty: boolean
	isValid: boolean
	errors: SettingsValidation[]
	isSubmitting: boolean
}

// Settings section configuration
export interface SettingsSection {
	id: string
	title: string
	description?: string
	icon?: string
	component: React.ComponentType<any>
	order: number
}

// Export settings data
export interface SettingsExport {
	version: string
	exportedAt: Date
	userId: string
	preferences: AlertPreferences
}
