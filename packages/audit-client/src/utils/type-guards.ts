import type {
	ApiError,
	AuditEvent,
	AuditEventStatus,
	BulkCreateResult,
	CreateAuditEventInput,
	DataClassification,
	ExportResult,
	IntegrityVerificationResult,
	PaginatedAuditEvents,
	QueryAuditEventsParams,
	ValidationErrorResponse,
} from '../types/api'
import type {
	CustomReport,
	GdprExportResult,
	GDPRReport,
	HIPAAReport,
	PseudonymizationResult,
	ReportCriteria,
	ReportFormat,
	ReportStatus,
	ReportType,
} from '../types/compliance'
import type {
	DetailedHealthStatus,
	HealthStatus,
	ReadinessStatus,
	VersionInfo,
} from '../types/health'
import type {
	Alert,
	AlertCategory,
	AlertSeverity,
	AlertStatus,
	AuditMetrics,
	PaginatedAlerts,
	PerformanceMetrics,
	SystemMetrics,
	UsageMetrics,
} from '../types/metrics'
import type {
	AuditPreset,
	CreateAuditPresetInput,
	PresetApplicationResult,
	PresetCategory,
	PresetContext,
	UpdateAuditPresetInput,
	ValidationRule,
} from '../types/presets'
import type {
	CreateScheduledReportInput,
	PaginatedExecutions,
	ReportExecution,
	ScheduledReport,
	ScheduleFrequency,
	UpdateScheduledReportInput,
} from '../types/scheduled-reports'
import type { ExecutionStatus, ExecutionTrigger } from '../types/shared-schemas'
import type {
	ContentType,
	Email,
	Environment,
	HttpMethod,
	HttpStatusCode,
	ISODateTime,
	LogLevel,
	URL,
	UUID,
} from '../types/utils'

// ============================================================================
// Basic Type Guards
// ============================================================================

/**
 * Type guard for checking if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined
}

/**
 * Type guard for checking if a value is a string
 */
export function isString(value: unknown): value is string {
	return typeof value === 'string'
}

/**
 * Type guard for checking if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
	return isString(value) && value.length > 0
}

/**
 * Type guard for checking if a value is a number
 */
export function isNumber(value: unknown): value is number {
	return typeof value === 'number' && !isNaN(value)
}

/**
 * Type guard for checking if a value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
	return isNumber(value) && value > 0
}

/**
 * Type guard for checking if a value is a non-negative number
 */
export function isNonNegativeNumber(value: unknown): value is number {
	return isNumber(value) && value >= 0
}

/**
 * Type guard for checking if a value is an integer
 */
export function isInteger(value: unknown): value is number {
	return isNumber(value) && Number.isInteger(value)
}

/**
 * Type guard for checking if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean'
}

/**
 * Type guard for checking if a value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Type guard for checking if a value is an array
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
	return Array.isArray(value)
}

/**
 * Type guard for checking if a value is a non-empty array
 */
export function isNonEmptyArray<T = unknown>(value: unknown): value is [T, ...T[]] {
	return isArray(value) && value.length > 0
}

/**
 * Type guard for checking if a value is a function
 */
export function isFunction(value: unknown): value is Function {
	return typeof value === 'function'
}

/**
 * Type guard for checking if a value is a promise
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
	return value instanceof Promise || (isObject(value) && isFunction((value as any).then))
}

/**
 * Type guard for checking if a value is a date
 */
export function isDate(value: unknown): value is Date {
	return value instanceof Date && !isNaN(value.getTime())
}

/**
 * Type guard for checking if a value is a valid date string
 */
export function isDateString(value: unknown): value is string {
	return isString(value) && !isNaN(Date.parse(value))
}

/**
 * Type guard that checks if a string starts with a given prefix
 */
export function startsWith(value: unknown, prefix: string): value is string {
	return isString(value) && value.length >= prefix.length && value.startsWith(prefix)
}

// ============================================================================
// Format-Specific Type Guards
// ============================================================================

/**
 * Type guard for UUID format
 */
export function isUUID(value: unknown): value is UUID {
	return (
		isString(value) &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
	)
}

/**
 * Type guard for email format
 */
export function isEmail(value: unknown): value is Email {
	return isString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Type guard for URL format
 */
export function isURL(value: unknown): value is URL {
	if (!isString(value)) return false
	try {
		new URL(value)
		return true
	} catch {
		return false
	}
}

/**
 * Type guard for ISO datetime format
 */
export function isISODateTime(value: unknown): value is ISODateTime {
	return (
		isString(value) &&
		!isNaN(Date.parse(value)) &&
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(value)
	)
}

/**
 * Type guard for IP address format
 */
export function isIPAddress(value: unknown): value is string {
	if (!isString(value)) return false

	// IPv4 regex
	const ipv4Regex =
		/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

	// IPv6 regex (simplified)
	const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/

	return ipv4Regex.test(value) || ipv6Regex.test(value)
}

/**
 * Type guard for base64 format
 */
export function isBase64(value: unknown): value is string {
	if (!isString(value)) return false
	try {
		return btoa(atob(value)) === value
	} catch {
		return false
	}
}

/**
 * Type guard for JSON string format
 */
export function isJSONString(value: unknown): value is string {
	if (!isString(value)) return false
	try {
		JSON.parse(value)
		return true
	} catch {
		return false
	}
}

// ============================================================================
// Enum Type Guards
// ============================================================================

/**
 * Type guard for data classification
 */
export function isDataClassification(value: unknown): value is DataClassification {
	return isString(value) && ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'].includes(value)
}

/**
 * Type guard for audit event status
 */
export function isAuditEventStatus(value: unknown): value is AuditEventStatus {
	return isString(value) && ['attempt', 'success', 'failure'].includes(value)
}

/**
 * Type guard for report type
 */
export function isReportType(value: unknown): value is ReportType {
	return isString(value) && ['hipaa', 'gdpr', 'sox', 'pci', 'iso27001', 'custom'].includes(value)
}

/**
 * Type guard for report status
 */
export function isReportStatus(value: unknown): value is ReportStatus {
	return (
		isString(value) && ['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(value)
	)
}

/**
 * Type guard for report format
 */
export function isReportFormat(value: unknown): value is ReportFormat {
	return isString(value) && ['pdf', 'html', 'csv', 'json', 'xlsx', 'xml'].includes(value)
}

/**
 * Type guard for execution status
 */
export function isExecutionStatus(value: unknown): value is ExecutionStatus {
	return (
		isString(value) &&
		['pending', 'running', 'completed', 'failed', 'cancelled', 'skipped', 'timeout'].includes(value)
	)
}

/**
 * Type guard for execution trigger
 */
export function isExecutionTrigger(value: unknown): value is ExecutionTrigger {
	return isString(value) && ['scheduled', 'manual', 'api', 'retry', 'catchup'].includes(value)
}

/**
 * Type guard for schedule frequency
 */
export function isScheduleFrequency(value: unknown): value is ScheduleFrequency {
	return (
		isString(value) &&
		['once', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'].includes(
			value
		)
	)
}

/**
 * Type guard for preset category
 */
export function isPresetCategory(value: unknown): value is PresetCategory {
	return (
		isString(value) &&
		[
			'authentication',
			'authorization',
			'data_access',
			'data_modification',
			'system_administration',
			'compliance',
			'security',
			'user_management',
			'configuration',
			'monitoring',
			'custom',
		].includes(value)
	)
}

/**
 * Type guard for alert severity
 */
export function isAlertSeverity(value: unknown): value is AlertSeverity {
	return isString(value) && ['low', 'medium', 'high', 'critical'].includes(value)
}

/**
 * Type guard for alert status
 */
export function isAlertStatus(value: unknown): value is AlertStatus {
	return isString(value) && ['active', 'acknowledged', 'resolved', 'suppressed'].includes(value)
}

/**
 * Type guard for alert category
 */
export function isAlertCategory(value: unknown): value is AlertCategory {
	return (
		isString(value) &&
		[
			'performance',
			'security',
			'compliance',
			'system',
			'data_quality',
			'availability',
			'capacity',
			'custom',
		].includes(value)
	)
}

/**
 * Type guard for HTTP method
 */
export function isHttpMethod(value: unknown): value is HttpMethod {
	return (
		isString(value) && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(value)
	)
}

/**
 * Type guard for HTTP status code
 */
export function isHttpStatusCode(value: unknown): value is HttpStatusCode {
	return isNumber(value) && value >= 100 && value < 600
}

/**
 * Type guard for content type
 */
export function isContentType(value: unknown): value is ContentType {
	return (
		isString(value) &&
		[
			'application/json',
			'application/xml',
			'application/x-www-form-urlencoded',
			'multipart/form-data',
			'text/plain',
			'text/html',
			'text/csv',
		].includes(value)
	)
}

/**
 * Type guard for log level
 */
export function isLogLevel(value: unknown): value is LogLevel {
	return isString(value) && ['debug', 'info', 'warn', 'error'].includes(value)
}

/**
 * Type guard for environment
 */
export function isEnvironment(value: unknown): value is Environment {
	return isString(value) && ['development', 'staging', 'production', 'test'].includes(value)
}

// ============================================================================
// Complex Object Type Guards
// ============================================================================

/**
 * Type guard for audit event
 */
export function isAuditEvent(value: unknown): value is AuditEvent {
	if (!isObject(value)) return false

	const event = value as any
	return (
		// FIXME: the id is serial
		isUUID(event.id) &&
		isISODateTime(event.timestamp) &&
		isNonEmptyString(event.action) &&
		isNonEmptyString(event.targetResourceType) &&
		isNonEmptyString(event.principalId) &&
		isNonEmptyString(event.organizationId) &&
		isAuditEventStatus(event.status) &&
		isDataClassification(event.dataClassification)
	)
}

/**
 * Type guard for create audit event input
 */
export function isCreateAuditEventInput(value: unknown): value is CreateAuditEventInput {
	if (!isObject(value)) return false

	const input = value as any
	return (
		isNonEmptyString(input.action) &&
		isNonEmptyString(input.targetResourceType) &&
		isNonEmptyString(input.principalId) &&
		isNonEmptyString(input.organizationId) &&
		isAuditEventStatus(input.status) &&
		isDataClassification(input.dataClassification)
	)
}

/**
 * Type guard for paginated audit events
 */
export function isPaginatedAuditEvents(value: unknown): value is PaginatedAuditEvents {
	if (!isObject(value)) return false

	const paginated = value as any
	return (
		isArray(paginated.events) &&
		paginated.events.every(isAuditEvent) &&
		isObject(paginated.pagination) &&
		isNonNegativeNumber(paginated.pagination.total) &&
		isPositiveNumber(paginated.pagination.limit) &&
		isNonNegativeNumber(paginated.pagination.offset) &&
		isBoolean(paginated.pagination.hasNext) &&
		isBoolean(paginated.pagination.hasPrevious)
	)
}

/**
 * Type guard for bulk create result
 */
export function isBulkCreateResult(value: unknown): value is BulkCreateResult {
	if (!isObject(value)) return false

	const result = value as any
	return (
		isUUID(result.requestId) &&
		isNonNegativeNumber(result.total) &&
		isNonNegativeNumber(result.successful) &&
		isNonNegativeNumber(result.failed) &&
		isArray(result.results) &&
		isNonNegativeNumber(result.processingTime)
	)
}

/**
 * Type guard for export result
 */
export function isExportResult(value: unknown): value is ExportResult {
	if (!isObject(value)) return false

	const result = value as any
	return (
		startsWith(result.exportId, 'export-') &&
		isNonNegativeNumber(result.recordCount) &&
		isNonNegativeNumber(result.dataSize) &&
		isNonEmptyString(result.format) &&
		isISODateTime(result.exportTimestamp)
	)
}

/**
 * Type guard for integrity verification result
 */
export function isIntegrityVerificationResult(
	value: unknown
): value is IntegrityVerificationResult {
	if (!isObject(value)) return false

	const result = value as any
	return (
		// FIXME: ebent ID is serial
		isUUID(result.eventId) &&
		isBoolean(result.isValid) &&
		isISODateTime(result.verificationTimestamp) &&
		isNonEmptyString(result.hashAlgorithm) &&
		isNonEmptyString(result.computedHash) &&
		isNonEmptyString(result.storedHash)
	)
}

/**
 * Type guard for API error
 */
export function isApiError(value: unknown): value is ApiError {
	if (!isObject(value)) return false

	const error = value as any
	return (
		isNonEmptyString(error.code) &&
		isNonEmptyString(error.message) &&
		isISODateTime(error.timestamp)
	)
}

/**
 * Type guard for validation error response
 */
export function isValidationErrorResponse(value: unknown): value is ValidationErrorResponse {
	if (!isObject(value)) return false

	const error = value as any
	return (
		error.code === 'VALIDATION_ERROR' &&
		isNonEmptyString(error.message) &&
		isArray(error.errors) &&
		isISODateTime(error.timestamp)
	)
}

/**
 * Type guard for scheduled report
 */
export function isScheduledReport(value: unknown): value is ScheduledReport {
	if (!isObject(value)) return false

	const report = value as any
	return (
		startsWith(report.id, 'report-') &&
		isNonEmptyString(report.name) &&
		isReportType(report.reportType) &&
		isObject(report.criteria) &&
		isReportFormat(report.format) &&
		isObject(report.schedule) &&
		isObject(report.delivery) &&
		isBoolean(report.enabled) &&
		isISODateTime(report.createdAt) &&
		isISODateTime(report.updatedAt) &&
		isISODateTime(report.nextExecution)
	)
}

/**
 * Type guard for report execution
 */
export function isReportExecution(value: unknown): value is ReportExecution {
	if (!isObject(value)) return false

	const execution = value as any
	return (
		startsWith(execution.id, 'execution-') &&
		startsWith(execution.scheduledReportId, 'report-') &&
		isExecutionStatus(execution.status) &&
		isExecutionTrigger(execution.trigger) &&
		isISODateTime(execution.scheduledAt)
	)
}

/**
 * Type guard for audit preset
 */
export function isAuditPreset(value: unknown): value is AuditPreset {
	if (!isObject(value)) return false

	const preset = value as any
	return (
		isNonEmptyString(preset.name) &&
		isObject(preset.template) &&
		isObject(preset.validation) &&
		isObject(preset.metadata) &&
		isBoolean(preset.enabled)
	)
}

/**
 * Type guard for preset context
 */
export function isPresetContext(value: unknown): value is PresetContext {
	if (!isObject(value)) return false

	const context = value as any
	return isNonEmptyString(context.principalId) && isNonEmptyString(context.organizationId)
}

/**
 * Type guard for system metrics
 */
export function isSystemMetrics(value: unknown): value is SystemMetrics {
	if (!isObject(value)) return false

	const metrics = value as any
	return (
		isISODateTime(metrics.timestamp) &&
		isNonNegativeNumber(metrics.uptime) &&
		isObject(metrics.server) &&
		isObject(metrics.database) &&
		isObject(metrics.cache) &&
		isObject(metrics.api)
	)
}

/**
 * Type guard for health status
 */
export function isHealthStatus(value: unknown): value is HealthStatus {
	if (!isObject(value)) return false

	const status = value as any
	return (
		isString(status.status) &&
		isISODateTime(status.timestamp) &&
		isString(status.environment) &&
		isNonNegativeNumber(status.uptime) &&
		(status.version === undefined || isString(status.version))
	)
}

/**
 * Type guard for detailed health status
 */
export function isDetailedHealthStatus(value: unknown): value is DetailedHealthStatus {
	if (!isObject(value)) return false

	const status = value as any
	return (
		isString(status.status) &&
		isISODateTime(status.timestamp) &&
		isNonNegativeNumber(status.uptime) &&
		isString(status.version) &&
		isObject(status.details)
	)
}

/**
 * Type guard for alert
 */
export function isAlert(value: unknown): value is Alert {
	if (!isObject(value)) return false

	// FIXME: the alert type is wrong
	const alert = value as any
	return (
		startsWith(alert.id, 'alert-') &&
		isNonEmptyString(alert.title) &&
		isAlertSeverity(alert.severity) &&
		isAlertStatus(alert.status) &&
		isAlertCategory(alert.category) &&
		isObject(alert.condition) &&
		isISODateTime(alert.triggeredAt) &&
		isISODateTime(alert.lastUpdated)
	)
}

// ============================================================================
// Generic Type Guards
// ============================================================================

/**
 * Creates a type guard that checks if all items in an array match a predicate
 */
export function isArrayOf<T>(predicate: (value: unknown) => value is T) {
	return (value: unknown): value is T[] => {
		return isArray(value) && value.every(predicate)
	}
}

/**
 * Creates a type guard that checks if a value is one of the provided values
 */
export function isOneOf<T extends readonly unknown[]>(...values: T) {
	return (value: unknown): value is T[number] => {
		return values.includes(value as any)
	}
}

/**
 * Creates a type guard that checks if an object has specific properties
 */
export function hasProperties<T extends Record<string, unknown>>(properties: (keyof T)[]) {
	return (value: unknown): value is T => {
		if (!isObject(value)) return false
		return properties.every((prop) => prop in value)
	}
}

/**
 * Creates a type guard that checks if an object has all required properties with specific types
 */
export function hasTypedProperties<T extends Record<string, unknown>>(propertyChecks: {
	[K in keyof T]: (value: unknown) => value is T[K]
}) {
	return (value: unknown): value is T => {
		if (!isObject(value)) return false

		return Object.entries(propertyChecks).every(([key, check]) => {
			return key in value && check((value as any)[key])
		})
	}
}

/**
 * Creates a type guard for optional properties
 */
export function isOptional<T>(predicate: (value: unknown) => value is T) {
	return (value: unknown): value is T | undefined => {
		return value === undefined || predicate(value)
	}
}

/**
 * Creates a type guard for nullable properties
 */
export function isNullable<T>(predicate: (value: unknown) => value is T) {
	return (value: unknown): value is T | null => {
		return value === null || predicate(value)
	}
}

/**
 * Creates a type guard for optional and nullable properties
 */
export function isOptionalNullable<T>(predicate: (value: unknown) => value is T) {
	return (value: unknown): value is T | null | undefined => {
		return value === null || value === undefined || predicate(value)
	}
}

// ============================================================================
// Utility Functions for Type Narrowing
// ============================================================================

/**
 * Asserts that a value is defined, throwing an error if not
 */
export function assertDefined<T>(
	value: T | null | undefined,
	message?: string
): asserts value is T {
	if (!isDefined(value)) {
		throw new Error(message || 'Value is null or undefined')
	}
}

/**
 * Asserts that a value matches a type guard, throwing an error if not
 */
export function assertType<T>(
	value: unknown,
	predicate: (value: unknown) => value is T,
	message?: string
): asserts value is T {
	if (!predicate(value)) {
		throw new Error(message || 'Value does not match expected type')
	}
}

/**
 * Filters an array to only include items that match a type guard
 */
export function filterByType<T>(array: unknown[], predicate: (value: unknown) => value is T): T[] {
	return array.filter(predicate)
}

/**
 * Maps an array, filtering out items that don't match a type guard
 */
export function mapAndFilter<T, U>(
	array: unknown[],
	predicate: (value: unknown) => value is T,
	mapper: (value: T) => U
): U[] {
	return array.filter(predicate).map(mapper)
}

/**
 * Finds the first item in an array that matches a type guard
 */
export function findByType<T>(
	array: unknown[],
	predicate: (value: unknown) => value is T
): T | undefined {
	return array.find(predicate)
}

/**
 * Checks if any item in an array matches a type guard
 */
export function someByType<T>(
	array: unknown[],
	predicate: (value: unknown) => value is T
): boolean {
	return array.some(predicate)
}

/**
 * Checks if all items in an array match a type guard
 */
export function everyByType<T>(
	array: unknown[],
	predicate: (value: unknown) => value is T
): array is T[] {
	return array.every(predicate)
}
