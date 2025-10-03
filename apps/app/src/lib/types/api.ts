import { z } from 'zod'

import {
	AlertFiltersSchema,
	AlertSchema,
	AlertSeverity,
	AlertSeveritySchema,
	AlertStatus,
	AlertStatusSchema,
	AlertType,
	AlertTypeSchema,
	AlertUpdateSchema,
	DateRangeSchema,
	NotificationSchema,
} from './alert'

import type { Alert, AlertFilters, AlertUpdate, DateRange, Notification } from './alert'

// ============================================================================
// API Request/Response Types for Alert Operations
// ============================================================================

/**
 * Pagination parameters for alert queries
 */
export const AlertPaginationParamsSchema = z.object({
	limit: z.number().int().min(1).max(1000).default(50),
	offset: z.number().int().min(0).default(0),
	cursor: z.string().optional(),
})
export type AlertPaginationParams = z.infer<typeof AlertPaginationParamsSchema>

/**
 * Pagination metadata for alert responses
 */
export const AlertPaginationMetadataSchema = z.object({
	total: z.number().int().min(0),
	limit: z.number().int().min(1),
	offset: z.number().int().min(0),
	hasNext: z.boolean(),
	hasPrevious: z.boolean(),
	nextCursor: z.string().optional(),
	previousCursor: z.string().optional(),
})
export type AlertPaginationMetadata = z.infer<typeof AlertPaginationMetadataSchema>

/**
 * Sort parameters for alert queries
 */
export const AlertSortParamsSchema = z.object({
	field: z.enum(['timestamp', 'severity', 'status', 'type', 'source', 'title']),
	direction: z.enum(['asc', 'desc']).default('desc'),
})
export type AlertSortParams = z.infer<typeof AlertSortParamsSchema>

/**
 * Query parameters for fetching alerts
 */
export const QueryAlertsParamsSchema = z.object({
	filters: AlertFiltersSchema.optional(),
	pagination: AlertPaginationParamsSchema.optional(),
	sort: AlertSortParamsSchema.optional(),
	includeResolved: z.boolean().default(false),
	includeDismissed: z.boolean().default(false),
})
export type QueryAlertsParams = z.infer<typeof QueryAlertsParamsSchema>

/**
 * Paginated alerts response
 */
export const PaginatedAlertsSchema = z.object({
	alerts: z.array(AlertSchema),
	pagination: AlertPaginationMetadataSchema,
	metadata: z
		.object({
			queryTime: z.number().min(0),
			cacheHit: z.boolean(),
			totalFiltered: z.number().int().min(0),
			appliedFilters: z.array(z.string()).optional(),
		})
		.optional(),
})
export type PaginatedAlerts = z.infer<typeof PaginatedAlertsSchema>

/**
 * Create alert input
 */
export const CreateAlertInputSchema = z.object({
	title: z
		.string()
		.min(1, 'Alert title is required')
		.max(200, 'Title must be less than 200 characters'),
	description: z.string().min(1, 'Alert description is required'),
	severity: AlertSeveritySchema,
	type: AlertTypeSchema,
	source: z.string().min(1, 'Alert source is required'),
	metadata: z.record(z.string(), z.any()).default({}),
	tags: z.array(z.string()).default([]),
})
export type CreateAlertInput = z.infer<typeof CreateAlertInputSchema>

/**
 * Update alert status input
 */
export const UpdateAlertStatusInputSchema = z.object({
	status: AlertStatusSchema,
	notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
	userId: z.string().min(1, 'User ID is required'),
})
export type UpdateAlertStatusInput = z.infer<typeof UpdateAlertStatusInputSchema>

/**
 * Bulk alert operation input
 */
export const BulkAlertOperationInputSchema = z.object({
	alertIds: z
		.array(z.string().min(1))
		.min(1, 'At least one alert ID is required')
		.max(100, 'Maximum 100 alerts per operation'),
	operation: z.enum(['acknowledge', 'resolve', 'dismiss']),
	notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
	userId: z.string().min(1, 'User ID is required'),
})
export type BulkAlertOperationInput = z.infer<typeof BulkAlertOperationInputSchema>

/**
 * Bulk operation result item
 */
export const BulkAlertResultItemSchema = z.object({
	alertId: z.string(),
	success: z.boolean(),
	error: z.string().optional(),
	updatedAlert: AlertSchema.optional(),
})
export type BulkAlertResultItem = z.infer<typeof BulkAlertResultItemSchema>

/**
 * Bulk operation result
 */
export const BulkAlertOperationResultSchema = z.object({
	requestId: z.string(),
	total: z.number().int().min(0),
	successful: z.number().int().min(0),
	failed: z.number().int().min(0),
	results: z.array(BulkAlertResultItemSchema),
	processingTime: z.number().min(0),
})
export type BulkAlertOperationResult = z.infer<typeof BulkAlertOperationResultSchema>

// ============================================================================
// Notification API Types
// ============================================================================

/**
 * Query parameters for fetching notifications
 */
export const QueryNotificationsParamsSchema = z.object({
	unreadOnly: z.boolean().default(false),
	limit: z.number().int().min(1).max(100).default(20),
	offset: z.number().int().min(0).default(0),
	severity: z.array(AlertSeveritySchema).optional(),
})
export type QueryNotificationsParams = z.infer<typeof QueryNotificationsParamsSchema>

/**
 * Paginated notifications response
 */
export const PaginatedNotificationsSchema = z.object({
	notifications: z.array(NotificationSchema),
	pagination: AlertPaginationMetadataSchema,
	unreadCount: z.number().int().min(0),
})
export type PaginatedNotifications = z.infer<typeof PaginatedNotificationsSchema>

/**
 * Mark notification as read input
 */
export const MarkNotificationReadInputSchema = z.object({
	notificationIds: z.array(z.string().min(1)).min(1, 'At least one notification ID is required'),
})
export type MarkNotificationReadInput = z.infer<typeof MarkNotificationReadInputSchema>

/**
 * Notification preferences
 */
export const NotificationPreferencesSchema = z.object({
	emailEnabled: z.boolean().default(true),
	pushEnabled: z.boolean().default(true),
	severityThreshold: AlertSeveritySchema.default(AlertSeverity.MEDIUM),
	quietHours: z
		.object({
			enabled: z.boolean().default(false),
			startTime: z
				.string()
				.regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
			endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
			timezone: z.string().default('UTC'),
		})
		.optional(),
	categories: z.array(AlertTypeSchema).default([]),
})
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>

// ============================================================================
// WebSocket Real-time Update Types
// ============================================================================

/**
 * WebSocket message types for real-time updates
 */
export const WebSocketMessageTypeSchema = z.enum([
	'alert_created',
	'alert_updated',
	'alert_deleted',
	'notification_created',
	'notification_updated',
	'connection_established',
	'connection_error',
	'heartbeat',
	'subscription_confirmed',
	'subscription_error',
])
export type WebSocketMessageType = z.infer<typeof WebSocketMessageTypeSchema>

/**
 * WebSocket alert update message
 */
export const AlertUpdateMessageSchema = z.object({
	type: z.enum(['alert_created', 'alert_updated', 'alert_deleted']),
	timestamp: z.string().datetime(),
	alert: AlertSchema,
	previousState: AlertSchema.optional(),
	userId: z.string().optional(),
})
export type AlertUpdateMessage = z.infer<typeof AlertUpdateMessageSchema>

/**
 * WebSocket notification message
 */
export const NotificationUpdateMessageSchema = z.object({
	type: z.enum(['notification_created', 'notification_updated']),
	timestamp: z.string().datetime(),
	notification: NotificationSchema,
})
export type NotificationUpdateMessage = z.infer<typeof NotificationUpdateMessageSchema>

/**
 * WebSocket connection message
 */
export const ConnectionMessageSchema = z.object({
	type: z.enum(['connection_established', 'connection_error', 'heartbeat']),
	timestamp: z.string().datetime(),
	message: z.string().optional(),
	connectionId: z.string().optional(),
})
export type ConnectionMessage = z.infer<typeof ConnectionMessageSchema>

/**
 * WebSocket subscription message
 */
export const SubscriptionMessageSchema = z.object({
	type: z.enum(['subscription_confirmed', 'subscription_error']),
	timestamp: z.string().datetime(),
	subscriptionId: z.string(),
	filters: AlertFiltersSchema.optional(),
	error: z.string().optional(),
})
export type SubscriptionMessage = z.infer<typeof SubscriptionMessageSchema>

/**
 * Generic WebSocket message
 */
export const WebSocketMessageSchema = z.discriminatedUnion('type', [
	AlertUpdateMessageSchema,
	NotificationUpdateMessageSchema,
	ConnectionMessageSchema,
	SubscriptionMessageSchema,
])
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>

/**
 * WebSocket subscription parameters
 */
export const WebSocketSubscriptionParamsSchema = z.object({
	filters: AlertFiltersSchema.optional(),
	includeNotifications: z.boolean().default(true),
	includeAlerts: z.boolean().default(true),
	heartbeatInterval: z.number().int().min(5000).max(300000).default(30000),
	reconnectAttempts: z.number().int().min(0).max(10).default(5),
	reconnectDelay: z.number().int().min(1000).max(60000).default(5000),
})
export type WebSocketSubscriptionParams = z.infer<typeof WebSocketSubscriptionParamsSchema>

// ============================================================================
// Error Handling Types
// ============================================================================

/**
 * Alert API error codes
 */
export const AlertApiErrorCodeSchema = z.enum([
	'ALERT_NOT_FOUND',
	'ALERT_ALREADY_RESOLVED',
	'ALERT_ALREADY_DISMISSED',
	'INVALID_ALERT_STATUS_TRANSITION',
	'INSUFFICIENT_PERMISSIONS',
	'VALIDATION_ERROR',
	'RATE_LIMIT_EXCEEDED',
	'INTERNAL_SERVER_ERROR',
	'SERVICE_UNAVAILABLE',
	'WEBSOCKET_CONNECTION_FAILED',
	'WEBSOCKET_SUBSCRIPTION_FAILED',
])
export type AlertApiErrorCode = z.infer<typeof AlertApiErrorCodeSchema>

/**
 * Alert API error response
 */
export const AlertApiErrorSchema = z.object({
	code: AlertApiErrorCodeSchema,
	message: z.string().min(1),
	details: z.record(z.string(), z.unknown()).optional(),
	correlationId: z.string().optional(),
	timestamp: z.string().datetime(),
	path: z.string().optional(),
	method: z.string().optional(),
	alertId: z.string().optional(),
})
export type AlertApiError = z.infer<typeof AlertApiErrorSchema>

/**
 * Alert validation error details
 */
export const AlertValidationErrorDetailSchema = z.object({
	field: z.string().min(1),
	message: z.string().min(1),
	code: z.string().min(1),
	value: z.unknown().optional(),
	constraint: z.string().optional(),
})
export type AlertValidationErrorDetail = z.infer<typeof AlertValidationErrorDetailSchema>

/**
 * Alert validation error response
 */
export const AlertValidationErrorResponseSchema = z.object({
	code: z.literal('VALIDATION_ERROR'),
	message: z.string().min(1),
	errors: z.array(AlertValidationErrorDetailSchema),
	correlationId: z.string().optional(),
	timestamp: z.string().datetime(),
})
export type AlertValidationErrorResponse = z.infer<typeof AlertValidationErrorResponseSchema>

/**
 * WebSocket error types
 */
export const WebSocketErrorSchema = z.object({
	type: z.enum(['connection_error', 'subscription_error', 'message_error', 'authentication_error']),
	message: z.string().min(1),
	code: z.string().optional(),
	timestamp: z.string().datetime(),
	reconnectable: z.boolean().default(true),
	retryAfter: z.number().int().min(0).optional(),
})
export type WebSocketError = z.infer<typeof WebSocketErrorSchema>

// ============================================================================
// Statistics and Analytics Types
// ============================================================================

/**
 * Alert statistics time grouping
 */
export const AlertTimeGroupingSchema = z.enum(['hour', 'day', 'week', 'month'])
export type AlertTimeGrouping = z.infer<typeof AlertTimeGroupingSchema>

/**
 * Alert statistics parameters
 */
export const AlertStatisticsParamsSchema = z.object({
	dateRange: DateRangeSchema,
	groupBy: AlertTimeGroupingSchema.optional(),
	filters: AlertFiltersSchema.optional(),
	includeTimeline: z.boolean().default(false),
	includeBreakdown: z.boolean().default(true),
})
export type AlertStatisticsParams = z.infer<typeof AlertStatisticsParamsSchema>

/**
 * Alert timeline data point
 */
export const AlertTimelineDataPointSchema = z.object({
	timestamp: z.string().datetime(),
	count: z.number().int().min(0),
	breakdown: z.record(z.string(), z.number().int().min(0)).optional(),
})
export type AlertTimelineDataPoint = z.infer<typeof AlertTimelineDataPointSchema>

/**
 * Alert statistics response
 */
export const AlertStatisticsSchema = z.object({
	totalAlerts: z.number().int().min(0),
	alertsBySeverity: z.record(z.string(), z.number().int().min(0)),
	alertsByStatus: z.record(z.string(), z.number().int().min(0)),
	alertsByType: z.record(z.string(), z.number().int().min(0)),
	alertsBySource: z.record(z.string(), z.number().int().min(0)),
	timeline: z.array(AlertTimelineDataPointSchema).optional(),
	averageResolutionTime: z.number().min(0).optional(),
	metadata: z
		.object({
			queryTime: z.number().min(0),
			cacheHit: z.boolean(),
			dataFreshness: z.string().datetime(),
		})
		.optional(),
})
export type AlertStatistics = z.infer<typeof AlertStatisticsSchema>

// ============================================================================
// Generic Response Wrappers
// ============================================================================

/**
 * Success response wrapper for alert operations
 */
export const AlertSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
	z.object({
		success: z.literal(true),
		data: dataSchema,
		metadata: z
			.object({
				timestamp: z.string().datetime(),
				correlationId: z.string().optional(),
				version: z.string().optional(),
				requestId: z.string().optional(),
			})
			.optional(),
	})

/**
 * Error response wrapper for alert operations
 */
export const AlertErrorResponseSchema = z.object({
	success: z.literal(false),
	error: AlertApiErrorSchema,
	metadata: z
		.object({
			timestamp: z.string().datetime(),
			correlationId: z.string().optional(),
			version: z.string().optional(),
			requestId: z.string().optional(),
		})
		.optional(),
})

/**
 * Generic alert API response
 */
export const AlertApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
	z.union([AlertSuccessResponseSchema(dataSchema), AlertErrorResponseSchema])

// ============================================================================
// Type Guards and Validation Utilities
// ============================================================================

/**
 * Type guard for alert API errors
 */
export const isAlertApiError = (value: unknown): value is AlertApiError => {
	return AlertApiErrorSchema.safeParse(value).success
}

/**
 * Type guard for alert validation errors
 */
export const isAlertValidationErrorResponse = (
	value: unknown
): value is AlertValidationErrorResponse => {
	return AlertValidationErrorResponseSchema.safeParse(value).success
}

/**
 * Type guard for WebSocket messages
 */
export const isWebSocketMessage = (value: unknown): value is WebSocketMessage => {
	return WebSocketMessageSchema.safeParse(value).success
}

/**
 * Type guard for WebSocket errors
 */
export const isWebSocketError = (value: unknown): value is WebSocketError => {
	return WebSocketErrorSchema.safeParse(value).success
}

/**
 * Type guard for paginated alerts
 */
export const isPaginatedAlerts = (value: unknown): value is PaginatedAlerts => {
	return PaginatedAlertsSchema.safeParse(value).success
}

/**
 * Type guard for paginated notifications
 */
export const isPaginatedNotifications = (value: unknown): value is PaginatedNotifications => {
	return PaginatedNotificationsSchema.safeParse(value).success
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates query alerts parameters
 */
export const validateQueryAlertsParams = (data: unknown) => {
	return QueryAlertsParamsSchema.safeParse(data)
}

/**
 * Validates create alert input
 */
export const validateCreateAlertInput = (data: unknown) => {
	return CreateAlertInputSchema.safeParse(data)
}

/**
 * Validates update alert status input
 */
export const validateUpdateAlertStatusInput = (data: unknown) => {
	return UpdateAlertStatusInputSchema.safeParse(data)
}

/**
 * Validates bulk alert operation input
 */
export const validateBulkAlertOperationInput = (data: unknown) => {
	return BulkAlertOperationInputSchema.safeParse(data)
}

/**
 * Validates query notifications parameters
 */
export const validateQueryNotificationsParams = (data: unknown) => {
	return QueryNotificationsParamsSchema.safeParse(data)
}

/**
 * Validates WebSocket subscription parameters
 */
export const validateWebSocketSubscriptionParams = (data: unknown) => {
	return WebSocketSubscriptionParamsSchema.safeParse(data)
}

/**
 * Validates alert statistics parameters
 */
export const validateAlertStatisticsParams = (data: unknown) => {
	return AlertStatisticsParamsSchema.safeParse(data)
}

/**
 * Validates notification preferences
 */
export const validateNotificationPreferences = (data: unknown) => {
	return NotificationPreferencesSchema.safeParse(data)
}
