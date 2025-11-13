import { z } from 'zod'

import { ValidationResultSchema } from './shared-schemas'

import type { ValidationResult } from './shared-schemas'

// ============================================================================
// Delivery Destination Types
// ============================================================================

/**
 * Delivery destination type
 */
export const DeliveryDestinationTypeSchema = z.enum([
	'email',
	'webhook',
	'storage',
	'sftp',
	'download',
])
export type DeliveryDestinationType = z.infer<typeof DeliveryDestinationTypeSchema>

/**
 * Delivery destination configuration
 */
export const DeliveryDestinationConfigSchema = z.object({
	email: z
		.object({
			service: z.string(),
			smtpConfig: z
				.object({
					host: z.string(),
					port: z.number(),
					secure: z.boolean(),
					auth: z.object({
						user: z.string(),
						pass: z.string(),
					}),
				})
				.optional(),
			apiKey: z.string().optional(),
			from: z.string(),
			subject: z.string(),
			bodyTemplate: z.string().optional(),
			attachmentName: z.string().optional(),
			recipients: z.array(z.string()).optional(),
		})
		.optional(),
	webhook: z
		.object({
			url: z.string().url(),
			method: z.enum(['POST', 'PUT']),
			headers: z.record(z.string(), z.string()),
			timeout: z.number(),
			retryConfig: z.object({
				maxRetries: z.number(),
				backoffMultiplier: z.number(),
				maxBackoffDelay: z.number(),
			}),
		})
		.optional(),
	storage: z
		.object({
			provider: z.enum(['local', 's3', 'azure', 'gcp']),
			config: z.record(z.string(), z.any()),
			path: z.string(),
			retention: z.object({
				days: z.number(),
				autoCleanup: z.boolean(),
			}),
		})
		.optional(),
	sftp: z
		.object({
			host: z.string(),
			port: z.number(),
			username: z.string().optional(),
			password: z.string().optional(),
			privateKey: z.string().optional(),
			path: z.string(),
			filename: z.string().optional(),
		})
		.optional(),
	download: z
		.object({
			baseUrl: z.string().optional(),
			expiryHours: z.number(),
			maxAccess: z.number().optional(),
			allowedIpRanges: z.array(z.string()).optional(),
		})
		.optional(),
})
export type DeliveryDestinationConfig = z.infer<typeof DeliveryDestinationConfigSchema>

/**
 * Delivery destination
 */
export const DeliveryDestinationSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	label: z.string(),
	type: DeliveryDestinationTypeSchema,
	description: z.string().optional(),
	icon: z.string().optional(),
	instructions: z.string().optional(),
	disabled: z.boolean(),
	disabledAt: z.string().optional(),
	disabledBy: z.string().optional(),
	countUsage: z.number(),
	lastUsedAt: z.string().optional(),
	config: DeliveryDestinationConfigSchema,
	createdAt: z.string(),
	updatedAt: z.string(),
})
export type DeliveryDestination = z.infer<typeof DeliveryDestinationSchema>

/**
 * Create delivery destination input
 */
export const CreateDeliveryDestinationSchema = z.object({
	organizationId: z.string(),
	label: z.string().min(1),
	type: DeliveryDestinationTypeSchema,
	description: z.string().optional(),
	icon: z.string().optional(),
	instructions: z.string().optional(),
	config: DeliveryDestinationConfigSchema,
})
export type CreateDeliveryDestination = z.infer<typeof CreateDeliveryDestinationSchema>

/**
 * Update delivery destination input
 */
export const UpdateDeliveryDestinationSchema = z.object({
	label: z.string().min(1).optional(),
	description: z.string().optional(),
	icon: z.string().optional(),
	instructions: z.string().optional(),
	config: DeliveryDestinationConfigSchema.optional(),
	disabled: z.boolean().optional(),
})
export type UpdateDeliveryDestination = z.infer<typeof UpdateDeliveryDestinationSchema>

/**
 * Delivery destination query parameters
 */
export const DeliveryDestinationQuerySchema = z.object({
	type: DeliveryDestinationTypeSchema.optional(),
	disabled: z.boolean().optional(),
	limit: z.number().int().min(1).max(1000).optional(),
	offset: z.number().int().min(0).optional(),
	sortBy: z.enum(['createdAt', 'updatedAt', 'label', 'type']).optional(),
	sortOrder: z.enum(['asc', 'desc']).optional(),
})
export type DeliveryDestinationQuery = z.infer<typeof DeliveryDestinationQuerySchema>

/**
 * Paginated delivery destinations
 */
export const PaginatedDeliveryDestinationsSchema = z.object({
	data: z.array(DeliveryDestinationSchema),
	pagination: z.object({
		total: z.number().int().min(0).optional(),
		limit: z.number().int().min(1).optional(),
		offset: z.number().int().min(0).optional(),
		hasNext: z.boolean(),
		hasPrevious: z.boolean(),
		nextCursor: z.string().optional(),
		previousCursor: z.string().optional(),
	}),
})
export type PaginatedDeliveryDestinations = z.infer<typeof PaginatedDeliveryDestinationsSchema>

// ============================================================================
// Delivery Request Types
// ============================================================================

/**
 * Delivery payload type
 */
export const DeliveryPayloadTypeSchema = z.enum(['report', 'export', 'data', 'custom'])
export type DeliveryPayloadType = z.infer<typeof DeliveryPayloadTypeSchema>

/**
 * Delivery request
 */
export const DeliveryRequestSchema = z.object({
	organizationId: z.string(),
	destinations: z.union([z.array(z.string()), z.literal('default')]),
	payload: z.object({
		type: DeliveryPayloadTypeSchema,
		data: z.any(),
		metadata: z.record(z.string(), z.any()),
	}),
	options: z
		.object({
			priority: z.number().min(0).max(10).optional(),
			idempotencyKey: z.string().optional(),
			correlationId: z.string().optional(),
			tags: z.array(z.string()).optional(),
		})
		.optional(),
})
export type DeliveryRequest = z.infer<typeof DeliveryRequestSchema>

/**
 * Delivery status
 */
export const DeliveryStatusSchema = z.enum(['queued', 'processing', 'completed', 'failed'])
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>

/**
 * Destination delivery status
 */
export const DestinationDeliveryStatusSchema = z.enum([
	'pending',
	'delivered',
	'failed',
	'retrying',
])
export type DestinationDeliveryStatus = z.infer<typeof DestinationDeliveryStatusSchema>

/**
 * Delivery response
 */
export const DeliveryResponseSchema = z.object({
	deliveryId: z.string(),
	status: DeliveryStatusSchema,
	destinations: z.array(
		z.object({
			destinationId: z.string(),
			status: DestinationDeliveryStatusSchema,
			deliveryLogId: z.string().optional(),
		})
	),
	queuedAt: z.string(),
	estimatedDeliveryTime: z.string().optional(),
})
export type DeliveryResponse = z.infer<typeof DeliveryResponseSchema>

/**
 * Delivery status response
 */
export const DeliveryStatusResponseSchema = z.object({
	deliveryId: z.string(),
	status: DeliveryStatusSchema,
	destinations: z.array(
		z.object({
			destinationId: z.string(),
			status: DestinationDeliveryStatusSchema,
			attempts: z.number(),
			lastAttemptAt: z.string().optional(),
			deliveredAt: z.string().optional(),
			failureReason: z.string().optional(),
			crossSystemReference: z.string().optional(),
		})
	),
	createdAt: z.string(),
	updatedAt: z.string(),
	metadata: z.record(z.string(), z.any()),
})
export type DeliveryStatusResponse = z.infer<typeof DeliveryStatusResponseSchema>

/**
 * Delivery list query parameters
 */
export const DeliveryListQuerySchema = z.object({
	destinationId: z.string().optional(),
	status: DestinationDeliveryStatusSchema.optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	limit: z.number().int().min(1).max(1000).optional(),
	offset: z.number().int().min(0).optional(),
	sortBy: z.enum(['createdAt', 'updatedAt', 'status']).optional(),
	sortOrder: z.enum(['asc', 'desc']).optional(),
})
export type DeliveryListQuery = z.infer<typeof DeliveryListQuerySchema>

/**
 * Paginated deliveries
 */
export const PaginatedDeliveriesSchema = z.object({
	data: z.array(DeliveryStatusResponseSchema),
	pagination: z.object({
		total: z.number().int().min(0).optional(),
		limit: z.number().int().min(1).optional(),
		offset: z.number().int().min(0).optional(),
		hasNext: z.boolean(),
		hasPrevious: z.boolean(),
		nextCursor: z.string().optional(),
		previousCursor: z.string().optional(),
	}),
})
export type PaginatedDeliveries = z.infer<typeof PaginatedDeliveriesSchema>

// ============================================================================
// Validation and Testing Types
// ============================================================================

/**
 * Connection test result
 */
export const ConnectionTestResultSchema = z.object({
	success: z.boolean(),
	responseTime: z.number().optional(),
	statusCode: z.number().optional(),
	error: z.string().optional(),
	details: z.record(z.string(), z.any()).optional(),
})
export type ConnectionTestResult = z.infer<typeof ConnectionTestResultSchema>

// ============================================================================
// Health and Metrics Types
// ============================================================================

/**
 * Destination health status
 */
export const DestinationHealthStatusSchema = z.enum([
	'healthy',
	'degraded',
	'unhealthy',
	'disabled',
])
export type DestinationHealthStatus = z.infer<typeof DestinationHealthStatusSchema>

/**
 * Circuit breaker state
 */
export const CircuitBreakerStateSchema = z.enum(['closed', 'open', 'half-open'])
export type CircuitBreakerState = z.infer<typeof CircuitBreakerStateSchema>

/**
 * Destination health
 */
export const DestinationHealthSchema = z.object({
	destinationId: z.string(),
	status: DestinationHealthStatusSchema,
	lastCheckAt: z.string(),
	consecutiveFailures: z.number(),
	totalFailures: z.number(),
	totalDeliveries: z.number(),
	successRate: z.string(),
	averageResponseTime: z.number().optional(),
	lastFailureAt: z.string().optional(),
	lastSuccessAt: z.string().optional(),
	disabledAt: z.string().optional(),
	disabledReason: z.string().optional(),
	circuitBreakerState: CircuitBreakerStateSchema,
	circuitBreakerOpenedAt: z.string().optional(),
	metadata: z.record(z.string(), z.any()),
})
export type DestinationHealth = z.infer<typeof DestinationHealthSchema>

/**
 * Delivery metrics
 */
export const DeliveryMetricsSchema = z.object({
	totalDeliveries: z.number(),
	successfulDeliveries: z.number(),
	failedDeliveries: z.number(),
	successRate: z.string(),
	averageDeliveryTime: z.number(),
	byDestinationType: z.record(
		z.string(),
		z.object({
			total: z.number(),
			successful: z.number(),
			failed: z.number(),
			successRate: z.string(),
			averageTime: z.number(),
		})
	),
	byOrganization: z.record(
		z.string(),
		z.object({
			total: z.number(),
			successful: z.number(),
			failed: z.number(),
			successRate: z.string(),
		})
	),
	timeRange: z.object({
		start: z.string(),
		end: z.string(),
	}),
})
export type DeliveryMetrics = z.infer<typeof DeliveryMetricsSchema>

/**
 * Metrics query parameters
 */
export const MetricsQuerySchema = z.object({
	destinationType: DeliveryDestinationTypeSchema.optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	granularity: z.enum(['hour', 'day', 'week', 'month']).optional(),
})
export type MetricsQuery = z.infer<typeof MetricsQuerySchema>

// ============================================================================
// Type Guards
// ============================================================================

export const isDeliveryDestination = (value: unknown): value is DeliveryDestination => {
	return DeliveryDestinationSchema.safeParse(value).success
}

export const isDeliveryResponse = (value: unknown): value is DeliveryResponse => {
	return DeliveryResponseSchema.safeParse(value).success
}

export const isDeliveryStatusResponse = (value: unknown): value is DeliveryStatusResponse => {
	return DeliveryStatusResponseSchema.safeParse(value).success
}

export const isValidationResult = (value: unknown): value is ValidationResult => {
	return ValidationResultSchema.safeParse(value).success
}

export const isConnectionTestResult = (value: unknown): value is ConnectionTestResult => {
	return ConnectionTestResultSchema.safeParse(value).success
}

export const isDestinationHealth = (value: unknown): value is DestinationHealth => {
	return DestinationHealthSchema.safeParse(value).success
}

export const isDeliveryMetrics = (value: unknown): value is DeliveryMetrics => {
	return DeliveryMetricsSchema.safeParse(value).success
}

// ============================================================================
// Validation Utilities
// ============================================================================

export const validateCreateDeliveryDestination = (data: unknown) => {
	return CreateDeliveryDestinationSchema.safeParse(data)
}

export const validateUpdateDeliveryDestination = (data: unknown) => {
	return UpdateDeliveryDestinationSchema.safeParse(data)
}

export const validateDeliveryRequest = (data: unknown) => {
	return DeliveryRequestSchema.safeParse(data)
}

export const validateDeliveryDestinationQuery = (data: unknown) => {
	return DeliveryDestinationQuerySchema.safeParse(data)
}

export const validateDeliveryListQuery = (data: unknown) => {
	return DeliveryListQuerySchema.safeParse(data)
}

export const validateMetricsQuery = (data: unknown) => {
	return MetricsQuerySchema.safeParse(data)
}
