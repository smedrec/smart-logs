import { z } from 'zod'

/**
 * Alert severity levels indicating the urgency and impact of an alert
 */
export enum AlertSeverity {
	CRITICAL = 'critical',
	HIGH = 'high',
	MEDIUM = 'medium',
	LOW = 'low',
	INFO = 'info',
}

/**
 * Alert types categorizing the nature of the alert
 */
export enum AlertType {
	SYSTEM = 'system',
	SECURITY = 'security',
	PERFORMANCE = 'performance',
	COMPLIANCE = 'compliance',
	CUSTOM = 'custom',
}

/**
 * Alert status indicating the current state of the alert
 */
export enum AlertStatus {
	ACTIVE = 'active',
	ACKNOWLEDGED = 'acknowledged',
	RESOLVED = 'resolved',
	DISMISSED = 'dismissed',
}

/**
 * Zod schema for AlertSeverity enum validation
 */
export const AlertSeveritySchema = z.nativeEnum(AlertSeverity)

/**
 * Zod schema for AlertType enum validation
 */
export const AlertTypeSchema = z.nativeEnum(AlertType)

/**
 * Zod schema for AlertStatus enum validation
 */
export const AlertStatusSchema = z.nativeEnum(AlertStatus)

/**
 * Core Alert interface representing a system alert
 */
export interface Alert {
	/** Unique identifier for the alert */
	id: string
	/** Human-readable title of the alert */
	title: string
	/** Detailed description of the alert */
	description: string
	/** Severity level of the alert */
	severity: AlertSeverity
	/** Type/category of the alert */
	type: AlertType
	/** Current status of the alert */
	status: AlertStatus
	/** Source system or component that generated the alert */
	source: string
	/** Timestamp when the alert was created */
	timestamp: Date
	/** Timestamp when the alert was acknowledged (if applicable) */
	acknowledgedAt?: Date
	/** User who acknowledged the alert */
	acknowledgedBy?: string
	/** Timestamp when the alert was resolved (if applicable) */
	resolvedAt?: Date
	/** User who resolved the alert */
	resolvedBy?: string
	/** Notes provided when resolving the alert */
	resolutionNotes?: string
	/** Additional metadata associated with the alert */
	metadata: Record<string, any>
	/** Tags for categorization and filtering */
	tags: string[]
}

/**
 * Zod schema for Alert validation
 */
export const AlertSchema = z.object({
	id: z.string().min(1, 'Alert ID is required'),
	title: z
		.string()
		.min(1, 'Alert title is required')
		.max(200, 'Title must be less than 200 characters'),
	description: z.string().min(1, 'Alert description is required'),
	severity: AlertSeveritySchema,
	type: AlertTypeSchema,
	status: AlertStatusSchema,
	source: z.string().min(1, 'Alert source is required'),
	timestamp: z.date(),
	acknowledgedAt: z.date().optional(),
	acknowledgedBy: z.string().optional(),
	resolvedAt: z.date().optional(),
	resolvedBy: z.string().optional(),
	resolutionNotes: z.string().optional(),
	metadata: z.record(z.string(), z.any()).default({}),
	tags: z.array(z.string()).default([]),
})

/**
 * Type derived from AlertSchema for type safety
 */
export type AlertInput = z.infer<typeof AlertSchema>

/**
 * Notification interface for alert notifications in the UI
 */
export interface Notification {
	/** Unique identifier for the notification */
	id: string
	/** ID of the associated alert */
	alertId: string
	/** Title of the notification */
	title: string
	/** Message content of the notification */
	message: string
	/** Severity level inherited from the alert */
	severity: AlertSeverity
	/** Timestamp when the notification was created */
	timestamp: Date
	/** Whether the notification has been read */
	read: boolean
	/** Optional URL to navigate to when notification is clicked */
	actionUrl?: string
}

/**
 * Zod schema for Notification validation
 */
export const NotificationSchema = z.object({
	id: z.string().min(1, 'Notification ID is required'),
	alertId: z.string().min(1, 'Alert ID is required'),
	title: z
		.string()
		.min(1, 'Notification title is required')
		.max(100, 'Title must be less than 100 characters'),
	message: z
		.string()
		.min(1, 'Notification message is required')
		.max(500, 'Message must be less than 500 characters'),
	severity: AlertSeveritySchema,
	timestamp: z.date(),
	read: z.boolean().default(false),
	actionUrl: z.string().url().optional(),
})

/**
 * Type derived from NotificationSchema for type safety
 */
export type NotificationInput = z.infer<typeof NotificationSchema>

/**
 * Date range interface for filtering alerts by time period
 */
export interface DateRange {
	/** Start date of the range */
	start: Date
	/** End date of the range */
	end: Date
}

/**
 * Zod schema for DateRange validation
 */
export const DateRangeSchema = z
	.object({
		start: z.date(),
		end: z.date(),
	})
	.refine((data) => data.start <= data.end, {
		message: 'Start date must be before or equal to end date',
		path: ['end'],
	})

/**
 * Alert filters interface for filtering and searching alerts
 */
export interface AlertFilters {
	/** Filter by alert severity levels */
	severity?: AlertSeverity[]
	/** Filter by alert types */
	type?: AlertType[]
	/** Filter by alert status */
	status?: AlertStatus[]
	/** Filter by alert sources */
	source?: string[]
	/** Filter by date range */
	dateRange?: DateRange
	/** Search query for title and description */
	search?: string
	/** Filter by tags */
	tags?: string[]
}

/**
 * Zod schema for AlertFilters validation
 */
export const AlertFiltersSchema = z.object({
	severity: z.array(AlertSeveritySchema).optional(),
	type: z.array(AlertTypeSchema).optional(),
	status: z.array(AlertStatusSchema).optional(),
	source: z.array(z.string()).optional(),
	dateRange: DateRangeSchema.optional(),
	search: z.string().max(200, 'Search query must be less than 200 characters').optional(),
	tags: z.array(z.string()).optional(),
})

/**
 * Type derived from AlertFiltersSchema for type safety
 */
export type AlertFiltersInput = z.infer<typeof AlertFiltersSchema>

/**
 * Utility type for partial alert updates
 */
export type AlertUpdate = Partial<
	Pick<
		Alert,
		'status' | 'acknowledgedAt' | 'acknowledgedBy' | 'resolvedAt' | 'resolvedBy' | 'resolutionNotes'
	>
>

/**
 * Zod schema for AlertUpdate validation
 */
export const AlertUpdateSchema = z.object({
	status: AlertStatusSchema.optional(),
	acknowledgedAt: z.date().optional(),
	acknowledgedBy: z.string().optional(),
	resolvedAt: z.date().optional(),
	resolvedBy: z.string().optional(),
	resolutionNotes: z
		.string()
		.max(1000, 'Resolution notes must be less than 1000 characters')
		.optional(),
})

/**
 * Type derived from AlertUpdateSchema for type safety
 */
export type AlertUpdateInput = z.infer<typeof AlertUpdateSchema>
