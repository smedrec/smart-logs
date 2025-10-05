/**
 * Alert-specific type definitions and interfaces
 * Based on the existing Alert schema from collections.ts but enhanced for UI needs
 */

// Re-export the base Alert type from collections
export type { Alert } from '@/lib/collections'

// Enhanced enums for better type safety and UI display
export enum AlertSeverity {
	CRITICAL = 'CRITICAL',
	HIGH = 'HIGH',
	MEDIUM = 'MEDIUM',
	LOW = 'LOW',
	INFO = 'INFO',
}

export enum AlertType {
	SYSTEM = 'SYSTEM',
	SECURITY = 'SECURITY',
	PERFORMANCE = 'PERFORMANCE',
	COMPLIANCE = 'COMPLIANCE',
	METRICS = 'METRICS',
	CUSTOM = 'CUSTOM',
}

export enum AlertStatus {
	ACTIVE = 'active',
	ACKNOWLEDGED = 'acknowledged',
	RESOLVED = 'resolved',
	DISMISSED = 'dismissed',
}

// UI-specific alert interface that extends the base Alert
export interface AlertUI {
	id: string
	title: string
	description?: string
	severity: AlertSeverity
	type: AlertType
	status: AlertStatus
	source: string
	createdAt: Date
	acknowledgedAt?: Date
	acknowledgedBy?: string
	resolvedAt?: Date
	resolvedBy?: string
	resolutionNotes?: string
	metadata: Record<string, any>
	tags: string[]
	correlationId?: string
}

// Alert display options for different views
export interface AlertDisplayOptions {
	showMetadata?: boolean
	showTags?: boolean
	showTimestamp?: boolean
	showActions?: boolean
	compact?: boolean
}

// Alert action types
export type AlertAction = 'acknowledge' | 'resolve' | 'dismiss' | 'view'

// Alert bulk action interface
export interface AlertBulkAction {
	type: AlertAction
	alertIds: string[]
	notes?: string
	userId?: string
}

// Alert history entry
export interface AlertHistoryEntry {
	id: string
	alertId: string
	action: AlertAction
	userId: string
	userName: string
	timestamp: Date
	notes?: string
	previousStatus?: AlertStatus
	newStatus?: AlertStatus
}

// Alert statistics interface
export interface AlertStatistics {
	total: number
	active: number
	acknowledged: number
	resolved: number
	dismissed: number
	bySeverity: Record<AlertSeverity, number>
	byType: Record<AlertType, number>
	bySource: Record<string, number>
	trends: {
		period: string
		created: number
		resolved: number
	}[]
}
