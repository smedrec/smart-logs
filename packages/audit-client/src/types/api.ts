import { z } from 'zod'

// ============================================================================
// Core Data Types with Zod Schemas
// ============================================================================

/**
 * Data classification levels for audit events
 */
export const DataClassificationSchema = z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'])
export type DataClassification = z.infer<typeof DataClassificationSchema>

/**
 * Audit event status types
 */
export const AuditEventStatusSchema = z.enum(['attempt', 'success', 'failure'])
export type AuditEventStatus = z.infer<typeof AuditEventStatusSchema>

/**
 * Session context information for audit events
 */
export const SessionContextSchema = z.object({
	sessionId: z.string().min(1, 'Session ID is required'),
	ipAddress: z.string(), //.ip('Invalid IP address format'),
	userAgent: z.string().min(1, 'User agent is required'),
	geolocation: z.string().optional(),
	deviceId: z.string().optional(),
	browserFingerprint: z.string().optional(),
})
export type SessionContext = z.infer<typeof SessionContextSchema>

/**
 * Audit event metadata
 */
export const AuditEventMetadataSchema = z.object({
	source: z.string().optional(),
	version: z.string().optional(),
	tags: z.array(z.string()).optional(),
	customFields: z.record(z.unknown()).optional(),
})
export type AuditEventMetadata = z.infer<typeof AuditEventMetadataSchema>

/**
 * Complete audit event interface with validation
 */
export const AuditEventSchema = z.object({
	id: z.string().uuid('Invalid audit event ID format'),
	timestamp: z.string().datetime('Invalid timestamp format'),
	action: z.string().min(1, 'Action is required'),
	targetResourceType: z.string().min(1, 'Target resource type is required'),
	targetResourceId: z.string().optional(),
	principalId: z.string().min(1, 'Principal ID is required'),
	organizationId: z.string().min(1, 'Organization ID is required'),
	status: AuditEventStatusSchema,
	outcomeDescription: z.string().optional(),
	dataClassification: DataClassificationSchema,
	details: z.record(z.unknown()).optional(),
	hash: z.string().optional(),
	correlationId: z.string().optional(),
	sessionContext: SessionContextSchema.optional(),
	metadata: AuditEventMetadataSchema.optional(),
})
export type AuditEvent = z.infer<typeof AuditEventSchema>

/**
 * Input interface for creating audit events with validation
 */
export const CreateAuditEventInputSchema = z.object({
	action: z.string().min(1, 'Action is required'),
	targetResourceType: z.string().min(1, 'Target resource type is required'),
	targetResourceId: z.string().optional(),
	principalId: z.string().min(1, 'Principal ID is required'),
	organizationId: z.string().min(1, 'Organization ID is required'),
	status: AuditEventStatusSchema,
	outcomeDescription: z.string().optional(),
	dataClassification: DataClassificationSchema,
	sessionContext: SessionContextSchema.optional(),
	details: z.record(z.unknown()).optional(),
	correlationId: z.string().optional(),
	metadata: AuditEventMetadataSchema.optional(),
})

/* Options for audit event creation */
const CreateAuditEventOptionsSchema = z.object({
	priority: z.number().optional(),
	delay: z.number().optional(),
	durabilityGuarantees: z.boolean().optional(),
	generateHash: z.boolean().optional(),
	generateSignature: z.boolean().optional(),
	correlationId: z.string().optional(),
	eventVersion: z.string().optional(),
	skipValidation: z.boolean().optional(),
	validationConfig: z
		.object({
			maxStringLength: z.number().default(10000),
			allowedDataClassifications: z
				.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']))
				.default(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']),
			requiredFields: z.array(z.string()).default(['timestamp', 'action', 'status']),
			maxCustomFieldDepth: z.number().default(3),
			allowedEventVersions: z.array(z.string()).default(['1.0', '1.1', '2.0']),
		})
		.optional(),
})

export type CreateAuditEventInput = z.infer<typeof CreateAuditEventInputSchema>
export type CreateAuditEventOptions = z.infer<typeof CreateAuditEventOptionsSchema>

// ============================================================================
// Pagination and Query Types
// ============================================================================

/**
 * Pagination parameters with validation
 */
export const PaginationParamsSchema = z.object({
	limit: z.number().int().min(1).max(1000).default(50),
	offset: z.number().int().min(0).default(0),
})
export type PaginationParams = z.infer<typeof PaginationParamsSchema>

/**
 * Pagination metadata
 */
export const PaginationMetadataSchema = z.object({
	total: z.number().int().min(0),
	limit: z.number().int().min(1),
	offset: z.number().int().min(0),
	hasNext: z.boolean(),
	hasPrevious: z.boolean(),
	nextCursor: z.string().optional(),
	previousCursor: z.string().optional(),
})
export type PaginationMetadata = z.infer<typeof PaginationMetadataSchema>

/**
 * Sort parameters with validation
 */
export const SortParamsSchema = z.object({
	field: z.enum(['timestamp', 'status', 'action', 'principalId', 'organizationId']),
	direction: z.enum(['asc', 'desc']).default('desc'),
})
export type SortParams = z.infer<typeof SortParamsSchema>

/**
 * Date range filter with validation
 */
export const DateRangeFilterSchema = z
	.object({
		startDate: z.string().datetime('Invalid start date format'),
		endDate: z.string().datetime('Invalid end date format'),
	})
	.refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
		message: 'Start date must be before or equal to end date',
		path: ['endDate'],
	})
export type DateRangeFilter = z.infer<typeof DateRangeFilterSchema>

/**
 * Query filter parameters with comprehensive validation
 */
export const QueryFilterSchema = z.object({
	dateRange: DateRangeFilterSchema.optional(),
	principalIds: z.array(z.string().min(1)).optional(),
	organizationIds: z.array(z.string().min(1)).optional(),
	actions: z.array(z.string().min(1)).optional(),
	statuses: z.array(AuditEventStatusSchema).optional(),
	dataClassifications: z.array(DataClassificationSchema).optional(),
	resourceTypes: z.array(z.string().min(1)).optional(),
	verifiedOnly: z.boolean().optional(),
	correlationId: z.string().optional(),
	targetResourceIds: z.array(z.string().min(1)).optional(),
	hasSessionContext: z.boolean().optional(),
	tags: z.array(z.string()).optional(),
})
export type QueryFilter = z.infer<typeof QueryFilterSchema>

/**
 * Query parameters for audit events with validation
 */
export const QueryAuditEventsParamsSchema = z.object({
	filter: QueryFilterSchema.optional(),
	pagination: PaginationParamsSchema.optional(),
	sort: SortParamsSchema.optional(),
})
export type QueryAuditEventsParams = z.infer<typeof QueryAuditEventsParamsSchema>

/**
 * Paginated audit events response with validation
 */
export const PaginatedAuditEventsSchema = z.object({
	events: z.array(AuditEventSchema),
	pagination: PaginationMetadataSchema,
	metadata: z
		.object({
			queryTime: z.number().min(0),
			cacheHit: z.boolean(),
			totalFiltered: z.number().int().min(0),
			appliedFilters: z.array(z.string()).optional(),
		})
		.optional(),
})
export type PaginatedAuditEvents = z.infer<typeof PaginatedAuditEventsSchema>

// ============================================================================
// Bulk Operations Types
// ============================================================================

/**
 * Bulk create input with validation
 */
export const BulkCreateAuditEventsInputSchema = z.object({
	events: z
		.array(CreateAuditEventInputSchema)
		.min(1, 'At least one event is required')
		.max(1000, 'Maximum 1000 events per batch'),
	validateOnly: z.boolean().default(false),
	continueOnError: z.boolean().default(false),
})
export type BulkCreateAuditEventsInput = z.infer<typeof BulkCreateAuditEventsInputSchema>

/**
 * Bulk operation result item
 */
export const BulkResultItemSchema = z.object({
	success: z.boolean(),
	event: AuditEventSchema.optional(),
	error: z.string().optional(),
	index: z.number().int().min(0),
	validationErrors: z.array(z.string()).optional(),
})
export type BulkResultItem = z.infer<typeof BulkResultItemSchema>

/**
 * Bulk create result with validation
 */
export const BulkCreateResultSchema = z.object({
	requestId: z.string().uuid(),
	total: z.number().int().min(0),
	successful: z.number().int().min(0),
	failed: z.number().int().min(0),
	results: z.array(BulkResultItemSchema),
	processingTime: z.number().min(0),
	metadata: z
		.object({
			batchSize: z.number().int().min(1),
			validationTime: z.number().min(0),
			persistenceTime: z.number().min(0),
		})
		.optional(),
})
export type BulkCreateResult = z.infer<typeof BulkCreateResultSchema>

// ============================================================================
// Integrity and Verification Types
// ============================================================================

/**
 * Integrity verification result with validation
 */
export const IntegrityVerificationResultSchema = z.object({
	eventId: z.string().uuid(),
	isValid: z.boolean(),
	verificationTimestamp: z.string().datetime(),
	hashAlgorithm: z.string().min(1),
	computedHash: z.string().min(1),
	storedHash: z.string().min(1),
	details: z
		.object({
			signatureValid: z.boolean().optional(),
			chainIntegrity: z.boolean().optional(),
			timestampValid: z.boolean().optional(),
			checksumValid: z.boolean().optional(),
		})
		.optional(),
	metadata: z
		.object({
			verificationMethod: z.string().optional(),
			verificationDuration: z.number().min(0).optional(),
			previousEventHash: z.string().optional(),
			nextEventHash: z.string().optional(),
		})
		.optional(),
})
export type IntegrityVerificationResult = z.infer<typeof IntegrityVerificationResultSchema>

// ============================================================================
// Export and Import Types
// ============================================================================

/**
 * Export format types
 */
export const ExportFormatSchema = z.enum(['json', 'csv', 'xml', 'pdf', 'parquet', 'avro'])
export type ExportFormat = z.infer<typeof ExportFormatSchema>

/**
 * Compression types
 */
export const CompressionTypeSchema = z.enum(['gzip', 'zip', 'bzip2', 'none'])
export type CompressionType = z.infer<typeof CompressionTypeSchema>

/**
 * Encryption configuration
 */
export const EncryptionConfigSchema = z.object({
	enabled: z.boolean(),
	algorithm: z.string().optional(),
	publicKey: z.string().optional(),
	keyId: z.string().optional(),
})
export type EncryptionConfig = z.infer<typeof EncryptionConfigSchema>

/**
 * Export parameters with validation
 */
export const ExportEventsParamsSchema = z.object({
	filter: QueryFilterSchema.optional(),
	format: ExportFormatSchema,
	includeMetadata: z.boolean().default(true),
	compression: CompressionTypeSchema.default('gzip'),
	encryption: EncryptionConfigSchema.optional(),
	chunkSize: z.number().int().min(100).max(100000).default(10000),
	includeHeaders: z.boolean().default(true),
	customFields: z.array(z.string()).optional(),
})
export type ExportEventsParams = z.infer<typeof ExportEventsParamsSchema>

/**
 * Export result with validation
 */
export const ExportResultSchema = z.object({
	exportId: z.string(),
	format: ExportFormatSchema,
	recordCount: z.number().int().min(0),
	dataSize: z.number().int().min(0),

	exportTimestamp: z.string().datetime(),
	downloadUrl: z.string().url().optional(),
	expiresAt: z.string().datetime().optional(),
	status: z.enum(['pending', 'processing', 'completed', 'failed']),
	progress: z.number().min(0).max(100).optional(),
	metadata: z
		.object({
			compression: CompressionTypeSchema.optional(),
			encryption: z.boolean().optional(),
			checksum: z.string().optional(),
			chunks: z.number().int().min(1).optional(),
			estimatedSize: z.number().int().min(0).optional(),
		})
		.optional(),
})
export type ExportResult = z.infer<typeof ExportResultSchema>

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Stream format types
 */
export const StreamFormatSchema = z.enum(['json', 'ndjson', 'csv'])
export type StreamFormat = z.infer<typeof StreamFormatSchema>

/**
 * Stream parameters with validation
 */
export const StreamEventsParamsSchema = z.object({
	filter: QueryFilterSchema.optional(),
	batchSize: z.number().int().min(1).max(10000).default(100),
	format: StreamFormatSchema.default('ndjson'),
	includeMetadata: z.boolean().default(false),
	bufferSize: z.number().int().min(1).max(1000).default(10),
})
export type StreamEventsParams = z.infer<typeof StreamEventsParamsSchema>

// ============================================================================
// Real-time Subscription Types
// ============================================================================

/**
 * Transport types for real-time subscriptions
 */
export const TransportTypeSchema = z.enum(['websocket', 'sse', 'polling'])
export type TransportType = z.infer<typeof TransportTypeSchema>

/**
 * Subscription filter parameters
 */
export const SubscriptionFilterSchema = z.object({
	actions: z.array(z.string().min(1)).optional(),
	principalIds: z.array(z.string().min(1)).optional(),
	organizationIds: z.array(z.string().min(1)).optional(),
	resourceTypes: z.array(z.string().min(1)).optional(),
	dataClassifications: z.array(DataClassificationSchema).optional(),
	statuses: z.array(AuditEventStatusSchema).optional(),
})
export type SubscriptionFilter = z.infer<typeof SubscriptionFilterSchema>

/**
 * Subscription parameters with validation
 */
export const SubscriptionParamsSchema = z.object({
	filter: SubscriptionFilterSchema.optional(),
	transport: TransportTypeSchema.default('websocket'),
	reconnect: z.boolean().default(true),
	maxReconnectAttempts: z.number().int().min(0).max(100).default(5),
	heartbeatInterval: z.number().int().min(1000).max(300000).default(30000),
	bufferSize: z.number().int().min(1).max(10000).default(100),
	compression: z.boolean().default(false),
})
export type SubscriptionParams = z.infer<typeof SubscriptionParamsSchema>

/**
 * Event subscription interface for real-time event streaming
 */
export interface EventSubscription {
	readonly id: string
	readonly params: SubscriptionParams
	readonly isActive: boolean
	readonly createdAt: Date

	// Subscription control
	start(): Promise<void>
	stop(): Promise<void>
	pause(): Promise<void>
	resume(): Promise<void>

	// Event handlers
	onEvent(handler: (event: AuditEvent) => void): void
	onError(handler: (error: Error) => void): void
	onReconnect(handler: () => void): void
	onDisconnect(handler: () => void): void

	// Status
	getStatus(): {
		isActive: boolean
		isPaused: boolean
		isConnected: boolean
		reconnectAttempts: number
		lastEvent?: Date
		lastError?: Error
	}
}

// ============================================================================
// Statistics and Analytics Types
// ============================================================================

/**
 * Time grouping options
 */
export const TimeGroupingSchema = z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year'])
export type TimeGrouping = z.infer<typeof TimeGroupingSchema>

/**
 * Statistics parameters
 */
export const StatisticsParamsSchema = z.object({
	dateRange: DateRangeFilterSchema,
	groupBy: TimeGroupingSchema.optional(),
	filters: QueryFilterSchema.optional(),
	includeTimeline: z.boolean().default(false),
	includeBreakdown: z.boolean().default(true),
})
export type StatisticsParams = z.infer<typeof StatisticsParamsSchema>

/**
 * Timeline data point
 */
export const TimelineDataPointSchema = z.object({
	timestamp: z.string().datetime(),
	count: z.number().int().min(0),
	breakdown: z.record(z.number().int().min(0)).optional(),
})
export type TimelineDataPoint = z.infer<typeof TimelineDataPointSchema>

/**
 * Audit event statistics
 */
export const AuditEventStatisticsSchema = z.object({
	totalEvents: z.number().int().min(0),
	eventsByStatus: z.record(AuditEventStatusSchema, z.number().int().min(0)),
	eventsByAction: z.record(z.string(), z.number().int().min(0)),
	eventsByDataClassification: z.record(DataClassificationSchema, z.number().int().min(0)),
	eventsByResourceType: z.record(z.string(), z.number().int().min(0)),
	timeline: z.array(TimelineDataPointSchema).optional(),
	metadata: z
		.object({
			queryTime: z.number().min(0),
			cacheHit: z.boolean(),
			dataFreshness: z.string().datetime(),
		})
		.optional(),
})
export type AuditEventStatistics = z.infer<typeof AuditEventStatisticsSchema>

// ============================================================================
// Error Types
// ============================================================================

/**
 * API error response
 */
export const ApiErrorSchema = z.object({
	code: z.string().min(1),
	message: z.string().min(1),
	details: z.record(z.unknown()).optional(),
	correlationId: z.string().optional(),
	timestamp: z.string().datetime(),
	path: z.string().optional(),
	method: z.string().optional(),
})
export type ApiError = z.infer<typeof ApiErrorSchema>

/**
 * Validation error details
 */
export const ValidationErrorDetailSchema = z.object({
	field: z.string().min(1),
	message: z.string().min(1),
	code: z.string().min(1),
	value: z.unknown().optional(),
})
export type ValidationErrorDetail = z.infer<typeof ValidationErrorDetailSchema>

/**
 * Validation error response
 */
export const ValidationErrorResponseSchema = z.object({
	code: z.literal('VALIDATION_ERROR'),
	message: z.string().min(1),
	errors: z.array(ValidationErrorDetailSchema),
	correlationId: z.string().optional(),
	timestamp: z.string().datetime(),
})
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>

// ============================================================================
// Generic Response Types
// ============================================================================

/**
 * Success response wrapper
 */
export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
	z.object({
		success: z.literal(true),
		data: dataSchema,
		metadata: z
			.object({
				timestamp: z.string().datetime(),
				correlationId: z.string().optional(),
				version: z.string().optional(),
			})
			.optional(),
	})

/**
 * Error response wrapper
 */
export const ErrorResponseSchema = z.object({
	success: z.literal(false),
	error: ApiErrorSchema,
	metadata: z
		.object({
			timestamp: z.string().datetime(),
			correlationId: z.string().optional(),
			version: z.string().optional(),
		})
		.optional(),
})

/**
 * Generic API response
 */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
	z.union([SuccessResponseSchema(dataSchema), ErrorResponseSchema])

// ============================================================================
// Utility Types and Type Guards
// ============================================================================

/**
 * Type guard for audit events
 */
export const isAuditEvent = (value: unknown): value is AuditEvent => {
	return AuditEventSchema.safeParse(value).success
}

/**
 * Type guard for create audit event input
 */
export const isCreateAuditEventInput = (value: unknown): value is CreateAuditEventInput => {
	return CreateAuditEventInputSchema.safeParse(value).success
}

/**
 * Type guard for query parameters
 */
export const isQueryAuditEventsParams = (value: unknown): value is QueryAuditEventsParams => {
	return QueryAuditEventsParamsSchema.safeParse(value).success
}

/**
 * Type guard for paginated results
 */
export const isPaginatedAuditEvents = (value: unknown): value is PaginatedAuditEvents => {
	return PaginatedAuditEventsSchema.safeParse(value).success
}

/**
 * Type guard for API errors
 */
export const isApiError = (value: unknown): value is ApiError => {
	return ApiErrorSchema.safeParse(value).success
}

/**
 * Type guard for validation errors
 */
export const isValidationErrorResponse = (value: unknown): value is ValidationErrorResponse => {
	return ValidationErrorResponseSchema.safeParse(value).success
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates audit event data
 */
export const validateAuditEvent = (data: unknown) => {
	return AuditEventSchema.safeParse(data)
}

/**
 * Validates create audit event input
 */
export const validateCreateAuditEventInput = (data: unknown) => {
	return CreateAuditEventInputSchema.safeParse(data)
}

/**
 * Validates query parameters
 */
export const validateQueryParams = (data: unknown) => {
	return QueryAuditEventsParamsSchema.safeParse(data)
}

/**
 * Validates bulk create input
 */
export const validateBulkCreateInput = (data: unknown) => {
	return BulkCreateAuditEventsInputSchema.safeParse(data)
}

/**
 * Validates export parameters
 */
export const validateExportParams = (data: unknown) => {
	return ExportEventsParamsSchema.safeParse(data)
}

/**
 * Validates stream parameters
 */
export const validateStreamParams = (data: unknown) => {
	return StreamEventsParamsSchema.safeParse(data)
}

/**
 * Validates subscription parameters
 */
export const validateSubscriptionParams = (data: unknown) => {
	return SubscriptionParamsSchema.safeParse(data)
}

/**
 * Validates statistics parameters
 */
export const validateStatisticsParams = (data: unknown) => {
	return StatisticsParamsSchema.safeParse(data)
}
