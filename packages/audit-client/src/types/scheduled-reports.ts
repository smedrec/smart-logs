import { z } from 'zod'

import { PaginationMetadataSchema, PaginationParamsSchema } from './api'
import { ReportCriteriaSchema, ReportFormatSchema, ReportTypeSchema } from './compliance'

// ============================================================================
// Scheduled Report Types
// ============================================================================

/**
 * Schedule frequency types
 */
export const ScheduleFrequencySchema = z.enum([
	'once',
	'hourly',
	'daily',
	'weekly',
	'monthly',
	'quarterly',
	'yearly',
	'custom',
])
export type ScheduleFrequency = z.infer<typeof ScheduleFrequencySchema>

/**
 * Day of week enumeration
 */
export const DayOfWeekSchema = z.enum([
	'sunday',
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday',
])
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>

/**
 * Timezone validation
 */
export const TimezoneSchema = z.string().refine(
	(tz) => {
		try {
			Intl.DateTimeFormat(undefined, { timeZone: tz })
			return true
		} catch {
			return false
		}
	},
	{ message: 'Invalid timezone' }
)

/**
 * Cron expression validation
 */
export const CronExpressionSchema = z
	.string()
	.regex(
		/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
		{ message: 'Invalid cron expression format' }
	)

/**
 * Schedule configuration
 */
export const ScheduleConfigSchema = z
	.object({
		frequency: ScheduleFrequencySchema,
		cronExpression: CronExpressionSchema.optional(),
		startDate: z.string().datetime().optional(),
		endDate: z.string().datetime().optional(),
		timezone: TimezoneSchema.default('UTC'),

		// For specific frequencies
		hour: z.number().int().min(0).max(23),
		minute: z.number().int().min(0).max(59).default(0),
		dayOfWeek: DayOfWeekSchema.optional(),
		dayOfMonth: z.number().int().min(1).max(31).optional(),
		monthOfYear: z.number().int().min(1).max(12).optional(),

		// Advanced options
		skipWeekends: z.boolean().default(false),
		skipHolidays: z.boolean().default(false),
		holidayCalendar: z.string().optional(),
		maxMissedRuns: z.number().int().min(0).max(100).default(3),
		catchUpMissedRuns: z.boolean().default(false),
	})
	.refine(
		(data) => {
			// Validate that required fields are present based on frequency
			if (data.frequency === 'custom' && !data.cronExpression) {
				return false
			}
			if (data.frequency === 'weekly' && !data.dayOfWeek) {
				return false
			}
			if (data.frequency === 'monthly' && !data.dayOfMonth) {
				return false
			}
			return true
		},
		{
			message: 'Missing required fields for the selected frequency',
		}
	)
export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>

/**
 * Delivery configuration
 */
export const DeliveryConfigSchema = z
	.object({
		method: z.enum(['email', 'webhook', 'sftp', 's3', 'download']),

		// Email delivery
		recipients: z.array(z.string().email()).optional(),
		subject: z.string().optional(),
		body: z.string().optional(),
		attachmentName: z.string().optional(),

		// Webhook delivery
		webhookUrl: z.string().url().optional(),
		webhookHeaders: z.record(z.string()).optional(),
		webhookTimeout: z.number().int().min(1000).max(300000).default(30000),
		webhookRetries: z.number().int().min(0).max(5).default(3),

		// SFTP delivery
		sftpHost: z.string().optional(),
		sftpPort: z.number().int().min(1).max(65535).default(22),
		sftpUsername: z.string().optional(),
		sftpPath: z.string().optional(),
		sftpFilename: z.string().optional(),

		// S3 delivery
		s3Bucket: z.string().optional(),
		s3Key: z.string().optional(),
		s3Region: z.string().optional(),

		// General options
		compression: z.enum(['none', 'gzip', 'zip']).default('none'),
		encryption: z.boolean().default(false),
		encryptionKey: z.string().optional(),
		retentionDays: z.number().int().min(1).max(365).optional(),
	})
	.refine(
		(data) => {
			// Validate required fields based on delivery method
			switch (data.method) {
				case 'email':
					return data.recipients && data.recipients.length > 0
				case 'webhook':
					return !!data.webhookUrl
				case 'sftp':
					return !!(data.sftpHost && data.sftpUsername && data.sftpPath)
				case 's3':
					return !!(data.s3Bucket && data.s3Key)
				default:
					return true
			}
		},
		{
			message: 'Missing required fields for the selected delivery method',
		}
	)
export type DeliveryConfig = z.infer<typeof DeliveryConfigSchema>

/**
 * Notification configuration
 */
export const NotificationConfigSchema = z.object({
	onSuccess: z.boolean().default(false),
	onFailure: z.boolean().default(true),
	onSkip: z.boolean().default(false),
	recipients: z.array(z.string().email()),
	includeReport: z.boolean().default(false),
	customMessage: z.string().optional(),
})
export type NotificationConfig = z.infer<typeof NotificationConfigSchema>

/**
 * Scheduled report
 */
export const ScheduledReportSchema = z.object({
	id: z.string(),
	name: z.string().min(1, 'Report name is required').max(255),
	description: z.string().max(1000).optional(),
	reportType: ReportTypeSchema,
	criteria: ReportCriteriaSchema,
	format: ReportFormatSchema,
	schedule: ScheduleConfigSchema,
	delivery: DeliveryConfigSchema,
	notifications: NotificationConfigSchema.optional(),

	// Status and metadata
	enabled: z.boolean().default(true),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	createdBy: z.string().min(1),
	lastModifiedBy: z.string().min(1),

	// Execution tracking
	lastExecuted: z.string().datetime().optional(),
	nextExecution: z.string().datetime(),
	executionCount: z.number().int().min(0).default(0),
	successCount: z.number().int().min(0).default(0),
	failureCount: z.number().int().min(0).default(0),

	// Configuration
	tags: z.array(z.string()).default([]),
	metadata: z.record(z.unknown()).optional(),
	version: z.number().int().min(1).default(1),
})
export type ScheduledReport = z.infer<typeof ScheduledReportSchema>

/**
 * Create scheduled report input
 */
export const CreateScheduledReportInputSchema = ScheduledReportSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
	lastExecuted: true,
	nextExecution: true,
	executionCount: true,
	successCount: true,
	failureCount: true,
	version: true,
})
export type CreateScheduledReportInput = z.infer<typeof CreateScheduledReportInputSchema>

/**
 * Update scheduled report input
 */
export const UpdateScheduledReportInputSchema = CreateScheduledReportInputSchema.partial().extend({
	lastModifiedBy: z.string().min(1),
})
export type UpdateScheduledReportInput = z.infer<typeof UpdateScheduledReportInputSchema>

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Execution status
 */
export const ExecutionStatusSchema = z.enum([
	'pending',
	'running',
	'completed',
	'failed',
	'cancelled',
	'skipped',
	'timeout',
])
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>

/**
 * Execution trigger
 */
export const ExecutionTriggerSchema = z.enum(['scheduled', 'manual', 'api', 'retry', 'catchup'])
export type ExecutionTrigger = z.infer<typeof ExecutionTriggerSchema>

/**
 * Report execution
 */
export const ReportExecutionSchema = z.object({
	id: z.string(),
	scheduledReportId: z.string().uuid(),
	status: ExecutionStatusSchema,
	trigger: ExecutionTriggerSchema,

	// Timing
	scheduledAt: z.string().datetime(),
	startedAt: z.string().datetime().optional(),
	completedAt: z.string().datetime().optional(),
	duration: z.number().min(0).optional(),

	// Results
	reportId: z.string().optional(),
	recordCount: z.number().int().min(0).optional(),
	fileSize: z.number().int().min(0).optional(),
	downloadUrl: z.string().url().optional(),

	// Error handling
	error: z
		.object({
			code: z.string(),
			message: z.string(),
			details: z.record(z.unknown()).optional(),
			stackTrace: z.string().optional(),
		})
		.optional(),

	// Delivery tracking
	deliveryStatus: z.enum(['pending', 'delivered', 'failed', 'skipped']).optional(),
	deliveryAttempts: z.number().int().min(0).default(0),
	lastDeliveryAttempt: z.string().datetime().optional(),
	deliveryError: z.string().optional(),

	// Metadata
	executedBy: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	logs: z
		.array(
			z.object({
				timestamp: z.string().datetime(),
				level: z.enum(['debug', 'info', 'warn', 'error']),
				message: z.string(),
				details: z.record(z.unknown()).optional(),
			})
		)
		.optional(),
})
export type ReportExecution = z.infer<typeof ReportExecutionSchema>

/**
 * Execution history parameters
 */
export const ExecutionHistoryParamsSchema = z.object({
	status: z.array(ExecutionStatusSchema).optional(),
	trigger: z.array(ExecutionTriggerSchema).optional(),
	dateRange: z
		.object({
			startDate: z.string().datetime(),
			endDate: z.string().datetime(),
		})
		.optional(),
	pagination: PaginationParamsSchema.optional(),
	sort: z
		.object({
			field: z.enum(['scheduledAt', 'startedAt', 'completedAt', 'duration', 'status']),
			direction: z.enum(['asc', 'desc']).default('desc'),
		})
		.optional(),
})
export type ExecutionHistoryParams = z.infer<typeof ExecutionHistoryParamsSchema>

/**
 * Paginated executions
 */
export const PaginatedExecutionsSchema = z.object({
	executions: z.array(ReportExecutionSchema),
	pagination: PaginationMetadataSchema,
	summary: z
		.object({
			totalExecutions: z.number().int().min(0),
			successRate: z.number().min(0).max(100),
			averageDuration: z.number().min(0),
			lastExecution: z.string().datetime().optional(),
			nextExecution: z.string().datetime().optional(),
		})
		.optional(),
})
export type PaginatedExecutions = z.infer<typeof PaginatedExecutionsSchema>

// ============================================================================
// List and Query Types
// ============================================================================

/**
 * List scheduled reports parameters
 */
export const ListScheduledReportsParamsSchema = z.object({
	enabled: z.boolean().optional(),
	reportType: z.array(ReportTypeSchema).optional(),
	createdBy: z.array(z.string()).optional(),
	tags: z.array(z.string()).optional(),
	search: z.string().optional(),
	dateRange: z
		.object({
			field: z.enum(['createdAt', 'updatedAt', 'lastExecuted', 'nextExecution']),
			startDate: z.string().datetime(),
			endDate: z.string().datetime(),
		})
		.optional(),
	pagination: PaginationParamsSchema.optional(),
	sort: z
		.object({
			field: z.enum([
				'name',
				'createdAt',
				'updatedAt',
				'lastExecuted',
				'nextExecution',
				'executionCount',
			]),
			direction: z.enum(['asc', 'desc']).default('desc'),
		})
		.optional(),
})
export type ListScheduledReportsParams = z.infer<typeof ListScheduledReportsParamsSchema>

/**
 * Paginated scheduled reports
 */
export const PaginatedScheduledReportsSchema = z.object({
	reports: z.array(ScheduledReportSchema),
	pagination: PaginationMetadataSchema,
	summary: z
		.object({
			totalReports: z.number().int().min(0),
			enabledReports: z.number().int().min(0),
			disabledReports: z.number().int().min(0),
			reportsByType: z.record(ReportTypeSchema, z.number().int().min(0)),
			upcomingExecutions: z.number().int().min(0),
		})
		.optional(),
})
export type PaginatedScheduledReports = z.infer<typeof PaginatedScheduledReportsSchema>

// ============================================================================
// Validation and Management Types
// ============================================================================

/**
 * Schedule validation result
 */
export const ScheduleValidationResultSchema = z.object({
	isValid: z.boolean(),
	errors: z.array(
		z.object({
			field: z.string(),
			message: z.string(),
			code: z.string(),
		})
	),
	warnings: z.array(
		z.object({
			field: z.string(),
			message: z.string(),
			code: z.string(),
		})
	),
	nextExecutions: z.array(z.string().datetime()).optional(),
})
export type ScheduleValidationResult = z.infer<typeof ScheduleValidationResultSchema>

/**
 * Bulk operation parameters
 */
export const BulkScheduledReportOperationSchema = z.object({
	operation: z.enum(['enable', 'disable', 'delete', 'execute']),
	reportIds: z.array(z.string().uuid()).min(1).max(100),
	force: z.boolean().default(false),
})
export type BulkScheduledReportOperation = z.infer<typeof BulkScheduledReportOperationSchema>

/**
 * Bulk operation result
 */
export const BulkOperationResultSchema = z.object({
	requestId: z.string().uuid(),
	operation: z.enum(['enable', 'disable', 'delete', 'execute']),
	total: z.number().int().min(0),
	successful: z.number().int().min(0),
	failed: z.number().int().min(0),
	results: z.array(
		z.object({
			reportId: z.string().uuid(),
			success: z.boolean(),
			error: z.string().optional(),
		})
	),
	processingTime: z.number().min(0),
})
export type BulkOperationResult = z.infer<typeof BulkOperationResultSchema>

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for scheduled reports
 */
export const isScheduledReport = (value: unknown): value is ScheduledReport => {
	return ScheduledReportSchema.safeParse(value).success
}

/**
 * Type guard for create scheduled report input
 */
export const isCreateScheduledReportInput = (
	value: unknown
): value is CreateScheduledReportInput => {
	return CreateScheduledReportInputSchema.safeParse(value).success
}

/**
 * Type guard for update scheduled report input
 */
export const isUpdateScheduledReportInput = (
	value: unknown
): value is UpdateScheduledReportInput => {
	return UpdateScheduledReportInputSchema.safeParse(value).success
}

/**
 * Type guard for report execution
 */
export const isReportExecution = (value: unknown): value is ReportExecution => {
	return ReportExecutionSchema.safeParse(value).success
}

/**
 * Type guard for execution history parameters
 */
export const isExecutionHistoryParams = (value: unknown): value is ExecutionHistoryParams => {
	return ExecutionHistoryParamsSchema.safeParse(value).success
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates scheduled report data
 */
export const validateScheduledReport = (data: unknown) => {
	return ScheduledReportSchema.safeParse(data)
}

/**
 * Validates create scheduled report input
 */
export const validateCreateScheduledReportInput = (data: unknown) => {
	return CreateScheduledReportInputSchema.safeParse(data)
}

/**
 * Validates update scheduled report input
 */
export const validateUpdateScheduledReportInput = (data: unknown) => {
	return UpdateScheduledReportInputSchema.safeParse(data)
}

/**
 * Validates schedule configuration
 */
export const validateScheduleConfig = (data: unknown) => {
	return ScheduleConfigSchema.safeParse(data)
}

/**
 * Validates delivery configuration
 */
export const validateDeliveryConfig = (data: unknown) => {
	return DeliveryConfigSchema.safeParse(data)
}

/**
 * Validates execution history parameters
 */
export const validateExecutionHistoryParams = (data: unknown) => {
	return ExecutionHistoryParamsSchema.safeParse(data)
}

/**
 * Validates list parameters
 */
export const validateListScheduledReportsParams = (data: unknown) => {
	return ListScheduledReportsParamsSchema.safeParse(data)
}
