/**
 * Form Data Transformation Utilities
 *
 * Transforms form data from the UI format to API-compatible formats
 * for scheduled report creation and updates.
 */

import type {
	CreateScheduledReportInput,
	DeliveryConfig,
	ExportConfig,
	NotificationConfig,
	ReportCriteria,
	ReportFormat,
	ReportType,
	ScheduleConfig,
	UpdateScheduledReportInput,
} from '@smedrec/audit-client'

/**
 * Form data structure from ReportConfigurationForm
 */
export interface ReportFormData {
	// Basic Information
	name: string
	description: string
	reportType: ReportType
	format: string // Will be transformed to ReportFormat

	// Schedule Configuration
	schedule: {
		frequency:
			| 'once'
			| 'hourly'
			| 'daily'
			| 'weekly'
			| 'monthly'
			| 'quarterly'
			| 'yearly'
			| 'custom'
		time: string // HH:MM format
		dayOfWeek?: number // 0-6
		dayOfMonth?: number // 1-31
		timezone: string
		cronExpression?: string
		startDate?: string
		endDate?: string
		skipWeekends?: boolean
		skipHolidays?: boolean
		holidayCalendar?: string
		maxMissedRuns?: number
		catchUpMissedRuns?: boolean
	}

	// Notifications
	notifications: {
		onSuccess: boolean
		onFailure: boolean
		onSkip?: boolean
		recipients: string[]
		includeReport?: boolean
		customMessage?: string
	}

	// Report Parameters
	parameters: {
		dateRange?: {
			startDate: string
			endDate: string
		}
		organizationIds?: string[]
		principalIds?: string[]
		actions?: string[]
		resourceTypes?: string[]
		dataClassifications?: Array<'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'>
		statuses?: Array<'attempt' | 'success' | 'failure'>
		verifiedOnly?: boolean
		includeIntegrityFailures?: boolean
		limit?: number
		offset?: number
		sortBy?: 'timestamp' | 'status'
		sortOrder?: 'asc' | 'desc'
	}

	// Delivery Configuration
	delivery?: {
		destinations: string[] | 'default'
	}

	// Export Configuration
	export?: {
		includeMetadata?: boolean
		includeIntegrityReport?: boolean
		compression?: 'none' | 'gzip' | 'zip' | 'bzip2'
		encryption?: {
			enabled: boolean
			algorithm?: string
			keyId?: string
		}
	}

	// Metadata
	enabled?: boolean
	tags?: string[]
	metadata?: Record<string, any>
	templateId?: string
}

/**
 * Transforms form time (HH:MM) to hour and minute
 */
function parseTimeString(time: string): { hour: number; minute: number } {
	const [hourStr, minuteStr] = time.split(':')
	return {
		hour: parseInt(hourStr, 10) || 0,
		minute: parseInt(minuteStr, 10) || 0,
	}
}

/**
 * Maps day of week number to DayOfWeek enum
 */
function mapDayOfWeek(
	dayOfWeek?: number
): 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | undefined {
	if (dayOfWeek === undefined) return undefined

	const days = [
		'sunday',
		'monday',
		'tuesday',
		'wednesday',
		'thursday',
		'friday',
		'saturday',
	] as const
	return days[dayOfWeek]
}

/**
 * Transforms schedule configuration from form format to API format
 */
function transformScheduleConfig(schedule: ReportFormData['schedule']): ScheduleConfig {
	const { hour, minute } = parseTimeString(schedule.time)

	const config: ScheduleConfig = {
		frequency: schedule.frequency,
		timezone: schedule.timezone,
		hour,
		minute,
		skipWeekends: schedule.skipWeekends ?? false,
		skipHolidays: schedule.skipHolidays ?? false,
		maxMissedRuns: schedule.maxMissedRuns ?? 3,
		catchUpMissedRuns: schedule.catchUpMissedRuns ?? false,
	}

	// Add optional fields based on frequency
	if (schedule.frequency === 'custom' && schedule.cronExpression) {
		config.cronExpression = schedule.cronExpression
	}

	if (schedule.frequency === 'weekly' && schedule.dayOfWeek !== undefined) {
		config.dayOfWeek = mapDayOfWeek(schedule.dayOfWeek)
	}

	if (schedule.frequency === 'monthly' && schedule.dayOfMonth !== undefined) {
		config.dayOfMonth = schedule.dayOfMonth
	}

	if (schedule.startDate) {
		config.startDate = schedule.startDate
	}

	if (schedule.endDate) {
		config.endDate = schedule.endDate
	}

	if (schedule.holidayCalendar) {
		config.holidayCalendar = schedule.holidayCalendar
	}

	return config
}

/**
 * Transforms notification configuration from form format to API format
 */
function transformNotificationConfig(
	notifications: ReportFormData['notifications']
): NotificationConfig | undefined {
	// Only include notifications if there are recipients
	if (!notifications.recipients || notifications.recipients.length === 0) {
		return undefined
	}

	return {
		recipients: notifications.recipients,
		onSuccess: notifications.onSuccess,
		onFailure: notifications.onFailure,
		onSkip: notifications.onSkip,
		includeReport: notifications.includeReport,
		customMessage: notifications.customMessage,
	}
}

/**
 * Transforms report criteria from form parameters to API format
 */
function transformReportCriteria(parameters: ReportFormData['parameters']): ReportCriteria {
	const criteria: ReportCriteria = {
		dateRange: parameters.dateRange || {
			startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Default: last 30 days
			endDate: new Date().toISOString(),
		},
		verifiedOnly: parameters.verifiedOnly ?? false,
		includeIntegrityFailures: parameters.includeIntegrityFailures ?? true,
	}

	// Add optional filter fields
	if (parameters.organizationIds && parameters.organizationIds.length > 0) {
		criteria.organizationIds = parameters.organizationIds
	}

	if (parameters.principalIds && parameters.principalIds.length > 0) {
		criteria.principalIds = parameters.principalIds
	}

	if (parameters.actions && parameters.actions.length > 0) {
		criteria.actions = parameters.actions
	}

	if (parameters.resourceTypes && parameters.resourceTypes.length > 0) {
		criteria.resourceTypes = parameters.resourceTypes
	}

	if (parameters.dataClassifications && parameters.dataClassifications.length > 0) {
		criteria.dataClassifications = parameters.dataClassifications
	}

	if (parameters.statuses && parameters.statuses.length > 0) {
		criteria.statuses = parameters.statuses
	}

	if (parameters.limit !== undefined) {
		criteria.limit = parameters.limit
	}

	if (parameters.offset !== undefined) {
		criteria.offset = parameters.offset
	}

	if (parameters.sortBy) {
		criteria.sortBy = parameters.sortBy
	}

	if (parameters.sortOrder) {
		criteria.sortOrder = parameters.sortOrder
	}

	return criteria
}

/**
 * Transforms delivery configuration from form format to API format
 */
function transformDeliveryConfig(delivery?: ReportFormData['delivery']): DeliveryConfig {
	if (!delivery || !delivery.destinations) {
		return { destinations: 'default' }
	}

	return {
		destinations: delivery.destinations,
	}
}

/**
 * Transforms export configuration from form format to API format
 */
function transformExportConfig(
	format: string,
	exportConfig?: ReportFormData['export']
): ExportConfig {
	// Map format string to ReportFormat enum
	const formatMap: Record<string, ReportFormat> = {
		PDF: 'pdf',
		CSV: 'csv',
		JSON: 'json',
		XLSX: 'xlsx',
		HTML: 'html',
		XML: 'xml',
	}

	const config: ExportConfig = {
		format: formatMap[format] || 'pdf',
		includeMetadata: exportConfig?.includeMetadata ?? true,
		includeIntegrityReport: exportConfig?.includeIntegrityReport ?? false,
		compression: exportConfig?.compression ?? 'none',
	}

	if (exportConfig?.encryption) {
		config.encryption = exportConfig.encryption
	}

	return config
}

/**
 * Transforms form data to CreateScheduledReportInput for API submission
 */
export function transformFormDataToCreateInput(
	formData: ReportFormData,
	userId: string,
	runId?: string
): CreateScheduledReportInput {
	return {
		name: formData.name,
		description: formData.description || undefined,
		templateId: formData.templateId,
		reportType: formData.reportType,
		criteria: transformReportCriteria(formData.parameters),
		format: transformExportConfig(formData.format, formData.export).format,
		schedule: transformScheduleConfig(formData.schedule),
		delivery: transformDeliveryConfig(formData.delivery),
		export: transformExportConfig(formData.format, formData.export),
		notifications: transformNotificationConfig(formData.notifications),
		createdBy: userId,
		updatedBy: userId,
		runId,
		tags: formData.tags || [],
		metadata: formData.metadata,
	}
}

/**
 * Transforms form data to UpdateScheduledReportInput for API submission
 */
export function transformFormDataToUpdateInput(
	formData: Partial<ReportFormData>,
	userId: string,
	runId?: string
): UpdateScheduledReportInput {
	const input: UpdateScheduledReportInput = {
		updatedBy: userId,
		runId,
	}

	// Only include fields that are present in the form data
	if (formData.name !== undefined) {
		input.name = formData.name
	}

	if (formData.description !== undefined) {
		input.description = formData.description || undefined
	}

	if (formData.templateId !== undefined) {
		input.templateId = formData.templateId
	}

	if (formData.reportType !== undefined) {
		input.reportType = formData.reportType
	}

	if (formData.parameters !== undefined) {
		input.criteria = transformReportCriteria(formData.parameters)
	}

	if (formData.format !== undefined) {
		input.format = transformExportConfig(formData.format, formData.export).format
	}

	if (formData.schedule !== undefined) {
		input.schedule = transformScheduleConfig(formData.schedule)
	}

	if (formData.delivery !== undefined) {
		input.delivery = transformDeliveryConfig(formData.delivery)
	}

	if (formData.export !== undefined || formData.format !== undefined) {
		input.export = transformExportConfig(formData.format || 'PDF', formData.export)
	}

	if (formData.notifications !== undefined) {
		input.notifications = transformNotificationConfig(formData.notifications)
	}

	if (formData.tags !== undefined) {
		input.tags = formData.tags
	}

	if (formData.metadata !== undefined) {
		input.metadata = formData.metadata
	}

	return input
}

/**
 * Validates form data before transformation
 */
export function validateFormData(formData: ReportFormData): {
	isValid: boolean
	errors: string[]
} {
	const errors: string[] = []

	// Basic validation
	if (!formData.name || formData.name.trim().length === 0) {
		errors.push('Report name is required')
	}

	if (formData.name && formData.name.length > 255) {
		errors.push('Report name must be 255 characters or less')
	}

	if (formData.description && formData.description.length > 1000) {
		errors.push('Description must be 1000 characters or less')
	}

	// Schedule validation
	if (!formData.schedule.timezone) {
		errors.push('Timezone is required')
	}

	if (formData.schedule.frequency === 'custom' && !formData.schedule.cronExpression) {
		errors.push('Cron expression is required for custom frequency')
	}

	if (formData.schedule.frequency === 'weekly' && formData.schedule.dayOfWeek === undefined) {
		errors.push('Day of week is required for weekly frequency')
	}

	if (formData.schedule.frequency === 'monthly' && !formData.schedule.dayOfMonth) {
		errors.push('Day of month is required for monthly frequency')
	}

	// Date range validation
	if (formData.parameters.dateRange) {
		const { startDate, endDate } = formData.parameters.dateRange
		if (new Date(startDate) > new Date(endDate)) {
			errors.push('Start date must be before or equal to end date')
		}
	}

	// Notification validation
	if (
		(formData.notifications.onSuccess || formData.notifications.onFailure) &&
		(!formData.notifications.recipients || formData.notifications.recipients.length === 0)
	) {
		errors.push('At least one recipient email is required when notifications are enabled')
	}

	// Email validation
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	if (formData.notifications.recipients) {
		for (const email of formData.notifications.recipients) {
			if (!emailRegex.test(email)) {
				errors.push(`Invalid email address: ${email}`)
			}
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
	}
}

/**
 * Type guard to check if form data is complete
 */
export function isCompleteFormData(formData: Partial<ReportFormData>): formData is ReportFormData {
	return !!(
		formData.name &&
		formData.reportType &&
		formData.format &&
		formData.schedule &&
		formData.notifications &&
		formData.parameters
	)
}
