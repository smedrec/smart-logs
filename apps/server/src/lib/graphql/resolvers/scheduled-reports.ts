/**
 * Scheduled Reports GraphQL Resolvers
 * Requirements: 3.1, 3.2
 */

import { GraphQLError } from 'graphql'

import type {
	CreateScheduledReportInput,
	GraphQLContext,
	ReportExecution,
	ScheduledReport,
	UpdateScheduledReportInput,
} from '../types'

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
				const reports = await compliance.scheduled.getScheduledReports(organizationId)

				const scheduledReports: ScheduledReport[] = reports.map((report: any) => ({
					id: report.id.toString(),
					name: report.name,
					description: report.description,
					reportType: report.reportType,
					criteria: {
						dateRange: report.criteria.dateRange,
						organizationIds: report.criteria.organizationIds,
						includeMetadata: report.criteria.includeMetadata,
						format: report.criteria.format,
					},
					schedule: {
						frequency: report.schedule.frequency,
						dayOfWeek: report.schedule.dayOfWeek,
						dayOfMonth: report.schedule.dayOfMonth,
						hour: report.schedule.hour,
						minute: report.schedule.minute,
						timezone: report.schedule.timezone,
					},
					deliveryConfig: {
						method: report.deliveryConfig.method,
						config: report.deliveryConfig.config,
					},
					isActive: report.isActive,
					createdAt: report.createdAt,
					updatedAt: report.updatedAt,
					lastExecution: report.lastExecution
						? {
								id: report.lastExecution.id.toString(),
								reportId: report.id.toString(),
								startedAt: report.lastExecution.startedAt,
								completedAt: report.lastExecution.completedAt,
								status: report.lastExecution.status,
								error: report.lastExecution.error,
								downloadUrl: report.lastExecution.downloadUrl,
							}
						: undefined,
				}))

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
				const report = await compliance.scheduled.getScheduledReport(args.id, organizationId)

				if (!report) {
					return null
				}

				const scheduledReport: ScheduledReport = {
					id: report.id.toString(),
					name: report.name,
					description: report.description,
					reportType: report.reportType,
					criteria: {
						dateRange: report.criteria.dateRange,
						organizationIds: report.criteria.organizationIds,
						includeMetadata: report.criteria.includeMetadata,
						format: report.criteria.format,
					},
					schedule: {
						frequency: report.schedule.frequency,
						dayOfWeek: report.schedule.dayOfWeek,
						dayOfMonth: report.schedule.dayOfMonth,
						hour: report.schedule.hour,
						minute: report.schedule.minute,
						timezone: report.schedule.timezone,
					},
					deliveryConfig: {
						method: report.deliveryConfig.method,
						config: report.deliveryConfig.config,
					},
					isActive: report.isActive,
					createdAt: report.createdAt,
					updatedAt: report.updatedAt,
					lastExecution: report.lastExecution
						? {
								id: report.lastExecution.id.toString(),
								reportId: report.id.toString(),
								startedAt: report.lastExecution.startedAt,
								completedAt: report.lastExecution.completedAt,
								status: report.lastExecution.status,
								error: report.lastExecution.error,
								downloadUrl: report.lastExecution.downloadUrl,
							}
						: undefined,
				}

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
				// Ensure organization isolation
				const reportData = {
					...args.input,
					criteria: {
						...args.input.criteria,
						organizationIds: [organizationId],
					},
				}

				const report = await compliance.scheduled.createScheduledReport(reportData, organizationId)

				const scheduledReport: ScheduledReport = {
					id: report.id.toString(),
					name: report.name,
					description: report.description,
					reportType: report.reportType,
					criteria: {
						dateRange: report.criteria.dateRange,
						organizationIds: report.criteria.organizationIds,
						includeMetadata: report.criteria.includeMetadata,
						format: report.criteria.format,
					},
					schedule: {
						frequency: report.schedule.frequency,
						dayOfWeek: report.schedule.dayOfWeek,
						dayOfMonth: report.schedule.dayOfMonth,
						hour: report.schedule.hour,
						minute: report.schedule.minute,
						timezone: report.schedule.timezone,
					},
					deliveryConfig: {
						method: report.deliveryConfig.method,
						config: report.deliveryConfig.config,
					},
					isActive: report.isActive,
					createdAt: report.createdAt,
					updatedAt: report.updatedAt,
				}

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
				const report = await compliance.scheduled.updateScheduledReport(
					args.id,
					args.input,
					organizationId
				)

				if (!report) {
					throw new GraphQLError('Scheduled report not found', {
						extensions: { code: 'NOT_FOUND' },
					})
				}

				const scheduledReport: ScheduledReport = {
					id: report.id.toString(),
					name: report.name,
					description: report.description,
					reportType: report.reportType,
					criteria: {
						dateRange: report.criteria.dateRange,
						organizationIds: report.criteria.organizationIds,
						includeMetadata: report.criteria.includeMetadata,
						format: report.criteria.format,
					},
					schedule: {
						frequency: report.schedule.frequency,
						dayOfWeek: report.schedule.dayOfWeek,
						dayOfMonth: report.schedule.dayOfMonth,
						hour: report.schedule.hour,
						minute: report.schedule.minute,
						timezone: report.schedule.timezone,
					},
					deliveryConfig: {
						method: report.deliveryConfig.method,
						config: report.deliveryConfig.config,
					},
					isActive: report.isActive,
					createdAt: report.createdAt,
					updatedAt: report.updatedAt,
				}

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
				const success = await compliance.scheduled.deleteScheduledReport(args.id, organizationId)

				logger.info('GraphQL scheduled report deleted', {
					organizationId,
					reportId: args.id,
					success,
				})

				return success
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
				const execution = await compliance.scheduled.executeScheduledReport(args.id, organizationId)

				const reportExecution: ReportExecution = {
					id: execution.id.toString(),
					reportId: args.id,
					startedAt: execution.startedAt,
					completedAt: execution.completedAt,
					status: execution.status,
					error: execution.error,
					downloadUrl: execution.downloadUrl,
				}

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
