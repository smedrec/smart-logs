import { z } from 'zod'

// Import all schemas for validation
import {
	AuditEventSchema,
	BulkCreateAuditEventsInputSchema,
	CreateAuditEventInputSchema,
	ExportEventsParamsSchema,
	IntegrityVerificationResultSchema,
	QueryAuditEventsParamsSchema,
	StatisticsParamsSchema,
	StreamEventsParamsSchema,
	SubscriptionParamsSchema,
} from '../types/api'
import {
	CustomReportParamsSchema,
	GdprExportParamsSchema,
	GDPRReportSchema,
	HIPAAReportSchema,
	PseudonymizationParamsSchema,
	ReportCriteriaSchema,
	ReportTemplateSchema,
} from '../types/compliance'
import {
	DetailedHealthStatusSchema,
	HealthStatusSchema,
	ReadinessStatusSchema,
	VersionInfoSchema,
} from '../types/health'
import {
	AlertSchema,
	AlertsParamsSchema,
	AuditMetricsParamsSchema,
	SystemMetricsSchema,
	UsageMetricsParamsSchema,
} from '../types/metrics'
import {
	AuditPresetSchema,
	CreateAuditPresetInputSchema,
	PresetContextSchema,
	PresetExportParamsSchema,
	PresetImportParamsSchema,
	PresetTemplateSchema,
	PresetValidationSchema,
	UpdateAuditPresetInputSchema,
} from '../types/presets'
import {
	CreateScheduledReportInputSchema,
	DeliveryConfigSchema,
	ExecutionHistoryParamsSchema,
	ListScheduledReportsParamsSchema,
	ScheduleConfigSchema,
	ScheduledReportSchema,
	UpdateScheduledReportInputSchema,
} from '../types/scheduled-reports'

import type { ValidationResult, Validator } from '../types/utils'

// ============================================================================
// Generic Validation Utilities
// ============================================================================

/**
 * Creates a validator function from a Zod schema
 */
export function createValidator<T>(schema: z.ZodSchema<T>): Validator<T> {
	return (value: unknown): ValidationResult<T> => {
		const result = schema.safeParse(value)

		if (result.success) {
			return {
				success: true,
				data: result.data,
			}
		}

		const firstError = result.error.errors[0]
		return {
			success: false,
			error: {
				message: firstError?.message || 'Validation failed',
				...(firstError?.path && { path: firstError.path as (string | number)[] }),
				...(firstError?.code && { code: firstError.code }),
			},
			zodError: result.error, // Preserve the original ZodError
		}
	}
}

/**
 * Validates a value against a schema and throws on error
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, value: unknown): T {
	try {
		return schema.parse(value)
	} catch (error) {
		if (error instanceof z.ZodError) {
			const firstError = error.errors[0]
			throw new ValidationError(`Validation failed: ${firstError?.message || 'Unknown error'}`, {
				...(firstError?.path && { path: firstError.path as (string | number)[] }),
				...(firstError?.code && { code: firstError.code }),
				originalError: error,
			})
		}
		throw error
	}
}

/**
 * Validates a value against a schema and returns a result
 */
export function validateSafely<T>(schema: z.ZodSchema<T>, value: unknown): ValidationResult<T> {
	const validator = createValidator(schema)
	return validator(value)
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
	public readonly path?: (string | number)[]
	public readonly code?: string
	public readonly originalError?: z.ZodError

	constructor(
		message: string,
		options?: {
			path?: (string | number)[]
			code?: string
			originalError?: z.ZodError
		}
	) {
		super(message)
		this.name = 'ValidationError'
		if (options?.path !== undefined) {
			this.path = options.path
		}
		if (options?.code !== undefined) {
			this.code = options.code
		}
		if (options?.originalError !== undefined) {
			this.originalError = options.originalError
		}
	}

	/**
	 * Gets a formatted error message with path information
	 */
	getFormattedMessage(): string {
		if (this.path && this.path.length > 0) {
			const pathString = this.path.join('.')
			return `${this.message} at path: ${pathString}`
		}
		return this.message
	}

	/**
	 * Gets all validation errors from the original Zod error
	 */
	getAllErrors(): Array<{ path: string; message: string; code: string }> {
		if (!this.originalError) {
			return [
				{
					path: this.path?.join('.') || '',
					message: this.message,
					code: this.code || 'VALIDATION_ERROR',
				},
			]
		}

		return this.originalError.errors.map((error) => ({
			path: error.path.join('.'),
			message: error.message,
			code: error.code,
		}))
	}
}

// ============================================================================
// API Validation Functions
// ============================================================================

/**
 * Validates audit event data
 */
export const validateAuditEvent = createValidator(AuditEventSchema)

/**
 * Validates create audit event input
 */
export const validateCreateAuditEventInput = createValidator(CreateAuditEventInputSchema)

/**
 * Validates query audit events parameters
 */
export const validateQueryAuditEventsParams = createValidator(QueryAuditEventsParamsSchema)

/**
 * Validates bulk create audit events input
 */
export const validateBulkCreateAuditEventsInput = createValidator(BulkCreateAuditEventsInputSchema)

/**
 * Validates export events parameters
 */
export const validateExportEventsParams = createValidator(ExportEventsParamsSchema)

/**
 * Validates stream events parameters
 */
export const validateStreamEventsParams = createValidator(StreamEventsParamsSchema)

/**
 * Validates subscription parameters
 */
export const validateSubscriptionParams = createValidator(SubscriptionParamsSchema)

/**
 * Validates statistics parameters
 */
export const validateStatisticsParams = createValidator(StatisticsParamsSchema)

/**
 * Validates integrity verification result
 */
export const validateIntegrityVerificationResult = createValidator(
	IntegrityVerificationResultSchema
)

// ============================================================================
// Compliance Validation Functions
// ============================================================================

/**
 * Validates report criteria
 */
export const validateReportCriteria = createValidator(ReportCriteriaSchema)

/**
 * Validates HIPAA report
 */
export const validateHIPAAReport = createValidator(HIPAAReportSchema)

/**
 * Validates GDPR report
 */
export const validateGDPRReport = createValidator(GDPRReportSchema)

/**
 * Validates custom report parameters
 */
export const validateCustomReportParams = createValidator(CustomReportParamsSchema)

/**
 * Validates GDPR export parameters
 */
export const validateGdprExportParams = createValidator(GdprExportParamsSchema)

/**
 * Validates pseudonymization parameters
 */
export const validatePseudonymizationParams = createValidator(PseudonymizationParamsSchema)

/**
 * Validates report template
 */
export const validateReportTemplate = createValidator(ReportTemplateSchema)

// ============================================================================
// Scheduled Reports Validation Functions
// ============================================================================

/**
 * Validates scheduled report
 */
export const validateScheduledReport = createValidator(ScheduledReportSchema)

/**
 * Validates create scheduled report input
 */
export const validateCreateScheduledReportInput = createValidator(CreateScheduledReportInputSchema)

/**
 * Validates update scheduled report input
 */
export const validateUpdateScheduledReportInput = createValidator(UpdateScheduledReportInputSchema)

/**
 * Validates schedule configuration
 */
export const validateScheduleConfig = createValidator(ScheduleConfigSchema)

/**
 * Validates delivery configuration
 */
export const validateDeliveryConfig = createValidator(DeliveryConfigSchema)

/**
 * Validates execution history parameters
 */
export const validateExecutionHistoryParams = createValidator(ExecutionHistoryParamsSchema)

/**
 * Validates list scheduled reports parameters
 */
export const validateListScheduledReportsParams = createValidator(ListScheduledReportsParamsSchema)

// ============================================================================
// Presets Validation Functions
// ============================================================================

/**
 * Validates audit preset
 */
export const validateAuditPreset = createValidator(AuditPresetSchema)

/**
 * Validates create audit preset input
 */
export const validateCreateAuditPresetInput = createValidator(CreateAuditPresetInputSchema)

/**
 * Validates update audit preset input
 */
export const validateUpdateAuditPresetInput = createValidator(UpdateAuditPresetInputSchema)

/**
 * Validates preset context
 */
export const validatePresetContext = createValidator(PresetContextSchema)

/**
 * Validates preset template
 */
export const validatePresetTemplate = createValidator(PresetTemplateSchema)

/**
 * Validates preset validation configuration
 */
export const validatePresetValidation = createValidator(PresetValidationSchema)

/**
 * Validates preset export parameters
 */
export const validatePresetExportParams = createValidator(PresetExportParamsSchema)

/**
 * Validates preset import parameters
 */
export const validatePresetImportParams = createValidator(PresetImportParamsSchema)

// ============================================================================
// Metrics Validation Functions
// ============================================================================

/**
 * Validates system metrics
 */
export const validateSystemMetrics = createValidator(SystemMetricsSchema)

/**
 * Validates audit metrics parameters
 */
export const validateAuditMetricsParams = createValidator(AuditMetricsParamsSchema)

/**
 * Validates usage metrics parameters
 */
export const validateUsageMetricsParams = createValidator(UsageMetricsParamsSchema)

/**
 * Validates alerts parameters
 */
export const validateAlertsParams = createValidator(AlertsParamsSchema)

/**
 * Validates alert
 */
export const validateAlert = createValidator(AlertSchema)

// ============================================================================
// Health Validation Functions
// ============================================================================

/**
 * Validates health status
 */
export const validateHealthStatus = createValidator(HealthStatusSchema)

/**
 * Validates detailed health status
 */
export const validateDetailedHealthStatus = createValidator(DetailedHealthStatusSchema)

/**
 * Validates readiness status
 */
export const validateReadinessStatus = createValidator(ReadinessStatusSchema)

/**
 * Validates version information
 */
export const validateVersionInfo = createValidator(VersionInfoSchema)

// ============================================================================
// Composite Validation Functions
// ============================================================================

/**
 * Validates multiple audit events at once
 */
export function validateMultipleAuditEvents(
	events: unknown[]
): ValidationResult<import('../types/api').AuditEvent[]> {
	const validatedEvents: import('../types/api').AuditEvent[] = []

	for (let index = 0; index < events.length; index++) {
		const result = validateAuditEvent(events[index])
		if (!result.success) {
			return {
				success: false,
				error: {
					...result.error!,
					path: [`[${index}]`, ...(result.error!.path || [])],
				},
			}
		}
		validatedEvents.push(result.data!)
	}

	return {
		success: true,
		data: validatedEvents,
	}
}

/**
 * Validates a batch of create audit event inputs
 */
export function validateBatchCreateInputs(
	inputs: unknown[]
): ValidationResult<import('../types/api').CreateAuditEventInput[]> {
	const validatedInputs: import('../types/api').CreateAuditEventInput[] = []

	for (let index = 0; index < inputs.length; index++) {
		const result = validateCreateAuditEventInput(inputs[index])
		if (!result.success) {
			return {
				success: false,
				error: {
					...result.error!,
					path: [`[${index}]`, ...(result.error!.path || [])],
				},
			}
		}
		validatedInputs.push(result.data!)
	}

	return {
		success: true,
		data: validatedInputs,
	}
}

// ============================================================================
// Runtime Type Guards with Validation
// ============================================================================

/**
 * Type guard that validates and narrows type for audit events
 */
export function isValidAuditEvent(value: unknown): value is import('../types/api').AuditEvent {
	return validateAuditEvent(value).success
}

/**
 * Type guard that validates and narrows type for create audit event input
 */
export function isValidCreateAuditEventInput(
	value: unknown
): value is import('../types/api').CreateAuditEventInput {
	return validateCreateAuditEventInput(value).success
}

/**
 * Type guard that validates and narrows type for query parameters
 */
export function isValidQueryAuditEventsParams(
	value: unknown
): value is import('../types/api').QueryAuditEventsParams {
	return validateQueryAuditEventsParams(value).success
}

/**
 * Type guard that validates and narrows type for scheduled reports
 */
export function isValidScheduledReport(
	value: unknown
): value is import('../types/scheduled-reports').ScheduledReport {
	return validateScheduledReport(value).success
}

/**
 * Type guard that validates and narrows type for audit presets
 */
export function isValidAuditPreset(
	value: unknown
): value is import('../types/presets').AuditPreset {
	return validateAuditPreset(value).success
}

/**
 * Type guard that validates and narrows type for preset context
 */
export function isValidPresetContext(
	value: unknown
): value is import('../types/presets').PresetContext {
	return validatePresetContext(value).success
}

// ============================================================================
// Validation Middleware
// ============================================================================

/**
 * Creates validation middleware for request/response validation
 */
export function createValidationMiddleware<T>(
	schema: z.ZodSchema<T>,
	options: {
		validateRequest?: boolean
		validateResponse?: boolean
		throwOnError?: boolean
	} = {}
) {
	const { validateRequest = true, validateResponse = false, throwOnError = true } = options

	return {
		request: validateRequest
			? (data: unknown) => {
					const result = validateSafely(schema, data)
					if (!result.success && throwOnError) {
						throw new ValidationError(result.error!.message, {
							...(result.error!.path && { path: result.error!.path }),
							...(result.error!.code && { code: result.error!.code }),
						})
					}
					return result
				}
			: undefined,

		response: validateResponse
			? (data: unknown) => {
					const result = validateSafely(schema, data)
					if (!result.success && throwOnError) {
						throw new ValidationError(result.error!.message, {
							...(result.error!.path && { path: result.error!.path }),
							...(result.error!.code && { code: result.error!.code }),
						})
					}
					return result
				}
			: undefined,
	}
}

// ============================================================================
// Schema Registry for Dynamic Validation
// ============================================================================

/**
 * Schema registry for dynamic validation
 */
export class SchemaRegistry {
	private schemas = new Map<string, z.ZodSchema<any>>()

	/**
	 * Registers a schema with a name
	 */
	register<T>(name: string, schema: z.ZodSchema<T>): void {
		this.schemas.set(name, schema)
	}

	/**
	 * Gets a schema by name
	 */
	get<T>(name: string): z.ZodSchema<T> | undefined {
		return this.schemas.get(name)
	}

	/**
	 * Validates data against a registered schema
	 */
	validate<T>(schemaName: string, data: unknown): ValidationResult<T> {
		const schema = this.get<T>(schemaName)
		if (!schema) {
			return {
				success: false,
				error: {
					message: `Schema '${schemaName}' not found`,
					code: 'SCHEMA_NOT_FOUND',
				},
			}
		}

		return validateSafely(schema, data)
	}

	/**
	 * Lists all registered schema names
	 */
	list(): string[] {
		return Array.from(this.schemas.keys())
	}

	/**
	 * Removes a schema from the registry
	 */
	unregister(name: string): boolean {
		return this.schemas.delete(name)
	}

	/**
	 * Clears all schemas from the registry
	 */
	clear(): void {
		this.schemas.clear()
	}
}

// Create and export a default schema registry with all schemas pre-registered
export const defaultSchemaRegistry = new SchemaRegistry()

// Register all schemas
defaultSchemaRegistry.register('AuditEvent', AuditEventSchema)
defaultSchemaRegistry.register('CreateAuditEventInput', CreateAuditEventInputSchema)
defaultSchemaRegistry.register('QueryAuditEventsParams', QueryAuditEventsParamsSchema)
defaultSchemaRegistry.register('BulkCreateAuditEventsInput', BulkCreateAuditEventsInputSchema)
defaultSchemaRegistry.register('ExportEventsParams', ExportEventsParamsSchema)
defaultSchemaRegistry.register('StreamEventsParams', StreamEventsParamsSchema)
defaultSchemaRegistry.register('SubscriptionParams', SubscriptionParamsSchema)
defaultSchemaRegistry.register('StatisticsParams', StatisticsParamsSchema)
defaultSchemaRegistry.register('IntegrityVerificationResult', IntegrityVerificationResultSchema)

defaultSchemaRegistry.register('ReportCriteria', ReportCriteriaSchema)
defaultSchemaRegistry.register('HIPAAReport', HIPAAReportSchema)
defaultSchemaRegistry.register('GDPRReport', GDPRReportSchema)
defaultSchemaRegistry.register('CustomReportParams', CustomReportParamsSchema)
defaultSchemaRegistry.register('GdprExportParams', GdprExportParamsSchema)
defaultSchemaRegistry.register('PseudonymizationParams', PseudonymizationParamsSchema)
defaultSchemaRegistry.register('ReportTemplate', ReportTemplateSchema)

defaultSchemaRegistry.register('ScheduledReport', ScheduledReportSchema)
defaultSchemaRegistry.register('CreateScheduledReportInput', CreateScheduledReportInputSchema)
defaultSchemaRegistry.register('UpdateScheduledReportInput', UpdateScheduledReportInputSchema)
defaultSchemaRegistry.register('ScheduleConfig', ScheduleConfigSchema)
defaultSchemaRegistry.register('DeliveryConfig', DeliveryConfigSchema)
defaultSchemaRegistry.register('ExecutionHistoryParams', ExecutionHistoryParamsSchema)
defaultSchemaRegistry.register('ListScheduledReportsParams', ListScheduledReportsParamsSchema)

defaultSchemaRegistry.register('AuditPreset', AuditPresetSchema)
defaultSchemaRegistry.register('CreateAuditPresetInput', CreateAuditPresetInputSchema)
defaultSchemaRegistry.register('UpdateAuditPresetInput', UpdateAuditPresetInputSchema)
defaultSchemaRegistry.register('PresetContext', PresetContextSchema)
defaultSchemaRegistry.register('PresetTemplate', PresetTemplateSchema)
defaultSchemaRegistry.register('PresetValidation', PresetValidationSchema)
defaultSchemaRegistry.register('PresetExportParams', PresetExportParamsSchema)
defaultSchemaRegistry.register('PresetImportParams', PresetImportParamsSchema)

defaultSchemaRegistry.register('SystemMetrics', SystemMetricsSchema)
defaultSchemaRegistry.register('AuditMetricsParams', AuditMetricsParamsSchema)
defaultSchemaRegistry.register('UsageMetricsParams', UsageMetricsParamsSchema)
defaultSchemaRegistry.register('AlertsParams', AlertsParamsSchema)
defaultSchemaRegistry.register('Alert', AlertSchema)

defaultSchemaRegistry.register('HealthStatus', HealthStatusSchema)
defaultSchemaRegistry.register('DetailedHealthStatus', DetailedHealthStatusSchema)
defaultSchemaRegistry.register('ReadinessStatus', ReadinessStatusSchema)
defaultSchemaRegistry.register('VersionInfo', VersionInfoSchema)
