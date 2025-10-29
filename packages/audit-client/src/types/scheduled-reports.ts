import { z } from 'zod'

import { ExportResultSchema, PaginationMetadataSchema, PaginationParamsSchema } from './api'
import {
	DeliveryConfigSchema,
	ExecutionStatusSchema,
	ExecutionTriggerSchema,
	ExportConfigSchema,
	IntegrityVerificationReportSchema,
	NotificationConfigSchema,
	ReportCriteriaSchema,
	ReportFormatSchema,
	ReportTypeSchema,
} from './shared-schemas'

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
		timezone: TimezoneSchema, //.default('UTC'),

		// For specific frequencies
		hour: z.number().int().min(0).max(23), //.default(0),
		minute: z.number().int().min(0).max(59), //.default(0),
		dayOfWeek: DayOfWeekSchema.optional(),
		dayOfMonth: z.number().int().min(1).max(31).optional(),
		monthOfYear: z.number().int().min(1).max(12).optional(),

		// Advanced options
		skipWeekends: z.boolean(), //.default(false),
		skipHolidays: z.boolean(), //.default(false),
		holidayCalendar: z.string().optional(),
		maxMissedRuns: z.number().int().min(0).max(100), //.default(3),
		catchUpMissedRuns: z.boolean(), //.default(false),
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

// Export and Notification configs are now imported from shared-schemas

/**
 * Scheduled report
 */
export const ScheduledReportSchema = z.object({
	id: z.string().startsWith('report-'),
	name: z.string().min(1, 'Report name is required').max(255),
	description: z.string().max(1000).optional(),
	organizationId: z.string().min(1, 'Organization ID is required'),
	templateId: z.string().optional(),
	reportType: ReportTypeSchema,
	criteria: ReportCriteriaSchema,
	format: ReportFormatSchema,
	schedule: ScheduleConfigSchema,
	delivery: DeliveryConfigSchema,
	export: ExportConfigSchema,
	notifications: NotificationConfigSchema.optional(),

	// Status and metadata
	enabled: z.boolean(), //.default(true),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	createdBy: z.string().min(1),
	updatedBy: z.string().min(1),

	// Execution tracking
	lastRun: z.string().datetime().optional(),
	nextRun: z.string().datetime(),
	executionCount: z.number().int().min(0), //.default(0),
	successCount: z.number().int().min(0), //.default(0),
	failureCount: z.number().int().min(0), //.default(0),
	runId: z.string().optional(),

	// Configuration
	tags: z.array(z.string()), //.default([]),
	metadata: z.record(z.string(), z.any()).optional(),
	version: z.number().int().min(1), //.default(1),
})
export type ScheduledReport = z.infer<typeof ScheduledReportSchema>

/**
 * Create scheduled report input
 */
export const CreateScheduledReportInputSchema = z.object({
	name: z.string().min(1, 'Report name is required').max(255),
	description: z.string().max(1000).optional(),
	templateId: z.string().optional(),
	reportType: ReportTypeSchema,
	criteria: ReportCriteriaSchema,
	format: ReportFormatSchema,
	schedule: ScheduleConfigSchema,
	delivery: DeliveryConfigSchema,
	export: ExportConfigSchema,
	notifications: NotificationConfigSchema.optional(),
	createdBy: z.string().min(1),
	updatedBy: z.string().min(1),
	runId: z.string().optional(),
	tags: z.array(z.string()), //.default([]),
	metadata: z.record(z.unknown()).optional(),
})
export type CreateScheduledReportInput = z.infer<typeof CreateScheduledReportInputSchema>

/**
 * Update scheduled report input
 */
export const UpdateScheduledReportInputSchema = z.object({
	name: z.string().min(1, 'Report name is required').max(255).optional(),
	description: z.string().max(1000).optional(),
	templateId: z.string().optional(),
	reportType: ReportTypeSchema.optional(),
	criteria: ReportCriteriaSchema.optional(),
	format: ReportFormatSchema.optional(),
	schedule: ScheduleConfigSchema.optional(),
	delivery: DeliveryConfigSchema.optional(),
	export: ExportConfigSchema.optional(),
	notifications: NotificationConfigSchema.optional(),
	updatedBy: z.string().min(1),
	runId: z.string().optional(),
	tags: z.array(z.string()).optional(),
	metadata: z.record(z.string(), z.any()).optional(),
})
export type UpdateScheduledReportInput = z.infer<typeof UpdateScheduledReportInputSchema>

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Report execution
 */
export const ReportExecutionSchema = z.object({
	id: z.string().startsWith('execution-'),
	scheduledReportId: z.string(),
	status: ExecutionStatusSchema,
	trigger: ExecutionTriggerSchema,

	// Timing
	scheduledTime: z.string().datetime(),
	executionTime: z.string().datetime().optional(),
	duration: z.number().min(0).optional(),

	// Results
	reportId: z.string().optional(),
	recordsProcessed: z.number().int().min(0).optional(),
	exportResult: ExportResultSchema.optional(),
	integrityReport: IntegrityVerificationReportSchema.optional(),

	// Delivery tracking
	deliveryId: z.string().optional(),

	// Error handling
	error: z
		.object({
			code: z.string(),
			message: z.string(),
			details: z.record(z.string(), z.any()).optional(),
			stackTrace: z.string().optional(),
		})
		.optional(),

	// Metadata
	//executedBy: z.string().optional(),
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
	startDate: z.string().datetime().optional(),
	endDate: z.string().datetime().optional(),
	limit: z.number().int().min(1).max(1000).optional(),
	offset: z.number().int().min(0).optional(),
	sortBy: z.enum(['scheduled_time', 'execution_time', 'duration', 'status']).optional(),
	sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
})
export type ExecutionHistoryParams = z.infer<typeof ExecutionHistoryParamsSchema>

/**
 * Paginated executions
 */
export const PaginatedExecutionsSchema = z.object({
	data: z.array(ReportExecutionSchema),
	pagination: PaginationMetadataSchema,
	summary: z
		.object({
			totalExecutions: z.number().int().min(0),
			successRate: z.number().min(0).max(100),
			averageDuration: z.number().min(0),
			lastRun: z.string().datetime().optional(),
			nextRun: z.string().datetime().optional(),
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
	reportType: z
		.array(
			z.enum([
				'HIPAA_AUDIT_TRAIL',
				'GDPR_PROCESSING_ACTIVITIES',
				'GENERAL_COMPLIANCE',
				'INTEGRITY_VERIFICATION',
				'CUSTOM_REPORT',
			])
		)
		.optional(),
	createdBy: z.array(z.string()).optional(),
	tags: z.array(z.string()).optional(),
	search: z.string().optional(),
	rangeBy: z.enum(['created_at', 'updated_at', 'last_run', 'next_run']).optional(),
	startDate: z.string().datetime().optional(),
	endDate: z.string().datetime().optional(),
	limit: z.number().int().min(1).max(1000).optional(),
	offset: z.number().int().min(0).optional(),
	sortBy: z
		.enum(['name', 'created_at', 'updated_at', 'last_run', 'next_run', 'execution_count'])
		.optional(),
	sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
})
export type ListScheduledReportsParams = z.infer<typeof ListScheduledReportsParamsSchema>

/**
 * Paginated scheduled reports
 */
export const PaginatedScheduledReportsSchema = z.object({
	data: z.array(ScheduledReportSchema),
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
