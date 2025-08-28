/**
 * Compliance GraphQL Resolvers
 * Requirements: 3.1, 3.2
 */

import { GraphQLError } from 'graphql'

import type {
	ComplianceReport,
	ComplianceReportType,
	GraphQLContext,
	ReportCriteriaInput,
} from '../types'

export const complianceResolvers = {
	Query: {
		/**
		 * Generate compliance reports
		 * Requirements: 3.1, 3.2
		 */
		complianceReports: async (
			_: any,
			args: {
				type: ComplianceReportType
				criteria: ReportCriteriaInput
			},
			context: GraphQLContext
		): Promise<ComplianceReport> => {
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
				// Ensure organization isolation in criteria
				const reportCriteria = {
					...args.criteria,
					organizationIds: [organizationId],
				}

				let report: any

				// Generate report based on type
				switch (args.type) {
					case 'HIPAA':
						report = await compliance.report.generateHIPAAReport(reportCriteria)
						break
					case 'GDPR':
						report = await compliance.report.generateGDPRReport(reportCriteria)
						break
					case 'INTEGRITY':
						report = await compliance.report.generateIntegrityVerificationReport(reportCriteria)
						break
					/**case 'CUSTOM':
						report = await compliance.report.generateCustomReport(reportCriteria)
						break*/
					default:
						throw new GraphQLError(`Unsupported report type: ${args.type}`, {
							extensions: { code: 'BAD_REQUEST' },
						})
				}

				const complianceReport: ComplianceReport = {
					id: report.reportId || crypto.randomUUID(),
					type: args.type,
					criteria: {
						dateRange: {
							startDate: reportCriteria.dateRange.startDate,
							endDate: reportCriteria.dateRange.endDate,
						},
						organizationIds: reportCriteria.organizationIds,
						includeMetadata: reportCriteria.includeMetadata,
						format: reportCriteria.format,
					},
					generatedAt: new Date().toISOString(),
					status: 'completed',
					summary: {
						totalEvents: report.summary?.totalEvents || 0,
						verifiedEvents: report.summary?.verifiedEvents || 0,
						failedVerifications: report.summary?.failedVerifications || 0,
						complianceScore: report.summary?.complianceScore,
					},
					downloadUrl: report.downloadUrl,
				}

				logger.info('GraphQL compliance report generated', {
					organizationId,
					reportType: args.type,
					reportId: complianceReport.id,
					totalEvents: complianceReport.summary.totalEvents,
				})

				return complianceReport
			} catch (e) {
				if (e instanceof GraphQLError) {
					throw e
				}

				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to generate compliance report via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							reportType: args.type,
							criteria: args.criteria,
						},
					},
					'graphql-api',
					'complianceReports'
				)

				throw new GraphQLError(`Failed to generate compliance report: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},
	},

	// Type resolvers for ComplianceReport
	ComplianceReport: {
		// Add any field-level resolvers if needed
	},
}
