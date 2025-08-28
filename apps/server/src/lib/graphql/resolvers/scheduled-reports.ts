/**
 * Scheduled Reports GraphQL Resolvers
 * Requirements: 3.1, 3.2
 */

import { GraphQLError } from 'graphql'

// Import audit package types for compatibility
import type { ReportExecution as AuditReportExecution, ScheduledReportConfig } from '@repo/audit'
import type {
	CreateScheduledReportInput,
	GraphQLContext,
	ReportExecution,
	ScheduledReport,
	UpdateScheduledReportInput,
} from '../types'

/**
 * Convert audit package ScheduledReportConfig to GraphQL ScheduledReport
 */
function mapScheduledReportConfigToGraphQL(config: ScheduledReportConfig): ScheduledReport {
	return {
		id: config.id,
		name: config.name,
		description: config.description,
		reportType: mapReportTypeToGraphQL(config.reportType),
		criteria: {
			dateRange: config.criteria.dateRange,
			organizationIds: config.criteria.organizationIds || [],
			includeMetadata: config.export?.includeMetadata || false,
			format: mapFormatToGraphQL(config.export?.format || config.format),
		},
		schedule: {
			frequency: mapFrequencyToGraphQL(config.schedule.frequency),
			dayOfWeek: config.schedule.dayOfWeek,
			dayOfMonth: config.schedule.dayOfMonth,
			hour: parseInt(config.schedule.time.split(':')[0]),
			minute: parseInt(config.schedule.time.split(':')[1]),
			timezone: config.schedule.timezone || 'UTC',
		},
		deliveryConfig: {
			method: mapDeliveryMethodToGraphQL(config.delivery.method),
			config: {
				recipients: config.delivery.recipients,
				webhookUrl: config.delivery.webhookUrl,
				storageLocation: config.delivery.storageLocation,
			},
		},
		isActive: config.enabled,
		createdAt: config.createdAt,
		updatedAt: config.createdAt, // Audit package doesn't have updatedAt, use createdAt
		lastExecution: undefined, // This would need to be fetched separately if needed
	}
}

/**
 * Convert audit package ReportExecution to GraphQL ReportExecution
 */
function mapReportExecutionToGraphQL(execution: AuditReportExecution): ReportExecution {
	return {
		id: execution.executionId,
		reportId: execution.reportConfigId,
		startedAt: execution.executionTime,
		completedAt: execution.status === 'completed' ? execution.executionTime : undefined,
		status: mapExecutionStatusToGraphQL(execution.status),
		error: execution.error,
		downloadUrl: execution.exportResult?.filename, // Use filename as downloadUrl
	}
}

/**
 * Map report type from audit package to GraphQL
 */
function mapReportTypeToGraphQL(reportType: string): 'HIPAA' | 'GDPR' | 'INTEGRITY' | 'CUSTOM' {
	switch (reportType) {
		case 'HIPAA_AUDIT_TRAIL':
			return 'HIPAA'
		case 'GDPR_PROCESSING_ACTIVITIES':
			return 'GDPR'
		case 'INTEGRITY_VERIFICATION':
			return 'INTEGRITY'
		case 'GENERAL_COMPLIANCE':
		default:
			return 'CUSTOM'
	}
}

/**
 * Map report type from GraphQL to audit package
 */
function mapReportTypeToAudit(reportType: 'HIPAA' | 'GDPR' | 'INTEGRITY' | 'CUSTOM'): string {
	switch (reportType) {
		case 'HIPAA':
			return 'HIPAA_AUDIT_TRAIL'
		case 'GDPR':
			return 'GDPR_PROCESSING_ACTIVITIES'
		case 'INTEGRITY':
			return 'INTEGRITY_VERIFICATION'
		case 'CUSTOM':
		default:
			return 'GENERAL_COMPLIANCE'
	}
}

/**
 * Map format from audit package to GraphQL
 */
function mapFormatToGraphQL(format: string): 'JSON' | 'CSV' | 'XML' {
	switch (format.toLowerCase()) {
		case 'csv':
			return 'CSV'
		case 'xml':
			return 'XML'
		case 'json':
		default:
			return 'JSON'
	}
}

/**
 * Map format from GraphQL to audit package
 */
function mapFormatToAudit(format: 'JSON' | 'CSV' | 'XML'): string {
	return format.toLowerCase()
}

/**
 * Map frequency from audit package to GraphQL
 */
function mapFrequencyToGraphQL(frequency: string): 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' {
	return frequency.toUpperCase() as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'
}

/**
 * Map frequency from GraphQL to audit package
 */
function mapFrequencyToAudit(frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'): string {
	return frequency.toLowerCase()
}

/**
 * Map delivery method from audit package to GraphQL
 */
function mapDeliveryMethodToGraphQL(method: string): 'EMAIL' | 'WEBHOOK' | 'STORAGE' {
	return method.toUpperCase() as 'EMAIL' | 'WEBHOOK' | 'STORAGE'
}

/**
 * Map delivery method from GraphQL to audit package
 */
function mapDeliveryMethodToAudit(method: 'EMAIL' | 'WEBHOOK' | 'STORAGE'): string {
	return method.toLowerCase()
}

/**
 * Map execution status from audit package to GraphQL
 */
function mapExecutionStatusToGraphQL(
	status: string
): 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' {
	switch (status) {
		case 'running':
			return 'RUNNING'
		case 'completed':
			return 'COMPLETED'
		case 'failed':
			return 'FAILED'
		default:
			return 'PENDING'
	}
}

export const scheduledReportResolvers = {
	Query: {
		/**
		 * Get all scheduled reports
		 * Requirements: 3.1, 3.2
		 */
		scheduledReports: async (
			_: any,
			__: any,
			context: GraphQLContext
		): Promise<ScheduledReport[]> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				const allReports = await compliance.scheduled.getScheduledReports()

				// Filter reports by organization for security
				const reports = allReports.filter((report: any) => {
					// Check if the report has organizationId in criteria or as a property
					return (
						report.criteria?.organizationIds?.includes(organizationId) ||
						report.organizationId === organizationId
					)
				})

				const scheduledReports: ScheduledReport[] = reports.map((report) =>
					mapScheduledReportConfigToGraphQL(report)
				)

				logger.info('GraphQL scheduled reports retrieved', {
					organizationId,
					reportCount: scheduledReports.length,
				})

				return scheduledReports
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to get scheduled reports via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
						},
					},
					'graphql-api',
					'scheduledReports'
				)

				throw new GraphQLError(`Failed to get scheduled reports: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},

		/**
		 * Get a single scheduled report by ID
		 * Requirements: 3.1, 3.2
		 */
		scheduledReport: async (
			_: any,
			args: { id: string },
			context: GraphQLContext
		): Promise<ScheduledReport | null> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				const report = await compliance.scheduled.getScheduledReport(args.id)

				if (!report) {
					return null
				}

				// Check organization access
				const hasAccess =
					report.criteria?.organizationIds?.includes(organizationId) ||
					(report as any).organizationId === organizationId

				if (!hasAccess) {
					return null
				}

				const scheduledReport = mapScheduledReportConfigToGraphQL(report)

				logger.info('GraphQL scheduled report retrieved', {
					organizationId,
					reportId: args.id,
				})

				return scheduledReport
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to get scheduled report via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							reportId: args.id,
						},
					},
					'graphql-api',
					'scheduledReport'
				)

				throw new GraphQLError(`Failed to get scheduled report: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},
	},

	Mutation: {
		/**
		 * Create a new scheduled report
		 * Requirements: 3.1, 3.2
		 */
		createScheduledReport: async (
			_: any,
			args: { input: CreateScheduledReportInput },
			context: GraphQLContext
		): Promise<ScheduledReport> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				// Convert GraphQL input to audit package format
				const reportData = {
					name: args.input.name,
					description: args.input.description,
					organizationId,
					reportType: mapReportTypeToAudit(args.input.reportType) as
						| 'HIPAA_AUDIT_TRAIL'
						| 'GDPR_PROCESSING_ACTIVITIES'
						| 'GENERAL_COMPLIANCE'
						| 'INTEGRITY_VERIFICATION',
					criteria: {
						...args.input.criteria,
						organizationIds: [organizationId], // Ensure organization isolation
					},
					format: mapFormatToAudit(args.input.criteria.format || 'JSON') as
						| 'json'
						| 'csv'
						| 'xml'
						| 'pdf',
					schedule: {
						frequency: mapFrequencyToAudit(args.input.schedule.frequency) as
							| 'daily'
							| 'weekly'
							| 'monthly'
							| 'quarterly',
						dayOfWeek: args.input.schedule.dayOfWeek,
						dayOfMonth: args.input.schedule.dayOfMonth,
						time: `${args.input.schedule.hour.toString().padStart(2, '0')}:${args.input.schedule.minute.toString().padStart(2, '0')}`,
						timezone: args.input.schedule.timezone,
					},
					delivery: {
						method: mapDeliveryMethodToAudit(args.input.deliveryConfig.method) as
							| 'email'
							| 'webhook'
							| 'storage',
						recipients: args.input.deliveryConfig.config.recipients,
						webhookUrl: args.input.deliveryConfig.config.webhookUrl,
						storageLocation: args.input.deliveryConfig.config.storageLocation,
					},
					export: {
						format: mapFormatToAudit(args.input.criteria.format || 'JSON') as
							| 'json'
							| 'csv'
							| 'xml'
							| 'pdf',
						includeMetadata: args.input.criteria.includeMetadata || false,
						includeIntegrityReport: false,
					},
					enabled: args.input.isActive !== false,
					createdBy: context.session.session.userId,
				}

				const report = await compliance.scheduled.createScheduledReport(reportData)

				const scheduledReport = mapScheduledReportConfigToGraphQL(report)

				logger.info('GraphQL scheduled report created', {
					organizationId,
					reportId: scheduledReport.id,
					reportName: scheduledReport.name,
				})

				return scheduledReport
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to create scheduled report via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							input: args.input,
						},
					},
					'graphql-api',
					'createScheduledReport'
				)

				throw new GraphQLError(`Failed to create scheduled report: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},

		/**
		 * Update an existing scheduled report
		 * Requirements: 3.1, 3.2
		 */
		updateScheduledReport: async (
			_: any,
			args: { id: string; input: UpdateScheduledReportInput },
			context: GraphQLContext
		): Promise<ScheduledReport> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				// Convert GraphQL input to audit package format
				const updateData: any = {
					updatedBy: context.session.session.userId,
				}

				if (args.input.name) updateData.name = args.input.name
				if (args.input.description !== undefined) updateData.description = args.input.description
				if (args.input.criteria) {
					updateData.criteria = {
						...args.input.criteria,
						organizationIds: [organizationId], // Ensure organization isolation
					}
					if (args.input.criteria.format) {
						updateData.format = mapFormatToAudit(args.input.criteria.format) as
							| 'json'
							| 'csv'
							| 'xml'
							| 'pdf'
					}
				}
				if (args.input.schedule) {
					updateData.schedule = {
						frequency: mapFrequencyToAudit(args.input.schedule.frequency) as
							| 'daily'
							| 'weekly'
							| 'monthly'
							| 'quarterly',
						dayOfWeek: args.input.schedule.dayOfWeek,
						dayOfMonth: args.input.schedule.dayOfMonth,
						time: `${args.input.schedule.hour.toString().padStart(2, '0')}:${args.input.schedule.minute.toString().padStart(2, '0')}`,
						timezone: args.input.schedule.timezone,
					}
				}
				if (args.input.deliveryConfig) {
					updateData.delivery = {
						method: mapDeliveryMethodToAudit(args.input.deliveryConfig.method) as
							| 'email'
							| 'webhook'
							| 'storage',
						recipients: args.input.deliveryConfig.config.recipients,
						webhookUrl: args.input.deliveryConfig.config.webhookUrl,
						storageLocation: args.input.deliveryConfig.config.storageLocation,
					}
				}
				if (args.input.isActive !== undefined) {
					updateData.enabled = args.input.isActive
				}

				const report = await compliance.scheduled.updateScheduledReport(args.id, updateData)

				if (!report) {
					throw new GraphQLError('Scheduled report not found', {
						extensions: { code: 'NOT_FOUND' },
					})
				}

				const scheduledReport = mapScheduledReportConfigToGraphQL(report)

				logger.info('GraphQL scheduled report updated', {
					organizationId,
					reportId: args.id,
				})

				return scheduledReport
			} catch (e) {
				if (e instanceof GraphQLError) {
					throw e
				}

				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to update scheduled report via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							reportId: args.id,
							input: args.input,
						},
					},
					'graphql-api',
					'updateScheduledReport'
				)

				throw new GraphQLError(`Failed to update scheduled report: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},

		/**
		 * Delete a scheduled report
		 * Requirements: 3.1, 3.2
		 */
		deleteScheduledReport: async (
			_: any,
			args: { id: string },
			context: GraphQLContext
		): Promise<boolean> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				await compliance.scheduled.deleteScheduledReport(args.id)

				logger.info('GraphQL scheduled report deleted', {
					organizationId,
					reportId: args.id,
				})

				return true
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to delete scheduled report via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							reportId: args.id,
						},
					},
					'graphql-api',
					'deleteScheduledReport'
				)

				throw new GraphQLError(`Failed to delete scheduled report: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},

		/**
		 * Execute a scheduled report immediately
		 * Requirements: 3.1, 3.2
		 */
		executeScheduledReport: async (
			_: any,
			args: { id: string },
			context: GraphQLContext
		): Promise<ReportExecution> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				const execution = await compliance.scheduled.executeReport(args.id)

				const reportExecution = mapReportExecutionToGraphQL(execution)

				logger.info('GraphQL scheduled report executed', {
					organizationId,
					reportId: args.id,
					executionId: reportExecution.id,
				})

				return reportExecution
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to execute scheduled report via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							reportId: args.id,
						},
					},
					'graphql-api',
					'executeScheduledReport'
				)

				throw new GraphQLError(`Failed to execute scheduled report: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},
	},

	// Type resolvers for ScheduledReport
	ScheduledReport: {
		// Add any field-level resolvers if needed
	},
}
