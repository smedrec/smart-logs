import { z } from 'zod'

import { DateRangeFilterSchema } from './api'

// ============================================================================
// Shared Schemas (to avoid circular imports)
// ============================================================================

/**
 * Report types
 */
export const ReportTypeSchema = z.enum([
	'HIPAA_AUDIT_TRAIL',
	'GDPR_PROCESSING_ACTIVITIES',
	'GENERAL_COMPLIANCE',
	'INTEGRITY_VERIFICATION',
	'CUSTOM_REPORT',
])
export type ReportType = z.infer<typeof ReportTypeSchema>

/**
 * Report format
 */
export const ReportFormatSchema = z.enum(['pdf', 'html', 'csv', 'json', 'xlsx', 'xml'])
export type ReportFormat = z.infer<typeof ReportFormatSchema>

/**
 * Report status
 */
export const ReportStatusSchema = z.enum([
	'pending',
	'processing',
	'completed',
	'failed',
	'cancelled',
])
export type ReportStatus = z.infer<typeof ReportStatusSchema>

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
 * Delivery Status
 */
export const DeliveryStatusSchema = z.enum(['pending', 'delivered', 'failed', 'skipped'])
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>

/**
 * Basic report criteria schema (to avoid circular imports)
 */
export const ReportCriteriaSchema = z.object({
	dateRange: DateRangeFilterSchema,
	organizationIds: z.array(z.string().min(1)).optional(),
	principalIds: z.array(z.string().min(1)).optional(),
	actions: z.array(z.string().min(1)).optional(),
	resourceTypes: z.array(z.string().min(1)).optional(),
	dataClassifications: z.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'])).optional(),
	statuses: z.array(z.enum(['attempt', 'success', 'failure'])).optional(),
	verifiedOnly: z.boolean().default(false).optional(),
	includeIntegrityFailures: z.boolean().default(true).optional(),
	limit: z.number().int().min(1).max(10000).optional(),
	offset: z.number().int().min(0).optional(),
	sortBy: z.enum(['timestamp', 'status']).optional(),
	sortOrder: z.enum(['asc', 'desc']).optional(),
})
export type ReportCriteria = z.infer<typeof ReportCriteriaSchema>

/**
 * Basic integrity verification report schema (to avoid circular imports)
 */
export const IntegrityVerificationReportSchema = z.object({
	verificationId: z.string(),
	verifiedAt: z.string().datetime(),
	verifiedBy: z.string().optional(),
	results: z.object({
		totalEvents: z.number().int().min(0),
		verifiedEvents: z.number().int().min(0),
		failedVerifications: z.number().int().min(0),
		unverifiedEvents: z.number().int().min(0),
		verificationRate: z.number().min(0).max(100),
	}),
	failures: z.array(
		z.object({
			eventId: z.string(),
			timestamp: z.string().datetime(),
			expectedHash: z.string(),
			actualHash: z.string(),
			hashAlgorithm: z.string(),
			failureReason: z.string(),
			severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
		})
	),
	statistics: z.object({
		hashAlgorithms: z.record(z.string(), z.number()),
		verificationLatency: z.object({
			average: z.number().min(0),
			median: z.number().min(0),
			p95: z.number().min(0),
		}),
	}),
})
export type IntegrityVerificationReport = z.infer<typeof IntegrityVerificationReportSchema>

/**
 * Export configuration schema
 */
export const ExportConfigSchema = z.object({
	format: ReportFormatSchema,
	includeMetadata: z.boolean().optional(),
	includeIntegrityReport: z.boolean().optional(),
	compression: z.enum(['none', 'gzip', 'zip', 'bzip2']).optional(),
	encryption: z
		.object({
			enabled: z.boolean(),
			algorithm: z.string().optional(),
			keyId: z.string().optional(),
		})
		.optional(),
})
export type ExportConfig = z.infer<typeof ExportConfigSchema>

/**
 * Notification configuration
 */
export const NotificationConfigSchema = z.object({
	recipients: z.array(z.string().email()),
	onSuccess: z.boolean().optional(),
	onFailure: z.boolean().optional(),
	onSkip: z.boolean().optional(),
	includeReport: z.boolean().optional(),
	customMessage: z.string().optional(),
})
export type NotificationConfig = z.infer<typeof NotificationConfigSchema>

/**
 * Basic delivery configuration schema
 */
export const DeliveryConfigSchema = z.object({
	destinations: z.union([z.array(z.string()), z.literal('default')]),
})
export type DeliveryConfig = z.infer<typeof DeliveryConfigSchema>

/**
 * Validation result
 */
export const ValidationResultSchema = z.object({
	isValid: z.boolean(),
	errors: z.array(z.string()).optional(),
	warnings: z.array(z.string()).optional(),
})
export type ValidationResult = z.infer<typeof ValidationResultSchema>
